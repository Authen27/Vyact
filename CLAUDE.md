# FinFlow — Family Finance OS

## Versioning at a glance

Three deployables, each on its own SemVer line. Authoritative changelogs:
- Master index: [`VERSIONS.md`](VERSIONS.md)
- Consumer: [`react/CHANGELOG.md`](react/CHANGELOG.md) — **current v6.4.9**
- Admin: [`admin/CHANGELOG.md`](admin/CHANGELOG.md) — **current v1.0.5**
- Vanilla shell: legacy, **frozen at v5.0** — see master index

## Project Overview
Three parallel deliverables exist in this repo:

- **Consumer (vanilla shell, legacy)** at the root — plain HTML+CSS+JS, no build step. Opens `index.html` directly. All v5.0 features fully working. **Frozen** as of consumer v6.0; superseded by the React port in `react/`.
- **Consumer (React app)** in `react/` — Vite + React 18 + TypeScript + Tailwind + Recharts + Zustand. **Current v6.4.9**. Supabase cloud (auth, multi-household, invitations, realtime, content module) wired behind the `HybridAdapter`. Local-only mode still works without env vars. Live at https://react-taupe-xi.vercel.app.
- **Admin app** in `admin/` — separate Vite + React + TS app with **Claude native theme**. **Current v1.0.5**. Three role tiers (Super / Roles / Content). NorthStar dashboard with live KPIs from `admin_dashboard_kpis()` RPC. Live at https://finflow-admin.vercel.app.

**Cloud is opt-in** — without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars, the React app falls back to localStorage-only mode (single anonymous household, no auth screens). Both modes share the same `DataAdapter` interface.

> **Consumer v6.4.1 status:** All 10 pages ported to React. The big v6.4 fix is **data persistence** — `HybridAdapter` no longer clobbers the local cache with an empty cloud response (per-`(household, entity)` sync sentinel + a store-level shrink guard), which was the root cause of "data lost on refresh / sign-out → sign-in". Other v6.4/v6.4.1 work: every CRUD entity (Transaction, Goal, Budget, Debt, Asset) now uses a store-driven modal mounted at App root; multi-period budgets (`BudgetPeriod`, stored per-device in `ff_budget_periods` until a v6.5 schema migration); adaptive `Money` component for billion-scale values; portal-rendered notification popover; Planner & Chat moved to floating action buttons; pip favicon + web manifest; sidebar logo links to Dashboard with Budgets→PLAN / Splits→TRACK. See [`react/CHANGELOG.md`](react/CHANGELOG.md) for the per-version detail and roadmap.

> **Key architectural conventions added in v6.4:**
> - **Global modals via store slots.** Each CRUD entity has `{entity}ModalOpen` / `editing{Entity}` state + `openAdd{Entity}` / `openEdit{Entity}` / `close{Entity}Modal` actions in `store.ts`. The modal component is mounted once in `App.tsx`. Pages call the store action instead of holding local modal state. Follow this pattern for any new CRUD surface.
> - **Client-side overlays for un-migrated schema.** When a feature needs a column the production DB doesn't have yet (e.g. budget `period`), store it in a namespaced localStorage map (`budgetMeta.ts`) and merge it onto adapter results in `refresh()`. Document the per-device limitation and queue the migration for a later version. **Never** change the production schema mid-release without an explicit migration step.
> - **Cache no-clobber.** `HybridAdapter.applyCloudList()` only trusts an empty cloud response once `ff_cloud_synced_<hid>_<entity>` proves a prior sync. `forceFullResync(hid)` clears the sentinel. Preserve this when touching the adapter.

## File Structure
```
budget-app/
├── index.html              — vanilla shell (legacy consumer, v5.0 frozen)
├── style.css               — vanilla paper-warm + dark themes
├── app.js                  — vanilla logic (3,500+ lines)
├── src/dataAdapter.js      — vanilla JS adapter
├── db/schema.sql           — Postgres schema (Supabase-ready)
├── VERSIONS.md             — MASTER changelog index (links to per-app CHANGELOGs)
├── ARCHITECTURE.md         — Cloud + auth + multi-household design
├── CLAUDE.md               — this file
├── README.md               — repo overview + run instructions
├── FinFlow App/            — Specs, GTM, design wireframes, PRDs
├── react/                  — CONSUMER app (v6.4.9)
│   ├── CHANGELOG.md         — consumer per-version history + roadmap
│   ├── package.json, vite.config.ts, tsconfig.json, tailwind.config.ts
│   ├── index.html, .env.local, README.md
│   ├── public/              — favicon.svg (pip mascot), manifest.webmanifest
│   └── src/
│       ├── main.tsx, App.tsx, index.css
│       ├── types.ts, constants.ts, store.ts, hooks.ts
│       ├── lib/             — format, i18n, calculations, dataAdapter,
│       │                      hybridAdapter, supabaseAdapter, auth, permissions,
│       │                      migration, budgetMeta, templates, amortization,
│       │                      recurring, notifications, plannerRules, aiSummary,
│       │                      insightsApi, seed (all TS)
│       ├── components/
│       │   ├── ui/          — Button, Card, Modal, Input, Badge, Toast, Empty, Money
│       │   ├── layout/      — Sidebar, MobileBar, ProfileSwitcher, Layout,
│       │   │                  NotificationCenter, FloatingTools
│       │   ├── charts/      — PulseGauge (custom SVG), Charts (Recharts)
│       │   ├── transactions/— TxnRow, PaymentMethodChip, TransactionFormModal
│       │   ├── goals/       — GoalFormModal, GoalProgressModal
│       │   ├── budgets/     — BudgetFormModal
│       │   ├── debts/       — DebtFormModal
│       │   └── assets/      — AssetFormModal
│       ├── components/auth/ — AuthGate
│       └── pages/           — Dashboard, Transactions, Budgets, Goals, Splits,
│                              Debts, NetWorth, Reports, Recurring, Planner, Chat,
│                              Insights, Households, Settings, Help, Onboarding,
│                              auth/{SignIn,SignUp,ResetPassword,AcceptInvite}
└── admin/                  — ADMIN app (v1.0.5, separate product)
    ├── CHANGELOG.md         — admin per-version history + roadmap
    ├── package.json, vite.config.ts, .env.local
    └── src/
        ├── App.tsx, store.ts, types.ts
        ├── lib/             — supabase, auth, adminApi, contentApi
        ├── components/      — Layout, AuthGate
        └── pages/           — Dashboard, Users, Households, Subscriptions,
                               Content, Audit, Settings, Help
```

## Tech Stack

| Layer | v5 (root) | v6 (react/) |
|---|---|---|
| Build | None | Vite 5 |
| Language | JS (ES2020) | TypeScript 5.6 strict |
| UI | Hand-rolled DOM | React 18 + hooks |
| Styling | CSS custom properties | Tailwind 3 + CSS HSL vars |
| State | Module-scope arrays | Zustand |
| Routing | `currentPage` string | React Router v6 |
| Charts | Hand-rolled SVG | **Recharts** (interactive, themed, animated) |
| Icons | Inline SVG paths | Lucide React |
| Persistence | DataAdapter (JS) | DataAdapter (TS, ported) |

## Running

### v5 vanilla
```bash
# Just open index.html in a browser, or:
python -m http.server 8000
```

### v6 React
```bash
cd react
npm install
npm run dev          # → http://localhost:5173
```

## v5 Feature Highlights
- **🔒 Private (excluded) transactions** — flag any transaction to skip aggregation; visual stripe + 🔒 Private badge
- **💳 Payment methods** — 30+ banks/cards/wallets; branded chip on every transaction row
- **📈 Investment & Transfer types** — beyond income/expense; isolated from cash-flow totals; investments optionally auto-update Asset values
- **👤 Multi-profile** — Personal/Family/Business/Multi-business/Shared profiles, each with isolated data; switcher in sidebar header
- **🤝 Split payments** — group bills with N participants; only your share counts as expense; outstanding IOUs tracked in dedicated Splits page
- **🏦 Loan tracker / EMI** — tenure & EMI fields, live amortization preview; payments split into interest (expense) + principal (transfer) automatically

## Architecture

### State (app.js)
Seven persisted collections + profile:
- `transactions[]` — every income/expense
- `budgets[]`      — monthly category limits
- `goals[]`        — financial milestones
- `members[]`      — household members
- `debts[]`        — loans, credit cards (NEW v4)
- `assets[]`       — cash, investments, real estate (NEW v4)
- `profile`        — name, email, baseCurrency, language, dateFormat, payoffStrategy, extraPayment
- `exchangeRates`  — USD-base table (editable in Settings)

### Data Shapes
```js
// Transaction — multi-currency
{ id, type:'income'|'expense', amount, date:'YYYY-MM-DD',
  description, category, note, memberId, recurring, currency }

// Debt
{ id, type, name, lender, account, principal, currentBalance,
  interestRate, minimumPayment, dueDate, currency }

// Asset
{ id, type, name, value, liquidity:'liquid'|'short'|'long',
  note, currency, lastUpdated }
```

### 9 Pages
**TRACK** — Dashboard · Transactions · Budgets
**PLAN** — Goals · **Debts** · **Net Worth**
**ANALYZE** — Reports
**Settings** · **Help & Guide**

## Design System v4 (from FinFlow Designs wireframes)

### Palette — Paper Warm (default)
- **Coral** `#E26D5C` — primary action, brand
- **Cream** `#F5EFE6` — canvas
- **Bone** `#FBF7EE` — cards
- **Ink** `#2A2522` — text
- **Sage** `#85A88A` — income, success
- **Olive** `#6B7C53` — savings, deeper positive
- **Honey** `#E8A87C` — warning, near-budget
- **Terracotta** `#C44536` — error, over-budget
- **Denim** `#4A6FA5` — trust, banking
- **Plum** `#6E4555` — multi-gen accent

> "Why warm coral over electric blue? Households associate cool fintech palettes with banks and bills — i.e. the things they're stressed about. Warm cream + coral reads as **kitchen-table conversation**, not **quarterly statement**."

### Typography
- **Newsreader** (italic) — display headings & section opens **only** (page titles, panel/modal titles, the FinFlow wordmark). **Never used for numbers** — `.display-italic` is for editorial headings, not amounts.
- **Inter Tight** (-0.005em) — UI, body, buttons, **and every money / numeric figure via the canonical `.num` class** (non-italic, `tabular-nums` + `lining-nums`). One money treatment across all sections (Dashboard, Budgets, Splits, Transactions, Net Worth, Debts, Reports); size/weight/colour are applied per call-site with utilities. The adaptive `<Money>` component applies `.num` automatically — prefer it for any rendered amount; use the bare `num` class only when rendering a raw `fmt()` string. Tabular figures keep digits column-aligned and stop values reflowing their neighbours, which lowers cognitive load and protects mobile real-estate.
- **JetBrains Mono** — labels, status, dense data tables (e.g. Reports → Period Summary), and micro-annotations such as original-currency sub-amounts (uppercase below 14px). Mono is acceptable for a self-contained numeric *table*; it is not used for headline/row/card amounts.

### Themes
- **Paper Warm** (default)
- **Dark** — same warm palette in dark inks
- **System** — follows OS

## Key Features

### Family Pulse Score™ — 5 components (UPDATED v4)
- Budget Compliance 25%
- Savings Rate 25%
- Goal Progress 15%
- Expense Trend 15%
- **Debt Health 20%** (NEW — debt-to-income ratio)

### Debt Management (NEW)
- 10 debt types: credit card, mortgage, auto loan, student loan, personal loan, business loan, line of credit, medical, family, other
- **Avalanche strategy** — highest APR first (saves money)
- **Snowball strategy** — smallest balance first (motivation)
- **Payoff calculator** — months to payoff per debt with cascade simulation
- **Debt-to-Income ratio** with healthy/watch/high-risk thresholds
- **Extra payment** support — cascades through priority debts
- **Record Payment** modal — auto-creates expense transaction, applies interest first, reduces principal
- **Payoff schedule** — ranked list by strategy

### Net Worth / Balance Sheet (NEW)
- **Hero formula** — Net Worth = Total Assets − Total Liabilities
- **10 asset types** organized by liquidity (liquid/short/long-term)
- **Financial ratios:**
  - Liquidity Ratio (months of liquid coverage)
  - Debt-to-Asset (leverage)
  - Emergency Coverage (months of expenses)
  - Savings Ratio (% income saved)
- Balance sheet split — Assets vs Liabilities columns

### Multi-Currency (NEW)
- 12 currencies: USD, EUR, GBP, INR, JPY, AUD, CAD, CHF, CNY, AED, SGD, BRL
- Each transaction/budget/debt/asset stores **original currency**
- Reports convert to base currency via editable rates table
- Locale-aware formatting via `Intl.NumberFormat`

### Localization (NEW)
- 6 languages: English, Español, Français, हिन्दी, Deutsch, 日本語
- `t(key)` translation function
- Locale-aware date formats: US/EU/ISO

### Interactive Charts (NEW)
- 5 time periods: Day (30d), Week (12w), Month (12m), Quarter (8q), Year (5y)
- SVG-based: line chart, net bar chart, donut breakdown
- Hover tooltips with exact values

### Settings Page (NEW)
- Profile (name, email, household type, date format)
- Localization (language, base currency, editable rates)
- Appearance (3 theme cards)
- Debt Preferences (default strategy, extra payment)
- Sync (JSON backup, restore, CSV export, balance sheet export, clipboard)
- Account Stats (8 counters)

### Help & Guide (NEW)
10 collapsible accordion sections, searchable:
1. Getting Started
2. Family Pulse Score™
3. Debt Management
4. Net Worth & Balance Sheet
5. Currency & Localization
6. Reports & Charts
7. Sync & Backup
8. Keyboard Shortcuts
9. Themes & Appearance
10. Privacy & Security

## Keyboard Shortcuts
- **N** — Add Transaction
- **G** — Add Goal
- **D** — Add Debt
- **A** — Add Asset
- **/** — Focus search
- **Esc** — Close modal

## Responsive
- Desktop ≥1100px — full layout
- Tablet ≤1100px — single-column settings/help, networth stacked
- Mobile ≤820px — slide-out sidebar, hamburger menu, all panels stacked
- Small ≤480px — single-column cards, smaller pulse ring

## Sync & Backup
- **JSON full backup** — restorable snapshot of all data + profile + rates
- **CSV transactions** — for spreadsheets/accountants
- **CSV balance sheet** — assets/liabilities/ratios
- **Clipboard copy** — paste backup as text

## Extending

### Add a currency
1. Add entry to `CURRENCIES` object
2. Add USD-base rate to `DEFAULT_RATES`
3. Refresh — appears in all currency selects

### Add a language
1. Add entry to `LOCALES` object with `name` and `strings` map
2. Translate keys (untranslated keys fall back to English)
3. Appears in Settings → Language dropdown

### Add a debt type
Append to `DEBT_TYPES` map with `icon`, `label`, `liquidity`.

### Add an asset type
Append to `ASSET_TYPES` map with `icon`, `label`, `liquidity`.

## Known Limitations / Future Ideas
- No bank aggregation (open banking / Plaid) — Phase 2
- No real-time exchange rates — manual update only
- No multi-device sync without manual JSON transfer
- No authentication, no encryption of backups at rest
- No business-specific features beyond debt/asset categories (P&L, A/R, A/P) — Phase 3
- No tax category mapping or year-end reports
- Charts use inline SVG, not Canvas — fine up to ~500 data points
- Recurring transactions: flag stored, no auto-generation yet
- Pip mascot defined in design system but not yet used in UI
