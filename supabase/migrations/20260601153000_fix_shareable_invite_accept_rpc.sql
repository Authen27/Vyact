create or replace function public.accept_invitation_link(invite_token text)
  returns jsonb
  language plpgsql
  security definer
  set search_path to 'public'
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
    coalesce(inv.household_role, 'member')
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

revoke all on function public.accept_invitation_link(text) from public;
grant execute on function public.accept_invitation_link(text) to authenticated;