import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureHandler, queryResult } from './helpers/edgeHarness';

const api = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient: () => api }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}'))); });
afterEach(() => vi.unstubAllGlobals());

describe('actual WhatsApp Edge handlers', () => {
  it('reads and unlinks only the authenticated identity, consuming pending relink codes', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-verify-otp/index'));
    api.auth.getUser.mockResolvedValue({ data: { user: { id: 'alice' } }, error: null });
    const status = queryResult({ phone_number: '111', household_id: 'alice-house' });
    const otpDelete = queryResult(null);
    const identityDelete = queryResult(null);
    api.from.mockReturnValueOnce(status).mockReturnValueOnce(otpDelete).mockReturnValueOnce(identityDelete).mockReturnValueOnce(queryResult(null));
    const request = (action: string) => new Request('https://edge.example.com/verify', { method: 'POST',
      headers: { Authorization: 'Bearer test-user' }, body: JSON.stringify({ action, profile_id: 'someone-else' }) });
    expect(await (await handler(request('status'))).json()).toEqual({ status: 'linked', phone: '111', householdId: 'alice-house' });
    expect(await (await handler(request('unlink'))).json()).toEqual({ status: 'unlinked' });
    expect(await (await handler(request('status'))).json()).toEqual({ status: 'unlinked' });
    for (const query of [status, otpDelete, identityDelete]) expect(query.eq).toHaveBeenCalledWith('profile_id', 'alice');
    expect(otpDelete.delete).toHaveBeenCalledOnce();
    expect(identityDelete.delete).toHaveBeenCalledOnce();
  });

  it('verifies a valid OTP, persists the server-owned identity and consumes the OTP', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-verify-otp/index'));
    api.auth.getUser.mockResolvedValue({ data: { user: { id: 'alice' } }, error: null });
    const otp = queryResult({ id: 'otp', household_id: 'alice-house', phone_number: '111', attempts: 0,
      otp_hash: createHash('sha256').update('123456:111:test-pepper').digest('hex') });
    const identity = queryResult(null);
    const cleanup = queryResult(null);
    api.from.mockReturnValueOnce(otp).mockReturnValueOnce(identity).mockReturnValueOnce(cleanup);
    const result = await handler(new Request('https://edge.example.com/verify', { method: 'POST',
      headers: { Authorization: 'Bearer test-user' }, body: JSON.stringify({ code: '123456' }) }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ status: 'linked', phone: '111', householdId: 'alice-house' });
    expect(identity.upsert).toHaveBeenCalledWith(expect.objectContaining({ profile_id: 'alice', phone_number: '111', household_id: 'alice-house' }), { onConflict: 'profile_id' });
    expect(cleanup.delete).toHaveBeenCalledOnce();
    expect(cleanup.eq).toHaveBeenCalledWith('profile_id', 'alice');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts the configured Meta handshake without database or message traffic', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const result = await handler(new Request('https://edge.example.com/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=challenge'));
    expect(result.status).toBe(200);
    expect(await result.text()).toBe('challenge');
    expect(api.from).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('processes every signed batch message using its own sender and confirms authoritative results', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const inboxQueries: ReturnType<typeof queryResult>[] = [];
    api.from.mockImplementation((table: string) => {
      if (table === 'accounts') return queryResult([{ name: 'Bank', kind: 'bank', currency: 'USD' }]);
      // v10.26.0 (R4) — investment assets are offered to the parser as aliases.
      if (table === 'assets') return queryResult([{ name: 'Nifty fund' }]);
      if (table === 'whatsapp_identities') {
        const query = queryResult(null);
        query.maybeSingle.mockImplementation(async () => {
          const phone = query.eq.mock.calls.find(([column]) => column === 'phone_number')?.[1];
          return { data: { profile_id: phone === '111' ? 'alice' : 'bob', household_id: phone === '111' ? 'alice-house' : 'bob-house' }, error: null };
        });
        return query;
      }
      if (table === 'whatsapp_inbound_messages') {
        const query = queryResult([{ wa_message_id: 'claimed' }]);
        inboxQueries.push(query);
        return query;
      }
      throw new Error(`Unexpected table ${table}`);
    });
    api.rpc.mockImplementation(async (_name: string, args: Record<string, unknown>) => ({ error: null, data: {
      status: 'success', amount: args.p_amount, currency: 'USD', type: 'expense', category_id: 'groceries', account_name: 'Bank' } }));
    const body = JSON.stringify({ entry: [{ changes: [{ value: { contacts: [{ wa_id: '111' }, { wa_id: '222' }], messages: [
      { id: 'message-a', from: '111', text: { body: '50 groceries bank' } },
      { id: 'message-b', from: '222', text: { body: '75 groceries bank' } },
    ] } }] }] });
    const signature = createHmac('sha256', 'test-app-secret').update(body).digest('hex');
    const result = await handler(new Request('https://edge.example.com/webhook', { method: 'POST',
      headers: { 'x-hub-signature-256': `sha256=${signature}` }, body }));
    expect(await result.json()).toEqual({ status: 'ok', recorded: 2 });
    expect(api.rpc.mock.calls).toEqual([
      ['whatsapp_log_transaction', expect.objectContaining({ p_profile_id: 'alice', p_household_id: 'alice-house', p_amount: 50, p_wa_message_id: 'message-a' })],
      ['whatsapp_log_transaction', expect.objectContaining({ p_profile_id: 'bob', p_household_id: 'bob-house', p_amount: 75, p_wa_message_id: 'message-b' })],
    ]);
    const sends = vi.mocked(fetch).mock.calls.map(([, options]) => JSON.parse(String(options?.body)));
    expect(sends).toEqual([
      expect.objectContaining({ to: '111', text: { body: expect.stringContaining('50 USD') } }),
      expect.objectContaining({ to: '222', text: { body: expect.stringContaining('75 USD') } }),
    ]);
    expect(inboxQueries.flatMap(query => query.upsert.mock.calls)).toHaveLength(2);
    expect(inboxQueries.flatMap(query => query.update.mock.calls).filter(([patch]) => patch.status === 'done')).toHaveLength(2);
  });
});

// ── v10.40.0 (W0) — failures are recorded, replayed and bounded ──────────────────
const sign = (body: string) => `sha256=${createHmac('sha256', 'test-app-secret').update(body).digest('hex')}`;
const inbound = (text: string) => JSON.stringify({ entry: [{ changes: [{ value: {
  messages: [{ id: 'm-1', from: '111', timestamp: String(Date.UTC(2026, 8, 24, 6, 0) / 1000), text: { body: text } }] } }] }] });

/** Route every table to a fresh query; the inbox claim reports `attempts`. */
function webhookTables(attempts = 0) {
  const inbox: ReturnType<typeof queryResult>[] = [];
  api.from.mockImplementation((table: string) => {
    if (table === 'accounts') return queryResult([{ name: 'Bank', kind: 'bank', currency: 'INR' }]);
    if (table === 'assets') return queryResult([]);
    if (table === 'whatsapp_identities') return queryResult({ profile_id: 'alice', household_id: 'alice-house' });
    if (table === 'whatsapp_inbound_messages') {
      const q = queryResult([{ wa_message_id: 'm-1', attempts }]);
      inbox.push(q);
      return q;
    }
    throw new Error(`Unexpected table ${table}`);
  });
  const patches = () => inbox.flatMap(q => q.update.mock.calls.map(([patch]) => patch as Record<string, unknown>));
  return { patches };
}
const sentTexts = () => vi.mocked(fetch).mock.calls.map(([, o]) => JSON.parse(String(o?.body))?.text?.body as string);

describe('webhook failure handling (W0)', () => {
  it('CON-UNIT-WA-W0-001 · a ledger error marks the row FAILED (not done), attempt 1, and says it is queued', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const { patches } = webhookTables(0);
    api.rpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });
    const body = inbound('450 lunch');
    await handler(new Request('https://edge.example.com/webhook', { method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body }));
    const failed = patches().filter(p => p.status === 'failed');
    expect(failed[0]).toEqual(expect.objectContaining({ status: 'failed', attempts: 1, last_error: 'rpc: connection reset' }));
    expect(patches().some(p => p.status === 'done')).toBe(false);
    expect(sentTexts()[0]).toContain('queued');
  });

  it('CON-UNIT-WA-W0-002 · the attempt counter climbs from the row, and the last retry asks the user to resend', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const { patches } = webhookTables(2);
    api.rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    const body = inbound('450 lunch');
    await handler(new Request('https://edge.example.com/webhook', { method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body }));
    expect(patches().find(p => p.status === 'failed')).toEqual(expect.objectContaining({ attempts: 3 }));
    expect(sentTexts()[0]).toContain('send it again');
  });

  it('CON-UNIT-WA-W0-003 · a stated date reaches p_date and is never read as the amount', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    webhookTables(0);
    api.rpc.mockResolvedValue({ error: null, data: { status: 'success', amount: 450, currency: 'INR', type: 'expense', category_id: 'food_dining', account_name: 'Bank' } });
    const body = inbound('yesterday 450 lunch');
    await handler(new Request('https://edge.example.com/webhook', { method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body }));
    expect(api.rpc).toHaveBeenCalledWith('whatsapp_log_transaction', expect.objectContaining({ p_amount: 450, p_date: '2026-09-23' }));
    expect(sentTexts()[0]).toContain('on 2026-09-23');
  });

  it('CON-UNIT-WA-W0-004 · a button reply is recorded as done without a reply', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const { patches } = webhookTables(0);
    const body = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: 'm-1', from: '111', type: 'button', button: { text: 'Mark as paid' } }] } }] }] });
    await handler(new Request('https://edge.example.com/webhook', { method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body }));
    expect(patches().find(p => p.status === 'done')).toEqual(expect.objectContaining({ last_error: 'ignored_button' }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-W0-005 · the sweep needs the service key, then replays failed rows through the ledger', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const denied = await handler(new Request('https://edge.example.com/webhook?mode=sweep', { method: 'POST', headers: { Authorization: 'Bearer nope' } }));
    expect(denied.status).toBe(403);
    api.from.mockImplementation((table: string) => {
      if (table === 'accounts') return queryResult([{ name: 'Bank', kind: 'bank', currency: 'INR' }]);
      if (table === 'assets') return queryResult([]);
      if (table === 'whatsapp_identities') return queryResult({ profile_id: 'alice', household_id: 'alice-house' });
      return queryResult([{ wa_message_id: 'm-9', attempts: 1, payload: { id: 'm-9', from: '111', text: { body: '80 coffee' } } }]);
    });
    api.rpc.mockResolvedValue({ error: null, data: { status: 'duplicate' } });
    const res = await handler(new Request('https://edge.example.com/webhook?mode=sweep', { method: 'POST', headers: { Authorization: 'Bearer test-service-key' } }));
    expect((await res.json()).replayed).toBeGreaterThan(0);
    expect(api.rpc).toHaveBeenCalledWith('whatsapp_log_transaction', expect.objectContaining({ p_wa_message_id: 'm-9', p_amount: 80 }));
    expect(fetch).not.toHaveBeenCalled();   // a replay that already landed stays silent
  });
});

describe('whatsapp-notify guards (W0)', () => {
  const ENABLED = { WHATSAPP_OUTBOUND_ENABLED: 'true', WHATSAPP_APPROVED_TEMPLATES: 'bill_due_reminder,reengagement_nudge' };
  const call = (handler: (r: Request) => Promise<Response>, token: string, body: Record<string, unknown>) =>
    handler(new Request('https://edge.example.com/notify', { method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ householdId: 'h', toProfileId: 'p2', ...body }) }));
  function tables(opts: { role?: string; claimError?: unknown; sentToday?: number } = {}) {
    const inbox: ReturnType<typeof queryResult>[] = [];
    api.from.mockImplementation((table: string) => {
      if (table === 'memberships') return queryResult({ role: opts.role ?? 'member' });
      if (table === 'whatsapp_identities') return queryResult({ phone_number: '222', household_id: 'h' });
      if (table === 'whatsapp_inbound_messages') {
        // Call order: [0] the 24h count, [1] the dedupe claim, then status updates.
        const q = queryResult(null, inbox.length === 1 ? (opts.claimError ?? null) : null, opts.sentToday ?? 0);
        inbox.push(q);
        return q;
      }
      throw new Error(`Unexpected table ${table}`);
    });
    return inbox;
  }

  it('CON-UNIT-WA-W0-006 · a server job authenticates with the service key and sends', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'), ENABLED);
    tables();
    const res = await call(handler, 'test-service-key', { event: 'bill_due', params: ['Rohan', 'BESCOM\nbill', 'Tuesday', '3,200'] });
    expect(await res.json()).toEqual({ status: 'sent', template: 'bill_due_reminder' });
    expect(api.auth.getUser).not.toHaveBeenCalled();
    const sent = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(sent.template.components[0].parameters[1].text).toBe('BESCOM bill');   // newline cleaned
  });

  it('CON-UNIT-WA-W0-007 · a viewer cannot message other members', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'), ENABLED);
    api.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    tables({ role: 'viewer' });
    const res = await call(handler, 'user-jwt', { event: 'bill_due' });
    expect(res.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-W0-008 · marketing is refused until the recipient has opted in', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'), ENABLED);
    tables();
    expect(await (await call(handler, 'test-service-key', { event: 'reengagement' })).json())
      .toEqual(expect.objectContaining({ status: 'skipped', reason: 'marketing_consent_required' }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-W0-009 · a second send of the same event is refused as a duplicate', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'), ENABLED);
    tables({ claimError: { code: '23505' } });
    expect(await (await call(handler, 'test-service-key', { event: 'bill_due', dedupeKey: 'sched-1:2026-09-24' })).json())
      .toEqual(expect.objectContaining({ status: 'skipped', reason: 'duplicate' }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-W0-010 · the daily cap and the outbound switch both stop a send', async () => {
    let handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'), ENABLED);
    tables({ sentToday: 6 });
    expect((await (await call(handler, 'test-service-key', { event: 'bill_due' })).json()).reason).toBe('daily_cap');
    vi.resetModules();
    handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'));
    tables();
    expect((await (await call(handler, 'test-service-key', { event: 'bill_due' })).json()).reason).toBe('outbound_disabled');
    expect(fetch).not.toHaveBeenCalled();
  });
});