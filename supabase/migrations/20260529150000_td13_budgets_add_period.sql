-- TD-13 — server-side budget period columns.
--
-- Discovery during PR #20 prep: the previous SUPERSEDED README claimed
-- this had been applied to prod via the Dashboard, but the captured
-- baseline at 00000000000001_production_state_baseline.sql shows
-- budgets has neither `period` nor `period_start`/`period_end` columns.
-- So TD-13 was actually still on paper, like TD-08 and TD-09. This
-- migration re-lands it as a fresh additive change through the now-
-- validated `supabase db push` pipeline (PR #16 + hotfixes #17–#19).
--
-- Adds:
--   period       text not null default 'monthly'
--   period_start date null
--   period_end   date null
-- and a check constraint matching the consumer's BudgetPeriod enum.
--
-- Until this migration applies, the consumer falls back to per-device
-- localStorage overlays (`budgetMeta.ts`, per the v6.4 convention in
-- CLAUDE.md). After it applies, those overlays can fold into the cloud
-- write path in a follow-up PR.

begin;

alter table budgets
  add column if not exists period       text not null default 'monthly',
  add column if not exists period_start date null,
  add column if not exists period_end   date null;

-- Constraint name mirrors the previous superseded migration so anyone
-- diff-ing the two sees the equivalence.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'budgets_period_check'
      and conrelid = 'public.budgets'::regclass
  ) then
    alter table budgets
      add constraint budgets_period_check
      check (period in ('monthly','quarterly','half_yearly','annual','custom'));
  end if;
end$$;

commit;
