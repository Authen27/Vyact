-- W1b (audit 2026-10-04, INT-HH-03 / BE-FN-01 / BE-FN-02 / BE-FN-03 / BE-FN-04 / XC-PRV-04 /
-- XC-PRV-06 / DB-INT-06 / DB-OPS-05 / FE-PLT-06) — account deletion that actually happens, in
-- one step, and only after a recent sign-in.
--
-- What was wrong:
--   • delete-account ran a non-atomic chain of deletes from the Edge Function, then deleted the
--     profile and the auth user. transactions.created_by, activity_log.actor_id,
--     invitations.invited_by, households.created_by and shared_split_shares.settled_user_id
--     reference auth.users with NO ACTION, so anyone who had ever written into a household they
--     did not own could not be deleted: the data was already erased, the login stayed.
--   • The "30-day undo" was never executed by anything, and signing in silently cancelled it.
--   • An owner's deletion deleted co-members' households outright (BE-FN-04).
--   • The email-code check before deleting or erasing was enforced only in the browser.
--   • WhatsApp message text kept the person's words after their profile was deleted
--     (profile_id ON DELETE SET NULL).
--
-- Now (owner decisions D22, D25):
--   • Deletion is IMMEDIATE (no grace period) and runs in ONE transaction: purge_account().
--   • An owner whose household has other members and no other owner must transfer ownership
--     first: 'transfer_required'. Co-members never lose their household.
--   • The user-referencing FKs no longer block deletion: history stays with the household and
--     simply stops naming the deleted person (SET NULL); invitations they sent go with them.
--   • Erase and delete require a sign-in within the last 10 minutes, read from the JWT's `amr`
--     claim (the email-code step's verifyOtp issues a fresh session; a stolen idle session
--     does not pass).

BEGIN;

-- ── 1. FKs to users: never block a deletion ─────────────────────────────────────────────
-- Drop whatever FK exists on each column (production names may differ from the baseline's),
-- then add one with the intended ON DELETE.
do $$
declare r record;
begin
  for r in
    select c.conname, c.conrelid::regclass::text as tbl
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and array_length(c.conkey, 1) = 1
       and (c.conrelid::regclass::text, a.attname::text) in (
         ('households', 'created_by'), ('invitations', 'invited_by'), ('transactions', 'created_by'),
         ('activity_log', 'actor_id'), ('shared_split_shares', 'settled_user_id'),
         ('whatsapp_inbound_messages', 'profile_id'), ('whatsapp_inbound_messages', 'household_id'))
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- households.created_by was NOT NULL; a household outlives its creator (it stays with its
-- other members), so it must be able to stop naming them.
alter table public.households alter column created_by drop not null;
alter table public.households add constraint households_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
alter table public.invitations add constraint invitations_invited_by_fkey
  foreign key (invited_by) references auth.users(id) on delete cascade;
alter table public.transactions add constraint transactions_created_by_fkey
  foreign key (created_by) references auth.users(id) on delete set null;
alter table public.activity_log add constraint activity_log_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null;
alter table public.shared_split_shares add constraint shared_split_shares_settled_user_id_fkey
  foreign key (settled_user_id) references auth.users(id) on delete set null;
-- WhatsApp message rows hold the person's words and phone number: they go with the person
-- and with the household (XC-PRV-07).
alter table public.whatsapp_inbound_messages add constraint whatsapp_inbound_messages_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;
alter table public.whatsapp_inbound_messages add constraint whatsapp_inbound_messages_household_id_fkey
  foreign key (household_id) references public.households(id) on delete cascade;

-- ── 2. Recent sign-in, checked on the server ───────────────────────────────────────────
create or replace function public.recently_reauthenticated(p_max_age_seconds int default 600)
returns boolean
language sql
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
     where jsonb_typeof(a -> 'timestamp') = 'number'
       and (a ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - p_max_age_seconds);
$$;

revoke all on function public.recently_reauthenticated(int) from public;
revoke all on function public.recently_reauthenticated(int) from anon;
grant execute on function public.recently_reauthenticated(int) to authenticated, service_role;

-- ── 3. Erase all household data: recent sign-in required; WhatsApp messages go too ─────
-- Body as 20261008120000 (W0) plus the re-auth check and the household's WhatsApp messages.
create or replace function erase_household_data(h_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role
  from memberships
  where household_id = h_id and user_id = auth.uid()
  limit 1;

  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'not authorized to erase this household''s data';
  end if;
  if not public.recently_reauthenticated() then
    raise exception 'reauth_required' using errcode = '42501',
      hint = 'Confirm with the emailed code, then erase within 10 minutes.';
  end if;

  delete from transactions        where household_id = h_id;
  delete from budgets              where household_id = h_id;
  delete from budget_allocations   where household_id = h_id;
  delete from goals                where household_id = h_id;
  delete from debts                where household_id = h_id;
  delete from assets               where household_id = h_id;
  delete from accounts             where household_id = h_id;
  delete from recurring_schedules  where household_id = h_id;
  delete from saved_views          where household_id = h_id;
  delete from net_worth_snapshots  where household_id = h_id;
  delete from whatsapp_inbound_messages where household_id = h_id;
  delete from activity_log         where household_id = h_id;

  update households set onboarding = '{}'::jsonb where id = h_id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h_id, auth.uid(), 'deleted', 'household', h_id,
          jsonb_build_object('kind', 'erase_household_data', 'erased_at', now()));
end;
$$;

revoke all on function erase_household_data(uuid) from public;
revoke all on function erase_household_data(uuid) from anon;
grant execute on function erase_household_data(uuid) to authenticated;

-- ── 4. The purge: one transaction, service role only ───────────────────────────────────
create or replace function public.purge_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
  blocked uuid[];
  sole uuid[];
  n_households int := 0;
  n_memberships int := 0;
begin
  if p_user_id is null then
    raise exception 'invalid_user' using errcode = '22023';
  end if;

  -- D22: an owner may not leave members behind without an owner.
  select array_agg(m.household_id) into blocked
    from memberships m
   where m.user_id = p_user_id and m.role = 'owner'
     and exists (select 1 from memberships o where o.household_id = m.household_id and o.user_id <> p_user_id)
     and not exists (select 1 from memberships o
                      where o.household_id = m.household_id and o.user_id <> p_user_id and o.role = 'owner');
  if blocked is not null then
    raise exception 'transfer_required' using errcode = 'P0001', detail = array_to_string(blocked, ',');
  end if;

  -- Households where they are the only member: the household and everything in it goes
  -- (every household-scoped table cascades from households).
  select array_agg(m.household_id) into sole
    from memberships m
   where m.user_id = p_user_id
     and not exists (select 1 from memberships o where o.household_id = m.household_id and o.user_id <> p_user_id);
  if sole is not null then
    delete from households where id = any (sole);
    get diagnostics n_households = row_count;
  end if;

  -- Shared households: only their membership goes; the household keeps its history.
  delete from memberships where user_id = p_user_id;
  get diagnostics n_memberships = row_count;

  -- Personal rows that would otherwise wait for the auth delete (or outlive it).
  delete from whatsapp_inbound_messages where profile_id = p_user_id;
  delete from whatsapp_identities        where profile_id = p_user_id;
  delete from whatsapp_pending_turns     where profile_id = p_user_id;
  delete from whatsapp_verification_otps where profile_id = p_user_id;
  delete from whatsapp_preferences       where profile_id = p_user_id;
  delete from push_subscriptions         where user_id = p_user_id;

  select email into v_email from auth.users where id = p_user_id;
  if v_email is not null then
    delete from invitations where accepted_at is null and lower(invited_email) = lower(v_email);
  end if;

  delete from profiles where id = p_user_id;

  return jsonb_build_object('status', 'purged', 'households_deleted', n_households,
                            'memberships_removed', n_memberships);
end;
$$;

revoke all on function public.purge_account(uuid) from public;
revoke all on function public.purge_account(uuid) from anon;
revoke all on function public.purge_account(uuid) from authenticated;
grant execute on function public.purge_account(uuid) to service_role;

-- ── 5. The 30-day schedule is gone ──────────────────────────────────────────────────────
-- Nothing ever executed it. reactivate_my_account still clears a legacy hold on sign-in.
drop function if exists public.request_account_deletion();
comment on column public.profiles.deletion_scheduled_for is
  'Legacy (until v10.63.0): the 30-day schedule was never executed and was removed. Deletion is immediate (purge_account).';

COMMIT;
