# FinFlow Admin App — Changelog

> Versioning record for the admin React app at `admin/`. Newest first.
>
> The admin app is a **standalone product**, separate from the consumer app at `react/`. It shares no code with the v1.0–v5.0 vanilla shell at the repo root (which is the *consumer* legacy app). Admin's version line starts at **v1.0.0**.
>
> **Current production version: `v1.0.8`**
> **Live URL:** https://finflow-admin.vercel.app
> **Next planned: `v1.1.0`** (see Roadmap at the bottom).

---

## v1.0.8 — Slug sanitiser edge-case fix (remediation PR #3) *(2026-05-24)*

Bugfix release. Fixes an edge-case in the `slugify()` sanitiser where punctuation-only inputs (for example `'!!!  ???  @@@'`) collapsed to a single hyphen. `slugify()` now trims the intermediate result after stripping punctuation so whitespace-only inputs return the empty string as intended. Tests updated: `ADM-UNIT-006` now asserts the corrected behaviour. No user-visible UI changes.

---

## v1.0.7 — First admin unit tests + test scenarios catalog (remediation PR #2) *(2026-05-23)*

Closes finding **N1** of the 2026-05-22 assessment ("the privileged admin app has no automated test safety net"). The admin app now has its own Vitest suite and an established pattern for growing it. Tooling-only, no user-visible change.

- [`admin/src/lib/__tests__/contentApi.test.ts`](admin/src/lib/__tests__/contentApi.test.ts) — 11 ID-tagged unit tests (`ADM-UNIT-001..011`) covering `slugify()` (URL-slug sanitiser for published articles) and `rowToArticle()` (the Supabase-row → consumer-Article boundary mapper). All passing locally.
- [`admin/src/lib/contentApi.ts`](admin/src/lib/contentApi.ts) — `rowToArticle` now exported so the boundary mapper is testable without going through Supabase.
- [`admin/package.json`](admin/package.json) — added `vitest` dev-dep + `test` / `test:watch` scripts mirroring the consumer.
- [`admin/tsconfig.json`](admin/tsconfig.json) — added `exclude` for `*.test.ts(x)` to match the consumer pattern.
- The shared automation gate now runs an `admin-unit` step and surfaces admin scenarios in the per-app/per-layer evidence table; admin scenarios are catalogued in [`docs/TEST_SCENARIOS.md`](docs/TEST_SCENARIOS.md) and reconciled on every run by `scripts/test-scenarios-check.mjs`. Real bug noted (not fixed in this PR): `slugify('!!! ??? @@@')` returns `'-'` instead of `''` because the whitespace-only intermediate collapses to a single hyphen — logged for a follow-up.

---

## v1.0.6 — ESLint floor (remediation PR #1) *(2026-05-23)*

First real linter for the admin app — the old `npm run lint` was `tsc --noEmit` (now preserved as `npm run typecheck`). Tooling-only, no user-visible change. Closes finding **N1/N2** of the 2026-05-22 remediation assessment (admin had zero tests *and* no linter despite being the privileged surface) for the linter half.

- [`admin/eslint.config.js`](admin/eslint.config.js) — new flat config mirroring the consumer's (`@eslint/js` recommended + `typescript-eslint` recommended + `react-hooks`).
- [`admin/package.json`](admin/package.json) — `lint` now runs `eslint .`; added `typecheck` script. Added matching dev-deps.
- Admin source passes lint clean today (1 pre-existing `no-explicit-any` warning in `Dashboard.tsx`, no errors).
- The shared `scripts/automation-run.mjs` gate now runs ESLint and type-check as separate admin gates.

---

## v1.0.5 — Mobile navigation fix *(2026-05-22)*

The admin sidebar was `hidden lg:flex` with **no mobile fallback** — below 1024px the navigation tabs disappeared entirely, leaving the app unusable on narrow viewports.

- [`admin/src/components/Layout.tsx`](admin/src/components/Layout.tsx) — added a hamburger button in the top bar (shown below `lg`) that opens a slide-out **mobile nav drawer** with the full role-filtered nav, dark-mode toggle and sign-out. Nav links extracted into a shared `navLinks()` renderer used by both the desktop sidebar and the drawer; drawer closes on navigation. The "staging · admin" tag hides on the smallest screens to make room.

---

## v1.0.4 — AI Assistant Intelligence *(2026-05-21)*

New **AI Intelligence** page (super, roles & content tiers) that segments user types from Ask-FinFlow usage.

- [`admin/src/pages/Intelligence.tsx`](admin/src/pages/Intelligence.tsx) — intent distribution, sentiment split, and a per-user segment table (Power user · advocate / · frustrated, At-risk, Engaged, Casual). Privacy-safe: derived from intent + sentiment + message length only, never message content.
- [`admin/src/lib/adminApi.ts`](admin/src/lib/adminApi.ts) — `fetchAiUsageSummary()` calls the new `admin_ai_usage_summary()` SECURITY DEFINER RPC (admin-gated).
- Wired into routing (`/intelligence`), the sidebar nav, and the role→page permission map.
- Pairs with consumer v6.4.6, which logs the `ai_usage` rows.

## Pre-1.0 history

The admin app was first scaffolded inside this repo and labelled internally as **"v8.0"** because the v7 product PRD §07 referred to it that way (the PRD's "v8" referred to the *delivery slot* in the broader product roadmap, not to a SemVer version of the admin app itself).

That scaffolding shipped with **mock data only** (220 fake users, fake KPIs, fake MRR, fake audit log) and was never a production-grade release of the admin app. It served as a UI preview and as the visual scaffold against which the real data layer was built.

When the data layer was sanitised — every page rewritten to read from the live Supabase project — we treated that as the **first production release** of the admin app and reset the version line accordingly. The "v8.0" label is retired.

> If you see references to `"version": "8.0.0"` in `admin/package.json` in older commits, or "v8 Admin" in `CLAUDE.md` history, that was the pre-1.0 scaffolding numbering. As of v1.0.0 the package version is `1.0.0`.

---

## v1.0.3 — Design System v2 brand marks *(2026-05-21)*

Aligned the admin to the FinFlow Design System v2 brand:
- Sidebar logo and `admin/public/favicon.svg` upgraded to the full **Pip mascot** (eyes, cheeks, smile), matching the consumer.
- Sidebar wordmark now renders **"Fin" upright + "Flow" italic coral** per the FF.Wordmark spec.

> The design system shows the admin on a dark "shell" theme (`#1F1B17`); the admin currently remains on its light Claude-native theme pending product sign-off. Token/shell adoption is tracked for a later release.

---

## v1.0.2 — Brand icon fix *(2026-05-20)*

The admin app's icon didn't match the FinFlow design.

- **Missing favicon:** `admin/index.html` referenced `/favicon.svg` but there was no `admin/public/` directory, so the admin browser tab fell back to a generic icon. Added [`admin/public/favicon.svg`](admin/public/favicon.svg) — the FinFlow "Pip" peach logo-mark (coral radial gradient + sage leaf), identical to the consumer app and the vanilla shell.
- **Sidebar wordmark:** the sidebar showed an "FF" monogram in a coral box instead of the brand logo. Replaced it with the inline Pip logo-mark SVG in [`admin/src/components/Layout.tsx`](admin/src/components/Layout.tsx) so admin branding matches the consumer.

Verified: admin sidebar renders the Pip mark; favicon serves.

---

## v1.0.1 — AuthGate deadlock hotfix *(2026-05-20)*

**Severity: critical (app unusable).** After the Supabase project was resumed from a pause, the admin app hung forever on the **"Checking session…"** screen — `sessionLoaded` never flipped, so no page ever rendered.

### Root cause
[`admin/src/components/AuthGate.tsx`](admin/src/components/AuthGate.tsx) registered an **`async`** `onAuthStateChange` callback that `await`ed `fetchMyAdminRole()`, which internally called `supabase.auth.getUser()`. supabase-js holds the GoTrue **auth lock** for the duration of an `onAuthStateChange` callback; any nested auth call that needs the same lock deadlocks. The lock never released, so `getSession()` also blocked → permanent "Checking session…". (The consumer app avoids this because its callback is synchronous.) It only surfaced now because there was a stored session to recover post-pause, and a deadlocked tab held the cross-tab Web Lock.

### Fix
- [`admin/src/lib/auth.ts`](admin/src/lib/auth.ts) — `fetchMyAdminRole(userId?)` now accepts the user id from the session, so it no longer calls `supabase.auth.getUser()`.
- [`admin/src/components/AuthGate.tsx`](admin/src/components/AuthGate.tsx) — role resolution is deferred via `setTimeout(0)` so the auth lock is released first, and the `onAuthStateChange` callback never `await`s a Supabase call inline. Passes `session.user.id` straight through.

### Verified
After the fix + closing the deadlocked tab, the admin dashboard loads fully with live data (Total Users 3, Households 3, Articles 5, Favorites 1 — all matching the DB). Build green.

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
