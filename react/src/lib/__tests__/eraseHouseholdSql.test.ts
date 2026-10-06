import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// W0 (audit 2026-10-04, DB-INT-05) — erase_household_data used to end with an
// activity_log row whose action the table's CHECK rejects, so every erase rolled back.
// Focused PGlite fixture: only the tables the function touches, with the real
// activity_log CHECK from the baseline.

const db = new PGlite();
const owner = '10000000-0000-4000-8000-000000000001';
const member = '10000000-0000-4000-8000-000000000002';
const household = '20000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';

const ledgerTables = ['transactions', 'budgets', 'budget_allocations', 'goals', 'debts', 'assets',
  'accounts', 'recurring_schedules', 'saved_views', 'net_worth_snapshots'];

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table households (id uuid primary key, onboarding jsonb not null default '{}'::jsonb);
    create table memberships (household_id uuid, user_id uuid, role text);
    ${ledgerTables.map(t => `create table ${t} (id uuid primary key default gen_random_uuid(), household_id uuid);`).join('\n')}
    create table activity_log (
      id uuid primary key default gen_random_uuid(), household_id uuid not null, actor_id uuid,
      action text not null check (action in ('created','updated','deleted','invited','accepted','removed','role_changed','transferred')),
      entity_type text not null, entity_id uuid, changes jsonb, created_at timestamptz not null default now());
    insert into households values ('${household}', '{"step":3}'), ('${other}', '{}');
    insert into memberships values ('${household}','${owner}','owner'), ('${household}','${member}','member');
  `);
  await db.exec(readFileSync(new URL('../../../../supabase/migrations/20261008120000_w0_erase_household_data_commits.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(async () => { await db.close(); });

beforeEach(async () => {
  for (const t of ledgerTables) {
    await db.exec(`delete from ${t}; insert into ${t}(household_id) values ('${household}'), ('${other}');`);
  }
  await db.exec(`delete from activity_log;
    insert into activity_log(household_id, action, entity_type) values ('${household}','created','transaction'), ('${other}','created','transaction');
    update households set onboarding = '{"step":3}' where id = '${household}';`);
});

const asUser = (uid: string) => db.exec(`select set_config('request.jwt.claim.sub','${uid}',false)`);
const count = async (table: string, hid: string) =>
  (await db.query<{ n: number }>(`select count(*)::int as n from ${table} where household_id = $1`, [hid])).rows[0].n;

describe('erase_household_data (W0 · DB-INT-05)', () => {
  it('CON-UNIT-W0-001 - the old audit action is exactly what the activity_log CHECK rejects', async () => {
    await expect(db.exec(`insert into activity_log(household_id, action, entity_type)
      values ('${household}','erase_household_data','household')`)).rejects.toThrow(/check/i);
  });

  it('CON-UNIT-W0-002 - an owner erase commits: every ledger table is emptied and one audit row remains', async () => {
    await asUser(owner);
    await db.query('select erase_household_data($1)', [household]);
    for (const t of ledgerTables) expect(await count(t, household)).toBe(0);
    const log = await db.query<{ action: string; changes: { kind: string } }>(
      'select action, changes from activity_log where household_id = $1', [household]);
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0].action).toBe('deleted');
    expect(log.rows[0].changes.kind).toBe('erase_household_data');
    const onboarding = await db.query<{ onboarding: object }>('select onboarding from households where id = $1', [household]);
    expect(onboarding.rows[0].onboarding).toEqual({});
  });

  it('CON-UNIT-W0-003 - another household is untouched', async () => {
    await asUser(owner);
    await db.query('select erase_household_data($1)', [household]);
    for (const t of ledgerTables) expect(await count(t, other)).toBe(1);
    expect(await count('activity_log', other)).toBe(1);
  });

  it('CON-UNIT-W0-004 - a plain member is refused and nothing is erased', async () => {
    await asUser(member);
    await expect(db.query('select erase_household_data($1)', [household])).rejects.toThrow(/not authorized/);
    for (const t of ledgerTables) expect(await count(t, household)).toBe(1);
  });
});
