# FinFlow — Family Finance OS

Three deliverables in one repo, each independently runnable, each on its own SemVer line.

| Path | What | Current | Live | Stack | Run |
|---|---|---|---|---|---|
| `react/` | **Consumer (React)** | **v6.4.2** | [react-taupe-xi.vercel.app](https://react-taupe-xi.vercel.app) | Vite · React 18 · TS · Tailwind · Recharts · Zustand · Supabase | `cd react && npm install && npm run dev` → `:5173` |
| `admin/` | **Admin** | **v1.0.1** | [finflow-admin.vercel.app](https://finflow-admin.vercel.app) | Vite · React 18 · TS · Tailwind · Recharts · Supabase | `cd admin && npm install && npm run dev` → `:5174` |
| `./` | Consumer legacy (vanilla shell) | **v5.0** *(frozen)* | local | HTML + CSS + JS, no build | open `index.html` |

## Changelogs

- [`VERSIONS.md`](VERSIONS.md) — **master index** + cross-app release timeline + roadmap
- [`react/CHANGELOG.md`](react/CHANGELOG.md) — full per-version detail for the consumer React app
- [`admin/CHANGELOG.md`](admin/CHANGELOG.md) — full per-version detail for the admin app

## What's where

- **`index.html` · `style.css` · `app.js`** — vanilla shell (legacy consumer, v5.0 frozen). No tooling required.
- **`src/dataAdapter.js`** — vanilla data adapter (LocalStorage / Supabase / Hybrid).
- **`react/`** — the active consumer app. All 10 pages in React, Insights, Add Transaction, cloud sync, multi-household.
- **`admin/`** — the admin backend. NorthStar dashboard with live KPIs from Supabase, three role tiers, content CMS.
- **`db/schema.sql`** — Postgres schema for Supabase (auth, multi-household, RLS).
- **`FinFlow App/`** — product specs, GTM strategy, financial model, design wireframes, PRDs.
- **`ARCHITECTURE.md`** — cloud + auth + multi-household design doc.
- **`CLAUDE.md`** — orientation for Claude Code agents working on this repo.

## Quick start

```bash
git clone <this-repo>
cd budget-app

# Vanilla shell (legacy)
python -m http.server 8000  # then open http://localhost:8000

# Consumer React app (local-only mode out of the box)
cd react && npm install && npm run dev   # http://localhost:5173

# Admin app (separate terminal)
cd admin && npm install && npm run dev   # http://localhost:5174
```

Consumer (`:5173`) and admin (`:5174`) can run side-by-side.

### Cloud sync (optional for consumer; required for admin)

The React consumer app runs in pure-localStorage mode by default. To enable cloud features (auth, multi-device sync, multi-household with invitations, realtime, role permissions, Insights content):

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run `db/schema.sql` in the Supabase SQL Editor.
3. Apply the migrations listed in [`react/CHANGELOG.md`](react/CHANGELOG.md) and [`admin/CHANGELOG.md`](admin/CHANGELOG.md) (auto-create-household trigger, RLS recursion fix, content_items, admin_data_layer).
4. Copy your project URL + anon key into `react/.env.local` and `admin/.env.local` (template at `react/.env.example`).
5. Restart the dev servers.

The admin app **requires** cloud — the AuthGate refuses to render without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

When env vars are present, the consumer picks `HybridAdapter` (cache + cloud + write queue) automatically; otherwise `LocalStorageAdapter`. Same `DataAdapter` interface either way.

## Roadmap

See [`VERSIONS.md`](VERSIONS.md) for the full cross-app roadmap. Highlights:

- **Consumer v6.4** — GA4 custom event taxonomy, Goals "+ Progress" modal, Transactions pagination, bundle code-split.
- **Admin v1.1.0** — Stripe webhook → `subscriptions`. Event-tracking pipeline unlocks the 8 cohort metrics on the Dashboard.
- **Consumer v6.5 / Admin v1.2.0** — Stripe in consumer Settings, user suspend/reinstate from admin.
- **Consumer v7.0** — LLM Chat backend (Claude Haiku via Edge Function). LLM-augmented Planner.
- **Admin v1.3.0** — Google Workspace SSO, VPN/IP allowlist at edge.
- **Admin v2.0.0** — Multi-tenant per-org admin views.

> **Platform expansion** — 8 verticals reusing the four-component architecture (Health · Care · Learning · Work · Legal · Consumer) per `FinFlow App/finflow-platform-expansion.html`.
