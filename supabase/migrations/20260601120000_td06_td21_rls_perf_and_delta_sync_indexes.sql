-- TD-21 (RLS performance) + TD-06 (delta-sync indexes) — paired migration.
--
-- Two Supabase Performance Advisor finding-classes are addressed here, plus
-- the index prerequisite for the TD-06 client-side delta-sync redesign.
--
-- ─── TD-21a · auth_rls_initplan ──────────────────────────────────────────
--   Several baseline policies call `auth.uid()` directly in the USING /
--   WITH CHECK expression. Postgres treats that as a row-dependent function
--   reference and re-evaluates it for every candidate row instead of caching
--   it as an initplan. Wrapping it as `(select auth.uid())` lets the planner
--   recognise it as a constant for the query and reduces RLS overhead from
--   O(rows) to O(1).
--
-- ─── TD-21b · multiple_permissive_policies ───────────────────────────────
--   Every domain table (transactions / budgets / goals / debts / assets)
--   carries TWO permissive SELECT policies for `authenticated`:
--     - "<table>_read"                         (household membership check)
--     - "admins read all <table>"              (is_admin('roles'))
--   Postgres OR-merges permissive policies, but each is still planned and
--   evaluated. Consolidating into a single policy with an OR-ed predicate
--   removes one full RLS evaluation per row per query. Same pattern is
--   applied to `memberships`, `profiles`, `exchange_rates`, `subscriptions`,
--   and `activity_log` which all carry overlapping select policies.
--
--   The new SELECT policies use the existing SECURITY DEFINER helpers
--   (`is_member`, `is_admin`) which (a) already wrap `auth.uid()` cleanly,
--   (b) are STABLE so the planner can memoise them, and (c) bypass RLS on
--   the `memberships` lookup so the policy can't recurse. The old hand-
--   inlined `exists (...)` form re-introduced the unwrapped `auth.uid()`
--   problem on every row.
--
-- ─── TD-06 · delta-sync index prerequisite ───────────────────────────────
--   The consumer adapter is moving from "pull the whole table" to "pull
--   rows where `updated_at > cursor` ordered by `updated_at`". The
--   transactions table already has `txns_updated_idx (household_id,
--   updated_at)`; this migration adds the matching composite index to the
--   other four domain tables so the new query path is index-served on day
--   one.
--
-- Idempotency: every statement uses `drop policy if exists` and
-- `create index if not exists`. Safe to re-run.

BEGIN;

-- ── transactions ─────────────────────────────────────────────────────────
drop policy if exists "transactions_read"            on transactions;
drop policy if exists "admins read all transactions" on transactions;
create policy "transactions_read" on transactions for select to authenticated
  using (is_member(household_id) or is_admin('roles'));

-- ── budgets ──────────────────────────────────────────────────────────────
drop policy if exists "budgets_read"             on budgets;
drop policy if exists "admins read all budgets"  on budgets;
create policy "budgets_read" on budgets for select to authenticated
  using (is_member(household_id) or is_admin('roles'));

-- ── goals ────────────────────────────────────────────────────────────────
drop policy if exists "goals_read"               on goals;
drop policy if exists "admins read all goals"    on goals;
create policy "goals_read" on goals for select to authenticated
  using (is_member(household_id) or is_admin('roles'));

-- ── debts ────────────────────────────────────────────────────────────────
drop policy if exists "debts_read"               on debts;
drop policy if exists "admins read all debts"    on debts;
create policy "debts_read" on debts for select to authenticated
  using (is_member(household_id) or is_admin('roles'));

-- ── assets ───────────────────────────────────────────────────────────────
drop policy if exists "assets_read"              on assets;
drop policy if exists "admins read all assets"   on assets;
create policy "assets_read" on assets for select to authenticated
  using (is_member(household_id) or is_admin('roles'));

-- ── exchange_rates ───────────────────────────────────────────────────────
-- Replaces the inline `exists (... user_id = auth.uid())` membership check
-- with the cached helper. Single SELECT policy already; just the RLS-init
-- plan rewrite.
drop policy if exists "rates_read" on exchange_rates;
create policy "rates_read" on exchange_rates for select to authenticated
  using (is_member(household_id));

-- ── memberships ──────────────────────────────────────────────────────────
-- Overlapping SELECT pair → single consolidated policy.
drop policy if exists "members see other members"    on memberships;
drop policy if exists "admins read all memberships"  on memberships;
create policy "memberships_read" on memberships for select to authenticated
  using (is_member(household_id) or is_admin('roles'));

-- "members leave; owners remove non-owners" uses bare auth.uid() — wrap.
drop policy if exists "members leave; owners remove non-owners" on memberships;
create policy "members leave; owners remove non-owners" on memberships for delete to authenticated
  using (user_id = (select auth.uid())
         or role_in(household_id) = 'owner'
         or (role_in(household_id) = 'admin' and role <> 'owner'));

-- ── profiles ─────────────────────────────────────────────────────────────
-- Three overlapping SELECT policies + a self-update policy with bare
-- auth.uid(). Consolidate the reads; wrap the writer.
drop policy if exists "users read own profile"             on profiles;
drop policy if exists "users read profiles of co-members"  on profiles;
drop policy if exists "admins read all profiles"           on profiles;
create policy "profiles_read" on profiles for select to authenticated
  using (
    id = (select auth.uid())
    or is_admin('roles')
    or id in (
      select m2.user_id
      from memberships m1
      join memberships m2 on m1.household_id = m2.household_id
      where m1.user_id = (select auth.uid())
    )
  );

drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on profiles for update to authenticated
  using (id = (select auth.uid()));

-- ── households ───────────────────────────────────────────────────────────
-- "anyone create household" uses bare auth.uid() — wrap. The other
-- households policies use the cached helpers; leave them alone.
drop policy if exists "anyone create household" on households;
create policy "anyone create household" on households for insert to authenticated
  with check (created_by = (select auth.uid()));

-- ── activity_log ─────────────────────────────────────────────────────────
-- Overlapping SELECT pair + bare auth.uid() in the membership form.
drop policy if exists "log_read"                  on activity_log;
drop policy if exists "admins read all activity"  on activity_log;
create policy "activity_log_read" on activity_log for select to authenticated
  using (is_member(household_id) or is_admin('roles'));

-- ── admin_roles ──────────────────────────────────────────────────────────
drop policy if exists "self read admin_roles" on admin_roles;
create policy "self read admin_roles" on admin_roles for select to authenticated
  using (user_id = (select auth.uid()));

-- ── ai_usage ─────────────────────────────────────────────────────────────
drop policy if exists "ai_usage_insert" on ai_usage;
create policy "ai_usage_insert" on ai_usage for insert to authenticated
  with check (is_member(household_id) and user_id = (select auth.uid()));

-- ── content_favorites ────────────────────────────────────────────────────
drop policy if exists "self favorites delete" on content_favorites;
drop policy if exists "self favorites insert" on content_favorites;
drop policy if exists "self favorites read"   on content_favorites;
create policy "self favorites delete" on content_favorites for delete to authenticated
  using (user_id = (select auth.uid()));
create policy "self favorites insert" on content_favorites for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "self favorites read"   on content_favorites for select to authenticated
  using (user_id = (select auth.uid()));

-- ── subscriptions ────────────────────────────────────────────────────────
drop policy if exists "self read subscriptions" on subscriptions;
create policy "self read subscriptions" on subscriptions for select to authenticated
  using (user_id = (select auth.uid()) or is_admin('roles'));

-- ── invitations ──────────────────────────────────────────────────────────
-- "owners and admins send invitations" embeds bare auth.uid().
drop policy if exists "owners and admins send invitations" on invitations;
create policy "owners and admins send invitations" on invitations for insert to authenticated
  with check (role_in(household_id) in ('owner','admin') and invited_by = (select auth.uid()));

-- ── TD-06 · composite indexes for `updated_at > cursor` delta pulls ──────
create index if not exists budgets_household_updated_idx on budgets (household_id, updated_at);
create index if not exists goals_household_updated_idx   on goals   (household_id, updated_at);
create index if not exists debts_household_updated_idx   on debts   (household_id, updated_at);
create index if not exists assets_household_updated_idx  on assets  (household_id, updated_at);
-- transactions already has `txns_updated_idx (household_id, updated_at)`.

COMMIT;
