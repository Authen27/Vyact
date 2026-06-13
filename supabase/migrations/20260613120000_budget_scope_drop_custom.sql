-- Vyact — remove the "custom" budget scope (monthly + annual only).
-- Custom date-range budgets were dropped from the Budgets module (more confusion
-- than use-case). The app now only writes scope ∈ {month, annual}; this CHECK
-- makes the database reject anything else so a stale client can't reintroduce it.
-- Forward-only, idempotent. Applied to prod 2026-06-13 (0 custom rows existed).

-- Defensive: fold any legacy custom rows back to month before constraining
-- (no-op when none exist).
update public.budgets
   set scope = 'month',
       period_month = coalesce(period_month, extract(month from coalesce(period_start, now()))::int),
       period_year  = coalesce(period_year,  extract(year  from coalesce(period_start, now()))::int),
       custom_name  = null
 where scope = 'custom';

alter table public.budgets drop constraint if exists ck_budget_scope;
alter table public.budgets
  add constraint ck_budget_scope check (scope is null or scope in ('month','annual')) not valid;
alter table public.budgets validate constraint ck_budget_scope;
