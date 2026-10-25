// Q7-001..012 — v10.135.0 (Track Q7; audit OPS-11, BE-PIP-06; owner decisions 20 Oct 2026). Pip's limits (named to the
// person, emailed to the owner as the ceiling fills), Pip's nudges raised by the server and pushed only where a device
// asked, the person's own answer length and language, and the test relay gone.
import { existsSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  limitAnswer, retryAfterSeconds, quotaFromReserveError, offTopicIntent, QUOTAS,
} from '../../../../supabase/functions/_shared/agent/limits';
import { filterRowsForUser, rowAppliesToUser } from '../../../../supabase/functions/_shared/agent/modelRows';
import { skipReason, type NotificationRow, type SubscriptionRow } from '../../../../supabase/functions/_shared/web-push-rules';
import {
  ModelLimitError, ModelUnavailableError, InventedFigureError, assertNoInventedFigures, phraseViaModel, answerLanguage,
  systemPromptFor, type ModelCall,
} from '../askVyactLlm';
import { LlmBackend, runAssistant, limitCopy, type AssistantContext } from '../askVyactBackend';
import { buildSafeSummary } from '../aiSummary';
import { notificationsOnServer, type HouseholdRows } from '../serverEngine';
import { pipNudgeRoom } from '../notifications';
import { profileFromRows } from '../supabaseAdapter';
import { today } from '../format';
import { prefsForServer } from '../nativePush';
import { DEFAULT_PREFS } from '../notifications';
import * as bundle from '../../../../supabase/functions/_shared/agent/engine.generated.js';
import { captureHandler } from './helpers/edgeHarness';
import type { Notification, Profile, Transaction } from '../../types';

vi.mock('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient: () => ({}) }));
vi.mock('https://deno.land/x/denomailer@1.6.0/mod.ts', () => ({ SMTPClient: class { send() {} close() {} } }));

const ROOT = new URL('../../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, ROOT), 'utf8');

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("Pip's limits, named (OPS-11)", () => {
  it('Q7-001 · each refusal has its own status and code; ok and skipped are no refusal', () => {
    expect(QUOTAS.map(q => [q, limitAnswer(q)?.status ?? null, limitAnswer(q)?.error ?? null])).toEqual([
      ['ok', null, null], ['skipped', null, null], ['exceeded', 429, 'quota_exceeded'], ['rate_limited', 429, 'rate_limited'],
      ['cooldown', 429, 'cooldown'], ['global_exceeded', 429, 'global_limit'], ['misconfigured', 503, 'quota_misconfigured'],
    ]);
    const now = Date.parse('2026-10-25T10:00:00Z');
    expect(retryAfterSeconds('2026-10-25T10:14:00Z', now)).toBe(840);
    expect(retryAfterSeconds('2026-10-25T09:59:00Z', now)).toBe(1);          // already past: ask again now
    expect(retryAfterSeconds('soon', now)).toBeNull();
    expect(retryAfterSeconds(null, now)).toBeNull();
    expect(quotaFromReserveError({ code: '42901', message: 'quota_exceeded' })).toBe('exceeded');
    expect(quotaFromReserveError({ code: '42901', message: 'cooldown' })).toBe('cooldown');
    expect(quotaFromReserveError({ code: '42901', message: 'rate_limited' })).toBe('rate_limited');
    expect(quotaFromReserveError({ code: '42901', message: 'global_exceeded' })).toBe('global_exceeded');
    expect(quotaFromReserveError({ code: '55000', message: 'quota_misconfigured' })).toBe('misconfigured');
    expect(quotaFromReserveError({ code: 'XX000', message: 'connection reset' })).toBeNull();
  });

  it('Q7-002 · only a classify reply that places the question off topic is recorded as off_topic', () => {
    expect(offTopicIntent('classify', '{"id":"off_topic","entities":{},"confidence":0.9}')).toBe('off_topic');
    expect(offTopicIntent('classify', '```json\n{"id":"off_topic"}\n```')).toBe('off_topic');
    expect(offTopicIntent('classify', '{"id":"interpret.lookup"}')).toBeNull();
    expect(offTopicIntent('classify', 'off_topic')).toBeNull();               // not the classifier's JSON
    expect(offTopicIntent('classify', '["off_topic"]')).toBeNull();
    expect(offTopicIntent('phrase', '{"id":"off_topic"}')).toBeNull();        // a phrase reply is never read this way
    expect(offTopicIntent(undefined, '{"id":"off_topic"}')).toBeNull();
    expect(offTopicIntent('classify', null)).toBeNull();
  });

  it('Q7-003 · Pip says which limit applies and when to ask again, instead of "I can\'t reach the assistant"', async () => {
    expect(limitCopy('cooldown', 840)).toBe("I only help with your household's money, so I'm pausing for a few minutes. Ask me about your spending, budgets, bills or plans in 14 minutes.");
    expect(limitCopy('rate_limited', 20)).toBe("That's a lot of questions at once. Ask again in a minute.");
    expect(limitCopy('rate_limited', null)).toBe("That's a lot of questions at once. Ask again in a minute.");
    expect(limitCopy('quota_exceeded', null)).toMatch(/today's limit for questions to Pip/);
    expect(limitCopy('global_limit', null)).toMatch(/as many questions as it can today/);
    for (const limit of ['cooldown', 'rate_limited', 'quota_exceeded', 'global_limit'] as const) {
      expect(limitCopy(limit, 600)).not.toMatch(/!|sorry/i);                   // Pip's voice: no exclamation, no apology
    }
    // At classify, and at phrase.
    const paused = await runAssistant('write me a poem', ctx(), new LlmBackend(async () => { throw new ModelLimitError('cooldown', 840); }), 0);
    expect(paused).toMatchObject({ reply: limitCopy('cooldown', 840), intentId: 'unavailable' });
    const atPhrase: ModelCall = async (req) => {
      if (req.op === 'classify') return '{"id":"interpret.status","entities":{},"confidence":0.9}';
      throw new ModelLimitError('global_limit');
    };
    expect((await runAssistant('how am I doing?', ctx(), new LlmBackend(atPhrase), 0)).reply).toBe(limitCopy('global_limit', null));
    // Any other failure is still "unreachable".
    const down = await runAssistant('how am I doing?', ctx(), new LlmBackend(async () => { throw new Error('timeout'); }), 0);
    expect(down.reply).toMatch(/can't reach the assistant/);
    expect(new ModelLimitError('cooldown')).toBeInstanceOf(ModelUnavailableError);
  });
});

describe('the owner hears as the ceiling fills (OPS-11)', () => {
  const load = () => import('../../../../supabase/functions/job-health/index');

  it('Q7-004 · 50%, 80% and 100% each have a line; below half, nothing; an unreadable limits row is a problem', async () => {
    await captureHandler(load);
    const { spendLevel, spendAlert } = await load();
    expect(spendLevel({ calls: 2499, ceiling: 5000 })).toBeNull();
    expect(spendLevel({ calls: 2500, ceiling: 5000 })).toBe(50);
    expect(spendLevel({ calls: 4000, ceiling: 5000 })).toBe(80);
    expect(spendLevel({ calls: 5000, ceiling: 5000 })).toBe(100);
    expect(spendLevel({ calls: 0, ceiling: 0 })).toBe(100);                   // a ceiling of 0 refuses everything
    expect(spendLevel({ calls: 9, ceiling: null })).toBeNull();
    expect(spendAlert({ calls: 2600, ceiling: 5000 })).toEqual({ job: 'pip', kind: 'spend_50',
      line: 'Pip has used 2,600 of its 5,000 model calls in the last 24 hours (52%).' });
    expect(spendAlert({ calls: 4100, ceiling: 5000 })?.line).toBe(
      'Pip has used 4,100 of its 5,000 model calls in the last 24 hours (82%). At 5,000 it stops answering everyone until the count falls.');
    expect(spendAlert({ calls: 5000, ceiling: 5000 })).toMatchObject({ kind: 'spend_100',
      line: expect.stringMatching(/refusing new questions until the count falls\. Raise ai_limits\.global_daily_calls/) });
    expect(spendAlert({ calls: 0, ceiling: null })).toMatchObject({ job: 'pip', kind: 'failed', line: expect.stringMatching(/refusing every question/) });
    expect(spendAlert({ calls: 10, ceiling: 5000 })).toBeNull();
  });

  it('Q7-005 · job-health emails the owner once a day per level, with the job problems; a failed read never stops the job alerts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    await captureHandler(load, { HEALTH_ALERT_EMAIL: 'owner@vyact.app', MAILERSEND_API_KEY: 'ms-key' });
    const { checkHealth } = await load();
    const claims: unknown[] = [];
    const admin = (ceiling: { data: unknown; error: unknown }, jobs: unknown[] = []) => ({
      rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
        if (name === 'job_health') return { data: jobs, error: null };
        if (name === 'ai_ceiling_state') return ceiling;
        if (name === 'claim_job_alert') { claims.push(args); return { data: true, error: null }; }
        return { data: null, error: null };
      }),
    });
    expect(await checkHealth(admin({ data: { calls: 4200, ceiling: 5000 }, error: null }) as never))
      .toEqual({ problems: 1, emailed: 1, spend_pct: 84 });
    expect(claims).toEqual([{ p_job: 'pip', p_kind: 'spend_80' }]);
    const mail = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(mail.subject).toBe('Vyact: something needs a look');
    expect(mail.text).toContain('Pip has used 4,200 of its 5,000 model calls in the last 24 hours (84%).');
    // Below half: nothing to say.
    expect(await checkHealth(admin({ data: { calls: 100, ceiling: 5000 }, error: null }) as never)).toEqual({ problems: 0, emailed: 0, spend_pct: 2 });
    // The ceiling cannot be read: logged, and a broken job is still reported.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    claims.length = 0;
    const late = { job: 'recurring-post', every_minutes: 30, last_started_at: null, last_status: null, last_error: null, problem: 'late' };
    expect(await checkHealth(admin({ data: null, error: { message: 'boom' } }, [late]) as never))
      .toEqual({ problems: 1, emailed: 1, spend: 'unread' });
    expect(claims).toEqual([{ p_job: 'recurring-post', p_kind: 'late' }]);
  });
});

// ── The person's own answer length and language ───────────────────────────────────────────────────────────────
function ctx(profile: Partial<Profile> = {}): AssistantContext {
  const p = { baseCurrency: 'INR', household: 'individual', language: 'en', ...profile } as unknown as Profile;
  const day = today();                                     // the device's day, never the UTC one
  const transactions = [{ id: 't1', type: 'expense', amount: 1200, currency: 'INR', date: day, description: '', category: 'food_dining' }] as Transaction[];
  const summary = buildSafeSummary(transactions, [], [], [], [], p, { INR: 1 });
  return { summary, transactions, budgets: [], goals: [], debts: [], assets: [], profile: p, rates: { INR: 1 }, baseCurrency: 'INR' };
}
const intent = { id: 'interpret.lookup', bucket: 'interpret', entities: { text: 'how much on food?' }, confidence: 0.9 } as never;
const result = { outcome: 'ok', facts: { spent_this_month: '₹1,200' } } as never;

describe('Pip remembers how a person likes answers (owner: "remembered preferences")', () => {
  it('Q7-006 · the app sends the length and language with each answer; WhatsApp and the defaults send nothing new', async () => {
    const sent: Record<string, unknown>[] = [];
    const call: ModelCall = async (req) => { sent.push(JSON.parse(req.user)); return 'You spent ₹1,200 on food this month.'; };
    await phraseViaModel(intent, result, call, [], 'app', { answerLength: 'detailed', language: 'hi' });
    await phraseViaModel(intent, result, call, [], 'app', { answerLength: 'short', language: 'en' });
    await phraseViaModel(intent, result, call, [], 'app');
    await phraseViaModel(intent, result, call, [], 'whatsapp', { answerLength: 'detailed', language: 'hi' });
    await phraseViaModel(intent, result, call, [], 'app', { language: 'xx' });
    expect(sent[0]).toMatchObject({ answer_length: 'detailed', answer_language: 'Hindi (Devanagari script)' });
    for (const s of sent.slice(1)) {
      expect(s).not.toHaveProperty('answer_length');
      expect(s).not.toHaveProperty('answer_language');
    }
    expect(answerLanguage('ja')).toBe('Japanese');
    expect(answerLanguage('en')).toBeNull();
    // The backend reads them from the person's profile.
    const seen: Record<string, unknown>[] = [];
    await new LlmBackend(async (req) => { seen.push(JSON.parse(req.user)); return 'You spent ₹1,200 on food this month.'; })
      .phraseResponse(intent, result, ctx({ pipAnswerLength: 'detailed', language: 'es' }));
    expect(seen[0]).toMatchObject({ answer_length: 'detailed', answer_language: 'Spanish' });
    // The prompt says what each means, and that figures are copied exactly in any language.
    const prompt = systemPromptFor('phrase');
    expect(prompt).toContain('`answer_length: "detailed"`');
    expect(prompt).toMatch(/`answer_language`[\s\S]*copy every figure exactly as FACTS write it/);
  });

  it('Q7-007 · in another language no number passes as a count; other digits are never shown', () => {
    // English: a small number is a count. In another language it may be an amount ("3 万" is 30,000).
    expect(() => assertNoInventedFigures('Gastaste 3 millones en comida.', {})).not.toThrow();
    expect(() => assertNoInventedFigures('Gastaste 3 millones en comida.', {}, { strict: true })).toThrow(InventedFigureError);
    expect(() => assertNoInventedFigures('食費は3万円です。', { a: '₹1,200' }, { strict: true })).toThrow(InventedFigureError);
    expect(() => assertNoInventedFigures('In 2019 you spent ₹1,200.', { a: '₹1,200' }, { strict: true })).toThrow(InventedFigureError);
    expect(() => assertNoInventedFigures('Has gastado ₹1,200 en comida.', { a: '₹1,200' }, { strict: true })).not.toThrow();
    // Digits other than 0-9 cannot be checked, in any mode.
    expect(() => assertNoInventedFigures('आपने खाने पर ₹१,२०० खर्च किए।', { a: '₹1,200' })).toThrow(InventedFigureError);
    expect(() => assertNoInventedFigures('合計 ₹１,２００', { a: '₹1,200' })).toThrow(InventedFigureError);
  });

  it('Q7-008 · a Spanish answer with a figure not in FACTS is refused after one retry; the same words pass in English', async () => {
    const replies = ['Gastaste 3 millones en comida.', 'Gastaste 3 millones en comida.'];
    const call: ModelCall = async () => replies.shift()!;
    await expect(phraseViaModel(intent, result, call, [], 'app', { language: 'es' })).rejects.toThrow(InventedFigureError);
    expect(replies).toHaveLength(0);
    await expect(phraseViaModel(intent, result, async () => 'Gastaste 3 millones en comida.', [], 'app')).resolves.toBe('Gastaste 3 millones en comida.');
  });

  it('Q7-009 · the profile carries the length: short unless detailed, written back as null for short', () => {
    expect(profileFromRows({ pip_answer_length: 'detailed' }, {}, '').pipAnswerLength).toBe('detailed');
    expect(profileFromRows({ pip_answer_length: null }, {}, '').pipAnswerLength).toBe('short');
    expect(profileFromRows({ pip_answer_length: 'weird' }, {}, '').pipAnswerLength).toBe('short');
    const adapter = read('react/src/lib/supabaseAdapter.ts');
    expect(adapter).toContain(".select('display_name,default_currency,language,date_format,education_progress,pip_answer_length')");
    expect(adapter).toContain("userPatch.pip_answer_length = patch.pipAnswerLength === 'detailed' ? 'detailed' : null;");
  });
});

// ── Pip's nudges while the app is closed ────────────────────────────────────────────────────────────────────────
const HID = '11111111-1111-4111-8111-111111111111';
const stamp = { created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z', deleted_at: null };
const txn = (id: string, date: string, amount: number) => ({
  id, household_id: HID, created_by: null, member_id: null, currency: 'INR', date, description: 'x', note: null, recurring: null,
  extras: {}, account_id: null, to_account_id: null, initiated_by: null, recurring_schedule_id: null, debt_id: null,
  payment_mode: null, asset_id: null, type: 'expense', category: 'food_dining', amount, ...stamp,
});
const household = (): HouseholdRows => ({
  transactions: [txn('a', '2026-08-10', 1000), txn('b', '2026-09-10', 1000), txn('c', '2026-10-02', 1300)],
  budgets: [], budgetAllocations: [], goals: [], debts: [], assets: [], accounts: [], recurring: [],
  memberCount: 1, rates: [], email: '',
  profile: { display_name: 'Asha', default_currency: 'INR', language: 'en', date_format: 'dmy' },
  household: { type: 'family', base_currency: 'INR', language: 'en', payoff_strategy: 'avalanche', extra_payment: 0, timezone: 'Asia/Kolkata' },
});
const AT = Date.parse('2026-10-10T06:00:00Z');            // 11:30 in India

describe("Pip's nudges are raised by the server too (owner: \"a Pip inbox while closed\")", () => {
  it('Q7-010 · the server raises the nudge the app would, within one a day and three a week counted in the household\'s day', () => {
    const fresh = notificationsOnServer(household(), [], HID, [], AT);
    expect(fresh.map(n => [n.type, n.priority, n.dedupe_key, n.deep_link])).toEqual([
      ['trend_alert', 'P2', 'pip:trend:food_dining:2026-10', `/chat?ask=${encodeURIComponent('Why is my food & dining spending so high?')}`],
    ]);
    // The deployed bundle is the same function.
    const fromBundle = (bundle as unknown as { notificationsOnServer: typeof notificationsOnServer }).notificationsOnServer(household(), [], HID, [], AT);
    expect(fromBundle.map(n => [n.type, n.dedupe_key, n.title, n.body])).toEqual(fresh.map(n => [n.type, n.dedupe_key, n.title, n.body]));
    // Already raised by a device (or the server): not again.
    expect(notificationsOnServer(household(), [], HID, [{ dedupe_key: 'pip:trend:food_dining:2026-10', created_at: '2026-10-05T04:00:00Z' }], AT)).toEqual([]);
    // Another nudge earlier the same day IN INDIA (00:30 IST, still the 9th in UTC): none today.
    expect(notificationsOnServer(household(), [], HID, [{ dedupe_key: 'pip:review:2026-09', created_at: '2026-10-09T19:00:00Z' }], AT)).toEqual([]);
    expect(notificationsOnServer(household(), [], HID, [{ dedupe_key: 'pip:review:2026-09', created_at: '2026-10-09T18:00:00Z' }], AT)).toHaveLength(1);
    // Three this week: none.
    const week = ['2026-10-04T05:00:00Z', '2026-10-06T05:00:00Z', '2026-10-08T05:00:00Z'].map((at, i) => ({ dedupe_key: `pip:trend:x${i}:2026-10`, created_at: at }));
    expect(notificationsOnServer(household(), [], HID, week, AT)).toEqual([]);
    // A household far from this machine's zone (UTC+14): its day, not the server's or the device's.
    const kiritimati = { ...household(), household: { ...household().household, timezone: 'Pacific/Kiritimati' } };
    expect(notificationsOnServer(kiritimati, [], HID, [{ dedupe_key: 'pip:review:2026-09', created_at: '2026-10-09T10:30:00Z' }], AT)).toEqual([]);
    expect(pipNudgeRoom([{ dedupeKey: 'pip:review:2026-09', createdAt: '2026-10-09T10:30:00Z' } as Notification], AT, 'Pacific/Kiritimati')).toBe(0);
    // The device keeps its own day: no zone given, the device's.
    const n = (createdAt: string) => ({ dedupeKey: 'pip:review:2026-09', createdAt }) as Notification;
    expect(pipNudgeRoom([n('2026-10-09T19:00:00Z')], AT, 'Asia/Kolkata')).toBe(0);
    expect(pipNudgeRoom([n('2026-10-09T19:00:00Z')], AT, 'UTC')).toBe(1);
    expect(pipNudgeRoom([n('2026-10-09T19:00:00Z'), { dedupeKey: 'pip:review:2026-09' } as Notification], AT, 'Asia/Kolkata')).toBe(0);
  });

  it('Q7-011 · a nudge reaches a lock screen only where "Pip\'s nudges" is on; other P2s never; its type switch still rules', () => {
    const nudge: NotificationRow = { id: 'n1', household_id: HID, type: 'trend_alert', priority: 'P2', title: 't', body: 'b',
      status: 'unread', created_at: '2026-10-10T06:00:00Z', deep_link: '/chat?ask=x', dedupe_key: 'pip:trend:food_dining:2026-10' };
    const other: NotificationRow = { ...nudge, id: 'n2', type: 'income_landed', dedupe_key: 'income_landed:t9' };
    const sub = (prefs: SubscriptionRow['prefs']): SubscriptionRow => ({ id: 's1', user_id: 'u1', household_id: HID, endpoint: 'https://fcm.googleapis.com/x',
      p256dh: 'p', auth: 'a', tz: 'Asia/Kolkata', prefs, created_at: '2026-10-01T00:00:00Z', disabled_at: null });
    const noon = new Date('2026-10-10T06:30:00Z');
    expect(skipReason(nudge, sub({}), noon)).toBe('not_action_required');               // off by default
    expect(skipReason(nudge, sub({ pipNudges: false }), noon)).toBe('not_action_required');
    expect(skipReason(nudge, sub({ pipNudges: true }), noon)).toBeNull();
    expect(skipReason(other, sub({ pipNudges: true }), noon)).toBe('not_action_required');
    expect(skipReason(nudge, sub({ pipNudges: true, perType: { trend_alert: false } }), noon)).toBe('type_off');
    expect(skipReason(nudge, sub({ pipNudges: true }), new Date('2026-10-10T17:30:00Z'))).toBe('quiet_hours');
    // The device sends its switch with the others, browsers and phones alike.
    expect(prefsForServer({ ...DEFAULT_PREFS, pipNudges: true })).toMatchObject({ pipNudges: true });
    expect(prefsForServer(DEFAULT_PREFS)).toMatchObject({ pipNudges: false });
  });
});

describe('the Claude Code relay is retired (BE-PIP-06, TD-44)', () => {
  it('Q7-012 · no relay function, polling, queue or deploy entry is left; pilot rows still serve only their people', () => {
    expect(existsSync(new URL('supabase/functions/ask-vyact-relay-status/index.ts', ROOT))).toBe(false);
    expect(existsSync(new URL('supabase/functions/_shared/agent/relay.ts', ROOT))).toBe(false);
    for (const f of ['supabase/functions/ask-vyact/index.ts', 'supabase/functions/_shared/agent/assistantCore.ts',
      'react/src/lib/askVyactModelCall.ts', '.github/workflows/deploy.yml', '.github/workflows/deploy-test-functions.yml']) {
      expect(read(f), f).not.toMatch(/relayPoll|relay_pending|ask_vyact_relay|ask-vyact-relay-status|claude-code-relay/);
    }
    // Moved from the relay's tests (CON-UNIT-RELAY-006/007): a model piloted on some accounts.
    const piloted = { provider: 'lmstudio', priority: 200, params: { allowed_user_ids: ['tester'] } };
    const shared = { provider: 'openrouter', priority: 110, params: { max_tokens: 600 } };
    expect(rowAppliesToUser(piloted, 'tester')).toBe(true);
    expect(rowAppliesToUser(piloted, 'someone-else')).toBe(false);
    expect(filterRowsForUser([piloted, shared], 'someone-else')).toEqual([shared]);
    expect(rowAppliesToUser({ provider: 'openrouter', params: null }, 'anyone')).toBe(true);
    expect(rowAppliesToUser({ ...piloted, params: {} }, 'someone-else')).toBe(true);   // promotion = removing the key
  });
});
