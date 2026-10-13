-- ADM-03 / FE-PUB-01, step 2 of 2 (v10.93.0, admin v1.4.5; owner decision 13 Oct 2026): platform admins
-- see who did what and when in a household's activity log, never the values.
--
-- Step 1 (20261020120000_admin_activity_feed.sql, v10.92.0) added `admin_activity_feed`, which returns
-- the time, household, actor, action and entity, and never `changes`. The admin Audit page reads it from
-- admin v1.4.5. This migration closes the direct read: `activity_log_read` was
-- `is_member(household_id) or is_admin('roles')`, so a roles-tier admin could still select every
-- household's rows, row images (`changes`) included. It becomes members only.
--
-- Members are unaffected: the household Activity panel reads its own household's log as before.
-- Ship order: step 1 must be live first; the admin page no longer reads the table.

BEGIN;

-- Sweep: drop EVERY select policy on activity_log that calls is_admin, not just the ones the
-- migrations name. Production holds objects no migration creates (docs/DEVELOPER_INPUTS.md Q1), so a
-- name list could leave a prod-only admin read in place (the W1a pattern).
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public' and tablename = 'activity_log' and cmd = 'SELECT' and qual ilike '%is_admin%'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

drop policy if exists "activity_log_read" on public.activity_log;
create policy "activity_log_read" on public.activity_log for select to authenticated
  using (public.is_member(household_id));

COMMIT;
