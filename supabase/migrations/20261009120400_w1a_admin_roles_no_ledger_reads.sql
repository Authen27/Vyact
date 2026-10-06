-- W1a (audit 2026-10-04, ADM-03 / D24) — platform admins no longer read household ledgers
-- row by row.
--
-- The domain-table SELECT policies were `is_member(household_id) or is_admin('roles')`, so a
-- 'roles' (or 'super') admin could select every family's transactions, accounts, debts,
-- assets, budgets, recurring bills and notifications. No admin page needs that: every admin
-- screen reads households / memberships / activity_log directly or calls a SECURITY DEFINER
-- RPC (admin_dashboard_kpis, admin_weekly_trend, admin_list_users, admin_ai_usage_summary,
-- admin_ai_feedback_summary), which RLS does not affect. Admin access is password-only by the
-- owner's decision (no 2FA), so the blast radius of one admin password matters.
--
-- Kept for now (admin pages read them): households, memberships, profiles, subscriptions,
-- activity_log. activity_log stores row images and is the next thing to narrow (ADM-04).

BEGIN;

-- Sweep: drop EVERY select-only policy on these tables that mentions is_admin, not just the
-- ones the migrations name. Production holds objects no migration creates (see
-- docs/DEVELOPER_INPUTS.md Q1), so a name list could leave a prod-only admin read in place.
-- Only SELECT policies are touched: a FOR ALL policy also carries members' writes.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('transactions', 'budgets', 'goals', 'debts', 'assets', 'accounts',
                         'recurring_schedules', 'budget_allocations', 'notifications', 'saved_views')
       and cmd = 'SELECT'
       and qual ilike '%is_admin%'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

drop policy if exists "transactions_read" on public.transactions;
create policy "transactions_read" on public.transactions for select to authenticated
  using (is_member(household_id));

drop policy if exists "budgets_read" on public.budgets;
create policy "budgets_read" on public.budgets for select to authenticated
  using (is_member(household_id));

drop policy if exists "goals_read" on public.goals;
create policy "goals_read" on public.goals for select to authenticated
  using (is_member(household_id));

drop policy if exists "debts_read" on public.debts;
create policy "debts_read" on public.debts for select to authenticated
  using (is_member(household_id));

drop policy if exists "assets_read" on public.assets;
create policy "assets_read" on public.assets for select to authenticated
  using (is_member(household_id));

drop policy if exists "accounts_read" on public.accounts;
create policy "accounts_read" on public.accounts for select to authenticated
  using (is_member(household_id));

drop policy if exists "recurring_read" on public.recurring_schedules;
create policy "recurring_read" on public.recurring_schedules for select to authenticated
  using (is_member(household_id));

drop policy if exists balloc_read on public.budget_allocations;
create policy balloc_read on public.budget_allocations for select to authenticated
  using (is_member(household_id));

drop policy if exists "notif_read" on public.notifications;
create policy "notif_read" on public.notifications for select to authenticated
  using (is_member(household_id));

drop policy if exists "saved_views_self" on public.saved_views;
create policy "saved_views_self" on public.saved_views for select to authenticated
  using (user_id = (select auth.uid()));

COMMIT;
