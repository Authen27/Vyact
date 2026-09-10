import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../../store';
import { LocalStorageAdapter } from '../dataAdapter';
import { computeAccountBalance } from '../accountBalance';
import { budgetLinesForMonth, computePulseScore, monthlyData } from '../calculations';
import type { Transaction } from '../../types';
import { buildSafeSummary } from '../aiSummary';

vi.mock('../supabase', () => ({ isCloudEnabled: () => false, supabase: null }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-09T12:00:00Z'));
  useStore.setState({ ...useStore.getInitialState(), adapter: new LocalStorageAdapter(),
    currentHouseholdId: crypto.randomUUID(), cloudEnabled: false, myRole: 'owner',
    accounts: [{ id: 'bank', kind: 'bank', name: 'Bank', currency: 'USD', openingBalance: 1000 },
      { id: 'investment', kind: 'investment', name: 'Investment', currency: 'USD', openingBalance: 200 }],
    transactions: [], budgets: [], budgetAllocations: [], recurringSchedules: [], assets: [], debts: [],
    refreshNotifications: vi.fn().mockResolvedValue(undefined), toast: vi.fn() });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function balance(id: string) {
  const state = useStore.getState();
  return computeAccountBalance(state.accounts.find(account => account.id === id)!, state.transactions, 'USD', { USD: 1 });
}

describe('ledger persisted happy paths', () => {
  it('deleting a schedule remains final after refresh even when its historical transaction survives', async () => {
    const state = useStore.getState();
    const schedule = await state.upsertRecurring({ frequency: 'monthly', startDate: '2026-09-09', nextDueDate: '2026-10-09', autoConfirm: false,
      transactionTemplate: { type: 'expense', amount: 100, currency: 'USD', category: 'utilities', description: 'Bill', accountId: 'bank' } });
    const transaction = await useStore.getState().upsertTransaction({ ...schedule.transactionTemplate, date: '2026-09-09',
      recurring: 'monthly', recurringScheduleId: schedule.id });
    await useStore.getState().removeRecurring(schedule.id);
    await useStore.getState().refresh();
    await useStore.getState().refresh();
    expect(useStore.getState().recurringSchedules).toEqual([]);
    expect(useStore.getState().transactions).toEqual([transaction]);
    expect(await state.adapter.list('recurring', state.currentHouseholdId)).toEqual([]);
  });

  it('profile and household currency/type changes persist and reload together', async () => {
    const adapter = useStore.getState().adapter;
    const household = await adapter.createHousehold('Family', 'family', 'USD');
    useStore.setState({ currentHouseholdId: household.id, households: [household] });
    await useStore.getState().updateProfile({ name: 'Test User', baseCurrency: 'GBP', household: 'personal', language: 'en' });
    const reloaded = new LocalStorageAdapter();
    expect(await reloaded.getProfile(household.id)).toMatchObject({ name: 'Test User', baseCurrency: 'GBP', household: 'personal' });
    expect(await reloaded.listHouseholds()).toContainEqual(expect.objectContaining({ id: household.id, baseCurrency: 'GBP', type: 'personal' }));
    expect(useStore.getState().households[0]).toMatchObject({ baseCurrency: 'GBP', type: 'personal' });
  });

  it('reconciliation persists the stated balance and linked asset without inventing a transaction', async () => {
    const state = useStore.getState();
    useStore.setState({ profile: { ...state.profile, baseCurrency: 'USD' }, rates: { USD: 1 },
      accounts: [{ ...state.accounts[0], assetId: 'asset' }],
      assets: [{ id: 'asset', name: 'Bank', type: 'bank', currency: 'USD', value: 1000, liquidity: 'liquid' }] });
    expect(await useStore.getState().reconcileAccount(useStore.getState().accounts[0], 1200)).toBe(200);
    expect(balance('bank')).toBe(1200);
    const after = useStore.getState();
    expect(after.transactions).toEqual([]);
    expect(after.assets[0]).toMatchObject({ value: 1200, confidence: 'confirmed' });
    expect(after.accounts[0].reconciliationLog).toEqual([expect.objectContaining({ delta: 200, stated_value: 1200 })]);
    expect(await new LocalStorageAdapter().list('accounts', after.currentHouseholdId)).toEqual(after.accounts);
    expect(await new LocalStorageAdapter().list('assets', after.currentHouseholdId)).toEqual(after.assets);
  });

  it.each([
    { type: 'expense', category: 'groceries', accountId: 'bank', toAccountId: undefined, bank: 900, income: 0, expenses: 100 },
    { type: 'income', category: 'salary', accountId: undefined, toAccountId: 'bank', bank: 1100, income: 100, expenses: 0 },
    { type: 'transfer', category: '', accountId: 'bank', toAccountId: 'investment', bank: 900, income: 0, expenses: 0 },
    { type: 'investment', category: '', accountId: 'bank', toAccountId: 'investment', bank: 900, income: 0, expenses: 0 },
  ] as const)('$type create, edit and delete persist correct account effects and reporting', async (scenario) => {
    const state = useStore.getState();
    const saved = await state.upsertTransaction({ type: scenario.type, category: scenario.category,
      accountId: scenario.accountId, toAccountId: scenario.toAccountId, amount: 100,
      currency: 'USD', date: '2026-09-09', description: 'Happy path' });
    expect(balance('bank')).toBe(scenario.bank);
    expect(balance('investment')).toBe(scenario.toAccountId === 'investment' ? 300 : 200);
    expect(monthlyData(useStore.getState().transactions, '2026-09', 'USD', { USD: 1 }))
      .toMatchObject({ income: scenario.income, expense: scenario.expenses });
    await useStore.getState().upsertTransaction({ ...saved, amount: 150 });
    const reloaded = await new LocalStorageAdapter().list('transactions', state.currentHouseholdId) as Transaction[];
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toMatchObject({ id: saved.id, amount: 150 });
    useStore.setState({ transactions: reloaded });
    expect(balance('bank')).toBe(scenario.type === 'income' ? 1150 : 850);
    await useStore.getState().removeTransaction(saved.id);
    expect(balance('bank')).toBe(1000);
    expect(balance('investment')).toBe(200);
    expect(await state.adapter.list('transactions', state.currentHouseholdId)).toEqual([]);
  });

  it.each(['month', 'annual'] as const)('%s budget create and replace retain identity and replace allocations', async scope => {
    const state = useStore.getState();
    const created = await state.saveBudgetWithAllocations({ scope, periodYear: 2026,
      ...(scope === 'month' ? { periodMonth: 9 } : {}), currency: 'USD', limit: 500 },
    [{ category: 'groceries', amount: 300 }, { category: 'utilities', amount: 200 }]);
    expect(created.budget.id).toBeTruthy();
    expect(created.allocations).toHaveLength(2);
    const edited = await useStore.getState().saveBudgetWithAllocations({ ...created.budget, limit: 600 },
      [{ category: 'groceries', amount: 600 }]);
    expect(edited.budget.id).toBe(created.budget.id);
    expect(useStore.getState().budgets).toHaveLength(1);
    expect(useStore.getState().budgetAllocations).toEqual(edited.allocations);
    expect(edited.allocations).toEqual([expect.objectContaining({ budgetId: created.budget.id, category: 'groceries', amount: 600 })]);
    const adapter = new LocalStorageAdapter();
    expect(await adapter.list('budgets', state.currentHouseholdId)).toEqual([edited.budget]);
    expect(await adapter.list('budgetAllocations', state.currentHouseholdId)).toEqual(edited.allocations);
    expect(budgetLinesForMonth([edited.budget], edited.allocations, '2026-09'))
      .toEqual([expect.objectContaining({ category: 'groceries', limit: 600 })]);
    expect(computePulseScore([], [edited.budget], [], [], 'USD', { USD: 1 }, edited.allocations).components.budget).toBe(100);
    expect(buildSafeSummary([], [edited.budget], [], [], [], { ...state.profile, baseCurrency: 'USD' }, { USD: 1 }, state.accounts, edited.allocations).budgets)
      .toEqual([{ category: 'groceries', limit: 600, spentPct: 0 }]);
  });

  it.each(['expense', 'income', 'investment'] as const)('due %s schedule posts once, advances and survives reload', async type => {
    const state = useStore.getState();
    const template = { type, amount: 100, currency: 'USD', description: 'Scheduled',
      category: type === 'expense' ? 'groceries' : type === 'income' ? 'salary' : '',
      accountId: type === 'income' ? undefined : 'bank', toAccountId: type === 'income' ? 'bank' : type === 'investment' ? 'investment' : undefined };
    const saved = await state.upsertRecurring({ frequency: 'monthly', dayOfMonth: 9,
      startDate: '2026-09-09', nextDueDate: '2026-09-09', autoConfirm: true, transactionTemplate: template });
    expect(useStore.getState().transactions).toEqual([]);
    await useStore.getState().runRecurringEngine();
    expect(useStore.getState().transactions).toEqual([expect.objectContaining({ type, amount: 100,
      date: '2026-09-09', recurringScheduleId: saved.id })]);
    expect(balance('bank')).toBe(type === 'income' ? 1100 : 900);
    const adapter = new LocalStorageAdapter();
    useStore.setState({ recurringSchedules: await adapter.list('recurring', state.currentHouseholdId),
      transactions: await adapter.list('transactions', state.currentHouseholdId) });
    expect(useStore.getState().recurringSchedules[0].nextDueDate).toBe('2026-10-09');
    await useStore.getState().runRecurringEngine();
    expect(useStore.getState().transactions).toHaveLength(1);
  });

  it('paused schedule posts nothing and resumes on its due date', async () => {
    const saved = await useStore.getState().upsertRecurring({ frequency: 'monthly', dayOfMonth: 9,
      startDate: '2026-09-09', nextDueDate: '2026-09-09', active: false, autoConfirm: true,
      transactionTemplate: { type: 'expense', amount: 100, currency: 'USD', category: 'groceries', accountId: 'bank', description: 'Bill' } });
    await useStore.getState().runRecurringEngine();
    expect(useStore.getState().transactions).toEqual([]);
    await useStore.getState().upsertRecurring({ ...saved, active: true });
    await useStore.getState().runRecurringEngine();
    expect(useStore.getState().transactions).toHaveLength(1);
  });
});
describe('Accounts R1 — one Cash in Hand per household, currency from the household', () => {
  it('local-only: creates exactly one Cash in Hand, idempotently, and refuses a second', async () => {
    await useStore.getState().ensureDefaultCashAccount();
    await useStore.getState().ensureDefaultCashAccount();
    expect(useStore.getState().accounts.filter(a => a.kind === 'cash')).toHaveLength(1);
    await expect(useStore.getState().upsertAccount({ id: crypto.randomUUID(), kind: 'cash', name: 'Second cash' }))
      .rejects.toThrow(/already has a Cash account/);
    expect(useStore.getState().accounts.filter(a => a.kind === 'cash')).toHaveLength(1);
  });

  it('Cash in Hand cannot be archived either — it would vanish from every picker', async () => {
    await useStore.getState().ensureDefaultCashAccount();
    const cash = useStore.getState().accounts.find(a => a.kind === 'cash')!;
    await expect(useStore.getState().upsertAccount({ id: cash.id, isArchived: true })).rejects.toThrow(/cannot be archived/);
    expect(useStore.getState().accounts.find(a => a.id === cash.id)?.isArchived).toBeFalsy();
  });

  it('Cash in Hand cannot be deleted, and the refusal changes nothing', async () => {
    await useStore.getState().ensureDefaultCashAccount();
    const cash = useStore.getState().accounts.find(a => a.kind === 'cash')!;
    await expect(useStore.getState().removeAccount(cash.id)).rejects.toThrow(/cannot be deleted/);
    expect(useStore.getState().accounts.some(a => a.id === cash.id)).toBe(true);
  });

  it('every account write carries the household currency, whatever the caller sent', async () => {
    useStore.setState({ profile: { ...useStore.getState().profile, baseCurrency: 'INR' } });
    const created = await useStore.getState().upsertAccount({ id: crypto.randomUUID(), kind: 'bank', name: 'HDFC', currency: 'USD' });
    expect(created.currency).toBe('INR');
    const renamed = await useStore.getState().upsertAccount({ id: 'bank', name: 'Renamed' });
    expect(renamed.currency).toBe('INR');
    expect(renamed.openingBalance).toBe(1000);
  });

  it('cloud mode asks the server for the cash account and never inserts one — even against an empty, unhydrated store', async () => {
    const hid = crypto.randomUUID();
    const serverCash = { id: crypto.randomUUID(), kind: 'cash' as const, name: 'Cash', currency: 'INR', openingBalance: 0, isDefault: true };
    const upsert = vi.fn();
    const ensureCashAccount = vi.fn().mockResolvedValue(serverCash);
    useStore.setState({ cloudEnabled: true, currentHouseholdId: hid, accounts: [],
      adapter: { upsert, ensureCashAccount } as never });
    await useStore.getState().ensureDefaultCashAccount();
    expect(ensureCashAccount).toHaveBeenCalledWith(hid);
    expect(upsert).not.toHaveBeenCalled();
    expect(useStore.getState().accounts).toEqual([serverCash]);
  });

  it('cloud mode replaces a stale cached cash row with the server one, so nothing double-counts', async () => {
    const hid = crypto.randomUUID();
    const serverCash = { id: crypto.randomUUID(), kind: 'cash' as const, name: 'Cash', currency: 'INR', openingBalance: 0 };
    const staleDuplicate = { id: crypto.randomUUID(), kind: 'cash' as const, name: 'Cash in Hand', currency: 'USD', openingBalance: 0 };
    useStore.setState({ cloudEnabled: true, currentHouseholdId: hid,
      accounts: [useStore.getState().accounts[0], staleDuplicate],
      adapter: { upsert: vi.fn(), ensureCashAccount: vi.fn().mockResolvedValue(serverCash) } as never });
    await useStore.getState().ensureDefaultCashAccount();
    const cash = useStore.getState().accounts.filter(a => a.kind === 'cash');
    expect(cash).toEqual([serverCash]);
    expect(useStore.getState().accounts.some(a => a.id === 'bank')).toBe(true);
  });

  it('a household switch during the server call does not leak the previous household cash into the new one', async () => {
    const serverCash = { id: crypto.randomUUID(), kind: 'cash' as const, name: 'Cash', currency: 'INR', openingBalance: 0 };
    let release!: (value: unknown) => void;
    const ensureCashAccount = vi.fn(() => new Promise(resolve => { release = resolve; }));
    useStore.setState({ cloudEnabled: true, currentHouseholdId: 'household-old', accounts: [],
      adapter: { upsert: vi.fn(), ensureCashAccount } as never });
    const pending = useStore.getState().ensureDefaultCashAccount();
    useStore.setState({ currentHouseholdId: 'household-new' });
    release(serverCash);
    await pending;
    expect(useStore.getState().accounts).toEqual([]);
  });
});
