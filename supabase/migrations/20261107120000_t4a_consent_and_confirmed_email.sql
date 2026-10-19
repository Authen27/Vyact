-- T4a (v10.124.0; audit XC-PRV-09, DB-INT-15; owner decisions 19 Oct 2026: "server record + accept on
-- change"; "confirmed email only").
--
-- 1. CONSENT IS RECORDED BY THE SERVER AT SIGN-UP (XC-PRV-09).
--    The app recorded acceptance from the browser after sign-up, keyed on a sessionStorage flag. When the
--    project asks an email sign-up to confirm first, the verification link opens in a new tab, the flag is
--    gone, and nothing recorded that the person accepted. The sign-up form now sends the policy version
--    the person ticked in the sign-up metadata (`policy_version`), and handle_new_user stamps it on the
--    profile in the same transaction that creates the account. A sign-up without it (Google: an OAuth
--    sign-up carries no form data) is recorded by the app as before, and the app asks anyone whose
--    record is not the current version to accept it (T4b).
--
-- 2. A SPLIT FINDS YOU BY YOUR CONFIRMED EMAIL (DB-INT-15).
--    my_email() said it was "the verified-email analogue of is_member()", but it read auth.users.email
--    whether or not it was confirmed. Every split check reads it: is_split_participant, the
--    shared_split_shares_select policy, settle_share and resolve_participant_names. Where a person can
--    sign in before confirming, someone could register with another person's address and see, or settle,
--    the splits sent to it. It now returns the email only once it is confirmed (as my_verified_email()
--    does for household invitations). A person who hasn't confirmed sees their splits once they do; a
--    Google sign-in is confirmed already.

-- ── 1 ─────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_display_name text;
        v_policy text;
begin
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),     -- Google, Apple, GitHub via Supabase
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1));
  -- T4a (XC-PRV-09): the version of the Terms / Privacy / Cookies the person accepted on the sign-up form
  -- (an ISO date, lib/policyVersion.ts). Anything else is not a version and records nothing.
  v_policy := nullif(btrim(new.raw_user_meta_data->>'policy_version'), '');
  if v_policy !~ '^\d{4}-\d{2}-\d{2}$' then v_policy := null; end if;
  insert into profiles (id, display_name, tos_accepted_at, tos_version, privacy_accepted_at, privacy_version)
  values (new.id, v_display_name,
          case when v_policy is not null then now() end, v_policy,
          case when v_policy is not null then now() end, v_policy);
  insert into households (name, type, base_currency, created_by) values ('My Household', 'personal', 'USD', new.id);
  return new;
end; $$;

-- ── 2 ─────────────────────────────────────────────────────────────────────────────────────────────────
create or replace function public.my_email()
returns text
language sql stable security definer set search_path = public
as $$ select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null; $$;

grant execute on function public.my_email() to authenticated;

-- Settling says why it can't, instead of "Must be signed in" to someone who is signed in but unconfirmed.
create or replace function public.settle_share(p_share_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_email text;
  v_matched uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to settle a split share';
  end if;
  v_email := my_email();
  if v_email is null then
    raise exception 'Confirm your email address to settle splits shared with you' using errcode = '42501';
  end if;

  select id into v_matched from shared_split_shares
   where id = p_share_id and email = v_email;

  if v_matched is null then
    raise exception 'Share not found, or it is not yours to settle';
  end if;

  update shared_split_shares
     set paid = true, paid_at = now(), settled_user_id = auth.uid()
   where id = p_share_id;
end;
$$;

grant execute on function public.settle_share(uuid) to authenticated;

comment on function public.my_email() is
  'T4a (v10.124.0, DB-INT-15): the caller''s email, lower-case, once it is CONFIRMED (null before). Split sharing keys on it (is_split_participant, shared_split_shares_select, settle_share, resolve_participant_names).';
