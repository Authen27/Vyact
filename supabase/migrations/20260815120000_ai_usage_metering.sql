-- ============================================================================
-- AI-P0 — ai_usage metering (the LLM-spend GATE).
--
-- `vyact-ask-vyact-engineering-spec.md` §8/§10 makes adoption + cost measurement
-- the PRECONDITION for authorising LLM spend ("Promote to the LLM track only when
-- v1 clears the §9 targets"). Today `ai_usage` records intent/sentiment/length
-- only — no model, no tokens, no cost, no latency — so the gate cannot be
-- evaluated. This adds exactly those signals.
--
-- Forward-only, additive, idempotent. Every column is nullable so existing
-- writers (react/src/lib/aiUsage.ts) keep working unchanged.
--
-- PRIVACY CONTRACT PRESERVED: still NO message content, NO merchant names, NO
-- descriptions. Only metadata about the call. (baseline comment: "ai_usage
-- (privacy-safe: no message content; only intent + sentiment + length)")
-- ============================================================================

-- ── Which engine actually answered (measures the deterministic fast-path rate,
--    the single biggest cost lever: every 'rules' row is an LLM call not made).
alter table public.ai_usage add column if not exists backend text;      -- 'rules' | 'llm'
alter table public.ai_usage add column if not exists tier text;         -- 't0' | 't1' | 't2'

-- ── Model identity (plug-n-play: which provider/model served this turn).
alter table public.ai_usage add column if not exists provider text;     -- 'openrouter' | 'groq' | 'vllm' | 'gemini' | …
alter table public.ai_usage add column if not exists model text;        -- e.g. 'llama-3.3-70b-instruct'

-- ── Volume + money.
alter table public.ai_usage add column if not exists prompt_tokens integer;
alter table public.ai_usage add column if not exists completion_tokens integer;
alter table public.ai_usage add column if not exists cost_usd numeric(12,6);

-- ── UX + reliability.
alter table public.ai_usage add column if not exists latency_ms integer;
alter table public.ai_usage add column if not exists outcome text;      -- see CHECK below
alter table public.ai_usage add column if not exists tool_calls integer;

-- ── §10 gate metrics that need explicit capture.
--    `helpful`   → the ≥75% interpret / ≥70% forecast thumbs-up targets.
--    `tap_depth` → the ≤2 median taps target (Chat.tsx already logs tap depth).
alter table public.ai_usage add column if not exists helpful boolean;
alter table public.ai_usage add column if not exists tap_depth integer;

-- Constrain the enum-ish columns (added separately so re-runs don't fail).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_usage_outcome_chk') then
    alter table public.ai_usage add constraint ai_usage_outcome_chk
      check (outcome is null or outcome in ('ok','error','blocked','fallback','clarify'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_usage_backend_chk') then
    alter table public.ai_usage add constraint ai_usage_backend_chk
      check (backend is null or backend in ('rules','llm'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ai_usage_tier_chk') then
    alter table public.ai_usage add constraint ai_usage_tier_chk
      check (tier is null or tier in ('t0','t1','t2'));
  end if;
end $$;

comment on column public.ai_usage.backend  is 'rules|llm — which engine answered; rules rows are LLM calls avoided';
comment on column public.ai_usage.cost_usd is 'Computed server-side from token counts x the model rate at call time; never trusted from a client';
comment on column public.ai_usage.helpful  is '§10 gate: thumbs up/down on the answer (null = not rated)';

-- ── Admin summary: extend with the spend-gate signals. Additive keys only —
--    admin/src/lib/adminApi.ts already defaults missing keys, so DB and app can
--    deploy in either order.
create or replace function public.admin_ai_usage_summary()
  returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare result jsonb;
begin
  if not public.is_admin('content') then
    raise exception 'forbidden: admin role required';
  end if;

  select jsonb_build_object(
    -- ── EXISTING KEYS — preserved byte-for-byte (Intelligence.tsx depends on
    --    these, incl. `segments`; dropping any would break the admin page).
    'total',     (select count(*) from ai_usage),
    'users',     (select count(distinct user_id) from ai_usage),
    'last7',     (select count(*) from ai_usage where ts > now() - interval '7 days'),
    'last30',    (select count(*) from ai_usage where ts > now() - interval '30 days'),
    'byIntent',  (select coalesce(jsonb_object_agg(intent, c), '{}'::jsonb)
                    from (select coalesce(intent,'other') as intent, count(*) c
                            from ai_usage group by 1) t),
    'bySentiment', (select coalesce(jsonb_object_agg(sentiment, c), '{}'::jsonb)
                    from (select coalesce(sentiment,'neutral') as sentiment, count(*) c
                            from ai_usage group by 1) t),
    'segments', (
      select coalesce(jsonb_agg(seg order by (seg->>'interactions')::int desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'userId',       u.user_id,
          'email',        au.email,
          'interactions', u.interactions,
          'topIntent',    u.top_intent,
          'avgSentiment', u.avg_sentiment,
          'lastSeen',     u.last_seen
        ) as seg
        from (
          select user_id,
                 count(*)                                   as interactions,
                 mode() within group (order by intent)      as top_intent,
                 round(avg(sentiment_score)::numeric, 2)    as avg_sentiment,
                 max(ts)                                    as last_seen
          from ai_usage
          where user_id is not null
          group by user_id
          order by count(*) desc
          limit 200
        ) u
        left join auth.users au on au.id = u.user_id
      ) s
    ),

    -- ── spend gate (new) ──────────────────────────────────────────────
    'byModel', (
      select coalesce(jsonb_object_agg(model, n), '{}'::jsonb)
      from (select coalesce(model,'n/a') as model, count(*) n
              from ai_usage where ts > now() - interval '30 days'
             group by 1 order by 2 desc limit 25) t),
    'byProvider', (
      select coalesce(jsonb_object_agg(provider, n), '{}'::jsonb)
      from (select coalesce(provider,'n/a') as provider, count(*) n
              from ai_usage where ts > now() - interval '30 days' group by 1) t),
    'byBackend', (
      select coalesce(jsonb_object_agg(backend, n), '{}'::jsonb)
      from (select coalesce(backend,'unknown') as backend, count(*) n
              from ai_usage where ts > now() - interval '30 days' group by 1) t),
    'tokens30', jsonb_build_object(
      'prompt',     coalesce((select sum(prompt_tokens)     from ai_usage where ts > now() - interval '30 days'), 0),
      'completion', coalesce((select sum(completion_tokens) from ai_usage where ts > now() - interval '30 days'), 0)),
    'cost30Usd',  coalesce((select round(sum(cost_usd), 4) from ai_usage where ts > now() - interval '30 days'), 0),
    'cost7Usd',   coalesce((select round(sum(cost_usd), 4) from ai_usage where ts > now() - interval '7 days'), 0),
    'latencyMsP50', (
      select coalesce(percentile_disc(0.5) within group (order by latency_ms), 0)
        from ai_usage where latency_ms is not null and ts > now() - interval '30 days'),
    'latencyMsP95', (
      select coalesce(percentile_disc(0.95) within group (order by latency_ms), 0)
        from ai_usage where latency_ms is not null and ts > now() - interval '30 days'),
    -- §10 targets: fallback rate < 15%, thumbs-up >= 75%, deterministic hit rate.
    'fallbackRate30', (
      select case when count(*) = 0 then 0
             else round(count(*) filter (where outcome = 'fallback')::numeric / count(*), 4) end
        from ai_usage where ts > now() - interval '30 days'),
    'errorRate30', (
      select case when count(*) = 0 then 0
             else round(count(*) filter (where outcome = 'error')::numeric / count(*), 4) end
        from ai_usage where ts > now() - interval '30 days'),
    'deterministicRate30', (
      select case when count(*) filter (where backend is not null) = 0 then 0
             else round(count(*) filter (where backend = 'rules')::numeric
                        / count(*) filter (where backend is not null), 4) end
        from ai_usage where ts > now() - interval '30 days'),
    'helpfulRate30', (
      select case when count(*) filter (where helpful is not null) = 0 then 0
             else round(count(*) filter (where helpful)::numeric
                        / count(*) filter (where helpful is not null), 4) end
        from ai_usage where ts > now() - interval '30 days'),
    'ratedCount30', (
      select count(*) from ai_usage where helpful is not null and ts > now() - interval '30 days')
  ) into result;

  return result;
end;
$$;

grant execute on function public.admin_ai_usage_summary() to authenticated, anon, service_role;
