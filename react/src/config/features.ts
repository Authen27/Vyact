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
} as const;

/** True when the onboarding feature is active. Every onboarding code path must
 *  check this at its entry — no onboarding logic executes when the flag is off. */
export function isOnboardingEnabled(): boolean {
  return FEATURES.onboarding.enabled === true;
}
