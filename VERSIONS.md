# FinFlow — Master Version History

> **Parent / master changelog.** Per-app detail lives in each app's own `CHANGELOG.md`; this document is the single index that tells you what's installed, what shipped where, and what's coming next.

## Three deployables in this repo

| App | Path | Current | Live URL | Per-app changelog |
|---|---|---|---|---|
| **Consumer (React)** | `react/` | **v6.4.10** | https://react-taupe-xi.vercel.app | [`react/CHANGELOG.md`](react/CHANGELOG.md) |
| **Admin** | `admin/` | **v1.0.6** | https://finflow-admin.vercel.app | [`admin/CHANGELOG.md`](admin/CHANGELOG.md) |
| **Vanilla shell (legacy consumer)** | `/` (root) | **v5.0** *(frozen)* | n/a — opens `index.html` directly | [§ Vanilla shell history](#vanilla-shell-history-v10--v50) below |

The three apps deploy independently and are versioned independently. The vanilla shell at the repo root is kept available as the *original* FinFlow app from before the React port; it shares no code with the admin app.

---

## Cross-app release timeline

Newest first. For full per-version detail, follow the link in the **App** column.

| Date | App | Version | Headline |
|---|---|---|---|
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6410--eslint-floor-remediation-pr-1-2026-05-23) | **v6.4.10** | **ESLint floor (remediation PR #1).** First real linter; `npm run lint` now runs `eslint .`, `tsc --noEmit` preserved as `npm run typecheck`. Surfaces existing `exhaustive-deps` / unused-vars / `no-explicit-any` debt as warnings to be ratcheted by later TECH_DEBT PRs. One real bug fixed: short-circuit-as-statement in `Households.tsx`. |
| 2026-05-23 | [Admin](admin/CHANGELOG.md#v106--eslint-floor-remediation-pr-1-2026-05-23) | **v1.0.6** | **ESLint floor (remediation PR #1).** Same lint floor for the privileged admin app (no tests + no linter was the highest-risk gap). Source passes lint clean today (1 pre-existing warning). |
| 2026-05-22 | [Admin](admin/CHANGELOG.md#v105--mobile-navigation-fix-2026-05-22) | **v1.0.5** | **Mobile navigation fix.** Sidebar was desktop-only with no fallback; added a hamburger + slide-out nav drawer so tabs work below 1024px. |
| 2026-05-22 | [Consumer](react/CHANGELOG.md#v649--calendar-all-months-recurring-projection-day-filter-on-demand-2026-05-22) | **v6.4.9** | **Calendar overhaul.** Navigable across all months, projects upcoming recurring payments (denim), tap a day to filter the list to that date, and it's now toggled on-demand via a Calendar icon. |
| 2026-05-22 | [Consumer](react/CHANGELOG.md#v648--auto-even-split-shares-2026-05-22) | **v6.4.8** | **Auto-even split shares.** Bill splits default to an even split and rebalance as people are added; users only type a number to override. |
| 2026-05-22 | [Consumer](react/CHANGELOG.md#v647--calendar-view-on-transactions-page-2026-05-22) | **v6.4.7** | **Calendar view on Transactions page.** Visualizes which days of the month had expenses logged vs missed. |
| 2026-05-21 | [Admin](admin/CHANGELOG.md#v104--ai-assistant-intelligence-2026-05-21) | **v1.0.4** | **AI Assistant Intelligence** page — intent/sentiment distribution + per-user business segments from privacy-safe Ask-FinFlow usage (`admin_ai_usage_summary()` RPC). |
| 2026-05-21 | [Consumer](react/CHANGELOG.md#v646--linked-accounts-dynamic-needswants-ai-usage-metrics-split-bill-ux-2026-05-21) | **v6.4.6** | **Linked accounts + dynamic needs/wants + AI usage metrics.** Payments now draw from Net Worth accounts (cash/bank/credit-card); needs/wants moved to an admin-editable DB table; Ask-FinFlow logs privacy-safe intent/sentiment. Plus split-bill UX and a build-stabilisation pass (two non-compiling files rebuilt). |
| 2026-05-21 | [Consumer](react/CHANGELOG.md#v645--help-page-real-screenshots--interactive-gifs-2026-05-21) | **v6.4.5** | **Help page: real screenshots & GIFs.** Consolidated Help to 8 searchable topics, each backed by a real capture of the live app — 6 WEBP screenshots + 2 animated GIFs (Add Transaction, Split a bill). Added a reproducible `puppeteer-core` capture pipeline (`react/scripts/capture-help.mjs`). |
| 2026-05-21 | [Consumer](react/CHANGELOG.md#v644--finflow-design-system-v2-alignment-2026-05-21) | **v6.4.4** | **Design System v2 alignment.** Adopted the full `--ff-*` token set, matched buttons/inputs/cards to the `lib.jsx` FF specs, and upgraded the Pip mascot (eyes/cheeks/smile) + "Fin*Flow*" wordmark. Visual-only. |
| 2026-05-21 | [Admin](admin/CHANGELOG.md#v103--design-system-v2-brand-marks-2026-05-21) | **v1.0.3** | Design System v2 brand marks: full Pip mascot + Fin*Flow* wordmark + favicon. (Dark "shell" theme deferred pending sign-off.) |
| 2026-05-20 | [Consumer](react/CHANGELOG.md#v643--split-transaction-creation--buttoninput-styling-2026-05-20) | **v6.4.3** | Split-transaction creation restored in the Add/Edit modal (participants, shares, who-paid, validation) — persists full `SplitInfo` to Supabase. Fixed undefined `btn-*`/`input` classes that made ported-page buttons render as plain text. |
| 2026-05-20 | [Admin](admin/CHANGELOG.md#v102--brand-icon-fix-2026-05-20) | **v1.0.2** | Brand icon fix: added missing `admin/public/favicon.svg` (FinFlow Pip mark) and replaced the "FF" monogram in the sidebar with the logo-mark. |
| 2026-05-20 | [Consumer](react/CHANGELOG.md#v642--critical-sync-fix-cloud-writes-never-persisted-2026-05-20) | **v6.4.2** | **Critical sync fix.** Cloud writes never persisted: non-UUID ids (22P02) + UPDATE-instead-of-INSERT left every locally-created record stuck in the queue. Fixed `uid()`→`crypto.randomUUID()`, adapter→real upsert, + queue guard for legacy poisoned ops. |
| 2026-05-20 | [Admin](admin/CHANGELOG.md#v101--authgate-deadlock-hotfix-2026-05-20) | **v1.0.1** | **AuthGate deadlock hotfix.** App hung on "Checking session…" post-pause: an async `onAuthStateChange` callback awaited a nested `getUser()` and deadlocked the GoTrue auth lock. Deferred role resolution + pass session user id. |
| 2026-05-10 | [Consumer](react/CHANGELOG.md#v641--sidebar-polish--debt--asset-form-parity-2026-05-10) | **v6.4.1** | Sidebar logo links to Dashboard. Budgets moved to PLAN, Splits moved to TRACK. Debt and Asset forms refactored to modals matching the Add Transaction / Budget / Goal pattern. |
| 2026-05-10 | [Consumer](react/CHANGELOG.md#v64--blocker-sweep-persistence-form-parity-budget-periods-floating-tools-2026-05-10) | **v6.4** | 7-issue blocker sweep: cache no-clobber + sentinel persistence; Goal/Budget modal parity with Add Transaction; multi-period budgets with calendar windows; pip favicon + manifest; portal-rendered notification popover; adaptive `Money` component for billion-scale values; Planner & Chat moved to floating action buttons. |
| 2026-05-10 | [Admin](admin/CHANGELOG.md#v100--production-data-layer--northstar-dashboard-2026-05-10) | **v1.0.0** | First production release. All 5 pages on live Supabase data. Mock layer deleted. Honest `—` placeholders for cohort metrics that need event-tracking. |
| 2026-05-10 | [Consumer](react/CHANGELOG.md#v631--admin-dashboard-sanitised-every-page-on-live-data-2026-05-10) | v6.3.1 | Cross-ref of the admin v1.0 release. No consumer code changes. |
| 2026-05-10 | [Consumer](react/CHANGELOG.md#v63--content-module--adminsupabase--global-add-txn-modal-2026-05-10) | v6.3 | Content module (admin authors → consumer reads with search + favorites). Global Add-Transaction modal hoisted to App root. New `/insights` page. |
| 2026-05-10 | [Consumer](react/CHANGELOG.md#v622--add-transaction-wiring--ga4-2026-05-10) | v6.2.2 | Add-Transaction modal on the Transactions page. GA4 (`G-E3XKWZP850`) added to all 3 entry HTMLs. |
| 2026-05-10 | [Consumer](react/CHANGELOG.md#v621--households-rls-recursion-hotfix-2026-05-10) | v6.2.1 | Server-side RLS hotfix. The "No API key found" error was actually an HTTP 500 from RLS recursion on `households` ↔ `memberships`. |
| 2026-05-10 | [Consumer](react/CHANGELOG.md#v62--friction-free-signup--module-port-out-2026-05-10) | v6.2 | All 7 v5 stub pages ported to React. Onboarding becomes opt-in. Email verification non-blocking. Trigger fix so new signups always have a household. |
| pre-2026-05 | [Consumer](react/CHANGELOG.md#v75--rules-based-planner--ai-chatbot-pre-2026-05) | v7.5 | Rules-based AI Finance Planner (no LLM). AI Chatbot scaffold with privacy-safe aggregation. |
| pre-2026-05 | [Consumer](react/CHANGELOG.md#v70--onboarding--emi--recurring--notifications-pre-2026-05) | v7.0 | Smart Onboarding (6 templates). EMI re-amortisation engine. Recurring transactions + notifications. |
| pre-2026-05 | [Consumer](react/CHANGELOG.md#v60--react--typescript--recharts-pre-2026-05) | v6.0 | React + TypeScript + Tailwind + Vite + Recharts rebuild. Dashboard / Reports / Transactions ported; 7 other pages stubbed. |
| pre-2026-05 | [Consumer](react/CHANGELOG.md#v41--cloud--auth--multi-household-pre-2026-05) | v4.1 | Cloud / Auth / Multi-Household. Supabase wired behind the `DataAdapter` interface. Roles + invitations + realtime. |
| pre-2026-05 | [Consumer (vanilla)](react/CHANGELOG.md#v41-internal--adapter-refactor-pre-2026-05) | v4.1 (internal) | `DataAdapter` interface introduced on the vanilla shell. Foundation for the cloud release above. |
| pre-2026-05 | [Vanilla shell](#v50--loans-splits-profiles--privacy) | v5.0 | Loans, Splits, Profiles, Privacy. **Final vanilla-shell release** — frozen as of v6.0. |
| pre-2026-05 | [Vanilla shell](#v40--paper-warm-redesign--debt--net-worth--currency--i18n) | v4.0 | Paper Warm redesign. Debt + Net Worth + Multi-currency + i18n. |
| pre-2026-05 | [Vanilla shell](#v30--themes-charts-settings-help-internal--never-shipped) | v3.0 | *Never shipped* — UI was rolled into v4.0. |
| pre-2026-05 | [Vanilla shell](#v20--family-pulse-score-goals-members-insights) | v2.0 | Family Pulse Score, Goals, Members, AI Insights bar. |
| pre-2026-05 | [Vanilla shell](#v10--budgetflow-mvp) | v1.0 | BudgetFlow MVP. The original release. |

> **Why some Consumer versions look out of order:** v7.0 / v7.5 ran as a parallel **major-feature track** alongside the v6.x **integration track**. Going forward (v6.4+) every consumer release is on a single increasing line. See [§ Version provenance](react/CHANGELOG.md#version-provenance--gaps) in the consumer changelog for the full explanation.

---

## Roadmap (cross-app)

Per-app detail in each `CHANGELOG.md` Roadmap section.

| Up next | App | Version | Headline |
|---|---|---|---|
| **next** | [Consumer](react/CHANGELOG.md#v65-planned) | v6.5 | Server-side budget-period storage (DB migration to add `extras jsonb` on `budgets`). GA4 custom events. Transactions pagination. Resend Edge Function for invitation emails. Bundle code-split. |
| **next** | [Admin](admin/CHANGELOG.md#v110--next-planned) | v1.1.0 | Stripe billing wired to `subscriptions`. Event-tracking pipeline unlocks the 8 cohort metrics on the Dashboard. Audit-log JSON-diff viewer. |
| later | [Consumer](react/CHANGELOG.md#v66-planned) | v6.6 | Stripe consumer Settings. Cohort-event tracking client-side hooks (matched to admin v1.1). |
| later | [Admin](admin/CHANGELOG.md#v120-planned) | v1.2.0 | User suspend/reinstate. Invite admin tier from UI. SIEM audit export. |
| later | [Admin](admin/CHANGELOG.md#v130-planned) | v1.3.0 | Google Workspace SSO. VPN / IP allowlist at Vercel edge. |
| **future major** | [Consumer](react/CHANGELOG.md#v70--future-major) | v7.0 | LLM Chat backend (Claude Haiku via Edge Function). LLM-augmented Planner. Multi-device push. |
| **future major** | [Admin](admin/CHANGELOG.md#v200--future-major) | v2.0.0 | Multi-tenant admin (per-org metrics). Embedded Looker Studio. CS conversation linking. |

---

## Vanilla shell history (v1.0 – v5.0)

The vanilla HTML+CSS+JS app at the repo root. All v5.0 features remain working — just open `index.html`. **No further releases planned**; the React app at `react/` (v6.0+) is the active consumer product.

### v5.0 — Loans, Splits, Profiles & Privacy

A substantial feature release that turns FinFlow into a true multi-context financial workspace. Six new capabilities, all designed to stay low-learning-curve.

**New**
- **Private (excluded) transactions** — flag any transaction with `Exclude from reports`. It stays in your history but doesn't appear in expense/income totals, charts, the Pulse Score, or the Net Worth calculation.
- **Payment method library** — 30+ banks, cards, and wallets baked in.
- **Investment & Transfer transaction types** — beyond income/expense.
- **Multi-profile workspace** — Personal · Family · Single Business · Multi-Business types. Profile switcher in the sidebar header. Each profile has its own transactions, budgets, debts, assets, members, and currency.
- **Split payments** — handle group bills without skewing reports. Mark any expense as a split with N participants. Only your share counts as expense.
- **Loan tracker / EMI breakdown** — debts become real loans. New fields: tenure (months), EMI amount, amortization preview. Recording a payment now splits automatically into **interest** (logged as expense) and **principal** (logged as transfer, excluded from expense totals).

**Improved**
- Aggregation engine refactored: `monthlyData` / `totalBalance` / `spendByCategory` / Pulse Score / Net Worth all respect the new types and the excluded flag.
- Help page expanded with new sections: Splits, Investment Tracking, Loan Tracker, Profiles, Privacy.
- Settings page gains profile management.

### v4.0 — Paper Warm Redesign + Debt + Net Worth + Currency + i18n

Major redesign and feature expansion based on the FinFlow Designs wireframes.

**New**
- **Paper Warm** design system (default theme): Coral · Cream · Ink · Sage · Honey · Terracotta.
- Newsreader (italic display) + Inter Tight (UI) + JetBrains Mono (data) typography.
- **Debt management page** (10 debt types, Avalanche/Snowball strategies, payoff calculator with extra-payment cascade, DTI ratio).
- **Net Worth / Balance Sheet page** (10 asset types organized by liquidity, formula display, 4 financial ratios).
- **Multi-currency support** — 12 currencies with locale-aware formatting via `Intl.NumberFormat`, editable USD-base rates table.
- **Localization (i18n)** — 6 languages.
- **Interactive period charts** — Day / Week / Month / Quarter / Year selector with SVG line, bar, and donut charts.
- **Settings page** — profile, theme cards, localization, debt preferences, sync, account stats.
- **Help & Guide page** — 10 collapsible accordion sections.
- **Pulse Score expansion** — now 5 components (Budget 25% · Savings 25% · Goals 15% · Trend 15% · Debt Health 20%).

### v3.0 — Themes, Charts, Settings, Help *(internal — never shipped)*

Light/dark theme switcher, SVG icon set, responsive design, period-based charts, settings and help pages. Shipped HTML and CSS but `app.js` logic was deferred and rolled into v4.0.

### v2.0 — Family Pulse Score, Goals, Members, Insights

Eight increments shipping the foundational MVP defined in the FinFlow architecture spec.

**New**
- **Family Pulse Score™** — composite 0–100 wellness score on the dashboard.
- **Goals page** — 6 goal types, inline progress updates, completion celebration.
- **Family Members** — multi-member household, sidebar avatar strip, member tag on transactions.
- **Recurring transactions** — weekly/monthly/yearly flag with badge.
- **AI Insights bar** — savings rate analysis, budget overage alerts, top-category flag, goal nudges.
- **Smart auto-categorization** — keyword detection on transaction description (`KEYWORD_MAP`).
- **CSV export** — full transaction history download.
- **Enhanced reports** — net worth, monthly trend chart, top categories, savings rate over time.

### v1.0 — BudgetFlow MVP

The original release. Plain HTML + CSS + JS, no build step, no backend, no dependencies.

**Initial features**
- 4 pages: Dashboard, Transactions, Budgets, Reports
- Single-user, localStorage-only
- Income / expense transaction tracking with 16 categories
- Monthly budget limits per category with color-coded progress bars
- Reports: all-time totals, monthly summary table, top expense categories
- Dark theme with indigo accent
- Modal-based add/edit for transactions and budgets
- Auto-seed demo data on first run

---

## Versioning conventions

Each app uses standard SemVer (`MAJOR.MINOR.PATCH`):

- **Major** (`x.0.0`): breaking changes to data shape, design language, or core architecture.
- **Minor** (`x.y.0`): additive features, no breaking changes, backward-compatible.
- **Patch** (`x.y.z`): bug fixes, polish, copy edits, server-only hotfixes.

Cross-app changes are recorded in **both** apps' changelogs with explicit cross-references. The version number doesn't have to bump in both apps for a change that touches one and is referenced from the other.
