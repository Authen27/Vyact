-- ============================================================================
-- Audit F2 (2026-09-08) — record_loan_payment: ONE atomic command for an EMI.
--
-- THE BUGS THIS REPLACES
--   1. The client EMI branch was unreachable from the transaction form (the
--      form pre-assigns an id; the branch required `!t.id`), so a loan EMI was
--      stored as a plain expense — no interest/principal split, no debt
--      re-amortisation, silently.
--   2. The intended path wrote expense → principal leg → account → debt
--      SEQUENTIALLY from the browser; a failure mid-way left a half-written
--      payment.
--   3. The loan account was linked via accounts.asset_id = debt.id — a column
--      whose FK points at assets, not debts, so the cloud write violated
--      23503 the moment the branch ever ran. (Explicit linkage instead:
--      accounts.debt_id — audit §8.2.)
--
-- THE DIVISION OF LABOUR (matches "the model never computes money" rule)
--   The RE-AMORTISATION MATH (interest/principal split, tenure/EMI strategy)
--   stays in the parity-tested TypeScript port (lib/amortization.ts). This RPC
--   VALIDATES the decomposition's shape (interest+principal = amount, tenancy,
--   non-negative, within outstanding) and applies all writes in ONE
--   transaction, idempotent on p_operation_id so a retried call cannot
--   double-post.
-- ============================================================================

BEGIN;

-- ── 1. Explicit account ↔ debt linkage (audit §8.2) ────────────────────────
-- asset_id stays for asset-backed accounts; debt_id is the loan/credit-card
-- counterpart. Nullable; one loan account per debt in practice.
alter table public.accounts
  add column if not exists debt_id uuid references public.debts(id) on delete set null;
create index if not exists accounts_debt
  on public.accounts (household_id, debt_id) where debt_id is not null;

-- ── 2. Idempotency + audit record for the command ──────────────────────────
create table if not exists public.loan_payment_events (
  operation_id    uuid primary key,
  household_id    uuid not null references public.households(id) on delete cascade,
  debt_id         uuid not null references public.debts(id) on delete cascade,
  expense_txn_id  uuid references public.transactions(id) on delete set null,
  transfer_txn_id uuid references public.transactions(id) on delete set null,
  loan_account_id uuid references public.accounts(id) on delete set null,
  amount          numeric not null,
  interest        numeric not null,
  principal       numeric not null,
  created_at      timestamptz not null default now()
);
alter table public.loan_payment_events enable row level security;
-- Members may READ their household's events (retry/duplicate visibility);
-- only this function (security definer) writes them.
create policy "members read own household loan payment events"
  on public.loan_payment_events for select using (is_member(household_id));

-- ── 3. The command ─────────────────────────────────────────────────────────
create or replace function public.record_loan_payment(
  p_operation_id         uuid,
  p_debt_id              uuid,
  p_funding_account_id   uuid,
  p_amount               numeric,
  p_currency             text,
  p_date                 date,
  p_interest             numeric,
  p_principal            numeric,
  p_member_id            uuid default null,
  p_description          text default null,
  p_new_balance          numeric default null,
  p_new_remaining_months integer default null,
  p_new_minimum_payment  numeric default null,
  p_payment_log_entry    jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hid             uuid;
  v_debt            public.debts%rowtype;
  v_expense_id      uuid;
  v_transfer_id     uuid;
  v_loan_account_id uuid;
  v_existing        public.loan_payment_events%rowtype;
  v_claimed         uuid;
begin
  -- 0. Idempotency: a retried operation returns its original outcome and
  --    writes nothing twice.
  select * into v_existing from public.loan_payment_events
   where operation_id = p_operation_id;
  if found then
    return jsonb_build_object('status','duplicate',
      'expense_txn_id',  v_existing.expense_txn_id,
      'transfer_txn_id', v_existing.transfer_txn_id,
      'loan_account_id', v_existing.loan_account_id);
  end if;

  -- 1. Debt must exist, be live; lock it so concurrent payments serialise.
  select * into v_debt from public.debts
   where id = p_debt_id and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('status','error','reason','debt_not_found');
  end if;
  v_hid := v_debt.household_id;

  -- 2. Caller must hold a WRITE role in the debt's household (viewer blocked).
  if coalesce(role_in(v_hid), 'viewer') not in ('owner','admin','member') then
    return jsonb_build_object('status','error','reason','not_authorized');
  end if;

  -- 3. Funding account must belong to the SAME household and be usable.
  if not exists (
    select 1 from public.accounts
     where id = p_funding_account_id and household_id = v_hid
       and deleted_at is null and coalesce(is_archived,false) = false
  ) then
    return jsonb_build_object('status','error','reason','funding_account_invalid');
  end if;

  -- 4. Decomposition shape: non-negative legs that sum to the amount, within
  --    the outstanding balance. The arithmetic itself was computed by the
  --    parity-tested client port; here we refuse anything that does not
  --    reconcile.
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('status','error','reason','invalid_amount');
  end if;
  if p_interest is null or p_principal is null or p_interest < 0 or p_principal < 0 then
    return jsonb_build_object('status','error','reason','invalid_split');
  end if;
  if abs((p_interest + p_principal) - p_amount) > 0.01 then
    return jsonb_build_object('status','error','reason','split_mismatch');
  end if;
  if p_interest = 0 and p_principal = 0 then
    return jsonb_build_object('status','error','reason','empty_payment');
  end if;
  if p_new_balance is not null and (p_new_balance < 0 or p_new_balance > v_debt.current_balance + 0.01) then
    return jsonb_build_object('status','error','reason','balance_out_of_range');
  end if;

  -- 5. Claim the operation id (second concurrent caller becomes a duplicate).
  insert into public.loan_payment_events (operation_id, household_id, debt_id, amount, interest, principal)
  values (p_operation_id, v_hid, p_debt_id, p_amount, p_interest, p_principal)
  on conflict (operation_id) do nothing
  returning operation_id into v_claimed;
  if v_claimed is null then
    select * into v_existing from public.loan_payment_events where operation_id = p_operation_id;
    return jsonb_build_object('status','duplicate',
      'expense_txn_id',  v_existing.expense_txn_id,
      'transfer_txn_id', v_existing.transfer_txn_id,
      'loan_account_id', v_existing.loan_account_id);
  end if;

  -- 6. Find-or-create the linked loan (liability) account — via debt_id,
  --    NOT the asset FK that broke the old path (audit F2 sub-2).
  select id into v_loan_account_id from public.accounts
   where household_id = v_hid and debt_id = p_debt_id and kind = 'loan'
     and deleted_at is null
   limit 1;
  if v_loan_account_id is null then
    insert into public.accounts (household_id, kind, name, currency, debt_id)
    values (v_hid, 'loan', v_debt.name, v_debt.currency, p_debt_id)
    returning id into v_loan_account_id;
  end if;

  -- 7. Interest leg — the visible expense (the only leg that counts as spend).
  --    transactions.amount is CHECK(amount > 0), so a zero-interest leg
  --    (0%-APR loan) is simply not written.
  if p_interest > 0 then
    insert into public.transactions (
      household_id, created_by, member_id, amount, currency, type, category,
      account_id, debt_id, date, description, extras
    ) values (
      v_hid, auth.uid(), p_member_id, p_interest,
      coalesce(nullif(p_currency,''), v_debt.currency),
      'expense', 'loan_emi', p_funding_account_id, p_debt_id,
      coalesce(p_date, current_date),
      coalesce(nullif(p_description,''), v_debt.name || ' EMI'),
      jsonb_build_object('emi_split', jsonb_build_object(
        'interest', p_interest, 'principal', p_principal, 'debt_id', p_debt_id))
    ) returning id into v_expense_id;
  end if;

  -- 8. Principal leg — system transfer INTO the loan account (spend-neutral).
  if p_principal > 0 then
    insert into public.transactions (
      household_id, created_by, member_id, amount, currency, type, category,
      account_id, to_account_id, debt_id, date, description, extras
    ) values (
      v_hid, auth.uid(), p_member_id, p_principal,
      coalesce(nullif(p_currency,''), v_debt.currency),
      'transfer', null, p_funding_account_id, v_loan_account_id, p_debt_id,
      coalesce(p_date, current_date),
      coalesce(nullif(p_description,''), v_debt.name || ' EMI') || ' — principal',
      jsonb_build_object('emi_split', jsonb_build_object(
        'interest', p_interest, 'principal', p_principal, 'debt_id', p_debt_id),
        'linkedTxnId', v_expense_id)
    ) returning id into v_transfer_id;
  end if;

  -- 9. Re-amortised debt state + payment log entry (client-computed values,
  --    shape-validated above).
  update public.debts
     set current_balance = coalesce(p_new_balance, current_balance),
         minimum_payment = coalesce(p_new_minimum_payment, minimum_payment),
         extras = coalesce(extras, '{}'::jsonb)
           || case when p_new_remaining_months is not null
                   then jsonb_build_object('remainingMonths', p_new_remaining_months)
                   else '{}'::jsonb end
           || case when p_payment_log_entry is not null
                   then jsonb_build_object('paymentLog',
                        coalesce(extras->'paymentLog', '[]'::jsonb) || p_payment_log_entry)
                   else '{}'::jsonb end,
         updated_at = now()
   where id = p_debt_id;

  -- 10. Complete the event record.
  update public.loan_payment_events
     set expense_txn_id = v_expense_id,
         transfer_txn_id = v_transfer_id,
         loan_account_id = v_loan_account_id
   where operation_id = p_operation_id;

  return jsonb_build_object(
    'status', 'success',
    'expense_txn_id',  v_expense_id,
    'transfer_txn_id', v_transfer_id,
    'loan_account_id', v_loan_account_id);
end;
$$;

revoke all on function public.record_loan_payment(uuid,uuid,uuid,numeric,text,date,numeric,numeric,uuid,text,numeric,integer,numeric,jsonb) from public, anon;
grant execute on function public.record_loan_payment(uuid,uuid,uuid,numeric,text,date,numeric,numeric,uuid,text,numeric,integer,numeric,jsonb) to authenticated;

comment on function public.record_loan_payment(uuid,uuid,uuid,numeric,text,date,numeric,numeric,uuid,text,numeric,integer,numeric,jsonb) is
  'Audit F2 — one atomic loan-payment command: validates caller role, debt/account tenancy and split reconciliation, writes interest expense + principal transfer + re-amortised debt + payment log in a single transaction, idempotent on p_operation_id. Re-amortisation math is computed by the parity-tested client port (lib/amortization.ts); this function validates shape, never arithmetic.';

COMMIT;
