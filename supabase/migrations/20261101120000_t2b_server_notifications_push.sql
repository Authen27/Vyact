-- v10.116.0 — Track T2, part b-2: the lock screen shows only what Vyact raised, and push is hardened.
-- Audit DB-SEC-06 (and FE-PLT-05), BE-FN-07; owner decision 18 Oct 2026: "push only the server's".
--
-- DB-SEC-06. Any member, even a viewer, could insert a notification, and web-push sent every unpushed
-- row to every member's lock screen: a fake "security alert, call this number" looked exactly like
-- Vyact. A viewer could also delete or mark read the real "EMI due" for everyone. Now:
--   1. every row says who raised it (`source`: 'client' from a device, 'server' from web-push);
--   2. web-push pushes only `source = 'server'` rows. When it raises a notification a device already
--      wrote (same dedupe key), it takes that row over with its own wording, so genuine pushes are
--      unchanged (raise_server_notifications);
--   3. a device may write only its own kind of row: not as a viewer, never 'server', never pre-stamped as
--      pushed, and a link only inside Vyact;
--   4. from the app, only a notification's read state can change; viewers can mark read but not delete.
-- BE-FN-07. Push services are the real ones only (Apple's web push host, Windows' WNS hosts), and a person
-- keeps at most 10 devices: registering an 11th retires the oldest. (Payload size and household paging
-- are in the web-push function.)
--
-- MONEY MODEL: untouched.

begin;

-- ── 1. Who raised it ────────────────────────────────────────────────────────────────────────────
alter table public.notifications add column if not exists source text not null default 'client';
do $$ begin
  alter table public.notifications add constraint notifications_source_check check (source in ('client', 'server'));
exception when duplicate_object then null; end $$;
-- Only server-raised rows are ever pushed: an index for the dispatcher's pending read.
create index if not exists notif_server_unpushed_idx on public.notifications (household_id, created_at)
  where source = 'server' and pushed_at is null;

-- ── 2. The server raises, and takes over a device's matching row ───────────────────────────────
create or replace function public.raise_server_notifications(p_rows jsonb)
  returns integer language plpgsql security definer set search_path = public, pg_temp
as $$
declare n integer;
begin
  insert into public.notifications (household_id, type, priority, title, body, status, due_at, member_id, amount_ref,
                                    deep_link, tint, actions, context, dedupe_key, source)
  select r.household_id, r.type, coalesce(r.priority, 'P2'), r.title, r.body, coalesce(r.status, 'unread'), r.due_at,
         r.member_id, r.amount_ref, r.deep_link, r.tint, r.actions, r.context, r.dedupe_key, 'server'
    from jsonb_populate_recordset(null::public.notifications, coalesce(p_rows, '[]'::jsonb)) r
  on conflict (household_id, dedupe_key) do update
     set type = excluded.type, priority = excluded.priority, title = excluded.title, body = excluded.body,
         due_at = excluded.due_at, member_id = excluded.member_id, amount_ref = excluded.amount_ref,
         deep_link = excluded.deep_link, tint = excluded.tint, actions = excluded.actions, context = excluded.context,
         source = 'server'
   where notifications.source = 'client';
  get diagnostics n = row_count;
  return n;
end; $$;
revoke all on function public.raise_server_notifications(jsonb) from public, anon, authenticated;
grant execute on function public.raise_server_notifications(jsonb) to service_role;

-- ── 3. What a device may write ──────────────────────────────────────────────────────────────────
drop policy if exists "notif_insert" on public.notifications;
create policy "notif_insert" on public.notifications for insert with check (
  public.is_member(household_id)
  and coalesce(public.role_in(household_id), 'viewer') <> 'viewer'
  and source = 'client'
  and pushed_at is null
  and (deep_link is null or deep_link = '/' or deep_link ~ '^/[^/\\]')
);

-- ── 4. From the app, only the read state changes; viewers don't delete ─────────────────────────
drop policy if exists "notif_update" on public.notifications;
create policy "notif_update" on public.notifications for update
  using (public.is_member(household_id)) with check (public.is_member(household_id));
drop policy if exists "notif_delete" on public.notifications;
create policy "notif_delete" on public.notifications for delete using (
  public.is_member(household_id) and coalesce(public.role_in(household_id), 'viewer') <> 'viewer'
);

create or replace function public.notifications_app_edits_status_only()
  returns trigger language plpgsql set search_path = public, pg_temp
as $$
declare v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  -- The web-push job (service role), migrations and scheduled jobs carry no 'authenticated' claim.
  if v_claims is null or (v_claims::jsonb ->> 'role') is distinct from 'authenticated' then
    return new;
  end if;
  if (new.household_id, new.type, new.priority, new.title, new.body, new.created_at, new.due_at, new.member_id,
      new.amount_ref, new.deep_link, new.tint, new.actions, new.context, new.dedupe_key, new.source, new.pushed_at)
     is distinct from
     (old.household_id, old.type, old.priority, old.title, old.body, old.created_at, old.due_at, old.member_id,
      old.amount_ref, old.deep_link, old.tint, old.actions, old.context, old.dedupe_key, old.source, old.pushed_at) then
    raise exception 'notification_fixed: only its read state can change' using errcode = '42501';
  end if;
  return new;
end; $$;
revoke all on function public.notifications_app_edits_status_only() from public, anon, authenticated;
drop trigger if exists notifications_app_edits_status_only on public.notifications;
create trigger notifications_app_edits_status_only
  before update on public.notifications
  for each row execute function public.notifications_app_edits_status_only();

-- ── 5. Real push services only; at most 10 devices a person (BE-FN-07) ─────────────────────────
-- Unchanged otherwise (20261003120000_web_push.sql). Apple's web push host is web.push.apple.com, and
-- Windows' are wns2-<region>.notify.windows.com; the old wildcards let anyone register a host that
-- never answers.
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
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|web\.push\.apple\.com|wns2-[a-z0-9-]+\.notify\.windows\.com)/' then
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
  -- At most 10 live devices a person: the oldest beyond that are retired.
  update public.push_subscriptions set disabled_at = now()
   where id in (select s.id from public.push_subscriptions s
                 where s.user_id = auth.uid() and s.disabled_at is null and s.id <> v_id
                 order by s.updated_at desc, s.created_at desc
                 offset 9);
  return jsonb_build_object('id', v_id);
end;
$$;
revoke all on function public.register_push_subscription(text, text, text, uuid, text, text, jsonb) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, uuid, text, text, jsonb) to authenticated;

commit;
