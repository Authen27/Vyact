// Track E (owner decisions 13–14 Oct 2026) — one definition of spending, read by every screen, Pip and
// WhatsApp. E2 (v10.96.0): WhatsApp's alerts and digests read spending through the APP's rules over the
// APP's row mapping (the bundled engine); the hand-copied money port is deleted (audit XC-ARC-06).
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spendRows, spendByCategoryInRange } from '../calculations';
import { txnsFromRows } from '../serverEngine';
import {
  rowToTxn, largeSpendAlerts, dailyDigest, monthClose, weeklySummary, type TxnRow,
} from '../../../../supabase/functions/_shared/whatsapp-dispatch-rules';
import type { Transaction } from '../../types';

const FUNCTIONS = resolve(__dirname, '../../../../supabase/functions');
const read = (p: string) => readFileSync(join(FUNCTIONS, p), 'utf8');

let n = 0;
const row = (p: Partial<TxnRow>): TxnRow => ({
  id: `r-${++n}`, household_id: 'h', created_by: 'alice', type: 'expense', amount: 100, currency: 'INR',
  date: '2026-10-14', category: 'food_dining', account_id: 'acc-1', extras: null, ...p,
});
const HH = { id: 'h', base_currency: 'INR' };
const MEMBERS = [{ profile_id: 'alice', household_id: 'h', first_name: 'Asha' }, { profile_id: 'bob', household_id: 'h', first_name: 'Bob' }];

describe('Track E · E2: WhatsApp reads the app\'s spending', () => {
  it('TE2-001 · a scheduler row becomes the app\'s own Transaction: loan-payment details, splits and privacy survive', () => {
    const split = { interest: 600, principal: 9400, debt_id: 'd1', kind: 'emi', operation_id: 'op1' };
    const t = rowToTxn(row({ type: 'transfer', category: null, amount: 9400, to_account_id: 'loan-acc', debt_id: 'd1',
      recurring_schedule_id: 's1', member_id: 'm1', extras: { emi_split: split, excluded: true, split: { isSplit: true, yourShare: 5 } } })) as unknown as Transaction;
    expect(t).toMatchObject({ type: 'transfer', amount: 9400, toAccountId: 'loan-acc', debtId: 'd1', recurringScheduleId: 's1',
      memberId: 'm1', excluded: true, created_by: 'alice', emiSplit: split, split: { isSplit: true, yourShare: 5 } });
    // The old port mapping dropped emi_split, so a change to what counts as spending (E3) never reached WhatsApp.
    expect(txnsFromRows([row({})])[0]).toEqual(rowToTxn(row({ id: 'r-' + n })));
  });

  it('TE2-002 · every spending rule counts exactly the app\'s spending rows', () => {
    const rows = [
      row({ id: 'food', amount: 18000, date: '2026-10-14' }),
      row({ id: 'private', amount: 50000, date: '2026-10-14', extras: { excluded: true } }),
      row({ id: 'move', type: 'transfer', category: null, amount: 30000, date: '2026-10-14', to_account_id: 'acc-2' }),
      row({ id: 'adjust', amount: 25000, date: '2026-10-14', category: 'balance_adjustment' }),
      row({ id: 'sept', amount: 4000, date: '2026-09-10', category: 'groceries' }),
    ];
    const app = spendRows(txnsFromRows(rows));
    expect(app.map(t => t.id)).toEqual(['food', 'sept']);
    // Large spend: only the app's spending rows can alert.
    const large = largeSpendAlerts({ household: HH, members: MEMBERS, thresholds: {}, accountNames: { 'acc-1': 'HDFC' }, txns: rows });
    expect(large.map(s => s.dedupeKey)).toEqual(['txn:food']);
    // The evening digest: today's spending rows only (the private one makes the day "logged", not counted).
    const digest = dailyDigest({ household: HH, today: '2026-10-14', txns: rows, members: MEMBERS, names: {}, memberCount: 2 });
    expect(digest[0].values.slice(1, 3)).toEqual(['18,000', '1']);
    // The weekly summary counts the same entries.
    expect(weeklySummary({ household: HH, today: '2026-10-14', txns: rows, member: MEMBERS[0], weekKey: 'w' })?.values.slice(1))
      .toEqual(['1', 'Food & Dining']);
    // Month close: September's total is the app's September spending.
    const close = monthClose({ household: HH, today: '2026-10-01', txns: rows, members: MEMBERS });
    const sept = spendByCategoryInRange(txnsFromRows(rows), '2026-09-01', '2026-09-30', 'INR', {});
    expect(close[0].values[2]).toBe('4,000');
    expect(sept).toEqual({ groceries: 4000 });
  });

  it('TE2-003 · no server code keeps its own money port; the scheduler loads the columns the app maps', () => {
    expect(existsSync(join(FUNCTIONS, '_shared/money'))).toBe(false);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!e.name.endsWith('.ts') || e.name.endsWith('.generated.js')) continue;
        if (/from ['"][^'"]*money\/calculations/.test(readFileSync(p, 'utf8'))) offenders.push(p);
      }
    };
    walk(FUNCTIONS);
    expect(offenders).toEqual([]);
    expect(read('_shared/whatsapp-dispatch-rules.ts')).toMatch(/import \{ txnsFromRows, spendRows, spendByCategoryInRange, effectiveAmount, type EngineTxn \} from '\.\/agent\/engine\.ts';/);
    expect(read('whatsapp-dispatch/index.ts')).toMatch(/const TXN_COLUMNS = '[^']*\bmember_id\b[^']*\bdebt_id\b[^']*\bextras\b/);
    expect(readFileSync(resolve(__dirname, '../serverEngine.ts'), 'utf8')).toMatch(/export \{ spendRows, spendByCategoryInRange, effectiveAmount \} from '\.\/calculations';/);
  });
});
