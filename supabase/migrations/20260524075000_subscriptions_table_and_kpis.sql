-- TD-04-ext-a: Subscriptions table + admin KPI wiring
-- Adds `subscriptions` table used by admin UI and the `paidSubscriptions`/`mrr` KPI.

BEGIN;

-- 1) Subscriptions table
create table if not exists subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade,
  household_id      uuid references households(id) on delete set null,
  tier              text not null check (tier in ('free','family','premium','enterprise')),
  status            text not null check (status in ('active','past_due','canceled','trialing')),
  monthly_amount    numeric(15,2) not null default 0,
  currency          text not null default 'USD',
  stripe_subscription_id text,
  started_at        timestamptz not null default now(),
  renews_at         timestamptz,
  failure_count     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);
create index if not exists subscriptions_user_idx on subscriptions(user_id);
create index if not exists subscriptions_household_idx on subscriptions(household_id);
create index if not exists subscriptions_status_idx on subscriptions(status);

-- 2) touch_updated trigger for subscriptions
-- reuse the generic set_updated_at() trigger function defined in schema.sql
drop trigger if exists touch_subscriptions on subscriptions;
create trigger touch_subscriptions before update on subscriptions for each row execute function set_updated_at();

-- 3) Row-level security and policies
alter table subscriptions enable row level security;

drop policy if exists "subscriptions_read" on subscriptions;
drop policy if exists "subscriptions_insert" on subscriptions;
drop policy if exists "subscriptions_update" on subscriptions;
drop policy if exists "subscriptions_delete" on subscriptions;

create policy "subscriptions_read" on subscriptions for select using (
  user_id = auth.uid() or is_admin()
);
create policy "subscriptions_insert" on subscriptions for insert with check (
  (user_id = auth.uid()) or is_admin()
);
create policy "subscriptions_update" on subscriptions for update using (
  (user_id = auth.uid()) or is_admin()
) with check (
  (user_id = auth.uid()) or is_admin()
);
create policy "subscriptions_delete" on subscriptions for delete using (
  is_admin()
);

-- 4) Audit trigger: log domain activity for subscriptions
-- If the audit trigger function exists (TD-08), attach it; otherwise skip.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_domain_activity') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_subscriptions_trigger') THEN
      CREATE TRIGGER activity_subscriptions_trigger
        AFTER INSERT OR UPDATE OR DELETE ON subscriptions
        FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
    END IF;
  END IF;
END$$;

-- 5) Update admin_dashboard_kpis() to include subscription counts and MRR
-- Create-or-replace the function so environments can be migrated in a single
-- replayable migration.
create or replace function admin_dashboard_kpis()
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
    raise exception 'admin_dashboard_kpis: caller is not an admin'
      using errcode = '42501';   -- insufficient_privilege
  end if;

  return jsonb_build_object(
    'totalUsers',        (select count(*) from public.profiles),
    'totalHouseholds',   (select count(*) from public.households),
    'multiMemberPct',    (
      select coalesce(
        round(100.0 * count(*) filter (where mc > 1) / nullif(count(*), 0), 1),
        0
      )
      from (
        select household_id, count(*) as mc
        from public.memberships
        group by household_id
      ) hh
    ),
    'activeUsers7d',     (
      select count(distinct created_by)
      from public.transactions
      where deleted_at is null
        and created_at >= now() - interval '7 days'
        and created_by is not null
    ),
    'activeHouseholds7d',(
      select count(distinct household_id)
      from public.transactions
      where deleted_at is null
        and created_at >= now() - interval '7 days'
    ),

    'signups7d',         (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
    'signups30d',        (select count(*) from public.profiles where created_at >= now() - interval '30 days'),

    'totalTransactions', (select count(*) from public.transactions where deleted_at is null),
    'transactions7d',    (
      select count(*) from public.transactions
      where deleted_at is null
        and created_at >= now() - interval '7 days'
    ),

    'publishedArticles', 0,
    'contentFavorites',  0,

    -- Subscriptions KPIs (now backed by public.subscriptions)
    'paidSubscriptions', (
      select count(*) from public.subscriptions
      where deleted_at is null
        and status = 'active'
        and tier <> 'free'
    ),
    'mrr', (
      select coalesce(sum(monthly_amount), 0) from public.subscriptions
      where deleted_at is null
        and status = 'active'
        and tier <> 'free'
    ),

    'computedAt',        now()
  );
end;
$$;

-- Ensure the function is callable by authenticated users (the function itself
-- enforces admin privileges inside its body).
grant execute on function admin_dashboard_kpis() to authenticated;

COMMIT;
