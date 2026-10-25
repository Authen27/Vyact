import type { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR, replayMigrations } from './helpers/replayMigrations';

// Q3A-001..014 — v10.130.0 (Track Q3a; audit DB-SEC-03, DB-OPS-03, DB-OPS-16, ADM-04, ADM-05, ADM-06, ADM-08,
// ADM-10, ADM-11, ADM-14, FE-PUB-08, DB-INT-13, DB-INT-14, INT-TXN-14, INT-HH-08, INT-HH-14, DB-OPS-09; owner
// decisions 20 Oct 2026). What the Q3a migrations do beyond who-can-do-what (authzMatrixSql), on the schema every
// migration builds.

let db: PGlite;
let H = '';
const OWNER = '20000000-0000-4000-8000-0000000000a1';
const MEMBER = '20000000-0000-4000-8000-0000000000a2';
const SUPER = '20000000-0000-4000-8000-0000000000c1';
const SUPER2 = '20000000-0000-4000-8000-0000000000c2';
const CONTENT = '20000000-0000-4000-8000-0000000000c3';
const ROLES = '20000000-0000-4000-8000-0000000000c4';
const PLAIN = '20000000-0000-4000-8000-0000000000d1';

type Row = Record<string, unknown>;
type Outcome = { ok: true; rows: Row[] } | { ok: false; code: string; message: string };

/** One statement as a signed-in user (or the service role), always rolled back unless `keep`; `pre` runs first, in it. */
async function as(uid: string | 'service', sql: string, params: unknown[] = [], keep = false, pre = ''): Promise<Outcome> {
  await db.exec('begin');
  try {
    if (uid === 'service') {
      await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', true); set local role service_role`);
    } else {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await db.exec('set local role authenticated');
    }
    if (pre) await db.exec(pre);
    const r = await db.query<Row>(sql, params);
    await db.exec(keep ? 'commit' : 'rollback');
    return { ok: true, rows: r.rows };
  } catch (e) {
    await db.exec('rollback');
    const err = e as { code?: string; message?: string };
    return { ok: false, code: err.code ?? '?', message: err.message ?? String(e) };
  }
}
const rows = async <T = Row>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
const migration = (name: string) => {
  const file = readdirSync(MIGRATIONS_DIR).find(f => f.endsWith(`_${name}.sql`));
  if (!file) throw new Error(`no migration ${name}`);
  return readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8');
};

beforeAll(async () => {
  ({ db } = await replayMigrations());
  const users = [[OWNER, 'owner'], [MEMBER, 'member'], [SUPER, 'super'], [SUPER2, 'super2'], [CONTENT, 'content'], [ROLES, 'roles'], [PLAIN, 'plain']];
  await db.exec(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    ${users.map(([id, n]) => `('${id}', '${n}@vyact.test', now(), '{"display_name": "${n}"}'::jsonb)`).join(', ')}`);
  H = (await rows<{ id: string }>(`select id from households where created_by = $1`, [OWNER]))[0].id;
  await db.exec(`update households set type = 'family' where id = '${H}';
    insert into memberships (household_id, user_id, role, display_name) values ('${H}', '${MEMBER}', 'member', 'member');
    insert into admin_roles (user_id, role) values ('${SUPER}', 'super'), ('${CONTENT}', 'content'), ('${ROLES}', 'roles');`);
}, 180_000);
afterAll(async () => { await db?.close(); });

describe('the staff audit trail (ADM-04)', () => {
  it('Q3A-001 · a super admin grants and revokes roles; each change is recorded with who made it', async () => {
    expect((await as(SUPER, `select grant_admin_role($1, 'content')`, [PLAIN], true)).ok).toBe(true);
    expect((await as(SUPER, `select grant_admin_role($1, 'roles')`, [PLAIN], true)).ok).toBe(true);
    expect((await as(SUPER, `select revoke_admin_role($1) as gone`, [PLAIN], true))).toMatchObject({ ok: true, rows: [{ gone: true }] });
    // Revoking someone with no role says so, and records nothing.
    expect((await as(SUPER, `select revoke_admin_role($1) as gone`, [PLAIN]))).toMatchObject({ ok: true, rows: [{ gone: false }] });
    const trail = await rows<{ actor_id: string; action: string; target_id: string; changed: string[]; detail: Row }>(
      `select actor_id, action, target_id, changed, detail from admin_audit where target_table = 'admin_roles' and target_id = $1 order by id`, [PLAIN]);
    expect(trail).toEqual([
      { actor_id: SUPER, action: 'insert', target_id: PLAIN, changed: [], detail: { role_after: 'content' } },
      { actor_id: SUPER, action: 'update', target_id: PLAIN, changed: ['granted_at', 'role'], detail: { role_before: 'content', role_after: 'roles' } },
      { actor_id: SUPER, action: 'delete', target_id: PLAIN, changed: [], detail: { role_before: 'roles' } },
    ]);
    // Only super admins grant or revoke, and only to real people and real roles.
    for (const who of [CONTENT, ROLES, OWNER]) {
      expect(await as(who, `select grant_admin_role($1, 'super')`, [who])).toMatchObject({ ok: false, code: '42501' });
    }
    expect(await as(SUPER, `select grant_admin_role($1, 'owner')`, [PLAIN])).toMatchObject({ ok: false, code: '22023' });
    expect(await as(SUPER, `select grant_admin_role(gen_random_uuid(), 'content')`)).toMatchObject({ ok: false, code: 'P0002' });
  });

  it('Q3A-002 · the last super admin can be neither demoted nor removed', async () => {
    expect(await as(SUPER, `select revoke_admin_role($1)`, [SUPER])).toMatchObject({ ok: false, message: expect.stringMatching(/last_super_admin/) });
    expect(await as(SUPER, `select grant_admin_role($1, 'content')`, [SUPER])).toMatchObject({ ok: false, message: expect.stringMatching(/last_super_admin/) });
    // With a second super admin, either can step down.
    expect((await as(SUPER, `select grant_admin_role($1, 'super')`, [SUPER2])).ok).toBe(true);
    await db.exec(`insert into admin_roles (user_id, role) values ('${SUPER2}', 'super')`);
    expect((await as(SUPER, `select revoke_admin_role($1)`, [SUPER])).ok).toBe(true);   // rolled back
    await db.exec(`delete from admin_roles where user_id = '${SUPER2}'`);
  });

  it('Q3A-003 · content, needs/wants and model changes are recorded without their text; nobody can edit the trail', async () => {
    await db.exec(`insert into content_items (id, slug, title, body, topic, author_name, status)
      values ('30000000-0000-4000-8000-000000000001', 'q3a-item', 'T', 'Secret body text', 'budgeting', 'Vyact', 'draft')`);
    expect((await as(CONTENT, `update content_items set body = 'New body', status = 'published' where slug = 'q3a-item' returning 1`, [], true)).ok).toBe(true);
    await db.exec(`insert into category_classifications (category, classification) values ('q3a_cat', 'need');
      update category_classifications set classification = 'want' where category = 'q3a_cat';`);
    const content = await rows<{ actor_id: string; changed: string[]; detail: Row }>(
      `select actor_id, changed, detail from admin_audit where target_table = 'content_items' and action = 'update'`);
    expect(content).toEqual([{ actor_id: CONTENT, changed: ['body', 'status'], detail: { slug: 'q3a-item', status_before: 'draft', status_after: 'published' } }]);
    expect(JSON.stringify(await rows(`select * from admin_audit`))).not.toMatch(/Secret body|New body/);
    // A change with no signed-in user (the dashboard, a migration) has no actor.
    const cc = await rows<{ actor_id: string | null; detail: Row }>(
      `select actor_id, detail from admin_audit where target_table = 'category_classifications' and action = 'update'`);
    expect(cc).toEqual([{ actor_id: null, detail: { before: 'need', after: 'want' } }]);
    // Append-only for everyone, the database owner included.
    await expect(db.exec(`update admin_audit set target_id = 'x'`)).rejects.toThrow(/append_only/);
    await expect(db.exec(`delete from admin_audit`)).rejects.toThrow(/append_only/);
  });

  it('Q3A-004 · super admins read the trail newest first, with the actor\'s email; nobody else reads it', async () => {
    const r = await as(SUPER, `select actor_email, target_table from admin_staff_audit(2, null)`);
    expect(r).toMatchObject({ ok: true, rows: [{ target_table: 'category_classifications' }, { target_table: 'category_classifications' }] });
    const all = await as(SUPER, `select actor_email from admin_staff_audit(500, null) where target_table = 'admin_roles' and actor_email is not null limit 1`);
    expect(all).toMatchObject({ ok: true, rows: [{ actor_email: 'super@vyact.test' }] });
    for (const who of [ROLES, CONTENT, OWNER]) expect((await as(who, `select * from admin_staff_audit(10, null)`)).ok).toBe(false);
    expect(await as(SUPER, `select * from admin_audit`)).toMatchObject({ ok: false, code: '42501' });
  });
});

describe('admin lists page on the server (ADM-08, INT-HH-14)', () => {
  it('Q3A-005 · users and households come a page at a time, with the total, a search and real member counts', async () => {
    const page = await as(ROLES, `select email, total from admin_list_users_page(2, 0, null)`);
    expect(page.ok && page.rows.length).toBe(2);
    expect(page.ok && Number(page.rows[0].total)).toBe(7);
    const next = await as(ROLES, `select email from admin_list_users_page(2, 6, null)`);
    expect(next.ok && next.rows.length).toBe(1);
    expect(await as(ROLES, `select email from admin_list_users_page(10, 0, 'MEMB')`)).toMatchObject({ ok: true, rows: [{ email: 'member@vyact.test' }] });
    const hh = await as(ROLES, `select member_count, total from admin_list_households(50, 0, null) where id = $1`, [H]);
    expect(hh).toMatchObject({ ok: true, rows: [{ member_count: 2, total: 7 }] });
    // A page holds 1 to 500 rows, and a negative offset starts at the first.
    expect((await as(ROLES, `select count(*)::int n from admin_list_users_page(100000, -5, null)`))).toMatchObject({ ok: true, rows: [{ n: 7 }] });
    expect((await as(ROLES, `select count(*)::int n from admin_list_households(0, 0, null)`))).toMatchObject({ ok: true, rows: [{ n: 1 }] });
    // The pages' headline counts, from the server (they were counted from the truncated list).
    const s = await as(ROLES, `select admin_people_summary() as s`);
    expect(s.ok && s.rows[0].s).toEqual({
      users: { total: 7, confirmed: 7, admins: 3, multiHousehold: 1 },
      households: { total: 7, multiMember: 1, byType: { family: 1, personal: 6 } },
    });
  });
});

describe('WhatsApp picks the account it names (DB-INT-13), refuses a loan payment as an expense, and is named in the log (INT-TXN-14)', () => {
  const log = (alias: string | null, msg: string, category = 'groceries', type = 'expense') =>
    as('service', `select whatsapp_log_transaction($1, $2, 120, 'USD', $3, $4, $5, null, $6, 'test') as r`,
      [OWNER, H, type, category, alias, msg]);

  it('Q3A-006 · "bank" with two bank accounts: the default; with none default, the oldest; a name match first', async () => {
    await db.exec(`
      insert into accounts (id, household_id, kind, name, currency, created_at) values
        ('40000000-0000-4000-8000-000000000001', '${H}', 'bank', 'Old Bank', 'USD', now() - interval '2 days'),
        ('40000000-0000-4000-8000-000000000002', '${H}', 'bank', 'New Bank', 'USD', now() - interval '1 day'),
        ('40000000-0000-4000-8000-000000000003', '${H}', 'bank', 'bank', 'USD', now())`);
    // An account literally named "bank" wins over the kind.
    expect(await log('bank', 'wa-1')).toMatchObject({ ok: true, rows: [{ r: { status: 'success', account_name: 'bank' } }] });
    await db.exec(`update accounts set name = 'Third Bank' where id = '40000000-0000-4000-8000-000000000003'`);
    expect(await log('bank', 'wa-2')).toMatchObject({ ok: true, rows: [{ r: { status: 'success', account_name: 'Old Bank' } }] });
    await db.exec(`update accounts set is_default = true where id = '40000000-0000-4000-8000-000000000002'`);
    expect(await log('bank', 'wa-3')).toMatchObject({ ok: true, rows: [{ r: { status: 'success', account_name: 'New Bank' } }] });
  });

  it('Q3A-007 · a Loan / EMI expense is refused (it must pay the loan)', async () => {
    expect(await log('bank', 'wa-4', 'loan_emi')).toMatchObject({ ok: true, rows: [{ r: { status: 'error', reason: 'loan_emi_needs_loan' } }] });
  });

  it('Q3A-008 · the log names the person a WhatsApp entry came from; a job has no actor; a signed-in user wins', async () => {
    const r = await as('service', `select whatsapp_log_transaction($1, $2, 50, 'USD', 'expense', 'groceries', 'bank', null, 'wa-5', 'kept') as r`, [MEMBER, H], true);
    const txn = r.ok ? (r.rows[0].r as { transaction_id: string }).transaction_id : '';
    expect(await rows(`select actor_id, action from activity_log where entity_id = $1`, [txn])).toEqual([{ actor_id: MEMBER, action: 'created' }]);
    // The setting lasts for its transaction only: a server write afterwards (a job) names nobody.
    await as('service', `update transactions set description = 'job' where id = $1`, [txn], true);
    expect(await rows(`select actor_id, action from activity_log where entity_id = $1 order by created_at, id`, [txn]))
      .toEqual([{ actor_id: MEMBER, action: 'created' }, { actor_id: null, action: 'updated' }]);
    const signedIn = await as(OWNER, `update transactions set description = 'owner' where id = $1 returning 1`, [txn], true,
      `select set_config('vyact.actor', '${MEMBER}', true)`);
    expect(signedIn).toMatchObject({ ok: true });
    expect((await rows<{ actor_id: string }>(`select actor_id from activity_log where entity_id = $1 order by created_at desc, id desc limit 1`, [txn]))[0].actor_id).toBe(OWNER);
  });

  it('Q3A-009 · a soft delete is logged as deleted', async () => {
    const t = (await rows<{ id: string }>(`select id from transactions where description = 'owner'`))[0].id;
    await as(OWNER, `update transactions set deleted_at = now() where id = $1`, [t], true);
    expect((await rows<{ action: string }>(`select action from activity_log where entity_id = $1 order by created_at desc, id desc limit 1`, [t]))[0].action).toBe('deleted');
  });
});

describe('money rules and per-person language (DB-INT-14, INT-HH-08)', () => {
  it('Q3A-010 · a transfer to the same account and a negative budget line are refused, for new rows', async () => {
    await expect(db.exec(`insert into transactions (household_id, type, amount, currency, date, description, account_id, to_account_id)
      values ('${H}', 'transfer', 5, 'USD', current_date, 'x', '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001')`))
      .rejects.toThrow(/ck_txn_transfer_accounts_differ/);
    const b = (await rows<{ id: string }>(`insert into budgets (household_id, monthly_limit, scope, period, period_year, period_month)
      values ('${H}', 100, 'month', 'monthly', 2026, 11) returning id`))[0].id;
    await expect(db.exec(`insert into budget_allocations (budget_id, household_id, category, amount) values ('${b}', '${H}', 'dining', -1)`))
      .rejects.toThrow(/ck_balloc_amount_not_negative/);
    // NOT VALID: a row that broke a rule before this migration cannot fail the deploy.
    expect(await rows(`select conname, convalidated from pg_constraint where conname in ('ck_txn_transfer_accounts_differ', 'ck_balloc_amount_not_negative') order by 1`))
      .toEqual([{ conname: 'ck_balloc_amount_not_negative', convalidated: false }, { conname: 'ck_txn_transfer_accounts_differ', convalidated: false }]);
  });

  it('Q3A-011 · a person\'s language is unset until they choose one (then the household\'s applies)', async () => {
    expect(await rows(`select is_nullable, column_default from information_schema.columns where table_name = 'profiles' and column_name = 'language'`))
      .toEqual([{ is_nullable: 'YES', column_default: null }]);
    expect(await rows(`select count(*)::int n from profiles where language is not null`)).toEqual([{ n: 0 }]);
    expect((await as(MEMBER, `update profiles set language = 'hi' where id = $1 returning language`, [MEMBER])))
      .toMatchObject({ ok: true, rows: [{ language: 'hi' }] });
  });
});

describe('staff tiers and public content (ADM-05, ADM-06, ADM-10, ADM-11, ADM-14, FE-PUB-08)', () => {
  it('Q3A-012 · per-person AI usage is for super admins; MRR comes per currency', async () => {
    await db.exec(`insert into ai_usage (household_id, user_id, source, intent) values ('${H}', '${OWNER}', 'client', 'spend.total')`);
    const segments = async (who: string) => {
      const r = await as(who, `select admin_ai_usage_summary() -> 'segments' as s`);
      return r.ok ? (r.rows[0].s as unknown[]).length : r.message;
    };
    expect(await segments(SUPER)).toBe(1);
    expect(await segments(CONTENT)).toBe(0);
    await db.exec(`insert into subscriptions (user_id, tier, status, monthly_amount, currency) values
      ('${OWNER}', 'family', 'active', 999, 'INR'), ('${MEMBER}', 'premium', 'trialing', 12, 'usd'),
      ('${PLAIN}', 'premium', 'canceled', 50, 'USD'), ('${SUPER}', 'free', 'active', 0, 'USD')`);
    const k = await as(ROLES, `select admin_dashboard_kpis() as k`);
    const kpis = k.ok ? k.rows[0].k as Row : {};
    expect(kpis.mrrByCurrency).toEqual({ INR: 999, USD: 12 });
    expect(kpis.paidSubscriptions).toBe(2);
    expect(kpis).not.toHaveProperty('mrr');
  });

  it('Q3A-013 · signed out, only the public columns of content; every column react/api asks for is one of them', async () => {
    const granted = (await rows<{ column_name: string }>(`select column_name from information_schema.column_privileges
      where table_name = 'content_items' and grantee = 'anon' and privilege_type = 'SELECT'`)).map(r => r.column_name);
    for (const file of ['learn.js', 'sitemap.js', 'llms.js', 'v.js']) {
      const src = readFileSync(new URL(`../../../api/${file}`, import.meta.url), 'utf8');
      const cols = new Set<string>();
      for (const m of src.matchAll(/const (?:LESSON|LIST)_COLS = '([^']+)'/g)) m[1].split(',').forEach(c => cols.add(c));
      for (const m of src.matchAll(/select=([a-z_,]+)/g)) m[1].split(',').forEach(c => cols.add(c));
      for (const m of src.matchAll(/[?&]([a-z_]+)=(?:eq|like)\./g)) cols.add(m[1]);
      for (const m of src.matchAll(/order=([a-z_]+)\./g)) cols.add(m[1]);
      cols.delete('');
      expect([...cols].filter(c => !granted.includes(c)), file).toEqual([]);
    }
    await db.exec(`insert into content_items (slug, title, body, topic, author_name, author_id, status) values
      ('q3a-public', 'Public', 'Body', 'budgeting', 'Vyact', '${OWNER}', 'published')`);
    await db.exec('begin; set local role anon');
    try {
      expect((await db.query(`select slug, title from content_items where slug = 'q3a-public'`)).rows).toEqual([{ slug: 'q3a-public', title: 'Public' }]);
    } finally { await db.exec('rollback'); }
    for (const col of ['author_id', 'author_name', 'body', 'id']) {
      await db.exec('begin; set local role anon');
      await expect(db.query(`select ${col} from content_items where slug = 'q3a-public'`)).rejects.toThrow(/permission denied/);
      await db.exec('rollback');
    }
  });

  it('Q3A-014 · the image bucket takes images up to 5 MB; an email byline becomes "Vyact"; needs/wants ids look like ids', async () => {
    expect(await rows(`select allowed_mime_types, file_size_limit from storage.buckets where id = 'insight-infographics'`))
      .toEqual([{ allowed_mime_types: ['image/png', 'image/jpeg', 'image/webp'], file_size_limit: 5242880 }]);
    await db.exec(`insert into content_items (slug, title, body, topic, author_name) values ('q3a-email', 'E', 'B', 'budgeting', 'editor@vyact.test')`);
    await db.exec(migration('q3a_public_content'));   // the backfill, as it ran in production
    expect(await rows(`select author_name from content_items where slug = 'q3a-email'`)).toEqual([{ author_name: 'Vyact' }]);
    await expect(db.exec(`insert into category_classifications (category, classification) values ('Dining Out', 'want')`)).rejects.toThrow(/ck_cc_category_id/);
  });
});

describe('production-only objects and indexes (DB-OPS-03, DB-OPS-16, DB-OPS-09)', () => {
  it('Q3A-015 · the v9 backups go; pg_trgm goes only when nothing uses it', async () => {
    await db.exec(`create table public._backup_v9_transactions (id int); create extension pg_trgm;
      create table public.q3a_trgm (x text); create index q3a_trgm_ix on public.q3a_trgm using gin (x gin_trgm_ops);`);
    await db.exec(migration('q3a_production_only_objects'));
    expect(await rows(`select relname from pg_class where relname like '\\_backup\\_v9\\_%'`)).toEqual([]);
    expect(await rows(`select extname from pg_extension where extname = 'pg_trgm'`)).toEqual([{ extname: 'pg_trgm' }]);   // an index uses it
    await db.exec(`drop table public.q3a_trgm`);
    await db.exec(migration('q3a_production_only_objects'));
    expect(await rows(`select extname from pg_extension where extname = 'pg_trgm'`)).toEqual([]);
    expect(await rows(`select relrowsecurity from pg_class where relname = 'migration_issues'`)).toEqual([{ relrowsecurity: true }]);
  });

  it('Q3A-016 · the hot lookups are indexed, and no index exists twice', async () => {
    const idx = (await rows<{ i: string }>(`select indexrelid::regclass::text as i from pg_index
      where indrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)`)).map(r => r.i);
    for (const want of ['ix_txn_account', 'ix_txn_to_account', 'ix_debts_funding_account', 'ix_accounts_debt', 'ix_invitations_household',
      'ix_loan_events_household', 'ix_ai_feedback_household', 'ix_wa_inbound_household', 'ix_wa_inbound_profile']) {
      expect(idx, want).toContain(want);
    }
    expect(await rows(`select indrelid::regclass::text t, array_agg(indexrelid::regclass::text order by 1) idx from pg_index
      where indrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)
      group by indrelid, indkey::text, coalesce(pg_get_expr(indpred, indrelid), ''), indexprs::text having count(*) > 1`)).toEqual([]);
  });
});
