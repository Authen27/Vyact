# FinFlow Admin App — Changelog

> Versioning record for the admin React app at `admin/`. Newest first.
>
> The admin app is a **standalone product**, separate from the consumer app at `react/`. It shares no code with the v1.0–v5.0 vanilla shell at the repo root (which is the *consumer* legacy app). Admin's version line starts at **v1.0.0**.
>
> **Current production version: `v1.0.0`**
> **Live URL:** https://finflow-admin.vercel.app
> **Next planned: `v1.1.0`** (see Roadmap at the bottom).

## Pre-1.0 history

The admin app was first scaffolded inside this repo and labelled internally as **"v8.0"** because the v7 product PRD §07 referred to it that way (the PRD's "v8" referred to the *delivery slot* in the broader product roadmap, not to a SemVer version of the admin app itself).

That scaffolding shipped with **mock data only** (220 fake users, fake KPIs, fake MRR, fake audit log) and was never a production-grade release of the admin app. It served as a UI preview and as the visual scaffold against which the real data layer was built.

When the data layer was sanitised — every page rewritten to read from the live Supabase project — we treated that as the **first production release** of the admin app and reset the version line accordingly. The "v8.0" label is retired.

> If you see references to `"version": "8.0.0"` in `admin/package.json` in older commits, or "v8 Admin" in `CLAUDE.md` history, that was the pre-1.0 scaffolding numbering. As of v1.0.0 the package version is `1.0.0`.

---

## v1.0.0 — Production data layer · NorthStar dashboard *(2026-05-10)*

The first production-grade release of the admin app. Every page on real Supabase data; mock data layer deleted.

### New / promoted from scaffolding

**Auth + privilege model**

- New `admin/src/lib/supabase.ts` — Supabase client pointing at `dmxqkvploojokffuhxnz` (same project as the consumer app).
- New `admin/src/lib/auth.ts` — `signIn()`, `signOut()`, `fetchMyAdminRole()`.
- New `admin/src/components/AuthGate.tsx` — top-level gate. Four states:
  - Loading
  - Not signed in → `<SignIn />` page
  - Signed in but not in `admin_roles` → `<NotAuthorized />` with sign-out button
  - Signed in + admin → render children
- Store extended (`admin/src/store.ts`) with `session`, `serverRole`, `setSession()`. The role-switcher in the sidebar is now a **preview-only override** for Super Admins (lower-tier admins see their server role locked).

**Database — `admin_data_layer` migration**

- `public.subscriptions` — full schema (tier · status · MRR · currency · Stripe sub id · failure count) with `updated_at` trigger and `is_admin('roles')` RLS. Empty in production until v1.1 wires Stripe webhooks.
- Admin-bypass `SELECT` RLS policies on the seven previously household-scoped tables (`households`, `memberships`, `profiles`, `activity_log`, `transactions`, `budgets`, `goals`, `debts`, `assets`) gated by `is_admin('roles')`. Lower-tier consumers are unaffected.
- `public.admin_list_users()` — `SECURITY DEFINER STABLE` RPC that joins `auth.users` with `profiles`, `memberships`, `admin_roles`. Returns email-confirmation status, household count, admin-tier badge per user.
- `public.admin_dashboard_kpis()` — single-row JSON RPC returning 13 live metrics: total users / households / transactions, multi-member %, 7-day actives (users + households), 7-day & 30-day signups, 7-day & total transaction counts, published articles, content favourites, paid subscription count, MRR, computed-at timestamp.
- `public.admin_weekly_trend(weeks int default 12)` — series RPC for trend charts.

Earlier `content_items_and_user_favorites` migration (originally consumer v6.3) also installed:
- `public.admin_roles (user_id, role, granted_by, granted_at)` — server-side privilege source.
- `public.is_admin(min_role text)` — `SECURITY DEFINER STABLE` helper.
- `public.content_items` + `public.content_favorites` — admin authors, consumers read.

**Pages — all five rewritten to live data**

- **Dashboard** — every number from `admin_dashboard_kpis()`. Three Recharts area/bar panels driven by `admin_weekly_trend()`. **Cohort metrics that need event-tracking infrastructure** (D7/D90 retention, NPS, pulse-improved%, recs-followed%, chat-satisfaction, time-to-first-txn) render as `—` placeholders with hover-tooltips explaining what's needed. Refresh button. Computed-at footer.
- **Users** — list from `admin_list_users()` with verified-email badge, admin-tier shield, household count, joined date, last-seen date. Search + 4 KPI cards.
- **Households** — card grid from `households` joined with `memberships` count. Type colour-coded.
- **Subscriptions** — reads from `public.subscriptions`. Empty state shows the **"billing not wired"** callout pointing at v1.1 roadmap. MRR/ARR/active/failures tiles + tier-mix donut + row table — all driven by real columns, just zero rows currently.
- **Audit** — last 200 rows from `activity_log` with collapsible JSON-diff and CSV export.
- **Content** — full CRUD against `content_items`. New article form modal (title auto-generates slug; topic, status, read-minutes, cover emoji). Edit + delete from the row.
- **Help** — searchable 17-section accordion, audience-badged per admin tier (super / roles / content). Filter chips: `mine` (auto-selects topics for current role), per-tier filters, and `all`. Three top-of-page tier cards explain privileges.

**New file:** `admin/src/lib/adminApi.ts` — all six fetchers (`fetchDashboardKpis`, `fetchWeeklyTrend`, `fetchAllUsers`, `fetchAllHouseholds`, `fetchAllSubscriptions`, `fetchActivityLog`).

**Deleted:** `admin/src/lib/mockData.ts` — the 137-line scaffolding fixture. Zero remaining references.

### Honest-by-design empty states

- `subscriptions` empty → explicit "billing not wired" callout, not fake $X MRR.
- Cohort metrics that need event-tracking infrastructure → `—` cards with an explainer for each, not invented numbers.
- Audit log filterable by query string from the global search bar.

### Validated

Smoke-tested the three new RPCs as `authenticated` user `uday.kr27@gmail.com` (super admin):

- `admin_dashboard_kpis()` → returns `{totalUsers:2, totalHouseholds:2, signups7d:1, publishedArticles:5, contentFavorites:1, ...}` (real numbers from production).
- `admin_list_users()` → returns 2 rows with the seeded users + their admin tiers.
- `admin_weekly_trend(4)` → returns 4 weekly buckets with non-zero `signups` and `active_users` for the current week.

`tsc -b && vite build` clean (`✓ 2431 modules transformed`).

### Tech stack

| Layer | Choice |
|---|---|
| Build | Vite 5 |
| Language | TypeScript 5.6 strict |
| UI | React 18 + React Router 6 |
| Styling | Tailwind 3 with Claude HSL theme tokens (light + dark) |
| State | Zustand |
| Data | Supabase (`@supabase/supabase-js` v2) |
| Charts | Recharts |
| Icons | Lucide React |
| Display font | Source Serif 4 (Tiempos-equivalent) |
| UI font | Inter |
| Mono font | JetBrains Mono |

### Three-tier role model (per PRD §07)

| Tier | Server role | Privileges |
|---|---|---|
| Super Admin | `super` | Full access: user management, content, settings, can grant other tiers |
| Roles Admin | `roles` | User + household management, audit log read |
| Content Admin | `content` | Article library — create / edit / publish |

Roles are server-enforced via `public.admin_roles` and the `is_admin(min_role)` helper. Client-side route gating is for UX only.

### NorthStar Dashboard

- **Active Households per Week (AHpW)** — household with at least one transaction recorded in the past 7 days. Live count, not seeded.
- **12 KPI cards** with the metrics that *can* be computed today plus 8 placeholders for cohort metrics that need event-tracking infrastructure (v1.1).
- **Three trend charts** — weekly signups, weekly active users, weekly transactions.

### Deploy

Two Vercel deployments aliased to:

- Production: https://finflow-admin.vercel.app
- Backup alias: https://admin-jade-nu.vercel.app

Both fed by the same Vercel project under `udaykr27-1375s-projects/admin`.

---

## Roadmap

### v1.1.0 — *next* (planned)
> Closes the gaps explicitly called out as `—` or "billing not wired" in v1.0.0.

- **Stripe billing wiring** — `stripe-webhook` Supabase Edge Function inserts/updates rows on `customer.subscription.*` events. Lights up the Subscriptions page MRR / tier-mix / status columns.
- **Event-tracking pipeline** (PostHog or Supabase events table) — unblocks the 8 cohort KPI cards on the Dashboard:
  - Time-to-first-txn (median seconds sign-up → first transaction)
  - D7 retention %, D90 retention %
  - Pulse improved 30d %
  - Reminder confirmed % (recurring transactions)
  - Recs followed % (Planner)
  - Chat satisfaction (thumbs-up rate)
  - NPS (in-app survey)
- **Audit-log diff viewer** — pretty-print the `changes` JSONB column inline instead of in a `<pre>` toggle.

### v1.2.0 (planned)
- **User suspend / reinstate flow** — write to `auth.users` via SECURITY DEFINER RPC. Requires capturing reason in `activity_log`.
- **Invite admin tier from UI** — currently requires manual SQL `INSERT INTO admin_roles`. Add a guarded form on the Users page (Super only).
- **SIEM audit export** — webhook + scheduled job pushing `activity_log` deltas to Datadog / Splunk.

### v1.3.0 (planned)
- **Google Workspace SSO** — replace email/password sign-in with Workspace OAuth (per PRD §07 security posture).
- **VPN / IP allowlist** at the Vercel edge — admin app only accessible from the office network.

### v2.0.0 — *future major*
- **Multi-tenant admin** — per-org metrics for enterprise customers. The current `admin_dashboard_kpis()` returns global numbers; multi-tenant adds an `org_id` filter.
- **Embedded Looker Studio** for deeper drill-down on KPIs.
- **CS conversation linking** — connect Intercom threads to user IDs.
