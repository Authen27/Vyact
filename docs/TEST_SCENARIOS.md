# Vyact Test Inventory

Generated from passing Vitest assertion results by `node scripts/test-inventory.mjs --update`.
Do not hand-edit counts or file rows. Full expanded test names: [UNIT_TEST_INVENTORY.json](UNIT_TEST_INVENTORY.json).
CI runs both apps, rejects failures/skips/empty collections/unclassified files, and compares the generated inventory.
Raw results with execution timestamps are uploaded as CI artifacts under `test-results/`.

## 1. Meaning

- **available**: exposed by current source; not a production deployment assertion.
- **conditional**: needs cloud, authorization, configuration or channel activation.
- **infrastructure**: implemented/tested but not connected to a current user entrypoint.
- **unit / contract-unit**: real production logic, external I/O mocked where applicable.
- **store / storage / SQL / handler integration**: multiple real modules; PGlite is a focused schema, not full Supabase RLS. Handler tests stub DB/provider transport.
- Counts are expanded executable cases, not unique user journeys, assertions, code coverage percentages or release approval.

## 2. Scope and Maintenance

Both runners discover `src/**/*.test.{ts,tsx}`, including component tests and unnumbered/parameterized titles.
Classifications and owning functions live in [test-inventory-config.mjs](../scripts/test-inventory-config.mjs).
The optional paid provider smoke (`npm --prefix react run test:live`) is excluded from default CI and these counts.
Goals/Tax pages are removed; Saved Views is hidden. Shared math, legacy-row compatibility and removal guards remain valuable tests, not proof of those modules being live.
Learned ingestion tests remain in the infrastructure bucket; they do not imply SMS/receipt automation is connected.
Browser and real-cloud execution are separate lanes and are NOT included in Vitest totals.

## 3. Coverage Summary

**1089 passing deterministic cases in 72 files. Zero failed, skipped or TODO cases at generation.**

| App | Layer | Availability | Cases |
|---|---|---|---:|
| admin | contract-unit | conditional | 5 |
| admin | unit | conditional | 15 |
| react | contract-unit | available | 8 |
| react | contract-unit | conditional | 36 |
| react | handler-integration | conditional | 8 |
| react | sql-integration | conditional | 5 |
| react | storage-integration | available | 28 |
| react | store-integration | available | 48 |
| react | store-integration | conditional | 2 |
| react | unit | available | 265 |
| react | unit | conditional | 69 |
| react | unit | infrastructure | 600 |

### Executed Files

| File | Feature | Layer | Availability | Cases |
|---|---|---|---|---:|
| [admin/src/lib/__tests__/contentApi.test.ts](../admin/src/lib/__tests__/contentApi.test.ts) | Admin content and permissions | unit | conditional | 11 |
| [admin/src/lib/__tests__/contentWorkflow.test.ts](../admin/src/lib/__tests__/contentWorkflow.test.ts) | Admin publication | contract-unit | conditional | 5 |
| [admin/src/lib/__tests__/roleGating.test.ts](../admin/src/lib/__tests__/roleGating.test.ts) | Admin content and permissions | unit | conditional | 4 |
| [react/src/components/ui/__tests__/estimatedTag.test.ts](../react/src/components/ui/__tests__/estimatedTag.test.ts) | Estimate provenance | unit | available | 5 |
| [react/src/lib/__tests__/accountPatchSafety.test.ts](../react/src/lib/__tests__/accountPatchSafety.test.ts) | Cloud adapter contracts | contract-unit | conditional | 6 |
| [react/src/lib/__tests__/accountsView.test.ts](../react/src/lib/__tests__/accountsView.test.ts) | Accounts | unit | available | 21 |
| [react/src/lib/__tests__/agentAmbiguity.test.ts](../react/src/lib/__tests__/agentAmbiguity.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 31 |
| [react/src/lib/__tests__/agentClassify.test.ts](../react/src/lib/__tests__/agentClassify.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 13 |
| [react/src/lib/__tests__/agentDedupe.test.ts](../react/src/lib/__tests__/agentDedupe.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 36 |
| [react/src/lib/__tests__/agentGrammar.test.ts](../react/src/lib/__tests__/agentGrammar.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 24 |
| [react/src/lib/__tests__/agentPipeline.test.ts](../react/src/lib/__tests__/agentPipeline.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 18 |
| [react/src/lib/__tests__/agentRecipe.test.ts](../react/src/lib/__tests__/agentRecipe.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 34 |
| [react/src/lib/__tests__/agentRecipeStore.test.ts](../react/src/lib/__tests__/agentRecipeStore.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 13 |
| [react/src/lib/__tests__/agentResolver.test.ts](../react/src/lib/__tests__/agentResolver.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 36 |
| [react/src/lib/__tests__/agentRouter.test.ts](../react/src/lib/__tests__/agentRouter.test.ts) | Ask Vyact | unit | conditional | 11 |
| [react/src/lib/__tests__/agentValidator.test.ts](../react/src/lib/__tests__/agentValidator.test.ts) | Learned ingestion (not connected to entrypoints) | unit | infrastructure | 22 |
| [react/src/lib/__tests__/amortization.test.ts](../react/src/lib/__tests__/amortization.test.ts) | Money model | unit | available | 15 |
| [react/src/lib/__tests__/askVyact.test.ts](../react/src/lib/__tests__/askVyact.test.ts) | Ask Vyact | unit | conditional | 31 |
| [react/src/lib/__tests__/askVyactExamples.test.ts](../react/src/lib/__tests__/askVyactExamples.test.ts) | Reports and Ask guidance | unit | available | 3 |
| [react/src/lib/__tests__/authTransport.test.ts](../react/src/lib/__tests__/authTransport.test.ts) | Authentication and invitations | contract-unit | conditional | 3 |
| [react/src/lib/__tests__/budgetOrdering.test.ts](../react/src/lib/__tests__/budgetOrdering.test.ts) | Recurring and budgets | unit | available | 13 |
| [react/src/lib/__tests__/budgetTrends.test.ts](../react/src/lib/__tests__/budgetTrends.test.ts) | Reports consultation | unit | available | 4 |
| [react/src/lib/__tests__/cacheBoundary.test.ts](../react/src/lib/__tests__/cacheBoundary.test.ts) | Storage and synchronization | storage-integration | available | 2 |
| [react/src/lib/__tests__/cacheInvalidation.test.ts](../react/src/lib/__tests__/cacheInvalidation.test.ts) | Storage and synchronization | storage-integration | available | 9 |
| [react/src/lib/__tests__/calculations.test.ts](../react/src/lib/__tests__/calculations.test.ts) | Money model | unit | available | 16 |
| [react/src/lib/__tests__/categoryModel.test.ts](../react/src/lib/__tests__/categoryModel.test.ts) | Categories and ordering | unit | available | 8 |
| [react/src/lib/__tests__/categoryOptions.test.ts](../react/src/lib/__tests__/categoryOptions.test.ts) | Navigation and category selection | unit | available | 4 |
| [react/src/lib/__tests__/cloudTransport.test.ts](../react/src/lib/__tests__/cloudTransport.test.ts) | Cloud adapter contracts | contract-unit | conditional | 4 |
| [react/src/lib/__tests__/dashboardPresentation.test.tsx](../react/src/lib/__tests__/dashboardPresentation.test.tsx) | Dashboard MVP presentation | contract-unit | available | 3 |
| [react/src/lib/__tests__/essentialRunway.test.ts](../react/src/lib/__tests__/essentialRunway.test.ts) | Reports consultation | unit | available | 4 |
| [react/src/lib/__tests__/faults.test.ts](../react/src/lib/__tests__/faults.test.ts) | Permissions and faults | unit | available | 3 |
| [react/src/lib/__tests__/featureOutputs.test.ts](../react/src/lib/__tests__/featureOutputs.test.ts) | Reports, Planner, Insights, notifications | unit | available | 5 |
| [react/src/lib/__tests__/format.test.ts](../react/src/lib/__tests__/format.test.ts) | Formatting and structured content | unit | available | 11 |
| [react/src/lib/__tests__/formRoutes.test.ts](../react/src/lib/__tests__/formRoutes.test.ts) | Navigation and category selection | unit | available | 3 |
| [react/src/lib/__tests__/fxCentralization.test.ts](../react/src/lib/__tests__/fxCentralization.test.ts) | Money model | unit | available | 2 |
| [react/src/lib/__tests__/gatewayWorkflow.test.ts](../react/src/lib/__tests__/gatewayWorkflow.test.ts) | Ask gateway | handler-integration | conditional | 4 |
| [react/src/lib/__tests__/helpContent.test.ts](../react/src/lib/__tests__/helpContent.test.ts) | Help and adoption guidance | contract-unit | available | 5 |
| [react/src/lib/__tests__/learnJsonLd.test.ts](../react/src/lib/__tests__/learnJsonLd.test.ts) | Formatting and structured content | unit | available | 2 |
| [react/src/lib/__tests__/ledgerWorkflow.test.ts](../react/src/lib/__tests__/ledgerWorkflow.test.ts) | Ledger and recurring workflows | store-integration | available | 39 |
| [react/src/lib/__tests__/loanPayment.test.ts](../react/src/lib/__tests__/loanPayment.test.ts) | Cloud adapter contracts | contract-unit | conditional | 6 |
| [react/src/lib/__tests__/loanPaymentSql.test.ts](../react/src/lib/__tests__/loanPaymentSql.test.ts) | Loan SQL command | sql-integration | conditional | 5 |
| [react/src/lib/__tests__/loanPaymentWorkflow.test.ts](../react/src/lib/__tests__/loanPaymentWorkflow.test.ts) | Ledger and recurring workflows | store-integration | available | 8 |
| [react/src/lib/__tests__/money.test.ts](../react/src/lib/__tests__/money.test.ts) | Money model | unit | available | 8 |
| [react/src/lib/__tests__/moneyModel.engines.test.ts](../react/src/lib/__tests__/moneyModel.engines.test.ts) | Money model | unit | available | 9 |
| [react/src/lib/__tests__/moneyModel.invariants.test.ts](../react/src/lib/__tests__/moneyModel.invariants.test.ts) | Money model | unit | available | 13 |
| [react/src/lib/__tests__/moneyModel.regression.test.ts](../react/src/lib/__tests__/moneyModel.regression.test.ts) | Money model | unit | available | 6 |
| [react/src/lib/__tests__/moneyPortParity.test.ts](../react/src/lib/__tests__/moneyPortParity.test.ts) | Server money port parity | unit | infrastructure | 373 |
| [react/src/lib/__tests__/navigationVisibility.test.ts](../react/src/lib/__tests__/navigationVisibility.test.ts) | Navigation and category selection | unit | available | 2 |
| [react/src/lib/__tests__/netWorthProjection.test.ts](../react/src/lib/__tests__/netWorthProjection.test.ts) | Money model | unit | available | 6 |
| [react/src/lib/__tests__/netWorthSnapshots.test.ts](../react/src/lib/__tests__/netWorthSnapshots.test.ts) | Net worth history | unit | available | 7 |
| [react/src/lib/__tests__/onboarding.test.ts](../react/src/lib/__tests__/onboarding.test.ts) | Onboarding | unit | available | 16 |
| [react/src/lib/__tests__/onboardingWiring.test.ts](../react/src/lib/__tests__/onboardingWiring.test.ts) | Onboarding | unit | available | 8 |
| [react/src/lib/__tests__/onboardingWorkflow.test.ts](../react/src/lib/__tests__/onboardingWorkflow.test.ts) | Onboarding | unit | available | 3 |
| [react/src/lib/__tests__/ordering.test.ts](../react/src/lib/__tests__/ordering.test.ts) | Categories and ordering | unit | available | 5 |
| [react/src/lib/__tests__/outbox.test.ts](../react/src/lib/__tests__/outbox.test.ts) | Outbox algorithm | unit | available | 8 |
| [react/src/lib/__tests__/outboxIndexedDb.test.ts](../react/src/lib/__tests__/outboxIndexedDb.test.ts) | Storage and synchronization | storage-integration | available | 5 |
| [react/src/lib/__tests__/permissionsRole.test.ts](../react/src/lib/__tests__/permissionsRole.test.ts) | Permissions and faults | unit | available | 3 |
| [react/src/lib/__tests__/personalInsights.test.ts](../react/src/lib/__tests__/personalInsights.test.ts) | Merged personal Insights | unit | available | 10 |
| [react/src/lib/__tests__/pulseBudget.test.ts](../react/src/lib/__tests__/pulseBudget.test.ts) | Money model | unit | available | 3 |
| [react/src/lib/__tests__/recurring.test.ts](../react/src/lib/__tests__/recurring.test.ts) | Recurring and budgets | unit | available | 12 |
| [react/src/lib/__tests__/recurringApproval.test.ts](../react/src/lib/__tests__/recurringApproval.test.ts) | Ledger and recurring workflows | store-integration | available | 1 |
| [react/src/lib/__tests__/reportRange.test.ts](../react/src/lib/__tests__/reportRange.test.ts) | Reports consultation | unit | available | 6 |
| [react/src/lib/__tests__/reportsModel.test.ts](../react/src/lib/__tests__/reportsModel.test.ts) | Reports and Ask guidance | unit | available | 6 |
| [react/src/lib/__tests__/rrule.test.ts](../react/src/lib/__tests__/rrule.test.ts) | Recurring and budgets | unit | available | 10 |
| [react/src/lib/__tests__/sessionWorkflow.test.ts](../react/src/lib/__tests__/sessionWorkflow.test.ts) | Session transitions | store-integration | conditional | 2 |
| [react/src/lib/__tests__/sharedSplitsWorkflow.test.ts](../react/src/lib/__tests__/sharedSplitsWorkflow.test.ts) | Shared splits | contract-unit | conditional | 3 |
| [react/src/lib/__tests__/storage.test.ts](../react/src/lib/__tests__/storage.test.ts) | Storage and synchronization | storage-integration | available | 6 |
| [react/src/lib/__tests__/supabaseAdapter.test.ts](../react/src/lib/__tests__/supabaseAdapter.test.ts) | Cloud adapter contracts | contract-unit | conditional | 14 |
| [react/src/lib/__tests__/sync.test.ts](../react/src/lib/__tests__/sync.test.ts) | Storage and synchronization | storage-integration | available | 6 |
| [react/src/lib/__tests__/v91.test.ts](../react/src/lib/__tests__/v91.test.ts) | Recurring and budgets | unit | available | 5 |
| [react/src/lib/__tests__/whatsappParser.test.ts](../react/src/lib/__tests__/whatsappParser.test.ts) | WhatsApp parser | unit | conditional | 27 |
| [react/src/lib/__tests__/whatsappWorkflow.test.ts](../react/src/lib/__tests__/whatsappWorkflow.test.ts) | WhatsApp handlers | handler-integration | conditional | 4 |

## 4. Roster

The Vitest roster is the generated JSON above. The following historical browser IDs remain reconciled separately; presence does not mean the browser/cloud lane passed.

| ID | File | Scenario |
|---|---|---|
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
| CON-E2E-025 | `react/e2e/tests/permissions-local.spec.ts` | [PERM-FC-002] clicking "+ Add Budget" opens the budget form (a routed page since v10.28.0) | **Reachability pin.** A visible button is not a reachable editor. This is the step CON-E2E-017..023 could never perform, which is why four of the eight v10.20 defect reports sat behind a green suite. |
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
| CON-E2E-017 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-001] creates a period budget with a category allocation, starting at 0% used | Rewritten 2026-09-09 for the v9.1 container model (a budget is a period container; its limit splits into `budget_allocations` child rows). Passing. |
| CON-E2E-018 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-002] spend in a category reduces the remaining budget | Rewritten 2026-09-09 for the v9.1 container model (a budget is a period container; its limit splits into `budget_allocations` child rows). Passing. |
| CON-E2E-019 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-003] crossing the threshold fires a budget_threshold notification | **`test.fixme`** — the `budget_threshold` notification TYPE exists but nothing emits it on threshold crossing in local-only mode. Kept as a documented gap rather than a test asserting a notification the app never sends. |
| CON-E2E-022 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-006] raising the limit recomputes utilisation from over to under | Rewritten 2026-09-09 for the v9.1 container model (a budget is a period container; its limit splits into `budget_allocations` child rows). Passing. |
| CON-E2E-023 | `react/e2e/tests/budgets.spec.ts` | [BDGT-FC-007] an over-budget category shows over-budget styling | Rewritten 2026-09-09 for the v9.1 container model (a budget is a period container; its limit splits into `budget_allocations` child rows). Passing. |
| CON-E2E-040 | `react/e2e/tests/smoke.spec.ts` | tolerates corrupt localStorage payloads and falls back to clean defaults | Renumbered 2026-09-09: this test had been sharing CON-E2E-008 with `debts-payment.spec.ts`, so the catalogue could not say which scenario a result belonged to. |
| CON-E2E-041 | `react/e2e/tests/smoke.spec.ts` | primary routed pages mount without page errors | Renumbered from a collision with CON-E2E-007 (`transactions-create.spec.ts`). |
| CON-E2E-042 | `react/e2e/tests/smoke.spec.ts` | boots from legacy ff_* keys and writes back under vt_* | Renumbered from a collision with CON-E2E-010 (`transactions-create.spec.ts`). |
| CON-E2E-050 | `react/e2e/tests/budget-editor.spec.ts` | every expense category is listed, with no "add category" step | Catalogued during the 2026-09-09 reconciliation pass. |
| CON-E2E-051 | `react/e2e/tests/budget-editor.spec.ts` | a store refresh mid-edit does not wipe what you typed | Catalogued during the 2026-09-09 reconciliation pass. |
| CON-E2E-052 | `react/e2e/tests/budget-editor.spec.ts` | one row per category, so a duplicate allocation is unrepresentable | Catalogued during the 2026-09-09 reconciliation pass. |
| CON-E2E-053 | `react/e2e/tests/budgets.spec.ts` | an annual budget is accepted alongside monthly | Replaces the retired CON-E2E-020/021. `month` and `annual` are the only two scopes left, so annual is what "non-monthly" now means. |
| CON-E2E-043 | `react/e2e/tests/dialog-correction.spec.ts` | Budget form page title bounds, and focus back on its opener after closing, at desktop and mobile sizes | Playwright browser workflow. v10.28.0: the form became a routed page, so "restores focus" is now proven across a history back, not a dialog close. |

## 5. Retired IDs

Reserved permanently. Never reuse a retired ID for a new scenario.

CON-UNIT-087, CON-UNIT-088, CON-UNIT-089, CON-UNIT-090, CON-UNIT-091, CON-UNIT-097, CON-UNIT-098: removed recurring backfill/re-key tests. Both writers were DELETED from `react/src/lib/recurring.ts` in v10.22.1, not merely unwired — an exported resurrection writer with no tests and no callers is worse than either keeping it tested or removing it. Deletion is final.

Browser IDs (carried forward from the previous document; the generator never mints these):

- CON-E2E-020 — [BDGT-FC-004] quarterly budget period. The `quarterly` scope was removed from the product by `budget_scope_drop_custom`; a test for a deleted feature is not a coverage gap. Replaced by the annual-scope case in the budgets spec.
- CON-E2E-021 — [BDGT-FC-005] custom start/end budget period. The `custom` scope was removed by the same migration. Replaced by the annual-scope case in the budgets spec.
- TXN-FC-003 — transfer track creating PAIRED transfer rows. Asserted two rows per transfer, a sorted [expense, income] pair, category === transfer on both, and a __tg: note tag. All four are money-model VIOLATIONS since v9: a transfer is ONE spend/income-neutral row with both account FKs set and no category, and the __tg paired-row encoding was retired. Its failure was the correct behaviour; passing would have broken INV-1.
- TXN-FC-010 — track picker narrowing investment categories. The track picker was retired in v9 (D3).
- TXN-FC-011 — edit mode opening with the track locked and no picker. Same retired control.
- TXN-FC-012 — numeric shortcuts choosing each track. Same retired control; the surviving half (Escape closes the modal) is covered by A11Y-FC-001.

## 6. Deployment Verification

See [UNIT_TEST_CI_HANDOFF.md](UNIT_TEST_CI_HANDOFF.md) for the ten happy-path groups, mocked boundaries, commands and remaining live-environment gates.
