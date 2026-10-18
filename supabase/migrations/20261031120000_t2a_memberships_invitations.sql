-- v10.114.0 — Track T2, part a: who belongs to a household, and how they join.
-- Audit INT-HH-07, INT-HH-09, DB-INT-11, INT-HH-06, INT-CON-07, XC-PRV-12; owner decisions 18 Oct 2026
-- (T2 reopened Batch E; the name lookup answers for "known emails only").
--
--   1. People join only by accepting an invitation. An owner or admin could insert a membership for
--      ANY user id (a uid learnt from a settled split, say): no consent, and the stranger's profile was
--      then readable. The client INSERT policy goes; every real join is a definer function.
--   2. A membership's person and household never change (an UPDATE could re-point one).
--   3. The old phone copies on profiles, read by nothing since audit S1, are cleared (dropped next release).
--   4. One membership per person per household (a unique index). Duplicates, if any, are merged first.
--   5. The member limit counts with the household locked, so two joins at once can't overfill it.
--   6. Accepting an invitation is atomic and single-use; opening a link you're already a member through
--      no longer burns it.
--   7. The legacy accept_invitation(text / uuid), unused by the app, are dropped.
--   8. leave_household reads the caller's role null-safely.
--   9. The participant name lookup answers only for people the caller already shares something with.
--
-- MONEY MODEL: untouched. Duplicate memberships (none expected) hand their transactions and schedules to
-- the row that is kept, so no entry loses who made it.

begin;

-- ── 1. People join only by accepting an invitation (INT-HH-07) ─────────────────────────────────────
drop policy if exists "owners and admins add members" on public.memberships;
-- No client INSERT policy remains: handle_new_household, accept_invitation_link and
-- accept_invitation_by_id are SECURITY DEFINER and are the only ways in.

-- ── 2. A membership's person and household never change (INT-HH-07) ───────────────────────────────
create or replace function public.memberships_keep_identity()
  returns trigger language plpgsql set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id or new.household_id is distinct from old.household_id then
    raise exception 'membership_identity_fixed: a membership stays with its person and household'
      using errcode = '42501';
  end if;
  return new;
end; $$;
revoke all on function public.memberships_keep_identity() from public, anon, authenticated;
drop trigger if exists memberships_keep_identity on public.memberships;
create trigger memberships_keep_identity
  before update of user_id, household_id on public.memberships
  for each row execute function public.memberships_keep_identity();

-- ── 3. The old phone copies on profiles are cleared (INT-HH-07) ───────────────────────────────────
-- guard_whatsapp_profile_columns lets only the service role touch them; this migration acts as it.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
update public.profiles set phone_number = null, phone_verified_at = null, whatsapp_household_id = null
 where phone_number is not null or phone_verified_at is not null or whatsapp_household_id is not null;
select set_config('request.jwt.claims', '', true);

-- ── 4. One membership per person per household (DB-INT-11, INT-HH-06) ─────────────────────────────
-- A WhatsApp link ends with the membership (W1a) — but only once the person has no membership left in
-- that household, so merging a duplicate below never unlinks someone who stays.
create or replace function public.unlink_whatsapp_on_membership_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.whatsapp_identities w
   where w.profile_id = OLD.user_id and w.household_id = OLD.household_id
     and not exists (select 1 from public.memberships m
                      where m.user_id = OLD.user_id and m.household_id = OLD.household_id);
  return null;
end;
$$;

-- Keep the highest role, then the earliest; move what pointed at the others to it.
create temporary table t2a_duplicate_memberships on commit drop as
select id, keep from (
  select id, first_value(id) over (
           partition by household_id, user_id
           order by case role when 'owner' then 0 when 'admin' then 1 when 'member' then 2 when 'viewer' then 3 else 4 end,
                    joined_at, id) as keep
    from public.memberships where user_id is not null) ranked
 where id <> keep;
update public.transactions t set member_id = d.keep from t2a_duplicate_memberships d where t.member_id = d.id;
update public.transactions t set initiated_by = d.keep from t2a_duplicate_memberships d where t.initiated_by = d.id;
update public.recurring_schedules s set owner_member_id = d.keep from t2a_duplicate_memberships d where s.owner_member_id = d.id;
delete from public.memberships m using t2a_duplicate_memberships d where m.id = d.id;

create unique index if not exists uq_memberships_household_user
  on public.memberships (household_id, user_id) where user_id is not null;

-- ── 5. The member limit counts with the household locked (DB-INT-11) ──────────────────────────────
-- Unchanged otherwise (20261007120000_household_types_v2.sql). Two joins at once used to count the same
-- members and both get in: a Couple household with three.
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
  select type into v_type from households where id = new.household_id for update;
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
revoke execute on function public.enforce_household_member_limit() from public, anon, authenticated;

-- ── 6. Accepting is atomic and single-use (INT-HH-09) ─────────────────────────────────────────────
-- The link: the invitation and its household are locked before anything is counted; the accept is
-- claimed only while still unaccepted; someone already in the household opening the link leaves it
-- usable (it used to be burnt). Unchanged otherwise (20261022120000_invitation_inbox.sql).
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
  claimed integer;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to accept an invitation';
  end if;

  select email into caller_email from auth.users where id = auth.uid();

  select * into inv
  from invitations
  where token = invite_token
    and accepted_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Invitation not found or expired';
  end if;

  perform 1 from households where id = inv.household_id for update;

  select * into existing
  from memberships
  where household_id = inv.household_id
    and user_id = auth.uid();

  if found then
    return jsonb_build_object(
      'household_id', inv.household_id,
      'membership_id', existing.id,
      'role', existing.role,
      'already_member', true
    );
  end if;

  update invitations set accepted_at = now() where id = inv.id and accepted_at is null;
  get diagnostics claimed = row_count;
  if claimed = 0 then
    raise exception 'Invitation not found or expired';
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

-- The inbox: the household is locked too, and the accept is claimed only while still unaccepted. An
-- invitation addressed to someone already in the household is theirs, so it is marked answered.
create or replace function public.accept_invitation_by_id(p_id uuid)
  returns jsonb
  language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_email text := public.my_verified_email();
  inv public.invitations%rowtype;
  existing public.memberships%rowtype;
  new_membership_id uuid;
  claimed integer;
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

  perform 1 from public.households where id = inv.household_id for update;

  select * into existing from public.memberships
   where household_id = inv.household_id and user_id = auth.uid();
  if found then
    update public.invitations set accepted_at = now() where id = inv.id;
    return jsonb_build_object('household_id', inv.household_id, 'membership_id', existing.id,
                              'role', existing.role, 'already_member', true);
  end if;

  update public.invitations set accepted_at = now() where id = inv.id and accepted_at is null;
  get diagnostics claimed = row_count;
  if claimed = 0 then
    raise exception 'invitation_not_found' using errcode = 'P0001';
  end if;

  -- The membership insert runs the HOUSEHOLD_FULL limit trigger, as the link accept does.
  insert into public.memberships (household_id, user_id, role, display_name, household_role)
  values (inv.household_id, auth.uid(), inv.role,
          coalesce((select nullif(btrim(display_name), '') from public.profiles where id = auth.uid()),
                   split_part(v_email, '@', 1)),
          case when inv.household_role in ('primary', 'partner', 'child', 'elder') then inv.household_role end)
  returning id into new_membership_id;

  insert into public.activity_log (household_id, actor_id, action, entity_type, entity_id)
  values (inv.household_id, auth.uid(), 'accepted', 'invitation', inv.id);

  return jsonb_build_object('household_id', inv.household_id, 'membership_id', new_membership_id,
                            'role', inv.role, 'already_member', false);
end;
$$;
revoke all on function public.accept_invitation_by_id(uuid) from public, anon;
grant execute on function public.accept_invitation_by_id(uuid) to authenticated, service_role;

-- ── 7. The legacy accept functions go (INT-HH-09) ─────────────────────────────────────────────────
-- The app calls only accept_invitation_link and accept_invitation_by_id.
drop function if exists public.accept_invitation(text);
drop function if exists public.accept_invitation(uuid);

-- ── 8. leave_household, null-safe (INT-CON-07) ────────────────────────────────────────────────────
-- Someone not in the household leaves nothing; the last owner can't leave (the W1a owner trigger
-- guards it too).
create or replace function public.leave_household(h_id uuid)
  returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_role text;
  owner_count int;
begin
  select role into v_role from memberships where household_id = h_id and user_id = auth.uid();
  if v_role is null then
    return;
  end if;
  if v_role = 'owner' then
    select count(*) into owner_count from memberships where household_id = h_id and role = 'owner';
    if owner_count = 1 then
      raise exception 'last_owner_cannot_leave';
    end if;
  end if;
  delete from memberships where household_id = h_id and user_id = auth.uid();
end; $$;

-- ── 9. Names only for people the caller already knows (XC-PRV-12; owner: "known emails only") ────
-- Anyone signed in could send thousands of emails and learn which belong to Vyact users, and their
-- names. Now an email resolves only when it is already shared with the caller: on a split they own or
-- take part in, or a member of one of their households. Everyone else gets no answer; the Split form
-- then asks by email. At most 200 emails per call.
create or replace function public.resolve_participant_names(p_emails text[])
returns table(email text, display_name text)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_me text := public.my_email();
begin
  if auth.uid() is null then
    return;
  end if;
  if coalesce(array_length(p_emails, 1), 0) > 200 then
    raise exception 'too_many_emails: at most 200 at a time' using errcode = '22023';
  end if;
  return query
  with wanted as (
    select distinct lower(btrim(e)) as email from unnest(p_emails) e where nullif(btrim(e), '') is not null
  ), my_splits as (
    select sp.id from public.shared_splits sp where sp.owner_user_id = auth.uid()
    union
    select s.split_id from public.shared_split_shares s where v_me is not null and lower(s.email) = v_me
  ), known as (
    select lower(s.email) as email from public.shared_split_shares s where s.split_id in (select id from my_splits)
    union
    select lower(u.email) from public.shared_splits sp join auth.users u on u.id = sp.owner_user_id
     where sp.id in (select id from my_splits)
    union
    select lower(u.email) from public.memberships m join auth.users u on u.id = m.user_id
     where public.is_member(m.household_id)
  )
  select lower(u.email) as email, p.display_name
    from auth.users u
    join public.profiles p on p.id = u.id
   where lower(u.email) in (select w.email from wanted w where w.email in (select k.email from known k))
     and p.deactivated_at is null
     and p.deletion_requested_at is null;
end;
$$;
revoke execute on function public.resolve_participant_names(text[]) from public, anon;
grant execute on function public.resolve_participant_names(text[]) to authenticated;

commit;
