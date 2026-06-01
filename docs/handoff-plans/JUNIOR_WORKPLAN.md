# Vyact — Junior Workplan (active, unblocked)

> Junior-facing, solutioned breakdown of the **currently actionable** work.
> Companion to [`todo.yaml`](todo.yaml) (the full index) — this doc reorders it
> around what a junior can pick up **today**.
>
> **Waves 0 & 1 are PARKED** — they depend on the Google OAuth provider being
> configured in the Google Cloud Console + Supabase dashboard (a human/founder
> step that is currently blocked). See the **Parked** section at the bottom; do
> **not** start those until the provider is live.
>
> **Live state (2026-06-01):** consumer **v7.0.1** `https://vyact-twentyx.vercel.app` ·
> admin **v1.1.0** `https://vyact-admin.vercel.app` · Supabase `dmxqkvploojokffuhxnz`
> (18 migrations reconciled) · repo `github.com/Authen27/Vyact`.
>
> **Safe key:** 🟢 junior solo · 🟡 junior implements, senior reviews the diff · 🔴 senior/human only.
>
> **Definition of done (every item):** `node scripts/automation-run.mjs` green
> (10/10 jobs, all scenarios); new logic carries a **TS-ID + `docs/TEST_SCENARIOS.md`**
> entry; `VERSIONS.md` + the app `CHANGELOG.md` updated and `package.json` bumped
> if it's a release; no `service_role`/secret key ever committed.

---

## Start here (pick-up order)

The 🟢 housekeeping items (**A3, A4, A5, A6**) are fully independent — start any of
them immediately. Do the data/product items (**A1 → A2**) with the senior, in that
order. Do **A7 (E2E)** last because it needs A1/A2 to exist.

Critical path: **A1 (recurring) → A2 (notifications) → A7 (E2E)**.

---

## ACTIVE — Wave 2 (data & product)

| # | Item | Safe | Problem | Solution (steps) | Done-when |
|---|---|---|---|---|---|
| **A1** | Unify `transaction.recurring` with the `RecurringSchedule` engine | 🟡 senior+junior | Two parallel recurrence models drift; Planner counts wrong; re-running the engine can double-create occurrences. | **Senior:** apply the already-drafted migration `supabase/migrations/20260530000000_recurring_unification.sql`, then run `get_advisors` (security+performance). **Junior:** in the recurring engine — (a) add an **idempotency guard** so an occurrence already materialised is never recreated; (b) honour the `autoConfirm` flag; (c) fix the Planner "upcoming" count. | Running the engine twice creates **zero** duplicates; Planner upcoming-count matches reality; advisors clean. |
| **A2** | Real, deduplicated notifications (bell shows live data) | 🟡 senior-spec, junior-build | `lib/notifications.ts` is append-only and currently fires on demo data — the bell isn't trustworthy. | **Senior specs the reconcile/dedupe/expire algorithm first.** Then **junior** implements MVP alert types — `budget_threshold`, `upcoming_bill`, `missed_payment`, `goal_milestone`, `low_balance` — each with a stable idempotency key so re-renders don't multiply them. Depends on **A1**. | Bell shows live, non-duplicated alerts off real data; reload/re-render does not duplicate; expired alerts clear. |
| **A8** | TD-21 — RLS performance | 🔴 senior | 21 policies re-evaluate `auth.<fn>()` **per row**; 51 overlapping permissive policies; 12 unindexed FKs. Invisible now, degrades at scale; compounds with TD-06. | **Additive migrations only.** Wrap `auth.uid()` → `(select auth.uid())` in flagged policies; consolidate overlapping permissive policies per `(role, action)`; add the 12 FK indexes. `get_advisors` after **each** batch. Pair with TD-06 (pagination). | Advisor `auth_rls_initplan` + `multiple_permissive_policies` counts → ~0; **no behaviour change**. *(Senior-owned; listed for visibility — not a junior task.)* |

## ACTIVE — Wave 3 (quality & housekeeping — junior-friendly)

| # | Item | Safe | Problem | Solution (steps) | Done-when |
|---|---|---|---|---|---|
| **A3** | Write `OPERATIONS.md` | 🟢 junior | No single DB-ops runbook. | Document: `node scripts/db-migrations-check.mjs --fix`, `supabase db push --include-all`, `pg_dump` backup, restore-to-staging, and a pre/post-deploy checklist. Commit `OPERATIONS.md` at repo root. | A reviewer can run a migration + a backup/restore from the doc alone. |
| **A4** | Finish `// FinFlow` → `// Vyact` comment cleanup | 🟢 junior | ~319 stale `// FinFlow vX.X` header comments remain in `.ts/.tsx`. | Replace `// FinFlow` → `// Vyact` in **source files only**. **Do not** touch `VERSIONS.md`, CHANGELOG entries, or historical docs. | `npm run lint` + build clean; zero functional diff. |
| **A5** | Branch / Dependabot / TD cleanup | 🟢 junior | Stale branches + ~10 Dependabot PRs + unfiled TDs. | Prune merged branches (`design-money-typography-standardize`, `td-08-td-09-*`, `td-20-*`, `hotfix-*`, `release/consumer-v6.6.0`). Merge/close the ~10 Dependabot PRs per group (test each). File GitHub Issues with estimates for **TD-06, TD-14, TD-07, TD-16, TD-02**. | Branch list pruned; Dependabot queue empty; 5 TD issues filed. |
| **A6** | Hard-cut legacy `ff_` localStorage keys *(due 2026-09-01)* | 🟢 junior | The `ff_`→`vt_` compat shim still write-backs; the 90-day window expires. | Remove the `ff_` write-back in `localStorageCompat.ts` `setString()` (keep the read shim if still needed for stragglers, or drop entirely if past window). Ship as a **patch** bump. | After deploy, no `ff_` keys are written; existing `vt_` users unaffected. |
| **A7** | Stabilize + extend the E2E suite | 🟢 junior | New flows uncovered; QA work-in-progress is sitting in **3 git stashes**. | `git stash list` → resume the 3 stashes. Add coverage for: Pulse empty-state (`— / No data yet`), the always-visible Google button, reset-without-email fallbacks, and `vyact_*` export filenames. Every spec gets a **TS-ID + `docs/TEST_SCENARIOS.md`** entry (the reconciler gate enforces parity). Depends on **A1, A2**. | `automation-run.mjs` 10/10, all scenarios green; catalog ↔ code in lock-step. |

---

## PARKED — Wave 0 & 1 (blocked on Google OAuth provider)

> Do **not** start these until the human/founder completes the Google Cloud
> Console + Supabase provider configuration. They are the OAuth critical path and
> are blocked end-to-end by that one dashboard step.

| # | Item | Safe | Why parked | Unblock trigger |
|---|---|---|---|---|
| **P0.1** | Admin least-privilege lockdown (gate before any OAuth) | 🔴 senior | Its whole purpose is to land *before* the Google provider goes live so a new Google user can't self-escalate. Pointless to rush while OAuth is blocked — but it **must** ship in the same change-window that 1.1 is enabled. | When the founder is ready to enable Google → do this **first**. |
| **P1.1** | Configure Google OAuth provider (Console + Supabase) | 🔴 human | The blocking dependency itself. | Founder unblocks Google Cloud Console. |
| **P1.2** | Wire the Google sign-in call (UI is already primary CTA in v7.0.1) | 🟢 junior | v7.0.1 already shows the Google button as the primary CTA with a **"coming soon" toast**; the real `signInWithOAuth` call can't be tested until P1.1 is live. | After P0.1 + P1.1: replace the coming-soon toast with `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: <APP_URL>/auth/verified }})`, remove the `isCloudEnabled` guard, add an error state, and handle the `/auth/verified` return. |

> **Note on A1 vs. the wave numbering:** `recurring_unification` was filed under
> "Wave 1" in `todo.yaml`, but it has **no Google dependency**, so it's promoted
> here into the active set as **A1**. If you prefer to honour the wave-skip
> strictly, it's the only Wave-1 item safe to pull forward.

---

## Deferred (human/founder — not engineering-blocking)
`domain_registration` (vyact.com/.app/.io + variants) and `trademark_clearance`
(classes 9/35/36/42) — parked per founder decision 2026-06-01.

---

## Working agreement (read before your first PR)
1. **One logical change per PR/commit.** Gate green (`automation-run.mjs`) before pushing.
2. **Tests carry a TS-ID** (`{APP}-{LAYER}-{NNN}`) catalogued in `docs/TEST_SCENARIOS.md`.
3. **Schema is additive** through `supabase/migrations/`; regenerate the snapshot with
   `db-migrations-check.mjs --fix`; run `get_advisors` after any DDL.
4. **Deploy = push to `main`** (see `DEPLOY.md`). A green Actions run is *not* proof —
   verify the live URL serves the new bundle and is DB-connected.
5. **Never** hardcode the `service_role`/secret key; **never** push without being asked.
6. When in doubt on a 🟡/🔴 item, **stop and ask the senior** — don't guess on schema,
   RLS, or auth.
