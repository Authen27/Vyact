-- v10.20 · whatsapp_log_transaction — accept an explicit transaction date
--
-- WHY THIS IS A CORRECTNESS FIX, NOT AN ENHANCEMENT
-- The v10.18 RPC hardcodes `current_date` for every row it writes. That was fine
-- when the only input was a human typing "850 groceries hdfc" as it happened.
-- It is WRONG for the agent's actual use case: a bank SMS is routinely
-- BACKDATED. "Rs.850 debited ... on 14-08" forwarded on the 20th must land on
-- the 14th, or the ledger silently misstates which month the money moved — and
-- that error is invisible to the user, because the amount and account are right.
--
-- The resolver already parses the real date (agent/resolver.ts parseLooseDate,
-- day-first, never defaulting to today). This RPC was the last place that threw
-- it away.
--
-- WHY DROP-AND-RECREATE RATHER THAN `create or replace`
-- Adding a defaulted parameter changes the signature, so `create or replace`
-- would create an OVERLOAD rather than replace the function. The existing
-- 10-argument call in whatsapp-webhook would then match BOTH candidates and
-- Postgres would raise 42725 "function ... is not unique" — breaking WhatsApp
-- logging in production. So the old signature is dropped explicitly first.
--
-- BACKWARD COMPATIBLE AT THE CALL SITE: p_date defaults to null and null falls
-- back to current_date, so the existing 10-argument caller keeps working
-- unchanged and can adopt the parameter later.
--
-- NOTE: `drop function` also drops its grants, so they are re-issued below for
-- the new signature. Forgetting that would leave the RPC callable by nobody and
-- WhatsApp logging would fail closed.

BEGIN;

drop function if exists public.whatsapp_log_transaction(
  uuid, uuid, numeric, text, text, text, text, text, text, text
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
  -- ISO date of the transaction as stated by the SOURCE (the SMS), not the
  -- moment we happened to receive it. Null => today, preserving v10.18 behaviour.
  p_date            date default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id     uuid;
  v_account_id    uuid;
  v_to_account_id uuid;
  v_cash_id       uuid;
  v_txn_id        uuid;
  v_claimed       int;
  v_date          date;
begin
  -- Sanity-clamp the incoming date. An extractor reading a garbled SMS must not
  -- be able to write a transaction dated 1900 or next year: a future-dated row
  -- corrupts "this month" on every dashboard that reads it. Out-of-range falls
  -- back to today rather than raising, because losing the DATE is recoverable
  -- and losing the TRANSACTION is not.
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

  -- Idempotency claim-first: ensure the inbound row exists, then claim it by
  -- flipping processed_at only if still unprocessed. Concurrent deliveries lose
  -- the race (0 rows) and return 'duplicate' without inserting.
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

  -- Resolve the household member backing this profile (nullable is fine).
  select id into v_member_id
    from public.memberships
   where household_id = p_household_id and user_id = p_profile_id
   limit 1;

  -- Cash fallback account for this household.
  select id into v_cash_id
    from public.accounts
   where household_id = p_household_id and lower(kind) = 'cash' and coalesce(is_archived,false) = false
   limit 1;

  -- Resolve source alias (name or kind).
  if p_account_alias is not null and p_account_alias <> '' then
    select id into v_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
       and (lower(name) = lower(p_account_alias) or lower(kind) = lower(p_account_alias))
     limit 1;
  end if;

  -- Resolve destination alias (name or kind).
  if p_to_account_alias is not null and p_to_account_alias <> '' then
    select id into v_to_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
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
    -- income names its destination via account_alias; to_account_alias unused.
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

-- Grants must be re-issued: `drop function` above discarded the originals, and
-- without these the RPC would be executable by nobody and WhatsApp logging
-- would fail closed. Service-role only (the Edge Function); deny everyone else.
revoke all on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date) from public, anon, authenticated;
grant execute on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date) to service_role;

comment on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date) is
  'v10.20 — WhatsApp/agent transaction writer. Honors the v9 CHECK matrix, claim-first idempotent on wa_message_id. p_date carries the date stated by the SOURCE (a bank SMS is routinely backdated); null => current_date. Out-of-range dates clamp to today rather than raising.';

COMMIT;
