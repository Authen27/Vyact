-- Money Map · Phase 3 — saved filter views (Item #4)
--
-- Spec: docs/SOLUTION_MONEY_MAP.md → "v7.3 Migration C".
-- Per-user, per-page filter snapshots that survive across devices.
-- Sharing is opt-in at the row level (`is_shared = true`) and limited
-- to the owner's household via the second policy.
--
-- Sec-2 (privacy): the `filters` jsonb is sanitised app-side before
-- save — only filter parameters ever leak into a shared view, never
-- transaction ids, member ids, or descriptions. The DB does not enforce
-- the shape; the app does. This mirrors the `extras` discipline on
-- `transactions`.
--
-- Run order: after 20260529151500_td08_td09_harden_execute_grants.sql
-- (depends on `is_member` / `is_admin` helpers).

BEGIN;

-- ─── 1. Table ───────────────────────────────────────────────────────────
create table if not exists saved_views (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  page          text not null check (page in ('transactions','reports','insights')),
  name          text not null,
  filters       jsonb not null default '{}'::jsonb,
  is_shared     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists saved_views_user
  on saved_views (user_id, page) where deleted_at is null;

create index if not exists saved_views_household_shared
  on saved_views (household_id, page)
  where is_shared and deleted_at is null;

-- ─── 2. updated_at trigger ──────────────────────────────────────────────
create or replace function public.tg_saved_views_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_views_touch_updated_at on saved_views;
create trigger saved_views_touch_updated_at
  before update on saved_views
  for each row execute function public.tg_saved_views_touch_updated_at();

-- ─── 3. RLS ─────────────────────────────────────────────────────────────
alter table saved_views enable row level security;

drop policy if exists "saved_views_self"             on saved_views;
drop policy if exists "saved_views_household_shared" on saved_views;
drop policy if exists "saved_views_insert"           on saved_views;
drop policy if exists "saved_views_update"           on saved_views;
drop policy if exists "saved_views_delete"           on saved_views;

-- Owner sees their own rows always.
create policy "saved_views_self" on saved_views for select to authenticated
  using (user_id = auth.uid() or is_admin('roles'));

-- Other household members see rows the owner explicitly shared.
create policy "saved_views_household_shared" on saved_views for select to authenticated
  using (is_shared and is_member(household_id));

-- Owner-only writes. Members do NOT inherit edit rights on shared rows.
create policy "saved_views_insert" on saved_views for insert to authenticated
  with check (user_id = auth.uid() and is_member(household_id));

create policy "saved_views_update" on saved_views for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "saved_views_delete" on saved_views for delete to authenticated
  using (user_id = auth.uid());

-- ─── 4. replace_saved_views RPC (TD-09 family) ──────────────────────────
-- Note: scoped to (household, user) — we never wipe another user's saved
-- views. Bulk-replace stays per-owner.
create or replace function public.replace_saved_views(h uuid, rows jsonb)
returns setof saved_views
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;
  if not is_member(h) then
    raise exception 'Not a member of this household';
  end if;

  update saved_views
     set deleted_at = now()
   where household_id = h
     and user_id = auth.uid()
     and deleted_at is null;

  return query
  insert into saved_views (id, user_id, household_id, page, name, filters, is_shared, created_at, updated_at, deleted_at)
  select coalesce(t.id, gen_random_uuid()),
         auth.uid(),
         h,
         t.page,
         t.name,
         coalesce(t.filters, '{}'::jsonb),
         coalesce(t.is_shared, false),
         coalesce(t.created_at, now()),
         coalesce(t.updated_at, now()),
         t.deleted_at
    from jsonb_populate_recordset(null::saved_views, rows) as t;
end;
$$;

revoke execute on function public.replace_saved_views(uuid, jsonb) from public;
revoke execute on function public.replace_saved_views(uuid, jsonb) from anon;
grant  execute on function public.replace_saved_views(uuid, jsonb) to authenticated;

COMMIT;
