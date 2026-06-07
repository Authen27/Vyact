-- Decision (c) — sub-category budget allocations were removed in favour of a
-- monthly/annual → category roll-up VIEW (computed client-side via budgetRollup).
-- Drop the now-unused jsonb column added by 20260607140000_v8_budgets_allocations.sql.
-- No app code references budgets.allocations after this release.

alter table budgets drop column if exists allocations;
