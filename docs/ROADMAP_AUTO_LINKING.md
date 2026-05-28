# FinFlow — Auto-Linking Roadmap

> **Vision:** Move FinFlow from "every entity is a flat field the user
> manually keeps consistent" → "the data is a graph; one user action
> propagates through every dependent view automatically."
>
> Today a recorded expense touches a category and a budget. It does
> **not** touch the asset the money came from, the goal that account is
> funding, or the debt it might have paid down. The user does that
> reconciliation in their head — and increasingly forgets to. This
> roadmap closes those loops.

---

## Status

| Phase | Title | Target Release | Status |
|---:|---|---|---|
| A | Asset Reflection | Consumer v6.5 | 🟡 Designed |
| B | Goal Linking | Consumer v6.6 | 🟡 Designed |
| C | Budget Surplus Routing | Consumer v6.7 | 🟡 Designed |
| D | Split Auto-Settlement | Consumer v6.8 | 🟡 Designed |
| E | Recurring Projection Engine | Consumer v7.0 | 🟡 Designed |
| F | Two-Way Edit & Reconciliation | Consumer v7.0 | 🟡 Designed |

Each phase ships behind a feature flag; default off until the migration
tooling for that phase is in production.

---

## Guiding principles

1. **Manual remains an escape hatch.** Every auto-linked field must be
   user-overridable; auto-link can be unhooked per-entity.
2. **Derived values are computed, not stored.** Once a value is derived
   from the transaction graph, removing the stored copy is a hard rule —
   two sources of truth always drift.
3. **Migrations carry a baseline.** Households created before a phase
   ships need a one-time reconciliation step (UI + tooling), not a
   silent recompute that may surprise them.
4. **Feature-flagged, not big-bang.** Each phase lands dark, opt-in for
   internal households, then default-on after one release cycle.
5. **Cloud-safe.** Every auto-propagation respects TD-03 optimistic
   concurrency; conflicting writes surface, never silently win.

---

# Phase A — Asset Reflection (v6.5)

## User story
*"When I record a $500 expense paid from my Chase Checking, my Chase
Checking balance in NetWorth should drop by $500 without me touching it."*

## Behaviour spec
- **Expense** linked to an asset → asset value decreases by the amount.
- **Income** linked to an asset → asset value increases by the amount.
- **Transfer** with `linkedAssetId` source + target → source decreases,
  target increases (existing `transfer` type formalised).
- **Investment** linked to an asset → asset value increases by the
  invested amount (asset auto-update toggle from the existing
  Investment feature, now mandatory under this phase).

## Data-model changes

```ts
// types.ts — Asset
interface Asset {
  // ...existing fields
  openingBalance: number;        // NEW — value at asset creation
  value: number;                 // KEPT — now a derived cache; never written directly
  linkedPaymentMethods?: string[]; // NEW — e.g. ['Chase Sapphire', 'Visa ****1234']
}

// types.ts — Transaction (no schema change; uses existing linkedAssetId)
```

Asset.value formula:
```
asset.value = asset.openingBalance + Σ (signed transaction deltas where linkedAssetId === asset.id)
```

## UX surface
- Transaction form: when `paymentMethod` is selected, auto-fill
  `linkedAssetId` from `Asset.linkedPaymentMethods`. User can override.
- Asset detail page: "Activity" tab showing the contributing
  transactions, with running balance.
- NetWorth page: "Reconcile" button per asset when manual value
  divergence is detected (post-migration).

## Migration
- New `openingBalance` column defaults to current `Asset.value` for
  existing rows.
- Existing transactions have no `linkedAssetId` → asset value stays
  unchanged (no surprise drop).
- First time a user records a transaction with `linkedAssetId` for an
  asset, a banner offers: *"From now on this account auto-updates from
  transactions. Want us to back-fill from your transaction history?"*

## Test cases affected
- TXN-FC-001 through 008: assertions extend to verify asset balance moves.
- NWRT-FC-001, 002: become happy paths (no longer require manual asset
  edit between recording the transaction and checking NetWorth).
- TXN-EDIT-FC-001: amount edit propagates to asset.
- TXN-DEL-FC-002: deletion reverses asset balance.
- New TXN-FC row needed: "Asset baseline can be overridden without
  losing transaction reflection." (TXN-FC-010)

## Risks
- **Drift on existing data**: users will see their assets "re-baseline"
  after migration if they enable the back-fill. Banner copy must be
  unambiguous.
- **Performance**: NetWorth aggregation now scans transactions per asset
  on every render. Mitigation: memoise per-asset deltas in the store;
  recompute only on transaction CRUD.

## Effort: **~3–4 weeks** engineering, ~1 week QA (40 h test rework).

---

# Phase B — Goal Linking (v6.6)

## User story
*"My Emergency Fund goal is fed by deposits into my Ally Savings. When
I record income to that account, my goal progress should update without
me opening the Goal modal."*

## Behaviour spec
- Goal can link to **one or more assets**; positive cash flow into any
  linked asset credits `Goal.current` by the same amount.
- Negative cash flow (withdrawals from a linked asset) **decrements**
  `Goal.current` — the goal reflects the asset's true contribution.
- Debt-type goals auto-link to a `Debt` row; `Goal.current` mirrors
  `Debt.principal - Debt.currentBalance` (amount paid down).
- Manual progress edits are still allowed; create a `goal_adjustment`
  transaction so the audit trail stays intact.

## Data-model changes

```ts
interface Goal {
  // ...existing fields
  linkedAssetIds?: string[];   // NEW — multi-link
  linkedDebtId?: string;       // NEW — for type === 'debt'
  current: number;             // now derived for linked goals
}
```

## UX surface
- Goal modal: "Linked accounts" multi-select; "Linked debt" picker for
  debt-type goals.
- Goal detail: "Sources" sub-list showing per-asset / per-period
  contribution.
- Notification: milestone (50/75/100 %) fires on auto-updates too.

## Test cases affected
- GOAL-FC-003 unblocks (Clarification #2 resolved — auto-update via
  linked asset).
- GOAL-FC-004 unblocks (multi-source contribution becomes natural).
- GOAL-FC-005 (debt goal) simplifies to "verify Goal.current mirrors
  Debt.principal − Debt.currentBalance".

## Risks
- Goal showing **negative** progress on withdrawal will surprise users.
  Mitigation: ship with a "lock progress at peak" toggle (per-goal).
- Multi-link Goal with overlapping assets (one asset feeding two goals)
  would double-credit. Validation: an asset can fund any number of
  goals, but the credit is computed independently per goal — explicit
  in the UI as "Tracking" not "Allocation".

## Effort: **~2 weeks** engineering, ~3 days QA.

---

# Phase C — Budget Surplus Routing (v6.7)

## User story
*"I budgeted $400 for Groceries this month and only spent $320. Sweep
the $80 surplus into my Vacation goal automatically."*

## Behaviour spec
- Each Budget gets an optional `surplusGoalId`.
- At budget period close (cron / first-of-period boot), the surplus is:
  1. Computed as `max(0, limit − spent)`.
  2. Materialised as a `goal_contribution` transaction tagged with
     `budgetId` (provenance).
  3. Credits `Goal.current` via Phase B linkage if the goal is
     linked to an asset; otherwise raw `Goal.current` increment.
- User sees a digest: *"Your March surplus of $80 was routed to Vacation."*

## Data-model changes

```ts
interface Budget {
  // ...existing fields
  surplusGoalId?: string;   // NEW
}

type TxnType = 'income' | 'expense' | 'investment' | 'transfer' | 'goal_contribution'; // NEW value
```

## UX surface
- Budget modal: "When this period ends with money left over, send it
  to…" + Goal dropdown.
- Settings → Notifications: opt-in for the monthly surplus digest.

## Test cases affected
- BDGT-FC-008 unblocks (Clarification #3 resolved — auto-route).
- New BDGT-FC row needed: "Surplus routing respects locked goals."

## Risks
- Period-close logic must be idempotent (boot the app twice on the 1st
  of the month → one surplus transaction, not two). Use
  `materialisedFor: '2026-04'` marker.

## Effort: **~2 weeks** engineering, ~2 days QA.

---

# Phase D — Split Auto-Settlement (v6.8)

## User story
*"When I mark Alice's split as paid, FinFlow should record the $50
income transaction for me — and if I delete that income later, Alice
should pop back to 'unpaid'."*

## Behaviour spec
- Marking a `SplitParticipant.paid = true` auto-creates a settlement
  transaction (`type='income'`, linked back to the split anchor via
  `linkedTxnId`).
- Deleting a settlement transaction auto-flips the corresponding
  participant back to `paid = false`.
- Settlement transactions are tagged so they don't double-count in
  income aggregations (already handled by the existing split
  `yourShare` accounting; settlements are a wash).

## Data-model changes

```ts
interface Transaction {
  // ...existing fields
  isSplitSettlement?: boolean;  // NEW — exempts from primary aggregations
  splitParticipantId?: string;  // NEW — links back to the participant row
}
```

## UX surface
- Splits page: "Settle" button on each participant; modal asks
  destination asset (Phase A linkage).
- Transaction list: settlement rows render with a chain-link icon and
  the source split as a clickable reference.

## Test cases affected
- SPLIT-FC-002 simplifies: marking paid IS the settlement.
- SPLIT-FC-003 unblocks (Clarification #1 resolved through Phase A
  asset linkage).
- SPLIT-FC-005 unblocks (Clarification #5: cascade rules formalised).
- TXN-DEL-FC-004 rewrites: deleting settlement reverses the paid flag.

## Effort: **~1.5 weeks** engineering, ~3 days QA.

---

# Phase E — Recurring Projection Engine (v7.0)

## User story
*"Looking at my Vacation goal, FinFlow should tell me 'On your current
recurring savings of $200/month, you'll hit $5,000 in 18 months — by
2027-11-24'."*

## Behaviour spec
- Active `RecurringSchedule`s are projected forward through
  end-of-deadline windows for goals and current-period for budgets.
- Goal page shows "ETA at current rate" computed from linked-asset
  recurring inflows.
- Budget page shows "Expected remaining" projecting recurring debits
  for the rest of the period.
- Dashboard surfaces "Cash flow forecast" — next 90 days, including
  recurring income, recurring debt payments, recurring transfers.

## Data-model changes
- None to persisted types — pure read-side derivation.
- New utility module: `lib/projection.ts` with deterministic, pure
  functions (testable in isolation).

## UX surface
- Goal page: timeline ribbon with projected vs target deadline.
- Budget page: dual-bar — "Spent so far" + "Projected by month-end".
- Dashboard: collapsible "Forecast" card.

## Test cases affected
- RECUR-FC-007 becomes a deep test rather than a smoke check.
- GOAL-FC-007 unblocks (projection from history + recurring).
- New PERF-FC row: projection must run < 50 ms for 24 active recurrings
  over a 12-month horizon.

## Risks
- Projection on a recurring schedule that ends mid-period is easy to
  get wrong. Tests must cover edge cases (schedule ends 3 days into
  period, skipped instance, frequency changed mid-flight).

## Effort: **~2 weeks** engineering, ~5 days QA.

---

# Phase F — Two-Way Edit & Reconciliation (v7.0 polish)

## User story
*"I have $10,250 in my Chase Checking but FinFlow shows $10,180. Let me
type the real number and have FinFlow either adjust the baseline or
add a reconciling transaction — my choice."*

## Behaviour spec
- Editing a derived asset value opens a sheet:
  - "**Adjust baseline by +$70**" — bumps `openingBalance`; rare,
    used for "I never imported transactions before this date".
  - "**Add reconciling transaction +$70**" — creates a synthetic
    income transaction tagged `reconciliation`; default and recommended.
- Same UX for derived `Goal.current` and `Debt.currentBalance`.
- Reconciliation transactions are flagged in transaction history.

## Data-model changes

```ts
interface Transaction {
  // ...existing fields
  isReconciliation?: boolean;  // NEW — flagged in UI, never excluded from aggregates
}
```

## Conflict resolution (cloud)
- Two devices reconcile simultaneously → both create reconciliation
  transactions, both succeed, sum is correct (commutative).
- Two devices edit the same `openingBalance` → TD-03 optimistic
  concurrency surfaces a conflict; user picks one.

## Test cases affected
- New ERR-FC row: reconciliation surfaces in audit trail.
- SYNC-FC-003 extends: stale `openingBalance` write rejected.

## Effort: **~1.5 weeks** engineering, ~3 days QA.

---

## Cross-phase rollout

### Feature flags
| Flag | Phase | Default |
|---|---|---|
| `VITE_FEATURE_AUTO_ASSET_REFLECTION` | A | off (v6.5) → on (v6.6) |
| `VITE_FEATURE_GOAL_LINKING` | B | off (v6.6) → on (v6.7) |
| `VITE_FEATURE_BUDGET_SURPLUS_ROUTING` | C | off (v6.7) → on (v6.8) |
| `VITE_FEATURE_SPLIT_AUTO_SETTLEMENT` | D | off (v6.8) → on (v7.0) |
| `VITE_FEATURE_PROJECTION_ENGINE` | E | on at v7.0 launch |
| `VITE_FEATURE_RECONCILIATION_UX` | F | on at v7.0 launch |

### Schema migrations
Each phase that adds columns ships a forward-only Supabase migration
script + a localStorage migration in `lib/migration.ts`. Backups
exported on the older schema must remain importable for at least one
major version after the phase lands (current backwards-compatibility
window).

### Test-inventory implications
This roadmap modifies the **expected behaviour** of ~25 designed test
cases in [`TEST_CASE_INVENTORY.md`](../react/e2e/TEST_CASE_INVENTORY.md).
The implementation order is:

1. Build all 157 designed tests using the **current (manual)** defaults
   from the inventory's Clarifications section.
2. As each phase ships, update the affected test IDs in the inventory
   (the test ID never changes — only the expected behaviour).
3. The `🟠 blocked on clarification` counter in the inventory's Progress
   Tracker drops to 0 by end of Phase D (resolves Clarifications #1, #2,
   #3, #5; Clarification #4 — future-date policy — remains a separate
   decision unrelated to auto-linking).

### Effort summary
| Phase | Eng | QA | Calendar |
|---|---:|---:|---|
| A — Asset Reflection | 3–4 weeks | 1 week | v6.5 |
| B — Goal Linking | 2 weeks | 3 days | v6.6 |
| C — Surplus Routing | 2 weeks | 2 days | v6.7 |
| D — Split Auto-Settle | 1.5 weeks | 3 days | v6.8 |
| E — Projection Engine | 2 weeks | 5 days | v7.0 |
| F — Reconciliation UX | 1.5 weeks | 3 days | v7.0 |
| **Total** | **~12 weeks eng** | **~4 weeks QA** | ~4 release cycles |

---

## Open questions for product

1. **Multiple payment methods per asset** — is the relationship
   one-to-many (one asset, many cards/wallets) or also many-to-one
   (a card that draws from multiple sub-accounts)? Phase A assumes
   one-to-many only.
2. **Asset "active" state** — when a user closes a bank account, should
   transactions still attempt to update its balance, or should the
   asset go read-only? Phase A leaves it editable indefinitely.
3. **Goal "lock at peak"** semantics (Phase B) — does locking prevent
   downward movement permanently, or only until the user manually
   unlocks? Default proposal: manual unlock required.
4. **Surplus routing across linked profiles** — multi-household users
   may want surpluses from a Business profile routed to a Personal
   goal. Phase C scope is intra-profile only; cross-profile is a Phase
   G item if validated.

---

*Last reviewed: 2026-05-24. Owners: TBD product + TBD engineering lead.*
