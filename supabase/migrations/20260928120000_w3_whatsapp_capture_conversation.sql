-- ============================================================================
-- v10.44.0 (W3) — the capture conversation on WhatsApp.
--
--   1. `whatsapp_pending_turns`: one open question per person (a missing amount,
--      a possible duplicate), with what it is waiting to log. It expires after 30
--      minutes; asking something new replaces it. Server-owned (RLS on, no
--      policies), like every WhatsApp table.
--   2. `whatsapp_undo_last`: UNDO removes the entry WhatsApp logged for this
--      person in the last 15 minutes — a soft delete, exactly like deleting it in
--      the app — unless it has been edited in the app since.
--   3. `whatsapp_correct_last`: "no, that was groceries" re-categorises that same
--      entry under the same rules.
--
-- Both act ONLY on a transaction `whatsapp_log_transaction` created (its id is
-- on the inbox row), never on anything the app wrote, never on a "paid Rent"
-- approval (undoing that would also have to rewind the schedule). Both claim the
-- message first, so a replay is silent. Service role only.
--
-- MONEY MODEL: a soft delete and a category change on one ordinary row, the same
-- two edits the app offers. No amount is changed.
-- ============================================================================

BEGIN;

create table if not exists public.whatsapp_pending_turns (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  kind         text not null check (kind in ('missing_amount', 'duplicate_check')),
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '30 minutes',
  resolved_at  timestamptz
);
-- At most one open question per person.
create unique index if not exists uq_wa_pending_open
  on public.whatsapp_pending_turns(profile_id) where resolved_at is null;
alter table public.whatsapp_pending_turns enable row level security;
revoke all on public.whatsapp_pending_turns from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_pending_turns to service_role;

-- The last entry WhatsApp logged for this person, locked, with why it may not be
-- touched. Shared by UNDO and correction.
create or replace function public.whatsapp_last_logged(p_profile_id uuid, p_household_id uuid, p_exclude text)
returns table (inbox_id text, txn_id uuid, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inbox text; v_txn uuid; v_at timestamptz; v_created timestamptz; v_updated timestamptz; v_deleted timestamptz;
  v_ours timestamptz;
begin
  select m.wa_message_id, (m.payload->'parsed'->>'transaction_id')::uuid, m.processed_at,
         (m.payload->>'corrected_at')::timestamptz
    into v_inbox, v_txn, v_at, v_ours
    from public.whatsapp_inbound_messages m
   where m.direction = 'inbound' and m.profile_id = p_profile_id and m.household_id = p_household_id
     and m.wa_message_id <> p_exclude
     and m.payload->'parsed'->>'transaction_id' is not null
     and m.payload->>'undone' is null
   order by m.processed_at desc nulls last
   limit 1;
  if v_txn is null then
    return query select null::text, null::uuid, 'nothing'::text; return;
  end if;
  if v_at < now() - interval '15 minutes' then
    return query select v_inbox, v_txn, 'too_late'::text; return;
  end if;
  select t.created_at, t.updated_at, t.deleted_at into v_created, v_updated, v_deleted
    from public.transactions t where t.id = v_txn and t.household_id = p_household_id for update;
  if not found or v_deleted is not null then
    return query select v_inbox, v_txn, 'nothing'::text; return;
  end if;
  -- Edited in the app since WhatsApp wrote it: that edit is the person's, leave it.
  -- A correction made from WhatsApp also moves updated_at; it records when, so it
  -- is not mistaken for an edit in the app.
  if v_updated > greatest(v_created, coalesce(v_ours, v_created)) + interval '5 seconds' then
    return query select v_inbox, v_txn, 'edited'::text; return;
  end if;
  return query select v_inbox, v_txn, null::text;
end;
$$;

-- Claim the message and check a write role; null when both pass, else the reply status.
create or replace function public.whatsapp_claim_for_write(p_profile_id uuid, p_household_id uuid, p_wa_message_id text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_claimed int; v_role text;
begin
  insert into public.whatsapp_inbound_messages (wa_message_id, profile_id, household_id, direction)
    values (p_wa_message_id, p_profile_id, p_household_id, 'inbound') on conflict (wa_message_id) do nothing;
  update public.whatsapp_inbound_messages set processed_at = now()
   where wa_message_id = p_wa_message_id and processed_at is null;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then return 'duplicate'; end if;
  select role into v_role from public.memberships where household_id = p_household_id and user_id = p_profile_id limit 1;
  if v_role is null then return 'not_a_member'; end if;
  if v_role = 'viewer' then return 'read_only_member'; end if;
  return null;
end;
$$;

create or replace function public.whatsapp_undo_last(p_profile_id uuid, p_household_id uuid, p_wa_message_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_block text; l record; t record;
begin
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  select * into l from public.whatsapp_last_logged(p_profile_id, p_household_id, p_wa_message_id);
  if l.reason is not null then return jsonb_build_object('status', l.reason); end if;

  update public.transactions set deleted_at = now()
   where id = l.txn_id returning amount, currency, type, category into t;
  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('undone', now())
   where wa_message_id = l.inbox_id;
  return jsonb_build_object('status', 'undone', 'transaction_id', l.txn_id,
    'amount', t.amount, 'currency', t.currency, 'type', t.type, 'category_id', t.category);
end;
$$;

create or replace function public.whatsapp_correct_last(
  p_profile_id uuid, p_household_id uuid, p_category text, p_wa_message_id text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_block text; l record; v_type text; t record; v_at timestamptz;
begin
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  select * into l from public.whatsapp_last_logged(p_profile_id, p_household_id, p_wa_message_id);
  if l.reason is not null then return jsonb_build_object('status', l.reason); end if;

  select type into v_type from public.transactions where id = l.txn_id;
  -- Only an expense or an income carries a category; the caller checked the id is
  -- one of that type's categories.
  if v_type not in ('expense', 'income') then return jsonb_build_object('status', 'no_category'); end if;
  update public.transactions set category = p_category
   where id = l.txn_id returning amount, currency, type, category, updated_at into t;
  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('corrected_at', t.updated_at)
   where wa_message_id = l.inbox_id;
  return jsonb_build_object('status', 'corrected', 'transaction_id', l.txn_id,
    'amount', t.amount, 'currency', t.currency, 'type', t.type, 'category_id', t.category);
end;
$$;

revoke all on function public.whatsapp_last_logged(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.whatsapp_claim_for_write(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.whatsapp_undo_last(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.whatsapp_correct_last(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_last_logged(uuid, uuid, text) to service_role;
grant execute on function public.whatsapp_claim_for_write(uuid, uuid, text) to service_role;
grant execute on function public.whatsapp_undo_last(uuid, uuid, text) to service_role;
grant execute on function public.whatsapp_correct_last(uuid, uuid, text, text) to service_role;

COMMIT;
