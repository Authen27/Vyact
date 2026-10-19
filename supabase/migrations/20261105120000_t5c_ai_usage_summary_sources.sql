-- T5c (v10.122.0; audit FE-PIP-09; owner, 19 Oct 2026: "timed turns only; admin counts read only the
-- server's rows").
--
-- ai_usage holds two kinds of row (`source`, since W1c 20261011120100):
--   • 'gateway' — one per MODEL CALL, written by the server (ask-vyact, WhatsApp): provider, model,
--     tokens, cost, the call's latency and outcome. A Pip turn makes one or two (classify, phrase).
--   • 'client'  — one per TURN, written by the app: intent, sentiment, length, the turn's outcome and its
--     per-stage timings. Since v10.122.0 only for a turn that called the model.
-- admin_ai_usage_summary() counted both together, so every call figure ran two to three times over and
-- the cost, token and latency figures mixed in rows that carry none. It now reads:
--   • call figures (total, users, last 7 / 30 days, by model / provider, tokens, cost, latency, error
--     rate) from the gateway's rows;
--   • turn figures (by intent / sentiment, user segments, by backend, fallback / deterministic /
--     helpful rates) from the app's rows.
-- Same keys, same shape: the admin Intelligence page (admin v1.4.7) relabels the call counts. Grants are
-- untouched (create or replace keeps them; v10.22 locked the function to admins).

create or replace function public.admin_ai_usage_summary()
  returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare result jsonb;
begin
  if not public.is_admin('content') then
    raise exception 'forbidden: admin role required';
  end if;

  with calls as (select * from ai_usage where source = 'gateway'),
       turns as (select * from ai_usage where source = 'client')
  select jsonb_build_object(
    -- ── Model calls (the gateway's rows) ─────────────────────────────────────
    'total',     (select count(*) from calls),
    'users',     (select count(distinct user_id) from calls),
    'last7',     (select count(*) from calls where ts > now() - interval '7 days'),
    'last30',    (select count(*) from calls where ts > now() - interval '30 days'),

    -- ── Turns (the app's rows: what was asked, how it felt) ─────────────────
    'byIntent',  (select coalesce(jsonb_object_agg(intent, c), '{}'::jsonb)
                    from (select coalesce(intent,'other') as intent, count(*) c
                            from turns group by 1) t),
    'bySentiment', (select coalesce(jsonb_object_agg(sentiment, c), '{}'::jsonb)
                    from (select coalesce(sentiment,'neutral') as sentiment, count(*) c
                            from turns group by 1) t),
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
          from turns
          where user_id is not null
          group by user_id
          order by count(*) desc
          limit 200
        ) u
        left join auth.users au on au.id = u.user_id
      ) s
    ),

    -- ── The spend gate (model calls) ─────────────────────────────────────────
    'byModel', (
      select coalesce(jsonb_object_agg(model, n), '{}'::jsonb)
      from (select coalesce(model,'n/a') as model, count(*) n
              from calls where ts > now() - interval '30 days'
             group by 1 order by 2 desc limit 25) t),
    'byProvider', (
      select coalesce(jsonb_object_agg(provider, n), '{}'::jsonb)
      from (select coalesce(provider,'n/a') as provider, count(*) n
              from calls where ts > now() - interval '30 days' group by 1) t),
    'byBackend', (
      select coalesce(jsonb_object_agg(backend, n), '{}'::jsonb)
      from (select coalesce(backend,'unknown') as backend, count(*) n
              from turns where ts > now() - interval '30 days' group by 1) t),
    'tokens30', jsonb_build_object(
      'prompt',     coalesce((select sum(prompt_tokens)     from calls where ts > now() - interval '30 days'), 0),
      'completion', coalesce((select sum(completion_tokens) from calls where ts > now() - interval '30 days'), 0)),
    'cost30Usd',  coalesce((select round(sum(cost_usd), 4) from calls where ts > now() - interval '30 days'), 0),
    'cost7Usd',   coalesce((select round(sum(cost_usd), 4) from calls where ts > now() - interval '7 days'), 0),
    'latencyMsP50', (
      select coalesce(percentile_disc(0.5) within group (order by latency_ms), 0)
        from calls where latency_ms is not null and ts > now() - interval '30 days'),
    'latencyMsP95', (
      select coalesce(percentile_disc(0.95) within group (order by latency_ms), 0)
        from calls where latency_ms is not null and ts > now() - interval '30 days'),
    -- §10 targets: fallback rate < 15% (a turn's), thumbs-up >= 75% (a turn's), errors (a call's).
    'fallbackRate30', (
      select case when count(*) = 0 then 0
             else round(count(*) filter (where outcome = 'fallback')::numeric / count(*), 4) end
        from turns where ts > now() - interval '30 days'),
    'errorRate30', (
      select case when count(*) = 0 then 0
             else round(count(*) filter (where outcome = 'error')::numeric / count(*), 4) end
        from calls where ts > now() - interval '30 days'),
    'deterministicRate30', (
      select case when count(*) filter (where backend is not null) = 0 then 0
             else round(count(*) filter (where backend = 'rules')::numeric
                        / count(*) filter (where backend is not null), 4) end
        from turns where ts > now() - interval '30 days'),
    'helpfulRate30', (
      select case when count(*) filter (where helpful is not null) = 0 then 0
             else round(count(*) filter (where helpful)::numeric
                        / count(*) filter (where helpful is not null), 4) end
        from turns where ts > now() - interval '30 days'),
    'ratedCount30', (
      select count(*) from turns where helpful is not null and ts > now() - interval '30 days')
  ) into result;

  return result;
end;
$$;

comment on function public.admin_ai_usage_summary() is
  'T5c (v10.122.0, FE-PIP-09): call figures (total, users, last7/30, model, provider, tokens, cost, latency, error rate) from source = gateway rows (one per model call); turn figures (intent, sentiment, segments, backend, fallback, deterministic, helpful) from source = client rows (one per turn that called the model). Admins only.';
