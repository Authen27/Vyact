// W7a (v10.80.0) — small app fixes from the 2026-10-04 audit (batch A). Each case is named after its
// finding. Vitest runs in node here (no DOM), so screen behaviour is pinned through the pure helpers
// it uses and, where a page must use them, through its source.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateRecommendations } from '../plannerRules';
import type { Transaction } from '../../types';

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('W7a · small app fixes', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('W7a-MNY14-001 · a steady salary is not "income varies" early in a month; real variance still is (FE-MNY-14)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 2, 12, 0, 0));               // 2 Oct 2026, before this month's salary
    const pay = (date: string, amount: number): Transaction => ({ id: date, type: 'income', amount, currency: 'INR', date, category: 'salary', description: 'Salary' } as Transaction);
    const steady = ['2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map(d => pay(d, 1_00_000));
    const ctx = (transactions: Transaction[]) => ({ transactions, budgets: [], goals: [], debts: [], assets: [], baseCurrency: 'INR', rates: {} });
    // A tiny entry this month used to count as a near-zero income month and trip the rule.
    const thisMonth = [{ id: 'x', type: 'expense', amount: 50, currency: 'INR', date: '2026-10-01', category: 'food_dining', description: 'Tea', accountId: 'a' } as Transaction];
    expect(evaluateRecommendations(ctx([...steady, ...thisMonth]), 50).some(r => r.id === 'income.unstable')).toBe(false);
    const lumpy = ['2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((d, i) => pay(d, [20_000, 1_50_000, 30_000, 1_20_000][i]));
    expect(evaluateRecommendations(ctx(lumpy), 50).some(r => r.id === 'income.unstable')).toBe(true);
  });
  it('W7a-PIP17-001 · the chat is keyed on the household, so a switch starts a fresh conversation (FE-PIP-17)', () => {
    const chat = src('pages/Chat.tsx');
    expect(chat).toMatch(/export default function Chat\(props[^)]*\) \{\s*const householdId = useStore\(s => s\.currentHouseholdId\);\s*return <ChatForHousehold key=\{householdId\} \{\.\.\.props\} \/>;/);
  });
});
