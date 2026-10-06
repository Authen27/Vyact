-- W1a (audit 2026-10-04, DB-SEC-02 / INT-CON-01 / INT-HH-01 / DB-INT-02 / INT-CON-07 /
-- INT-HH-06) — only the owner can transfer ownership, and a household with members always
-- keeps an owner.
--
-- 1. transfer_ownership guarded itself with
--      if (select role ... where user_id = auth.uid()) <> 'owner' then raise
--    For a caller who is NOT a member the sub-select is NULL, `NULL <> 'owner'` is NULL, the
--    IF does not fire, and the function promoted the target. A viewer could create a second
--    account (not a member) and use it to promote their own membership to owner. It also
--    never checked that the target is a member of the household.
--
-- 2. Nothing kept an owner in the household. RLS lets an owner delete their own membership
--    or demote themselves directly (leave_household's last-owner check is bypassed that
--    way), leaving members in a household nobody can manage. A DEFERRED constraint trigger
--    now refuses any statement that leaves a household which still has members without an
--    owner. It is checked at commit, so transfer_ownership (promote, then demote) and a whole
--    household being deleted (every membership goes with it) are fine.

BEGIN;

create or replace function public.transfer_ownership(h_id uuid, to_user uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.role_in(h_id) is distinct from 'owner' then
    raise exception 'only_owner_can_transfer' using errcode = '42501';
  end if;
  if to_user is null or to_user = auth.uid() then
    raise exception 'invalid_transfer_target' using errcode = '22023';
  end if;
  perform 1 from memberships where household_id = h_id and user_id = to_user for update;
  if not found then
    raise exception 'not_a_member' using errcode = '22023';
  end if;
  update memberships set role = 'owner' where household_id = h_id and user_id = to_user;
  update memberships set role = 'admin' where household_id = h_id and user_id = auth.uid();
end;
$$;

revoke all on function public.transfer_ownership(uuid, uuid) from public;
revoke all on function public.transfer_ownership(uuid, uuid) from anon;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;

create or replace function public.enforce_household_keeps_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if OLD.role = 'owner' and (TG_OP = 'DELETE' or NEW.role is distinct from 'owner') then
    if exists (select 1 from memberships where household_id = OLD.household_id)
       and not exists (select 1 from memberships where household_id = OLD.household_id and role = 'owner') then
      raise exception 'household_needs_an_owner'
        using errcode = '23514',
              hint = 'Make another member the owner first (transfer ownership), then leave or change roles.';
    end if;
  end if;
  return null;
end;
$$;

revoke all on function public.enforce_household_keeps_owner() from public;
revoke all on function public.enforce_household_keeps_owner() from anon;

drop trigger if exists trg_household_keeps_owner on public.memberships;
create constraint trigger trg_household_keeps_owner
  after delete or update of role on public.memberships
  deferrable initially deferred
  for each row execute function public.enforce_household_keeps_owner();

COMMIT;
