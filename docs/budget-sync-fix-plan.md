# Plan: Durable Budget-Allocation Cross-Device Sync (v9.5.x)

Fix the defect behind "category allocations created on mobile never appear on desktop" (issue **a**) and
guarantee real-time, either-device budget edits (req **b**).

**Root cause — write-path asymmetry.** The parent budget is written online and awaited
(`createBudgetChecked`), but each child allocation goes through the fire-and-forget optimistic queue and can
silently dead-letter into `vt_sync_failed` — never reaching the cloud. So realtime has nothing to broadcast,
and a desktop logout / login / private-browser still shows nothing because the rows literally aren't in
Supabase.

> **Note:** The previous plan's Phases 1–2 ("remove `uid()`, bind to server id") are **already shipped in
> v9.5.1** (`BudgetFormModal` passes `id: initial?.id` and `setBudgetAllocations(saved.id, rows)`; `crudSlice`
> branches `if (!b.id) → createBudgetChecked`). They are intentionally dropped here as no-ops.

---

## Phase 0 — Reproduce with evidence (no code; gates everything)

- Create a mobile-PWA budget with ≥2 category allocations.
- Inspect mobile LocalStorage `vt_sync_failed` / `vt_sync_conflicts` / `vt_sync_queue` for leftover
  `budgetAllocations` ops.
- Query Supabase `budgets` + `budget_allocations` for the new `budget_id`; confirm the parent exists and the
  children are missing (or partial).
- Record the failing op's error class (`23503` FK / `42501` RLS / dropped non-UUID id / network).

**Exit gate:** a documented loss point. If the children *are* in Supabase, pivot to a read-path problem (the
`.catch(() => [])` swallow in `dataSlice.refresh`) instead of the write path.

## Phase 1 — Atomic parent + children write (PRIMARY FIX for a; unblocks b)

- **DB:** new RPC `upsert_budget_with_allocations(p_household_id uuid, p_budget jsonb, p_allocations jsonb[],
  p_mode text)` — wraps the existing `upsert_budget` identity/dedup logic, then deletes-missing + upserts the
  allocation set in the **same transaction**, scoped strictly to the resolved `budget_id`. Reuse
  `upsert_budget`'s `23505 → BUDGET_EXISTS` behavior for `p_mode='create'`.
- **Adapter:** add `upsertBudgetWithAllocations(...)` to `supabaseAdapter.ts` (online RPC, maps
  `BUDGET_EXISTS → BudgetExistsError`) and to the `DataAdapter` interface.
- **HybridAdapter:** route through the online-synchronous path (like `createBudgetChecked`); write returned
  authoritative rows to cache; advance the `budgets` + `budgetAllocations` cursors/sentinels.
- **Store/UI:** replace the per-row loop in `crudSlice.setBudgetAllocations` and the two-call site in
  `BudgetFormModal.save()` with a single awaited `upsertBudgetWithAllocations(...)`. Keep the optimistic local
  echo for UX, but durability now depends on the awaited online write, not a background flush.
- **Local-only mode** (no Supabase env): client transaction equivalent so offline behavior is unchanged.

## Phase 2 — Either-device edit + real-time (requirement b)

- Realtime already covers both tables (`realtime.ts` subscribes `budgets` + `budget_allocations`; migration
  `20260617120000_v950` adds both to `supabase_realtime`). **No new subscription** — once Phase 1 guarantees
  rows reach the cloud, realtime broadcasts them.
- **RLS decision — Option A (locked):** tighten `budget_allocations` `insert` / `update` / `delete` policies
  from `role_in(household_id) = any(array['owner','admin','member'])` to `= any(array['owner','admin'])` to
  match the v9.5.0 client gate (`assertCanManageBudgets`). Keep `balloc_read` as `is_member` so members keep
  **view-only** access. The new RPC also enforces owner/admin. Tighten the `budgets` write policies to
  owner/admin if they still allow member.
- **Concurrent edit:** row-level last-writer-wins on the awaited RPC (not OT/CRDT — documented limitation).

## Phase 3 — Surface silent failures + close landmines

- Wire the existing `pendingConflictCount` / `recordFailed` infra into a visible indicator (reuse the dev
  `FaultsPanel` pattern) so a future dropped write is never invisible again.
- Fix `replaceAll('budgetAllocations')` in `supabaseAdapter.ts` (~L787): it soft-deletes **all** household
  allocations (`.eq('household_id', hid)`) instead of scoping to `budget_id` — a data-loss footgun. Scope it
  to `budget_id`, or remove it (likely dead code after Phase 1).
- Relax the `.catch(() => [])` swallow on the `budgetAllocations` read in `dataSlice.refresh` (L250, L327) so
  a real read failure degrades visibly instead of rendering empty allocations.

## Phase 4 — Regression containment (run after the fix lands)

- **Money-model gate:** `lib/__tests__/moneyModel.{invariants,regression,engines}.test.ts` stays green;
  budgets are spend-neutral containers — do **not** touch the aggregation snapshot.
- **Budget identity:** `uq_budget_month` / `uq_budget_annual` + `BUDGET_EXISTS` still fire on a taken slot via
  the new RPC (create mode); delete + recreate still replaces.
- **Cache no-clobber:** `applyCloudList` empty-response sentinel + delta cursors for `budgets` and
  `budgetAllocations` still hold after the new write path seeds them.
- **RLS/advisors:** after any DDL run `get_advisors`; validate the new RPC against a real household inside a
  single rolled-back `DO` block with an impersonated authed member.
- **Local-only mode** + **soft-delete tombstone** propagation still work.

---

## Relevant files

- `supabase/migrations/<new>.sql` — `upsert_budget_with_allocations` RPC + Option A RLS tightening
- `react/src/lib/supabaseAdapter.ts` — RPC wrapper; fix `replaceAll` scope leak (~L787)
- `react/src/lib/hybridAdapter.ts` — online-sync route + cursor/sentinel seeding
- `react/src/lib/dataAdapter.ts` — extend `DataAdapter` interface
- `react/src/store/slices/crudSlice.ts` — replace per-row `setBudgetAllocations` loop (L79–96)
- `react/src/store/slices/dataSlice.ts` — relax `.catch(() => [])` swallow (L250, L327)
- `react/src/components/budgets/BudgetFormModal.tsx` — single atomic save call (L161–175)
- `react/src/lib/realtime.ts` — verify only (already covers both tables)

## Verification (acceptance gates)

1. Two-context manual: mobile create budget + allocations → desktop sees **both** within the realtime
   debounce window, no cache purge. Repeat desktop create → mobile read.
2. Either-device edit: change a category limit on device A → device B reflects it in real time.
3. Supabase direct query confirms parent + all child rows present immediately after a single save.
4. Forced offline mobile save then reconnect: children still land (atomic online write, or visibly queued
   with a surfaced indicator — never silently dropped).
5. `npm run test` green, money-model suites unchanged; `get_advisors` clean after DDL.

## Decisions

- **Dropped** prior Phases 1–2 (already shipped v9.5.1) — documented so no one re-does them.
- **Root cause re-pointed** from "`uid()` bypass" (false for v9.5.1) to "async-queue child-write asymmetry +
  silent dead-letter".
- **Primary fix** = atomic server RPC; realtime is already wired (no new subscription).
- **Phase 2.2 — Option A (locked):** tighten `budget_allocations` RLS to owner/admin; members view-only.
- **Excluded:** OT/CRDT realtime conflict merging (row-level last-writer-wins is acceptable for
  container + limit data); changing the budget identity model / unique constraints.
