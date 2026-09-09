# Corrective Review And Handoff

Reviewed specialist commits `6d13454`, `5104ccb`, and `6134ed9` on
`fix/vite-artifact-and-cache-isolation`. These changes are retained.

## Specialist Review

- The generated Vite config was removed and TypeScript emit redirected away
  from the maintained config. This corrects the shadow-config failure.
- The cache purge now reaches IndexedDB and session initialization awaits it.
  Twenty focused cache/storage/ordering tests passed in this review.
- The release note explains the Pulse change and the catalogue was reconciled.
- The latest automation report explicitly excludes E2E. Its PASS must not be
  represented as browser or cloud workflow approval.
- Two remaining cache defects were reproduced with the actual HybridAdapter:
  delayed deltas bypassed the generation guard, and current chat/cursor key
  shapes survived purge. Both are corrected in this working tree.
- Generation changes during purge, concurrent session transitions, profile/rate
  responses, service-worker cache reads, and cross-tab isolation still require
  broader lifecycle tests. No complete privacy guarantee is claimed here.

## Corrective Work

- Loan accounts initialize with the existing negative liability. The real
  store-to-IndexedDB test proves an 8000 loan paid down by 500 leaves 7500 owed.
- A forward migration validates the payment against the locked debt, checks
  membership before duplicate lookup, binds operation IDs to request identity,
  computes debt/log/strategy fields server-side, and returns authoritative rows.
- The client adopts those rows without duplicating transaction IDs. The editor
  retains its operation ID across failed submissions. Cloud mode no longer
  falls back to sequential offline loan writes.
- Individual loan-payment legs cannot be edited/deleted through generic store
  CRUD. A complete server-enforced reversal command remains open.
- Net worth retains archived owned value, values openings in account currency,
  and treats a positive card balance as credit rather than debt.
- Outbox enqueue/claim/acknowledgement now wait for IndexedDB transaction commit.
  Unknown owners are quarantined; dead-letter retry does not reassign ownership.
  The flusher drains new work and schedules backoff/lease retries. Tests execute
  real IndexedDB semantics, including abort and competing-claim cases.
- A stored failing permissions screenshot showed a displaced dialog form.
  The inner form no longer starts translated outside its panel. Store-opened
  dialogs explicitly restore opener focus. Desktop/mobile checks were performed
  in the integrated browser; a repeatable Playwright spec was added.

## Evidence And Limits

The latest combined consumer unit run recorded 880 passed, 2 skipped, 0 failed,
including the concurrently added category tests. Consumer typecheck passed. SQL tests use PGlite
with the actual original and corrective loan migrations and a focused schema
fixture. They include retries, authorization, stale reductions and client/SQL
parity for ordinary/part payments in USD and JPY. This is real SQL execution,
but not full Supabase/RLS/production-schema validation.

Existing browser failures are not all harmless stale selectors. The saved
permissions screenshot shows a real modal defect. Other tests still assume
retired sidebar/Planner controls or localStorage-only persistence. Triage each
failure by its assertion and page evidence; do not waive the entire suite.

## Release Blockers Still Open

- Run corrective migration and authorization tests on the disposable Supabase
  preview database. Do not deploy on the strength of regex validation.
- Existing incorrectly initialized loan accounts need an explicit reconciliation
  plan. This migration does not silently rewrite historical financial rows.
- Durable recovery/confirmation delivery for WhatsApp, sender identity and
  status/unlink integration remain unfinished; no webhook completion is claimed.
- Full browser matrix, complete payment reversal, session races, cross-tab
  outbox migration with old clients, and transactionally durable dead letters
  remain required acceptance work.
- The 17 npm audit advisories reported during dependency installation need
  separate dependency triage; no automatic major-version upgrade was attempted.

No production SQL, push, or deployment was performed. The corrective changes
are being preserved as a local review checkpoint, not a release approval.

## Coordination Note

Category changes appeared concurrently during this review and were preserved.
The loan correction migration is `20260909140000_correct_loan_payment_contract.sql`
to avoid sharing a timestamp with the category migration. The modified
automation index is also preserved. Do not stage all work blindly: review the
two workstreams separately.

The focused Playwright runner passed the new dialog regression (desktop and
mobile in one test). Consumer typecheck, lint (warnings remain), and catalogue
checks passed. The production build did not yield a confirmed completion and
was interrupted; it remains unverified in this pass. The full old Lane A suite
is not declared green.

At the last corrective-run check, the migration snapshot was synchronized with
68 migrations and version drift passed. Corrective test IDs occupy CON-UNIT-900
through CON-UNIT-918 to avoid concurrent allocation collisions. The concurrent
category catalogue initially lagged by eight entries; check the current
reconciler result rather than carrying that historical count forward.
Local raw reports are under
`automation-runs/local-corrective-review-20260909/`; early failing reports there
are retained as reproduction evidence, not final verdicts.

## Deployment Specialist: Incorporation Steps

1. This checkpoint is based on `9eca487e85a8342b166fc2de1897b90ff712af5e`
  (v10.21.0 categories), not directly on the earlier `51b9c5a` audit commit.
  The parent already contains the PGlite dependency declaration and corrective
  catalogue entries. Review the parent plus this checkpoint together; a
  cherry-pick onto an older base is not self-contained.
2. Retain the specialist's Vite emit fix and IndexedDB purge. This commit extends
  the latter with delta-response generation checks and chat/cursor key coverage.
  Do not replace those files with versions from the original audit checkpoint.
3. Apply `20260909140000_correct_loan_payment_contract.sql` to the disposable
  preview database before promoting the consumer. It follows the category
  migration at `20260909130000`, adds a request fingerprint to payment events,
  and replaces the existing 14-argument loan RPC without adding an overload.
  The new consumer requires authoritative debt/account/transaction rows in
  the response. Merely updating the client is not sufficient.
4. Validate with real authenticated preview actors: first payment, stale
  concurrent payments, same-operation retry, mismatched-operation reuse,
  cross-household denial, and foreign-currency rejection. PGlite tests execute
  SQL but use a focused schema fixture; they do not validate the full deployed
  schema, grants, triggers, or Supabase transport. Run security/performance
  advisors after applying DDL.
5. Existing incorrectly initialized loan accounts and pre-correction payment
  events are not automatically repaired. Legacy events without a request
  fingerprint fail closed on retry. Assess historical data explicitly; do not
  recreate or re-key financial rows as an automatic migration.
6. Ownerless outbox operations are retained but no longer automatically replay.
  A recovery workflow must establish their original owner; never assign them
  to the current user merely to empty the queue. Browser/multi-tab tests must
  cover old-client overlap, lease expiry, storage aborts, and retry backoff.
7. User-visible changes need release notes: cloud loan payments require online
  access; mixed-currency funding is rejected; generic edits/deletes of payment
  legs are blocked pending an atomic reversal feature; archived value remains
  in net worth; positive card balances count as credit rather than debt.
8. Run the normal full build and Lane A/Lane B release gates. The narrow dialog
  check can be rerun with `npx playwright test --config=playwright.corrective.config.ts`
  from `react/`, against an already-running local-only app at port 5181. This
  configuration does not start a server and is not the full browser matrix.

Keep webhook recovery, complete privacy/session isolation, full payment
reversal, and historical-data reconciliation open. Do not use this commit or
the previously reported green unit counts as justification to bypass those
release decisions. No automatic deployment is authorized by this handoff.

## Local Checkpoint Verification

Immediately before this checkpoint, the eight corrective Vitest files passed
43 tests with no failures or skips (loan workflow, loan SQL, loan mapper,
net-worth projection, IndexedDB outbox, legacy outbox, sync, cache boundary).
The catalogue is now green at 212 code / 212 documented scenarios. The schema
snapshot was regenerated and verified against all 68 migrations. Version drift
passes for consumer v10.21.0 and admin v1.3.1. These results supersede the
earlier transient catalogue mismatch, not the remaining release blockers.

The full 880-pass unit run and one passing desktop/mobile dialog Playwright
scenario belong to the preceding corrective pass; the full browser matrix and
Supabase preview validation have not been rerun for this checkpoint. The
lockfile is included as the generated dependency update from installing PGlite;
it is excluded from Copilot inspection. Review its dependency resolutions and
root version metadata before promotion.

The pre-existing modification to `automation-runs/INDEX.md` and local raw test
reports are intentionally excluded from this checkpoint.