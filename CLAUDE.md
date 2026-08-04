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
  **v10.16.0**. Live: **https://vyact-twentyx.vercel.app**. Cloud (Supabase) is
  opt-in — **without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` it runs
  localStorage-only** (single anon household, no auth). Both modes share the
  `DataAdapter` interface.
- **Admin** — `admin/`. Separate Vite+React+TS app, Claude native theme. **v1.3.1**.
  Live: **https://vyact-admin.vercel.app**.
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
  investments are one spend/income-**neutral** row (both account FKs set, no
  category). Reconciliation is an account **offset + dated log, never a
  transaction** (and bridges the stated value to the linked Asset/Debt).
  `loan_emi` is a SYSTEM_SPLIT (visible interest expense + system principal
  transfer into a `kind='loan'` account). Categories are **type-scoped**
  (`CATEGORIES_BY_TYPE`). **The gate is the test suite:**
  `lib/__tests__/moneyModel.{invariants,regression,engines}.test.ts` (INV-1..9 +
  golden file) — keep green, update the snapshot deliberately.
- **Budget identity lives in the DB** — one per `(household, scope, period)`,
  enforced by `uq_budget_month/annual` + `upsert_budget(_with_allocations)` RPC
  (the single writer). Never put budget identity on the client. Create is online
  and raises `BUDGET_EXISTS`. A NOT-NULL column with a DB default is written as
  its default or **omitted**, never explicit `null` (`?? undefined`).
- **Global modals via store slots** — `{entity}ModalOpen`/`editing{Entity}` +
  `openAdd/openEdit/close`; mounted once in `App.tsx`; pages call the store action.
- **Store is sliced (TD-25)** — `store/index.ts` is a thin composition root;
  logic lives in `store/slices/` (modal, reconcile, notify, recurring, cloudAuth,
  sync, data, crud). Keep `useStore`'s public type/behaviour byte-identical when
  refactoring; verify against the money suites.
- **Sync is refresh-based** (visibility/focus/online + poll, not a live socket).
  Queue mechanics in `lib/sync/`; faults via `lib/faults.ts` — **never a silent
  write-loss `catch {}`** on a write/contract path.
- **Onboarding** is owned by the household (`households.onboarding` jsonb +
  localStorage cache); no-op when `isOnboardingEnabled()` is false. **Honest
  data is non-negotiable:** any value with `confidence !== 'confirmed'` renders
  `<EstimatedTag/>`; never auto-overwrite a user value without an explicit tap.
  (v10.13: onboarding now also wires take-home → Cash opening balance + recurring
  paycheck, bills → approval-gated recurring expenses + a join-month budget.)
- **Ask Vyact** is on-device, no-LLM, deterministic (`normalise → entityExtract →
  classifyIntent → resolve → phraseResponse`). **The assistant phrases; services
  compute** — money math only in stage 4 (`resolve`), via the same dashboard
  services. Only classify/phrase sit on the swappable `AssistantBackend` seam.
- **Motion is one system** — framer-motion via `lib/motion.ts` tokens; global
  `<MotionConfig reducedMotion="user">`. Money animates via `<AnimatedMoney>`,
  settles with `bounce:0`, tone calm.
- **Goals & Tax are removed as modules** (since v8.8.0) — dormant type/slice kept,
  never surfaced. Pulse Score is 4 components (Budget/Savings/Trend/Debt).
- **Insights Hub** — on-device For You feed adds NO financial math; card visuals
  from a CLOSED code set (icon allowlist · stat · 6 diagram primitives), never
  hosted images / LLM generation. Personal insights are never publicly shareable.
- **WhatsApp integration is dormant** (RLS-locked service-role tables + Edge fns;
  no secrets in code).
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
