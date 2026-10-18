-- v10.119.0 — A loan that records its EMIs automatically always has an account to pay from.
-- Follow-up to T2c (v10.117.0). Owner decisions, 19 Oct 2026:
--   * deleting an account such a loan pays from is REFUSED; "Move and delete" carries the loan;
--   * archiving it is REFUSED until the loan pays from another account (enforced here, not only in the app);
--   * loans whose paying account is ALREADY deleted or archived are kept, with "Record automatically"
--     switched off.
--
-- The gap. `auto_record_due_emis` (pg_cron, every 30 min) pays each due EMI through `loan_payment_core`, which
-- refuses a paying account that is missing, deleted, archived, not bank/cash, or another household's
-- (`funding_account_invalid`). The job counts that as an error and moves on, so a loan whose paying account
-- had been deleted or archived simply stopped recording, every run, with nobody told; the app still said
-- "Vyact records this EMI on the day". (v10.117.0's note said such EMIs had landed on the deleted account.
-- They had not: they were never recorded.)
--
--   1. Repair: every live loan set to record automatically whose paying account is not usable has
--      "Record automatically" switched off. Its EMI then shows as Pay on its day. No loan, balance or
--      entry is changed or removed.
--   2. A loan set to record automatically can only point at a usable paying account
--      (`debts_funding_account_guard`), and any paying account is the household's own (DB-SEC-09's class).
--   3. `account_dependencies` lists such loans (`loans`); `delete_account` refuses while there are any, and
--      clears the paying account of a loan that does not record automatically (it was only a default).
--   4. `move_account_and_delete` moves every live loan's paying account to the destination.
--   5. `accounts_guard_lifecycle` (from the app) refuses archiving an account such a loan pays from.
--
-- MONEY MODEL: untouched. No balance, entry or debt figure moves.

begin;

-- ── 1. Repair ────────────────────────────────────────────────────────────────────────────────────────
update public.debts d
   set auto_record = false, updated_at = now()
 where d.deleted_at is null and d.auto_record and d.paid_off_at is null
   and coalesce(d.direction, 'owed_by_me') = 'owed_by_me'
   and not exists (select 1 from public.accounts a
                    where a.id = d.funding_account_id and a.household_id = d.household_id
                      and a.kind in ('bank', 'cash') and a.deleted_at is null and not a.is_archived);

-- ── 2. A loan's paying account ──────────────────────────────────────────────────────────────────────
create or replace function public.debts_funding_account_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare acc public.accounts;
begin
  if new.funding_account_id is not null then
    select * into acc from public.accounts where id = new.funding_account_id;
    if (tg_op = 'INSERT' or old.funding_account_id is distinct from new.funding_account_id)
       and (not found or acc.household_id <> new.household_id) then
      raise exception 'debts.funding_account_id belongs to a different household' using errcode = '23503';
    end if;
  end if;
  -- Recording automatically needs an account a payment will accept: checked when it is switched on, or its
  -- account changes, on a live loan.
  if new.auto_record and new.deleted_at is null and new.paid_off_at is null
     and coalesce(new.direction, 'owed_by_me') = 'owed_by_me'
     and (tg_op = 'INSERT' or old.auto_record is distinct from true
          or old.funding_account_id is distinct from new.funding_account_id)
     and (new.funding_account_id is null or acc.id is null or acc.kind not in ('bank', 'cash')
          or acc.deleted_at is not null or acc.is_archived) then
    raise exception 'loan_needs_paying_account: a loan recorded automatically needs a live bank or cash account to pay from'
      using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.debts_funding_account_guard() from public, anon, authenticated;

drop trigger if exists trg_debts_funding_account_guard on public.debts;
create trigger trg_debts_funding_account_guard
  before insert or update on public.debts
  for each row execute function public.debts_funding_account_guard();

-- ── 3. What is attached to an account: now also the loans that record from it ──────────────────────
-- Unchanged otherwise (20260910150000_r2_accounts_card_metadata_delete_guard.sql).
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
    'loanEvents', (select count(*) from public.loan_payment_events e where e.loan_account_id = acc.id),
    -- v10.119.0: live loans that record their EMIs automatically from this account.
    'loans', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name)
        from public.debts d
       where d.household_id = acc.household_id and d.funding_account_id = acc.id
         and d.deleted_at is null and d.paid_off_at is null and d.auto_record
         and coalesce(d.direction, 'owed_by_me') = 'owed_by_me'), '[]'::jsonb)
  ) into result;

  return result;
end $fn$;
revoke all on function public.account_dependencies(uuid) from public;
revoke all on function public.account_dependencies(uuid) from anon;
grant execute on function public.account_dependencies(uuid) to authenticated;

-- ── 4. delete_account: refused while a loan records from it ─────────────────────────────────────────
-- Unchanged otherwise (20261102120000_t2c_ledger_integrity.sql).
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
  -- Owners and admins only.
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
     or (deps->>'loanEvents')::int > 0
     or jsonb_array_length(deps->'loans') > 0 then
    raise exception 'account_in_use' using errcode = '23503', detail = deps::text;
  end if;

  -- A loan that does not record automatically only had this as its default paying account.
  update public.debts set funding_account_id = null, updated_at = now()
   where household_id = acc.household_id and funding_account_id = p_account_id and deleted_at is null;

  -- A tombstone, not a row delete: under refresh-based sync another device still
  -- holding the row would otherwise upload it again. Unrecoverable from the app.
  perform set_config('vyact.account_delete', 'on', true);
  update public.accounts set deleted_at = now(), is_default = false where id = p_account_id;
  perform set_config('vyact.account_delete', '', true);
  return jsonb_build_object('status', 'deleted', 'accountId', p_account_id);
end $fn$;

-- ── 5. move_account_and_delete: the loans move with the history ─────────────────────────────────────
-- Unchanged otherwise (20261102120000_t2c_ledger_integrity.sql).
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
  n_loans  int;
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

  -- v10.119.0: the loans paid from it are paid from the destination now.
  update public.debts set funding_account_id = p_to, updated_at = now()
   where household_id = src.household_id and funding_account_id = p_from and deleted_at is null;
  get diagnostics n_loans = row_count;

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

  perform set_config('vyact.account_delete', 'on', true);
  update public.accounts set deleted_at = now(), is_default = false where id = p_from;
  perform set_config('vyact.account_delete', '', true);

  return jsonb_build_object(
    'status', 'moved', 'from', p_from, 'to', p_to,
    'transactions', n_debit + n_credit, 'schedules', n_sched + n_sched2, 'loans', n_loans, 'folded', folded);
end $fn$;

revoke all on function public.delete_account(uuid) from public;
revoke all on function public.delete_account(uuid) from anon;
grant execute on function public.delete_account(uuid) to authenticated;
revoke all on function public.move_account_and_delete(uuid, uuid) from public;
revoke all on function public.move_account_and_delete(uuid, uuid) from anon;
grant execute on function public.move_account_and_delete(uuid, uuid) to authenticated;

-- ── 6. From the app, an account a loan records from can't be archived ──────────────────────────────
-- Unchanged otherwise (20261102120000_t2c_ledger_integrity.sql).
create or replace function public.accounts_guard_lifecycle()
returns trigger
language plpgsql
security definer   -- v10.119.0: it reads loans, which row security must not hide from it
set search_path = public, pg_temp
as $$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_loan   text;
begin
  if v_claims is null or (v_claims::jsonb ->> 'role') is distinct from 'authenticated' then
    return new;
  end if;
  if old.kind = 'cash' and (new.kind is distinct from 'cash'
       or (new.is_archived and not old.is_archived)
       or (new.deleted_at is not null and old.deleted_at is null)) then
    raise exception 'cash_account_protected: Cash in Hand can be renamed, never archived or deleted'
      using errcode = '22023';
  end if;
  if new.kind = 'cash' and old.kind is distinct from 'cash' then
    raise exception 'cash_account_protected: Cash in Hand is created by the household, never converted'
      using errcode = '22023';
  end if;
  if new.deleted_at is not null and old.deleted_at is null
     and current_setting('vyact.account_delete', true) is distinct from 'on' then
    raise exception 'account_delete_guarded: delete an account with delete_account or move_account_and_delete'
      using errcode = '42501';
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'account_delete_final: a deleted account stays deleted' using errcode = '42501';
  end if;
  -- v10.119.0 (owner, 19 Oct 2026): a loan's automatic EMI would be refused from an archived account.
  if new.is_archived and not old.is_archived then
    select string_agg(d.name, ', ' order by d.name) into v_loan
      from public.debts d
     where d.household_id = old.household_id and d.funding_account_id = old.id
       and d.deleted_at is null and d.paid_off_at is null and d.auto_record
       and coalesce(d.direction, 'owed_by_me') = 'owed_by_me';
    if v_loan is not null then
      raise exception 'account_pays_a_loan: % records its EMIs from this account; change its paying account first', v_loan
        using errcode = '23503';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.accounts_guard_lifecycle() from public, anon, authenticated;

commit;
