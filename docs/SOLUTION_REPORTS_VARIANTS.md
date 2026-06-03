# Solution: Reports Variants — Member, Account, Insights (Item #8)

**Status:** Draft · **Target:** v7.3 (Variants A + B) · **Owner:** Consumer
**Depends on:** [`SOLUTION_MONEY_MAP.md`](SOLUTION_MONEY_MAP.md) Phase 4 views (`v_txn_by_member`, `v_txn_by_account`)
**Related:** [`MEASUREMENT_PLAN.md`](MEASUREMENT_PLAN.md) (`report_period_changed`, `report_drilldown_clicked`, `insight_*`)

## Problem
The current `Reports.tsx` page shows a single household-wide income/expense summary.
Multi-gen households need to see *who* earned and spent (without exposing private detail
to children/viewers); small-business households need to see *which account* the cash flowed
through. And nobody wants to read tables — they want one-sentence insights ("Groceries up
22% this month, mostly weekends").

## Goals
- **Variant A:** Member contribution donut + drilldown (privacy-aware).
- **Variant B:** Insight cards on Reports + Dashboard, generated client-side from existing data.
- Reuse current period selector (Day/Week/Month/Quarter/Year).
- All variants opt-in via `vt_feature_reports_v2` flag; legacy view preserved.

## Non-Goals
- **Variant C — Sankey** (income → categories → savings flow): deferred to v7.4. Visualization complexity and mobile rendering need separate spike.
- **Variant D — Forecast** (projected month-end based on trend): deferred to v7.4; depends on stable insight engine first.
- Custom report builder / saved views: see Money Map Migration C (v7.3.1).

## Variants

### Variant A — Member contribution (v7.3)
Donut chart with one wedge per household member, sized by net contribution (income −
expense) for the period. Clicking a wedge drills into that member's transactions.

### Variant B — Insight cards (v7.3)
3-5 cards above the Reports tables and a single "Top insight" card on the Dashboard.
Generated client-side from already-loaded data; no LLM, no backend call.

### Variant C — Sankey (deferred v7.4)
### Variant D — Forecast (deferred v7.4)

## Architecture

```
react/src/components/reports/
  MemberContribution.tsx   ← Recharts donut + legend + drilldown link
  AccountBreakdown.tsx     ← reused on Net Worth too (Item #5)
  InsightCard.tsx          ← title, body, action ("View txns"), dismiss
  InsightStack.tsx         ← 3-5 cards, prioritized
react/src/lib/insights/
  index.ts                 ← orchestrator: runs templates, returns ranked Insight[]
  templates/
    categoryTrendUp.ts
    memberShareShift.ts
    paymentMethodConcentration.ts
    budgetRunway.ts
    pulseDrop.ts
react/src/pages/Reports.tsx ← +period tabs, +variants gated on feature flag
```

### Data sources
- **Variant A:** `v_txn_by_member` view (Money Map Phase 4) when cloud-on; client-side
  groupBy on `transactions.initiated_by` when cloud-off.
- **Variant B:** Pure client-side over already-loaded `transactions`, `budgets`, `goals`,
  `pulseHistory`. Zero new queries.

## Insight templates (Variant B)

Each template is a pure function `(state) => Insight | null`. Run in priority order; top-N
returned (configurable, default 3 on Reports, 1 on Dashboard).

| ID | Trigger | Example output |
|---|---|---|
| `category_trend_up` | Category MoM change > +20%, ≥ 3 txns this period | "Groceries up 22% vs last month — mostly weekend trips." |
| `member_share_shift` | One member's share of expenses shifted ≥ 10pp | "Maya covered 45% of household spending this month, up from 32%." |
| `payment_method_concentration` | One payment method used for > 70% of expense | "85% of spending went on the Chase card. Worth diversifying for rewards?" |
| `budget_runway` | Budget pace projects > 110% by month-end | "Dining is on track to land at 118% by month-end." |
| `pulse_drop` | Pulse Score ↓ ≥ 5pts in last 7 days | "Pulse dropped 7pts this week — debt component took the hit." |

Insight type:
```ts
type Insight = {
  id: string;                  // 'category_trend_up:groceries:2026-06'
  template: InsightTemplate;
  priority: number;            // 0-100, higher = more prominent
  title: string;
  body: string;                // ≤ 140 chars
  action?: { label: string; route: string; params?: Record<string, string> };
  dismissible: boolean;
};
```
Dismissals persisted to `education_progress.insights_dismissed[]` (24h half-life so they
re-surface if condition persists).

## Drilldown contract
Clicking a chart segment / insight action navigates with URL params:
```
/transactions?member=<id>&from=2026-06-01&to=2026-06-30
/transactions?account=<id>&category=groceries
```
`Transactions.tsx` reads params on mount, applies as filters, shows a "Filtered by:
Maya · June 2026" chip with × to clear. Hooks into Item #4 filter findability — same
chip component.

## Privacy guardrail (critical)

`child` and `viewer` roles **must not** see other members' contribution detail.

| Role | Variant A donut | Drilldown to other member |
|---|---|---|
| primary, partner | Full | Yes |
| elder | Full | Yes |
| child | Aggregated only ("Household total") + own slice highlighted | Own only |
| viewer | Aggregated only | None |

Enforced in `MemberContribution.tsx` via `usePermissions()` + cloud-side via `v_txn_by_member`
RLS (Money Map Migration A includes role check; verify before v7.3 ship).

## Telemetry
- `report_period_changed` `{ from_period, to_period, variant }`
- `report_drilldown_clicked` `{ from: 'member'|'account'|'insight', target_route }`
- `insight_dismissed` `{ insight_template, priority }`
- `insight_actioned` `{ insight_template, action_route }`

## Risks

| ID | Risk | Severity | Group | Mitigation |
|---|---|---|---|---|
| R-1 | Donut illegible with > 6 members | Medium | Usability | "Others" wedge groups members < 5%; legend lists all |
| R-2 | **Member donut leaks data to viewer/child** | **Critical** | **Security** | Role check at component + RLS at view; e2e test `RPT-FC-008`; security review before flag flip |
| R-3 | Insight templates fire on noisy data → cry-wolf fatigue | High | Adoption | Min sample size (≥ 3 txns / ≥ 14 days); dismissal half-life; cap at 5 cards |
| R-4 | Client-side aggregation slow with 10k+ txns | Medium | Scalability | Memoize per-period; v7.4 promotes hot templates to SQL views |
| R-5 | `member_share_shift` triggers when a member just joined → false signal | Medium | Adoption | Require ≥ 30 days of prior data per member |
| R-6 | Budget runway insight contradicts dashboard pulse | Low | Usability | Single source of truth in `lib/calculations.ts`; insight reads same fn |
| R-7 | Drilldown URL params survive across logout → leak filter context | Medium | Security | Clear on auth state change; don't include member names in URL, only IDs |
| R-8 | Dismissal jsonb merge race with education_progress | Medium | Scalability | Same deep-merge rule as `SOLUTION_EDUCATION.md` E-6 |

## Release Gates
1. RLS verified: viewer JWT cannot read `v_txn_by_member` rows for other members.
2. Playwright `RPT-FC-007` member donut renders; `RPT-FC-008` viewer sees aggregated only.
3. `RPT-FC-009` insight dismiss persists 24h then re-surfaces if condition holds.
4. `RPT-FC-010` drilldown URL applies filters on Transactions and chip is removable.
5. `RPT-FC-011` legacy reports view still reachable when flag off.
6. Performance: aggregation < 50ms on 5k-txn fixture (measured in CI).

## Test IDs (add to `react/e2e/TEST_CASE_INVENTORY.md`)
- `RPT-FC-007` — primary role sees per-member donut with all wedges
- `RPT-FC-008` — viewer role sees aggregated wedge only; no drilldown links
- `RPT-FC-009` — dismiss `category_trend_up`; reload; absent. Force-fast-time +25h; reappears.
- `RPT-FC-010` — click member wedge → Transactions filtered, chip visible, × clears
- `RPT-FC-011` — flag off → legacy single-table reports renders unchanged
- `NWRT-FC-007` — `AccountBreakdown` reused on Net Worth shows same totals as Reports

## Open Questions
1. Should "Top insight" on Dashboard be dismissible per-card, or only the whole stack?
2. When household has 1 member (personal mode), hide member donut entirely or show a
   single 100% wedge with a hint to invite others?
3. Insight dismissal half-life: 24h, 7d, or per-template? (Recommend per-template defaults
   in `insights/index.ts`.)
