# Vyact — Family Finance OS

> Note: This document was updated to reflect the product rename from FinFlow to Vyact (2026-06-01). Older references to "FinFlow" are intentionally preserved for historical context.

## Versioning at a glance

Three deployables, each on its own SemVer line. Authoritative changelogs:
- Master index: [`VERSIONS.md`](VERSIONS.md)
- Consumer: [`react/CHANGELOG.md`](react/CHANGELOG.md) — **current v8.1.0**
- Admin: [`admin/CHANGELOG.md`](admin/CHANGELOG.md) — **current v1.1.0**
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
- **Consumer (React app)** in `react/` — Vite + React 18 + TypeScript + Tailwind + Recharts + Zustand. **Current v8.1.0**. Supabase cloud (auth, multi-household, invitations, realtime, content module) wired behind the `HybridAdapter`. Local-only mode still works without env vars. **Live (CI-deployed prod): https://vyact-twentyx.vercel.app** — this is the production URL of the `react` project under the `bhushandandolus-projects` Vercel team that `deploy.yml` ships to. ⚠ The older `react-taupe-xi.vercel.app` is **orphaned on a different Vercel account**, not updated by CI, and should not be relied on (it serves a stale build).
- **Admin app** in `admin/` — separate Vite + React + TS app with **Claude native theme**. **Current v1.1.0**. Three role tiers (Super / Roles / Content). NorthStar dashboard with live KPIs from `admin_dashboard_kpis()` RPC. **Live (CI-deployed prod): https://vyact-admin.vercel.app** (the `admin` project under the same team). ⚠ The older `finflow-admin.vercel.app` is likewise orphaned on a different account.

**Cloud is opt-in** — without `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars, the React app falls back to localStorage-only mode (single anonymous household, no auth screens). Both modes share the same `DataAdapter` interface.

> **Consumer v6.4.1 status:** All 10 pages ported to React. The big v6.4 fix is **data persistence** — `HybridAdapter` no longer clobbers the local cache with an empty cloud response (per-`(household, entity)` sync sentinel + a store-level shrink guard), which was the root cause of "data lost on refresh / sign-out → sign-in". Other v6.4/v6.4.1 work: every CRUD entity (Transaction, Goal, Budget, Debt, Asset) now uses a store-driven modal mounted at App root; multi-period budgets (`BudgetPeriod`, stored per-device in `ff_budget_periods` until a v6.5 schema migration); adaptive `Money` component for billion-scale values; portal-rendered notification popover; Planner & Chat moved to floating action buttons; pip favicon + web manifest; sidebar logo links to Dashboard with Budgets→PLAN / Splits→TRACK. See [`react/CHANGELOG.md`](react/CHANGELOG.md) for the per-version detail and roadmap.

> **Key architectural conventions added in v6.4:**
> - **Global modals via store slots.** Each CRUD entity has `{entity}ModalOpen` / `editing{Entity}` state + `openAdd{Entity}` / `openEdit{Entity}` / `close{Entity}Modal` actions in `store.ts`. The modal component is mounted once in `App.tsx`. Pages call the store action instead of holding local modal state. Follow this pattern for any new CRUD surface.
> - **Client-side overlays for un-migrated schema.** When a feature needs a column the production DB doesn't have yet (e.g. budget `period`), store it in a namespaced localStorage map (`budgetMeta.ts`) and merge it onto adapter results in `refresh()`. Document the per-device limitation and queue the migration for a later version. **Never** change the production schema mid-release without an explicit migration step.
> - **Cache no-clobber.** `HybridAdapter.applyCloudList()` only trusts an empty cloud response once `ff_cloud_synced_<hid>_<entity>` proves a prior sync. `forceFullResync(hid)` clears the sentinel. Preserve this when touching the adapter.

> **Consumer v8.0.0 status — Onboarding & Activation module.** A new per-household onboarding surface built to [`vyact-onboarding-engineering-spec.md`](vyact-onboarding-engineering-spec.md) (the buildable contract). Six-step segment-driven flow (Welcome → Segment → Context → Snapshot → Forward Model → Reveal) capturing a minimal baseline (snapshot + recurring scaffold — never a bank statement) whose estimates converge to confirmed over a **21-day** window. Files: `config/features.ts` (the `FEATURES.onboarding` flag — the single toggle the whole feature hides behind), `lib/onboardingState.ts` (state machine + provenance + 21-day window), `lib/onboardingTemplates.ts` (per-segment content for individual/household/smb), `pages/Onboarding.tsx` (the flow), `components/ui/EstimatedTag.tsx` (honest-data tag), `lib/onboardingNudges.ts` + `components/onboarding/NudgeBanner.tsx` (progressive capture). Unit pins in `lib/__tests__/onboarding.test.ts` (`CON-UNIT-ONB-001..016`).

> **Key architectural conventions added in v8.0.0:**
> - **Single feature flag, OFF must be a clean no-op.** The whole module checks `isOnboardingEnabled()` (from `config/features.ts`) at every entry. With `enabled = false`: no UI renders, new households are created `skipped`, no estimates are seeded, no nudges fire, no "% confirmed" shows. This is the plug-n-play contract — keep it true. The flag object is also the swap-point for server-driven remote config later.
> - **Onboarding is owned by the HOUSEHOLD, not the user/device — and it is cloud-synced (v8.0.1).** Two halves, two stores: the per-household **state machine** lives on `households.onboarding` (jsonb) with a localStorage *cache* in `onboardingState.ts` (write-through via `registerOnboardingSync`, hydrated by `hydrateOnboardingFromCloud` in `store.init()`); **record provenance** lives as normalized `confidence`/`source`/`estimated_at`/`confirmed_at` columns on the baseline-derived entity tables (`transactions`/`budgets`/`goals`/`debts`/`assets`), so it rides the existing entity sync + RLS and survives a cache clear or device switch. Migration: `20260606120000_v8_onboarding_state.sql`. `migrateExistingHousehold()` marks pre-feature/data-bearing households `skipped`; column defaults are `'confirmed'`/`'user'` so **existing data is never re-onboarded or re-tagged as an estimate.**
> - **The trigger is auth-method-agnostic.** The `App.tsx` guard routes fresh households into the flow regardless of how the user signed in (email today, Google OAuth once the v7.0.1 stub is wired) because it keys off household state, not auth. Invited members of a `completed` household skip baseline capture.
> - **Honest data is non-negotiable.** Any value with `confidence !== 'confirmed'` must render `<EstimatedTag/>`; never style an estimate as confirmed, never auto-overwrite a user value without an explicit tap.

> **Consumer v8.1.0 status — Ask Vyact assistant.** A deterministic, on-device, **no-LLM** three-bucket assistant (Capture / Interpret / Forecast) built to [`vyact-ask-vyact-engineering-spec.md`](vyact-ask-vyact-engineering-spec.md). Five-stage pipeline: `normalise → entityExtract → classifyIntent → resolve → phraseResponse`. Files: `config/features.ts` (`FEATURES.askVyact` flag), `lib/askVyactParser.ts` (stages 1–2, pure), `lib/askVyactIntents.ts` (extended with `classifyIntent`, stage 3), `lib/askVyactResponses.ts` (`phraseResponse`, stage 5, warm variant arrays), `lib/askVyactBackend.ts` (`resolve` stage 4 + `RulesBackend`/`LlmBackend` + `runAssistant` + `proactiveInsight`), wired in `pages/Chat.tsx`. Unit pins in `lib/__tests__/askVyact.test.ts` (`CON-UNIT-ASK-*`).

> **Key architectural conventions added in v8.1.0:**
> - **The assistant phrases; services compute.** Stage 4 (`resolve`) is the ONLY place money is computed, and it does so purely by calling the SAME services that power the dashboard (`spendByCategory`, `liquidAssets`, `monthlyData`, Planner-style helpers). No figure the assistant says is ever produced by a template. Never add arithmetic to the response/tone layer.
> - **Two seams make a future LLM a drop-in.** Only `classifyIntent` (stage 3) and `phraseResponse` (stage 5) are on the `AssistantBackend` interface; stages 1, 2, 4 are pure and model-agnostic and are **never** delegated to a model. `RulesBackend` ships; `LlmBackend` is a stub that swaps in via `FEATURES.askVyact.backend = 'llm'` with zero change to extraction/compute.
> - **Flag OFF reverts to the v7.4.5 launcher.** `Chat.tsx` only routes free-text through `runAssistant` when `isAskVyactEnabled()`; otherwise the two-tap chip launcher behaves exactly as before. Per-bucket flags gate Capture/Interpret/Forecast for staged rollout (a disabled bucket degrades to a clarifying fallback, never an error).
> - **On-device + honest.** All parsing is local — no utterance leaves the client (there is no LLM call). Interpret answers flag estimate-derived figures via the v8.0.1 provenance columns. Forecast never recommends a specific security/product (template guardrail).

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
└── admin/                  — ADMIN app (v1.1.0, separate product)
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
