-- v10.59.0 — household types: Personal · Couple · Family · Business (owner, 4 Oct 2026).
--
--   personal  private: the owner only, no one can be invited
--   couple    the owner and ONE other member
--   family    the owner and as many members as they invite
--   business  as many members as they invite; Pip and Insights add business terms
--             (cash runway, setting aside for tax)
--
-- Retired: 'shared' (roommates / partner pool) → family, so nobody's members exceed a
-- limit. ('multi_biz' existed only in the app; the database never accepted it.)
-- A personal household that already has other members becomes couple (2) or family
-- (3+): the limit applies to new invitations, and nobody is ever removed by this.
--
-- The limits live HERE, not only in the app: a BEFORE INSERT trigger on invitations
-- (pending invitations count toward the limit) and on memberships (the accept RPC),
-- and a guard on changing the type to one the current members don't fit.

alter table public.households drop constraint if exists households_type_check;

update public.households set type = 'family' where type = 'shared';

update public.households h
   set type = case when m.n > 2 then 'family' else 'couple' end
  from (select household_id, count(*) as n from public.memberships group by household_id) m
 where m.household_id = h.id and h.type = 'personal' and m.n > 1;

alter table public.households
  add constraint households_type_check check (type in ('personal', 'couple', 'family', 'business'));

-- Members a household type has room for (owner included); null = no limit.
create or replace function public.household_member_limit(p_type text)
returns integer
language sql immutable
set search_path = public
as $$
  select case p_type when 'personal' then 1 when 'couple' then 2 else null end;
$$;

grant execute on function public.household_member_limit(text) to authenticated;

create or replace function public.enforce_household_member_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type  text;
  v_limit integer;
  v_count integer;
begin
  select type into v_type from households where id = new.household_id;
  v_limit := household_member_limit(v_type);
  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count from memberships where household_id = new.household_id;
  if tg_table_name = 'invitations' then
    v_count := v_count + (select count(*) from invitations
                           where household_id = new.household_id
                             and accepted_at is null and expires_at > now());
  end if;

  if v_count >= v_limit then
    raise exception 'HOUSEHOLD_FULL: a % household has room for % member%',
      v_type, v_limit, case when v_limit = 1 then '' else 's' end
      using errcode = 'P0001',
            hint = case v_type
                     when 'personal' then 'Personal households are private. Change the type to Couple or Family to invite someone.'
                     else 'A Couple household has room for one other person. Change the type to Family to invite more.'
                   end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_invitations_member_limit on public.invitations;
create trigger trg_invitations_member_limit
  before insert on public.invitations
  for each row execute function public.enforce_household_member_limit();

drop trigger if exists trg_memberships_member_limit on public.memberships;
create trigger trg_memberships_member_limit
  before insert on public.memberships
  for each row execute function public.enforce_household_member_limit();

-- A type the current members don't fit is refused (Family with 3 members → Couple).
create or replace function public.enforce_household_type_fits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_count integer;
begin
  if new.type is not distinct from old.type then
    return new;
  end if;
  v_limit := household_member_limit(new.type);
  if v_limit is null then
    return new;
  end if;
  select count(*) into v_count from memberships where household_id = new.id;
  if v_count > v_limit then
    raise exception 'HOUSEHOLD_TYPE_TOO_SMALL: this household has % members; a % household has room for %',
      v_count, new.type, v_limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_households_type_fits on public.households;
create trigger trg_households_type_fits
  before update of type on public.households
  for each row execute function public.enforce_household_type_fits();

revoke execute on function public.enforce_household_member_limit() from public, anon, authenticated;
revoke execute on function public.enforce_household_type_fits() from public, anon, authenticated;
