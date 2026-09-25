-- ============================================================================
-- v10.45.0 (W4) — Ask Vyact answers on WhatsApp, only with consent.
--
-- An answer puts figures on a phone's notification screen. So questions stay
-- hard-blocked on WhatsApp unless the person turns on "Answer my questions here"
-- in the app — a consent of its own (`reads_enabled`), OFF by default, recorded
-- with when it was given, never bundled with marketing or insights.
--
--   1. whatsapp_preferences.reads_enabled (+ reads_enabled_at).
--   2. get/set_my_whatsapp_preferences carry it (set gains p_reads_enabled; the
--      old 4-argument function is replaced, not overloaded).
--   3. whatsapp_pending_turns may hold 'chips': an answer's follow-ups, so a reply
--      of "1", "2" or "3" asks that follow-up.
--
-- MONEY MODEL: untouched.
-- ============================================================================

BEGIN;

alter table public.whatsapp_preferences
  add column if not exists reads_enabled    boolean not null default false,
  add column if not exists reads_enabled_at timestamptz;

alter table public.whatsapp_pending_turns drop constraint if exists whatsapp_pending_turns_kind_check;
alter table public.whatsapp_pending_turns drop constraint if exists ck_wa_pending_kind;
alter table public.whatsapp_pending_turns add constraint ck_wa_pending_kind
  check (kind in ('missing_amount', 'duplicate_check', 'chips'));

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
    'reads_enabled',       coalesce(p.reads_enabled, false),
    'muted_topics',        coalesce(to_jsonb(p.muted_topics), '[]'::jsonb),
    'large_txn_threshold', coalesce(p.large_txn_threshold, 10000),
    'linked',              exists (select 1 from public.whatsapp_identities i where i.profile_id = auth.uid())
  )
  from (select auth.uid() as uid) me
  left join public.whatsapp_preferences p on p.profile_id = me.uid
  where me.uid is not null;
$$;

drop function if exists public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric);

create or replace function public.set_my_whatsapp_preferences(
  p_marketing_opt_in    boolean default null,
  p_insights_opt_in     boolean default null,
  p_muted_topics        text[]  default null,
  p_large_txn_threshold numeric default null,
  p_reads_enabled       boolean default null
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
    reads_enabled       = coalesce(p_reads_enabled, p.reads_enabled),
    reads_enabled_at    = case when p_reads_enabled is true and not p.reads_enabled then now()
                               when p_reads_enabled is false then null
                               else p.reads_enabled_at end,
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
revoke all on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric, boolean) from public;
revoke all on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric, boolean) from anon;
grant execute on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric, boolean) to authenticated;

COMMIT;
