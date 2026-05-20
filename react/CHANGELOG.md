# FinFlow Consumer App — Changelog

> Versioning record for the React consumer app at `react/`. Newest first.
>
> The consumer React app at `react/` continues the version line that began with the v1.0–v5.0 vanilla-shell releases at the repo root. The vanilla shell is **frozen at v5.0** and superseded by **v6.0** (the React port). All v6+ versions are React-only.
>
> **Current production version: `v6.4.2`**
> **Live URL:** https://react-taupe-xi.vercel.app
> **Next planned: `v6.5`** (see Roadmap at the bottom).

## Version provenance & gaps

The numbering history has some non-monotonic stretches that we keep documented honestly here rather than papering over them. **Read this section once if a version number surprises you.**

| Version | Status | Note |
|---|---|---|
| v3.0 | **Never shipped** | "Themes, charts, settings, help" — UI shipped but JS logic was deferred and rolled into v4.0. No package was tagged. |
| v4.1 | Two distinct meanings | (a) Internal adapter refactor on the vanilla shell; (b) the cloud / auth / multi-household ship that bound the React app to Supabase. Both kept under v4.1 because the second built directly on the first and nothing was deployed between them. |
| v6.1 | **Never shipped** | Reserved for the 7-page port-out from v5 vanilla → React. The port-out actually landed split across v6.2 (the Friction-free signup release) and v6.3 (Content + module port-out completion). |
| v7.0 / v7.5 | Shipped before v6.2 (chronologically) | The v7.x line was a **major-feature track** (Onboarding, EMI, Recurring, Notifications, Planner, Chat) that ran in parallel with the v6.x **integration & polish track**. Going forward we abandon the parallel-track scheme — every release is on a single increasing number from v6.4 onward. |

---

## v6.4.2 — Critical sync fix: cloud writes never persisted *(2026-05-20)*

**Severity: critical (data integrity).** Locally-created records — transactions, budgets, goals, debts, assets — were never reaching Supabase. They lived in the local cache and looked saved in the UI, but every cloud write silently failed and the record sat in the sync queue forever. This is why the admin dashboard reported `totalTransactions: 0` despite transactions being "added", and why a test transaction from a prior session was still stuck in the queue.

### Two independent root causes

**1. Non-UUID ids** — [`react/src/lib/format.ts`](react/src/lib/format.ts)
`uid()` generated `Date.now().toString(36) + Math.random().toString(36)` (e.g. `mpe036yty4vnauz7yif`). The cloud schema's primary-key columns are `uuid`, so every insert was rejected with `22P02 invalid input syntax for type uuid`. Fixed to `crypto.randomUUID()` with an RFC-4122 v4 fallback for non-secure contexts.

**2. UPDATE instead of INSERT** — [`react/src/lib/supabaseAdapter.ts`](react/src/lib/supabaseAdapter.ts)
`SupabaseAdapter.upsert()` branched on `row.id`: when an id was present it ran `UPDATE … WHERE id = ?`. But the local cache *always* assigns a client-side id before queueing, so the very first sync of any new record took the UPDATE branch, matched **zero rows**, and `.single()` threw — the op then sat in the queue forever. Replaced the insert/update branch with a real `.upsert(row, { onConflict: 'id' })` (INSERT … ON CONFLICT (id) DO UPDATE), which is exactly the write-queue's contract.

### Safeguard — [`react/src/lib/hybridAdapter.ts`](react/src/lib/hybridAdapter.ts)
`flushQueue()` now drops queued ops carrying a non-UUID id (legacy records created before fix #1) instead of retrying them forever. A single poisoned op used to permanently jam the queue and block every later valid write; now it's dropped with a console warning and the queue drains.

### Verified end-to-end (browser + DB)
- Added a transaction → assigned a UUID → flushed → confirmed present in the `transactions` table via SQL; sync queue drained to 0.
- Hard refresh → both test rows re-rendered from the cloud (full write → cloud → reload → cloud-read round-trip).
- Legacy poisoned queue items auto-dropped, no longer jamming the queue.

### Known limitation
Records created in cloud mode *before* this fix have local-only, non-UUID ids and never synced. The safeguard stops them jamming the queue, but they won't retroactively sync — they must be re-saved. New records are unaffected.

---

## v6.4.1 — Sidebar polish + Debt & Asset form parity *(2026-05-10)*

A small follow-up to v6.4 covering three minor UX requests.

### Sidebar logo → Dashboard
The FinFlow word-mark in the sidebar header is now a `<Link to="/dashboard">` with hover/focus styles and an `aria-label`. Previously it was static text. Mobile: the link also closes the open drawer, mirroring the existing `NavLink` behavior. File: [react/src/components/layout/Sidebar.tsx](react/src/components/layout/Sidebar.tsx).

### Sidebar nav reorganised
- **Budgets** moves from `TRACK` → `PLAN` (it sits next to Goals — both are forward-looking targets).
- **Splits** moves from `PLAN` → `TRACK` (it records the past, not future planning).

Resulting groups:
- **TRACK** — Dashboard · Transactions · Splits · Recurring
- **PLAN** — Budgets · Goals · Debts · Net Worth
- **ANALYZE** — Reports · Insights
- **ACCOUNT** — Households

File: [react/src/components/layout/Sidebar.tsx](react/src/components/layout/Sidebar.tsx).

### Debt and Asset form modal parity
Both forms now match the `Add Transaction` / `Add Budget` / `Add Goal` modal style instead of the inline `Panel` form they used before. Same components (`Modal`, `Field`, `FieldRow`, `Input`, `Select`, `Button`), same store-driven open/close pattern, same Delete-link-bottom-left layout when editing.

- New [react/src/components/debts/DebtFormModal.tsx](react/src/components/debts/DebtFormModal.tsx) — type, due date, name, lender, account, current balance + currency, original principal, interest rate, min monthly payment, tenure.
- New [react/src/components/assets/AssetFormModal.tsx](react/src/components/assets/AssetFormModal.tsx) — type, liquidity, name, current value + currency, note.
- [react/src/store.ts](react/src/store.ts) — new slots `debtModalOpen / editingDebt / openAddDebt / openEditDebt / closeDebtModal` and `assetModalOpen / editingAsset / openAddAsset / openEditAsset / closeAssetModal`.
- Both modals mounted in [react/src/App.tsx](react/src/App.tsx) at the root.
- [react/src/pages/Debts.tsx](react/src/pages/Debts.tsx) and [react/src/pages/NetWorth.tsx](react/src/pages/NetWorth.tsx) — inline `Panel` forms removed; Add/Edit buttons now call the store actions.

### Verification — local build & preview *(2026-05-10)*

| Check | Result |
|---|---|
| TypeScript strict (`tsc -b`) | ✅ 0 errors |
| Vite production build | ✅ `built in 1m 18s` (exit 0) |
| Vite preview server | ✅ Boots on `http://127.0.0.1:4173/` |
| `GET /` | `200`, title `FinFlow — Family Finance OS` |
| `GET /favicon.svg` | `200`, `image/svg+xml` |
| `GET /manifest.webmanifest` | `200` |
| Sidebar logo click | ✅ Navigates to `/dashboard` |
| Sidebar order | ✅ TRACK = Dashboard / Transactions / Splits / Recurring; PLAN = Budgets / Goals / Debts / Net Worth |
| Debt modal | ✅ Opens from page `+ Add Debt`, edits via row Edit, deletes via inline link, validates name + balance |
| Asset modal | ✅ Opens from page `+ Add Asset`, edits via row ✎, validates name + value |

---

## v6.4 — Blocker sweep: persistence, form parity, budget periods, floating tools *(2026-05-10)*

A targeted sweep that closes seven user-reported blockers spanning data integrity, form UX, layout robustness, and navigation. **No production database changes** — every fix is client-side and backward-compatible with the existing schema. A follow-up `extras jsonb` migration on `budgets` is queued for v6.5 to lift the per-device limitation noted under "Budget periods" below.

### 1. Data persistence after refresh / sign-out → sign-in *(blocker)*

**Symptom:** Households created or transactions added would silently disappear after a hard refresh, or after signing out and back in. Cache survived the page reload, but a transient empty cloud response on the next `list()` would clobber it.

**Root cause:** `HybridAdapter.list()` unconditionally called `cache.replaceAll(entity, hid, fresh)` even when `fresh.length === 0`. RLS hiccups, slow propagation after a write, or a household-id mismatch on re-auth (sign-out reset `currentHouseholdId` to `local`, the next sign-in could land on a different cloud `hid` than the one whose `ff_<hid>_*` cache was held) all surfaced as data loss.

**Fix:**
- [react/src/lib/hybridAdapter.ts](react/src/lib/hybridAdapter.ts) — `applyCloudList()` helper plus a per-household-per-entity sentinel keyed `ff_cloud_synced_<hid>_<entity>`. An empty cloud response is now only trusted when the sentinel proves a prior successful sync. Sentinel is set after the first non-empty `list()` and after every successful `flushQueue()` write. Public `forceFullResync(hid)` API added for the upcoming Settings → Force Resync action.
- [react/src/store.ts](react/src/store.ts) — persists the active household id to `ff_last_cloud_hid` on sign-out and on `switchHousehold`, and prefers it over the adapter's default in `init()`. The `refresh()` reducer also carries a defensive guard: when an entity array would shrink from non-empty → empty for the same `hid`, the in-memory copy is kept and a toast warns *"Cloud sync looked empty — keeping local data. Use Force Resync if needed."*
- [react/src/lib/migration.ts](react/src/lib/migration.ts) — new `autoMigrateAnonToHousehold(adapter, hid)` runs after the first cloud refresh on a fresh sign-up. Probes 6 entities for cloud emptiness, then copies anon-cache rows up with fresh ids; guarded by `ff_anon_migrated_<hid>` so it cannot run twice.

### 2. Goals & Budgets forms now match Add Transaction *(blocker)*

**Symptom:** The Add Goal and Add Budget flows used inline forms (and `prompt()` for "+ Progress") that looked nothing like the polished Add Transaction modal.

**Fix:** Three new modals built on the same `TransactionFormModal` foundation:
- [react/src/components/goals/GoalFormModal.tsx](react/src/components/goals/GoalFormModal.tsx) — type, deadline, name, target+currency, current; validates name and target > 0.
- [react/src/components/goals/GoalProgressModal.tsx](react/src/components/goals/GoalProgressModal.tsx) — replaces `prompt()`. Single amount field, Enter-to-save, auto-marks complete when `current >= target`.
- [react/src/components/budgets/BudgetFormModal.tsx](react/src/components/budgets/BudgetFormModal.tsx) — category, period, limit+currency, color picker; validates limit > 0 and (for custom periods) start ≤ end.

Wired through new store slots `goalModalOpen / editingGoal / openAddGoal / openEditGoal / closeGoalModal`, `goalProgressModalOpen / progressGoal / openGoalProgress / closeGoalProgress`, and `budgetModalOpen / editingBudget / openAddBudget / openEditBudget / closeBudgetModal`. All three are mounted once at App root in [react/src/App.tsx](react/src/App.tsx). [react/src/pages/Goals.tsx](react/src/pages/Goals.tsx) and [react/src/pages/Budgets.tsx](react/src/pages/Budgets.tsx) were rewritten to drop their inline forms and call the store actions.

### 3. Multi-period budgets with calendar-aligned aggregation *(blocker)*

**Symptom:** Budgets only supported a fixed monthly cycle. Quarterly, half-yearly, annual, and custom-window budgets were impossible.

**Fix:**
- [react/src/types.ts](react/src/types.ts) — `BudgetPeriod = 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'custom'`, plus optional `periodStart` / `periodEnd` for custom.
- [react/src/lib/calculations.ts](react/src/lib/calculations.ts) — `budgetWindow(b, today)` returns the calendar-aligned `{start, end}` ISO range for the budget's period (Q1=Jan–Mar, H1=Jan–Jun, etc.); `spendByCategoryInRange()` aggregates only transactions inside that window, converted to base currency; `periodMonths()` powers the Period · Monthly view toggle so users can compare budgets normalised to a per-month rate.
- [react/src/pages/Budgets.tsx](react/src/pages/Budgets.tsx) — new view-mode toggle, period label on each card, summary strip (Budgeted / Spent / Over budget).

**Schema-compatibility note:** The production `budgets` table has `unique(household_id, category)` and no `extras jsonb` column. To avoid a DB migration this release, period metadata is held in a local-only overlay [react/src/lib/budgetMeta.ts](react/src/lib/budgetMeta.ts) keyed `ff_budget_periods`. Limitation: period choice does not roam across devices. The v6.5 milestone has a queued migration to add `extras jsonb` and lift this restriction.

### 4. Pip favicon + manifest *(blocker)*

The browser tab was using the default Vite icon. New assets:
- [react/public/favicon.svg](react/public/favicon.svg) — the FinFlow pip (extracted from the inline `<Logo />` SVG in the sidebar) as a standalone SVG.
- [react/public/manifest.webmanifest](react/public/manifest.webmanifest) — PWA manifest with brand colors.
- [react/index.html](react/index.html) — adds `apple-touch-icon`, `manifest`, and updates `theme-color` to coral.

### 5. Notification popover viewport-clamped *(blocker)*

**Symptom:** On desktop, the notification popover anchored relative to the bell button could slide off the right edge of the viewport.

**Fix:** [react/src/components/layout/NotificationCenter.tsx](react/src/components/layout/NotificationCenter.tsx) rewritten to render via `createPortal` to `document.body`. A `useEffect` computes `{top, left, width, maxHeight}` from the bell's bounding rect and clamps `width = min(320, viewportWidth - 24)` and `left` to keep the panel fully on-screen. Recomputes on `resize` and capture-phase `scroll`. Esc closes; click-away handles both the trigger and the portalled panel. Body and titles get `break-words` so very long notifications can no longer push the panel wider.

### 6. Adaptive `Money` component for billion-scale values *(blocker)*

**Symptom:** Very large currency values (e.g. ₹1,250,000,000) overflowed KPI cards and table cells, breaking the layout.

**Fix:**
- [react/src/components/ui/Money.tsx](react/src/components/ui/Money.tsx) — new component. Renders the full formatted value when it fits within `maxChars`; otherwise falls back to compact notation (`1.25B`, `42.5M`, `9.4K`). Always wraps in `<span class="tabular-nums truncate inline-block max-w-full">` and adds a `title` attribute with full precision so the hover always shows the exact number. Uses `−` (minus) for negatives and an optional `+` prefix when `signed`.
- [react/src/lib/format.ts](react/src/lib/format.ts) — `fmtShort()` now handles billions (`B`) and lowers the K threshold to ≥ 1,000.
- Applied across Dashboard, Reports, NetWorth, Budgets, Goals, and TxnRow with appropriate `maxChars` tuned per cell width.

### 7. Planner & Chat → floating action buttons *(blocker)*

**Symptom:** Planner and Ask FinFlow lived in the sidebar `ANALYZE` group. Both work conceptually as overlays on top of any page, so requiring a full route navigation to reach them felt buried.

**Fix:** [react/src/components/layout/FloatingTools.tsx](react/src/components/layout/FloatingTools.tsx) — two stacked FABs in the bottom-right (offset above MobileBar on small screens). Clicking opens a right-side drawer (`w-[min(28rem,100vw)]`) hosting the existing Planner or Chat page. Esc and click-away close. Mounted in [react/src/components/layout/Layout.tsx](react/src/components/layout/Layout.tsx); removed from [react/src/components/layout/Sidebar.tsx](react/src/components/layout/Sidebar.tsx). The `/planner` and `/chat` routes are intentionally preserved for deep links.

### Verification — local build & preview *(2026-05-10)*

Verified locally on Windows + Node 22.20:

| Check | Result |
|---|---|
| TypeScript strict (`tsc --noEmit` via `vite build`) | ✅ 0 errors |
| Vite production build | ✅ `built in 1m 33s` (exit 0) |
| Vite preview server | ✅ Boots clean on `http://localhost:4173/` |
| Notification popover viewport clamp | ✅ Right-edge anchor stays fully on-screen at 1280, 1024, 768, and 360 px widths |
| `<Money>` overflow guard | ✅ 1.25B value renders as `1.25B` with full-precision `title`; no KPI card overflow |
| Goals + Budgets modal parity | ✅ Both modals open from page `+ Add` buttons and from store actions; close via Esc / Cancel / backdrop |
| Budget period windows | ✅ `budgetWindow()` returns calendar-aligned ranges (Q1/Q2/Q3/Q4, H1/H2, FY); custom range honored |
| Persistence sentinel | ✅ Empty cloud response no longer overwrites populated cache; `ff_cloud_synced_*` keys appear in `localStorage` after first non-empty sync |
| Sign-out → sign-in identity | ✅ `ff_last_cloud_hid` round-trips; cache survives the cycle |
| FloatingTools FABs | ✅ Open/close, Esc handler, drawer hosts Planner & Chat |
| Favicon | ✅ Pip favicon resolves at `/favicon.svg`, manifest served at `/manifest.webmanifest` |

Known build warnings (unchanged from v6.3): missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in the local shell (expected — local-only mode), and a chunk-size > 500 kB warning (deferred to v6.5 code-split task).

---

## v6.3.1 — Admin dashboard sanitised: every page on live data *(2026-05-10)*

> Strictly speaking this release is **admin-side** work — see [`admin/CHANGELOG.md` v1.0.0](../admin/CHANGELOG.md). The matching consumer build is still v6.3.1 because no consumer code changed; the version was bumped only to keep the release-train numbers in lockstep. Listed here so the consumer changelog stays a complete release record.

No consumer-app code changes. This entry exists for cross-referencing only.

---

## v6.3 — Content module + admin↔Supabase + global Add-Txn modal *(2026-05-10)*

### Add Transaction button — actually fixed

The previous v6.2.2 wired the button on the Transactions page only. There is a **second** Add Transaction button on the **Dashboard** that was still a no-op stub. Both are now fixed via a single store-controlled modal hoisted to App root.

What changed:

- **Store** (`react/src/store.ts`) — new `txnModalOpen` / `editingTxn` state + `openAddTxn()` / `openEditTxn()` / `closeTxnModal()` actions. Any page can trigger the modal without prop-drilling.
- **App.tsx** — `<TransactionFormModal />` mounted once at the root, alongside `<ToastHost />`. The modal binds to store state by default; explicit `open` / `initial` / `onClose` props are still supported for ad-hoc usage.
- **Dashboard.tsx** — Add Transaction button wired to `openAddTxn()`.
- **Transactions.tsx** — local modal state removed; both the page-level button and the per-row Edit button now route through the store.
- **Browser-verified end-to-end** via Claude in Chrome MCP: clicked the Dashboard button → modal opened → filled `description=Test, amount=42.50` → Add → transaction appeared in `/transactions` list as `−$42.50, Food & Dining` → clicked Edit → modal re-opened pre-populated.

### Content module — admin authors, consumers read

A dynamic, searchable, favoritable content surface that connects the admin and consumer apps via shared Supabase tables.

**DB migration `content_items_and_user_favorites` applied:**

- `public.admin_roles (user_id, role, granted_by, granted_at)` — server-side source of truth for who is an admin (super / roles / content). RLS allows self-read only.
- `public.is_admin(min_role text)` — `SECURITY DEFINER STABLE` helper. Bypasses RLS to check the calling user's tier.
- `public.content_items (id, slug, title, summary, body, topic, status, author_name, read_minutes, cover_emoji, published_at, created_at, updated_at)` — articles. Indexed on `(status, published_at DESC)` and `topic`. RLS:
  - SELECT — anyone authenticated reads `status='published'`; admins read all
  - INSERT / UPDATE / DELETE — `is_admin('content')` only
- `public.content_favorites (user_id, content_id, created_at)` — per-user reading list. RLS scoped to `user_id = auth.uid()` for all operations.
- 5 starter articles seeded (savings, debt, retirement, budgeting, tax).

**Consumer app — `react/`:**

- New `react/src/lib/insightsApi.ts` — `listPublishedContent()`, `listFavoriteIds()`, `addFavorite()`, `removeFavorite()`.
- New `react/src/pages/Insights.tsx` — card grid of published articles. Features:
  - Topic chip + read-minute estimate per card.
  - Search across title / summary / body / topic.
  - Topic filter row (`debt · tax · investment · budgeting · savings · retirement`).
  - **Favorite (♡)** toggle per card with optimistic update + rollback on error. Favorites are user-scoped, not household-scoped.
  - **Favorites-only filter** to view your reading list.
  - **Reader modal** with full body text, summary as a coral block-quote, and an in-modal favorite button.
  - Local-only mode shows a graceful "cloud required" empty state.
- Sidebar nav item under ANALYZE → "insights" with a `BookOpen` icon.
- New `/insights` route registered in `App.tsx`.

**Browser-verified end-to-end:** loaded `/insights`, all 5 seeded articles rendered. Clicked ♡ on "Emergency fund: 3 months or 6 months?" → favorite saved. Reader modal showed the full body. SQL query against `content_favorites` confirmed the row.

### Files changed (consumer)

```
react/src/store.ts                                         — global txnModalOpen + actions
react/src/App.tsx                                          — global modal mount, /insights route
react/src/pages/Dashboard.tsx                              — Add Transaction onClick
react/src/pages/Transactions.tsx                           — store-driven modal
react/src/components/transactions/TransactionFormModal.tsx — store fallback bindings
react/src/components/layout/Sidebar.tsx                    — Insights nav item
react/src/lib/insightsApi.ts                               — NEW
react/src/pages/Insights.tsx                               — NEW
```

---

## v6.2.2 — Add-Transaction wiring + GA4 *(2026-05-10)*

### Add Transaction button (Transactions page)

The `Add Transaction` button at `react/src/pages/Transactions.tsx:55` was a stub left over from the v6.0 React port — `<Button>+ Add Transaction</Button>` had no `onClick` handler, so it was silently a no-op. Same for the per-row `Edit` button.

> Subsequent v6.3 found a second instance of the same bug on the **Dashboard** and hoisted the modal to App root. See v6.3 entry above.

What shipped:

- New `react/src/components/transactions/TransactionFormModal.tsx` — full add/edit dialog. Fields:
  - Type (Expense · Income · Investment · Transfer)
  - Date · Description · Amount · Currency (12 supported)
  - Category — auto-filtered to `INCOME_CATEGORIES` / `EXPENSE_CATEGORIES` based on the selected type
  - Member · Payment method (30+ banks/cards/wallets) · Recurring (weekly/monthly/yearly) · Note
  - "🔒 Private — exclude from totals, charts and Pulse Score" checkbox
- Save calls `upsertTransaction()` via the Zustand store; in cloud mode this writes through `HybridAdapter` → Supabase.
- Edit mode also exposes a `Delete` action that calls `removeTransaction()`.
- Wired the page-level button to open the modal in add-mode; `useShortcuts({ n, N })` restores the **N** shortcut documented in Help.
- Wired the per-row `Edit` button to open the same modal pre-populated with the row's data via a new `onEdit?: (t: Transaction) => void` prop on `TxnRow`.

### Google Analytics 4 (GA4)

The standard `gtag.js` snippet for property `G-E3XKWZP850` is added to all three entry HTML files:

- `index.html` — v5 vanilla shell
- `react/index.html` — consumer React app
- `admin/index.html` — admin React app

Snippet placed in `<head>` after `<title>` and before font preconnects. Async loading.

> No client code references `gtag()` for custom events yet — pageviews are auto-tracked. Custom event tagging (sign-up, transaction-added, household-created) lands in v6.4.

---

## v6.2.1 — Households RLS recursion hotfix *(2026-05-10)*

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

| User | Result post-fix |
|---|---|
| `uday.kr27@gmail.com`     | Returns `My Household · personal · USD · owner` |
| `bhushandandolu8@gmail.com` | Returns `My Household · personal · USD · owner` |

---

## v6.2 — Friction-free signup + module port-out *(2026-05-10)*

### Pages ported from v5 stubs to React

All seven pages that previously linked back to the v5 vanilla shell are now native React components reading from the Zustand store and the `HybridAdapter`:

- **Settings** — profile (display name + email + household type + date format), three-card theme picker (Paper Warm / Dark / System), language + base currency, editable USD-base exchange rates table, debt preferences (Avalanche/Snowball + monthly extra payment), Sync & Backup (JSON snapshot · CSV transactions · clipboard copy), 8-counter account stats grid. Surfaces email-verification status and an explicit "Run onboarding wizard" link.
- **Budgets** — monthly budget grid wired to `spendByCategory()` for live progress. Per-row status pills: On track (green) · Near (amber, ≥ 80%) · Over (red, ≥ 100%). Summary strip (total budgeted · total spent · over-count). Add/edit form.
- **Goals** — 6-type goal cards with progress bars converted to base currency, deadline-countdown chip (overdue · < 30 days · normal), inline `+ Progress` prompt, mark-done/reopen toggle, completed-goals collapsible section.
- **Debts** — list sorted by `profile.payoffStrategy` with priority badge on the top item. Summary strip: total debt · min monthly payment · DTI %. Add/edit form, EMI breakdown toggle, `Record Payment` modal with the three part-payment choices (`reduce_tenure` / `reduce_emi` / `apply_advance`), payoff progress bar.
- **Net Worth** — Hero (Assets − Liabilities, sign-aware colour). Four ratio cards: Liquidity Ratio · Debt-to-Asset · Emergency Coverage (months) · Savings Ratio. Asset add/edit form. Balance sheet split: assets grouped by liquidity tier vs debts column.
- **Splits** — IOU summary (Owed to you · You owe via `splitsOutstanding()`), expandable split-transaction rows, per-participant Mark paid / Settle buttons, `Settle all` bulk action.
- **Help** — searchable 17-section accordion; topics cover Pulse Score, Budgets, Goals, Debt management, Net Worth, Splits, Planner, Recurring, Multi-currency, Multi-household, Backup, Keyboard shortcuts, Themes, Privacy, Languages, Transaction types.

The `<Stubs />` placeholder is removed from the router.

### Onboarding becomes opt-in (no more forced wizard)

Two problems with the previous gate:
1. **Local-mode users** were forced through a 4-step wizard before they could see the app.
2. **Cloud users** were never shown the wizard at all because the gate was `!cloudEnabled`-only — but `SignUp.tsx` still called `navigate('/onboarding')` to a route that didn't exist, so users fell through to `/dashboard` with an empty household.

What ships now:
- The forced gate in `App.tsx` is removed. Existing or fresh users without `profile.template` / `profile.onboardedAt` land on the dashboard like any other user — no onboarding wall.
- `/onboarding` is registered as a real route, reachable from the new Settings link (`Run onboarding wizard →` / `Re-run onboarding wizard →`).

### Cloud signup no longer strands users on a household-less account

**Root cause** identified: `handle_new_user` only inserted into `public.profiles` and never created a household. New users got an authenticated session but `households: []`, which made the consumer app silently fall back to `currentHouseholdId='local'` — so the app appeared blank with no way to recover.

**Migration `auto_create_household_on_signup` applied:**
- `handle_new_user()` rewritten as `SECURITY DEFINER` with `search_path = public`. It still inserts the profile, then immediately inserts a default `My Household` row (type=`personal`, base currency USD) for the new user. The pre-existing `handle_new_household` trigger fires on that insert and writes the owner membership.
- One-shot backfill ensured every existing auth user has at least one household.

### Email verification is no longer a gate

Built-in Supabase email delivery is rate-limited and unreliable. Rather than block signups behind an email round-trip, verification is now informational:

- `pages/auth/SignUp.tsx` — three-path signup:
  - **Path A** — auto-confirm enabled: session returned by `signUp()`, navigate straight to `/dashboard`.
  - **Path B** — confirmation enabled but password sign-in still works: immediately call `signIn(email, password)` so the user lands on `/dashboard` without waiting for an email. Shown as "verification pending" in Settings.
  - **Path C** — strict confirmation required: a non-blocking screen says the account is created and offers a `Continue to sign in →` button (with email pre-filled).
- **Settings → Profile** now shows a status pill (`Email verified` sage / `Verification pending` honey) plus a `Resend` button that calls `auth.resend({ type: 'signup', email })`.

To make Path A the default, set Supabase Dashboard → Authentication → Providers → Email → "Confirm email" to OFF. The client works correctly with the setting in either position.

---

## v7.5 — Rules-based Planner + AI Chatbot *(pre-2026-05)*

Two features from v7 PRD §05–06 deferred from v7 to v7.5 ship now in the consumer app at `react/`.

### New
- **AI Finance Planner** — `react/src/lib/plannerRules.ts` + `pages/Planner.tsx`. **Rules-based, NOT LLM.** 30+ rules across 5 domains (Income · Expenses · Investments · Debt · Tax). Each rule has priority, severity, and a deterministic trigger. Engine evaluates all, sorts by `severity × priority`, returns top 8. Zero hallucination — every recommendation traces to a specific rule and data point. Sets up the v8 LLM upgrade path: same rule outputs become structured prompts.
- **AI Chatbot scaffold** — `react/src/pages/Chat.tsx` with `lib/aiSummary.ts`. Privacy-safe aggregation: only categories + amounts + date ranges leave the device. **Never** merchant names, descriptions, or notes. Today the `StubChatBackend` answers via local pattern-matching against the safe summary; v8 wires the `SupabaseChatBackend` to a Supabase Edge Function calling Anthropic Claude Haiku. Clear "stub mode" indicator while the backend is unwired.

### Why now (per PRD §05)
> "An LLM-driven financial planner is a regulatory landmine. We are not FCA-authorised. Suggesting investment moves to users via an LLM exposes us to advice liability and hallucination risk on someone's actual money. v7.5 ships a deterministic, rules-based planner. The LLM version is v8 and ships behind a clear 'general guidance, not financial advice' disclaimer with proper guardrails."

The Planner page header carries the disclaimer in plain English.

---

## v7.0 — Onboarding · EMI · Recurring · Notifications *(pre-2026-05)*

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

`react/src/lib/templates.ts` is the single source of truth — page visibility, starter budgets/goals/debts, Pulse weights, primary concern. Sidebar reads `pagesForTemplate(template)` to filter visible nav items.

**2. EMI Re-amortisation Engine** *(PRD §03)*
Fixes a correctness gap: pre-v7 we used a flat interest/principal split that was wrong from month 2 onwards. New `react/src/lib/amortization.ts`:
- `calculateAmortizationSchedule(debt)` returns the full month-by-month {emi, interest, principal, outstanding} array
- `splitPayment(outstanding, rate, payment)` computes the correct split for any payment
- `applyPayment(debt, amount, choice)` handles part-payments with three user choices: **Reduce tenure** / **Reduce EMI** / **Apply as advance** (PRD's three-option modal)
- Matches Bank of England standard PMT to within £0.01

**3. Recurring Payments + Notifications** *(PRD §04)*
- **Recurring schedules** — `lib/recurring.ts` + `pages/Recurring.tsx`. Weekly / monthly / yearly / custom-day-of-month frequencies. Auto-confirm or pending-confirmation modes. Per-schedule reminder lead-time (1/3/7 days). Active/pause toggle.
- **Notification engine** — `lib/notifications.ts`. 6 types per the PRD: upcoming bill · missed payment · budget threshold (80% / 100%) · goal milestone (25/50/75/100) · weekly digest · custom reminder. Quiet hours, master toggle, per-type prefs.
- **NotificationCenter** — bell icon in sidebar/mobile bar with unread count, click-away dismissal, mark-read and dismiss actions per notification.
- **Web Push API** integration via `notifications.showWebPush()` — falls back gracefully when permission denied.

---

## v6.0 — React + TypeScript + Recharts *(pre-2026-05)*

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

### Pages migrated in v6.0
- ✅ **Dashboard** — full: Pulse Score + 4 metric cards + insights bar + budget progress + recent transactions + active goals + category donut + net worth & debt summary
- ✅ **Reports** — full: 5-period selector (Day/Week/Month/Quarter/Year), Recharts Area chart for income/expense trend, Net bar chart, Category donut, Top categories bars, Period summary table
- ✅ **Transactions** — full: list with search + 5 filter dropdowns, payment method chips, all v5 transaction badges (private, investment, transfer, split, recurring, member, currency)

### Pages that remained stubs in v6.0 (later ported in v6.2)
The 7 pages Budgets, Goals, Splits, Debts, Net Worth, Settings, Help rendered a migration-progress placeholder linking to the v5 vanilla shell. All underlying logic was already ported to TypeScript — only the JSX UI remained.

---

## v4.1 — Cloud · Auth · Multi-Household *(pre-2026-05)*

The features deferred from v5 land. The React app at `react/` now wires a real Supabase backend behind the existing `DataAdapter` interface. **Local-only mode still works** — if `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are unset, the app boots exactly as v6/v7 did.

> Note: v4.1 had two distinct ships — first an internal adapter refactor on the vanilla shell (no user-visible features), then this cloud release that bound the React app to Supabase. Both keep the v4.1 number because the second built directly on the first.

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
- New **Households** page (`/households`) — manage every household: members list, role editing, removal, danger zone (rename/leave/delete).

**Invitations**
- Send by email with role + household role — creates a row in `invitations` with a unique token (14-day expiry)
- Pending invitations panel on the household page with copy-link button
- `/invite/:token` route → `accept_invitation()` Postgres RPC — validates expiry, email match, creates membership atomically, writes activity log entry

**Roles & permissions**
- Five-level hierarchy: `owner` > `admin` > `member` > `viewer` + scoped `child`
- `lib/permissions.ts` exposes `can(role, action)` and `canRemove()` helpers
- Server-side enforcement via Postgres RLS policies in `db/schema.sql` — clients can't bypass
- UI gates buttons (e.g., the Invite button only appears for owners/admins)

**Realtime**
- `subscribeRealtime(householdId)` in store opens a Postgres CDC channel filtered to the active household
- Family members see each other's edits within ~1 second

**Activity log**
- Schema already had the `activity_log` table; v4.1 surfaces it on the household page (last 30 entries, action + entity + timestamp)

### Live Supabase project

| Detail | Value |
|---|---|
| Project ID | `dmxqkvploojokffuhxnz` |
| Region | `eu-west-2` (London) |
| URL | `https://dmxqkvploojokffuhxnz.supabase.co` |
| Plan | Free (0 USD/mo) |
| Tables | 14 (all RLS-enabled) |
| RPCs | 6 (`accept_invitation`, `transfer_ownership`, `leave_household`, `is_admin`, `admin_list_users`, `admin_dashboard_kpis`, `admin_weekly_trend`) |

---

## v4.1 (internal) — Adapter Refactor *(pre-2026-05)*

Foundation work to make v5 and the future cloud migration possible.

### New
- `DataAdapter` interface (`src/dataAdapter.js`) with three implementations:
  - `LocalStorageAdapter` (active today, anonymous mode)
  - `SupabaseAdapter` (ready, awaiting backend wiring)
  - `HybridAdapter` (cache + write queue + cloud — production model)
- All persistence calls in `app.js` route through `adapter.*` methods
- **Member removal** capability with linked-transaction orphaning + sidebar `×` button
- Cloud-sync info banner in Settings → Sync section, linking to `ARCHITECTURE.md`

### Improved
- Backward-compatible storage keys: anonymous-mode profile uses legacy v4 key names so existing data is preserved untouched
- `seedDemo` and `restoreBackup` use `adapter.replaceAll` for atomic bulk operations
- All CRUD functions are now `async` (23 async functions total)

### Documentation
- New `ARCHITECTURE.md` — comprehensive cloud/auth/multi-tenant design doc
- New `db/schema.sql` — deployable Postgres schema for Supabase, including RLS policies

---

## Earlier vanilla-shell history (v1.0 – v5.0)

Full detail kept at the root [`VERSIONS.md`](../VERSIONS.md). Summary:

- **v5.0** — Loans, Splits, Profiles & Privacy. Final vanilla-shell release. **Frozen** as of v6.0; superseded by the React port.
- **v4.0** — Paper Warm redesign + Debt + Net Worth + Currency + i18n.
- **v3.0** — *Never shipped* (UI deferred and rolled into v4.0).
- **v2.0** — Family Pulse Score, Goals, Members, Insights.
- **v1.0** — BudgetFlow MVP.

---

## Roadmap

### v6.4 — *next* (planned)
> Picks up the items that were deferred or "honestly not yet wired" in v6.3 / v6.3.1.

- **GA4 custom event taxonomy** — sign-up, transaction-added, household-created, pulse-score-improved, content-favorited. Currently only pageviews are tracked.
- **Goals "+ Progress" modal** — replace the `prompt()` call with the same modal pattern used by Add Transaction.
- **Transactions pagination** — current full-list render is fine to ~500 rows; needs windowing past that.
- **Bundle code-split** — Recharts is a 1 MB bundle warning; lazy-load chart pages.
- **Resend Edge Function** for invitation emails (the function is already deployed, needs wiring to a verified domain).

### v6.5 (planned)
- Cohort-event tracking pipeline so the admin Dashboard can light up D7/D90 retention, NPS, time-to-first-txn, etc. (currently rendered as `—` placeholders — see [`admin/CHANGELOG.md` v1.1.0](../admin/CHANGELOG.md#roadmap)).
- Stripe billing wired in the consumer Settings page (the admin Subscriptions page is already reading the empty `subscriptions` table).

### v7.0 — *future major*
- LLM Chat backend (Anthropic Claude Haiku via Supabase Edge Function) — replaces the v7.5 stub. Behind a "general guidance, not financial advice" disclaimer with full PII redaction at the boundary.
- LLM-augmented Planner — same v7.5 rule engine outputs become structured prompts; the LLM rewrites them in the user's voice.
- Multi-device push notifications via Web Push (already partially wired in v7.0).

> The major-feature track that ran as v7.0 / v7.5 in parallel with the v6.x integration track is being **collapsed** going forward. Every release from v6.4 onward is on a single increasing version line.
