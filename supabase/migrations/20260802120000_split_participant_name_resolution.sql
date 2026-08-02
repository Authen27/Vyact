-- v10.14.1 — resolve a split participant's DISPLAY NAME from their email.
--
-- The split form and Splits view are email-keyed, but users think in names.
-- This lets the client show "Manu · u.reddy@vidaxl.com" instead of a bare
-- email, and lets the Add-Transaction split form show the resolved name as a
-- NON-EDITABLE value once you type a participant's email (feedback items 1+2).
--
-- SECURITY DEFINER so it can read auth.users/profiles (the caller can't), but
-- it returns ONLY the display_name for a matching, active account — same
-- invite-by-email directory lookup Splitwise/Venmo expose. Authenticated only.
-- Deactivated / deletion-pending accounts are excluded.
create or replace function public.resolve_participant_names(p_emails text[])
returns table(email text, display_name text)
language sql stable security definer set search_path = public
as $$
  select lower(u.email) as email, p.display_name
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = any (select lower(e) from unnest(p_emails) e)
    and p.deactivated_at is null
    and p.deletion_requested_at is null;
$$;

-- Postgres grants EXECUTE to PUBLIC by default on create; revoke it so an
-- UNAUTHENTICATED (anon) caller can't enumerate email → name. This function
-- has no auth.uid() gate (it's a pure directory lookup), so unlike the other
-- SECURITY DEFINER helpers it must be authenticated-only.
revoke execute on function public.resolve_participant_names(text[]) from public;
revoke execute on function public.resolve_participant_names(text[]) from anon;
grant execute on function public.resolve_participant_names(text[]) to authenticated;
