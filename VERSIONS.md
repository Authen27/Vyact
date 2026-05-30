# FinFlow — Master Version History

> **Parent / master changelog.** Per-app detail lives in each app's own `CHANGELOG.md`; this document is the single index that tells you what's installed, what shipped where, and what's coming next.

## Three deployables in this repo

| App | Path | Current | Live URL | Per-app changelog |
|---|---|---|---|---|
| **Consumer (React)** | `react/` | **v6.6.0** | https://react-three-puce-61.vercel.app | [`react/CHANGELOG.md`](react/CHANGELOG.md) |
| **Admin** | `admin/` | **v1.0.8** | https://admin-six-orpin-47.vercel.app | [`admin/CHANGELOG.md`](admin/CHANGELOG.md) |
| **Database (Supabase)** | `supabase/migrations/` | **td-08-09-13-honest-residuals** | n/a — auto-applied by `deploy.yml` via `supabase db push` (TD-20 / PR #16) | [`db/MIGRATIONS.md`](db/MIGRATIONS.md) |
| **Vanilla shell (legacy consumer)** | `/` (root) | **v5.0** *(frozen)* | n/a — opens `index.html` directly | [§ Vanilla shell history](#vanilla-shell-history-v10--v50) below |

> **Production URL note (updated 2026-05-30):** the live URLs above are the production domains of the `react` / `admin` projects under the `bhushandandolus-projects` Vercel team that `deploy.yml` deploys to. The previously-documented `react-taupe-xi.vercel.app` / `finflow-admin.vercel.app` are **orphaned on a different Vercel account**, are not updated by CI, and serve stale builds — reclaiming those exact hostnames needs dashboard action on that other account. See [`DEPLOY.md`](DEPLOY.md) for the authoritative deploy process.

The three apps deploy independently and are versioned independently. The vanilla shell at the repo root is kept available as the *original* FinFlow app from before the React port; it shares no code with the admin app.

---

## Cross-app release timeline

Newest first. For full per-version detail, follow the link in the **App** column.

| Date | App | Version | Headline |
|---|---|---|---|
| 2026-05-30 | [Consumer](react/CHANGELOG.md#v660--earnable-pulse-score--google-sign-in--reset-without-email-2026-05-30) | **v6.6.0** | **Earnable Pulse Score + Google sign-in + reset-without-email.** Pulse Score (plan 09) drops the arbitrary component defaults that pinned empty accounts at ~55: each component is scored only when it has data and the weights renormalise, so an empty account reads `null` → gauge shows "— / No data yet" instead of a fake number; `PulseGauge` respects `prefers-reduced-motion`. Adds a `GoogleButton` (plan 11, gated on `isCloudEnabled`) to Sign In / Sign Up / Reset — needs the Supabase Google provider configured before it works (dashboard step, not in this code release). Password reset (plan 07) gains Google + magic-link fallbacks + a no-cloud state so it never dead-ends without SMTP. `aiSummary.ts` widened to accept `pulseScore.total: number\|null`. Lint clean, build green; no schema change (plan-10 migration ships separately). |
| 2026-05-30 | [Consumer](react/CHANGELOG.md#v651--in-app-new-version-available-update-prompt-2026-05-30) | **v6.5.1** | **In-app "new version available" update prompt.** Fixes deploys not reaching long-lived tabs (the v6.5.0 footer-stuck confusion). Build stamps `dist/version.json`; a new `UpdateBanner` polls it (`no-store`, on load/focus/15-min) and prompts Refresh when the deployed version differs from the running `__APP_VERSION__`. No service worker involved; purely additive UI. |
| 2026-05-30 | [Consumer](react/CHANGELOG.md#v650--e2e-test-automation-foundation-batch-12--test-build-cloud-leak-fix-2026-05-30) | **v6.5.0** | **E2E test automation foundation + test-build cloud-leak fix (non-functional release).** No runtime/UI change. Lands the Playwright E2E suite (20 passed / 3 skipped on chromium) covering Transaction Creation, Budgets, and Debt payment math, with Page Objects, deterministic fixtures, and the test-case inventory (`react/e2e/TEST_CASE_INVENTORY.md`, 20/163 developed) as the QA source of truth. Adds a11y groundwork that also stabilises test locators (`Modal` `role="dialog"`/`aria-labelledby`, `Field` `htmlFor`/`id`). Build fix: the v6.4.27 production Supabase `FALLBACK_URL/KEY` was applied on the e2e `--mode test` build too, flipping the test app into cloud mode and gating every route behind `/auth/sign-in`; the fallback is now skipped when `MODE === 'test'` — real production (`MODE === 'production'`) is unchanged. |
| 2026-05-30 | [Consumer](react/CHANGELOG.md#v6427--production-db-connection-fix--deploy-hardening--in-app-version-note-2026-05-30) | **v6.4.27** | **Production DB-connection fix + deploy hardening + in-app version note.** Root-caused why the live consumer showed *dummy/seeded* data: the CI build shipped in local-only mode because `VITE_SUPABASE_URL`/`ANON_KEY` never reached it. Fixed by committing `react/.env.production` + `admin/.env.production` with the **public** project URL + publishable key (RLS enforces security), and removing the empty-secret `VITE_SUPABASE_*` injection from `deploy.yml` (Vite gives shell env vars precedence over `.env` files, so an empty secret silently overrode the config). Deploy pipeline now deterministic & self-contained: every push to `main` deploys; `db-migrations` is best-effort and never blocks the app deploys. Added a build-time version sub-note (from `package.json`) to the **Help & Guide** page. Corrected the documented live URLs to the real Vercel production domains. Admin verified healthy (NorthStar dashboard on live prod data). See [`DEPLOY.md`](DEPLOY.md). |
| 2026-05-29 | [Consumer](react/CHANGELOG.md#v6426--money-typography-standardisation-one-canonical-figure-style-across-all-sections-2026-05-29) | **v6.4.26** | **Money typography standardisation.** One canonical `.num` figure style (non-italic Inter Tight, tabular + lining numerals) for every amount across Dashboard, Budgets, Splits, Transactions, Net Worth, Debts, Reports — replacing the previous mix of italic-serif KPI/hero numbers, mono transaction rows, and plain non-tabular sans totals. `<Money>` now applies `.num` automatically; headings stay editorial italic; dense numeric tables stay mono. Purely visual — no value/format change. |
| 2026-05-29 | [Database](db/MIGRATIONS.md) | **td-08-09-13-honest-residuals** | **TD-08 / TD-09 / TD-13 actually in prod now (PR #20).** Four migrations: `20260529150000_td13_budgets_add_period.sql` (adds the period columns the consumer's been faking with `budgetMeta.ts` since v6.4), `20260529150500_td08_audit_triggers.sql` (`log_domain_activity` SECURITY DEFINER + 6 triggers, with the `search_path` + memberships corrections from the review), `20260529151000_td09_replace_all_rpcs.sql` (6 `replace_<entity>` SECURITY DEFINER RPCs), `20260529151500_td08_td09_harden_execute_grants.sql` (revokes the default PUBLIC execute grant after the security advisor flagged anon-exposure of the new functions). **Applied to prod directly via the Supabase MCP `execute_sql` flow** (the GitHub Actions browser-merge path was unavailable), with the four `schema_migrations` tracker rows recorded to match the repo filenames 1:1 — so the CI `db push` on this release is a clean no-op. Discovery during prep: the earlier "Resolved on paper" claim for TD-13 was incorrect (baseline grep showed no `period` columns); fixes the `db/migrations-superseded/README.md` claim too. Security advisor re-checked post-apply: zero anon-executable and zero `function_search_path_mutable` warnings on any PR #20 function. |
| 2026-05-28 | [Database](db/MIGRATIONS.md) | **production-baseline** | **TD-20 reconciliation — closes TD-20 (PR #16).** Captures actual production schema as a single new baseline (`00000000000001_production_state_baseline.sql`, ~46 KB: 16 tables, 18 indexes, ~55 RLS policies, 15 functions incl. the live admin RPCs, 12 triggers). The earlier 8 design-intent migrations move to `db/migrations-superseded/` (out of the apply path, kept for git history). New `db-migrations` job in `deploy.yml` runs `supabase db push --include-all` before the app deploy jobs so the apply step is no longer manual. Baseline pre-recorded in `supabase_migrations.schema_migrations` so the first deploy is a verified no-op against prod. Three follow-up hotfixes shipped on the same day: PR #17 pinned Supabase CLI version (rate-limit fix), PR #18 added minimal `supabase/config.toml` (required by `supabase link`), PR #19 added 13 stub files matching the pre-baseline prod-tracker entries (CLI requires 1:1 sync between local files and remote tracker). |
| 2026-05-24 | [Consumer](react/CHANGELOG.md#v6425--lead-review-pass--td-08-audit-triggers--td-04-extension-catch-up-remediation-pr-13-batch-2026-05-24) | **v6.4.25** | **Lead review pass over the dev's PR #13 batch — closes TD-08/09/10/12/13/15.** Adds TD-08 audit triggers (with the missing `memberships` + `search_path` corrections the dev's patch lacked); accepts TD-04-ext-a/b; documents the TD-04-ext-c scope deviation (dev wrote subscription/content mutation RPCs instead of the requested admin_list_users/weekly_trend/ai_usage_summary). Filename-case + e2e ID + schema-regen blockers all corrected. |
| 2026-05-24 | db-migrations | audit-triggers | TD-08: server-side `activity_log` triggers on every domain table (incl. memberships, added during review) via `log_domain_activity()` SECURITY DEFINER function with `search_path` lockdown. |
| 2026-05-24 | db-migrations | content-items | TD-04-ext-b: `content_items` + `content_favorites` tables + RLS; wires `publishedArticles` / `contentFavorites` into `admin_dashboard_kpis()`. |
| 2026-05-24 | [Admin](admin/CHANGELOG.md#v108--slug-sanitiser-edge-case-fix-remediation-pr-3-2026-05-24) | **v1.0.8** | Slug sanitiser edge-case fix: `slugify()` now returns an empty string for punctuation-only inputs (ADM-UNIT-006). |
| 2026-05-24 | [Consumer](react/CHANGELOG.md#v6420--td-15-mfa-enrolment-auth-hardening) | **v6.4.20** | TD-15: Add MFA enrolment helpers and a Security subsection in Settings; docs/AUTH_HARDENING.md added. |
| 2026-05-24 | [Consumer](react/CHANGELOG.md#v6421--td-13-budgets-period-column-migration) | **v6.4.21** | TD-13: Add `period`/`period_start`/`period_end` columns to `budgets` (migration added). |
| 2026-05-24 | [Consumer](react/CHANGELOG.md#v6422--td-09-atomic-replace_all-rpc--adapter-call) | **v6.4.22** | TD-09: Add server-side `replace_<entity>` RPCs and call them from the Supabase adapter for atomic bulk replace operations. |
| 2026-05-24 | [Consumer](react/CHANGELOG.md#v6423--td-10-sync-status-badge--sidebar-mount) | **v6.4.23** | TD-10: Add a sidebar `SyncStatusBadge` to surface sync/queued/conflict state. |
| 2026-05-24 | [Consumer](react/CHANGELOG.md#v6424--td-12-memoised-selectors--dashboard-updates) | **v6.4.24** | TD-12: Add memoized selectors and update Dashboard to use them. |
| 2026-05-24 | db-migrations | subscriptions | Add `subscriptions` table and wire `paidSubscriptions`/`mrr` into `admin_dashboard_kpis()` (TD-04-ext-a). |
| 2026-05-24 | db-migrations | admin-rpcs | Add admin RPCs for subscriptions & content (admin_list_subscriptions, admin_cancel_subscription, admin_publish_content_item) (TD-04-ext-c). |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6419--td-03-phase-b-concurrency-wired-across-all-crud--in-app-conflict-banner-remediation-pr-12-2026-05-23) | **v6.4.19** | **TD-03 phase B: concurrency wired across all CRUD + in-app conflict banner (remediation PR #12). Closes TD-03.** Budget/Goal/Debt/Asset interfaces gain `updated_at?`; row mappers thread it from the cloud; `upsertBudget/Goal/Debt/Asset` store actions pass it as the precondition on edits. New `SyncConflictBanner` mounted in Layout polls `pendingConflictCount()` every 5s and shows a banner with a Dismiss action when conflicts dead-letter. `HybridAdapter.clearConflicts()` added. Two household members editing the same row no longer silently overwrite each other anywhere in the app. |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6418--td-03-phase-a-optimistic-concurrency-at-the-cloud-boundary-remediation-pr-11-2026-05-23) | **v6.4.18** | **TD-03 phase A: optimistic concurrency at the cloud boundary (remediation PR #11).** SupabaseAdapter.upsert gains an optional `expectedUpdatedAt` precondition; when supplied, performs a guarded UPDATE and throws `ConcurrencyConflictError` if the cloud row has been touched since the caller's read. HybridAdapter dead-letters conflicts to `ff_sync_conflicts` and exposes `pendingConflictCount()`. Transactions edit is the first wired call site. 3 new tests (`CON-UNIT-051..053`). UI toast + the other 4 CRUD entities queued for PR #12. |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6417--td-01-phases-cd-decimal-money--amortisation--cloud-boundary-remediation-pr-10-2026-05-23) | **v6.4.17** | **TD-01 phases C+D: decimal money — amortisation + cloud boundary (remediation PR #10).** **Closes TD-01.** Phase C: `amortization.ts` carries outstanding balance as Dinero across 300-row schedules; `splitPayment(…, currency)` quantises both interest and principal. Phase D: new `parseMoneyFromCloud` helper centralises the supabaseAdapter row-mapper boundary; `types.ts` gains the TD-01 discipline doc block. 4 new pins (CON-UNIT-047/048/049/050); 5 existing tests tightened. |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6416--td-01-phase-b-decimal-money--aggregations-in-dinero-space-remediation-pr-9-2026-05-23) | **v6.4.16** | **TD-01 phase B: decimal money — aggregations in dinero space (remediation PR #9).** Every aggregator in `calculations.ts` (sums, grouped reduces, splits) folds in dinero integer-cents arithmetic; reductions no longer drift across `+`. `calculations.test.ts` tightened from `toBeCloseTo` to strict `.toBe` where exactness is now achievable. New `CON-UNIT-046` pins the float-drift fix on 10×$0.10 sums. Phases C/D still queued. |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6415--td-01-phase-a-decimal-money--dineroJs-at-the-fx-boundary-remediation-pr-8-2026-05-23) | **v6.4.15** | **TD-01 phase A: decimal money — dinero.js at the FX boundary (remediation PR #8).** `convert()` now routes through dinero.js v2 with banker's rounding at the FX edge. Public signature unchanged; round-trip USD↔EUR is now exact (`CON-UNIT-006` flipped from characterization to positive assertion). 6 new money-module tests (`CON-UNIT-040..045`). Phases B/C/D still queued. |
| 2026-05-23 | [Database](db/MIGRATIONS.md) | **admin-roles-and-kpis** | **Admin privilege surface into migrations (remediation PR #7 / TD-04).** New migration `20260523060000_admin_roles_and_dashboard_kpis.sql` adds the `admin_role` enum, `admin_roles` table + RLS, `is_admin()` / `has_admin_role()` helpers, and the `admin_dashboard_kpis()` RPC. The privileged authorisation layer is no longer hand-run-only. `content_items` / `subscriptions` backed KPI fields return 0 until follow-up TD-04-extension migrations land them. |
| 2026-05-23 | [Database](db/MIGRATIONS.md) | **migrations-init** | **DB migrations toolchain (remediation PR #6 / TD-18).** New `supabase/migrations/` directory is the source of truth; current schema is `00000000000000_initial_schema.sql`. `db/schema.sql` is now a generated snapshot kept in sync by a new `db-migrations` CI gate. Foundation for PR #7 (TD-04 admin schema). |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6414--route-level-code-splitting-remediation-pr-5-2026-05-23) | **v6.4.14** | **Route-level code splitting (remediation PR #5 / TD-11).** Every page in `App.tsx` is now `React.lazy`-imported and wrapped in `<Suspense>`; Recharts ships only in the chunks for routes that import it (Dashboard / Reports / NetWorth). New `CON-E2E-006` regression spec verifies Recharts is not fetched on `/transactions`. |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6413--top-level-error-boundary-remediation-pr-4-2026-05-23) | **v6.4.13** | **Top-level error boundary (remediation PR #4 / TD-05).** Adds a global `<ErrorBoundary>` to catch uncaught render errors and show a fallback UI with a reset button. New `CON-E2E-005` regression spec navigates to a throwing page and asserts the fallback. |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6412--transactions-list-virtualization-remediation-pr-3-2026-05-23) | **v6.4.12** | **Transactions list virtualization (remediation PR #3 / TD-17).** Virtualizes the Transactions list with `@tanstack/react-virtual` for O(viewport) DOM nodes even at 10 000+ rows. `data-testid="txn-row"` added to support the acceptance check. |
| 2026-05-23 | [Consumer](react/CHANGELOG.md#v6411--test-scenarios-master-catalog--per-scenario-audit-evidence-remediation-pr-2-2026-05-23) | **v6.4.11** | **Test Scenarios master catalog + per-scenario audit evidence (remediation PR #2).** Every consumer test now carries a stable TS ID (`CON-UNIT-001..039`, `CON-E2E-001..004`) catalogued in `docs/TEST_SCENARIOS.md`. A reconciler gate refuses code↔doc drift. The automation report now captures per-app pass/fail counts, full failure details, and a complete pass register for audit on every run. |
| 2026-05-23 | [Admin](admin/CHANGELOG.md#v107--first-admin-unit-tests--test-scenarios-catalog-remediation-pr-2-2026-05-23) | **v1.0.7** | **First admin unit tests + test scenarios catalog (remediation PR #2).** Closes the privileged-admin-app safety-net gap (N1). 11 ID-tagged unit tests (`ADM-UNIT-001..011`) covering `slugify` + `rowToArticle`; `admin-unit` now part of the gate. Caught one real slugify edge-case bug for follow-up. |
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
