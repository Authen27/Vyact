# FinFlow — Session Handoff / Continuity Brief

> **Read this first in a new session.** It captures the live state, the
> non-obvious gotchas that otherwise take a lot of context to rediscover, how
> deployment actually works, what's still open, and a command cheatsheet.
> Last updated: **2026-05-30** · HEAD at write time: consumer **v6.4.27**, admin **v1.0.8**.
>
> Companion docs: [`CLAUDE.md`](../CLAUDE.md) (architecture/design system) ·
> [`DEPLOY.md`](../DEPLOY.md) (deploy mechanics) · [`VERSIONS.md`](../VERSIONS.md)
> (release timeline) · [`TECH_DEBT.md`](../TECH_DEBT.md) (TD register) ·
> [`db/MIGRATIONS.md`](../db/MIGRATIONS.md) (schema discipline).

---

## 1. Snapshot — what's live right now

| Deployable | Version | Live URL (authoritative) | Vercel project / team |
|---|---|---|---|
| Consumer (`react/`) | **v6.4.27** | https://react-three-puce-61.vercel.app | `react` · `bhushandandolus-projects` |
| Admin (`admin/`) | **v1.0.8** | https://admin-six-orpin-47.vercel.app | `admin` · `bhushandandolus-projects` |
| Database (Supabase) | reconciled (TD-20) | project `dmxqkvploojokffuhxnz` (eu-west-2) | — |

- **Consumer is DB-connected** (verified: the live JS bundle contains the
  Supabase project ref). Real auth + real data; no more local-only dummy data.
- **Admin is healthy** — renders the NorthStar dashboard on real prod data.
  Admin user: `uday.kr27@gmail.com` has the `super` role.
- Prod DB has **18 migrations** in the tracker, matching `supabase/migrations/`
  1:1. TD-08/09/13 objects are live (audit triggers, `replace_*` RPCs, budget
  period columns).

---

## 2. The gotchas that cause "context lag" (read these — they are non-obvious)

### 2a. Two different Vercel accounts are in play
- **CI deploys** to the **`bhushandandolus-projects`** team (Vercel team id
  `team_qk0fHaWkDdfdYKoEhqvx4TE9`). Its `react`/`admin` projects' production
  URLs are `react-three-puce-61` / `admin-six-orpin-47`. **These are the real
  live URLs.**
- **`react-taupe-xi.vercel.app` / `finflow-admin.vercel.app`** (what older docs
  called "live") are **orphaned on a different Vercel account** — CI cannot
  update them (`vercel alias` → "already in use", `vercel promote` → "belongs to
  a different team"). They serve **stale** builds. Ignore them. Reclaiming those
  exact hostnames needs dashboard access to that other account (a user task).
- The **Vercel MCP** connected to Claude is scoped to the user's *personal*
  account (`udaykr27-1375s-projects`), which has **no access** to the
  `bhushandandolus` team (403) and `list_teams` returns `[]`. So the MCP cannot
  inspect/deploy the live projects. Use the GitHub Actions path + the CI
  `VERCEL_TOKEN` instead (that token *does* have team access).

### 2b. Supabase client config is COMMITTED, with a PROD code-fallback
- `react/.env.production` and `admin/.env.production` hold the **public** URL +
  **publishable** key (`sb_publishable_…`). Public by design (already in the
  browser bundle; RLS enforces security). **Never** commit the `service_role`/
  secret key.
- **Additionally**, `react/src/lib/supabase.ts` and `admin/src/lib/supabase.ts`
  fall back to those public values **in production builds** (`import.meta.env.PROD`)
  when the env var is missing/empty. This was the *definitive* fix for the
  "dummy data" bug: `vercel pull` writes an empty `.env.local` that Vite ranks
  **above** `.env.production`, so the committed file alone was overridden. With
  the PROD fallback, a build with **no env files at all** still connects.
- **Do NOT** re-add `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` injection to the
  `deploy.yml` build steps — an empty secret there silently overrides everything
  (Vite shell-env precedence). The committed files + fallback are the source of truth.
- Local `npm run dev` stays local-only unless you add `.env.local` (fallback is PROD-gated).

### 2c. Deployment = push to `main` (single trigger)
- `git push origin main` → `.github/workflows/deploy.yml` runs three jobs:
  `db-migrations` (best-effort, `continue-on-error: true`) → `consumer` + `admin`
  (both `needs: db-migrations` **with `if: always()`**, so a Supabase-auth hiccup
  never blocks the app deploys). Full detail in [`DEPLOY.md`](../DEPLOY.md).
- **A green Actions run is NOT proof prod updated.** Always verify the public URL
  serves the new bundle AND is DB-connected (see cheatsheet §5).

### 2d. Environment tooling limits in this workspace
- **No `gh` CLI**; the **Chrome extension was flaky** and the user asked to stop
  using it. PR merges in this history were done via **direct `git` to `main`**
  (the "releases 1–12" pattern) or cherry-pick — that's the expected flow here.
- **GitHub Actions logs need auth (403)** and **job-level `::notice::`
  annotations get dropped**; `::warning::` is more reliable but still lossy. To
  read CI output reliably, either parse the **annotations API** or have CI write
  to a file and push a throwaway branch. Examples in §5.
- Read GitHub run status via the public REST API (repo is public) — see §5.

### 2e. Migration discipline (TD-20)
- `supabase/migrations/*.sql` is the source of truth; `db/schema.sql` is a
  **generated** concat (regenerate with `node scripts/db-migrations-check.mjs --fix`).
- The repo↔prod tracker are reconciled 1:1 (baseline `00000000000001` + 13
  historical stubs + the TD-08/09/13 set). **To add schema:** new additive file
  `supabase/migrations/<ts>_<name>.sql`, `--fix` the snapshot, run the gate, push
  (CI `supabase db push` applies it; idempotent).
- Superseded pre-PR-#16 migrations live in `db/migrations-superseded/` — **do not
  move them back** into `supabase/migrations/`.

---

## 3. Open work (next steps), highest-value first

| Item | What | Notes / where |
|---|---|---|
| **TD-21** | RLS performance: wrap `auth.<fn>()` in `(select …)`; consolidate overlapping permissive policies; index 12 FKs | filed in `TECH_DEBT.md`; pair with TD-06. Re-run `get_advisors` after each migration. |
| **TD-02** | Test governance ratchet — coverage floor + "what must be tested" gate | docs + script; lowest-risk, high trust |
| **TD-19 / Task #69** | E2E expansion + triage the flaky/uncatalogued specs | QA stream WIP is **stashed** (see §4) |
| **TD-06** | Pagination / delta sync (client pulls whole tables) | design doc + schema; scaling blocker |
| **TD-14** | IndexedDB swap (localStorage quota) | pairs with TD-06 |
| **TD-07** | AI Chat/Insights backend (currently stubs) | product decision needed (provider) |
| **TD-16** | Encrypted backups at rest | self-contained |
| **Task #60** | `logo.spec.ts` E2E baseline rename + catalog | when QA stream lands |
| polish | TD-01 opaque `Money` type; TD-12 `any[]` selector typing | pure DX |

Full register + remediation log: [`TECH_DEBT.md`](../TECH_DEBT.md). TD-01/03/04/05/08/09/10/11/12/13/15/17/18/20 are **resolved**.

---

## 4. Loose ends to be aware of (don't lose these)

- **Three git stashes hold the QA implementer's uncommitted e2e WIP** (kept out
  of the v6.4.26 release deliberately — the specs were flaky/uncatalogued):
  - `stash@{0}` — QA e2e suite WIP (on `main`)
  - `stash@{1}`, `stash@{2}` — QA/MCP working-tree noise (on `td-08-td-09-fresh-migrations`)
  - To resume that work: `git stash list`, then `git stash show -p stash@{N}`.
- **Stale local branches** can be pruned: `design-money-typography-standardize`,
  `td-08-td-09-fresh-migrations`, `td-20-*`, `hotfix-*` — their content is in
  `main` (merged or cherry-picked). The PRs they backed are superseded; close on
  GitHub if still open.
- **~10 Dependabot PRs** open on `origin` (react/admin: vite, supabase-js,
  lucide, postcss, tailwind, react). Triage separately.
- **Revoke the Supabase access token** that was pasted in chat earlier
  (https://supabase.com/dashboard/account/tokens) — the GitHub secret has its own
  copy. (If `supabase link` in CI starts failing, that's the token to refresh.)
- **`react-taupe-xi` decision** still open: keep `react-three-puce-61` as canonical,
  OR reclaim the pretty URL (needs the other Vercel account — user action).

---

## 5. Command cheatsheet

```bash
# ── Full quality gate (must be green before every push: 10/10 jobs, 64/64 scenarios)
node scripts/automation-run.mjs
# Regenerate the schema snapshot after adding a migration:
node scripts/db-migrations-check.mjs --fix && node scripts/db-migrations-check.mjs

# ── Verify a deploy REALLY reached prod (green CI ≠ live)
JS=$(curl -s https://react-three-puce-61.vercel.app/ | grep -oE '/assets/index-[^"]+\.js' | head -1)
curl -s "https://react-three-puce-61.vercel.app$JS" | grep -c dmxqkvploojokffuhxnz   # >0 = DB-connected

# ── Read GitHub Actions status (no gh CLI; public REST API)
curl -s "https://api.github.com/repos/Authen27/Finflow/actions/workflows/deploy.yml/runs?per_page=3" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{for(const r of JSON.parse(s).workflow_runs)console.log(r.head_sha.slice(0,7),r.status,r.conclusion)})"

# ── Deploy (the only trigger)
git push origin main
```

- **Supabase MCP** (works — project `dmxqkvploojokffuhxnz`): `list_migrations`,
  `execute_sql`, `apply_migration`, `get_advisors` (run security+performance after
  DDL). This is how TD-08/09/13 were applied directly when CI auth was down.
- **GitHub:** repo `Authen27/Finflow` (public), default branch `main`.

---

## 6. Working agreement / governance (how changes ship here)

1. One logical change per PR/commit; **gate green** (`automation-run.mjs`: 10/10,
   64/64) before pushing.
2. New tests carry a **TS-ID** (`{APP}-{LAYER}-{NNN}`) and are catalogued in
   `docs/TEST_SCENARIOS.md` (the reconciler gate enforces code↔doc parity).
3. Update **`VERSIONS.md` + the app `CHANGELOG.md` + bump `package.json`** for any
   release; record remediation in **`TECH_DEBT.md`**.
4. **Never** push/commit unless the user asks; **never** hardcode `service_role`/
   secret keys; financial actions (trades/transfers) are off-limits.
5. Schema changes are **additive** through `supabase/migrations/` and reconcile
   with the prod tracker; re-run `get_advisors` after DDL.
