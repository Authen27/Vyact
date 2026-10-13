-- #9, step 1 of 2 (v10.94.0; owner decisions 13 Oct 2026): an invitation can be addressed to a
-- person, who is emailed and finds it in their bell (Accept / Decline). Inviters keep Revoke.
--
-- Until now an invitation was a shareable link only. `invited_email` never held an email: it holds
-- the label the inviter typed ("Partner", "Mom") or "(shareable link)". So nothing could tell the
-- invitee about it except the link itself.
--
--   1. invitations.recipient_email: the invitee's address, lower-case and email-shaped, or null
--      for a link-only invitation. Existing rows are untouched (all null); `invited_email` stays the
--      label.
--   2. my_pending_invitations(): the caller's own pending invitations, matched on the caller's
--      CONFIRMED email (an unconfirmed sign-up with someone else's address sees nothing). It returns
--      the household's name and type, who invited them, the role and the expiry, never the token.
--   3. accept_invitation_by_id(id): the link accept's rules (the same membership insert, so the same
--      HOUSEHOLD_FULL limit), for an invitation addressed to the caller. The row is locked so a
--      double tap joins once.
--   4. decline_invitation(id): the invitee removes an invitation addressed to them.
--   5. accept_invitation_link: an invitation with no relationship label joined with
--      household_role 'member', which the memberships check refuses, so that join failed. A missing
--      or unknown label is now stored as null (the check allows it). The app always sends a label,
--      so nobody hit it.
--   6. invite_email_log + claim_invite_email(): send-invite-email claims before it sends. One email
--      per invitation, ever, and a daily cap per sender. A revoked invitation keeps its log row
--      (invitation_id set to null), so revoking and re-inviting does not reset the cap. Service role
--      only; the log holds ids and a time, never an address.
--   7. purge_account: deleting an account also deletes pending invitations addressed to it.

BEGIN;

-- ── 1. The invitee's address ────────────────────────────────────────────────────────────
alter table public.invitations add column if not exists recipient_email text;
alter table public.invitations drop constraint if exists ck_invitation_recipient_email;
alter table public.invitations add constraint ck_invitation_recipient_email check (
  recipient_email is null or (
    recipient_email = lower(btrim(recipient_email))
    and length(recipient_email) <= 254
    and recipient_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ));
create index if not exists invitations_recipient_idx
  on public.invitations (recipient_email) where accepted_at is null;

comment on column public.invitations.invited_email is
  'The label the inviter typed, or "(shareable link)". A legacy name: it is not the invitee''s address; that is recipient_email.';
comment on column public.invitations.recipient_email is
  'The invitee''s email (lower-case), when the invitation is addressed to a person (v10.94.0). Null for a link-only invitation.';

-- ── 2. The caller's confirmed email (internal: only the functions below call it) ────────
create or replace function public.my_verified_email()
  returns text
  language sql stable security definer set search_path = public, pg_temp
as $$
  select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null;
$$;
revoke all on function public.my_verified_email() from public, anon, authenticated;

-- ── 3. Invitations addressed to me ──────────────────────────────────────────────────────
create or replace function public.my_pending_invitations()
  returns table (id uuid, household_id uuid, household_name text, household_type text,
                 invited_by_name text, role text, household_role text,
                 expires_at timestamptz, created_at timestamptz)
  language sql stable security definer set search_path = public, pg_temp
as $$
  select i.id, i.household_id, h.name, h.type,
         coalesce(nullif(btrim(p.display_name), ''), 'Someone'),
         i.role, i.household_role, i.expires_at, i.created_at
    from public.invitations i
    join public.households h on h.id = i.household_id
    left join public.profiles p on p.id = i.invited_by
   where i.recipient_email = public.my_verified_email()
     and i.accepted_at is null
     and i.expires_at > now()
     and not exists (select 1 from public.memberships m
                      where m.household_id = i.household_id and m.user_id = auth.uid())
   order by i.created_at desc;
$$;

-- ── 4. Accept one ───────────────────────────────────────────────────────────────────────
create or replace function public.accept_invitation_by_id(p_id uuid)
  returns jsonb
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_email text := public.my_verified_email();
  inv public.invitations%rowtype;
  existing public.memberships%rowtype;
  new_membership_id uuid;
begin
  if auth.uid() is null or v_email is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into inv from public.invitations
   where id = p_id and recipient_email = v_email and accepted_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  select * into existing from public.memberships
   where household_id = inv.household_id and user_id = auth.uid();
  if found then
    update public.invitations set accepted_at = now() where id = inv.id;
    return jsonb_build_object('household_id', inv.household_id, 'membership_id', existing.id,
                              'role', existing.role, 'already_member', true);
  end if;

  -- The membership insert runs the HOUSEHOLD_FULL limit trigger, as the link accept does.
  insert into public.memberships (household_id, user_id, role, display_name, household_role)
  values (inv.household_id, auth.uid(), inv.role,
          coalesce((select nullif(btrim(display_name), '') from public.profiles where id = auth.uid()),
                   split_part(v_email, '@', 1)),
          case when inv.household_role in ('primary', 'partner', 'child', 'elder') then inv.household_role end)
  returning id into new_membership_id;

  update public.invitations set accepted_at = now() where id = inv.id;

  insert into public.activity_log (household_id, actor_id, action, entity_type, entity_id)
  values (inv.household_id, auth.uid(), 'accepted', 'invitation', inv.id);

  return jsonb_build_object('household_id', inv.household_id, 'membership_id', new_membership_id,
                            'role', inv.role, 'already_member', false);
end;
$$;

-- ── 5. Decline one ──────────────────────────────────────────────────────────────────────
create or replace function public.decline_invitation(p_id uuid)
  returns boolean
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_email text := public.my_verified_email();
begin
  if auth.uid() is null or v_email is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  delete from public.invitations
   where id = p_id and recipient_email = v_email and accepted_at is null;
  return found;
end;
$$;

revoke all on function public.my_pending_invitations() from public, anon;
revoke all on function public.accept_invitation_by_id(uuid) from public, anon;
revoke all on function public.decline_invitation(uuid) from public, anon;
grant execute on function public.my_pending_invitations() to authenticated, service_role;
grant execute on function public.accept_invitation_by_id(uuid) to authenticated, service_role;
grant execute on function public.decline_invitation(uuid) to authenticated, service_role;

-- ── 6. The link accept: a missing relationship label joins as null, not 'member' ────────
-- Unchanged otherwise (20260601153000_fix_shareable_invite_accept_rpc.sql).
create or replace function public.accept_invitation_link(invite_token text)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
as $$
declare
  inv invitations%rowtype;
  caller_email text;
  existing memberships%rowtype;
  new_membership_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to accept an invitation';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  select * into inv
  from invitations
  where token = invite_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'Invitation not found or expired';
  end if;

  select * into existing
  from memberships
  where household_id = inv.household_id
    and user_id = auth.uid();

  if found then
    update invitations set accepted_at = now() where id = inv.id;
    return jsonb_build_object(
      'household_id', inv.household_id,
      'membership_id', existing.id,
      'role', existing.role,
      'already_member', true
    );
  end if;

  insert into memberships (household_id, user_id, role, display_name, household_role)
  values (
    inv.household_id,
    auth.uid(),
    inv.role,
    coalesce((select display_name from profiles where id = auth.uid()), split_part(coalesce(caller_email, ''), '@', 1), 'member'),
    case when inv.household_role in ('primary', 'partner', 'child', 'elder') then inv.household_role end
  )
  returning id into new_membership_id;

  update invitations set accepted_at = now() where id = inv.id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id)
  values (inv.household_id, auth.uid(), 'accepted', 'invitation', inv.id);

  return jsonb_build_object(
    'household_id', inv.household_id,
    'membership_id', new_membership_id,
    'role', inv.role,
    'already_member', false
  );
end;
$$;

revoke all on function public.accept_invitation_link(text) from public, anon;
grant execute on function public.accept_invitation_link(text) to authenticated;

-- ── 7. The email claim ──────────────────────────────────────────────────────────────────
create table if not exists public.invite_email_log (
  id              bigint generated always as identity primary key,
  invitation_id   uuid references public.invitations(id) on delete set null,
  sender_user_id  uuid references auth.users(id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint uq_invite_email_once unique (invitation_id)
);
create index if not exists invite_email_log_sender_idx on public.invite_email_log (sender_user_id, created_at);

alter table public.invite_email_log enable row level security;
revoke all on table public.invite_email_log from public, anon, authenticated;
grant select, insert, delete on table public.invite_email_log to service_role;

-- 'claimed' (send it), 'already_sent' (this invitation was emailed before) or 'daily_limit'.
create or replace function public.claim_invite_email(p_sender uuid, p_invitation uuid, p_daily_cap int)
  returns text
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_used int;
begin
  if p_sender is null or p_invitation is null then
    raise exception 'invalid_claim' using errcode = '22023';
  end if;
  if p_daily_cap is null or p_daily_cap < 0 then
    raise exception 'invalid_cap' using errcode = '22023';
  end if;

  -- One sender at a time: two parallel calls cannot both see the same room under the cap.
  perform pg_advisory_xact_lock(hashtextextended('invite_email:' || p_sender::text, 0));

  if exists (select 1 from public.invite_email_log where invitation_id = p_invitation) then
    return 'already_sent';
  end if;

  select count(*) into v_used
    from public.invite_email_log
   where sender_user_id = p_sender and created_at > now() - interval '24 hours';
  if v_used >= p_daily_cap then
    return 'daily_limit';
  end if;

  insert into public.invite_email_log (invitation_id, sender_user_id) values (p_invitation, p_sender)
  on conflict (invitation_id) do nothing;
  if not found then
    return 'already_sent';
  end if;
  return 'claimed';
end;
$$;

revoke all on function public.claim_invite_email(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.claim_invite_email(uuid, uuid, int) to service_role;

-- ── 8. Deleting an account also removes invitations addressed to it ─────────────────────
-- Unchanged otherwise (20261010120000_w1b_account_purge.sql).
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
    delete from invitations
     where accepted_at is null
       and (lower(invited_email) = lower(v_email) or recipient_email = lower(v_email));
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

COMMIT;
