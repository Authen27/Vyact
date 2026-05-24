# FinFlow — Technical Debt Register

> Source: independent engineering audit of `react/` (consumer v6.4.9), `admin/` (v1.0.4),
> `db/schema.sql`, and the frozen legacy vanilla shell (v5.0).
> Date: 2026-05-22.
>
> **Effort key:** XS ≤ ½ day · S ≈ 1–2 days · M ≈ 1 week · L ≈ 1–2 weeks.
> **Severity:** Critical / High / Medium / Low.

## Summary

| ID | Title | Area | Severity | Effort |
|----|-------|------|----------|--------|
| TD-01 | Floating-point money arithmetic | Technical / Correctness | Critical | L |
| TD-02 | Zero automated tests | Technical / Process | High | M |
| TD-03 | No optimistic concurrency (lost updates) | Technical / Correctness | High | M |
| TD-04 | Admin privilege schema not version-controlled | Security | High | S |
| TD-05 | No render error boundary | Functional / Resilience | High | XS |
| TD-06 | Client pulls entire tables; no pagination/delta sync | Scalability | High | M–L |
| TD-07 | AI Chat & Insights shipped as stubs | Functional / Product | High | M |
| TD-08 | Audit trail not populated for financial CRUD | Functional / Compliance | Medium | S |
| TD-09 | Non-atomic, N+1 bulk import (`replaceAll`) | Technical / Correctness | Medium | S |
| TD-10 | Sync queue drops ops silently; no retry cap/visibility | Technical / Reliability | Medium | S |
| TD-11 | No route-level code splitting; heavy bundle | Performance | Medium | S |
| TD-12 | Derived metrics recompute per render | Performance | Medium | S–M |
| TD-13 | Budget `period` is a per-device localStorage overlay | Functional / Data integrity | Medium | S |
| TD-14 | localStorage quota ceiling; failures swallowed | Scalability | Medium | S–M |
| TD-15 | No MFA / documented auth rate limiting | Security | Medium | XS |
| TD-16 | Backups/exports unencrypted at rest | Security / Privacy | Medium | S |
| TD-17 | No transaction list virtualization | Performance | Low | S |
| TD-18 | Hand-run SQL file instead of a migrations tool | Technical / Process | Medium | S |
| TD-19 | No end-to-end / browser test automation | Technical / Process / QA | High | M (phased) |

---

## TD-01 — Floating-point money arithmetic

**Description.** All monetary values are JavaScript `number` (IEEE-754 double). Currency conversion chains float division then multiplication (`(amount / rFrom) * rTo` in `format.convert`), aggregates accumulate over arrays (`reduce`), and EMI interest/principal is split on floats (`splitEmiPortions`, `computeEmi`). Rounding happens only at display time (`fmt`). The Postgres source of truth is `numeric(15,2)`, but the entire client compute path is binary floating point.

**Impact — tech / architecture.** Rounding drift accumulates across multi-currency aggregation, split shares, amortization, and pulse-score inputs (the `0.1 + 0.2 ≠ 0.3` class of error). The compute core (`calculations.ts`, `format.ts`) is the architectural hub every page depends on, so the defect is systemic, not local.

**Impact — functional.** Totals, balances, "you owe / owed to you", payoff schedules, and net-worth figures can disagree by cents and fail to reconcile against bank/source figures — the exact failure a finance app must never exhibit.

**Impact — business.** Erodes user trust (the product's core promise is accuracy); blocks any future move into regulated/business accounting (P&L, A/R, A/P on the roadmap) where penny-exactness is mandatory.

**Effort.** L (~1–2 weeks) — touches the calc core, both adapters, and all formatters.

**Possible solution approaches.**
- Represent money as **integer minor units (cents)** end-to-end; convert to display units only at the UI edge.
- Or adopt a decimal library (`dinero.js` / `big.js` / `decimal.js`) for all money ops.
- Apply explicit, consistent rounding (banker's / half-even) only at FX-conversion boundaries; keep `numeric(15,2)` server-side authoritative.
- Add property-based tests asserting conversion round-trips and sum invariants.

**Justification.** This is the single defining gap between a "budgeting toy" and fintech-grade software. Cost rises sharply once more features and persisted data depend on the imprecise representation; fixing it before the decimal model spreads further is cheapest now.

---

## TD-02 — Zero automated tests

**Description.** Neither app has a test runner (no vitest/jest/playwright/testing-library in `package.json`). The `lint` script is only `tsc --noEmit`. The compute layer is explicitly designed to be "easy to unit-test" (`calculations.ts` header) but has no tests.

**Impact — tech / architecture.** No regression safety net; every refactor (especially TD-01) is high-risk. CI builds but verifies nothing about behaviour.

**Impact — functional.** Money-math and sync-logic correctness rests entirely on manual checking; silent regressions can ship.

**Impact — business.** Slows safe iteration, raises defect-escape rate, and undermines diligence/credibility for investors or enterprise buyers.

**Effort.** M (~1 week to stand up + cover the core).

**Possible solution approaches.**
- Add **vitest**; first target the pure functions: `calculations.ts`, `format.convert`, `amortization.ts`, `splitsOutstanding`, `computePulseScore`.
- Add a few component/integration tests (testing-library) for the sync adapter's no-clobber rules.
- Gate CI on tests **before** the build step.

**Justification.** Highest ROI item: pure functions are trivial to test and are exactly where financial correctness lives. It is also the prerequisite that de-risks TD-01 and TD-03.

---

## TD-03 — No optimistic concurrency (lost updates)

**Description.** Cloud writes (`SupabaseAdapter.upsert`) do not check `updated_at`; behaviour is last-write-wins. Two members of a shared household editing the same record concurrently silently overwrite each other.

**Impact — tech / architecture.** The sync layer has no conflict detection or resolution (no version guard, vector clocks, or merge).

**Impact — functional.** Lost edits in the multi-user / multi-device scenario that is a headline feature ("multi-household, realtime").

**Impact — business.** Data-loss complaints directly contradict the shared-finance value proposition.

**Effort.** M.

**Possible solution approaches.**
- Add an `updated_at` precondition to writes (`.eq('updated_at', expected)`); on mismatch surface a conflict and re-fetch/merge.
- Or use a server-side RPC that performs compare-and-set.
- Longer term: per-field merge or CRDT for high-contention entities.

**Justification.** Concurrency is intrinsic to the multi-household design; without it the realtime/shared features are unsafe for real money.

---

## TD-04 — Admin privilege schema not version-controlled

**Description.** The admin app references `admin_roles` and the `admin_dashboard_kpis()` RPC, but neither exists in `db/schema.sql` — the only versioned schema in the repo. The privileged authorization layer lives in an unmanaged, hand-run migration.

**Impact — tech / architecture.** Schema drift: the deployed admin RLS/privilege model is not reproducible from source.

**Impact — functional.** An environment can be provisioned from `schema.sql` and silently lack correct admin authorization, or have stale/inconsistent admin RLS.

**Impact — business.** A privileged-access table with no source-of-truth is a material security and audit risk for a finance product.

**Effort.** S.

**Possible solution approaches.**
- Commit `admin_roles`, `admin_dashboard_kpis()`, and their RLS policies into versioned migrations.
- Add a CI check that the deployed schema matches the committed migrations.

**Justification.** Privileged authorization must be reviewable and reproducible; undocumented admin tables are the highest-leverage place for an accidental exposure.

---



### Remediation log

| Date       | Version  | Action                                                                                                 |
|------------|----------|--------------------------------------------------------------------------------------------------------|
| 2026-05-23 | v6.4.14  | Route-level code splitting: All pages in App.tsx use React.lazy + Suspense; Recharts lazy-loaded only on chart-heavy pages. |
| 2026-05-23 | v6.4.13  | Added top-level `<ErrorBoundary>` to React app root. All uncaught render errors now show a fallback UI. Sentry wiring placeholder included. |

## TD-05 — No render error boundary

**Description.** There is no top-level React error boundary. An uncaught render error white-screens the entire app.

**Impact — tech / architecture.** No fault isolation between pages/widgets.

**Impact — functional.** A single bad data shape or component bug makes the whole app unusable, with no reassurance about local data.

**Impact — business.** "My finance app went blank" is a trust-destroying experience.

**Effort.** XS (~½ day).

**Possible solution approaches.**
- Add a top-level `<ErrorBoundary>` with a recovery fallback ("something broke — your data is safe locally"), plus optional per-route boundaries.
- Wire to error logging (Sentry or equivalent).

**Justification.** Tiny effort, removes a catastrophic-feeling failure mode.

---

## TD-06 — Client pulls entire tables; no pagination or delta sync

**Description.** `SupabaseAdapter.list()` does `select('*').eq('household_id', …)` with no limit/pagination, caches the whole dataset in localStorage, and aggregates entirely client-side. The schema provides `txns_updated_idx` for incremental sync, but the adapter re-fetches all non-deleted rows every call rather than `where updated_at > cursor`.

**Impact — tech / architecture.** Compute and memory scale linearly with full history on the client; no incremental sync path despite the index existing.

**Impact — functional.** Slow loads and degraded UX for power users, long histories, and business accounts; cloud-blocking reads when the cache can't hold the data.

**Impact — business.** Caps the addressable segment (power/business users) and the per-household data ceiling.

**Effort.** M–L.

**Possible solution approaches.**
- Add pagination + a delta-sync cursor (`updated_at > lastSync`, including soft-deletes) using the existing index.
- Push heavy aggregations (monthly rollups, pulse inputs) into Postgres views/RPCs; fetch detail on demand.

**Justification.** Architecturally fine for a small family today; the rework gets much harder once more pages assume "all data is already in memory."

---

## TD-07 — AI Chat & Insights shipped as stubs

**Description.** `StubChatBackend` is a regex pattern-matcher; `SupabaseChatBackend.ask()` throws ("not yet wired"). The privacy-safe summary contract (`SafeSummary`, no PII) is built but never sent anywhere.

**Impact — tech / architecture.** Dead seams (sub-agent registry, backend interface) carry maintenance cost with no payoff yet.

**Impact — functional.** A surfaced "AI" feature returns canned responses.

**Impact — business.** Over-promising an unbuilt capability risks user/investor trust if discovered.

**Effort.** M (wire backend) / XS (relabel as Beta).

**Possible solution approaches.**
- Implement the Supabase Edge Function → Claude Haiku using the existing `SafeSummary` contract (PII-safe by design).
- Or clearly label as "Beta / coming soon" until wired.

**Justification.** The clean PII boundary is already done; finishing it is low-risk, but until then honest labelling protects trust.

---

## TD-08 — Audit trail not populated for financial CRUD

**Description.** `activity_log` is written only by three RPCs (`accept_invitation`, `transfer_ownership`, `leave_household`). Transaction/budget/goal/debt/asset mutations write nothing, so the "audit trail for shared households" does not record financial edits.

**Impact — tech / architecture.** Auditing relies on client cooperation rather than server enforcement.

**Impact — functional.** No "who changed this number and when" for shared households — a core trust feature for multi-user finance.

**Impact — business.** Weakens the shared-finance/compliance story; blocks future business/accounting use.

**Effort.** S.

**Possible solution approaches.**
- Write `activity_log` rows via **Postgres triggers** on the domain tables (server-side, non-bypassable), capturing actor, action, and a `changes` diff.

**Justification.** Server-side triggers make the trail tamper-resistant and complete with modest effort.

---

## TD-09 — Non-atomic, N+1 bulk import (`replaceAll`)

**Description.** `replaceAll` soft-deletes all rows then upserts records one-by-one in a `for…await` loop. No surrounding transaction; a mid-loop failure leaves the household partially imported.

**Impact — tech / architecture.** No atomicity; many round-trips.

**Impact — functional.** Restore/import can corrupt a household's data on partial failure.

**Impact — business.** Data-loss/corruption on restore is severe for a finance app.

**Effort.** S.

**Possible solution approaches.**
- Wrap the operation in a single Postgres RPC/transaction (delete + bulk insert) so it is all-or-nothing.
- Use a batched insert instead of per-row upserts.

**Justification.** Restore is precisely when users are already in a fragile state; partial failure must not be possible.

---

## TD-10 — Sync queue drops ops silently; no retry cap or visibility

**Description.** `HybridAdapter.flushQueue` drops ops carrying non-UUID ids (logged to console only), and failed ops are retained without a cap, backoff, or user-visible status. `pendingOpCount()` exists but isn't surfaced.

**Impact — tech / architecture.** No dead-letter handling or backoff; a poisoned op can spin.

**Impact — functional.** Users get no signal that data failed to reach the cloud.

**Impact — business.** "I entered it but it vanished" undermines reliability perception.

**Effort.** S.

**Possible solution approaches.**
- Surface unsynced-op count and a "sync issue" indicator using existing `pendingOpCount()`.
- Add capped retries with exponential backoff and a dead-letter view for unsyncable ops.

**Justification.** The plumbing exists; exposing state and bounding retries closes a silent data-loss gap cheaply.

---

## TD-11 — No route-level code splitting; heavy initial bundle

**Description.** All ~17 pages plus Recharts are eagerly imported in the app shell; no `React.lazy`/`Suspense`.

**Impact — tech / architecture.** Single large bundle; Recharts ships even to users who never open a chart.

**Impact — functional.** Slower first paint, especially on mobile/low-bandwidth.

**Impact — business.** Worse activation/retention on the mobile-first family audience.

**Effort.** S.

**Possible solution approaches.**
- `React.lazy` per route + `Suspense`; lazy-load Recharts only on chart pages.

**Justification.** Standard, low-risk win that materially improves load time.

---

## TD-12 — Derived metrics recompute per render

**Description.** Pages subscribe to multiple store slices and recompute pulse score/aggregations on render; `useMemo` coverage is uneven (e.g. Dashboard recomputes across the full transaction array).

**Impact — tech / architecture.** Redundant O(n) recomputation over financial collections.

**Impact — functional.** Jank as data volume grows.

**Impact — business.** Degraded perceived performance for engaged (data-heavy) users.

**Effort.** S–M.

**Possible solution approaches.**
- Compute aggregations once per data change in memoized Zustand selectors; consume the memoized result in pages.

**Justification.** Centralizing derived state both speeds rendering and reduces correctness surface (one place to get the math right).

---

## TD-13 — Budget `period` is a per-device localStorage overlay

**Description.** Multi-period budgets store `period` in a namespaced localStorage map (`budgetMeta.ts`) and merge it client-side, because the production DB lacks the column. Two devices show different periods for the same household.

**Impact — tech / architecture.** Schema/feature mismatch papered over on the client.

**Impact — functional.** Inconsistent budget views across devices for the same data.

**Impact — business.** Confusing behaviour in the shared/multi-device scenario.

**Effort.** S.

**Possible solution approaches.**
- Add a real `period` (and custom range) column via migration; backfill from `budgetMeta`; remove the overlay.

**Justification.** Documented stop-gap; promoting it to the schema removes a per-device inconsistency cleanly.

---

## TD-14 — localStorage quota ceiling; failures swallowed

**Description.** The full dataset is cached in localStorage (~5–10 MB cap). `markSynced`/cache writes catch and ignore quota errors, so large households silently fail to cache and degrade to slower cloud-blocking reads.

**Impact — tech / architecture.** Storage layer has a hard ceiling and no failure signalling.

**Impact — functional.** Silent performance degradation for large datasets.

**Impact — business.** Caps usable data volume; opaque slowdowns.

**Effort.** S–M.

**Possible solution approaches.**
- Move the cache to **IndexedDB** (e.g. `idb-keyval`) to lift the ceiling.
- Surface quota/cache failures instead of swallowing them.

**Justification.** Pairs naturally with TD-06; required for the product to scale past a small family.

---

## TD-15 — No MFA / documented auth rate limiting

**Description.** No multi-factor auth and no documented rate limiting / leaked-password protection / CAPTCHA for account security.

**Impact — tech / architecture.** Relies on defaults; account-takeover surface larger than appropriate for finance.

**Impact — functional.** Weaker protection for accounts holding full financial profiles.

**Impact — business.** Below the security bar expected of a finance product; a barrier to enterprise/serious users.

**Effort.** XS (largely Supabase configuration).

**Possible solution approaches.**
- Enable Supabase MFA, leaked-password protection, and auth rate limits; expose MFA enrolment in Settings.

**Justification.** Mostly configuration; large security gain for minimal effort.

---

## TD-16 — Backups/exports unencrypted at rest

**Description.** JSON/CSV/clipboard exports contain the full financial picture and PII with no encryption (acknowledged limitation).

**Impact — tech / architecture.** Sensitive data leaves the app in plaintext.

**Impact — functional.** Exported files are a standing data-leak vector.

**Impact — business.** Privacy/compliance exposure (e.g. GDPR-style obligations).

**Effort.** S.

**Possible solution approaches.**
- Offer passphrase-based encryption (WebCrypto AES-GCM) for JSON backups; at minimum warn users about plaintext sensitivity.

**Justification.** Backups are the most portable copy of the most sensitive data; encryption is a reasonable expectation.

---

## TD-17 — No transaction list virtualization

**Description.** The Transactions page renders the full array with no windowing.

**Impact — tech / architecture.** DOM node count scales with history.

**Impact — functional.** Sluggish scrolling/interaction past ~1k rows.

**Impact — business.** Minor; affects only heavy users.

**Effort.** S.

**Possible solution approaches.**
- Virtualize with `@tanstack/react-virtual` (or similar).

**Justification.** Low priority until datasets grow, but cheap and isolated when needed.

---

## TD-18 — Hand-run SQL file instead of a migrations tool

**Description.** Schema is a single hand-run `db/schema.sql` executed in the Supabase SQL editor; no migration tooling or version history of schema changes (related to TD-04).

**Impact — tech / architecture.** Schema evolution is not reproducible or reviewable; drift between environments is likely.

**Impact — functional.** Hard to guarantee any environment matches the code's expectations.

**Impact — business.** Operational risk and slower, riskier schema changes.

**Effort.** S.

**Possible solution approaches.**
- Adopt the Supabase CLI migrations (or sqitch/Flyway); commit incremental, ordered migrations; run them in CI/CD.

**Justification.** Reproducible schema is foundational for safe iteration and is a prerequisite for cleanly resolving TD-04 and TD-13.

---

## TD-19 — No end-to-end / browser test automation

**Description.** Unit coverage now exists (vitest, 39 tests on the pure compute layer — see TD-02), but there are **no end-to-end tests** exercising the actual app in a browser: navigation, the CRUD modals, multi-currency in the UI, backup/restore, the persistence guarantees the v6.4 cache-no-clobber work introduced, the auth/multi-household/RLS cloud flows, and responsive/mobile rendering. Critical user journeys are verified only by hand.

**Impact — tech / architecture.** No automated guard on the integration seams (store ↔ adapter ↔ localStorage/Supabase, routing, modal mounting at App root). The exact regression that motivated the v6.4 sentinel ("data lost on refresh / sign-out → sign-in") has no automated test pinning it. A render error has no test ensuring it surfaces gracefully (couples to TD-05).

**Impact — functional.** Cross-cutting journeys (add transaction → dashboard/pulse updates, record debt payment → amortization, split a bill, restore a backup) can break without any signal. RLS isolation between households is asserted nowhere.

**Impact — business.** Manual QA does not scale with release cadence across three deployables; raises defect-escape rate and slows confident shipping — the opposite of the team's stated belief in test automation.

**Effort.** M, phased (Foundation S → core journeys M → cloud lane M → hardening ongoing).

**Possible solution approaches.**
- **Playwright** with two execution lanes: **Lane A (local-only mode)** — deterministic, no backend, seeded via `localStorage` injection at boot using the existing `seed.ts` factories; runs on every PR. **Lane B (cloud mode)** — auth, multi-household, invitations, sync, and **negative RLS-isolation** tests against a disposable Supabase test project; runs nightly / pre-release.
- Page Object Model under `react/e2e/`; determinism harness (frozen clock — the app leans on `today()`/`nowMonthKey()` everywhere — pinned `crypto.randomUUID`, fixed viewport, disabled animations); network stubbing for FX/AI.
- CI: dedicated `e2e` job, sharded, traces/screenshots/video on failure; Chromium on PR, WebKit/Firefox + mobile viewports nightly. Optional Playwright visual snapshots for the design system (nightly, flake-gated).
- Scope discipline: ~15–20 high-value journeys, not a re-test of the math already covered by vitest.

**Justification.** The team explicitly values test automation; E2E is the missing layer of the pyramid above the new unit tests. The localStorage-only anonymous mode makes most journeys testable with zero backend and zero flake, so the cost/benefit is unusually favourable. Lane B is the only place RLS — the app's core security boundary (see TD-04/S1) — can be asserted end to end.

---

## Remediation log

Chronological record of remediation PRs against this register. Each row pins to the merge commit's automation run report (governance: [`docs/TEST_GOVERNANCE.md`](docs/TEST_GOVERNANCE.md)).

| Date | PR | Scope | Items addressed |
|---|---|---|---|
| 2026-05-23 | #1 | **ESLint floor** in `react/` and `admin/`. `npm run lint` now runs `eslint .` (flat config, `react-hooks` plugin, typescript-eslint recommended); `tsc --noEmit` preserved as `npm run typecheck`. Gate updated to run both. | Closes **Finding N2** of the 2026-05-22 assessment (no real linter anywhere). Surfaces pre-existing `exhaustive-deps` / `no-unused-vars` / `no-explicit-any` violations as warnings — these are the future-PR debt that the gate will ratchet to errors as TD-05/TD-12 and related items land. Real bug found and fixed: short-circuit-as-statement in [`Households.tsx:304`](react/src/pages/Households.tsx:304). |
| 2026-05-23 | #2 | **Test Scenarios master catalog + per-scenario audit evidence.** New [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md) is the regression-managed master copy of every automated test scenario (56 today). New [`scripts/test-scenarios-check.mjs`](scripts/test-scenarios-check.mjs) CI gate refuses code↔doc drift. Admin Vitest scaffold added with 11 ID-tagged unit tests (`ADM-UNIT-001..011`) covering `slugify` + `rowToArticle`. All 43 existing consumer tests retitled with their TS IDs. `scripts/automation-run.mjs` rewritten so every run's `report.md` and `summary.json` carry per-app pass/fail counts, full failure details (message + stack), and a complete pass register for audit. | Closes **Finding N1** of the 2026-05-22 assessment (admin had zero tests). Establishes regression discipline for the whole test pyramid. Real edge-case bug surfaced (not fixed in this PR): `slugify('!!! ??? @@@')` returns `'-'` instead of `''`. |
| 2026-05-23 | #3 | **Transactions list virtualization** (handed off to a developer per the handoff protocol). Wraps the Transactions list in `@tanstack/react-virtual`; `data-testid="txn-row"` added on `TxnRow`. No visible UI change. DOM node count is O(viewport) even at 10 000+ rows. | Closes **TD-17**. **Review note:** the submitted patch placed `useRef` / `useVirtualizer` inside JSX (Rules-of-Hooks violation + TS compile error); hoisted to the function body before merge. |
| 2026-05-23 | #4 | **Top-level error boundary.** New `<ErrorBoundary>` class component in [`react/src/components/ui/ErrorBoundary.tsx`](react/src/components/ui/ErrorBoundary.tsx) mounted in `main.tsx` outside `<BrowserRouter>`. Friendly fallback + reset button; data preserved. New `CON-E2E-005` spec exercises the fallback via a `/__e2e_error` route that throws on render. | Closes **TD-05**. |
| 2026-05-23 | #5 | **Route-level code splitting.** Every page in `App.tsx` is `React.lazy`-imported and wrapped in `<Suspense>`. Because Recharts is imported only from `Charts.tsx` (used by Dashboard / Reports / NetWorth), it now ships only in those three route chunks. New `CON-E2E-006` spec asserts Recharts is not requested on `/transactions` and is on `/dashboard`. | Closes **TD-11**. **Review note:** the submitted patch also wrapped every Recharts primitive (`<Area>`, `<Bar>`, `<XAxis>`…) in its own `React.lazy` inside `Charts.tsx`. Recharts requires synchronous parent-child registration; that approach broke chart rendering and produced N+1 redundant dynamic imports of the same module. Reverted to the original `Charts.tsx` before merge; the route-level split alone delivers the TD-11 benefit cleanly. **Process note:** TD-11 was explicitly flagged as a hold-back item in the handoff prompt; the dev took it anyway. Accepted because the result is correct after correction, but the scope-discipline lesson is filed. |
| 2026-05-23 | #6 | **DB migrations toolchain (TD-18).** New `supabase/migrations/` directory; current schema lifted verbatim into `00000000000000_initial_schema.sql`. New [`db/MIGRATIONS.md`](db/MIGRATIONS.md) workflow doc. New [`scripts/db-migrations-check.mjs`](scripts/db-migrations-check.mjs) CI gate validates naming/ordering and refuses drift between the migrations and the now-**generated** `db/schema.sql` snapshot (with `--fix` to regenerate). Wired into `automation-run.mjs` as the `db-migrations` gate. `README.md` cloud-sync section updated. No app SemVer bump — neither consumer nor admin behavior changes. | Closes **TD-18** (hand-run SQL → versioned migrations) and is the prerequisite for **TD-04** (admin schema → migrations) which PR #7 will land. The generated-snapshot pattern keeps existing references to `db/schema.sql` working while making migration files authoritative. |
| 2026-05-23 | #7 | **Admin privilege surface into versioned migrations (TD-04).** New migration `supabase/migrations/20260523060000_admin_roles_and_dashboard_kpis.sql` adds the `admin_role` enum (`super`/`roles`/`content`), the `admin_roles` table with RLS, helper functions `is_admin()` and `has_admin_role()` (both `security definer` to avoid RLS recursion, mirroring the existing `is_member()`/`role_in()` pattern), and the `admin_dashboard_kpis()` RPC that returns the `DashboardKpis` shape `admin/src/lib/adminApi.ts` already expects. RPC has a built-in admin guard (raises `42501` on non-admin callers) on top of RLS. Generated `db/schema.sql` snapshot now ~35.5 KB across 2 migrations. No app SemVer bump. | Closes **TD-04** (admin authorisation layer no longer lives in an unmanaged hand-run migration). **Honest scope:** the RPC reports `0` for `publishedArticles`/`contentFavorites`/`paidSubscriptions`/`mrr` because their backing tables (`content_items`, `subscriptions`) are still unversioned today; each is commented inline with the follow-up TD-04-extension migration that will plug in real numbers via `CREATE OR REPLACE FUNCTION`. The other unversioned admin RPCs (`admin_weekly_trend`, `admin_ai_usage_summary`, `admin_list_users`) are filed as the same follow-up cluster. |

## Suggested remediation order

1. **TD-02** (tests) — safety net and prerequisite for the rest.
2. **TD-01** (decimal money) — the defining correctness fix.
3. **TD-05, TD-04** (error boundary, admin schema into migrations) — small effort, removes a white-screen and a schema-drift/security landmine.
4. **TD-03, TD-08** (concurrency, audit triggers) — correctness & auditability for the multi-household promise.
5. **TD-06, TD-14, TD-11** (delta sync/pagination, IndexedDB, code splitting) — scale and load performance.
6. **TD-15, TD-16, TD-07** (MFA, encrypted backups, AI backend) — productization & trust.
7. **TD-09, TD-10, TD-12, TD-13, TD-17, TD-18** — reliability and polish, scheduled alongside related work.
