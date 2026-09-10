-- ============================================================================
-- v10.23.0 — Accounts R1: exactly one Cash in Hand per household, currency
-- from the household, and one default account.
--
-- WHY
-- 1. DUPLICATE CASH. Every cash account encodes to the same literal 'cash'
--    ledger key (react/src/lib/accountBalance.ts accountValueOf), so a second
--    one double-counts every cash transaction into both balances and into Net
--    Worth. The only guard was client-side: crudSlice.ensureDefaultCashAccount
--    checked the LOCAL store, and when it ran before that store had hydrated it
--    wrote a fresh "Cash in Hand" — in USD, because profile.baseCurrency
--    defaults to 'USD' until the profile loads. Production held exactly that:
--    two empty USD "Cash in Hand" rows beside an INR household's real "Cash".
--    Identity now lives in the database, as budget identity already does.
-- 2. CURRENCY. Currency is a household setting. A per-account currency can
--    only ever disagree with it. A trigger stamps the household's
--    base_currency on every account write, and a change of base currency flows
--    to every account.
-- 3. DEFAULT. With one currency per household, "default for <currency>"
--    collapses to one default per household. Marking a new default clears the
--    old one in the same statement, so the unique index can never be tripped by
--    an ordinary edit.
--
-- MONEY MODEL: no number moves.
--   • Only cash duplicates with ZERO live references are tombstoned. A
--     duplicate that IS referenced aborts the migration — it needs a merge,
--     not a delete.
--   • Currency is normalised only where opening_balance and
--     reconciliation_offset are both zero. computeAccountBalance never reads
--     account.currency, but a non-zero amount under a changed label would
--     change what it means, so that case aborts too.
--
-- VERIFIED IN PRODUCTION BEFORE WRITING (2026-09-10)
--   • 1 household with duplicate cash; both duplicates have 0 transactions,
--     0 schedules, 0 open splits.
--   • 3 accounts with a currency other than their household's; none hold money.
--   • 1 household with two defaults — the duplicate cash; resolved by step 1.
--   • 0 debts in a non-base currency. record_loan_payment requires the loan
--     account's currency to equal the debt's, so a foreign-currency debt would
--     become unpayable once accounts inherit the household currency. None exist.
-- ============================================================================

BEGIN;

-- ── 0. Archive every row this migration changes ─────────────────────────────
create schema if not exists maintenance;
create table if not exists maintenance.accounts_archive_20260910 as
  select a.*, now() as archived_at, ''::text as archive_reason
    from public.accounts a where false;

-- ── 1. Tombstone duplicate cash accounts ────────────────────────────────────
-- Per household keep the cash account with the most live transactions (then
-- the oldest); every other one must be unreferenced.
do $$
declare
  dup  record;
  refs int;
begin
  for dup in
    with ranked as (
      select a.id, a.household_id, a.name,
             row_number() over (
               partition by a.household_id
               order by (select count(*) from public.transactions t
                          where t.deleted_at is null
                            and (t.account_id = a.id or t.to_account_id = a.id)) desc,
                        a.created_at, a.id) as rn
        from public.accounts a
       where a.kind = 'cash' and a.deleted_at is null
    )
    select id, household_id, name from ranked where rn > 1
  loop
    select (select count(*) from public.transactions t
             where t.deleted_at is null
               and (t.account_id = dup.id or t.to_account_id = dup.id))
         + (select count(*) from public.recurring_schedules r
             where r.deleted_at is null
               and (r.txn_template->>'accountId' = dup.id::text
                    or r.txn_template->>'toAccountId' = dup.id::text))
      into refs;
    if refs > 0 then
      raise exception 'Duplicate cash account % (%) in household % has % live reference(s) — merge it into the household''s cash account before this migration can run',
        dup.id, dup.name, dup.household_id, refs;
    end if;
    insert into maintenance.accounts_archive_20260910
      select a.*, now(), 'R1: duplicate cash account with no references'
        from public.accounts a where a.id = dup.id;
    update public.accounts set deleted_at = now(), is_default = false where id = dup.id;
  end loop;
end $$;

-- Archived rows count: a second cash row double-counts whether or not it is
-- hidden from the pickers.
create unique index if not exists uq_account_cash_per_household
  on public.accounts (household_id)
  where kind = 'cash' and deleted_at is null;

-- ── 2. One default account per household ──────────────────────────────────
-- Dropped BEFORE currencies are normalised: collapsing two currencies onto one
-- would otherwise trip the per-currency index mid-migration.
drop index if exists public.accounts_default_per_currency;

-- Keep the oldest default where a household still has several. Production has
-- none after step 1; this is for any other database the file runs against.
insert into maintenance.accounts_archive_20260910
  select a.*, now(), 'R1: is_default cleared — a household has one default account'
    from public.accounts a
   where a.is_default and not a.is_archived and a.deleted_at is null
     and exists (select 1 from public.accounts b
                  where b.household_id = a.household_id
                    and b.is_default and not b.is_archived and b.deleted_at is null
                    and (b.created_at, b.id) < (a.created_at, a.id));
update public.accounts a set is_default = false
 where a.is_default and not a.is_archived and a.deleted_at is null
   and exists (select 1 from public.accounts b
                where b.household_id = a.household_id
                  and b.is_default and not b.is_archived and b.deleted_at is null
                  and (b.created_at, b.id) < (a.created_at, a.id));

create unique index if not exists uq_account_default_per_household
  on public.accounts (household_id)
  where is_default and not is_archived and deleted_at is null;

-- Marking an account default clears the previous one in the same statement.
-- The nested UPDATE re-fires this trigger on the other row with
-- is_default = false, which does nothing, so it cannot recurse.
create or replace function public.accounts_single_default()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.is_default and not new.is_archived and new.deleted_at is null then
    update public.accounts
       set is_default = false
     where household_id = new.household_id
       and id <> new.id
       and is_default and not is_archived and deleted_at is null;
  end if;
  return new;
end $$;

drop trigger if exists trg_accounts_single_default on public.accounts;
create trigger trg_accounts_single_default
  before insert or update on public.accounts
  for each row execute function public.accounts_single_default();

-- ── 3. Currency is the household's ─────────────────────────────────────────
do $$
declare n int;
begin
  select count(*) into n
    from public.accounts a
    join public.households h on h.id = a.household_id
   where a.deleted_at is null
     and a.currency <> h.base_currency
     and (a.opening_balance <> 0 or a.reconciliation_offset <> 0);
  if n > 0 then
    raise exception '% account(s) hold money under a currency other than their household''s — relabelling would change what the amount means; resolve them first', n;
  end if;
end $$;

insert into maintenance.accounts_archive_20260910
  select a.*, now(), 'R1: currency normalised to the household base_currency'
    from public.accounts a
    join public.households h on h.id = a.household_id
   where a.deleted_at is null and a.currency <> h.base_currency;

update public.accounts a
   set currency = h.base_currency
  from public.households h
 where h.id = a.household_id
   and a.deleted_at is null
   and a.currency <> h.base_currency;

-- Runs as the caller. That is enough: every member can SELECT their own
-- household (policy "members read household"), and record_loan_payment's own
-- inserts run as the function owner.
create or replace function public.accounts_currency_from_household()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare hc text;
begin
  select base_currency into hc from public.households where id = new.household_id;
  if hc is not null then
    new.currency := hc;
  end if;
  return new;
end $$;

drop trigger if exists trg_accounts_currency_from_household on public.accounts;
create trigger trg_accounts_currency_from_household
  before insert or update on public.accounts
  for each row execute function public.accounts_currency_from_household();

-- Changing the household currency relabels every account. (Amounts are
-- untouched, exactly as they already are today: computeAccountBalance treats
-- opening balances and offsets as base-currency figures.)
create or replace function public.households_currency_to_accounts()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.base_currency is distinct from old.base_currency then
    update public.accounts
       set currency = new.base_currency
     where household_id = new.id and deleted_at is null;
  end if;
  return new;
end $$;

drop trigger if exists trg_households_currency_to_accounts on public.households;
create trigger trg_households_currency_to_accounts
  after update of base_currency on public.households
  for each row execute function public.households_currency_to_accounts();

-- ── 4. The server owns Cash in Hand creation ────────────────────────────────
-- Idempotent: returns the household's cash account, creating it first if there
-- is none. Viewers get the existing row back but never create one.
create or replace function public.ensure_cash_account(p_household uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
  acc public.accounts;
begin
  caller_role := public.role_in(p_household);
  if auth.uid() is null or caller_role is null then
    raise exception 'not_a_household_member' using errcode = '42501';
  end if;

  if caller_role in ('owner', 'admin', 'member') then
    insert into public.accounts (household_id, kind, name, currency, is_default, opening_balance, source)
    select h.id, 'cash', 'Cash in Hand', h.base_currency,
           not exists (select 1 from public.accounts d
                        where d.household_id = h.id
                          and d.is_default and not d.is_archived and d.deleted_at is null),
           0, 'user'
      from public.households h
     where h.id = p_household
    on conflict (household_id) where kind = 'cash' and deleted_at is null do nothing;
  end if;

  select * into acc
    from public.accounts
   where household_id = p_household and kind = 'cash' and deleted_at is null;
  if not found then
    return null;
  end if;
  return to_jsonb(acc);
end $$;

-- Postgres grants EXECUTE to PUBLIC by default and anon inherits it; an
-- explicit grant to authenticated does not take that away (see v10.22's
-- 20260909150000_v1022_lock_down_definer_functions.sql).
revoke all on function public.ensure_cash_account(uuid) from public;
revoke all on function public.ensure_cash_account(uuid) from anon;
grant execute on function public.ensure_cash_account(uuid) to authenticated;

COMMIT;

-- Verify (run manually):
--   select household_id, count(*) from public.accounts
--    where kind = 'cash' and deleted_at is null group by 1 having count(*) > 1;   -- 0 rows
--   select count(*) from public.accounts a join public.households h on h.id = a.household_id
--    where a.deleted_at is null and a.currency <> h.base_currency;                 -- 0
--   select has_function_privilege('anon', 'public.ensure_cash_account(uuid)', 'EXECUTE');  -- false
