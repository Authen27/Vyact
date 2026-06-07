// Vyact — Onboarding & Activation feature flag.
//
// Single source of truth for the per-household onboarding flow (see
// vyact-onboarding-engineering-spec.md §1). The toggle is built FIRST so every
// other piece of the feature sits behind it: with `enabled = false` the app must
// be indistinguishable from the pre-onboarding build (no UI, no seeded data, no
// nudges, no "% confirmed" indicator).
//
// When a remote-config / experimentation service lands (VISION_AND_NEXT_STEPS.md
// H2), `enabled` becomes a server-driven value with no refactor — this object is
// the swap point.

export const FEATURES = {
  onboarding: {
    enabled: true,            // master switch — false disables the entire feature
    perHousehold: true,       // run onboarding per household (vs once per user)
    confirmationWindowDays: 21,
    skipAllowedFromStep: 2,   // user may skip from step 2 onward; step 0/1 mandatory
  },

  // Ask Vyact assistant (see vyact-ask-vyact-engineering-spec.md §2). Deterministic
  // rules-based, no LLM in this build. `enabled = false` reverts the launcher to
  // its v7.4.5 two-tap behaviour with zero side effects. Per-bucket flags allow a
  // staged rollout; each handler checks its bucket flag at entry. `backend` selects
  // the AssistantBackend implementation — 'rules' now, 'llm' is the future drop-in.
  askVyact: {
    enabled: true,            // master switch — false → v7.4.5 launcher, no parsing
    capture: true,
    interpret: true,
    forecast: true,
    proactiveInsight: true,   // the single "here's what to know" card on open (§5)
    backend: 'rules' as 'rules' | 'llm',
  },

  // ── Money-Model Overhaul (vyact-money-model-execution-and-regression.md) ──────
  // Phased program. Part D sequencing + the "build the flag, verify OFF first"
  // discipline: with an epic's flag OFF the app is indistinguishable from v8.0.1.
  //
  // Epic 1 — "Money Feels Real" (B1.1–B1.6). The risky core (account enforcement,
  // opening balances, reconciliation, ledger, migration). Staged behind these
  // sub-flags, all OFF until the golden-file safety net + migration dry-run gate
  // (Part C) pass. NOT YET BUILT — flag scaffolding + regression suites land first.
  moneyModel: {
    enabled: false,           // umbrella — OFF = current v8.0.1 money model
    enforceAccount: false,    // B1.1 account-on-every-transaction (BLOCKING invariant)
    openingBalance: false,    // B1.2 real, finite account balances
    reconciliation: false,    // B1.3 "fix balance" → dated adjustment txn
    ledger: false,            // B1.4 per-account ledger screen
    scopedCategories: false,  // B1.5 categories scoped by txn type
  },

  // Epic 2 — Budgets. Quick win B2.1 (remove colour picker) is applied by default
  // (reversible via the flag); the heavier items stay OFF until built.
  budgetsV2: {
    enabled: false,
    removeColorPicker: true,  // B2.1 quick win — deterministic colour, no picker
    history: false,           // B2.2 budget history & timeline
    allocations: false,       // B2.3 category sub-limits roll-up
    suggest: false,           // B2.4 copy + suggested budget
  },

  // Goals feature master switch. Set false to REMOVE the goal concept for now —
  // hides the Goals page/nav/dashboard section and drops Goal Progress from the
  // Pulse Score (the score renormalises over the remaining components). Reversible:
  // flip true to restore. Data model is preserved (nothing deleted).
  goals: { enabled: false },

  // Epic 3 — Goals & Tax as lenses. Modeling change; OFF until built + Net-Worth
  // contamination guard (R3) is green.
  goalsLens: { enabled: false },
  taxNudge:  { enabled: false },

  // Epic 4 — Entry & surface polish. Quick wins B4.1 (no keypad auto-launch) and
  // B4.4 (Saved Views hidden by default) are applied; the form reshape (B4.2/B4.3)
  // stays OFF until built. `showSavedViews:false` = the B4.4 default-hidden state
  // (the saved_views table + RPC stay dormant, not deleted).
  entryV2: {
    enabled: false,
    stopAutofocus: true,      // B4.1 — no auto-focus on amount on open/edit
    shortForm: false,         // B4.2/B4.3 — primary fields + "More details"
    showSavedViews: false,    // B4.4 — Saved Views hidden (flip true to restore)
  },
} as const;

/** True when the onboarding feature is active. Every onboarding code path must
 *  check this at its entry — no onboarding logic executes when the flag is off. */
export function isOnboardingEnabled(): boolean {
  return FEATURES.onboarding.enabled === true;
}

/** True when the Goals feature is active. When false the goal concept is removed
 *  from the UI (page, nav, dashboard) and from the Pulse Score. */
export function isGoalsEnabled(): boolean {
  return Boolean(FEATURES.goals.enabled);
}

/** True when the Ask Vyact assistant is active. When false, the Chat launcher
 *  must behave exactly as it did in v7.4.5 (no free-text parsing, no buckets,
 *  no proactive insight, no new events). */
export function isAskVyactEnabled(): boolean {
  return FEATURES.askVyact.enabled === true;
}

export type AskVyactBucket = 'capture' | 'interpret' | 'forecast';

/** Per-bucket gate. A bucket only runs when the master switch AND its own flag
 *  are on, enabling staged rollout (Capture → Interpret → Forecast). */
export function isAskVyactBucketEnabled(bucket: AskVyactBucket): boolean {
  return isAskVyactEnabled() && FEATURES.askVyact[bucket] === true;
}
