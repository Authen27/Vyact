// Vyact — Money-Model Epic 1: real account balances + reconciliation.
//
// vyact-money-model-execution-and-regression.md, Part A:
//   A2 — every transaction moves an account.
//   A3 — balance = opening_balance + credits − debits (a real, finite number).
//   B1.3 — reconciliation writes a dated Balance Adjustment transaction, NEVER a
//          silent overwrite.
//
// Pure functions over the existing transaction encoding (paymentMethod /
// linkedToAssetId / account_id FK). No money is invented here — balances are a
// fold over real transactions. These helpers are pure and the money model is now
// a permanent part of the app.

import type { Transaction, Account } from '../types';
import { effectiveAmount } from './calculations';
import type { ExchangeRates } from '../types';
import { uid, today } from './format';

/** The system Cash account value (matches the legacy paymentMethod scheme). */
export const CASH_ACCOUNT_VALUE = 'cash';
/** Category used for reconciliation Balance Adjustment entries. */
export const ADJUSTMENT_CATEGORY = 'balance_adjustment';

/** The account value a transaction's money LEAVES from (its funding source). */
export function debitAccountOf(t: Transaction): string | undefined {
  // Prefer the Money Map FK, fall back to the legacy paymentMethod/linkedAssetId.
  return t.accountId ?? t.paymentMethod ?? t.linkedAssetId ?? undefined;
}

/** The account value a transfer's money ARRIVES into (destination), if any. */
export function creditAccountOf(t: Transaction): string | undefined {
  return t.toAccountId ?? t.linkedToAssetId ?? undefined;
}

/**
 * Compute an account's current balance: opening + credits − debits (A3).
 * Considers every transaction that touches the account:
 *   • income into it      → credit
 *   • expense from it      → debit
 *   • transfer            → debit the source account, credit the destination
 * `accountValue` is the encoded account key (e.g. 'cash', 'asset:<id>').
 */
export function computeAccountBalance(
  accountValue: string,
  openingBalance: number,
  txns: Transaction[],
  baseCurrency: string,
  rates: ExchangeRates,
): number {
  let bal = openingBalance;
  for (const t of txns) {
    // Balance reflects real money movement, so excluded-from-reports txns still
    // count here (the money did move). Only reports/budgets honour `excluded`.
    const amt = effectiveAmount(t, baseCurrency, rates);
    if (t.type === 'income' && debitAccountOf(t) === accountValue) {
      bal += amt;
    } else if (t.type === 'expense' && debitAccountOf(t) === accountValue) {
      bal -= amt;
    } else if (t.type === 'transfer') {
      if (debitAccountOf(t) === accountValue) bal -= amt;     // money leaves source
      if (creditAccountOf(t) === accountValue) bal += amt;    // money enters dest
    }
  }
  return Math.round(bal * 100) / 100;
}

/** Map an Account entity to its encoded transaction key (see buildAccountsFromStore). */
export function accountValueOf(account: Account): string {
  if (account.kind === 'cash') return CASH_ACCOUNT_VALUE;
  if (account.kind === 'credit_card') return `debt:${account.assetId || account.id}`;
  return `asset:${account.assetId || account.id}`;
}

export interface ReconcileResult {
  /** The dated Balance Adjustment transaction to persist (null when no delta). */
  adjustment: Partial<Transaction> | null;
  delta: number;
}

/**
 * B1.3 — reconcile an account to a user-stated real balance by emitting a dated
 * Balance Adjustment transaction for the delta. NEVER mutates the balance
 * directly; the adjustment is a normal account-bound transaction so it respects
 * A2 and shows in the ledger. Returns null adjustment when already reconciled.
 *
 * A positive delta (real > computed) books as income into the account; a negative
 * delta books as an expense from it.
 */
export function reconcileAccount(
  accountValue: string,
  computedBalance: number,
  realBalance: number,
  currency: string,
): ReconcileResult {
  const delta = Math.round((realBalance - computedBalance) * 100) / 100;
  if (delta === 0) return { adjustment: null, delta: 0 };
  const adjustment: Partial<Transaction> = {
    id: uid(),
    type: delta > 0 ? 'income' : 'expense',
    amount: Math.abs(delta),
    currency,
    date: today(),
    description: 'Balance adjustment',
    category: ADJUSTMENT_CATEGORY,
    accountId: accountValue,
    paymentMethod: accountValue,
    // adjustments are confirmed corrections, not estimates
    confidence: 'confirmed',
    source: 'user',
    note: '__recon',
  };
  return { adjustment, delta };
}
