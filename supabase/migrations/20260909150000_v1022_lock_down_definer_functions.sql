-- ============================================================================
-- v10.22 — P4 security: stop `anon` reaching SECURITY DEFINER functions, and
-- pin the search_path on the six that lack one.
--
-- WHY THIS MATTERS
-- A SECURITY DEFINER function runs as its OWNER and bypasses RLS by design.
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and `anon`
-- inherits PUBLIC — so an explicit `grant ... to authenticated` does NOT take
-- the default away. Every one of the 19 functions below was reachable without
-- signing in, through `/rest/v1/rpc/<name>`.
--
-- They all fail internally on a null `auth.uid()` today, so this is not a live
-- breach. It is the same class as the two revokes already applied
-- (20260430092130 for the v4.1 RPCs, and the agent helper in
-- 20260816120000): defence that should not depend on every function
-- remembering to check. The names alone are an information leak —
-- `erase_household_data`, `transfer_ownership`, `admin_list_users` are
-- enumerable from an unauthenticated client.
--
-- VERIFIED SAFE BEFORE WRITING: every one of these requires a signed-in user
-- semantically. The only plausible pre-auth caller was the invite flow, and
-- `AcceptInvite.tsx` explicitly checks `getSession()` first and stashes the
-- token to prompt sign-in when there is none — so `anon` never calls
-- `accept_invitation_link`.
--
-- search_path: an unqualified name inside a SECURITY DEFINER function resolves
-- against the CALLER's search_path, so a caller who puts a same-named table or
-- operator earlier on the path can change what the function does while it runs
-- as the owner. Pinning it removes that.
--
-- MONEY MODEL: untouched. No table, no row, no amount.
-- ============================================================================

BEGIN;

-- ── 1. Revoke the default PUBLIC grant (which `anon` inherits) ──────────────
do $$
declare
  fn text;
  fns text[] := array[
    'public.accept_invitation(uuid)',
    'public.accept_invitation(text)',
    'public.accept_invitation_link(text)',
    'public.admin_ai_usage_summary()',
    'public.admin_dashboard_kpis()',
    'public.admin_list_users()',
    'public.admin_weekly_trend(integer)',
    'public.deactivate_my_account()',
    'public.erase_household_data(uuid)',
    'public.is_admin(text)',
    'public.is_split_participant(uuid)',
    'public.leave_household(uuid)',
    'public.my_email()',
    'public.owns_shared_split(uuid)',
    'public.reactivate_my_account()',
    'public.request_account_deletion()',
    'public.settle_share(uuid)',
    'public.transfer_ownership(uuid,uuid)',
    'public.upsert_budget(uuid,jsonb,text)',
    'public.upsert_budget_with_allocations(uuid,jsonb,jsonb,text)'
  ];
begin
  foreach fn in array fns loop
    -- to_regprocedure returns null rather than raising when a signature is
    -- absent, so a function retired later cannot break this migration.
    if to_regprocedure(fn) is not null then
      execute format('revoke all on function %s from public', fn);
      execute format('revoke all on function %s from anon',   fn);
      execute format('grant execute on function %s to authenticated', fn);
    end if;
  end loop;
end $$;

-- `service_role` keeps what it needs for the edge functions and admin paths.
do $$
declare fn text;
  fns text[] := array[
    'public.admin_ai_usage_summary()', 'public.admin_dashboard_kpis()',
    'public.admin_list_users()', 'public.admin_weekly_trend(integer)',
    'public.erase_household_data(uuid)', 'public.my_email()'
  ];
begin
  foreach fn in array fns loop
    if to_regprocedure(fn) is not null then
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;

-- ── 2. Pin search_path on the six app functions that lack one ──────────────
-- pg_trgm's own functions are extension-owned and deliberately left alone;
-- moving that extension out of `public` is a separate, riskier change because
-- existing gin_trgm_ops indexes resolve their opclass through the search path.
alter function public.accept_invitation(uuid)            set search_path = public, pg_temp;
alter function public.leave_household(uuid)              set search_path = public, pg_temp;
alter function public.transfer_ownership(uuid, uuid)     set search_path = public, pg_temp;
alter function public.touch_updated_at()                 set search_path = public, pg_temp;
alter function public.set_updated_at_accounts()          set search_path = public, pg_temp;
alter function public.set_updated_at_recurring()         set search_path = public, pg_temp;

COMMIT;

-- Verify (run manually):
--   select p.oid::regprocedure::text
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname='public' and p.prosecdef
--      and has_function_privilege('anon', p.oid, 'EXECUTE');
--   -- expect: zero rows.
