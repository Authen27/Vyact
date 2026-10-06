-- W1a (audit 2026-10-04, BE-WA-01 / BE-PIP-01 / INT-HH-02) — a WhatsApp link ends when the
-- membership ends.
--
-- whatsapp_identities (phone ↔ profile ↔ household) was deleted only by an explicit unlink.
-- Leaving a household, or being removed from it, deleted the membership and nothing else, so
-- a removed partner could keep asking Pip on WhatsApp for net worth, spend and account names,
-- and kept receiving bill and spend alerts (the app's RLS cut them off; the WhatsApp path,
-- which runs with the service role, did not re-check). Writes were always safe: every write
-- RPC re-checks the membership.
--
-- Now the identity is deleted with the membership. The webhook and guardedSend also refuse a
-- link whose person is no longer a member (second layer, in the Edge code).

BEGIN;

create or replace function public.unlink_whatsapp_on_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.whatsapp_identities
   where profile_id = OLD.user_id and household_id = OLD.household_id;
  return null;
end;
$$;

revoke all on function public.unlink_whatsapp_on_membership_delete() from public;
revoke all on function public.unlink_whatsapp_on_membership_delete() from anon;

drop trigger if exists trg_membership_delete_unlinks_whatsapp on public.memberships;
create trigger trg_membership_delete_unlinks_whatsapp
  after delete on public.memberships
  for each row execute function public.unlink_whatsapp_on_membership_delete();

-- Links that already outlived their membership.
delete from public.whatsapp_identities wi
 where not exists (
   select 1 from public.memberships m
    where m.household_id = wi.household_id and m.user_id = wi.profile_id);

COMMIT;
