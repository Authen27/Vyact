// W7a (v10.80.0) — small app fixes from the 2026-10-04 audit (batch A). Each case is named after its
// finding. Vitest runs in node here (no DOM), so screen behaviour is pinned through the pure helpers
// it uses and, where a page must use them, through its source.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { evaluateRecommendations } from '../plannerRules';
import { buildBackup, BACKUP_FORMAT_VERSION } from '../backup';
import { txnAccountLabel } from '../accounts';
import { listNet, dayTotalsForMonth } from '../txnListTotals';
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
  it('W7a-MNY15-001 · "Full backup" carries accounts, allocations, recurring bills and net-worth history (FE-MNY-15, FE-UIS-06)', () => {
    const empty = { profile: { name: 'A' } as never, transactions: [], budgets: [], goals: [], members: [], debts: [], assets: [] };
    const b = buildBackup({
      ...empty,
      accounts: [{ id: 'acc' } as never], budgetAllocations: [{ budgetId: 'b' } as never],
      recurringSchedules: [{ id: 'r' } as never], netWorthSnapshots: [{ month: '2026-09' } as never],
    }, '2026-10-08', '10.80.0');
    expect(b).toMatchObject({ version: BACKUP_FORMAT_VERSION, appVersion: '10.80.0', exported: '2026-10-08' });
    expect([b.accounts, b.budgetAllocations, b.recurringSchedules, b.netWorthSnapshots].map(a => a.length)).toEqual([1, 1, 1, 1]);
    expect(b).not.toHaveProperty('exchangeRates');
    expect(src('pages/Settings.tsx')).toMatch(/buildBackup\(\{[\s\S]*?accounts: s\.accounts, budgetAllocations: s\.budgetAllocations,[\s\S]*?recurringSchedules: s\.recurringSchedules, netWorthSnapshots: s\.netWorthSnapshots/);
  });
  it('W7a-UIC16-001 · a transaction row names its account from the accounts FK (FE-UIC-16)', () => {
    const accounts = [{ id: 'a1', name: 'HDFC Salary' }, { id: 'a2', name: 'ICICI Card' }];
    const lbl = (t: Partial<Transaction>) => txnAccountLabel({ type: 'expense', ...t } as Transaction, accounts, [], []);
    expect(lbl({ accountId: 'a1', paymentMethod: 'asset:gone' })).toBe('HDFC Salary');   // was "Linked account"
    expect(lbl({ paymentMethod: 'a2' })).toBe('ICICI Card');                              // account id stored as method
    expect(lbl({ type: 'transfer', accountId: 'a1', toAccountId: 'a2' })).toBe('HDFC Salary → ICICI Card');
    expect(lbl({ accountSplits: [{ accountId: 'a1', amount: 1 }, { accountId: 'a2', amount: 2 }] })).toBe('HDFC Salary + ICICI Card');
    expect(lbl({ type: 'investment', toAccountId: 'a1' })).toBe('HDFC Salary');
    expect(lbl({ paymentMethod: 'cash' })).toBe('Cash');                                  // legacy path kept
    expect(lbl({})).toBeNull();
    expect(src('components/transactions/TxnRow.tsx')).toMatch(/txnAccountLabel\(t, accounts, assets, debts2\)/);
  });
  it('W7a-UIC17-001 · list and calendar totals count reportable rows at your share (FE-UIC-17)', () => {
    const t = (o: Partial<Transaction>) => ({ id: Math.random().toString(), currency: 'INR', description: '', date: '2026-10-03', ...o } as Transaction);
    const rows = [
      t({ type: 'income', amount: 1000, category: 'salary' }),
      t({ type: 'expense', amount: 600, category: 'food_dining', split: { isSplit: true, yourShare: 200, participants: [] } as never }),
      t({ type: 'expense', amount: 300, category: 'transfer' }),             // paired transfer leg
      t({ type: 'expense', amount: 50, category: 'balance_adjustment' }),    // reconciliation correction
      t({ type: 'expense', amount: 80, category: 'shopping', excluded: true }),
      t({ type: 'transfer', amount: 999, category: 'transfer' }),
    ];
    expect(listNet(rows, 'INR')).toBe(800);                                    // 1000 − 200 (was 1000 − 600 − 300 − 50)
    const days = dayTotalsForMonth(rows, '2026-10', 'INR');
    expect(days.get('2026-10-03')).toEqual({ income: 1000, expense: 200 });
    expect(dayTotalsForMonth(rows, '2026-09', 'INR').size).toBe(0);
    expect(src('pages/Transactions.tsx')).not.toMatch(/effectiveAmount\(/);
    expect(src('components/transactions/TxnCalendar.tsx')).toMatch(/dayTotalsForMonth\(transactions, viewMonth, currency\)/);
  });
  it('W7a-PIP17-001 · the chat is keyed on the household, so a switch starts a fresh conversation (FE-PIP-17)', () => {
    const chat = src('pages/Chat.tsx');
    expect(chat).toMatch(/export default function Chat\(props[^)]*\) \{\s*const householdId = useStore\(s => s\.currentHouseholdId\);\s*return <ChatForHousehold key=\{householdId\} \{\.\.\.props\} \/>;/);
  });
});
