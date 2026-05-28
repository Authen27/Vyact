// FinFlow v6.4 — Budget period local metadata
//
// DEPRECATED: server-side `period` columns are being added in
// `supabase/migrations/20260524070000_budgets_add_period.sql`. Keep this
// file as a compatibility shim for a single release; it will be removed
// once the migration is applied and `db/schema.sql` regenerated.
//
// The production Supabase schema does not have an `extras` jsonb column on
// the `budgets` table, and we are committed to no production DB changes for
// this release. To deliver the budget-period feature without a migration we
// keep the period metadata in localStorage keyed by budget id and merge it
// onto Budget objects after they are loaded from the adapter.
//
// Limitation: period metadata is per-device. A future release will move
// this into the cloud once the schema migration is shipped.

import type { Budget, BudgetPeriod } from '../types';

interface Meta {
  period?: BudgetPeriod;
  periodStart?: string;
  periodEnd?: string;
}

const KEY = 'ff_budget_periods';

function readAll(): Record<string, Meta> {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; }
  catch { return {}; }
}

function writeAll(map: Record<string, Meta>): void {
  try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { /* noop */ }
}

export function getBudgetMeta(id: string): Meta {
  return readAll()[id] || {};
}

export function setBudgetMeta(id: string, meta: Meta): void {
  const all = readAll();
  // Strip undefined keys so we don't bloat storage.
  const clean: Meta = {};
  if (meta.period)      clean.period = meta.period;
  if (meta.periodStart) clean.periodStart = meta.periodStart;
  if (meta.periodEnd)   clean.periodEnd = meta.periodEnd;
  if (Object.keys(clean).length === 0) delete all[id];
  else                                  all[id] = clean;
  writeAll(all);
}

export function deleteBudgetMeta(id: string): void {
  const all = readAll();
  if (all[id]) { delete all[id]; writeAll(all); }
}

/** Merge stored period metadata onto Budget objects loaded from the adapter. */
export function hydrateBudgets(budgets: Budget[]): Budget[] {
  const all = readAll();
  return budgets.map(b => {
    const m = all[b.id];
    if (!m) return b.period ? b : { ...b, period: 'monthly' };
    return { ...b, ...m, period: m.period || b.period || 'monthly' };
  });
}
