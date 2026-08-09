-- ============================================================================
-- WhatsApp workflow phase — atomic ledger insert from an inbound chat message.
-- Companion: whatsapp-vyact-solutioning.md §8 (v2-corrected + re-validated against
-- the live v10.x schema on 2026-08-10). Forward-only, idempotent.
--
-- Called by the `whatsapp-webhook` Edge Function (service role) after the
-- deterministic parser produces a structured transaction. SECURITY DEFINER so it
-- can write under the household's RLS; locked down to service_role only.
--
-- Honors the live CHECK matrix exactly:
--   ck_txn_type            : type ∈ (expense, income, investment, transfer)
--   ck_txn_category_by_type: category NOT NULL for expense/income, NULL otherwise
--   ck_txn_accounts_by_type: expense→account_id only; income→to_account_id only;
--                            transfer/investment→both
-- Attribution uses created_by (auth uid = profiles.id) + member_id (resolved from
-- memberships), never a non-existent profile_id column. Money model unchanged:
-- this inserts a normal transaction exactly like the app.
-- ============================================================================

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
  p_description     text
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
begin
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
    current_date,
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

-- Service-role only (the Edge Function). Deny anon/authenticated/public.
revoke all on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text) to service_role;
