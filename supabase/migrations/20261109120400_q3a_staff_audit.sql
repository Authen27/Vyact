-- Q3a (v10.130.0; audit ADM-04; owner brought it in from the backlog, 20 Oct 2026).
--
-- What Vyact staff change, and who changed it, is recorded and cannot be edited:
--   - admin_roles: a role granted, changed or revoked;
--   - content_items: a Learn item created, edited (which fields; never the text), published or deleted;
--   - category_classifications: a category's need/want changed (old → new);
--   - ai_model_configs: Pip's model settings changed (which fields; seam, provider, model and the enabled flag
--     by value; params are never copied, though a CHECK keeps secrets out of them).
-- A change made in the Supabase dashboard or by a migration has no signed-in user: it is recorded with no actor
-- ("dashboard"). Rows are never updated or deleted (a trigger refuses it, for every role). There is no
-- household data here, so it is not part of a household erase.
--
-- Roles are granted and revoked through grant_admin_role / revoke_admin_role (super admins only); the last
-- super admin can neither be demoted nor removed. Super admins read the trail through admin_staff_audit.

create table if not exists public.admin_audit (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  -- auth.users id, intentionally not a foreign key: the trail outlives an account (it holds no other data).
  actor_id     uuid,
  action       text not null check (action in ('insert', 'update', 'delete')),
  target_table text not null check (target_table in ('admin_roles', 'content_items', 'category_classifications', 'ai_model_configs')),
  target_id    text,
  changed      text[] not null default '{}',
  detail       jsonb not null default '{}'::jsonb
);
create index if not exists ix_admin_audit_at on public.admin_audit (at desc);

alter table public.admin_audit enable row level security;
revoke all on table public.admin_audit from public, anon, authenticated;
grant select on table public.admin_audit to service_role;

-- Append-only, for everyone (service role and dashboard included).
create or replace function public.admin_audit_append_only()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'admin_audit_append_only: the staff audit trail is never changed' using errcode = '42501';
end $$;
drop trigger if exists trg_admin_audit_append_only on public.admin_audit;
create trigger trg_admin_audit_append_only before update or delete on public.admin_audit
  for each row execute function public.admin_audit_append_only();
revoke all on function public.admin_audit_append_only() from public, anon, authenticated;

-- One row per staff-managed change.
create or replace function public.log_staff_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  v_changed text[] := '{}';
  v_detail  jsonb;
  v_target  text;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into v_changed
      from jsonb_object_keys(n) k
     where k not in ('updated_at', 'created_at') and (o -> k) is distinct from (n -> k);
    if cardinality(v_changed) = 0 then return null; end if;   -- a no-op update records nothing
  end if;

  if tg_table_name = 'admin_roles' then
    v_target := r ->> 'user_id';
    v_detail := jsonb_build_object('role_before', o ->> 'role', 'role_after', n ->> 'role');
  elsif tg_table_name = 'content_items' then
    v_target := r ->> 'id';
    v_detail := jsonb_build_object('slug', r ->> 'slug', 'status_before', o ->> 'status', 'status_after', n ->> 'status');
  elsif tg_table_name = 'category_classifications' then
    v_target := r ->> 'category';
    v_detail := jsonb_build_object('before', o ->> 'classification', 'after', n ->> 'classification');
  elsif tg_table_name = 'ai_model_configs' then
    v_target := r ->> 'id';
    v_detail := jsonb_build_object('seam', r ->> 'seam', 'provider', r ->> 'provider', 'model', r ->> 'model',
                                   'enabled_before', o -> 'enabled', 'enabled_after', n -> 'enabled');
  else
    return null;
  end if;

  insert into public.admin_audit (actor_id, action, target_table, target_id, changed, detail)
  values (auth.uid(), lower(tg_op), tg_table_name, v_target, v_changed, jsonb_strip_nulls(v_detail));
  return null;
end $$;
revoke all on function public.log_staff_change() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['admin_roles', 'content_items', 'category_classifications', 'ai_model_configs'] loop
    execute format('drop trigger if exists trg_%1$s_staff_audit on public.%1$I', t);
    execute format('create trigger trg_%1$s_staff_audit after insert or update or delete on public.%1$I
                      for each row execute function public.log_staff_change()', t);
  end loop;
end $$;

-- ── Granting and revoking staff roles ────────────────────────────────────────────────────────────────────────────
create or replace function public.grant_admin_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin('super') then
    raise exception 'only_super_admins_grant_roles' using errcode = '42501';
  end if;
  if p_role is null or p_role not in ('super', 'roles', 'content') then
    raise exception 'invalid_admin_role' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  -- Serialise role changes, so two demotions cannot leave no super admin.
  lock table public.admin_roles in share row exclusive mode;
  if p_role <> 'super'
     and exists (select 1 from public.admin_roles where user_id = p_user and role = 'super')
     and (select count(*) from public.admin_roles where role = 'super') <= 1 then
    raise exception 'last_super_admin: grant another super admin first' using errcode = '42501';
  end if;
  insert into public.admin_roles (user_id, role, granted_by, granted_at)
  values (p_user, p_role, auth.uid(), now())
  on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by, granted_at = excluded.granted_at;
end $$;

create or replace function public.revoke_admin_role(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin('super') then
    raise exception 'only_super_admins_revoke_roles' using errcode = '42501';
  end if;
  lock table public.admin_roles in share row exclusive mode;
  if exists (select 1 from public.admin_roles where user_id = p_user and role = 'super')
     and (select count(*) from public.admin_roles where role = 'super') <= 1 then
    raise exception 'last_super_admin: grant another super admin first' using errcode = '42501';
  end if;
  delete from public.admin_roles where user_id = p_user;
  return found;
end $$;

-- ── Reading the trail ────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_staff_audit(p_limit int default 100, p_before timestamptz default null)
returns table (id bigint, at timestamptz, actor_id uuid, actor_email text, action text, target_table text,
               target_id text, changed text[], detail jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin('super') then
    raise exception 'forbidden: super admin required' using errcode = '42501';
  end if;
  return query
    select a.id, a.at, a.actor_id, u.email::text, a.action, a.target_table, a.target_id, a.changed, a.detail
      from public.admin_audit a
      left join auth.users u on u.id = a.actor_id
     where p_before is null or a.at < p_before
     order by a.at desc, a.id desc
     limit greatest(1, least(coalesce(p_limit, 100), 500));
end $$;

revoke all on function public.grant_admin_role(uuid, text) from public, anon;
revoke all on function public.revoke_admin_role(uuid) from public, anon;
revoke all on function public.admin_staff_audit(int, timestamptz) from public, anon;
grant execute on function public.grant_admin_role(uuid, text) to authenticated;
grant execute on function public.revoke_admin_role(uuid) to authenticated;
grant execute on function public.admin_staff_audit(int, timestamptz) to authenticated;
