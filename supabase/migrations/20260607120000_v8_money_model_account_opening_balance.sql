-- Money-Model Epic 1 (B1.2) — opening balance + provenance on accounts.
--
-- Additive only; safe to apply ahead of the feature flag (no behaviour change
-- until FEATURES.moneyModel.openingBalance is on). Current balance is derived in
-- the app as opening_balance + credits − debits. Provenance reuses the v8 pattern:
-- existing accounts are real data → default 'confirmed' / 'user' (never re-tagged
-- as estimate); onboarding-seeded accounts set 'estimated' until reconciled (B1.3).

BEGIN;

alter table accounts
  add column if not exists opening_balance numeric not null default 0,
  add column if not exists confidence  text not null default 'confirmed',
  add column if not exists source      text not null default 'user',
  add column if not exists estimated_at timestamptz,
  add column if not exists confirmed_at timestamptz;

alter table accounts drop constraint if exists accounts_confidence_chk;
alter table accounts add  constraint accounts_confidence_chk
  check (confidence in ('estimated','confirming','confirmed'));
alter table accounts drop constraint if exists accounts_source_chk;
alter table accounts add  constraint accounts_source_chk
  check (source in ('onboarding','user','bank'));

comment on column accounts.opening_balance is
  'Money-Model B1.2 — opening balance; current balance = opening + credits − debits.';

COMMIT;
