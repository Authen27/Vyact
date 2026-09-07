-- v10.20 · Agent provenance — widen the provenance `source` CHECK to allow 'agent'
--
-- WHY THIS IS A BLOCKER, NOT A NICETY
-- The v8 honest-data model pins `source` to ('onboarding','user','bank') via a
-- per-table CHECK, applied in a loop over the provenance tables
-- (20260606120000_v8_onboarding_state.sql) and again on `accounts`
-- (20260607120000_v8_money_model_account_opening_balance.sql).
--
-- The agent creates transactions. Without this migration the FIRST agent-created
-- row fails with 23514 (check_violation) — the client union already carries
-- 'agent' (react/src/types.ts ProvenanceSource) and the Supabase adapter passes
-- `source` through generically, so the failure surfaces only at write time.
--
-- WHY A NEW VALUE RATHER THAN REUSING 'bank'
-- 'bank' asserts a bank confirmed the figure. An agent-extracted row is a
-- MODEL's reading of a message — frequently correct, never authoritative. The
-- honest-data convention is that anything with confidence <> 'confirmed' renders
-- <EstimatedTag/>; reusing 'bank' would let a model-read row inherit a bank's
-- credibility, which is exactly the dishonesty that convention exists to prevent.
--
-- ADDITIVE AND REVERSIBLE. Widening a CHECK cannot invalidate an existing row:
-- every current value remains legal. No data is rewritten, no default changes,
-- and every row already in the table keeps its meaning. The confidence CHECK is
-- deliberately left ALONE — 'estimated'|'confirming'|'confirmed' already covers
-- the agent's states.

BEGIN;

do $$
declare
  t text;
  -- Same table list as the v8 loop. Kept verbatim so the two stay comparable.
  tables text[] := array['transactions','budgets','goals','debts','assets'];
begin
  foreach t in array tables loop
    execute format($f$
      alter table %1$I drop constraint if exists %1$s_source_chk;
      alter table %1$I add  constraint %1$s_source_chk
        check (source in ('onboarding','user','bank','agent'));
    $f$, t);

    execute format($f$
      comment on column %I.source is
        'v8 honest-data provenance: onboarding|user|bank|agent. ''agent'' = extracted by the agent from a message (chat/WhatsApp/SMS/receipt) and NOT bank-authoritative — it must render <EstimatedTag/> until a human confirms it (vyact-agent-architecture.md §4).';
    $f$, t);
  end loop;
end $$;

-- `accounts` was constrained in its own migration, outside that loop.
alter table accounts drop constraint if exists accounts_source_chk;
alter table accounts add  constraint accounts_source_chk
  check (source in ('onboarding','user','bank','agent'));

comment on column accounts.source is
  'v8 honest-data provenance: onboarding|user|bank|agent. See transactions.source.';

COMMIT;
