-- v10.135.0 — Track Q, part 7: Pip's limits, and the test relay retired (audit OPS-11, BE-PIP-06; owner decisions
-- 20 Oct 2026: "a rate limit with an off-topic cool-down", "a global daily ceiling, fail closed", "retire the relay",
-- "remembered preferences").
--
-- 1. Limits. One row, ai_limits, holds every number (service role only; a change is recorded in the staff audit trail):
--      per_user_daily_calls   200   model calls one person may make in 24 hours. The gateway's ASK_VYACT_DAILY_CALL_CAP
--                                   can only lower it, so a caller naming its own cap cannot raise it.
--      global_daily_calls    5000   model calls everyone together may make in 24 hours.
--      per_minute_calls        12   one person's calls in a minute (a question is two calls).
--      off_topic_limit          3   off-topic questions within off_topic_window_min (10 minutes) pause Pip for that
--      cooldown_min            15   person until 15 minutes after the last of them.
--    ai_limit_state() decides, with the person's profile row locked: no row means misconfigured (closed); then the
--    person's 24 hours, the cool-down, the minute, and last everyone's 24 hours, counted under one advisory lock so two
--    reservations at the same moment count each other. A reservation left unfinalised for 5 minutes is not counted as
--    a call against the ceiling (the gateway finalises within its 20-second timeout), so reserving alone cannot use it
--    up. prepare_ai_call() and reserve_ai_usage() both ask it, and both now reserve without the gateway's cap too.
--    The gateway records 'off_topic' on a classify call the model placed off topic: the cool-down counts the server's
--    own reading, never the app's.
-- 2. ai_ceiling_state(): the last 24 hours against the ceiling, for job-health's email to the owner at 50%, 80% and
--    100% (job_alerts kinds spend_50, spend_80, spend_100; once a day each).
-- 3. The Claude Code relay (TD-44) is gone: its config rows, its queue (message content) and its line in the
--    household erase. A 'claude-code-relay' row can no longer be added.
-- 4. profiles.pip_answer_length: 'short' (null means short) or 'detailed', the person's own choice; the app sends it
--    with each answer it asks Pip to word.
--
-- MONEY MODEL: untouched.

begin;

-- ── 1. The relay (BE-PIP-06, TD-44) ─────────────────────────────────────────────────────────────────────────────
delete from public.ai_model_configs where provider = 'claude-code-relay';
alter table public.ai_model_configs drop constraint if exists ck_ai_model_configs_no_relay;
alter table public.ai_model_configs add constraint ck_ai_model_configs_no_relay check (provider <> 'claude-code-relay');

CREATE OR REPLACE FUNCTION public.erase_household_data(h_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  caller_role text;
begin
  select role into caller_role
  from memberships
  where household_id = h_id and user_id = auth.uid()
  limit 1;

  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'not authorized to erase this household''s data';
  end if;
  if not public.recently_reauthenticated() then
    raise exception 'reauth_required' using errcode = '42501',
      hint = 'Confirm with the emailed code, then erase within 10 minutes.';
  end if;

  -- Splits shared with people outside the household: deleted for everyone (shares cascade).
  delete from shared_splits        where owner_household_id = h_id;

  delete from transactions         where household_id = h_id;
  delete from budgets              where household_id = h_id;
  delete from budget_allocations   where household_id = h_id;
  delete from goals                where household_id = h_id;

  -- Loans first (R1): with no transactions left, a loan account still holds its opening balance, so
  -- debts_refuse_unpaid_delete would see money owed. Remove the loan accounts, zero the cached
  -- balance the guard falls back to, then delete the debts.
  delete from loan_payment_events  where household_id = h_id;
  delete from accounts             where household_id = h_id and kind = 'loan';
  update debts set current_balance = 0 where household_id = h_id;
  delete from debts                where household_id = h_id;

  delete from assets               where household_id = h_id;
  delete from accounts             where household_id = h_id;
  delete from recurring_schedules  where household_id = h_id;
  delete from saved_views          where household_id = h_id;
  delete from net_worth_snapshots  where household_id = h_id;
  delete from notifications        where household_id = h_id;
  delete from whatsapp_inbound_messages where household_id = h_id;
  delete from whatsapp_pending_turns    where household_id = h_id;
  delete from whatsapp_rule_state       where household_id = h_id;
  delete from agent_pending_intents     where household_id = h_id;
  delete from agent_conversations       where household_id = h_id;
  delete from activity_log         where household_id = h_id;

  update households set onboarding = '{}'::jsonb where id = h_id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h_id, auth.uid(), 'deleted', 'household', h_id,
          jsonb_build_object('kind', 'erase_household_data', 'erased_at', now()));
end;
$function$;

drop table if exists public.ask_vyact_relay;

-- ── 2. Limits (OPS-11) ──────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.ai_limits (
  id                    boolean primary key default true check (id),
  per_user_daily_calls  int not null check (per_user_daily_calls between 0 and 1000),
  global_daily_calls    int not null check (global_daily_calls between 0 and 1000000),
  per_minute_calls      int not null check (per_minute_calls between 1 and 600),
  off_topic_limit       int not null check (off_topic_limit between 1 and 100),
  off_topic_window_min  int not null check (off_topic_window_min between 1 and 1440),
  cooldown_min          int not null check (cooldown_min between 1 and 1440),
  updated_at            timestamptz not null default now()
);
insert into public.ai_limits (id, per_user_daily_calls, global_daily_calls, per_minute_calls, off_topic_limit,
                              off_topic_window_min, cooldown_min)
values (true, 200, 5000, 12, 3, 10, 15)
on conflict (id) do nothing;
alter table public.ai_limits enable row level security;
revoke all on public.ai_limits from public, anon, authenticated;
comment on table public.ai_limits is
  'Q7 (v10.135.0, OPS-11): Pip''s limits, one row. Without it every model call is refused (fail closed). Service role only; changes are in admin_audit.';

alter table public.admin_audit drop constraint if exists admin_audit_target_table_check;
alter table public.admin_audit add constraint admin_audit_target_table_check
  check (target_table in ('admin_roles', 'content_items', 'category_classifications', 'ai_model_configs', 'ai_limits'));
CREATE OR REPLACE FUNCTION public.log_staff_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  v_changed text[] := '{}';
  v_detail  jsonb;
  v_target  text;
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), '{}') into v_changed
      from jsonb_object_keys(n) k
     where k not in ('updated_at', 'created_at') and (o -> k) is distinct from (n -> k);
    if cardinality(v_changed) = 0 then return null; end if;   -- a no-op update records nothing
  end if;

  if tg_table_name = 'admin_roles' then
    v_target := r ->> 'user_id';
    v_detail := jsonb_build_object('role_before', o ->> 'role', 'role_after', n ->> 'role');
  elsif tg_table_name = 'content_items' then
    v_target := r ->> 'id';
    v_detail := jsonb_build_object('slug', r ->> 'slug', 'status_before', o ->> 'status', 'status_after', n ->> 'status');
  elsif tg_table_name = 'category_classifications' then
    v_target := r ->> 'category';
    v_detail := jsonb_build_object('before', o ->> 'classification', 'after', n ->> 'classification');
  elsif tg_table_name = 'ai_model_configs' then
    v_target := r ->> 'id';
    v_detail := jsonb_build_object('seam', r ->> 'seam', 'provider', r ->> 'provider', 'model', r ->> 'model',
                                   'enabled_before', o -> 'enabled', 'enabled_after', n -> 'enabled');
  elsif tg_table_name = 'ai_limits' then
    -- v10.135.0 (Q7): Pip's limits, every number before and after (there is nothing private in them).
    v_target := 'ai_limits';
    v_detail := jsonb_build_object('before', o - 'id' - 'updated_at', 'after', n - 'id' - 'updated_at');
  else
    return null;
  end if;

  insert into public.admin_audit (actor_id, action, target_table, target_id, changed, detail)
  values (auth.uid(), lower(tg_op), tg_table_name, v_target, v_changed, jsonb_strip_nulls(v_detail));
  return null;
end $function$;

drop trigger if exists trg_ai_limits_staff_audit on public.ai_limits;
create trigger trg_ai_limits_staff_audit after insert or update or delete on public.ai_limits
  for each row execute function public.log_staff_change();

create or replace function public.ai_limits_touch()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.ai_limits_touch() from public, anon, authenticated;
drop trigger if exists trg_ai_limits_touch on public.ai_limits;
create trigger trg_ai_limits_touch before update on public.ai_limits for each row execute function public.ai_limits_touch();

-- Everyone's model calls in the last 24 hours, the global ceiling's count.
create index if not exists ai_usage_gateway_llm_ts_idx on public.ai_usage (ts) where source = 'gateway' and backend = 'llm';

create or replace function public.ai_global_calls_24h()
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*)::int
    from public.ai_usage
   where source = 'gateway' and backend = 'llm' and ts >= now() - interval '24 hours'
     -- A reservation never finalised within 5 minutes was not a call.
     and (outcome is distinct from 'reserved' or ts > now() - interval '5 minutes')
$$;

-- May this person make one more model call now? The caller holds the person's profile row lock.
create or replace function public.ai_limit_state(p_user uuid, p_cap int)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  l        public.ai_limits;
  v_cap    int;
  v_count  int;
  v_last   timestamptz;
  v_first  timestamptz;
begin
  select * into l from public.ai_limits where id;
  if not found then
    return jsonb_build_object('quota', 'misconfigured');
  end if;
  -- The gateway's own cap may only lower the server's (none: the server's).
  v_cap := case when p_cap is null then l.per_user_daily_calls else least(l.per_user_daily_calls, greatest(p_cap, 0)) end;

  select count(*) into v_count
    from public.ai_usage
   where user_id = p_user and source = 'gateway' and backend = 'llm' and ts >= now() - interval '24 hours';
  if v_count >= v_cap then
    return jsonb_build_object('quota', 'exceeded');
  end if;

  -- off_topic_limit off-topic questions within off_topic_window_min pause Pip for this person until cooldown_min after
  -- the last of them.
  select max(ts) into v_last
    from public.ai_usage
   where user_id = p_user and source = 'gateway' and intent = 'off_topic'
     and ts > now() - make_interval(mins => l.cooldown_min);
  if v_last is not null then
    select count(*) into v_count
      from public.ai_usage
     where user_id = p_user and source = 'gateway' and intent = 'off_topic'
       and ts > v_last - make_interval(mins => l.off_topic_window_min) and ts <= v_last;
    if v_count >= l.off_topic_limit then
      return jsonb_build_object('quota', 'cooldown', 'retry_at', v_last + make_interval(mins => l.cooldown_min));
    end if;
  end if;

  select count(*), min(ts) into v_count, v_first
    from public.ai_usage
   where user_id = p_user and source = 'gateway' and backend = 'llm' and ts > now() - interval '1 minute';
  if v_count >= l.per_minute_calls then
    return jsonb_build_object('quota', 'rate_limited', 'retry_at', v_first + interval '1 minute');
  end if;

  -- Everyone together, last, under one lock: reservations made at the same moment count each other.
  perform pg_advisory_xact_lock(hashtext('vyact.ai_global_ceiling'));
  if public.ai_global_calls_24h() >= l.global_daily_calls then
    return jsonb_build_object('quota', 'global_exceeded');
  end if;
  return jsonb_build_object('quota', 'ok');
end $$;

create or replace function public.ai_ceiling_state()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object('calls', public.ai_global_calls_24h(),
                            'ceiling', (select l.global_daily_calls from public.ai_limits l where l.id))
$$;

create or replace function public.prepare_ai_call(
  p_household_id uuid,
  p_seam         text,
  p_surface      text,
  p_cap          int,
  p_reserve      boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_member     boolean := null;
  v_applicable boolean;
  v_state      jsonb;
  v_id         uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_surface is null or p_surface not in ('chat', 'whatsapp', 'sms_share', 'receipt') then
    raise exception 'invalid_surface' using errcode = '22023';
  end if;

  if p_household_id is not null then
    select exists (
      select 1 from public.memberships where user_id = v_uid and household_id = p_household_id
    ) into v_member;
    if not v_member then
      return jsonb_build_object('member', false, 'reservation_id', null, 'quota', 'skipped');
    end if;
  end if;

  if not coalesce(p_reserve, false) then
    return jsonb_build_object('member', v_member, 'reservation_id', null, 'quota', 'skipped');
  end if;

  -- The gateway's row rule (filterRowsForUser + selectModelConfig): an enabled row for this seam with a model and an
  -- address, piloted rows (params.allowed_user_ids) only for those people. Nothing applies: nothing is written.
  select exists (
    select 1 from public.ai_model_configs c
     where c.seam = p_seam
       and c.enabled
       and coalesce(btrim(c.model), '') <> ''
       and coalesce(btrim(c.base_url), '') <> ''
       and case
             when jsonb_typeof(c.params -> 'allowed_user_ids') = 'array'
               then (c.params -> 'allowed_user_ids') ? v_uid::text
             else true
           end
  ) into v_applicable;
  if not v_applicable then
    return jsonb_build_object('member', v_member, 'reservation_id', null, 'quota', 'skipped');
  end if;

  -- Serialise this person's quota decisions on their profile row (audit A2), as reserve_ai_usage() does.
  perform 1 from public.profiles where id = v_uid for update;

  v_state := public.ai_limit_state(v_uid, p_cap);
  if v_state ->> 'quota' <> 'ok' then
    return jsonb_build_object('member', v_member, 'reservation_id', null) || v_state;
  end if;

  insert into public.ai_usage (user_id, household_id, surface, backend, outcome, ts, source)
  values (v_uid, p_household_id, p_surface, 'llm', 'reserved', now(), 'gateway')
  returning id into v_id;

  return jsonb_build_object('member', v_member, 'reservation_id', v_id, 'quota', 'ok');
end $$;

comment on function public.prepare_ai_call(uuid, text, text, int, boolean) is
  'v10.107.1, v10.135.0: the ask-vyact gateway''s pre-model checks in one round trip, for auth.uid() only: household membership, then (when asked and an enabled model row applies) Pip''s limits (ai_limit_state) and a reservation. Returns {member, reservation_id, quota: ok|exceeded|rate_limited|cooldown|global_exceeded|misconfigured|skipped, retry_at?}.';

create or replace function public.reserve_ai_usage(p_user_id uuid, p_household_id uuid, p_surface text, p_cap integer)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state jsonb;
  v_id    uuid;
begin
  -- Serialise this user's quota decisions on their profile row (audit A2).
  perform 1 from public.profiles where id = p_user_id for update;

  -- v10.135.0 (Q7): the same limits as prepare_ai_call(). Over a limit raises its name (42901); no limits row, 55000.
  v_state := public.ai_limit_state(p_user_id, p_cap);
  if v_state ->> 'quota' = 'misconfigured' then
    raise exception 'quota_misconfigured' using errcode = '55000';
  elsif v_state ->> 'quota' = 'exceeded' then
    raise exception 'quota_exceeded' using errcode = '42901';
  elsif v_state ->> 'quota' <> 'ok' then
    raise exception '%', v_state ->> 'quota' using errcode = '42901';
  end if;

  insert into public.ai_usage (user_id, household_id, surface, backend, outcome, ts, source)
  values (p_user_id, p_household_id, p_surface, 'llm', 'reserved', now(), 'gateway')
  returning id into v_id;
  return v_id;
end $$;

do $$
declare
  f text;
begin
  foreach f in array array['ai_global_calls_24h()', 'ai_limit_state(uuid,integer)', 'ai_ceiling_state()',
                           'reserve_ai_usage(uuid,uuid,text,integer)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
revoke all on function public.prepare_ai_call(uuid, text, text, int, boolean) from public, anon;
grant execute on function public.prepare_ai_call(uuid, text, text, int, boolean) to authenticated, service_role;

-- The owner hears when everyone's calls pass half, most and all of the ceiling (job-health, once a day each).
alter table public.job_alerts drop constraint if exists job_alerts_kind_check;
alter table public.job_alerts add constraint job_alerts_kind_check
  check (kind in ('failed', 'partial', 'late', 'spend_50', 'spend_80', 'spend_100'));

-- ── 3. Remembered preferences ───────────────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists pip_answer_length text;
alter table public.profiles drop constraint if exists ck_profiles_pip_answer_length;
alter table public.profiles add constraint ck_profiles_pip_answer_length
  check (pip_answer_length is null or pip_answer_length in ('short', 'detailed'));
comment on column public.profiles.pip_answer_length is
  'Q7 (v10.135.0): how long Pip''s answers are for this person: short (null) or detailed. Their own; the app sends it with each answer.';

commit;
