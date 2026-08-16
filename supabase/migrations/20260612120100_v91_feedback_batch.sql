-- Vyact v9.1 — feedback batch schema (triage doc §4/§5/§6/§7/§8).
--
-- Covers: budget strict identity + allocations child table (§4, fixes Inv A
-- parallel-budget minting), recurring RRULE + owner + single-source-of-truth FK
-- (§5), debt receivables already had columns (§6 is UI-only), transactions.debt_id
-- for the §8 debt drill-down, and the forward-only accountSplits scrub (§7).
--
-- DISCIPLINE (v9 txn-redesign rules):
--   • forward-only, idempotent (safe to re-run).
--   • additive columns/tables first; the DESTRUCTIVE accountSplits scrub is the
--     LAST section and is gated — run it only after the §7 UI no longer writes
--     accountSplits, with an INV-9-style before/after balance reconcile.
--   • never drop data silently — multi-account rows are logged to migration_issues.
--   • APPLY ONLY after the v9.1 feature waves land and a dry-run reconciles totals.
--     This file is the tracked source of truth; it is NOT auto-applied.

-- ── scratch: issues log (idempotent) ────────────────────────────────────────
create table if not exists migration_issues (
  id bigint generated always as identity primary key,
  migration text not null,
  kind text not null,
  entity_id text,
  detail jsonb,
  logged_at timestamptz not null default now()
);

-- ── §4 — budgets: strict (scope, year, month) identity ──────────────────────
alter table budgets add column if not exists scope        text;
alter table budgets add column if not exists period_year  int;
alter table budgets add column if not exists period_month int;
alter table budgets add column if not exists custom_name  text;

-- Backfill scope + period_year/month from the legacy period + period_start.
update budgets set scope = case
    when period = 'annual'                       then 'annual'
    when period = 'custom'                       then 'custom'
    else 'month'                                  -- 'monthly'/null/others → month
  end
  where scope is null;

update budgets set
    period_year  = nullif(extract(year  from period_start)::int, 0),
    period_month = case when scope = 'month' then extract(month from period_start)::int else null end
  where period_start is not null and period_year is null;

-- Resolve period_start/period_end for month & annual where missing (TD-13 cols).
update budgets set
    period_start = make_date(period_year, period_month, 1),
    period_end   = (make_date(period_year, period_month, 1) + interval '1 month - 1 day')::date
  where scope = 'month' and period_year is not null and period_month is not null and period_start is null;
update budgets set
    period_start = make_date(period_year, 1, 1),
    period_end   = make_date(period_year, 12, 31)
  where scope = 'annual' and period_year is not null and period_start is null;

-- Identity: one budget per (household, scope, year[, month]). Partial unique
-- indexes — custom budgets are id-identified and excluded. This is what makes a
-- budget the SAME budget on every device (Investigation A root-cause fix).
-- NOTE: if duplicates exist pre-migration, this index creation will fail; the
-- gated runbook de-dupes into migration_issues first (see §pre-checks below).
create unique index if not exists uq_budget_month
  on budgets (household_id, period_year, period_month)
  where scope = 'month' and deleted_at is null;
create unique index if not exists uq_budget_annual
  on budgets (household_id, period_year)
  where scope = 'annual' and deleted_at is null;

-- ── §4 — budget_allocations child table (the reintroduced allocations, done
--    right: a row-synced, RLS'd child table, NOT the dropped v8.7 jsonb) ──────
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
create index if not exists ix_balloc_budget on budget_allocations (budget_id) where deleted_at is null;
create unique index if not exists uq_balloc_cat on budget_allocations (budget_id, category) where deleted_at is null;

alter table budget_allocations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'budget_allocations' and policyname = 'balloc_household') then
    create policy balloc_household on budget_allocations
      using (household_id in (select household_id from memberships where user_id = auth.uid()))
      with check (household_id in (select household_id from memberships where user_id = auth.uid()));
  end if;
end $$;

-- ── §5 — recurring schedules: RRULE + owner + single-source-of-truth ────────
alter table recurring_schedules add column if not exists rrule           text;
alter table recurring_schedules add column if not exists owner_member_id uuid references memberships(id) on delete set null;
alter table recurring_schedules add column if not exists auto_confirm    boolean not null default true;

-- Backfill an RRULE from the legacy frequency enum (best-effort; the form will
-- author proper RRULEs going forward).
update recurring_schedules set rrule = case frequency
    when 'weekly'     then 'FREQ=WEEKLY;INTERVAL=1'
    when 'monthly'    then 'FREQ=MONTHLY;INTERVAL=1'
    when 'yearly'     then 'FREQ=YEARLY;INTERVAL=1'
    when 'custom_day' then 'FREQ=MONTHLY;INTERVAL=1'
    else 'FREQ=MONTHLY;INTERVAL=1'
  end
  where rrule is null;

-- ── §5/§8 — transactions: link generated txns to their schedule, and txns to a
--    debt for the §8 debt drill-down ──────────────────────────────────────────
alter table transactions add column if not exists recurring_schedule_id uuid references recurring_schedules(id) on delete set null;
alter table transactions add column if not exists debt_id               uuid references debts(id) on delete set null;
create index if not exists ix_txn_schedule on transactions (recurring_schedule_id) where recurring_schedule_id is not null;
create index if not exists ix_txn_debt     on transactions (debt_id) where debt_id is not null;

-- Backfill debt_id from the v9 EMI split metadata in extras.
update transactions
  set debt_id = (extras->'emi_split'->>'debt_id')::uuid
  where debt_id is null
    and extras ? 'emi_split'
    and (extras->'emi_split'->>'debt_id') ~ '^[0-9a-f-]{36}$';

-- ════════════════════════════════════════════════════════════════════════════
-- §7 — DESTRUCTIVE: scrub extras.accountSplits  (GATED — run last, see header)
-- ════════════════════════════════════════════════════════════════════════════
-- Pre-flight: log every multi-account row so nothing is lost. A split row keeps
-- its primary account_id; if absent, it is assigned to the largest leg.
-- insert into migration_issues (migration, kind, entity_id, detail)
--   select '20260612120000_v91', 'accountSplit_collapsed', id,
--          jsonb_build_object('account_id', account_id, 'splits', extras->'accountSplits')
--     from transactions
--    where extras ? 'accountSplits';
--
-- update transactions
--    set account_id = coalesce(account_id, (
--          select (s->>'accountId')
--            from jsonb_array_elements(extras->'accountSplits') s
--           order by (s->>'amount')::numeric desc limit 1))
--  where extras ? 'accountSplits' and account_id is null;
--
-- update transactions set extras = extras - 'accountSplits' where extras ? 'accountSplits';
--
-- -- assert: none remain
-- do $$ begin
--   if exists (select 1 from transactions where extras ? 'accountSplits') then
--     raise exception 'accountSplits scrub incomplete';
--   end if;
-- end $$;
