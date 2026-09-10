# Deterministic Test CI Handoff

## Commands

Use Node 22.20.0 and install locked dependencies in `react/` and `admin/` with `npm ci`.
From the repository root:

```sh
npm run test:ci
npm run test:inventory:update
```

The first command runs inventory tooling tests and both default Vitest suites,
then checks the committed generated inventory. The second runs both suites and
regenerates the inventory after an intentional test change. Never update a
snapshot to hide a failed test. New test files require a classification in
`scripts/test-inventory-config.mjs`. No database secrets or provider keys are
needed. Default execution excludes the optional paid smoke test.

Existing `ci.yml` automation runs the app suites, then supplies those exact JSON
reports to the inventory checker, avoiding a duplicate full run. Collection,
assertion, skipped/TODO, missing-file and inventory-drift failures fail the gate.
The separate browser ID check remains in `test-scenarios-check.mjs`; browser
tests and Lane B are not counted as Vitest cases. Preserve their independent gates.

## Happy-Path Matrix

| Requested group | Executable coverage | Boundary |
|---|---|---|
| 1. Budget create/edit | `ledgerWorkflow`, `cloudTransport`, `onboardingWorkflow` | Monthly/annual create/replace, persisted allocation replacement, merged onboarding categories, Budget/Pulse/Ask projections; RPC transport mocked |
| 2. Transaction lifecycle | `ledgerWorkflow` | Real store + IndexedDB, four transaction types, edits/deletes, account movement, report neutrality and linked-asset reconciliation |
| 3. Recurring lifecycle | `ledgerWorkflow`, `recurringApproval`, `recurring` | No posting on creation; automatic/approval paths; pause/resume; exact occurrence identity; durable next date; deletion stays final after refresh with surviving historical rows |
| 4. Onboarding | `onboardingWorkflow`, `onboardingWiring`, `onboarding` | Actual orchestration with injected writes; estimated Cash, future approval-gated schedules, join-month budget, existing balance preservation |
| 5. Shared splits | `sharedSplitsWorkflow` | Actual services for create/edit/settle/close and both-side reload mapping; Supabase transport mocked, not RLS validation |
| 6. Session handoff | `sessionWorkflow`, `authTransport`, `ledgerWorkflow`, cache/outbox suites | Real auth slice + IndexedDB/outbox; prior ledger purged before mocked hydration; queued writes survive; auth/invite contracts; profile and household settings reload |
| 7. Loan completion | `loanPaymentWorkflow`, `loanPaymentSql` | Fresh cloud response adoption (mock RPC), local payoff/interest, actual loan SQL in focused PGlite schema; SQL cases independent |
| 8. Gateway and WhatsApp | `gatewayWorkflow`, `whatsappWorkflow`, `cloudTransport` | Actual Edge handlers: authentication transport, reservation before provider, metadata finalization, OTP/status/unlink, signed multi-sender webhook and confirmations |
| 9. Admin success | `roleGating`, `contentWorkflow`, `contentApi` | Tests import production route rule; real article/card/external draft/publish/read/delete and upload services with mocked transport |
| 10. Outputs | `featureOutputs` | Report date range/FX/exclusions; Planner recommendation/grouping; Insights selection/stability; notification generation/dedupe/actions |

Test file names in the table are resolved to full paths in the generated inventory.
These are bounded success-path checks, not proof that every possible workflow,
concurrency case or failure recovery path is covered.

## Fixes Exposed by Tests

- Approval-required recurring schedules were advanced without user approval.
  The engine now leaves them due; the sheet awaits an occurrence-specific store
  command before reporting success.
- Sign-out left allocations, schedules, notifications and shared splits in memory.
  They now clear with the other household ledger collections.
- A multi-sender WhatsApp batch attributed every message to its first contact.
  Each message now resolves its own signed `from` identity.
- Settings read/unlink still used frozen legacy profile columns. They now call
  authenticated `whatsapp-verify-otp` actions against server-owned identities.
- Admin permission tests duplicated the rule. App and tests now import one rule.

## Deployment Requirements and Limits

Deploy the changed `whatsapp-verify-otp` and `whatsapp-webhook` functions BEFORE
promoting the consumer that uses the status/unlink actions. Keep JWT verification
on the OTP endpoint and off the HMAC-authenticated Meta webhook. Apply the existing
identity and corrective loan migrations before testing these workflows in cloud mode.

The tests stub Supabase authentication/transport and provider/Meta HTTP responses.
They do not prove live JWT validation, RLS/grants, delivery, quota concurrency,
recovery of failed inbox rows, real provider behavior, or consent-policy compliance.
The PGlite fixture is not the full production schema. Run Lane B against the
designated test project and the browser workflows against a preview deployment.
Do not advertise these deterministic counts as release approval.

The independent ingestion/recipe implementation remains tested infrastructure,
not a live SMS/receipt feature. Legacy category aliases and stored-money compatibility
remain covered even though retired UI modules are not active. Seven obsolete
recurring backfill/re-key cases and the fake passing live-smoke marker were removed.
No user-authored browser test changes were reverted or included in this cleanup.