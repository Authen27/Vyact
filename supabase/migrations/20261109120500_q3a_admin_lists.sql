-- Q3a (v10.130.0; audit ADM-08, INT-HH-14; owner brought them in from the backlog, 20 Oct 2026).
--
-- The admin Users and Households pages read whole tables, and the API returns at most 1,000 rows a request, so
-- past 1,000 people or memberships the lists and the member counts were cut short without a word. These read
-- one page at a time (newest first), search on the server, count members with a GROUP BY, and return the total
-- that matched with every row. Roles-tier staff only (super included), as admin_list_users.
-- admin_list_users stays for the admin app until v1.5.0 reads these; it is retired after that.

create or replace function public.admin_list_users_page(p_limit int default 100, p_offset int default 0, p_query text default null)
returns table (id uuid, email text, display_name text, email_confirmed boolean, created_at timestamptz,
               last_sign_in_at timestamptz, household_count int, is_admin boolean, admin_role text, total bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.is_admin('roles') then
    raise exception 'forbidden: admin role required' using errcode = '42501';
  end if;
  return query
    with matched as (
      select u.id, u.email::text as email, p.display_name, (u.email_confirmed_at is not null) as email_confirmed,
             u.created_at, u.last_sign_in_at
        from auth.users u
        left join public.profiles p on p.id = u.id
       where v_q is null
          or u.email ilike '%' || v_q || '%'
          or p.display_name ilike '%' || v_q || '%'
    )
    select m.id, m.email, m.display_name, m.email_confirmed, m.created_at, m.last_sign_in_at,
           (select count(*)::int from public.memberships ms where ms.user_id = m.id) as household_count,
           (a.user_id is not null) as is_admin, a.role as admin_role,
           count(*) over () as total
      from matched m
      left join public.admin_roles a on a.user_id = m.id
     order by m.created_at desc, m.id
     limit greatest(1, least(coalesce(p_limit, 100), 500))
    offset greatest(0, coalesce(p_offset, 0));
end $$;

create or replace function public.admin_list_households(p_limit int default 100, p_offset int default 0, p_query text default null)
returns table (id uuid, name text, type text, base_currency text, created_by uuid, created_at timestamptz,
               member_count int, total bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_q text := nullif(btrim(coalesce(p_query, '')), '');
begin
  if not public.is_admin('roles') then
    raise exception 'forbidden: admin role required' using errcode = '42501';
  end if;
  return query
    select h.id, h.name, h.type, h.base_currency, h.created_by, h.created_at,
           coalesce(c.n, 0)::int as member_count,
           count(*) over () as total
      from public.households h
      left join (select household_id, count(*) as n from public.memberships group by household_id) c
             on c.household_id = h.id
     where v_q is null or h.name ilike '%' || v_q || '%'
     order by h.created_at desc, h.id
     limit greatest(1, least(coalesce(p_limit, 100), 500))
    offset greatest(0, coalesce(p_offset, 0));
end $$;

-- The pages' headline counts, which they used to work out from the whole (truncated) list.
create or replace function public.admin_people_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin('roles') then
    raise exception 'forbidden: admin role required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'users', jsonb_build_object(
      'total',          (select count(*) from auth.users),
      'confirmed',      (select count(*) from auth.users where email_confirmed_at is not null),
      'admins',         (select count(*) from public.admin_roles),
      'multiHousehold', (select count(*) from (select user_id from public.memberships
                                                group by user_id having count(*) > 1) m)),
    'households', jsonb_build_object(
      'total',       (select count(*) from public.households),
      'multiMember', (select count(*) from (select household_id from public.memberships
                                             group by household_id having count(*) >= 2) m),
      'byType',      (select coalesce(jsonb_object_agg(type, n), '{}'::jsonb)
                        from (select type, count(*) as n from public.households group by type) t)));
end $$;

revoke all on function public.admin_people_summary() from public, anon;
grant execute on function public.admin_people_summary() to authenticated;
revoke all on function public.admin_list_users_page(int, int, text) from public, anon;
revoke all on function public.admin_list_households(int, int, text) from public, anon;
grant execute on function public.admin_list_users_page(int, int, text) to authenticated;
grant execute on function public.admin_list_households(int, int, text) to authenticated;
