# FinFlow — Consumer Test Case Inventory

> **Authoritative source of truth for functional QA automation.**
> Scope: `react/` consumer app (v6.4.9). Framework: Playwright E2E.
> Local-only mode is the default execution environment; cloud-mode tests are
> tagged `@cloud` and require Supabase env vars.

---

## Maintenance Rules

1. **Every PR that ships user-visible behaviour must update this file.**
   - New feature → add test ID(s) under the relevant functional area.
   - Bug fix → add a `*-REG-NNN` regression entry citing the issue/PR.
   - Removed feature → mark the test ID `DEPRECATED <version>` (keep the row).
2. **Test IDs are immutable.** Never reuse a number, even after deprecation.
3. **CI gate:** the lint job fails if `react/e2e/TEST_CASE_INVENTORY.md` is
   older than any modified file under `react/src/` in the same PR (configured
   in `.github/workflows/ci.yml`).
4. **Quarterly audit:** owners listed at the bottom of this file walk the
   inventory against shipped features and the changelog.

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Implemented & passing in CI |
| 🟡 | Designed, awaiting implementation |
| 🟠 | Blocked on a designer clarification (see §Clarifications) |
| 🔴 | Failing / quarantined — must be fixed before next release |
| ⛔ | Deprecated |

---

## Progress Tracker

> Update these counters in the same PR that lands or removes a test.
> CI verifies the table sums match the body — drift will fail the lint job.

| Metric | Count | % of Total |
|---|---:|---:|
| ✅ **Developed (green in CI)** | **6** | **3.7 %** |
| 🟣 Golden template landed (awaiting junior pass) | 3 | 1.8 % |
| 🟡 Designed (awaiting build) | 154 | 94.5 % |
| 🟠 Blocked on clarification | 8 | 4.9 % |
| 🔴 Failing / quarantined | 0 | 0.0 % |
| ⛔ Deprecated | 0 | — |
| **Total in scope** | **163** | 100 % |

**Golden templates landed in scaffolding PR:** `TXN-FC-001` (S tier),
`NWRT-FC-002` (M tier), `DEBT-FC-002` (C tier). The junior turns each 🟣
to ✅ once the test passes in CI on their first feature-area PR.

**Burn-down target:** see §Effort Estimate at the bottom of this file for the
phased delivery plan against this counter.

---

## Summary

| # | Functional Area | Prefix | Implemented | Designed | Total |
|---:|---|---|---:|---:|---:|
| 0 | Foundation & Smoke | CON-E2E | 5 | 3 | 8 |
| 1 | Transaction Creation & Validation | TXN-FC | 0 | 9 | 9 |
| 2 | Transaction Edit Propagation | TXN-EDIT-FC | 0 | 6 | 6 |
| 3 | Transaction Deletion & Recovery | TXN-DEL-FC | 0 | 4 | 4 |
| 4 | NetWorth Module Impact | NWRT-FC | 0 | 6 | 6 |
| 5 | Budgets Module | BDGT-FC | 0 | 8 | 8 |
| 6 | Goals Tracking | GOAL-FC | 0 | 8 | 8 |
| 7 | Debt Payment Cascading | DEBT-FC | 0 | 8 | 8 |
| 8 | Asset Management | ASSET-FC | 0 | 5 | 5 |
| 9 | Split Payments | SPLIT-FC | 0 | 6 | 6 |
| 10 | Recurring Transactions | RECUR-FC | 0 | 7 | 7 |
| 11 | Notifications System | NOTIF-FC | 0 | 6 | 6 |
| 12 | Reports & Analytics | RPT-FC | 0 | 6 | 6 |
| 13 | Family Pulse Score™ | PULSE-FC | 0 | 4 | 4 |
| 14 | Login, Registration & Session | AUTH-FC | 0 | 9 | 9 |
| 15 | Account Details & Profile | PROFILE-FC | 0 | 7 | 7 |
| 16 | Multi-Household & Members | HH-FC | 0 | 6 | 6 |
| 17 | Cloud Sync & Conflict Resolution | SYNC-FC | 0 | 6 | 6 |
| 18 | Backup & Data Portability | BACKUP-FC | 0 | 5 | 5 |
| 19 | Search & Filter | SEARCH-FC | 0 | 4 | 4 |
| 20 | Onboarding & Templates | ONB-FC | 0 | 5 | 5 |
| 21 | Privacy / Excluded Transactions | PRIV-FC | 0 | 3 | 3 |
| 22 | Investment Auto-Update | INV-FC | 0 | 3 | 3 |
| 23 | Multi-Currency & FX | FX-FC | 0 | 5 | 5 |
| 24 | Keyboard Shortcuts & Accessibility | A11Y-FC | 0 | 5 | 5 |
| 25 | Responsive & Mobile Layout | RESP-FC | 0 | 4 | 4 |
| 26 | Performance & Large Datasets | PERF-FC | 0 | 4 | 4 |
| 27 | Error Resilience & Edge Cases | ERR-FC | 1 | 5 | 6 |
|   | **TOTAL** | | **6** | **157** | **163** |

> CON-E2E-005 (error boundary) is listed under §27 (Error Resilience) but
> retains its original ID. Foundation §0 therefore shows 5 implemented even
> though the project has 6 implemented tests overall.

---

# §0 · Foundation & Smoke (CON-E2E)

### ✅ CON-E2E-001 — Boots into dashboard in local-only mode
- **File**: `react/e2e/tests/smoke.spec.ts`
- **Scenario**: No Supabase env vars; visiting `/` should land on dashboard.
- **Steps**: `goto('/')` → expect redirect to `/dashboard`.
- **Expected**: Title contains "FinFlow"; `dashboard.logoLink` visible.

### ✅ CON-E2E-002 — Does not render cloud auth screen in local-only mode
- **File**: `smoke.spec.ts`
- **Steps**: `goto('/')`.
- **Expected**: URL never matches `/auth/`.

### ✅ CON-E2E-003 — Seeded transactions are visible
- **File**: `smoke.spec.ts`
- **Preconditions**: `defaultSeed` injected.
- **Expected**: Rows "E2E Salary", "E2E Rent", "E2E Grocery" visible on Transactions.

### ✅ CON-E2E-004 — Seeded data survives page reload (persistence guard)
- **File**: `smoke.spec.ts`
- **Steps**: Open Transactions → reload → re-assert seeded rows.
- **Why**: Regression guard for the v6.4 "data lost on refresh" class of bug.

### ✅ CON-E2E-006 — Recharts lazy-loads only on chart pages
- **File**: `code-splitting.spec.ts`
- **Steps**: Visit `/transactions` (no recharts) → visit `/dashboard` (recharts loads).

### 🟡 CON-E2E-007 — Every primary route renders without a console error
- **Scenario**: Smoke each top-level page in the sidebar.
- **Steps**: Loop through `/dashboard`, `/transactions`, `/budgets`, `/goals`,
  `/splits`, `/debts`, `/networth`, `/reports`, `/recurring`, `/planner`,
  `/chat`, `/insights`, `/households`, `/settings`, `/help`.
- **Expected**: Each route mounts; `page.on('pageerror')` captures nothing;
  `console.error` only fires for known-allowlisted messages.

### 🟡 CON-E2E-008 — App tolerates corrupt localStorage payload
- **Scenario**: Pre-seed `ff_*` keys with malformed JSON.
- **Expected**: App boots into clean state, surfaces toast "Could not restore
  saved data — starting fresh", original blob preserved in `ff_corrupt_backup_<ts>`.

### 🟡 CON-E2E-009 — Initial dashboard render within performance budget
- **Scenario**: With `defaultSeed`, dashboard FCP < 1500 ms on CI hardware.
- **Tooling**: `page.evaluate(() => performance.getEntriesByType('paint'))`.

---

# §1 · Transaction Creation & Validation (TXN-FC)

### 🟡 TXN-FC-001 — Create income with minimum required fields
- **Scenario**: `type='income'`, amount, date, description only.
- **Expected**: Row visible with green income chip; `currency = profile.baseCurrency`.

### 🟡 TXN-FC-002 — Create expense with full optional set
- **Scenario**: Category, note, paymentMethod, memberId all populated.
- **Expected**: All fields round-trip through reload; paymentMethod chip rendered.

### 🟡 TXN-FC-003 — Create transfer between two assets
- **Preconditions**: Assets `Checking` ($10k) and `Savings` ($5k).
- **Steps**: Transfer $2k Checking → Savings.
- **Expected**: Two `linkedAssetId` references; both asset values reflect new
  balances ($8k / $7k); no double-counting in NetWorth total.

### 🟡 TXN-FC-004 — Create investment transaction with asset link
- **Scenario**: `type='investment'`; user picks investment asset.
- **Expected**: `Transaction.linkedAssetId` set; if asset auto-update enabled
  (see §22 INV-FC-001), asset value increases by the invested amount.

### 🟡 TXN-FC-005 — Reject non-positive / non-numeric amount
- **Steps**: Submit amount of `-100`, `0`, `abc`.
- **Expected**: Inline validation error; form does not submit; no row appended.

### 🟡 TXN-FC-006 — Future-date policy 🟠
- **Steps**: Enter date one year in the future.
- **Expected**: *Pending designer decision — see Clarification #4.* Document the
  resolved policy in this row before implementation.

### 🟡 TXN-FC-007 — Description/category preserve Unicode and emoji
- **Steps**: Description = `Rent @ 123 Main St 🏠 — €1200`.
- **Expected**: Stored byte-for-byte; searchable; rendered correctly on row.

### 🟡 TXN-FC-008 — Multi-currency entry stores original currency
- **Steps**: With `baseCurrency='USD'`, create expense in `EUR`.
- **Expected**: `Transaction.currency='EUR'`; display shows €; NetWorth/Reports
  convert via `exchangeRates` (see §23 FX-FC).

### 🟡 TXN-FC-009 — Rapid double-submit yields a single transaction
- **Scenario**: User double-clicks the submit button.
- **Expected**: Exactly one row created; UUID pinning + idempotent submit.

---

# §2 · Transaction Edit Propagation (TXN-EDIT-FC)

### 🟡 TXN-EDIT-FC-001 — Amount edit recomputes NetWorth
- **Preconditions**: Expense $500; NetWorth $9,500 (from $10k asset).
- **Steps**: Edit amount → $800.
- **Expected**: NetWorth → $9,200; dashboard charts repaint.

### 🟡 TXN-EDIT-FC-002 — Type flip (expense → income) cascades correctly
- **Steps**: Toggle type on an existing $500 expense.
- **Expected**: NetWorth swings by $1,000 (−$500 expense removed, +$500 income added);
  badge colour flips; budget for the original category releases its $500.

### 🟡 TXN-EDIT-FC-003 — Date edit moves transaction between budget periods
- **Preconditions**: Food budget $300/month; expense $100 on 2026-05-15.
- **Steps**: Edit date to 2026-06-15.
- **Expected**: May budget "used" decreases by $100; June increases by $100.

### 🟡 TXN-EDIT-FC-004 — Unlinking a debt-payment transaction
- **Preconditions**: Transaction `linkedDebtId` set; debt `paymentLog` includes it.
- **Steps**: Clear the link.
- **Expected**: Transaction removed from `paymentLog`; debt balance recalculated
  from the remaining log; expense itself still present.

### 🟡 TXN-EDIT-FC-005 — Member reassignment updates per-member aggregations
- **Preconditions**: Family household with Alice + Bob.
- **Steps**: Edit `memberId` Alice → Bob on a $500 expense.
- **Expected**: Alice's "spent this month" −$500; Bob's +$500; Pulse Score
  components recompute.

### 🟡 TXN-EDIT-FC-006 — Edit is conflict-safe with concurrent cloud update 🟢`@cloud`
- **Scenario**: Same transaction edited on Device A and Device B simultaneously.
- **Expected**: Adapter surfaces a conflict toast (TD-03 optimistic-concurrency);
  user can choose "Use mine" / "Use theirs"; no silent overwrite.

---

# §3 · Transaction Deletion & Recovery (TXN-DEL-FC)

### 🟡 TXN-DEL-FC-001 — Soft-delete via row menu, undo within toast window
- **Steps**: Delete row → click "Undo" in the toast within 5 s.
- **Expected**: Row reappears; all dependent aggregates restore.

### 🟡 TXN-DEL-FC-002 — Hard delete after toast window closes
- **Steps**: Delete row → wait 6 s.
- **Expected**: Row gone from list, NetWorth/budget/goal aggregates updated,
  no orphan entries in `paymentLog`/`SplitInfo`.

### 🟡 TXN-DEL-FC-003 — Deleting a debt-payment transaction restores debt balance
- **Preconditions**: Debt $4,927 (after a $150 payment $77 int / $73 princ).
- **Steps**: Delete the payment transaction.
- **Expected**: Debt balance reverts to $5,000; `paymentLog` entry removed.

### 🟡 TXN-DEL-FC-004 — Deleting a split anchor cleans up participants
- **Steps**: Delete the originating split transaction.
- **Expected**: Splits page no longer shows the IOUs; settlement transactions
  remain but are unlinked (or designer-prescribed behaviour, see Clarification #5).

---

# §4 · NetWorth Module Impact (NWRT-FC)

### 🟡 NWRT-FC-001 — Expense reduces asset balance
- **Scenario**: $500 expense on $10k Checking → NetWorth $9,500.

### 🟡 NWRT-FC-002 — Income increases asset balance
- **Scenario**: $5k salary into $10k Checking → NetWorth $15,000.

### 🟡 NWRT-FC-003 — Adding an asset increases total assets
- **Scenario**: Add Real Estate $500k, liquidity `long`.
- **Expected**: Total Assets +$500k; liquidity ratio recomputes.

### 🟡 NWRT-FC-004 — Adding a debt increases total liabilities
- **Scenario**: Mortgage $300k → Liabilities +$300k; Net Worth = A − L.

### 🟡 NWRT-FC-005 — Multi-currency assets convert to base currency
- **Scenario**: $10k USD + €100k EUR at 1.1 → $120k USD total.

### 🟡 NWRT-FC-006 — Financial ratios update when inputs change
- **Scenario**: After a $1k expense, expect Emergency-Coverage months and
  Liquidity Ratio both to recompute from the updated balances.

---

# §5 · Budgets Module (BDGT-FC)

### 🟡 BDGT-FC-001 — Create monthly budget
- **Steps**: Add Food $300/month.
- **Expected**: Appears with 0 % used; period = monthly.

### 🟡 BDGT-FC-002 — Spend within a budget updates "used" and progress bar
- **Steps**: $120 expense in Food.
- **Expected**: Bar = 40 %; remaining = $180.

### 🟡 BDGT-FC-003 — Crossing the threshold fires a notification
- **Steps**: Cross 80 % threshold (default).
- **Expected**: Notification `type='budget_threshold'` with budgetId; visible
  in NotificationCenter (gated by §11 NOTIF-FC-001 prefs).

### 🟡 BDGT-FC-004 — Multi-period budgets (quarterly, half-yearly, annual)
- **Scenario**: Create quarterly budget; record expenses across 3 months.
- **Expected**: Spend aggregates across the quarter; rolls over correctly at
  period boundary.

### 🟡 BDGT-FC-005 — Custom-window budget enforces start/end dates
- **Scenario**: `period='custom'`, `periodStart=2026-06-01`, `periodEnd=2026-06-15`.
- **Expected**: Only transactions inside the window count; transactions on
  2026-06-16 are excluded.

### 🟡 BDGT-FC-006 — Edit budget limit recomputes utilisation
- **Steps**: Change limit $300 → $200 with $150 already spent.
- **Expected**: Bar jumps to 75 %; threshold logic re-evaluates.

### 🟡 BDGT-FC-007 — Budget overrun shows over-budget styling
- **Steps**: Cross 100 %.
- **Expected**: Bar terracotta; "+$50 over" badge; Pulse Score "Budget
  Compliance" component drops.

### 🟡 BDGT-FC-008 — Budget surplus surfaces in dashboard insight 🟠
- **Scenario**: Period ends under-spent.
- **Expected**: *Pending designer decision — see Clarification #3.*

---

# §6 · Goals Tracking (GOAL-FC)

### 🟡 GOAL-FC-001 — Create savings goal with target + deadline
### 🟡 GOAL-FC-002 — Manually update goal progress
### 🟡 GOAL-FC-003 — Goal linked to asset auto-updates from transfer 🟠 (Clar. #2)
### 🟡 GOAL-FC-004 — Goal progress aggregates multi-source contributions 🟠 (Clar. #2/#3)
### 🟡 GOAL-FC-005 — Debt-type goal tracks payoff progress
- **Expected**: `current` = remaining balance; bar fills as debt shrinks.

### 🟡 GOAL-FC-006 — Milestone notification at 50 / 75 / 100 %
### 🟡 GOAL-FC-007 — Projected completion date from contribution history
### 🟡 GOAL-FC-008 — Auto-complete flag at 100 %
- **Expected**: `Goal.completed=true`; moved to "Completed" tab; subsequent
  contributions do not push `current` past `target`.

*(Each row above follows the same Scenario / Preconditions / Steps / Expected
template as §1; collapsed here for readability. Implementers must fill in the
exact selectors per the Page-Object guide at the end.)*

---

# §7 · Debt Payment Cascading (DEBT-FC)

### 🟡 DEBT-FC-001 — Create debt with principal, rate, minimum payment
### 🟡 DEBT-FC-002 — Recording payment splits interest / principal correctly
- **Math**: $150 on $5k @ 18.5 % APR → interest $77.08, principal $72.92,
  balance $4,927.08. Use exact dinero arithmetic per `lib/amortization.ts`.

### 🟡 DEBT-FC-003 — Debt-payment transaction appears in Transactions list
- **Expected**: Linked expense visible with `linkedDebtId`; cannot be deleted
  without confirming TXN-DEL-FC-003 cascade.

### 🟡 DEBT-FC-004 — Avalanche extra-payment cascade
- **Scenario**: 18.5 % debt vs 8 % debt; extra $500 → all extra hits 18.5 % first.

### 🟡 DEBT-FC-005 — Snowball extra-payment cascade
- **Scenario**: Same two debts; extra $500 → all extra hits the smaller balance.

### 🟡 DEBT-FC-006 — Part-payment with `partChoice='reduce_tenure'`
- **Expected**: `remainingMonths` decreases; EMI unchanged.

### 🟡 DEBT-FC-007 — Part-payment with `partChoice='reduce_emi'`
- **Expected**: EMI recomputed downward; tenure unchanged.

### 🟡 DEBT-FC-008 — Paying a debt to zero marks it inactive
- **Expected**: Debt no longer appears on Liabilities side of NetWorth; final
  payment row preserved in `paymentLog`; Pulse "Debt Health" component improves.

---

# §8 · Asset Management (ASSET-FC)

### 🟡 ASSET-FC-001 — Create asset of each liquidity tier (liquid/short/long)
### 🟡 ASSET-FC-002 — Edit asset value and `lastUpdated` stamp updates
### 🟡 ASSET-FC-003 — Delete asset removes from NetWorth + relinks transactions
- **Expected**: Transactions previously holding the asset's id show "Account
  removed" placeholder; aggregates exclude the asset.

### 🟡 ASSET-FC-004 — Liquidity ratio uses only `liquid`-tier assets
- **Expected**: A long-tier asset increase does **not** raise the liquidity ratio.

### 🟡 ASSET-FC-005 — Manual value edit creates an audit trail entry (v7)
- **Expected**: History view shows old → new transition with timestamp.

---

# §9 · Split Payments (SPLIT-FC)

### 🟡 SPLIT-FC-001 — Create even split with N participants
### 🟡 SPLIT-FC-002 — Create uneven split (per-participant `share` differs)
- **Expected**: Sum of shares = `totalAmount`; validator blocks otherwise.
### 🟡 SPLIT-FC-003 — Mark participant settled; IOU disappears from Splits page
### 🟡 SPLIT-FC-004 — `paidBy='external'` split — only your share counts as expense
### 🟡 SPLIT-FC-005 — Settlement persists across reload 🟠 (Clar. #5)
### 🟡 SPLIT-FC-006 — Settlement deposit reflects in NetWorth on selected asset 🟠 (Clar. #1)

---

# §10 · Recurring Transactions (RECUR-FC)

### 🟡 RECUR-FC-001 — Create weekly recurring schedule
### 🟡 RECUR-FC-002 — `autoConfirm=true` auto-generates on `nextDueDate`
- **Tooling**: `page.clock.fastForward` to advance virtual time.
### 🟡 RECUR-FC-003 — `reminderLeadDays=3` fires `upcoming_bill` notification
### 🟡 RECUR-FC-004 — Skip / defer one instance; future schedule unaffected
### 🟡 RECUR-FC-005 — Monthly with `dayOfMonth=31` handles February correctly
- **Expected**: Falls back to last day of month; no exception.
### 🟡 RECUR-FC-006 — Weekly `weekday` field schedules on correct day
### 🟡 RECUR-FC-007 — Recurring income visible in goal projection timeline

---

# §11 · Notifications System (NOTIF-FC)

### 🟡 NOTIF-FC-001 — Master toggle off suppresses all notifications
### 🟡 NOTIF-FC-002 — Per-type toggle (e.g. `budget_threshold=false`) is honoured
### 🟡 NOTIF-FC-003 — Quiet hours suppress non-critical notifications
- **Scenario**: Set quiet 22:00–07:00; trigger at 23:00 → notification
  queued for 07:00 delivery, not surfaced immediately.
### 🟡 NOTIF-FC-004 — Marking notification read updates badge count
### 🟡 NOTIF-FC-005 — Dismissed notification persists across reload
### 🟡 NOTIF-FC-006 — Web-push opt-in flow (when supported) `@cloud`

---

# §12 · Reports & Analytics (RPT-FC)

### 🟡 RPT-FC-001 — Each period selector (Day/Week/Month/Quarter/Year) re-renders charts
### 🟡 RPT-FC-002 — Empty-state copy shown when no transactions in period
### 🟡 RPT-FC-003 — Donut breakdown matches sum of expense category totals
- **Property**: Sum of all donut slice values = total expense for the period
  (assert exactly via dinero arithmetic; no penny drift).
### 🟡 RPT-FC-004 — Filter by member narrows all charts consistently
### 🟡 RPT-FC-005 — CSV export contains the rows the chart is built from
### 🟡 RPT-FC-006 — Print-friendly Reports page renders without sidebar

---

# §13 · Family Pulse Score™ (PULSE-FC)

### 🟡 PULSE-FC-001 — Score weights match the documented 25/25/15/15/20 split
- **Method**: Construct a seed that yields known component values; assert
  the composite equals the weighted sum to 2 dp.

### 🟡 PULSE-FC-002 — Budget Compliance component drops on over-budget
### 🟡 PULSE-FC-003 — Debt Health component improves after debt payoff
### 🟡 PULSE-FC-004 — Score is stable across reload (no recompute drift)

---

# §14 · Login, Registration & Session (AUTH-FC) `@cloud`

### 🟡 AUTH-FC-001 — Sign-up with valid email + strong password
### 🟡 AUTH-FC-002 — Weak password rejected with inline guidance
### 🟡 AUTH-FC-003 — Invalid email format rejected
### 🟡 AUTH-FC-004 — Sign-in with valid credentials lands on dashboard
### 🟡 AUTH-FC-005 — Sign-in with wrong password shows generic error (no user enumeration)
### 🟡 AUTH-FC-006 — Sign-out clears session and bounces to `/auth/signin`
### 🟡 AUTH-FC-007 — Reset-password email link sets a new password
### 🟡 AUTH-FC-008 — Accept household invitation joins shared household
### 🟡 AUTH-FC-009 — Session restored from refresh token after browser restart
- **Tooling**: Persist storage state via Playwright `storageState`.

---

# §15 · Account Details & Profile (PROFILE-FC)

### 🟡 PROFILE-FC-001 — Edit name + email
### 🟡 PROFILE-FC-002 — Change `baseCurrency` reformats every money display
### 🟡 PROFILE-FC-003 — Change language + dateFormat updates UI everywhere
- **Coverage**: Sample at least one Latin (es), one RTL-free non-Latin (hi)
  and one CJK locale (ja) for label rendering.
### 🟡 PROFILE-FC-004 — Change household type (`personal`→`family`) reveals member features
### 🟡 PROFILE-FC-005 — Change payoff strategy reorders Payoff Schedule
### 🟡 PROFILE-FC-006 — Change `extraPayment` updates payoff projections
### 🟡 PROFILE-FC-007 — Theme switch (warm / dark / system) persists across reload

---

# §16 · Multi-Household & Members (HH-FC)

### 🟡 HH-FC-001 — Create second household; switcher lists both
### 🟡 HH-FC-002 — Switching household isolates data (no cross-bleed)
### 🟡 HH-FC-003 — Add member; member appears in transaction member dropdown
### 🟡 HH-FC-004 — Change member role (primary/partner/child/elder); role badge updates
### 🟡 HH-FC-005 — Invite member by email (`@cloud`); pending state shown until accept
### 🟡 HH-FC-006 — Viewer role cannot edit or delete (read-only enforcement)

---

# §17 · Cloud Sync & Conflict Resolution (SYNC-FC) `@cloud`

### 🟡 SYNC-FC-001 — Local edit syncs to cloud on next push
### 🟡 SYNC-FC-002 — Cloud edit propagates to a second open session (realtime)
### 🟡 SYNC-FC-003 — Optimistic concurrency rejects stale update (TD-03)
- **Scenario**: Device A reads row v1, Device B writes v2, Device A writes
  v1 → adapter returns conflict, UI prompts merge.
### 🟡 SYNC-FC-004 — Cache no-clobber: empty cloud response does not wipe local
- **Why**: Regression guard for v6.4's "data lost on sign-out → sign-in".
### 🟡 SYNC-FC-005 — Forced full resync via Settings → "Resync"
### 🟡 SYNC-FC-006 — Offline edits queue, then flush on reconnect

---

# §18 · Backup & Data Portability (BACKUP-FC)

### 🟡 BACKUP-FC-001 — JSON full backup contains every entity + profile + rates
- **Property**: Round-trip — export, clear, import, deep-equal == original.
### 🟡 BACKUP-FC-002 — Import rejects malformed JSON with a clear error
### 🟡 BACKUP-FC-003 — Import warns on version mismatch; refuses if incompatible
### 🟡 BACKUP-FC-004 — CSV transactions export matches the active filter set
### 🟡 BACKUP-FC-005 — Balance-sheet CSV export sums to NetWorth shown on screen

---

# §19 · Search & Filter (SEARCH-FC)

### 🟡 SEARCH-FC-001 — Free-text search matches description, note, category
### 🟡 SEARCH-FC-002 — Date-range filter narrows transactions list
### 🟡 SEARCH-FC-003 — Type filter (income/expense/transfer/investment) is sticky on reload
### 🟡 SEARCH-FC-004 — Empty result shows actionable empty state (not blank)

---

# §20 · Onboarding & Templates (ONB-FC)

### 🟡 ONB-FC-001 — First run shows onboarding; chooses template seed
### 🟡 ONB-FC-002 — Template `family` seeds expected categories + budgets
### 🟡 ONB-FC-003 — `primaryConcern` (spending/debt/savings/retirement) tunes dashboard widgets
### 🟡 ONB-FC-004 — Skipping onboarding lands on dashboard with empty state
### 🟡 ONB-FC-005 — `onboardedAt` set so onboarding never re-prompts

---

# §21 · Privacy / Excluded Transactions (PRIV-FC)

### 🟡 PRIV-FC-001 — Marking a transaction `excluded=true` adds the 🔒 stripe + badge
### 🟡 PRIV-FC-002 — Excluded transactions skip ALL aggregations
- **Assertions**: NetWorth, Reports, Pulse, Budgets, Goals — none change when
  toggling `excluded` on/off for the same transaction.
### 🟡 PRIV-FC-003 — Excluded count surfaces in Settings → Account Stats

---

# §22 · Investment Auto-Update (INV-FC)

### 🟡 INV-FC-001 — Investment transaction with auto-update increments asset value
### 🟡 INV-FC-002 — Disabling auto-update keeps asset value flat
### 🟡 INV-FC-003 — Editing the investment transaction adjusts asset by the delta only

---

# §23 · Multi-Currency & FX (FX-FC)

### 🟡 FX-FC-001 — Editing an exchange rate re-renders converted totals everywhere
### 🟡 FX-FC-002 — Rounding uses banker's rounding at the target's native exponent
- **Property**: A 300-row schedule must end exactly on `0.00` outstanding —
  no per-step drift (`lib/amortization.ts` guarantee).
### 🟡 FX-FC-003 — Sums in dinero space match per-row currency-formatted values
### 🟡 FX-FC-004 — Cloud `numeric(15,2)` string serialisation parses via `parseMoneyFromCloud`
### 🟡 FX-FC-005 — Switching `baseCurrency` re-anchors every chart without precision loss

---

# §24 · Keyboard Shortcuts & Accessibility (A11Y-FC)

### 🟡 A11Y-FC-001 — `N` / `G` / `D` / `A` open Add modals; `Esc` closes; `/` focuses search
### 🟡 A11Y-FC-002 — Modal focus trap returns focus to the trigger on close
### 🟡 A11Y-FC-003 — `aria-live` announces toast notifications
### 🟡 A11Y-FC-004 — Tab order on transaction form is logical and complete
### 🟡 A11Y-FC-005 — Colour contrast ≥ AA on both warm and dark themes (sample 5 pages)

---

# §25 · Responsive & Mobile Layout (RESP-FC)

### 🟡 RESP-FC-001 — ≥1100 px renders the full desktop layout
### 🟡 RESP-FC-002 — ≤820 px collapses sidebar into hamburger menu
### 🟡 RESP-FC-003 — ≤480 px stacks dashboard cards single-column
### 🟡 RESP-FC-004 — Floating action buttons (Planner / Chat) are reachable on mobile

---

# §26 · Performance & Large Datasets (PERF-FC)

### 🟡 PERF-FC-001 — 5,000 transactions render and scroll smoothly
- **Method**: Seed 5k rows; assert first paint < 2 s; scroll at 60 fps median.
### 🟡 PERF-FC-002 — Reports period switch on 5k dataset re-renders < 800 ms
### 🟡 PERF-FC-003 — Amortisation schedule of 360 rows computes < 250 ms
### 🟡 PERF-FC-004 — Initial JS bundle (excluding charts) under 250 KB gzipped
- **Method**: Inspect built `dist/assets` sizes in CI step.

---

# §27 · Error Resilience & Edge Cases (ERR-FC)

### ✅ CON-E2E-005 — Error boundary shows fallback UI
- **File**: `error-boundary.spec.ts`
- **Steps**: Visit `/__e2e_error` → assert "Something broke" + "Your data is
  safe locally." → click "Try Again" → fallback disappears.

### 🟡 ERR-FC-001 — Adapter network failure surfaces toast, retains local cache `@cloud`
### 🟡 ERR-FC-002 — Schema migration failure surfaces "Could not upgrade data" with backup link
### 🟡 ERR-FC-003 — Calling `forceFullResync()` re-establishes per-entity sentinel `@cloud`
### 🟡 ERR-FC-004 — Time-zone change on the host does not shift transaction dates
### 🟡 ERR-FC-005 — `localStorage` quota exceeded shows a clear, recoverable error

---

## Designer Clarifications (block ⛔ rows until resolved)

| # | Question | Affected IDs |
|---:|---|---|
| 1 | Expense→asset linking: automatic from a primary account, manual every time, or remembered per category? | TXN-FC-002, NWRT-FC-001, SPLIT-FC-006 |
| 2 | Income→goal: auto-credit when the receiving asset is linked, or always manual? | GOAL-FC-003, GOAL-FC-004 |
| 3 | Budget surplus: auto-route to a designated goal, manual allocation, or unallocated? | BDGT-FC-008, GOAL-FC-004 |
| 4 | Future-dated transactions: blocked, allowed as pending, or allowed unrestricted? | TXN-FC-006, RECUR-FC |
| 5 | Split anchor deletion: cascade settlement transactions or leave them unlinked? | SPLIT-FC-005, TXN-DEL-FC-004 |

---

## Required Test Infrastructure

### Page Objects (`react/e2e/pages/`)
- ✅ `DashboardPage`, `TransactionsPage`, `TransactionFormModal`,
  `NetWorthPage`, `BudgetsPage`, `GoalsPage`, `DebtsPage`, `AssetsPage`
  *(scaffolding PR — Phase 1 ready)*
- 🟡 `SplitsPage`, `ReportsPage`, `RecurringPage`, `NotificationCenter`,
  `SettingsPage` (with nested `AccountSection`, `LocalizationSection`,
  `AppearanceSection`, `DebtPrefsSection`, `SyncSection`),
  `AuthPage` (sign-in/up/reset/accept-invite), `OnboardingPage`,
  `HouseholdSwitcher`, `SearchBar`.

### Fixture Extensions (`react/e2e/fixtures/`)
- ✅ `advanceClock(epochMs | dateString)` helper wrapping
  `page.clock.setFixedTime`.
- ✅ `seedWith({ debts?, goals?, recurring?, splits?, members?, assets?, profile? })`
  factory that deep-merges into `defaultSeed`.
- ✅ `sampleCreditCardDebt` reference seed for §7 DEBT-FC.
- 🟡 `mockExchangeRates(rates)` to pin FX for FX-FC suite.
- 🟡 `withCloud()` wrapper running against an ephemeral Supabase branch
  via the Supabase MCP (`create_branch` / `delete_branch`). Mock path
  abandoned — see `docs/ROADMAP_AUTO_LINKING.md` rationale on testing
  against the real cloud boundary.

### Test Hooks in App Code
- 🟡 `/__e2e_error` ✅
- 🟡 `/__e2e_debt_error`, `/__e2e_split_error`, `/__e2e_sync_conflict`
- 🟡 `window.__ff_clock` exposes the mocked `Date.now` for fixture sanity checks.

---

## CI Integration

### Job graph (`.github/workflows/ci.yml`)

```
react-test
  ├─ react-lint            (eslint + tsc --noEmit)
  ├─ react-unit            (vitest)
  ├─ react-e2e-local       (playwright, default project, all non-@cloud)
  └─ react-e2e-cloud       (playwright, --grep @cloud, runs only on PRs that
                            touch lib/supabaseAdapter.ts, lib/auth.ts,
                            components/auth/**, or are tagged `cloud-required`)
```

### Inventory-freshness gate

```yaml
- name: Test inventory freshness
  run: |
    if git diff --name-only origin/main... | grep -qE '^react/src/'; then
      if ! git diff --name-only origin/main... | grep -q 'react/e2e/TEST_CASE_INVENTORY.md'; then
        echo "::error::App source changed without updating TEST_CASE_INVENTORY.md"
        exit 1
      fi
    fi
```

### Reporting
- Playwright HTML report uploaded as a CI artifact for every run.
- A nightly job posts a Slack summary (counts of ✅ / 🟡 / 🔴 by area) to the
  team channel, sourced from this file's status legend.

---

## Owners

| Area | Owner |
|---|---|
| Foundation, Performance, A11y, Responsive | TBD |
| Transactions, Budgets, Goals, Debts, Assets, NetWorth | TBD |
| Splits, Recurring, Notifications | TBD |
| Auth, Multi-Household, Cloud Sync | TBD |
| Reports, Pulse, Search, Onboarding, FX | TBD |
| Privacy, Investment, Error Resilience, Backup | TBD |

> Replace `TBD` with the GitHub handles of the engineers accountable for
> keeping each section honest. The quarterly audit (see Maintenance Rules)
> is owned by these names.

---

## Effort Estimate

Ballpark to take the inventory from **6 / 163 (3.7 %) to 100 %** on Playwright.
Numbers assume one SDET familiar with Playwright + the FinFlow codebase
(~6 months ramp). Adjust ±25 % for less-familiar engineers.

### Per-test complexity rubric

| Tier | Description | Hours / test | Examples |
|---|---|---:|---|
| **S — Simple** | Single screen, CRUD, validation, no time/cloud/perf concerns | **3 h** | TXN-FC-001/005/007, SEARCH-FC-*, PROFILE-FC-001 |
| **M — Medium** | Cross-module assertions, calculations, multi-step flows | **6 h** | NWRT-FC-*, BDGT-FC-*, TXN-EDIT-FC-001..005, RPT-FC-* |
| **C — Complex** | Time manipulation, cloud sync, conflict resolution, performance budgets, dinero math validation | **12 h** | RECUR-FC-*, SYNC-FC-*, PERF-FC-*, FX-FC-002, DEBT-FC-004/005, PULSE-FC-001 |

### Test-build effort (157 designed tests)

| Tier | Count | Hours each | Subtotal |
|---|---:|---:|---:|
| Simple | ~32 | 3 | 96 h |
| Medium | ~86 | 6 | 516 h |
| Complex | ~39 | 12 | 468 h |
| **Test development subtotal** | **157** | | **~1 080 h** |

### Infrastructure & enablement (one-time)

| Item | Hours |
|---|---:|
| 12 new Page Objects (Budgets, Goals, Debts, Assets, Splits, NetWorth, Reports, Recurring, Notifications, Settings + 5 sub-sections, Auth, Onboarding, HouseholdSwitcher, SearchBar) | ~60 h |
| Fixture extensions (`advanceClock`, `seedWith`, `mockExchangeRates`, `withCloud`, viewport presets) | ~32 h |
| App-side test hooks (`/__e2e_*` routes, `window.__ff_clock`) | ~16 h |
| Cloud test environment (Supabase mock or ephemeral branch via MCP) | ~24 h |
| Designer clarifications + spec rework (5 open questions) | ~24 h |
| CI integration (workflow, freshness gate, `@cloud` split, Slack reporter) | ~16 h |
| Team documentation + onboarding | ~20 h |
| **Infrastructure subtotal** | **~192 h** |

### Ongoing overheads

| Item | Hours |
|---|---:|
| Flake stabilisation (~15 % of test dev) | ~162 h |
| App-bug triage surfaced by new coverage | ~40 h |
| Code review for the SDET PRs | ~80 h |
| **Overhead subtotal** | **~282 h** |

### Grand total

| Bucket | Hours |
|---|---:|
| Test development | 1 080 |
| Infrastructure | 192 |
| Overhead | 282 |
| **TOTAL** | **~1 554 h** |

Converted:

| Capacity | Calendar time |
|---|---|
| 1 SDET, 100 % dedicated | **~9–10 months** |
| 2 SDETs in parallel (some infra serialisation) | **~5–6 months** |
| 3 SDETs (1 lead + 2 implementers) | **~3.5–4 months** |
| Realistic team (1 lead + 2 SDETs with normal interruption) | **~6 months** |

### Phased delivery (recommended — burn the counter down in chunks)

| Phase | Scope | Tests added | Hours | Cum. Developed | Cum. % |
|---:|---|---:|---:|---:|---:|
| 0 | Today (already shipped) | — | — | 6 | 3.7 % |
| 1 | Core CRUD + persistence: §0 finish, §1 TXN-FC, §2 EDIT, §3 DEL, §4 NWRT | ~32 | ~220 h | 38 | 23 % |
| 2 | Major modules: §5 Budgets, §6 Goals, §7 Debts, §8 Assets, §9 Splits | ~33 | ~240 h | 71 | 44 % |
| 3 | Time + state: §10 Recurring, §11 Notifications, §12 Reports, §13 Pulse | ~23 | ~200 h | 94 | 58 % |
| 4 | Cloud + auth (gated `@cloud`): §14 Auth, §16 Households, §17 Sync, §18 Backup | ~26 | ~280 h | 120 | 74 % |
| 5 | Cross-cutting features: §15 Profile, §19 Search, §20 Onboarding, §21 Privacy, §22 Investment, §23 FX | ~27 | ~190 h | 147 | 90 % |
| 6 | Quality bars: §24 A11y, §25 Responsive, §26 Performance, §27 Error Resilience | ~16 | ~190 h | 163 | **100 %** |
|   | **Total** | **~157** | **~1 320 h** test dev only (infra/overhead amortised across phases) | | |

### Risk / sensitivity

- **Clarifications #1–#5 unresolved** → 8 tests blocked; resolving these early
  protects ~50 h of rework later.
- **Cloud test infra choice** (Supabase mock vs ephemeral branch) swings
  Phase 4 by ±60 h. Ephemeral branches via the connected Supabase MCP are
  preferred — closer to production, but slower per-test.
- **Test data seeding** is reused; once `seedWith()` lands, per-test S/M/C
  hours can drop ~20 %.
- **Designer rework** post-Phase 2 (if features change) typically costs
  ~10 % of impacted tests' original build cost.

### How to update this section

When you ship test IDs:

1. Bump the **Progress Tracker** counter at the top of this file.
2. Flip the row's status icon from 🟡 to ✅ in its functional area.
3. Note actual hours in your PR — quarterly we recalibrate the rubric against
   real data and revise the per-tier hour estimates in this section.

---

*Last reviewed: 2026-05-24. Inventory schema v1.*
