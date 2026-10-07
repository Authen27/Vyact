-- W4e (v10.74.0) — the loan model, ahead of the app that uses it (owner decisions D19, D17, D30;
-- audit INT-TXN-07, FE-MNY-03/04, XC-ARC-02, BE-WA-08, the live "Save failed – payment_out_of_range").
--
-- What was wrong:
--   • Two "outstanding" figures: debts.current_balance (typed, and moved by the old RPC) and the loan
--     account's ledger (what net worth reads). They drifted, and the Debts page and Net Worth disagreed.
--   • record_loan_payment charged a FULL month's interest on every payment, so a prepayment paid a
--     second month of interest, and the final EMI (which is less than a month's EMI) was refused with
--     payment_out_of_range. It had no dates, no instalments, no schedule and no undo.
--   • Credit cards were also "debts", so a card could exist twice — as a debt and as an account.
--
-- The model now (the owner's, 2026-10-07):
--   • OUTSTANDING = the loan ACCOUNT's ledger, only. debts.current_balance is a cache the functions
--     keep equal to it, for older apps. Every live loan gets its account here.
--   • Terms: principal (sanctioned), interest_rate + effective-dated rate_history, tenure_months,
--     first_emi_date (with terms_confirmed — estimated for existing loans until the owner confirms),
--     minimum_payment (the EMI), due_date (the NEXT instalment's date), instalments_paid,
--     auto_record + funding_account_id (used by the server job in a later release).
--   • pay_loan — the SERVER computes the split, per instalment, on a reducing balance:
--       emi           interest first, then principal. Instalment k's interest is fixed when its first
--                     payment arrives (outstanding × rate/12, banker's rounding to the minor unit) and
--                     its amount is min(EMI, outstanding + interest). A payment SHORT of it is accepted
--                     and the instalment stays open; MORE than it is refused (more_than_due) — the extra
--                     is a prepayment (owner).
--       prepayment    all principal; reduce_tenure keeps the EMI, reduce_emi recomputes it over the
--                     instalments that were left. Refused while an instalment is part-paid.
--       payoff        exactly outstanding + the unpaid interest of an instalment already started
--                     (owner); anything else is refused with the exact figure (payoff_amount).
--       bank_override the bank's own interest/principal for the due instalment, which it closes.
--     Each payment is ONE transaction: an interest expense (loan_emi) and a principal transfer into
--     the loan account, under an idempotent operation id.
--   • reverse_loan_payment — undo the LATEST payment on a loan only (owner), atomically.
--   • mark_loan_paid_off — the loan account reconciled to zero (offset + dated log, never a
--     transaction), the loan closed. delete_debt / the delete guard — a loan with money still owed
--     cannot be deleted (D17).
--   • Credit cards are ACCOUNTS (D30, owner): every live credit-card debt moves into a credit-card
--     account (merged with the one already linked to it, else created at its outstanding) and the
--     debt row is archived; a card debt an older app still creates is moved the same way.
--
-- record_loan_payment stays, unchanged, for the app until v10.75.0 stops calling it.

-- ── 1. Terms and instalment tracking on debts ───────────────────────────────────────────────
alter table public.debts
  add column if not exists tenure_months      integer,
  add column if not exists first_emi_date     date,
  add column if not exists terms_confirmed    boolean not null default false,
  add column if not exists rate_history       jsonb   not null default '[]'::jsonb,
  add column if not exists instalments_paid   integer not null default 0,
  add column if not exists auto_record        boolean not null default false,
  add column if not exists funding_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists paid_off_at        timestamptz;
alter table public.debts drop constraint if exists ck_debt_tenure_months;
alter table public.debts add constraint ck_debt_tenure_months check (tenure_months is null or tenure_months between 1 and 600);
alter table public.debts drop constraint if exists ck_debt_instalments_paid;
alter table public.debts add constraint ck_debt_instalments_paid check (instalments_paid >= 0);
alter table public.debts drop constraint if exists ck_debt_rate_history;
alter table public.debts add constraint ck_debt_rate_history check (jsonb_typeof(rate_history) = 'array');

-- ── 2. Payment events carry the instalment they paid ─────────────────────────────────────────
alter table public.loan_payment_events
  add column if not exists kind                text,
  add column if not exists instalment_no       integer,
  add column if not exists instalment_date     date,
  add column if not exists instalment_interest numeric,
  add column if not exists instalment_due      numeric,
  add column if not exists closes_instalment   boolean not null default false,
  add column if not exists emi_before          numeric,
  add column if not exists emi_after           numeric,
  add column if not exists due_date_before     date,
  add column if not exists paid_off            boolean not null default false,
  add column if not exists prepayment_choice   text,
  add column if not exists payment_date        date,
  add column if not exists created_by          uuid references auth.users(id) on delete set null,
  add column if not exists reversed_at         timestamptz,
  add column if not exists reversed_by         uuid references auth.users(id) on delete set null;
alter table public.loan_payment_events drop constraint if exists ck_loan_event_kind;
alter table public.loan_payment_events add constraint ck_loan_event_kind
  check (kind is null or kind in ('emi', 'prepayment', 'payoff', 'bank_override', 'legacy'));
create index if not exists loan_payment_events_debt_live
  on public.loan_payment_events (debt_id, created_at desc) where reversed_at is null;

-- ── 3. The arithmetic (the app mirrors it in lib/loanSchedule.ts; parity-tested) ─────────────
create or replace function public.loan_minor_scale(p_currency text)
returns integer language sql immutable as $$
  select case when p_currency = 'JPY' then 1 else 100 end
$$;

-- The decimals a scale stands for (100 → 2, 1 → 0), so stored amounts carry the currency's own scale.
create or replace function public.loan_digits(p_scale integer)
returns integer language sql immutable as $$
  select length(p_scale::text) - 1
$$;

-- One instalment's interest: outstanding × annual/1200, in minor units, banker's rounding.
create or replace function public.loan_interest(p_outstanding numeric, p_annual numeric, p_scale integer)
returns numeric language sql immutable as $$
  select round((case when u - trunc(u) = 0.5 then trunc(u) + mod(trunc(u), 2) else round(u) end) / p_scale, public.loan_digits(p_scale))
    from (select round(p_outstanding * p_scale) * round(p_annual / 1200, 12) as u) x
$$;

-- The standard EMI P·r(1+r)^n/((1+r)^n−1), rounded UP to the minor unit (so no stub instalment).
create or replace function public.loan_emi(p_outstanding numeric, p_annual numeric, p_months integer, p_scale integer)
returns numeric language sql immutable as $$
  select round(case
    when p_months is null or p_months < 1 or p_outstanding <= 0 then null
    when p_annual = 0 then ceil(p_outstanding * p_scale / p_months) / p_scale
    else ceil(p_outstanding * (p_annual / 1200) / (1 - power(1 + p_annual / 1200, -p_months)) * p_scale - 1e-9) / p_scale
  end, public.loan_digits(p_scale))
$$;

-- Instalments left at this EMI (null when the EMI never clears it).
create or replace function public.loan_instalments_left(p_outstanding numeric, p_annual numeric, p_emi numeric)
returns integer language sql immutable as $$
  select case
    when p_outstanding <= 0 then 0
    when p_emi is null or p_emi <= 0 then null
    when p_annual = 0 then ceil(p_outstanding / p_emi - 1e-9)::integer
    when p_emi <= p_outstanding * p_annual / 1200 then null
    else ceil(-ln(1 - (p_annual / 1200) * p_outstanding / p_emi) / ln(1 + p_annual / 1200) - 1e-9)::integer
  end
$$;

-- The instalment after p_from on the loan's day of month (a 31st falls on a shorter month's last day).
create or replace function public.loan_next_instalment(p_from date, p_anchor_day integer)
returns date language sql immutable as $$
  select (date_trunc('month', p_from) + interval '1 month')::date
         + (least(p_anchor_day,
                  extract(day from (date_trunc('month', p_from) + interval '2 month' - interval '1 day'))::integer) - 1)
$$;

-- The rate on a date: the latest change on or before it; before every change, the first rate.
create or replace function public.loan_rate_on(p_history jsonb, p_current numeric, p_on date)
returns numeric language sql immutable as $$
  select case when p_on is null or jsonb_array_length(coalesce(p_history, '[]'::jsonb)) = 0 then p_current else coalesce(
    (select (e->>'rate')::numeric from jsonb_array_elements(p_history) e
      where (e->>'from')::date <= p_on order by (e->>'from')::date desc limit 1),
    (select (e->>'rate')::numeric from jsonb_array_elements(p_history) e order by (e->>'from')::date asc limit 1),
    p_current) end
$$;

-- A loan account's ledger balance (negative while money is owed): opening + offset + money in − out.
create or replace function public.loan_ledger_balance(p_account uuid)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(a.opening_balance, 0) + coalesce(a.reconciliation_offset, 0)
       + coalesce((select sum(t.amount) from public.transactions t
                    where t.to_account_id = a.id and t.deleted_at is null
                      and t.type in ('income', 'transfer', 'investment')), 0)
       - coalesce((select sum(t.amount) from public.transactions t
                    where t.account_id = a.id and t.deleted_at is null
                      and t.type in ('expense', 'transfer', 'investment')), 0)
    from public.accounts a where a.id = p_account
$$;

-- The loan's account, created at the debt's outstanding when it has none. Locked.
create or replace function public.loan_account_for(p_debt public.debts)
returns public.accounts language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_acc public.accounts%rowtype;
  v_currency text;
begin
  select * into v_acc from public.accounts
   where household_id = p_debt.household_id and debt_id = p_debt.id and kind = 'loan' and deleted_at is null
   order by created_at limit 1 for update;
  if not found then
    select base_currency into v_currency from public.households where id = p_debt.household_id;
    insert into public.accounts (household_id, kind, name, currency, debt_id, opening_balance)
      values (p_debt.household_id, 'loan', p_debt.name, v_currency, p_debt.id, -p_debt.current_balance)
      returning * into v_acc;
  end if;
  return v_acc;
end;
$$;

-- The instalment due and what has been paid toward it. ONE definition, used by pay_loan (which acts on
-- it) and loan_due (which tells the app what pay_loan will accept), so the two can never disagree.
create or replace function public.loan_instalment_state(
  p_debt public.debts, p_outstanding numeric, p_scale integer, p_on date,
  out instalment_no integer, out started boolean, out paid numeric, out interest_paid numeric,
  out interest numeric, out due numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  instalment_no := p_debt.instalments_paid + 1;
  select coalesce(sum(e.amount), 0), coalesce(sum(e.interest), 0), min(e.instalment_interest), min(e.instalment_due), count(*) > 0
    into paid, interest_paid, interest, due, started
    from public.loan_payment_events e
   where e.debt_id = p_debt.id and e.reversed_at is null and e.kind = 'emi' and e.instalment_no = loan_instalment_state.instalment_no;
  if not started then
    interest := public.loan_interest(p_outstanding,
      public.loan_rate_on(p_debt.rate_history, p_debt.interest_rate, coalesce(p_debt.due_date, p_on)), p_scale);
    due := least(p_debt.minimum_payment, p_outstanding + interest);
  end if;
end;
$$;

-- ── 4. Paying a loan ────────────────────────────────────────────────────────────────────────
create or replace function public.loan_payment_result(p_status text, p_operation_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'status', p_status,
    'operation_id', e.operation_id,
    'kind', e.kind,
    'interest', e.interest,
    'principal', e.principal,
    'instalment_no', e.instalment_no,
    'closes_instalment', e.closes_instalment,
    'paid_off', e.paid_off,
    'outstanding_after', greatest(0, -public.loan_ledger_balance(e.loan_account_id)),
    'next_due_date', d.due_date,
    'emi_after', d.minimum_payment,
    'debt', to_jsonb(d),
    'loan_account', to_jsonb(a),
    'transactions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.transactions t
                      where t.id in (e.expense_txn_id, e.transfer_txn_id)))
  from public.loan_payment_events e
  join public.debts d on d.id = e.debt_id
  left join public.accounts a on a.id = e.loan_account_id
  where e.operation_id = p_operation_id
$$;

create or replace function public.loan_payment_core(
  p_actor              uuid,
  p_operation_id       uuid,
  p_debt_id            uuid,
  p_kind               text,
  p_amount             numeric,
  p_date               date,
  p_funding_account_id uuid,
  p_member_id          uuid,
  p_description        text,
  p_prepayment_choice  text,
  p_bank_interest      numeric,
  p_bank_principal     numeric
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  d               public.debts%rowtype;
  acc             public.accounts%rowtype;
  ev              public.loan_payment_events%rowtype;
  v_member        uuid;
  v_currency      text;
  v_scale         integer;
  v_choice        text;
  v_desc          text;
  v_request       jsonb;
  v_outstanding   numeric;
  v_emi           numeric;
  v_rate          numeric;
  v_k             integer;
  v_started       boolean;
  v_paid          numeric;
  v_interest_paid numeric;
  v_i_k           numeric;
  v_due_k         numeric;
  v_interest      numeric := 0;
  v_principal     numeric := 0;
  v_closes        boolean := false;
  v_after         numeric;
  v_emi_after     numeric;
  v_due_after     date;
  v_left          integer;
  v_split         jsonb;
  v_expense       uuid;
  v_transfer      uuid;
begin
  select * into d from public.debts where id = p_debt_id and deleted_at is null for update;
  if not found then raise exception 'debt_unavailable' using errcode = '22023'; end if;
  select id into v_member from public.memberships
   where household_id = d.household_id and user_id = p_actor and role in ('owner', 'admin', 'member') for share;
  if v_member is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  if coalesce(d.direction, 'owed_by_me') <> 'owed_by_me' then raise exception 'not_a_loan' using errcode = '22023'; end if;
  if d.type = 'credit_card' then raise exception 'cards_are_accounts' using errcode = '22023'; end if;
  if p_kind is null or p_kind not in ('emi', 'prepayment', 'payoff', 'bank_override') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if p_operation_id is null or p_date is null or p_amount is null
     or p_amount::text in ('NaN', 'Infinity', '-Infinity') or p_amount <= 0 then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  select base_currency into v_currency from public.households where id = d.household_id;
  v_scale := public.loan_minor_scale(v_currency);
  if p_amount * v_scale <> trunc(p_amount * v_scale) then raise exception 'invalid_precision' using errcode = '22023'; end if;
  v_choice := case when p_kind = 'prepayment' then coalesce(p_prepayment_choice, 'reduce_tenure') end;
  if v_choice is not null and v_choice not in ('reduce_tenure', 'reduce_emi') then
    raise exception 'invalid_strategy' using errcode = '22023';
  end if;
  v_desc := coalesce(nullif(btrim(p_description), ''), d.name || case p_kind
              when 'prepayment' then ' prepayment' when 'payoff' then ' payoff' else ' EMI' end);
  v_request := jsonb_build_object('actor', p_actor, 'debt', p_debt_id, 'kind', p_kind, 'amount', p_amount,
    'date', p_date, 'funding', p_funding_account_id, 'member', p_member_id, 'description', v_desc,
    'choice', v_choice, 'bank_interest', p_bank_interest, 'bank_principal', p_bank_principal);

  -- A retry of the same operation returns what it did the first time; a different request under the
  -- same id is refused.
  select * into ev from public.loan_payment_events where operation_id = p_operation_id;
  if found then
    if ev.debt_id <> p_debt_id or ev.request is distinct from v_request then
      raise exception 'operation_id_reused' using errcode = '22023';
    end if;
    return public.loan_payment_result('duplicate', p_operation_id);
  end if;
  if d.paid_off_at is not null then raise exception 'loan_paid_off' using errcode = '22023'; end if;

  perform 1 from public.accounts where id = p_funding_account_id and household_id = d.household_id
     and kind in ('cash', 'bank') and deleted_at is null and not is_archived for share;
  if not found then raise exception 'funding_account_invalid' using errcode = '22023'; end if;
  if p_member_id is not null then
    perform 1 from public.memberships where id = p_member_id and household_id = d.household_id for share;
    if not found then raise exception 'member_invalid' using errcode = '22023'; end if;
    v_member := p_member_id;
  end if;

  -- The outstanding is the loan account's ledger, and nothing else.
  acc := public.loan_account_for(d);
  v_outstanding := -public.loan_ledger_balance(acc.id);
  if v_outstanding <= 0 then raise exception 'loan_paid_off' using errcode = '22023'; end if;
  v_emi := d.minimum_payment;

  -- The instalment due, and what has been paid toward it so far.
  select s.instalment_no, s.started, s.paid, s.interest_paid, s.interest, s.due
    into v_k, v_started, v_paid, v_interest_paid, v_i_k, v_due_k
    from public.loan_instalment_state(d, v_outstanding, v_scale, p_date) s;

  if p_kind = 'emi' then
    if v_emi is null or v_emi <= 0 then raise exception 'no_emi' using errcode = '22023'; end if;
    if p_amount > v_due_k - v_paid then
      raise exception 'more_than_due' using errcode = '22023', detail = (v_due_k - v_paid)::text;
    end if;
    v_interest := least(p_amount, greatest(v_i_k - v_interest_paid, 0));
    v_principal := p_amount - v_interest;
    v_closes := (v_paid + p_amount = v_due_k);
  elsif p_kind = 'prepayment' then
    if v_started then raise exception 'instalment_open' using errcode = '22023', detail = (v_due_k - v_paid)::text; end if;
    if p_amount > v_outstanding then
      raise exception 'more_than_outstanding' using errcode = '22023', detail = v_outstanding::text;
    end if;
    v_principal := p_amount;
  elsif p_kind = 'payoff' then
    v_interest := case when v_started then greatest(v_i_k - v_interest_paid, 0) else 0 end;
    if p_amount <> v_outstanding + v_interest then
      raise exception 'payoff_amount' using errcode = '22023', detail = (v_outstanding + v_interest)::text;
    end if;
    v_principal := v_outstanding;
    v_closes := v_started;
  else -- bank_override
    if v_started then raise exception 'instalment_open' using errcode = '22023', detail = (v_due_k - v_paid)::text; end if;
    if p_bank_interest is null or p_bank_principal is null or p_bank_interest < 0 or p_bank_principal < 0
       or p_bank_interest + p_bank_principal <> p_amount or p_bank_principal > v_outstanding
       or p_bank_interest * v_scale <> trunc(p_bank_interest * v_scale)
       or p_bank_principal * v_scale <> trunc(p_bank_principal * v_scale) then
      raise exception 'bank_figures_invalid' using errcode = '22023';
    end if;
    v_interest := p_bank_interest;
    v_principal := p_bank_principal;
    v_i_k := p_bank_interest;
    v_due_k := p_amount;
    v_closes := true;
  end if;

  v_after := v_outstanding - v_principal;
  v_emi_after := v_emi;
  if p_kind = 'prepayment' and v_choice = 'reduce_emi' and v_after > 0 then
    v_rate := public.loan_rate_on(d.rate_history, d.interest_rate, coalesce(d.due_date, p_date));
    v_left := public.loan_instalments_left(v_outstanding, v_rate, v_emi);
    if v_left is null then raise exception 'non_amortizing_payment' using errcode = '22023'; end if;
    v_emi_after := public.loan_emi(v_after, v_rate, v_left, v_scale);
  end if;
  v_due_after := case
    when v_after = 0 then null
    when v_closes and d.due_date is not null then
      public.loan_next_instalment(d.due_date, extract(day from coalesce(d.first_emi_date, d.due_date))::integer)
    else d.due_date end;

  -- The legs: interest is spending (Loan / EMI), principal moves money into the loan account.
  v_split := jsonb_build_object('interest', v_interest, 'principal', v_principal, 'debt_id', d.id,
    'kind', p_kind, 'instalment_no', case when p_kind = 'prepayment' then null else v_k end,
    'operation_id', p_operation_id, 'partPaymentChoice', v_choice);
  if v_interest > 0 then
    insert into public.transactions (household_id, created_by, member_id, amount, currency, type, category,
      account_id, debt_id, date, description, extras)
    values (d.household_id, p_actor, v_member, v_interest, v_currency, 'expense', 'loan_emi',
      p_funding_account_id, d.id, p_date, v_desc,
      jsonb_build_object('emi_split', v_split, 'linkedDebtId', d.id))
    returning id into v_expense;
  end if;
  if v_principal > 0 then
    insert into public.transactions (household_id, created_by, member_id, amount, currency, type, category,
      account_id, to_account_id, debt_id, date, description, extras)
    values (d.household_id, p_actor, v_member, v_principal, v_currency, 'transfer', null,
      p_funding_account_id, acc.id, d.id, p_date, v_desc || ' - principal',
      jsonb_build_object('emi_split', v_split, 'linkedDebtId', d.id, 'linkedTxnId', v_expense))
    returning id into v_transfer;
  end if;

  update public.debts
     set current_balance  = v_after,
         minimum_payment  = v_emi_after,
         instalments_paid = instalments_paid + case when v_closes then 1 else 0 end,
         due_date         = v_due_after,
         paid_off_at      = case when v_after = 0 then now() else paid_off_at end,
         updated_at       = now()
   where id = d.id;

  insert into public.loan_payment_events (
    operation_id, household_id, debt_id, expense_txn_id, transfer_txn_id, loan_account_id,
    amount, interest, principal, request, kind, instalment_no, instalment_date, instalment_interest,
    instalment_due, closes_instalment, emi_before, emi_after, due_date_before, paid_off,
    prepayment_choice, payment_date, created_by)
  values (
    p_operation_id, d.household_id, d.id, v_expense, v_transfer, acc.id,
    p_amount, v_interest, v_principal, v_request, p_kind,
    case when p_kind = 'prepayment' then null else v_k end, d.due_date,
    case when p_kind = 'prepayment' then null else v_i_k end,
    case when p_kind = 'prepayment' then null else v_due_k end,
    v_closes, v_emi, v_emi_after, d.due_date, v_after = 0, v_choice, p_date, p_actor);

  return public.loan_payment_result('success', p_operation_id);
end;
$$;

create or replace function public.pay_loan(
  p_operation_id       uuid,
  p_debt_id            uuid,
  p_kind               text,
  p_amount             numeric,
  p_date               date,
  p_funding_account_id uuid,
  p_member_id          uuid    default null,
  p_description        text    default null,
  p_prepayment_choice  text    default null,
  p_bank_interest      numeric default null,
  p_bank_principal     numeric default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  return public.loan_payment_core(auth.uid(), p_operation_id, p_debt_id, p_kind, p_amount, p_date,
    p_funding_account_id, p_member_id, p_description, p_prepayment_choice, p_bank_interest, p_bank_principal);
end;
$$;

-- What pay_loan will accept today, for the app's Pay form: the instalment due (number, date, its
-- interest, the amount still due), the exact payoff figure, and the latest payment (undo). Any member
-- may read it; nothing is written (a loan without its account yet reads the debt's own figure).
create or replace function public.loan_due(p_debt_id uuid, p_on date default null)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  d public.debts%rowtype;
  s record;
  v_scale integer;
  v_outstanding numeric;
  v_acc uuid;
  v_latest public.loan_payment_events%rowtype;
begin
  select * into d from public.debts where id = p_debt_id and deleted_at is null;
  if not found or not public.is_member(d.household_id) then raise exception 'debt_unavailable' using errcode = '22023'; end if;
  v_scale := public.loan_minor_scale((select base_currency from public.households where id = d.household_id));
  select id into v_acc from public.accounts where debt_id = d.id and kind = 'loan' and deleted_at is null order by created_at limit 1;
  v_outstanding := public.loan_outstanding(d);
  select * into s from public.loan_instalment_state(d, v_outstanding, v_scale, coalesce(p_on, current_date));
  select * into v_latest from public.loan_payment_events e
   where e.debt_id = d.id and e.reversed_at is null and coalesce(e.kind, '') <> 'legacy'
   order by e.created_at desc, e.operation_id desc limit 1;
  return jsonb_build_object(
    'outstanding', v_outstanding,
    'emi', d.minimum_payment,
    'paid_off', d.paid_off_at is not null or v_outstanding = 0,
    'instalment_no', s.instalment_no,
    'due_date', d.due_date,
    'interest', s.interest,
    'due', s.due,
    'paid', s.paid,
    'remaining', greatest(s.due - s.paid, 0),
    'started', s.started,
    'payoff', v_outstanding + case when s.started then greatest(s.interest - s.interest_paid, 0) else 0 end,
    'loan_account_id', v_acc,
    'latest_payment', case when v_latest.operation_id is null then null else jsonb_build_object(
      'operation_id', v_latest.operation_id, 'kind', v_latest.kind, 'amount', v_latest.amount,
      'date', v_latest.payment_date, 'created_at', v_latest.created_at) end);
end;
$$;

-- ── 5. Undo the latest payment (owner: the latest only) ───────────────────────────────────────
create or replace function public.reverse_loan_payment(p_operation_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  ev public.loan_payment_events%rowtype;
  d  public.debts%rowtype;
  v_actor uuid := auth.uid();
begin
  if v_actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into ev from public.loan_payment_events where operation_id = p_operation_id;
  if not found then raise exception 'payment_unavailable' using errcode = '22023'; end if;
  select * into d from public.debts where id = ev.debt_id for update;
  perform 1 from public.memberships
   where household_id = d.household_id and user_id = v_actor and role in ('owner', 'admin', 'member');
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  -- Locked: re-read the event under the debt's lock.
  select * into ev from public.loan_payment_events where operation_id = p_operation_id;
  if ev.reversed_at is not null then return jsonb_build_object('status', 'already_reversed'); end if;
  if ev.kind = 'legacy' then raise exception 'cannot_undo_legacy' using errcode = '22023'; end if;
  if exists (select 1 from public.loan_payment_events e
              where e.debt_id = ev.debt_id and e.reversed_at is null and e.operation_id <> ev.operation_id
                and (e.created_at, e.operation_id) > (ev.created_at, ev.operation_id)) then
    raise exception 'not_latest_payment' using errcode = '22023';
  end if;

  update public.transactions set deleted_at = now(), updated_at = now()
   where id in (ev.expense_txn_id, ev.transfer_txn_id) and deleted_at is null;
  update public.loan_payment_events set reversed_at = now(), reversed_by = v_actor where operation_id = ev.operation_id;
  update public.debts
     set minimum_payment  = coalesce(ev.emi_before, minimum_payment),
         instalments_paid = greatest(0, instalments_paid - case when ev.closes_instalment then 1 else 0 end),
         due_date         = case when ev.kind is not null then ev.due_date_before else due_date end,
         paid_off_at      = case when ev.paid_off then null else paid_off_at end,
         current_balance  = case when ev.loan_account_id is not null
                                 then greatest(0, -public.loan_ledger_balance(ev.loan_account_id))
                                 else current_balance + ev.principal end,
         updated_at       = now()
   where id = d.id
  returning * into d;

  return jsonb_build_object('status', 'reversed', 'debt', to_jsonb(d),
    'removed_transaction_ids', to_jsonb(array_remove(array[ev.expense_txn_id, ev.transfer_txn_id], null)),
    'outstanding', greatest(0, -public.loan_ledger_balance(ev.loan_account_id)));
end;
$$;

-- ── 6. Closing and deleting a loan (D17) ────────────────────────────────────────────────────
create or replace function public.mark_loan_paid_off(p_debt_id uuid, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  d   public.debts%rowtype;
  acc public.accounts%rowtype;
  v_actor uuid := auth.uid();
  v_owed numeric;
begin
  if v_actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into d from public.debts where id = p_debt_id and deleted_at is null for update;
  if not found then raise exception 'debt_unavailable' using errcode = '22023'; end if;
  perform 1 from public.memberships
   where household_id = d.household_id and user_id = v_actor and role in ('owner', 'admin', 'member');
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if coalesce(d.direction, 'owed_by_me') <> 'owed_by_me' then raise exception 'not_a_loan' using errcode = '22023'; end if;

  -- Reconcile, never post: the outstanding goes to zero through the account's offset, with a dated log.
  acc := public.loan_account_for(d);
  v_owed := -public.loan_ledger_balance(acc.id);
  if v_owed <> 0 then
    update public.accounts
       set reconciliation_offset = coalesce(reconciliation_offset, 0) + v_owed,
           reconciliation_log = coalesce(reconciliation_log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
             'at', now(), 'delta', v_owed, 'kind', 'loan', 'stated_value', 0,
             'note', coalesce(nullif(btrim(p_note), ''), 'Marked paid off'))),
           last_reconciled_at = now(), updated_at = now()
     where id = acc.id;
  end if;
  update public.accounts set is_archived = true, updated_at = now() where id = acc.id;
  update public.debts
     set current_balance = 0, due_date = null, auto_record = false,
         paid_off_at = coalesce(paid_off_at, now()), updated_at = now()
   where id = d.id
  returning * into d;
  return jsonb_build_object('status', 'paid_off', 'written_off', v_owed, 'debt', to_jsonb(d));
end;
$$;

create or replace function public.loan_outstanding(p_debt public.debts)
returns numeric language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(
    (select greatest(0, -public.loan_ledger_balance(a.id)) from public.accounts a
      where a.debt_id = p_debt.id and a.kind = 'loan' and a.deleted_at is null order by a.created_at limit 1),
    p_debt.current_balance)
$$;

create or replace function public.delete_debt(p_debt_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  d public.debts%rowtype;
  v_actor uuid := auth.uid();
  v_owed numeric;
begin
  if v_actor is null then raise exception 'not_authorized' using errcode = '42501'; end if;
  select * into d from public.debts where id = p_debt_id and deleted_at is null for update;
  if not found then return jsonb_build_object('status', 'already_deleted'); end if;
  perform 1 from public.memberships
   where household_id = d.household_id and user_id = v_actor and role in ('owner', 'admin', 'member');
  if not found then raise exception 'not_authorized' using errcode = '42501'; end if;
  if coalesce(d.direction, 'owed_by_me') = 'owed_by_me' then
    v_owed := public.loan_outstanding(d);
    if v_owed > 0 then raise exception 'debt_not_paid_off' using errcode = 'P0001', detail = v_owed::text; end if;
    update public.accounts set is_archived = true, updated_at = now()
     where debt_id = d.id and kind = 'loan' and deleted_at is null;
  end if;
  update public.debts set deleted_at = now(), updated_at = now(),
         paid_off_at = case when coalesce(direction, 'owed_by_me') = 'owed_by_me' then coalesce(paid_off_at, now()) else paid_off_at end
   where id = d.id;
  return jsonb_build_object('status', 'deleted');
end;
$$;

-- Every other path (an older app's delete) is held to the same rule.
create or replace function public.debts_refuse_unpaid_delete()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- A debt deleted ON ITS OWN is guarded. A household being deleted (the account purge, W1b) takes its
  -- debts with it by cascade: by then the household row is already gone, and that must not be blocked.
  if (tg_op = 'DELETE' or (new.deleted_at is not null and old.deleted_at is null))
     and coalesce(old.direction, 'owed_by_me') = 'owed_by_me' and old.type <> 'credit_card'
     and exists (select 1 from public.households h where h.id = old.household_id)
     and public.loan_outstanding(old) > 0 then
    raise exception 'debt_not_paid_off' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
drop trigger if exists trg_debts_refuse_unpaid_delete on public.debts;
create trigger trg_debts_refuse_unpaid_delete
  before update of deleted_at or delete on public.debts
  for each row execute function public.debts_refuse_unpaid_delete();

-- ── 7. Credit cards are accounts (D30) ──────────────────────────────────────────────────────
create or replace function public.move_card_debt_to_account(p_debt_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  d public.debts%rowtype;
  v_acc uuid;
  v_currency text;
begin
  select * into d from public.debts where id = p_debt_id for update;
  if not found or d.type is distinct from 'credit_card' or coalesce(d.direction, 'owed_by_me') <> 'owed_by_me'
     or d.deleted_at is not null then
    return null;
  end if;
  -- The card account already linked to it holds the outstanding (net worth already counted it once).
  select id into v_acc from public.accounts
   where debt_id = d.id and kind = 'credit_card' and deleted_at is null order by created_at limit 1;
  if v_acc is null then
    select base_currency into v_currency from public.households where id = d.household_id;
    insert into public.accounts (household_id, kind, name, currency, opening_balance, debt_id, payment_modes)
      values (d.household_id, 'credit_card', d.name, v_currency, -d.current_balance, d.id, array['swipe', 'online'])
      returning id into v_acc;
  end if;
  update public.debts set deleted_at = now(), updated_at = now() where id = d.id;
  return v_acc;
end;
$$;

create or replace function public.debts_card_to_account()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.move_card_debt_to_account(new.id);
  return null;
end;
$$;
drop trigger if exists trg_debts_card_to_account on public.debts;
create trigger trg_debts_card_to_account
  after insert on public.debts
  for each row when (new.type = 'credit_card' and new.deleted_at is null)
  execute function public.debts_card_to_account();

-- ── 8. Existing rows ────────────────────────────────────────────────────────────────────────
-- 8a. Cards move into card accounts.
select public.move_card_debt_to_account(id) from public.debts
 where type = 'credit_card' and coalesce(direction, 'owed_by_me') = 'owed_by_me' and deleted_at is null;

-- 8b. Every live loan gets its account, at the outstanding the household sees today (net worth unchanged:
--     the debt row counted it before; the account counts it now, once).
insert into public.accounts (household_id, kind, name, currency, opening_balance, debt_id)
select d.household_id, 'loan', d.name, h.base_currency, -d.current_balance, d.id
  from public.debts d join public.households h on h.id = d.household_id
 where d.deleted_at is null and coalesce(d.direction, 'owed_by_me') = 'owed_by_me' and d.type <> 'credit_card'
   and not exists (select 1 from public.accounts a where a.debt_id = d.id and a.kind = 'loan' and a.deleted_at is null);

-- 8c. Terms, estimated from what each loan recorded (terms_confirmed stays false until the owner
--     confirms them in the app, which shows them as estimates meanwhile).
update public.debts
   set tenure_months = (extras->>'tenureMonths')::integer
 where tenure_months is null and coalesce(extras->>'tenureMonths', '') ~ '^[0-9]{1,3}$'
   and (extras->>'tenureMonths')::integer between 1 and 600;
update public.debts d
   set instalments_paid = greatest(0, coalesce(
         d.tenure_months - coalesce(
           case when coalesce(d.extras->>'remainingMonths', '') ~ '^[0-9]{1,3}$' then (d.extras->>'remainingMonths')::integer end,
           public.loan_instalments_left(public.loan_outstanding(d), d.interest_rate, d.minimum_payment)),
         (select count(*) from public.loan_payment_events e where e.debt_id = d.id)::integer, 0))
 where d.deleted_at is null and coalesce(d.direction, 'owed_by_me') = 'owed_by_me' and d.type <> 'credit_card';
update public.debts
   set first_emi_date = (due_date - make_interval(months => instalments_paid))::date
 where first_emi_date is null and due_date is not null and deleted_at is null
   and coalesce(direction, 'owed_by_me') = 'owed_by_me' and type <> 'credit_card';
update public.debts d
   set paid_off_at = now()
 where d.deleted_at is null and d.paid_off_at is null and coalesce(d.direction, 'owed_by_me') = 'owed_by_me'
   and d.type <> 'credit_card' and public.loan_outstanding(d) = 0;

-- 8d. The payment log a debt kept in its extras becomes events (history only: no entries are posted).
insert into public.loan_payment_events (operation_id, household_id, debt_id, amount, interest, principal,
                                        request, kind, payment_date, created_at)
select case when x.e->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (x.e->>'id')::uuid else gen_random_uuid() end,
       d.household_id, d.id,
       coalesce((x.e->>'amount')::numeric, 0), coalesce((x.e->>'interest')::numeric, 0),
       coalesce((x.e->>'principal')::numeric, 0),
       jsonb_build_object('legacy', true, 'entry', x.e), 'legacy',
       case when coalesce(x.e->>'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then left(x.e->>'date', 10)::date end,
       coalesce(case when coalesce(x.e->>'date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then left(x.e->>'date', 10)::timestamptz end, d.created_at)
  from public.debts d
  cross join lateral jsonb_array_elements(
    case when jsonb_typeof(d.extras->'paymentLog') = 'array' then d.extras->'paymentLog' else '[]'::jsonb end) as x(e)
 where not exists (select 1 from public.loan_payment_events p
                    where p.operation_id::text = x.e->>'id')
on conflict (operation_id) do nothing;

-- ── 9. Who may call what ────────────────────────────────────────────────────────────────────
revoke all on function public.loan_payment_core(uuid, uuid, uuid, text, numeric, date, uuid, uuid, text, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.loan_payment_core(uuid, uuid, uuid, text, numeric, date, uuid, uuid, text, text, numeric, numeric) to service_role;
revoke all on function public.pay_loan(uuid, uuid, text, numeric, date, uuid, uuid, text, text, numeric, numeric) from public, anon;
grant execute on function public.pay_loan(uuid, uuid, text, numeric, date, uuid, uuid, text, text, numeric, numeric) to authenticated;
revoke all on function public.reverse_loan_payment(uuid) from public, anon;
grant execute on function public.reverse_loan_payment(uuid) to authenticated;
revoke all on function public.mark_loan_paid_off(uuid, text) from public, anon;
grant execute on function public.mark_loan_paid_off(uuid, text) to authenticated;
revoke all on function public.delete_debt(uuid) from public, anon;
grant execute on function public.delete_debt(uuid) to authenticated;
revoke all on function public.loan_due(uuid, date) from public, anon;
grant execute on function public.loan_due(uuid, date) to authenticated;
revoke all on function public.loan_instalment_state(public.debts, numeric, integer, date) from public, anon, authenticated;
revoke all on function public.move_card_debt_to_account(uuid) from public, anon, authenticated;
revoke all on function public.loan_account_for(public.debts) from public, anon, authenticated;
revoke all on function public.loan_ledger_balance(uuid) from public, anon, authenticated;
revoke all on function public.loan_outstanding(public.debts) from public, anon, authenticated;
revoke all on function public.loan_payment_result(text, uuid) from public, anon, authenticated;
