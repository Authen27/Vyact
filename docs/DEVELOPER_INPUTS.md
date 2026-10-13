# Developer inputs — open decisions from the 2026-10-04 audit

> The owner walked through every critical/high finding of the architecture audit
> (`VYACT_ARCHITECTURE_AUDIT_2026-10-04.md`, `_FINDINGS.md`) and chose a fix for each.
> These four were **deliberately left to the developer**. Every finding that depends on one
> of them is **on hold** until it is answered (list at the end of each section).
>
> **How to answer:** fill in the `Decision:` line under each question (pick an option or write
> your own), add any constraints, and tell the owner. Nothing in these sections is being
> worked on until then.
>
> **Status 2026-10-12: all four questions are still unanswered.** They hold 12 findings, three of them high: DB-SEC-03, OPS-01 and OPS-06. The current status of every finding, and the recommended order (D8 and D10 first), are in `VYACT_ARCHITECTURE_AUDIT_2026-10-04.md` §0.
>
> Opened 2026-10-06, after v10.61.0 (W0). Remediation stages that proceed meanwhile: W1
> (authorization & data lifecycle), W3 (single sources of truth), W4 (functional money),
> W5 (Pip), W6 (medium batches) — none of them depends on these answers except where listed.

---

## Q1 · Production-only database logic (D4) — and the budget guard that depends on it (D5)

**What the audit found (DB-OPS-03, DB-SEC-04, DB-INT-04 — verified):** `supabase/migrations/` is
supposed to be the source of truth, but production holds objects no migration creates:

| In production only | Evidence |
|---|---|
| An **owner/admin guard inside `upsert_budget`** (`if role_in(h) not in ('owner','admin') then raise`) | `20260617120000_v950_budgets_owner_admin_only_plus_realtime.sql:29-36` has the guard only as a **comment** ("Applied to prod via CREATE OR REPLACE with the full body"). The only definition in the repo (`20260614140000_v933_upsert_budget_identity_authority.sql:26-41`) checks `is_member(h)` alone. `upsert_budget_with_allocations` says it "reuses upsert_budget for the owner/admin guard". |
| **RLS enabled on `migration_issues`** | TECH_DEBT TD-42 says it is RLS-enabled in prod; no migration enables it (created in `v9_txn_redesign`, `v91`, `v91_feedback` without RLS). |
| **`_backup_v9_*` tables** | Listed in `docs/ENVIRONMENTS.md` as prod-only. |

**Why it matters:** any database rebuilt from the migrations — vyact-test, a Supabase branch, a
disaster-recovery restore — lets a plain member, viewer or child **create or replace the
household's budgets**, so Lane B validates weaker authorization than production. Worse, the next
`CREATE OR REPLACE upsert_budget` written from the repo copy would **silently delete the
production guard**.

**The fix it blocks — D5, cross-household budget overwrite (DB-SEC-03, DB-INT-03, high):** in
`replace` mode, `upsert_budget` and `replace_budgets` do `ON CONFLICT (id) DO UPDATE` with no
`where budgets.household_id = h`. A member removed from household H who still holds H's budget
UUIDs can create their own household H2 and call
`rpc('upsert_budget', {h: H2, b: {id: <H's budget id>, monthly_limit: 1}, p_mode: 'replace'})` —
H's ₹60,000 budget becomes ₹1 and the row (amounts, categories) is returned to them. The fix
(scope every `DO UPDATE` to the caller's household, raise on 0 rows) has to rewrite
`upsert_budget`, which is exactly the function whose production body differs from the repo.
(`replace_budgets` is dropped in W1, so only `upsert_budget` remains.)

**Questions:**
1. Is the production owner/admin guard on `upsert_budget` intended product behaviour (only
   owners/admins change budgets — the app's permission matrix says so)?
2. May we capture production's exact definitions and commit them as a migration? One read-only
   query in the Supabase SQL editor does it:
   ```sql
   select pg_get_functiondef('public.upsert_budget(uuid,jsonb,text)'::regprocedure);
   select pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'upsert_budget_with_allocations';
   select relname, relrowsecurity from pg_class where relname in ('migration_issues');
   select tablename from pg_tables where schemaname = 'public' and tablename like '\_backup\_v9\_%';
   ```
3. Should the `_backup_v9_*` tables be kept (and documented), moved to a private schema, or dropped?

**Options:** (a) commit production's definitions verbatim as a "capture production" migration,
then fix D5 on top — *owner's original preference*; (b) rebuild the guard by hand from the
v9.5.0 comment; (c) your call.

**Decision:** _______________________________________________

**On hold until answered:** D5 · DB-SEC-03, DB-INT-03 (cross-household budget overwrite);
DB-OPS-03, DB-SEC-04, DB-INT-04 (repo ≠ prod); DB-OPS-02 (same). **No migration may
`CREATE OR REPLACE upsert_budget` or `upsert_budget_with_allocations` until then.**

---

## Q2 · Production release gate (D8)

**What the audit found (OPS-01, high — verified):** Vercel's GitHub connection publishes
vyact.app on every push to `main`, in parallel with the Actions `Deploy` workflow (migrations +
Edge Functions). Nothing makes the app wait: if CI, a migration or an Edge deploy fails, the new
app is live anyway (`deploy.yml:21-24, 58-63`; `docs/ENVIRONMENTS.md:22`). The audit found this
happened for four releases in a row while the Edge deploy was failing on a stale token.
CLAUDE.md's "schema ships before the app" rule is today enforced only by merge discipline.

**Options:**
- (a) **Vercel Deployment Checks** — Vercel holds the production promotion until the GitHub
  `Deploy` workflow (migrations + Edge) succeeds. Little extra Actions time; a Vercel dashboard
  setting (check your plan supports it).
- (b) **GitHub Actions promotes** — turn off Vercel auto-production for `main`; a final job in
  `deploy.yml` with `needs: [db-migrations, deploy-edge-functions]` runs
  `vercel deploy --prebuilt --prod`. Full control; needs a Vercel token in GitHub secrets and
  ~3–5 Actions minutes per release (budget: 2,000/month shared with Vyact-Android).
- (c) **Alert only** — keep publishing as is; add a post-deploy smoke check that alerts.

**Decision:** _______________________________________________

**On hold until answered:** OPS-01; INT-PAR-08 (the engine bundle check gating the Edge deploy);
XC-ARC-04 and DB-OPS-13 (same release-ordering class); OPS-05's admin-preview part
(ADM-09 is in the backlog anyway).

---

## Q3 · Production error reporting (D9)

**What the audit found (OPS-06, high — verified):** faults reach only `console.error`.
`setFaultTransport` (`react/src/lib/faults.ts:56`) has no production caller, the root
`ErrorBoundary` (`components/ui/ErrorBoundary.tsx:23-28`) reports nothing, and nobody checks
`cron.job_run_details` or `net._http_response` for the WhatsApp / web-push schedulers. A broken
sync, a dead scheduler or a failed send is discovered only when a user complains (TD-43's
two-day Pip outage went unnoticed).

**Options:**
- (a) **Sentry (free tier)** for the app and Edge Functions, with a `beforeSend` scrubber that
  strips amounts, descriptions, names, emails and tokens before anything leaves the device;
  email alerts. Fastest real signal; adds a processor to the Privacy page.
- (b) **Own `client_faults` table** (insert-only RPC, PII-free payload) + a pg_cron health job
  over cron/pg_net results + an admin page. No third party; alerting is DIY.
- (c) **Defer.**

**Decision:** _______________________________________________

**On hold until answered:** OPS-06; FE-PLT-09 (fault transport); DB-OPS-08 (scheduler
observability); the "report" half of FE-UIS-12 (ErrorBoundary — its chunk-load recovery and the
`__e2e__` route fix proceed in batch F).

---

## Q4 · Migration dry-run before production (D10)

**What the audit found (OPS-02, medium; DB-SEC-10; OPS-08 — verified):** a migration executes
for the first time on production (`deploy.yml` runs `supabase db push --include-all`). No CI job
replays the migrations on a scratch database, there is no automatic backup step, and the RLS
isolation suite covers 3 of ~40 tables, PR-only, against a hand-synced schema. `--include-all`
also applies out-of-order files, so "last filename wins" can be false in prod (OPS-03).

**Options:**
- (a) **PR job on migration changes only** — when a PR touches `supabase/migrations/**`, start
  Postgres with the Supabase roles (`supabase start` or a `postgres:15` service), `supabase db
  reset` all migrations in order, then run the SQL tests. ~4 Actions minutes per such PR.
- (b) **Stage-first apply** — on merge, apply to vyact-test first and promote to production only
  if it succeeds. Slower releases; exercises real Supabase.
- (c) **Defer.**

**Decision:** _______________________________________________

**On hold until answered:** OPS-02; OPS-03 (`--include-all` ordering); DB-SEC-10 / OPS-08 /
XC-ARC-13 (an RLS/RPC role × tenant test matrix needs somewhere to run). Until then every new
or rewritten SQL function ships with a focused **PGlite** test (the `loanPaymentSql.test.ts`
pattern) and is validated on vyact-test with the DO-block-ending-in-RAISE technique.
