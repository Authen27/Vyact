# Vyact — Notification Requirements & Scope (Aurora revamp)
Version: draft for v9.9.3 redesign · Batch A amendment · 2026-07-09
Owner: design → engineering handoff. Source screens: `revamp/batch-a/Batch A · Shell + Home.html` (frames M2, D2).

## 1. Model
- Statuses: `unread` → `read` → (optional) `dismissed`. Matches existing store model; no schema change required.
- Every notification: `{ id, type, createdAt, status, title, body, amountRef?, deepLink?, actions[], householdId, memberId? }`.
- Badge: bell shows count of **unread only**, capped display at `9+`.
- Grouping in UI: **Today** / **Earlier** (calendar-day boundary, household timezone).
- Ordering: within each group, action-required types pinned first, then by `createdAt` desc.
- Retention: auto-purge `dismissed` after 30 days; `read` after 90 days.
- Household-scoped: switching household swaps the notification list; badge reflects active household only.

## 2. Surfaces & gestures
- Bell (header, mobile + desktop) → **full-screen top pull-down sheet** (glass, scrim). Not an anchored popover.
- Dismiss sheet: swipe up (mobile), scrim tap, Esc (desktop), grabber.
- Row actions execute **inline** — row transitions to `read` state with a toast; the sheet stays open.
- Row swipe-left (mobile) = dismiss single. `Mark all read` in header.
- Footer link → Notification settings (Settings ▸ Notifications).

## 3. Type matrix
Legend: P1 = action-required (pinned, has decision buttons) · P2 = informational (read/view).

| # | type id | P | Trigger | Copy pattern (title / body) | Icon · tint | Actions [primary, secondary…] | Deep link | Dedupe / frequency |
|---|---------|---|---------|------------------------------|-------------|-------------------------------|-----------|--------------------|
| 1 | `recurring_due_confirm` | P1 | Recurring txn reaches due date with auto-confirm OFF | "{desc} · {amount} — due {rel-date}" / "Auto-approve is off for this schedule" | ↻ · coral | **Approve** (posts txn), Skip once, Edit schedule | recurring?id | 1 per occurrence; re-notify daily until resolved, max 3 |
| 2 | `recurring_reminder` | P2 | Lead-time reminder (1/3/7 d per schedule setting) | "{desc} · {amount} — in {n} days" | ↻ · neutral | View schedule | recurring?id | 1 per occurrence per lead window |
| 3 | `recurring_posted` | P2 | Auto-confirmed recurring posted | "{desc} charged {amount}" / "recurring" | ↻ · neutral | View transaction | transactions?id | 1 per posting |
| 4 | `budget_threshold` | P1 | Allocation crosses 80% or 100% | "{cat} at {pct}% of {period} budget" / "{remaining} left · {days} days to go" | ◐ · honey (80) / terra (100) | **Review budget**, See transactions | budgets?id / transactions?budgetId&cat | 1 per cat+period+threshold |
| 5 | `income_landed` | P2 | Income txn posted (incl. salary schedule) | "{source} landed — +{amount}" | ✓ · sage | View | transactions?id | 1 per txn |
| 6 | `insight_fresh` | P2 | buildInsightFeed produces ≥1 new card | "Your insights are ready" / "{n} fresh cards" | ✦ · plum | Open For You | insights?tab=foryou | Max 1/day, replaces prior unread of same type |
| 7 | `trend_alert` | P2 | Rules engine flags trend (e.g. category ↑ ≥10% MoM) | "{cat} is trending up {pct}%" / "{driver}" | ✦ · plum | See why | reports?focus=cat | 1 per cat per month |
| 8 | `debt_payment_due` | P1 | Debt min-payment due in ≤3 days | "{debt} payment · {amount} — due {rel-date}" | ⚠ · honey | **Record payment** (pre-seeded sheet), View debt | debts?id | Re-notify at 3d and 1d; stops when payment recorded |
| 9 | `stale_balance` | P1 | Liquid/short asset or account balance >30 d old | "{n} balances may be out of date" | ◌ · honey | **Update balances** (reconcile), Dismiss | networth / accounts | Max 1/week, aggregated |
| 10 | `invite_received` | P1 | Household invite to this user | "{inviter} invited you to {household}" / "as {role}" | ⌂ · coral | **Accept**, Decline | invite/{token} | 1 per invite; expires with invite |
| 11 | `member_activity` | P2 | Member joined / left / role changed (requires `view_activity_log`) | "{member} {event} {household}" | ⌂ · denim | View household | households | 1 per event |
| 12 | `sync_conflict` | P1 | Local vs cloud conflict detected | "Sync conflict — review needed" / "Your changes are kept locally" | ! · terra | **Review conflict** | (conflict banner flow) | 1 active at a time; also shows persistent banner |
| 13 | `milestone` | P2 | Payoff %, pulse jump ≥5, goal-like milestones | "{achievement}" e.g. "Card A is 75% paid off" | ✦ · sage | View | context | 1 per milestone, never repeated |

## 4. Settings scope (Settings ▸ Notifications)
- Per-type toggles, grouped: Money movement (1,2,3,5) · Budgets & debts (4,8) · Insights (6,7,13) · Household (10,11) · System (9,12 — cannot disable 12).
- Quiet hours (default 22:00–07:00): P2 types hold; P1 types deliver silently (badge only).
- Delivery: in-app always; push/email out of scope for this redesign phase.

## 5. Acceptance criteria
1. Bell badge equals count of unread for active household; updates live on approve/skip/read.
2. Approve on `recurring_due_confirm` posts the transaction, flips row to read state inline, fires "Saved" toast with Undo, and does NOT close the sheet.
3. All P1 rows expose their primary action as a coral button; P2 rows are tap-to-navigate.
4. Empty state: "All caught up" + pip; shows when no unread AND no read within 7 days.
5. Sheet is identical in structure on mobile and desktop (desktop = centered 720px column).
6. Every deep link opens the target with context applied (existing `?budgetId` etc. conventions).
7. Reduced-motion: sheet fades (no slide), rows don't stagger.
