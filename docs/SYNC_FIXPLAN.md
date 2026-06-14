# Vyact — Sync Fix Plan (refresh-based model)

> Product decision (PM, 2026-06): **devices converge ON REFRESH, not via a live
> socket.** The bar that decision sets: *every refresh must converge the device
> to the true server state (including deletes), never lose a write silently, and
> honestly show pending/failed/last-synced.* This plan delivers that.
>
> Contract: a "refresh" = a pull triggered by app open, tab focus/visibility
> regained, reconnect, local write, the foreground poll, or the manual Refresh
> control. There is no real-time subscription.

## Status

| ID | Fix | State | Files |
|---|---|---|---|
| **R1** | Refresh-convergence correctness (deletes/tombstones, cursor `>=`) | ✅ shipped | `lib/supabaseAdapter.ts` |
| **R2** | Recurring generation idempotency (no duplicate transactions) | ✅ shipped | `lib/recurring.ts`, `store.ts` |
| **R3** | Refresh triggers (focus/visibility/online/poll) + retire dead realtime | ✅ shipped | `store.ts` |
| **R4** | Honest sync status + manual refresh control | ✅ shipped | `lib/hybridAdapter.ts`, `store.ts`, `SyncStatusBadge.tsx` |
| **R5** | Conflict & lost-write safety (no silent loss; re-apply) | ✅ shipped | `lib/hybridAdapter.ts`, `SyncConflictBanner.tsx` |
| **R6** | Atomic reconcile (no half-applied money on refresh) | ⏸ **deferred — spec below** | (migration + `store.ts`) |

---

## R1 — Refresh-convergence correctness  ✅
Two defects made a refresh unable to converge:
1. **`listSince` used strict `.gt('updated_at', cursor)`** → a row whose
   `updated_at` ties the cursor's exact millisecond is silently skipped on every
   other device. **Fixed → `.gte(...)`** (boundary rows re-upsert idempotently).
2. **`remove()` set only `deleted_at`, never bumped `updated_at`.** The delta
   cursor is `max(updated_at)`; deletes propagate only as tombstones inside
   `updated_at >= cursor`. With no DB touch-trigger on the `deleted_at` write,
   the tombstone kept a stale timestamp and **never entered another device's
   delta window → permanent ghost rows** (the case-7 net-worth bug). **Fixed →
   `remove()` and the `budgetAllocations` soft-delete now set `updated_at`
   alongside `deleted_at`.**

**Done-when:** delete on A → one refresh on B removes it; child-table
(`budget_allocations`) replacements drop their old rows on B.

## R2 — Recurring generation idempotency  ✅
`generateTransaction` used a random `uid()`, so two devices each materialising
the same due occurrence inserted **two** transactions. **Fixed →** instances now
get a **deterministic id** `recurringInstanceId(scheduleId, occurrenceDate)`
(stable UUIDv8 via cyrb128), so concurrent generation upserts the *same* row.
A guard in `runRecurringEngine` also skips an occurrence already present locally.

**Done-when:** two devices refresh a due schedule → exactly one instance; the
engine is safe to re-run.

## R3 — Refresh triggers + retire dead realtime  ✅
The old `subscribeRealtime` used `postgres_changes` with **no `table`** and one
household filter for every table — it could not reliably deliver. Removed it.
`subscribeRealtime` now wires refresh-based triggers: `visibilitychange→visible`,
`window focus`, `window online`, plus a **90 s foreground poll**, all debounced
400 ms (collapses bursts, avoids out-of-order clobber). App-init + post-write
refreshes are unchanged.

**Done-when:** switch tabs / unlock phone / reconnect → current within one
refresh, no manual page reload.

## R4 — Honest sync status + manual refresh  ✅
- Adapter gained `pendingFailedCount()` / `clearFailed()` — the `sync_failed`
  dead-letter was previously **invisible** (a money write could vanish silently).
- Store tracks `lastSyncedAt` (set on every successful `refresh()`) and exposes
  `manualRefresh()` — a **full-sweep** that clears the per-device delta cursors
  (`forceFullResync`) then refreshes, so it also catches any tombstone a delta
  window missed (R1 safety net).
- `SyncStatusBadge` is now a **tap-to-refresh button** showing worst-of
  `{offline · N failed · N conflicts · syncing · synced "· 2m ago"}`.

**Done-when:** a pending/failed/conflicted write is never shown as "all synced";
tapping the badge full-resyncs.

## R5 — Conflict & lost-write safety  ✅
- Adapter gained `retryDeadLettered(bucket)` — re-queues conflict/failed ops with
  retries reset and (for conflicts) `expectedUpdatedAt` stripped, so the user can
  **re-apply** their edit on top of the newer server row instead of losing it.
- `SyncConflictBanner` now surfaces **both** conflicts and the (previously silent)
  failed bucket, with **"Refresh & re-apply"** (pull latest, then retry) and
  "Dismiss" (discard).

**Done-when:** concurrent edits → the loser gets an explicit re-apply prompt, not
silent loss; failed syncs are visible.

---

## R6 — Atomic reconcile  ⏸ DEFERRED (ready-to-implement spec)

**Why deferred (not skipped):** R6 is the lowest-severity case and **self-heals
on the next refresh** under the accepted refresh-based model (a device that
refreshes mid-reconcile shows a transient half-state, corrected seconds later).
Shipping it properly needs a money-mutating SQL RPC, which (a) isn't covered by
the JS money-invariant tests and (b) would either mutate the prod DB out-of-band
or entangle `schema.sql` with an unrelated uncommitted migration. That risk is
not justified for a transient, self-healing issue — so it's specced for a
branch-tested follow-up rather than rushed.

**The fix:** `store.reconcileAccount` writes the account offset and the linked
Asset/Debt as two separate queued ops. Wrap them in one server transaction.

**Verified columns (live DB, `dmxqkvploojokffuhxnz`):**
`accounts(reconciliation_offset numeric, reconciliation_log jsonb, confidence text,
source text, confirmed_at timestamptz, updated_at timestamptz, household_id uuid)`;
`assets(value numeric, last_updated date, confidence, source, confirmed_at,
updated_at)`; `debts(current_balance numeric, confidence, source, confirmed_at,
updated_at)`.

**Migration (apply via the deploy pipeline / a Supabase branch first):**
```sql
create or replace function public.reconcile_account(
  p_household uuid, p_account_id uuid, p_offset numeric, p_log jsonb,
  p_linked_table text,           -- 'assets' | 'debts' | null
  p_linked_id uuid, p_linked_value numeric
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_now timestamptz := now();
begin
  if auth.uid() is null or not is_member(p_household) then
    raise exception 'Not a member of this household';
  end if;
  update accounts set reconciliation_offset = p_offset, reconciliation_log = p_log,
         confidence = 'confirmed', source = 'user', confirmed_at = v_now, updated_at = v_now
   where id = p_account_id and household_id = p_household;
  if p_linked_table = 'assets' and p_linked_id is not null then
    update assets set value = p_linked_value, last_updated = (v_now)::date,
           confidence = 'confirmed', source = 'user', confirmed_at = v_now, updated_at = v_now
     where id = p_linked_id and household_id = p_household;
  elsif p_linked_table = 'debts' and p_linked_id is not null then
    update debts set current_balance = p_linked_value,
           confidence = 'confirmed', source = 'user', confirmed_at = v_now, updated_at = v_now
     where id = p_linked_id and household_id = p_household;
  end if;
end $$;
revoke execute on function public.reconcile_account(uuid,uuid,numeric,jsonb,text,uuid,numeric) from public, anon;
grant  execute on function public.reconcile_account(uuid,uuid,numeric,jsonb,text,uuid,numeric) to authenticated;
```

**Client wiring (`store.reconcileAccount`):** when `cloudEnabled && online`, call
`supabase.rpc('reconcile_account', …)` for the cloud leg and update local state
in-memory; **on any error, fall back to the existing two-write queued path** (so
offline + pre-migration prod still work, and correctness never depends solely on
the new SQL). Keep the JS `reconcileAccount` offset math (INV-3/3b) untouched.

**Branch-test plan:** `create_branch` → `apply_migration` → call the RPC on a seed
row, assert `accounts.reconciliation_offset` + linked entity both updated with a
shared `updated_at`; then `delete_branch`. Only then ship the migration.

---

## What we explicitly did NOT build
- **No real-time infrastructure** (broadcast triggers / per-table `postgres_changes`).
- **No Web Push / server-side notification fan-out** — notifications recompute on
  refresh, acceptable per the product decision. *(Optional low-pri nicety: sync a
  per-household dismiss/"seen" state so a dismissed alert doesn't reappear.)*

---

## B-series — Budget multi-device convergence (v9.3.1)

Separate root cause from R1–R5 (those were delta/tombstone/status plumbing; this
is a budget **data-model** defect underneath them).

- **B1 — deterministic budget container id** (`lib/budgetIdentity.ts`, wired in
  `store.upsertBudget` + `BudgetFormModal`). A budget's identity is
  `(household, scope, year, month)` enforced by `uq_budget_month`/`uq_budget_annual`,
  but the client minted a random `uid()` per new budget → two devices, two PKs,
  same slot → second INSERT violates the unique index and dead-letters (silent
  cross-device loss). Now every device derives the same id → converge via
  `ON CONFLICT (id)`. (Same idempotency principle as R2/`recurringInstanceId`.)
- **B2 — DB defects** (`20260614130000_v931_budget_identity_convergence.sql`):
  `replace_budgets` rewritten (was stripping `scope/period_year/period_month` on
  restore and PK-colliding on same-id re-insert) → schema-correct + atomic upsert;
  dropped the legacy competing `budgets_household_category_uniq` index.

### Deferred follow-up (evidence-gated) — R-BUDGET-RPC: identity-merge upsert
B1 converges all **fixed** clients. The one residual case is **rollout skew**: a
fixed client (deterministic id) creating a slot that a *pre-fix* client already
populated with a **random** id — `ON CONFLICT (id)` won't match → INSERT →
unique-index violation → dead-letter (now surfaced by R5, not silent; self-heals
once the stale client updates). Prod has **zero live budgets**, so there is no
skew to reconcile today. If rollout telemetry shows residual budget dead-letters,
add an `upsert_budget(h uuid, b jsonb)` RPC doing `INSERT … ON CONFLICT
(household_id, period_year, period_month) WHERE scope=… AND deleted_at IS NULL DO
UPDATE` (branch `scope` month/annual) and route the budgets new-insert path
through it — making the DB the id-independent convergence authority. Not built now
to keep the hot upsert path stable; gated behind evidence.
