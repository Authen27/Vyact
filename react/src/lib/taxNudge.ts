// Vyact — Money-Model Epic 3 (B3.2): tax as a NUDGE, not an entity (A5).
//
// Tax owed is DERIVED from income + a simple rate. It is a number surfaced as a
// gentle nudge ("you'll likely owe ~X; you've set aside Y"). Money actually set
// aside is a transfer to a real "Tax Reserve" account (an asset already in Net
// Worth) — there is NO tax entity and NO phantom balance.
//
// Scope note (per spec): v1 is the reserve-account pattern + a simple estimate.
// Do not over-build a full tax engine. Pure + unit-tested; UI gates behind
// FEATURES.taxNudge.

import type { Transaction, Account, ExchangeRates } from '../types';
import { effectiveAmount } from './calculations';
import { getMonthKey } from './format';
import { computeAccountBalance, accountValueOf } from './accountBalance';

/** Heuristic name match for the user's Tax Reserve account. */
export const TAX_RESERVE_HINT = /tax\s*reserve/i;

export interface TaxNudge {
  /** Estimated tax owed over the window, derived from income × rate. */
  estimated: number;
  /** Amount currently sitting in the Tax Reserve account (0 if none). */
  reserved: number;
  /** estimated − reserved; positive = still to set aside. */
  shortfall: number;
  /** true when the user has a tax reserve account at all. */
  hasReserve: boolean;
}

/** Sum reportable income over the trailing `months` (default: this calendar year
 *  to date is overkill for v1 — we use a rolling window). */
function incomeOverMonths(txns: Transaction[], months: number, base: string, rates: ExchangeRates): number {
  const mks = [...new Set(txns.map(t => getMonthKey(t.date)))].sort().slice(-months);
  const set = new Set(mks);
  return txns
    .filter(t => t.type === 'income' && t.category !== 'transfer' && t.category !== 'balance_adjustment' && set.has(getMonthKey(t.date)))
    .reduce((s, t) => s + effectiveAmount(t, base, rates), 0);
}

/**
 * Compute the tax nudge. `effectiveRate` is a fraction (e.g. 0.2 for 20%). The
 * reserve is read from the named Tax Reserve account's real balance — never a
 * phantom number. Returns hasReserve=false when no such account exists, so the UI
 * can offer to create one + a "set aside for tax" transfer.
 */
export function computeTaxNudge(input: {
  transactions: Transaction[];
  accounts: Account[];
  effectiveRate: number;
  baseCurrency: string;
  rates: ExchangeRates;
  windowMonths?: number;
}): TaxNudge {
  const { transactions, accounts, effectiveRate, baseCurrency, rates, windowMonths = 12 } = input;
  const income = incomeOverMonths(transactions, windowMonths, baseCurrency, rates);
  const estimated = Math.max(0, Math.round(income * effectiveRate));

  const reserveAcc = accounts.find(a => TAX_RESERVE_HINT.test(a.name) && !a.isArchived);
  const reserved = reserveAcc
    ? Math.max(0, computeAccountBalance(accountValueOf(reserveAcc), reserveAcc.openingBalance ?? 0, transactions, baseCurrency, rates))
    : 0;

  return {
    estimated,
    reserved: Math.round(reserved),
    shortfall: Math.max(0, estimated - Math.round(reserved)),
    hasReserve: Boolean(reserveAcc),
  };
}
