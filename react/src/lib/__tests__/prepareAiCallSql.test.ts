import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { replayMigrations } from './helpers/replayMigrations';

// v10.107.1 — prepare_ai_call(): the gateway's membership check and quota reservation in one round trip, for
// auth.uid() only. v10.135.0 (Track Q7; audit OPS-11, BE-PIP-06; owner decisions 20 Oct 2026): Pip's limits
// (ai_limits, ai_limit_state) — the person's 24 hours, a minute, an off-topic cool-down and everyone's 24 hours,
// closed without the row — and the test relay gone. On the schema every migration builds.

let db: PGlite;
const ME = '10000000-0000-4000-8000-0000000000e1';
const OTHER = '10000000-0000-4000-8000-0000000000e2';
let HOME = '';
let ELSEWHERE = '';

type Answer = { member: boolean | null; reservation_id: string | null; quota: string; retry_at?: string };

/** One statement as a signed-in person, committed (reservations persist between calls). */
async function asUser<T>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec('begin');
  try {
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'authenticated' })]);
    await db.exec('set local role authenticated');
    const r = await db.query<T>(sql, params);
    await db.exec('commit');
    return r.rows;
  } catch (e) {
    await db.exec('rollback');
    throw e;
  }
}
const prepare = async (household: string | null, cap: number | null, reserve = true, surface = 'chat', uid = ME) =>
  (await asUser<{ r: Answer }>(uid, `select public.prepare_ai_call($1, 'assistant', $2, $3, $4) as r`,
    [household, surface, cap, reserve]))[0].r;
const gatewayRows = async (uid = ME) => (await db.query<{ n: number }>(
  `select count(*)::int as n from ai_usage where user_id = $1 and source = 'gateway' and ts > now() - interval '1 hour'`, [uid])).rows[0].n;
const setConfigs = (sql: string) => db.exec(`delete from ai_model_configs; ${sql}`);
const setLimits = (cols: string) => db.exec(`update ai_limits set ${cols}`);
/** A gateway row for `uid`, `ago` back, with an optional intent and outcome. */
const pastCall = (uid: string, ago: string, intent: string | null = null, outcome = 'ok') => db.query(
  `insert into ai_usage (user_id, household_id, surface, backend, outcome, ts, source, intent)
   values ($1, null, 'chat', 'llm', $2, now() - $3::interval, 'gateway', $4)`, [uid, outcome, ago, intent]);

beforeAll(async () => {
  ({ db } = await replayMigrations());
  await db.exec(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
    ('${ME}', 'me@vyact.test', now(), '{"display_name": "me"}'::jsonb),
    ('${OTHER}', 'other@vyact.test', now(), '{"display_name": "other"}'::jsonb);`);
  const home = (uid: string) => db.query<{ h: string }>(`select household_id as h from memberships where user_id = $1`, [uid]);
  HOME = (await home(ME)).rows[0].h;
  ELSEWHERE = (await home(OTHER)).rows[0].h;
}, 180_000);
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`delete from ai_usage;
    update ai_limits set per_user_daily_calls = 200, global_daily_calls = 5000, per_minute_calls = 12,
                         off_topic_limit = 3, off_topic_window_min = 10, cooldown_min = 15;`);
  await setConfigs(`insert into ai_model_configs (seam, provider, model, base_url, enabled, priority)
    values ('assistant', 'bedrock', 'amazon.nova-lite-v1:0', 'https://bedrock-runtime.ap-southeast-2.amazonaws.com', true, 120);`);
});

describe('prepare_ai_call() (v10.107.1)', () => {
  it('PIP-GW-020 · a member under the cap gets one gateway reservation, for themselves', async () => {
    const r = await prepare(HOME, 200);
    expect(r).toMatchObject({ member: true, quota: 'ok' });
    expect(r.reservation_id).toMatch(/^[0-9a-f-]{36}$/);
    const row = (await db.query<{ user_id: string; household_id: string; outcome: string; source: string; backend: string }>(
      `select user_id, household_id, outcome, source, backend from ai_usage where id = $1`, [r.reservation_id])).rows[0];
    expect(row).toEqual({ user_id: ME, household_id: HOME, outcome: 'reserved', source: 'gateway', backend: 'llm' });
    // No household named: no membership answer, still a reservation.
    expect(await prepare(null, 200)).toMatchObject({ member: null, quota: 'ok' });
  });

  it('PIP-GW-021 · a household the caller is not in: member false, nothing reserved', async () => {
    expect(await prepare(ELSEWHERE, 200)).toEqual({ member: false, reservation_id: null, quota: 'skipped' });
    expect(await gatewayRows()).toBe(0);
  });

  it('PIP-GW-022 · at the cap: exceeded, nothing reserved; the same count as reserve_ai_usage (gateway rows of 24 h)', async () => {
    expect((await prepare(HOME, 2)).quota).toBe('ok');
    expect((await prepare(HOME, 2)).quota).toBe('ok');
    expect(await prepare(HOME, 2)).toEqual({ member: true, reservation_id: null, quota: 'exceeded' });
    expect(await gatewayRows()).toBe(2);
    // The app's own analytics rows do not count against the cap.
    await db.exec(`insert into ai_usage (user_id, household_id, backend, outcome, source) values ('${ME}', '${HOME}', 'llm', 'ok', 'client')`);
    expect((await prepare(HOME, 3)).quota).toBe('ok');
  });

  it('PIP-GW-023 · OFF writes nothing: no enabled row, a row piloted on someone else, another seam', async () => {
    await setConfigs(`insert into ai_model_configs (seam, provider, model, base_url, enabled) values ('assistant', 'bedrock', 'm', 'https://x', false);`);
    expect((await prepare(HOME, 200)).quota).toBe('skipped');
    await setConfigs(`insert into ai_model_configs (seam, provider, model, base_url, enabled, params)
      values ('assistant', 'vllm', 'm', 'https://x', true, '{"allowed_user_ids":["${OTHER}"]}');`);
    expect((await prepare(HOME, 200)).quota).toBe('skipped');
    await setConfigs(`insert into ai_model_configs (seam, provider, model, base_url, enabled) values ('chat', 'bedrock', 'm', 'https://x', true);`);
    expect((await prepare(HOME, 200)).quota).toBe('skipped');
    expect(await gatewayRows()).toBe(0);
    // The caller on a pilot's allowlist does get a reservation.
    await setConfigs(`insert into ai_model_configs (seam, provider, model, base_url, enabled, params)
      values ('assistant', 'vllm', 'm', 'https://x', true, '{"allowed_user_ids":["${ME}"]}');`);
    expect((await prepare(HOME, 200)).quota).toBe('ok');
  });

  it('PIP-GW-024 · nothing is reserved when not asked; with no cap, or one above the server\'s, the server\'s own cap applies (v10.135.0)', async () => {
    expect(await prepare(HOME, 200, false)).toEqual({ member: true, reservation_id: null, quota: 'skipped' });
    expect(await gatewayRows()).toBe(0);
    await setLimits('per_user_daily_calls = 2');
    expect((await prepare(HOME, null)).quota).toBe('ok');           // 'off' at the gateway: the server's 2
    expect((await prepare(HOME, 5000)).quota).toBe('ok');           // a caller's own cap cannot raise it
    expect((await prepare(HOME, 5000)).quota).toBe('exceeded');
    expect((await prepare(HOME, null)).quota).toBe('exceeded');
    expect(await gatewayRows()).toBe(2);
  });

  it('PIP-GW-025 · only a signed-in caller, only real surfaces; anon cannot run it', async () => {
    await expect(asUser(null, `select public.prepare_ai_call(null, 'assistant', 'chat', 200, true)`)).rejects.toThrow(/not_authenticated/);
    await expect(prepare(HOME, 200, true, 'anything')).rejects.toThrow(/invalid_surface/);
    await db.exec('begin');
    try {
      await db.exec(`set local role anon`);
      await expect(db.query(`select public.prepare_ai_call(null, 'assistant', 'chat', 200, true)`)).rejects.toThrow(/permission denied/);
    } finally { await db.exec('rollback'); }
    expect(await gatewayRows()).toBe(0);
  });
});

describe("Pip's limits (v10.135.0, Track Q7; OPS-11)", () => {
  it('Q7-SQL-001 · the limits are one server-only row; without it every call is refused and nothing is written', async () => {
    expect((await db.query(`select per_user_daily_calls, global_daily_calls, per_minute_calls, off_topic_limit,
      off_topic_window_min, cooldown_min from ai_limits`)).rows).toEqual([{ per_user_daily_calls: 200, global_daily_calls: 5000,
      per_minute_calls: 12, off_topic_limit: 3, off_topic_window_min: 10, cooldown_min: 15 }]);
    await expect(db.query(`insert into ai_limits (id, per_user_daily_calls, global_daily_calls, per_minute_calls,
      off_topic_limit, off_topic_window_min, cooldown_min) values (false, 1, 1, 1, 1, 1, 1)`)).rejects.toThrow(/check/);
    await expect(asUser(ME, `select * from ai_limits`)).rejects.toThrow(/permission denied/);
    await expect(asUser(ME, `update ai_limits set global_daily_calls = 1000000`)).rejects.toThrow(/permission denied/);
    await expect(asUser(ME, `select public.ai_limit_state('${ME}', 200)`)).rejects.toThrow(/permission denied/);
    // No row: closed, for the gateway and for WhatsApp's reserve_ai_usage alike.
    await db.exec(`alter table ai_limits disable trigger trg_ai_limits_staff_audit; delete from ai_limits;`);
    try {
      expect(await prepare(HOME, 200)).toEqual({ member: true, reservation_id: null, quota: 'misconfigured' });
      await expect(db.query(`select reserve_ai_usage('${ME}', '${HOME}', 'whatsapp', 200)`)).rejects.toMatchObject({ code: '55000' });
      expect(await gatewayRows()).toBe(0);
    } finally {
      await db.exec(`insert into ai_limits (id, per_user_daily_calls, global_daily_calls, per_minute_calls, off_topic_limit,
        off_topic_window_min, cooldown_min) values (true, 200, 5000, 12, 3, 10, 15);
        alter table ai_limits enable trigger trg_ai_limits_staff_audit;`);
    }
  });

  it('Q7-SQL-002 · a minute: the per-minute limit refuses with when to ask again; older calls do not count', async () => {
    await setLimits('per_minute_calls = 3');
    await pastCall(ME, '2 minutes');                          // outside the minute
    for (let i = 0; i < 3; i++) expect((await prepare(HOME, null)).quota).toBe('ok');
    const r = await prepare(HOME, null);
    expect(r).toMatchObject({ member: true, reservation_id: null, quota: 'rate_limited' });
    const wait = Date.parse(r.retry_at!) - Date.now();
    expect(wait).toBeGreaterThan(30_000);
    expect(wait).toBeLessThanOrEqual(60_000);
    expect((await prepare(null, null, true, 'chat', OTHER)).quota).toBe('ok');   // someone else is not limited
  });

  it('Q7-SQL-003 · the off-topic cool-down: 3 within 10 minutes pause Pip until 15 minutes after the last', async () => {
    await pastCall(ME, '9 minutes', 'off_topic');
    await pastCall(ME, '5 minutes', 'off_topic');
    expect((await prepare(HOME, null)).quota).toBe('ok');     // two: not yet
    await db.exec(`delete from ai_usage`);
    await pastCall(ME, '9 minutes', 'off_topic');
    await pastCall(ME, '5 minutes', 'off_topic');
    await pastCall(ME, '1 minute', 'off_topic');
    const r = await prepare(HOME, null);
    expect(r).toMatchObject({ reservation_id: null, quota: 'cooldown' });
    const wait = Date.parse(r.retry_at!) - Date.now();
    expect(wait).toBeGreaterThan(13 * 60_000);
    expect(wait).toBeLessThanOrEqual(14 * 60_000 + 1_000);
    // The app's own rows never count: the cool-down reads the gateway's reading of the model's answer.
    await db.exec(`delete from ai_usage`);
    for (const ago of ['3 minutes', '2 minutes', '1 minute']) {
      await db.query(`insert into ai_usage (user_id, backend, outcome, ts, source, intent)
        values ($1, 'llm', 'ok', now() - $2::interval, 'client', 'off_topic')`, [ME, ago]);
    }
    expect((await prepare(HOME, null)).quota).toBe('ok');
    // Spread over more than the window, or long enough ago: no pause.
    await db.exec(`delete from ai_usage`);
    for (const ago of ['14 minutes', '8 minutes', '2 minutes']) await pastCall(ME, ago, 'off_topic');
    expect((await prepare(HOME, null)).quota).toBe('ok');
    await db.exec(`delete from ai_usage`);
    for (const ago of ['20 minutes', '18 minutes', '16 minutes']) await pastCall(ME, ago, 'off_topic');
    expect((await prepare(HOME, null)).quota).toBe('ok');
  });

  it('Q7-SQL-004 · everyone\'s 24 hours: the ceiling refuses everyone; a reservation never finalised is not a call', async () => {
    await setLimits('global_daily_calls = 3');
    await pastCall(OTHER, '2 hours');
    await pastCall(OTHER, '25 hours');                         // older than a day
    await pastCall(OTHER, '10 minutes', null, 'reserved');     // never finalised: not a call
    expect((await db.query(`select ai_ceiling_state() as s`)).rows[0]).toEqual({ s: { calls: 1, ceiling: 3 } });
    expect((await prepare(HOME, null)).quota).toBe('ok');      // 2 (its own fresh reservation counts)
    expect((await prepare(HOME, null)).quota).toBe('ok');      // 3
    expect(await prepare(HOME, null)).toMatchObject({ reservation_id: null, quota: 'global_exceeded' });
    expect((await prepare(null, null, true, 'chat', OTHER)).quota).toBe('global_exceeded');
    expect((await db.query(`select ai_ceiling_state() as s`)).rows[0]).toEqual({ s: { calls: 3, ceiling: 3 } });
    await expect(asUser(ME, `select ai_ceiling_state()`)).rejects.toThrow(/permission denied/);
  });

  it('Q7-SQL-005 · reserve_ai_usage (WhatsApp, the gateway\'s fallback) applies the same limits and names the refusal', async () => {
    const reserve = (cap: number | null) => db.query<{ id: string }>(
      `select reserve_ai_usage($1, $2, 'whatsapp', $3) as id`, [ME, HOME, cap]);
    expect((await reserve(null)).rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
    await setLimits('per_minute_calls = 1');
    await expect(reserve(null)).rejects.toMatchObject({ code: '42901', message: 'rate_limited' });
    await setLimits('per_minute_calls = 12, per_user_daily_calls = 1');
    await expect(reserve(null)).rejects.toMatchObject({ code: '42901', message: 'quota_exceeded' });
    await setLimits('per_user_daily_calls = 200');
    for (const ago of ['3 minutes', '2 minutes', '1 minute']) await pastCall(ME, ago, 'off_topic');
    await expect(reserve(200)).rejects.toMatchObject({ code: '42901', message: 'cooldown' });
    await db.exec(`delete from ai_usage`);
    await setLimits('global_daily_calls = 0');
    await expect(reserve(200)).rejects.toMatchObject({ code: '42901', message: 'global_exceeded' });
    expect(await gatewayRows()).toBe(0);
    await expect(asUser(ME, `select reserve_ai_usage('${ME}', null, 'chat', 200)`)).rejects.toThrow(/permission denied/);
  });

  it('Q7-SQL-006 · a change to the limits is in the staff audit trail, every number before and after', async () => {
    await db.exec(`update ai_limits set cooldown_min = 30`);
    const row = (await db.query<{ target_table: string; target_id: string; changed: string[]; detail: { before: Record<string, number>; after: Record<string, number> } }>(
      `select target_table, target_id, changed, detail from admin_audit where target_table = 'ai_limits' order by id desc limit 1`)).rows[0];
    expect(row).toMatchObject({ target_table: 'ai_limits', target_id: 'ai_limits', changed: ['cooldown_min'] });
    expect(row.detail.before.cooldown_min).toBe(15);
    expect(row.detail.after.cooldown_min).toBe(30);
    expect(row.detail.after.global_daily_calls).toBe(5000);
  });

  it('Q7-SQL-007 · the owner hears at 50%, 80% and 100%: job_alerts takes each level, once a day', async () => {
    for (const kind of ['spend_50', 'spend_80', 'spend_100']) {
      expect((await db.query(`select claim_job_alert('pip', $1) as ok`, [kind])).rows[0]).toEqual({ ok: true });
      expect((await db.query(`select claim_job_alert('pip', $1) as ok`, [kind])).rows[0]).toEqual({ ok: false });
    }
    await expect(db.query(`select claim_job_alert('pip', 'spend_90')`)).rejects.toThrow(/check/);
    await db.exec(`delete from job_alerts where job = 'pip'`);
  });
});

describe('the Claude Code relay is retired (v10.135.0, BE-PIP-06, TD-44)', () => {
  it('Q7-SQL-008 · no queue table, no relay rows, no relay in the household erase; a relay row cannot be added', async () => {
    expect((await db.query(`select to_regclass('public.ask_vyact_relay') as t`)).rows[0]).toEqual({ t: null });
    await expect(db.exec(`insert into ai_model_configs (seam, provider, model, base_url, enabled)
      values ('assistant', 'claude-code-relay', 'relay', 'https://claude-code.relay', false)`)).rejects.toThrow(/ck_ai_model_configs_no_relay/);
    const erase = (await db.query<{ d: string }>(`select pg_get_functiondef('public.erase_household_data(uuid)'::regprocedure) as d`)).rows[0].d;
    expect(erase).not.toMatch(/relay/);
    expect(erase).toMatch(/delete from agent_conversations/);
  });
});

describe('Pip remembers how long a person likes answers (v10.135.0)', () => {
  it("Q7-SQL-009 · profiles.pip_answer_length: the person's own, short (null) or detailed", async () => {
    await asUser(ME, `update profiles set pip_answer_length = 'detailed' where id = '${ME}'`);
    expect((await db.query(`select pip_answer_length from profiles where id = $1`, [ME])).rows[0]).toEqual({ pip_answer_length: 'detailed' });
    await expect(db.query(`update profiles set pip_answer_length = 'long' where id = $1`, [ME])).rejects.toThrow(/ck_profiles_pip_answer_length/);
    // Someone else's setting is not theirs to change (RLS matches no row).
    await asUser(OTHER, `update profiles set pip_answer_length = 'detailed' where id = '${ME}'`);
    await asUser(ME, `update profiles set pip_answer_length = null where id = '${ME}'`);
    await asUser(OTHER, `update profiles set pip_answer_length = 'detailed' where id = '${ME}'`);
    expect((await db.query(`select pip_answer_length from profiles where id = $1`, [ME])).rows[0]).toEqual({ pip_answer_length: null });
  });
});
