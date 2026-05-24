-- TD-04 — version-control the privileged admin surface.
--
-- Brings the admin authorisation layer + the dashboard KPIs RPC into a
-- reviewable, source-controlled migration. Both were previously hand-run
-- against production via the Supabase SQL editor and so were absent from
-- any committed schema, meaning a fresh environment provisioned from the
-- repo would silently lack the privilege model the admin app relies on.
--
-- Scope (deliberately narrow, matching the TD-04 spec verbatim):
--   • admin_role enum            ('super', 'roles', 'content')
--   • admin_roles table          (user_id ↔ role)
--   • is_admin() / has_admin_role() helper functions
--   • RLS on admin_roles
--   • admin_dashboard_kpis() RPC returning the DashboardKpis shape that
--     admin/src/lib/adminApi.ts already expects
--
-- Out of scope for this migration (filed as follow-up TD-04-extension):
--   • subscriptions      table  (referenced by admin/src/lib/adminApi.ts
--                                fetchAllSubscriptions) — KPI fields
--                                paidSubscriptions / mrr will read this
--                                once it's versioned; until then they
--                                report 0.
--   • content_items      table  (referenced by admin/src/lib/contentApi.ts
--                                + Insights consumer page). Same story
--                                for publishedArticles / contentFavorites.
--   • admin_weekly_trend / admin_ai_usage_summary / admin_list_users RPCs
--     (also unversioned today).
--
-- Each follow-up migration ratchets one more piece of the unversioned
-- admin surface into the committed schema and CAN replace this function
-- via CREATE OR REPLACE FUNCTION to plug in the real numbers.

-- ── 1. admin_role enum ───────────────────────────────────────────
-- Wrapped in a DO block so re-applying the migration after a partial
-- rollback doesn't fail. The enum mirrors the AdminRole TS type in
-- admin/src/types.ts so the wire contract stays single-sourced.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type admin_role as enum ('super', 'roles', 'content');
  end if;
end$$;

-- ── 2. admin_roles table ─────────────────────────────────────────
-- One row per privileged user. user_id is the PK so a user is granted at
-- most one tier; promote/demote is a single UPDATE. References auth.users
-- (matching the existing profiles.id → auth.users.id pattern in the
-- baseline) so deleting a user cascades the privilege away.
create table if not exists admin_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        admin_role not null,
  granted_by  uuid references auth.users(id),
  granted_at  timestamptz not null default now(),
  notes       text
);

create index if not exists admin_roles_role_idx on admin_roles(role);

-- ── 3. helper functions ──────────────────────────────────────────
-- Server-side checks. SECURITY DEFINER + a fixed search_path so callers
-- can use these from any RLS expression without the lookup itself going
-- through RLS (which would create a recursion: "to know if you're admin,
-- read admin_roles, which requires being admin to read"). is_member /
-- role_in in the baseline use the same pattern.
create or replace function is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_roles where user_id = uid);
$$;

create or replace function has_admin_role(target_role admin_role, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_roles
    where user_id = uid
      and (role = target_role or role = 'super')   -- super implies all tiers
  );
$$;

-- ── 4. RLS on admin_roles ────────────────────────────────────────
-- Read rules:
--   • a user can see their own row (so the admin app's
--     fetchMyAdminRole(uid) works for any signed-in user)
--   • a super admin can see every row (for an "admins list" UI)
-- Write rules:
--   • only super admins can grant or revoke privilege
alter table admin_roles enable row level security;

drop policy if exists "user reads own admin row"    on admin_roles;
drop policy if exists "super reads all admin rows"  on admin_roles;
drop policy if exists "super inserts admin rows"    on admin_roles;
drop policy if exists "super updates admin rows"    on admin_roles;
drop policy if exists "super deletes admin rows"    on admin_roles;

create policy "user reads own admin row"
  on admin_roles for select using (user_id = auth.uid());

create policy "super reads all admin rows"
  on admin_roles for select using (has_admin_role('super'));

create policy "super inserts admin rows"
  on admin_roles for insert with check (has_admin_role('super'));

create policy "super updates admin rows"
  on admin_roles for update using (has_admin_role('super')) with check (has_admin_role('super'));

create policy "super deletes admin rows"
  on admin_roles for delete using (has_admin_role('super'));

-- ── 5. admin_dashboard_kpis() RPC ────────────────────────────────
-- Returns the DashboardKpis shape expected by
-- admin/src/lib/adminApi.ts:fetchDashboardKpis. The output is a single
-- jsonb object, matching the admin app's `.rpc('admin_dashboard_kpis')`
-- + `data as DashboardKpis` cast.
--
-- SECURITY DEFINER + search_path so a logged-in admin can read the
-- aggregates without each underlying table needing its RLS relaxed.
-- The function is GUARDED at the top: callers who are not in admin_roles
-- get a permission-denied error, never the data.
--
-- Fields whose backing tables are still unversioned today return 0;
-- each such line is commented with the table/migration that will
-- replace it.
create or replace function admin_dashboard_kpis()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.admin_roles where user_id = uid) then
    raise exception 'admin_dashboard_kpis: caller is not an admin'
      using errcode = '42501';   -- insufficient_privilege
  end if;

  return jsonb_build_object(
    -- Total users in the system. profiles is the authoritative public mirror
    -- of auth.users (every signup creates a row via handle_new_user()).
    'totalUsers',        (select count(*) from public.profiles),

    -- Households + multi-member ratio.
    'totalHouseholds',   (select count(*) from public.households),
    'multiMemberPct',    (
      select coalesce(
        round(100.0 * count(*) filter (where mc > 1) / nullif(count(*), 0), 1),
        0
      )
      from (
        select household_id, count(*) as mc
        from public.memberships
        group by household_id
      ) hh
    ),

    -- 7-day active windows. "Active" here means "appears as created_by on a
    -- non-deleted transaction in the last 7 days". A richer notion (logins,
    -- sessions) needs an events table, deferred.
    'activeUsers7d',     (
      select count(distinct created_by)
      from public.transactions
      where deleted_at is null
        and created_at >= now() - interval '7 days'
        and created_by is not null
    ),
    'activeHouseholds7d',(
      select count(distinct household_id)
      from public.transactions
      where deleted_at is null
        and created_at >= now() - interval '7 days'
    ),

    -- New signups in the last 7 / 30 days, from profiles.created_at.
    'signups7d',         (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'signups30d',        (select count(*) from public.profiles where created_at >= now() - interval '30 days'),

    -- All-time + 7-day transaction counts (deleted excluded).
    'totalTransactions', (select count(*) from public.transactions where deleted_at is null),
    'transactions7d',    (
      select count(*) from public.transactions
      where deleted_at is null
        and created_at >= now() - interval '7 days'
    ),

    -- Content KPIs depend on the content_items table which is referenced
    -- by admin/src/lib/contentApi.ts but not yet in versioned migrations.
    -- TODO(TD-04-content): once content_items lands, replace these with:
    --   (select count(*) from public.content_items where status = 'published')
    --   (sum of favorites across content_items / a content_favorites join)
    'publishedArticles', 0,
    'contentFavorites',  0,

    -- Subscription KPIs depend on the subscriptions table (also
    -- referenced by admin/src/lib/adminApi.ts but unversioned today).
    -- TODO(TD-04-subscriptions): once subscriptions lands, replace with
    -- counts/sums filtered by status='active' AND tier != 'free'.
    'paidSubscriptions', 0,
    'mrr',               0,

    -- Server time the snapshot was computed.
    'computedAt',        now()
  );
end;
$$;

-- Authenticated users can CALL the function; the function body itself
-- enforces the admin check on uid. Without this grant, even an admin
-- can't invoke the RPC from the client.
grant execute on function admin_dashboard_kpis() to authenticated;
grant execute on function is_admin(uuid)         to authenticated;
grant execute on function has_admin_role(admin_role, uuid) to authenticated;
