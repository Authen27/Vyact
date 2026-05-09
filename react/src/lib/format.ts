// Currency formatting · date formatting · misc
import { CURRENCIES, DEFAULT_RATES } from '../constants';

export const today = (): string => new Date().toISOString().split('T')[0];
export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2);
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

export function convert(amount: number, from: string, to: string, rates: Record<string, number> = DEFAULT_RATES): number {
  if (!amount || from === to) return amount;
  const rFrom = rates[from] ?? 1;
  const rTo = rates[to] ?? 1;
  return (amount / rFrom) * rTo;
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
  if (n >= 1_000_000) return cur.symbol + (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 10_000)    return cur.symbol + (n / 1_000).toFixed(1) + 'K';
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
