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
import { editSeedAccount } from '../accounts';
import { parseAmount } from '../amountInput';
import { accountLedgerRows } from '../accountLedger';
import { parseAmountInput } from '../accountsView';
import { sanitizeAmount } from '../../components/ui/NumericKeypad';
import type { Account, Budget, BudgetAllocation, Transaction } from '../../types';

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

  it('W8a-UIC05-001 · an edit opens on the account the ledger uses (the FK), not a stale paymentMethod (FE-UIC-05)', () => {
    const accounts = [
      { id: 'acc-hdfc', kind: 'bank', name: 'HDFC', currency: 'INR' },
      { id: 'acc-card', kind: 'credit_card', name: 'Card', currency: 'INR' },
      { id: 'acc-cash', kind: 'cash', name: 'Cash', currency: 'INR' },
    ] as Account[];
    // Moved to the card elsewhere; paymentMethod still names the bank.
    expect(editSeedAccount({ type: 'expense', accountId: 'acc-card', paymentMethod: 'asset:acc-hdfc' }, accounts)).toBe('debt:acc-card');
    expect(editSeedAccount({ type: 'income', toAccountId: 'acc-hdfc', paymentMethod: 'cash' }, accounts)).toBe('asset:acc-hdfc');
    expect(editSeedAccount({ type: 'expense', accountId: 'acc-cash' }, accounts)).toBe('cash');
    // Legacy rows with no FK keep their stored method.
    expect(editSeedAccount({ type: 'expense', paymentMethod: 'visa' }, accounts)).toBe('visa');
    expect(editSeedAccount({ type: 'expense', accountId: 'gone' }, accounts)).toBe('gone');
    expect(editSeedAccount({ type: 'expense' }, accounts)).toBe('');
    expect(src('components/transactions/TransactionFormModal.tsx')).toMatch(/: editSeedAccount\(initial, accountsState\)/);
  });

  it('W8a-UIC09-001 · editing a non-folding asset patches the row it opened (FE-UIC-09)', () => {
    const s = src('components/assets/AssetFormModal.tsx');
    const elseBranch = s.slice(s.indexOf('} else {', s.indexOf('if (initial && folds)')));
    expect(elseBranch).toMatch(/const asset: Partial<Asset> = \{\s*\.\.\.\(initial \?\? \{\}\),\s*id: initial\?\.id \?\? uid\(\),/);
  });

  it('W8a-UIC10-001 · a decimal comma is read as one; grouping commas still work (FE-UIC-10)', () => {
    expect(parseAmount('12,50')).toBe(12.5);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('1,50,000')).toBe(150000);
    expect(parseAmount('150,000')).toBe(150000);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('46.')).toBe(46);
    expect(parseAmount('-1200')).toBe(-1200);           // a reconcile overdraft keeps its sign
    expect(parseAmount('')).toBeNaN();
    expect(parseAmount('abc')).toBeNaN();
    expect(parseAmountInput('12,50')).toBe(12.5);
    expect(parseAmountInput('')).toBeNull();
    expect(sanitizeAmount('12,50')).toBe('12,50');       // kept as typed (used to become "1250")
    expect(sanitizeAmount('₹ 1,50,000')).toBe('1,50,000');
    for (const f of ['components/transactions/TransactionFormModal.tsx', 'components/splits/SplitFormModal.tsx', 'pages/Recurring.tsx', 'components/budgets/BudgetFormModal.tsx']) {
      expect(src(f), f).not.toMatch(/parseFloat\((form\.amount|form\.limit|amount|r\.amount)\)/);
    }
    expect(src('components/debts/LoanPaymentSheet.tsx')).toMatch(/: parseAmount\(amount\)/);
  });

  it('W8a-UIC15-001 · the ledger running balance undoes a reconcile adjustment when walking back past it (FE-UIC-15)', () => {
    // Opening 1,000; spend 100 on the 2nd; reconcile +50 on the 5th; spend 200 on the 8th.
    const account = {
      id: 'acc', kind: 'bank', name: 'HDFC', currency: 'INR', openingBalance: 1000, reconciliationOffset: 50,
      reconciliationLog: [{ at: '2026-10-05T10:00:00.000Z', delta: 50, kind: 'bank', stated_value: 950 }],
    } as Account;
    const txns = [
      { id: 'a', type: 'expense', amount: 100, currency: 'INR', date: '2026-10-02', category: 'food_dining', description: 'A', accountId: 'acc' },
      { id: 'b', type: 'expense', amount: 200, currency: 'INR', date: '2026-10-08', category: 'shopping', description: 'B', accountId: 'acc' },
    ] as Transaction[];
    const rows = accountLedgerRows(account, txns, 'INR', {});
    expect(rows.map(r => [r.t.id, r.impact, r.runningAfter])).toEqual([
      ['b', -200, 750],    // today's balance: 1000 − 100 + 50 − 200
      ['a', -100, 900],    // was 950: the +50 reconcile on the 5th came after this row
    ]);
    expect(src('pages/Accounts.tsx')).toMatch(/accountLedgerRows\(account, txns, baseCur, rates\)/);
  });

  it('W8a-PIP16-003 · the chat gives each turn an abort signal; Stop, New chat and unmount abort it (FE-PIP-16)', () => {
    const chat = src('pages/Chat.tsx');
    expect(chat).toMatch(/useEffect\(\(\) => \(\) => \{ turnAbort\.current\?\.abort\(\); \}, \[\]\);/);
    expect(chat).toMatch(/cancel: \(\) => \{ cancelledTurns\.current\.add\(turnId\); abort\.abort\(\); \}/);
    expect(chat).toMatch(/selectAssistantBackend\(householdId, abort\.signal\)/);
  });

  it('W8a-SYN12-001 · a failed device-storage read is not "empty": strict reads throw, writes are refused (FE-SYN-12)', async () => {
    vi.resetModules();
    vi.stubGlobal('indexedDB', { open() {
      const req: { error?: Error; onerror?: () => void } = {};
      queueMicrotask(() => { req.error = new Error('disk unavailable'); req.onerror?.(); });
      return req;
    } });
    try {
      const kv = await import('../kvStore');
      expect(await kv.kvGet('h_transactions')).toBeNull();                       // plain read: tolerant
      await expect(kv.kvGetStrict('h_transactions')).rejects.toBeInstanceOf(kv.KvReadError);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
    const adapter = src('lib/dataAdapter.ts');
    for (const m of ['async upsert<', 'async put<', 'async remove(', 'async createBudgetChecked(', 'async recordNetWorthSnapshot(']) {
      const body = adapter.slice(adapter.indexOf(m), adapter.indexOf(m) + 900);
      expect(body, m).toMatch(/this\.readForWrite</);
    }
    expect(adapter).toMatch(/const v = await kvGetStrict<T>\(key\);/);
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
