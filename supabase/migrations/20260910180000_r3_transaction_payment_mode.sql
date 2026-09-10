-- ============================================================================
-- v10.25.0 (Accounts R3) — the payment mode a transaction was made with.
--
-- R2 gave every account the modes it is used with (accounts.payment_modes).
-- This records WHICH of them a transaction used: UPI vs debit card on a bank,
-- swipe vs online on a card.
--
--   transactions.payment_mode  text NULL
--     NULL is valid forever: legacy rows, recurring posts and imports carry
--     none, and an investment never has one. The mode is DESCRIPTIVE — no
--     balance, total, category or net-worth figure reads it.
--
-- The mode set exists in THREE places, like categories: this CHECK (and the
-- accounts CHECK from R2), react/src/lib/accountsView.ts, and the Deno
-- allowlists in _shared/whatsapp-parser.ts + _shared/agent/types.ts. The unit
-- parity tests fail if the TypeScript copies drift.
--
-- whatsapp_log_transaction gains p_payment_mode (default null). It is stored
-- ONLY when the resolved paying account lists that mode — a mode the account
-- does not use is dropped, never an error, so a message still logs.
-- ============================================================================

BEGIN;

alter table public.transactions
  add column if not exists payment_mode text;

alter table public.transactions drop constraint if exists ck_txn_payment_mode;
alter table public.transactions
  add constraint ck_txn_payment_mode check (
    payment_mode is null
    or (type <> 'investment'
        and payment_mode = any (array['upi','debit_card','net_banking','cheque','auto_debit',
                                      'swipe','upi_on_card','online','standing_instruction','cash']))
  );

comment on column public.transactions.payment_mode is
  'v10.25.0 — how the paying account was used (upi, swipe, …). Descriptive only; null for legacy, recurring, imports and every investment.';

-- ── WhatsApp writer: same body as audit-S1, plus the mode ────────────────────
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
  p_date            date default null,
  p_payment_mode    text default null
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
  v_mode          text;
begin
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

  select id into v_cash_id
    from public.accounts
   where household_id = p_household_id and lower(kind) = 'cash'
     and coalesce(is_archived,false) = false and deleted_at is null
   limit 1;

  if p_account_alias is not null and p_account_alias <> '' then
    select id into v_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
       and deleted_at is null
       and (lower(name) = lower(p_account_alias) or lower(kind) = lower(p_account_alias))
     limit 1;
  end if;

  if p_to_account_alias is not null and p_to_account_alias <> '' then
    select id into v_to_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
       and deleted_at is null
       and (lower(name) = lower(p_to_account_alias) or lower(kind) = lower(p_to_account_alias))
     limit 1;
  end if;

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
  else
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

  -- R3: keep the mode only when the PAYING account uses it (income: the
  -- receiving account). Never for an investment. Anything else is dropped.
  if p_payment_mode is not null and p_txn_type <> 'investment' then
    select p_payment_mode into v_mode
      from public.accounts
     where id = case when p_txn_type = 'income' then v_to_account_id else v_account_id end
       and p_payment_mode = any (payment_modes);
  end if;

  insert into public.transactions (
    household_id, created_by, member_id, amount, currency, type, category,
    account_id, to_account_id, date, description, payment_mode
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
    coalesce(nullif(p_description,''), 'Logged via WhatsApp'),
    v_mode
  ) returning id into v_txn_id;

  update public.whatsapp_inbound_messages
     set payload = coalesce(payload,'{}'::jsonb) || jsonb_build_object(
           'parsed', jsonb_build_object(
             'transaction_id', v_txn_id, 'amount', p_amount, 'currency', p_currency,
             'type', p_txn_type, 'category_id', p_category_id,
             'account_id', v_account_id, 'to_account_id', v_to_account_id,
             'payment_mode', p_payment_mode, 'payment_mode_stored', v_mode))
   where wa_message_id = p_wa_message_id;

  return jsonb_build_object(
    'status','success',
    'transaction_id', v_txn_id,
    'amount', p_amount,
    'currency', coalesce(nullif(p_currency,''),'USD'),
    'type', p_txn_type,
    'category_id', p_category_id,
    'payment_mode', v_mode,
    'account_name',    (select name from public.accounts where id = v_account_id),
    'to_account_name', (select name from public.accounts where id = v_to_account_id)
  );
end;
$$;

revoke all on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date,text) from public, anon, authenticated;
grant execute on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date,text) to service_role;

comment on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date,text) is
  'v10.25.0 — WhatsApp/agent transaction writer. v9 CHECK-safe, claim-first idempotent on wa_message_id, p_date backdate-aware, audit-S1 membership gate. p_payment_mode is stored only when the paying account lists it (never for investments); otherwise dropped. Service-role only.';

COMMIT;
