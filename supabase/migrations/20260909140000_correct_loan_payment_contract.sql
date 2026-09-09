BEGIN;

alter table public.loan_payment_events add column if not exists request jsonb;

create or replace function public.record_loan_payment(
  p_operation_id uuid, p_debt_id uuid, p_funding_account_id uuid,
  p_amount numeric, p_currency text, p_date date,
  p_interest numeric, p_principal numeric, p_member_id uuid default null,
  p_description text default null, p_new_balance numeric default null,
  p_new_remaining_months integer default null, p_new_minimum_payment numeric default null,
  p_payment_log_entry jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  debt_row public.debts%rowtype;
  payment_event public.loan_payment_events%rowtype;
  account_row public.accounts%rowtype;
  actor_id uuid := auth.uid();
  member_id uuid;
  request_body jsonb;
  strategy text := p_payment_log_entry->>'partChoice';
  payment_date date := coalesce(p_date, current_date);
  payment_description text;
  currency_scale numeric;
  interest_units numeric;
  interest_amount numeric;
  principal_amount numeric;
  balance_after numeric;
  remaining integer;
  minimum_after numeric;
  monthly_rate numeric;
  payment_log jsonb;
  split_details jsonb;
  is_extra boolean;
  expense_id uuid;
  transfer_id uuid;
begin
  select * into debt_row from public.debts
    where id = p_debt_id and deleted_at is null for update;
  if not found or actor_id is null then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  select id into member_id from public.memberships
    where household_id = debt_row.household_id and user_id = actor_id
      and role in ('owner', 'admin', 'member') for share;
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;

  if p_operation_id is null or p_date is null or p_amount is null
      or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount <= 0
      or p_currency is distinct from debt_row.currency
      or coalesce(debt_row.direction, 'owed_by_me') <> 'owed_by_me' then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  if strategy is not null and strategy not in ('reduce_tenure','reduce_emi','apply_advance') then
    raise exception 'invalid_strategy' using errcode = '22023';
  end if;
  payment_description := coalesce(nullif(p_description,''), debt_row.name || ' EMI');
  request_body := jsonb_build_object('actor', actor_id, 'debt', p_debt_id,
    'funding', p_funding_account_id, 'amount', p_amount, 'currency', p_currency,
    'date', payment_date, 'strategy', strategy, 'member', p_member_id,
    'description', payment_description);

  select * into payment_event from public.loan_payment_events where operation_id = p_operation_id;
  if found then
    if payment_event.household_id <> debt_row.household_id
        or payment_event.debt_id <> p_debt_id
        or payment_event.request is distinct from request_body then
      raise exception 'operation_id_reused' using errcode = '22023';
    end if;
    select * into account_row from public.accounts where id = payment_event.loan_account_id;
    return jsonb_build_object('status','duplicate', 'debt', to_jsonb(debt_row),
      'loan_account', to_jsonb(account_row),
      'expense_txn_id', payment_event.expense_txn_id, 'transfer_txn_id', payment_event.transfer_txn_id,
      'loan_account_id', payment_event.loan_account_id,
      'transactions', (select coalesce(jsonb_agg(to_jsonb(txn)), '[]'::jsonb)
        from public.transactions txn where id in (payment_event.expense_txn_id, payment_event.transfer_txn_id)));
  end if;

  perform 1 from public.accounts where id = p_funding_account_id
    and household_id = debt_row.household_id and kind in ('cash','bank')
    and currency = p_currency and deleted_at is null and not is_archived for share;
  if not found then raise exception 'funding_account_invalid' using errcode = '22023'; end if;
  if p_member_id is not null then
    perform 1 from public.memberships where id = p_member_id and household_id = debt_row.household_id for share;
    if not found then raise exception 'member_invalid' using errcode = '22023'; end if;
    member_id := p_member_id;
  end if;
  if p_currency not in ('USD','EUR','GBP','INR','JPY','AUD','CAD','CHF','CNY','AED','SGD','BRL') then
    raise exception 'unsupported_currency' using errcode = '22023';
  end if;
  currency_scale := case when p_currency = 'JPY' then 1 else 100 end;
  if p_amount * currency_scale <> trunc(p_amount * currency_scale) then
    raise exception 'invalid_precision' using errcode = '22023';
  end if;
  monthly_rate := debt_row.interest_rate / 1200;
  interest_units := round(debt_row.current_balance * currency_scale) * round(monthly_rate, 12);
  interest_amount := (case when interest_units - trunc(interest_units) = 0.5
    then trunc(interest_units) + mod(trunc(interest_units), 2)
    else round(interest_units) end) / currency_scale;
  if p_amount < interest_amount or p_amount > debt_row.current_balance + interest_amount then
    raise exception 'payment_out_of_range' using errcode = '22023';
  end if;
  principal_amount := p_amount - interest_amount;
  balance_after := debt_row.current_balance - principal_amount;
  if p_new_balance is distinct from balance_after or p_interest is distinct from interest_amount
      or p_principal is distinct from principal_amount then
    raise exception 'payment_state_changed_refresh_required' using errcode = '40001';
  end if;

  remaining := greatest(0, coalesce((debt_row.extras->>'remainingMonths')::integer,
    (debt_row.extras->>'tenureMonths')::integer, 0) - 1);
  minimum_after := debt_row.minimum_payment;
  is_extra := p_amount > minimum_after * 1.05;
  if balance_after = 0 then
    remaining := 0;
  elsif is_extra and strategy = 'reduce_tenure' then
    if minimum_after <= monthly_rate * balance_after then
      raise exception 'non_amortizing_payment' using errcode = '22023';
    end if;
    remaining := case when monthly_rate = 0 then ceil(balance_after / minimum_after)
      else ceil(-ln(1 - monthly_rate * balance_after / minimum_after) / ln(1 + monthly_rate)) end;
  elsif is_extra and strategy = 'reduce_emi' then
    if remaining < 1 then raise exception 'invalid_remaining_tenure' using errcode = '22023'; end if;
    minimum_after := case when monthly_rate = 0 then balance_after / remaining
      else balance_after * monthly_rate / (1 - power(1 + monthly_rate, -remaining)) end;
  elsif is_extra and strategy = 'apply_advance' then
    if minimum_after <= 0 then raise exception 'invalid_minimum_payment' using errcode = '22023'; end if;
    remaining := greatest(0, remaining - floor((p_amount - minimum_after) / minimum_after)::integer);
  end if;

  select * into account_row from public.accounts where household_id = debt_row.household_id
    and debt_id = p_debt_id and kind = 'loan' and deleted_at is null for update;
  if not found then
    insert into public.accounts (household_id, kind, name, currency, debt_id, opening_balance)
      values (debt_row.household_id, 'loan', debt_row.name, debt_row.currency, p_debt_id, -debt_row.current_balance)
      returning * into account_row;
  elsif account_row.currency <> debt_row.currency or account_row.is_archived then
    raise exception 'loan_account_invalid' using errcode = '22023';
  end if;

  split_details := jsonb_build_object('interest', interest_amount, 'principal', principal_amount,
    'debt_id', p_debt_id, 'partPaymentChoice', strategy);
  if interest_amount > 0 then
    insert into public.transactions (household_id, created_by, member_id, amount, currency,
      type, category, account_id, debt_id, date, description, extras)
    values (debt_row.household_id, actor_id, member_id, interest_amount, p_currency,
      'expense', 'loan_emi', p_funding_account_id, p_debt_id, payment_date, payment_description,
      jsonb_build_object('emi_split', split_details, 'linkedDebtId', p_debt_id)) returning id into expense_id;
  end if;
  if principal_amount > 0 then
    insert into public.transactions (household_id, created_by, member_id, amount, currency,
      type, category, account_id, to_account_id, debt_id, date, description, extras)
    values (debt_row.household_id, actor_id, member_id, principal_amount, p_currency,
      'transfer', null, p_funding_account_id, account_row.id, p_debt_id, payment_date,
      payment_description || ' - principal', jsonb_build_object('emi_split', split_details,
        'linkedDebtId', p_debt_id, 'linkedTxnId', expense_id)) returning id into transfer_id;
  end if;
  payment_log := jsonb_build_object('id', p_operation_id, 'date', payment_date, 'amount', p_amount,
    'interest', interest_amount, 'principal', principal_amount, 'outstandingAfter', balance_after,
    'isPartPayment', is_extra, 'partChoice', strategy);
  update public.debts set current_balance = balance_after, minimum_payment = minimum_after,
    extras = coalesce(extras, '{}'::jsonb) || jsonb_build_object('remainingMonths', remaining,
      'paymentLog', coalesce(extras->'paymentLog', '[]'::jsonb) || jsonb_build_array(payment_log)), updated_at = now()
    where id = p_debt_id returning * into debt_row;
  insert into public.loan_payment_events (operation_id, household_id, debt_id, expense_txn_id,
    transfer_txn_id, loan_account_id, amount, interest, principal, request)
    values (p_operation_id, debt_row.household_id, p_debt_id, expense_id, transfer_id,
      account_row.id, p_amount, interest_amount, principal_amount, request_body);
  return jsonb_build_object('status','success', 'debt', to_jsonb(debt_row),
    'loan_account', to_jsonb(account_row), 'expense_txn_id', expense_id,
    'transfer_txn_id', transfer_id, 'loan_account_id', account_row.id,
    'transactions', (select coalesce(jsonb_agg(to_jsonb(txn)), '[]'::jsonb)
      from public.transactions txn where id in (expense_id, transfer_id)));
end;
$$;

revoke all on function public.record_loan_payment(uuid,uuid,uuid,numeric,text,date,numeric,numeric,uuid,text,numeric,integer,numeric,jsonb) from public, anon;
grant execute on function public.record_loan_payment(uuid,uuid,uuid,numeric,text,date,numeric,numeric,uuid,text,numeric,integer,numeric,jsonb) to authenticated;

COMMIT;