-- ============================================================================
-- Vyact v9.1 — feedback batch (companion: vyact-v9-feedback-triage-and-solutions.md)
--   §4  budgets: strict identity (scope + year + month) + budget_allocations child table
--   §5  recurring_schedules: rrule + owner_member_id
--   §6  debts.direction/counterparty_name already existed (v7.2.0) — no DDL here
--   §7  scrub transactions.extras.accountSplits (people-split untouched)
--   §8  transactions.recurring_schedule_id + debt_id (deep-link FKs)
--
-- Forward-only. Applied to prod 2026-06-12 (4 budgets → 2 month containers + 4
-- allocations; 0 recurring; 0 accountSplits; 0 receivables).
--
-- ⚠ LESSON: the Supabase apply_migration runner autocommits per-statement, so a
--   DO-block that fails mid-way leaves earlier statements committed. The legacy
--   collapse below is therefore GUARDED to run only when no allocations exist yet
--   (re-runnable on a clean clone; a no-op once migrated). Identity constraints
--   are added LAST, after the data is clean (v9 migration discipline).
-- ============================================================================

create table if not exists migration_issues (
  id bigserial primary key, at timestamptz default now(), area text, detail text, payload jsonb
);

-- 1. budgets — strict identity columns; category becomes optional (container has none)
alter table budgets add column if not exists scope text;
alter table budgets add column if not exists period_year int;
alter table budgets add column if not exists period_month int;
alter table budgets add column if not exists custom_name text;
alter table budgets alter column category drop not null;

-- 2. budget_allocations — reintroduced as a cloud-synced CHILD TABLE (not jsonb)
create table if not exists budget_allocations (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  category text not null,
  amount numeric(15,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_balloc_budget on budget_allocations(budget_id) where deleted_at is null;
create index if not exists idx_balloc_household on budget_allocations(household_id) where deleted_at is null;
alter table budget_allocations enable row level security;
drop policy if exists balloc_read on budget_allocations;
create policy balloc_read on budget_allocations for select using (is_member(household_id) or is_admin('roles'));
drop policy if exists balloc_insert on budget_allocations;
create policy balloc_insert on budget_allocations for insert with check (role_in(household_id) = any (array['owner','admin','member']));
drop policy if exists balloc_update on budget_allocations;
create policy balloc_update on budget_allocations for update using (role_in(household_id) = any (array['owner','admin','member']));
drop policy if exists balloc_delete on budget_allocations;
create policy balloc_delete on budget_allocations for delete using (role_in(household_id) = any (array['owner','admin','member']));
drop trigger if exists touch_budget_allocations on budget_allocations;
create trigger touch_budget_allocations before update on budget_allocations for each row execute function set_updated_at();

-- 3. collapse legacy per-category budgets → one current-month container + allocations
--    GUARDED: only when no allocations exist (autocommit-safe; no-op once migrated)
do $$
declare h record; container uuid; cy int := extract(year from now())::int; cm int := extract(month from now())::int;
begin
  if exists (select 1 from budget_allocations) then return; end if;
  for h in select distinct household_id from budgets where deleted_at is null loop
    select id into container from budgets
      where household_id=h.household_id and deleted_at is null
      order by created_at asc nulls last, id asc limit 1;
    insert into budget_allocations (budget_id, household_id, category, amount)
      select container, household_id, category, coalesce(monthly_limit,0)
        from budgets where household_id=h.household_id and deleted_at is null and category is not null;
    update budgets set scope='month',
      period_year=coalesce(extract(year from period_start)::int, cy),
      period_month=coalesce(extract(month from period_start)::int, cm),
      period_start=coalesce(period_start, make_date(cy,cm,1)),
      period_end=coalesce(period_end, (make_date(cy,cm,1)+interval '1 month - 1 day')::date),
      monthly_limit=(select coalesce(sum(monthly_limit),0) from budgets where household_id=h.household_id and deleted_at is null),
      category=null
      where id=container;
    update budgets set deleted_at=now()
      where household_id=h.household_id and deleted_at is null and id<>container;
  end loop;
end $$;
update budgets set scope='month',
  period_year=coalesce(period_year, extract(year from now())::int),
  period_month=coalesce(period_month, extract(month from now())::int),
  period_start=coalesce(period_start, date_trunc('month',now())::date),
  period_end=coalesce(period_end, (date_trunc('month',now())+interval '1 month - 1 day')::date)
  where deleted_at is null and scope is null;

-- 4. recurring_schedules — RRULE + owner (§5)
alter table recurring_schedules add column if not exists rrule text;
alter table recurring_schedules add column if not exists owner_member_id uuid;

-- 5. transactions — deep-link FKs (§5 materialisation, §8 debt drill)
alter table transactions add column if not exists recurring_schedule_id uuid references recurring_schedules(id) on delete set null;
alter table transactions add column if not exists debt_id uuid references debts(id) on delete set null;
create index if not exists idx_txn_recurring on transactions(recurring_schedule_id) where recurring_schedule_id is not null;
create index if not exists idx_txn_debt on transactions(debt_id) where debt_id is not null;

-- 6. §7 — scrub account-split (people-split untouched)
update transactions set extras = extras - 'accountSplits' where extras ? 'accountSplits';

-- 7. CONSTRAINTS LAST — strict budget identity (§4.1)
create unique index if not exists uq_budget_month on budgets(household_id, period_year, period_month) where scope='month' and deleted_at is null;
create unique index if not exists uq_budget_annual on budgets(household_id, period_year) where scope='annual' and deleted_at is null;

-- 8. assertion
do $$ begin
  if exists (select 1 from transactions where extras ? 'accountSplits') then raise exception 'accountSplits scrub incomplete'; end if;
end $$;
