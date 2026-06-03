-- SECURITY FIX (post-v7.4.0 advisor) — Money Map aggregate views must respect RLS.
--
-- `v_txn_by_member` and `v_txn_by_account` (added in
-- 20260602120000_money_map_phase1_accounts.sql) were created WITHOUT
-- `security_invoker`, so in Postgres they ran with the view owner's
-- privileges and BYPASSED row-level security. Their bodies select from
-- `transactions` with no household filter, so any authenticated user could
-- query `/rest/v1/v_txn_by_member` / `/rest/v1/v_txn_by_account` and read
-- transaction aggregates across EVERY household — a cross-tenant data leak.
-- (Flagged ERROR `security_definer_view` 0010 by the Supabase advisor.)
--
-- Setting `security_invoker = on` makes each view run with the querying
-- user's privileges, so the existing `transactions` RLS
-- (`is_member(household_id)`) scopes results to the caller's own households.
-- This is also the behaviour the Reports breakouts already assume.

alter view public.v_txn_by_member  set (security_invoker = on);
alter view public.v_txn_by_account set (security_invoker = on);
