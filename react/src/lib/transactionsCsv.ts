// Transactions → CSV (v10.55.0, master to-do #69). One builder for Settings › Export CSV and the
// Transactions page's export of what is on screen. Adds who added each entry, the account(s) and
// the payment mode to the original seven columns, which keep their order and meaning.
import type { Account, Member, Transaction } from '../types';
import { PAYMENT_MODE_LABEL } from './accountsView';

export const CSV_HEADER = ['Date', 'Type', 'Description', 'Category', 'Amount', 'Currency', 'Note', 'Added by', 'Account', 'To account', 'Payment mode'];

const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function transactionsCsv(
  transactions: Transaction[],
  ctx: {
    members: Pick<Member, 'id' | 'name'>[]; accounts: Pick<Account, 'id' | 'name'>[];
    /** W3b (D14): the household's one currency — every row is in it, whatever its old label. */
    baseCurrency: string;
  },
): string {
  const memberName = (id?: string) => (id && ctx.members.find(m => m.id === id)?.name) || '';
  const accountName = (id?: string) => (id && ctx.accounts.find(a => a.id === id)?.name) || '';
  const rows = transactions.map(t => [
    t.date, t.type, t.description, t.category, t.amount, ctx.baseCurrency, t.note || '',
    memberName(t.memberId), accountName(t.accountId), accountName(t.toAccountId),
    t.paymentMode ? PAYMENT_MODE_LABEL[t.paymentMode] : '',
  ]);
  return [CSV_HEADER, ...rows].map(r => r.map(cell).join(',')).join('\n');
}

/** Save a CSV in the browser. */
export function downloadCsv(csv: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
