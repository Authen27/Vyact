-- v10.48.0 — Web Push for the installed app (TD-22).
--
-- Until now "Browser push" only showed a popup from an OPEN tab; nothing reached a
-- lock screen. This adds the server half:
--   • push_subscriptions — one row per device (browser push endpoint + its keys),
--     written only through the RPCs below, readable by nobody but the service;
--   • push_deliveries    — every attempt and the push service's answer (the proof a
--     device was reached), service-only;
--   • notifications.pushed_at — a notification is pushed at most once;
--   • Vault: the VAPID key pair (created by the web-push function on first use) and
--     the cron secret (created here). Nobody handles either;
--   • pg_cron: web-push dispatch every 15 minutes.

begin;

alter table public.notifications add column if not exists pushed_at timestamptz;
create index if not exists notif_unpushed_idx on public.notifications (household_id, created_at) where pushed_at is null;

create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  household_id    uuid not null references public.households(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  tz              text,
  prefs           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_status     int,
  last_success_at timestamptz,
  failures        int not null default 0,
  disabled_at     timestamptz
);
create index if not exists push_sub_household_idx on public.push_subscriptions (household_id) where disabled_at is null;
create index if not exists push_sub_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

create table if not exists public.push_deliveries (
  id              bigint generated always as identity primary key,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  user_id         uuid,
  notification_id uuid,
  kind            text not null check (kind in ('test', 'notification')),
  status          int,
  error           text,
  created_at      timestamptz not null default now()
);
create index if not exists push_deliveries_user_idx on public.push_deliveries (user_id, created_at desc);
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.push_deliveries to service_role;
grant usage on sequence public.push_deliveries_id_seq to service_role;

-- ── Device registration (the signed-in person, for their own device) ──────────

-- Register (or refresh) THIS device for the caller's active household. Idempotent:
-- the endpoint is the device, so a second call updates keys, zone and switches, and a
-- device that signs in as someone else moves to them.
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_household_id uuid,
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
  -- Only real push services; the dispatcher POSTs to this URL.
  if p_endpoint is null or length(p_endpoint) > 1024
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' then
    raise exception 'bad_endpoint' using errcode = '22023';
  end if;
  if coalesce(length(p_p256dh), 0) not between 80 and 100 or coalesce(length(p_auth), 0) not between 16 and 30 then
    raise exception 'bad_keys' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, household_id, endpoint, p256dh, auth, user_agent, tz, prefs)
  values (auth.uid(), p_household_id, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300), left(p_tz, 64), coalesce(p_prefs, '{}'::jsonb))
  on conflict (endpoint) do update
     set user_id = excluded.user_id, household_id = excluded.household_id,
         p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent,
         tz = excluded.tz, prefs = excluded.prefs, updated_at = now(),
         disabled_at = null, failures = 0,
         -- A device moving to another person or household starts fresh: no backlog.
         created_at = case when push_subscriptions.user_id <> excluded.user_id
                             or push_subscriptions.household_id <> excluded.household_id
                           then now() else push_subscriptions.created_at end
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;

-- Stop this device (push switched off, or signing out).
create or replace function public.unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- What the server knows about THIS device, for the Settings status line.
create or replace function public.push_subscription_status(p_endpoint text)
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
     where s.endpoint = p_endpoint and s.user_id = auth.uid()
  ), jsonb_build_object('registered', false));
$$;

revoke all on function public.register_push_subscription(text, text, text, uuid, text, text, jsonb) from public, anon;
revoke all on function public.unregister_push_subscription(text) from public, anon;
revoke all on function public.push_subscription_status(text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, uuid, text, text, jsonb) to authenticated;
grant execute on function public.unregister_push_subscription(text) to authenticated;
grant execute on function public.push_subscription_status(text) to authenticated;

-- ── Service side (the web-push function only) ──────────────────────────────────

create or replace function public.web_push_vapid()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.decrypted_secret::jsonb from vault.decrypted_secrets s where s.name = 'web_push_vapid' limit 1;
$$;

-- Store the key pair once; a second (concurrent) first use gets the stored pair back.
create or replace function public.web_push_store_vapid(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p ? 'publicKey' and p ? 'privateJwk' and not exists (select 1 from vault.secrets where name = 'web_push_vapid') then
    begin
      perform vault.create_secret(p::text, 'web_push_vapid', 'Web Push VAPID key pair (generated by the web-push function)');
    exception when unique_violation then null;
    end;
  end if;
  return public.web_push_vapid();
end;
$$;

create or replace function public.web_push_cron_ok(p text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select length(coalesce(p, '')) >= 32
     and exists (select 1 from vault.decrypted_secrets s where s.name = 'web_push_cron_secret' and s.decrypted_secret = p);
$$;

-- A delivery's outcome on its device: gone (404/410) retires it; 5 failures in a row too.
create or replace function public.web_push_mark_device(p_id uuid, p_status int, p_ok boolean, p_gone boolean)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update public.push_subscriptions
     set last_status = p_status,
         last_success_at = case when p_ok then now() else last_success_at end,
         failures = case when p_ok then 0 else failures + 1 end,
         disabled_at = case when p_gone or (not p_ok and failures + 1 >= 5) then now() else disabled_at end
   where id = p_id;
$$;

revoke all on function public.web_push_vapid() from public, anon, authenticated;
revoke all on function public.web_push_store_vapid(jsonb) from public, anon, authenticated;
revoke all on function public.web_push_cron_ok(text) from public, anon, authenticated;
revoke all on function public.web_push_mark_device(uuid, int, boolean, boolean) from public, anon, authenticated;
grant execute on function public.web_push_vapid() to service_role;
grant execute on function public.web_push_store_vapid(jsonb) to service_role;
grant execute on function public.web_push_cron_ok(text) to service_role;
grant execute on function public.web_push_mark_device(uuid, int, boolean, boolean) to service_role;

-- ── The cron secret (generated here; never leaves the database and the function) ──
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'web_push_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'web_push_cron_secret',
                                'pg_cron -> web-push dispatch');
  end if;
end;
$$;

-- ── Every 15 minutes: raise and push ────────────────────────────────────────────
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'web-push-dispatch';
select cron.schedule('web-push-dispatch', '*/15 * * * *', $job$
  select net.http_post(
    url     := 'https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/web-push?mode=dispatch',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000)
  from vault.decrypted_secrets s where s.name = 'web_push_cron_secret';
$job$);

commit;
