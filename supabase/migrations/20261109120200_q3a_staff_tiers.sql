-- Q3a (v10.130.0; audit ADM-05, ADM-06, ADM-14; owner decisions 20 Oct 2026). Staff see what their tier is for.
--
-- ADM-05: the needs/wants table (category_classifications) overrides the app's NEEDS_WANTS_MAP for every
--   household (the emergency floor, Pip's essentials, the runway). A content-tier admin could rewrite it. Only
--   super admins write it now, and a category must at least look like one of the app's ids (a lowercase id;
--   the list itself lives in constants.ts and the two Deno allowlists, never a fourth copy here).
-- ADM-06: content-tier admins saw every Pip user's email and per-person sentiment (the AI usage summary's
--   segments) and could read the whole ai_usage table. Segments are for super admins; ai_usage is read by its
--   own household's members, and staff read the summaries.
-- ADM-14: the dashboard's MRR summed every active row across currencies (INR 999 + USD 12 = "USD 1,011").
--   It is now per currency, counting active and trialing subscriptions; the summed figure is gone.

-- ── ADM-05 ─────────────────────────────────────────────────────────────────────────────────────────────────────
drop policy if exists cc_admin_write on public.category_classifications;
create policy cc_admin_write on public.category_classifications for all to authenticated
  using (public.is_admin('super')) with check (public.is_admin('super'));
alter table public.category_classifications drop constraint if exists ck_cc_category_id;
alter table public.category_classifications
  add constraint ck_cc_category_id check (category ~ '^[a-z][a-z0-9_]{0,39}$') not valid;

-- ── ADM-06 ─────────────────────────────────────────────────────────────────────────────────────────────────────
drop policy if exists ai_usage_select on public.ai_usage;
create policy ai_usage_select on public.ai_usage for select to authenticated using (public.is_member(household_id));

CREATE OR REPLACE FUNCTION public.admin_ai_usage_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- Q3a (ADM-06): who asked what, by email, is for super admins only.
    'segments', case when not public.is_admin('super') then '[]'::jsonb else (
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
    ) end,

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
$function$;

-- ── ADM-14 ─────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_dashboard_kpis()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  total_users int; total_households int; multi_member_pct numeric;
  active_7d int; active_households_7d int; signups_7d int; signups_30d int;
  total_txns int; txns_7d int; published_articles int; total_favorites int;
  paid_subscriptions int; mrr_by_currency jsonb;
begin
  if not public.is_admin('roles') then raise exception 'forbidden'; end if;
  select count(*) into total_users      from auth.users;
  select count(*) into total_households from households;
  select count(*) into total_txns       from transactions;
  select count(*) into signups_7d  from auth.users where created_at > now() - interval '7 days';
  select count(*) into signups_30d from auth.users where created_at > now() - interval '30 days';
  select count(distinct m.user_id) into active_7d from memberships m
    join auth.users u on u.id = m.user_id where u.last_sign_in_at > now() - interval '7 days';
  select count(distinct t.household_id) into active_households_7d from transactions t
    where t.created_at > now() - interval '7 days';
  select case when total_households > 0
    then round(100.0 * count(*) filter (where member_count >= 2) / total_households, 1) else 0 end
    into multi_member_pct
    from (select household_id, count(*) as member_count from memberships group by household_id) t;
  select count(*) into txns_7d from transactions where created_at > now() - interval '7 days';
  select count(*) into published_articles from content_items where status = 'published';
  select count(*) into total_favorites    from content_favorites;
  -- Q3a (ADM-14): paying = active or trialing; revenue per currency, never summed across currencies.
  select count(*) into paid_subscriptions from subscriptions
   where tier <> 'free' and status in ('active', 'trialing');
  select coalesce(jsonb_object_agg(cur, amount), '{}'::jsonb) into mrr_by_currency
    from (select upper(coalesce(nullif(btrim(currency), ''), '?')) as cur, sum(monthly_amount) as amount
            from subscriptions where tier <> 'free' and status in ('active', 'trialing') group by 1) m;
  return jsonb_build_object(
    'totalUsers', total_users, 'totalHouseholds', total_households,
    'multiMemberPct', multi_member_pct, 'activeUsers7d', active_7d,
    'activeHouseholds7d', active_households_7d, 'signups7d', signups_7d,
    'signups30d', signups_30d, 'totalTransactions', total_txns,
    'transactions7d', txns_7d, 'publishedArticles', published_articles,
    'contentFavorites', total_favorites, 'paidSubscriptions', paid_subscriptions,
    'mrrByCurrency', mrr_by_currency, 'computedAt', now());
end; $function$;
