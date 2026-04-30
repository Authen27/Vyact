# Deploying FinFlow

> Three steps. ~15 minutes total. You'll get a live consumer app URL, a live
> admin app URL, and CI/CD that auto-deploys on every push to `main`.

```
┌──────────────┐   git push   ┌──────────────┐   webhook   ┌──────────────┐
│  Local repo  │ ───────────► │   GitHub     │ ──────────► │    Vercel    │
└──────────────┘              └──────────────┘             └──────────────┘
                                                                  │
                                                                  ▼
                                                       ┌─────────────────────┐
                                                       │ finflow.vercel.app  │ (consumer)
                                                       │ finflow-admin       │ (admin)
                                                       └─────────────────────┘
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

cd C:/Users/U.Reddy/Downloads/budget-app
gh repo create finflow --private --source=. --remote=origin --push
```

Done. The repo lives at `https://github.com/<your-username>/finflow`.

### Option B — Web UI

1. Go to https://github.com/new
2. Name: `finflow` · Visibility: **Private** · **Don't** initialise with README
3. Click "Create repository"
4. Copy the SSH or HTTPS URL it shows you
5. Locally:

```bash
cd C:/Users/U.Reddy/Downloads/budget-app
git remote add origin git@github.com:<your-username>/finflow.git   # or https URL
git push -u origin main
```

---

## Step 2 · Deploy both apps to Vercel (5 min)

### Through the Vercel dashboard (easiest)

For the **consumer app**:

1. Go to https://vercel.com/new
2. **Import Git Repository** → pick `finflow`
3. Configure:
   - **Project name**: `finflow` (or whatever you want)
   - **Root Directory**: click "Edit" → select `react`
   - Framework: Vercel auto-detects Vite
4. **Environment Variables** — add:
   - `VITE_SUPABASE_URL` = `https://dmxqkvploojokffuhxnz.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_SpuQFPzUWOnKI3nRR6ghNw_ktWqrKCA`
   - `VITE_APP_URL` = (leave blank for now, Vercel will fill in the deploy URL)
5. Click **Deploy**

After ~90 seconds you'll get a URL like `https://finflow.vercel.app`.

For the **admin app** — repeat with:
- **New project** → same `finflow` repo
- **Project name**: `finflow-admin`
- **Root Directory**: `admin`
- No env vars needed (mock data layer)
- Deploy

You'll get `https://finflow-admin.vercel.app`.

### Through the Vercel CLI (alternative)

```bash
npm i -g vercel
vercel login

# Consumer
cd react
vercel --prod
# Answers when prompted:
#   Set up and deploy? Yes
#   Which scope? <pick>
#   Link to existing project? No
#   Project name? finflow
#   Directory? . (current — Vercel reads root from vercel.json)
# When it asks about env vars, paste the two from above

# Admin
cd ../admin
vercel --prod      # same flow, name it finflow-admin
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

### Update `VITE_APP_URL` on the consumer project

Once you know the URL (e.g. `https://finflow.vercel.app`), edit it in Vercel:
**Project → Settings → Environment Variables → `VITE_APP_URL` = `https://finflow.vercel.app`**

This is the URL Supabase will use in invitation emails and password-reset links.

### Configure Supabase auth redirects

In your Supabase dashboard at https://supabase.com/dashboard/project/dmxqkvploojokffuhxnz:

1. **Authentication → URL Configuration**
2. **Site URL**: `https://finflow.vercel.app`
3. **Redirect URLs** (allow list): add both
   - `https://finflow.vercel.app/**`
   - `http://localhost:5173/**` (for local dev)

Without these, magic-link and password-reset emails will redirect to the wrong host.

### Lock down the admin app

The admin app is currently **publicly accessible**. Before you ship real data:

1. Set `X-Robots-Tag: noindex` header — already configured in `admin/vercel.json` ✓
2. Add Vercel **Password Protection** (paid feature) or Cloudflare Access in front
3. Long-term: implement admin-side auth that gates pages with the role tiers
   defined in `admin/src/types.ts`

### Custom domains (optional)

Vercel → Project → Settings → Domains → Add. They auto-issue SSL.

Recommended setup once you own a domain:
- `app.finflow.io` → consumer
- `admin.finflow.io` → admin (behind Cloudflare Access or Workspace SSO)
- `finflow.io` → marketing site (separate)

---

## Verifying the deployment works

After the first deploy:

1. Open the consumer URL → you should see the auth screen (because `VITE_SUPABASE_URL` is set)
2. Sign up with a real email → check inbox for verification → click → you're in
3. Create a household → switch to it → add a transaction
4. Open the same URL on a different device, sign in → confirm same household + transaction is there ✓
5. Open the admin URL → you should see the NorthStar dashboard with mock data

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
| **Total to ship FinFlow live** | **$0/mo** | $45/mo when you outgrow free tiers |

You can comfortably run a closed beta with hundreds of users on the free tiers.

---

## Rollback

If a deploy goes wrong:
- **Vercel**: dashboard → Deployments → click any past deploy → "Promote to Production". Instant.
- **Supabase**: migrations are forward-only by default. To undo, write a new migration that reverses the change. For data, restore from a manual `pg_dump` snapshot.

The local repo always has every commit; you can also `git revert <sha>` and push.
