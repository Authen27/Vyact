# Environments & domain map

Where each build runs and which database it talks to. Treat this page as the source of truth; older docs
that mention the `bhushandandolus-projects` team or `vyact-twentyx.vercel.app` are historical.

*Written 2026-09-28 (from closed PR #128); corrected 2026-09-29 for v10.49.0–v10.50.0.*

| Environment | Git branch | Consumer app | Admin app | Supabase project | Access |
|---|---|---|---|---|---|
| Production | `main` | https://vyact.app | https://admin.vyact.app | `vyact` (`dmxqkvploojokffuhxnz`) | Public |
| Pre-production (stage) | `staging` | https://stage.vyact.app | https://stage-admin.vyact.app | `vyact-test` (`xdbfzwltqocyljbgztmv`) | Vercel login (team only) |
| Development | `develop` | https://dev.vyact.app | https://dev-admin.vyact.app | `vyact-test` (`xdbfzwltqocyljbgztmv`) | Vercel login (team only) |

- **Hosting:** Vercel team `authen27` (Hobby) — projects `vyact` (consumer) and `vyact-admin` (admin), both
  deploying from `Authen27/Vyact`. 308 redirects: `www.vyact.app` and `vyact-twentyx.vercel.app` →
  `vyact.app`; `vyact-admin.vercel.app` → `admin.vyact.app`. Deployment Protection = Standard on both
  projects (every preview needs a Vercel login; production domains stay public).
- **Who deploys what (1 Oct 2026):**
  - **The apps** are deployed only by Vercel's GitHub connection above.
  - **The Actions `Deploy` workflow** only applies Supabase migrations and deploys Edge Functions. Its
    old consumer/admin jobs published to `bhushandandolus-projects`, never to vyact.app, and were removed.
  - **Nothing makes the app wait for its migration.** A schema change ships as its own PR before the
    app change that needs it.
- **DNS:** GoDaddy hosts DNS for `vyact.app`. Apex A record and the `www`, `admin`, `stage`, `dev`,
  `stage-admin`, `dev-admin` CNAMEs point at Vercel. **Never edit the GoDaddy email records**
  (MX / SPF / DKIM / DMARC). Google Search Console: Domain property `vyact.app`, verified by TXT record.
- **Env vars:** production uses `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (All Environments) and
  `VITE_APP_URL` (Production) on `vyact`; admin production reads the committed `admin/.env.production`.
  Stage/dev use **Preview, branch-scoped** overrides (`staging`, `develop`) on both projects pointing at
  `vyact-test`. The anon key is type *Config* — public by design; **never put the `service_role` key in a
  `VITE_` variable.**
- **Previews of any other branch never touch production data (v10.49.0).** A Vercel preview with no
  Supabase env of its own builds **local-only** (`react/vite.config.ts` preview guard). Pointing those
  previews at `vyact-test` needs the Vercel **Preview** env set to it (owner action, master-todo #42).
- **`vyact-test` is shared** by stage, dev and CI E2E Lane B (`e2e/lane-b/env.ts`; `@vyact.test` fixture
  accounts — **do not wipe**). Free plan: auto-pauses after ~7 idle days. Auth: Site URL
  `https://stage.vyact.app`, redirect allow-list has the four stage/dev domains. Google sign-in is **not**
  enabled there yet. Edge functions deploy there with **Deploy test functions**
  (`.github/workflows/deploy-test-functions.yml`, v10.49.0); their secrets (WhatsApp, web push, AI) must be
  set on `vyact-test` first (owner action, #41). Schema at parity with production as of 2026-09-28, except
  the four `_backup_*` tables, which intentionally stay production-only.
- **Non-production DB pipeline:** `.github/workflows/nonprod-db.yml` exists on `staging` and `develop` only
  (GitHub environment `nonprod-database`; secrets `SUPABASE_ACCESS_TOKEN`, `NONPROD_SUPABASE_DB_PASSWORD`;
  a guard step refuses the production project ref). **Status: ON HOLD — do not extend it or merge it to
  `main` until the product owner says so.**
