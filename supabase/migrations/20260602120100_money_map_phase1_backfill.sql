-- Money Map · Phase 1 backfill — synthesise `accounts` rows from existing
-- `assets` and link `transactions.account_id` to the new rows.
--
-- Spec: docs/SOLUTION_MONEY_MAP.md → "Backfill (idempotent, runs once per
-- household)". Split out from the schema migration so it can be rerun
-- safely without re-touching DDL, and so the schema can ship to staging
-- without paying the backfill cost there.
--
-- Idempotency:
--   • The accounts INSERT is gated by NOT EXISTS on (household_id, asset_id).
--   • The transactions UPDATE only writes where `account_id IS NULL`.
--   • Run twice → identical row counts (acceptance gate #3 of v7.2).
--
-- Operational guidance for large tenants:
--   • Wrap each tenant in its own transaction by filtering on a single
--     `household_id` if the global form holds locks too long. The default
--     form below is fine up to ~1 M transaction rows.
--   • Run during the v7.2.0-rc 'shadow' window — the app is still reading
--     legacy `linked_asset_id` so any backfill correctness issue is
--     observable in dual-read assertions before flipping to 'on'.

BEGIN;

-- ─── 1. accounts derived from spendable / liquid asset rows ─────────────
--
-- Only the four asset types that map to a real spending surface get an
-- account synthesised. Investment / property / vehicle assets do NOT
-- become accounts here — they remain assets and join the accounts table
-- only when the user explicitly creates an "investment" account in the
-- v7.2 UI. (Per spec U-2: keeps the account list bounded.)

insert into accounts (household_id, asset_id, kind, name, currency, is_default)
select a.household_id,
       a.id,
       case a.type
         when 'checking'    then 'checking'
         when 'savings'     then 'savings'
         when 'credit_card' then 'credit_card'
         when 'cash'        then 'cash'
         else 'other'
       end                                                            as kind,
       a.name,
       a.currency,
       -- The largest-balance asset per (household, currency) wins
       -- the is_default flag; ties broken by created_at desc.
       (row_number() over (
          partition by a.household_id, a.currency
              order by a.value desc, a.created_at desc
        ) = 1)                                                        as is_default
  from assets a
 where a.type in ('checking','savings','credit_card','cash')
   and a.deleted_at is null
   and not exists (
     select 1 from accounts ac
      where ac.household_id = a.household_id
        and ac.asset_id     = a.id
   );

-- ─── 2. link existing transactions to the new account rows ──────────────
--
-- Reads `extras->>'linkedAssetId'` (the v7.0.3 client-side key) and
-- `extras->>'linkedToAssetId'` (added in v7.0.3 for transfer / investment
-- destinations). Resolves both to the matching account_id.

update transactions t
   set account_id = ac.id
  from accounts ac
 where ac.household_id = t.household_id
   and ac.asset_id     = nullif(t.extras->>'linkedAssetId', '')::uuid
   and t.account_id is null;

update transactions t
   set to_account_id = ac.id
  from accounts ac
 where ac.household_id = t.household_id
   and ac.asset_id     = nullif(t.extras->>'linkedToAssetId', '')::uuid
   and t.to_account_id is null;

-- `member_id` already exists on transactions for the v7.0 work; copy it
-- across to `initiated_by` so the new aggregate views see historical rows.
update transactions
   set initiated_by = member_id
 where initiated_by is null
   and member_id    is not null;

-- ─── 3. debts direction default ────────────────────────────────────────
-- Schema default is 'owed_by_me' (the existing semantic) so no UPDATE is
-- needed. Counterparty_name is left null; users fill it in only when
-- they create a new lending row in v7.2 UI.

COMMIT;
