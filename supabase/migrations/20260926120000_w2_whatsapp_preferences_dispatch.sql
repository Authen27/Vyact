-- ============================================================================
-- v10.42.0 (W2) — WhatsApp consent, preferences, delivery tracking, scheduler.
--
--   1. `whatsapp_preferences`: one row per profile. Marketing and insights
--      consent (off by default, with when and where it was given), muted topics,
--      and the large-spend alert threshold. Server-owned like the other WhatsApp
--      tables (RLS on, no policies); the person reads and changes their own row
--      only through the two RPCs below.
--   2. Delivery tracking on the outbound audit rows: Meta's message id and the
--      last status it reported (sent → delivered → read, or failed).
--   3. The scheduler: pg_cron calls the `whatsapp-dispatch` Edge Function through
--      pg_net. INERT until the owner stores `whatsapp_dispatch_secret` in Vault
--      (and the same value as WHATSAPP_DISPATCH_SECRET on the function): each
--      job selects the secret, so with no secret it selects no row and makes no
--      call. A preview branch, which has no such secret, never calls production.
--
-- MONEY MODEL: untouched. No transaction, account, budget or amount is written.
-- ============================================================================

BEGIN;

-- ── 1. Preferences ──────────────────────────────────────────────────────────
create table if not exists public.whatsapp_preferences (
  profile_id          uuid primary key references public.profiles(id) on delete cascade,
  marketing_opt_in    boolean not null default false,
  marketing_opt_in_at timestamptz,
  marketing_source    text,
  insights_opt_in     boolean not null default false,
  insights_opt_in_at  timestamptz,
  muted_topics        text[] not null default '{}',
  large_txn_threshold numeric(14,2) not null default 10000 check (large_txn_threshold > 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint ck_wa_prefs_topics check (muted_topics <@ array[
    'budgets','splits','recurring','payday','digest','summary','runway','setup','balances','weekly','tips'
  ]::text[]),
  constraint ck_wa_prefs_marketing_source check (marketing_source is null
    or marketing_source in ('app_settings','whatsapp_keyword','meta_opt_out'))
);

alter table public.whatsapp_preferences enable row level security;
-- Deliberately NO policies: deny-all to anon/authenticated. Edge Functions use
-- the service role; people use the RPCs.
revoke all on public.whatsapp_preferences from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_preferences to service_role;

-- The caller's own preferences, defaults when no row exists yet.
create or replace function public.get_my_whatsapp_preferences()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'marketing_opt_in',    coalesce(p.marketing_opt_in, false),
    'marketing_opt_in_at', p.marketing_opt_in_at,
    'insights_opt_in',     coalesce(p.insights_opt_in, false),
    'muted_topics',        coalesce(to_jsonb(p.muted_topics), '[]'::jsonb),
    'large_txn_threshold', coalesce(p.large_txn_threshold, 10000),
    'linked',              exists (select 1 from public.whatsapp_identities i where i.profile_id = auth.uid())
  )
  from (select auth.uid() as uid) me
  left join public.whatsapp_preferences p on p.profile_id = me.uid
  where me.uid is not null;
$$;

-- Change the caller's own preferences. A null argument leaves that field as it
-- is. Turning marketing or insights ON records when, and that it was in the app.
create or replace function public.set_my_whatsapp_preferences(
  p_marketing_opt_in    boolean default null,
  p_insights_opt_in     boolean default null,
  p_muted_topics        text[]  default null,
  p_large_txn_threshold numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_large_txn_threshold is not null and p_large_txn_threshold <= 0 then
    raise exception 'threshold must be positive' using errcode = '22023';
  end if;

  insert into public.whatsapp_preferences (profile_id) values (v_uid)
  on conflict (profile_id) do nothing;

  update public.whatsapp_preferences p set
    marketing_opt_in    = coalesce(p_marketing_opt_in, p.marketing_opt_in),
    marketing_opt_in_at = case when p_marketing_opt_in is true and not p.marketing_opt_in then now()
                               when p_marketing_opt_in is false then null
                               else p.marketing_opt_in_at end,
    marketing_source    = case when p_marketing_opt_in is true and not p.marketing_opt_in then 'app_settings'
                               when p_marketing_opt_in is false then null
                               else p.marketing_source end,
    insights_opt_in     = coalesce(p_insights_opt_in, p.insights_opt_in),
    insights_opt_in_at  = case when p_insights_opt_in is true and not p.insights_opt_in then now()
                               when p_insights_opt_in is false then null
                               else p.insights_opt_in_at end,
    muted_topics        = case when p_muted_topics is null then p.muted_topics
                               else coalesce((select array_agg(distinct t order by t) from unnest(p_muted_topics) t), '{}'::text[]) end,
    large_txn_threshold = coalesce(p_large_txn_threshold, p.large_txn_threshold),
    updated_at          = now()
  where p.profile_id = v_uid;

  return public.get_my_whatsapp_preferences();
end;
$$;

revoke all on function public.get_my_whatsapp_preferences() from public;
revoke all on function public.get_my_whatsapp_preferences() from anon;
grant execute on function public.get_my_whatsapp_preferences() to authenticated;
revoke all on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric) from public;
revoke all on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric) from anon;
grant execute on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric) to authenticated;

-- ── 2. Delivery tracking on outbound audit rows ─────────────────────────────
alter table public.whatsapp_inbound_messages
  add column if not exists provider_message_id text,
  add column if not exists delivery_status     text,
  add column if not exists delivery_updated_at timestamptz;
create unique index if not exists uq_wa_messages_provider_id
  on public.whatsapp_inbound_messages(provider_message_id) where provider_message_id is not null;

COMMIT;

-- ── 3. Scheduler ────────────────────────────────────────────────────────────
-- Validated 25 Sep against production in a rolled-back DO block: both jobs are
-- created, the RPCs work as a signed-in user, anon cannot execute them.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Every 15 minutes: large-spend, budget and split alerts.
select cron.schedule('whatsapp-dispatch-alerts', '*/15 * * * *', $job$
  select net.http_post(
    url     := 'https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-dispatch?job=alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000)
  from vault.decrypted_secrets s where s.name = 'whatsapp_dispatch_secret';
$job$);

-- Sundays 18:00 IST (12:30 UTC): the weekly summary and stale-balance nudge,
-- both marketing, so they reach only people who opted in.
select cron.schedule('whatsapp-dispatch-weekly', '30 12 * * 0', $job$
  select net.http_post(
    url     := 'https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-dispatch?job=weekly',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000)
  from vault.decrypted_secrets s where s.name = 'whatsapp_dispatch_secret';
$job$);
