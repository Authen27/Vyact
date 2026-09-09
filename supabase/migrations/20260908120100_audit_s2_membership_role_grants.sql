-- ============================================================================
-- Audit S2 (2026-09-08) — constrain which roles a household admin may grant.
--
-- THE HOLE
-- The memberships INSERT policy checked the CALLER is owner/admin but never
-- constrained the ROLE being inserted — a household admin could insert a new
-- 'owner' membership. Hiding "owner" in a UI dropdown is not a boundary.
-- The UPDATE policy had the mirror-image gap: its USING clause stopped an
-- admin from touching an existing owner's row, but without a WITH CHECK an
-- admin could promote a member TO owner in one UPDATE.
--
-- THE RULE NOW (database-enforced)
--   • owners may insert/update rows to any role (including owner — that is
--     the ownership-transfer building block);
--   • admins may insert/update rows only to non-owner roles;
--   • everyone else: no grants (unchanged).
-- Owner-continuity (never demote/delete the last owner) is NOT enforced here —
-- that needs a dedicated transfer-ownership RPC and is tracked separately.
-- ============================================================================

BEGIN;

drop policy if exists "owners and admins add members" on memberships;
create policy "owners and admins add members" on memberships for insert with check (
  role_in(household_id) = 'owner'
  or (role_in(household_id) = 'admin' and role <> 'owner')
);

drop policy if exists "owners change roles; admins change non-owners" on memberships;
create policy "owners change roles; admins change non-owners" on memberships for update
  using (
    -- existing row: admins may not touch an owner's membership
    role_in(household_id) = 'owner' or (role_in(household_id) = 'admin' and role <> 'owner')
  )
  with check (
    -- new row: admins may not GRANT ownership either
    role_in(household_id) = 'owner' or (role_in(household_id) = 'admin' and role <> 'owner')
  );

COMMIT;
