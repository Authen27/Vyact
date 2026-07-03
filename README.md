# Vyact — Family Finance OS

Three deliverables in one repo, each independently runnable, each on its own SemVer line.

| Path | What | Current | Live | Stack | Run |
|---|---|---|---|---|---|
| `react/` | **Consumer (React)** | **v9.9.0** | [vyact-twentyx.vercel.app](https://vyact-twentyx.vercel.app) | Vite · React 18 · TS · Tailwind · Recharts · Zustand · Supabase | `cd react && npm install && npm run dev` → `:5173` |
| `admin/` | **Admin** | **v1.3.0** | [vyact-admin.vercel.app](https://vyact-admin.vercel.app) | Vite · React 18 · TS · Tailwind · Recharts · Supabase | `cd admin && npm install && npm run dev` → `:5174` |
| archived | Vanilla shell | **v5.0** *(final)* | git history only | removed from working tree | see `VERSIONS.md` |

> **Version source of truth:** [`VERSIONS.md`](VERSIONS.md) + each app's `package.json` / `CHANGELOG.md`. The consumer/admin numbers above are CI-checked against `react/package.json` and `admin/package.json` (`scripts/version-drift-check.mjs`, TD-28) — don't hand-edit them out of sync.

## Documentation map

The doc tree is small but purposeful — start here:

| Doc | What it's for |
|---|---|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | **New-session continuity brief** — live URLs, deploy/Supabase gotchas, open work, command cheatsheet |
| [`CLAUDE.md`](CLAUDE.md) | Agent orientation + the **binding architecture conventions** (money model, budget identity, store slices, sync) |
| [`VERSIONS.md`](VERSIONS.md) | Master cross-app release timeline + roadmap (version source of truth) |
| [`react/CHANGELOG.md`](react/CHANGELOG.md) · [`admin/CHANGELOG.md`](admin/CHANGELOG.md) | Authoritative per-version detail |
| [`docs/HISTORY.md`](docs/HISTORY.md) | Archived per-version *implementation* narrative (moved out of CLAUDE.md) |
| [`TECH_DEBT.md`](TECH_DEBT.md) | The single source of truth for technical debt (TD-01…TD-28) |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Cloud + auth + multi-household design |
| [`DEPLOY.md`](DEPLOY.md) · [`db/MIGRATIONS.md`](db/MIGRATIONS.md) | Deploy pipeline · DB migration workflow |
| [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md) | Regression-managed catalog of every automated test (CI-reconciled) |

## Changelogs

- [`VERSIONS.md`](VERSIONS.md) — **master index** + cross-app release timeline + roadmap
- [`react/CHANGELOG.md`](react/CHANGELOG.md) — full per-version detail for the consumer React app
- [`admin/CHANGELOG.md`](admin/CHANGELOG.md) — full per-version detail for the admin app

## What's where

- **`react/`** — the active consumer app. All 10 pages in React, Insights, Add Transaction, cloud sync, multi-household.
- **`admin/`** — the admin backend. NorthStar dashboard with live KPIs from Supabase, three role tiers, content CMS.
- **`db/schema.sql`** — Postgres schema for Supabase (auth, multi-household, RLS).
- **Vanilla shell (v1.0-v5.0)** — archived from the working tree in v7.0.1; preserved in git history.
- **`ARCHITECTURE.md`** — cloud + auth + multi-household design doc.
- **`CLAUDE.md`** — orientation for Claude Code agents working on this repo.

## Quick start

```bash
git clone <this-repo>
cd budget-app

# Consumer React app (local-only mode out of the box)
cd react && npm install && npm run dev   # http://localhost:5173

# Admin app (separate terminal)
cd admin && npm install && npm run dev   # http://localhost:5174
```

Consumer (`:5173`) and admin (`:5174`) can run side-by-side.

### Cloud sync (optional for consumer; required for admin)

The React consumer app runs in pure-localStorage mode by default. To enable cloud features (auth, multi-device sync, multi-household with invitations, realtime, role permissions, Insights content):

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Apply the migrations in [`supabase/migrations/`](supabase/migrations/) in lexicographic order. For a fresh project the easiest path is to paste the contents of `supabase/migrations/00000000000000_initial_schema.sql` (the baseline) followed by every subsequent migration into the Supabase SQL Editor in order; for an existing project use the Supabase MCP `apply_migration` tool per [`db/MIGRATIONS.md`](db/MIGRATIONS.md). The single-file view at `db/schema.sql` is generated from these migrations and is useful for human review but **should not be re-pasted** once any individual migration has been applied.
3. Apply any further migrations listed in [`react/CHANGELOG.md`](react/CHANGELOG.md) and [`admin/CHANGELOG.md`](admin/CHANGELOG.md) (auto-create-household trigger, RLS recursion fix, content_items, admin_data_layer) that are not yet in `supabase/migrations/` — see [`db/MIGRATIONS.md`](db/MIGRATIONS.md) for the absorb-them-into-the-directory plan.
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
