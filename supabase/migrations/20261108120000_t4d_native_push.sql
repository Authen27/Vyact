-- T4d (v10.127.0) — lock-screen notifications for the Vyact Android app, through Firebase Cloud Messaging.
--
-- The Play Store app is the web app inside an Android WebView, which has no Web Push: it could never
-- register, so its alerts reached the phone only as local notifications raised while the app happened to be
-- running. Owner decisions, 19 Oct 2026:
--   • ONE device list: an Android app device is a `push_subscriptions` row of kind 'fcm' with its FCM
--     registration token, beside the browsers' 'webpush' rows. The same 10-device cap, test, sign-out and
--     dispatcher rules (P1 only, the device's switches, quiet hours in its zone, never a backlog, members
--     only, "Show details on the lock screen") apply to both;
--   • the server is the only source on a registered phone (the app stops its own local notifications);
--   • on by default in the app; a tap opens the app on the alert.
-- The web-push function sends a kind 'fcm' row through FCM's HTTP v1 API with the project's service account
-- (Edge Function secret FCM_SERVICE_ACCOUNT_JSON); no person handles a token.

begin;

alter table public.push_subscriptions
  add column if not exists kind text not null default 'webpush',
  add column if not exists fcm_token text;

alter table public.push_subscriptions drop constraint if exists push_subscriptions_kind_check;
alter table public.push_subscriptions add constraint push_subscriptions_kind_check check (kind in ('webpush', 'fcm'));

-- A Web Push row has an endpoint and its keys; an FCM row has only its token.
alter table public.push_subscriptions alter column endpoint drop not null;
alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth drop not null;
alter table public.push_subscriptions drop constraint if exists ck_push_subscription_shape;
alter table public.push_subscriptions add constraint ck_push_subscription_shape check (
  (kind = 'webpush' and endpoint is not null and p256dh is not null and auth is not null and fcm_token is null)
  or (kind = 'fcm' and fcm_token is not null and endpoint is null and p256dh is null and auth is null)
);
create unique index if not exists uq_push_sub_fcm_token on public.push_subscriptions (fcm_token);

comment on column public.push_subscriptions.kind is
  'T4d (v10.127.0): webpush = a browser or installed web app (endpoint + keys); fcm = the Vyact Android app (fcm_token).';
comment on column public.push_subscriptions.fcm_token is
  'T4d: the Android app''s Firebase Cloud Messaging registration token. Written only by register_native_push.';

-- ── The Android app's device (the signed-in person, for their own phone) ─────────────────────────────────

-- Register (or refresh) THIS phone for the caller's active household. The token is the device: a second call
-- updates the household, zone and switches, and a phone that signs in as someone else moves to them, starting
-- fresh (no backlog), exactly as register_push_subscription does for a browser.
create or replace function public.register_native_push(
  p_token text, p_household_id uuid,
  p_user_agent text default null, p_tz text default null, p_prefs jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if not public.is_member(p_household_id) then raise exception 'not_a_member' using errcode = '42501'; end if;
  -- An FCM registration token: base64url characters and colons, a few hundred at most.
  if p_token is null or length(p_token) not between 32 and 4096 or p_token !~ '^[A-Za-z0-9_:-]+$' then
    raise exception 'bad_token' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, household_id, kind, fcm_token, user_agent, tz, prefs)
  values (auth.uid(), p_household_id, 'fcm', p_token, left(p_user_agent, 300), left(p_tz, 64), coalesce(p_prefs, '{}'::jsonb))
  on conflict (fcm_token) do update
     set user_id = excluded.user_id, household_id = excluded.household_id,
         user_agent = excluded.user_agent, tz = excluded.tz, prefs = excluded.prefs, updated_at = now(),
         disabled_at = null, failures = 0,
         created_at = case when push_subscriptions.user_id <> excluded.user_id
                             or push_subscriptions.household_id <> excluded.household_id
                           then now() else push_subscriptions.created_at end
  returning id into v_id;
  -- One list: at most 10 live devices a person, browsers and phones together (as register_push_subscription).
  update public.push_subscriptions set disabled_at = now()
   where id in (select s.id from public.push_subscriptions s
                 where s.user_id = auth.uid() and s.disabled_at is null and s.id <> v_id
                 order by s.updated_at desc, s.created_at desc
                 offset 9);
  return jsonb_build_object('id', v_id);
end;
$$;

-- Stop this phone (switched off in Settings, or signing out).
create or replace function public.unregister_native_push(p_token text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.push_subscriptions where kind = 'fcm' and fcm_token = p_token and user_id = auth.uid();
$$;

-- What the server knows about THIS phone, for the Settings status line.
create or replace function public.native_push_status(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select jsonb_build_object('registered', true, 'active', s.disabled_at is null, 'last_status', s.last_status,
                              'last_success_at', s.last_success_at, 'household_id', s.household_id)
      from public.push_subscriptions s
     where s.kind = 'fcm' and s.fcm_token = p_token and s.user_id = auth.uid()
  ), jsonb_build_object('registered', false));
$$;

revoke all on function public.register_native_push(text, uuid, text, text, jsonb) from public, anon;
revoke all on function public.unregister_native_push(text) from public, anon;
revoke all on function public.native_push_status(text) from public, anon;
grant execute on function public.register_native_push(text, uuid, text, text, jsonb) to authenticated;
grant execute on function public.unregister_native_push(text) to authenticated;
grant execute on function public.native_push_status(text) to authenticated;

commit;
