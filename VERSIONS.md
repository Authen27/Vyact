# FinFlow — Version History

> A complete changelog of every release of FinFlow. Newest first.

---

## **v6.3.1 — Admin dashboard sanitised: every page on live data** *(current — 2026-05-10)*

The user flagged that the admin dashboard wasn't reflecting actual production data — KPIs, users, households, audit, subscriptions were all driven by a bundled `mockData.ts`. This release deletes the mock layer entirely and routes every admin page through the live Supabase project (`dmxqkvploojokffuhxnz`).

### What's now live data (everything that can be computed)

A new `admin_data_layer` migration adds:

- **`public.subscriptions`** — full schema (tier · status · MRR · currency · Stripe sub id · failure count) with `updated_at` trigger and `is_admin('roles')` RLS. Empty in production until v6.4 wires Stripe webhooks; the page reflects this honestly with an explicit "billing not wired" callout instead of fake numbers.
- **Admin-bypass `SELECT` RLS policies** on the seven previously household-scoped tables (`households`, `memberships`, `profiles`, `activity_log`, `transactions`, `budgets`, `goals`, `debts`, `assets`) gated by `is_admin('roles')`. Lower-tier consumers are unaffected; admins can now read across households for KPI computation.
- **`public.admin_list_users()`** — `SECURITY DEFINER STABLE` RPC that joins `auth.users` with `profiles`, `memberships`, `admin_roles`. Returns email-confirmation status, household count, and admin-tier badge per user. Required because anon-key clients cannot read `auth.users` directly.
- **`public.admin_dashboard_kpis()`** — single-row JSON RPC that returns 13 live metrics: total users / households / transactions, multi-member %, 7-day actives (users + households), 7-day & 30-day signups, 7-day & total transaction counts, published articles, content favourites, paid subscription count, MRR, computed-at timestamp. Authorised by `is_admin('roles')`.
- **`public.admin_weekly_trend(weeks int default 12)`** — series RPC powering the Dashboard's three trend charts (signups · active users · new transactions).

### Pages rewritten to live data

- [`Dashboard.tsx`](admin/src/pages/Dashboard.tsx) — every number from `admin_dashboard_kpis()`. Three Recharts area/bar charts driven by `admin_weekly_trend()`. KPIs that require event tracking we don't have yet (D7/D90 retention, NPS, Pulse-improved%, recs-followed%, chat-satisfaction, time-to-first-txn) are rendered as `—` placeholders with hover-tooltips explaining what's needed. Refresh button. Computed-at footer.
- [`Users.tsx`](admin/src/pages/Users.tsx) — list from `admin_list_users()` with verified-email badge, admin-tier shield, household count, joined date, last-seen date. Search + 4 KPI cards.
- [`Households.tsx`](admin/src/pages/Households.tsx) — card grid from `households` joined with `memberships` count. Type colour-coded.
- [`Subscriptions.tsx`](admin/src/pages/Subscriptions.tsx) — reads from `public.subscriptions`. Empty state shows the "billing not wired" callout pointing at v6.4 roadmap. MRR/ARR/active/failures tiles + tier-mix donut + row table — all driven by real columns, just zero rows currently.
- [`Audit.tsx`](admin/src/pages/Audit.tsx) — last 200 rows from `activity_log` with collapsible JSON-diff and CSV export.
- New [`admin/src/lib/adminApi.ts`](admin/src/lib/adminApi.ts) — all six fetchers (`fetchDashboardKpis`, `fetchWeeklyTrend`, `fetchAllUsers`, `fetchAllHouseholds`, `fetchAllSubscriptions`, `fetchActivityLog`).

### What's gone

- **Deleted** `admin/src/lib/mockData.ts`. Zero remaining references in the admin codebase (`grep -rn mockData` returns nothing).

### Honest-by-design empty states

- `subscriptions` empty → explicit "billing not wired" callout, not fake $X MRR.
- Cohort metrics that need event-tracking infrastructure → `—` cards with an explainer for each, not invented numbers.
- Audit log filterable by query string from the global search bar.

### Validated

- Smoke-tested the three new RPCs as `authenticated` user `uday.kr27@gmail.com` (super admin):
  - `admin_dashboard_kpis()` → returns `{totalUsers:2, totalHouseholds:2, signups7d:1, publishedArticles:5, contentFavorites:1, ...}` (real numbers from production).
  - `admin_list_users()` → returns 2 rows with the seeded users + their admin tiers.
  - `admin_weekly_trend(4)` → returns 4 weekly buckets with non-zero `signups` and `active_users` for the current week.
- `tsc -b && vite build` clean (`✓ 2431 modules transformed`).

### Files changed

```
admin/src/lib/mockData.ts                             — DELETED
admin/src/lib/adminApi.ts                             — NEW
admin/src/pages/Dashboard.tsx                         — rewritten (live KPIs + trend RPC)
admin/src/pages/Users.tsx                             — rewritten (admin_list_users)
admin/src/pages/Households.tsx                        — rewritten (households + memberships)
admin/src/pages/Subscriptions.tsx                     — rewritten (live + empty-state callout)
admin/src/pages/Audit.tsx                             — rewritten (activity_log + CSV export)

db/migration: admin_data_layer                        — applied to dmxqkvploojokffuhxnz
```

### Roadmap

- **v6.4** — Stripe webhook → `subscriptions` (active billing). Event-tracking pipeline → unblocks the 8 cohort metrics currently rendered as `—`.

---

## **v6.3 — Content module + admin↔Supabase + global Add-Txn modal** *(2026-05-10)*

### Add Transaction button — actually fixed this time

The previous v6.2.2 wired the button on the *Transactions* page only. There is a **second** Add Transaction button on the **Dashboard** that was still a no-op stub. Both are now fixed via a single store-controlled modal hoisted to App root.

What changed:

- **Store** ([`react/src/store.ts`](react/src/store.ts)) — new `txnModalOpen` / `editingTxn` state + `openAddTxn()` / `openEditTxn()` / `closeTxnModal()` actions. Any page can trigger the modal without prop-drilling.
- **App.tsx** — `<TransactionFormModal />` mounted once at the root, alongside `<ToastHost />`. The modal binds to store state by default; explicit `open` / `initial` / `onClose` props are still supported for ad-hoc usage.
- **Dashboard.tsx** — Add Transaction button wired to `openAddTxn()`.
- **Transactions.tsx** — local modal state removed; both the page-level button and the per-row Edit button now route through the store.
- **Browser-verified end-to-end** via Claude in Chrome MCP: clicked the Dashboard button → modal opened → filled `description=Test, amount=42.50` → Add → transaction appeared in `/transactions` list as `−$42.50, Food & Dining` → clicked Edit → modal re-opened pre-populated. Screenshot saved.

### Content module — admin authors, consumers read

A dynamic, searchable, favoritable content surface that connects the admin and consumer apps via shared Supabase tables.

**DB migration `content_items_and_user_favorites` applied:**

- `public.admin_roles (user_id, role, granted_by, granted_at)` — server-side source of truth for who is an admin (super / roles / content). RLS allows self-read only. Granted `uday.kr27@gmail.com` the `super` tier.
- `public.is_admin(min_role text)` — `SECURITY DEFINER STABLE` helper. Bypasses RLS to check the calling user's tier. Granted EXECUTE to `authenticated`.
- `public.content_items (id, slug, title, summary, body, topic, status, author_name, read_minutes, cover_emoji, published_at, created_at, updated_at)` — articles. Indexed on `(status, published_at DESC)` and `topic`. RLS:
  - SELECT — anyone authenticated reads `status='published'`; admins read all
  - INSERT / UPDATE / DELETE — `is_admin('content')` only
- `public.content_favorites (user_id, content_id, created_at)` — per-user reading list. RLS scoped to `user_id = auth.uid()` for all operations.
- `touch_updated_at()` trigger on `content_items`.
- 5 starter articles seeded (savings, debt, retirement, budgeting, tax).

**Admin app — `admin/`:**

- New [`admin/src/lib/supabase.ts`](admin/src/lib/supabase.ts) — singleton client pointing at the same `dmxqkvploojokffuhxnz` project as the consumer.
- New [`admin/src/lib/auth.ts`](admin/src/lib/auth.ts) — `signIn()`, `signOut()`, `fetchMyAdminRole()` reading from `admin_roles`.
- New [`admin/src/lib/contentApi.ts`](admin/src/lib/contentApi.ts) — `listAllContent()`, `upsertContent()`, `deleteContent()`, `slugify()`.
- New [`admin/src/components/AuthGate.tsx`](admin/src/components/AuthGate.tsx) — top-level gate. Four states: loading / not-signed-in / signed-in-but-not-admin / signed-in-and-admin.
- Store extended with `session`, `serverRole`, `setSession()`. The role-switcher in the sidebar is now a **preview-only override** for Super Admins (lower-tier admins see their server role locked).
- [`admin/src/pages/Content.tsx`](admin/src/pages/Content.tsx) — fully rewritten to read from real Supabase. New article form modal (title auto-generates slug; topic, status, read-minutes, cover emoji). Edit + delete from the row.

**Consumer app — `react/`:**

- New [`react/src/lib/insightsApi.ts`](react/src/lib/insightsApi.ts) — `listPublishedContent()`, `listFavoriteIds()`, `addFavorite()`, `removeFavorite()`.
- New [`react/src/pages/Insights.tsx`](react/src/pages/Insights.tsx) — card grid of published articles. Features:
  - Topic chip + read-minute estimate per card.
  - Search across title / summary / body / topic.
  - Topic filter row (`debt · tax · investment · budgeting · savings · retirement`).
  - **Favorite (♡)** toggle per card with optimistic update + rollback on error. Favorites are user-scoped, not household-scoped.
  - **Favorites-only filter** to view your reading list.
  - **Reader modal** with full body text, summary as a coral block-quote, and an in-modal favorite button.
  - Local-only mode shows a graceful "cloud required" empty state.
- Sidebar nav item under ANALYZE → "insights" with a `BookOpen` icon.
- New `/insights` route registered in `App.tsx`.

**Browser-verified end-to-end:** loaded `/insights`, all 5 seeded articles rendered with topic chips. Clicked ♡ on "Emergency fund: 3 months or 6 months?" → favorite saved. Opened the article → reader modal showed the full body. SQL query against `content_favorites` confirmed the row landed in the database.

### Admin Help / User Manual

New [`admin/src/pages/Help.tsx`](admin/src/pages/Help.tsx) and `/help` route, accessible to all three tiers (Super, Roles, Content). 17 topics organised by audience badge. Filter chips: `mine` (auto-selects topics relevant to your current role), per-tier filters, and `all`. Three top-of-page tier cards explain the privileges of each role with the user's own tier highlighted.

### What's *not* yet wired to Supabase (intentional, called out)

The admin app's Users / Households / Subscriptions / Audit / Dashboard KPIs pages still read from `admin/src/lib/mockData.ts`. Wiring each entity end-to-end (read + write + RLS + UI) is meaningful work and warrants its own release. Content was prioritised because it's the first cross-app feature where admin-authored data shows up in the consumer experience — the rest of the admin entities are pure read-only reports against tables that already exist.

Roadmap entry adjusted: **v6.3.1** to wire Users + Households + Audit Log to the live `auth.users` / `households` / `activity_log` tables.

### Files changed

```
admin/.env.local                                      — Supabase env (already present)
admin/package.json                                    — added @supabase/supabase-js
admin/src/vite-env.d.ts                               — NEW (vite/client types)
admin/src/lib/supabase.ts                             — NEW
admin/src/lib/auth.ts                                 — NEW
admin/src/lib/contentApi.ts                           — NEW
admin/src/components/AuthGate.tsx                     — NEW
admin/src/components/Layout.tsx                       — sign-out wired, role-switch gated to super, Help nav item
admin/src/store.ts                                    — session + serverRole hydration
admin/src/App.tsx                                     — AuthGate wrap, /help route
admin/src/pages/Content.tsx                           — rewritten to use Supabase
admin/src/pages/Help.tsx                              — NEW

react/src/store.ts                                    — global txnModalOpen + actions
react/src/App.tsx                                     — global modal mount, /insights route
react/src/pages/Dashboard.tsx                         — Add Transaction onClick
react/src/pages/Transactions.tsx                      — store-driven modal
react/src/components/transactions/TransactionFormModal.tsx — store fallback bindings
react/src/components/layout/Sidebar.tsx               — Insights nav item
react/src/lib/insightsApi.ts                          — NEW
react/src/pages/Insights.tsx                          — NEW

db/migration: content_items_and_user_favorites        — applied to dmxqkvploojokffuhxnz
```

### Validated scenarios

| # | Scenario | Result |
|---|---|---|
| 1 | Click Add Transaction on **Dashboard** | Modal opens (was no-op before) |
| 2 | Submit Add form | Transaction persists to Supabase, shows in `/transactions` list |
| 3 | Click Edit on a transaction row | Modal re-opens pre-populated with values |
| 4 | Load `/insights` as authed consumer user | 5 published articles render with topic chips |
| 5 | Click ♡ on an article | Favorite saved to `content_favorites`; SQL confirmed |
| 6 | Click Read | Reader modal shows full body text |
| 7 | Build admin app | `tsc -b && vite build` clean |
| 8 | Build consumer app | `tsc -b && vite build` clean |

---

## **v6.2.2 — Add-Transaction wiring + GA4** *(2026-05-10)*

A small but user-blocking patch on top of v6.2. Two follow-ups landed in the same day after v6.2 ship:

### Add Transaction button now opens a real dialog

The `Add Transaction` button at [`react/src/pages/Transactions.tsx:55`](react/src/pages/Transactions.tsx) was a stub left over from the v6.0 React port — `<Button>+ Add Transaction</Button>` had no `onClick` handler, so it was silently a no-op. The same was true for the per-row `Edit` button at [`react/src/components/transactions/TxnRow.tsx:65`](react/src/components/transactions/TxnRow.tsx).

What ships:

- **New** [`react/src/components/transactions/TransactionFormModal.tsx`](react/src/components/transactions/TransactionFormModal.tsx) — full add/edit dialog reusing the existing `Modal` / `Input` / `Select` / `Field` / `Button` primitives. Fields covered:
  - Type (Expense · Income · Investment · Transfer)
  - Date · Description · Amount · Currency (12 supported)
  - Category — auto-filtered to `INCOME_CATEGORIES` / `EXPENSE_CATEGORIES` based on the selected type
  - Member · Payment method (30+ banks/cards/wallets) · Recurring (weekly/monthly/yearly) · Note
  - "🔒 Private — exclude from totals, charts and Pulse Score" checkbox
  - Save calls `upsertTransaction()` via the Zustand store; in cloud mode this writes through `HybridAdapter` → Supabase.
  - Edit mode also exposes a `Delete` action that calls `removeTransaction()`.
- **Wired** the page-level button to open the modal in add-mode; `useShortcuts({ n, N })` restores the **N** shortcut documented in Help.
- **Wired** the per-row `Edit` button to open the same modal pre-populated with the row's data via a new `onEdit?: (t: Transaction) => void` prop on `TxnRow`.

### Google Analytics 4 (GA4)

The standard `gtag.js` snippet for property `G-E3XKWZP850` is added to all three entry HTML files:

- [`index.html`](index.html) — v5 vanilla shell
- [`react/index.html`](react/index.html) — consumer React app
- [`admin/index.html`](admin/index.html) — admin React app

Snippet placed in `<head>` after `<title>` and before font preconnects so the GA4 collector loads early. Async loading means it never blocks paint.

> No client code references `gtag()` for custom events yet — pageviews are auto-tracked. Custom event tagging (sign-up, transaction-added, household-created) lands in v6.3 once the event taxonomy is agreed.

### Files changed

```
index.html                                               — GA4 snippet
react/index.html                                         — GA4 snippet
admin/index.html                                         — GA4 snippet
react/src/components/transactions/TransactionFormModal.tsx — NEW
react/src/components/transactions/TxnRow.tsx             — onEdit prop + Edit handler
react/src/pages/Transactions.tsx                         — modal state + N shortcut
```

---

## **v6.2.1 — Households RLS recursion hotfix** *(2026-05-10)*

Right after v6.2 deployed, signed-in users hit `{"message":"No API key found in request"}`. The error message is misleading — Kong/PostgREST returns it on a number of error paths. The actual root cause was an **RLS infinite recursion** on the `households` and `memberships` tables.

### What was happening

- `households` SELECT policy ran `EXISTS (SELECT 1 FROM memberships WHERE …)`.
- `memberships` SELECT policy ran `EXISTS (SELECT 1 FROM memberships m2 WHERE …)` — referencing **itself**.
- Postgres detected the cycle and aborted the query with error code `42P17`.
- PostgREST surfaced this as HTTP 500 on `GET /rest/v1/my_households`, which the Supabase gateway/cache occasionally re-shaped into the misleading apikey message.

Live API logs (last 24h) showed the smoking gun: a long sequence of `POST /auth/v1/token (200)` followed immediately by `GET /rest/v1/my_households (500)` for every user session.

### Fix shipped (server-side migrations)

Two `db/migration` operations, no client redeploy needed:

```sql
-- migration: fix_rls_recursion_via_security_definer_helpers
DROP POLICY "members read household"    ON public.households;
DROP POLICY "members see other members" ON public.memberships;

CREATE POLICY "members read household" ON public.households
  FOR SELECT USING ( public.is_member(id) );

CREATE POLICY "members see other members" ON public.memberships
  FOR SELECT USING ( public.is_member(household_id) );

-- migration: grant_execute_on_rls_helpers
GRANT EXECUTE ON FUNCTION public.is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.role_in(uuid)  TO authenticated;
```

`is_member(h_id)` and `role_in(h_id)` are existing `SECURITY DEFINER STABLE` SQL functions. Calling them from inside the policy bypasses RLS on the `memberships` look-up — no cycle, no recursion. The functions still enforce auth via `auth.uid()` internally.

### Validated

Impersonating both signed-up users via `SET ROLE authenticated; SET LOCAL request.jwt.claim.sub = …`:

| User | Result post-fix |
|---|---|
| `uday.kr27@gmail.com`     | Returns `My Household · personal · USD · owner` |
| `bhushandandolu8@gmail.com` | Returns `My Household · personal · USD · owner` |

Browser hard-refresh (Ctrl+Shift+R) clears any cached 500 response.

---

## **v6.2 — Friction-free signup + module port-out** *(2026-05-10)*

The remaining v5 modules ship as full React pages, the cloud signup flow stops stranding users on a household-less account, and email verification becomes optional rather than a gate.

### Pages ported from v5 stubs to React (consumer app at `react/`)

All seven pages that previously linked back to the v5 vanilla shell are now native React components reading from the Zustand store and the `HybridAdapter`:

- **Settings** — profile (display name + email + household type + date format), three-card theme picker (Paper Warm / Dark / System), language + base currency, editable USD-base exchange rates table (inline-edit + blur to save), debt preferences (Avalanche/Snowball + monthly extra payment), Sync & Backup (JSON snapshot · CSV transactions · clipboard copy), 8-counter account stats grid. Now also surfaces email-verification status and an explicit "Run onboarding wizard" link (see below).
- **Budgets** — monthly budget grid wired to `spendByCategory()` for live progress. Per-row status pills: On track (green) · Near (amber, ≥ 80%) · Over (red, ≥ 100%). Summary strip (total budgeted · total spent · over-count). Add/edit form with category selector, currency, amount, and `BUDGET_COLORS` palette.
- **Goals** — 6-type goal cards with progress bars converted to base currency, deadline-countdown chip (overdue · < 30 days · normal), inline `+ Progress` prompt, mark-done/reopen toggle, completed-goals collapsible section.
- **Debts** — list sorted by `profile.payoffStrategy` with priority badge on the top item. Summary strip: total debt · min monthly payment · DTI %. Add/edit form, EMI breakdown toggle (interest vs principal via `splitEmiPortions`), `Record Payment` modal with the three part-payment choices (`reduce_tenure` / `reduce_emi` / `apply_advance`), payoff progress bar.
- **Net Worth** — Hero (Assets − Liabilities, sign-aware colour). Four ratio cards: Liquidity Ratio · Debt-to-Asset · Emergency Coverage (months) · Savings Ratio. Asset add/edit form with `ASSET_TYPES`. Balance sheet split: assets grouped by liquidity tier (Liquid / Short-term / Long-term) versus debts column.
- **Splits** — IOU summary (Owed to you · You owe via `splitsOutstanding()`), expandable split-transaction rows, per-participant Mark paid / Settle buttons, `Settle all` bulk action.
- **Help** — searchable 17-section accordion; topics cover Pulse Score, Budgets, Goals, Debt management, Net Worth, Splits, Planner, Recurring, Multi-currency, Multi-household, Backup, Keyboard shortcuts, Themes, Privacy, Languages, Transaction types.

The `<Stubs />` placeholder is removed from the router; every nav item now reaches a native React page.

### Onboarding becomes opt-in (no more forced wizard)

Two problems with the previous gate:
1. **Local-mode users** were forced through a 4-step wizard before they could see the app, even if they had no interest in the templates.
2. **Cloud users** were never shown the wizard at all because the gate was `!cloudEnabled`-only — but `SignUp.tsx` still called `navigate('/onboarding')` to a route that didn't exist, so users fell through to `/dashboard` with an empty household.

What ships now:
- The forced gate in `App.tsx` is removed. Existing or fresh users without `profile.template` / `profile.onboardedAt` land on the dashboard like any other user — no onboarding wall.
- `/onboarding` is registered as a real route, reachable from the new Settings link (`Run onboarding wizard →` / `Re-run onboarding wizard →`) and from the wizard's own internal navigation. The page is unchanged — only its discoverability is.
- Existing users see the link as `Re-run onboarding wizard →` if they previously completed it.

### Cloud signup no longer strands users on a household-less account

**Root cause** identified in the live Supabase project: `handle_new_user` only inserted into `public.profiles` and never created a household. New users got an authenticated session but `households: []`, which made the consumer app silently fall back to `currentHouseholdId='local'` — so the app appeared blank with no way to recover. Both seeded users on the project were in this state (`bhushandandolu8@gmail.com`, `uday.kr27@gmail.com` — household_count=0).

**Migration `auto_create_household_on_signup` applied:**
- `handle_new_user()` rewritten as `SECURITY DEFINER` with `search_path = public`. It still inserts the profile, then immediately inserts a default `My Household` row (type=`personal`, base currency USD) for the new user. The pre-existing `handle_new_household` trigger fires on that insert and writes the owner membership.
- One-shot backfill: `INSERT INTO households … FROM auth.users LEFT JOIN memberships WHERE m.user_id IS NULL` — ensured every existing auth user has at least one household.

Result: every new and existing cloud user now has a usable household before the first dashboard render.

### Email verification is no longer a gate

Built-in Supabase email delivery is rate-limited and unreliable. Rather than block signups behind an email round-trip, verification is now informational:

- `pages/auth/SignUp.tsx` — three-path signup:
  - **Path A** — auto-confirm enabled: session returned by `signUp()`, navigate straight to `/dashboard`.
  - **Path B** — confirmation enabled but password sign-in still works: immediately call `signIn(email, password)` so the user lands on `/dashboard` without waiting for an email. Shown as "verification pending" in Settings.
  - **Path C** — strict confirmation required: a non-blocking screen says the account is created and offers a `Continue to sign in →` button (with email pre-filled), instead of the previous dead-end "we sent you an email" wall.
- The "verify email" copy on the signup form is replaced with: *"Email verification is optional — you'll get full access immediately. Verify anytime from Settings to enable password recovery."*
- **Settings → Profile** now shows a status pill (`Email verified` sage / `Verification pending` honey) plus a `Resend` button that calls `auth.resend({ type: 'signup', email })`.

To make the recommended Path A the default, set Supabase Dashboard → Authentication → Providers → Email → **"Confirm email"** to OFF for the project. The client works correctly with the setting in either position; OFF just removes one round-trip.

### Files changed

```
react/src/App.tsx                       — drop forced onboarding gate, add /onboarding route
react/src/pages/auth/SignUp.tsx         — three-path signup (no email-verification wall)
react/src/pages/Settings.tsx            — verification status pill, resend, onboarding link
react/src/pages/Settings.tsx            — NEW (port from v5)
react/src/pages/Budgets.tsx             — NEW (port from v5)
react/src/pages/Goals.tsx               — NEW (port from v5)
react/src/pages/Debts.tsx               — NEW (port from v5)
react/src/pages/NetWorth.tsx            — NEW (port from v5)
react/src/pages/Splits.tsx              — NEW (port from v5)
react/src/pages/Help.tsx                — NEW (port from v5)
db/migration: auto_create_household_on_signup  — applied to project dmxqkvploojokffuhxnz
```

### Validated scenarios

| # | Scenario | Result |
|---|---|---|
| 1 | Fresh sign-up with email confirmation OFF | Auto-confirm path → straight to dashboard, household auto-created by trigger |
| 2 | Fresh sign-up with email confirmation ON, password works | Auto sign-in fallback → dashboard with "Verification pending" badge in Settings |
| 3 | Fresh sign-up with strict confirmation gate | Non-blocking "Continue to sign in" screen, account already exists |
| 4 | Existing user (no preferences set) signs in | Lands on dashboard — no forced wizard, opt-in link visible in Settings |
| 5 | Existing user clicks "Run onboarding" from Settings | Wizard opens, completes, navigates to dashboard with template applied |
| 6 | Backfilled existing users (`uday.kr27`, `bhushandandolu8`) | Both now have 1 household each (was 0); next login reads it correctly |
| 7 | Resend verification email from Settings | `auth.resend()` succeeds; toast confirms |

### Roadmap

- **v6.3** — Replace `prompt()` calls in Goals "+ Progress" with a proper modal · paginate Transactions on large datasets · split chart libraries into a dynamically-imported chunk (the current bundle warns at 1 MB) · GA4 custom event taxonomy (sign-up, transaction-added, household-created, pulse-score-improved).
- **v7.5.1** — Resend Edge Function (already deployed) wired to a custom SMTP setting in `auth.config` once Resend domain is verified, allowing Path C ("strict confirmation") to feel as fast as Path A.

---

## **v4.1 — Cloud · Auth · Multi-Household**

The features deferred from v5 land. The React app at `react/` now wires a real Supabase backend behind the existing `DataAdapter` interface. **Local-only mode still works** — if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are unset, the app boots exactly as v6/v7 did.

### What ships

**Auth**
- Email + password sign-up with verification
- Magic link sign-in
- Password reset flow
- OAuth helpers (Google/Apple/GitHub) — wired in `lib/auth.ts`, ready for provider config in Supabase
- Session persistence + auto-refresh
- Sign out from sidebar footer

**Data layer**
- `SupabaseAdapter` — full DataAdapter implementation against the Postgres schema in `db/schema.sql`. Maps every JS shape to/from snake_case columns. Soft-delete for syncable tables.
- `HybridAdapter` — production model: instant paint from LocalStorage cache, background refresh from Supabase, optimistic writes with a write queue that flushes when online. Graceful offline behaviour.
- Adapter selector in `store.ts` — picks `HybridAdapter` if env vars present, else `LocalStorageAdapter`. Identical interface either way.

**Multi-household**
- Cloud-backed `listHouseholds()` against the `my_households` view
- `createHousehold(name, type, currency)` — auto-creates an `owner` membership via the schema's trigger
- ProfileSwitcher now shows real cloud households when authed; click to switch (loads that household's data + subscribes to its realtime channel)
- New **Households** page (`/households`) — manage every household: members list, role editing, removal, danger zone (rename/leave/delete). Cards mark the active household.

**Invitations**
- Send by email with role + household role — creates a row in `invitations` with a unique token (14-day expiry)
- Pending invitations panel on the household page with copy-link button
- `/invite/:token` route → `accept_invitation()` Postgres RPC — validates expiry, email match, creates membership atomically, writes activity log entry
- Inviter gets back a magic-link URL they can copy if no email service is wired (Edge Function `send-invite-email` is the production path)

**Roles & permissions**
- Five-level hierarchy: `owner` > `admin` > `member` > `viewer` + scoped `child`
- `lib/permissions.ts` exposes `can(role, action)` and `canRemove()` helpers
- Server-side enforcement via Postgres RLS policies in `db/schema.sql` — clients can't bypass
- UI gates buttons (e.g., the Invite button only appears for owners/admins)
- `transfer_ownership(h_id, to_user)` and `leave_household(h_id)` RPCs added to schema

**Realtime**
- `subscribeRealtime(householdId)` in store opens a Postgres CDC channel filtered to the active household
- Family members see each other's edits within ~1 second — via `store.refresh()` triggered on any change event

**Activity log**
- Schema already had the `activity_log` table; v4.1 surfaces it on the household page (last 30 entries, action + entity + timestamp)
- Future: SIEM export per v8 admin app

**Migration**
- `lib/migration.ts` exposes `migrateLocalToCloud(adapter, name, type, currency)` which reads the legacy localStorage snapshot and pushes every row through the adapter into a fresh cloud household
- Migration banner on Settings prompts existing v6/v7 users on first sign-in (TODO wired during v4.1.1)

### Schema additions

`db/schema.sql` now includes three RPCs that v4.1 calls:
- `accept_invitation(invite_token text)` — atomic invitation acceptance with email validation
- `transfer_ownership(h_id uuid, to_user uuid)` — atomic role swap, owner ↔ admin
- `leave_household(h_id uuid)` — guards against sole-owner leaving without transfer

All three are `security definer` and granted to `authenticated` role.

### Env setup

```bash
cp react/.env.example react/.env.local
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
cd react && npm install && npm run dev
```

Without those vars, the app continues to behave exactly as v6/v7 did — pure localStorage, no auth, single anonymous household.

### Files added (in `react/src/`)

```
lib/
  supabase.ts             — singleton client, isCloudEnabled()
  supabaseAdapter.ts      — SupabaseAdapter (real CRUD)
  hybridAdapter.ts        — cache + cloud + write queue
  auth.ts                 — signIn/signUp/signOut, invitations, RPCs
  permissions.ts          — can(role, action) helpers
  migration.ts            — localStorage → cloud
components/auth/
  AuthGate.tsx            — top-level gate, redirects to /auth/sign-in if needed
pages/auth/
  SignIn.tsx              — password + magic link
  SignUp.tsx              — email/password + display name + verification
  ResetPassword.tsx       — request + set-new
  AcceptInvite.tsx        — /invite/:token route handler
pages/
  Households.tsx          — full management UI (members, invites, activity, danger zone)
.env.example
```

### Live Supabase project

A FinFlow Supabase project is now provisioned and serves as the canonical reference deployment for v4.1:

| Detail | Value |
|---|---|
| Project ID | `dmxqkvploojokffuhxnz` |
| Region | `eu-west-2` (London) |
| URL | `https://dmxqkvploojokffuhxnz.supabase.co` |
| Plan | Free (0 USD/mo) |
| Tables | 11 (all RLS-enabled) |
| RPCs | 3 (`accept_invitation`, `transfer_ownership`, `leave_household`) |
| Migrations applied | 4 (initial schema · RLS+RPCs · security hardening · revoke public execute) |

**Security review:** all ERROR-level advisor findings cleared. The 3 remaining WARN findings are intentional and reviewed:
- `accept_invitation` / `transfer_ownership` / `leave_household` — must be `SECURITY DEFINER` to atomically write to `memberships` + `activity_log` while enforcing their own auth checks. The advisor flags these as "manual review needed" — review confirmed correct.
- `pg_trgm` extension in `public` schema — used for future search; can be moved to `extensions` schema in v4.2 if needed.

The `react/.env.local` file (gitignored) is wired to this project and ready for `npm run dev`.

### Roadmap

- **v4.1.1** — Migration prompt UI on Settings · `send-invite-email` Edge Function template
- **v4.2** — Recurring schedules + notifications synced per-household (currently localStorage-only) · Move `pg_trgm` to `extensions` schema
- **v4.3** — Activity log richer diff display + filtering by actor/action

---

## **v8.0 — Admin Backend**

Separate React app at `admin/` for product administration. **Claude native theme.** Companion to the consumer app at `react/`.

### What ships

- **Three role tiers** (per v7 PRD §07): Super Admin (full), Roles Admin (users + audit), Content Admin (articles only). Role-gated client-side; server-side enforcement via Postgres RLS arrives in v8.1.
- **NorthStar Dashboard** with the metric defined in v7 PRD §08: **Active Households per Week (AHpW)**. A household where 2+ members logged in or recorded a transaction in the past 7 days. Single-user accounts count as 0.5.
- **12 KPI cards** with target thresholds — Time-to-first-txn, Template completion, D7/D90 retention, Multi-member %, Pulse improvement, Reminder confirmed, Recs followed, Chat satisfaction, Free→Paid, NPS. Each shows good/warn state.
- **Three trend charts** — Weekly signups (bar), MRR (area), NPS (area with target reference line).
- **Pages**: Users (220 mock with status/tier/search filters) · Households (card grid by type) · Subscriptions (MRR + tier-mix donut + list) · Content CMS (article status workflow) · Audit Log (immutable, 80 entries, IP/role tracked) · Settings (theme + integration status).
- **Mock data layer** — 220 users, 80 audit entries, 12 weeks of KPI history with deterministic seeded RNG so charts don't reshuffle on hot reload.

### Tech stack

| Layer | Choice |
|---|---|
| Build | Vite 5 |
| Language | TypeScript 5.6 strict |
| UI | React 18 + React Router 6 |
| Styling | Tailwind 3 with Claude HSL theme tokens (light + dark) |
| State | Zustand |
| Charts | Recharts |
| Icons | Lucide React |
| Display font | Source Serif 4 (Tiempos-equivalent) |
| UI font | Inter |
| Mono font | JetBrains Mono |

### Why a separate app
Per PRD §07: different bundle, different auth flow (Google Workspace SSO planned), different deploy cadence, different security posture (VPN/IP allowlist), different visual language. Lives at `admin/` next to `react/` (consumer).

### Run
```bash
cd admin && npm install && npm run dev    # → http://localhost:5174
```
Both apps can run side-by-side (consumer on `:5173`, admin on `:5174`).

### Roadmap
- **v8.1** — Supabase auth + RLS · Stripe webhooks · PostHog + Intercom integrations · Article editorial workflow · SIEM audit export
- **v8.2** — Embedded Looker Studio · CS conversation linking
- **v9.0** — Multi-tenant admin (per-org metrics for enterprise customers)

---

## **v7.5 — Rules-based Planner + AI Chatbot**

Two features from v7 PRD §05–06 deferred from v7 to v7.5 ship now in the consumer app at `react/`.

### New
- **AI Finance Planner** — `react/src/lib/plannerRules.ts` + `pages/Planner.tsx`. **Rules-based, NOT LLM.** 30+ rules across 5 domains (Income · Expenses · Investments · Debt · Tax). Each rule has priority, severity, and a deterministic trigger. Engine evaluates all, sorts by `severity × priority`, returns top 8. Zero hallucination — every recommendation traces to a specific rule and data point. Sets up the v8 LLM upgrade path: same rule outputs become structured prompts.
- **AI Chatbot scaffold** — `react/src/pages/Chat.tsx` with `lib/aiSummary.ts`. Privacy-safe aggregation: only categories + amounts + date ranges leave the device. **Never** merchant names, descriptions, or notes. Today the `StubChatBackend` answers via local pattern-matching against the safe summary; v8 wires the `SupabaseChatBackend` to a Supabase Edge Function calling Anthropic Claude Haiku. Clear "stub mode" indicator while the backend is unwired.

### Why now (per PRD §05)
> "An LLM-driven financial planner is a regulatory landmine. We are not FCA-authorised. Suggesting investment moves to users via an LLM exposes us to advice liability and hallucination risk on someone's actual money. v7.5 ships a deterministic, rules-based planner. The LLM version is v8 and ships behind a clear 'general guidance, not financial advice' disclaimer with proper guardrails."

The Planner page header carries the disclaimer in plain English.

---

## **v7.0 — Onboarding · EMI · Recurring · Notifications**

Tier 1 of the v7 PRD. Three features ship in the consumer app at `react/`.

### New

**1. Smart Onboarding with 6 Profile Templates** *(PRD §02)*
4-step intake (90 second target). 6 templates each with: visible pages, pre-populated budgets/goals/debts, and Pulse Score weighting:
- **Young Couple** — joint goals, splits, holiday/down-payment funds
- **Family with Kids** — childcare, school fees, mortgage template
- **Single Earner / Single Parent** — emergency fund priority, no splits
- **Self-Employed / SMB Owner** — Personal/Business firewall, tax goal
- **Pre-Retiree / Retiree** — drawdown target, healthcare reserve, no debts
- **Student / Early Career** — student loan, tight budgets, building habits

`react/src/lib/templates.ts` is the single source of truth — page visibility, starter budgets/goals/debts, Pulse weights, primary concern. Sidebar reads `pagesForTemplate(template)` to filter visible nav items. New users hit `/onboarding` (4 steps), existing v6 users default silently to `family` template.

**2. EMI Re-amortisation Engine** *(PRD §03)*
Fixes a correctness gap: pre-v7 we used a flat interest/principal split that was wrong from month 2 onwards. New `react/src/lib/amortization.ts`:
- `calculateAmortizationSchedule(debt)` returns the full month-by-month {emi, interest, principal, outstanding} array
- `splitPayment(outstanding, rate, payment)` computes the correct split for any payment
- `applyPayment(debt, amount, choice)` handles part-payments with three user choices: **Reduce tenure** / **Reduce EMI** / **Apply as advance** (PRD's three-option modal)
- Matches Bank of England standard PMT to within £0.01

**3. Recurring Payments + Notifications** *(PRD §04)*
Two features collapsed into one (you can't have one without the other):
- **Recurring schedules** — `lib/recurring.ts` + `pages/Recurring.tsx`. Weekly / monthly / yearly / custom-day-of-month frequencies. Auto-confirm or pending-confirmation modes. Per-schedule reminder lead-time (1/3/7 days). Active/pause toggle.
- **Notification engine** — `lib/notifications.ts`. 6 types per the PRD: upcoming bill · missed payment · budget threshold (80% / 100%) · goal milestone (25/50/75/100) · weekly digest · custom reminder. Quiet hours, master toggle, per-type prefs.
- **NotificationCenter** — bell icon in sidebar/mobile bar with unread count, click-away dismissal, mark-read and dismiss actions per notification.
- **Web Push API** integration via `notifications.showWebPush()` — falls back gracefully when permission denied.

### Engineering deliverables

- `lib/templates.ts` · `lib/amortization.ts` · `lib/recurring.ts` · `lib/notifications.ts` · `lib/plannerRules.ts` · `lib/aiSummary.ts` (all pure TS, framework-agnostic, unit-testable)
- `pages/Onboarding.tsx` · `pages/Recurring.tsx` · `pages/Planner.tsx` · `pages/Chat.tsx`
- `components/layout/NotificationCenter.tsx` (sidebar + mobile bar bell)
- Updated `Sidebar.tsx` with template-aware page visibility
- Extended `store.ts` with `recurringSchedules`, `notifications`, `notificationPrefs`, `recordDebtPayment`, `runRecurringEngine`, `refreshNotifications`
- Periodic recurring + notifications check on app load + every 60s while open

---

## **v6.0 — React + TypeScript + Recharts**

Frontend stack rebuild. All v5 features remain available in the vanilla shell at the project root; the React app lives in `react/` as a side-by-side migration.

### New stack
- **Vite 5** dev server + production builder (replaces "open `index.html` directly")
- **React 18** + **TypeScript 5.6** strict mode
- **Tailwind CSS 3** with HSL custom-property tokens for the paper-warm theme
- **Zustand** for global state (no provider tree, full TS inference, ~1KB)
- **React Router v6** for deep-linkable URLs (`/dashboard`, `/reports`, etc.)
- **Recharts** for interactive charts (Area, Bar, Donut) — theme-aware via CSS vars, animated by default, with custom-styled tooltips, legend, and axes that match the FinFlow design system
- **Lucide React** for the icon set (1,400+ tree-shakeable icons; replaces hand-rolled SVG paths)

### Architecture
- **`DataAdapter` ported to TypeScript** with full type inference — same interface as v4.1, backward-compatible storage keys for the anonymous profile
- **Pure-TS `calculations.ts`** — Pulse Score (5 components), monthly aggregation, splits, EMI, financial ratios, insights — all framework-agnostic and unit-testable
- **Zustand store** — every CRUD action for transactions/budgets/goals/members/debts/assets/profile/rates routed through the adapter
- **Theme** as a class on `<html>` — Tailwind `dark:` modifier works, CSS HSL vars cascade to Recharts via the `recharts-*` class overrides in `index.css`
- **Custom `PulseGauge`** — kept as hand-crafted SVG conic-gradient for brand fidelity (Recharts radial-bar would have been close but not exact)

### Pages migrated
- ✅ **Dashboard** — full: Pulse Score + 4 metric cards + insights bar + budget progress + recent transactions + active goals + category donut + net worth & debt summary
- ✅ **Reports** — full: 5-period selector (Day/Week/Month/Quarter/Year), Recharts Area chart for income/expense trend, Net bar chart, Category donut, Top categories bars, Period summary table
- ✅ **Transactions** — full: list with search + 5 filter dropdowns, payment method chips, all v5 transaction badges (private, investment, transfer, split, recurring, member, currency)

### Pages stubbed
The remaining 7 pages (Budgets, Goals, Splits, Debts, Net Worth, Settings, Help) render a migration-progress placeholder linking to the v5 vanilla shell where they're fully functional. All underlying logic is already ported to TypeScript — only the JSX UI remains for each.

### Roadmap
- **v6.1** — port the 7 stub pages to React (1–2 weeks)
- **v6.2** — wire up the modal-based CRUD flows (add/edit transaction, debt payment, etc.)
- **v6.3** — Framer Motion page transitions and chart entry animations
- **v7.0** — Supabase integration: auth, cloud sync, multi-device, multi-household with email invitations, RLS-enforced multi-tenancy. See `ARCHITECTURE.md` and `db/schema.sql`.

### Setup
```bash
cd react
npm install
npm run dev    # http://localhost:5173
```

The v5 vanilla shell at the project root continues to work standalone — no build step required. Run them side-by-side during the migration.

---

## **v5.0 — Loans, Splits, Profiles & Privacy**

A substantial feature release that turns FinFlow into a true multi-context financial workspace. Six new capabilities, all designed to stay low-learning-curve.

### New
- **Private (excluded) transactions** — flag any transaction with `Exclude from reports`. It stays in your history but doesn't appear in expense/income totals, charts, the Pulse Score, or the Net Worth calculation. Ideal for sensitive flows you don't want skewing your overall picture. Marked with a subtle dashed border + eye-off badge on the row.
- **Payment method library** — 30+ banks, cards, and wallets baked in (Visa, Mastercard, Amex, Chase, BofA, Wells Fargo, PayPal, Venmo, Cash App, Apple Pay, HDFC, ICICI, SBI, Paytm, PhonePe, Revolut, Wise, Coinbase, more). Selectable on every transaction; rendered as a coloured brand chip on the row. Adds authenticity without a corporate feel.
- **Investment & Transfer transaction types** — beyond income/expense:
  - `Investment` — money flowing into (or out of) a brokerage, retirement, or other asset. Doesn't count as expense; optionally links to and updates an Asset's value.
  - `Transfer` — money moved between accounts (savings ⇄ checking, paying down principal). Excluded from income/expense totals so reports stay accurate.
- **Multi-profile workspace** — maintain multiple isolated profiles on the same device:
  - Personal · Family · Single Business · Multi-Business types
  - Profile switcher in the sidebar header
  - Each profile has its own transactions, budgets, debts, assets, members, and currency
  - Backwards-compatible with existing v4.1 anonymous data (becomes "Default" profile on first run)
- **Split payments** — handle group bills without skewing reports:
  - Mark any expense as a split with N participants
  - Only your share counts as expense (e.g. $400 dinner ÷ 4 = $100 expense)
  - Outstanding IOUs tracked in a dedicated **Splits** page: `Owed to you / You owe`
  - One-click settlement marks participants as paid (no income inflation)
- **Loan tracker / EMI breakdown** — debts become real loans:
  - New fields: tenure (months), EMI amount, amortization preview
  - Recording a payment now splits automatically into **interest** (logged as expense) and **principal** (logged as transfer, excluded from expense totals)
  - This is how accountants do it — your spending reports finally reflect your *true* cost of debt, not the sticker payment

### Improved
- Aggregation engine refactored: `monthlyData` / `totalBalance` / `spendByCategory` / Pulse Score / Net Worth all respect the new types and the excluded flag
- Help page expanded with new sections: Splits, Investment Tracking, Loan Tracker, Profiles, Privacy
- Settings page gains profile management (create / rename / delete / switch / export-per-profile)

### Behind the scenes
- Payment method library `PAYMENT_METHODS` extensible for new banks/wallets (just add to the constant)
- Multi-profile uses the existing `DataAdapter` namespacing — same code path as cloud households will use post-Supabase
- Splits stored on the transaction itself as `split: { totalAmount, yourShare, paidBy, participants[] }` — clean, queryable, no extra collection
- Loan amortization computed client-side; Postgres schema in `db/schema.sql` supports it server-side too

### Roadmap (deferred to future releases — see `ARCHITECTURE.md`)
- Account authentication (sign-up, sign-in, password reset, magic-link, social OAuth)
- Cloud sync via Supabase (Postgres + RLS + Realtime)
- Multi-household / multi-business with cross-device sync (a user belongs to N households simultaneously)
- Email-based invitations with token acceptance
- Role-based permissions (owner / admin / member / viewer / child) with RLS-enforced authorization
- Realtime collaboration — see family members' edits within ~1 second
- Activity log / audit trail for shared workspaces

---

## **v4.1 — Adapter Refactor** *(internal release)*

Foundation work to make v5 and the future cloud migration possible.

### New
- `DataAdapter` interface (`src/dataAdapter.js`) with three implementations:
  - `LocalStorageAdapter` (active today, anonymous mode)
  - `SupabaseAdapter` (ready, awaiting backend wiring)
  - `HybridAdapter` (cache + write queue + cloud — production model)
- All persistence calls in `app.js` route through `adapter.*` methods — no direct `localStorage` writes in the data path
- **Member removal** capability with linked-transaction orphaning + sidebar `×` button (was missing from v4)
- Cloud-sync info banner in Settings → Sync section, linking to `ARCHITECTURE.md`

### Improved
- Backward-compatible storage keys: anonymous-mode profile uses legacy v4 key names so existing data is preserved untouched
- `seedDemo` and `restoreBackup` use `adapter.replaceAll` for atomic bulk operations
- All CRUD functions are now `async` (23 async functions total)

### Documentation
- New `ARCHITECTURE.md` — comprehensive cloud/auth/multi-tenant design doc (17 sections)
- New `db/schema.sql` — deployable Postgres schema for Supabase, including RLS policies, helper functions, and views

---

## **v4.0 — Paper Warm Redesign + Debt + Net Worth + Currency + i18n**

Major redesign and feature expansion based on the FinFlow Designs wireframes.

### New
- **Paper Warm** design system (default theme): Coral · Cream · Ink · Sage · Honey · Terracotta — based on the official wireframe palette. Designed to feel like a kitchen-table conversation, not a quarterly statement
- Newsreader (italic display) + Inter Tight (UI) + JetBrains Mono (data) typography
- **Debt management page** (10 debt types, Avalanche/Snowball strategies, payoff calculator with extra-payment cascade, DTI ratio, payoff schedule)
- **Net Worth / Balance Sheet page** (10 asset types organized by liquidity, formula display, 4 financial ratios, balance sheet split view)
- **Multi-currency support** — 12 currencies with locale-aware formatting via `Intl.NumberFormat`, editable USD-base rates table
- **Localization (i18n)** — 6 languages (English, Español, Français, हिन्दी, Deutsch, 日本語) via `t()` function and `data-i18n` attributes
- **Interactive period charts** — Day / Week / Month / Quarter / Year selector with SVG line, bar, and donut charts
- **Settings page** — profile, theme cards, localization, debt preferences, sync, account stats
- **Help & Guide page** — 10 collapsible accordion sections, searchable
- **Pulse Score expansion** — now 5 components (Budget 25% · Savings 25% · Goals 15% · Trend 15% · Debt Health 20%)
- Realistic seed data: 4-person household with $312K mortgage, $24K auto loan, $5K credit card, $19K student loan vs $755K assets across checking, savings, brokerage, 401(k), Roth IRA, home, vehicle

### Improved
- 9 pages total (Dashboard, Transactions, Budgets, Goals, Debts, Net Worth, Reports, Settings, Help) grouped as Track / Plan / Analyze
- Three themes: Paper Warm (default), Dark (warm-toned), System (follows OS)
- Mobile-responsive with hamburger sidebar, stacked layouts, touch-friendly modals

---

## **v3.0 — Themes, Charts, Settings, Help** *(internal — superseded by v4)*

Light/dark theme switcher, SVG icon set, responsive design, period-based charts, settings and help pages. Shipped HTML and CSS but app.js logic was deferred and rolled into v4.

---

## **v2.0 — Family Pulse Score, Goals, Members, Insights**

Eight increments shipping the foundational MVP defined in the FinFlow architecture spec.

### New
- **Family Pulse Score™** — composite 0–100 wellness score on the dashboard, animated conic gradient, color-coded
- **Goals page** — 6 goal types (Emergency Fund, Savings, Debt Payoff, Investment, Major Purchase, Custom), inline progress updates, completion celebration
- **Family Members** — multi-member household, sidebar avatar strip, member tag on transactions
- **Recurring transactions** — weekly/monthly/yearly flag with badge
- **AI Insights bar** — savings rate analysis, budget overage alerts, top-category flag, goal nudges
- **Smart auto-categorization** — keyword detection on transaction description (`KEYWORD_MAP`)
- **CSV export** — full transaction history download
- **Enhanced reports** — net worth, monthly trend chart, top categories, savings rate over time
- Seed data with 3 months of realistic family financial activity

### Improved
- 5 pages (added Goals to existing 4)
- New design tokens for the original electric blue + amber theme
- Keyboard shortcuts (`N` for new transaction, `G` for new goal, `Esc` to close)

---

## **v1.0 — BudgetFlow MVP**

The original release. Plain HTML + CSS + JS, no build step, no backend, no dependencies.

### Initial features
- 4 pages: Dashboard, Transactions, Budgets, Reports
- Single-user, localStorage-only
- Income / expense transaction tracking with 16 categories
- Monthly budget limits per category with color-coded progress bars (yellow at 80%, red at 100%)
- Budget bars on dashboard
- Recent transactions feed
- Category spending chart (CSS bars)
- Reports: all-time totals, monthly summary table, top expense categories
- Dark theme with indigo accent
- Modal-based add/edit for transactions and budgets
- Color picker for budget styling
- Toast notifications
- Auto-seed demo data on first run

---

## Versioning conventions

- **Major** (`x.0`): breaking changes to data shape, design language, or core architecture
- **Minor** (`x.y`): additive features, no breaking changes, backward-compatible
- **Patch** (`x.y.z`): bug fixes, polish, copy edits

All releases are documented here. Each version's full diff lives in the project's git history once the project is moved to version control.
