// W8a (v10.82.0) — app fixes from the 2026-10-04 audit's open low/medium items. Each case is named after
// its finding. Vitest runs in node (no DOM): behaviour is pinned through pure helpers and, where a page
// must use them, through its source.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FULLY_TRANSLATED, languageOptionLabel } from '../i18n';
import { LOCALES } from '../../constants';
import { getInsights, recurringForecastByCategory } from '../calculations';
import { recurringForecastByCategory as portForecast } from '../../../../supabase/functions/_shared/money/calculations';
import type { Budget, BudgetAllocation, Transaction } from '../../types';

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('W8a · app fixes', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('W8a-MNY06-001 · Dashboard chips read this month\'s budget lines and the net-worth projection (FE-MNY-06)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    const txns = [
      { id: 'i', type: 'income', amount: 1000, currency: 'INR', date: '2026-10-01', category: 'salary', description: '' },
      { id: 'e', type: 'expense', amount: 150, currency: 'INR', date: '2026-10-05', category: 'food_dining', description: '' },
    ] as Transaction[];
    // A v9.1 container budget: no category of its own, the food limit lives in an allocation.
    const budgets = [{ id: 'b', limit: 500, currency: 'INR', scope: 'month', periodYear: 2026, periodMonth: 10 }] as Budget[];
    const allocations = [{ id: 'a', budgetId: 'b', category: 'food_dining', amount: 100 }] as BudgetAllocation[];
    // The old call saw no category on the container and reported nothing over.
    expect(getInsights(txns, budgets, [], [], [], 'INR', {}).some(c => /exceeded/.test(c.text))).toBe(false);
    const withCtx = getInsights(txns, budgets, [], [], [], 'INR', {}, { allocations, netWorth: 2500 });
    expect(withCtx.find(c => /exceeded/.test(c.text))?.text).toBe('1 budget exceeded');
    // Net worth comes from the projection (live accounts), not the empty static asset array.
    expect(withCtx.some(c => c.text === 'Net worth building')).toBe(true);
    expect(getInsights(txns, budgets, [], [], [], 'INR', {}, { allocations, netWorth: -10 }).some(c => /focus on payoff/.test(c.text))).toBe(true);
    expect(getInsights(txns, budgets, [], [], [], 'INR', {}, { allocations, netWorth: null }).some(c => /Net worth/.test(c.text))).toBe(false);
    // An annual line's limit is not a month's: never "exceeded" against one month of spending.
    const annual = [{ id: 'y', limit: 1200, currency: 'INR', scope: 'annual', periodYear: 2026 }] as Budget[];
    const annualAlloc = [{ id: 'ya', budgetId: 'y', category: 'food_dining', amount: 120 }] as BudgetAllocation[];
    expect(getInsights(txns, annual, [], [], [], 'INR', {}, { allocations: annualAlloc, netWorth: null }).some(c => /exceeded/.test(c.text))).toBe(false);
    expect(src('lib/selectors.ts')).toMatch(/getInsights\(transactions, budgets, goals, debts, assets, base, rates, \{ allocations, netWorth \}\)/);
  });

  it('W8a-MNY16-001 · the budget forecast skips paused schedules and loan EMIs, client and server alike (FE-MNY-16)', () => {
    const sched = [
      { transactionTemplate: { type: 'expense', amount: 300, currency: 'INR', category: 'utilities' }, frequency: 'monthly' },
      { transactionTemplate: { type: 'expense', amount: 999, currency: 'INR', category: 'subscriptions' }, frequency: 'monthly', active: false },
      { transactionTemplate: { type: 'expense', amount: 16000, currency: 'INR', category: 'loan_emi' }, frequency: 'monthly' },
      { transactionTemplate: { type: 'expense', amount: 5000, currency: 'INR', category: 'other_expense', linkedDebtId: 'd' }, frequency: 'monthly' },
    ];
    const f = recurringForecastByCategory(sched, '2026-10-01', '2026-10-31', 'INR', {});
    expect(Object.keys(f)).toEqual(['utilities']);
    expect(portForecast(sched, '2026-10-01', '2026-10-31', 'INR', {})).toStrictEqual(f);
  });

  it('W8a-UIS15-001 · the Language select labels the partly translated languages "Preview" (FE-UIS-15)', () => {
    expect(languageOptionLabel('en')).toBe('English');
    for (const code of Object.keys(LOCALES).filter(c => c !== 'en')) {
      expect(languageOptionLabel(code)).toBe(`${LOCALES[code].name} — Preview: navigation only`);
    }
    expect([...FULLY_TRANSLATED]).toEqual(['en']);
    const s = src('pages/Settings.tsx');
    expect(s).toMatch(/<option key=\{k\} value=\{k\}>\{languageOptionLabel\(k\)\}<\/option>/);
    expect(s).toMatch(/!FULLY_TRANSLATED\.has\(profile\.language\)/);
  });
});
