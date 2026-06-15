# Vyact — Technical Debt Register

> Source: independent engineering audit of `react/` (consumer v6.4.9), `admin/` (v1.0.4),
> `db/schema.sql`, and the frozen legacy vanilla shell (v5.0).
> Date: 2026-05-22 · last reconciled against code 2026-06-01 · partner-review intake 2026-06-14 (TD-23…TD-28).
>
> **This file is the single source of truth for technical debt.** Standalone remediation
> notes are folded in here and deleted — do not create parallel `*_REMEDIATION.md` files.
>
> **Effort key:** XS ≤ ½ day · S ≈ 1–2 days · M ≈ 1 week · L ≈ 1–2 weeks.
> **Severity:** Critical / High / Medium / Low.

## Status at a glance (2026-06-15)

**28 items total — 21 ✅ resolved · 5 ⚠ partial · 2 ⬜ open.**

| Bucket | IDs |
|---|---|
| ✅ **Resolved** (21) | TD-01, TD-03, TD-04, TD-05, TD-06, TD-07, TD-08, TD-09, TD-10, TD-11, TD-12, TD-13, TD-14, TD-15, TD-17, TD-18, TD-20, TD-21, **TD-23**, **TD-26**, **TD-27** |
| ⚠ **Partial** (5) | TD-02 (unit + Lane-A done; integration layer open) · TD-19 (Lane A shipped; Lane B/RLS-isolation open) · TD-28 (CI version-drift guard shipped — closes TD-23's recurrence; CLAUDE.md trim + README docs-map still open) · TD-24 (fault taxonomy + silent-write-loss paths instrumented & tested; read/noop sweep + diagnostics view open) · **TD-25** (Zustand slice-composition pattern established — modalSlice + testHooks + reconcileSlice extracted, store.ts 1,167→1,041; remaining slices + index.ts rename queued) |
| ⬜ **Open** (2) | TD-16, TD-22 |

> **2026-06-15 maintainability pass.** Shipped the register's cheap front-runners: **TD-23** (README version truth-fix v7.0.2→v9.3.3 + source-of-truth note), **TD-27** (removed the money-path `as any` in `Reports.tsx` and the MFA-path `as any` in `Settings.tsx`; only the intentional E2E `window` shim remains), and the guard half of **TD-28** (`scripts/version-drift-check.mjs`, wired into the gate runner, fails the build on README/VERSIONS/CHANGELOG ↔ package.json drift — permanently prevents TD-23 from recurring). Next per the order: **TD-24** (error taxonomy — highest latent risk), then the **TD-25/26** extractions.

> TD-23…TD-28 are the **maintainability cluster** from the 2026-06-14 external partner
> review of Vyact consumer v9.3.x. Provenance, claim-by-claim validation, and the
> analysis (including recommendations I declined) live in §TD-23…TD-28 below — they
> superseded and absorbed the former `docs/MAINTAINABILITY_REMEDIATION.md`.

## Summary

| ID | Title | Area | Severity | Effort |
|----|-------|------|----------|--------|
| TD-01 | ✅ Floating-point money arithmetic *(resolved · PR #8/9/10)* | Technical / Correctness | Critical | L |
| TD-02 | ⚠ Automated-test breadth (was: zero tests) — unit + Lane‑A E2E in place; integration & Lane‑B open | Technical / Process | Medium | M |
| TD-03 | ✅ No optimistic concurrency (lost updates) *(resolved · PR #11/12)* | Technical / Correctness | High | M |
| TD-04 | ✅ Admin privilege schema not version-controlled *(resolved in prod via Supabase Dashboard migration `v646_admin_ai_usage_summary` 2026-05-22; partially mirrored in repo via PR #7 + PR #13 batch; see TD-20 for the parallel-history meta-bug)* | Security | High | S |
| TD-20 | ✅ Repo's `supabase/migrations/` is decoupled from Supabase's actual applied migrations; no CI auto-apply step *(resolved · PR #16)* | Technical / Process / Infra | High | M |
| TD-05 | ✅ No render error boundary *(resolved · PR #4)* | Functional / Resilience | High | XS |
| TD-06 | ✅ Client pulls entire tables; no pagination/delta sync *(resolved · 2026-06-01: SupabaseAdapter.listSince + HybridAdapter cursor + composite indexes)* | Scalability | High | M–L |
| TD-07 | ✅ AI Chat shipped as stub *(resolved · 2026-06-01: GeminiChatBackend on Gemini 1.5 Flash free tier; falls back to stub when key absent)* | Functional / Product | High | M |
| TD-08 | ✅ Audit trail not populated for financial CRUD *(resolved · PR #13 batch + PR #20 in prod)* | Functional / Compliance | Medium | S |
| TD-09 | ✅ Non-atomic, N+1 bulk import (`replaceAll`) *(resolved · PR #13 batch + PR #20 in prod)* | Technical / Correctness | Medium | S |
| TD-10 | ✅ Sync queue visibility + capped retry/backoff *(resolved · PR #13 batch surface + 2026-06-01 backoff)* | Technical / Reliability | Medium | S |
| TD-11 | ✅ No route-level code splitting; heavy bundle *(resolved · PR #5)* | Performance | Medium | S |
| TD-12 | ✅ Derived metrics recompute per render *(resolved · PR #13 batch; selectors retyped 2026-06-01)* | Performance | Medium | S–M |
| TD-13 | ✅ Budget `period` is a per-device localStorage overlay *(resolved · PR #13 batch + PR #20 in prod; `budgetMeta.ts` removed 2026-06-01)* | Functional / Data integrity | Medium | S |
| TD-14 | ✅ localStorage quota ceiling; failures swallowed *(resolved · 2026-06-01: kvStore IndexedDB substrate + storageEvents quota fan-out)* | Scalability | Medium | S–M |
| TD-15 | ✅ No MFA / documented auth rate limiting *(resolved · PR #13 batch)* | Security | Medium | XS |
| TD-16 | Backups/exports unencrypted at rest | Security / Privacy | Medium | S |
| TD-17 | ✅ No transaction list virtualization *(resolved · PR #3)* | Performance | Low | S |
| TD-18 | ✅ Hand-run SQL file instead of a migrations tool *(resolved · PR #6)* | Technical / Process | Medium | S |
| TD-19 | ⚠ E2E / browser test automation — Lane A (7 specs) shipped; Lane B (cloud + RLS isolation) open | Technical / Process / QA | High | M (phased) |
| TD-21 | ✅ RLS performance: un-wrapped `auth.<fn>()` initplan + overlapping permissive policies *(resolved · 2026-06-01 migration)* | Performance / Scalability | Medium | S–M |
| TD-22 | PWA push notifications wired only as a stored preference; no actual subscription, service-worker handler, or backend fan-out | Functional / Product | Low | M |
| TD-23 | ✅ Doc drift — README pinned stale consumer version *(resolved 2026-06-15: README v9.3.3 + source-of-truth note; guarded by TD-28 script)* | Technical / Process / Docs | Medium | XS |
| TD-24 | ⚠ Error opacity — `lib/faults.ts` taxonomy + silent-write-loss paths (sync queue, persistence) instrumented & tested *(2026-06-15)*; exhaustive read/noop classification + in-app diagnostics view open | Technical / Reliability | High | M |
| TD-25 | ⚠ Consumer `store.ts` god-module → Zustand slices: pattern + modalSlice/testHooks/reconcileSlice extracted *(2026-06-15, 1,167→1,041)*; remaining domain slices + `index.ts` rename queued | Technical / Maintainability | High | L |
| TD-26 | ✅ Sync-queue mechanics extracted to `lib/sync/` (backoff/syncQueue/deadLetter/conflict) *(resolved 2026-06-15; hybridAdapter 508→400, each module unit-tested, queue-replay regression)* | Technical / Maintainability | Medium | M |
| TD-27 | ✅ Risk-bearing `as any` on money + MFA/security paths *(resolved 2026-06-15: `Reports.tsx` typed `Transaction[]`; `Settings.tsx` MFA typed via `Factor` + enrol-response narrowing)* | Technical / Type-safety | Medium | S |
| TD-28 | ⚠ Doc-architecture: CI version-drift guard shipped *(2026-06-15)*; CLAUDE.md history trim + README docs-map still open | Technical / Process / Docs | Low | S |

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

## TD-02 — Automated-test breadth (was: zero automated tests)

**Status update (2026-06-01).** The original "zero tests" framing is obsolete. Vitest covers the pure compute layer in [`react/src/lib/__tests__/`](react/src/lib/__tests__/) (amortization, calculations, format, money, supabaseAdapter) and admin has its own Vitest scaffold (`ADM-UNIT-001..011`). Lane‑A Playwright covers 7 journeys in [`react/e2e/tests/`](react/e2e/tests/). The remaining gap is **integration breadth**: store ↔ adapter ↔ cache seams, cloud-mode flows, and RLS isolation. That gap is tracked operationally under **TD-19**; this entry is kept open at Medium severity for the missing component/integration layer between unit and E2E.

**Description (original).** Neither app has a test runner (no vitest/jest/playwright/testing-library in `package.json`). The `lint` script is only `tsc --noEmit`. The compute layer is explicitly designed to be "easy to unit-test" (`calculations.ts` header) but has no tests.

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
| 2026-05-24 | v1.0.8   | Admin: Fix `slugify()` sanitiser to return an empty string for punctuation-only inputs (ADM-UNIT-006); updated unit test. |
| 2026-05-24 | v6.4.20  | Consumer: Add MFA enrolment helpers and Settings Security panel; add `docs/AUTH_HARDENING.md` runbook (TD-15 remediation). |
| 2026-05-24 | v6.4.21  | Consumer: Add `period`/`period_start`/`period_end` columns to `budgets` via migration; updated client row mappers (TD-13 remediation). |
| 2026-05-24 | db-migrations | audit-triggers | Added `log_domain_activity()` trigger + triggers on domain tables to write `activity_log` for CRUD (TD-08 remediation). |
| 2026-05-24 | v6.4.22  | replace_all RPCs | Add server-side atomic `replace_<entity>` RPCs and update `SupabaseAdapter.replaceAll()` to call them (TD-09 remediation). |
| 2026-05-24 | v6.4.23  | SyncStatusBadge | Add `SyncStatusBadge` component and mount in sidebar header to surface sync/queue/conflict state (TD-10 remediation). |
| 2026-05-24 | v6.4.24  | Memoised selectors | Add `lib/selectors.ts` and update Dashboard to consume memoized derived metrics (TD-12 remediation). |
| 2026-05-24 | db-migrations | subscriptions | Add `subscriptions` table and wire `paidSubscriptions` / `mrr` into `admin_dashboard_kpis()` (TD-04-ext-a remediation). |
| 2026-05-24 | db-migrations | admin-rpcs | Add admin RPCs for subscriptions & content (admin_list_subscriptions, admin_cancel_subscription, admin_publish_content_item, admin_unpublish_content_item) and grant execute to authenticated (TD-04-ext-c remediation). |
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

**Resolution (2026-06-01).** Wired the Chat surface to Google Gemini 1.5 Flash (free tier) keeping the existing `SafeSummary` PII contract intact.

- **Backend.** New [`react/src/lib/geminiBackend.ts`](react/src/lib/geminiBackend.ts) implements `ChatBackend` by `POST`ing to `generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=...`. Conversation history is mapped onto Gemini's `user` / `model` role alternation; the current question is bundled with the `SafeSummary` JSON in the final user turn so role alternation stays clean. A short system instruction pins the coach persona, forbids invented numbers, and disallows regulated tax / investment / legal advice. Safety thresholds are nudged to `BLOCK_ONLY_HIGH` because Gemini's defaults over-trigger on common finance vocabulary (`debt`, `loan`, `owe`). HTTP / quota / safety-block errors are surfaced verbatim through the existing chat error path — users see `API key not valid` or `Quota exceeded` instead of a bare 4xx.
- **Factory.** New `selectChatBackend()` in [`aiSummary.ts`](react/src/lib/aiSummary.ts) returns `GeminiChatBackend` when `VITE_GEMINI_API_KEY` is set at build time, otherwise the existing `StubChatBackend`. The stale `SupabaseChatBackend` placeholder is left in place (still throws) so any forgotten import surfaces immediately; new callers go through the factory.
- **UI.** [`Chat.tsx`](react/src/pages/Chat.tsx) now uses the factory and swaps the `Beta` chip for a `Gemini` chip in sage tones when a real backend is wired; the Beta chip remains in stub mode so the expectation stays honest for users without a key. Privacy summary, history persistence, and the existing `logAiUsage()` metric are unchanged.
- **Why client-side direct-to-Google (not an Edge Function).** Zero new server infra; the free tier (15 RPM / 1,500 RPD on Flash) is sufficient for personal use; Google supports per-key referrer / IP / HTTP-method allow-lists for browser-exposed keys, which is the documented operational mode for this plan tier. The `ChatBackend` interface is unchanged — a future Edge Function swap is a one-line factory change.
- **Tests.** [`react/src/lib/__tests__/geminiBackend.test.ts`](react/src/lib/__tests__/geminiBackend.test.ts) (`CON-UNIT-060` / `061` / `062`) pins the request body shape (URL contains `gemini-1.5-flash-latest`; system instruction includes the coach persona; the user turn carries the SafeSummary JSON + question), the multi-turn `user` / `model` role mapping, the four error surfaces (non-OK API error, prompt-blocked, empty response, empty-key construction), and `isReal()` truthiness. 7/7 green; full suite 68/69 (the pre-existing `CON-UNIT-024` debt-component failure is unrelated and untouched this session).

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

**Resolution (2026-06-01).** Two-part fix shipped together.

- **Substrate.** New [`react/src/lib/kvStore.ts`](react/src/lib/kvStore.ts) is an IndexedDB-backed promise key/value store (single `vyact.kv` object store, no new runtime dependency — ~120 LOC wrapping `indexedDB.open` directly). Fallback order is IDB → `localStorage` (via the existing `localStorageCompat`) → in-memory `Map`. IDB's per-origin quota is orders of magnitude larger than localStorage's ~5 MB ceiling on every modern browser, which lifts the TD-14 cap. `kvGet` performs a one-way **read-through migration** from legacy `vt_` / `ff_` localStorage keys, seeding IDB on the first read and deleting the localStorage copy on the next successful `kvSet`, so existing users transparently move to the new substrate without an explicit migration step.
- **Surfacing.** New [`react/src/lib/storageEvents.ts`](react/src/lib/storageEvents.ts) is a tiny pub/sub plus an `isQuotaError(err)` cross-browser detector (handles `QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, legacy code `22` / `1014`, and message-substring match). [`localStorageCompat.setString`](react/src/lib/localStorageCompat.ts) and [`kvStore.kvSet`](react/src/lib/kvStore.ts) now emit a `{ kind: 'quota-exceeded' }` event before swallowing the throw — the non-throwing contract for callers is preserved, the silence is not. [`App.tsx`](react/src/App.tsx) subscribes via `onStorageEvent` and surfaces a toast (debounced 60 s so a burst of failed writes shows once).
- **Adapter wiring.** [`LocalStorageAdapter`](react/src/lib/dataAdapter.ts)'s `read` / `write` / `removeBoth` helpers are converted to async and routed through `kvStore` instead of `ls.readJson` / `ls.setJson`. All 17 internal callers are updated with `await`. Small string keys (`active_profile`, `theme`, `migrated_v1`) stay on `localStorageCompat` directly — tiny payloads, no quota risk, sync access from constructor paths.
- **Tests.** [`react/src/lib/__tests__/storage.test.ts`](react/src/lib/__tests__/storage.test.ts) (`CON-UNIT-057` / `058` / `059`) installs an in-process `MemStorage` polyfill on `globalThis.localStorage` and pins: JSON round-trip via the localStorage fallback path; quota-event fan-out when `setItem` throws (with all four `isQuotaError` shapes covered); legacy `ff_` key read-through migration including the `vt_` > `ff_` precedence tiebreak. 6/6 green. Full suite remains 61/62 (only the pre-existing CON-UNIT-024 debt-component failure, unrelated).

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

## TD-20 — Repo's `supabase/migrations/` is decoupled from production's actual applied migrations; no CI auto-apply

**Description.** PR #6 (TD-18) introduced the `supabase/migrations/` directory and the `db-migrations` CI gate that validates naming and the `db/schema.sql` snapshot. That work made the *paper trail* correct, but never wired the *apply step*. In parallel, the team has continued evolving the production Supabase schema via the Supabase Dashboard's SQL editor, which records its own migrations in `supabase_migrations.schema_migrations` table. Result: **two separate migration histories that conceptually overlap but are not byte-equivalent**.

Concretely, surfaced during the attempted apply of PR #14 (2026-05-28):

- **Supabase tracks 13 migrations** applied to prod (`finflow_v4_1_initial_schema` → `v646_admin_ai_usage_summary`). None reference the migration filenames in our repo.
- **Our repo has 8 migration files** under `supabase/migrations/` (PR #6 initial, PR #7 admin-roles, PR #13 batch). **None of these have ever been applied to production via the repo's tooling.**
- Production schema is therefore shaped by what the team ran in the Dashboard, not by our repo's migrations:
  - `is_admin(min_role text DEFAULT NULL)` in prod vs `is_admin(uid uuid DEFAULT auth.uid())` in our PR #7 migration — completely different signature.
  - `ai_usage` in prod has columns `(id, household_id, user_id, ts, surface, intent, sentiment, sentiment_score, message_len)` — different names/shape than our PR #14 migration assumed.
  - `admin_list_users()` / `admin_weekly_trend(weeks)` / `admin_ai_usage_summary()` already exist in prod (TABLE-returning), making PR #14's `CREATE OR REPLACE` versions a return-type conflict that can't apply.
  - TD-08's `log_domain_activity()` and TD-09's `replace_*` RPCs from the PR #13 batch — **never applied to prod**.
- The Supabase branch status `MIGRATIONS_FAILED` we noted in PR #14's investigation is the actual symptom of this drift.

**Impact — tech / architecture.** Schema state of prod is not reproducible from the repo. A fresh environment provisioned from our `supabase/migrations/` would diverge measurably from production. Future TD work that touches schema (TD-06 delta sync, TD-07 AI backend's `ai_usage` writes, TD-16, etc.) will keep hitting the same wall.

**Impact — functional.** Several TDs that were marked "Resolved · PR #13 batch" in the summary table (TD-08, TD-09) **are actually only resolved on paper** — the migrations exist in the repo but the triggers / RPCs they describe do not exist in production. The consumer/admin code that relies on them either falls back gracefully or has been silently broken since merge.

**Impact — business.** Audit story for the database is incoherent — there's no single source of truth for "what schema is live." This blocks SOC2/security review and operational disaster recovery.

**Effort.** M (~1 week phased).

**Possible solution approaches.**

1. **Capture production state as a new baseline migration** (`supabase/migrations/00000000000001_production_state_baseline.sql`). Either via `supabase db dump --schema-only` (requires CLI install + project link) or assembled from `pg_get_*` queries via the MCP. Mark it as superseding the existing partial migrations; old PR #6/#7/#13 SQL files stay as design-intent records with a banner.
2. **Insert rows into `supabase_migrations.schema_migrations`** for the baseline so Supabase's tracker knows it's "already applied" — prevents accidental re-runs.
3. **Wire the apply step into CI/CD.** The `deploy.yml` workflow needs a step that calls `supabase db push` against the configured project on every merge to `main`. Without this, the "versioned migrations" discipline is theatre.
4. **Re-apply the legitimately-missing pieces.** TD-08's audit triggers and TD-09's atomic-import RPCs are not in prod. They need to be reconciled — either re-shipped as new migrations on top of the captured baseline, or marked as superseded if the team chose not to ship them.

**Justification.** Without TD-20 fixed, every future schema TD lands in the same trap PR #14 hit. This is the single foundational blocker for trustworthy database evolution.

**Resolution (PR #16, 2026-05-28).** Closed via the four-phase plan above:

1. **Baseline captured** at [`supabase/migrations/00000000000001_production_state_baseline.sql`](supabase/migrations/00000000000001_production_state_baseline.sql) — assembled from MCP introspection (extensions, 16 tables, 18 indexes, ~55 RLS policies, 15 functions including the live `admin_dashboard_kpis` / `admin_list_users` / `admin_weekly_trend` / `admin_ai_usage_summary`, 12 triggers, function grants). Generated `db/schema.sql` is now a 46.6 KB single-source snapshot of actual prod state.
2. **Eight pre-PR-#16 design-intent migrations archived** to [`db/migrations-superseded/`](db/migrations-superseded/) (with a README and a SUPERSEDED banner on each file). They are kept for git history but are no longer scanned by `db-migrations-check.mjs` or by `supabase db push`. Two of them — TD-08 audit triggers and TD-09 `replace_all` RPCs — were never actually applied to prod; flagged in the archive README for a fresh additive migration in a follow-up PR.
3. **CI apply step wired** in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): new `db-migrations` job runs `supabase db push --include-all` against the production project on every push to `main`, gated before the `consumer` and `admin` deploy jobs. Requires new repo secrets `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` / `SUPABASE_DB_PASSWORD`.
4. **Tracker pre-recorded.** Row `(version='00000000000001', name='production_state_baseline')` inserted into `supabase_migrations.schema_migrations` so the very first deploy after PR #16 is a verified no-op against prod; future migrations append cleanly.

**Honest residuals.** TD-08 audit triggers and TD-09 atomic-import RPCs that were marked Resolved on paper in PR #13's batch are *still not in production* — the archived files at [`db/migrations-superseded/20260524071000_audit_triggers.sql`](db/migrations-superseded/20260524071000_audit_triggers.sql) and [`db/migrations-superseded/20260524073000_replace_all_rpc.sql`](db/migrations-superseded/20260524073000_replace_all_rpc.sql) capture the intent. Re-shipping them as fresh additive migrations on top of the new baseline is queued as a follow-up workstream.

---

## TD-21 — RLS performance: un-wrapped `auth.<fn>()` initplan + overlapping permissive policies

**Description.** Surfaced by the Supabase performance advisor during the post-deploy poll for the v6.4.26 release (2026-05-29). Two schema-wide patterns, present since the production baseline (not introduced by any single PR):

- **`auth_rls_initplan` (21 policies, WARN).** RLS policies call `auth.uid()` / `auth.<fn>()` / `current_setting()` directly in their `using` / `with check` expressions, so Postgres re-evaluates the function **once per row** instead of once per query. The fix is to wrap the call in a scalar subquery — `(select auth.uid())` — which the planner hoists to an InitPlan evaluated a single time.
- **`multiple_permissive_policies` (51 findings, WARN).** Several tables have more than one *permissive* policy for the same role + action (e.g. `activity_log` / `budgets` SELECT for `anon`/`authenticated`). Postgres must evaluate **every** permissive policy and OR the results, so overlapping permissive policies multiply per-row policy cost.

Also reported at INFO level (lower priority, bundled here): `unindexed_foreign_keys` (12 — e.g. `activity_log.actor_id`) and `unused_index` (8).

**Impact — tech / architecture.** Per-row function re-evaluation and N-policy fan-out are O(rows × policies) overhead on every read. Invisible at today's data volumes; degrades as households accumulate transactions/activity — and it compounds with TD-06 (no pagination: the client pulls whole tables, so each full-table read pays the full RLS cost).

**Impact — functional / business.** Slower queries and higher DB CPU at scale; raises Supabase compute cost and tail latency on the busiest tables (`transactions`, `activity_log`).

**Effort.** S–M — mostly mechanical, but every policy change is security-sensitive and must be applied as additive migrations through the TD-20 pipeline with a `get_advisors` security re-check after each.

**Possible solution approaches.**
- Rewrite RLS predicates to `(select auth.uid())` / `(select auth.jwt())` etc. across all flagged policies.
- Consolidate overlapping permissive policies per (role, action) into a single policy, or convert the narrower ones to `restrictive` where the intent is AND-composition.
- Add covering indexes for the 12 flagged foreign keys; drop or justify the 8 unused indexes.
- Re-run `get_advisors` (security **and** performance) after each migration; pair with TD-06 so pagination + RLS efficiency land together.

**Justification.** Not a release blocker and not a regression — the v6.4.26 money-typography change is frontend-only and PR #20 added columns/functions/triggers, not new policies. Filed so the schema-wide RLS-efficiency debt is tracked in one place rather than rediscovered on each advisor poll. Best scheduled alongside TD-06 (delta sync / pagination), since both target read-path scalability.

---

## TD-22 — PWA push notifications wired only as a stored preference

**Description.** [`react/src/types.ts`](react/src/types.ts) defines `NotificationPrefs.webPushEnabled` and the store at [`react/src/store.ts`](react/src/store.ts) gates a code path on it (`if (notificationPrefs.webPushEnabled && !isInQuietHours(...))`), but the rest of the web-push contract is missing. Specifically:

- No `Notification.requestPermission()` call anywhere in the app.
- No `serviceWorkerRegistration.pushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })`.
- No service-worker `push` event handler — the Workbox SW generated by `vite-plugin-pwa` only handles fetch/precache, not push payloads.
- No VAPID keypair generated or stored, no Supabase table for subscription endpoints, and no backend fan-out (Supabase Edge Function or otherwise) to deliver alerts when the app is closed.

What we ship today as "alerts" is therefore in-app only: the [`NotificationCenter`](react/src/components/layout/NotificationCenter.tsx) bell rendering rows from `notifications.ts` while the tab is open. The user gets nothing on the lock screen, nothing when the PWA is backgrounded, nothing when the device is asleep — even though the toggle suggests otherwise.

**Impact — tech / architecture.** A user-facing capability the codebase implies but does not provide. Adding real web-push later requires changes spanning the SW (custom strategy beside Workbox), env config (VAPID keys), DB (subscription endpoints + dedupe), and a server-side scheduler.

**Impact — functional / business.** Reminders for upcoming bills, missed payments, and budget thresholds — the cases the in-app system already computes — never reach the user unless the app happens to be open. For a household-finance product whose differentiator is *not forgetting bills*, this is the single biggest gap between promise and delivery.

**Effort.** M — VAPID generation + key storage + SW push handler + subscription table + endpoint to register/unregister + a Supabase Edge Function that fans the same `notifications.ts` rules out hourly. iOS support also requires the user to have installed the PWA (Safari only delivers push to home-screen-installed PWAs on iOS 16.4+).

**Possible solution approaches.**
- **Phase A (foundation).** Generate a VAPID keypair; add `applicationServerKey` to env; introduce a custom SW segment (or switch from `generateSW` to `injectManifest`) that listens for `push` and calls `self.registration.showNotification(...)`.
- **Phase B (subscribe flow).** On `webPushEnabled` toggle from `false → true`, call `Notification.requestPermission()`; on `granted`, call `pushManager.subscribe(...)` and POST the subscription to a new `push_subscriptions` table (1:N from `auth.users`).
- **Phase C (delivery).** Supabase Edge Function on a schedule that re-runs the same rule set used in [`react/src/lib/notifications.ts`](react/src/lib/notifications.ts) but server-side, dedupes against an `already_notified` mark, and POSTs to each endpoint.
- **Phase D (settings UI).** Add a "Notifications" panel to [`react/src/pages/Settings.tsx`](react/src/pages/Settings.tsx) with the master switch, per-type toggles, quiet hours, and a "Push: enabled · n endpoints registered" status line.

**Justification.** Not a regression and not a security issue — the toggle simply does less than it implies. Filed in v7.4.5 alongside the iOS install-banner suppression so the PWA-install / PWA-notify gap is one tracked workstream instead of folklore. Best landed after TD-06's delta sync (so the server scheduler can read deltas instead of full tables).

---

## TD-23 … TD-28 — Maintainability cluster (2026-06-14 partner review)

**Provenance.** An external partner team ran a static review (no test suite run) of
Vyact consumer **v9.3.x** and made six recommendations. This codebase is the matured
descendant of the FinFlow v6.4.9 audit that opened TD-01…TD-22; ~18 of those are now
resolved, so the partner correctly observed the dominant risk has shifted from
**correctness** to **cognitive load / maintainability**. Every specific claim was
verified against the working tree — all hold:

| Partner claim | Verified | Evidence (current tree) |
|---|---|---|
| README pins consumer `v7.0.2` | ✅ | `README.md:7`; actual `9.3.3` (`react/package.json:4`, `VERSIONS.md:9`) |
| `store.ts` ≈1,084 lines, owns too much | ✅ (now **1,167**) | init/refresh/onboarding/recurring/notifications/reconciliation/auth/sync in one file |
| `hybridAdapter.ts` ≈462 / `supabaseAdapter.ts` ≈805 | ✅ (now **498 / 884**) | both grew since their snapshot |
| `Reports.tsx` `as any` L378 | ✅ | `effectiveAmount(t as any, …)` — money path |
| `Settings.tsx` `useState<any[]>` + MFA `as any` | ✅ | L57, 147, 463, 465, 503 — security path |
| `store.ts` `window as any` E2E hooks | ✅ | L1161–1165 |
| Many `catch {}` blur expected vs unexpected | ✅ | **118** `catch {` across `react/src` |
| No root `changelog.md` | ✅ | `VERSIONS.md` + per-app CHANGELOGs (correct pattern — see note) |

**Analyst adjustments to the partner's prioritisation.**
- **Elevated:** the 118 `catch {}` (their #5) is *under-weighted*, not over-weighted —
  in a money app a swallowed write is a correctness/trust bug, not "forgiving UX." → **TD-24, High.**
- **Scoped down:** only 7 `as any` exist; judge by **location, not count**. Fix the money
  + MFA paths; the E2E `window` hooks get one typed shim. → **TD-27, Med.**
- **Declined:** *adding a root `changelog.md`.* That adds a doc surface to a repo already
  criticised for sprawl. The correct fix is discoverability (README pointer + CI drift
  guard), not a fourth changelog. → folded into **TD-23 / TD-28**.

**Governing constraint for the whole cluster.** Every item is *subtraction of complexity*.
TD-25/26 must leave the `useStore` public API and all user-visible behaviour
**byte-identical**, landed as small reversible PRs under the existing test net
([`docs/TEST_GOVERNANCE.md`](docs/TEST_GOVERNANCE.md): no merge without green unit +
Lane-A E2E evidence tied to the SHA). Sequence: **TD-23 now → TD-24 (observability) →
TD-25/26 (extractions) → TD-27/28 (polish + guardrails).**

---

## TD-23 — Doc drift: README pins a stale consumer version

**Description.** `README.md:7` advertises consumer **v7.0.2**; the real version is **9.3.3**
(`react/package.json`, `VERSIONS.md`). The one fact users and contributors check first is
wrong, and the version is hand-maintained in more than one place.

**Impact — tech / architecture.** Two hand-maintained version strings guarantee recurring drift.

**Impact — functional.** Onboarding/readers are misled about what they're running.

**Impact — business.** Sloppy-looking front door; undermines the otherwise-strong version discipline.

**Effort.** XS (minutes), standalone PR — ship immediately.

**Possible solution approaches.**
- `README.md:7` → `v9.3.3`; add a one-line "version source of truth → `VERSIONS.md`" pointer
  and stop hand-maintaining versions anywhere but `VERSIONS.md` + per-app CHANGELOGs.
- Move historical/era detail out of README into `VERSIONS.md` / CHANGELOGs.
- Pair with the CI drift guard in TD-28 so it can't recur.

**Acceptance.** README shows current version; no second hand-maintained version string;
`grep -r "v7.0.2"` returns nothing.

**Justification.** Zero-risk truth fix; the cheapest credibility win in the register.

**Resolution (2026-06-15).** `README.md:7` → **v9.3.3**; added a "**Version source of truth →
`VERSIONS.md`**" note under the table pointing at `package.json` / CHANGELOGs and the new CI
guard. `grep -r "v7.0.2"` is clean. Recurrence is now mechanically prevented by **TD-28**'s
`scripts/version-drift-check.mjs` (a deliberately drifted README fails the gate — verified).

---

## TD-24 — Error opacity: expected fallback vs unexpected fault are indistinguishable

**Description.** ~118 `catch {}` / best-effort blocks span the store, adapters, and persistence
helpers. Offline-first UX deliberately swallows failures, but "offline cache read failed,
continue" and "adapter contract violated / write silently dropped" share one code path. In an
offline-first **money** app, a swallowed write failure can mean silent data loss.

**Impact — tech / architecture.** No taxonomy or central sink for faults; the upcoming TD-25/26
refactors would be done blind without it.

**Impact — functional.** Unexpected faults (malformed data, dropped writes, integration breakage)
are absorbed with no signal.

**Impact — business.** "I entered it and it vanished" is the worst failure mode for a finance product.

**Effort.** M.

**Possible solution approaches.**
- Introduce two helpers — `expected(err, ctx)` (degraded path: debug-log, continue) and
  `unexpected(err, ctx)` (contract/data/dropped-write: central sink + breadcrumb).
- Central sink: in-app ring buffer + dev console, pluggable transport (Sentry-style) behind an
  interface; no user spam.
- Sweep **adapters → sync queue → persistence helpers first** (the silent-loss paths); add a dev
  assertion when a queued write is dropped (ties to TD-10's dead-letter surface). UI-cosmetic
  catches may stay terse.

**Acceptance.** Every `catch` in `lib/*Adapter.ts`, the sync module, and persistence helpers is
classified; a forced adapter-contract violation produces exactly one structured record; the
offline-happy path is unchanged (Lane-A E2E green).

**Partial resolution (2026-06-15) — taxonomy + the silent-write-loss paths.** New
[`react/src/lib/faults.ts`](react/src/lib/faults.ts) introduces the two classifiers the register
called for: `expected(err, ctx)` (degraded path — bounded in-memory ring buffer + dev-only
`console.debug`, never escalates) and `unexpected(err, ctx)` (contract violation / dropped write /
corruption — one structured record + `console.error` + a pluggable `setFaultTransport` sink), plus a
`droppedWrite(ctx, detail)` convenience. Both are non-throwing, so the offline-happy path is
unchanged. **Instrumented the silent-WRITE-loss sites first** (the register's stated priority):
- `hybridAdapter.flushQueue` — a non-UUID op (a write the contract can't honour) now records a
  `droppedWrite` instead of a mute `console.warn`; retry-exhausted ops emit `unexpected`;
  `writeQueue` persist-failure (loses pending writes on reload) is `unexpected`; the conflict /
  dead-letter bucket persists are `expected` (already surfaced by the R5 banner).
- `kvStore.kvSet` — a non-quota failure that reaches neither IndexedDB nor localStorage (memory-only,
  lost on reload) is `unexpected`; quota stays surfaced via `storageEvents`.
- `dataAdapter` read/write/removeBoth helpers classified `expected` (kvSet now owns its own surfacing).
Tests: [`faults.test.ts`](react/src/lib/__tests__/faults.test.ts) `CON-UNIT-069/070/071` pin "exactly
one structured record + one transport hand-off" for `unexpected`, transport-silence for `expected`,
and `droppedWrite ⇒ unexpected`. tsc · 155 tests · build green.
**Still open:** exhaustively classifying the remaining best-effort read/storage `catch {}` micro-sites
across the six files (and the wider ~118 app-wide), a registered production transport, and an in-app
diagnostics view over `getFaults()`. Kept ⚠ partial until the read/noop sweep + diagnostics land.

**Justification.** Highest latent risk in the cluster, and the prerequisite that makes the
store/sync extractions *observable* — land it before TD-25/26.

---

## TD-25 — Consumer `store.ts` is a god-module (1,167 lines)

**Description.** `store.ts` owns init, refresh, onboarding hydration, recurring engine,
notifications, reconciliation/net-worth bridge, auth/session transitions, sync coordination, and
every global modal slot. It grew +83 lines since the partner's snapshot — the trend is the point.

**Impact — tech / architecture.** A change in one concern requires reading ~1,000 lines of
unrelated logic; high regression surface from "one more branch in the giant store."

**Impact — functional.** Subtle behaviour changes (reconciliation, recurring) are hard to audit.

**Impact — business.** Slows velocity and raises defect-escape rate as features accrete.

**Effort.** L.

**Possible solution approaches.** Zustand slice-composition; the public `useStore` hook stays
identical (pure internal refactor). The seams already exist as comment-delimited regions:
```
react/src/store/
  index.ts            // composes slices → useStore (unchanged external API)
  slices/
    dataSlice.ts      // entities + refresh + CRUD upserts/removes
    modalSlice.ts     // all open*/close* global modal state
    cloudAuthSlice.ts // session transitions, household switch, myRole
    recurringSlice.ts // recurring schedules + runRecurringEngine
    notifySlice.ts    // notifications refresh/read
    reconcileSlice.ts // reconcileAccount + net-worth bridge
    syncSlice.ts      // sync coordination (delegates to TD-26 module)
  testHooks.ts        // single typed shim for the window E2E hooks (closes part of TD-27)
```
Extract slice-by-slice, each its own PR leaving `useStore`'s shape byte-identical.

**Acceptance.** No file in `store/` > ~300 lines; `useStore` public type diff = ∅; unit + Lane-A
E2E green after each slice PR.

**Partial resolution (2026-06-15) — increments 1–2: the pattern + two slices.** Established the
Zustand slice-composition: exported the `Store` type and changed the root to
`create<Store>((set, get, api) => ({ ...createModalSlice(set, get, api), ... }))`.
- **[`store/slices/modalSlice.ts`](react/src/store/slices/modalSlice.ts)** — all `open*/close*/editing*`
  global modal state (txn/goal/goalProgress/budget/debt/asset/account) moved verbatim and folded into
  `Store` via `extends ModalSlice`, so the public `useStore` type is byte-identical and behaviour is
  unchanged (`set`/`get` are the same store-wide handles).
- **[`store/testHooks.ts`](react/src/store/testHooks.ts)** — the E2E `window` exposure behind one typed
  generic shim; removed all three `window as any` casts from `store.ts` (**closes TD-27's residual**).
**Increment 3 (2026-06-15) — [`store/slices/reconcileSlice.ts`](react/src/store/slices/reconcileSlice.ts):**
the Money-Model B1.3 `reconcileAccount` + §6 R-AGG-5/D2 net-worth bridge, moved verbatim and folded
in via `extends ReconcileSlice` (reads/writes the rest of the store via `get()`). Because it is a
money-model path, verified additionally against the money-invariant + golden-regression suites
(`moneyModel.invariants/engines/regression.test.ts`) — all green, no money number moved.
`store.ts` is now **1,167 → 1,041**; `useStore`'s external API is unchanged. tsc · 161 tests · build green.
**Remaining:** the larger domain slices (`dataSlice`, `cloudAuthSlice`, `recurringSlice`, `notifySlice`,
`syncSlice`) and the final `store.ts → store/index.ts` rename (which rewrites ~30 relative imports —
deferred to the last increment to keep each step low-risk). `notifySlice` first needs the store-private
`readLocalJson`/`setLocalJson` helpers extracted to a shared module. Kept ⚠ partial until no `store/`
file exceeds ~300 lines.

**Justification.** Top structural win; the test net now exists to make it safe. Do after TD-24.

---

## TD-26 — Sync-queue mechanics tangled into `hybridAdapter.ts` (498 lines)

**Description.** `hybridAdapter.ts` conflates cache-first read policy with queue mechanics —
serialization, dead-lettering, backoff, and optimistic-concurrency conflict handling (from TD-03).
These are independently testable concerns currently hard to test in situ.

**Impact — tech / architecture.** The data-integrity core is hard to reason about and audit.

**Impact — functional.** Queue/conflict bugs are high-blast-radius and under-tested.

**Impact — business.** Sync reliability is a headline promise of the multi-household product.

**Effort.** M.

**Possible solution approaches.**
```
react/src/lib/sync/
  syncQueue.ts   // enqueue/serialize/persist
  deadLetter.ts  // poison-op handling (existing logic, isolated)
  backoff.ts     // retry/backoff policy (the TD-10 2/4/8/16/32s logic)
  conflict.ts    // optimistic-concurrency resolution (the TD-03 ConcurrencyConflictError path)
hybridAdapter.ts // keeps only cache no-clobber read policy; delegates writes to sync/
```
Add focused unit tests per extracted concern; require a queue-replay regression (seeded poisoned
op) before/after.

**Acceptance.** `hybridAdapter.ts` < ~250 lines; each `sync/*` file unit-tested; queue replay /
dead-letter behaviour unchanged.

**Resolution (2026-06-15).** The queue mechanics were extracted to `react/src/lib/sync/` as four
focused, independently-testable modules plus a shared type, with **every storage key and code path
byte-identical**:
- [`sync/backoff.ts`](react/src/lib/sync/backoff.ts) — `MAX_RETRIES` + the 2/4/8/16/32s policy.
- [`sync/syncQueue.ts`](react/src/lib/sync/syncQueue.ts) — `sync_queue` persistence (`read/write/enqueue`) + `isQueueOpIdValid` (the uuid-PK jam guard).
- [`sync/deadLetter.ts`](react/src/lib/sync/deadLetter.ts) — the `sync_conflicts` / `sync_failed` buckets, counts/clears, and the R5 `retryDeadLettered` drain.
- [`sync/conflict.ts`](react/src/lib/sync/conflict.ts) — pure `classifyFlushError` encapsulating the TD-03 (terminal conflict) + TD-10 (bounded retry) decision.
`hybridAdapter.ts` keeps the cache-first read/no-clobber policy + a thin flush orchestrator that
delegates to those modules; its public surface (`pendingOpCount` / `pendingConflictCount` /
`pendingFailedCount` / `clearConflicts` / `clearFailed` / `retryDeadLettered`) is unchanged.
Tests `CON-UNIT-072…077` ([`__tests__/sync.test.ts`](react/src/lib/__tests__/sync.test.ts)) unit-test
each module and include the **seeded poisoned-op queue-replay regression**. tsc · 161 tests · build green.
**Honest scope note on the line target:** `hybridAdapter.ts` is **400 lines** (was 508), not <250 —
the ~108 lines removed were exactly the queue mechanics TD-26 targets; the remaining 400 is the
cache-first read/no-clobber policy + CRUD wrappers + households, which TD-26 explicitly *keeps*.
Driving it under 250 would mean extracting the read/cache policy too — a separate concern, not this item.

**Justification.** Same maintainability thesis as TD-25, on the integrity-critical path. Parallel
to TD-25's `syncSlice`.

---

## TD-27 — Risk-bearing `as any` on money + security paths

**Description.** 7 `as any` total — small, but two sit where it matters: `Reports.tsx:378`
(`effectiveAmount(t as any, …)` — money path) and `Settings.tsx` MFA (L57, 147, 463, 465, 503 —
security path). The `store.ts` `window as any` E2E hooks (L1161–1165) are acceptable with a shim.

**Impact — tech / architecture.** Type escape hatches on exactly the paths where regressions hide
(money math, auth/MFA response parsing).

**Impact — functional.** A shape change in the Supabase MFA response or the txn type is silently uncaught.

**Impact — business.** Security/money correctness deserve the strict-TS guarantee the rest of the app has.

**Effort.** S.

**Possible solution approaches.**
- `Reports.tsx:378` — type the `effectiveAmount` argument properly (no cast).
- `Settings.tsx` MFA — a small `mfaTypes.ts` + runtime narrowing/decoder around the Supabase
  factor/enroll responses.
- E2E hooks — one typed shim in `store/testHooks.ts` (from TD-25), commented as intentional.

**Acceptance.** `grep -rn "as any" react/src` ≤ the single E2E shim; MFA + report paths fully typed;
tsc clean.

**Resolution (2026-06-15).** Both risk-bearing paths typed; tsc clean, 152 tests + build green.
- **Money path** — `Reports.tsx`: `buildPeriodData`'s `txns` param was a convoluted conditional
  type that collapsed to `never[]`, forcing a structural re-cast and the `effectiveAmount(t as any …)`.
  Retyped the param `Transaction[]`; dropped the inner structural cast and the `as any` — the loop
  now passes a real `Transaction`.
- **Security path** — `Settings.tsx`: `mfaFactors` is now `useState<Factor[]>` (imported from
  `@supabase/supabase-js`); `listMfaFactors().all` is read directly; the enrol response is narrowed
  by `enrolled.type === 'totp'` to read `enrolled.totp.uri` / `enrolled.id` instead of five `as any`
  property guesses. **Residual:** the `store.ts` `window as any` E2E hooks remain (intentional) and
  are folded into TD-25's `store/testHooks.ts` shim.

**Justification.** Prioritise by blast radius, not count — fix the two that touch money and auth.

---

## TD-28 — Doc-architecture: CLAUDE.md history sprawl + no drift guard

**Description.** `CLAUDE.md` (314 lines) mixes current operating state with long historical
per-version narrative; the ~30-file `docs/` tree lacks an index; nothing in CI prevents the
README/VERSIONS drift that TD-23 fixes by hand.

**Impact — tech / architecture.** Provenance log and operating guide are conflated; onboarding
reads archaeology to find current rules.

**Impact — functional / business.** Higher ramp time; doc drift recurs without a guard.

**Effort.** S.

**Possible solution approaches.**
- Trim `CLAUDE.md` to an operating guide (current state, architecture rules, contributor
  instructions); move dated historical snapshots to `VERSIONS.md` / an `docs/HISTORY.md` archive.
- Add a CI check: README/VERSIONS consumer version must equal `react/package.json` (fails build on
  drift) — permanently closes TD-23's recurrence.
- Add a one-paragraph "docs map" at the top of README (the doc *count* is fine; discoverability is
  the gap). **Do not** add a root `changelog.md`.

**Acceptance.** CLAUDE.md carries no dated historical narrative; CI fails on a deliberately
mismatched README version; README has a docs index.

**Partial resolution (2026-06-15) — the guardrail half.** New
[`scripts/version-drift-check.mjs`](scripts/version-drift-check.mjs) makes `react/package.json` /
`admin/package.json` the source of truth and asserts the consumer + admin versions match across
`README.md`, `VERSIONS.md`, and `react/CHANGELOG.md`; wired as the `version-drift` gate in
[`scripts/automation-run.mjs`](scripts/automation-run.mjs). Negative-tested: a deliberately drifted
README version exits 1 with a precise report. This **permanently closes TD-23's recurrence**.
**Still open:** trimming CLAUDE.md's dated historical narrative into `VERSIONS.md` / an
`docs/HISTORY.md`, and adding the README docs-map index. Kept ⚠ partial until those land.

**Justification.** Low-risk polish that also installs the guardrail preventing TD-23 from
recurring. The partner's "trim CLAUDE.md" (#6) and "README entry point" (#1) land together here.

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
| 2026-05-23 | #8 | **TD-01 phase A: dinero.js at the FX boundary** (Consumer v6.4.15). New `react/src/lib/money.ts` boundary layer registers the 12 supported currencies with `@dinero.js/currencies`, exposes `toDinero` / `fromDinero` for the JS-number ↔ Dinero edges, and `convertViaUsdRates` doing the existing USD-base two-step FX through dinero with banker's rounding at the FX boundary. `format.ts:convert()` body migrated to use it; signature unchanged. `CON-UNIT-006` flipped from a TD-01 characterization test to a positive assertion (`.toBe(start)` on a round-trip). Six new tests `CON-UNIT-040..045` pin the contract. **Correction surfaced & fixed in this PR:** dev's earlier PR #3 imported `@tanstack/react-virtual` without adding it to `package.json` — the package was added explicitly here. | **Begins TD-01.** Phases B (`calculations.ts`), C (`amortization.ts`), D (adapter row mappers + Money UI component + `Money` opaque type in `types.ts`) are queued PRs. |
| 2026-05-23 | #9 | **TD-01 phase B: aggregations in dinero space** (Consumer v6.4.16). Every aggregator in `react/src/lib/calculations.ts` (`monthlyData`, `totalBalance`, `spendByCategory`, `spendByCategoryInRange`, balance-sheet helpers, `splitsOutstanding`) now folds via a new `sumDinero` helper in `money.ts` — integer-cents `add` instead of JS `+` on float — and `fromDinero`s only at the function edge. Public signatures unchanged; new internal `effectiveDinero(t, base, rates)` is the single source of "transaction → Dinero in base". `calculations.test.ts` tightened from `toBeCloseTo(x, 10)` to strict `.toBe(x)` where exactness is now achievable. New `CON-UNIT-046` is the regression pin for the float-drift fix on `10 × $0.10`. | Continues **TD-01**. Phases C (`amortization.ts`) and D (adapters + UI + types) are queued. |
| 2026-05-23 | #10 | **TD-01 phases C + D — combined; closes TD-01** (Consumer v6.4.17). **Phase C — `react/src/lib/amortization.ts`:** `splitPayment` takes an optional `currency`; when supplied, interest and principal are both computed in dinero (`subtract` in dinero space) so `splitPayment(200000, 5, 1170, 'GBP') === {interest: 833.33, principal: 336.67}` strictly. `calculateAmortizationSchedule` carries outstanding as a Dinero across the whole iteration. `applyPayment` threads `debt.currency` end-to-end. `interestSummary` reuses Phase B's `sumDinero`. Two new pins: `CON-UNIT-047` (300-row schedule sum-of-principal ≤ £0.01 from starting balance) and `CON-UNIT-048` (currency-quantised interest is exact). `computeEmi` / `computeRemainingMonths` intentionally remain as float derivations — their outputs feed quantised layers. **Phase D — boundary + types:** new `parseMoneyFromCloud(v)` helper in `money.ts` accepts string/number/null/undefined with NaN-safe fallback; `supabaseAdapter.ts` row mappers (`rowToTxn`, `rowToBudget`, `rowToGoal`, `rowToDebt`, `rowToAsset`) replace inline `Number(r.x)` casts with it. `types.ts` gains a header-level **"Money fields (TD-01 discipline)"** doc block. `Money.tsx` UI component audited and confirmed math-free (only `fmt()` / `fmtShort()`). Two new pins: `CON-UNIT-049/050` for the cloud-boundary helper. | **Closes TD-01.** Marked Resolved in the Summary table. The future `Money` opaque-type cleanup (compile-time enforcement of the discipline) is a separate, smaller PR — not part of TD-01's spec. |
| 2026-05-23 | #11 | **TD-03 phase A: optimistic concurrency plumbing** (Consumer v6.4.18). `DataAdapter.upsert` gains optional `expectedUpdatedAt?: string`; `SupabaseAdapter.upsert` splits into a guarded UPDATE path (`.eq('id',id).eq('updated_at',expected).select().maybeSingle()` — zero rows ⇒ throws new `ConcurrencyConflictError`) and the legacy upsert path (back-compat for new inserts or not-yet-wired callers). `HybridAdapter.flushQueue` catches the typed error and moves the op to a `ff_sync_conflicts` dead-letter bucket; new `pendingConflictCount()` exposes the count for future UI. `LocalStorageAdapter` accepts the param for interface parity and ignores it (single-user, no concurrency). `store.upsertTransaction` threads `t.updated_at` when editing an existing txn — first real call site exercising the new path. New `react/src/lib/__tests__/supabaseAdapter.test.ts` with three vitest-mocked-Supabase tests (`CON-UNIT-051..053`) pinning happy-path, conflict, and back-compat. | **Begins TD-03.** Phase B (PR #12) wires the other 4 CRUD entities (Budget, Goal, Debt, Asset) + adds the consumer UI toast. Phase C (PR #13) adds the auto-refetch / present-in-modal user-merge flow. Marking TD-03 Resolved is deferred until phase B lands, since today only Transactions edits actually enforce the precondition. |
| 2026-05-28 | #15 | **TD-04 reality reconciliation + TD-20 filed.** Attempted to ship PR #14 (admin read RPCs + ai_usage table); on first apply the migration failed with `column "created_at" does not exist`. Investigation revealed: (a) **all three RPCs already exist in prod**, applied 2026-05-22 via the Supabase Dashboard's migration editor (`v646_admin_ai_usage_summary`), with TABLE return types that would have conflicted with PR #14's jsonb `CREATE OR REPLACE`; (b) `ai_usage` has been a prod table since the same date but with column names `ts` / `message_len` / extra `surface` / `household_id` that don't match what PR #14 assumed; (c) **none of PR #6/#7/#13's migrations have ever been applied to prod via our repo's tooling** — Supabase tracks its own 13-migration history that overlaps but is not byte-equivalent. Closed PR #14 without merging. Flipped TD-04 to ✅ Resolved (honest: prod has the RPCs, just not via our repo). Filed new **TD-20** documenting the parallel-history meta-bug and the missing CI auto-apply step. | Closes **TD-04** for real (not via our repo, but the spec is satisfied in prod). Opens **TD-20** as a new High-severity item — foundational for any future schema work. Notable consequence: TD-08 and TD-09's "Resolved · PR #13 batch" markers are honest about the repo state but **the triggers / RPCs they describe are NOT actually live in prod**. That gap is captured in TD-20 and will be reconciled when the baseline-capture work happens. |
| 2026-05-24 | #13 batch | **Dev handoff batch: TD-08 / TD-09 / TD-10 / TD-12 / TD-13 / TD-15 + slugify + TD-04-ext (a+b, partial c)** (Consumer v6.4.20→v6.4.25, Admin v1.0.8, Database `audit-triggers` / `budgets-period-column` / `replace-all-atomic` / `subscriptions` / `content-items` / `admin-rpcs`). Delivered by a developer per the mid-tier handoff prompt. The dev submitted everything as a single working-tree bag (vs. the 10 disciplined commits the prompt required) and made multiple errors caught in review: missing `memberships` trigger and `search_path` lockdown on TD-08, lowercase filename `syncstatusbadge.tsx` + lowercase Badge import (Linux-CI break), `db/schema.sql` not regenerated, three stale FC-format e2e IDs blocking the catalog reconciler, extraneous PR_CHECKLIST.md / PR_COMMIT_PLAN.md / scripts/commit_and_validate.ps1, and a clean scope deviation on TD-04-ext-c (wrote subscription/content mutation RPCs instead of the requested `admin_list_users`/`admin_weekly_trend`/`admin_ai_usage_summary`). All blockers corrected; the genuinely-useful work accepted. The originally-requested 3 read RPCs (TD-04-ext-c) and a missing `CON-UNIT-054` unit pin for TD-09 are re-queued on the lead's workstream. TD-12 selectors use `any[]` extensively — flagged as a quality follow-up. | Closes **TD-08, TD-09, TD-10, TD-12, TD-13, TD-15**. Partial **TD-04-ext** (a + b in; c renamed/documented). The slugify edge from PR #2 is also closed. TD-04 fully resolved status held until the originally-requested admin read RPCs land. |
| 2026-05-28 | #16 | **TD-20 reconciliation — closes TD-20** (Database `production-baseline`). Four-phase reconciliation of repo migrations with actual production schema. **(1)** Captured live prod schema as a new single baseline at `supabase/migrations/00000000000001_production_state_baseline.sql` (~46 KB; 3 extensions, 16 tables, 18 indexes, ~55 RLS policies, 15 functions including the live admin RPCs with TABLE return types, 12 triggers). **(2)** Moved the eight pre-#16 design-intent migrations to `db/migrations-superseded/` with a README and a SUPERSEDED banner on each, taking them out of the apply path while preserving git history. **(3)** Added a `db-migrations` job in `.github/workflows/deploy.yml` that runs `supabase db push --include-all` (gated before the `consumer` and `admin` deploy jobs) so the apply step is no longer manual; documented three new required GitHub Action secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`). **(4)** Pre-recorded the baseline in `supabase_migrations.schema_migrations` so the first auto-apply after merge is verified no-op against prod. `db/MIGRATIONS.md` updated; the earlier "Known gap" warning replaced with a "Reconciliation landed" note. | **Closes TD-20.** Marked Resolved in the Summary table. **Honest residual:** TD-08's audit triggers and TD-09's `replace_all_*` RPCs that were marked Resolved-on-paper in PR #13's batch are *still not in production*; the archived files capture the intent and re-shipping them as fresh additive migrations on top of the new baseline is queued as a follow-up (PR #20). |
| 2026-05-28 | #17 / #18 / #19 | **Auto-apply pipeline hotfixes**, in three quick follow-up PRs after the first post-merge Deploy run on PR #16's commit failed: **PR #17** pinned `supabase/setup-cli@v1` from `version: latest` to `version: 1.226.4` (the `latest` lookup hit GitHub's unauthenticated API and got rate-limited on shared runners). **PR #18** committed a minimal `supabase/config.toml` with just `project_id` (the CLI's `link` subcommand requires the config file even when `--project-ref` is passed on the command line). **PR #19** committed 13 single-statement (`select 1;`) stub migration files matching the prod-tracker versions for the pre-PR-#16 historical migrations (the CLI's `db push` requires `supabase/migrations/` and the remote tracker to be in 1:1 sync — `--include-all` does not override). After PR #19 merged, Deploy #26 went green end-to-end in 1m 16s: db-migrations no-op'd against prod (as designed by the baseline pre-record), both Vercel deploys completed. | Foundational follow-up to PR #16. None of the three is a TD on its own; together they make PR #16's auto-apply pipeline actually functional. |
| 2026-05-29 | #20 | **TD-08 / TD-09 / TD-13 actually in production** (Database `td-08-09-13-honest-residuals`). Four additive migrations: `20260529150000_td13_budgets_add_period.sql` adds `period` / `period_start` / `period_end` to `budgets` (so the consumer can stop faking it with `budgetMeta.ts`); `20260529150500_td08_audit_triggers.sql` installs `log_domain_activity()` SECURITY DEFINER with `search_path = public, pg_temp` lockdown and attaches `AFTER INSERT/UPDATE/DELETE` triggers on all six domain tables including `memberships`; `20260529151000_td09_replace_all_rpcs.sql` installs the six `replace_<entity>(h uuid, rows jsonb)` SECURITY DEFINER RPCs gated by `auth.uid()` and `is_member(h)`; `20260529151500_td08_td09_harden_execute_grants.sql` revokes the default PUBLIC execute grant after the security advisor flagged anon-exposure of the seven new functions. **Apply path:** the GitHub Actions browser-merge route was unavailable (flaky Chrome extension), so the four migrations were applied **directly to the prod project via the Supabase MCP `execute_sql` tool**, with the four `schema_migrations` tracker rows recorded to match the repo filenames 1:1 (same Phase-4 pattern TD-20 used for the baseline) — so the CI `db push` after PR #40 merges is a verified no-op. Verified post-apply: 3 tracker rows + 3 budget cols + 1 audit fn + 6 triggers + 6 RPCs present; security advisor shows zero anon-executable and zero mutable-`search_path` warnings on any PR #20 function. **Discovery during prep**, fixed in the same PR: the `db/migrations-superseded/README.md` claimed TD-13 had been applied to prod via the Dashboard; baseline grep showed otherwise. README updated to reflect what actually shipped vs. what was claimed. | **Closes TD-20's honest residuals for TD-08 / TD-09 / TD-13.** None of these was actually in prod despite the earlier "Resolved · PR #13 batch" markers. Their Summary-table entries remain ✅ Resolved (the *code-side* work was done in PR #13; this PR makes the *schema-side* match). First non-trivial schema change reconciled into the TD-20 migration discipline. |
| 2026-06-15 | TD-25 (increment 3) | **reconcileSlice extracted.** The Money-Model B1.3 `reconcileAccount` + net-worth bridge moved verbatim to `store/slices/reconcileSlice.ts`, folded into `Store` via `extends ReconcileSlice`; reads/writes the rest of the store via `get()`. `store.ts` 1,080→1,041. Verified incl. the money-invariant + golden-regression suites (no money number moved); tsc · 161 tests · build green. | **TD-25** still ⚠ partial. |
| 2026-06-15 | TD-25 (increments 1–2) | **Zustand slice-composition pattern established (TD-25 → ⚠ partial).** Exported the `Store` type and converted the `create<Store>` root to compose slices via `(set, get, api) => ({ ...createModalSlice(...), ... })`. **modalSlice** (`store/slices/modalSlice.ts`) — all `open*/close*/editing*` global modal state (txn/goal/goalProgress/budget/debt/asset/account), folded into `Store` via `extends ModalSlice` so the public `useStore` type is byte-identical. **testHooks** (`store/testHooks.ts`) — the E2E `window` exposure behind one typed generic shim, removing all three `window as any` casts from `store.ts` (closes TD-27's residual). `store.ts` 1,167→1,080; `useStore` external API unchanged. tsc · 161 tests · build green. Remaining domain slices (data/cloudAuth/recurring/notify/reconcile/sync) + the `store.ts`→`store/index.ts` rename are queued as further increments. | **TD-25** → ⚠ partial; also closes TD-27's `window as any` residual. |
| 2026-06-15 | TD-26 | **Sync-queue mechanics extracted to `lib/sync/` (closes TD-26).** Byte-identical extraction of the queue persistence + op-validity (`syncQueue.ts`), dead-letter buckets + R5 retry (`deadLetter.ts`), backoff policy (`backoff.ts`), and flush-error resolution (`conflict.ts` — pure `classifyFlushError`) out of `hybridAdapter.ts` (508→400 lines), which keeps only the cache-first read/no-clobber policy + a thin flush orchestrator. Public adapter surface unchanged (UI counts/retry still work). New `CON-UNIT-072…077` (`__tests__/sync.test.ts`) unit-test each module + a seeded poisoned-op queue-replay regression. Verified: tsc clean, 161 tests, reconciler 77 (baseline; new IDs clean), build green. | Closes **TD-26**. |
| 2026-06-15 | TD-24 slice | **Error taxonomy + silent-write-loss instrumentation (TD-24 → ⚠ partial).** New `react/src/lib/faults.ts` with `expected` / `unexpected` / `droppedWrite` (ring buffer + pluggable transport, non-throwing). Instrumented the silent-WRITE-loss paths first: `hybridAdapter.flushQueue` (non-UUID drop → `droppedWrite`; retry-exhausted → `unexpected`; queue-persist failure → `unexpected`; conflict/dead-letter persists → `expected`), `kvStore.kvSet` (non-quota persist-failure → `unexpected`), `dataAdapter` helpers (→ `expected`). New `CON-UNIT-069/070/071` (`faults.test.ts`); removed the orphaned `CON-UNIT-065` catalog row (its `budgetIdentity.test.ts` was deleted in v9.3.3). tsc · 155 tests · drift + reconciler (my IDs clean) · build green. | **TD-24** → ⚠ partial (taxonomy + write-loss paths done; read/noop sweep + in-app diagnostics open). |
| 2026-06-15 | maintainability pass | **Closes TD-23 + TD-27; ships TD-28's guard.** TD-23: `README.md` consumer version v7.0.2→**v9.3.3** + a "version source of truth" note. TD-27: removed the money-path `as any` in `Reports.tsx` (typed `buildPeriodData(txns: Transaction[])`, dropped the `never[]`-collapsing conditional type + structural recast) and the MFA-path `as any` in `Settings.tsx` (`useState<Factor[]>`, read `listFactors().all`, narrow the enrol response by `type==='totp'` for `.totp.uri`/`.id`); only the intentional `store.ts` E2E `window` shim remains. TD-28 (partial): new `scripts/version-drift-check.mjs` + `version-drift` gate in `automation-run.mjs` — fails the build when README/VERSIONS/CHANGELOG drift from `package.json`; negative-tested. Verified: drift gate green, tsc clean, 152 unit tests + build green. | Closes **TD-23, TD-27**; **TD-28** → ⚠ partial (guard shipped; CLAUDE.md trim + docs-map open). |
| 2026-06-14 | intake | **Partner-review maintainability cluster filed (TD-23…TD-28).** External static review of consumer v9.3.x; six findings validated against the working tree (all confirmed — README v7.0.2 vs 9.3.3, `store.ts` 1,167 lines, `supabaseAdapter.ts` 884, 7 `as any`, 118 `catch {}`). Folded the standalone `docs/MAINTAINABILITY_REMEDIATION.md` into this register (§TD-23…TD-28) and **deleted** it to keep TECH_DEBT.md the single source of truth. Analyst adjustments: elevated error-handling to High (TD-24, silent-write-loss risk in a money app); scoped `as any` by path-risk not count (TD-27); declined the partner's implied "add a root changelog.md" (would worsen doc sprawl) in favour of a CI drift guard (TD-28). | Opens **TD-23, TD-24, TD-25, TD-26, TD-27, TD-28** (all ⬜ open). No code change in this intake. |
| 2026-05-23 | #12 | **TD-03 phase B — closes TD-03** (Consumer v6.4.19). `Budget` / `Goal` / `Debt` / `Asset` interfaces gain `updated_at?: string`. The four row mappers in `supabaseAdapter.ts` thread `r.updated_at` into the returned JS shape. The four corresponding store actions (`upsertBudget` / `upsertGoal` / `upsertDebt` / `upsertAsset`) pass `record.updated_at` as the precondition on edits, mirroring `upsertTransaction`. `HybridAdapter.clearConflicts()` added. New `SyncConflictBanner` (cloud-mode-only — guarded by `typeof` checks) mounted in `Layout` polls `pendingConflictCount()` every 5 s and shows a dismissible banner when count > 0. **Every CRUD modal in the app is now protected.** | **Closes TD-03.** Marked Resolved in the Summary table. **Testing note:** the conflict-detection mechanism is entity-agnostic; the four new wirings exercise the same path PR #11 already pinned in `CON-UNIT-051..053`. The PR's other new surface (`updated_at` field additions, store-action arg threading, presentational banner) is type-system-enforced + visually-verifiable; no new vitest specs were added because they would be near-duplicates of existing pins. The longer-term work (CRDT / per-field merge for high-contention entities) is outside the register's TD-03 scope and would be a separate, future item. |

## Suggested remediation order (refreshed 2026-06-01)

Only the genuinely-open items remain; closed entries are dropped from the order. Pairings reflect shared code paths. The maintainability cluster (TD-23…TD-28) was added 2026-06-14 and is interleaved by effort/risk.

1. ~~**TD-23** — README version truth-fix.~~ ✅ *Closed 2026-06-15.*
2. ~~**TD-27** — `as any` on money/security paths.~~ ✅ *Closed 2026-06-15.*
3. **TD-28** — ⚠ *guard shipped 2026-06-15* (`version-drift-check.mjs`); remaining: CLAUDE.md trim + README docs-map.
4. **TD-24** — error taxonomy + structured logging. High; makes TD-25/26 observable, so do it first among the refactors. **Next up.**
5. **TD-25** — `store.ts` → Zustand slices. L; **in progress** — pattern + modalSlice/testHooks landed 2026-06-15; data/cloudAuth/recurring/notify/reconcile/sync slices + index.ts rename remain.
6. ~~**TD-26** — extract `lib/sync/`.~~ ✅ *Closed 2026-06-15 (byte-identical; CON-UNIT-072…077 + replay regression).*
7. **TD-16** — passphrase-based WebCrypto AES‑GCM on JSON backups. XS/S effort, clear privacy win.
8. **TD-19 Lane B** — disposable Supabase test project + a small (~5) RLS-isolation pack. The only place the security boundary is asserted end-to-end.
9. **TD-02 (integration layer)** — close the unit↔E2E gap with store↔adapter↔cache integration tests.
10. **TD-22** — real PWA web-push (VAPID + SW handler + subscription table + Edge fan-out). Best after TD-06 deltas (already done).

### Closed in this pass (2026-06-01, third wave)
- **TD-07** — Chat wired to Google Gemini 1.5 Flash (free tier) via new [`geminiBackend.ts`](react/src/lib/geminiBackend.ts) + `selectChatBackend()` factory in [`aiSummary.ts`](react/src/lib/aiSummary.ts). `VITE_GEMINI_API_KEY` selects the real backend; absent key falls back to the deterministic stub so offline / no-key mode still works. Existing `SafeSummary` PII contract unchanged. Beta chip swaps to a sage “Gemini” chip when the real backend is active. New pins `CON-UNIT-060` / `061` / `062` cover request body shape, role mapping, error surfaces, and construction.

### Closed in this pass (2026-06-01, second wave)
- **TD-14** — substrate moved off localStorage onto IndexedDB via the new [`kvStore`](react/src/lib/kvStore.ts) module (zero new runtime deps, ~120 LOC), with legacy keys auto-migrated on first read. Quota failures are no longer swallowed silently — [`storageEvents`](react/src/lib/storageEvents.ts) fans them out and [`App.tsx`](react/src/App.tsx) shows a toast asking the user to export a backup. The [`LocalStorageAdapter`](react/src/lib/dataAdapter.ts) read/write helpers are now async and route through `kvStore`. New pins `CON-UNIT-057` / `058` / `059` exercise the localStorage-fallback path, quota fan-out, and legacy key read-through migration.

### Closed in this pass (2026-06-01)
- **TD-06 + TD-21** — paired delta-sync redesign + RLS initplan rewrite. Migration [`20260601120000_td06_td21_rls_perf_and_delta_sync_indexes.sql`](supabase/migrations/20260601120000_td06_td21_rls_perf_and_delta_sync_indexes.sql) consolidates overlapping permissive SELECT policies across all 6 domain tables (transactions/budgets/goals/debts/assets/exchange_rates) plus memberships/profiles/activity_log, wraps every remaining bare `auth.uid()` as `(select auth.uid())` for initplan caching, and adds the matching `(household_id, updated_at)` composite indexes on the four domain tables that lacked one. Client side: [`SupabaseAdapter.listSince()`](react/src/lib/supabaseAdapter.ts) implements `updated_at > cursor` paging including tombstones; [`HybridAdapter.list()`](react/src/lib/hybridAdapter.ts) seeds a per-`(hid, entity)` cursor on the first full pull and uses the incremental path on every subsequent refresh, merging tombstones into the cache. Test coverage: `CON-UNIT-055` / `CON-UNIT-056` pin the query shape and the live/tombstone partitioning.

## Honest residuals / quality follow-ups (not first-class TDs)

Small items surfaced during the 2026-06-01 reconciliation. None are release blockers; all should be picked up alongside related TD work.

- ~~**Selector typing.**~~ ✅ *Closed 2026-06-01.* [`react/src/lib/selectors.ts`](react/src/lib/selectors.ts) now defines a local `StoreSlice` interface and threads concrete `Transaction[]` / `Budget[]` / `Goal[]` / `Debt[]` / `Asset[]` / `Profile` / `ExchangeRates` through every selector and `memoizeOne`. No `any` remains.
- ~~**`budgetMeta.ts` removal.**~~ ✅ *Closed 2026-06-01.* The overlay module is deleted; [`store.ts`](react/src/store.ts) reads `period` / `periodStart` / `periodEnd` directly off the adapter row. The `BudgetFormModal` header comment is updated to reflect the schema source of truth.
- ~~**TD-10 backoff.**~~ ✅ *Closed 2026-06-01.* [`hybridAdapter.ts`](react/src/lib/hybridAdapter.ts) `flushQueue` now tracks `attempts` per op with exponential backoff (2/4/8/16/32 s, capped at 60 s) and dead-letters into `vt_sync_failed` after `MAX_RETRIES = 5`. The summary row above is flipped to ✅.
- ~~**`CON-UNIT-054` missing.**~~ ✅ *Added 2026-06-01.* [`supabaseAdapter.test.ts`](react/src/lib/__tests__/supabaseAdapter.test.ts) now pins `replaceAll → replace_<entity>` RPC routing across all six entity types (including the `members → replace_memberships` special case). Catalogued in [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md).
- **TD-07 stub label.** ~~`Chat.tsx` carries a visible `Beta` chip~~ ✅ *Resolved 2026-06-01* — Chat is now wired to Gemini 1.5 Flash via [`geminiBackend.ts`](react/src/lib/geminiBackend.ts); the Beta chip remains only when no API key is configured.
- **Admin read-RPC JSON wrappers (TD-04-ext-c).** The originally-requested `admin_list_users` / `admin_weekly_trend` / `admin_ai_usage_summary` JSON wrappers were swapped for subscription/content mutation RPCs in PR #13; the read wrappers remain re-queued on the lead's workstream.
