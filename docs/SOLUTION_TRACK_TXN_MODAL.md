# Solution Direction — Track-Specific Transaction Modal

**Status:** Proposed · **Owner:** Product · **Target:** v7.1
**Backend impact:** **Zero** (no schema migration, no cloud column, no RLS change)
**Related:** Item #1 (Track-specific modal) + Item #9 (Type-specific
categories) + sets up Item #6 (in-amount calculator)
**Last reviewed:** 2026-06-02

---

## Problem

The single `TransactionFormModal` serves four mental models (income, spend,
transfer, investment) with one field set and one category list. Users see
"salary" alongside "vendor" alongside "from/to account" on every entry, and
transfers are not modelled at all (the modal has a single account picker —
see TXN-FC-003 `fixme` in [react/e2e/TEST_CASE_INVENTORY.md](../react/e2e/TEST_CASE_INVENTORY.md)).

## Goals

1. One mental model per track; only relevant fields per track.
2. Investment + Transfer become first-class entry tracks.
3. Categories filter to the chosen track (delivers Item #9 entirely).
4. Ship without a database migration.

## Non-goals

- Auto-mutation of `Asset.value` (that is Auto-Linking Phase A in
  [docs/ROADMAP_AUTO_LINKING.md](ROADMAP_AUTO_LINKING.md)).
- Income → goal credit (Phase B).
- Cloud schema additions (`linked_to_asset_id` column waits for the next
  scheduled bump).

## Schema impact

**TypeScript only.** The local adapter persists the full JSON shape; a new
optional field rides inside the existing payload at zero migration cost.

```diff
  // react/src/types.ts
  export interface Transaction {
    /* …existing fields unchanged… */
    linkedAssetId?: string;     // already exists — source / paid-from
+   linkedToAssetId?: string;   // NEW — transfer destination / investment vehicle
  }
```

`ALL_CATEGORIES` is preserved for legacy row rendering. New constants:

```diff
  // react/src/constants.ts
+ export const INVESTMENT_CATEGORIES = [
+   { id: 'investment_in',  label: 'Buy / Contribute', icon: '📈', color: '#E8A87C' },
+   { id: 'investment_out', label: 'Sell / Withdraw',  icon: '📉', color: '#E8A87C' },
+   { id: 'dividend',       label: 'Dividend',         icon: '💵', color: '#85A88A' },
+   { id: 'capital_gain',   label: 'Capital Gain',     icon: '🪙', color: '#6B7C53' },
+   { id: 'rebalance',      label: 'Rebalance',        icon: '⇄',  color: '#4A6FA5' },
+ ] as const;
+
+ export const CATEGORIES_BY_TYPE = {
+   expense:    EXPENSE_CATEGORIES,
+   income:     INCOME_CATEGORIES,
+   investment: INVESTMENT_CATEGORIES,
+   transfer:   [] as const,
+ } as const;
```

## Field map per track

| Field            | Spend | Income | Transfer | Investment |
|------------------|:-----:|:------:|:--------:|:----------:|
| Amount + currency| ✅    | ✅     | ✅       | ✅         |
| Date / time      | ✅    | ✅     | ✅       | ✅         |
| Description      | ✅    | ✅     | optional | ✅         |
| Category         | EXPENSE | INCOME | —     | INVESTMENT |
| From account     | ✅    | —      | ✅       | ✅         |
| To account       | —     | ✅     | ✅       | ✅         |
| Payment method   | ✅    | —      | —        | —          |
| Linked debt      | optional | — | — | — |
| Member           | ✅    | ✅     | optional | ✅         |
| Split            | ✅    | —      | —        | —          |
| Recurring        | ✅    | ✅     | optional | ✅         |
| Excluded         | ✅    | ✅     | ✅       | ✅         |

## UX flow

1. User taps **+ Add Transaction** → 4-card `TrackPicker` (Spend / Income /
   Transfer / Investment).
2. Track chosen → modal renders only that track's field set.
3. **Edit mode** skips the picker — track is locked to the row's `type`.
4. Power users: keys `1/2/3/4` pick a track; `Esc` cancels.

## Files touched

| File | Change | LOC |
|---|---|---:|
| `react/src/components/transactions/TrackPicker.tsx` | **NEW** | ~60 |
| `react/src/components/transactions/TransactionFormModal.tsx` | refactor: gate fields, add track state | ~120 net |
| `react/src/constants.ts` | add `INVESTMENT_CATEGORIES`, `CATEGORIES_BY_TYPE` | ~15 |
| `react/src/types.ts` | add optional `linkedToAssetId` | 1 |
| `react/src/store.ts` | branch `upsertTransaction` for transfer | ~25 |
| `react/src/lib/accounts.ts` | add `excludeId` / `filter` props plumbing | ~10 |

**Net:** ~230 LOC, one new component, no schema migration, no cloud work.

## Transfer encoding (zero-backend)

Two linked rows written atomically by `upsertTransaction`:

- Row A: `type: 'expense'`, `linkedAssetId: source`, `category: 'transfer'`,
  `note: '__tg:<groupId>'`
- Row B: `type: 'income'`,  `linkedAssetId: dest`,   `category: 'transfer'`,
  `note: '__tg:<groupId>'`

Reports already exclude `category === 'transfer'` from spend/income totals →
self-cancelling, no double-count. Deletion of either row removes the
group atomically (cascade keyed off the `__tg:` prefix in `note`).

## Rollout

- Feature-flag in localStorage: `vt_feature_track_picker = '1'`
- Default OFF in v7.0.3 (dogfood), default ON in v7.1
- `trackFlagExposure('vt_feature_track_picker', 'on'|'off')` fires once per
  session — see [MEASUREMENT_PLAN.md](MEASUREMENT_PLAN.md).

## Test inventory deltas

Updates needed in `react/e2e/TEST_CASE_INVENTORY.md`:

- **TXN-FC-003** — un-`fixme`; assert paired rows + balanced sums.
- **TXN-FC-004** — assert `linkedToAssetId` set.
- **NEW TXN-FC-010** — TrackPicker shows 4 tracks; chosen track gates
  category list (S-tier, ~3 h).
- **NEW TXN-FC-011** — Editing a transaction skips the picker (S-tier, ~3 h).

## Success criteria (post-launch, 30 days)

| Metric | Target |
|---|---|
| Spend track usage | ≥ 70 % of `txn_saved` |
| Transfer track adoption | ≥ 5 % of `txn_saved` |
| Median time-to-save (Spend) | < 12 s |
| Median time-to-save (Income) | < 10 s |
| Edit-within-7-days rate | ≥ 20 % drop vs. baseline |
| Per-track abandonment | < 25 % |

All metrics are computed off events defined in
[MEASUREMENT_PLAN.md](MEASUREMENT_PLAN.md).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Two-row transfer drifts in totals | Reports already filter `category === 'transfer'`; add a unit test that asserts the pair sums to zero |
| Legacy rows without `linkedToAssetId` | Optional field; renderer falls back to single-account display |
| User confused by extra picker step | Keyboard shortcuts `1-4`; remember last-used track per session |
| Investment category ids new in v7.1 | `getCat()` fallback in `constants.ts` already handles unknown ids |
