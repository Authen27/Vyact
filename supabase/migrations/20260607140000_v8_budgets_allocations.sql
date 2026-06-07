-- Money-Model B2.3 — category sub-limits (allocations) that roll up to a budget.
-- Additive jsonb; safe ahead of the flag (no behaviour until budgetsV2.allocations
-- is on). Shape: [{ "category": "<label>", "limit": <number> }, ...]. Existing
-- budgets default to [] and are unaffected.

BEGIN;

alter table budgets
  add column if not exists allocations jsonb not null default '[]'::jsonb;

alter table budgets drop constraint if exists budgets_allocations_is_array;
alter table budgets add  constraint budgets_allocations_is_array
  check (jsonb_typeof(allocations) = 'array');

comment on column budgets.allocations is
  'Money-Model B2.3 — category sub-limits rolling up to monthly_limit.';

COMMIT;
