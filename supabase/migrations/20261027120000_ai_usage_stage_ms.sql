-- v10.106.2 · Pip answer timings (16 Oct 2026).
--
-- A 14.8 s Pip answer had a 9.2 s gap after the gateway replied that nobody could explain: the app's
-- ai_usage row recorded only the total. `stage_ms` splits that total into stages, so a slow answer can
-- be traced: the classify round trip, the phrase round trip(s), and the time before, between and after
-- them (react/src/lib/aiUsage.ts `createTurnTimer`).
--
-- PRIVACY: stage_ms holds NUMBERS ONLY, under short alphabetic keys. The CHECK below refuses anything
-- else (a string, a nested object, a long key), so a mistaken or hostile client cannot store message
-- text in it. Like intent and latency_ms it is analytics, not metering: the W1c trigger
-- (ai_usage_stamp_source) still clears every metering field on a client row and leaves this one.
--
-- The gateway's own per-request stages (auth, config, membership, reservation, model) are logged by
-- ask-vyact as `[ask-vyact] timing` lines; this column is the app's side of the same answer.

create or replace function public.ai_usage_stage_ms_ok(p jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p is null or (
    jsonb_typeof(p) = 'object'
    and (select count(*) from jsonb_each(p)) <= 16
    and not exists (
      select 1 from jsonb_each(p) e
       where jsonb_typeof(e.value) <> 'number' or e.key !~ '^[A-Za-z]{1,24}$'
    )
  )
$$;

alter table public.ai_usage add column if not exists stage_ms jsonb;

alter table public.ai_usage drop constraint if exists ai_usage_stage_ms_chk;
alter table public.ai_usage add constraint ai_usage_stage_ms_chk check (public.ai_usage_stage_ms_ok(stage_ms));

comment on column public.ai_usage.stage_ms is
  'v10.106.2: per-stage timings of one Pip answer in ms (numbers only, short keys). Never message text.';
