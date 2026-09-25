-- ============================================================================
-- v10.46.0 (W5) — "ANSWERS ON" from the chat: consent given where it is asked.
--
-- The WhatsApp answer rule (responses spec §6): a question is answered in the
-- chat, and a link is never the answer. Someone with answers off who asks a
-- question is now OFFERED answers in the chat ("Reply ANSWERS ON"), instead of
-- being sent to the app. So consent can be given in two places, and the record
-- says which:
--   1. whatsapp_preferences.reads_source: 'app_settings' | 'whatsapp_keyword'.
--   2. set_my_whatsapp_preferences stamps 'app_settings' when answers are turned on
--      in the app (and clears it when turned off), as marketing already does.
--   3. whatsapp_pending_turns may hold 'reads_offer': the question that prompted
--      the offer, answered as soon as the person says ANSWERS ON.
--
-- MONEY MODEL: untouched.
-- ============================================================================

BEGIN;

alter table public.whatsapp_preferences
  add column if not exists reads_source text;
alter table public.whatsapp_preferences drop constraint if exists ck_wa_prefs_reads_source;
alter table public.whatsapp_preferences add constraint ck_wa_prefs_reads_source
  check (reads_source is null or reads_source in ('app_settings', 'whatsapp_keyword'));

alter table public.whatsapp_pending_turns drop constraint if exists ck_wa_pending_kind;
alter table public.whatsapp_pending_turns add constraint ck_wa_pending_kind
  check (kind in ('missing_amount', 'duplicate_check', 'chips', 'reads_offer'));

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
    reads_source        = case when p_reads_enabled is true and not p.reads_enabled then 'app_settings'
                               when p_reads_enabled is false then null
                               else p.reads_source end,
    muted_topics        = case when p_muted_topics is null then p.muted_topics
                               else coalesce((select array_agg(distinct t order by t) from unnest(p_muted_topics) t), '{}'::text[]) end,
    large_txn_threshold = coalesce(p_large_txn_threshold, p.large_txn_threshold),
    updated_at          = now()
  where p.profile_id = v_uid;

  return public.get_my_whatsapp_preferences();
end;
$$;

revoke all on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric, boolean) from public;
revoke all on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric, boolean) from anon;
grant execute on function public.set_my_whatsapp_preferences(boolean, boolean, text[], numeric, boolean) to authenticated;

COMMIT;
