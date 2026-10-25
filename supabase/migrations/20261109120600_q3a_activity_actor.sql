-- Q3a (v10.130.0; audit INT-TXN-14, DB-INT-13, DB-INT-14; owner decisions 20 Oct 2026).
--
-- The household activity log (log_domain_activity) named its actor from auth.uid(), so every entry the server
-- wrote (WhatsApp, the bill and EMI jobs) had no actor, and a soft delete (deleted_at set) read as "updated".
--   - Owner: "the person, else Vyact". Each WhatsApp writer below sets the transaction-local `vyact.actor` to
--     the person the message came from, and the trigger reads it when there is no signed-in user. Scheduled
--     jobs set nothing: no actor, which the apps show as "Vyact (automatic)". A signed-in request always wins,
--     and only these SECURITY DEFINER functions set it (the API cannot set a setting).
--   - Setting deleted_at is logged as "deleted".
-- Each WhatsApp function is its current definition with that one line added at the top; whatsapp_log_transaction
-- also picks an account deterministically (DB-INT-13) and refuses a Loan / EMI expense (DB-INT-14; the webhook
-- already sends those to the loan).

create or replace function public.log_domain_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h       uuid;
  act     text;
  ent     text := tg_table_name;
  ent_id  uuid;
  ch      jsonb;
  actor   uuid := coalesce(auth.uid(), nullif(current_setting('vyact.actor', true), '')::uuid);
begin
  if tg_op = 'INSERT' then
    act    := 'created';
    h      := new.household_id;
    ent_id := new.id;
    ch     := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    -- A soft delete is a delete (the row stays for sync; the person deleted it).
    act    := case when (to_jsonb(old) ->> 'deleted_at') is null and (to_jsonb(new) ->> 'deleted_at') is not null
                   then 'deleted' else 'updated' end;
    h      := new.household_id;
    ent_id := new.id;
    ch     := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    act    := 'deleted';
    h      := old.household_id;
    ent_id := old.id;
    ch     := to_jsonb(old);
  else
    return null;
  end if;

  begin
    insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
    values (h, actor, act, ent, ent_id, ch);
  exception when foreign_key_violation then
    -- The household (or the actor's account) is being deleted in this same transaction.
    null;
  end;

  return null;
end;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_log_transaction(p_profile_id uuid, p_household_id uuid, p_amount numeric, p_currency text, p_txn_type text, p_category_id text, p_account_alias text, p_to_account_alias text, p_wa_message_id text, p_description text, p_date date DEFAULT NULL::date, p_payment_mode text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_member_id     uuid;
  v_member_role   text;
  v_account_id    uuid;
  v_to_account_id uuid;
  v_asset_id      uuid;
  v_cash_id       uuid;
  v_txn_id        uuid;
  v_claimed       int;
  v_date          date;
  v_mode          text;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
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
  -- Q3a (DB-INT-14): a loan payment goes through the loan (whatsapp_pay_loan), never as a plain expense.
  if p_category_id = 'loan_emi' then
    return jsonb_build_object('status','error','reason','loan_emi_needs_loan');
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
     -- Q3a (DB-INT-13; owner, 20 Oct 2026: "use the default"): the account named exactly, else the household's
     -- default when it is of that kind, else the oldest of that kind. The reply names the account.
     order by (lower(name) = lower(p_account_alias)) desc, coalesce(is_default, false) desc, created_at, id
     limit 1;
  end if;

  if p_txn_type = 'investment' then
    -- R4: the destination is an investment ASSET — by name, or the household's
    -- only one when the message names none ("invested 5000").
    if p_to_account_alias is not null and p_to_account_alias <> '' and lower(p_to_account_alias) <> 'investment' then
      select id into v_asset_id from public.assets
       where household_id = p_household_id and deleted_at is null and type = 'investment'
         and lower(name) = lower(p_to_account_alias)
       limit 1;
    end if;
    if v_asset_id is null and (select count(*) from public.assets
                                where household_id = p_household_id and deleted_at is null and type = 'investment') = 1 then
      select id into v_asset_id from public.assets
       where household_id = p_household_id and deleted_at is null and type = 'investment';
    end if;
  elsif p_to_account_alias is not null and p_to_account_alias <> '' then
    select id into v_to_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
       and deleted_at is null
       and (lower(name) = lower(p_to_account_alias) or lower(kind) = lower(p_to_account_alias))
     -- Q3a (DB-INT-13; owner, 20 Oct 2026: "use the default"): the account named exactly, else the household's
     -- default when it is of that kind, else the oldest of that kind. The reply names the account.
     order by (lower(name) = lower(p_to_account_alias)) desc, coalesce(is_default, false) desc, created_at, id
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
  elsif p_txn_type = 'investment' then
    v_account_id := coalesce(v_account_id, v_cash_id);
    v_to_account_id := null;
    if v_account_id is null then
      return jsonb_build_object('status','error','reason','no_source_account');
    end if;
    if v_asset_id is null then
      return jsonb_build_object('status','error','reason','no_investment_asset');
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

  if p_payment_mode is not null and p_txn_type <> 'investment' then
    select p_payment_mode into v_mode
      from public.accounts
     where id = case when p_txn_type = 'income' then v_to_account_id else v_account_id end
       and p_payment_mode = any (payment_modes);
  end if;

  insert into public.transactions (
    household_id, created_by, member_id, amount, currency, type, category,
    account_id, to_account_id, asset_id, date, description, payment_mode
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
    v_asset_id,
    v_date,
    coalesce(nullif(p_description,''), 'Logged via WhatsApp'),
    v_mode
  ) returning id into v_txn_id;

  update public.whatsapp_inbound_messages
     set payload = coalesce(payload,'{}'::jsonb) || jsonb_build_object(
           'parsed', jsonb_build_object(
             'transaction_id', v_txn_id, 'amount', p_amount, 'currency', p_currency,
             'type', p_txn_type, 'category_id', p_category_id,
             'account_id', v_account_id, 'to_account_id', v_to_account_id, 'asset_id', v_asset_id,
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
    -- the confirmation reads "from → to"; for an investment "to" is the asset
    'to_account_name', coalesce((select name from public.accounts where id = v_to_account_id),
                                (select name from public.assets   where id = v_asset_id))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_approve_recurring(p_profile_id uuid, p_household_id uuid, p_schedule_id uuid, p_occurrence date, p_today date, p_next_due date, p_row jsonb, p_wa_message_id text, p_exhausted boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_member_id  uuid;
  v_role       text;
  v_s          public.recurring_schedules%rowtype;
  v_t          jsonb;
  v_claimed    int;
  v_inserted   int;
  v_type       text;
  v_mode       text;
  v_paying     uuid;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
  -- 1. Claim the message, exactly as whatsapp_log_transaction does.
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
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- 2. A write role in this household.
  select id, role into v_member_id, v_role
    from public.memberships
   where household_id = p_household_id and user_id = p_profile_id
   limit 1;
  if v_member_id is null then
    return jsonb_build_object('status', 'error', 'reason', 'not_a_member');
  end if;
  if v_role = 'viewer' then
    return jsonb_build_object('status', 'error', 'reason', 'read_only_member');
  end if;

  -- 3. The schedule, locked, and this occurrence the one due.
  select * into v_s
    from public.recurring_schedules
   where id = p_schedule_id and household_id = p_household_id and deleted_at is null
   for update;
  if not found or not v_s.active then
    return jsonb_build_object('status', 'error', 'reason', 'schedule_unavailable');
  end if;
  v_t := v_s.txn_template;
  if v_s.next_due_date > p_occurrence then
    return jsonb_build_object('status', 'already_done', 'next_due_date', v_s.next_due_date);
  end if;
  if v_s.next_due_date < p_occurrence then
    return jsonb_build_object('status', 'error', 'reason', 'not_the_due_occurrence');
  end if;
  if p_occurrence > p_today then
    return jsonb_build_object('status', 'error', 'reason', 'not_due_yet');
  end if;
  if not coalesce(p_exhausted, false) and (p_next_due is null or p_next_due <= p_occurrence) then
    return jsonb_build_object('status', 'error', 'reason', 'bad_next_due');
  end if;

  v_type := v_t->>'type';
  if v_type not in ('expense', 'income') or coalesce(v_t->>'category', '') = 'loan_emi'
     or nullif(v_t->>'debtId', '') is not null then
    return jsonb_build_object('status', 'error', 'reason', 'approve_in_app');
  end if;

  -- 4. The row must be this occurrence of this template.
  if (p_row->>'recurring_schedule_id')::uuid is distinct from p_schedule_id
     or (p_row->>'household_id')::uuid is distinct from p_household_id
     or (p_row->>'date')::date is distinct from p_occurrence
     or p_row->>'type' is distinct from v_type
     or (p_row->>'amount')::numeric is distinct from (v_t->>'amount')::numeric
     or coalesce(p_row->>'currency', 'USD') is distinct from coalesce(nullif(v_t->>'currency', ''), 'USD') then
    return jsonb_build_object('status', 'error', 'reason', 'row_mismatch');
  end if;

  -- A mode the paying account does not use is dropped, never an error (the
  -- store's rule, and whatsapp_log_transaction's).
  v_mode := nullif(p_row->>'payment_mode', '');
  if v_mode is not null then
    v_paying := case when v_type = 'income' then nullif(p_row->>'to_account_id', '')::uuid
                     else nullif(p_row->>'account_id', '')::uuid end;
    if exists (select 1 from public.accounts a where a.id = v_paying
                 and coalesce(array_length(a.payment_modes, 1), 0) > 0
                 and not (v_mode = any (a.payment_modes))) then
      v_mode := null;
    end if;
  end if;

  -- 5. The app's own row, under the deterministic id.
  insert into public.transactions (
    id, household_id, created_by, member_id, type, amount, currency, date, description,
    category, note, recurring, account_id, to_account_id, initiated_by,
    recurring_schedule_id, debt_id, payment_mode, extras, confidence, source, estimated_at, confirmed_at
  ) values (
    (p_row->>'id')::uuid,
    p_household_id,
    p_profile_id,
    nullif(p_row->>'member_id', '')::uuid,
    v_type,
    (p_row->>'amount')::numeric,
    coalesce(nullif(p_row->>'currency', ''), 'USD'),
    p_occurrence,
    coalesce(p_row->>'description', ''),
    nullif(p_row->>'category', ''),
    nullif(p_row->>'note', ''),
    nullif(p_row->>'recurring', ''),
    nullif(p_row->>'account_id', '')::uuid,
    nullif(p_row->>'to_account_id', '')::uuid,
    nullif(p_row->>'initiated_by', '')::uuid,
    p_schedule_id,
    null,
    v_mode,
    coalesce(p_row->'extras', '{}'::jsonb),
    coalesce(nullif(p_row->>'confidence', ''), 'confirmed'),
    coalesce(nullif(p_row->>'source', ''), 'user'),
    nullif(p_row->>'estimated_at', '')::timestamptz,
    nullif(p_row->>'confirmed_at', '')::timestamptz
  )
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;

  -- 6. Move the schedule on.
  update public.recurring_schedules
     set last_generated = p_occurrence,
         next_due_date  = case when coalesce(p_exhausted, false) then next_due_date else p_next_due end,
         active         = not coalesce(p_exhausted, false)
   where id = p_schedule_id;

  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
           'approved', jsonb_build_object('schedule_id', p_schedule_id, 'occurrence', p_occurrence,
                                          'transaction_id', p_row->>'id', 'inserted', v_inserted = 1))
   where wa_message_id = p_wa_message_id;

  return jsonb_build_object(
    'status', 'success',
    'transaction_id', p_row->>'id',
    'already_posted', v_inserted = 0,
    'amount', (p_row->>'amount')::numeric,
    'currency', coalesce(nullif(p_row->>'currency', ''), 'USD'),
    'description', p_row->>'description',
    'next_due_date', case when coalesce(p_exhausted, false) then null else p_next_due end,
    'finished', coalesce(p_exhausted, false)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_correct_last(p_profile_id uuid, p_household_id uuid, p_category text, p_wa_message_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_block text; l record; v_type text; t record;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
  -- An EMI pays a loan (whatsapp_correct_to_loan); relabelling a plain expense would book it whole as
  -- spending and leave the loan untouched.
  if p_category = 'loan_emi' then return jsonb_build_object('status', 'use_loan_payment'); end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_correct_to_loan(p_profile_id uuid, p_household_id uuid, p_debt_id uuid, p_wa_message_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_block  text;
  l        record;
  t        public.transactions%rowtype;
  d        public.debts%rowtype;
  v_member uuid;
  v_result jsonb;
  v_code   text;
  v_detail text;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  select * into l from public.whatsapp_last_logged(p_profile_id, p_household_id, p_wa_message_id);
  if l.reason is not null then return jsonb_build_object('status', l.reason); end if;

  select * into t from public.transactions where id = l.txn_id;
  if t.type is distinct from 'expense' then return jsonb_build_object('status', 'not_an_expense'); end if;
  select * into d from public.debts
   where id = p_debt_id and household_id = p_household_id and deleted_at is null;
  if not found then return jsonb_build_object('status', 'error', 'reason', 'debt_unavailable'); end if;
  select id into v_member from public.memberships
   where household_id = p_household_id and user_id = p_profile_id limit 1;

  -- The server's split, for the entry's own amount, date and paying account. A refusal is an answer:
  -- the payment's savepoint rolls back and the entry stays as it was.
  begin
    v_result := public.loan_payment_core(p_profile_id, md5('wa-correct-emi:' || t.id::text)::uuid, d.id, 'emi',
      t.amount, t.date, t.account_id, v_member, null, null, null, null);
  exception when sqlstate '22023' or sqlstate '42501' then
    get stacked diagnostics v_code = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('status', 'refused', 'reason', v_code, 'figure', nullif(v_detail, ''),
      'loan', d.name, 'amount', t.amount, 'currency', t.currency);
  end;

  -- The plain expense goes: the payment above replaces it (one entry, never both).
  update public.transactions set deleted_at = now() where id = t.id;
  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('undone', now(),
           'converted_to_loan', jsonb_build_object('debt_id', d.id, 'operation_id', v_result->>'operation_id'))
   where wa_message_id = l.inbox_id;
  return v_result || jsonb_build_object('loan', d.name, 'amount', t.amount, 'currency', t.currency);
end;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_name_entries(p_profile_id uuid, p_household_id uuid, p_wa_message_id text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_block text; v_item jsonb; t record; v_out jsonb := '[]'::jsonb; v_status text;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 10 then
    return jsonb_build_object('status', 'bad_request');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select x.id, x.type, x.category, x.deleted_at, x.created_by,
           coalesce((x.extras->>'excluded')::boolean, false) as excluded
      into t
      from public.transactions x
     where x.id = (v_item->>'id')::uuid and x.household_id = p_household_id
     for update;
    if not found or t.deleted_at is not null then v_status := 'gone';
    elsif t.type <> 'expense' then v_status := 'not_expense';
    elsif t.excluded and t.created_by is distinct from p_profile_id then v_status := 'private';
    elsif t.category not in ('other_expense', 'other') then v_status := 'already_named';
    else
      update public.transactions set category = v_item->>'category' where id = t.id;
      v_status := 'named';
    end if;
    v_out := v_out || jsonb_build_object('id', v_item->>'id', 'status', v_status, 'category', v_item->>'category');
  end loop;
  return jsonb_build_object('status', 'done', 'results', v_out);
end;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_pay_loan(p_profile_id uuid, p_household_id uuid, p_debt_id uuid, p_amount numeric, p_date date, p_wa_message_id text, p_account_alias text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_member  uuid;
  v_role    text;
  v_claimed int;
  d         public.debts%rowtype;
  v_funding uuid;
  v_result  jsonb;
  v_code    text;
  v_detail  text;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
  -- 1. Claim the message, exactly as whatsapp_log_transaction does.
  insert into public.whatsapp_inbound_messages (wa_message_id, profile_id, household_id, direction)
    values (p_wa_message_id, p_profile_id, p_household_id, 'inbound')
    on conflict (wa_message_id) do nothing;
  update public.whatsapp_inbound_messages
     set processed_at = now(),
         profile_id   = coalesce(profile_id, p_profile_id),
         household_id = coalesce(household_id, p_household_id)
   where wa_message_id = p_wa_message_id and processed_at is null;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then return jsonb_build_object('status', 'duplicate'); end if;

  -- 2. A write role in this household.
  select id, role into v_member, v_role from public.memberships
   where household_id = p_household_id and user_id = p_profile_id limit 1;
  if v_member is null then return jsonb_build_object('status', 'error', 'reason', 'not_a_member'); end if;
  if v_role = 'viewer' then return jsonb_build_object('status', 'error', 'reason', 'read_only_member'); end if;

  select * into d from public.debts where id = p_debt_id and household_id = p_household_id and deleted_at is null;
  if not found then return jsonb_build_object('status', 'error', 'reason', 'debt_unavailable'); end if;

  -- 3. The account it was paid from: the one named, else the loan's own, else the household default.
  if nullif(btrim(p_account_alias), '') is not null then
    select id into v_funding from public.accounts
     where household_id = p_household_id and kind in ('bank', 'cash') and deleted_at is null and not is_archived
       and lower(name) like '%' || lower(btrim(p_account_alias)) || '%'
     order by is_default desc, created_at limit 1;
  end if;
  v_funding := coalesce(v_funding,
    (select id from public.accounts where id = d.funding_account_id and kind in ('bank', 'cash') and deleted_at is null and not is_archived),
    (select id from public.accounts where household_id = p_household_id and kind in ('bank', 'cash') and deleted_at is null
        and not is_archived order by is_default desc, (kind = 'bank') desc, created_at limit 1));

  -- 4. The server's split. A refusal is an answer, not a failure: the message stays claimed.
  begin
    v_result := public.loan_payment_core(p_profile_id, md5('wa-loan:' || p_wa_message_id)::uuid, d.id, 'emi',
      p_amount, coalesce(p_date, (now() at time zone 'Asia/Kolkata')::date), v_funding, v_member, null, null, null, null);
  exception when sqlstate '22023' or sqlstate '42501' then
    get stacked diagnostics v_code = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('status', 'refused', 'reason', v_code, 'figure', nullif(v_detail, ''),
      'loan', d.name);
  end;

  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('loan_payment',
           jsonb_build_object('debt_id', d.id, 'operation_id', v_result->>'operation_id'))
   where wa_message_id = p_wa_message_id;
  return v_result || jsonb_build_object('loan', d.name);
end;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_reconcile_account(p_profile_id uuid, p_household_id uuid, p_wa_message_id text, p_account_id uuid, p_expected_offset numeric, p_offset numeric, p_log jsonb, p_at timestamp with time zone, p_bridge jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_block text; a record;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;

  select x.id, x.kind, x.is_archived, x.deleted_at, coalesce(x.reconciliation_offset, 0) as off
    into a
    from public.accounts x
   where x.id = p_account_id and x.household_id = p_household_id
   for update;
  if not found or a.deleted_at is not null or a.is_archived then return jsonb_build_object('status', 'gone'); end if;
  if a.kind not in ('bank', 'credit_card', 'cash') then return jsonb_build_object('status', 'not_supported'); end if;
  -- The plan was computed from this offset; if it moved, the plan is stale.
  if round(a.off, 2) <> round(coalesce(p_expected_offset, 0), 2) then
    return jsonb_build_object('status', 'changed');
  end if;
  if jsonb_typeof(p_log) <> 'array' then return jsonb_build_object('status', 'bad_request'); end if;

  update public.accounts set
    reconciliation_offset = round(p_offset, 2),
    reconciliation_log    = p_log,
    last_reconciled_at    = p_at,
    confidence = 'confirmed', source = 'user', confirmed_at = p_at
   where id = p_account_id;

  -- §6 R-AGG-5 / D2 — the stated value flows to the linked entity (reconcileSlice).
  if p_bridge is not null and p_bridge->>'debt_id' is not null then
    update public.debts set current_balance = greatest(0, (p_bridge->>'current_balance')::numeric),
           confidence = 'confirmed', source = 'user', confirmed_at = p_at
     where id = (p_bridge->>'debt_id')::uuid and household_id = p_household_id and deleted_at is null;
  elsif p_bridge is not null and p_bridge->>'asset_id' is not null then
    update public.assets set value = (p_bridge->>'value')::numeric, last_updated = (p_at at time zone 'UTC')::date,
           confidence = 'confirmed', source = 'user', confirmed_at = p_at
     where id = (p_bridge->>'asset_id')::uuid and household_id = p_household_id and deleted_at is null;
  end if;
  return jsonb_build_object('status', 'reconciled', 'offset', round(p_offset, 2));
end;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_split_even(p_profile_id uuid, p_household_id uuid, p_wa_message_id text, p_txn_id uuid, p_partner_email text, p_split jsonb, p_partner_share numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_block text; t record; v_split uuid;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;

  select x.id, x.type, x.amount, x.currency, x.date, x.description, x.created_by, x.deleted_at, x.extras
    into t from public.transactions x
   where x.id = p_txn_id and x.household_id = p_household_id for update;
  if not found or t.deleted_at is not null then return jsonb_build_object('status', 'gone'); end if;
  if t.type <> 'expense' then return jsonb_build_object('status', 'not_expense'); end if;
  if t.created_by is distinct from p_profile_id then return jsonb_build_object('status', 'not_yours'); end if;
  if t.extras ? 'split' or exists (select 1 from public.shared_splits s where s.txn_id = t.id) then
    return jsonb_build_object('status', 'already_split');
  end if;
  -- The caller built the split from this row; refuse a mismatch rather than store it.
  if round((p_split->>'totalAmount')::numeric, 2) <> round(t.amount, 2)
     or round((p_split->>'yourShare')::numeric + p_partner_share, 2) <> round(t.amount, 2) then
    return jsonb_build_object('status', 'bad_request');
  end if;

  update public.transactions
     set extras = coalesce(extras, '{}'::jsonb) || jsonb_build_object('split', p_split)
   where id = t.id;
  insert into public.shared_splits (owner_user_id, owner_household_id, txn_id, description, currency, total_amount, txn_type, date)
    values (p_profile_id, p_household_id, t.id, t.description, t.currency, t.amount, 'expense', t.date)
    returning id into v_split;
  insert into public.shared_split_shares (split_id, email, share)
    values (v_split, lower(trim(p_partner_email)), p_partner_share);
  return jsonb_build_object('status', 'split', 'split_id', v_split, 'description', t.description,
    'currency', t.currency, 'your_share', (p_split->>'yourShare')::numeric, 'partner_share', p_partner_share);
end;
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_undo_last(p_profile_id uuid, p_household_id uuid, p_wa_message_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_block text; l record; t record;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
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
$function$;

CREATE OR REPLACE FUNCTION public.whatsapp_undo_recurring_post(p_profile_id uuid, p_household_id uuid, p_wa_message_id text, p_txn_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_block text; t record;
begin
  -- Q3a (INT-TXN-14): the activity log names the person this message came from.
  perform set_config('vyact.actor', p_profile_id::text, true);
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  select x.id, x.amount, x.currency, x.date, x.description, x.recurring_schedule_id, x.deleted_at, x.created_at, x.updated_at
    into t from public.transactions x
   where x.id = p_txn_id and x.household_id = p_household_id for update;
  if not found or t.deleted_at is not null then return jsonb_build_object('status', 'gone'); end if;
  if t.recurring_schedule_id is null then return jsonb_build_object('status', 'not_scheduled'); end if;
  -- Edited in the app since it posted: that edit is the person's; leave it.
  if t.updated_at > t.created_at + interval '5 seconds' then return jsonb_build_object('status', 'edited'); end if;
  update public.transactions set deleted_at = now() where id = t.id;
  return jsonb_build_object('status', 'undone', 'description', t.description, 'amount', t.amount,
    'currency', t.currency, 'date', t.date);
end;
$function$;
