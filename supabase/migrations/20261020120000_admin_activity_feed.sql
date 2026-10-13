-- ADM-03 / FE-PUB-01, step 1 of 2 (v10.92.0; owner decision 13 Oct 2026): platform admins see WHO did
-- WHAT and WHEN in a household's activity log, never the values.
--
-- activity_log.changes holds row images: amounts, payees, descriptions, names. The admin Audit page
-- reads the table directly (`activity_log_read`: is_member(household_id) OR is_admin('roles')), so a
-- roles-tier admin could read every household's values. W1a (D24) stopped admin reads of the ledger
-- tables; this table was left for the next step.
--
-- This migration adds the server feed the Audit page will use. It returns the time, the household, the
-- actor, the action, the entity type and the entity id, and never `changes`. It changes nothing else:
-- the admin page still reads the table until step 2, so the page is never empty in between.
--
-- Step 2 (the admin app PR) switches the Audit page and its CSV to this function, then narrows
-- `activity_log_read` to members only. That migration must not ship before this one is live.

BEGIN;

create or replace function public.admin_activity_feed(p_limit integer default 200, p_before timestamptz default null)
  returns table (id uuid, created_at timestamptz, household_id uuid, actor_id uuid,
                 action text, entity_type text, entity_id uuid)
  language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin('roles') then
    raise exception 'forbidden: admin role required' using errcode = '42501';
  end if;

  -- Newest first. p_before pages back: the next page starts below the oldest row already shown.
  -- Every column is named on purpose: `changes` must never be added here.
  return query
    select a.id, a.created_at, a.household_id, a.actor_id, a.action, a.entity_type, a.entity_id
      from public.activity_log a
     where p_before is null or a.created_at < p_before
     order by a.created_at desc, a.id desc
     limit least(greatest(coalesce(p_limit, 200), 1), 1000);
end $$;

-- Not reachable without signing in (v10.22 rule: revoke the PUBLIC default anon inherits).
revoke all on function public.admin_activity_feed(integer, timestamptz) from public, anon;
grant execute on function public.admin_activity_feed(integer, timestamptz) to authenticated, service_role;

COMMIT;
