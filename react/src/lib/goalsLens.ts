// Vyact — Money-Model Epic 3: goals & tax as LENSES, not containers.
//
// Principle A4/A5/R3 (the modeling decision, made concrete):
//   • A virtual goal is a target + a measured progress number. Progress is COUNTED
//     from tagged contributions; money never leaves the real account. It contributes
//     ZERO to Net Worth (no money has moved).
//   • A real goal points at a real savings account and reads its balance; it shows
//     in Net Worth as the account (once), because it is a real asset.
//   • NEVER a virtual sub-balance carved out of a real account (the forbidden
//     in-between).
//   • Tax is a calculation surfaced as a nudge — never an entity with a balance.
//
// Pure + unit-tested. UI gates behind FEATURES.goalsLens / FEATURES.taxNudge.

import type { Transaction, Goal, Account, ExchangeRates } from '../types';
import { effectiveAmount } from './calculations';
import { computeAccountBalance, accountValueOf } from './accountBalance';

/** A contribution to a virtual goal is tagged in the transaction note. */
export const GOAL_TAG = (goalId: string) => `__goal:${goalId}`;

/** Extra fields a goal may carry to opt into the real-account-backed model.
 *  Kept structural (not money) so a virtual goal holds nothing. */
export interface GoalLensMeta {
  /** When set, the goal is backed by this real account and reads its balance. */
  linkedAccountId?: string;
}

export interface GoalProgress {
  goalId: string;
  current: number;
  target: number;
  pct: number;          // 0–100
  backed: boolean;      // true = real-account-backed; false = virtual
}

/** Measure goal progress.
 *  • Real (linkedAccountId set): read the linked account's live balance.
 *  • Virtual: COUNT tagged contributions from transactions (note carries the goal
 *    tag). Money is never carved out of an account — this is a measurement only. */
export function goalProgress(
  goal: Goal & GoalLensMeta,
  txns: Transaction[],
  accounts: Account[],
  baseCurrency: string,
  rates: ExchangeRates,
): GoalProgress {
  let current: number;
  let backed = false;
  if (goal.linkedAccountId) {
    const acc = accounts.find(a => a.id === goal.linkedAccountId);
    if (acc) {
      current = computeAccountBalance(accountValueOf(acc), acc.openingBalance ?? 0, txns, baseCurrency, rates);
      backed = true;
    } else {
      current = goal.current; // linked account missing → fall back to stored progress
    }
  } else {
    const tag = GOAL_TAG(goal.id);
    const tagged = txns
      .filter(t => t.note?.includes(tag))
      .reduce((s, t) => s + effectiveAmount(t, baseCurrency, rates), 0);
    // Stored `current` (e.g. an onboarding seed) plus any tagged contributions.
    current = Math.round((goal.current + tagged) * 100) / 100;
  }
  const pct = goal.target > 0 ? Math.min(100, Math.round((current / goal.target) * 100)) : 0;
  return { goalId: goal.id, current, target: goal.target, pct, backed };
}

/** R3 — only real-account-backed goals are assets; virtual goals contribute ZERO
 *  to Net Worth (the money is still in the user's account and already counted). */
export function goalContributesToNetWorth(goal: Goal & GoalLensMeta): boolean {
  return Boolean(goal.linkedAccountId);
}
