// Q6-001..006 — v10.134.0 (Track Q6; audit FE-MNY-08; owner decision 20 Oct 2026: "full debit + Owed to you; settling
// records the money into a chosen account"). What a split does to the accounts, read from one module (splitMoney), and
// the screens that make and settle one. The money invariants are §Q6 INV-12 (moneyModel.invariants); the server's fold
// and links are q6SplitSql.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isFullDebitSplit, ledgerDebit, owedToYou, owedToYouShares, splitReceipts } from '../splitMoney';
import { accountLedgerRows } from '../accountLedger';
import { computeAccountBalance } from '../accountBalance';
import { localAccountDependencies } from '../accountsView';
import { buildSafeSummary } from '../aiSummary';
import type { Account, Profile, Transaction } from '../../types';

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const bill = (over: Partial<Transaction> = {}, people: Record<string, { paid?: boolean; into?: string; on?: string }> = {}, extra: Record<string, unknown> = { fullDebit: true }): Transaction => ({
  id: 's1', type: 'expense', amount: 900, currency: 'INR', date: '2026-10-05', description: 'Dinner', category: 'food_dining', accountId: 'main',
  split: { isSplit: true, totalAmount: 900, yourShare: 300, paidBy: 'me', ...extra,
    participants: [{ name: 'You', isYou: true, share: 300, paid: true },
      ...Object.entries(people).map(([name, p]) => ({ name, share: 300, paid: !!p.paid, ...(p.into ? { paidInto: p.into } : {}), ...(p.on ? { paidOn: p.on } : {}) }))] },
  ...over,
}) as Transaction;

describe('what a split does to the accounts (FE-MNY-08)', () => {
  it('Q6-001 · only a new split you paid carries the full bill; its paid shares come back into their account; the rest is owed', () => {
    const t = bill({}, { Ann: { paid: true, into: 'save', on: '2026-10-09' }, Bo: {} });
    expect(isFullDebitSplit(t)).toBe(true);
    expect(ledgerDebit(t)).toBe(900);
    expect(splitReceipts(t)).toEqual([{ txnId: 's1', name: 'Ann', accountId: 'save', amount: 300, date: '2026-10-09' }]);
    expect(owedToYouShares([t])).toEqual([{ txnId: 's1', name: 'Bo', amount: 300, description: 'Dinner', date: '2026-10-05' }]);
    expect(owedToYou([t])).toBe(300);
    // A paid share naming no account came back into the paying account, on the bill's day if it has none of its own.
    expect(splitReceipts(bill({}, { Cy: { paid: true } }))).toEqual([{ txnId: 's1', name: 'Cy', accountId: 'main', amount: 300, date: '2026-10-05' }]);
    // Not full debit: an older split, someone else paying, or an income split.
    for (const other of [bill({}, { Ann: {} }, {}), bill({}, { Ann: {} }, { fullDebit: true, paidBy: 'external' }), bill({ type: 'income' }, { Ann: {} })]) {
      expect(isFullDebitSplit(other)).toBe(false);
      expect(ledgerDebit(other)).toBeNull();
      expect(splitReceipts(other)).toEqual([]);
      expect(owedToYou([other])).toBe(0);
    }
  });

  it('Q6-002 · an account\'s ledger shows each repayment on its own day, by name, and ends at the account\'s balance', () => {
    const save = { id: 'save', kind: 'bank', name: 'Savings', currency: 'INR', openingBalance: 0 } as Account;
    const main = { id: 'main', kind: 'bank', name: 'HDFC', currency: 'INR', openingBalance: 5000 } as Account;
    const txns = [bill({}, { Ann: { paid: true, into: 'save', on: '2026-10-09' }, Bo: { paid: true, into: 'main', on: '2026-10-12' } })];
    const saveRows = accountLedgerRows(save, txns, 'INR', {});
    expect(saveRows.map(r => [r.date, r.impact, r.receipt, r.runningAfter])).toEqual([['2026-10-09', 300, 'Ann', 300]]);
    const mainRows = accountLedgerRows(main, txns, 'INR', {});
    expect(mainRows.map(r => [r.date, r.impact, r.receipt ?? null])).toEqual([['2026-10-12', 300, 'Bo'], ['2026-10-05', -900, null]]);
    expect(mainRows[0].runningAfter).toBe(computeAccountBalance(main, txns, 'INR', {}));
    expect(src('pages/Accounts.tsx')).toMatch(/receipt \? `\$\{receipt\} paid you back · /);
  });

  it('Q6-003 · the Split form makes a new expense split full debit, keeps an older one as it was, and records where a share ticked paid came in', () => {
    const form = src('components/splits/SplitFormModal.tsx');
    expect(form).toMatch(/const fullDebit = form\.type === 'expense' && \(initial \? initial\.split\?\.fullDebit === true : true\);/);
    expect(form).toMatch(/\.\.\.\(fullDebit \? \{ fullDebit: true \} : \{\}\),/);
    expect(form).toMatch(/const paidInto = fullDebit && !p\.isYou && p\.paid \? \(before\?\.paidInto \?\? form\.paymentMethod\) : undefined;/);
    // The store turns a picker value into the account's id, so the server can check the link.
    expect(src('store/slices/dataSlice.ts')).toMatch(/paidInto: resolveUuid\(p\.paidInto\) \?\? p\.paidInto/);
  });

  it('Q6-004 · on a full-debit split, marking someone paid asks which bank or cash account the money came back into', () => {
    const page = src('pages/Splits.tsx');
    expect(page).toMatch(/if \(isFullDebitSplit\(txn\)\) \{ askWhereItCameIn\(txn, \[participantName\]\); return; \}/);
    expect(page).toMatch(/askWhereItCameIn\(txn, txn\.split\.participants\.filter\(p => !p\.isYou && !p\.paid\)\.map\(p => p\.name\)\);/);
    expect(page).toMatch(/\{ \.\.\.p, paid: true, paidOn: today\(\), paidInto: accountValue \}/);
    expect(page).toMatch(/await queueCloudSharesPaid\(updated\);/);
    const sheet = src('components/splits/SettleShareSheet.tsx');
    expect(sheet).toMatch(/filter: o => o\.kind === 'bank' \|\| o\.kind === 'cash'/);
    expect(sheet).toMatch(/It isn&apos;t income, and your spending on this split stays your share\./);
  });

  it('Q6-005 · an account a repayment came into is in use here too, and a move carries its repayments', () => {
    const deps = localAccountDependencies('save', [bill({}, { Ann: { paid: true, into: 'save' } })], []);
    expect(deps.transactions.count).toBe(1);
    expect(src('store/slices/crudSlice.ts')).toMatch(/\.map\(p => \(p\.paidInto === fromId \? \{ \.\.\.p, paidInto: toId \} : p\)\)/);
  });

  it('Q6-006 · Net Worth and Pip show Owed to you as an asset, never as money to spend', () => {
    const main = { id: 'main', kind: 'bank', name: 'HDFC', currency: 'INR', openingBalance: 5000 } as Account;
    const s = buildSafeSummary([bill({}, { Ann: {}, Bo: {} })], [], [], [], [], { baseCurrency: 'INR' } as Profile, {}, [main]);
    expect(s.holdings).toContainEqual({ name: 'Owed to you', source: 'asset', liquidity: 'short', value: 600 });
    expect(s.netWorth.liquidAssets).toBe(4100);
    expect(src('pages/NetWorth.tsx')).toMatch(/if \(row\.source === 'split'\) \{/);
  });
});
