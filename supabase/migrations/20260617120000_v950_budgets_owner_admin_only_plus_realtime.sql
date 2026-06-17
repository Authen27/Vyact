-- ============================================================================
-- Vyact v9.5.0 — Budget management restricted to owner+admin + near-real-time sync
--
-- Product change: only the household OWNER or ADMIN may create/edit/delete
-- budgets; members are view-only. Budget changes propagate near-real-time via
-- Supabase Realtime (a budgets-only accelerator layered on the existing
-- refresh-based sync — if the socket drops, budgets degrade to refresh, no
-- regression).
--
-- Three enforcement layers (DB is the boundary; the client is UX):
--   1. upsert_budget RPC — add an owner/admin guard. The RPC is SECURITY DEFINER
--      so it bypasses RLS; it needs its own check. role_in() reads auth.uid()
--      from the JWT (SECURITY DEFINER does NOT change that), so it returns the
--      CALLER's household role.
--   2. RLS write policies on budgets + budget_allocations → owner/admin only
--      (reads unchanged: is_member). NOTE: budget_allocations had a permissive
--      `balloc_household` ALL policy granting writes to any member — it OR'd
--      with the per-command policies and had to be DROPPED, else tightening the
--      writes would have done nothing.
--   3. Realtime: publish budgets + budget_allocations (RLS still authorizes each
--      subscriber, so a member receives change events only for households they read).
--
-- Forward-only, idempotent. Applied to prod 2026-06-17. get_advisors: no new findings.
-- (Deferred follow-up: fold setBudgetAllocations into upsert_budget for an atomic
--  budget+allocations write — see TECH_DEBT / SYNC_FIXPLAN.)
-- ============================================================================
begin;

-- 1) upsert_budget guard — see the canonical body in
--    20260614140000_v933_upsert_budget_identity_authority.sql; this adds, right
--    after the is_member() check:
--      if role_in(h) not in ('owner','admin') then
--        raise exception 'Only the household owner or admin can manage budgets'
--          using errcode = '42501';
--      end if;
--    (Applied to prod via CREATE OR REPLACE with the full body.)

-- 2) RLS — owner/admin writes (reads unchanged)
alter policy budgets_insert on public.budgets with check (role_in(household_id) = any (array['owner','admin']));
alter policy budgets_update on public.budgets using (role_in(household_id) = any (array['owner','admin'])) with check (role_in(household_id) = any (array['owner','admin']));
alter policy budgets_delete on public.budgets using (role_in(household_id) = any (array['owner','admin']));

drop policy if exists balloc_household on public.budget_allocations;  -- permissive ALL catch-all — must go
alter policy balloc_insert on public.budget_allocations with check (role_in(household_id) = any (array['owner','admin']));
alter policy balloc_update on public.budget_allocations using (role_in(household_id) = any (array['owner','admin'])) with check (role_in(household_id) = any (array['owner','admin']));
alter policy balloc_delete on public.budget_allocations using (role_in(household_id) = any (array['owner','admin']));

-- 3) Near-real-time — publish for Supabase Realtime (RLS authorizes per subscriber)
alter publication supabase_realtime add table public.budgets;
alter publication supabase_realtime add table public.budget_allocations;

commit;
