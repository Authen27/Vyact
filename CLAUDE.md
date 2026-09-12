# Vyact — Family Finance OS (lean guide)

> Lightweight index. **Full detail lives in [`CLAUDE-1.md`](CLAUDE-1.md)** — read it
> for the complete architecture narrative, feature list, file tree, and history.
> New session? Start with [`docs/HANDOFF.md`](docs/HANDOFF.md).
>
> (Renamed 2026-07-24: the former monolithic CLAUDE.md is now CLAUDE-1.md; this
> file holds only the load-bearing, binding bits.)

## What this repo is

Three independently-versioned deliverables:
- **Consumer (React)** — `react/`. Vite + React 18 + TS + Tailwind + Zustand + Recharts.
  **v10.33.1**. Live: **https://vyact.app**. Cloud (Supabase) is
  opt-in — **without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` it runs
  localStorage-only** (single anon household, no auth). Both modes share the
  `DataAdapter` interface.
- **Admin** — `admin/`. Separate Vite+React+TS app, Claude native theme. **v1.3.2**.
  Live: **https://admin.vyact.app**.
- **Database (Supabase)** — `supabase/migrations/` is the source of truth,
  auto-applied by `deploy.yml` (`supabase db push`). Live project
  `dmxqkvploojokffuhxnz` (name "vyact"). The vanilla shell was archived in v7.0.1.

**Deploys:** every push to `main` deploys (see [`DEPLOY.md`](DEPLOY.md)). The older
`react-taupe-xi` / `finflow-admin` URLs are orphaned on a different account — don't use.

## Versioning (CI-guarded)

Authoritative changelogs: [`VERSIONS.md`](VERSIONS.md) (master index),
[`react/CHANGELOG.md`](react/CHANGELOG.md), [`admin/CHANGELOG.md`](admin/CHANGELOG.md).
`scripts/version-drift-check.mjs` fails the build if the version drifts across
README / VERSIONS / CHANGELOG / package.json — bump all together. Dated
per-version history is archived in [`docs/HISTORY.md`](docs/HISTORY.md).

## Binding conventions (violating one is a regression)

- **Money model — the gate.** Accounts hold real balances; every transaction
  moves an account; the dashboard is two numbers (Cash Flow + Net Worth).
  **If an implementation would make any number untrue, STOP.** Transfers AND
  investments are one spend/income-**neutral** row with no category. A transfer
  sets both account FKs. **An investment (v10.26.0) moves money between an
  ACCOUNT and an investment ASSET in Net Worth** — buy: `account_id` +
  `asset_id`; withdrawal: `to_account_id` + `asset_id` (`ck_txn_accounts_by_type`).
  An investment asset folds like an account: live value = `value` (opening) +
  buys − withdrawals + `valuation_offset`; "Update value" moves the offset with a
  dated `valuation_log` entry, never `value` and never a transaction. There are
  no live `kind='investment'` accounts (`ck_account_no_live_investment`); legacy
  two-account rows in old caches still fold, and an asset with live buys cannot
  be deleted. Reconciliation is an account **offset + dated log, never a
  transaction** (and bridges the stated value to the linked Asset/Debt).
  `loan_emi` is a SYSTEM_SPLIT (visible interest expense + system principal
  transfer into a `kind='loan'` account). Categories are **type-scoped**
  (`CATEGORIES_BY_TYPE`). **The gate is the test suite:**
  `lib/__tests__/moneyModel.{invariants,regression,engines}.test.ts` + the golden
  file — keep green, update the snapshot deliberately. **It is not "INV-1..9".**
  The test labels run off-by-one from the spec past INV-4 (the mapping is in the
  invariants file's header), so the gaps at 4 and 8 are a labelling artefact, not
  missing coverage. What IS missing is spec **INV-7 (atomicity)** — force-fail a
  leg of an EMI or transfer and the whole event must roll back. Nothing asserts
  that; it is the open "atomic reversal" blocker.
- **Categories are type-scoped, and the set exists in THREE places (v10.21).**
  `constants.ts` is the source, but `_shared/whatsapp-parser.ts` and
  `_shared/agent/types.ts` each hold their own allowlist because they are Deno
  modules that cannot import it. **Adding or removing a category means editing
  all three** — CON-UNIT-161/162 fail if they drift. Drift is silent: a category
  the app offers is rejected as unknown and the expense lands in other.
  A retired id (`transport`, merged into `travel`) is **never deleted from**
  `NEEDS_WANTS_MAP` **or** `LEGACY_CATEGORY_ALIASES` — stored rows and lagging
  caches still carry it, and dropping it silently removes those rows from the
  needs/wants split. Every offered category MUST have a needs/wants entry.
  🔴 **`category_classifications` OVERRIDES `NEEDS_WANTS_MAP` at runtime** in cloud
  mode (`lib/categorization.ts`), so a code-level need/want default can be
  silently reverted by a stale row. v10.21.0 shipped `travel: need` while the
  DB still said `want` from May — the change was not in effect in production
  until the row was corrected. Change the constant AND the row, or the app
  disagrees with itself and nothing says so.
  Renaming a category in the DB is a **merge, not an UPDATE**:
  `budget_allocations` is unique on `(budget_id, category)`, so a budget holding
  both ids collides and aborts the migration. Sum them; keep `category_prev`.
- **Budget identity lives in the DB** — one per `(household, scope, period)`,
  enforced by `uq_budget_month/annual` + `upsert_budget(_with_allocations)` RPC
  (the single writer). Never put budget identity on the client. Create is online
  and raises `BUDGET_EXISTS`. A NOT-NULL column with a DB default is written as
  its default or **omitted**, never explicit `null` (`?? undefined`).
- **Cash in Hand identity lives in the DB too (v10.23.0)** — exactly one live
  cash account per household (`uq_account_cash_per_household`, archived
  included), created only by `ensure_cash_account`. Every cash account encodes to
  the same literal `'cash'` ledger key, so a second one double-counts every cash
  transaction. **In cloud mode the store never inserts a cash account** — it asks
  the RPC. The old client check read a store that had not hydrated yet and wrote
  duplicates, in USD because `profile.baseCurrency` is `'USD'` until the profile
  loads. Cash can be renamed but never deleted or archived.
  **Account currency is the household's** — the form has no currency field; a
  trigger stamps `households.base_currency` on every account write and a base
  currency change relabels every account. One default account per household
  (`uq_account_default_per_household`); marking a new default clears the old one
  in the same statement.
- **The Accounts screen holds spendable accounts only (v10.24.0)** — Cash in Hand
  has a standalone summary with direct reconciliation; Bank and Credit Card are
  separate groups. Cash remains in aggregate spendable totals and retains its
  existing bank-compatible history-move rules. Loans live in Debts, investments in Net Worth.
  **A card stores its limit and cycle days, never its outstanding** — outstanding,
  available and utilisation are derived from the limit and the ledger balance
  (`lib/accountsView.ts`); "available limit" is typed once, to seed the opening
  balance, and a disagreeing statement afterwards is a reconcile. **Deleting an
  account is decided by the database** (`account_dependencies` →
  `delete_account` / `move_account_and_delete`): refused while anything refers
  to it; a move re-tags transactions + schedules within the same group and folds
  the source's opening balance + offset into the destination, so no balance,
  category total or net worth moves. Reconcile stamps `last_reconciled_at` even
  with no drift, which is what clears "not reconciled in N days".
- **Payment modes, like categories, exist in THREE places (v10.25.0)** —
  `PAYMENT_MODE_LABEL` in `lib/accountsView.ts` (the client source), and the
  Deno allowlists `PAYMENT_MODE_IDS` in `_shared/whatsapp-parser.ts` and
  `_shared/agent/types.ts`, plus the `ck_account_payment_modes` /
  `ck_txn_payment_mode` CHECKs. The parity tests in `whatsappParser.test.ts`
  fail on drift. `transactions.payment_mode` is **descriptive only** — no balance,
  total or net-worth figure reads it — and is NULL for legacy rows, imports and
  every investment. A mode the paying account does not use is **dropped, never an
  error**, in the store and in `whatsapp_log_transaction` alike, so a recurring
  post never fails because a mode was later removed from its account.
- **Financial category selection (v10.27.1)** uses `components/ui/CategoryPicker.tsx`: one
  select-only native `Select` matching Add Debt -> Type, with icon + full-label
  metadata from `constants.ts` and
  type-scoped options from `lib/categoryOptions.ts`. Use it for transaction,
  recurring and split forms and transaction filters; no separate category tiles
  or editable category inputs. Filters may include All categories;
  transfers/investments have no category picker. Budget allocation amount rows
  and chart legends retain icon + label display, not selection controls.
- **Fixed-choice dropdowns (v10.27.1)** — all consumer fixed-choice dropdowns use `Select` from `components/ui/Input.tsx`.
  No typed custom values or separate editable combobox. Short mode/period choices
  may remain segmented; names, notes, amounts and invite emails are input fields.
- **Accounts is a permanent Plan route (v10.27.0)** for every household template. Its
  navigation visibility must not depend on the retired Money Map rollout flag.
- **Entity forms are routed pages (v10.28.0)** — Add/Edit Transaction, Split, Debt,
  Budget, Account, Asset and Reconcile Account are focused full-screen routes
  (`lib/formRoutes.ts` → `pages/FormPages.tsx`, rendered outside `<Layout>` in a
  `ui/FormPage`). Callers use the store's `openAdd*/openEdit*`, which navigate
  (an Ask Vyact seed travels as router state); never spell a form URL. Close =
  history back, else the list screen; edit routes snapshot the entity once.
  Goal modals and the non-form sheets (recurring schedule, household, filters,
  delete guard) stay store slots / `HalfSheet`.
- **Store is sliced (TD-25)** — `store/index.ts` is a thin composition root;
  logic lives in `store/slices/` (modal, reconcile, notify, recurring, cloudAuth,
  sync, data, crud). Keep `useStore`'s public type/behaviour byte-identical when
  refactoring; verify against the money suites.
- **Sync is refresh-based** (visibility/focus/online + poll, not a live socket).
  Queue mechanics in `lib/sync/`; faults via `lib/faults.ts` — **never a silent
  write-loss `catch {}`** on a write/contract path.
- **The local store is a CACHE, and the cloud is the truth (v10.20.7, corrected
  in v10.20.8).** `lib/cacheInvalidation.ts` drops it at the session boundary
  when it cannot be trusted — a different user, or an older `CACHE_EPOCH`.
  **Bumping `CACHE_EPOCH` is the reset lever** for any server-side cleanup,
  because otherwise devices re-upload what you just deleted. The **pending write
  queue is never dropped** (that would be data loss); device prefs and
  `last_cloud_hid` also survive. Sign-out clears the cache — a signed-out device
  must not hold the last user's ledger.
  🔴 **The cache lives in IndexedDB (`kvStore`, DB `vyact`), NOT localStorage** —
  `kvSet` deletes the localStorage copy after a successful IDB write. v10.20.7
  purged only localStorage, so it cleared nothing in a browser, and its unit
  tests passed because vitest runs in node with a localStorage polyfill and no
  IndexedDB. **Any test touching the cache must import `fake-indexeddb/auto`**,
  or it pins the fallback path and reports a guarantee that is not delivered.
  The purge is **async and must be awaited before hydration**, and it bumps a
  **cache generation** that `HybridAdapter.applyCloudList` checks — otherwise a
  cloud read already in flight writes the previous session's rows straight back
  into the cache you just cleared. The outbox is a separate database
  (`vyact_outbox`), which is what keeps unsynced writes structurally safe. **Never add a migration that RECREATES rows from other rows.**
  `backfillSchedulesFromTransactions` did exactly that and could not tell a
  deliberate deletion from a legacy gap, so deleting a recurring schedule and
  reloading brought it back for ~2 years; it was unwired in v10.20.7 along with
  the v10.20.5 re-key, and both were **deleted outright in v10.22.2** — an
  exported resurrection writer with no callers and no tests is worse than one
  that is either tested or gone. A delete is final; do not reintroduce them.
- **Onboarding** is owned by the household (`households.onboarding` jsonb +
  localStorage cache); no-op when `isOnboardingEnabled()` is false. **Honest
  data is non-negotiable:** any value with `confidence !== 'confirmed'` renders
  `<EstimatedTag/>`; never auto-overwrite a user value without an explicit tap.
  (v10.13: onboarding now also wires take-home → Cash opening balance + recurring
  paycheck, bills → approval-gated recurring expenses + a join-month budget.)
- **Ask Vyact is MODEL-BACKED (v10.20)** — the deterministic `RulesBackend` was
  REMOVED; `LlmBackend` is the only backend and there is no rules fallback.
  **The assistant phrases; services compute** — stage 4 (`resolve`) was NOT
  removed and is still the sole source of every figure. The model picks the
  intent (stage 3) and words the answer (stage 5); it never does arithmetic on
  money. That rule is backed mechanically by `assertNoInventedFigures`
  (`askVyactLlm.ts`): a reply carrying a money-shaped figure no tool produced is
  DISCARDED, not shown. **Do NOT describe that guard as proof every figure is
  correct** — it matches numeric TOKENS, not meaning, and exempts small counts
  (`HARMLESS`), so a right number with the wrong sign, unit or framing passes.
  UI copy overstated this in v10.20 and was corrected in v10.20.1; the honest
  end state is structured facts rendered by the UI, with the model only
  explaining them. **With no model configured or reachable, Ask Vyact
  returns an explicit unavailable turn — it must never silently degrade to a
  canned answer.** The provider key lives server-side in the `ask-vyact` Edge
  Function; the browser-direct Gemini client, `ChatBackend`, `StubChatBackend`,
  `SupabaseChatBackend` and the `SubAgent` registry were all retired with it.
- **Agent = an INDEPENDENT SERVICE, never a second app** (v10.19+, in build).
  📖 **Working on the agent? Read [`vyact-agent-architecture.md`](vyact-agent-architecture.md)
  and stop there — it is self-contained by design.** Do NOT load the Aurora design
  system, Insights, onboarding or the admin CMS to build agent features; that
  doc plus the one seam you're touching is the whole context. The service owns
  `supabase/functions/ask-vyact/`, `supabase/functions/_shared/agent/`, and the
  `agent_*` / `ai_model_configs` / `ai_usage` tables, and consumes the app through
  exactly three seams: `upsertTransaction` / `whatsapp_log_transaction` (writes),
  `resolve()` + `calculations.ts` (money), `buildSafeSummary()` (the only egress
  shape). Keep that boundary — it is a token-budget rule as much as an
  architectural one.
  One Supabase Edge gateway serves every client (PWA · Android · iOS · WhatsApp)
  through **channel adapters**; only presentation and policy differ per channel.
  **SMS/receipt parsing is LLM-first with LEARNED recipes** — formats vary too
  much across banks/issuers/locales to hand-maintain templates; an extraction is
  cached by digit-masked signature so repeat formats become free and
  deterministic, and every extraction passes deterministic validator guards (the
  "available balance is not the amount" class of bug). Binding rules:
  **(1) the LLM never computes money** — it selects tools and phrases their
  returns, so stage 4 stays the sole source of figures; **(2) hybrid, not
  replacement** — rules answer first, the model runs only on a miss;
  **(3) reads/writes are separated** — the planner role holds read tools only,
  writes are **propose → user confirms**; **(4) all stored text is untrusted**
  (`transactions.description` now carries WhatsApp-ingested external text — treat
  it as data, never instruction); **(5) "learning" = context + memory, never
  fine-tuning**; **(6) providers are OpenAI-compatible** so a model swap is a DB
  row, and the feature's **off state must be provably byte-identical to today**;
  **(7) only `SafeSummary`-shaped data may egress, and only with consent.**
  Money computation the agent calls must live **server-side** (`_shared/` ports +
  Postgres RPCs) — WhatsApp has no browser — guarded by **parity tests** against
  the client TS originals. **`ai_usage` metering is the spec's LLM-spend gate**
  (§8/§10): measure adoption/cost before authorising spend.
- **Motion is one system** — framer-motion via `lib/motion.ts` tokens; global
  `<MotionConfig reducedMotion="user">`. Money animates via `<AnimatedMoney>`,
  settles with `bounce:0`, tone calm.
- **Goals & Tax are removed as modules** (since v8.8.0) — dormant type/slice kept,
  never surfaced. Pulse Score is 4 components (Budget/Savings/Trend/Debt). The Dashboard
  hides Pulse and its debt summary by default (`FEATURES.dashboard`, v10.27.0);
  Net Worth still subtracts every liability.
- **Insights Hub** — on-device For You feed adds NO financial math; card visuals
  from a CLOSED code set (icon allowlist · stat · 6 diagram primitives), never
  hosted images / LLM generation. Personal insights are never publicly shareable.
  **Two tabs since v10.29.0 (For You · Learn)** — Plan is merged into For You by
  `lib/personalInsights.ts`, which runs the planner rules and the feed over ONE
  context and dedupes by issue + period; don't re-add a Plan tab, a second
  recommendation rail, Pulse, Goals or Tax there. Empty = "Not enough recorded
  activity yet", never a health verdict.
- **Net Worth history is RECORDED, never reconstructed (v10.30.0)** —
  `net_worth_snapshots`: one row per household per month, first write wins, written
  only via `record_net_worth_snapshot` (current month, household base currency).
  Never back-fill or rebuild a past Net Worth from today's assets/debts/transactions
  (standalone assets and debts keep only their current value). The chart draws
  recorded rows only (≥2). In cloud mode record only when
  `adapter.positionIsCloudFresh()` — a cache-first read can be stale, and a stale
  first write is permanent.
- **Reports reads ONE date range (v10.31.0)** — every flow panel takes its window
  from `lib/reportRange.ts` (URL `range`/`group`, custom `start`/`end` — never
  `from`, which is the savings banner). Don't add a panel with its own window or an
  unlabelled all-time total; the household position and "this month" are the only
  current-by-design figures. Budget vs actual compares each budget over its OWN
  period by scope (`lib/budgetTrends.ts`; the current period is "in progress", never
  over/under). The runway's baseline is completed months only and is stated on
  screen (`lib/essentialRunway.ts`).
- **The bill calendar speaks the recurring engine's terms (v10.32.0)** —
  `lib/billCalendar.ts` is a read-only projection: dates from the RRULE
  (`expandRRule`), never anything before `nextDueDate`, and a status per occurrence
  (posted · posts automatically · awaiting approval · approval when due). Only the
  due occurrence AT the pointer is actionable, because `approveRecurring` refuses
  any other date. Never offer "approve early", never post from the calendar's own
  math, and hide pointers the engine will fast-forward past (`isStaleOccurrence`).
  Totals are a commitment preview, not a balance forecast.
- **WhatsApp integration — write-only logging (v10.18)** — inbound text → the
  deterministic parser (`supabase/functions/_shared/whatsapp-parser.ts`, ported
  from `askVyactParser`, NO AI / NO egress) → `whatsapp_log_transaction` RPC
  (v9 CHECK-safe: `created_by`/`member_id`, per-type account matrix; **v10.20 adds
  `p_date`** — a bank SMS is routinely BACKDATED, null => today, out-of-range clamps) → **session-text**
  confirmation (24h window → no template needed). Data queries are **hard-blocked**
  (nothing sensitive leaves over chat). Proactive templates (partner-split, budget/bill
  alerts, digests) dispatch through `whatsapp-notify`, **inert until BOTH
  `WHATSAPP_OUTBOUND_ENABLED` AND the template name in `WHATSAPP_APPROVED_TEMPLATES`**.
  RLS-locked service-role tables + Edge fns; no secrets in code. The OTP *link* flow is
  blocked on Meta business verification (its template is rejected until then).
- **Cross-household split sharing** (v10.14) — `shared_splits`/`shared_split_shares`
  key participants by **verified email** (`my_email()`, never a client-supplied
  value) so a household can't be spoofed into another's split. The owner has
  normal owner-checked CRUD; a participant has SELECT only + `settle_share()`
  (SECURITY DEFINER RPC) for self-service settling. Settle/close notifications
  are generated **locally on each side** — no cross-household writes needed,
  since RLS already lets each party read the rows relevant to them.
  (v10.16: splits are authored in a **standalone `SplitFormModal`** — removed
  from the txn form — but stay **transaction-backed** (only `yourShare` counts,
  money model unchanged); editable until a member pays/settles; emails use the
  reusable `supabase/functions/_shared/emailTemplates.ts` with a "sign up"
  variant for non-account recipients.)
- **Onboarding renders outside `<Layout>`** (v10.16) — the `/onboarding` early
  return in `App.tsx` (mirroring auth/legal routes) means no top/bottom nav
  chrome on the flow, desktop or mobile.

## Aurora design — token usage rule (binding · silent-failure class)

`index.css` has TWO token conventions. **HSL triplets** (`--coral --sage --honey
--denim --plum --terra --olive --line --line2 --bg* --ink*` …) → consume as
`hsl(var(--x))` or Tailwind classes. **Complete-value tokens** (`--canvas
--sunken --elevated --accent --neu* --rail --coral-grad --glass* --ff-*` …) →
consume as `var(--x)`. Writing a triplet raw (`border:1px dashed var(--line2)`)
is invalid CSS the browser silently drops — verify new decorative properties via
computed style, and grep before shipping:
`(?<!hsl\()var\(--(coral|sage|honey|denim|plum|terra|olive|line2?|bg\d?|ink)`.
Palette/nav/typography detail: see CLAUDE-1.md § Design System.

## DB gotchas

- **Views freeze their column list** — `select h.*` expands at creation time.
  Adding a `households` column the consumer reads through `my_households` requires
  a drop+recreate of that view (CREATE OR REPLACE can't reorder columns).
- **Validating RPCs costs nothing** — run the real function inside one `DO` block
  ending in `RAISE` → Postgres rolls back; the message carries PASS/FAIL.
  Impersonate with `set_config('request.jwt.claims', …, true)`. No paid branches.
  After any DDL run `get_advisors` (security + performance).
- **Local-only mode leaves `myRole` undefined** → the owner/admin budget guard
  blocks store-level budget writes; seed + onboarding (`saveOnboardingBudget`)
  bypass it. Verify budget writes in cloud mode, not the local preview.
- **Circular RLS policies recurse (`42P17`)** — table A's policy querying table B
  while B's policy queries A back raises "infinite recursion detected in policy".
  Fix: a `SECURITY DEFINER` helper function for the cross-table check (it runs
  as the function owner, bypassing RLS internally, breaking the cycle) — the
  established pattern (`is_member()`/`role_in()`, and `owns_shared_split()`/
  `is_split_participant()` for shared splits). A blocked **UPDATE** doesn't
  raise — it silently matches 0 rows; test with `GET DIAGNOSTICS row_count`,
  not exception-catching.

## Running

### Test inventory and CI (source of truth)

- `docs/TEST_SCENARIOS.md` and `docs/UNIT_TEST_INVENTORY.json` are generated
  from actual passing Vitest cases, not regex-matched IDs or a manual count.
  Run `npm run test:ci` at the repository root after installing both apps.
  After adding/removing/renaming tests, run `npm run test:inventory:update`
  and review the generated diff. Never copy a historical count into this guide.
- `scripts/test-inventory-config.mjs` classifies every test file by feature,
  availability and layer. New files must be classified; failed, skipped, TODO,
  empty or uncollected default tests fail the gate. Parameter expansions count
  as executable cases, not independent product workflows.
- `unit`/`contract-unit`, store/IndexedDB, SQL and Edge-handler integration are
  reported separately. Infrastructure tests do not prove a feature is live.
  Goals/Tax pages are removed; Saved Views is hidden; learned ingestion is not
  connected to current entrypoints. Retired recurring backfill/re-key tests
  were removed; stored-row compatibility and money invariants remain required.
- 🔴 **The e2e specs ARE type-checked now (v10.22.3) — keep them that way.**
  `react/tsconfig.json` excludes `e2e` and `src/**/*.test.ts`, so for months
  nothing compiled the Playwright suite: 68 type errors had accumulated, and each
  one surfaced only at runtime as `Test timeout of 30000ms exceeded` — an error
  naming the stopwatch instead of the cause. Two page-object bugs (`setAmount`
  clicking a keypad that no longer exists, `submitButton` matching a bare "Save"
  when the label is `Save ${type}`) accounted for a large share of Lane A on
  their own. `react/tsconfig.e2e.json` + the `Consumer · type-check (e2e specs)`
  gate close that hole; a stale spec now fails in seconds with the exact line.
  **Vitest still does not type-check `src/**/*.test.ts`** (esbuild transpiles
  only) — the same class of rot can still grow there.
- **A failing e2e test may be RIGHT.** Before fixing one, decide which it is:
  a real product defect, a stale test, or a test for a removed feature. v10.22.3
  found two INVERTED tests whose failure was the correct behaviour — TXN-FC-003
  asserted the retired `__tg` paired-row transfer encoding, and CON-E2E-012 gave
  an investment a category. Had either passed, INV-1/INV-9 would be broken.
  Retire those; never "fix" a test into contradicting the money model.
- The optional real-provider smoke runs only with `npm --prefix react run
  test:live`; default CI never spends provider tokens. Mocked Edge handlers
  are not deployed Supabase/Meta verification. See `docs/UNIT_TEST_CI_HANDOFF.md`
  for the happy-path matrix and required deployment follow-through.

```bash
cd react && npm install && npm run dev   # → http://localhost:5173
```

## Auto Mode Active

Bias toward working without stopping for clarifying questions — make the reasonable
call and keep going; the user will redirect if needed. Still fine to stop when
genuinely blocked (unclear direction, missing input, a decision only they can make).

Before any command that could discard uncommitted work (`git checkout`/`restore`/
`reset`/`clean`, `rm -rf`, snapshot restore), run `git status` first and stash
(`-u` for untracked) or commit. When staging/committing, review what's included
and double-check any file that might reveal secrets before pushing.
