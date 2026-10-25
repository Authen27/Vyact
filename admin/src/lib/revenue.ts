// W8c (audit ADM-14) — revenue KPIs per currency. MRR used to sum every active row's monthly_amount across
// currencies and label the total "USD" (₹999 + $12 = "$1,011"). It counts active and trialing
// subscriptions (the audit's rule) and keeps each currency apart; nothing is converted.
import type { AdminSubscriptionRow } from './adminApi';

export interface CurrencyRevenue { currency: string; mrr: number; arr: number }

const COUNTED: ReadonlySet<AdminSubscriptionRow['status']> = new Set(['active', 'trialing']);

export function revenueByCurrency(rows: readonly Pick<AdminSubscriptionRow, 'status' | 'monthly_amount' | 'currency'>[]): CurrencyRevenue[] {
  const byCur = new Map<string, number>();
  for (const r of rows) {
    if (!COUNTED.has(r.status)) continue;
    const cur = (r.currency || '').trim().toUpperCase() || '?';
    byCur.set(cur, (byCur.get(cur) ?? 0) + Number(r.monthly_amount || 0));
  }
  return [...byCur.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, mrr]) => ({ currency, mrr: Math.round(mrr * 100) / 100, arr: Math.round(mrr * 12 * 100) / 100 }));
}

/** "INR 999 · USD 12" — or "—" with nothing counted. */
export function revenueLabel(list: CurrencyRevenue[], pick: 'mrr' | 'arr'): string {
  if (!list.length) return '—';
  return list.map(r => `${r.currency} ${r[pick].toLocaleString('en-US', { maximumFractionDigits: 2 })}`).join(' · ');
}

/** v1.5.0 (ADM-14): the dashboard's per-currency MRR (admin_dashboard_kpis().mrrByCurrency) as the same list. */
export function revenueFromMap(byCurrency: Record<string, number> | null | undefined): CurrencyRevenue[] {
  return Object.entries(byCurrency ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, n]) => {
      const mrr = Math.round(Number(n || 0) * 100) / 100;
      return { currency, mrr, arr: Math.round(mrr * 12 * 100) / 100 };
    });
}
