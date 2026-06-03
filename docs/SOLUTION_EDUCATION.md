# Solution: Visual Education & Onboarding (Item #7)

**Status:** Draft · **Target:** v7.4 (Variants A + C) · **Owner:** Consumer
**Depends on:** [`SOLUTION_MONEY_MAP.md`](SOLUTION_MONEY_MAP.md) Migration B (`education_progress` jsonb)
**Related:** [`MEASUREMENT_PLAN.md`](MEASUREMENT_PLAN.md) (`onboarding_step_completed`, `help_tooltip_opened`)

## Problem
Vyact targets multi-generational households with mixed financial literacy. Elders may
not know what "Pulse Score" means; children/teens (viewer/child roles) need plain-language
framing; primaries want depth without re-reading docs. Today the only education surface
is `Help.tsx` (10 accordion sections). Nothing surfaces at the *moment of need*.

## Goals
- First-run tour highlights 5 anchor concepts (no forced lessons).
- Inline contextual chips ("Why this number?") on every score / ratio / threshold.
- Per-user dismissal that survives reinstall (cloud-persisted via `education_progress`).
- Plain-language tone, ≤ 280 chars per snippet, locale-translatable.

## Non-Goals
- Sandbox / "try it" mode (Variant B) — deferred to v7.5; needs separate scope.
- Weekly insight digest (Variant D) — overlaps with `SOLUTION_REPORTS_VARIANTS.md` insights; consolidated there.
- Video / animated tutorials.

## Variants

### Variant A — Coachmarks + Spotlight (v7.4)
First-run modal asks "Show me around?" → 5-step spotlight tour with anchored tooltips.
Skippable per step. Replays from `Help → Take the tour`.

### Variant C — `WhyChip` contextual snippets (v7.4)
Small `(?)` chip next to: Pulse Score components, Debt-to-Income ratio, Liquidity Ratio,
budget over-threshold warning, debt strategy choice (Avalanche vs Snowball), goal forecast.
Tap → 2-3 sentence explainer + "Learn more" link to Help anchor.

### Variant B — Sandbox profile (deferred to v7.5)
Pre-seeded "demo household" toggle so users can experiment without polluting real data.
Requires adapter awareness; out of scope for v7.4.

### Variant D — Weekly insights (deferred → reports)
See [`SOLUTION_REPORTS_VARIANTS.md`](SOLUTION_REPORTS_VARIANTS.md) Variant B.

## Architecture

```
react/src/components/education/
  Coachmark.tsx        ← anchored tooltip with arrow + dismiss
  Spotlight.tsx        ← scrim + cutout positioning (uses anchor's getBoundingClientRect)
  WhyChip.tsx          ← (?) chip → popover with title/body/link
  TourController.tsx   ← orchestrates step sequence; reads/writes progress
  topics/
    pulseScore.tsx
    debtStrategy.tsx
    liquidityRatio.tsx
    budgetThreshold.tsx
    debtToIncome.tsx
react/src/lib/educationProgress.ts ← read/write progress; cloud-synced via adapter
react/src/lib/educationContent.ts  ← topic registry { id, title, body, helpAnchor }
```

### Data
`education_progress` jsonb (from Money Map Migration B):
```json
{
  "tour_v1_completed": true,
  "tour_v1_skipped_step": null,
  "topics_seen": ["pulse_score", "debt_strategy"],
  "topics_dismissed": ["liquidity_ratio"],
  "version": 1
}
```
- **Local-only mode:** stored in `localStorage` under `vt_education_progress`.
- **Cloud mode:** merged into `profiles.education_progress` jsonb on save.
- Versioned so v7.5 can re-prompt elders for new topics without resetting all dismissals.

## First-Run Tour Steps

| # | Anchor (`data-tour=`) | Topic | Snippet (English source) |
|---|---|---|---|
| 1 | `pulse-score` | What this score means | "Your Pulse Score is a 0-100 health check across budgeting, saving, debt, and goals. It's not a credit score — it's a private mirror." |
| 2 | `add-txn` | Logging in 5s | "Tap here to log spending or income. Pick the track that matches your action — we'll handle the rest." |
| 3 | `sidebar-budgets` | Plans not limits | "Budgets here are plans, not punishments. Going over once doesn't 'fail' you — the trend does." |
| 4 | `sidebar-debts` | Two ways to pay | "Avalanche saves the most money. Snowball gives the most motivation. Both work — pick what you'll stick with." |
| 5 | `pulse-empty` | No data yet | "Add 5-10 transactions and check back. Your score gets sharper with each entry." |

Anchors are added as `data-tour="..."` attributes on existing components; no DOM changes.

## `WhyChip` placements

| Location | Topic ID | Snippet |
|---|---|---|
| Pulse Score donut center | `pulse_score` | Same as tour step 1 |
| Pulse Score breakdown row | `pulse_component_*` | One per component (Budget/Savings/Goal/Trend/Debt) |
| Debt page strategy toggle | `debt_strategy` | Avalanche vs Snowball plain-language comparison |
| Net Worth ratio card | `liquidity_ratio`, `debt_to_income`, `emergency_coverage`, `savings_ratio` | One per ratio |
| Budget row over threshold | `budget_threshold` | "You're past 80% — here's what that means by month-end" |
| Goal forecast | `goal_forecast` | "Based on your last 90 days, you'll hit this on..." |

## Role-aware rendering
- **child / viewer roles:** WhyChips show on read-only screens; tour skips steps 2-3 (logging
  txn, budgets) since they lack write permission.
- **elder role flag (planned for `Household.members[].role`):** Variant B drawer hint
  enabled by default; tour pace slowed (no auto-advance).

## Telemetry
- `onboarding_step_completed` `{ step_id, step_index, skipped }` — fires per tour step.
- `help_tooltip_opened` `{ topic_id, surface }` — fires when WhyChip popover opens.
- Never log snippet text or user identifiers.

## Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| E-1 | Tour interrupts power user on every fresh install | High | One-time per `device + householdId` until cloud sync; `tour_v1_completed` honored across devices once cloud-synced |
| E-2 | Elder dismisses WhyChip then can't find it | Medium | "Show all hints" toggle in Settings; never permanently hide |
| E-3 | Children see content above their literacy level | Medium | Role-aware copy variants in `educationContent.ts` (`adult` / `youth` keys) |
| E-4 | Spotlight cutout misaligned on mobile rotation | Medium | Recompute on `resize` / `orientationchange`; fall back to plain modal if anchor missing |
| E-5 | Translations lag English copy → mixed-language UX | Medium | Fall back to English with `lang="en"` attribute; track via `i18n_missing_key` event |
| E-6 | Cloud merge race overwrites recent dismissals | High | Use jsonb `||` deep-merge in adapter, not replace; arrays union'd by id |
| E-7 | Help search doesn't include snippet text → users can't find topic later | Medium | Index `educationContent.ts` titles into Help search on build |

## Release Gates
1. All 5 first-run topics translated into the 6 supported locales.
2. Playwright `ONB-FC-006` tour happy path; `ONB-FC-007` skip-each-step; `ONB-FC-008` replay from Help.
3. `EDU-FC-001` WhyChip popover dismiss persists across reload (local + cloud).
4. `EDU-FC-002` role=child sees youth copy on Pulse Score breakdown.
5. Education content reviewed by domain SME before each release (no financial advice phrasing).

## Test IDs (add to `react/e2e/TEST_CASE_INVENTORY.md`)
- `ONB-FC-006` — first-run tour completes; `tour_v1_completed=true` in `education_progress`
- `ONB-FC-007` — skip step 3; `tour_v1_skipped_step=3` recorded
- `ONB-FC-008` — Help → Take the tour replays from step 1 even when completed
- `EDU-FC-001` — dismiss WhyChip, reload, chip stays dismissed (local mode)
- `EDU-FC-002` — login as child role, Pulse Score WhyChip shows youth-tone copy

## Open Questions
1. Should WhyChip dismiss be per-topic forever, or re-prompt on major version bumps?
2. Do we need a "guardian explains to child" co-view mode, or is solo-child copy enough?
3. Tour at signup vs after first 3 transactions logged — which converts better? (A/B in v7.4.1.)
