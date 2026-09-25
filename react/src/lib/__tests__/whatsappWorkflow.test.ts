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

  it('verifies a valid OTP, persists the server-owned identity, consumes the OTP and asks notify for the welcome', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-verify-otp/index'));
    api.auth.getUser.mockResolvedValue({ data: { user: { id: 'alice' } }, error: null });
    const otp = queryResult({ id: 'otp', household_id: 'alice-house', phone_number: '111', attempts: 0,
      otp_hash: createHash('sha256').update('123456:111:test-pepper').digest('hex') });
    const identity = queryResult(null);
    const cleanup = queryResult(null);
    api.from.mockReturnValueOnce(otp).mockReturnValueOnce(identity).mockReturnValueOnce(cleanup)
      .mockReturnValueOnce(queryResult({ display_name: 'Alice Rao' })).mockReturnValueOnce(queryResult({ name: 'Rao Household' }));
    const result = await handler(new Request('https://edge.example.com/verify', { method: 'POST',
      headers: { Authorization: 'Bearer test-user' }, body: JSON.stringify({ code: '123456' }) }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ status: 'linked', phone: '111', householdId: 'alice-house' });
    expect(identity.upsert).toHaveBeenCalledWith(expect.objectContaining({ profile_id: 'alice', phone_number: '111', household_id: 'alice-house' }), { onConflict: 'profile_id' });
    expect(cleanup.delete).toHaveBeenCalledOnce();
    expect(cleanup.eq).toHaveBeenCalledWith('profile_id', 'alice');
    // v10.41.0 — the welcome goes through whatsapp-notify as the service, never straight to Meta.
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/functions\/v1\/whatsapp-notify$/);
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-service-key');
    expect(JSON.parse(String(init?.body))).toEqual({ event: 'whatsapp_welcome', householdId: 'alice-house', toProfileId: 'alice',
      params: ['Alice', 'Rao Household'], dedupeKey: 'link:alice-house:111' });
  });

  it('CON-UNIT-WA-R-006 · a welcome that cannot be sent never fails the link', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-verify-otp/index'));
    api.auth.getUser.mockResolvedValue({ data: { user: { id: 'alice' } }, error: null });
    api.from.mockReturnValueOnce(queryResult({ id: 'otp', household_id: 'alice-house', phone_number: '111', attempts: 0,
      otp_hash: createHash('sha256').update('123456:111:test-pepper').digest('hex') })).mockReturnValue(queryResult(null));
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    const result = await handler(new Request('https://edge.example.com/verify', { method: 'POST',
      headers: { Authorization: 'Bearer test-user' }, body: JSON.stringify({ code: '123456' }) }));
    expect(await result.json()).toEqual({ status: 'linked', phone: '111', householdId: 'alice-house' });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body)).params).toEqual(['friend', 'your household']);
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
      expect.objectContaining({ to: '111', text: { body: expect.stringContaining('$50') } }),
      expect.objectContaining({ to: '222', text: { body: expect.stringContaining('$75') } }),
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
function webhookTables(attempts = 0, linked = true, prefs: Record<string, unknown> | null = null) {
  const inbox: ReturnType<typeof queryResult>[] = [];
  const prefWrites: Record<string, unknown>[] = [];
  api.from.mockImplementation((table: string) => {
    if (table === 'accounts') return queryResult([{ name: 'Bank', kind: 'bank', currency: 'INR' }]);
    if (table === 'assets') return queryResult([]);
    if (table === 'whatsapp_identities') return queryResult(linked ? { profile_id: 'alice', household_id: 'alice-house' } : null);
    if (table === 'profiles') return queryResult({ display_name: 'Rohan Mehta' });
    if (table === 'whatsapp_preferences') {
      const q = queryResult(prefs);
      q.upsert.mockImplementation((row: Record<string, unknown>) => { prefWrites.push(row); return q; });
      return q;
    }
    if (table === 'whatsapp_inbound_messages') {
      const q = queryResult([{ wa_message_id: 'm-1', attempts }]);
      inbox.push(q);
      return q;
    }
    throw new Error(`Unexpected table ${table}`);
  });
  const patches = () => inbox.flatMap(q => q.update.mock.calls.map(([patch]) => patch as Record<string, unknown>));
  return { patches, prefWrites };
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
  const ENABLED = { WHATSAPP_OUTBOUND_ENABLED: 'true', WHATSAPP_APPROVED_TEMPLATES: 'bill_due_reminder,split_settled,reengagement_nudge' };
  const call = (handler: (r: Request) => Promise<Response>, token: string, body: Record<string, unknown>) =>
    handler(new Request('https://edge.example.com/notify', { method: 'POST', headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ householdId: 'h', toProfileId: 'p2', ...body }) }));
  function tables(opts: { role?: string; claimError?: unknown; sentToday?: number; prefs?: Record<string, unknown> } = {}) {
    const inbox: ReturnType<typeof queryResult>[] = [];
    api.from.mockImplementation((table: string) => {
      if (table === 'memberships') return queryResult({ role: opts.role ?? 'member' });
      if (table === 'whatsapp_identities') return queryResult({ phone_number: '222', household_id: 'h' });
      if (table === 'whatsapp_preferences') return queryResult(opts.prefs ?? null);
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
    const res = await call(handler, 'test-service-key', { event: 'split_settled', params: ['Priya', 'BESCOM\nbill', 'Dinner'] });
    expect(await res.json()).toEqual({ status: 'sent', template: 'split_settled' });
    expect(api.auth.getUser).not.toHaveBeenCalled();
    const sent = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    const component = (type: string) => sent.template.components.find((c: { type: string }) => c.type === type);
    expect(component('body').parameters[1].text).toBe('BESCOM bill');   // newline cleaned
    // W1 — an image template carries its header image on the send.
    expect(component('header').parameters[0].image.link).toMatch(/\/whatsapp\/08-split-settled\.jpg$/);
    // v10.42.0 — bill reminders are held until "paid X" can approve the occurrence (W2b), even when listed.
    vi.mocked(fetch).mockClear();
    expect((await (await call(handler, 'test-service-key', { event: 'bill_due', params: ['Rent', '₹25,000', '5 Aug', 'Rent'] })).json()).reason)
      .toBe('held_until_paid_reply_approves');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-W0-007 · a viewer cannot message other members', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'), ENABLED);
    api.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    tables({ role: 'viewer' });
    const res = await call(handler, 'user-jwt', { event: 'bill_due', params: ['Rohan', '₹3,200', 'Tuesday', 'BESCOM'] });
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
    expect(await (await call(handler, 'test-service-key', { event: 'split_settled', dedupeKey: 'split:s-1', params: ['Priya', '₹600', 'Dinner'] })).json())
      .toEqual(expect.objectContaining({ status: 'skipped', reason: 'duplicate' }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-W0-010 · the daily cap and the outbound switch both stop a send', async () => {
    let handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'), ENABLED);
    tables({ sentToday: 6 });
    expect((await (await call(handler, 'test-service-key', { event: 'split_settled', params: ['Priya', '₹600', 'Dinner'] })).json()).reason).toBe('daily_cap');
    vi.resetModules();
    handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'));
    tables();
    expect((await (await call(handler, 'test-service-key', { event: 'split_settled', params: ['Priya', '₹600', 'Dinner'] })).json()).reason).toBe('outbound_disabled');
    expect(fetch).not.toHaveBeenCalled();
  });
});

// ── v10.41.0 — the receptionist: a greeting opens the action menu ───────────────
describe('WhatsApp receptionist', () => {
  const post = async (handler: (r: Request) => Promise<Response>, body: string) =>
    handler(new Request('https://edge.example.com/webhook', { method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body }));
  const sentBodies = () => vi.mocked(fetch).mock.calls.map(([, o]) => JSON.parse(String(o?.body)));

  it('CON-UNIT-WA-R-001 · "Hi" from a linked number gets the action list by first name, and logs nothing', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    webhookTables(0);
    await post(handler, inbound('Hi'));
    const [msg] = sentBodies();
    expect(msg.type).toBe('interactive');
    expect(msg.interactive.type).toBe('list');
    expect(msg.interactive.body.text).toMatch(/^Hi, Rohan\. What would you like to do\?/);
    expect(msg.interactive.action.button).toBe('Choose an action');
    expect(msg.interactive.action.sections.map((s: { title: string }) => s.title)).toEqual(['Record', 'Check', 'Help and settings']);
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-R-002 · a tapped row gets its reply; a Check row links to the app, no figures', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    webhookTables(0);
    const tap = (id: string) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [
      { id: 'm-1', from: '111', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id, title: 'x' } } }] } }] }] });
    await post(handler, tap('menu:log_spend'));
    expect(sentTexts()[0]).toContain('450 lunch hdfc');
    vi.mocked(fetch).mockClear();
    await post(handler, tap('menu:budgets'));
    expect(sentTexts()[0]).toMatch(/budgets$/);
    expect(sentTexts()[0]).not.toMatch(/₹\d/);
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-R-003 · an unlinked number gets who we are on a greeting, a one-line reminder otherwise', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    webhookTables(0, false);
    await post(handler, inbound('hello'));
    expect(sentTexts()[0]).toContain("isn't linked to an account yet");
    vi.mocked(fetch).mockClear();
    await post(handler, inbound('450 lunch'));
    expect(sentTexts()[0]).toBe("I can't record that until this number is linked. Settings › WhatsApp in the app.");
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-R-007 · the welcome template’s buttons open the menu or answer as its rows; other templates’ taps wait for W2', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const { patches } = webhookTables(0);
    const tap = (button: Record<string, string>) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [
      { id: 'm-1', from: '111', type: 'button', button } ] } }] }] });
    await post(handler, tap({ payload: 'whatsapp_welcome:0:link:alice-house:111', text: 'Menu' }));
    const [menu] = sentBodies();
    expect(menu.interactive.type).toBe('list');
    expect(menu.interactive.body.text).toBe("Here's everything I can do in this chat.");
    vi.mocked(fetch).mockClear();
    await post(handler, tap({ payload: 'whatsapp_welcome:1:link:alice-house:111', text: 'Log a spend' }));
    expect(sentTexts()[0]).toContain('450 lunch hdfc');
    vi.mocked(fetch).mockClear();
    await post(handler, tap({ payload: 'What can I send?', text: 'What can I send?' }));   // a test send from WhatsApp Manager
    expect(sentTexts()[0]).toContain('Send MENU any time');
    vi.mocked(fetch).mockClear();
    await post(handler, tap({ payload: 'someone_elses:1:x', text: 'Flag it' }));   // a payload we never issued
    expect(fetch).not.toHaveBeenCalled();
    expect(patches().at(-1)).toEqual(expect.objectContaining({ status: 'done', last_error: 'ignored_button' }));
    expect(api.rpc).not.toHaveBeenCalled();
  });
});

// ── v10.42.0 (W2) — consent, STOP, statuses and template button taps ────────────
describe('WhatsApp preferences and taps (W2)', () => {
  const post = async (handler: (r: Request) => Promise<Response>, body: string) =>
    handler(new Request('https://edge.example.com/webhook', { method: 'POST', headers: { 'x-hub-signature-256': sign(body) }, body }));
  const tap = (payload: string, extra: Record<string, unknown> = {}) => JSON.stringify({ entry: [{ changes: [{ value: { messages: [
    { id: 'm-1', from: '111', type: 'button', button: { payload, text: 'x' }, ...extra }] } }] }] });

  it('CON-UNIT-WA-P-001 · STOP BUDGETS mutes budgets, says what still comes, and logs nothing', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const { prefWrites } = webhookTables(0);
    await post(handler, inbound('STOP BUDGETS'));
    expect(prefWrites[0]).toEqual(expect.objectContaining({ profile_id: 'alice', muted_topics: ['budgets'] }));
    expect(sentTexts()[0]).toMatch(/^Done\. No more budget alerts\./);
    expect(sentTexts()[0]).toContain('Bill reminders and large-spend alerts still come');
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-P-002 · bare STOP withdraws marketing and insights and mutes every mutable topic, never bills', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const { prefWrites } = webhookTables(0, true, { marketing_opt_in: true, insights_opt_in: false, muted_topics: [], large_txn_threshold: 10000 });
    await post(handler, inbound('stop'));
    const w = prefWrites[0];
    expect(w).toEqual(expect.objectContaining({ marketing_opt_in: false, insights_opt_in: false, marketing_opt_in_at: null, marketing_source: null }));
    expect(w.muted_topics).toContain('weekly');
    expect(w.muted_topics).not.toContain('bills');
    expect(w.muted_topics).not.toContain('large_spend');
  });

  it('CON-UNIT-WA-P-003 · a "Stop these" tap mutes that template’s topic; "Flag it" advises the bank and writes nothing', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const { prefWrites } = webhookTables(0);
    await post(handler, tap('payday_headroom:1:2026-09-25'));
    expect(prefWrites[0]).toEqual(expect.objectContaining({ muted_topics: ['payday'] }));
    expect(sentTexts()[0]).toMatch(/^Done\. No more payday messages\./);
    vi.mocked(fetch).mockClear();
    await post(handler, tap('large_transaction_alert:1:txn:t-1'));
    expect(sentTexts()[0]).toContain("I can't block a card");
    expect(prefWrites).toHaveLength(1);
    expect(api.rpc).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-P-004 · a tap on a message more than a week old is not acted on', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const { prefWrites } = webhookTables(0);
    const old = new Date(Date.now() - 8 * 86_400_000).toISOString();
    api.from.mockImplementation(((orig) => (table: string) => {
      if (table === 'whatsapp_inbound_messages') {
        const q = queryResult([{ wa_message_id: 'm-1', attempts: 0 }]);
        q.maybeSingle.mockReturnValue(queryResult({ created_at: old }));
        return q;
      }
      return orig(table);
    })(api.from.getMockImplementation()!));
    await post(handler, tap('payday_headroom:1:2026-09-01', { context: { id: 'wamid.OLD' } }));
    expect(sentTexts()[0]).toMatch(/^That message is from a while ago/);
    expect(prefWrites).toHaveLength(0);
  });

  it('CON-UNIT-WA-P-005 · delivery statuses move forward only, and Meta’s marketing stop withdraws consent', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    const updates: Record<string, unknown>[] = [];
    const prefWrites: Record<string, unknown>[] = [];
    let current = 'delivered';
    api.from.mockImplementation((table: string) => {
      if (table === 'whatsapp_identities') return queryResult({ profile_id: 'alice', household_id: 'alice-house' });
      if (table === 'whatsapp_preferences') {
        const q = queryResult(null);
        q.upsert.mockImplementation((row: Record<string, unknown>) => { prefWrites.push(row); return q; });
        return q;
      }
      const q = queryResult({ wa_message_id: 'out:x', delivery_status: current });
      q.update.mockImplementation((row: Record<string, unknown>) => { updates.push(row); return q; });
      return q;
    });
    const body = (statuses: unknown[], extra: Record<string, unknown> = {}) =>
      JSON.stringify({ entry: [{ changes: [{ value: { statuses, ...extra } }] }] });
    await post(handler, body([{ id: 'wamid.1', status: 'read' }]));
    expect(updates[0]).toEqual(expect.objectContaining({ delivery_status: 'read' }));
    current = 'read';
    await post(handler, body([{ id: 'wamid.1', status: 'delivered' }]));   // late, out of order
    expect(updates).toHaveLength(1);
    await post(handler, body([], { user_preferences: [{ wa_id: '111', category: 'marketing_messages', value: 'stop' }] }));
    expect(prefWrites[0]).toEqual(expect.objectContaining({ profile_id: 'alice', marketing_opt_in: false, marketing_source: 'meta_opt_out' }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('CON-UNIT-WA-P-006 · "Messages I send you" reads the person’s own preferences', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-webhook/index'));
    webhookTables(0, true, { marketing_opt_in: false, insights_opt_in: false, muted_topics: ['budgets'], large_txn_threshold: 10000 });
    await post(handler, JSON.stringify({ entry: [{ changes: [{ value: { messages: [
      { id: 'm-1', from: '111', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'menu:messages', title: 'x' } } }] } }] }] }));
    const text = sentTexts()[0];
    expect(text).toContain('Bill reminders and large-spend alerts (always)');
    expect(text).toMatch(/Off:\n• Budget alerts/);
    expect(text).toContain('Tips and weekly summaries');
  });

  it('CON-UNIT-WA-P-007 · notify refuses a muted topic and marketing without opt-in, and records Meta’s id on a send', async () => {
    const ENABLED = { WHATSAPP_OUTBOUND_ENABLED: 'true', WHATSAPP_APPROVED_TEMPLATES: 'budget_threshold_alert,weekly_summary' };
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-notify/index'), ENABLED);
    const call = (body: Record<string, unknown>) => handler(new Request('https://edge.example.com/notify', { method: 'POST',
      headers: { Authorization: 'Bearer test-service-key' }, body: JSON.stringify({ householdId: 'h', toProfileId: 'p2', ...body }) }));
    let prefs: Record<string, unknown> = { marketing_opt_in: false, insights_opt_in: false, muted_topics: ['budgets'], large_txn_threshold: 10000 };
    const updates: Record<string, unknown>[] = [];
    api.from.mockImplementation((table: string) => {
      if (table === 'whatsapp_identities') return queryResult({ phone_number: '222', household_id: 'h' });
      if (table === 'whatsapp_preferences') return queryResult(prefs);
      const q = queryResult(null, null, 0);
      q.update.mockImplementation((row: Record<string, unknown>) => { updates.push(row); return q; });
      return q;
    });
    const budget = { event: 'budget_threshold_alert', params: ['Dining', '81', '9', '1,540'] };
    expect((await (await call(budget)).json()).reason).toBe('muted');
    expect((await (await call({ event: 'weekly_summary', params: ['₹1', '2', 'Dining'] })).json()).reason).toBe('marketing_consent_required');
    prefs = { ...prefs, muted_topics: [] };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.SENT' }] })));
    expect(await (await call(budget)).json()).toEqual({ status: 'sent', template: 'budget_threshold_alert' });
    expect(updates.at(-1)).toEqual(expect.objectContaining({ status: 'sent', provider_message_id: 'wamid.SENT', delivery_status: 'accepted' }));
  });
});