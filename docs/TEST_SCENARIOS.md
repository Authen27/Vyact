# FinFlow — Test Scenarios (Master Catalog)

> Single source of truth for every automated test scenario across all FinFlow
> apps and layers. This document is **regression-managed**: every PR that adds,
> removes, or renames a scenario MUST update this file in the same commit, and
> the [`test-scenarios-doc`](../scripts/test-scenarios-check.mjs) CI gate refuses
> to merge any drift between this catalog and the code.
>
> Owner: Engineering. Last regenerated: 2026-05-23 (Remediation PR #2).
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

Counts as of 2026-05-23 (Remediation PR #2).

| App | Layer | Tool | File(s) | Scenarios | TD-characterization |
|---|---|---|---|---|---|
| Consumer | Unit | Vitest | `react/src/lib/__tests__/*.test.ts` | **39** | 1 (`CON-UNIT-006` ↔ `TD-01`) |
| Consumer | E2E  | Playwright | `react/e2e/tests/*.spec.ts` | **4** | 1 (`CON-E2E-004` regression-pins the v6.4 cache-no-clobber fix) |
| Admin | Unit | Vitest | `admin/src/lib/__tests__/*.test.ts` | **11** | 0 |
| Admin | E2E  | Playwright | *(none yet)* | 0 | — |
| **Total** | | | | **54** | 2 |

Known coverage gaps (tracked outside this file):

- Admin has no E2E coverage; the privileged surface (role tiers, KPIs) is
  unverified end-to-end. Folded into TD-19 expansion.
- Consumer E2E covers only foundation smoke (boot + reload-persistence + seed
  visibility). Journey tests (Add Transaction, Budgets, Debts, Splits,
  Backup/Restore) are TD-19 Phase 2.

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
| CON-UNIT-006 | `react/src/lib/__tests__/format.test.ts` | [TD-01] round-trip USD→EUR→USD does NOT return exactly the original | **TD-01 characterization** — pins current lossy float behaviour. Update when TD-01 lands. |
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

### 4.2 Consumer · E2E (CON-E2E)

| ID | File | Description | Notes |
|---|---|---|---|
| CON-E2E-001 | `react/e2e/tests/smoke.spec.ts` | boots into the dashboard in local-only mode | App-shell smoke. |
| CON-E2E-002 | `react/e2e/tests/smoke.spec.ts` | does not render a cloud auth screen | Confirms local-only env. |
| CON-E2E-003 | `react/e2e/tests/smoke.spec.ts` | seeded transactions are visible on the Transactions page | Seed fixture wiring. |
| CON-E2E-004 | `react/e2e/tests/smoke.spec.ts` | seeded data survives a full page reload (persistence guard) | Regression guard for the v6.4 cache-no-clobber fix. |

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

## 5. Retired IDs

> When a scenario is deleted, move its ID here with a one-line reason. IDs in
> this section are reserved and must not be reused.

*(none yet — this section will grow as scenarios are retired.)*
