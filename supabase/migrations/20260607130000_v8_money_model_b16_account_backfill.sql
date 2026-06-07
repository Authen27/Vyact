-- Money-Model B1.6 — account backfill (A2: every transaction has a funding source).
--
-- Idempotent and amount-invariant (only sets the funding source, never amounts;
-- global net unchanged). Verified via a read-only dry-run (R2) before apply:
--   orphans_after = 0, txns_repaired = 1, cash_accounts created = 2,
--   global_net 193592.90 before == after.
--
-- In-model representation: the app keys account membership off the encoded
-- `extras.paymentMethod` string ('cash' / 'asset:<id>' / 'debt:<id>' / legacy
-- key), which lib/accountBalance.ts reads. Full uuid-FK normalization of
-- transactions.account_id is a separate Money-Map-completion task, intentionally
-- not done here. `is_default` is set only when no default exists for the
-- (household, currency) pair, respecting the accounts_default_per_currency index.

BEGIN;

-- 1) System Cash account per household with transactions but no cash account.
insert into accounts (household_id, kind, name, currency, is_default, opening_balance, confidence, source)
select
  h.id, 'cash', 'Cash', coalesce(h.base_currency,'USD'),
  not exists (
    select 1 from accounts a2
    where a2.household_id = h.id
      and a2.currency = coalesce(h.base_currency,'USD')
      and a2.is_default and a2.deleted_at is null
  ),
  0, 'confirmed', 'user'
from households h
where exists (select 1 from transactions t where t.household_id = h.id and t.deleted_at is null)
  and not exists (select 1 from accounts a where a.household_id = h.id and a.kind = 'cash' and a.deleted_at is null);

-- 2) Repair accountless transactions → the system Cash funding source.
update transactions
set extras = jsonb_set(coalesce(extras, '{}'::jsonb), '{paymentMethod}', '"cash"', true)
where deleted_at is null
  and (extras->>'paymentMethod') is null;

COMMIT;
