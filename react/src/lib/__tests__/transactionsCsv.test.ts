// v10.55.0 (#69) — the transactions CSV: the original seven columns keep their order and meaning
// (exports people already use keep working), followed by who added it, the account(s) and the
// payment mode; text is quoted and escaped.
import { describe, expect, it } from 'vitest';
import { CSV_HEADER, transactionsCsv } from '../transactionsCsv';
import type { Transaction } from '../../types';

const txn = (over: Partial<Transaction>): Transaction => ({
  id: 't', type: 'expense', amount: 12.5, currency: 'USD', date: '2026-10-02', category: 'food', description: 'Lunch',
  ...over,
} as Transaction);

describe('transactions CSV', () => {
  it('CON-UNIT-CSV-001 · the first seven columns are unchanged; added-by, accounts and mode follow', () => {
    expect(CSV_HEADER.slice(0, 7)).toEqual(['Date', 'Type', 'Description', 'Category', 'Amount', 'Currency', 'Note']);
    const csv = transactionsCsv([
      txn({ memberId: 'm1', accountId: 'a1', paymentMode: 'upi' }),
      txn({ id: 't2', type: 'transfer', category: '', description: 'To savings', accountId: 'a1', toAccountId: 'a2', amount: 100 }),
    ], { members: [{ id: 'm1', name: 'Asha' }], accounts: [{ id: 'a1', name: 'HDFC' }, { id: 'a2', name: 'Savings' }], baseCurrency: 'INR' });
    const lines = csv.split('\n');
    expect(lines[0]).toBe(CSV_HEADER.map(h => `"${h}"`).join(','));
    // W3b (owner decision D14): the Currency column is the household's, whatever an old row was labelled.
    expect(lines[1]).toBe('"2026-10-02","expense","Lunch","food","12.5","INR","","Asha","HDFC","","UPI"');
    expect(lines[2]).toBe('"2026-10-02","transfer","To savings","","100","INR","","","HDFC","Savings",""');
  });

  it('CON-UNIT-CSV-002 · quotes and commas in text are escaped; unknown member or account is blank', () => {
    const csv = transactionsCsv([txn({ description: 'Pizza, "large"', memberId: 'gone', accountId: 'gone' })], { members: [], accounts: [], baseCurrency: 'USD' });
    expect(csv.split('\n')[1]).toBe('"2026-10-02","expense","Pizza, ""large""","food","12.5","USD","","","","",""');
  });
});
