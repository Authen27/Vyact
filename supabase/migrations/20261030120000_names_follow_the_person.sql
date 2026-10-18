-- v10.113.0 — a person's name is their own, everywhere (owner, 18 Oct 2026: "why does the name go empty
-- or prefilled by email IDs").
--
-- Two of the three causes were in the database:
--   1. Sign-up took the name only from `display_name` in the sign-up metadata, else the part of the
--      email before "@". A Google (or any OAuth) sign-in sends the name as `full_name` / `name`, so
--      every such account was named after its email ("uday.kr27").
--   2. A member's name in a household (`memberships.display_name`) is a COPY of the profile name, made
--      when they joined (with the same email fallback). Nothing updated it when the person renamed, so
--      the members list, "who paid" and splits kept showing the old, email-style name.
-- (The third, Settings' name box staying empty when opened before the profile loaded, is in the app.)
--
-- No screen sets a household-specific name (the app's upsertMember has no callers), so every household
-- copy is the profile's. A rename still updates only the copies that showed the old name, so a name set
-- for one household on purpose (if that is ever added) is kept.
--
-- MONEY MODEL: untouched. Names only.

begin;

-- ── 1. Sign-up reads the name the provider sends ─────────────────────────────────────────────────
-- Unchanged otherwise (00000000000001_production_state_baseline.sql): the profile, then the person's
-- first household (its owner membership comes from handle_new_household).
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_display_name text;
begin
  v_display_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),     -- Google, Apple, GitHub via Supabase
    nullif(btrim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1));
  insert into profiles (id, display_name) values (new.id, v_display_name);
  insert into households (name, type, base_currency, created_by) values ('My Household', 'personal', 'USD', new.id);
  return new;
end; $$;

-- ── 2. A rename reaches every household copy that still showed the old name ──────────────────────
create or replace function public.sync_member_display_name()
  returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if new.display_name is distinct from old.display_name and nullif(btrim(new.display_name), '') is not null then
    update public.memberships set display_name = new.display_name
     where user_id = new.id and display_name is not distinct from old.display_name;
  end if;
  return null;
end; $$;
revoke all on function public.sync_member_display_name() from public, anon, authenticated;

drop trigger if exists trg_profiles_sync_member_name on public.profiles;
create trigger trg_profiles_sync_member_name
  after update of display_name on public.profiles
  for each row execute function public.sync_member_display_name();

-- ── 3. Existing accounts ─────────────────────────────────────────────────────────────────────────
-- 3a. A profile still named after its email (the old fallback) takes the name its provider sent. The
--     trigger above carries it into the household copies that showed the email name.
update public.profiles p
   set display_name = coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                               nullif(btrim(u.raw_user_meta_data->>'name'), ''))
  from auth.users u
 where u.id = p.id
   and p.display_name = split_part(u.email, '@', 1)
   and coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
                nullif(btrim(u.raw_user_meta_data->>'name'), '')) is not null;

-- 3b. A household copy that no longer matches its person's name (a rename never reached it, or it was
--     made from the email fallback) takes the profile's name. Copies are never set on purpose today.
update public.memberships m
   set display_name = p.display_name
  from public.profiles p
 where p.id = m.user_id
   and nullif(btrim(p.display_name), '') is not null
   and m.display_name is distinct from p.display_name;

commit;
