import { describe, it, expect } from 'vitest';
import {
  reportableTxns, effectiveAmount, monthlyData, totalBalance,
  spendByCategory, totalAssets, totalLiabilities, liquidAssets,
  computePulseScore, splitsOutstanding,
} from '../calculations';
import { DEFAULT_RATES } from '../../constants';
import type { Transaction, Budget, Goal, Debt, Asset } from '../../types';

// Test scenarios CON-UNIT-012..026. See docs/TEST_SCENARIOS.md.

const R = DEFAULT_RATES;
const USD = 'USD';

function txn(over: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    type: 'expense',
    amount: 0,
    currency: 'USD',
    date: '2026-05-10',
    description: 'x',
    category: 'general',
    ...over,
  };
}

describe('reportableTxns', () => {
  it('CON-UNIT-012 · excludes private/excluded txns and isolates investment + transfer', () => {
    const txns = [
      txn({ type: 'income', amount: 100 }),
      txn({ type: 'expense', amount: 40 }),
      txn({ type: 'expense', amount: 999, excluded: true }), // private
      txn({ type: 'investment', amount: 500 }),              // isolated
      txn({ type: 'transfer', amount: 300 }),                // isolated
    ];
    const r = reportableTxns(txns);
    expect(r).toHaveLength(2);
    expect(r.every(t => t.type === 'income' || t.type === 'expense')).toBe(true);
    expect(r.some(t => t.excluded)).toBe(false);
  });
});

describe('effectiveAmount', () => {
  it('CON-UNIT-013 · uses the full amount for non-split txns', () => {
    expect(effectiveAmount(txn({ amount: 100 }), USD, R)).toBeCloseTo(100, 10);
  });
  it('CON-UNIT-014 · uses only yourShare for a split txn', () => {
    const t = txn({
      amount: 120,
      split: { isSplit: true, totalAmount: 120, yourShare: 40, paidBy: 'me', participants: [] },
    });
    expect(effectiveAmount(t, USD, R)).toBeCloseTo(40, 10);
  });
  it('CON-UNIT-015 · converts a foreign-currency amount into base', () => {
    // 92 EUR → USD = (92 / 0.92) * 1 = 100
    expect(effectiveAmount(txn({ amount: 92, currency: 'EUR' }), USD, R)).toBeCloseTo(100, 8);
  });
});

describe('monthlyData', () => {
  const txns = [
    txn({ type: 'income', amount: 5000, date: '2026-05-01' }),
    txn({ type: 'expense', amount: 1200, date: '2026-05-15' }),
    txn({ type: 'expense', amount: 800, date: '2026-05-20' }),
    txn({ type: 'expense', amount: 9999, date: '2026-04-30' }), // different month
  ];
  it('CON-UNIT-016 · sums income/expense within the month and computes net', () => {
    const d = monthlyData(txns, '2026-05', USD, R);
    expect(d.income).toBeCloseTo(5000, 10);
    expect(d.expense).toBeCloseTo(2000, 10);
    expect(d.net).toBeCloseTo(3000, 10);
  });
  it('CON-UNIT-017 · ignores transactions outside the requested month', () => {
    expect(monthlyData(txns, '2026-05', USD, R).expense).not.toBeCloseTo(11999, 1);
  });
});

describe('totalBalance', () => {
  it('CON-UNIT-018 · income adds, expense subtracts', () => {
    const txns = [
      txn({ type: 'income', amount: 1000 }),
      txn({ type: 'expense', amount: 250 }),
      txn({ type: 'expense', amount: 250 }),
    ];
    expect(totalBalance(txns, USD, R)).toBeCloseTo(500, 10);
  });
});

describe('spendByCategory', () => {
  it('CON-UNIT-019 · groups expense totals by category for the month', () => {
    const txns = [
      txn({ category: 'food', amount: 100 }),
      txn({ category: 'food', amount: 50 }),
      txn({ category: 'rent', amount: 900 }),
      txn({ type: 'income', category: 'salary', amount: 5000 }), // not an expense
    ];
    const s = spendByCategory(txns, '2026-05', USD, R);
    expect(s.food).toBeCloseTo(150, 10);
    expect(s.rent).toBeCloseTo(900, 10);
    expect(s.salary).toBeUndefined();
  });
});

describe('balance sheet helpers', () => {
  const assets: Asset[] = [
    { id: 'a1', type: 'cash', name: 'Checking', value: 10000, currency: 'USD', liquidity: 'liquid' },
    { id: 'a2', type: 'property', name: 'House', value: 300000, currency: 'USD', liquidity: 'long' },
  ];
  const debts: Debt[] = [
    { id: 'd1', type: 'mortgage', name: 'Home loan', principal: 250000, currentBalance: 200000, interestRate: 5, minimumPayment: 1170, currency: 'USD' },
  ];
  it('CON-UNIT-020 · totalAssets sums all asset values', () => {
    expect(totalAssets(assets, USD, R)).toBeCloseTo(310000, 10);
  });
  it('CON-UNIT-021 · liquidAssets sums only liquid assets', () => {
    expect(liquidAssets(assets, USD, R)).toBeCloseTo(10000, 10);
  });
  it('CON-UNIT-022 · totalLiabilities sums debt balances', () => {
    expect(totalLiabilities(debts, USD, R)).toBeCloseTo(200000, 10);
  });
});

describe('computePulseScore', () => {
  it('CON-UNIT-023 · returns a total in [0,100] with all five components present', () => {
    const txns = [
      txn({ type: 'income', amount: 5000, date: '2026-05-01' }),
      txn({ type: 'expense', amount: 2000, date: '2026-05-10' }),
    ];
    const budgets: Budget[] = [{ id: 'b1', category: 'general', limit: 3000, currency: 'USD' }];
    const goals: Goal[] = [{ id: 'g1', type: 'savings', name: 'Fund', target: 10000, current: 5000, currency: 'USD', completed: false }];
    const debts: Debt[] = [];
    const p = computePulseScore(txns, budgets, goals, debts, USD, R);
    expect(p.total).toBeGreaterThanOrEqual(0);
    expect(p.total).toBeLessThanOrEqual(100);
    expect(Object.keys(p.components).sort()).toEqual(['budget', 'debt', 'goals', 'savings', 'trend']);
  });
  it('CON-UNIT-024 · higher debt-to-income lowers the debt component', () => {
    const lowDtiTxns = [txn({ type: 'income', amount: 10000, date: '2026-05-01' })];
    const highDebt: Debt[] = [{ id: 'd', type: 'loan', name: 'L', principal: 0, currentBalance: 5000, interestRate: 10, minimumPayment: 6000, currency: 'USD' }];
    const noDebt: Debt[] = [];
    const high = computePulseScore(lowDtiTxns, [], [], highDebt, USD, R);
    const none = computePulseScore(lowDtiTxns, [], [], noDebt, USD, R);
    expect(high.components.debt).toBeLessThan(none.components.debt);
  });
});

describe('splitsOutstanding', () => {
  it('CON-UNIT-025 · tallies amounts owed TO you when you paid', () => {
    const t = txn({
      amount: 120,
      split: {
        isSplit: true, totalAmount: 120, yourShare: 40, paidBy: 'me',
        participants: [
          { name: 'me', isYou: true, share: 40, paid: true },
          { name: 'Alex', share: 40, paid: false },
          { name: 'Sam', share: 40, paid: false },
        ],
      },
    });
    const r = splitsOutstanding([t], USD, R);
    expect(r.owedToYou).toBeCloseTo(80, 10);
    expect(r.youOwe).toBeCloseTo(0, 10);
    expect(r.owedDetails).toHaveLength(2);
  });
  it('CON-UNIT-026 · tallies what YOU owe when someone external paid', () => {
    const t = txn({
      amount: 90,
      split: {
        isSplit: true, totalAmount: 90, yourShare: 30, paidBy: 'external',
        participants: [
          { name: 'me', isYou: true, share: 30, paid: false },
          { name: 'Jordan', share: 60, paid: true },
        ],
      },
    });
    const r = splitsOutstanding([t], USD, R);
    expect(r.youOwe).toBeCloseTo(30, 10);
    expect(r.owedToYou).toBeCloseTo(0, 10);
  });
});
