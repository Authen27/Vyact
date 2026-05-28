-- Admin-side RPCs for subscription / content lifecycle management.
--
-- Review note (lead, PR #13): the dev who delivered this batch wrote a
-- different RPC set than the one the prompt named — the prompt requested
-- `admin_list_users` / `admin_weekly_trend` / `admin_ai_usage_summary`
-- which plug into the existing admin/src/lib/adminApi.ts fetchers. What
-- landed here is a useful but unrelated set of mutation RPCs:
-- `admin_list_subscriptions`, `admin_cancel_subscription`,
-- `admin_get_mrr_by_currency`, `admin_publish_content_item`,
-- `admin_unpublish_content_item`. Accepted because the work is
-- functionally valuable, but the originally-requested 3 read RPCs
-- remain UNADDRESSED and are re-queued on the lead's workstream.
--
-- Functions are SECURITY DEFINER and validate admin membership via
-- `public.admin_roles`.

BEGIN;

-- List subscriptions (optionally only active)
create or replace function admin_list_subscriptions(active_only boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.admin_roles where user_id = uid) then
    raise exception 'admin_list_subscriptions: caller is not an admin' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
    from (
      select id, user_id, household_id, tier, status, monthly_amount, currency,
             stripe_subscription_id, started_at, renews_at, failure_count, created_at, updated_at
      from public.subscriptions
      where (not active_only) or (status = 'active')
      order by created_at desc
    ) s
  );
end;
$$;

-- Cancel subscription (admin action)
create or replace function admin_cancel_subscription(sub_id uuid, reason text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  updated_row jsonb;
begin
  if uid is null or not exists (select 1 from public.admin_roles where user_id = uid) then
    raise exception 'admin_cancel_subscription: caller is not an admin' using errcode='42501';
  end if;

  update public.subscriptions
  set status = 'canceled', updated_at = now(), deleted_at = now()
  where id = sub_id
  returning to_jsonb(public.subscriptions.*) into updated_row;

  if updated_row is null then
    return jsonb_build_object('ok', false, 'message', 'subscription_not_found');
  end if;

  return jsonb_build_object('ok', true, 'subscription', updated_row);
end;
$$;

-- MRR grouped by currency
create or replace function admin_get_mrr_by_currency()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not exists (select 1 from public.admin_roles where user_id = uid) then
    raise exception 'admin_get_mrr_by_currency: caller is not an admin' using errcode='42501';
  end if;

  return (
    select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb)
    from (
      select currency, coalesce(sum(monthly_amount),0) as total
      from public.subscriptions
      where deleted_at is null and status = 'active' and tier <> 'free'
      group by currency
    ) t
  );
end;
$$;

-- Publish a content item (admin action)
create or replace function admin_publish_content_item(content_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  updated_row jsonb;
begin
  if uid is null or not exists (select 1 from public.admin_roles where user_id = uid) then
    raise exception 'admin_publish_content_item: caller is not an admin' using errcode='42501';
  end if;

  update public.content_items
  set status = 'published', published_at = coalesce(published_at, now()), updated_at = now()
  where id = content_id
  returning to_jsonb(public.content_items.*) into updated_row;

  if updated_row is null then
    return jsonb_build_object('ok', false, 'message', 'content_not_found');
  end if;

  return jsonb_build_object('ok', true, 'content', updated_row);
end;
$$;

-- Unpublish content item (admin action)
create or replace function admin_unpublish_content_item(content_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  updated_row jsonb;
begin
  if uid is null or not exists (select 1 from public.admin_roles where user_id = uid) then
    raise exception 'admin_unpublish_content_item: caller is not an admin' using errcode='42501';
  end if;

  update public.content_items
  set status = 'draft', updated_at = now()
  where id = content_id
  returning to_jsonb(public.content_items.*) into updated_row;

  if updated_row is null then
    return jsonb_build_object('ok', false, 'message', 'content_not_found');
  end if;

  return jsonb_build_object('ok', true, 'content', updated_row);
end;
$$;

-- Expose to authenticated callers (function bodies enforce admin membership)
grant execute on function admin_list_subscriptions(boolean) to authenticated;
grant execute on function admin_cancel_subscription(uuid, text) to authenticated;
grant execute on function admin_get_mrr_by_currency() to authenticated;
grant execute on function admin_publish_content_item(uuid) to authenticated;
grant execute on function admin_unpublish_content_item(uuid) to authenticated;

COMMIT;
