import { describe, it, expect } from 'vitest';
import {
  computeAccountBalance, reconcileAccount, accountValueOf, ADJUSTMENT_CATEGORY,
} from '../accountBalance';
import { copyBudgets, suggestBudget, budgetHistory, rollupAllocations } from '../budgetIntel';
import { goalProgress, goalContributesToNetWorth, GOAL_TAG } from '../goalsLens';
import { computeTaxNudge } from '../taxNudge';
import { reportableTxns, monthlyData } from '../calculations';
import type {
  Transaction, Budget, Debt, Goal, Asset, Account, RecurringSchedule, ExchangeRates,
} from '../../types';

// CON-UNIT-MM-100..0xx — Money-Model engine tests (Epics 1–3). Pure functions;
// every figure folds over real data (Part A: services compute, never templates).

const R: ExchangeRates = { USD: 1 };
const MK = new Date().toISOString().slice(0, 7);
const d = (day: string) => `${MK}-${day}`;

// ── Epic 1: account balances + reconciliation ───────────────────────────────────
describe('accountBalance — real, finite balances (A3)', () => {
  const txns: Transaction[] = [
    { id: '1', type: 'income',  amount: 1000, currency: 'USD', date: d('01'), description: '', category: 'salary',   accountId: 'cash' },
    { id: '2', type: 'expense', amount: 200,  currency: 'USD', date: d('02'), description: '', category: 'food',     accountId: 'cash' },
    { id: '3', type: 'transfer',amount: 300,  currency: 'USD', date: d('03'), description: '', category: 'transfer', accountId: 'cash', toAccountId: 'asset:bank1' },
  ];

  it('CON-UNIT-MM-100 · balance = opening + credits − debits across types', () => {
    // cash: opening 500 + 1000 income − 200 expense − 300 transfer-out = 1000
    expect(computeAccountBalance('cash', 500, txns, 'USD', R)).toBe(1000);
    // bank1: opening 0 + 300 transfer-in = 300
    expect(computeAccountBalance('asset:bank1', 0, txns, 'USD', R)).toBe(300);
  });

  it('CON-UNIT-MM-101 · accountValueOf encodes kinds to the legacy paymentMethod scheme', () => {
    expect(accountValueOf({ id: 'a', kind: 'cash', name: 'Cash', currency: 'USD' } as Account)).toBe('cash');
    expect(accountValueOf({ id: 'a', kind: 'checking', name: 'C', currency: 'USD', assetId: 'x' } as Account)).toBe('asset:x');
    expect(accountValueOf({ id: 'a', kind: 'credit_card', name: 'V', currency: 'USD', assetId: 'd1' } as Account)).toBe('debt:d1');
  });

  it('CON-UNIT-MM-102 · reconciliation writes an adjustment, never overwrites (B1.3/R4)', () => {
    // computed 1000, user says real is 1100 → +100 income adjustment.
    const up = reconcileAccount('cash', 1000, 1100, 'USD');
    expect(up.delta).toBe(100);
    expect(up.adjustment?.type).toBe('income');
    expect(up.adjustment?.amount).toBe(100);
    expect(up.adjustment?.category).toBe(ADJUSTMENT_CATEGORY);
    // real lower → expense adjustment
    const down = reconcileAccount('cash', 1000, 900, 'USD');
    expect(down.adjustment?.type).toBe('expense');
    // already reconciled → no adjustment
    expect(reconcileAccount('cash', 1000, 1000, 'USD').adjustment).toBeNull();
  });

  it('CON-UNIT-MM-103 · adjustments never pollute spend/income totals but DO move balance', () => {
    const { adjustment } = reconcileAccount('cash', 1000, 1100, 'USD');
    const withAdj = [...txns, adjustment as Transaction];
    // reportable totals exclude the adjustment category
    expect(reportableTxns(withAdj).some(t => t.category === ADJUSTMENT_CATEGORY)).toBe(false);
    const m = monthlyData(withAdj, MK, 'USD', R);
    expect(m.income).toBe(1000);   // unchanged by the +100 adjustment
    // but the balance reflects it: 1000 + 100 = 1100
    expect(computeAccountBalance('cash', 500, withAdj, 'USD', R)).toBe(1100);
  });
});

// ── Epic 2: budget intelligence ─────────────────────────────────────────────────
describe('budgetIntel — read-only inference (A8)', () => {
  it('CON-UNIT-MM-110 · copyBudgets clones category + limit without ids', () => {
    const out = copyBudgets([{ id: 'b1', category: 'food', limit: 400, currency: 'USD' }]);
    expect(out).toEqual([{ category: 'food', limit: 400, currency: 'USD', period: 'monthly' }]);
    expect((out[0] as { id?: string }).id).toBeUndefined();
  });

  it('CON-UNIT-MM-111 · suggestBudget proposes from recurring + debts + goals, traceably', () => {
    const recurring: RecurringSchedule[] = [
      { id: 'r1', frequency: 'monthly', startDate: d('01'), nextDueDate: d('01'),
        transactionTemplate: { type: 'expense', amount: 1200, currency: 'USD', description: '', category: 'rent' } as Omit<Transaction,'id'|'date'> },
    ];
    const debts: Debt[] = [{ id: 'd1', type: 'loan', name: 'L', principal: 0, currentBalance: 5000, interestRate: 8, minimumPayment: 250, currency: 'USD' }];
    const goals: Goal[] = [{ id: 'g1', type: 'savings', name: 'Trip', target: 1200, current: 0, currency: 'USD', completed: false }];
    const s = suggestBudget({ transactions: [], debts, goals, recurring, baseCurrency: 'USD', rates: R });
    expect(s.find(x => x.category === 'rent')).toMatchObject({ limit: 1200, basis: 'recurring' });
    expect(s.find(x => x.category === 'debt_payment')).toMatchObject({ limit: 250, basis: 'debt' });
    expect(s.find(x => x.category === 'savings')?.basis).toBe('goal');
  });

  it('CON-UNIT-MM-112 · rollupAllocations flags over-allocation transparently', () => {
    expect(rollupAllocations(1000, [400, 300])).toEqual({ parentLimit: 1000, allocated: 700, unallocated: 300, overAllocated: false });
    expect(rollupAllocations(1000, [700, 400]).overAllocated).toBe(true);
  });

  it('CON-UNIT-MM-113 · budgetHistory reports budget vs actual per month', () => {
    const txns: Transaction[] = [
      { id: '1', type: 'expense', amount: 350, currency: 'USD', date: d('05'), description: '', category: 'food' },
    ];
    const hist = budgetHistory(txns, [{ id: 'b', category: 'food', limit: 400, currency: 'USD' }], 'USD', R, 6);
    const cur = hist.find(h => h.monthKey === MK)!;
    expect(cur.budgeted).toBe(400);
    expect(cur.actual).toBe(350);
    expect(cur.variance).toBe(50);   // saved 50
  });
});

// ── Epic 3: goals & tax as lenses ───────────────────────────────────────────────
describe('goalsLens + taxNudge — lenses, not containers (A4/A5/R3)', () => {
  const accounts: Account[] = [
    { id: 'sav', kind: 'savings', name: 'Savings', currency: 'USD', assetId: 'sav', openingBalance: 2000 },
  ];

  it('CON-UNIT-MM-120 · virtual goal counts tagged contributions, contributes 0 to Net Worth', () => {
    const goal: Goal = { id: 'g1', type: 'savings', name: 'Trip', target: 1000, current: 0, currency: 'USD', completed: false };
    const txns: Transaction[] = [
      { id: 't1', type: 'expense', amount: 300, currency: 'USD', date: d('02'), description: '', category: 'savings', note: GOAL_TAG('g1') },
    ];
    const p = goalProgress(goal, txns, accounts, 'USD', R);
    expect(p.current).toBe(300);
    expect(p.backed).toBe(false);
    expect(goalContributesToNetWorth(goal)).toBe(false);
  });

  it('CON-UNIT-MM-121 · real-backed goal reads the linked account balance and IS an asset', () => {
    const goal = { id: 'g2', type: 'savings', name: 'House', target: 5000, current: 0, currency: 'USD', completed: false, linkedAccountId: 'sav' };
    const txns: Transaction[] = [
      { id: 't1', type: 'income', amount: 500, currency: 'USD', date: d('02'), description: '', category: 'salary', accountId: 'asset:sav' },
    ];
    const p = goalProgress(goal, txns, accounts, 'USD', R);
    expect(p.current).toBe(2500);   // opening 2000 + 500 in
    expect(p.backed).toBe(true);
    expect(goalContributesToNetWorth(goal)).toBe(true);
  });

  it('CON-UNIT-MM-122 · tax nudge derives owed from income and reads reserve balance', () => {
    const accts: Account[] = [{ id: 'tax', kind: 'savings', name: 'Tax Reserve', currency: 'USD', assetId: 'tax', openingBalance: 0 }];
    const txns: Transaction[] = [
      { id: 'i1', type: 'income', amount: 10000, currency: 'USD', date: d('01'), description: '', category: 'freelance' },
      { id: 'r1', type: 'transfer', amount: 1500, currency: 'USD', date: d('02'), description: '', category: 'transfer', toAccountId: 'asset:tax' },
    ];
    const n = computeTaxNudge({ transactions: txns, accounts: accts, effectiveRate: 0.2, baseCurrency: 'USD', rates: R });
    expect(n.estimated).toBe(2000);   // 10000 × 0.2
    expect(n.reserved).toBe(1500);    // transfer into the reserve
    expect(n.shortfall).toBe(500);
    expect(n.hasReserve).toBe(true);
  });

  it('CON-UNIT-MM-123 · no tax reserve account → hasReserve false, reserved 0', () => {
    const n = computeTaxNudge({ transactions: [], accounts: [], effectiveRate: 0.2, baseCurrency: 'USD', rates: R });
    expect(n.hasReserve).toBe(false);
    expect(n.reserved).toBe(0);
  });
});
