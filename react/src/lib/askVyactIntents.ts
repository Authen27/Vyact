// Vyact v7.4.5 — Ask Vyact intent taxonomy
//
// Two-tap quick actions for the Chat surface. Each intent is a single tap-1
// chip the user can pick from the empty-state grid. If the intent has
// `secondary` chips it expands a tap-2 row that finalises the action; if
// not, the primary action fires immediately on tap-1.
//
// The four buckets map to the user's mental model:
//   • Capture  — record something that happened (Add ...)
//   • Inquire  — ask about current state (How much / what is ...)
//   • Plan     — decide / project (can-I-afford, what-if)
//   • Manage   — open / configure
//
// Actions are a typed union so the Chat page can dispatch deterministically:
//   - `open-modal` opens a global modal (optionally pre-seeded)
//   - `navigate`   pushes a route
//   - `ask`        falls through to the rule engine in askVyactBrain.ts,
//                  which itself can fall back to Gemini if a key is set.

import type { Transaction, TxnType } from '../types';

export type Bucket = 'capture' | 'inquire' | 'plan' | 'manage';

export type IntentAction =
  | { kind: 'open-modal'; modal: 'addTxn' | 'addGoal' | 'addBudget' | 'addDebt' | 'addAsset'; seed?: Partial<Transaction> }
  | { kind: 'navigate'; to: string }
  | { kind: 'ask'; prompt: string };

export interface SubChip {
  label: string;
  action: IntentAction;
}

export interface Intent {
  id: string;
  bucket: Bucket;
  label: string;
  /** When set, tapping the chip primes a sub-row of secondary chips. */
  secondary?: SubChip[];
  /** When `secondary` is absent, the chip fires this action on tap-1. */
  action?: IntentAction;
}

// Curated tap-2 chips for "Add expense" — top everyday categories. Stays a
// short list deliberately; we don't want a wall of buttons. Power users
// can still use the modal's category dropdown after the seed lands.
const EXPENSE_QUICK_CATS: SubChip[] = [
  { label: 'Groceries',     action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'expense' as TxnType, category: 'food' } } },
  { label: 'Fuel',          action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'expense' as TxnType, category: 'transport' } } },
  { label: 'Eating out',    action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'expense' as TxnType, category: 'food' } } },
  { label: 'Shopping',      action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'expense' as TxnType, category: 'shopping' } } },
  { label: 'Bills',         action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'expense' as TxnType, category: 'utilities' } } },
  { label: 'Other',         action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'expense' as TxnType, category: 'other_exp' } } },
];

const INCOME_QUICK_CATS: SubChip[] = [
  { label: 'Salary',        action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'income' as TxnType, category: 'salary' } } },
  { label: 'Freelance',     action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'income' as TxnType, category: 'freelance' } } },
  { label: 'Gift / Bonus',  action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'income' as TxnType, category: 'gift' } } },
  { label: 'Other',         action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'income' as TxnType, category: 'other_inc' } } },
];

export const INTENTS: Intent[] = [
  // ── Capture ─────────────────────────────────────────────────
  { id: 'add-expense',     bucket: 'capture', label: 'Add expense',      secondary: EXPENSE_QUICK_CATS },
  { id: 'add-income',      bucket: 'capture', label: 'Add income',       secondary: INCOME_QUICK_CATS },
  { id: 'add-transfer',    bucket: 'capture', label: 'Add transfer',     action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'transfer' as TxnType, category: 'transfer' } } },
  { id: 'add-investment',  bucket: 'capture', label: 'Add investment',   action: { kind: 'open-modal', modal: 'addTxn', seed: { type: 'investment' as TxnType, category: 'investment_in' } } },
  { id: 'add-goal',        bucket: 'capture', label: 'Add a goal',       action: { kind: 'open-modal', modal: 'addGoal' } },
  { id: 'add-budget',      bucket: 'capture', label: 'Add a budget',     action: { kind: 'open-modal', modal: 'addBudget' } },
  { id: 'add-debt',        bucket: 'capture', label: 'Add a debt',       action: { kind: 'open-modal', modal: 'addDebt' } },
  { id: 'add-asset',       bucket: 'capture', label: 'Add an asset',     action: { kind: 'open-modal', modal: 'addAsset' } },

  // ── Inquire ─────────────────────────────────────────────────
  { id: 'spend-month',     bucket: 'inquire', label: 'Spend this month', action: { kind: 'ask', prompt: 'How much did I spend this month?' } },
  { id: 'pulse',           bucket: 'inquire', label: 'Pulse Score',      action: { kind: 'ask', prompt: "What's my Pulse Score and why?" } },
  { id: 'net-worth',       bucket: 'inquire', label: 'Net worth',        action: { kind: 'ask', prompt: "What's my net worth?" } },
  { id: 'budgets-risk',    bucket: 'inquire', label: 'Budgets at risk',  action: { kind: 'ask', prompt: 'Which budgets are at risk?' } },
  { id: 'top-categories',  bucket: 'inquire', label: 'Top categories',   action: { kind: 'ask', prompt: 'What are my top spending categories this month?' } },
  { id: 'upcoming-bills',  bucket: 'inquire', label: 'Upcoming bills',   action: { kind: 'ask', prompt: 'What are my upcoming bills?' } },

  // ── Plan ────────────────────────────────────────────────────
  { id: 'emergency',       bucket: 'plan',    label: 'Emergency fund',   action: { kind: 'ask', prompt: 'How am I doing on my emergency fund?' } },
  { id: 'debts',           bucket: 'plan',    label: 'Debt strategy',    action: { kind: 'ask', prompt: 'Tell me about my debts and the best payoff strategy.' } },
  { id: 'goal-eta',        bucket: 'plan',    label: 'Goal ETA',         action: { kind: 'ask', prompt: 'When will I reach my biggest goal?' } },

  // ── Manage / Navigate ───────────────────────────────────────
  { id: 'open-budgets',    bucket: 'manage',  label: 'Open Budgets',     action: { kind: 'navigate', to: '/budgets' } },
  { id: 'open-networth',   bucket: 'manage',  label: 'Open Net Worth',   action: { kind: 'navigate', to: '/networth' } },
  { id: 'open-households',  bucket: 'manage', label: 'Open Households',  action: { kind: 'navigate', to: '/households' } },
];

export const BUCKET_LABEL: Record<Bucket, string> = {
  capture: 'Capture',
  inquire: 'Inquire',
  plan:    'Plan',
  manage:  'Manage',
};

export function intentsByBucket(bucket: Bucket): Intent[] {
  return INTENTS.filter(i => i.bucket === bucket);
}
