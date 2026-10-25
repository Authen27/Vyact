// Vyact — what a split does to the accounts (v10.134.0, Track Q6; audit FE-MNY-08; owner decision 20 Oct 2026: "full
// debit + Owed to you; settling records the money into a chosen account").
//
// A split used to debit only YOUR share from the account that paid the whole bill, so that account and its
// reconciliation drifted by everyone else's share. A NEW split you paid (`split.fullDebit`, set by the Split form on
// create) now:
//   • debits the paying account by the FULL bill (ledgerDebit);
//   • counts your share only as spending (effectiveAmount / reportableTxns, unchanged);
//   • makes the others' unpaid shares "Owed to you" (owedToYou): an asset in Net Worth, liquidity 'short', never
//     liquid, never free to spend;
//   • when someone pays you back, records the account it came into on their share (`paidInto`, `paidOn`): that
//     account rises by the share and Owed to you falls by it (splitReceipts). No income row: a repayment is not income.
// So at creation net worth and spending are what the share-only model gave; settling moves money and nothing else.
// Splits made before keep their share-only debit and owe nothing here. The server folds the same rule
// (split_full_debit / account_ledger_balance, migration 20261112120000), and the bundled engine reads this module.
import type { Transaction } from '../types';

/** A split you paid whose paying account carries the whole bill (new since v10.134.0). */
export function isFullDebitSplit(t: Pick<Transaction, 'type' | 'split'>): boolean {
  return t.type === 'expense' && t.split?.isSplit === true && t.split.fullDebit === true && t.split.paidBy === 'me';
}

/** What a transaction takes from the account it is paid from, or null to use the usual (effective) amount. */
export function ledgerDebit(t: Pick<Transaction, 'type' | 'split' | 'amount'>): number | null {
  return isFullDebitSplit(t) ? Math.round(t.amount * 100) / 100 : null;
}

export interface SplitReceipt { txnId: string; name: string; accountId: string; amount: number; date: string }

/** The repayments recorded on a full-debit split: each paid share with the account it came back into. A paid share
 *  that names no account came back into the account the bill was paid from, so a paid share never leaves net worth. */
export function splitReceipts(t: Pick<Transaction, 'id' | 'type' | 'split' | 'date' | 'accountId' | 'paymentMethod'>): SplitReceipt[] {
  if (!isFullDebitSplit(t)) return [];
  const paidFrom = t.accountId ?? t.paymentMethod;
  return (t.split!.participants ?? [])
    .filter(p => !p.isYou && p.paid && Number.isFinite(p.share) && !!(p.paidInto ?? paidFrom))
    .map(p => ({ txnId: t.id, name: p.name, accountId: (p.paidInto ?? paidFrom)!, amount: Math.round(p.share * 100) / 100, date: p.paidOn ?? t.date }));
}

export interface OwedShare { txnId: string; name: string; amount: number; description: string; date: string }

/** The others' unpaid shares of full-debit splits: money that left your account and is owed back. */
export function owedToYouShares(txns: Transaction[]): OwedShare[] {
  const out: OwedShare[] = [];
  for (const t of txns) {
    if (!isFullDebitSplit(t)) continue;
    for (const p of t.split!.participants ?? []) {
      if (p.isYou || p.paid || !Number.isFinite(p.share) || p.share <= 0) continue;
      out.push({ txnId: t.id, name: p.name, amount: Math.round(p.share * 100) / 100, description: t.description, date: t.date });
    }
  }
  return out;
}

/** Owed to you, in total. */
export function owedToYou(txns: Transaction[]): number {
  return Math.round(owedToYouShares(txns).reduce((s, x) => s + x.amount, 0) * 100) / 100;
}
