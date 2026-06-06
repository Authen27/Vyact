# Vyact — Onboarding & Activation: Engineering Specification

> **For:** Engineering team
> **From:** Product
> **Status:** APPROVED for build
> **Companion docs:** `vyact-onboarding-prd.docx` (full product rationale), `VISION_AND_NEXT_STEPS.md` (roadmap context), `CLAUDE.md` (codebase state)
> **Build target:** Vyact v8 (React 18 + TypeScript + Tailwind + Zustand, per `CLAUDE.md`)

This document is the buildable contract. The PRD explains *why*; this explains *what to build*. Where they differ, this document wins.

---

## 0. TL;DR for engineering

Build a **per-household onboarding flow** that captures a minimal financial baseline (a snapshot + a recurring scaffold — never a bank statement), renders a useful dashboard in under 2 minutes, and lets estimated values converge to confirmed reality over a **21-day** window.

**Three hard requirements from this revision:**
1. **Per-household:** onboarding runs once *per household*, not once per user/device. A user who creates or joins a second household onboards again for that household.
2. **21-day discipline window:** the truing-up / confirmation horizon is **21 days** (not 30). Aligns with habit-formation cadence.
3. **Plug-n-play toggle:** the entire feature sits behind a single feature flag. Toggle off → no onboarding renders, app falls back to current behaviour, zero side effects.

---

## 1. The feature flag (build this FIRST)

The toggle is not an afterthought — it is the first thing built, so every other piece is developed behind it.

### 1.1 Flag definition
```ts
// src/config/features.ts
export const FEATURES = {
  onboarding: {
    enabled: true,            // master switch — false disables the entire feature
    perHousehold: true,       // run onboarding per household (vs once per user)
    confirmationWindowDays: 21,
    skipAllowedFromStep: 2,   // user may skip from step 2 onward; step 0/1 mandatory
  },
} as const;
```

### 1.2 Toggle behaviour contract
| Flag state | Behaviour |
|------------|-----------|
| `onboarding.enabled = true` | Full flow runs per the rules below. |
| `onboarding.enabled = false` | **No onboarding renders, ever.** New households are created with `onboardingState = 'skipped'`. App behaves exactly as it does today (blank-but-functional dashboard). No estimated data is seeded. No nudges fire. No "% confirmed" indicator shows. |

**Acceptance:** flipping `enabled` to `false` and reloading must produce an app indistinguishable from the pre-onboarding build. No dead UI, no orphaned state, no console errors. This is the definition of "plug-n-play."

### 1.3 Why a config object, not scattered booleans
- One source of truth. QA flips one value to test both states.
- When a remote config / experimentation service lands (per `VISION_AND_NEXT_STEPS.md` H2), this object is the swap point — `enabled` becomes a server-driven value with no refactor.
- Every onboarding code path checks `FEATURES.onboarding.enabled` at its entry. No onboarding logic executes when the flag is off.

---

## 2. Trigger model — per household

### 2.1 The rule
Onboarding is owned by the **household**, not the user or the device. Each household carries its own onboarding state.

- A new household is created → its `onboardingState = 'not_started'` → onboarding triggers on first entry into that household (if the flag is on).
- A user switches into a household whose `onboardingState` is `not_started` → onboarding runs for that household.
- A user who already completed household A then creates household B → onboarding runs again for household B.
- A user *joins* an existing household (invited member) that is already `completed` → **no onboarding** for them; they enter the already-configured household. (They may see a lightweight "welcome to this household" intro — see §6.4, but not the full baseline-capture flow, since the baseline already exists.)

### 2.2 State machine (per household)
```
not_started ──▶ in_progress ──▶ completed
     │                              
     └──────────▶ skipped  (user skipped, or flag off at creation)
```

- `not_started` — household exists, onboarding not yet begun.
- `in_progress` — user is mid-flow. Store the current step so it resumes if abandoned.
- `completed` — user reached the Reveal (step 5).
- `skipped` — user skipped (allowed from step 2), OR the household was created while the flag was off.

### 2.3 Resume behaviour
If a user abandons mid-flow (`in_progress`) and returns, resume at the saved step. Do not restart. Do not lose entered values.

---

## 3. Data model

### 3.1 Household-level onboarding record
```ts
// Attached to the Household entity
interface HouseholdOnboarding {
  state: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  segment: 'individual' | 'household' | 'smb' | null;  // set at step 1
  context: OnboardingContext | null;                    // step 2 answers
  currentStep: number;                                  // 0–5, for resume
  startedAt: string | null;                             // ISO
  completedAt: string | null;                           // ISO
  confirmationWindowEndsAt: string | null;              // completedAt + 21 days
}

interface OnboardingContext {
  // shared
  primaryConcern: string;
  // household-specific
  adultCount?: 1 | 2 | 3;        // 3 = "more"
  dependents?: 'none' | 'kids' | 'other';
  splitRatio?: number | null;    // e.g. 60 means 60/40, null if not set
  // individual-specific
  incomeType?: 'steady' | 'variable';
  // smb-specific
  businessType?: 'solo' | 'team' | 'side_business';
  taxReservePct?: number | null;
}
```

### 3.2 Confidence on every baseline-derived record
Every record created from onboarding estimates carries confidence + source. This is what powers honest-data rendering and the truing-up loop.
```ts
type Confidence = 'estimated' | 'confirming' | 'confirmed';
type Source = 'onboarding' | 'user' | 'bank';

interface WithProvenance {
  confidence: Confidence;
  source: Source;
  estimatedAt?: string;   // when the estimate was captured
  confirmedAt?: string;   // when it transitioned to confirmed
}
```
Apply `WithProvenance` to: snapshot balances, debt estimates, and each recurring-scaffold entry created during onboarding.

### 3.3 Reuse, do not duplicate
- Recurring scaffold entries **reuse the existing recurring-transaction structure** (per v7 PRD §recurring). Do not build a parallel "onboarding income/bill" model.
- Snapshot balance → an opening-balance entry on the relevant account, tagged `estimated`.
- Debt estimates → existing Debt records, tagged `estimated`.

### 3.4 Migration for existing v6 households
- Every existing household (pre-feature) gets `onboardingState = 'skipped'` and all existing data marked `confidence = 'confirmed'`, `source = 'user'`.
- Existing households default `segment = 'household'` (most permissive, hides no modules).
- **No existing user is ever re-onboarded.** Their data is real — never re-tag it as an estimate, never force them through the flow.

---

## 4. The flow — 6-step spine

One flow engine. Steps 0, 1, 5 are shared. Steps 2–4 read content from a per-segment config map.

| Step | Name | Shared? | Input cap |
|------|------|---------|-----------|
| 0 | Welcome + Trust | shared | 0 inputs |
| 1 | Segment Select | shared | 1 tap (mandatory) |
| 2 | Context | per-segment | 2–3 taps |
| 3 | The Snapshot | per-segment | ≤2 inputs |
| 4 | The Forward Model | per-segment | income + fixed-cost chips |
| 5 | The Reveal | shared | 0 inputs (+ optional invite/next-action) |

### 4.1 Hard constraints
- **Steps 2–4 combined: ≤ 6 input interactions total.** If a segment needs more, it goes to progressive capture (§5), NOT into the flow.
- **Median time to Reveal: < 120 seconds.** Instrument it (§7).
- **Step 1 is mandatory** (segment is the #1 driver of UX fit). Steps 2–4 are skippable from step 2 onward per `skipAllowedFromStep`. Skipping → `state = 'skipped'`, segment defaults to `household` if not chosen, dashboard still renders (empty-but-functional).
- **No bank connect, no statement upload, no account numbers, no card details anywhere in this flow.** Enforced by code review.

### 4.2 Per-segment content
Content lives in `src/lib/onboardingTemplates.ts` as a static map keyed by segment. Full question text, chip sets, and configured-module lists are in the PRD (§4 Path A, §5 Path B, §6 Path C). Engineering reproduces those verbatim; do not improvise copy.

Summary of what each path configures on completion:

| Segment | Visible modules | Pulse weighting bias | Signature Reveal moment |
|---------|-----------------|----------------------|--------------------------|
| Individual | Dashboard, Transactions, Budgets, Goals, Reports | savings + control | "Here's your month at a glance" |
| Household | + Members, Debts, Net Worth, Splits | balanced | "You're set — invite your partner?" |
| SMB | Dashboard (cash-runway hero), Transactions, Budgets, Net Worth, Debts, Reports | business health (runway/burn) | "~X months runway at current burn" |

### 4.3 The Reveal (step 5) must show
- Current position (from snapshot)
- Monthly cash-flow shape (from forward model)
- First Pulse Score
- 21-day outlook (was 30 — see §0)
- The "% confirmed" indicator (starts low, e.g. 35–45%)
- One suggested next action
- (Household only) the partner-invite offer — **here**, not earlier

---

## 5. The temporary-baseline lifecycle (21-day window)

### 5.1 Three states
```
estimated ──▶ confirming ──▶ confirmed
```
- **estimated** — entered during onboarding. Renders with a visible "Estimated" tag. Counts in dashboard/Pulse so the app feels alive, but is visually distinct.
- **confirming** — real data has begun reconciling against this estimate. Triggers a gentle nudge.
- **confirmed** — user verified/edited/replaced it, OR real data has fully superseded it. Tag drops; value is first-class.

### 5.2 Transition rules
- **estimated → confirming:** a real transaction (`source: 'user'` or `'bank'`) lands in a category/account that has an estimate. Surface a non-blocking nudge: *"Your real {category} is tracking {x}% {above/below} your estimate — update it?"*
- **confirming → confirmed:** the user taps to confirm/edit, OR enough real data accrues that the estimate is no longer materially load-bearing (define "enough" as ≥ 3 real transactions in that category within the window).
- **Never auto-overwrite a user-entered value without an explicit tap.** Suggest only.

### 5.3 The 21-day discipline window
- `confirmationWindowEndsAt = completedAt + 21 days`.
- The "% confirmed" indicator and the day-N check-ins are scoped to this window.
- **Day 7 check-in** and **Day 14 check-in** and a **Day 21 wrap** (was a single day-7 + day-30 in the PRD; align to the 21-day cadence: gentle touchpoints at days 7, 14, 21).
- **Target:** active users cross **80% confirmed within 21 days** (was 30).
- After day 21: estimates that remain un-confirmed do NOT silently vanish (no auto-decay — that hides what's happening). They keep their "Estimated" tag indefinitely until the user resolves them. The *active nudging* simply tapers after the window closes so the app doesn't nag forever.

### 5.4 The "% confirmed" indicator
- Derived: `confirmedRecords / totalBaselineRecords`, weighted by financial materiality (a £1,200 mortgage estimate matters more than a £9 subscription).
- Persistent but quiet on the dashboard.
- Reframes accuracy as visible progress, and frames estimates as temporary-by-design.

### 5.5 Honest-data rendering (non-negotiable)
- A single shared `<EstimatedTag/>` component. Any value where `confidence !== 'confirmed'` renders it.
- Charts visually distinguish estimated vs confirmed segments (hatched fill or reduced opacity).
- **Never render a fabricated number styled as real.** Every estimate is one the user placed, and it always looks like an estimate. Enforced by code review.

---

## 6. Progressive capture (post-onboarding)

Onboarding captures the minimum; the rest accretes in context.

### 6.1 Contextual capture moments
| Trigger | Prompt (gentle, skippable) |
|---------|----------------------------|
| User logs spend in an estimated category | "Your real {category} is above your {amount} estimate. Update it?" |
| A recurring bill's predicted date passes | "Did your {bill} of {amount} go out as expected?" — Yes confirms scaffold; No corrects it |
| Day 7 / 14 / 21 check-in | "Your picture is {x}% confirmed. Two taps to reach {target}?" — surfaces highest-materiality unconfirmed items only |
| User has seen value (≥ 5 real logs) | **First** bank-connect offer: "Tired of typing? Connect your bank and Vyact logs automatically." |

### 6.2 Bank-connect timing (critical)
- **Never at signup.** Surfaces only after the user has logged real activity and seen value (≥ 5 logs as the trigger).
- Framed as convenience ("stop typing"), not demand.
- The integration itself is out of scope for this build (Integration layer, H2). This spec only governs **when the offer appears**.

### 6.3 Nudge governance
- All nudges are non-blocking, dismissible, and rate-limited (max 1 capture nudge per session).
- Respect a global "reduce prompts" setting if/when notification preferences ship (per v7 PRD).
- When `onboarding.enabled = false`, no nudges fire (they belong to this feature).

### 6.4 Joining an already-onboarded household
- A member invited into a `completed` household does **not** run baseline capture (the baseline exists).
- Optional lightweight intro (1 screen): "Welcome to {household}. Here's what's set up." — gated behind the same feature flag.

---

## 7. Instrumentation

Capture these events (raw event logging is enough for now; full analytics layer is H2 per `VISION_AND_NEXT_STEPS.md`).

| Event | Properties |
|-------|------------|
| `onboarding_started` | householdId, segment (null at start), flagEnabled |
| `onboarding_step_completed` | step, segment, msSinceStart |
| `onboarding_skipped` | step skipped from, segment |
| `onboarding_completed` | segment, totalMs, baselineRecordCount, initialConfirmedPct |
| `estimate_confirmed` | recordType, daysSinceOnboarding, viaNudge (bool) |
| `confirmed_pct_milestone` | pct (50/80), daysSinceOnboarding |
| `bank_connect_offered` | daysSinceOnboarding, logCountAtOffer |

Primary funnel to watch: started → step 1 → step 5 (completed), with median time to Reveal.

---

## 8. Acceptance criteria

### 8.1 Plug-n-play (the toggle)
- [ ] `FEATURES.onboarding.enabled = false` → no onboarding UI renders anywhere; new households created as `skipped`; no estimated data seeded; no nudges; no "% confirmed" indicator; app identical to pre-feature build; no console errors.
- [ ] `enabled = true` → full flow runs per these rules.
- [ ] Flipping the flag requires no other code change and no data migration.

### 8.2 Per-household
- [ ] Creating a new household triggers onboarding for that household (flag on).
- [ ] A user who completed household A and creates household B is onboarded again for B.
- [ ] A member joining an already-`completed` household is NOT put through baseline capture.
- [ ] Onboarding state is stored per-household and resumes at the saved step after abandonment.

### 8.3 The flow
- [ ] Each of the 3 segments reaches a populated, useful dashboard in < 120s median (10-user test).
- [ ] Steps 2–4 never exceed 6 input interactions for any segment.
- [ ] Step 1 (segment) is mandatory; steps 2–4 skippable from step 2.
- [ ] No bank-connect / statement / account-number / card request anywhere in the flow.
- [ ] Reveal shows: position, cash-flow shape, Pulse Score, 21-day outlook, "% confirmed", one next action.

### 8.4 Temporary-baseline + 21-day window
- [ ] All onboarding-derived values are tagged `estimated` and render with a visible tag.
- [ ] No estimated value is ever silently overwritten without an explicit user tap.
- [ ] `confirmationWindowEndsAt` = completedAt + 21 days.
- [ ] Check-ins fire at days 7, 14, 21.
- [ ] After day 21, estimates persist (no auto-decay); active nudging tapers.
- [ ] "% confirmed" indicator is present, materiality-weighted, and rises as estimates confirm.

### 8.5 Honest data
- [ ] No fabricated number is ever rendered as if it were real/confirmed.
- [ ] Estimated vs confirmed is visually distinguishable in both numbers and charts.

### 8.6 Existing users
- [ ] Existing v6 households: `skipped`, data `confirmed`, segment `household`, never re-onboarded, no data re-tagged as estimate.

---

## 9. Out of scope for this build

- The bank-aggregation integration itself (only the *timing* of the offer is in scope). → Integration layer, H2.
- Server-driven remote config (the flag is local for now; structured to swap later). → H2.
- Conversational / talk-through onboarding. → after the conversational layer ships; the spine is designed to be narratable later.
- 6-persona granularity — superseded by the 3-path model. Sub-segmentation inside a path can be added later without touching the spine.

---

## 10. Build order (suggested)

1. **Feature flag + toggle contract** (§1) — so everything else is built behind it. Verify the OFF state first.
2. **Per-household state model + migration** (§2, §3) — existing users safe.
3. **Flow engine + shared steps 0/1/5** (§4).
4. **Per-segment content map, steps 2–4** (§4.2).
5. **Confidence provenance + `<EstimatedTag/>` + honest rendering** (§3.2, §5.5).
6. **The Reveal dashboard** (§4.3).
7. **Lifecycle transitions + 21-day window + "% confirmed"** (§5).
8. **Progressive capture nudges + bank-connect timing** (§6).
9. **Instrumentation** (§7).
10. **Acceptance pass** (§8), including the critical OFF-state test.

---

*End of spec. Build the toggle first; verify the OFF state is a clean no-op before building anything else.*
