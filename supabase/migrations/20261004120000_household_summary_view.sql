-- household_summary view — codify production drift into the repo.
--
-- This view already exists in production (created outside the migration chain)
-- and was recreated manually in vyact-test for parity. This migration makes it
-- reproducible on any fresh database. It is idempotent: CREATE OR REPLACE with
-- the identical definition is a no-op where the view already exists.
--
-- security_invoker = true is REQUIRED: the view must respect the caller's RLS,
-- so each user only ever sees aggregates for households they belong to.

create or replace view public.household_summary
  with (security_invoker = true) as
select
  h.id as household_id,
  (select count(*) from public.memberships m where m.household_id = h.id) as member_count,
  (select count(*) from public.transactions t where t.household_id = h.id and t.deleted_at is null) as txn_count,
  (select count(*) from public.debts d where d.household_id = h.id and d.deleted_at is null) as debt_count,
  (select coalesce(sum(d.current_balance), 0::numeric) from public.debts d where d.household_id = h.id and d.deleted_at is null) as total_debt_native,
  (select count(*) from public.assets a where a.household_id = h.id and a.deleted_at is null) as asset_count,
  (select coalesce(sum(a.value), 0::numeric) from public.assets a where a.household_id = h.id and a.deleted_at is null) as total_assets_native
from public.households h;

comment on view public.household_summary is
  'Per-household aggregates (members, transactions, debts, assets). security_invoker: honours caller RLS.';
