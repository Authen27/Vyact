-- W1a (audit 2026-10-04, INT-HH-12; owner decision) — retire the 'child' app role.
--
-- The invite form offered "Child (own data only)", but a child could read every
-- transaction, account, debt and asset exactly like a viewer; the only child-specific rule
-- was that they could edit or delete only the transactions they created. The owner chose to
-- stop offering the role and make existing children members. (Member is broader: a member
-- can edit others' entries and manage goals, debts and assets.)
--
-- The household RELATIONSHIP label household_role = 'child' (Primary / Partner / Child /
-- Elder) is a different column and is untouched.
--
-- Old app builds may still send role = 'child' for one release, so the CHECKs keep the value
-- for now and a BEFORE trigger stores it as 'member'. A later migration can drop 'child' from
-- both CHECKs once no client sends it.

BEGIN;

create or replace function public.map_retired_child_role()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if NEW.role = 'child' then
    NEW.role := 'member';
  end if;
  return NEW;
end;
$$;

revoke all on function public.map_retired_child_role() from public;
revoke all on function public.map_retired_child_role() from anon;

drop trigger if exists trg_memberships_retired_child_role on public.memberships;
create trigger trg_memberships_retired_child_role
  before insert or update of role on public.memberships
  for each row execute function public.map_retired_child_role();

drop trigger if exists trg_invitations_retired_child_role on public.invitations;
create trigger trg_invitations_retired_child_role
  before insert or update of role on public.invitations
  for each row execute function public.map_retired_child_role();

update public.memberships set role = 'member' where role = 'child';
update public.invitations set role = 'member' where role = 'child';

-- The transaction write policies' child branches are dead now; restate them without it.
drop policy if exists "transactions_delete" on public.transactions;
create policy "transactions_delete" on public.transactions for delete using (
  role_in(household_id) in ('owner', 'admin', 'member'));

drop policy if exists "transactions_insert" on public.transactions;
create policy "transactions_insert" on public.transactions for insert with check (
  role_in(household_id) in ('owner', 'admin', 'member'));

drop policy if exists "transactions_update" on public.transactions;
create policy "transactions_update" on public.transactions for update using (
  role_in(household_id) in ('owner', 'admin', 'member'));

COMMIT;
