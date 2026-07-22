# Vyact — Family Finance OS

> Note: This document was updated to reflect the product rename from FinFlow to Vyact (2026-06-01). Older references to "FinFlow" are intentionally preserved for historical context.

## Versioning at a glance

Three deployables, each on its own SemVer line. Authoritative changelogs:
- Master index: [`VERSIONS.md`](VERSIONS.md)
- Consumer: [`react/CHANGELOG.md`](react/CHANGELOG.md) — **current v10.8.0**
- Admin: [`admin/CHANGELOG.md`](admin/CHANGELOG.md) — **current v1.3.1**
- Database (Supabase): migrations are source of truth at [`supabase/migrations/`](supabase/migrations/); reconciled with prod (TD-20) — see [`db/MIGRATIONS.md`](db/MIGRATIONS.md)
- Vanilla shell: archived from the working tree in **v7.0.1** — see master index and git history

> 🧭 **New session? Start with [`docs/HANDOFF.md`](docs/HANDOFF.md)** — the continuity brief:
> live URLs, the Vercel/Supabase gotchas, how deploys really work, open work, and
> the command cheatsheet. It's written to get a fresh context productive fast.

**Live production (2026-05-30):** consumer **https://vyact-twentyx.vercel.app** ·
admin **https://vyact-admin.vercel.app** (both on Vercel team `bhushandandolus-projects`).
The older `react-taupe-xi` / `finflow-admin` URLs are **orphaned on a different
account** — do not use. Every push to `main` deploys (see [`DEPLOY.md`](DEPLOY.md)).

## Project Overview
Three parallel deliverables exist in this repo:

- **Consumer (vanilla shell, legacy)** — archived. The v1.0-v5.0 vanilla HTML/CSS/JS app was removed from the working tree in v7.0.1 (2026-06-01). It is preserved in git history at commits before that cleanup. The React app at `react/` (v6.0+) is the only active consumer product.
- **Consumer (React app)** in `react/` — Vite + React 18 + TypeScript + Tailwind + Recharts + Zustand. **Current v10.5.0** (Aurora Batches A–E — the full planned redesign: cross-device notifications + 13-type sheet, household-switch pull-down, amount-first Add-Transaction half-sheet, home polish; Track restyled (Transactions chip-rail + filter half-sheet, Splits who-owes-who hero, Recurring upcoming strip); Plan restyled (Net Worth waterfall + liquidity bar, Debts payoff ring, Budgets pace hero, Accounts wallet cards); Analyze restyled (Reports needs-vs-wants verdict bar, Insights tri-tab + neu cards, Planner severity-spined cards, Ask Vyact chat bubbles); Profile/first-run restyled (Auth glass card + pip, Help neu FAQ accordion, Settings theme thumbnails — full Households/Onboarding/Settings-list treatment tracked as follow-up); Money-Model v2 permanent; txn-redesign; budgets monthly/annual with DB-owned identity; recurring cloud-synced; Goals & Tax removed as modules; store decomposed into Zustand slices). Per-version history is in [`react/CHANGELOG.md`](react/CHANGELOG.md) (authoritative) and [`docs/HISTORY.md`](docs/HISTORY.md) (agent-oriented archive). Supabase cloud (auth, multi-household, invitations, realtime, content module) wired behind the `HybridAdapter`; local-only mode works without env vars. **Live (CI-deployed prod): https://vyact-twentyx.vercel.app** (the `react` project under the `bhushandandolus-projects` Vercel team that `deploy.yml` ships to). ⚠ The older `react-taupe-xi.vercel.app` is **orphaned on a different account**, not CI-updated.
- **Admin app** in `admin/` — separate Vite + React + TS app with **Claude native theme**. **Current v1.3.1**. Three role tiers (Super / Roles / Content). NorthStar dashboard with live KPIs from `admin_dashboard_kpis()` RPC. **Live (CI-deployed prod): https://vyact-admin.vercel.app** (the `admin` project under the same team). ⚠ The older `finflow-admin.vercel.app` is likewise orphaned on a different account.

**Cloud is opt-in** — without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars, the React app falls back to localStorage-only mode (single anonymous household, no auth screens). Both modes share the same `DataAdapter` interface.

## Architecture conventions (binding)

These are the **current, binding** rules distilled from the project's history — violating one is a regression. Per-version narrative (the "what shipped when") is archived in [`docs/HISTORY.md`](docs/HISTORY.md); the authoritative changelog is [`react/CHANGELOG.md`](react/CHANGELOG.md).

**Global modals via store slots.** Each CRUD entity has `{entity}ModalOpen` / `editing{Entity}` state + `openAdd/openEdit/close{Entity}Modal` actions; the modal mounts once in `App.tsx` and pages call the store action (never local modal state). Follow this for any new CRUD surface.

**Cache no-clobber.** `HybridAdapter.applyCloudList()` only trusts an empty cloud response once the `cloud_synced_<hid>_<entity>` sentinel proves a prior sync; `forceFullResync(hid)` clears it. Preserve this when touching the adapter.

**Onboarding** is owned by the HOUSEHOLD and cloud-synced — the state machine lives on `households.onboarding` (jsonb) with a localStorage cache; record provenance is normalized `confidence`/`source`/`estimated_at`/`confirmed_at` columns on the entity tables. The whole module is a clean no-op when `isOnboardingEnabled()` is false (new households created `skipped`, nothing seeded/nudged). **Honest data is non-negotiable:** any value with `confidence !== 'confirmed'` renders `<EstimatedTag/>`; never style an estimate as confirmed or auto-overwrite a user value without an explicit tap.

**Ask Vyact** is on-device, no-LLM, deterministic (pipeline `normalise → entityExtract → classifyIntent → resolve → phraseResponse`). **The assistant phrases; services compute** — stage 4 (`resolve`) is the only place money is computed, purely via the same services that power the dashboard; never add arithmetic to the response/tone layer. Only `classifyIntent` + `phraseResponse` are on the swappable `AssistantBackend` seam (a future LLM is a drop-in); stages 1/2/4 stay pure and model-agnostic.

**Money model — the gate.** Part A: one source of truth — accounts hold real balances, every transaction moves an account; the dashboard is two numbers (Cash Flow + Net Worth). **If an implementation would make any number untrue, STOP.**
- Transfers AND investments are a **single row** (`type='transfer'|'investment'`, both account FKs NOT NULL, `category` NULL) and are **spend/income-neutral** — they never carry a category and never count in spend/income totals (enforced by `CK_txn_category_by_type`).
- Reconciliation / value-updates are an account-level **`reconciliation_offset`** + dated `reconciliation_log`, **never a transaction**. Because net worth folds over the linked `Asset`/`Debt` entities, `store.reconcileAccount` also bridges the stated value to the linked entity (R-AGG-5) — keep the offset and the entity value in lockstep, and never let the offset touch spend/income.
- `loan_emi` is a **SYSTEM_SPLIT**: a visible interest expense (counts as spend) + a system transfer leg moving principal into a `kind='loan'` account (excluded from spend, reduces the debt) — atomic. `kind='loan'` accounts are system-only.
- Categories are **type-scoped** (`CATEGORIES_BY_TYPE`); there is no flat pool. Never re-tag migrated data.
- **The invariant + golden suites are the gate:** `lib/__tests__/moneyModel.{invariants,regression,engines}.test.ts` — INV-1..9 (transfer/investment neutral, value-update = offset not txn, exact EMI split, balance fold, net worth = assets − liabilities, type-scoped categories) + the aggregation golden file. Update the snapshot **deliberately**, never blindly. Debt is already correct (EMI = interest expense + principal liability reduction) — do not "re-connect" or duplicate it.

**Budget identity lives in the DB.** One budget per `(household, scope, period)`, enforced by `uq_budget_month`/`uq_budget_annual` + the `upsert_budget(h,b,mode)` RPC — the single writer for every entry point (form + future Ask Vyact / WhatsApp / API). **Never put budget identity on the client** (no deterministic id, no per-device overlay — both were bugs). Create is online (household-wide existence check) and raises `BUDGET_EXISTS` on a taken slot; delete+recreate replaces. A budget is a period **container**; per-category limits are the cloud-synced `budget_allocations` child table. **The form saves both atomically (v9.6.0):** `upsert_budget_with_allocations(h,b,allocs,mode)` wraps `upsert_budget` and writes the budget + its full allocation set in ONE online transaction via `saveBudgetWithAllocations` — never the old two-step where child allocations went through the optimistic queue and could silently dead-letter. Don't reintroduce a queued/per-row allocation write on the save path. **Row-mapping rule:** a NOT-NULL column with a DB default must be written as its default or **omitted** (so the default applies) — never as an explicit `null` (use `?? undefined`, which supabase-js drops from the payload).

**Store is sliced (TD-25).** `store/index.ts` is a thin composition root; the domain logic lives in `store/slices/` (modal, reconcile, notify, recurring, cloudAuth, sync, data, crud) + shared `store/localJson.ts` + typed `store/testHooks.ts`. Every slice folds into the `Store` type via `extends <Slice>` and is composed in `create<Store>((set,get,api)=>({ ...createXSlice(set,get,api), … }))`. The money-critical `upsertTransaction`/`recordDebtPayment` live in `dataSlice`. When refactoring, keep `useStore`'s public type/behaviour **byte-identical** and verify against the money suites after each step.

**Motion is a shared system (v9.6.0).** Animation uses **framer-motion** through one vocabulary in [`react/src/lib/motion.ts`](react/src/lib/motion.ts) (the house `spring` + `dialogPanel`/`popover`/`banner`/`toast`/`stagger` variants) — reuse these, don't hand-roll per-component springs. Accessibility is global: `<MotionConfig reducedMotion="user">` wraps the app in `App.tsx`, so every motion component degrades to instant under OS reduce-motion — never bypass it. Overlays that need an **exit** animation use `AnimatePresence` (modals/popovers/toasts/banners). Money figures animate via `<AnimatedMoney>` (count-up that reuses `<Money>` formatting) and must **settle exactly with no overshoot** — `bounce: 0` on amounts; tone is calm (≤260ms, small travel), never flashy on money. Two legacy CSS keyframes remain in `tailwind.config.ts` (`modalIn`/`toastIn`) but new work should prefer the motion tokens.

**Sync is refresh-based + observable.** Devices converge on refresh (visibility/focus/online + a foreground poll), not a live socket. The queue mechanics live in `lib/sync/` (`syncQueue`/`deadLetter`/`backoff`/`conflict`); `hybridAdapter` keeps only the cache-first read/no-clobber policy + a flush orchestrator. Faults are classified via `lib/faults.ts` — `expected()` (quiet degraded path) vs `unexpected()`/`droppedWrite()` (contract violation / dropped write → structured record + pluggable transport). **Never re-introduce a silent write-loss `catch {}`** on a write/contract path (a dev `FaultsPanel` surfaces unexpected faults).

**Goals & Tax are removed as modules** (since v8.8.0). No Goals route/page/modals/nav, no Add-FAB goal or `g` shortcut, no Ask Vyact goal chips; Pulse Score is 4 components (Budgets/Savings/Trend/Debt). The `Goal` type + store slice + adapter remain **dormant** (kept to avoid destabilising seed/migration/backup) but are not surfaced anywhere. Do **not** reintroduce goal/tax UI without a product decision.

**Insights Hub** (consumer v9.5.3+, admin v1.3.0+). `/insights` is a 4-tab hub (For You / Learn / What's New / Plan); the Planner lives in the **Plan** tab (no FloatingTool bubble — that icon is now Ask Vyact's). Binding rules: (1) the **For You** feed (`lib/insightsFeed.ts`) is **on-device and adds NO financial math** — every number comes from the existing aggregates (`monthlyData`/`spendByCategory`/Pulse); it's tone-mixed (≤1 constructive card/session) and **finite** (the mobile reel ends, no infinite scroll). (2) Card **visuals render from a CLOSED code set** — `icon` (57-name allowlist) · `stat` · `diagram` (6 primitives: arc/arrow/bar2/compare2/stack) — **never hosted images, never LLM/free-form generation**; the same renderer logic backs the consumer card and the admin live-preview. (3) Content lives in **`content_items.format`** = `'article'` (legacy editorial) | `'card'` (evergreen, visual+text) | `'external'` (curated link-out, source allowlist RBI/SEBI/IncomeTax/PFRDA_NPS/GovScheme — link out, never copy the body); DB CHECK constraints enforce card-has-visual and external-has-source. The 116 evergreen cards are seeded in the DB **and** bundled at `react/src/data/evergreenCards.json` (Learn currently renders the bundle). Spec: [`docs/insights-hub-spec.md`](docs/insights-hub-spec.md) + [`docs/insights-integration-spec.md`](docs/insights-integration-spec.md). (4) **Sharing + public SEO (v9.6.0):** evergreen lessons are **public** and server-rendered at `/learn` + `/learn/<slug>` by **Vercel functions in `/api`** (`learn.js`/`sitemap.js`/`robots.js`, root `vercel.json` rewrites) with OG meta, a branded `/og-vyact.svg`, and `Article`/`LearningResource`/`ItemList` JSON-LD — because the app is a pure SPA, this server surface is the ONLY thing crawlers/AI see, so keep meta + JSON-LD there. **Privacy rule:** a personal *For You* insight NEVER gets a public page or appears in a share URL — it shares an app-promo link with no numbers; only evergreen content is publicly shareable/indexable.

**WhatsApp integration is dormant** (v9.3.0 connection foundation). Two RLS-locked service-role-only tables + Edge Functions; no secrets in code (Supabase secrets `WHATSAPP_*`); the webhook deploys `--no-verify-jwt`, the OTP functions verify JWT. Inactive until Meta credentials/template/webhook are configured. (Future budget/txn writers from this path go through the `upsert_budget` RPC like every other entry point.)

**⚠ DB gotcha — views freeze their column list.** Postgres expands `select h.*` into explicit columns **at view-creation time**; adding a column to the base table does NOT add it to the view (`my_households` is `select h.*` over `households` — a missing column 400'd the whole app once). When you add a `households` column the consumer reads through `my_households`, you **must drop+recreate** that view (`CREATE OR REPLACE` can't reorder columns).

**Validating DB RPCs costs nothing.** Run the real function against a real household inside a single `DO` block that ends with `RAISE` → Postgres rolls the whole block back and the RAISE message carries the PASS/FAIL report. Impersonate an authed member with `set_config('request.jwt.claims', …, true)`. No paid Supabase branches. After any DDL, run `get_advisors` (security + performance).

## File Structure
```
budget-app/
├── db/schema.sql           — Postgres schema (Supabase-ready)
├── VERSIONS.md             — MASTER changelog index (links to per-app CHANGELOGs)
├── ARCHITECTURE.md         — Cloud + auth + multi-household design
├── CLAUDE.md               — this file
├── README.md               — repo overview + run instructions
├── react/                  — CONSUMER app (v7.0.0)
│   ├── CHANGELOG.md         — consumer per-version history + roadmap
│   ├── package.json, vite.config.ts, tsconfig.json, tailwind.config.ts
│   ├── index.html, .env.local, README.md
│   ├── public/              — favicon.svg (pip mascot), manifest.webmanifest
│   └── src/
│       ├── main.tsx, App.tsx, index.css
│       ├── types.ts, constants.ts, store.ts, hooks.ts
│       ├── config/           — features.ts (FEATURES.onboarding flag, v8)
│       ├── lib/             — format, i18n, calculations, dataAdapter,
│       │                      hybridAdapter, supabaseAdapter, auth, permissions,
│       │                      migration, budgetMeta, templates, amortization,
│       │                      recurring, notifications, plannerRules, aiSummary,
│       │                      insightsApi, analytics, featureFlags, seed,
│       │                      onboardingState, onboardingTemplates,
│       │                      onboardingNudges (v8) (all TS)
│       ├── components/
│       │   ├── ui/          — Button, Card, Modal, Input, Badge, Toast, Empty, Money, EstimatedTag
│       │   ├── onboarding/   — NudgeBanner (v8 progressive capture)
│       │   ├── layout/      — TopBar, SubNav, CommandPalette, AccountMenu,
│       │   │                  MobileTabBar, Brand, navModel, ProfileSwitcher, Layout,
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
└── admin/                  — ADMIN app (v1.3.1, separate product)
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

### v6 React
```bash
cd react
npm install
npm run dev          # → http://localhost:5173
```
## Vanilla Shell

The legacy vanilla shell was archived from the working tree in **v7.0.1**. Its source is intentionally preserved in git history, but it is no longer a supported runtime surface or local run target.

## Design System — "Aurora" (v10.0.0, from `design_handoff_vyact_aurora`)

Neumorphic Fluid: soft dual-light **neumorphism** for everyday chrome (cards, buttons,
inputs, nav pills — `--neu`/`--neu-sm`/`--neu-inset`/`--neu-hover`), **glass**
(blur + translucency — `.glass-panel`) reserved for key moments (⌘K palette, account
dropdown, popovers). Ambient aurora glow behind content (`--ambient` on `body::before`).

### ⚠ Token usage rule (binding — a silent-failure class)
`index.css` has TWO token conventions. **HSL triplets** (`--coral --sage --honey
--denim --plum --terra --olive --line --line2 --bg* --ink*` …) are consumed as
`hsl(var(--x))` or via their Tailwind classes; **complete-value tokens**
(`--canvas --sunken --elevated --accent --accent-ink --neu* --rail --coral-grad
--glass* --ff-*` …) are consumed as `var(--x)` directly. Writing a triplet raw
(`border: 1px dashed var(--line2)`) is INVALID CSS and the browser silently
drops the whole declaration — no error anywhere. After styling, verify each new
decorative property (border/background/shadow) via computed style in the
browser, not just element presence; and grep new code with
`(?<!hsl\()var\(--(coral|sage|honey|denim|plum|terra|olive|line2?|bg\d?|ink)` before shipping.

### Palette — Nocturne (dark, DEFAULT) · Mist (light)
- **Canvas/Elevated/Sunken/Hover** `#0F181B / #17242A / #0A1215 / #1C2C33` (dark) ·
  `#E7EDEC / #FFFFFF / #DAE3E1 / #EFF4F3` (light) — mapped onto the legacy Tailwind slots
  `bg/bg2/bg4/bg3` so existing utilities re-skin automatically.
- **Accent = pip coral** `#EC8474` dark / `#E26D5C` light (`--coral`, `--accent`) — brand,
  primary action, focus. Swappable by design (Indigo/Jade exist in the handoff); Coral ships.
- **Semantic ("Accidental Wealth" rule — colors are meaningful, never decorative):**
  `--sage`=good/gains `#4FD9AE`·`#2E9E78` | `--honey`=warn/80–99% `#F2C978`·`#B98A38` |
  `--denim`=info/banking `#63D6EA`·`#2C93A8` | `--plum`=forecast/AI `#C4A6FF`·`#7C55C4` |
  `--terra`=crit (genuine failures ONLY) `#F58A8C`·`#D25656`. **Never use crit for "money
  spent"** — expenses render neutral ink; income in good.
- **Aurora rail gradient** `linear-gradient(120deg,#38C89B,#6D7CF0,#B08CF5)` (`--rail`) —
  the 3px strip atop the app bar, avatars, focus flourishes.
- **Category colors are kept from `constants.ts`** (donut/rows need distinct hues) — do not
  recolor them to the accent palette.

### Typography
- **Outfit** — display/headings/labels via `.display-italic` (class name kept for call-site
  stability; it is now upright Outfit 600) and `font-display`.
- **Inter** — UI/body (`--ff-sans`, body default).
- **JetBrains Mono** — **every** figure via the canonical `.num` class (tabular + lining),
  `mono-label` overlines, dense tables. The `<Money>` component applies `.num` automatically.

### Themes
- **Nocturne (dark)** — DEFAULT (`:root` / `data-theme="dark"`).
- **Mist (light)** — keeps the historical `data-theme="warm"` attribute so stored prefs survive.
- **System** — follows OS.

### Navigation shell (v10 — no left sidebar)
- **Desktop/tablet (≥640px):** sticky glass **TopBar** (rail strip · pip "Vy·act" wordmark ·
  **Track/Plan/Analyze** sliding-pill SectionTabs · "Jump to… ⌘K" · bell · AccountMenu) +
  contextual **SubNav** pill row + **⌘K CommandPalette** (quick actions + every route — the
  reachability guarantee). Account routes (Households/Settings/Help) live in the avatar
  dropdown, which also hosts ProfileSwitcher and the theme control.
- **Mobile (<640px):** slim glass top bar + bottom **MobileTabBar** (Home/Track/Plan/Analyze/
  Profile); secondary routes via the SubNav pill scroller.
- Shared route model + template/flag visibility rules: `components/layout/navModel.ts`.

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
- Mobile <640px — bottom tab bar (Home/Track/Plan/Analyze/Profile), slim glass top bar, all panels stacked
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
