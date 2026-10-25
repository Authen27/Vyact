import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { replayMigrations } from './helpers/replayMigrations';
import { computeAccountBalance } from '../accountBalance';
import type { Account, Transaction } from '../../types';

// Q5-SQL-001..004 — v10.133.0 (Track Q5; audit FE-MNY-12; owner decision 20 Oct 2026: "refuse archiving an account
// with a balance"). account_ledger_balance() is the app's fold on the server, and from the app a bank account or card
// is archived only at zero. On the schema every migration builds.

let db: PGlite;
let H = '';
const OWNER = '50000000-0000-4000-8000-0000000000a1';
const BANK = '50000000-0000-4000-8000-0000000000b1';
const SAVINGS = '50000000-0000-4000-8000-0000000000b2';
const CARD = '50000000-0000-4000-8000-0000000000b3';
const LOAN = '50000000-0000-4000-8000-0000000000b4';

type Outcome = { ok: true } | { ok: false; code: string; message: string };

/** One statement as the signed-in owner (the app) or with no claims (a migration or job); always rolled back. */
async function asOwner(sql: string, app = true): Promise<Outcome> {
  await db.exec('begin');
  try {
    if (app) {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: OWNER, role: 'authenticated' })]);
      await db.exec('set local role authenticated');
    }
    await db.exec(sql);
    await db.exec('rollback');
    return { ok: true };
  } catch (e) {
    await db.exec('rollback');
    const err = e as { code?: string; message?: string };
    return { ok: false, code: err.code ?? '?', message: err.message ?? String(e) };
  }
}
const balanceOf = async (id: string) => Number((await db.query<{ b: string }>(`select account_ledger_balance($1) b`, [id])).rows[0].b);

beforeAll(async () => {
  ({ db } = await replayMigrations());
  await db.exec(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    values ('${OWNER}', 'owner@vyact.test', now(), '{"display_name": "owner"}'::jsonb)`);
  H = (await db.query<{ id: string }>(`select id from households where created_by = $1`, [OWNER])).rows[0].id;
  await db.exec(`
    insert into accounts (id, household_id, kind, name, currency, opening_balance, reconciliation_offset) values
      ('${BANK}', '${H}', 'bank', 'HDFC', 'INR', 1000, 25),
      ('${SAVINGS}', '${H}', 'bank', 'Old savings', 'INR', 0, 0),
      ('${CARD}', '${H}', 'credit_card', 'Regalia', 'INR', 0, 0),
      ('${LOAN}', '${H}', 'loan', 'Car loan', 'INR', -5000, 0);
    insert into transactions (household_id, created_by, type, amount, currency, date, description, category, account_id, to_account_id, extras, deleted_at) values
      ('${H}', '${OWNER}', 'income',   500, 'INR', current_date, 'pay',     'salary',    null,        '${BANK}', null, null),
      ('${H}', '${OWNER}', 'expense',  120, 'INR', current_date, 'food',    'groceries', '${BANK}',   null, null, null),
      ('${H}', '${OWNER}', 'expense',  900, 'INR', current_date, 'dinner',  'dining_out','${BANK}',   null,
         '{"split": {"isSplit": true, "yourShare": 300}}'::jsonb, null),
      ('${H}', '${OWNER}', 'transfer', 200, 'INR', current_date, 'move',    null,        '${BANK}',   '${SAVINGS}', null, null),
      ('${H}', '${OWNER}', 'expense',  999, 'INR', current_date, 'deleted', 'groceries', '${BANK}',   null, null, now()),
      ('${H}', '${OWNER}', 'expense',  700, 'INR', current_date, 'card',    'shopping',  '${CARD}',   null, null, null);
  `);
}, 180_000);
afterAll(async () => { await db?.close(); });

describe('the server folds an account as the app does (FE-MNY-12)', () => {
  it('Q5-SQL-001 · opening + offset + what arrived − what left; a split at your share; deleted entries out', async () => {
    const acct = (id: string, opening: number, offset = 0): Account =>
      ({ id, name: id, kind: 'bank', currency: 'INR', openingBalance: opening, reconciliationOffset: offset }) as Account;
    const t = (p: Partial<Transaction>): Transaction => ({ id: crypto.randomUUID(), currency: 'INR', date: '2026-10-25', description: '', category: 'groceries', ...p }) as Transaction;
    const txns = [
      t({ type: 'income', amount: 500, toAccountId: BANK }),
      t({ type: 'expense', amount: 120, accountId: BANK }),
      t({ type: 'expense', amount: 900, accountId: BANK, split: { isSplit: true, yourShare: 300 } as Transaction['split'] }),
      t({ type: 'transfer', amount: 200, accountId: BANK, toAccountId: SAVINGS }),
    ];
    // 1000 + 25 + 500 − 120 − 300 − 200 = 905; the savings account received 200.
    expect(computeAccountBalance(acct(BANK, 1000, 25), txns, 'INR', {})).toBe(905);
    expect(await balanceOf(BANK)).toBe(905);
    expect(await balanceOf(SAVINGS)).toBe(200);
    expect(await balanceOf(CARD)).toBe(-700);
    expect(await balanceOf(LOAN)).toBe(-5000);
  });
});

describe('from the app, a bank account or card is archived at zero (FE-MNY-12)', () => {
  it('Q5-SQL-002 · an account holding money, or a card that owes, is refused: account_has_balance (23514)', async () => {
    for (const id of [BANK, SAVINGS, CARD]) {
      const r = await asOwner(`update accounts set is_archived = true where id = '${id}'`);
      expect(r, id).toMatchObject({ ok: false, code: '23514' });
      if (!r.ok) expect(r.message).toMatch(/^account_has_balance: .+ still holds -?\d+(\.\d+)?;/);
    }
  });

  it('Q5-SQL-003 · at zero it archives, including a reconcile to zero and the archive in one write', async () => {
    // The savings account holds 200: reconciled to zero in the same update, it archives.
    expect(await asOwner(`update accounts set reconciliation_offset = -200, is_archived = true where id = '${SAVINGS}'`)).toEqual({ ok: true });
    // Moved out first (a transfer back), then archived.
    expect(await asOwner(`
      insert into transactions (household_id, created_by, type, amount, currency, date, description, account_id, to_account_id)
        values ('${H}', '${OWNER}', 'transfer', 200, 'INR', current_date, 'back', '${SAVINGS}', '${BANK}');
      update accounts set is_archived = true where id = '${SAVINGS}'`)).toEqual({ ok: true });
    // A card paid off to zero archives.
    expect(await asOwner(`update accounts set reconciliation_offset = 700, is_archived = true where id = '${CARD}'`)).toEqual({ ok: true });
  });

  it('Q5-SQL-004 · loans are archived by the loan functions, and jobs and migrations are not held to it', async () => {
    // A loan's account is never part of "Spendable now": the loan functions archive it (delete_debt, mark_loan_paid_off).
    expect(await asOwner(`update accounts set is_archived = true where id = '${LOAN}'`)).toEqual({ ok: true });
    // No claims (a migration, a scheduled job): unchanged.
    expect(await asOwner(`update accounts set is_archived = true where id = '${BANK}'`, false)).toEqual({ ok: true });
    // Cash in Hand is still never archived.
    await db.exec(`insert into accounts (household_id, kind, name, currency)
      select '${H}', 'cash', 'Cash in Hand', 'INR' where not exists (select 1 from accounts where household_id = '${H}' and kind = 'cash')`);
    const cashId = (await db.query<{ id: string }>(`select id from accounts where household_id = $1 and kind = 'cash'`, [H])).rows[0].id;
    expect(await asOwner(`update accounts set is_archived = true where id = '${cashId}'`)).toMatchObject({ ok: false, code: '22023' });
  });
});
