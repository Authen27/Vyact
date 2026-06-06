-- v8.0.0 · Onboarding & Activation — cloud persistence
--
-- Spec: vyact-onboarding-engineering-spec.md (§2 per-household state, §3 data
-- model + provenance, §5 temporary-baseline lifecycle).
--
-- v8.0.0 shipped onboarding state as browser-local overlays, which made the
-- honest-data lifecycle device-local (a second device, or a cleared cache, lost
-- the "estimated" tags, the % confirmed indicator, the 21-day window, and nudge
-- bookkeeping). This migration promotes both halves to the cloud:
--
--   (a) PER-HOUSEHOLD STATE  → households.onboarding (jsonb). Mirrors the
--       Money-Map education_progress precedent: a trivial additive jsonb column
--       on the per-household table, inheriting the existing households RLS.
--
--   (b) RECORD PROVENANCE    → normalized confidence/source/estimated_at/
--       confirmed_at columns on every baseline-derived entity (transactions,
--       budgets, goals, debts, assets). Provenance therefore rides the existing
--       per-entity sync + RLS, is queryable in SQL, and stays attached to the
--       row it describes. Defaults ('confirmed' / 'user') mean every existing
--       row and every ordinary user row is first-class with no backfill, and
--       existing data is NEVER re-tagged as an estimate (spec §3.4).
--
-- households.onboarding shape (validated app-side; schemaless so the flow can
-- evolve without a migration per change):
--   {
--     "state": "not_started|in_progress|completed|skipped",
--     "segment": "individual|household|smb"|null,
--     "context": { ... }|null,
--     "currentStep": 0,
--     "startedAt": iso8601|null,
--     "completedAt": iso8601|null,
--     "confirmationWindowEndsAt": iso8601|null   -- completedAt + 21 days
--   }

BEGIN;

-- ── (a) per-household onboarding state ────────────────────────────────────────
alter table households
  add column if not exists onboarding jsonb not null default '{}'::jsonb;

alter table households
  drop constraint if exists households_onboarding_is_object;
alter table households
  add constraint households_onboarding_is_object
  check (jsonb_typeof(onboarding) = 'object');

comment on column households.onboarding is
  'v8 Onboarding & Activation per-household state machine record. See vyact-onboarding-engineering-spec.md §2/§3.';

-- ── (b) per-entity provenance columns ─────────────────────────────────────────
-- Applied to each baseline-derived table via a do-block so the checks/comments
-- stay DRY. confidence/source default to the first-class values so legacy rows
-- and ordinary user writes need no backfill.
do $$
declare
  t text;
  tables text[] := array['transactions','budgets','goals','debts','assets'];
begin
  foreach t in array tables loop
    execute format($f$
      alter table %I
        add column if not exists confidence   text        not null default 'confirmed',
        add column if not exists source        text       not null default 'user',
        add column if not exists estimated_at  timestamptz,
        add column if not exists confirmed_at  timestamptz;
    $f$, t);

    execute format($f$
      alter table %1$I drop constraint if exists %1$s_confidence_chk;
      alter table %1$I add  constraint %1$s_confidence_chk
        check (confidence in ('estimated','confirming','confirmed'));
      alter table %1$I drop constraint if exists %1$s_source_chk;
      alter table %1$I add  constraint %1$s_source_chk
        check (source in ('onboarding','user','bank'));
    $f$, t);

    -- Partial index: cheaply find the still-outstanding onboarding estimates a
    -- household has to confirm during the 21-day window (powers the nudge stats
    -- and a future server-side % confirmed). Excludes the confirmed majority.
    execute format($f$
      create index if not exists %1$s_estimated_idx
        on %1$I (household_id)
        where confidence <> 'confirmed';
    $f$, t);

    execute format($f$
      comment on column %I.confidence is
        'v8 honest-data confidence: estimated|confirming|confirmed (spec §3.2/§5).';
    $f$, t);
  end loop;
end $$;

COMMIT;
