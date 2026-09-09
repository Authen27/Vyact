-- ============================================================================
-- Audit S6 (2026-09-08) — erase_household_data violated its own schema.
--
-- THE BUG
-- The erase RPC ended with `update households set onboarding = null`, but
-- households.onboarding is `jsonb NOT NULL DEFAULT '{}'` with a CHECK that it
-- be a JSON object (20260606120000). Every real erase therefore raised 23502
-- and the WHOLE transactional wipe rolled back — "erase my data" has never
-- worked against the committed schema, and it failed silently for the user
-- behind a generic error.
--
-- THE FIX
-- Reset onboarding to its empty baseline ('{}'::jsonb) instead of null —
-- semantically identical (no onboarding state survives) and schema-legal.
-- Function body is otherwise byte-identical to 20260701120000.
-- ============================================================================

BEGIN;

create or replace function erase_household_data(h_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role
  from memberships
  where household_id = h_id and user_id = auth.uid()
  limit 1;

  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'not authorized to erase this household''s data';
  end if;

  delete from transactions        where household_id = h_id;
  delete from budgets              where household_id = h_id;
  delete from budget_allocations   where household_id = h_id;
  delete from goals                where household_id = h_id;
  delete from debts                where household_id = h_id;
  delete from assets               where household_id = h_id;
  delete from accounts             where household_id = h_id;
  delete from recurring_schedules  where household_id = h_id;
  delete from saved_views          where household_id = h_id;
  delete from activity_log         where household_id = h_id;

  -- Onboarding baseline/reference overlay (v9.7.0) lives in households.onboarding.
  -- NOT NULL + object CHECK ⇒ reset to the empty baseline, never null (audit S6).
  update households set onboarding = '{}'::jsonb where id = h_id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h_id, auth.uid(), 'erase_household_data', 'household', h_id, jsonb_build_object('erased_at', now()));
end;
$$;

-- `create or replace` keeps existing grants; re-assert for safety.
grant execute on function erase_household_data(uuid) to authenticated;

COMMIT;
