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
} as const;

/** True when the onboarding feature is active. Every onboarding code path must
 *  check this at its entry — no onboarding logic executes when the flag is off. */
export function isOnboardingEnabled(): boolean {
  return FEATURES.onboarding.enabled === true;
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
