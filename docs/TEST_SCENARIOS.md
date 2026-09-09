# Vyact — Test Scenarios (Master Catalog)

> Single source of truth for every automated test scenario across all Vyact
> apps and layers. This document is **regression-managed**: every PR that adds,
> removes, or renames a scenario MUST update this file in the same commit, and
> the [`test-scenarios-doc`](../scripts/test-scenarios-check.mjs) CI gate refuses
> to merge any drift between this catalog and the code.
>
> Owner: Engineering. Last regenerated: 2026-06-03 (inventory refresh plus
> timebox doc sync; no new master-catalog ID-tagged scenarios were promoted in
> this update, but additional FC-coded consumer E2E specs landed and remain
> tracked in `react/e2e/TEST_CASE_INVENTORY.md` until `CON-E2E-NNN` promotion).
> Governance: [`docs/TEST_GOVERNANCE.md`](TEST_GOVERNANCE.md).

---

## 1. Why this catalog exists

The vitest / Playwright suites are the *executable* test record; this file is
the *human-readable* one. It exists so that:

1. **Audit.** A reviewer can answer "what does our regression suite actually
   cover?" without grepping source.
2. **Change management.** Adding, removing, or renaming a scenario is a
   reviewable diff against this file, not a hidden change inside a test.
3. **Traceability.** Every scenario has a stable ID that survives renames; PRs
   reference the ID, the CHANGELOG references the ID, and the automation run
   report cites the ID per pass / fail.
4. **Coverage visibility.** The summary tables below make it obvious where the
   pyramid is thin (today: admin unit coverage and consumer E2E breadth).

---

## 2. Conventions

### 2.1 Scenario ID format

```
{APP}-{LAYER}-{NNN}
```

| Token | Allowed values | Meaning |
|---|---|---|
| `APP` | `CON` · `ADM` | Consumer app (`react/`) · Admin app (`admin/`) |
| `LAYER` | `UNIT` · `E2E` | Pure-function unit (vitest) · End-to-end browser (Playwright) |
| `NNN` | Zero-padded sequence within (APP, LAYER) | Stable across renames; never reused after deletion |

Examples: `CON-UNIT-006`, `ADM-UNIT-011`, `CON-E2E-003`.

### 2.2 Test title format

Every `it(...)` / `test(...)` title MUST start with the ID, followed by ` · `,
followed by a short human description:

```ts
it('CON-UNIT-006 · [TD-01] round-trip USD→EUR→USD does NOT return exactly the original', () => { … });
test('CON-E2E-004 · seeded data survives a full page reload (persistence guard)', async ({ … }) => { … });
```

The reconciler (`scripts/test-scenarios-check.mjs`) extracts the ID from the
title and compares the set of IDs in code against the set of IDs in this
document. Any mismatch fails the CI gate.

### 2.3 Adding / changing / removing scenarios

| Change | Required in the same PR |
|---|---|
| **Add** a test | Add a row to §4 with a fresh ID (next available in the APP/LAYER sequence); embed the ID in the new test title. |
| **Rename** a test | Update the description column in §4. ID stays. |
| **Delete** a test | Remove the row from §4. The ID is *retired*; do not reuse. |
| **Move** a test between files | Update the File column in §4. ID stays. |
| Mark a test as a **TD characterization** test (asserts current-but-known-bad behaviour pinning a TECH_DEBT item) | Include `[TD-NN]` in the description and the test title. |

---

## 3. Coverage summary

Counts as of 2026-06-03. No new master-catalog ID-tagged tests were promoted
into §4 in this doc refresh; the latest FC-coded consumer E2E additions are
tracked in the functional inventory at `react/e2e/TEST_CASE_INVENTORY.md`
until they are renumbered into stable `CON-E2E-NNN` roster entries.

| App | Layer | Tool | File(s) | Scenarios | TD-characterization |
|---|---|---|---|---|---|
| Consumer | Unit | Vitest | `react/src/lib/__tests__/*.test.ts` | **53** | 6 (`CON-UNIT-006` ↔ TD-01-A; `CON-UNIT-046` ↔ TD-01-B; `CON-UNIT-047` ↔ TD-01-C schedule drift; `CON-UNIT-048` ↔ TD-01-C currency quantisation; `CON-UNIT-051` ↔ TD-03 happy path; `CON-UNIT-052` ↔ TD-03 conflict) |
| Consumer | E2E  | Playwright | `react/e2e/tests/*.spec.ts` | **9** | 3 (`CON-E2E-004` v6.4 cache-no-clobber; `CON-E2E-005` TD-05; `CON-E2E-006` TD-11). `CON-E2E-007/008/009` are functional-case specs from the parallel QA scaffolding stream, renamed during PR #13 review. |
| Admin | Unit | Vitest | `admin/src/lib/__tests__/*.test.ts` | **11** | 0 |
| Admin | E2E  | Playwright | *(none yet)* | 0 | — |
| **Total** | | | | **73** | 9 |

Known coverage gaps (tracked outside this file):

- Admin has no E2E coverage; the privileged surface (role tiers, KPIs) is
  unverified end-to-end. Folded into TD-19 expansion.
- Consumer E2E roster in §4 is still foundation-heavy. Recent FC-coded local
   additions (backup/export, structured search/day-filter, shortcut smoke, and
   corrupt-localStorage boot) are documented in the functional inventory but are
   not yet promoted into stable `CON-E2E-NNN` IDs here.

---

## 4. Roster

> The reconciler treats this section as authoritative. Every ID present in
> code MUST appear in exactly one row here; every row here MUST correspond to
> exactly one test in code.

### 4.1 Consumer · Unit (CON-UNIT)

| ID | File | Description | Notes |
|---|---|---|---|
| CON-UNIT-001 | `react/src/lib/__tests__/format.test.ts` | returns the same amount when from === to | `convert()` short-circuit. |
| CON-UNIT-002 | `react/src/lib/__tests__/format.test.ts` | returns 0 (falsy amount) unchanged | |
| CON-UNIT-003 | `react/src/lib/__tests__/format.test.ts` | converts USD → EUR using the rate table | |
| CON-UNIT-004 | `react/src/lib/__tests__/format.test.ts` | converts a non-USD pair via the USD base (INR → GBP) | Cross-rate path. |
| CON-UNIT-005 | `react/src/lib/__tests__/format.test.ts` | treats an unknown currency code as rate 1 (documented fallback) | |
| CON-UNIT-006 | `react/src/lib/__tests__/format.test.ts` | [TD-01 fixed] round-trip USD→EUR→USD returns exactly the original | **TD-01 phase A regression pin** — was a characterization test for the pre-fix lossy behaviour; flipped to a positive assertion when PR #8 wired `convert()` through dinero.js. |
| CON-UNIT-007 | `react/src/lib/__tests__/format.test.ts` | extracts YYYY-MM from an ISO date | |
| CON-UNIT-008 | `react/src/lib/__tests__/format.test.ts` | nowMonthKey is 7 chars (YYYY-MM) | |
| CON-UNIT-009 | `react/src/lib/__tests__/format.test.ts` | clamps below, within, and above the range | |
| CON-UNIT-010 | `react/src/lib/__tests__/format.test.ts` | returns null for no date | `daysUntil`. |
| CON-UNIT-011 | `react/src/lib/__tests__/format.test.ts` | returns a positive number for a future date | `daysUntil`. |
| CON-UNIT-012 | `react/src/lib/__tests__/calculations.test.ts` | excludes private/excluded txns and isolates investment + transfer | `reportableTxns`. |
| CON-UNIT-013 | `react/src/lib/__tests__/calculations.test.ts` | uses the full amount for non-split txns | `effectiveAmount`. |
| CON-UNIT-014 | `react/src/lib/__tests__/calculations.test.ts` | uses only yourShare for a split txn | `effectiveAmount`. |
| CON-UNIT-015 | `react/src/lib/__tests__/calculations.test.ts` | converts a foreign-currency amount into base | `effectiveAmount`. |
| CON-UNIT-016 | `react/src/lib/__tests__/calculations.test.ts` | sums income/expense within the month and computes net | `monthlyData`. |
| CON-UNIT-017 | `react/src/lib/__tests__/calculations.test.ts` | ignores transactions outside the requested month | `monthlyData`. |
| CON-UNIT-018 | `react/src/lib/__tests__/calculations.test.ts` | income adds, expense subtracts | `totalBalance`. |
| CON-UNIT-019 | `react/src/lib/__tests__/calculations.test.ts` | groups expense totals by category for the month | `spendByCategory`. |
| CON-UNIT-020 | `react/src/lib/__tests__/calculations.test.ts` | totalAssets sums all asset values | |
| CON-UNIT-021 | `react/src/lib/__tests__/calculations.test.ts` | liquidAssets sums only liquid assets | |
| CON-UNIT-022 | `react/src/lib/__tests__/calculations.test.ts` | totalLiabilities sums debt balances | |
| CON-UNIT-023 | `react/src/lib/__tests__/calculations.test.ts` | returns a total in [0,100] with all five components present | `computePulseScore` shape. |
| CON-UNIT-024 | `react/src/lib/__tests__/calculations.test.ts` | higher debt-to-income lowers the debt component | `computePulseScore` ordering. |
| CON-UNIT-025 | `react/src/lib/__tests__/calculations.test.ts` | tallies amounts owed TO you when you paid | `splitsOutstanding`. |
| CON-UNIT-026 | `react/src/lib/__tests__/calculations.test.ts` | tallies what YOU owe when someone external paid | `splitsOutstanding`. |
| CON-UNIT-027 | `react/src/lib/__tests__/amortization.test.ts` | matches the documented £200k @ 5% / 25y example (~£1170/mo) | `computeEmi` correctness. |
| CON-UNIT-028 | `react/src/lib/__tests__/amortization.test.ts` | returns 0 with no principal or no tenure | `computeEmi` edge. |
| CON-UNIT-029 | `react/src/lib/__tests__/amortization.test.ts` | falls back to straight-line when rate is 0 | `computeEmi` edge. |
| CON-UNIT-030 | `react/src/lib/__tests__/amortization.test.ts` | interest = balance * monthly rate; principal = payment - interest | `splitPayment`. |
| CON-UNIT-031 | `react/src/lib/__tests__/amortization.test.ts` | never returns negative principal when payment < interest | `splitPayment` guard. |
| CON-UNIT-032 | `react/src/lib/__tests__/amortization.test.ts` | returns Infinity when EMI does not cover monthly interest | `computeRemainingMonths`. |
| CON-UNIT-033 | `react/src/lib/__tests__/amortization.test.ts` | uses straight-line when rate is 0 | `computeRemainingMonths`. |
| CON-UNIT-034 | `react/src/lib/__tests__/amortization.test.ts` | amortises the balance down toward zero by the final entry | `calculateAmortizationSchedule`. |
| CON-UNIT-035 | `react/src/lib/__tests__/amortization.test.ts` | interest portion decreases while principal portion increases over time | Schedule shape. |
| CON-UNIT-036 | `react/src/lib/__tests__/amortization.test.ts` | a normal payment reduces balance by the principal portion and decrements months | `applyPayment` happy path. |
| CON-UNIT-037 | `react/src/lib/__tests__/amortization.test.ts` | reduce_tenure keeps EMI and shortens the loan on a part-payment | `applyPayment` strategy. |
| CON-UNIT-038 | `react/src/lib/__tests__/amortization.test.ts` | reduce_emi keeps tenure (minus one) and lowers the EMI | `applyPayment` strategy. |
| CON-UNIT-039 | `react/src/lib/__tests__/amortization.test.ts` | aggregates lifetime interest, principal, and YTD from the payment log | `interestSummary`. |
| CON-UNIT-040 | `react/src/lib/__tests__/money.test.ts` | registers all 12 supported currency codes | TD-01 phase A — pins the CURRENCY_REGISTRY contract. |
| CON-UNIT-041 | `react/src/lib/__tests__/money.test.ts` | unknown currency code falls back to USD (documented contract) | TD-01 phase A. |
| CON-UNIT-042 | `react/src/lib/__tests__/money.test.ts` | scales a USD major-unit number to integer cents and back | `toDinero` / `fromDinero` round-trip. |
| CON-UNIT-043 | `react/src/lib/__tests__/money.test.ts` | respects JPY zero-decimals (no minor unit) | Currency-aware scaling. |
| CON-UNIT-044 | `react/src/lib/__tests__/money.test.ts` | no-ops when source and target currencies match | `convertViaUsdRates`. |
| CON-UNIT-045 | `react/src/lib/__tests__/money.test.ts` | post-conversion result is quantised to the target currency's native exponent | The exact fix that resolved `CON-UNIT-006`. |
| CON-UNIT-046 | `react/src/lib/__tests__/calculations.test.ts` | [TD-01 phase B] repeated additions do not drift in float (0.1 problem) | **TD-01 phase B regression pin.** Sums 10 expenses of $0.10 and asserts `totalBalance === -1.00` (strict). Pre-phase-B this drifted to `-1.0000000000000002` because the reducer used JS `+` on `number`; PR #9 migrated the reducer to dinero's `add`. |
| CON-UNIT-047 | `react/src/lib/__tests__/amortization.test.ts` | [TD-01 phase C] 300-row schedule does not accumulate per-step drift | **TD-01 phase C regression pin.** Sums every row's `principal` portion over a 300-month schedule and asserts the total is within £0.01 of the starting balance. Pre-phase-C the chained `outstanding -= principal` drifted by tens of pence by the final row. |
| CON-UNIT-048 | `react/src/lib/__tests__/amortization.test.ts` | [TD-01 phase C] currency-quantised interest is the exact native-minor-unit value | `splitPayment(200000, 5, 1170, 'GBP')` returns `interest === 833.33` strictly (not `833.333333…`); principal computed off the quantised interest is also exact (`336.67`). |
| CON-UNIT-049 | `react/src/lib/__tests__/money.test.ts` | parseMoneyFromCloud accepts string, number, null, undefined, and empty without throwing | TD-01 phase D — pins the supabaseAdapter row-mapper boundary contract. |
| CON-UNIT-050 | `react/src/lib/__tests__/money.test.ts` | parseMoneyFromCloud returns 0 for non-finite inputs (NaN, garbage strings) | Defensive contract: bad row data must not propagate NaN into the math layer. |
| CON-UNIT-051 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | guarded UPDATE with matching updated_at returns the server row | **TD-03 phase A regression pin.** Happy-path compare-and-set. |
| CON-UNIT-052 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | guarded UPDATE with no-rows-matched throws ConcurrencyConflictError | **TD-03 phase A regression pin.** Stale `updated_at` precondition → typed conflict, never silent overwrite. |
| CON-UNIT-053 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | upsert without expectedUpdatedAt skips the guard and uses the legacy upsert path | Back-compat: new records (no version yet) and any not-yet-wired caller fall through to last-write-wins. |
| CON-UNIT-054 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | replaceAll routes each entity to `replace_<entity>` RPC and passes `{h, rows}` payload (members → `replace_memberships`) | **TD-09 client-contract pin.** Pre-PR #20 the client did per-row upserts; PR #20 shipped the six atomic `replace_*` RPCs server-side. This test pins the client routing so a regression to per-row writes is caught at unit-test time. |
| CON-UNIT-055 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | listSince issues `.gte(updated_at, since).order(updated_at asc).limit(n)` and does NOT filter `deleted_at` | **TD-06 client-contract pin** (R1-updated `>` → `>=`). The incremental list MUST include soft-deleted rows so the cache layer can propagate tombstones; ordering matters because the cursor advance relies on `max(updated_at)`. The `>=` boundary stops same-millisecond rows being skipped. |
| CON-UNIT-056 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | listSince partitions live rows vs tombstones and reports `max(updated_at)` for the next cursor | **TD-06 partition pin.** Verifies the response splits cleanly into `{ rows, tombstones, maxUpdatedAt }` so callers can run `cache.upsert(rows) + cache.remove(tombstones)` and advance the cursor in one pass. |
| CON-UNIT-063 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | remove() soft-delete sets `deleted_at` AND bumps `updated_at` so the tombstone rides the delta window | **R1 sync-fix pin.** The delta cursor is `max(updated_at)`; if a delete doesn't advance `updated_at` the tombstone never enters another device's `updated_at >= cursor` window and the row survives as a ghost (case-7 net-worth bug). Asserts both columns are written, to the same instant. |
| CON-UNIT-064 | `react/src/lib/__tests__/recurring.test.ts` | recurringInstanceId is deterministic per (schedule, occurrence-date), distinct across dates/schedules, and a valid UUIDv8 | **R2 sync-fix pin.** A materialised recurring instance must get the same id on every device for a given occurrence so concurrent generation upserts the same row instead of inserting a duplicate transaction. |
| CON-UNIT-077 | `react/src/lib/__tests__/sync.test.ts` | dead-letter buckets: record → count → clear on conflict + failed; `retryDeadLettered` drains back into the main queue (stripping `expectedUpdatedAt`, resetting attempts) and kicks a flush | **TD-26 extraction pin.** `sync/deadLetter.ts` owns the `sync_conflicts` / `sync_failed` buckets and the R5 retry; behaviour must match the pre-extraction `hybridAdapter` (storage keys unchanged). |
| CON-UNIT-078 | `react/src/lib/__tests__/permissionsRole.test.ts` | `resolveMyRole` returns `owner` in local-only mode regardless of any stale session flag, and that role passes `can(…, 'manage_budgets')` and `can(…, 'delete_household')` | **Phase-0 pin.** `myRole` was never populated in local-only mode (its only writer sat behind a `cloudEnabled` guard), so `can()` fell through to deny-by-default and every write-gated screen rendered read-only — including in Lane A, which blinded the whole e2e suite to write journeys. |
| CON-UNIT-079 | `react/src/lib/__tests__/permissionsRole.test.ts` | a signed-out CLOUD user resolves to `undefined`, never `owner`; `can()` then grants `view` and denies `manage_budgets`, `delete_household`, `edit_household_settings` | **Privilege-escalation guard.** The previous fallback keyed on "no session" rather than "no cloud", so a signed-out cloud user resolved to `owner`. Unreachable while nothing called it in that state — live the moment `App.tsx` began calling it on boot. This test fails against the old implementation. |
| CON-UNIT-080 | `react/src/lib/__tests__/permissionsRole.test.ts` | a signed-in cloud user gets exactly their membership role; a null or absent membership row yields `undefined`, and a `viewer` is not silently upgraded | **Policy pin.** Keeps the two halves of the permission rule (`resolveMyRole` = who you are, `can` = what that allows) provably consistent now that they live side by side in `lib/permissions.ts`. |
| CON-UNIT-081 | `react/src/lib/__tests__/accountPatchSafety.test.ts` | a metadata-only account patch (name/kind/currency/flags) sends NO `opening_balance`, `reconciliation_offset` or `reconciliation_log` column at all | **Audit F1 · data-loss guard.** `accountToRow` read `?? 0` / `?? []`, so on an upsert a rename wrote zero over the opening balance and emptied the reconciliation history — silently, under an "Account updated" toast. All three columns are NOT NULL *with DB defaults*, so omission is correct on INSERT and preserving on UPDATE. **This test fails against the pre-fix implementation.** |
| CON-UNIT-082 | `react/src/lib/__tests__/accountPatchSafety.test.ts` | financial values ARE written when the caller supplies them (reconcile sends `{...account, ...patch}`) | **Over-correction guard.** The fix must not swing into never persisting financial state; reconcile depends on these columns reaching the database. |
| CON-UNIT-083 | `react/src/lib/__tests__/accountPatchSafety.test.ts` | an explicit `0` / `[]` is written as an explicit value, not treated as "unspecified" | **The `?? 0` vs `!== undefined` distinction.** Without this, the fix introduces the mirror-image bug: a user could never deliberately set an opening balance to zero. |
| CON-UNIT-084 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | a soft-delete that affects zero rows throws `WriteNotAppliedError` with an actionable message | **Silent-write-loss guard (defects 5 and 7).** An RLS-blocked UPDATE does not raise — it matches zero rows and returns `{ error: null }`, so `if (error) throw` saw a clean success, the store dropped the row from local state, the UI said "Deleted", and the next sync pulled it back. |
| CON-UNIT-085 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | `deleteHousehold` affecting zero rows throws rather than resolving | **Same shape, hard delete.** The households DELETE policy is `role_in(id) = 'owner'`; a non-owner previously got a "Profile deleted" toast and a household that was still there. |
| CON-UNIT-086 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | a write that DID apply still resolves silently | **Over-correction guard.** One row back is the normal case and must not become an error. |
| CON-UNIT-087 | `react/src/lib/__tests__/recurring.test.ts` | every id `backfillSchedulesFromTransactions` mints is a valid UUID, and never the old `bf-` shape | **The recurring-resurrection defect.** Backfilled ids were `` `bf-${txn.id}` ``, which is not a UUID, while `recurring_schedules.id` IS a `uuid` column — so every backfilled schedule died on write with `22P02`, silently (the write was wrapped in `catch {}`). That is why the table is empty in production while schedules appear in the app. **This test fails against the pre-fix implementation.** |
| CON-UNIT-088 | `react/src/lib/__tests__/recurring.test.ts` | the same source transaction always derives the same schedule id; a different one derives a different id | **Convergence, not randomness.** Two devices running the migration independently must land on one row rather than duplicate it — the same reason `recurringInstanceId` is deterministic (CON-UNIT-064). |
| CON-UNIT-089 | `react/src/lib/__tests__/recurring.test.ts` | an unstorable schedule id is replaced with a UUID **and** every transaction referencing it is repointed | **The legacy re-key.** `transactions.recurring_schedule_id` is an FK to this table, and the adapter's `fkOrNull` silently nulls any non-UUID — so cloud transactions had already lost the link. Rewriting the schedule id without remapping the transactions would break it locally too. |
| CON-UNIT-090 | `react/src/lib/__tests__/recurring.test.ts` | two devices holding the same schedule derive the SAME id; a materially different schedule derives a different one | **Why deterministic, not random.** Each device holds its own local copy. Random ids would have device A upload eleven rows and device B upload its own eleven — the duplicate-household pattern again. Content-derived ids let the upsert collapse them into one. |
| CON-UNIT-091 | `react/src/lib/__tests__/recurring.test.ts` | schedules that already have a valid UUID are untouched, and re-running the migration changes nothing | **Idempotency.** A localStorage sentinel guards it in production, but the function must be safe to run twice regardless — sentinels get cleared. |
| CON-UNIT-092 | `react/src/lib/__tests__/recurring.test.ts` | creating a schedule on the 8th for the 20th falls due THIS month, not next | **The skipped month.** `computeNextDueDate` always steps ONE period on from its base, so the 20th of the current month — which had not happened yet — was passed over and the first bill landed a month late. |
| CON-UNIT-093 | `react/src/lib/__tests__/recurring.test.ts` | a day-of-month that has already passed rolls forward to next month | The other half of CON-UNIT-092: rolling forward is correct HERE, and the fix must not overcorrect into always using the current month. |
| CON-UNIT-094 | `react/src/lib/__tests__/recurring.test.ts` | editing a schedule never moves its due date into the past | **The reported defect.** The form passed `lastGenerated: undefined`, so the base was the schedule's ORIGINAL startDate — editing one that began 2026-05-22 produced 2026-06-02, three months back. `dueSchedules` then matched it and the engine materialised a back-dated transaction per refresh. |
| CON-UNIT-095 | `react/src/lib/__tests__/recurring.test.ts` | a 31st clamps to the last day of a short month instead of rolling over | February has no 31st. Rolling into March would move the bill a whole month; clamping keeps it in the month the user chose. |
| CON-UNIT-096 | `react/src/lib/__tests__/recurring.test.ts` | the engine refuses to materialise an occurrence older than the catch-up horizon | **Defence in depth.** The source of corrupt dates is fixed, but schedules carrying one already exist on devices. A genuine offline gap still catches up; half a year of invented history does not. |
| CON-UNIT-097 | `react/src/lib/__tests__/recurring.test.ts` | re-keying reports the old ids for eviction, and content-identical twins collapse to one row | **The v10.20.5 duplication.** Re-keying changes the PRIMARY KEY, so writing the re-keyed schedule inserted a second row and left the original in the cache. The next load listed both, and deleting one of the pair left the other — which read as "delete doesn't work". |
| CON-UNIT-098 | `react/src/lib/__tests__/recurring.test.ts` | collapsing twins keeps the one that has fired furthest | Rewinding to an untouched twin would re-generate an occurrence already materialised. |
| CON-UNIT-099 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | a different user signing in gets none of the previous user's cached data | **Privacy.** The adapter answers from the local cache before the network replies, so a shared device could show user A's ledger to user B. Covers the legacy `ff_*` namespace too. |
| CON-UNIT-100 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | the same user keeps their cache | Purging on every sign-in would throw away offline work and make every cold start a full re-fetch. The cache is dropped when it cannot be TRUSTED, not on a schedule. |
| CON-UNIT-101 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | a stale cache epoch forces a purge even for the same user | **The shipped reset lever.** Bumping `CACHE_EPOCH` makes every device drop its cache once at next sign-in — the only way to stop a device re-uploading rows the cloud no longer has. |
| CON-UNIT-102 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | the unsynced write queue and device preferences survive a purge | Dropping `sync_queue` would be DATA LOSS — those are the user's own changes that have not reached the server. They flush after the purge. |
| CON-UNIT-103 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | cache-describing sentinels are cleared alongside the data | `cloud_synced_*` tells the adapter it has already seen a non-empty cloud result. Leaving it behind after wiping the data it describes is how a reset fails halfway. |
| CON-UNIT-104 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | signing out leaves no ledger on the device | The same privacy problem as CON-UNIT-099, deferred. `last_cloud_hid` is deliberately preserved so the next sign-in lands on the right household. |
| CON-UNIT-076 | `react/src/lib/__tests__/sync.test.ts` | `enqueue`/`readQueue`/`writeQueue` round-trip via storage; the poisoned-op (non-UUID) replay partitions cleanly from valid ops | **TD-26 extraction pin + queue-replay regression.** `sync/syncQueue.ts` owns `sync_queue` persistence; the seeded poisoned-op replay reproduces the v6.4.2 jam-prevention drop without driving the whole adapter. |
| CON-UNIT-075 | `react/src/lib/__tests__/sync.test.ts` | `isQueueOpIdValid`: `upsert`/`remove` require a UUID id; id-less ops (`updateProfile`/`upsertRate`/`replaceAll`) are always valid | **TD-26 extraction pin.** The uuid-PK guard that stops a legacy non-UUID id from jamming the flush, now isolated and unit-tested. |
| CON-UNIT-074 | `react/src/lib/__tests__/sync.test.ts` | `classifyFlushError`: a transient error retries with incremented attempts + a backoff window, then dead-letters at `MAX_RETRIES` | **TD-26 extraction pin.** `sync/conflict.ts` encapsulates the TD-10 bounded-retry decision (pure, no storage/logging). |
| CON-UNIT-073 | `react/src/lib/__tests__/sync.test.ts` | `classifyFlushError`: a `ConcurrencyConflictError` is terminal (`{kind:'conflict'}`), never retried | **TD-26 extraction pin.** The TD-03 rule — a conflict's precondition won't re-match, so it must dead-letter to `sync_conflicts`, not loop. |
| CON-UNIT-072 | `react/src/lib/__tests__/sync.test.ts` | `backoffMs` is exponential 2/4/8/16/32s capped at 60s; `MAX_RETRIES===5` | **TD-26 extraction pin.** `sync/backoff.ts` — the TD-10 retry policy, isolated. |
| CON-UNIT-071 | `react/src/lib/__tests__/faults.test.ts` | `droppedWrite()` is always an `unexpected` fault so silent write-loss is observable | **TD-24 fault-taxonomy pin.** A user write the sync queue can't honour (e.g. non-UUID id) is dropped; it must produce a structured `unexpected` record, not a mute `console.warn` — the silent-write-loss class behind the v9.3.x budget dead-letters. |
| CON-UNIT-070 | `react/src/lib/__tests__/faults.test.ts` | `expected()` records a degraded fault but NEVER reaches the transport | **TD-24 fault-taxonomy pin.** Offline-first degraded paths (cache miss, best-effort storage) stay quiet and never escalate to the Sentry-style sink — so unexpected faults aren't drowned out. |
| CON-UNIT-069 | `react/src/lib/__tests__/faults.test.ts` | `unexpected()` records exactly one structured fault and forwards it to the transport once | **TD-24 fault-taxonomy pin.** A forced contract violation must yield exactly one structured record + one transport hand-off (the acceptance criterion); never throws, so the offline-happy path is unbroken. |
| CON-UNIT-068 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | `createBudgetChecked` maps a 23505/`BUDGET_EXISTS` RPC error to a typed `BudgetExistsError` | **v9.3.3 budget-identity pin.** The DB authority raises `BUDGET_EXISTS` when a slot is taken (incl. another member's unsynced budget); the adapter must surface it as a typed error the UI can present, never a silent dead-letter. |
| CON-UNIT-067 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | a new budget routes to `upsert_budget(create)` with **no client id** and `period:"monthly"`, then maps the row back | **v9.3.3 budget-identity pin.** Budget creates go through the DB `upsert_budget` RPC (the single identity authority); the client must NOT send an id (the DB mints it — retiring the v9.3.1 deterministic-id coupling). |
| CON-UNIT-066 | `react/src/lib/__tests__/supabaseAdapter.test.ts` | a new scope-based budget (no `period` field) serializes `period:"monthly"`, never null | **v9.3.2 budget-sync pin.** `budgets.period` is a legacy NOT-NULL column; the v9.1 form never sends it. Mapping the missing value to an explicit `null` violated NOT NULL → the create threw, dead-lettered, and never reached the cloud (the "new July budget doesn't sync" bug). Pins the `'monthly'` default in `budgetToRow`. |
| CON-UNIT-057 | `react/src/lib/__tests__/storage.test.ts` | kvStore round-trips JSON via the localStorage fallback when IndexedDB is unavailable | **TD-14 substrate pin.** Locks the fallback path that runs in jsdom-less unit tests and on browsers/contexts without IDB; also exercises `kvRemove` and the read-after-delete null contract. |
| CON-UNIT-058 | `react/src/lib/__tests__/storage.test.ts` | quota errors from `localStorage.setItem` fan out via `storageEvents`; `isQuotaError` recognises all four common shapes (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, legacy code `22`, message substring); a throwing listener does not break the writer | **TD-14 surfacing pin.** Pre-TD-14 every storage write was wrapped in `try { … } catch { /* noop */ }` so users never saw quota failures. This test pins the new fan-out so a regression to silent-swallow is caught immediately. |
| CON-UNIT-059 | `react/src/lib/__tests__/storage.test.ts` | kvGet falls back to a legacy `ff_` key when no `vt_` value exists, and a `vt_` value beats a coexisting stale `ff_` value | **TD-14 migration pin.** Ensures the read-through migration from the v5 prefix to the v6 prefix works transparently and that downgrades cannot resurrect stale legacy data once a vt-prefixed write has happened. |
| CON-UNIT-105 | `react/src/lib/__tests__/outbox.test.ts` | enqueue assigns a stable opId and a monotonic seq | Audit F6 — the durable outbox. The old queue snapshotted storage, awaited I/O, then overwrote the key with its own remaining list, erasing ops enqueued during the flush. Per-op rows with claim/ack by id cannot erase an op they never claimed. |
| CON-UNIT-106 | `react/src/lib/__tests__/outbox.test.ts` | claim marks ops and a second claim while fresh returns nothing | Audit F6 — the durable outbox. The old queue snapshotted storage, awaited I/O, then overwrote the key with its own remaining list, erasing ops enqueued during the flush. Per-op rows with claim/ack by id cannot erase an op they never claimed. |
| CON-UNIT-107 | `react/src/lib/__tests__/outbox.test.ts` | THE RACE — an op enqueued DURING a flush survives it | Audit F6 — the durable outbox. The old queue snapshotted storage, awaited I/O, then overwrote the key with its own remaining list, erasing ops enqueued during the flush. Per-op rows with claim/ack by id cannot erase an op they never claimed. |
| CON-UNIT-108 | `react/src/lib/__tests__/outbox.test.ts` | backoff — an op inside nextRetryAt is not claimed; release re-queues it | Audit F6 — the durable outbox. The old queue snapshotted storage, awaited I/O, then overwrote the key with its own remaining list, erasing ops enqueued during the flush. Per-op rows with claim/ack by id cannot erase an op they never claimed. |
| CON-UNIT-109 | `react/src/lib/__tests__/outbox.test.ts` | a stale claim (dead tab) is reclaimable by another worker | Audit F6 — the durable outbox. The old queue snapshotted storage, awaited I/O, then overwrote the key with its own remaining list, erasing ops enqueued during the flush. Per-op rows with claim/ack by id cannot erase an op they never claimed. |
| CON-UNIT-110 | `react/src/lib/__tests__/outbox.test.ts` | owner filtering — user B never claims user A\ | Audit F6 — the durable outbox. The old queue snapshotted storage, awaited I/O, then overwrote the key with its own remaining list, erasing ops enqueued during the flush. Per-op rows with claim/ack by id cannot erase an op they never claimed. |
| CON-UNIT-111 | `react/src/lib/__tests__/outbox.test.ts` | the legacy localStorage queue migrates in once, ownerless, and is removed | Audit F6 — the durable outbox. The old queue snapshotted storage, awaited I/O, then overwrote the key with its own remaining list, erasing ops enqueued during the flush. Per-op rows with claim/ack by id cannot erase an op they never claimed. |
| CON-UNIT-112 | `react/src/lib/__tests__/outbox.test.ts` | ack removes exactly one op; pendingCountSync tracks mutations | Audit F6 — the durable outbox. The old queue snapshotted storage, awaited I/O, then overwrote the key with its own remaining list, erasing ops enqueued during the flush. Per-op rows with claim/ack by id cannot erase an op they never claimed. |
| CON-UNIT-113 | `react/src/lib/__tests__/loanPayment.test.ts` | maps the command to the RPC contract exactly | Audit F2 — `record_loan_payment` is atomic and idempotent on `operation_id`. These pin the RPC contract, that a server-side rejection THROWS rather than reporting a silent success, and that a retry returns the original ids. |
| CON-UNIT-114 | `react/src/lib/__tests__/loanPayment.test.ts` | a server-side rejection (bad split, tenancy, role) THROWS — never a silent success | Audit F2 — `record_loan_payment` is atomic and idempotent on `operation_id`. These pin the RPC contract, that a server-side rejection THROWS rather than reporting a silent success, and that a retry returns the original ids. |
| CON-UNIT-115 | `react/src/lib/__tests__/loanPayment.test.ts` | an idempotent retry returns duplicate with the ORIGINAL ids | Audit F2 — `record_loan_payment` is atomic and idempotent on `operation_id`. These pin the RPC contract, that a server-side rejection THROWS rather than reporting a silent success, and that a retry returns the original ids. |
| CON-UNIT-116 | `react/src/lib/__tests__/loanPayment.test.ts` | a transport error propagates (the caller toasts the failure) | Audit F2 — `record_loan_payment` is atomic and idempotent on `operation_id`. These pin the RPC contract, that a server-side rejection THROWS rather than reporting a silent success, and that a retry returns the original ids. |
| CON-UNIT-117 | `react/src/lib/__tests__/loanPayment.test.ts` | an unresolved PostgREST { error } now throws (it used to be ignored) | Audit F2 — `record_loan_payment` is atomic and idempotent on `operation_id`. These pin the RPC contract, that a server-side rejection THROWS rather than reporting a silent success, and that a retry returns the original ids. |
| CON-UNIT-118 | `react/src/lib/__tests__/learnJsonLd.test.ts` | a script-closing sequence in CMS content cannot break out | Audit S4 — CMS content cannot break out of the JSON-LD script block in the public Learn page. |
| CON-UNIT-119 | `react/src/lib/__tests__/netWorthProjection.test.ts` | asset side = live account balances + unlinked legacy assets (archived excluded) | Audit F3 — one canonical net-worth projection shared by Dashboard, Net Worth and Ask Vyact. Standalone liability accounts now count; archived accounts do not. |
| CON-UNIT-120 | `react/src/lib/__tests__/netWorthProjection.test.ts` | liability side = live credit_card/loan account balances + unlinked debts, receivables excluded, linked debt counted once | Audit F3 — one canonical net-worth projection shared by Dashboard, Net Worth and Ask Vyact. Standalone liability accounts now count; archived accounts do not. |
| CON-UNIT-121 | `react/src/lib/__tests__/netWorthProjection.test.ts` | a NEW account with no asset/debt row moves the projection (the audit\ | Audit F3 — one canonical net-worth projection shared by Dashboard, Net Worth and Ask Vyact. Standalone liability accounts now count; archived accounts do not. |
| CON-UNIT-122 | `react/src/lib/__tests__/netWorthProjection.test.ts` | Ask Vyact\ | Audit F3 — one canonical net-worth projection shared by Dashboard, Net Worth and Ask Vyact. Standalone liability accounts now count; archived accounts do not. |
| CON-UNIT-123 | `react/src/lib/__tests__/fxCentralization.test.ts` | convert() is units-per-USD and is the convention every surface uses | Audit F4 — a single FX path. Transactions totals convert per row, and the inverted ratio in `aiSummary` is fixed. |
| CON-UNIT-124 | `react/src/lib/__tests__/fxCentralization.test.ts` | SafeSummary converts a foreign-currency debt CORRECTLY (not the inverted ratio) | Audit F4 — a single FX path. Transactions totals convert per row, and the inverted ratio in `aiSummary` is fixed. |
| CON-UNIT-125 | `react/src/lib/__tests__/pulseBudget.test.ts` | a container budget is compliance-checked via its ALLOCATIONS (overspend now registers) | Audit F5 — Pulse and the AI read allocation-derived budget lines. On-budget (≤100%) scores full and overspend degrades, which is the semantics change behind the golden-snapshot update. |
| CON-UNIT-126 | `react/src/lib/__tests__/pulseBudget.test.ts` | on/under budget scores FULL; exactly-100% is not zero | Audit F5 — Pulse and the AI read allocation-derived budget lines. On-budget (≤100%) scores full and overspend degrades, which is the semantics change behind the golden-snapshot update. |
| CON-UNIT-127 | `react/src/lib/__tests__/pulseBudget.test.ts` | a legacy category budget (no scope) still applies every month | Audit F5 — Pulse and the AI read allocation-derived budget lines. On-budget (≤100%) scores full and overspend degrades, which is the semantics change behind the golden-snapshot update. |
| CON-UNIT-128 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | the generation advances on every purge | **Runs against fake-indexeddb.** The v10.20.7 suite used a localStorage polyfill and passed while the code cleared nothing in a browser — the cache lives in IndexedDB. These pin the real path: cross-user purge, same-user retention, the epoch lever, write-queue survival, and the generation guard that stops an in-flight cloud read refilling a cache that was just cleared. |
| CON-UNIT-129 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | a read that started before the purge is rejected after it | **Runs against fake-indexeddb.** The v10.20.7 suite used a localStorage polyfill and passed while the code cleared nothing in a browser — the cache lives in IndexedDB. These pin the real path: cross-user purge, same-user retention, the epoch lever, write-queue survival, and the generation guard that stops an in-flight cloud read refilling a cache that was just cleared. |
| CON-UNIT-130 | `react/src/lib/__tests__/cacheInvalidation.test.ts` | purging twice is safe and keeps advancing | **Runs against fake-indexeddb.** The v10.20.7 suite used a localStorage polyfill and passed while the code cleared nothing in a browser — the cache lives in IndexedDB. These pin the real path: cross-user purge, same-user retention, the epoch lever, write-queue survival, and the generation guard that stops an in-flight cloud read refilling a cache that was just cleared. |
| CON-UNIT-131 | `react/src/lib/__tests__/ordering.test.ts` | a back-dated row written today does not outrank a later-dated one | **Order is not a contract.** Reported 2026-09-08: the dashboard stopped being reverse-chronological and showed August's budget in September. Both bugs came from code that leaned on incidental array order, or on `created_at` (when the row was WRITTEN) instead of the transaction date. Clearing the local cache in v10.20.7 changed the array source and exposed them. |
| CON-UNIT-132 | `react/src/lib/__tests__/ordering.test.ts` | created_at breaks ties WITHIN a day, newest entry first | **Order is not a contract.** Reported 2026-09-08: the dashboard stopped being reverse-chronological and showed August's budget in September. Both bugs came from code that leaned on incidental array order, or on `created_at` (when the row was WRITTEN) instead of the transaction date. Clearing the local cache in v10.20.7 changed the array source and exposed them. |
| CON-UNIT-133 | `react/src/lib/__tests__/ordering.test.ts` | an explicit time still wins, and ordering is total | **Order is not a contract.** Reported 2026-09-08: the dashboard stopped being reverse-chronological and showed August's budget in September. Both bugs came from code that leaned on incidental array order, or on `created_at` (when the row was WRITTEN) instead of the transaction date. Clearing the local cache in v10.20.7 changed the array source and exposed them. |
| CON-UNIT-134 | `react/src/lib/__tests__/ordering.test.ts` | only the current month survives, whatever the array order | **Order is not a contract.** Reported 2026-09-08: the dashboard stopped being reverse-chronological and showed August's budget in September. Both bugs came from code that leaned on incidental array order, or on `created_at` (when the row was WRITTEN) instead of the transaction date. Clearing the local cache in v10.20.7 changed the array source and exposed them. |
| CON-UNIT-135 | `react/src/lib/__tests__/ordering.test.ts` | an annual budget covers every month of its year | **Order is not a contract.** Reported 2026-09-08: the dashboard stopped being reverse-chronological and showed August's budget in September. Both bugs came from code that leaned on incidental array order, or on `created_at` (when the row was WRITTEN) instead of the transaction date. Clearing the local cache in v10.20.7 changed the array source and exposed them. |
| CON-UNIT-155 | `react/src/lib/__tests__/categoryModel.test.ts` | transport is no longer offered, travel is, and it carries the route icon | **The merge.** The two categories were indistinguishable in practice — a taxi to the airport and the flight it fed were filed apart. The icon is the route, not a car or a plane, because neither described the whole of it. |
| CON-UNIT-156 | `react/src/lib/__tests__/categoryModel.test.ts` | the five requested categories exist with distinct ids, labels and icons | Also asserts no two categories share a glyph or a label: a duplicated icon makes two categories indistinguishable in the picker, which is how transport/travel got into this state. |
| CON-UNIT-157 | `react/src/lib/__tests__/categoryModel.test.ts` | every offered expense category has a needs/wants classification | Pulse, the 50/30/20 split and the planner all read `NEEDS_WANTS_MAP`. A category missing from it drops silently out of those calculations rather than failing. |
| CON-UNIT-158 | `react/src/lib/__tests__/categoryModel.test.ts` | a stored transport row still resolves — label and classification | `transport` is RETIRED, not deleted: historical rows carry it until the migration runs, and a device whose cache predates the migration keeps sending it. |
| CON-UNIT-159 | `react/src/lib/__tests__/categoryModel.test.ts` | travel is a need and the holiday half is the want | The merge changed what `travel` MEANS — getting around, not a holiday. Leaving it a want would misstate the needs/wants split for every household that commutes. |
| CON-UNIT-160 | `react/src/lib/__tests__/categoryModel.test.ts` | type-scoping still holds — no category is offered for both types | Guards the v9 binding rule that transfers and investments carry NO category (DB `ck_txn_category_by_type`). |
| CON-UNIT-161 | `react/src/lib/__tests__/categoryModel.test.ts` | the WhatsApp parser accepts exactly what the app offers | **Drift guard.** The server sets are Deno modules and cannot import the client constants, so three copies exist. Drift is silent: a category the app offers is rejected as unknown, and a logged expense lands in "other". |
| CON-UNIT-162 | `react/src/lib/__tests__/categoryModel.test.ts` | the agent accepts exactly what the app offers | The other half of CON-UNIT-161, for `_shared/agent/types.ts`. Proven to fail on a single missing id. |

### 4.2 Consumer · E2E (CON-E2E)

| ID | File | Description | Notes |
|---|---|---|---|
| CON-E2E-001 | `react/e2e/tests/smoke.spec.ts` | boots into the dashboard in local-only mode | App-shell smoke. |
| CON-E2E-002 | `react/e2e/tests/smoke.spec.ts` | does not render a cloud auth screen | Confirms local-only env. |
| CON-E2E-003 | `react/e2e/tests/smoke.spec.ts` | seeded transactions are visible on the Transactions page | Seed fixture wiring. |
| CON-E2E-004 | `react/e2e/tests/smoke.spec.ts` | seeded data survives a full page reload (persistence guard) | Regression guard for the v6.4 cache-no-clobber fix. |
| CON-E2E-005 | `react/e2e/tests/error-boundary.spec.ts` | shows fallback UI when a child throws | Regression guard for **TD-05** (PR #4). Navigates to `/__e2e_error` (a page that throws on render) and asserts the boundary's fallback + reset. |
| CON-E2E-006 | `react/e2e/tests/code-splitting.spec.ts` | Recharts lazy-loads only when chart pages are visited | Regression guard for **TD-11** (PR #5). Asserts Recharts is NOT requested on `/transactions` but IS requested after navigating to `/dashboard`. |
| CON-E2E-007 | `react/e2e/tests/transactions-create.spec.ts` | [TXN-FC-001] creates an income transaction with the minimum required fields | Functional-case spec landed via the QA scaffolding stream. Originally tagged `TXN-FC-001`; renamed during PR #13 review to follow the established `CON-E2E-NNN` convention while preserving the FC reference for the QA team. |
| CON-E2E-008 | `react/e2e/tests/debts-payment.spec.ts` | [DEBT-FC-002] payment splits interest and principal at the configured APR | Functional-case spec; renamed during PR #13 review. End-to-end check of the same math that `CON-UNIT-030/048` pin at the unit level. |
| CON-E2E-009 | `react/e2e/tests/networth-impact.spec.ts` | [NWRT-FC-002] income to a linked account moves NetWorth total assets | Functional-case spec; renamed during PR #13 review. Cross-module assertion (Transactions → NetWorth). |
| CON-E2E-024 | `react/e2e/tests/permissions-local.spec.ts` | [PERM-FC-001] in local-only mode the Budgets page renders the "+ Add Budget" affordance, shows no "View only" marker, and `__ff_store` reports `myRole === 'owner'` | **Suite-integrity pin.** Lane A runs local-only; before Phase 0 `myRole` was `undefined` there, so every write-gated control was unrendered and no e2e test could reach a write journey. A failure here means the suite has silently stopped testing writes — not that one screen broke. |
| CON-E2E-025 | `react/e2e/tests/permissions-local.spec.ts` | [PERM-FC-002] clicking "+ Add Budget" opens the budget dialog | **Reachability pin.** A visible button is not a reachable editor. This is the step CON-E2E-017..023 could never perform, which is why four of the eight v10.20 defect reports sat behind a green suite. |
| CON-E2E-026 | `react/e2e/lane-b/constraints.spec.ts` | [CLOUD-FC-001] inserting two allocations for the SAME category into one budget is rejected with `23505` by `uq_balloc_cat`, and exactly one row survives | **Lane B · the reason it exists.** Lane A runs localStorage-only, where there is no database and nothing to violate — calling `saveBudgetWithAllocations` with a duplicate category there resolves and stores both rows. This is the payload the budget editor produces today (defects 1 and 3), and only a real Postgres can reject it. |
| CON-E2E-027 | `react/e2e/lane-b/constraints.spec.ts` | [CLOUD-FC-002] the same category in a DIFFERENT budget period is accepted | **Over-correction guard.** The constraint is scoped to `(budget_id, category)`. A fix for the duplicate bug that de-duplicated on category alone would silently stop a category being budgeted next month. |
| CON-E2E-028 | `react/e2e/lane-b/rls-isolation.spec.ts` | [CLOUD-FC-003] Alice cannot read Bob's household, memberships or transactions; Bob can read his own | **The negative isolation test** `e2e/README.md` calls "most importantly". Asserted through clients authenticated as real users, never the service role — which bypasses RLS and would pass against a database with no policies at all. The positive control (Bob sees his own row) stops it passing against an empty database. |
| CON-E2E-029 | `react/e2e/lane-b/rls-isolation.spec.ts` | [CLOUD-FC-004] Alice's UPDATE and DELETE against Bob's transaction affect **zero rows**, and the row survives unchanged | **Cause-A pin.** A blocked write returns success with no error — verified directly against the schema (`row_count = 0`, no exception). That silent-no-op is the mechanism behind defects 5 and 7, so the assertion is on rows affected, never on the absence of an error. |
| CON-E2E-030 | `react/e2e/lane-b/rls-isolation.spec.ts` | [CLOUD-FC-005] Alice cannot INSERT a row addressed at Bob's household (`42501`) | **Write-side isolation.** Reads and writes are governed by separate policies; covering only reads would leave cross-household injection untested. |
| CON-E2E-031 | `react/e2e/lane-b/account-patch.spec.ts` | [CLOUD-FC-006] the audit's acceptance test verbatim — reconcile an account, rename it through the real `SupabaseAdapter`, reload from cloud, and assert balance, offset and history are unchanged | **Audit F1 · end-to-end proof.** CON-UNIT-081 pins the payload; this proves the row that actually lands in Postgres. Drives the production adapter under the actor's own RLS, so it exercises the browser's exact code path. Lane A could never show this — it has no database to lose data in. |
| CON-E2E-032 | `react/e2e/lane-b/account-patch.spec.ts` | [CLOUD-FC-007] archiving an account is likewise metadata-only and preserves its opening balance | **Same path, different field.** An archived account still carries history; zeroing it would corrupt net worth silently the moment it were unarchived. |
| CON-E2E-033 | `react/e2e/lane-b/write-not-applied.spec.ts` | [CLOUD-FC-008] a soft-delete the caller is not permitted to make rejects with `WriteNotAppliedError`, and the row is verifiably untouched from its owner's side | **Proves the premise, not just the mock.** CON-UNIT-084 asserts the adapter's row-count check with a stub; this proves a REAL policy really does refuse silently. If Postgres ever started raising instead, the mocks would keep passing and only this file would notice. |
| CON-E2E-034 | `react/e2e/lane-b/write-not-applied.spec.ts` | [CLOUD-FC-009] deleting another user's household rejects, and the household survives | **Defect 5's mechanism, closed.** Verified from the owner's side, because an empty read for the attacker would prove nothing. |
| CON-E2E-035 | `react/e2e/lane-b/write-not-applied.spec.ts` | [CLOUD-FC-010] the owner's own delete still tombstones normally | **The legitimate path must keep working** — a guard that rejects everything is not a fix. |
| CON-E2E-036 | `react/e2e/tests/recurring-lifecycle.spec.ts` | a schedule created for the Xth with a chosen account falls due THIS month, once | Covers the create path end to end, including the account picker that did not exist before v10.20.6, and asserts a single list row (the duplication guard). |
| CON-E2E-037 | `react/e2e/tests/recurring-lifecycle.spec.ts` | a day already past this month rolls forward, never backwards | The UI-level guard for CON-UNIT-094: a schedule must never be born overdue, because the engine acts on that date. |
| CON-E2E-038 | `react/e2e/tests/recurring-lifecycle.spec.ts` | deleting a schedule removes it and it stays deleted across a reload | **The original complaint** — "toast says deleted, refresh brings it back". The v7.3 backfill recreated any schedule whose signature had no match, with no concept of a deliberate deletion. |
| CON-E2E-039 | `react/e2e/tests/recurring-lifecycle.spec.ts` | creating a schedule writes no transaction | **The reported defect, at the UI level.** `upsertRecurring` seeded a transaction dated `startDate` (today) on every create, so setting up rent for the 28th charged you on the 8th. A schedule is a template; only the engine may materialise one. |
| CON-E2E-010 | `react/e2e/tests/transactions-create.spec.ts` | [TXN-FC-002] creates an expense with all optional fields and persists | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-011 | `react/e2e/tests/smoke.spec.ts` | legal pages render without auth and keep the shell linkable | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-012 | `react/e2e/tests/transactions-create.spec.ts` | [TXN-FC-004] investment records its type and account | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-013 | `react/e2e/tests/transactions-create.spec.ts` | [TXN-FC-005] form rejects negative, zero, and non-numeric amounts | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-014 | `react/e2e/tests/transactions-create.spec.ts` | [TXN-FC-007] preserves unicode and emoji in the description | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-015 | `react/e2e/tests/transactions-create.spec.ts` | [TXN-FC-008] stores the original currency of the transaction | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-016 | `react/e2e/tests/transactions-create.spec.ts` | [TXN-FC-009] a rapid double-submit creates only one transaction | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-017 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-001] creates a monthly budget that starts at 0% used | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-018 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-002] spend in a category reduces the remaining budget | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-019 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-003] crossing the threshold fires a budget_threshold notification | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-020 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-004] accepts a non-monthly (quarterly) period | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-021 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-005] custom period requires start and end dates | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-022 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-006] raising the limit recomputes utilisation from over to under | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-023 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-007] an over-budget category shows over-budget styling | Pre-existing Lane A scenario carried into the catalogue during the 2026-09-09 reconciliation. The suite itself is stale against Aurora (tracked in issue #74); cataloguing the ID separates "not written down" from "not passing". |
| CON-E2E-040 | `react/e2e/tests/smoke.spec.ts` | tolerates corrupt localStorage payloads and falls back to clean defaults | Renumbered 2026-09-09: this test had been sharing CON-E2E-008 with `debts-payment.spec.ts`, so the catalogue could not say which scenario a result belonged to. |
| CON-E2E-041 | `react/e2e/tests/smoke.spec.ts` | primary routed pages mount without page errors | Renumbered from a collision with CON-E2E-007 (`transactions-create.spec.ts`). |
| CON-E2E-042 | `react/e2e/tests/smoke.spec.ts` | boots from legacy ff_* keys and writes back under vt_* | Renumbered from a collision with CON-E2E-010 (`transactions-create.spec.ts`). |

### 4.3 Admin · Unit (ADM-UNIT)

| ID | File | Description | Notes |
|---|---|---|---|
| ADM-UNIT-001 | `admin/src/lib/__tests__/contentApi.test.ts` | lowercases and replaces spaces with single hyphens | `slugify` happy path. |
| ADM-UNIT-002 | `admin/src/lib/__tests__/contentApi.test.ts` | strips characters outside [a-z0-9 -] | `slugify` sanitiser. |
| ADM-UNIT-003 | `admin/src/lib/__tests__/contentApi.test.ts` | collapses runs of whitespace into a single hyphen | `slugify`. |
| ADM-UNIT-004 | `admin/src/lib/__tests__/contentApi.test.ts` | trims leading/trailing whitespace before slugging | `slugify`. |
| ADM-UNIT-005 | `admin/src/lib/__tests__/contentApi.test.ts` | caps the slug at 80 characters | `slugify` length bound. |
| ADM-UNIT-006 | `admin/src/lib/__tests__/contentApi.test.ts` | returns an empty string for entirely-stripped input | `slugify` empty case. |
| ADM-UNIT-007 | `admin/src/lib/__tests__/contentApi.test.ts` | preserves digits and existing hyphens | `slugify` passthrough. |
| ADM-UNIT-008 | `admin/src/lib/__tests__/contentApi.test.ts` | maps the canonical row fields to the Article shape | `rowToArticle` happy path. |
| ADM-UNIT-009 | `admin/src/lib/__tests__/contentApi.test.ts` | defaults a null summary to the empty string | `rowToArticle` defaulting. |
| ADM-UNIT-010 | `admin/src/lib/__tests__/contentApi.test.ts` | defaults a null cover_emoji to 📰 | `rowToArticle` defaulting. |
| ADM-UNIT-011 | `admin/src/lib/__tests__/contentApi.test.ts` | maps null published_at to undefined (not the string "null") | `rowToArticle` boundary. |

---

### Corrective Payment And Cache Regressions

| ID | File | Scenario | Scope |
|---|---|---|---|
| CON-E2E-043 | `react/e2e/tests/dialog-correction.spec.ts` | Budget dialog bounds and opener focus at desktop and mobile sizes | Playwright browser workflow |
| CON-UNIT-900 | `react/src/lib/__tests__/loanPaymentWorkflow.test.ts` | First principal payment retains opening liability and net worth | Real store and fake IndexedDB |
| CON-UNIT-901 | `react/src/lib/__tests__/loanPaymentWorkflow.test.ts` | Second payment and metadata edit preserve the opening liability | Real store and fake IndexedDB |
| CON-UNIT-902 | `react/src/lib/__tests__/loanPaymentSql.test.ts` | RPC initializes the liability and returns balanced rows | Actual migrations executed in PGlite; focused schema fixture |
| CON-UNIT-903 | `react/src/lib/__tests__/loanPaymentSql.test.ts` | Retrying returns the original payment | Postgres RPC |
| CON-UNIT-904 | `react/src/lib/__tests__/loanPaymentSql.test.ts` | Stale or invented reductions are rejected | Postgres RPC |
| CON-UNIT-905 | `react/src/lib/__tests__/loanPaymentSql.test.ts` | Duplicate lookup requires authorization | Postgres RPC |
| CON-UNIT-906 | `react/src/lib/__tests__/loanPaymentWorkflow.test.ts` | Cloud payments cannot fall back to sequential local writes | Store command |
| CON-UNIT-907 | `react/src/lib/__tests__/loanPaymentWorkflow.test.ts` | Retry adopts authoritative rows once | Store command with mocked transport |
| CON-UNIT-908 | `react/src/lib/__tests__/netWorthProjection.test.ts` | Positive card balance is credit, not debt | Financial projection |
| CON-UNIT-909 | `react/src/lib/__tests__/netWorthProjection.test.ts` | Archive retains value; foreign opening balance uses account currency | Financial projection |
| CON-UNIT-910 | `react/src/lib/__tests__/loanPaymentWorkflow.test.ts` | Generic CRUD rejects individual system-split corrections | Store command; full reversal remains separate |
| CON-UNIT-911 | `react/src/lib/__tests__/cacheBoundary.test.ts` | Delayed HybridAdapter delta cannot refill purged cache | Production adapter and fake IndexedDB |
| CON-UNIT-912 | `react/src/lib/__tests__/cacheBoundary.test.ts` | Purge covers transcript and cursor key shapes | fake IndexedDB |
| CON-UNIT-913 | `react/src/lib/__tests__/outboxIndexedDb.test.ts` | Competing claims own each row only once | fake IndexedDB transactions |
| CON-UNIT-914 | `react/src/lib/__tests__/outboxIndexedDb.test.ts` | Aborted transaction cannot report durable success | fake IndexedDB transactions |
| CON-UNIT-915 | `react/src/lib/__tests__/outboxIndexedDb.test.ts` | Unknown owners remain quarantined across database reopen | fake IndexedDB transactions |
| CON-UNIT-916 | `react/src/lib/__tests__/outboxIndexedDb.test.ts` | Later writes cannot overtake backoff work | fake IndexedDB transactions |
| CON-UNIT-917 | `react/src/lib/__tests__/outboxIndexedDb.test.ts` | Delayed HybridAdapter flush drains new work and advances server revisions | Production adapter, fake IndexedDB, mocked network |
| CON-UNIT-918 | `react/src/lib/__tests__/loanPaymentSql.test.ts` | SQL/client parity for payment strategies and USD/JPY | Real SQL execution, not full Supabase integration |

## 5. Retired IDs

> When a scenario is deleted, move its ID here with a one-line reason. IDs in
> this section are reserved and must not be reused.

*(none yet — this section will grow as scenarios are retired.)*

---

## 6. Pending scenarios (v7.3.x revision)

> Functional-case (FC) scenarios queued for v7.3.x. These are the source-of-truth
> test cases that the QA stream will translate into ID-tagged unit / E2E specs
> in subsequent PRs; once a spec lands in code, its row is **promoted** into
> §4 with the next available `CON-UNIT-NNN` / `CON-E2E-NNN` ID and removed from
> here. Rows in §6 are intentionally outside the doc/code reconciler's range
> (the gate scopes itself between `## 4. Roster` and `## 5. Retired IDs`).
>
> Owner: Engineering (consumer). Tracks the v7.3.0 ship plus the v7.3.1
> follow-up (Saved Views theme fix · Recurring schedule backfill · Income
> splits · Track-as-debt · text time entry · Settings-only sensitive actions ·
> sidebar label casing). Last updated: 2026-06-03.

### 6.1 Splits — income polarity & debt linkage

| FC ID | Layer | Target file | Description |
|---|---|---|---|
| SPLT-FC-001 | Unit | `react/src/lib/__tests__/calculations.test.ts` | `splitsOutstanding` on an **income** split with `paidBy: 'me'` adds each non-paid non-you participant share to **`youOwe`** (you collected the lump sum, you owe each forwardee their share). |
| SPLT-FC-002 | Unit | `react/src/lib/__tests__/calculations.test.ts` | `splitsOutstanding` on an **income** split with `paidBy: 'external'` and your own row unpaid adds your share to **`owedToYou`** (the external recipient hasn't forwarded your cut). |
| SPLT-FC-003 | Unit | `react/src/lib/__tests__/calculations.test.ts` | `splitsOutstanding` on an **expense** split keeps the legacy polarity unchanged (regression pin against the v7.3.1 income branch). |
| SPLT-FC-004 | E2E | `react/e2e/tests/splits-income.spec.ts` | TransactionFormModal exposes the "🤝 Share this income with others" toggle on income; saving an even-split income with two non-you participants and `paidBy: 'me'` produces a Splits row whose summary shows two `you owe` IOUs. |
| SPLT-FC-005 | E2E | `react/e2e/tests/splits-income.spec.ts` | The income-split "Who received the money?" select has the inverted-polarity copy (*"You received it — you'll forward each person their share"* / *"Someone else received it — they owe you your share"*); copy is the visible signal that downstream IOU semantics flipped. |
| SPLT-FC-006 | E2E | `react/e2e/tests/splits-debt-conversion.spec.ts` | On an expense split with `paidBy: 'external'`, clicking **Track as debt** on the user's own unpaid row creates a Debt with `direction: 'owed_by_me'`, `principal === participant.share`, `currency === txn.currency`, and writes `linkedDebtId` back onto the source transaction. The new debt appears on `/debts` and counts toward Liabilities on `/networth`. |
| SPLT-FC-007 | E2E | `react/e2e/tests/splits-debt-conversion.spec.ts` | After a successful Track-as-debt conversion, the Splits row exposes a *"linked to a debt"* hint and the **Track as debt** button is hidden for that participant — pin against double-tracking. |

### 6.2 Recurring — backfill from legacy transactions

| FC ID | Layer | Target file | Description |
|---|---|---|---|
| RECR-FC-001 | Unit | `react/src/lib/__tests__/recurring.test.ts` | `backfillSchedulesFromTransactions` synthesises a single `RecurringSchedule` for a group of legacy txns sharing `(type, normalised description, recurring, currency)`; uses the earliest occurrence as `startDate` and the latest as `lastGenerated`; computes `nextDueDate` past `now` so the schedule isn't instantly "due". |
| RECR-FC-002 | Unit | `react/src/lib/__tests__/recurring.test.ts` | Backfill is a **no-op** for a signature already represented by an existing `RecurringSchedule` (idempotency pin — guards against duplicate schedules on every refresh). |
| RECR-FC-003 | Unit | `react/src/lib/__tests__/recurring.test.ts` | Backfill ignores split rows (`split.isSplit`) and transfer rows (`category === 'transfer'`); pins the split-and-transfer carve-outs against scope creep. |
| RECR-FC-004 | Unit | `react/src/lib/__tests__/recurring.test.ts` | Frequency `'custom_day'` and unknown frequencies are skipped by the backfill (only `weekly` / `monthly` / `yearly` are promoted). |
| RECR-FC-005 | E2E | `react/e2e/tests/recurring-backfill.spec.ts` | A seeded fixture with weekly Rent transactions and an empty `recurringSchedules` localStorage key produces a schedule on first refresh; the schedule appears on `/recurring` and the projected-future overlay on the Transactions calendar shows the next due date. |
| RECR-FC-006 | E2E | `react/e2e/tests/recurring-backfill.spec.ts` | The toast *"Recovered N recurring schedule(s) from existing transactions"* fires exactly once on the seeded refresh; a second refresh inside the same session is silent (idempotency surface). |

### 6.3 Saved Views — theme tokens & sharing

| FC ID | Layer | Target file | Description |
|---|---|---|---|
| SVWS-FC-001 | E2E | `react/e2e/tests/saved-views.spec.ts` | The Views dropdown and the Save-view popover render with **opaque** Vyact theme backgrounds (`bg-bg2` resolves to a non-zero alpha); regression pin for the v7.3.0 → v7.3.1 transparency fix where shadcn-style tokens (`bg-card`, `bg-background`) resolved to no fill. |
| SVWS-FC-002 | E2E | `react/e2e/tests/saved-views.spec.ts` | Saving a view on `/transactions` with the **Share with household** checkbox unchecked persists `is_shared = false`; the row appears in the current user's Views dropdown and is invisible to a sibling household member's session. |
| SVWS-FC-003 | E2E | `react/e2e/tests/saved-views.spec.ts` | Saving a view with **Share with household** checked persists `is_shared = true`; the row is visible to other members of the same household but invisible to members of a different household (RLS scope pin). |
| SVWS-FC-004 | Unit | `react/src/lib/__tests__/savedViewsSanitize.test.ts` | The sanitizer strips every `PRIVATE_FILTER_KEYS` entry (`search`, `q`, `description`, `memberId`, `memberIds`, `txnId`, `transactionId`) regardless of the `is_shared` toggle; nullish / `'all'` values are also dropped; the remaining keys round-trip unmodified. |
| SVWS-FC-005 | E2E | `react/e2e/tests/saved-views.spec.ts` | The bar is hidden in local-only mode (no `cloudEnabled`); guards against half-implemented persistence on builds without Supabase env vars. |

### 6.4 Money Map — Account drawer & Reports views

| FC ID | Layer | Target file | Description |
|---|---|---|---|
| NWRT-FC-007 | E2E | `react/e2e/tests/account-drawer.spec.ts` | TransactionFormModal's `AccountDrawer` (multi-account split) refuses to save when row sum ≠ txn total within ±0.01; the inline indicator flips from sage *Balanced* to honey *Out by …* and the Save button toasts an error. |
| NWRT-FC-008 | E2E | `react/e2e/tests/account-drawer.spec.ts` | A balanced two-row split persists to `transactions.extras.accountSplits` (verified via the dev-tools backdoor that lists the saved row) and survives a full reload. |
| NWRT-FC-009 | E2E | `react/e2e/tests/account-drawer.spec.ts` | The drawer is hidden on **Transfer** rows and on households with `accounts.length <= 1`; pins the gate against accidental exposure on a 1-account profile. |
| RPRT-FC-001 | Unit | `react/src/lib/__tests__/hybridAdapter.test.ts` | `HybridAdapter.queryTxnByMember` returns `undefined` when the cloud method is absent or throws; pins the fall-back contract that lets `Reports` choose its read path without an `if (cloud)` branch. |
| RPRT-FC-002 | E2E | `react/e2e/tests/reports-views.spec.ts` | With `getMoneyMapMode() === 'on'`, `/reports` renders the *By member* / *By account* panels using the cloud `v_txn_by_*` views (mocked at the network layer) and matches the values produced by the v7.2.0-rc client-side fold for the same fixture. |

### 6.5 Education progress

| FC ID | Layer | Target file | Description |
|---|---|---|---|
| EDUC-FC-001 | Unit | `react/src/lib/__tests__/educationProgress.test.ts` | `mergeProgress(base, topicId, patch)` writes the patch under the topic key, preserves unrelated keys, and prunes the **oldest** entries when `MAX_KEYS = 50` would be exceeded; ordering uses `completed_at`/`dismissed_at` falling back to `0`. |
| EDUC-FC-002 | Unit | `react/src/lib/__tests__/educationProgress.test.ts` | `readLocalEducationProgress` returns `{}` for missing / malformed JSON and never throws; `writeLocalEducationProgress` is the inverse. |
| EDUC-FC-003 | E2E | `react/e2e/tests/why-chip.spec.ts` | Opening a `WhyChip` marks `completed_at` on the topic in the user's `profile.educationProgress`; closing it via the X button marks `dismissed_at` and a `completed_at` fallback if not already present. Both flows survive a reload. |
| EDUC-FC-004 | E2E | `react/e2e/tests/why-chip.spec.ts` | In local-only mode the same flow writes through to `localStorage['vt_education_progress']`; the LRU prune fires when more than 50 distinct topics are touched. |

### 6.6 Help — Saved Views topic

| FC ID | Layer | Target file | Description |
|---|---|---|---|
| HELP-FC-001 | E2E | `react/e2e/tests/help-search.spec.ts` | The Help page exposes a *"Saved Views — reusable filters on Transactions, Reports & Insights"* topic that is reachable via the search box (queries: "saved views", "reusable filters") and renders the privacy disclaimer about stripped search / member / transaction ids. |
| HELP-FC-002 | E2E | `react/e2e/tests/help-search.spec.ts` | The *"Splitting a bill — and shared income"* topic mentions both expense and income splits and the **Track as debt** action; pins the v7.3.1 copy refresh against silent regression to the legacy "Splitting a bill with others" wording. |

### 6.7 Timebox-landed FC-coded consumer E2E (awaiting `CON-E2E-NNN` promotion)

> These specs now exist in code and are counted in the functional inventory,
> but they were intentionally not promoted into §4 during the timebox because
> they still use functional-case titles rather than stable master-catalog
> `CON-E2E-NNN` IDs. The next cataloging pass should assign permanent IDs and
> move them into the Consumer E2E roster.

| FC ID | Layer | Target file | Description |
|---|---|---|---|
| smoke · corrupt-payload boot (inventory) | E2E | `react/e2e/tests/smoke.spec.ts` | App tolerates corrupt `vt_*` localStorage JSON payloads, boots without crashing, and falls back to clean defaults / empty state for the malformed entity. This is the revised local-only behaviour, not the older restore-toast flow. |
| BACKUP-FC-001 | E2E | `react/e2e/tests/backup.spec.ts` | Downloaded JSON backup contains the current snapshot payload (`version`, `exported`, `profile`, `transactions`, `budgets`, `goals`, `members`, `debts`, `assets`, `exchangeRates`). |
| BACKUP-FC-002 | E2E | `react/e2e/tests/backup.spec.ts` | Download Backup uses the shipped Vyact filename pattern and surfaces the success toast. |
| BACKUP-FC-003 | E2E | `react/e2e/tests/backup.spec.ts` | Copy to Clipboard writes the full JSON snapshot and surfaces success feedback. |
| BACKUP-FC-004 | E2E | `react/e2e/tests/backup.spec.ts` | CSV export contains the shipped transaction columns for the current dataset. |
| BACKUP-FC-005 | E2E | `react/e2e/tests/backup.spec.ts` | Backup/export actions remain reachable in local-only mode. |
| PROFILE-FC-008 | E2E | `react/e2e/tests/profile-settings.spec.ts` | Sensitive data actions remain surfaced only in Settings: the main drawer does not expose backup/export shortcuts, while Settings → Sync & Backup shows the warning callout plus the Download Backup / Export CSV / Copy to Clipboard actions. |
| FX-FC-005 | E2E | `react/e2e/tests/profile-settings.spec.ts` | Switching base currency re-anchors the Reports datasets without drift: summary cards, the period-summary rows, and the category breakdown re-render to the target currency using the seeded USD-base FX table. |
| SEARCH-FC-002 | E2E | `react/e2e/tests/search-filter.spec.ts` | Structured filters (`type`, `category`, `month`, `member`) narrow the Transactions list consistently. |
| SEARCH-FC-003 | E2E | `react/e2e/tests/search-filter.spec.ts` | Calendar day selection narrows the Transactions list and surfaces a clearable date chip. |
| A11Y-FC-001 | E2E | `react/e2e/tests/keyboard-accessibility.spec.ts` | The shipped keyboard shortcut contract works today: `N` opens Add Transaction and `Esc` closes the active modal. |
| A11Y-FC-004 | E2E | `react/e2e/tests/keyboard-accessibility.spec.ts` | The current transaction form tab order is logical through the shipped controls: description, amount, currency, category, member, account, recurring, note, then the private checkbox. |
| FX-FC-001 | E2E | `react/e2e/tests/profile-settings.spec.ts` | Editing an exchange rate re-renders converted totals on Dashboard and Reports for a foreign-currency seeded household. |
| ONB-FC-002 | E2E | `react/e2e/tests/onboarding.spec.ts` | Using the onboarding skip action applies the shipped Family with Kids template and seeds the expected starter budgets, goals, debts, and profile template metadata. |
| ONB-FC-003 | E2E | `react/e2e/tests/onboarding.spec.ts` | Completing the full onboarding flow persists the user-selected `primaryConcern` in profile metadata, overriding the template default when the user chooses a different concern. |
| ONB-FC-004 | E2E | `react/e2e/tests/onboarding.spec.ts` | Fresh local users are not forced through onboarding: visiting `/` lands on the empty dashboard while the onboarding wizard remains opt-in via its explicit route. |
| ONB-FC-005 | E2E | `react/e2e/tests/onboarding.spec.ts` | Completing onboarding sets `onboardedAt` and changes the Settings relaunch link from `Run onboarding wizard` to `Re-run onboarding wizard`. |
| PROFILE-FC-004 | E2E | `react/e2e/tests/profile-settings.spec.ts` | Changing the household type in Settings persists to the profile store and survives reload; the current scope is persistence only, not feature gating. |
| PRIV-FC-002 | E2E | `react/e2e/tests/privacy.spec.ts` | Editing a transaction to `excluded=true` removes it from transaction-derived aggregates consistently across Dashboard totals, Reports summaries, Budgets spend, and the visible Pulse score. |
| RESP-FC-001 | E2E | `react/e2e/tests/responsive-mobile.spec.ts` | At desktop width, the full layout is rendered with the persistent sidebar navigation visible while the MobileBar remains hidden. |
| RESP-FC-002 | E2E | `react/e2e/tests/responsive-mobile.spec.ts` | On a mobile viewport, the sidebar collapses behind the MobileBar hamburger trigger and the drawer navigation can still open Settings successfully. |
| RESP-FC-004 | E2E | `react/e2e/tests/responsive-mobile.spec.ts` | On a mobile viewport, the floating Planner and Ask Vyact actions remain visible, clickable, and open their drawers. |
| RESP-FC-005 | E2E | `react/e2e/tests/responsive-mobile.spec.ts` | With Money Map enabled on a mobile viewport, the drawer still renders `Accounts` and `Insights` as readable title-cased navigation labels rather than raw lowercase fallback keys. |
| TXN-FC-003 | E2E | `react/e2e/tests/transactions-create.spec.ts` | With the track picker enabled, choosing the Transfer track writes the paired expense+income transfer rows with `category='transfer'` and a shared `__tg:<groupId>` note tag. |
| TXN-FC-010 | E2E | `react/e2e/tests/transactions-create.spec.ts` | The track picker exposes all four tracks, narrows the Investment category list to the five investment ids, and hides the Category field entirely when Transfer is chosen. |
| TXN-FC-011 | E2E | `react/e2e/tests/transactions-create.spec.ts` | Editing an existing transaction skips the track picker and opens directly with the stored track locked and no Change affordance. |
| TXN-FC-012 | E2E | `react/e2e/tests/transactions-create.spec.ts` | With the track picker enabled, numeric shortcuts `1`–`4` choose Spend, Income, Transfer, and Investment respectively, and `Esc` closes the modal from the selected track form. |
| TXN-FC-013 | E2E | `react/e2e/tests/transactions-create.spec.ts` | The shipped text time-entry surface rejects malformed `hh:mm` input, persists valid AM/PM entries as normalized 24-hour times, and sorts same-day rows by the later timestamp first after reload. |
| DEBT-FC-001 | E2E | `react/e2e/tests/debts-payment.spec.ts` | Creating a debt through the Add Debt modal persists the configured principal, current balance, APR, minimum payment, tenure, and due date and renders the new debt card. |
| DEBT-FC-003 | E2E | `react/e2e/tests/debts-payment.spec.ts` | Recording a debt payment writes the linked interest/principal transactions into the Transactions list and preserves the generated `linkedDebtId` and shared `linkedTxnId` metadata. |
| DEBT-FC-006 | E2E | `react/e2e/tests/debts-payment.spec.ts` | A part-payment with `reduce_tenure` lowers `remainingMonths` while keeping the EMI unchanged. |
| DEBT-FC-007 | E2E | `react/e2e/tests/debts-payment.spec.ts` | A part-payment with `reduce_emi` recalculates a lower EMI while the remaining tenure only advances by the current payment month. |
| DEBT-FC-009 | E2E | `react/e2e/tests/debts-payment.spec.ts` | A part-payment with `apply_advance` covers future EMIs in advance, reducing `remainingMonths` by more than one month while leaving the EMI amount unchanged. |

