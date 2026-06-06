-- v8.0.2 hotfix — expose households.onboarding through the my_households view.
--
-- 20260606120000_v8_onboarding_state.sql added households.onboarding, but the
-- my_households view had been created with an EXPANDED column list (Postgres
-- freezes `select h.*` into explicit columns at creation time). Adding a column
-- to the base table therefore did NOT add it to the view, so the consumer's
-- `GET /rest/v1/my_households?select=...,onboarding` returned 400 and blocked the
-- entire app on load (listHouseholds runs during init).
--
-- A view's column set cannot be reordered/extended in the middle via CREATE OR
-- REPLACE, so we DROP and recreate. Confirmed no other view depends on it.
-- Recreating re-expands h.* to the current household columns (incl. onboarding
-- and baseline_provenance). security_invoker + grant restored to match the
-- original definition.

BEGIN;

drop view if exists my_households;

create view my_households with (security_invoker = true) as
  select h.*, m.role, m.display_name as my_display_name, m.household_role
  from households h
  join memberships m on m.household_id = h.id
  where m.user_id = auth.uid();

grant select on my_households to authenticated;

COMMIT;
