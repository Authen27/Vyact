# Deploying Vyact

> Note: This document was updated to reflect the product rename from FinFlow to Vyact (2026-06-01). Historical references to "FinFlow" are preserved for auditability.

> 🧭 New to this codebase / fresh session? Read [`docs/HANDOFF.md`](docs/HANDOFF.md)
> first for the full continuity brief (live URLs, Vercel/Supabase gotchas, open work).

> ⚠️ **Read this top section first — it is the authoritative, current description
> of how production deploys actually work (2026-05-30). The "Step 1/2/3" guide
> further down is the original one-time setup walkthrough and is kept for
> history; some of its specifics (URLs, manual env-var entry) are superseded by
> the section below.**

## 🛑 Non-negotiable pre-push checklist (every release, without fail)

Before any `git push origin main` that bumps a version, run **all** of these — this
step is not optional and is not "when convenient":

1. Bump the version in lockstep across all four surfaces: `react/package.json`
   (or `admin/package.json`), `README.md`, `react/CHANGELOG.md` (or
   `admin/CHANGELOG.md`) banner + new dated entry, and `CLAUDE.md`'s version
   mentions.
2. Add the release to **both** tables in [`VERSIONS.md`](VERSIONS.md): the
   current-version summary row near the top, **and** the "Cross-app release
   timeline" table further down. The timeline table is a narrative history that
   `scripts/version-drift-check.mjs` does **not** check — it has silently gone
   16 releases stale before (caught and backfilled 2026-07-01). Update it by
   hand, every time.
3. Run `node scripts/version-drift-check.mjs` from the repo root. It must
   print "Version-drift check passed" before you push. If it fails, fix the
   surface it names — do not bypass it.
4. Run the full verification gate for the app(s) you touched: `tsc -b` (0
   errors) → `eslint .` (0 errors; pre-existing warnings tolerated) →
   `vitest run` (full suite; money-model invariant tests must pass) →
   `vite build` (exit 0).

This is the same gate used for every release in this repo's history — treat a
version bump without all four doc surfaces + both VERSIONS.md tables updated as
an incomplete release, not a done one.

## ✅ Current production deployment (authoritative)

Rewritten 9 Oct 2026 (W8d, audit OPS-09) from `.github/workflows/deploy.yml` and the live Vercel
projects. The earlier text here described an Actions `vercel deploy --prod` pipeline and URLs on another
Vercel account. Neither has been used since PR #140.

**Two systems deploy, both on a push to `main`:**

1. **Vercel (git-connected)** builds and publishes the apps. Each project builds from its own folder:

   | Project | Root directory | Live |
   |---|---|---|
   | `vyact` | `react/` | **https://vyact.app** |
   | `vyact-demo` | `react/` with `VYACT_DEMO=1` | https://demo.vyact.app |
   | `vyact-admin` | `admin/` | **https://admin.vyact.app** |

   - **`ignoreCommand` (W7b, fixed in W8d).** It skips a build only when the last deployed commit (`$VERCEL_GIT_PREVIOUS_SHA`) is in the checkout and nothing outside docs changed since. When it can't tell, it builds.
     - The W7b version failed with exit 128 whenever that commit was beyond Vercel's shallow clone, and Vercel treats any code other than 0/1 as a deployment **Error**.
     - That stopped every admin production deploy from 8 to 9 Oct.
   - **Installs:** `npm ci`. Node is pinned by `engines` (22.x).
   - **Pull requests** get a Preview deployment, which never uses the production database:
     - `vite.config.ts` makes a preview local-only unless it has a non-production Supabase URL;
     - `scripts/assert-preview-isolated.mjs` fails a preview build that names the production project.

2. **GitHub Actions `Deploy`** (`deploy.yml`) ships the database, then the server, then puts the apps live
   (v10.128.0, Q1; owner decision D8):
   - **`db-migrations`:** `supabase db push` against production (no `--include-all` since Q1: an out-of-order
     migration is refused, never applied), in the `production-database` environment. It **fails loudly**: a
     failed migration is a red run.
   - **`deploy-edge-functions`** (`needs: db-migrations`):
     - the engine bundle must match the app code (`build-agent-engine --check`);
     - the commit is stored as the `BUILD_SHA` secret;
     - every function in `supabase/functions` is deployed;
     - the `version` function must then report this commit.
   - **`promote-apps`** (`needs` both): promotes Vercel's staged production build of this commit for `vyact`
     and `vyact-admin` (`scripts/promote-app.mjs`). A docs-only commit Vercel skipped has nothing to promote.
     A broken build fails the run, and the previous app stays live.

   **Turning the gate on (owner, once):**
   1. Create a Vercel token for the account that owns the projects (Account Settings → Tokens; scope: the
      `authen27` team). Store it as the repository secret `VERCEL_PROMOTE_TOKEN`. If the projects sit in a
      team, set the repository variable `VERCEL_TEAM` to its slug (`authen27`).
   2. Watch one Deploy run: `promote-apps` says "already serving this commit" (auto-assign is still on).
   3. In each of `vyact` and `vyact-admin`: Settings → Environments → Production → turn
      **Auto-assign Custom Production Domains** off. Leave `vyact-demo` as it is.
   4. The next Deploy run says "promoted …", and https://vyact.app/version.json shows the new version.

   Until step 3, Vercel and Actions run in parallel, so a schema change ships in its own PR, merged before the
   app that needs it (db/MIGRATIONS.md §4).

**Verify a deploy reached production.** A green run is not enough:

```bash
curl -s https://vyact.app/version.json
```

That should print the new version. Also check:
- the **Deploy** run on `main` is green, with both jobs;
- for a migration, the tracker or dashboard lists it as applied;
- for admin, the version on the sign-in screen and in the sidebar matches `admin/package.json`;
- `npx vercel ls vyact-admin --prod` shows the deployment as **Ready**, not Error or Canceled.

**Supabase client config is committed, not injected.** `react/.env.production` and `admin/.env.production`
hold the **public** project URL and **publishable** key. Never put the `service_role` or secret key there.

**GitHub Actions secrets in use:** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and
`SUPABASE_DB_PASSWORD`, for the `production-database` environment and the vyact-test function deploys.
Paste the token without a trailing newline (the workflow normalises it). The old `VERCEL_*` and
`VITE_SUPABASE_*` secrets are unused.

---

## (Original one-time setup guide — historical)

> ⚠️ **Superseded.** The current production flow is the section at the top of
> this file. Treat what follows as a first-time bootstrap reference only.
> Specific URLs, project names, env-var wiring, and "add it in the Vercel UI"
> instructions below do **not** match the present setup — production now reads
> Supabase config from the committed `.env.production` files.

> Three steps. ~15 minutes total. You'll get a live consumer app URL, a live
> admin app URL, and CI/CD that auto-deploys on every push to `main`.

```
┌──────────────┐   git push   ┌──────────────┐   webhook   ┌──────────────┐
│  Local repo  │ ───────────► │   GitHub     │ ──────────► │    Vercel    │
└──────────────┘              └──────────────┘             └──────────────┘
                                                                  │
                                                                  ▼
                                                       ┌──────────────────────────┐
                                                       │ vyact.app                │ (consumer)
                                                       │ admin.vyact.app          │ (admin)
                                                       └──────────────────────────┘
                                                                  │
                                                                  ▼
                                                          ┌──────────────┐
                                                          │   Supabase   │ (already live)
                                                          └──────────────┘
```

---

## Prerequisites

Three accounts (all have free tiers):
- **GitHub** — https://github.com
- **Vercel** — https://vercel.com (sign up with GitHub for one-click connection)
- **Supabase** — already done, project `dmxqkvploojokffuhxnz` is live

You'll also need locally:
- Git (already installed since you're reading this)
- Node 20+ if you want to test before pushing (optional)

---

## Step 1 · Push to GitHub (5 min)

### Option A — GitHub CLI (fastest, recommended)

```bash
# One-time: install gh on Windows
winget install --id GitHub.cli
gh auth login                    # follow the browser prompt

cd C:/Users/U.Reddy/Downloads/Vyact-main/Vyact-main
gh repo create vyact --private --source=. --remote=origin --push
```

Done. The repo lives at `https://github.com/<your-username>/vyact`.

### Option B — Web UI

1. Go to https://github.com/new
2. Name: `vyact` · Visibility: **Private** · **Don't** initialise with README
3. Click "Create repository"
4. Copy the SSH or HTTPS URL it shows you
5. Locally:

```bash
cd C:/Users/U.Reddy/Downloads/Vyact-main/Vyact-main
git remote add origin git@github.com:<your-username>/vyact.git   # or https URL
git push -u origin main
```

---

## Step 2 · Deploy both apps to Vercel (5 min)

### Through the Vercel dashboard (easiest)

For the **consumer app**:

1. Go to https://vercel.com/new
2. **Import Git Repository** → pick `vyact`
3. Configure:
   - **Project name**: `react` (or whatever you want — production uses `react`)
   - **Root Directory**: click "Edit" → select `react`
   - Framework: Vercel auto-detects Vite
4. **Environment Variables** — leave empty. Supabase URL + publishable key are
   committed in `react/.env.production`. Do **not** add `VITE_SUPABASE_*` here;
   an empty value would override the committed file at build time.
5. Click **Deploy**

After ~90 seconds you'll get a URL like `https://vyact.app`.

For the **admin app** — repeat with:
- **New project** → same `vyact` repo
- **Project name**: `admin`
- **Root Directory**: `admin`
- No env vars needed — `admin/.env.production` is committed
- Deploy

You'll get `https://admin.vyact.app`.

### Through the Vercel CLI (alternative)

```bash
npm i -g vercel
vercel login

# Consumer
cd react
vercel --prod
# Answers when prompted:
#   Set up and deploy? Yes
#   Which scope? <pick the bhushandandolus-projects team>
#   Link to existing project? No
#   Project name? react
#   Directory? . (current — Vercel reads root from vercel.json)
# Skip env-var prompts — config is in the committed .env.production

# Admin
cd ../admin
vercel --prod      # same flow, name it admin
```

---

## Step 3 · Wire up CI/CD (3 min, optional but recommended)

Once both Vercel projects exist, every `git push origin main` should auto-deploy.
Vercel handles this automatically once you connected the repo in Step 2 — **no GitHub
Actions config needed for the basic case**.

If you also want **GitHub Actions to run** the deploy (for parallel builds, audit trail, or
deploying without Vercel's git integration), set these GitHub secrets at:
**Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Where to find |
|---|---|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → Create |
| `VERCEL_ORG_ID` | Run `vercel link` once, look in `.vercel/project.json` |
| `VERCEL_CONSUMER_PROJECT_ID` | In `react/.vercel/project.json` after `vercel link` |
| `VERCEL_ADMIN_PROJECT_ID` | In `admin/.vercel/project.json` after `vercel link` |

The workflow at `.github/workflows/deploy.yml` will use them.

---

## After deployment

### `VITE_APP_URL` is no longer needed

The consumer app derives its public URL from `window.location` at runtime, so
there is no `VITE_APP_URL` to set per environment. The Supabase **Site URL**
(see below) is the value used inside invitation and password-reset emails.

### Configure Supabase auth redirects

In your Supabase dashboard at https://supabase.com/dashboard/project/dmxqkvploojokffuhxnz:

1. **Authentication → URL Configuration**
2. **Site URL**: `https://vyact.app`
3. **Redirect URLs** (allow list): add all of
   - `https://vyact.app/**`
   - `https://admin.vyact.app/**`
   - `http://localhost:5173/**` (for local consumer dev)
   - `http://localhost:5174/**` (for local admin dev)

For the canonical list, see [`SUPABASE_CONFIG.md`](SUPABASE_CONFIG.md) §4.
Without these, magic-link and password-reset emails redirect to the wrong host.

### Lock down the admin app

The admin app is currently **publicly accessible**. Before you ship real data:

1. Set `X-Robots-Tag: noindex` header — already configured in `admin/vercel.json` ✓
2. Add Vercel **Password Protection** (paid feature) or Cloudflare Access in front
3. Long-term: implement admin-side auth that gates pages with the role tiers
   defined in `admin/src/types.ts`

### Custom domains (optional)

Vercel → Project → Settings → Domains → Add. They auto-issue SSL.

Recommended setup once a domain is registered (see
[`VYACT_TRANSITION_CHECKLIST.md`](VYACT_TRANSITION_CHECKLIST.md) §1 for the
trademark / domain gate):
- `app.vyact.<tld>` → consumer
- `admin.vyact.<tld>` → admin (behind Cloudflare Access or Workspace SSO)
- `vyact.<tld>` → marketing site (separate)

---

## Verifying the deployment works

After the first deploy:

1. Open `https://vyact.app` → you should see the auth screen (because the committed `VITE_SUPABASE_URL` is baked into the bundle)
2. Sign up with a real email → check inbox for verification → click → you're in
3. Create a household → switch to it → add a transaction
4. Open the same URL on a different device, sign in → confirm same household + transaction is there ✓
5. Open `https://admin.vyact.app` → you should see the NorthStar dashboard with live KPIs

If something doesn't work, check:
- Vercel build logs for the failing deploy
- Browser devtools → Network tab → look for 401/403 from `*.supabase.co`
- Supabase dashboard → Authentication → Logs

---

## Cost summary

| Item | Free tier covers | Paid starts at |
|---|---|---|
| GitHub repo (private) | unlimited | — |
| Vercel hosting | 100 GB bandwidth/mo, unlimited deploys | $20/mo Pro |
| Supabase | 50K monthly active users, 500 MB DB, 1 GB file storage | $25/mo Pro |
| **Total to ship Vyact live** | **$0/mo** | $45/mo when you outgrow free tiers |

You can comfortably run a closed beta with hundreds of users on the free tiers.

---

## Rollback

If a deploy goes wrong:
- **Vercel**: dashboard → Deployments → click any past deploy → "Promote to Production". Instant.
- **Supabase**: migrations are forward-only by default. To undo, write a new migration that reverses the change. For data, restore from a manual `pg_dump` snapshot.

The local repo always has every commit; you can also `git revert <sha>` and push.
