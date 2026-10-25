import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { replayMigrations } from './helpers/replayMigrations';
import { computeAccountBalance } from '../accountBalance';
import { txnsFromRows } from '../serverEngine';
import type { Account } from '../../types';

// Q6-SQL-001..004 — v10.134.0 (Track Q6; audit FE-MNY-08; owner decision 20 Oct 2026). On the server a split you pay
// in full debits the whole bill, its repayments credit the account they came into, and those repayment links are
// account links like any other: the household's own, live when made, counted by account_dependencies and carried by
// move_account_and_delete. On the schema every migration builds.

let db: PGlite;
let H = '';
let H2 = '';
const OWNER = '60000000-0000-4000-8000-0000000000a1';
const OTHER = '60000000-0000-4000-8000-0000000000a2';
const MAIN = '60000000-0000-4000-8000-0000000000b1';
const SAVE = '60000000-0000-4000-8000-0000000000b2';
const ONLY = '60000000-0000-4000-8000-0000000000b3';
const GONE = '60000000-0000-4000-8000-0000000000b4';
const FOREIGN = '60000000-0000-4000-8000-0000000000c1';

const split = (o: { full: boolean; amount: number; your: number; people: { name: string; share: number; paid?: boolean; into?: string }[] }) =>
  JSON.stringify({ split: { isSplit: true, totalAmount: o.amount, yourShare: o.your, paidBy: 'me', ...(o.full ? { fullDebit: true } : {}),
    participants: [{ name: 'You', isYou: true, share: o.your, paid: true },
      ...o.people.map(p => ({ name: p.name, share: p.share, paid: !!p.paid, ...(p.into ? { paidInto: p.into, paidOn: '2026-10-20' } : {}) }))] } });

type Outcome = { ok: true; rows: Record<string, unknown>[] } | { ok: false; code: string; message: string };
async function run(sql: string, params: unknown[] = [], asOwner = false): Promise<Outcome> {
  await db.exec('begin');
  try {
    if (asOwner) {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: OWNER, role: 'authenticated' })]);
      await db.exec('set local role authenticated');
    }
    const r = await db.query<Record<string, unknown>>(sql, params);
    await db.exec('rollback');
    return { ok: true, rows: r.rows };
  } catch (e) {
    await db.exec('rollback');
    const err = e as { code?: string; message?: string };
    return { ok: false, code: err.code ?? '?', message: err.message ?? String(e) };
  }
}
const insertSplit = (id: string, account: string, extras: string) =>
  `insert into transactions (id, household_id, created_by, type, amount, currency, date, description, category, account_id, extras)
   values ('${id}', '${H}', '${OWNER}', 'expense', (('${extras}')::jsonb -> 'split' ->> 'totalAmount')::numeric, 'INR', '2026-10-15',
           'Dinner', 'food_dining', '${account}', '${extras}'::jsonb)`;
const balance = async (id: string) => Number((await db.query<{ b: string }>(`select account_ledger_balance($1) b`, [id])).rows[0].b);

beforeAll(async () => {
  ({ db } = await replayMigrations());
  await db.exec(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    ('${OWNER}', 'owner@vyact.test', now(), '{"display_name": "owner"}'::jsonb),
    ('${OTHER}', 'other@vyact.test', now(), '{"display_name": "other"}'::jsonb)`);
  H = (await db.query<{ id: string }>(`select id from households where created_by = $1`, [OWNER])).rows[0].id;
  H2 = (await db.query<{ id: string }>(`select id from households where created_by = $1`, [OTHER])).rows[0].id;
  await db.exec(`insert into accounts (id, household_id, kind, name, currency, opening_balance) values
    ('${MAIN}', '${H}', 'bank', 'HDFC', 'INR', 5000), ('${SAVE}', '${H}', 'bank', 'Savings', 'INR', 0),
    ('${ONLY}', '${H}', 'bank', 'Wallet app', 'INR', 0), ('${GONE}', '${H}', 'bank', 'Old', 'INR', 0),
    ('${FOREIGN}', '${H2}', 'bank', 'Theirs', 'INR', 0);`);
  await db.exec([
    insertSplit('70000000-0000-4000-8000-000000000001', MAIN,
      split({ full: true, amount: 900, your: 300, people: [{ name: 'Ann', share: 300, paid: true, into: SAVE }, { name: 'Bo', share: 300 }] })),
    insertSplit('70000000-0000-4000-8000-000000000002', MAIN,
      split({ full: false, amount: 600, your: 200, people: [{ name: 'Cy', share: 400 }] })),
    insertSplit('70000000-0000-4000-8000-000000000003', SAVE,
      split({ full: true, amount: 300, your: 200, people: [{ name: 'Di', share: 100, paid: true }] })),
    insertSplit('70000000-0000-4000-8000-000000000004', MAIN,
      split({ full: true, amount: 400, your: 200, people: [{ name: 'Ed', share: 200, paid: true, into: ONLY }] })),
  ].join(';\n'));
}, 180_000);
afterAll(async () => { await db?.close(); });

describe('the server folds a split as the app does (FE-MNY-08)', () => {
  it('Q6-SQL-001 · full debit, repayments into the named account (else the paying one), an older split at your share', async () => {
    // HDFC: 5000 − 900 (full) − 200 (older split, your share) − 400 (full) = 3500.
    expect(await balance(MAIN)).toBe(3500);
    // Savings: + 300 (Ann paid back into it) − 300 (a full split it paid) + 100 (Di, no account named: the paying one).
    expect(await balance(SAVE)).toBe(100);
    expect(await balance(ONLY)).toBe(200);
    // The app's fold on the same rows says the same.
    const rows = (await db.query(`select * from transactions where household_id = $1 and deleted_at is null`, [H])).rows;
    const txns = txnsFromRows(rows);
    const acct = (id: string, opening: number): Account => ({ id, kind: 'bank', name: id, currency: 'INR', openingBalance: opening }) as Account;
    for (const [id, opening] of [[MAIN, 5000], [SAVE, 0], [ONLY, 0]] as const)
      expect(computeAccountBalance(acct(id, opening), txns, 'INR', {}), id).toBe(await balance(id));
  });
});

describe('a repayment link is an account link (FE-MNY-08)', () => {
  it('Q6-SQL-002 · it names this household\'s account, and a new one a live account; an old one on a deleted account still edits', async () => {
    const foreign = await run(insertSplit('70000000-0000-4000-8000-000000000010', MAIN,
      split({ full: true, amount: 200, your: 100, people: [{ name: 'Fi', share: 100, paid: true, into: FOREIGN }] })));
    expect(foreign).toMatchObject({ ok: false, code: '23503' });
    if (!foreign.ok) expect(foreign.message).toMatch(/split receipt account belongs to a different household/);
    expect(await run(insertSplit('70000000-0000-4000-8000-000000000011', MAIN,
      split({ full: true, amount: 200, your: 100, people: [{ name: 'Fi', share: 100, paid: true, into: 'cash' }] }))))
      .toMatchObject({ ok: false, code: '23503' });
    // A receipt into an account that is then deleted: the old entry still edits; a NEW receipt into it is refused.
    await db.exec(insertSplit('70000000-0000-4000-8000-000000000012', MAIN,
      split({ full: true, amount: 200, your: 100, people: [{ name: 'Gu', share: 100, paid: true, into: GONE }] })));
    await db.exec(`update accounts set deleted_at = now() where id = '${GONE}'`);
    expect(await run(`update transactions set description = 'Lunch' where id = '70000000-0000-4000-8000-000000000012'`)).toMatchObject({ ok: true });
    const fresh = await run(insertSplit('70000000-0000-4000-8000-000000000013', MAIN,
      split({ full: true, amount: 200, your: 100, people: [{ name: 'Ho', share: 100, paid: true, into: GONE }] })));
    expect(fresh).toMatchObject({ ok: false, code: '23503' });
    if (!fresh.ok) expect(fresh.message).toMatch(/^account_deleted/);
  });

  it('Q6-SQL-003 · an account a repayment came into is in use: delete_account refuses it', async () => {
    const deps = await run(`select account_dependencies($1) d`, [ONLY], true);
    expect(deps.ok && (deps.rows[0].d as { transactions: { count: number } }).transactions.count).toBe(1);
    expect(await run(`select delete_account($1)`, [ONLY], true)).toMatchObject({ ok: false, code: '23503' });
  });

  it('Q6-SQL-004 · moving an account carries its repayments, and no balance or total moves', async () => {
    const before = (await balance(MAIN)) + (await balance(ONLY));
    await db.exec('begin');
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: OWNER, role: 'authenticated' })]);
    const r = (await db.query<{ r: { receipts: number } }>(`select move_account_and_delete($1, $2) r`, [ONLY, MAIN])).rows[0].r;
    expect(r.receipts).toBe(1);
    expect(await balance(MAIN)).toBe(before);
    const into = (await db.query<{ p: string }>(`select x ->> 'paidInto' p from transactions t,
      jsonb_array_elements(t.extras -> 'split' -> 'participants') x where t.id = '70000000-0000-4000-8000-000000000004' and x ->> 'name' = 'Ed'`)).rows[0].p;
    expect(into).toBe(MAIN);
    await db.exec('rollback');
  });
});
