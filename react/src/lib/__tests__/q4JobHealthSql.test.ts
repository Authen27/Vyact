import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { replayMigrations } from './helpers/replayMigrations';

// Q4-SQL-001..008 — v10.132.0 (Track Q4; audit OPS-06, DB-OPS-08; owner decision D9, 20 Oct 2026). Every scheduled
// job leaves a row in job_runs; job_health() says which job failed, keeps half-failing, or stopped; the hourly
// job-health check claims one email per job and problem a day. On the schema every migration builds.

let db: PGlite;
const OWNER = '40000000-0000-4000-8000-0000000000a1';
const ROLES = '40000000-0000-4000-8000-0000000000c4';
const CONTENT = '40000000-0000-4000-8000-0000000000c3';

type Row = Record<string, unknown>;
type Outcome = { ok: true; rows: Row[] } | { ok: false; code: string; message: string };

/** One statement as a signed-in user (or the service role), always rolled back. */
async function as(uid: string | 'service', sql: string, params: unknown[] = []): Promise<Outcome> {
  await db.exec('begin');
  try {
    if (uid === 'service') {
      await db.exec(`select set_config('request.jwt.claims', '{"role":"service_role"}', true); set local role service_role`);
    } else {
      await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: 'authenticated' })]);
      await db.exec('set local role authenticated');
    }
    const r = await db.query<Row>(sql, params);
    await db.exec('rollback');
    return { ok: true, rows: r.rows };
  } catch (e) {
    await db.exec('rollback');
    const err = e as { code?: string; message?: string };
    return { ok: false, code: err.code ?? '?', message: err.message ?? String(e) };
  }
}
const rows = async <T = Row>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows;
/** Runs `body` in a transaction that is always rolled back, as the database owner. */
async function rolledBack<T>(body: () => Promise<T>): Promise<T> {
  await db.exec('begin');
  try { return await body(); } finally { await db.exec('rollback'); }
}
const health = () => rows<{ job: string; problem: string | null; last_status: string | null; runs_24h: number; failed_24h: number }>(
  `select job, problem, last_status, runs_24h, failed_24h from job_health()`);
const problems = async () => Object.fromEntries((await health()).filter(r => r.problem).map(r => [r.job, r.problem]));

beforeAll(async () => {
  ({ db } = await replayMigrations());
  await db.exec(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    ('${OWNER}', 'owner@vyact.test', now(), '{"display_name": "owner"}'::jsonb),
    ('${ROLES}', 'roles@vyact.test', now(), '{"display_name": "roles"}'::jsonb),
    ('${CONTENT}', 'content@vyact.test', now(), '{"display_name": "content"}'::jsonb);
    insert into admin_roles (user_id, role) values ('${ROLES}', 'roles'), ('${CONTENT}', 'content');`);
}, 180_000);
afterAll(async () => { await db?.close(); });

describe('every scheduled run is recorded (OPS-06, DB-OPS-08)', () => {
  it('Q4-SQL-001 · record_job_run keeps counts and a short error, and only the server may call it', async () => {
    await rolledBack(async () => {
      const big = JSON.stringify({ blob: 'x'.repeat(5000) });
      await db.exec(`select record_job_run('recurring-post', now() - interval '5 seconds', 'partial', '{"posted": 2, "errors": 1}'::jsonb, repeat('e', 900));
        select record_job_run('web-push-dispatch', null, 'ok', '[1, 2]'::jsonb, '   ');
        select record_job_run('job-health', now(), 'ok', '${big}'::jsonb, null);`);
      const got = await rows<{ job: string; status: string; summary: Row; error: string | null; ordered: boolean }>(
        `select job, status, summary, error, finished_at >= started_at as ordered from job_runs order by id`);
      expect(got.map(r => [r.job, r.status, r.summary, r.error?.length ?? null, r.ordered])).toEqual([
        ['recurring-post', 'partial', { posted: 2, errors: 1 }, 500, true],
        ['web-push-dispatch', 'ok', {}, null, true],          // not an object: not kept; a blank error is no error
        ['job-health', 'ok', {}, null, true],                 // too large to be counts: not kept
      ]);
    });
    for (const bad of [`'recurring-post', now(), 'maybe'`, `'Recurring Post!', now(), 'ok'`]) {
      await rolledBack(() => expect(db.exec(`select record_job_run(${bad}, '{}'::jsonb, null)`)).rejects.toThrow(/check/));
    }
    // Nobody signed in may write or read a run.
    expect(await as(OWNER, `select record_job_run('recurring-post', now(), 'ok', '{}'::jsonb, null)`)).toMatchObject({ ok: false, code: '42501' });
    expect(await as(OWNER, `select * from job_runs`)).toMatchObject({ ok: false, code: '42501' });
    expect(await as(ROLES, `select * from job_alerts`)).toMatchObject({ ok: false, code: '42501' });
    expect(await as('service', `select record_job_run('recurring-post', now(), 'ok', '{}'::jsonb, null) as id`)).toMatchObject({ ok: true });
  });

  it('Q4-SQL-002 · the EMI job runs through its wrapper: ok with its counts, or failed with the error and nothing else kept', async () => {
    await rolledBack(async () => {
      expect((await rows<{ r: Row }>(`select run_loan_auto_record() as r`))[0].r).toEqual({ posted: 0, errors: 0 });
      // A run that throws: its writes roll back, the failure is kept.
      await db.exec(`create or replace function public.auto_record_due_emis(p_limit integer default 500) returns jsonb
        language plpgsql as $f$ begin insert into job_alerts (job, kind) values ('x', 'late'); raise exception 'ledger locked'; end $f$`);
      expect((await rows<{ r: Row }>(`select run_loan_auto_record() as r`))[0].r).toEqual({ status: 'failed' });
      expect(await rows(`select job, status, error from job_runs order by id`)).toEqual([
        { job: 'loan-auto-record', status: 'ok', error: null },
        { job: 'loan-auto-record', status: 'failed', error: 'ledger locked' },
      ]);
      expect(await rows(`select * from job_alerts`)).toEqual([]);
      // Some loans could not be paid: partial.
      await db.exec(`create or replace function public.auto_record_due_emis(p_limit integer default 500) returns jsonb
        language sql as $f$ select '{"posted": 3, "errors": 1}'::jsonb $f$`);
      await db.exec(`select run_loan_auto_record()`);
      expect((await rows<{ status: string }>(`select status from job_runs order by id desc limit 1`))[0].status).toBe('partial');
    });
  });

  it('Q4-SQL-003 · the daily retention job records its run and keeps 30 days of runs', async () => {
    await rolledBack(async () => {
      await db.exec(`insert into job_runs (job, started_at, status) values
        ('recurring-post', now() - interval '31 days', 'ok'), ('recurring-post', now() - interval '29 days', 'ok')`);
      const r = (await rows<{ r: Row }>(`select run_retention() as r`))[0].r;
      expect(r).toMatchObject({ messages: 0, job_runs: 1 });
      expect(await rows(`select job, status from job_runs order by started_at`)).toEqual([
        { job: 'recurring-post', status: 'ok' }, { job: 'whatsapp-retention', status: 'ok' },
      ]);
    });
  });
});

describe('job health (OPS-06)', () => {
  it('Q4-SQL-004 · failed, partly failing twice, and late are problems; nothing is late before recording starts', async () => {
    await rolledBack(async () => {
      // Nothing recorded yet: no job is late (recording has not started).
      expect(await problems()).toEqual({});
      expect((await health()).map(r => r.job)).toEqual([
        'job-health', 'loan-auto-record', 'recurring-post', 'web-push-dispatch', 'whatsapp-dispatch-alerts',
        'whatsapp-dispatch-bills', 'whatsapp-dispatch-digest', 'whatsapp-dispatch-monthly', 'whatsapp-dispatch-weekly',
        'whatsapp-inbox-sweep', 'whatsapp-retention']);
      await db.exec(`insert into job_runs (job, started_at, status) values
        ('web-push-dispatch', now() - interval '39 minutes', 'ok'),       -- 2 × 15 + 10 grace: not yet late
        ('whatsapp-inbox-sweep', now() - interval '21 minutes', 'ok'),    -- 2 × 5 + 10: late
        ('recurring-post', now() - interval '40 minutes', 'ok'),
        ('recurring-post', now() - interval '10 minutes', 'failed'),
        ('whatsapp-dispatch-alerts', now() - interval '20 minutes', 'partial'),
        ('whatsapp-dispatch-alerts', now() - interval '5 minutes', 'partial'),
        ('whatsapp-dispatch-digest', now() - interval '35 minutes', 'partial'),
        ('whatsapp-dispatch-digest', now() - interval '5 minutes', 'ok'),
        ('whatsapp-dispatch-bills', now() - interval '35 minutes', 'ok'),
        ('whatsapp-dispatch-bills', now() - interval '5 minutes', 'partial')`);
      // Recording started 40 minutes ago: a 30-minute job never recorded is not late yet (70 minutes).
      expect(await problems()).toEqual({
        'recurring-post': 'failed', 'whatsapp-dispatch-alerts': 'partial', 'whatsapp-inbox-sweep': 'late',
      });
      // Two hours on: every job that has not run since is late, a daily one only after two days.
      await db.exec(`update job_runs set started_at = started_at - interval '2 hours', finished_at = finished_at - interval '2 hours'`);
      const later = await problems();
      expect(later['loan-auto-record']).toBe('late');            // never recorded, counted from the first run anywhere
      expect(later['recurring-post']).toBe('late');               // late outranks its old failure
      expect(later['whatsapp-retention']).toBeUndefined();
      expect((await health()).find(r => r.job === 'recurring-post')).toMatchObject({ runs_24h: 2, failed_24h: 1, last_status: 'failed' });
    });
  });

  it('Q4-SQL-005 · one email per job and problem a day: claimed first, given back when the email fails', async () => {
    await rolledBack(async () => {
      const claim = async (job: string, kind: string) =>
        (await rows<{ c: boolean }>(`select claim_job_alert($1, $2) as c`, [job, kind]))[0].c;
      expect(await claim('recurring-post', 'failed')).toBe(true);
      expect(await claim('recurring-post', 'failed')).toBe(false);
      expect(await claim('recurring-post', 'late')).toBe(true);           // another problem is another email
      await db.exec(`select release_job_alert('recurring-post', 'failed')`);
      expect(await claim('recurring-post', 'failed')).toBe(true);
      await db.exec(`update job_alerts set last_sent_at = now() - interval '25 hours' where kind = 'late'`);
      expect(await claim('recurring-post', 'late')).toBe(true);
    });
    await rolledBack(() => expect(db.exec(`select claim_job_alert('recurring-post', 'flaky')`)).rejects.toThrow(/check/));
  });

  it('Q4-SQL-006 · the Health page reads job health and recent runs as the roles tier; others are refused', async () => {
    await db.exec(`select record_job_run('recurring-post', now(), 'ok', '{"posted": 1}'::jsonb, null)`);
    const page = await as(ROLES, `select job, last_status from admin_job_health() where job = 'recurring-post'`);
    expect(page).toEqual({ ok: true, rows: [{ job: 'recurring-post', last_status: 'ok' }] });
    expect(await as(ROLES, `select status, summary from admin_job_runs('recurring-post', 5)`))
      .toEqual({ ok: true, rows: [{ status: 'ok', summary: { posted: 1 } }] });
    for (const who of [CONTENT, OWNER]) {
      expect(await as(who, `select * from admin_job_health()`), who).toMatchObject({ ok: false, code: '42501' });
      expect(await as(who, `select * from admin_job_runs('recurring-post', 5)`), who).toMatchObject({ ok: false, code: '42501' });
      expect(await as(who, `select * from job_health()`), who).toMatchObject({ ok: false, code: '42501' });
    }
    await db.exec(`delete from job_runs`);
  });
});

describe('the jobs (OPS-06)', () => {
  it('Q4-SQL-007 · the SQL jobs run through their wrappers; job-health is hourly, on this project\'s own URL', async () => {
    const jobs = Object.fromEntries((await rows<{ jobname: string; schedule: string; command: string }>(
      `select jobname, schedule, command from cron.job`)).map(j => [j.jobname, j]));
    expect(jobs['loan-auto-record'].command).toBe('select public.run_loan_auto_record()');
    expect(jobs['whatsapp-retention'].command).toBe('select public.run_retention()');
    expect(jobs['job-health'].schedule).toBe('55 * * * *');
    expect(jobs['job-health'].command).toMatch(/u\.decrypted_secret \|\| '\/functions\/v1\/job-health'/);
    expect(jobs['job-health'].command).toMatch(/s\.name = 'job_health_cron_secret' and u\.name = 'project_url'/);
    expect(jobs['job-health'].command).not.toMatch(/supabase\.co/);
  });

  it('Q4-SQL-008 · job_health_cron_ok accepts only the Vault secret, and only the server may ask', async () => {
    const secret = (await rows<{ s: string }>(`select decrypted_secret s from vault.decrypted_secrets where name = 'job_health_cron_secret'`))[0].s;
    expect(secret).toMatch(/^[0-9a-f]{64}$/);
    const ok = async (p: string) => (await rows<{ ok: boolean }>(`select job_health_cron_ok($1) as ok`, [p]))[0].ok;
    expect(await ok(secret)).toBe(true);
    expect(await ok('x'.repeat(64))).toBe(false);
    expect(await ok('')).toBe(false);
    expect(await as(OWNER, `select job_health_cron_ok('x')`)).toMatchObject({ ok: false, code: '42501' });
  });
});
