# Vyact — Family Finance OS

> Note: This document was updated to reflect the product rename from FinFlow to Vyact (2026-06-01). Older references to "FinFlow" are intentionally preserved for historical context.

## Versioning at a glance

Three deployables, each on its own SemVer line. Authoritative changelogs:
- Master index: [`VERSIONS.md`](VERSIONS.md)
- Consumer: [`react/CHANGELOG.md`](react/CHANGELOG.md) — **current v9.0.0**
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
- **Consumer (React app)** in `react/` — Vite + React 18 + TypeScript + Tailwind + Recharts + Zustand. **Current v9.0.0** (Money-Model v2 permanent; **txn-redesign**: single-row transfers/investments, account-level `reconciliation_offset`, type-scoped categories, loan_emi SYSTEM_SPLIT; **Goals & Tax removed as modules**; two-number dashboard; Ask Vyact v2; recurring schedules cloud-synced + household-scoped). Supabase cloud (auth, multi-household, invitations, realtime, content module) wired behind the `HybridAdapter`. Local-only mode still works without env vars. **Live (CI-deployed prod): https://vyact-twentyx.vercel.app** — this is the production URL of the `react` project under the `bhushandandolus-projects` Vercel team that `deploy.yml` ships to. ⚠ The older `react-taupe-xi.vercel.app` is **orphaned on a different Vercel account**, not updated by CI, and should not be relied on (it serves a stale build).
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

> **Consumer v8.8.0 status — Money-Model v2 (live, flags ON).** Built to [`vyact-money-model-execution-and-regression.md`](vyact-money-model-execution-and-regression.md). Governing principle (Part A): **one source of truth — accounts hold real balances, every transaction moves an account; the dashboard is two numbers — Cash Flow (flow) + Net Worth (stock).** **Permanent** (v8.8.1 removed the `moneyModel`/`budgetsV2`/`entryV2` flag objects and inlined the behaviour; `FEATURES` now holds only `onboarding`, `askVyact`, and `savedViews`):
> - **Accounts (Epic 1):** `lib/accountBalance.ts` (balance = opening + credits − debits; reconciliation → dated Balance Adjustment, never overwrite; B1.1 cash-default enforcement in `upsertTransaction`). `accounts.opening_balance` + provenance columns. B1.6 backfill ran on prod (R2 dry-run: 0 orphans, `global_net` invariant). `pages/Accounts.tsx` shows balance + Fix-balance + per-account ledger.
> - **Categories (B1.5):** scoped by type via `CATEGORIES_BY_TYPE`; transfers are forced to `category:'transfer'` at the data layer so they never carry spend/earn categories or double-count (R1).
> - **Budgets v2:** a **monthly/annual → category hierarchy** (`budgetRollup`); **Suggest** icon-only button (editable proposal from `lib/budgetIntel.ts`, read-only A8); 6-month history. Copy carry-forward removed in v8.9.1. (Sub-category allocations were built in v8.7.0 then **removed in v8.8.0** per product — no `Budget.allocations`.)
> - **Dashboard:** two-number hero (Cash Flow + Net Worth) + actionable Pulse guidance.
> - **Reports:** By-member / By-account breakouts permanent (R6), fold over `reportableTxns`.
> - **Ask Vyact v2:** new `interpret.budgets`/`bills`/`debts` intents (chips no longer fall back), typing-stream replies, voice input. Planner advice adapts to `householdType`.
> - **Recurring (v8.9.0):** schedules are a first-class, cloud-synced, household-scoped entity (`recurring_schedules` table + RLS + `created_by`; `'recurring'` adapter entity). The store loads/persists via the adapter (no longer localStorage-only); a one-shot `init()` migration moves legacy local data over. Local-only mode still works via `LocalStorageAdapter`.
> - Regression net: `lib/__tests__/moneyModel.{regression,engines}.test.ts` (golden file + transfer invariant + engine + R7 provenance tests). **Parked:** B4.5 re-theme. The app can't be fully run here — validated via tsc + tests + build + dev-server boot; do a browser QA pass.

> **Key conventions for the money-model program:**
> - **Part A governs — if an implementation would make any number untrue, STOP.** No virtual sub-balance carved out of a real account (A4); no tax entity with a phantom balance (A5); transfers never carry a spend/earn category and never count in spend/income totals (B1.5/R1).
> - **The aggregation golden file is the gate.** Epic 1 (B1.1–B1.6: account enforcement, opening balances, reconciliation, ledger, migration) is scaffolded behind OFF `moneyModel.*` sub-flags and must NOT ship until `moneyModel.regression.test.ts` diffs clean (only intended changes), the migration dry-run reconciles (R2), and the transfer invariant stays green (R1). Update the snapshot deliberately, never blindly.
> - **Debt is already correct (A6) — do not "re-connect" or duplicate it.** EMI = real txn splitting into interest (expense) + principal (liability reduction). Protect this exact flow (C3).

> **Consumer v9.0.0 status — Transaction forms & categories rebuild (txn-redesign).** Built to the binding architect spec [`vyact-txn-redesign-architect-spec_1.md`](vyact-txn-redesign-architect-spec_1.md). A big-bang release behind `FEATURES.txnRedesign` (the data migration is **forward-only**, not flag-reversible). Locked decisions (§0): **D1** transfers AND investments are a **single row** (`type='transfer'|'investment'`, both `account_id`+`to_account_id` NOT NULL, `category` NULL — the `__tg` paired-row encoding is retired); **D2** reconciliation and investment-value updates are an account-level **`reconciliation_offset`** (+ dated `reconciliation_log` quiet-log), **NEVER a transaction** — the offset feeds net worth/balances and is structurally invisible to every spend/income aggregator; **D3** the v7.0.3 track picker is retired; **D4** single release; **D5** Goals/Tax stay absent. Migration `supabase/migrations/20260608120000_v9_txn_redesign.sql` (forward-only): `accounts.kind` → strict enum `bank|cash|credit_card|investment|loan`; nullable `transactions.category`; per-type FK matrix backfilled via `_v9_resolve_account()`; legacy category renames; constraints (`CK_txn_type`, `CK_txn_category_by_type`, `CK_txn_accounts_by_type`, `CK_account_kind`) added **last**. Files: `config/features.ts` (`txnRedesign` flag), `constants.ts` (type-scoped `CATEGORIES_BY_TYPE` + `LEGACY_CATEGORY_ALIASES`), `lib/accountBalance.ts` (balance + `reconcileAccount` offset), `store.ts` (per-type FK matrix in `upsertTransaction`, EMI split, reconcile bridges stated value to linked Asset/Debt for net worth), `components/transactions/TransactionFormModal.tsx` (investment direction toggle, loan picker). Invariant net: `lib/__tests__/moneyModel.invariants.test.ts` (INV-1..9).

> **Key conventions for txn-redesign (v9):**
> - **Reconciliation is forgiveness, not fabrication (D2).** A drift between computed and user-stated balance is absorbed into `accounts.reconciliation_offset` with a dated `reconciliation_log` entry — NEVER a Balance Adjustment transaction (that v8.8 mechanism is gone). The same path serves bank reconcile and investment value updates (the log entry's `kind` switches). Because net worth folds over the linked `Asset`/`Debt` entities, the store's `reconcileAccount` also syncs the stated value to the linked entity (R-AGG-5) — do not let the offset and the entity value diverge, and never let the offset touch spend/income.
> - **Categories are type-scoped — there is no flat pool.** `CATEGORIES_BY_TYPE` keys expense/income to their own enums; transfer and investment pools are **empty** (those rows carry `category=''`/NULL, enforced by `CK_txn_category_by_type`). `LEGACY_CATEGORY_ALIASES` + `getCat`/`deterministicColor` keep pre-migration local caches rendering for one session; never re-tag migrated data.
> - **loan_emi is a SYSTEM_SPLIT.** One EMI = a visible interest expense (counts as spend) + a system transfer leg moving principal into a `kind='loan'` account (excluded from spend, reduces the debt) — atomic. `kind='loan'` accounts are system-only and never a spend-from/deposit-to option.
> - **The §7 invariants are the gate.** INV-1 (transfer neutral), INV-2 (investment neutral), INV-3/3b (value-update = offset + quiet log, no txn), INV-5 (exact EMI split), INV-6 (balance fold), INV-7 (net worth = assets − liabilities), INV-9 (type-scoped categories). If a change makes any of these fail, STOP — a money number became untrue.

> **Goals & Tax removed as modules (v8.8.0, was flagged-off in v8.6.0).** No Goals route/page/modals/nav, no Add-FAB goal or `g` shortcut, no Ask Vyact goal chips/`forecast.goal`, and **Goal Progress is gone from the Pulse Score** (now 4 components: Budgets/Savings/Trend/Debt). The `goalsLens`/`taxNudge` engines and the tax-nudge card were deleted; Planner's old `/goals` links repoint to Net Worth. The `Goal` type + store slice + adapter remain **dormant** (kept to avoid destabilising seed/migration/backup/aiSummary) but are not surfaced or linked anywhere. Do **not** reintroduce goal/tax UI without a product decision.

> **⚠ DB gotcha (learned the hard way in v8.1.1) — views freeze their column list.** Postgres expands `select h.*` into explicit columns **at view-creation time**; adding a column to the base table does NOT add it to the view. `my_households` is `select h.*` over `households`, so the v8 `households.onboarding` column was invisible to it and the consumer's `select=…,onboarding` 400'd — blocking the whole app. **When you add a `households` column the consumer reads through `my_households`, you MUST also drop+recreate that view** (CREATE OR REPLACE can't reorder columns). The adapter's `listHouseholds()` now also retries without the new column as a safety net, but recreate the view — don't rely on the fallback.

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
