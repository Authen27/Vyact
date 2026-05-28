-- TD-04-ext-b: Content items + favorites tables + admin KPI wiring
-- Adds `content_items` and `content_favorites` for the help/content module,
-- enables RLS, attaches audit triggers (if present), and updates
-- `admin_dashboard_kpis()` to compute `publishedArticles` and `contentFavorites`.

BEGIN;

-- 1) Content items
create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  slug text not null,
  body text,
  status text not null check (status in ('draft','published','archived')) default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists content_items_slug_idx on content_items(slug);
create index if not exists content_items_status_idx on content_items(status);
create index if not exists content_items_author_idx on content_items(author_id);

-- 2) Content favorites (user -> content)
create table if not exists content_favorites (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references content_items(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint content_favorites_unique unique (content_id, user_id)
);
create index if not exists content_favorites_user_idx on content_favorites(user_id);
create index if not exists content_favorites_content_idx on content_favorites(content_id);

-- 3) touch_updated triggers
drop trigger if exists touch_content_items on content_items;
create trigger touch_content_items before update on content_items for each row execute function set_updated_at();

drop trigger if exists touch_content_favorites on content_favorites;
create trigger touch_content_favorites before update on content_favorites for each row execute function set_updated_at();

-- 4) Row level security and policies
alter table content_items enable row level security;
alter table content_favorites enable row level security;

-- content_items policies
drop policy if exists "content_items_read" on content_items;
drop policy if exists "content_items_insert" on content_items;
drop policy if exists "content_items_update" on content_items;
drop policy if exists "content_items_delete" on content_items;

create policy "content_items_read" on content_items for select using (
  status = 'published' or author_id = auth.uid() or is_admin()
);
create policy "content_items_insert" on content_items for insert with check (
  (author_id = auth.uid()) or is_admin()
);
create policy "content_items_update" on content_items for update using (
  (author_id = auth.uid()) or is_admin()
) with check (
  (author_id = auth.uid()) or is_admin()
);
create policy "content_items_delete" on content_items for delete using (
  is_admin()
);

-- content_favorites policies
drop policy if exists "content_favorites_read" on content_favorites;
drop policy if exists "content_favorites_insert" on content_favorites;
drop policy if exists "content_favorites_delete" on content_favorites;

create policy "content_favorites_read" on content_favorites for select using (
  user_id = auth.uid() or is_admin()
);
create policy "content_favorites_insert" on content_favorites for insert with check (
  user_id = auth.uid() or is_admin()
);
create policy "content_favorites_delete" on content_favorites for delete using (
  user_id = auth.uid() or is_admin()
);

-- 5) Audit triggers: attach if `log_domain_activity()` exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_domain_activity') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_content_items_trigger') THEN
      CREATE TRIGGER activity_content_items_trigger
        AFTER INSERT OR UPDATE OR DELETE ON content_items
        FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'activity_content_favorites_trigger') THEN
      CREATE TRIGGER activity_content_favorites_trigger
        AFTER INSERT OR UPDATE OR DELETE ON content_favorites
        FOR EACH ROW EXECUTE FUNCTION public.log_domain_activity();
    END IF;
  END IF;
END$$;

-- 6) Update admin_dashboard_kpis() to include content metrics
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
      using errcode = '42501';
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

    -- Content KPIs
    'publishedArticles', (
      select count(*) from public.content_items
      where deleted_at is null
        and status = 'published'
    ),
    'contentFavorites',  (
      select count(*) from public.content_favorites
      where deleted_at is null
    ),

    -- Subscriptions KPIs (if present)
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

grant execute on function admin_dashboard_kpis() to authenticated;

COMMIT;
