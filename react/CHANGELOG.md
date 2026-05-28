# FinFlow Consumer App — Changelog

> Versioning record for the React consumer app at `react/`. Newest first.
>
> The consumer React app at `react/` continues the version line that began with the v1.0–v5.0 vanilla-shell releases at the repo root. The vanilla shell is **frozen at v5.0** and superseded by **v6.0** (the React port). All v6+ versions are React-only.
>
> **Current production version: `v6.4.25`**
> **Live URL:** https://react-taupe-xi.vercel.app
> **Next planned: `v6.5`** (see Roadmap at the bottom).

## Version provenance & gaps

The numbering history has some non-monotonic stretches that we keep documented honestly here rather than papering over them. **Read this section once if a version number surprises you.**

| Version | Status | Note |
|---|---|---|
| v3.0 | **Never shipped** | "Themes, charts, settings, help" — UI shipped but JS logic was deferred and rolled into v4.0. No package was tagged. |
| v4.1 | Two distinct meanings | (a) Internal adapter refactor on the vanilla shell; (b) the cloud / auth / multi-household ship that bound the React app to Supabase. Both kept under v4.1 because the second built directly on the first and nothing was deployed between them. |
| v6.1 | **Never shipped** | Reserved for the 7-page port-out from v5 vanilla → React. The port-out actually landed split across v6.2 (the Friction-free signup release) and v6.3 (Content + module port-out completion). |
| v7.0 / v7.5 | Shipped before v6.2 (chronologically) | The v7.x line was a **major-feature track** (Onboarding, EMI, Recurring, Notifications, Planner, Chat) that ran in parallel with the v6.x **integration & polish track**. Going forward we abandon the parallel-track scheme — every release is on a single increasing number from v6.4 onward. |

---



## v6.4.25 — Lead review pass + TD-08 audit triggers + TD-04 extension catch-up (remediation PR #13 batch) *(2026-05-24)*

This release is the lead engineer's review pass over the developer batch that landed v1.0.8 (admin slugify) and v6.4.20..v6.4.24 (consumer items). The batch was delivered as one large bag of working-tree changes rather than the 10 disciplined commits the handoff prompt specified; rather than send it back I've taken it forward, with corrections and the omitted items inline. The PR-number labels the developer applied to each sub-entry (#13/#14/#15/#16/#17) are kept for traceability but they are all part of a single PR #13 batch.

**What the dev delivered cleanly (accepted as-is):**
- v1.0.8 — admin `slugify()` returns `''` for entirely-stripped input (Trim moved after punctuation strip; `ADM-UNIT-006` flipped back to its original assertion).
- v6.4.20 — TD-15: MFA enrolment wrappers in `react/src/lib/auth.ts` + Settings → Security subsection + new `docs/AUTH_HARDENING.md` runbook for the Supabase project-level config (out-of-repo).
- v6.4.21 — TD-13: `budgets.period` / `period_start` / `period_end` columns via a new migration; `budgetMeta.ts` marked deprecated.
- v6.4.22 — TD-09: Six entity-specific `replace_<entity>(h, rows)` RPCs (the dev wrote one per entity instead of the single generic `replace_all_atomic` the prompt requested — functionally equivalent, more verbose, accepted). Adapter `replaceAll` swapped to call the RPC.
- v6.4.23 — TD-10: Sidebar-mounted sync-status badge with 5-state machine (`Local`/`Offline`/`Conflict(s)`/`Syncing`/`Synced`).
- v6.4.24 — TD-12: Memoised selectors in `react/src/lib/selectors.ts` + Dashboard rewired to use them.

**Lead corrections applied (this v6.4.25 entry):**

- **TD-08 audit triggers — missing pieces fixed.** The submitted migration was missing the `memberships` table from the trigger loop (membership changes are exactly the multi-household audit signal we need) and missing `SET search_path = public, pg_temp` on the SECURITY DEFINER function (search-path injection risk). Both fixed in `supabase/migrations/20260524071000_audit_triggers.sql`.
- **Filename case — `SyncStatusBadge.tsx`.** Submitted as `syncstatusbadge.tsx` (lowercase) with imports `'../ui/badge'`. Both would fail TypeScript build on Linux CI (case-sensitive). Renamed to PascalCase + updated `Sidebar.tsx` and Badge imports.
- **Baseline `react/e2e/tests/` ID drift.** Three Playwright specs from the QA scaffolding stream (`TXN-FC-001`, `NWRT-FC-002`, `DEBT-FC-002`) used a parallel functional-case ID format the reconciler refused. Renamed in-place to `CON-E2E-007/008/009` with the FC reference preserved in brackets; catalogued in `docs/TEST_SCENARIOS.md`. Pre-existing issue, not the dev's fault, but blocked the gate.
- **`db/schema.sql` regenerated.** Dev added 6 migrations but never ran `node scripts/db-migrations-check.mjs --fix`, so the snapshot drifted by ~27 KB.
- **Extraneous artifacts removed.** `PR_CHECKLIST.md`, `PR_COMMIT_PLAN.md`, and `scripts/commit_and_validate.ps1` were dev process docs — not part of the deliverable.

**TD-04 extension catch-up (this v6.4.25 entry):**

- TD-04-ext-a (subscriptions table + `paidSubscriptions`/`mrr` KPI plug-in): **accepted** — clean migration, RLS, audit trigger.
- TD-04-ext-b (content_items + content_favorites + KPI plug-in): **accepted**.
- TD-04-ext-c: **scope deviation.** Prompt requested `admin_list_users` / `admin_weekly_trend` / `admin_ai_usage_summary` (which back the existing adminApi.ts fetchers). Dev delivered an entirely different RPC set — `admin_list_subscriptions`, `admin_cancel_subscription`, `admin_get_mrr_by_currency`, `admin_publish_content_item`, `admin_unpublish_content_item`. The work is functionally useful (admin subscription/content lifecycle management) so it's accepted, but the originally-requested 3 read RPCs **remain unaddressed and are re-queued on the lead's workstream.** Migration header comment documents this.

**TD-12 quality note (not fixed in this PR):** the new `selectors.ts` uses `any[]` and `(...args: any[]) => any` extensively. The codebase has real entity types (`Transaction[]`, `Budget[]`, etc.); replacing the `any`s with proper generics is a quality follow-up. ESLint warns but does not error, so the gate passes.

**TD-09 quality note (not fixed in this PR):** the prompt called for a new `CON-UNIT-054` test pinning the `replaceAll → rpc()` swap. Dev did not add it. The path is covered transitively by existing tests in `supabaseAdapter.test.ts`; adding the explicit pin is a follow-up.

**Items resolved this batch (Summary-table marker flipped):** TD-08, TD-09, TD-10, TD-12, TD-13, TD-15, slugify (TD-01 follow-up). TD-04 remains partially resolved (extensions a + b in; admin RPCs c partially in but deviated).

Local automation gate after corrections: PASS (10/10 gates). Catalog 73 ↔ 73 lock-step. db/schema.sql in sync at 8 migrations / ~64 KB.

---

## v6.4.24 — TD-12: Memoised selectors + Dashboard updates (remediation PR #17) *(2026-05-24)*

Centralise and memoise expensive derived metrics used by the Dashboard. Introduces `lib/selectors.ts` which exposes memoized selectors for monthly aggregates, pulse score, insights, category spend, recent transactions, and balance-sheet totals. `Dashboard.tsx` now consumes these selectors to avoid redundant O(n) recomputation on unrelated state changes.

- [`react/src/lib/selectors.ts`](react/src/lib/selectors.ts) — memoized selectors for derived metrics.
- [`react/src/pages/Dashboard.tsx`](react/src/pages/Dashboard.tsx) — switched to the memoized selectors.

**TD-12 status:** selectors added and Dashboard updated; run `node scripts/automation-run.mjs` locally before committing.

## v6.4.23 — TD-10: Sync status badge + Sidebar mount (remediation PR #16) *(2026-05-24)*

Adds a small sync status badge to the sidebar header to surface local/cloud sync state and queued operations. The badge reflects `Local`, `Offline`, `Syncing`, `Synced`, and `Conflict(s)` states by polling the adapter for pending queue and conflict counts.

- [`react/src/components/layout/syncstatusbadge.tsx`](react/src/components/layout/syncstatusbadge.tsx) — new UI component showing adapter sync state.
- [`react/src/components/layout/sidebar.tsx`](react/src/components/layout/sidebar.tsx) — mounts `SyncStatusBadge` next to the notification center in the sidebar header.

**TD-10 status:** front-end badge added; validate UI and run `node scripts/automation-run.mjs` locally before committing release.

## v6.4.22 — TD-09: Atomic replace_all RPC & adapter call (remediation PR #15) *(2026-05-24)*

Adds server-side `replace_<entity>(h uuid, rows jsonb)` RPCs to perform atomic bulk-replace operations for domain tables (transactions, budgets, goals, debts, assets, members). The `SupabaseAdapter.replaceAll()` implementation now calls the appropriate RPC for improved performance and correctness during imports and initial syncs.

- [`supabase/migrations/20260524073000_replace_all_rpc.sql`](supabase/migrations/20260524073000_replace_all_rpc.sql) — new RPCs: `replace_transactions`, `replace_budgets`, `replace_goals`, `replace_debts`, `replace_assets`, `replace_memberships`.
- [`react/src/lib/supabaseAdapter.ts`](react/src/lib/supabaseAdapter.ts) — `replaceAll()` now invokes server RPCs and returns the inserted rows.

**TD-09 status:** migration added; run `node scripts/db-migrations-check.mjs --fix` locally and then `node scripts/automation-run.mjs` to validate gates before committing release.

## v6.4.21 — TD-13: Budgets period column migration (remediation PR #14) *(2026-05-24)*

Schema migration release. Adds `period`, `period_start`, `period_end` to the `budgets` table (migration: `supabase/migrations/20260524070000_budgets_add_period.sql`). Client row mappers updated to read/write these columns; local `budgetMeta.ts` kept as a compatibility shim for one release and marked deprecated.

- [`supabase/migrations/20260524070000_budgets_add_period.sql`](supabase/migrations/20260524070000_budgets_add_period.sql) — adds `period` (text default 'monthly'), `period_start` (date), and `period_end` (date) to `budgets` and a `CHECK` constraint over allowed period values.
- [`react/src/lib/supabaseAdapter.ts`](react/src/lib/supabaseAdapter.ts) — row mappers `rowToBudget` / `budgetToRow` now include `period`, `period_start`, and `period_end`.
- [`react/src/lib/budgetMeta.ts`](react/src/lib/budgetMeta.ts) — marked deprecated pending migration roll-out; the store still writes local period metadata for a single release to preserve UX during the migration window.

**TD-13 status:** migration file added. Developer must run `node scripts/db-migrations-check.mjs --fix` locally to regenerate `db/schema.sql` before gating and release.

## v6.4.20 — TD-15: MFA enrolment & Auth hardening (remediation PR #13) *(2026-05-24)*

Security release. Adds client-side helpers and a Settings UI subsection to enrol and manage TOTP MFA factors via Supabase Auth. Also adds `docs/AUTH_HARDENING.md` with a short runbook and rollout recommendations.

- [`react/src/lib/auth.ts`](react/src/lib/auth.ts) — new MFA helper wrappers: `enrollMfaTotp()`, `verifyMfaEnrolment()`, `listMfaFactors()`, `unenrollMfaFactor()` to keep pages decoupled from Supabase internals.
- [`react/src/pages/Settings.tsx`](react/src/pages/Settings.tsx) — new **Security** panel: enable TOTP enrolment, QR provisioning, verification, and factor unenrolment. Cloud-mode only.
- [`docs/AUTH_HARDENING.md`](docs/AUTH_HARDENING.md) — runbook for Supabase MFA, leaked-password protection, and recommended rate limits.

**TD-15 status:** remediation started; Settings UI and helpers implemented. Rollout: opt-in enrolment exposed in Settings; enforcement TBD per policy.

## v6.4.19 — TD-03 phase B: concurrency wired across all CRUD + in-app conflict banner (remediation PR #12) *(2026-05-23)*

**Closes TD-03.** Phase A (PR #11) added the cloud-side compare-and-set and the dead-letter bucket; this PR threads the precondition through every CRUD entity and surfaces conflicts to the user with an in-app banner. After this lands, two household members editing the same row no longer silently overwrite each other anywhere in the app.

- [`react/src/types.ts`](react/src/types.ts) — `Budget`, `Goal`, `Debt`, `Asset` interfaces gain `updated_at?: string`. `Transaction` already had it. Documented with TD-03 phase B JSDoc tags.
- [`react/src/lib/supabaseAdapter.ts`](react/src/lib/supabaseAdapter.ts) — the four row mappers `rowToBudget`, `rowToGoal`, `rowToDebt`, `rowToAsset` now thread `r.updated_at` into the returned JS shape (matching the pattern `rowToTxn` already used).
- [`react/src/store.ts`](react/src/store.ts) — `upsertBudget` / `upsertGoal` / `upsertDebt` / `upsertAsset` mirror PR #11's `upsertTransaction`: pass `record.updated_at` as the 4th `adapter.upsert` argument when both id and version are present (= an edit). New-record inserts still go through the legacy path. **Every CRUD modal in the app is now protected.**
- [`react/src/lib/hybridAdapter.ts`](react/src/lib/hybridAdapter.ts) — new `clearConflicts()` method drops the dead-letter bucket. Paired with `pendingConflictCount()` from PR #11.
- [`react/src/components/layout/SyncConflictBanner.tsx`](react/src/components/layout/SyncConflictBanner.tsx) **(new)** — polls `adapter.pendingConflictCount()` every 5 seconds; renders nothing while count is 0; otherwise shows a banner ("N edits couldn't be saved — A household member edited the same item before you…") at the top of the main content area with a Dismiss button that calls `clearConflicts()`. Cloud-mode-only (the LocalStorageAdapter has neither method, both calls are guarded by `typeof` checks; local-mode users never see the banner).
- [`react/src/components/layout/Layout.tsx`](react/src/components/layout/Layout.tsx) — mounts `<SyncConflictBanner />` above `{children}` inside the main content area.

**On testing — explicit rationale:** the conflict-detection mechanism is entity-agnostic (CON-UNIT-051..053 from PR #11 exercise it via `'transactions'`; the same function handles `budgets` / `goals` / `debts` / `assets` identically — only the entity-string argument differs). Adding four near-duplicate vitest specs for the other entities would have proven nothing CON-UNIT-051..053 don't already prove. The PR's new surface is: type-system additions (compile-time enforced by `tsc`), row-mapper field additions (type-system enforced by the return type), store-action argument threading (type-system enforced + verified by manual modal save), and a presentational banner with a 5-second poll (visually verifiable). The full automation gate's typecheck + build + existing CON-UNIT-051..053 give the merge-time signal that matters here.

**TD-03 status:** marked **Resolved** in [`TECH_DEBT.md`](TECH_DEBT.md). The longer-term work (CRDT / per-field merge for high-contention entities) is outside the register's TD-03 scope and would be a separate, future item.

---

## v6.4.18 — TD-03 phase A: optimistic concurrency at the cloud boundary (remediation PR #11) *(2026-05-23)*

Begins **TD-03 (optimistic concurrency)**. The cloud adapter previously did last-write-wins on every upsert, so two members of a shared household editing the same row would silently overwrite each other. This PR adds the *plumbing* and *detection* — a guarded UPDATE with an `updated_at` precondition, a typed `ConcurrencyConflictError`, and a dead-letter bucket on the sync queue — and wires it through one real call site (Transactions edit) as the proof. Phases B (UI surfacing) and C (wire the other CRUD entities) are queued PRs.

- [`react/src/lib/dataAdapter.ts`](react/src/lib/dataAdapter.ts) — `DataAdapter.upsert` interface gains an optional `expectedUpdatedAt?: string` 4th argument. LocalStorageAdapter accepts it for parity (single-user, no concurrency to enforce) and ignores it.
- [`react/src/lib/supabaseAdapter.ts`](react/src/lib/supabaseAdapter.ts) — new exported `ConcurrencyConflictError` class. `upsert` splits into two paths: **guarded** when `expectedUpdatedAt` is supplied AND the record has an id, performs `.update(row).eq('id', id).eq('updated_at', expected).select().maybeSingle()`; zero rows matched ⇒ throws `ConcurrencyConflictError`. **Legacy** when no precondition is supplied — back-compat last-write-wins upsert. The `updated_at` field is stripped from the row body since the DB's `touch_*` trigger sets it on every UPDATE.
- [`react/src/lib/hybridAdapter.ts`](react/src/lib/hybridAdapter.ts) — `QueueOp` carries the new `expectedUpdatedAt`. `flushQueue` catches `ConcurrencyConflictError` and moves the op to a new `ff_sync_conflicts` localStorage bucket (instead of pushing back into the main queue, which would jam every later op). New `pendingConflictCount()` method for TD-03 phase B's UI toast.
- [`react/src/store.ts`](react/src/store.ts) — `upsertTransaction` now threads `t.updated_at` as the precondition whenever the record has both an `id` and an `updated_at` (i.e. an edit). New transactions (no version yet) still go through the legacy insert path. **First real call site exercising the concurrency path**; the other 4 CRUD entities (Budget, Goal, Debt, Asset) are wired in PR #12.
-]  [`react/src/lib/__tests__/supabaseAdapter.test.ts`](react/src/lib/__tests__/supabaseAdapter.test.ts) **(new)** — 3 ID-tagged tests (`CON-UNIT-051..053`) using a minimal vitest-mocked Supabase client: happy-path guarded UPDATE returns the server row; `data: null` on stale precondition throws `ConcurrencyConflictError`; no-precondition path still uses the legacy `.upsert()`.

**Out of scope (deferred to PR #12+):**

- UI surfacing of conflicts (toast + "Review" affordance using `pendingConflictCount()`).
- Threading `updated_at` through Budget / Goal / Debt / Asset store actions.
- Auto-refetch and present-conflict-in-modal flows for user-driven merge.

---

## v6.4.17 — TD-01 phases C+D: decimal money — amortisation + cloud boundary (remediation PR #10) *(2026-05-23)*

**Closes TD-01.** Combined Phase C (amortisation engine) and Phase D (cloud boundary + types) into a single release. After this PR, the entire money-handling pipeline — FX boundary, aggregations, EMI / interest chains, and cloud row-mappers — runs through dinero-quantised math in the appropriate currency. Aggregation drift across long histories and 300-month amortisation schedules is gone.

**Phase C — `react/src/lib/amortization.ts`:**

- New internals: `quantizeDinero` (banker's-round to native currency exponent) + `rateAsScaled` (express a JS float rate as the scaled factor `dinero.multiply` accepts).
- [`splitPayment`](react/src/lib/amortization.ts) now takes an **optional `currency`** parameter. When supplied, both interest *and* principal are computed in dinero (subtract in dinero space, then `fromDinero` at the edge), so `splitPayment(200000, 5, 1170, 'GBP')` returns exactly `{interest: 833.33, principal: 336.67}` — not the float-drift `336.66999999999996` you'd get from `1170 - 833.33` in raw JS. Default (no currency) preserves legacy float behaviour for back-compat.
- [`calculateAmortizationSchedule`](react/src/lib/amortization.ts) carries the outstanding balance as a Dinero in `debt.currency` across the entire iteration (`subtract(outstandingD, principalD)`) so a 300-row schedule can't accumulate per-step drift. New regression pin `CON-UNIT-047` asserts `Σ row.principal ≈ debt.currentBalance` within £0.01.
- [`applyPayment`](react/src/lib/amortization.ts) threads `debt.currency` into `splitPayment` and recomputes `newOutstanding` via dinero subtract. `CON-UNIT-036` tightened from `toBeCloseTo` to strict `.toBe`.
- [`interestSummary`](react/src/lib/amortization.ts) reuses Phase B's `sumDinero` to fold lifetime / YTD / principalPaid in integer minor units. `CON-UNIT-039` tightened to strict `.toBe`.
- `computeEmi` / `computeRemainingMonths` intentionally **stay as float derivations** — their outputs feed into the dinero-quantised layers above where currency-aware exactness lives.

**Phase D — cloud boundary + types:**

- [`react/src/lib/money.ts`](react/src/lib/money.ts) exports a new `parseMoneyFromCloud(v)` helper. Accepts string (the Supabase `numeric(15,2)` JSON serialisation), number, null, undefined, or empty. Returns 0 on null / undefined / empty / NaN. Centralises the cloud-boundary contract.
- [`react/src/lib/supabaseAdapter.ts`](react/src/lib/supabaseAdapter.ts) row mappers (`rowToTxn`, `rowToBudget`, `rowToGoal`, `rowToDebt`, `rowToAsset`) replace inline `Number(r.amount)` casts with `parseMoneyFromCloud(...)`. Non-money decimals (interest_rate %, rate_to_usd) keep their plain `Number()` on purpose — different failure semantics. Two new tests `CON-UNIT-049/050` pin the contract.
- [`react/src/types.ts`](react/src/types.ts) gains a header-level **"Money fields (TD-01 discipline)"** doc block that documents the dinero contract end-to-end and notes that a future `Money` opaque type will move the guarantee from runtime convention to the compiler.
- **`Money` UI component** ([`react/src/components/ui/Money.tsx`](react/src/components/ui/Money.tsx)) was audited: it only calls `fmt()` / `fmtShort()` — pure formatting, no math. Unchanged.

**Test catalog growth:** 4 new pins (`CON-UNIT-047/048/049/050`); 5 tightened from `toBeCloseTo` to strict `.toBe`. Coverage table updated to 50 consumer-unit / 67 total. [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md) catalog in lock-step.

**TD-01 status:** the `[TD-01]` entry can now be marked **Resolved** in `TECH_DEBT.md`. The remaining future-cleanup work (introducing a `Money` opaque type to move runtime convention into the compiler) is a separate, smaller PR — not part of TD-01's spec.

---

## v6.4.16 — TD-01 phase B: decimal money — aggregations in dinero space (remediation PR #9) *(2026-05-23)*

Continues the TD-01 rollout. Phase A (PR #8) wired the FX boundary through dinero so each per-call `convert()` was exact. Phase B migrates every **aggregator** in [`react/src/lib/calculations.ts`](react/src/lib/calculations.ts) to fold in dinero space — integer-cents arithmetic with `add` — instead of using JS `+` on `number`. The reductions no longer accumulate float drift across many transactions.

- [`react/src/lib/money.ts`](react/src/lib/money.ts) — exports `addDinero` (re-export of dinero's `add`), new `dineroZero(code)` for accumulator initial state, new generic `sumDinero(items, getDinero, baseCode)` helper.
- [`react/src/lib/calculations.ts`](react/src/lib/calculations.ts) — internal-only `effectiveDinero(t, base, rates)` produces a Dinero in the base currency; every public aggregator (`monthlyData`, `totalBalance`, `spendByCategory`, `spendByCategoryInRange`, `totalAssets`, `totalLiabilities`, `liquidAssets`, `totalMonthlyDebtPayment`, `splitsOutstanding`) now sums Dineros and calls `fromDinero` only at the function edge. `effectiveAmount` is kept as a thin `number`-returning wrapper for callers that don't yet need Dinero. Public signatures unchanged — every existing call site works without any change.
- Tests in [`calculations.test.ts`](react/src/lib/__tests__/calculations.test.ts) **tightened from `toBeCloseTo(x, 10)` to strict `.toBe(x)`** where exactness is now achievable (which is most of them — single-currency integer sums + the FX cases that are quantised at the boundary). The previously-tolerant assertions were a hedge against the very drift that's gone.
- **New `CON-UNIT-046`** pins TD-01 phase B's signature improvement directly: summing 10 expenses of `$0.10` returns exactly `-1.00` via `totalBalance`. Before phase B, the reducer drifted into `-1.0000000000000002` because of the classic `0.1 + 0.2 ≠ 0.3` float problem.
- `computeEmi` / `splitEmiPortions` (loan math) intentionally **not yet migrated** — they go to Phase C (PR #10) alongside the rest of `amortization.ts`.

Phases C (PR #10) and D (PR #11) remain queued.

---

## v6.4.15 — TD-01 phase A: decimal money — dinero.js at the FX boundary (remediation PR #8) *(2026-05-23)*

**TD-01 (decimal money) starts here.** Phase A of a phased rollout. The `convert()` FX function previously did `(amount / rFrom) * rTo` on raw JS floats, which drifted across round-trips and across aggregations — the canonical TD-01 example. This release wires `convert()` through **dinero.js v2** with banker's rounding at the FX boundary. The public signature is unchanged (number → number, major units), so no caller has to change today; the gain is that the conversion math is now exact integer arithmetic with currency-aware re-quantisation at the edge.

- [`react/src/lib/money.ts`](react/src/lib/money.ts) — new boundary layer. `CURRENCY_REGISTRY` registers all 12 supported currencies with the `@dinero.js/currencies` definitions (JPY=0 decimals natively); `toDinero` / `fromDinero` scale into and out of integer minor units; `convertViaUsdRates` does the FX through USD as before but each leg is dinero-mediated. After every conversion the result is re-quantised to the target currency's native exponent using banker's (half-to-even) rounding, so sub-cent precision from `(amount × rateScaled)` does not bleed through to subsequent operations.
- [`react/src/lib/format.ts`](react/src/lib/format.ts) — `convert()` body now delegates to `convertViaUsdRates(toDinero(...))` then `fromDinero(...)`. Same arguments, same return type, exact math in the middle.
- [`react/src/lib/__tests__/money.test.ts`](react/src/lib/__tests__/money.test.ts) — six new ID-tagged unit tests (`CON-UNIT-040..045`) pinning the contract every later phase will lean on (registry coverage, fallback semantics, JPY zero-decimals, and the quantisation that fixed CON-UNIT-006).
- [`react/src/lib/__tests__/format.test.ts`](react/src/lib/__tests__/format.test.ts) — **`CON-UNIT-006` flipped** from a TD-01 *characterization* test ("round-trip USD→EUR→USD does NOT return the original") to a positive assertion of the fixed behaviour using strict `.toBe(start)` rather than `toBeCloseTo`. The catalog row in [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md) is updated to match.
- New dev-deps: `dinero.js@^2.0.2` (stable) + `@dinero.js/currencies@^2.0.0-alpha.14`.

**What this PR explicitly does *not* do** (planned for the next phases):

- Phase B (PR #9): migrate `calculations.ts` aggregations to operate in dinero internally so sums no longer drift across `reduce`.
- Phase C (PR #10): migrate `amortization.ts` (EMI/interest split/schedule/payment apply).
- Phase D (PR #11): adapter row mappers, `Money` UI component, types.ts `Money` opaque type, charts.

The bundle gains ~5 KB tree-shaken from dinero.js v2.

---

## v6.4.14 — Route-level code splitting (remediation PR #5) *(2026-05-23)*

Performance release. Addresses **TD-11** from the technical-debt register. All page imports in [`react/src/App.tsx`](react/src/App.tsx) now use `React.lazy` and the `<Routes>` blocks are wrapped in `<Suspense fallback={…}>`. Because Recharts is imported only from `components/charts/Charts.tsx` (used by Dashboard, Reports, NetWorth), the route-level split means Recharts ships only in those three route chunks — not in the initial bundle, and not on the Transactions / Budgets / Goals / Settings / Help paths. Faster first paint on mobile and low-bandwidth connections. No user-visible change.

- [`react/src/App.tsx`](react/src/App.tsx) — every page import (consumer routes + auth routes + a new `__e2e_error` test route for `CON-E2E-005`) converted to `React.lazy`; `<Suspense>` boundary added inside `AppShell` and around the auth-only `<Routes>` block.
- [`react/e2e/tests/code-splitting.spec.ts`](react/e2e/tests/code-splitting.spec.ts) — new spec **`CON-E2E-006`** observes network requests on `/transactions` (asserts no Recharts chunk is fetched), then on `/dashboard` (asserts it is). Catalogued in [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md).
- **Review note (engineering):** the originally-submitted patch also tried to wrap every individual Recharts primitive (`<AreaChart>`, `<Area>`, `<XAxis>`, …) in its own `React.lazy`/`Suspense` inside `Charts.tsx`. Recharts requires its primitive children to register synchronously with their parent, so that approach broke chart rendering and produced N+1 redundant dynamic imports of the same module. Reverted to the original `Charts.tsx`; the route-level split above is the correct and sufficient implementation.

---

## v6.4.13 — Top-level error boundary (remediation PR #4) *(2026-05-23)*

Resilience release. Addresses **TD-05**. A top-level `<ErrorBoundary>` now wraps `<BrowserRouter>` in [`react/src/main.tsx`](react/src/main.tsx). Any uncaught render error now shows a friendly fallback ("Something broke — Your data is safe locally") with a Try-Again button that resets the boundary state. No data loss; localStorage and the sync queue are untouched.

- [`react/src/components/ui/ErrorBoundary.tsx`](react/src/components/ui/ErrorBoundary.tsx) — new class component using `getDerivedStateFromError` + `componentDidCatch`; Sentry wiring placeholder for a future PR.
- [`react/src/main.tsx`](react/src/main.tsx) — boundary mounted at the React root, outside `<BrowserRouter>` so route errors are also caught.
- [`react/src/pages/__e2e__ErrorTest.tsx`](react/src/pages/__e2e__ErrorTest.tsx) — tiny page that throws on render, mounted at `/__e2e_error` (added in v6.4.14's App route table) purely so the E2E test below can exercise the boundary.
- [`react/e2e/tests/error-boundary.spec.ts`](react/e2e/tests/error-boundary.spec.ts) — new spec **`CON-E2E-005`** navigates to `/__e2e_error`, asserts the fallback, clicks Try Again, asserts recovery. Catalogued in [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md).

---

## v6.4.12 — Transactions list virtualization (remediation PR #3) *(2026-05-23)*

Performance-only release. Addresses **TD-17**. The Transactions page list now uses `@tanstack/react-virtual`, so the DOM contains only O(viewport) row nodes even with 10 000+ transactions. Visible UI, filters, search, day-filter chip, calendar toggle, and row actions are all unchanged.

- [`react/src/pages/Transactions.tsx`](react/src/pages/Transactions.tsx) — list block wrapped in a fixed-height scroll container driven by `useVirtualizer`. Estimate size 64 px (matches `TxnRow`'s `py-2.5` + 1px border); overscan 8 rows.
- [`react/src/components/transactions/TxnRow.tsx`](react/src/components/transactions/TxnRow.tsx) — added `data-testid="txn-row"` so the acceptance check (`document.querySelectorAll('[data-testid="txn-row"]').length` ≤ ~40 at 10k rows) is reproducible.
- [`react/package.json`](react/package.json) — added `@tanstack/react-virtual` dependency.
- **Review note (engineering):** the originally-submitted patch placed the `useRef` and `useVirtualizer` calls *inside the JSX*, as raw `const …` statements between the `<EmptyState />` ternary and the closing `</Panel>`. That was a TypeScript compile error and a Rules-of-Hooks violation. Hoisted into the component body, after `filtered` is defined and before the JSX return.

---

## v6.4.11 — Test scenarios master catalog + per-scenario audit evidence (remediation PR #2) *(2026-05-23)*

Tooling-only release, no user-visible change. Establishes a **master Test Scenarios catalog** and rebuilds the automation report so every run leaves durable, per-scenario evidence for both success and failure. Closes finding **N1** of the 2026-05-22 assessment for the consumer side by tagging every consumer test with a stable ID.

- [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md) — new master catalog. Every scenario in code is listed here with a stable `{APP}-{LAYER}-{NNN}` ID, the file it lives in, a description, and any TD link. Regression-managed: PRs adding / renaming / removing scenarios must update this file in the same commit.
- [`scripts/test-scenarios-check.mjs`](scripts/test-scenarios-check.mjs) — CI reconciler. Walks `react/src/lib/__tests__`, `react/e2e/tests` (and admin's). Fails the gate on: orphan ID in code, orphan ID in doc, duplicate IDs, retired-ID reuse, or file-column drift.
- Consumer tests now all carry their TS ID in the title: `CON-UNIT-001..039` across `format.test.ts` / `calculations.test.ts` / `amortization.test.ts`; `CON-E2E-001..004` in `smoke.spec.ts`. One characterization test pins TD-01: `CON-UNIT-006 · [TD-01] round-trip USD→EUR→USD does NOT return exactly the original`.
- [`scripts/automation-run.mjs`](scripts/automation-run.mjs) — report rewrite. Every run's `report.md` now includes a **Test scenarios** section: per-app × per-layer pass/fail/total matrix, the catalog reconciler line, **Failure details** with the error message + stack excerpt per failed TS ID, and a complete **Pass register** capturing every passing TS ID + duration for audit. `summary.json` gains a `scenarios.records` array. The run register `automation-runs/INDEX.md` now includes a Scenarios cell on every row.

---

## v6.4.10 — ESLint floor (remediation PR #1) *(2026-05-23)*

First real linter for the consumer app — the old `npm run lint` was `tsc --noEmit` (now preserved as `npm run typecheck`). Tooling-only, no user-visible change. Closes finding **N2** of the 2026-05-22 remediation assessment ("there is no real linter anywhere") and gives every later [`TECH_DEBT.md`](TECH_DEBT.md) PR a real `react-hooks/exhaustive-deps` and unused-vars signal.

- [`react/eslint.config.js`](react/eslint.config.js) — new flat config: `@eslint/js` recommended, `typescript-eslint` recommended (non-type-checked, fast), `react-hooks` plugin. `rules-of-hooks` as error. `exhaustive-deps`, `no-unused-vars`, `no-explicit-any` as warnings — surfaces the pre-existing debt without blocking the gate, ratcheted to errors as the related TECH_DEBT items land.
- [`react/package.json`](react/package.json) — `lint` now runs `eslint .`; added `typecheck` script for the previous `tsc --noEmit` behaviour. Added dev-deps: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`.
- `e2e/` is ignored by ESLint (matches tsconfig); Playwright's fixture-injection `use` callback was being mis-flagged as a React hook.
- [`react/src/pages/Households.tsx`](react/src/pages/Households.tsx) — the first real bug ESLint found: a `cond && fn()` short-circuit at statement position in the invite-sent handler (no-op as written). Rewritten as `if (cond) fn()`.
- [`scripts/automation-run.mjs`](scripts/automation-run.mjs) — relabelled the existing `lint` gate to "ESLint" and split out a new "type-check" gate so both stay independently visible in `report.md`.

---

## v6.4.9 — Calendar: all months, recurring projection, day filter, on-demand *(2026-05-22)*

Reworked the Transactions expense calendar ([`react/src/components/transactions/TxnCalendar.tsx`](react/src/components/transactions/TxnCalendar.tsx)) from a single-month grid into a full navigable calendar.

- **All months, with navigation.** ‹ / › step through any past or future month; a "Today" shortcut jumps back to the current month. Logged-expense days are highlighted across every month, not just the filtered one.
- **Future recurring projection.** Upcoming days that a recurring **expense** schedule will fire on are shown in a distinct **denim** colour ("upcoming"), so you can see planned payments ahead. Past/today shows actual logged expenses (sage).
- **Clickable days.** Tapping a day filters the transaction list to that exact date (with a clearable chip); tapping it again clears. Works on past, today and future days.
- **On-demand.** The calendar is hidden by default and toggled by a new **Calendar** icon button beside *Add Transaction* — it no longer always occupies the top of the page.
- Today is ringed; the selected day is outlined.

---

## v6.4.8 — Auto-even split shares *(2026-05-22)*

Splitting a bill no longer requires mental math.

- [`react/src/components/transactions/TransactionFormModal.tsx`](react/src/components/transactions/TransactionFormModal.tsx):
  - Split shares now **default to an even split** of the bill and **auto-rebalance** as participants are added/removed or the amount changes.
  - The split stays in auto mode until you **type a share by hand** — then it respects your numbers and stops rebalancing (so manual amounts are never clobbered).
  - The toolbar button shows the current mode (`⚖ Even (auto)` vs `⚖ Even split`) and one click resets to an even split. Editing a participant's *name* never disturbs shares.

---

## v6.4.7 — Calendar view on Transactions page *(2026-05-22)*

Added a calendar visualization to the Transactions page, showing which days of the selected month had expenses logged (highlighted) versus missed (unhighlighted). The calendar is always in sync with the user's transaction data, including backend/cloud and local changes.

### Features
- [`react/src/pages/Transactions.tsx`](react/src/pages/Transactions.tsx), [`react/src/components/transactions/TxnCalendar.tsx`](react/src/components/transactions/TxnCalendar.tsx):
  - Calendar grid for the selected month, with each day showing if an expense was logged.
  - Days with expenses are highlighted; missed days are dimmed.
  - Works with all transaction filters and is always up to date with backend/local data.

---

## v6.4.6 — Linked accounts, dynamic needs/wants, AI usage metrics, split-bill UX *(2026-05-21)*

A feature release plus a stabilisation pass. **Two files (`TransactionFormModal`, `NetWorth`) had shipped in a non-compiling state in an earlier v6.4.6 draft** — both were reconstructed cleanly, the build is green again, and the intended features were re-implemented correctly.

### Build stabilisation (regressions fixed)
- `TransactionFormModal.tsx` had been corrupted (split-bill JSX pasted at module top-level, imports/interfaces/component signature deleted). Rebuilt from the v6.4.5 base.
- `NetWorth.tsx` had a temporal-dead-zone crash (an effect referencing `assets`/`toast` before declaration) plus type errors (`includes(undefined)`, invalid toast kind `'warn'`). Effect moved below declarations, runs once per mount, kind corrected to `'warning'`.
- `aiSummary.ts` — removed unwired stub sub-agents that intercepted "how can I save / insights" questions and returned canned `(stub)` text instead of the real data-driven answers.

### Linked accounts drive payments — [`react/src/lib/accounts.ts`](react/src/lib/accounts.ts)
- A user's spendable accounts are now derived from **Net Worth**: cash + bank assets (`cash`/`checking`/`savings`) + credit-card debts. The Add-Transaction **Account** dropdown lists exactly these (encoded as `cash` / `asset:<id>` / `debt:<id>`).
- Expense, income and transfer now **require** an account. Legacy `PAYMENT_METHODS` values still resolve for display so historical rows are never lost. `PaymentMethodChip` resolves all three forms.

### Dynamic needs/wants categorisation — [`react/src/lib/categorization.ts`](react/src/lib/categorization.ts)
- The need/want mapping now lives in the **`category_classifications`** DB table (admin-editable, globally read), with the static `NEEDS_WANTS_MAP` as offline fallback. Reports' Needs-vs-Wants panel reads the live mapping.

### AI usage metrics — [`react/src/lib/aiUsage.ts`](react/src/lib/aiUsage.ts)
- Each Ask-FinFlow message is classified for **intent** + **sentiment** locally and logged to the **`ai_usage`** table. Privacy-first: only intent, sentiment and message length are stored — never message content. Surfaced for the business in the admin app's new AI Intelligence page.

### Split-bill UX & recurring modal
- Split editor: auto-equal split, one-click add/remove participants, Backspace/Delete on an empty row removes it, and live validation messages.
- `Recurring.tsx`: schedules are now fully editable (pre-filled on edit) with graceful empty/invalid day-of-month handling.

### Schema (additive, non-destructive)
- New tables `category_classifications` and `ai_usage` (RLS via `is_member` / `is_admin`), plus the `admin_ai_usage_summary()` SECURITY DEFINER RPC for the admin dashboard.

---

## v6.4.5 — Help page: real screenshots & interactive GIFs *(2026-05-21)*

The Help page now teaches with **real captures of the live app**, not prose alone.

### Help content consolidated
- [`react/src/pages/Help.tsx`](react/src/pages/Help.tsx) — reduced from 17 fragmented topics to **8 focused, searchable topics**, each backed by a real screenshot or animated walkthrough. Images render in a `<figure>` with a caption and an `onError` fallback that hides the figure if an asset is ever missing (so the page never shows a broken-image icon).

### Eight media assets shipped to `react/public/help/`
A mix of **WEBP screenshots** and **animated GIFs**, all captured from the real React app (v6.4.x design — Pip mascot, FinFlow wordmark, coral buttons) seeded with representative family data:
- `getting-started.webp`, `pulse.webp`, `budgets-goals.webp`, `debt-networth.webp`, `planner.webp`, `settings.webp` — full-screen WEBP (16–53 KB each, 1340 px wide).
- `add-transaction.gif`, `split-bill.gif` — interactive walkthroughs showing the Add Transaction modal being filled in and a bill being split (≈ 220–250 KB each, 1080 px wide).

### Reproducible capture pipeline
- [`react/scripts/capture-help.mjs`](react/scripts/capture-help.mjs) — drives the locally-installed Chrome via `puppeteer-core` against a local-mode preview build (localStorage adapter, seeded demo data), screenshots each page/modal, and encodes the GIFs with `gifenc` + `pngjs` (pure-JS, no native deps). Static frames are converted PNG→WEBP and the GIFs downscaled via `sharp-cli`. Re-run with `BASE=<preview-url> node scripts/capture-help.mjs`.
- Dev-only deps added: `puppeteer-core`, `gifenc`, `pngjs`. No impact on the production bundle.

---

## v6.4.4 — FinFlow Design System v2 alignment *(2026-05-21)*

Adopted the **FinFlow Design System v2** handoff from claude.ai/design (tokens.css + lib.jsx `FF.*` specs). Visual/styling only — no behaviour or data changes.

### Tokens
- Injected the full `--ff-*` token set into [`react/src/index.css`](react/src/index.css): warm-paper surfaces (canvas / surface / shell), 4-step ink scale (`ink` → `ink-4`), line steps (`line` / `line-2` / `line-strong`), coral brand ramp (coral / soft / tint / deep / deep-tint), semantic colours + tints (sage, olive, honey, butter, denim, plum), the type scale, radii (4/6/8/14/20/pill), paper-soft shadows (1–4), and motion eases/durations. Added a dark-theme remap so the tokens stay correct in dark mode.

### Components (matched to `lib.jsx` FF specs)
- **Buttons** — radius **9px**, weight 600, 5 kinds: `primary` (coral), `ink` (dark solid), `ghost` (outline), `secondary`/`subtle` (surface fill), `danger`/`destruct` (terracotta) + `.btn-sm` / `.btn-lg` size modifiers.
- **Inputs** — height 40, radius 8, surface bg, line-2 border, coral focus ring; textareas/selects keep auto height.
- **Cards** — `.panel` now matches `FF.Card` (surface bg, `--ff-line` border, r8, shadow-1).
- `.mono-label` (mono 10px / 0.14em / ink-3) and `.display-italic` (serif) aligned.

### Brand — Pip + wordmark
- **Pip mascot** upgraded from the simplified circle to the real design-system character — coral radial-gradient body, **eyes, cheeks, and a smile** — in the consumer Sidebar, MobileBar, and `public/favicon.svg`.
- **Wordmark** now renders **"Fin" upright + "Flow" italic in coral** (Newsreader serif, weight 500, -0.015em) per the FF.Wordmark spec, replacing the all-italic treatment.

Verified in-browser: sidebar shows the faced Pip + Fin*Flow* wordmark, coral FF buttons, paper-warm cards.

---

## v6.4.3 — Split-transaction creation + button/input styling *(2026-05-20)*

Two regressions vs the vanilla app, both fixed.

### Split transactions can be created again
The vanilla shell let you split a bill across participants; the React `TransactionFormModal` only *preserved* an existing `split` (`initial?.split`) — there was **no UI to create one**, so the feature was effectively missing even though the DB (`extras.split`), the `Splits` page, and `splitsOutstanding()` all supported it.

- [`react/src/components/transactions/TransactionFormModal.tsx`](react/src/components/transactions/TransactionFormModal.tsx) — added a "🤝 Split this bill" section (expense only): "who paid" (you / someone else), a participants-and-shares editor (add/remove people, You is fixed), and a live "shares total vs bill" validator. On save it builds the full `SplitInfo` (`totalAmount`, `yourShare`, `paidBy`, `participants[]` with correct `paid` flags) and validates that shares sum to the bill. Editing an existing split rehydrates the form.
- Cash-flow stays correct: `effectiveAmount()` already counts only `yourShare`; the full bill is stored as `amount` + `split.totalAmount`.
- **Verified e2e:** created a ₹100 dinner split (You ₹50 / Alex ₹50, you paid) → persisted to `extras.split` in Supabase → Splits page shows "Owed to you ₹50.00 · 1 outstanding item".

### Buttons & inputs on the ported pages now render styled
The 7 v5-ported pages (Budgets, Goals, Debts, Net Worth, Splits, Settings) used `className="btn-primary"` / `btn-secondary` / `btn-ghost` / `input`, but **those classes were never defined** — Tailwind's preflight strips native button styling, so they rendered as plain clickable text and unstyled inputs.

- [`react/src/index.css`](react/src/index.css) — added `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`, and `.input` to the `@layer components` block, using the Paper-Warm design tokens (coral primary, hover lift, focus ring). This fixes every Add/Edit/Delete affordance and form field across all ported pages at once.
- **Verified:** Budgets/Goals/Debts/Net Worth now show proper coral buttons and styled inputs.

---

## v6.4.2 — Critical sync fix: cloud writes never persisted *(2026-05-20)*

**Severity: critical (data integrity).** Locally-created records — transactions, budgets, goals, debts, assets — were never reaching Supabase. They lived in the local cache and looked saved in the UI, but every cloud write silently failed and the record sat in the sync queue forever. This is why the admin dashboard reported `totalTransactions: 0` despite transactions being "added", and why a test transaction from a prior session was still stuck in the queue.

### Two independent root causes

**1. Non-UUID ids** — [`react/src/lib/format.ts`](react/src/lib/format.ts)
`uid()` generated `Date.now().toString(36) + Math.random().toString(36)` (e.g. `mpe036yty4vnauz7yif`). The cloud schema's primary-key columns are `uuid`, so every insert was rejected with `22P02 invalid input syntax for type uuid`. Fixed to `crypto.randomUUID()` with an RFC-4122 v4 fallback for non-secure contexts.

**2. UPDATE instead of INSERT** — [`react/src/lib/supabaseAdapter.ts`](react/src/lib/supabaseAdapter.ts)
`SupabaseAdapter.upsert()` branched on `row.id`: when an id was present it ran `UPDATE … WHERE id = ?`. But the local cache *always* assigns a client-side id before queueing, so the very first sync of any new record took the UPDATE branch, matched **zero rows**, and `.single()` threw — the op then sat in the queue forever. Replaced the insert/update branch with a real `.upsert(row, { onConflict: 'id' })` (INSERT … ON CONFLICT (id) DO UPDATE), which is exactly the write-queue's contract.

### Safeguard — [`react/src/lib/hybridAdapter.ts`](react/src/lib/hybridAdapter.ts)
`flushQueue()` now drops queued ops carrying a non-UUID id (legacy records created before fix #1) instead of retrying them forever. A single poisoned op used to permanently jam the queue and block every later valid write; now it's dropped with a console warning and the queue drains.

### Verified end-to-end (browser + DB)
- Added a transaction → assigned a UUID → flushed → confirmed present in the `transactions` table via SQL; sync queue drained to 0.
- Hard refresh → both test rows re-rendered from the cloud (full write → cloud → reload → cloud-read round-trip).
- Legacy poisoned queue items auto-dropped, no longer jamming the queue.

### Known limitation
Records created in cloud mode *before* this fix have local-only, non-UUID ids and never synced. The safeguard stops them jamming the queue, but they won't retroactively sync — they must be re-saved. New records are unaffected.

---

## v6.4.1 — Sidebar polish + Debt & Asset form parity *(2026-05-10)*

A small follow-up to v6.4 covering three minor UX requests.

### Sidebar logo → Dashboard
The FinFlow word-mark in the sidebar header is now a `<Link to="/dashboard">` with hover/focus styles and an `aria-label`. Previously it was static text. Mobile: the link also closes the open drawer, mirroring the existing `NavLink` behavior. File: [react/src/components/layout/Sidebar.tsx](react/src/components/layout/Sidebar.tsx).

### Sidebar nav reorganised
- **Budgets** moves from `TRACK` → `PLAN` (it sits next to Goals — both are forward-looking targets).
- **Splits** moves from `PLAN` → `TRACK` (it records the past, not future planning).

Resulting groups:
- **TRACK** — Dashboard · Transactions · Splits · Recurring
- **PLAN** — Budgets · Goals · Debts · Net Worth
- **ANALYZE** — Reports · Insights
- **ACCOUNT** — Households

File: [react/src/components/layout/Sidebar.tsx](react/src/components/layout/Sidebar.tsx).

### Debt and Asset form modal parity
Both forms now match the `Add Transaction` / `Add Budget` / `Add Goal` modal style instead of the inline `Panel` form they used before. Same components (`Modal`, `Field`, `FieldRow`, `Input`, `Select`, `Button`), same store-driven open/close pattern, same Delete-link-bottom-left layout when editing.

- New [react/src/components/debts/DebtFormModal.tsx](react/src/components/debts/DebtFormModal.tsx) — type, due date, name, lender, account, current balance + currency, original principal, interest rate, min monthly payment, tenure.
- New [react/src/components/assets/AssetFormModal.tsx](react/src/components/assets/AssetFormModal.tsx) — type, liquidity, name, current value + currency, note.
- [react/src/store.ts](react/src/store.ts) — new slots `debtModalOpen / editingDebt / openAddDebt / openEditDebt / closeDebtModal` and `assetModalOpen / editingAsset / openAddAsset / openEditAsset / closeAssetModal`.
- Both modals mounted in [react/src/App.tsx](react/src/App.tsx) at the root.
- [react/src/pages/Debts.tsx](react/src/pages/Debts.tsx) and [react/src/pages/NetWorth.tsx](react/src/pages/NetWorth.tsx) — inline `Panel` forms removed; Add/Edit buttons now call the store actions.

### Verification — local build & preview *(2026-05-10)*

| Check | Result |
|---|---|
| TypeScript strict (`tsc -b`) | ✅ 0 errors |
| Vite production build | ✅ `built in 1m 18s` (exit 0) |
| Vite preview server | ✅ Boots on `http://127.0.0.1:4173/` |
| `GET /` | `200`, title `FinFlow — Family Finance OS` |
| `GET /favicon.svg` | `200`, `image/svg+xml` |
| `GET /manifest.webmanifest` | `200` |
| Sidebar logo click | ✅ Navigates to `/dashboard` |
| Sidebar order | ✅ TRACK = Dashboard / Transactions / Splits / Recurring; PLAN = Budgets / Goals / Debts / Net Worth |
| Debt modal | ✅ Opens from page `+ Add Debt`, edits via row Edit, deletes via inline link, validates name + balance |
| Asset modal | ✅ Opens from page `+ Add Asset`, edits via row ✎, validates name + value |

---

## v6.4 — Blocker sweep: persistence, form parity, budget periods, floating tools *(2026-05-10)*

A targeted sweep that closes seven user-reported blockers spanning data integrity, form UX, layout robustness, and navigation. **No production database changes** — every fix is client-side and backward-compatible with the existing schema. A follow-up `extras jsonb` migration on `budgets` is queued for v6.5 to lift the per-device limitation noted under "Budget periods" below.

### 1. Data persistence after refresh / sign-out → sign-in *(blocker)*

**Symptom:** Households created or transactions added would silently disappear after a hard refresh, or after signing out and back in. Cache survived the page reload, but a transient empty cloud response on the next `list()` would clobber it.

**Root cause:** `HybridAdapter.list()` unconditionally called `cache.replaceAll(entity, hid, fresh)` even when `fresh.length === 0`. RLS hiccups, slow propagation after a write, or a household-id mismatch on re-auth (sign-out reset `currentHouseholdId` to `local`, the next sign-in could land on a different cloud `hid` than the one whose `ff_<hid>_*` cache was held) all surfaced as data loss.

**Fix:**
- [react/src/lib/hybridAdapter.ts](react/src/lib/hybridAdapter.ts) — `applyCloudList()` helper plus a per-household-per-entity sentinel keyed `ff_cloud_synced_<hid>_<entity>`. An empty cloud response is now only trusted when the sentinel proves a prior successful sync. Sentinel is set after the first non-empty `list()` and after every successful `flushQueue()` write. Public `forceFullResync(hid)` API added for the upcoming Settings → Force Resync action.
- [react/src/store.ts](react/src/store.ts) — persists the active household id to `ff_last_cloud_hid` on sign-out and on `switchHousehold`, and prefers it over the adapter's default in `init()`. The `refresh()` reducer also carries a defensive guard: when an entity array would shrink from non-empty → empty for the same `hid`, the in-memory copy is kept and a toast warns *"Cloud sync looked empty — keeping local data. Use Force Resync if needed."*
- [react/src/lib/migration.ts](react/src/lib/migration.ts) — new `autoMigrateAnonToHousehold(adapter, hid)` runs after the first cloud refresh on a fresh sign-up. Probes 6 entities for cloud emptiness, then copies anon-cache rows up with fresh ids; guarded by `ff_anon_migrated_<hid>` so it cannot run twice.

### 2. Goals & Budgets forms now match Add Transaction *(blocker)*

**Symptom:** The Add Goal and Add Budget flows used inline forms (and `prompt()` for "+ Progress") that looked nothing like the polished Add Transaction modal.

**Fix:** Three new modals built on the same `TransactionFormModal` foundation:
- [react/src/components/goals/GoalFormModal.tsx](react/src/components/goals/GoalFormModal.tsx) — type, deadline, name, target+currency, current; validates name and target > 0.
- [react/src/components/goals/GoalProgressModal.tsx](react/src/components/goals/GoalProgressModal.tsx) — replaces `prompt()`. Single amount field, Enter-to-save, auto-marks complete when `current >= target`.
- [react/src/components/budgets/BudgetFormModal.tsx](react/src/components/budgets/BudgetFormModal.tsx) — category, period, limit+currency, color picker; validates limit > 0 and (for custom periods) start ≤ end.

Wired through new store slots `goalModalOpen / editingGoal / openAddGoal / openEditGoal / closeGoalModal`, `goalProgressModalOpen / progressGoal / openGoalProgress / closeGoalProgress`, and `budgetModalOpen / editingBudget / openAddBudget / openEditBudget / closeBudgetModal`. All three are mounted once at App root in [react/src/App.tsx](react/src/App.tsx). [react/src/pages/Goals.tsx](react/src/pages/Goals.tsx) and [react/src/pages/Budgets.tsx](react/src/pages/Budgets.tsx) were rewritten to drop their inline forms and call the store actions.

### 3. Multi-period budgets with calendar-aligned aggregation *(blocker)*

**Symptom:** Budgets only supported a fixed monthly cycle. Quarterly, half-yearly, annual, and custom-window budgets were impossible.

**Fix:**
- [react/src/types.ts](react/src/types.ts) — `BudgetPeriod = 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'custom'`, plus optional `periodStart` / `periodEnd` for custom.
- [react/src/lib/calculations.ts](react/src/lib/calculations.ts) — `budgetWindow(b, today)` returns the calendar-aligned `{start, end}` ISO range for the budget's period (Q1=Jan–Mar, H1=Jan–Jun, etc.); `spendByCategoryInRange()` aggregates only transactions inside that window, converted to base currency; `periodMonths()` powers the Period · Monthly view toggle so users can compare budgets normalised to a per-month rate.
- [react/src/pages/Budgets.tsx](react/src/pages/Budgets.tsx) — new view-mode toggle, period label on each card, summary strip (Budgeted / Spent / Over budget).

**Schema-compatibility note:** The production `budgets` table has `unique(household_id, category)` and no `extras jsonb` column. To avoid a DB migration this release, period metadata is held in a local-only overlay [react/src/lib/budgetMeta.ts](react/src/lib/budgetMeta.ts) keyed `ff_budget_periods`. Limitation: period choice does not roam across devices. The v6.5 milestone has a queued migration to add `extras jsonb` and lift this restriction.

### 4. Pip favicon + manifest *(blocker)*

The browser tab was using the default Vite icon. New assets:
- [react/public/favicon.svg](react/public/favicon.svg) — the FinFlow pip (extracted from the inline `<Logo />` SVG in the sidebar) as a standalone SVG.
- [react/public/manifest.webmanifest](react/public/manifest.webmanifest) — PWA manifest with brand colors.
- [react/index.html](react/index.html) — adds `apple-touch-icon`, `manifest`, and updates `theme-color` to coral.

### 5. Notification popover viewport-clamped *(blocker)*

**Symptom:** On desktop, the notification popover anchored relative to the bell button could slide off the right edge of the viewport.

**Fix:** [react/src/components/layout/NotificationCenter.tsx](react/src/components/layout/NotificationCenter.tsx) rewritten to render via `createPortal` to `document.body`. A `useEffect` computes `{top, left, width, maxHeight}` from the bell's bounding rect and clamps `width = min(320, viewportWidth - 24)` and `left` to keep the panel fully on-screen. Recomputes on `resize` and capture-phase `scroll`. Esc closes; click-away handles both the trigger and the portalled panel. Body and titles get `break-words` so very long notifications can no longer push the panel wider.

### 6. Adaptive `Money` component for billion-scale values *(blocker)*

**Symptom:** Very large currency values (e.g. ₹1,250,000,000) overflowed KPI cards and table cells, breaking the layout.

**Fix:**
- [react/src/components/ui/Money.tsx](react/src/components/ui/Money.tsx) — new component. Renders the full formatted value when it fits within `maxChars`; otherwise falls back to compact notation (`1.25B`, `42.5M`, `9.4K`). Always wraps in `<span class="tabular-nums truncate inline-block max-w-full">` and adds a `title` attribute with full precision so the hover always shows the exact number. Uses `−` (minus) for negatives and an optional `+` prefix when `signed`.
- [react/src/lib/format.ts](react/src/lib/format.ts) — `fmtShort()` now handles billions (`B`) and lowers the K threshold to ≥ 1,000.
- Applied across Dashboard, Reports, NetWorth, Budgets, Goals, and TxnRow with appropriate `maxChars` tuned per cell width.

### 7. Planner & Chat → floating action buttons *(blocker)*

**Symptom:** Planner and Ask FinFlow lived in the sidebar `ANALYZE` group. Both work conceptually as overlays on top of any page, so requiring a full route navigation to reach them felt buried.

**Fix:** [react/src/components/layout/FloatingTools.tsx](react/src/components/layout/FloatingTools.tsx) — two stacked FABs in the bottom-right (offset above MobileBar on small screens). Clicking opens a right-side drawer (`w-[min(28rem,100vw)]`) hosting the existing Planner or Chat page. Esc and click-away close. Mounted in [react/src/components/layout/Layout.tsx](react/src/components/layout/Layout.tsx); removed from [react/src/components/layout/Sidebar.tsx](react/src/components/layout/Sidebar.tsx). The `/planner` and `/chat` routes are intentionally preserved for deep links.

### Verification — local build & preview *(2026-05-10)*

Verified locally on Windows + Node 22.20:

| Check | Result |
|---|---|
| TypeScript strict (`tsc --noEmit` via `vite build`) | ✅ 0 errors |
| Vite production build | ✅ `built in 1m 33s` (exit 0) |
| Vite preview server | ✅ Boots clean on `http://localhost:4173/` |
| Notification popover viewport clamp | ✅ Right-edge anchor stays fully on-screen at 1280, 1024, 768, and 360 px widths |
| `<Money>` overflow guard | ✅ 1.25B value renders as `1.25B` with full-precision `title`; no KPI card overflow |
| Goals + Budgets modal parity | ✅ Both modals open from page `+ Add` buttons and from store actions; close via Esc / Cancel / backdrop |
| Budget period windows | ✅ `budgetWindow()` returns calendar-aligned ranges (Q1/Q2/Q3/Q4, H1/H2, FY); custom range honored |
| Persistence sentinel | ✅ Empty cloud response no longer overwrites populated cache; `ff_cloud_synced_*` keys appear in `localStorage` after first non-empty sync |
| Sign-out → sign-in identity | ✅ `ff_last_cloud_hid` round-trips; cache survives the cycle |
| FloatingTools FABs | ✅ Open/close, Esc handler, drawer hosts Planner & Chat |
| Favicon | ✅ Pip favicon resolves at `/favicon.svg`, manifest served at `/manifest.webmanifest` |

Known build warnings (unchanged from v6.3): missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the local shell (expected — local-only mode), and a chunk-size > 500 kB warning (deferred to v6.5 code-split task).

---

## v6.3.1 — Admin dashboard sanitised: every page on live data *(2026-05-10)*

> Strictly speaking this release is **admin-side** work — see [`admin/CHANGELOG.md` v1.0.0](../admin/CHANGELOG.md). The matching consumer build is still v6.3.1 because no consumer code changed; the version was bumped only to keep the release-train numbers in lockstep. Listed here so the consumer changelog stays a complete release record.

No consumer-app code changes. This entry exists for cross-referencing only.

---

## v6.3 — Content module + admin↔Supabase + global Add-Txn modal *(2026-05-10)*

### Add Transaction button — actually fixed

The previous v6.2.2 wired the button on the Transactions page only. There is a **second** Add Transaction button on the **Dashboard** that was still a no-op stub. Both are now fixed via a single store-controlled modal hoisted to App root.

What changed:

- **Store** (`react/src/store.ts`) — new `txnModalOpen` / `editingTxn` state + `openAddTxn()` / `openEditTxn()` / `closeTxnModal()` actions. Any page can trigger the modal without prop-drilling.
- **App.tsx** — `<TransactionFormModal />` mounted once at the root, alongside `<ToastHost />`. The modal binds to store state by default; explicit `open` / `initial` / `onClose` props are still supported for ad-hoc usage.
- **Dashboard.tsx** — Add Transaction button wired to `openAddTxn()`.
- **Transactions.tsx** — local modal state removed; both the page-level button and the per-row Edit button now route through the store.
- **Browser-verified end-to-end** via Claude in Chrome MCP: clicked the Dashboard button → modal opened → filled `description=Test, amount=42.50` → Add → transaction appeared in `/transactions` list as `−$42.50, Food & Dining` → clicked Edit → modal re-opened pre-populated.

### Content module — admin authors, consumers read

A dynamic, searchable, favoritable content surface that connects the admin and consumer apps via shared Supabase tables.

**DB migration `content_items_and_user_favorites` applied:**

- `public.admin_roles (user_id, role, granted_by, granted_at)` — server-side source of truth for who is an admin (super / roles / content). RLS allows self-read only.
- `public.is_admin(min_role text)` — `SECURITY DEFINER STABLE` helper. Bypasses RLS to check the calling user's tier.
- `public.content_items (id, slug, title, summary, body, topic, status, author_name, read_minutes, cover_emoji, published_at, created_at, updated_at)` — articles. Indexed on `(status, published_at DESC)` and `topic`. RLS:
  - SELECT — anyone authenticated reads `status='published'`; admins read all
  - INSERT / UPDATE / DELETE — `is_admin('content')` only
- `public.content_favorites (user_id, content_id, created_at)` — per-user reading list. RLS scoped to `user_id = auth.uid()` for all operations.
- 5 starter articles seeded (savings, debt, retirement, budgeting, tax).

**Consumer app — `react/`:**

- New `react/src/lib/insightsApi.ts` — `listPublishedContent()`, `listFavoriteIds()`, `addFavorite()`, `removeFavorite()`.
- New `react/src/pages/Insights.tsx` — card grid of published articles. Features:
  - Topic chip + read-minute estimate per card.
  - Search across title / summary / body / topic.
  - Topic filter row (`debt · tax · investment · budgeting · savings · retirement`).
  - **Favorite (♡)** toggle per card with optimistic update + rollback on error. Favorites are user-scoped, not household-scoped.
  - **Favorites-only filter** to view your reading list.
  - **Reader modal** with full body text, summary as a coral block-quote, and an in-modal favorite button.
  - Local-only mode shows a graceful "cloud required" empty state.
- Sidebar nav item under ANALYZE → "insights" with a `BookOpen` icon.
- New `/insights` route registered in `App.tsx`.

**Browser-verified end-to-end:** loaded `/insights`, all 5 seeded articles rendered. Clicked ♡ on "Emergency fund: 3 months or 6 months?" → favorite saved. Reader modal showed the full body. SQL query against `content_favorites` confirmed the row.

### Files changed (consumer)

```
react/src/store.ts                                         — global txnModalOpen + actions
react/src/App.tsx                                          — global modal mount, /insights route
react/src/pages/Dashboard.tsx                              — Add Transaction onClick
react/src/pages/Transactions.tsx                           — store-driven modal
react/src/components/transactions/TransactionFormModal.tsx — store fallback bindings
react/src/components/layout/Sidebar.tsx                    — Insights nav item
react/src/lib/insightsApi.ts                               — NEW
react/src/pages/Insights.tsx                               — NEW
```

---

## v6.2.2 — Add-Transaction wiring + GA4 *(2026-05-10)*

### Add Transaction button (Transactions page)

The `Add Transaction` button at `react/src/pages/Transactions.tsx:55` was a stub left over from the v6.0 React port — `<Button>+ Add Transaction</Button>` had no `onClick` handler, so it was silently a no-op. Same for the per-row `Edit` button.

> Subsequent v6.3 found a second instance of the same bug on the **Dashboard** and hoisted the modal to App root. See v6.3 entry above.

What shipped:

- New `react/src/components/transactions/TransactionFormModal.tsx` — full add/edit dialog. Fields:
  - Type (Expense · Income · Investment · Transfer)
  - Date · Description · Amount · Currency (12 supported)
  - Category — auto-filtered to `INCOME_CATEGORIES` / `EXPENSE_CATEGORIES` based on the selected type
  - Member · Payment method (30+ banks/cards/wallets) · Recurring (weekly/monthly/yearly) · Note
  - "🔒 Private — exclude from totals, charts and Pulse Score" checkbox
- Save calls `upsertTransaction()` via the Zustand store; in cloud mode this writes through `HybridAdapter` → Supabase.
- Edit mode also exposes a `Delete` action that calls `removeTransaction()`.
- Wired the page-level button to open the modal in add-mode; `useShortcuts({ n, N })` restores the **N** shortcut documented in Help.
- Wired the per-row `Edit` button to open the same modal pre-populated with the row's data via a new `onEdit?: (t: Transaction) => void` prop on `TxnRow`.

### Google Analytics 4 (GA4)

The standard `gtag.js` snippet for property `G-E3XKWZP850` is added to all three entry HTML files:

- `index.html` — v5 vanilla shell
- `react/index.html` — consumer React app
- `admin/index.html` — admin React app

Snippet placed in `<head>` after `<title>` and before font preconnects. Async loading.

> No client code references `gtag()` for custom events yet — pageviews are auto-tracked. Custom event tagging (sign-up, transaction-added, household-created) lands in v6.4.

---

## v6.2.1 — Households RLS recursion hotfix *(2026-05-10)*

Right after v6.2 deployed, signed-in users hit `{"message":"No API key found in request"}`. The error message is misleading — Kong/PostgREST returns it on a number of error paths. The actual root cause was an **RLS infinite recursion** on the `households` and `memberships` tables.

### What was happening

- `households` SELECT policy ran `EXISTS (SELECT 1 FROM memberships WHERE …)`.
- `memberships` SELECT policy ran `EXISTS (SELECT 1 FROM memberships m2 WHERE …)` — referencing **itself**.
- Postgres detected the cycle and aborted the query with error code `42P17`.
- PostgREST surfaced this as HTTP 500 on `GET /rest/v1/my_households`, which the Supabase gateway/cache occasionally re-shaped into the misleading apikey message.

Live API logs (last 24h) showed the smoking gun: a long sequence of `POST /auth/v1/token (200)` followed immediately by `GET /rest/v1/my_households (500)` for every user session.

### Fix shipped (server-side migrations)

Two `db/migration` operations, no client redeploy needed:

```sql
-- migration: fix_rls_recursion_via_security_definer_helpers
DROP POLICY "members read household"    ON public.households;
DROP POLICY "members see other members" ON public.memberships;

CREATE POLICY "members read household" ON public.households
  FOR SELECT USING ( public.is_member(id) );

CREATE POLICY "members see other members" ON public.memberships
  FOR SELECT USING ( public.is_member(household_id) );

-- migration: grant_execute_on_rls_helpers
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_in(uuid)  TO authenticated;
```

`is_member(h_id)` and `role_in(h_id)` are existing `SECURITY DEFINER STABLE` SQL functions. Calling them from inside the policy bypasses RLS on the `memberships` look-up — no cycle, no recursion. The functions still enforce auth via `auth.uid()` internally.

### Validated

| User | Result post-fix |
|---|---|
| `uday.kr27@gmail.com`     | Returns `My Household · personal · USD · owner` |
| `bhushandandolu8@gmail.com` | Returns `My Household · personal · USD · owner` |

---

## v6.2 — Friction-free signup + module port-out *(2026-05-10)*

### Pages ported from v5 stubs to React

All seven pages that previously linked back to the v5 vanilla shell are now native React components reading from the Zustand store and the `HybridAdapter`:

- **Settings** — profile (display name + email + household type + date format), three-card theme picker (Paper Warm / Dark / System), language + base currency, editable USD-base exchange rates table, debt preferences (Avalanche/Snowball + monthly extra payment), Sync & Backup (JSON snapshot · CSV transactions · clipboard copy), 8-counter account stats grid. Surfaces email-verification status and an explicit "Run onboarding wizard" link.
- **Budgets** — monthly budget grid wired to `spendByCategory()` for live progress. Per-row status pills: On track (green) · Near (amber, ≥ 80%) · Over (red, ≥ 100%). Summary strip (total budgeted · total spent · over-count). Add/edit form.
- **Goals** — 6-type goal cards with progress bars converted to base currency, deadline-countdown chip (overdue · < 30 days · normal), inline `+ Progress` prompt, mark-done/reopen toggle, completed-goals collapsible section.
- **Debts** — list sorted by `profile.payoffStrategy` with priority badge on the top item. Summary strip: total debt · min monthly payment · DTI %. Add/edit form, EMI breakdown toggle, `Record Payment` modal with the three part-payment choices (`reduce_tenure` / `reduce_emi` / `apply_advance`), payoff progress bar.
- **Net Worth** — Hero (Assets − Liabilities, sign-aware colour). Four ratio cards: Liquidity Ratio · Debt-to-Asset · Emergency Coverage (months) · Savings Ratio. Asset add/edit form. Balance sheet split: assets grouped by liquidity tier vs debts column.
- **Splits** — IOU summary (Owed to you · You owe via `splitsOutstanding()`), expandable split-transaction rows, per-participant Mark paid / Settle buttons, `Settle all` bulk action.
- **Help** — searchable 17-section accordion; topics cover Pulse Score, Budgets, Goals, Debt management, Net Worth, Splits, Planner, Recurring, Multi-currency, Multi-household, Backup, Keyboard shortcuts, Themes, Privacy, Languages, Transaction types.

The `<Stubs />` placeholder is removed from the router.

### Onboarding becomes opt-in (no more forced wizard)

Two problems with the previous gate:
1. **Local-mode users** were forced through a 4-step wizard before they could see the app.
2. **Cloud users** were never shown the wizard at all because the gate was `!cloudEnabled`-only — but `SignUp.tsx` still called `navigate('/onboarding')` to a route that didn't exist, so users fell through to `/dashboard` with an empty household.

What ships now:
- The forced gate in `App.tsx` is removed. Existing or fresh users without `profile.template` / `profile.onboardedAt` land on the dashboard like any other user — no onboarding wall.
- `/onboarding` is registered as a real route, reachable from the new Settings link (`Run onboarding wizard →` / `Re-run onboarding wizard →`).

### Cloud signup no longer strands users on a household-less account

**Root cause** identified: `handle_new_user` only inserted into `public.profiles` and never created a household. New users got an authenticated session but `households: []`, which made the consumer app silently fall back to `currentHouseholdId='local'` — so the app appeared blank with no way to recover.

**Migration `auto_create_household_on_signup` applied:**
- `handle_new_user()` rewritten as `SECURITY DEFINER` with `search_path = public`. It still inserts the profile, then immediately inserts a default `My Household` row (type=`personal`, base currency USD) for the new user. The pre-existing `handle_new_household` trigger fires on that insert and writes the owner membership.
- One-shot backfill ensured every existing auth user has at least one household.

### Email verification is no longer a gate

Built-in Supabase email delivery is rate-limited and unreliable. Rather than block signups behind an email round-trip, verification is now informational:

- `pages/auth/SignUp.tsx` — three-path signup:
  - **Path A** — auto-confirm enabled: session returned by `signUp()`, navigate straight to `/dashboard`.
  - **Path B** — confirmation enabled but password sign-in still works: immediately call `signIn(email, password)` so the user lands on `/dashboard` without waiting for an email. Shown as "verification pending" in Settings.
  - **Path C** — strict confirmation required: a non-blocking screen says the account is created and offers a `Continue to sign in →` button (with email pre-filled).
- **Settings → Profile** now shows a status pill (`Email verified` sage / `Verification pending` honey) plus a `Resend` button that calls `auth.resend({ type: 'signup', email })`.

To make Path A the default, set Supabase Dashboard → Authentication → Providers → Email → "Confirm email" to OFF. The client works correctly with the setting in either position.

---

## v7.5 — Rules-based Planner + AI Chatbot *(pre-2026-05)*

Two features from v7 PRD §05–06 deferred from v7 to v7.5 ship now in the consumer app at `react/`.

### New
- **AI Finance Planner** — `react/src/lib/plannerRules.ts` + `pages/Planner.tsx`. **Rules-based, NOT LLM.** 30+ rules across 5 domains (Income · Expenses · Investments · Debt · Tax). Each rule has priority, severity, and a deterministic trigger. Engine evaluates all, sorts by `severity × priority`, returns top 8. Zero hallucination — every recommendation traces to a specific rule and data point. Sets up the v8 LLM upgrade path: same rule outputs become structured prompts.
- **AI Chatbot scaffold** — `react/src/pages/Chat.tsx` with `lib/aiSummary.ts`. Privacy-safe aggregation: only categories + amounts + date ranges leave the device. **Never** merchant names, descriptions, or notes. Today the `StubChatBackend` answers via local pattern-matching against the safe summary; v8 wires the `SupabaseChatBackend` to a Supabase Edge Function calling Anthropic Claude Haiku. Clear "stub mode" indicator while the backend is unwired.

### Why now (per PRD §05)
> "An LLM-driven financial planner is a regulatory landmine. We are not FCA-authorised. Suggesting investment moves to users via an LLM exposes us to advice liability and hallucination risk on someone's actual money. v7.5 ships a deterministic, rules-based planner. The LLM version is v8 and ships behind a clear 'general guidance, not financial advice' disclaimer with proper guardrails."

The Planner page header carries the disclaimer in plain English.

---

## v7.0 — Onboarding · EMI · Recurring · Notifications *(pre-2026-05)*

Tier 1 of the v7 PRD. Three features ship in the consumer app at `react/`.

### New

**1. Smart Onboarding with 6 Profile Templates** *(PRD §02)*
4-step intake (90 second target). 6 templates each with: visible pages, pre-populated budgets/goals/debts, and Pulse Score weighting:
- **Young Couple** — joint goals, splits, holiday/down-payment funds
- **Family with Kids** — childcare, school fees, mortgage template
- **Single Earner / Single Parent** — emergency fund priority, no splits
- **Self-Employed / SMB Owner** — Personal/Business firewall, tax goal
- **Pre-Retiree / Retiree** — drawdown target, healthcare reserve, no debts
- **Student / Early Career** — student loan, tight budgets, building habits

`react/src/lib/templates.ts` is the single source of truth — page visibility, starter budgets/goals/debts, Pulse weights, primary concern. Sidebar reads `pagesForTemplate(template)` to filter visible nav items.

**2. EMI Re-amortisation Engine** *(PRD §03)*
Fixes a correctness gap: pre-v7 we used a flat interest/principal split that was wrong from month 2 onwards. New `react/src/lib/amortization.ts`:
- `calculateAmortizationSchedule(debt)` returns the full month-by-month {emi, interest, principal, outstanding} array
- `splitPayment(outstanding, rate, payment)` computes the correct split for any payment
- `applyPayment(debt, amount, choice)` handles part-payments with three user choices: **Reduce tenure** / **Reduce EMI** / **Apply as advance** (PRD's three-option modal)
- Matches Bank of England standard PMT to within £0.01

**3. Recurring Payments + Notifications** *(PRD §04)*
- **Recurring schedules** — `lib/recurring.ts` + `pages/Recurring.tsx`. Weekly / monthly / yearly / custom-day-of-month frequencies. Auto-confirm or pending-confirmation modes. Per-schedule reminder lead-time (1/3/7 days). Active/pause toggle.
- **Notification engine** — `lib/notifications.ts`. 6 types per the PRD: upcoming bill · missed payment · budget threshold (80% / 100%) · goal milestone (25/50/75/100) · weekly digest · custom reminder. Quiet hours, master toggle, per-type prefs.
- **NotificationCenter** — bell icon in sidebar/mobile bar with unread count, click-away dismissal, mark-read and dismiss actions per notification.
- **Web Push API** integration via `notifications.showWebPush()` — falls back gracefully when permission denied.

---

## v6.0 — React + TypeScript + Recharts *(pre-2026-05)*

Frontend stack rebuild. All v5 features remain available in the vanilla shell at the project root; the React app lives in `react/` as a side-by-side migration.

### New stack
- **Vite 5** dev server + production builder (replaces "open `index.html` directly")
- **React 18** + **TypeScript 5.6** strict mode
- **Tailwind CSS 3** with HSL custom-property tokens for the paper-warm theme
- **Zustand** for global state (no provider tree, full TS inference, ~1KB)
- **React Router v6** for deep-linkable URLs (`/dashboard`, `/reports`, etc.)
- **Recharts** for interactive charts (Area, Bar, Donut) — theme-aware via CSS vars, animated by default, with custom-styled tooltips, legend, and axes that match the FinFlow design system
- **Lucide React** for the icon set (1,400+ tree-shakeable icons; replaces hand-rolled SVG paths)

### Architecture
- **`DataAdapter` ported to TypeScript** with full type inference — same interface as v4.1, backward-compatible storage keys for the anonymous profile
- **Pure-TS `calculations.ts`** — Pulse Score (5 components), monthly aggregation, splits, EMI, financial ratios, insights — all framework-agnostic and unit-testable
- **Zustand store** — every CRUD action for transactions/budgets/goals/members/debts/assets/profile/rates routed through the adapter
- **Theme** as a class on `<html>` — Tailwind `dark:` modifier works, CSS HSL vars cascade to Recharts via the `recharts-*` class overrides in `index.css`
- **Custom `PulseGauge`** — kept as hand-crafted SVG conic-gradient for brand fidelity (Recharts radial-bar would have been close but not exact)

### Pages migrated in v6.0
- ✅ **Dashboard** — full: Pulse Score + 4 metric cards + insights bar + budget progress + recent transactions + active goals + category donut + net worth & debt summary
- ✅ **Reports** — full: 5-period selector (Day/Week/Month/Quarter/Year), Recharts Area chart for income/expense trend, Net bar chart, Category donut, Top categories bars, Period summary table
- ✅ **Transactions** — full: list with search + 5 filter dropdowns, payment method chips, all v5 transaction badges (private, investment, transfer, split, recurring, member, currency)

### Pages that remained stubs in v6.0 (later ported in v6.2)
The 7 pages Budgets, Goals, Splits, Debts, Net Worth, Settings, Help rendered a migration-progress placeholder linking to the v5 vanilla shell. All underlying logic was already ported to TypeScript — only the JSX UI remained.

---

## v4.1 — Cloud · Auth · Multi-Household *(pre-2026-05)*

The features deferred from v5 land. The React app at `react/` now wires a real Supabase backend behind the existing `DataAdapter` interface. **Local-only mode still works** — if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are unset, the app boots exactly as v6/v7 did.

> Note: v4.1 had two distinct ships — first an internal adapter refactor on the vanilla shell (no user-visible features), then this cloud release that bound the React app to Supabase. Both keep the v4.1 number because the second built directly on the first.

### What ships

**Auth**
- Email + password sign-up with verification
- Magic link sign-in
- Password reset flow
- OAuth helpers (Google/Apple/GitHub) — wired in `lib/auth.ts`, ready for provider config in Supabase
- Session persistence + auto-refresh
- Sign out from sidebar footer

**Data layer**
- `SupabaseAdapter` — full DataAdapter implementation against the Postgres schema in `db/schema.sql`. Maps every JS shape to/from snake_case columns. Soft-delete for syncable tables.
- `HybridAdapter` — production model: instant paint from LocalStorage cache, background refresh from Supabase, optimistic writes with a write queue that flushes when online. Graceful offline behaviour.
- Adapter selector in `store.ts` — picks `HybridAdapter` if env vars present, else `LocalStorageAdapter`. Identical interface either way.

**Multi-household**
- Cloud-backed `listHouseholds()` against the `my_households` view
- `createHousehold(name, type, currency)` — auto-creates an `owner` membership via the schema's trigger
- ProfileSwitcher now shows real cloud households when authed; click to switch (loads that household's data + subscribes to its realtime channel)
- New **Households** page (`/households`) — manage every household: members list, role editing, removal, danger zone (rename/leave/delete).

**Invitations**
- Send by email with role + household role — creates a row in `invitations` with a unique token (14-day expiry)
- Pending invitations panel on the household page with copy-link button
- `/invite/:token` route → `accept_invitation()` Postgres RPC — validates expiry, email match, creates membership atomically, writes activity log entry

**Roles & permissions**
- Five-level hierarchy: `owner` > `admin` > `member` > `viewer` + scoped `child`
- `lib/permissions.ts` exposes `can(role, action)` and `canRemove()` helpers
- Server-side enforcement via Postgres RLS policies in `db/schema.sql` — clients can't bypass
- UI gates buttons (e.g., the Invite button only appears for owners/admins)

**Realtime**
- `subscribeRealtime(householdId)` in store opens a Postgres CDC channel filtered to the active household
- Family members see each other's edits within ~1 second

**Activity log**
- Schema already had the `activity_log` table; v4.1 surfaces it on the household page (last 30 entries, action + entity + timestamp)

### Live Supabase project

| Detail | Value |
|---|---|
| Project ID | `dmxqkvploojokffuhxnz` |
| Region | `eu-west-2` (London) |
| URL | `https://dmxqkvploojokffuhxnz.supabase.co` |
| Plan | Free (0 USD/mo) |
| Tables | 14 (all RLS-enabled) |
| RPCs | 6 (`accept_invitation`, `transfer_ownership`, `leave_household`, `is_admin`, `admin_list_users`, `admin_dashboard_kpis`, `admin_weekly_trend`) |

---

## v4.1 (internal) — Adapter Refactor *(pre-2026-05)*

Foundation work to make v5 and the future cloud migration possible.

### New
- `DataAdapter` interface (`src/dataAdapter.js`) with three implementations:
  - `LocalStorageAdapter` (active today, anonymous mode)
  - `SupabaseAdapter` (ready, awaiting backend wiring)
  - `HybridAdapter` (cache + write queue + cloud — production model)
- All persistence calls in `app.js` route through `adapter.*` methods
- **Member removal** capability with linked-transaction orphaning + sidebar `×` button
- Cloud-sync info banner in Settings → Sync section, linking to `ARCHITECTURE.md`

### Improved
- Backward-compatible storage keys: anonymous-mode profile uses legacy v4 key names so existing data is preserved untouched
- `seedDemo` and `restoreBackup` use `adapter.replaceAll` for atomic bulk operations
- All CRUD functions are now `async` (23 async functions total)

### Documentation
- New `ARCHITECTURE.md` — comprehensive cloud/auth/multi-tenant design doc
- New `db/schema.sql` — deployable Postgres schema for Supabase, including RLS policies

---

## Earlier vanilla-shell history (v1.0 – v5.0)

Full detail kept at the root [`VERSIONS.md`](../VERSIONS.md). Summary:

- **v5.0** — Loans, Splits, Profiles & Privacy. Final vanilla-shell release. **Frozen** as of v6.0; superseded by the React port.
- **v4.0** — Paper Warm redesign + Debt + Net Worth + Currency + i18n.
- **v3.0** — *Never shipped* (UI deferred and rolled into v4.0).
- **v2.0** — Family Pulse Score, Goals, Members, Insights.
- **v1.0** — BudgetFlow MVP.

---

## Roadmap

### v6.4 — *next* (planned)
> Picks up the items that were deferred or "honestly not yet wired" in v6.3 / v6.3.1.

- **GA4 custom event taxonomy** — sign-up, transaction-added, household-created, pulse-score-improved, content-favorited. Currently only pageviews are tracked.
- **Goals "+ Progress" modal** — replace the `prompt()` call with the same modal pattern used by Add Transaction.
- **Transactions pagination** — current full-list render is fine to ~500 rows; needs windowing past that.
- **Bundle code-split** — Recharts is a 1 MB bundle warning; lazy-load chart pages.
- **Resend Edge Function** for invitation emails (the function is already deployed, needs wiring to a verified domain).

### v6.5 (planned)
- Cohort-event tracking pipeline so the admin Dashboard can light up D7/D90 retention, NPS, time-to-first-txn, etc. (currently rendered as `—` placeholders — see [`admin/CHANGELOG.md` v1.1.0](../admin/CHANGELOG.md#roadmap)).
- Stripe billing wired in the consumer Settings page (the admin Subscriptions page is already reading the empty `subscriptions` table).

### v7.0 — *future major*
- LLM Chat backend (Anthropic Claude Haiku via Supabase Edge Function) — replaces the v7.5 stub. Behind a "general guidance, not financial advice" disclaimer with full PII redaction at the boundary.
- LLM-augmented Planner — same v7.5 rule engine outputs become structured prompts; the LLM rewrites them in the user's voice.
- Multi-device push notifications via Web Push (already partially wired in v7.0).

> The major-feature track that ran as v7.0 / v7.5 in parallel with the v6.x integration track is being **collapsed** going forward. Every release from v6.4 onward is on a single increasing version line.

## v6.5.0 — AI agent sub-agent architecture, functional fixes *(2026-05-21)*

### AI agent extensibility
- Refactored AI agent to support sub-agent registration and intent-based routing ([react/src/lib/aiSummary.ts](react/src/lib/aiSummary.ts)).
- Added sub-agent interface and registry; stub sub-agents for recommendations and insights.
- All Chat queries now routed through sub-agents, enabling future extensibility for insights, recommendations, and more.

### Functional/UX fixes (planned for this release)
- Category selection now context-aware by transaction type (Expense, Income, Transfer).
- Payment method selection restricted to Cash and user-linked accounts/cards; overspend alerts and card/account limit enforcement added.
- Reports now break down spending by "needs" vs "wants" (category mapping).
- Fixed day-of-month input bug in recurring payments (single-digit deletion/editing).
- Recurring schedules are now fully editable.
- Split bill UX defaults to equal shares, manual input optional.

> This release lays the foundation for richer AI-driven features and closes several functional gaps in the transaction and recurring flows.
