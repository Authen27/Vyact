-- ============================================================================
-- v10.24.0 — Accounts R2: card metadata, payment modes, a reconcile stamp, and
-- a delete that the database guards.
--
-- WHAT
-- 1. Credit cards record their credit limit, billing-cycle day and payment-due
--    day. Outstanding, available and utilisation are NOT stored — they are
--    derived from the limit and the ledger balance (react/src/lib/accountsView.ts),
--    so no figure can drift from the transactions underneath it.
-- 2. Every account records the payment modes used on it. Existing accounts get
--    the sensible set for their type, so nothing is left without a mode.
-- 3. last_reconciled_at — confirming a balance that already matches changes no
--    number and writes no log entry (INV-3b), but it must still clear the
--    "not reconciled in N days" state. Backfilled from the reconciliation log.
-- 4. Deleting an account is decided by the DATABASE, not the client cache:
--      account_dependencies  itemises what is attached
--      delete_account         tombstones only when NOTHING is attached
--      move_account_and_delete re-tags everything to another account of the
--                             same group, folds the balance across, tombstones
--
-- MONEY MODEL: no number moves.
--   • Adding nullable columns and a default mode set changes no amount.
--   • delete_account refuses whenever anything is attached, so the only accounts
--     it removes are ones no transaction, schedule or split refers to.
--   • move_account_and_delete moves every ledger row, AND folds the source's
--     opening_balance + reconciliation_offset into the destination's offset, so
--     the destination ends holding exactly what both held — balances sum the
--     same, category totals are untouched (no transaction's amount, type,
--     category or date changes), and net worth is unchanged. Moves stay within a
--     group (bank/cash ↔ bank/cash, card ↔ card) so value never crosses between
--     the asset and liability sides.
--
-- Recurring templates store the app's transactionTemplate verbatim, so the
-- account keys inside txn_template are camelCase: accountId / toAccountId.
-- ============================================================================

BEGIN;

-- ── 1–3. Columns ────────────────────────────────────────────────────────────
alter table public.accounts
  add column if not exists payment_modes      text[]        not null default '{}',
  add column if not exists credit_limit       numeric(15,2),
  add column if not exists billing_cycle_day  smallint,
  add column if not exists payment_due_day    smallint,
  add column if not exists last_reconciled_at timestamptz;

alter table public.accounts
  add constraint ck_account_payment_modes check (
    payment_modes <@ array['upi','debit_card','net_banking','cheque','auto_debit',
                           'swipe','upi_on_card','online','standing_instruction','cash']::text[]),
  add constraint ck_account_card_fields check (
    kind = 'credit_card'
    or (credit_limit is null and billing_cycle_day is null and payment_due_day is null)),
  add constraint ck_account_credit_limit check (credit_limit is null or credit_limit > 0),
  add constraint ck_account_cycle_days check (
    (billing_cycle_day is null or billing_cycle_day between 1 and 31)
    and (payment_due_day is null or payment_due_day between 1 and 31));

update public.accounts
   set payment_modes = case kind
         when 'bank'        then array['upi','debit_card','net_banking']
         when 'credit_card' then array['swipe','online']
         when 'cash'        then array['cash']
         else '{}'::text[]
       end
 where payment_modes = '{}' and deleted_at is null;

update public.accounts a
   set last_reconciled_at = (
         select max((e->>'at')::timestamptz)
           from jsonb_array_elements(a.reconciliation_log) e)
 where a.last_reconciled_at is null
   and jsonb_array_length(a.reconciliation_log) > 0;

-- ── 4a. What is attached to an account ─────────────────────────────────────
create or replace function public.account_dependencies(p_account_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
declare
  acc public.accounts;
  result jsonb;
begin
  select * into acc from public.accounts where id = p_account_id and deleted_at is null;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not public.is_member(acc.household_id) then
    raise exception 'not_a_household_member' using errcode = '42501';
  end if;

  with txns as (
    select t.id, t.amount, t.date, t.category, t.type, t.description
      from public.transactions t
     where t.household_id = acc.household_id
       and t.deleted_at is null
       and (t.account_id = acc.id or t.to_account_id = acc.id)
  ), grouped as (
    select coalesce(nullif(trim(description), ''), category, type) as label,
           count(*) as n, sum(amount) as total
      from txns
     group by 1
     order by count(*) desc, sum(amount) desc
     limit 3
  )
  select jsonb_build_object(
    'accountId', acc.id,
    'transactions', jsonb_build_object(
      'count',     (select count(*) from txns),
      'total',     coalesce((select sum(amount) from txns), 0),
      'firstDate', (select min(date) from txns),
      'lastDate',  (select max(date) from txns),
      'groups',    coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', n, 'total', total))
                               from grouped), '[]'::jsonb)),
    'recurring', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'label', coalesce(nullif(r.txn_template->>'description', ''), r.txn_template->>'category', 'Recurring')))
        from public.recurring_schedules r
       where r.household_id = acc.household_id
         and r.deleted_at is null
         and (r.txn_template->>'accountId' = acc.id::text
              or r.txn_template->>'toAccountId' = acc.id::text)), '[]'::jsonb),
    'openSplits', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'txnId', s.txn_id))
        from public.shared_splits s
        join txns t on t.id = s.txn_id
       where s.closed_at is null), '[]'::jsonb),
    'loanEvents', (select count(*) from public.loan_payment_events e where e.loan_account_id = acc.id)
  ) into result;

  return result;
end $fn$;

-- ── 4b. Delete only what nothing refers to ─────────────────────────────────
create or replace function public.delete_account(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  acc  public.accounts;
  deps jsonb;
begin
  select * into acc from public.accounts
   where id = p_account_id and deleted_at is null
   for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  -- Mirrors the accounts_delete RLS policy: owners and admins only.
  if auth.uid() is null or coalesce(public.role_in(acc.household_id), '') not in ('owner', 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if acc.kind = 'cash' then
    raise exception 'cash_account_protected' using errcode = '22023';
  end if;
  if acc.kind = 'loan' then
    raise exception 'system_account_protected' using errcode = '22023';
  end if;

  deps := public.account_dependencies(p_account_id);
  if (deps #>> '{transactions,count}')::int > 0
     or jsonb_array_length(deps->'recurring') > 0
     or jsonb_array_length(deps->'openSplits') > 0
     or (deps->>'loanEvents')::int > 0 then
    raise exception 'account_in_use' using errcode = '23503', detail = deps::text;
  end if;

  -- A tombstone, not a row delete: under refresh-based sync another device still
  -- holding the row would otherwise upload it again. Unrecoverable from the app.
  update public.accounts set deleted_at = now(), is_default = false where id = p_account_id;
  return jsonb_build_object('status', 'deleted', 'accountId', p_account_id);
end $fn$;

-- ── 4c. Move everything to another account, then delete ────────────────────
create or replace function public.move_account_and_delete(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  src      public.accounts;
  dst      public.accounts;
  deps     jsonb;
  n_debit  int;
  n_credit int;
  n_sched  int;
  n_sched2 int;
  folded   numeric;
begin
  if p_from = p_to then
    raise exception 'same_account' using errcode = '22023';
  end if;

  select * into src from public.accounts where id = p_from and deleted_at is null for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  select * into dst from public.accounts where id = p_to and deleted_at is null for update;
  if not found then
    raise exception 'destination_not_found' using errcode = 'P0002';
  end if;
  if src.household_id <> dst.household_id then
    raise exception 'different_household' using errcode = '22023';
  end if;
  if auth.uid() is null or coalesce(public.role_in(src.household_id), '') not in ('owner', 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if src.kind not in ('bank', 'credit_card') then
    raise exception 'source_not_movable' using errcode = '22023';
  end if;
  if dst.is_archived then
    raise exception 'destination_archived' using errcode = '22023';
  end if;
  -- Same group only: bank/cash ↔ bank/cash, card ↔ card.
  if (src.kind = 'credit_card') <> (dst.kind = 'credit_card')
     or dst.kind not in ('bank', 'cash', 'credit_card') then
    raise exception 'destination_different_group' using errcode = '22023';
  end if;

  deps := public.account_dependencies(p_from);
  if jsonb_array_length(deps->'openSplits') > 0 then
    raise exception 'unsettled_splits' using errcode = '23503', detail = deps::text;
  end if;
  if (deps->>'loanEvents')::int > 0 then
    raise exception 'loan_history_attached' using errcode = '23503', detail = deps::text;
  end if;
  -- A transfer between the two would become a transfer from an account to
  -- itself.
  if exists (
    select 1 from public.transactions t
     where t.household_id = src.household_id
       and t.deleted_at is null
       and ((t.account_id = p_from and t.to_account_id = p_to)
         or (t.account_id = p_to and t.to_account_id = p_from))
  ) then
    raise exception 'transfers_between_accounts' using errcode = '23514';
  end if;

  -- Every row, tombstoned ones included, so no history points at a deleted account.
  update public.transactions set account_id = p_to
   where household_id = src.household_id and account_id = p_from;
  get diagnostics n_debit = row_count;
  update public.transactions set to_account_id = p_to
   where household_id = src.household_id and to_account_id = p_from;
  get diagnostics n_credit = row_count;

  update public.recurring_schedules
     set txn_template = jsonb_set(txn_template, '{accountId}', to_jsonb(p_to::text))
   where household_id = src.household_id and txn_template->>'accountId' = p_from::text;
  get diagnostics n_sched = row_count;
  update public.recurring_schedules
     set txn_template = jsonb_set(txn_template, '{toAccountId}', to_jsonb(p_to::text))
   where household_id = src.household_id and txn_template->>'toAccountId' = p_from::text;
  get diagnostics n_sched2 = row_count;

  -- The source's starting point and its reconciled drift move with its rows.
  folded := coalesce(src.opening_balance, 0) + coalesce(src.reconciliation_offset, 0);
  if folded <> 0 then
    update public.accounts
       set reconciliation_offset = reconciliation_offset + folded,
           reconciliation_log = reconciliation_log || jsonb_build_array(jsonb_build_object(
             'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'delta', folded,
             'kind', 'merge',
             'stated_value', null,
             'note', 'Moved from ' || src.name))
     where id = p_to;
  end if;

  update public.accounts set deleted_at = now(), is_default = false where id = p_from;

  return jsonb_build_object(
    'status', 'moved', 'from', p_from, 'to', p_to,
    'transactions', n_debit + n_credit, 'schedules', n_sched + n_sched2, 'folded', folded);
end $fn$;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- EXECUTE defaults to PUBLIC and anon inherits it; grant to authenticated only.
revoke all on function public.account_dependencies(uuid) from public;
revoke all on function public.account_dependencies(uuid) from anon;
grant execute on function public.account_dependencies(uuid) to authenticated;

revoke all on function public.delete_account(uuid) from public;
revoke all on function public.delete_account(uuid) from anon;
grant execute on function public.delete_account(uuid) to authenticated;

revoke all on function public.move_account_and_delete(uuid, uuid) from public;
revoke all on function public.move_account_and_delete(uuid, uuid) from anon;
grant execute on function public.move_account_and_delete(uuid, uuid) to authenticated;

COMMIT;
