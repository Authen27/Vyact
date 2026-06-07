import { describe, it, expect } from 'vitest';
import {
  computeAccountBalance, reconcileAccount, accountValueOf, ADJUSTMENT_CATEGORY,
} from '../accountBalance';
import { copyBudgets, suggestBudget, budgetHistory, budgetRollup } from '../budgetIntel';
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

  it('CON-UNIT-MM-112 · budgetRollup nests category budgets under monthly/annual totals', () => {
    // a monthly 400 + an annual 1200 (→ 100/mo) roll up to 500/mo, 6000/yr.
    const r = budgetRollup([
      { category: 'food', limitBase: 400, period: 'monthly' },
      { category: 'insurance', limitBase: 1200, period: 'annual' },
    ]);
    expect(r.monthlyTotal).toBe(500);
    expect(r.annualTotal).toBe(6000);
    expect(r.children.find(c => c.category === 'insurance')?.monthly).toBe(100);
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

// (Epic 3 goals/tax-as-lenses tests removed — goals & tax are no longer modules.)

// ── R7 — provenance lifecycle: estimated → confirmed ────────────────────────────
describe('provenance lifecycle (R7/C4.4)', () => {
  it('CON-UNIT-MM-130 · an estimate is flagged until confirmed; reconcile confirms it', async () => {
    const { isEstimate, confirmedPctFromEntities, onboardingProvenance } = await import('../onboardingState');
    const est = onboardingProvenance();                 // estimated / onboarding
    expect(isEstimate(est)).toBe(true);
    expect(confirmedPctFromEntities([est])).toBe(0);
    // reconciliation marks the value confirmed (what the store does post-reconcile)
    const confirmed = { confidence: 'confirmed' as const, source: 'user' as const, confirmedAt: new Date().toISOString() };
    expect(isEstimate(confirmed)).toBe(false);
    expect(confirmedPctFromEntities([confirmed])).toBe(100);
    // a reconcile adjustment is itself a confirmed, user-sourced correction
    const { adjustment } = reconcileAccount('cash', 1000, 1200, 'USD');
    expect(adjustment?.confidence).toBe('confirmed');
    expect(adjustment?.source).toBe('user');
  });
});
