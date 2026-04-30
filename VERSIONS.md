# FinFlow — Version History

> A complete changelog of every release of FinFlow. Newest first.

---

## **v4.1 — Cloud · Auth · Multi-Household** *(current)*

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

### Roadmap

- **v4.1.1** — Migration prompt UI on Settings · `send-invite-email` Edge Function template
- **v4.2** — Recurring schedules + notifications synced per-household (currently localStorage-only)
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

## **v7.5 — Rules-based Planner + AI Chatbot** *(current)*

Two features from v7 PRD §05–06 deferred from v7 to v7.5 ship now in the consumer app at `react/`.

### New
- **AI Finance Planner** — `react/src/lib/plannerRules.ts` + `pages/Planner.tsx`. **Rules-based, NOT LLM.** 30+ rules across 5 domains (Income · Expenses · Investments · Debt · Tax). Each rule has priority, severity, and a deterministic trigger. Engine evaluates all, sorts by `severity × priority`, returns top 8. Zero hallucination — every recommendation traces to a specific rule and data point. Sets up the v8 LLM upgrade path: same rule outputs become structured prompts.
- **AI Chatbot scaffold** — `react/src/pages/Chat.tsx` with `lib/aiSummary.ts`. Privacy-safe aggregation: only categories + amounts + date ranges leave the device. **Never** merchant names, descriptions, or notes. Today the `StubChatBackend` answers via local pattern-matching against the safe summary; v8 wires the `SupabaseChatBackend` to a Supabase Edge Function calling Anthropic Claude Haiku. Clear "stub mode" indicator while the backend is unwired.

### Why now (per PRD §05)
> "An LLM-driven financial planner is a regulatory landmine. We are not FCA-authorised. Suggesting investment moves to users via an LLM exposes us to advice liability and hallucination risk on someone's actual money. v7.5 ships a deterministic, rules-based planner. The LLM version is v8 and ships behind a clear 'general guidance, not financial advice' disclaimer with proper guardrails."

The Planner page header carries the disclaimer in plain English.

---

## **v7.0 — Onboarding · EMI · Recurring · Notifications** *(current)*

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
