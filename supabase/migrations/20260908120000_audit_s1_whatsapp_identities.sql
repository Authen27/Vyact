-- ============================================================================
-- Audit S1 (2026-09-08) — WhatsApp verified identity moves to a server-owned
-- table; inbound writer revalidates membership + write role.
--
-- THE HOLE THIS CLOSES
-- phone_number / phone_verified_at / whatsapp_household_id sat on `profiles`,
-- covered only by "users update own profile" (id = auth.uid()). Any
-- authenticated user could self-assert a phone-verification state and pick a
-- household reference, and whatsapp_log_transaction then resolved membership
-- but explicitly tolerated a NULL result — a fabricated link could log
-- transactions into someone else's household.
--
-- THE FIX
--   1. `whatsapp_identities` — server-owned (RLS enabled, NO policies →
--      deny-all to anon/authenticated; Edge Functions use the service role,
--      which bypasses RLS). This is the only place a verified phone ↔
--      profile ↔ household binding may be written.
--   2. The legacy profiles columns are frozen by trigger: any non-service-role
--      UPDATE that changes them raises 42501. Ordinary profile edits (display
--      name, formats) pass — the guard fires only when those three columns
--      actually change.
--   3. whatsapp_log_transaction now REJECTS absent membership and viewer
--      (read-only) members instead of logging with a null member, and its
--      account resolution excludes soft-deleted rows.
--
-- The profiles columns are left in place (deprecated) so the previous Edge
-- Function deploy keeps working during the migration→deploy window; nothing
-- may write them client-side after this lands.
-- ============================================================================

BEGIN;

-- ── 1. Server-owned identity table ─────────────────────────────────────────
create table if not exists public.whatsapp_identities (
  profile_id   uuid primary key references public.profiles(id) on delete cascade,
  phone_number text not null,
  household_id uuid not null references public.households(id) on delete cascade,
  verified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
-- One phone number ↔ one identity, globally.
create unique index if not exists uq_whatsapp_identities_phone
  on public.whatsapp_identities(phone_number);

alter table public.whatsapp_identities enable row level security;
-- Deliberately NO policies: deny-all to anon/authenticated.
revoke all on public.whatsapp_identities from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_identities to service_role;

-- Backfill from the legacy columns (verified links only).
insert into public.whatsapp_identities (profile_id, phone_number, household_id, verified_at)
select id, phone_number, whatsapp_household_id, phone_verified_at
  from public.profiles
 where phone_number is not null
   and phone_verified_at is not null
   and whatsapp_household_id is not null
on conflict (profile_id) do nothing;

-- ── 2. Freeze the legacy columns against client writes ─────────────────────
create or replace function public.guard_whatsapp_profile_columns()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_claims text;
  v_role   text;
begin
  -- The service role (Edge Functions) manages these columns; everyone else —
  -- including the row owner and direct-SQL sessions (no JWT claims) — may not
  -- change them.
  v_claims := nullif(current_setting('request.jwt.claims', true), '');
  v_role := case when v_claims is null then ''
                 else coalesce(v_claims::jsonb ->> 'role', '') end;
  if v_role = 'service_role' then
    return new;
  end if;
  if new.phone_number is not distinct from old.phone_number
     and new.phone_verified_at is not distinct from old.phone_verified_at
     and new.whatsapp_household_id is not distinct from old.whatsapp_household_id then
    return new;  -- untouched by this UPDATE — ordinary profile edit
  end if;
  raise exception 'phone_number, phone_verified_at and whatsapp_household_id are server-managed; use the WhatsApp link flow'
    using errcode = '42501';
end $$;

drop trigger if exists trg_guard_whatsapp_profile_columns on public.profiles;
create trigger trg_guard_whatsapp_profile_columns
before update on public.profiles
for each row execute function public.guard_whatsapp_profile_columns();

-- ── 3. Harden the inbound writer ───────────────────────────────────────────
-- Same signature as 20260906130000 (drop+recreate because grants are dropped
-- with the function; re-issued below).
drop function if exists public.whatsapp_log_transaction(
  uuid, uuid, numeric, text, text, text, text, text, text, text, date
);

create or replace function public.whatsapp_log_transaction(
  p_profile_id      uuid,
  p_household_id    uuid,
  p_amount          numeric,
  p_currency        text,
  p_txn_type        text,
  p_category_id     text,
  p_account_alias   text,
  p_to_account_alias text,
  p_wa_message_id   text,
  p_description     text,
  p_date            date default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id     uuid;
  v_member_role   text;
  v_account_id    uuid;
  v_to_account_id uuid;
  v_cash_id       uuid;
  v_txn_id        uuid;
  v_claimed       int;
  v_date          date;
begin
  -- Sanity-clamp the incoming date (see 20260906130000 for the rationale).
  v_date := coalesce(p_date, current_date);
  if v_date > current_date + interval '2 days' or v_date < current_date - interval '5 years' then
    v_date := current_date;
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('status','error','reason','invalid_amount');
  end if;
  if p_txn_type not in ('expense','income','investment','transfer') then
    return jsonb_build_object('status','error','reason','invalid_type');
  end if;

  -- Idempotency claim-first (unchanged from v10.18/v10.20).
  insert into public.whatsapp_inbound_messages (wa_message_id, profile_id, household_id, direction)
    values (p_wa_message_id, p_profile_id, p_household_id, 'inbound')
    on conflict (wa_message_id) do nothing;

  update public.whatsapp_inbound_messages
     set processed_at = now(),
         profile_id   = coalesce(profile_id, p_profile_id),
         household_id = coalesce(household_id, p_household_id)
   where wa_message_id = p_wa_message_id and processed_at is null;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return jsonb_build_object('status','duplicate');
  end if;

  -- Audit S1: membership is now MANDATORY and must carry a write role. The
  -- previous version noted "nullable is fine" — with the identity link now
  -- client-forgeable no longer, this is the second gate: a revoked member (or
  -- a viewer) cannot log, even while their identity row still exists.
  select id, role into v_member_id, v_member_role
    from public.memberships
   where household_id = p_household_id and user_id = p_profile_id
   limit 1;
  if v_member_id is null then
    return jsonb_build_object('status','error','reason','not_a_member');
  end if;
  if v_member_role = 'viewer' then
    return jsonb_build_object('status','error','reason','read_only_member');
  end if;

  -- Cash fallback account for this household (audit S1: exclude soft-deleted).
  select id into v_cash_id
    from public.accounts
   where household_id = p_household_id and lower(kind) = 'cash'
     and coalesce(is_archived,false) = false and deleted_at is null
   limit 1;

  -- Resolve source alias (name or kind).
  if p_account_alias is not null and p_account_alias <> '' then
    select id into v_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
       and deleted_at is null
       and (lower(name) = lower(p_account_alias) or lower(kind) = lower(p_account_alias))
     limit 1;
  end if;

  -- Resolve destination alias (name or kind).
  if p_to_account_alias is not null and p_to_account_alias <> '' then
    select id into v_to_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
       and deleted_at is null
       and (lower(name) = lower(p_to_account_alias) or lower(kind) = lower(p_to_account_alias))
     limit 1;
  end if;

  -- Apply the per-type account matrix + cash fallbacks.
  if p_txn_type = 'expense' then
    v_account_id := coalesce(v_account_id, v_cash_id);
    v_to_account_id := null;
    if v_account_id is null then
      return jsonb_build_object('status','error','reason','no_source_account');
    end if;
  elsif p_txn_type = 'income' then
    v_to_account_id := coalesce(v_to_account_id, v_account_id, v_cash_id);
    v_account_id := null;
    if v_to_account_id is null then
      return jsonb_build_object('status','error','reason','no_destination_account');
    end if;
  else  -- transfer / investment: both required, must differ
    v_account_id := coalesce(v_account_id, v_cash_id);
    if v_account_id is null then
      return jsonb_build_object('status','error','reason','no_source_account');
    end if;
    if v_to_account_id is null then
      return jsonb_build_object('status','error','reason','no_destination_account');
    end if;
    if v_to_account_id = v_account_id then
      return jsonb_build_object('status','error','reason','same_account');
    end if;
  end if;

  insert into public.transactions (
    household_id, created_by, member_id, amount, currency, type, category,
    account_id, to_account_id, date, description
  ) values (
    p_household_id,
    p_profile_id,
    v_member_id,
    p_amount,
    coalesce(nullif(p_currency,''), 'USD'),
    p_txn_type,
    case when p_txn_type in ('expense','income')
         then coalesce(nullif(p_category_id,''), case when p_txn_type='expense' then 'other_expense' else 'other_income' end)
         else null end,
    v_account_id,
    v_to_account_id,
    v_date,
    coalesce(nullif(p_description,''), 'Logged via WhatsApp')
  ) returning id into v_txn_id;

  -- Store the parsed result on the audit row for traceability.
  update public.whatsapp_inbound_messages
     set payload = coalesce(payload,'{}'::jsonb) || jsonb_build_object(
           'parsed', jsonb_build_object(
             'transaction_id', v_txn_id, 'amount', p_amount, 'currency', p_currency,
             'type', p_txn_type, 'category_id', p_category_id,
             'account_id', v_account_id, 'to_account_id', v_to_account_id))
   where wa_message_id = p_wa_message_id;

  return jsonb_build_object(
    'status','success',
    'transaction_id', v_txn_id,
    'amount', p_amount,
    'currency', coalesce(nullif(p_currency,''),'USD'),
    'type', p_txn_type,
    'category_id', p_category_id,
    'account_name',    (select name from public.accounts where id = v_account_id),
    'to_account_name', (select name from public.accounts where id = v_to_account_id)
  );
end;
$$;

revoke all on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date) from public, anon, authenticated;
grant execute on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date) to service_role;

comment on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date) is
  'v10.20+audit-S1 — WhatsApp/agent transaction writer. v9 CHECK-safe, claim-first idempotent on wa_message_id, p_date backdate-aware (null => today, out-of-range clamps). Audit S1: membership is mandatory and viewers are rejected; account resolution excludes soft-deleted rows. Service-role only.';

COMMIT;
