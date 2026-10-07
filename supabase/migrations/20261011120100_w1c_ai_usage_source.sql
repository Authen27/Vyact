-- W1c (v10.64.0) — audit 2026-10-04 BE-PIP-03 / DB-SEC-11: the AI spend gate is the server's.
--
-- Before this, any member could insert an ai_usage row with any cost_usd, tokens, provider, model
-- and outcome (the INSERT policy checks only household membership and user_id). The admin
-- Intelligence page sums cost_usd over every row, so one devtools insert could put $99,999 on the
-- §9 spend gate. And reserve_ai_usage() counted every backend='llm' row, so the app's own
-- per-question analytics row used up a third of each person's daily model-call cap.
--
--   1. ai_usage.source: 'gateway' (written by the service role: the ask-vyact gateway, the
--      WhatsApp assistant, reserve_ai_usage) or 'client' (the app's analytics row).
--      Existing rows are labelled once: a reservation, a row with a provider, or a row without
--      the client's intent/length fields is the gateway's.
--   2. A BEFORE INSERT trigger: a row written by a signed-in client is always 'client', and its
--      metering fields (provider, model, tokens, cost, tool calls) are cleared; it can never be
--      'reserved'. The client keeps what it legitimately records: intent, sentiment, length,
--      backend, tier, outcome, latency.
--   3. reserve_ai_usage() counts only gateway rows, and marks its reservation as one.
--
-- admin_ai_usage_summary() is unchanged: cost and token sums now only ever see server values,
-- because client rows carry none.

alter table public.ai_usage add column if not exists source text;

update public.ai_usage
   set source = case
     when outcome = 'reserved' or provider is not null or (intent is null and message_len is null) then 'gateway'
     else 'client'
   end
 where source is null;

alter table public.ai_usage drop constraint if exists ai_usage_source_chk;
alter table public.ai_usage add constraint ai_usage_source_chk check (source in ('client', 'gateway'));

create or replace function public.ai_usage_stamp_source()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.source            := 'client';
    new.provider          := null;
    new.model             := null;
    new.prompt_tokens     := null;
    new.completion_tokens := null;
    new.cost_usd          := null;
    new.tool_calls        := null;
    if new.outcome = 'reserved' then new.outcome := null; end if;
  else
    new.source := coalesce(new.source, 'gateway');
  end if;
  return new;
end $$;

drop trigger if exists trg_ai_usage_stamp_source on public.ai_usage;
create trigger trg_ai_usage_stamp_source
  before insert on public.ai_usage
  for each row execute function public.ai_usage_stamp_source();

alter table public.ai_usage alter column source set not null;

create index if not exists ai_usage_gateway_user_ts_idx
  on public.ai_usage (user_id, ts) where source = 'gateway';

create or replace function public.reserve_ai_usage(
  p_user_id      uuid,
  p_household_id uuid,
  p_surface      text,
  p_cap          int
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_id    uuid;
begin
  -- Serialise this user's quota decisions on their profile row (audit A2).
  perform 1 from public.profiles where id = p_user_id for update;

  -- W1c: only the server's own rows count. The app's analytics row no longer uses up the cap.
  select count(*) into v_count
    from public.ai_usage
   where user_id = p_user_id
     and source = 'gateway'
     and backend = 'llm'
     and ts >= now() - interval '24 hours';

  if v_count >= p_cap then
    raise exception 'quota_exceeded' using errcode = '42901';
  end if;

  insert into public.ai_usage (user_id, household_id, surface, backend, outcome, ts, source)
  values (p_user_id, p_household_id, p_surface, 'llm', 'reserved', now(), 'gateway')
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.reserve_ai_usage(uuid, uuid, text, int) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, uuid, text, int) to service_role;

comment on column public.ai_usage.source is
  'W1c — gateway: written by the service role (metering is trustworthy); client: the app''s analytics row (metering fields always null).';
