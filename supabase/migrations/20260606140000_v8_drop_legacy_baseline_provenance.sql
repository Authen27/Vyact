-- v8.1.2 cleanup — drop the dead households.baseline_provenance column.
--
-- An early draft of the v8 onboarding migration stored record provenance as a
-- jsonb map on households.baseline_provenance. The shipped design instead uses
-- normalized confidence/source/estimated_at/confirmed_at columns on each
-- baseline-derived entity table (transactions/budgets/goals/debts/assets), so
-- baseline_provenance was never read or written by app code — pure legacy residue.
--
-- my_households (select h.*) depends on the column, so drop + recreate the view
-- around the column drop. households.onboarding (the live per-household state
-- machine record) stays.

BEGIN;

drop view if exists my_households;

alter table households drop column if exists baseline_provenance;

create view my_households with (security_invoker = true) as
  select h.*, m.role, m.display_name as my_display_name, m.household_role
  from households h
  join memberships m on m.household_id = h.id
  where m.user_id = auth.uid();

grant select on my_households to authenticated;

COMMIT;
