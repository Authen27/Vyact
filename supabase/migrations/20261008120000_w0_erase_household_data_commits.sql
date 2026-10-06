-- W0 (audit 2026-10-04, DB-INT-05 / DB-OPS-04) — "Erase all data" always rolled back.
--
-- erase_household_data ended with an activity_log insert whose action was
-- 'erase_household_data'. activity_log.action is CHECKed to
-- ('created','updated','deleted','invited','accepted','removed','role_changed','transferred')
-- (baseline), so that last insert raised and Postgres rolled back every delete before
-- it: the button reported failure and nothing was erased, ever.
--
-- Body identical to 20260911150000_v1030_net_worth_snapshots.sql except the audit row,
-- which now uses an allowed action ('deleted') and says what happened in `changes`.

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
  delete from net_worth_snapshots  where household_id = h_id;
  delete from activity_log         where household_id = h_id;

  -- Onboarding baseline/reference overlay (v9.7.0) lives in households.onboarding.
  -- NOT NULL + object CHECK ⇒ reset to the empty baseline, never null (audit S6).
  update households set onboarding = '{}'::jsonb where id = h_id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h_id, auth.uid(), 'deleted', 'household', h_id,
          jsonb_build_object('kind', 'erase_household_data', 'erased_at', now()));
end;
$$;

-- `create or replace` keeps existing grants; re-assert the v10.22 lock-down.
revoke all on function erase_household_data(uuid) from public;
revoke all on function erase_household_data(uuid) from anon;
grant execute on function erase_household_data(uuid) to authenticated;

COMMIT;
