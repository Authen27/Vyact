# Vyact Admin App — Changelog

> Versioning record for the admin React app at `admin/`. Newest first.
>
> The admin app is a **standalone product**, separate from the consumer app at `react/`. It shares no code with the v1.0–v5.0 vanilla shell at the repo root (which is the *consumer* legacy app). Admin's version line starts at **v1.0.0**.
>
> **Current production version: `v1.6.2`**
> **Live URL:** https://admin.vyact.app

---

## v1.6.2 — Installs run no package scripts *(2026-10-26)*

Ships with consumer v10.137.0 (supply-chain hardening; owner decision 26 Oct 2026). `admin/.npmrc` sets
`ignore-scripts=true`, so no package runs an install script on a developer's machine, in CI or on Vercel. Nothing
changes in the console.

---

## v1.6.1 — Pip's limits in Staff actions *(2026-10-25)*

Ships with consumer v10.135.0 (Track Q, part 7; audit OPS-11) and reads its migration: merge after its Deploy is
green.

- **Audit → Staff actions** names a change to Pip's limits ("Pip's limits") and says which numbers moved, before
  and after, as it does for Pip's model settings.

---

## v1.6.0 — Health: every scheduled job, and whether it is running *(2026-10-25)*

Ships with consumer v10.132.0 (Track Q, part 4) and reads its migration: merge after its Deploy is green. Audit
OPS-06, DB-OPS-08; owner decision D9, 20 Oct 2026.

- **Health** (roles tier and super admins) lists every scheduled job: what it does, how often it runs, when it last
  ran, how that run ended, and runs and failures in 24 hours. A job that failed on its last run, partly failed twice
  in a row, or has not run for two of its intervals is marked; it is what the owner's hourly email is about.
- A row opens its last 20 runs: counts and the error only, never a household's data.
- **Help** says what Health shows, and that the app's and the server's errors reach Sentry, scrubbed.

---

## v1.5.0 — Each tier sees the pages it can use; staff changes are on the record *(2026-10-25)*

Ships with consumer v10.131.0 and reads what v10.130.0's migrations (Q3a) give it: merge after Q3a's Deploy is
green. Track Q, part 3b. Owner decisions 20 Oct 2026.

- **Pages follow the server's tiers (ADM-07).**
  - One table (`PAGE_ROLES`, `lib/permissions.ts`) now drives both the sidebar and the routes.
  - Content admins no longer see a Dashboard whose figures the server refuses them; they land on Content.
  - Roles admins no longer see AI Intelligence, which needs the content tier.
- **Users and Households page on the server (ADM-08, INT-HH-14).**
  - 100 at a time, searched on the server.
  - Member counts and the headline figures (confirmed, admins, multi-member, by type) are counted on the server.
  - Before, both pages loaded whole tables, and past 1,000 rows both the lists and the counts stopped short.
- **Staff roles (ADM-04).**
  - Super admins grant and remove a staff role from a person's row, after confirming. Vyact always keeps one
    super admin.
  - **Audit Log → Staff actions** (super admins only) lists every staff change: roles, Learn content (which
    fields, never the text), needs/wants and AI settings, with who and when.
  - Household entries written on a schedule read "Vyact (automatic)".
- **MRR per currency (ADM-14).** The Dashboard's "MRR (USD)" tile added rupees to dollars; it now shows each
  currency.
- **Infographics (ADM-10).** Only PNG, JPEG or WebP up to 5 MB can be chosen or uploaded, as the bucket now enforces.
- **Previews (ADM-09, OPS-05).**
  - Vercel builds admin previews only on `staging` and `develop` (`scripts/ignore-build.sh`; a `vercel.json` command may
    be at most 256 characters, and the first, inline form failed every admin deployment).
  - A preview build that points at the production database fails before it builds (`previewGuard.ts`).
  - The production fallback in `lib/supabase.ts` is gone.
  - The admin CSP now also allows vyact-test, which `stage-admin` and `dev-admin` use.
- **Help** no longer tells you to grant roles in SQL, use a pulse score or a Suspend button the console does not
  have.

---

## v1.4.7 — Intelligence counts model calls once *(2026-10-19)*

Ships with consumer v10.122.0 and its migration `20261105120000_t5c_ai_usage_summary_sources.sql` (audit FE-PIP-09;
owner, 19 Oct 2026: "admin counts read only the server's rows").

- **The KPI row counts model calls**, from the server's own rows: "Model calls", "Calls, last 7 days", "Calls,
  last 30 days". It used to add the app's row for each turn to the server's row for each call, so a two-call
  turn counted three times. Cost, tokens and latency are the calls' alone.
- **Intent, sentiment and user segments are turns**, from the app's rows. Those now exist only for turns
  that called the model, so quick replies no longer weigh on them.

---

## v1.4.6 — The Pulse Score is archived *(2026-10-18)*

Ships with consumer v10.109.0 (owner decision, 16 Oct 2026: "Archive the concept of Pulse").

- The Dashboard's "Pulse improved 30d %" placeholder is gone, and so are the unused Pulse fields in the types.
- Intelligence colours the consumer's renamed `status` intent bucket. Rows written before keep `pulse`.

---

## v1.4.5 — Audit Log without values (ADM-03) *(2026-10-13)*

Owner decision, 13 Oct 2026: admins see who did what and when in a household, never the values. Ships with
consumer v10.93.0, which makes the activity_log table members only.

- **The Audit page reads `admin_activity_feed`** (consumer v10.92.0) instead of the activity_log table.
  The feed returns the time, household, actor, action and entity, never `changes` (the row images with
  amounts, payees, descriptions and names).
- **The diff column is gone**, and the CSV export no longer has a `changes` column.
- **The labels say what is true:** "household activity · who, what and when, never the values". The
  "append-only" label and "admins read-all via RLS policy" are gone, because neither was true.
- **Help:** the two answers that promised a JSON diff and an IP column now describe the page as it is. They
  also say the console has no record of admin actions yet (ADM-04).

Tests: adm03AuditFeed.test.ts (3):
- the page calls the feed and never a table;
- no values in the page, the CSV or Help;
- the Privacy sentence and the new policy version.

## v1.4.4 — W8c: admin fixes from the audit *(2026-10-09)*

Admin fixes from the 2026-10-04 audit (owner plan W8, batch c, including the earlier W7c items). No
schema change.

- **Household types (INT-CON-06, INT-HH-14).** The Households page shows today's four types (Personal,
  Couple, Family, Business) with a Couple count; retired `shared` / `multi_biz` rows read as Family /
  Business, the same rule as the consumer app (a parity test pins it).
- **Publishing (ADM-11).** Editing a published item keeps its original publish date (it used to re-date it
  to now), and the public byline is "Vyact" (owner decision) — an editor's email address was published
  as the author.
- **Infographics (ADM-10).** A replaced infographic is deleted only after the save succeeds (a failed
  save left the item pointing at a deleted image), and deleting an item removes its image too.
- **Settings (ADM-12).** The database status is a live check (Checking / Connected / Unreachable), the
  project ref comes from the build's own configuration, and the hard-coded GA4 "connected", the
  unverified region and the stale "wires in v1.1.0" promises are gone. The version in the sidebar,
  the Settings footer and the client header comes from the build (they read v1.0.5, v1.0.0, v1.1.0).
- **Revenue (ADM-14).** MRR and ARR are shown per currency over active and trialing subscriptions; they
  were one sum across currencies labelled USD.
- **Hardening (ADM-13).** admin.vyact.app sends a strict Content-Security-Policy (only itself, its
  Supabase project and Google Fonts; no inline scripts), and production builds publish no source maps
  (a build step fails if one appears).

---

## v1.4.3 — Admin MFA row tells the truth *(2026-10-06)*

- **Settings › Security › Admin MFA** said "Required for privileged access … tracked for v1.4.0".
  Owner decision (audit 2026-10-04, D23, shipped with consumer v10.61.0): no two-factor
  authentication for the consumer app or admin. The row now says "Not used" and that admin
  sign-in is password-only. No behaviour change.

---

## v1.4.2 — Pip answer feedback *(2026-10-02)*

- **Intelligence › Pip answer feedback:** how members rate Pip's answers (👍 / 👎, consumer
  v10.54.0): the helpful share, counts, the last 30 days, the split by question intent, and the
  latest ratings (when, rating, intent, surface, answer length). Read through
  `admin_ai_feedback_summary()` (admin-gated, migration `20261005120000_ai_feedback`). No question
  or answer text is stored or shown.
- It loads separately from the usage metrics, so if the feedback read fails the rest of the page
  still shows.

## v1.4.1 — The sign-in screen shows the real version *(2026-10-01)*

- The sign-in screen read "Vyact Admin Console · v1.0.4", hard-coded since v1.0.4 (master to-do
  #67). It now shows the version from `package.json`, inlined at build time (`__APP_VERSION__`
  via `vite.config.ts` `define`, the same pattern the consumer app uses).
- No data or permission change.

## v1.4.0 — Google sign-in, and no analytics *(2026-09-29)*

- **Continue with Google** on the sign-in screen (marketing #40): no password step for admins.
  Access is still decided server-side by `admin_roles`; signing in grants nothing by itself.
  **Owner action:** add each admin origin (https://admin.vyact.app and the stage/dev admin
  domains) to Supabase → Authentication → URL Configuration → Redirect URLs, or Google returns
  to the consumer app instead.
- **Google Analytics removed** from the admin app (marketing #3): admins are not users, and
  their visits were counted as product traffic.

## v1.3.2 — admin.vyact.app *(2026-09-12)*

The admin app's public identity moves from `vyact-admin.vercel.app` to **`admin.vyact.app`**, a
true subdomain of the consumer app's new `vyact.app` domain. `VITE_APP_URL` in
`admin/.env.production` updated to match; the live-URL reference in the in-app FAQ
(`pages/Help.tsx`) corrected — it had drifted to an even older orphaned URL
(`react-taupe-xi.vercel.app`) and a stale description of how `VITE_APP_URL` is set. No Supabase
changes needed for this move: admin sign-in is `signInWithPassword` only (no
`emailRedirectTo`/`redirectTo`), and nothing in `admin/src` calls a Supabase Edge Function, so
neither Auth's Redirect URLs nor CORS is affected. `vyact-admin.vercel.app` continues to work
during the cutover.

## v1.3.1 — Infographic upload on every Content item *(2026-07-04)*

Content editors can now upload a full-length portrait infographic image (authored outside
Vyact, e.g. NotebookLM) to any `content_items` row, alongside the v1.3.0 video-short field.
Shared **`InfographicField`** in `pages/Content.tsx` (upload / replace / remove with a live
preview) is reused across all three format modals, uploading immediately to the app's first
Supabase Storage bucket (`insight-infographics`) via new `uploadInfographic()`/
`deleteInfographic()` helpers in `lib/contentApi.ts`. The list view gains an image-icon badge
(hover for "last updated") next to the existing video badge.

`upsertContent()` follows the same only-bump-on-change pattern as `video_updated_at`: editing
an unrelated field never makes an infographic look freshly updated, and replacing/removing one
best-effort deletes the previous Storage object.

DB migration `20260704120000_v991_insight_infographics.sql` (additive `content_items.
infographic_url`/`infographic_updated_at` + the storage bucket/RLS) — shared with the consumer
app, applied once to the live Supabase project. Pairs with consumer v9.9.1, which makes the
infographic (with a video/article overlay) the universal way every card/article opens.

## v1.3.0 — Video-short field on every Content item *(2026-07-02)*

Content editors (Content role / Super) can now attach a YouTube short URL to any
`content_items` row — evergreen card, article, or curated external item — from the same
Content CMS used for everything else. Shared **`VideoUrlField`** in `pages/Content.tsx` is
reused across all three format-specific modals (Article / Card / External); the list view
shows a small YouTube-icon badge (hover for "last updated" date) on any row with a video
linked.

`lib/contentApi.ts`'s `upsertContent()` auto-manages `video_updated_at` — it only bumps the
timestamp when the URL actually changes (compares against the new `prev_video_url` field on
`ContentInput`), so editing an unrelated field on a row doesn't make its video look freshly
updated. Pairs with consumer v9.9.0, which renders these links as an in-app click-to-play
short + an "Open in YouTube" redirect.

DB migration `20260702120000_v99_insight_video_shorts.sql` (additive `content_items.video_url`
/ `video_updated_at`) — shared with the consumer app, applied once to the live Supabase project.

## v1.2.0 — Insights Hub authoring: cards + external curation *(2026-06-20)*

Admin side of the Insights Hub (spec `docs/insights-integration-spec.md` §C). The
Content module now manages all three `content_items` formats, not just articles.

- **Card authoring** (`format='card'`): a New Card form with title, category, tone,
  body (live word-count toward the ≤120 target), tags, reading-time, India-relevant,
  and a **visual picker** constrained to the closed set (spec §D) — 57-icon
  allowlist · stat (big/sub) · diagram primitive (arc/arrow/bar2/compare2/stack)
  with per-primitive params. A **live preview** (`CardVisualPreview`) renders with
  the same logic the consumer ships, so author-preview == shipped pixel. Category →
  legacy `topic` is mapped automatically.
- **External curation** (`format='external'`): a form constrained to the source
  **allowlist** (RBI / SEBI / IncomeTax / PFRDA_NPS / GovScheme), source URL,
  a one-line "why it matters", published date (drives What's New ordering), and
  tags. Link-out only — no source body is stored.
- The content list shows a **format badge**; each item edits through the right form.
- New `lib/visualKit.ts` (allowlists + defaults) and `components/CardVisualPreview`.

DB constraints (the v9.5.4 migration) enforce the contracts: a card without a
visual, or an external without a valid allowlisted source/url, is rejected (verified).

Also corrects this changelog's banner, which had drifted to `v1.0.8` while the
package shipped `v1.1.0`.

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

Smoke-tested the three new RPCs as `authenticated` user `owner@example.com` (super admin):

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
