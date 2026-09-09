import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../../store';
import { LocalStorageAdapter } from '../dataAdapter';
import { computeNetWorth } from '../netWorth';
import { computeAccountBalance } from '../accountBalance';

vi.mock('../supabase', () => ({ isCloudEnabled: () => false, supabase: null }));

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  useStore.setState({
    ...useStore.getInitialState(),
    currentHouseholdId: crypto.randomUUID(),
    adapter: new LocalStorageAdapter(),
    cloudEnabled: false,
    toast: vi.fn(),
    accounts: [{ id: crypto.randomUUID(), kind: 'bank', name: 'Funding', currency: 'USD', openingBalance: 10000 }],
    debts: [{ id: crypto.randomUUID(), type: 'loan', name: 'Loan', currency: 'USD', principal: 8000,
      currentBalance: 8000, interestRate: 0, minimumPayment: 500, remainingMonths: 16 }],
    transactions: [], assets: [],
  });
});

describe('loan payment workflow', () => {
  it('CON-UNIT-910 - generic CRUD cannot partially undo a system-split payment', async () => {
    const before = useStore.getState();
    await before.recordLoanPayment({ debtId: before.debts[0].id, fundingAccountId: before.accounts[0].id, amount: 500 });
    const leg = useStore.getState().transactions[0];
    await expect(useStore.getState().removeTransaction(leg.id)).rejects.toThrow('atomic reversal');
    await expect(useStore.getState().upsertTransaction({ ...leg, amount: 600 })).rejects.toThrow('atomic reversal');
    expect(useStore.getState().debts[0].currentBalance).toBe(7500);
    expect(useStore.getState().transactions[0].amount).toBe(500);
  });
  it('CON-UNIT-906 - cloud mode never falls back to sequential local loan writes', async () => {
    useStore.setState({ cloudEnabled: true });
    const state = useStore.getState();
    await expect(state.recordLoanPayment({ debtId: state.debts[0].id, amount: 500 })).rejects.toThrow('online');
    expect(useStore.getState().transactions).toHaveLength(0);
    expect(useStore.getState().debts[0].currentBalance).toBe(8000);
  });

  it('CON-UNIT-907 - a retry adopts server rows once and preserves the server account balance', async () => {
    const state = useStore.getState();
    const account = { id: 'server-loan', kind: 'loan' as const, name: 'Loan', currency: 'USD',
      debtId: state.debts[0].id, openingBalance: -8000, reconciliationOffset: 25, updated_at: 'server-revision' };
    const transaction = { id: 'server-txn', type: 'transfer' as const, amount: 500, currency: 'USD',
      date: '2026-09-09', category: '', description: 'Principal', accountId: state.accounts[0].id, toAccountId: account.id };
    const recordLoanPayment = vi.fn().mockResolvedValue({ status: 'duplicate', loanAccount: account,
      debt: { ...state.debts[0], currentBalance: 7500 }, transactions: [transaction] });
    state.adapter.recordLoanPayment = recordLoanPayment;
    useStore.setState({ cloudEnabled: true });
    const input = { operationId: crypto.randomUUID(), debtId: state.debts[0].id, amount: 500,
      fundingAccountId: state.accounts[0].id };
    await state.recordLoanPayment(input);
    await useStore.getState().recordLoanPayment(input);
    expect(useStore.getState().transactions).toEqual([transaction]);
    expect(useStore.getState().accounts).toContainEqual(account);
    expect(recordLoanPayment.mock.calls.map(call => call[1].operationId)).toEqual([input.operationId, input.operationId]);
  });
  it('CON-UNIT-900 - first principal payment preserves net worth and leaves the real outstanding balance', async () => {
    const before = useStore.getState();
    const initialWorth = computeNetWorth(before, 'USD', { USD: 1 }).netWorth;
    await before.recordLoanPayment({ debtId: before.debts[0].id, fundingAccountId: before.accounts[0].id, amount: 500 });
    const after = useStore.getState();
    const loan = after.accounts.find(account => account.debtId === before.debts[0].id)!;
    expect(loan.openingBalance).toBe(-8000);
    expect(computeAccountBalance(loan, after.transactions, 'USD', { USD: 1 })).toBe(-7500);
    expect(after.debts[0].currentBalance).toBe(7500);
    expect(computeNetWorth(after, 'USD', { USD: 1 }).netWorth).toBe(initialWorth);
    const persisted = await after.adapter.list('accounts', after.currentHouseholdId);
    expect(persisted).toContainEqual(expect.objectContaining({ id: loan.id, openingBalance: -8000 }));
  });

  it('CON-UNIT-901 - a second payment and metadata edit retain the opening liability', async () => {
    const before = useStore.getState();
    const input = { debtId: before.debts[0].id, fundingAccountId: before.accounts[0].id, amount: 500 };
    await before.recordLoanPayment(input);
    await useStore.getState().recordLoanPayment(input);
    const loan = useStore.getState().accounts.find(account => account.debtId === input.debtId)!;
    await useStore.getState().upsertAccount({ id: loan.id, name: 'Renamed loan' });
    const after = useStore.getState();
    expect(after.accounts.find(account => account.id === loan.id)?.openingBalance).toBe(-8000);
    expect(computeNetWorth(after, 'USD', { USD: 1 }).totalLiabilities).toBe(7000);
  });
});
afterEach(() => vi.unstubAllGlobals());