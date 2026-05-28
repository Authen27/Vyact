// Currency formatting · date formatting · misc
import { CURRENCIES, DEFAULT_RATES } from '../constants';
import { toDinero, fromDinero, convertViaUsdRates } from './money';

export const today = (): string => new Date().toISOString().split('T')[0];

// IDs must be valid UUIDs: the cloud schema's primary-key columns are `uuid`,
// so a non-UUID id (the old Date.toString(36)+Math.random() scheme) made every
// locally-created record fail to sync to Supabase with `22P02 invalid input
// syntax for type uuid`. crypto.randomUUID() is available in all modern
// browsers in a secure context (incl. localhost); the manual fallback covers
// the rare non-secure / old-runtime case and is still RFC-4122 v4 shaped.
export const uid = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  // RFC-4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
export const escHtml = (s: string): string =>
  String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const getMonthKey = (d: string): string => d.slice(0, 7);
export const nowMonthKey = (): string => today().slice(0, 7);

export function monthName(key: string): string {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' });
}

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

/**
 * Multi-currency conversion using a USD-base rate table.
 *
 * TD-01 phase A: this function previously did `(amount / rFrom) * rTo` on
 * raw JS floats, which drifted across round-trips and across aggregations.
 * It now routes the math through dinero.js — the input/output signature is
 * unchanged (number → number, major units) so no caller needs to change,
 * but the conversion itself is exact integer arithmetic with banker's
 * rounding at the FX boundary. See `react/src/lib/money.ts` for the
 * dinero plumbing and `CON-UNIT-006` for the regression test that pins
 * the fixed behaviour.
 */
export function convert(amount: number, from: string, to: string, rates: Record<string, number> = DEFAULT_RATES): number {
  if (!amount || from === to) return amount;
  return fromDinero(convertViaUsdRates(toDinero(amount, from), to, rates));
}

export function fmt(amount: number, currency = 'USD'): string {
  const cur = CURRENCIES[currency] ?? CURRENCIES.USD;
  const n = Math.abs(amount || 0);
  try {
    return new Intl.NumberFormat(cur.locale, {
      style: 'currency', currency,
      minimumFractionDigits: cur.decimals,
      maximumFractionDigits: cur.decimals,
    }).format(n);
  } catch {
    return cur.symbol + n.toLocaleString('en-US', { minimumFractionDigits: cur.decimals, maximumFractionDigits: cur.decimals });
  }
}

export function fmtShort(amount: number, currency = 'USD'): string {
  const cur = CURRENCIES[currency] ?? CURRENCIES.USD;
  const n = Math.abs(amount || 0);
  if (n >= 1_000_000_000) return cur.symbol + (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return cur.symbol + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return cur.symbol + (n / 1_000).toFixed(1) + 'K';
  return cur.symbol + n.toLocaleString(cur.locale, { maximumFractionDigits: 0 });
}

export const fmtSigned = (n: number, currency = 'USD'): string =>
  (n >= 0 ? '+' : '−') + fmt(Math.abs(n), currency);

export function formatDate(dateStr: string, format: 'us' | 'eu' | 'iso' = 'us'): string {
  if (!dateStr) return '';
  if (format === 'iso') return dateStr;
  const d = new Date(dateStr + 'T12:00:00');
  if (format === 'eu') return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}
