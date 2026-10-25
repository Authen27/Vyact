-- v10.134.0 — Track Q, part 6: a split debits the paying account by the full bill, and what the others owe is
-- "Owed to you" (audit FE-MNY-08; owner decision 20 Oct 2026: "full debit + Owed to you; settling records the money
-- into a chosen account").
--
-- A split used to debit only YOUR share from the account that paid the whole bill, so the bank balance and its
-- reconciliation drifted by everyone else's share. A NEW split (flagged on the row: extras.split.fullDebit, an expense
-- you paid) now debits the full bill; your spending is still your share (reportableTxns reads yourShare, unchanged).
-- The others' unpaid shares are a receivable, "Owed to you", in Net Worth (never liquid, never spendable). When one of
-- them pays you back, the share records the account it came into (participants[].paidInto, with paidOn): that account
-- rises by the share, Owed to you falls by it, and net worth, spending and income do not move. Splits made before
-- keep their share-only debit. No income row is written: a repayment is not income.
--
--   • split_full_debit(type, extras): the predicate, the app's isFullDebitSplit (lib/splitMoney.ts).
--   • account_ledger_balance(): the app's computeAccountBalance again, with full debits and receipts.
--   • account_dependencies(): an account a receipt came into is in use (delete_account refuses; move carries it).
--   • move_account_and_delete(): receipts into the source now came into the destination.
--   • assert_txn_tenant_consistency(): a receipt's account is the household's own, and a new one is live.
--
-- MONEY MODEL: revised by owner decision (CLAUDE.md, "Splits"). Q6 invariants (moneyModel.invariants) hold: the
-- account drops by the full bill, net worth and spending at creation are what the share-only model gave, and settling
-- moves the share from Owed to you into the account.

begin;

create or replace function public.split_full_debit(p_type text, p_extras jsonb)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select p_type = 'expense'
     and coalesce(p_extras -> 'split' ->> 'isSplit', '') = 'true'
     and coalesce(p_extras -> 'split' ->> 'fullDebit', '') = 'true'
     and coalesce(p_extras -> 'split' ->> 'paidBy', '') = 'me'
$$;
revoke all on function public.split_full_debit(text, jsonb) from public, anon, authenticated;
grant execute on function public.split_full_debit(text, jsonb) to service_role;

create or replace function public.account_ledger_balance(p_account uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with acc as (select * from public.accounts where id = p_account),
  amounts as (
    select t.type, t.account_id, t.to_account_id,
           case when public.split_full_debit(t.type, t.extras) then t.amount
                when t.extras -> 'split' ->> 'isSplit' = 'true'
                 and jsonb_typeof(t.extras -> 'split' -> 'yourShare') = 'number'
                then (t.extras -> 'split' ->> 'yourShare')::numeric
                else t.amount end as amount
      from public.transactions t
     where t.deleted_at is null and (t.account_id = p_account or t.to_account_id = p_account)
  ),
  receipts as (
    select coalesce(sum((p ->> 'share')::numeric), 0) as total
      from public.transactions t, acc, jsonb_array_elements(case when jsonb_typeof(t.extras -> 'split' -> 'participants') = 'array'
                                     then t.extras -> 'split' -> 'participants' else '[]'::jsonb end) p
     where t.household_id = acc.household_id and t.deleted_at is null
       and public.split_full_debit(t.type, t.extras)
       and p ->> 'paid' = 'true' and coalesce(p ->> 'isYou', '') <> 'true'
       -- A paid share that names no account came back into the account the bill was paid from.
       and coalesce(p ->> 'paidInto', t.account_id::text) = acc.id::text
       and jsonb_typeof(p -> 'share') = 'number'
  )
  select round(coalesce(a.opening_balance, 0) + coalesce(a.reconciliation_offset, 0)
       + coalesce((select sum(m.amount) from amounts m
                    where m.to_account_id = a.id and m.type in ('income', 'transfer', 'investment')), 0)
       - coalesce((select sum(m.amount) from amounts m
                    where m.account_id = a.id and m.type in ('expense', 'transfer', 'investment')), 0)
       + (select total from receipts), 2)
    from acc a
$$;
revoke all on function public.account_ledger_balance(uuid) from public, anon, authenticated;
grant execute on function public.account_ledger_balance(uuid) to service_role;

CREATE OR REPLACE FUNCTION public.account_dependencies(p_account_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
       and (t.account_id = acc.id or t.to_account_id = acc.id
            -- v10.134.0 (Q6): or a split's receipt came back into it.
            or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(t.extras -> 'split' -> 'participants') = 'array'
                                     then t.extras -> 'split' -> 'participants' else '[]'::jsonb end) p where p ->> 'paidInto' = acc.id::text))
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
end $function$;

CREATE OR REPLACE FUNCTION public.move_account_and_delete(p_from uuid, p_to uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  src      public.accounts;
  dst      public.accounts;
  deps     jsonb;
  n_debit  int;
  n_credit int;
  n_sched  int;
  n_sched2 int;
  n_loans  int;
  n_rcpt   int;
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

  -- v10.134.0 (Q6): a split's receipts into it now came back into the destination.
  update public.transactions t
     set extras = jsonb_set(t.extras, '{split,participants}', (
           select jsonb_agg(case when p ->> 'paidInto' = p_from::text
                                 then jsonb_set(p, '{paidInto}', to_jsonb(p_to::text)) else p end order by ord)
             from jsonb_array_elements(t.extras -> 'split' -> 'participants') with ordinality as x(p, ord)))
   where t.household_id = src.household_id
     and jsonb_typeof(t.extras -> 'split' -> 'participants') = 'array'
     and exists (select 1 from jsonb_array_elements(t.extras -> 'split' -> 'participants') p
                  where p ->> 'paidInto' = p_from::text);
  get diagnostics n_rcpt = row_count;

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
    'transactions', n_debit + n_credit, 'schedules', n_sched + n_sched2, 'loans', n_loans, 'receipts', n_rcpt,
    'folded', folded);
end $function$;

CREATE OR REPLACE FUNCTION public.assert_txn_tenant_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  prev     public.transactions;  -- the stored row this write replaces (an UPDATE, or an upsert's INSERT)
  had      boolean := false;
  live     boolean := new.deleted_at is null;
  revived  boolean;              -- a live entry that was not live before: a new one, or one brought back
  acc_new  boolean;
  to_new   boolean;
  asset_new boolean;
  r        record;
  rcpt     text;
begin
  if tg_op = 'UPDATE' then
    prev := old; had := true;
  else
    select * into prev from public.transactions where id = new.id;
    had := found and prev.household_id = new.household_id;
  end if;
  revived   := live and (not had or prev.deleted_at is not null);
  acc_new   := live and new.account_id is not null and (revived or prev.account_id is distinct from new.account_id);
  to_new    := live and new.to_account_id is not null and (revived or prev.to_account_id is distinct from new.to_account_id);
  asset_new := live and new.asset_id is not null and (revived or prev.asset_id is distinct from new.asset_id);

  -- Every link is the household's own (account, member and loan on every write, as S3 did).
  if new.account_id is not null and not exists (
    select 1 from public.accounts where id = new.account_id and household_id = new.household_id
  ) then
    raise exception 'transactions.account_id belongs to a different household' using errcode = '23503';
  end if;
  if new.to_account_id is not null and not exists (
    select 1 from public.accounts where id = new.to_account_id and household_id = new.household_id
  ) then
    raise exception 'transactions.to_account_id belongs to a different household' using errcode = '23503';
  end if;
  if new.member_id is not null and not exists (
    select 1 from public.memberships where id = new.member_id and household_id = new.household_id
  ) then
    raise exception 'transactions.member_id belongs to a different household' using errcode = '23503';
  end if;
  if new.debt_id is not null and not exists (
    select 1 from public.debts where id = new.debt_id and household_id = new.household_id
  ) then
    raise exception 'transactions.debt_id belongs to a different household' using errcode = '23503';
  end if;
  if new.asset_id is not null and not exists (
    select 1 from public.assets where id = new.asset_id and household_id = new.household_id
  ) then
    raise exception 'transactions.asset_id belongs to a different household' using errcode = '23503';
  end if;
  -- Who initiated it, and the schedule it came from: when the link is made or changed.
  if new.initiated_by is not null and (not had or prev.initiated_by is distinct from new.initiated_by)
     and not exists (select 1 from public.memberships where id = new.initiated_by and household_id = new.household_id) then
    raise exception 'transactions.initiated_by belongs to a different household' using errcode = '23503';
  end if;
  if new.recurring_schedule_id is not null
     and (not had or prev.recurring_schedule_id is distinct from new.recurring_schedule_id)
     and not exists (select 1 from public.recurring_schedules
                      where id = new.recurring_schedule_id and household_id = new.household_id) then
    raise exception 'transactions.recurring_schedule_id belongs to a different household' using errcode = '23503';
  end if;

  -- A NEW link needs a live account or asset. It is read under a share lock (accounts in id order, so two
  -- writers never wait on each other), which a delete running at the same moment waits for: either the
  -- delete then sees this entry and refuses (account_in_use / asset_in_use), or this sees the delete.
  if acc_new or to_new then
    for r in
      select a.id, a.deleted_at from public.accounts a
       where (acc_new and a.id = new.account_id) or (to_new and a.id = new.to_account_id)
       order by a.id
         for share
    loop
      if r.deleted_at is not null then
        raise exception 'account_deleted: the account was deleted' using errcode = '23503', detail = r.id::text;
      end if;
    end loop;
  end if;
  -- v10.134.0 (Q6; FE-MNY-08): a split's receipts name the account the money came back into (paidInto). Each is an
  -- account of this household; a receipt this write adds (or an entry brought back) needs a live one, read under the
  -- same share lock as the entry's own accounts.
  for rcpt in
    select distinct p ->> 'paidInto' from jsonb_array_elements(case when jsonb_typeof(new.extras -> 'split' -> 'participants') = 'array'
                                     then new.extras -> 'split' -> 'participants' else '[]'::jsonb end) p where p ->> 'paidInto' is not null order by 1
  loop
    if rcpt !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or not exists (select 1 from public.accounts where id = rcpt::uuid and household_id = new.household_id) then
      raise exception 'transactions.split receipt account belongs to a different household' using errcode = '23503',
        detail = rcpt;
    end if;
    if live and (revived or not exists (select 1 from jsonb_array_elements(case when jsonb_typeof(prev.extras -> 'split' -> 'participants') = 'array'
                                     then prev.extras -> 'split' -> 'participants' else '[]'::jsonb end) q where q ->> 'paidInto' = rcpt)) then
      select a.deleted_at into r from public.accounts a where a.id = rcpt::uuid for share;
      if r.deleted_at is not null then
        raise exception 'account_deleted: the account was deleted' using errcode = '23503', detail = rcpt;
      end if;
    end if;
  end loop;
  if asset_new then
    select a.deleted_at into r from public.assets a where a.id = new.asset_id for share;
    if r.deleted_at is not null then
      raise exception 'asset_deleted: the investment was deleted' using errcode = '23503', detail = new.asset_id::text;
    end if;
  end if;
  return new;
end $function$;

commit;
