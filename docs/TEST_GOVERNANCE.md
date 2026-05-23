# FinFlow — Test Governance & Change Management

> How automated quality gates are run, evidenced, and tied into change management.
> Owner: Engineering. Last updated: 2026-05-22.

This document is the single source of truth for **how change reaches production safely**: every
change is exercised by automation, every run leaves a readable evidence trail, and merge/deploy are
gated on that evidence.

---

## 1. Principles

1. **No change without evidence.** Every commit that reaches `main` has at least one automation run
   with a stored, readable report linked to its SHA.
2. **Readable first.** Each run produces `report.md` a human can read in 30 seconds — verdict,
   metadata, per-gate results — before anyone digs into raw logs.
3. **Traceability.** A run is traceable to a *commit*, *branch*, *trigger*, and *author*; a change is
   traceable to a *PR*, an *issue / TECH_DEBT id*, a *CHANGELOG entry*, and the *automation run* that
   cleared it.
4. **Gates are blocking.** A failed gate blocks merge and blocks deploy. Gates are never skipped to
   "fix later".

---

## 2. The test pyramid

| Layer | Tool | Scope | Where it runs |
|---|---|---|---|
| **Static · lint** | ESLint flat config (`npm run lint`) | Both apps. `react-hooks/rules-of-hooks` as error; `exhaustive-deps`, `no-unused-vars`, `no-explicit-any` as warnings (pre-existing debt, ratcheted to errors as TECH_DEBT items land) | every run |
| **Static · types** | `tsc --noEmit` (`npm run typecheck`) | Types, both apps | every run |
| **Unit** | Vitest (`react/src/lib/__tests__`, `admin/src/lib/__tests__`) | Pure logic: consumer money/calculations/amortization/formatting; admin slug + row-mappers | every run |
| **Build** | Vite (`npm run build`) | Both apps compile & bundle (consumer also verified in local-only env) | every run |
| **E2E** | Playwright (`react/e2e`) | Critical user journeys in a real browser, local-only mode | CI + on demand (`--e2e`) |
| **Catalog** | `node scripts/test-scenarios-check.mjs` (reconciler) | Lock-step between [`docs/TEST_SCENARIOS.md`](TEST_SCENARIOS.md) (the master catalog) and the test titles in code. Fails on orphan IDs, duplicates, retired-ID reuse, or file-column drift. | every run |
| **DB migrations** | `node scripts/db-migrations-check.mjs` | Validates `supabase/migrations/` (naming, unique timestamps, non-empty files) and refuses drift between the migrations and the generated `db/schema.sql` snapshot. See [`db/MIGRATIONS.md`](../db/MIGRATIONS.md). | every run |

New code SHOULD add the cheapest test that covers it (prefer unit over E2E). Pure functions in
`react/src/lib` and `admin/src/lib` MUST have unit tests.

Every scenario added/renamed/removed MUST update the master catalog
[`docs/TEST_SCENARIOS.md`](TEST_SCENARIOS.md) in the same PR — the reconciler gate refuses any drift.

---

## 3. Every run produces a folder + readable report

Run locally or in CI via the single entry point:

```bash
node scripts/automation-run.mjs          # static + unit + builds
node scripts/automation-run.mjs --e2e    # also Playwright E2E
```

It writes `automation-runs/<UTC-timestamp>__<shortsha>/` containing `report.md` (readable),
`summary.json` (machine-readable, includes a per-scenario `scenarios.records` array with TS ID,
status, duration, file, and full failure stack on fail), `consumer-vitest.json`, `admin-vitest.json`,
optionally `playwright.json`, and `logs/<gate>.log`. It appends the run to
`automation-runs/INDEX.md` (the register, now including a scenarios cell) and exits non-zero if any
gate fails.

The readable `report.md` includes — for every run — a per-app/per-layer **Test scenarios**
summary (Consumer vs Admin × unit vs E2E, with pass/fail/total/duration), the catalog
reconciliation status, **Failure details** (full message + stack excerpt per failed TS ID), and
a complete **Pass register** (every passing TS ID with duration). This gives every run a durable,
human-readable audit trail covering both success and failure scenarios.

- **Locally:** the folder is generated on disk (gitignored) and the register row is kept.
- **In CI:** the folder is uploaded as the **`automation-run-report`** artifact and is downloadable
  from the run's summary page. The job fails (red ❌, blocking merge) if the script exits non-zero.

---

## 4. Change-management flow

```
issue / TECH_DEBT id
        │
        ▼
   feature branch ──▶ Pull Request ──▶ CI automation run ──▶ report.md (evidence)
        │                  │                   │
        │            PR template          gate: must be green
        │            checklist                 │
        ▼                  ▼                    ▼
  code + tests      reviewer approval     merge to main
                                                │
                                                ▼
                                   Deploy workflow (deploy.yml)
                                                │
                                                ▼
                                   production + CHANGELOG / VERSIONS bump
```

**Required for every change:**
- A PR (no direct pushes to `main` for substantive change). The [PR template](../.github/PULL_REQUEST_TEMPLATE.md) checklist must be completed.
- A **green CI automation run** (its `report.md` is the merge evidence).
- A **CHANGELOG** entry in the affected app and a **VERSIONS.md** timeline row, with the version bumped in code (`package.json`, `X-Client-Info`, Settings export).
- For schema/RLS changes: an additive migration applied to staging + the security advisor reviewed (see PR template).

---

## 5. Roles & ownership

| Role | Responsibility |
|---|---|
| Author | Add tests for new logic; keep gates green; complete the PR checklist; bump version + CHANGELOG. |
| Reviewer | Confirm the automation run is green and the report matches the claimed change before approving. |
| Release owner | Ensure the deploy workflow ran and production smoke-tested (cloud config present, root 200). |

---

## 6. Retention

| Evidence | Location | Retention |
|---|---|---|
| Run register (`INDEX.md`) | version control | permanent |
| Per-run report + logs | CI artifact `automation-run-report` | 90 days |
| Build artifacts (`*-dist`) | CI artifact | 7 days |
| Playwright HTML report | CI artifact `playwright-report` | 7 days |
| CHANGELOG / VERSIONS | version control | permanent |

---

## 7. What "done" means for a change

- [ ] Static + unit gates green; new logic has unit tests.
- [ ] Both apps build (consumer also in local-only env).
- [ ] E2E green (CI) for user-facing changes.
- [ ] Automation `report.md` linked on the PR.
- [ ] CHANGELOG + VERSIONS updated; version bumped in code.
- [ ] Deployed and smoke-tested (cloud config present on both live apps).
