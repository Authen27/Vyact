// W4 (v10.45.0) — the server-side model call for Ask Vyact on WhatsApp: the gateway's
// config, cap and metering. v10.135.0 (Track Q7): Pip's limits, and the test relay gone.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryResult } from './helpers/edgeHarness';

const MODEL = { id: 'm-1', seam: 'assistant', provider: 'openai', model: 'gpt-x', base_url: 'https://api.example.com',
  key_env_var: 'LLM_TEST_KEY', params: {}, enabled: true, priority: 10 };
/** A model piloted on someone else: higher priority, so a missed allowlist would pick it. */
const PILOT = { id: 'p-1', seam: 'assistant', provider: 'vllm', model: 'pilot', base_url: 'https://pilot.example.com',
  key_env_var: null, params: { allowed_user_ids: ['bob'] }, enabled: true, priority: 50 };

function admin(opts: { rows?: unknown[]; reserveError?: { code?: string; message?: string } } = {}) {
  const usageUpdates: Record<string, unknown>[] = [];
  const api = {
    from: vi.fn((table: string) => {
      if (table === 'ai_model_configs') return queryResult(opts.rows ?? [PILOT, MODEL]);
      const q = queryResult(null);
      q.update.mockImplementation((row: Record<string, unknown>) => { usageUpdates.push(row); return q; });
      return q;
    }),
    rpc: vi.fn(async () => (opts.reserveError ? { data: null, error: opts.reserveError } : { data: 'res-1', error: null })),
  };
  return { api, usageUpdates };
}

const reply = (content: string) => vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
  choices: [{ message: { content }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
}), { status: 200, headers: { 'Content-Type': 'application/json' } }));

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('Deno', { env: { get: (k: string) => (k === 'LLM_TEST_KEY' ? 'sk-test' : undefined) } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
    choices: [{ message: { content: 'Here you go.' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 12, completion_tokens: 4, total_tokens: 16 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
});
afterEach(() => vi.unstubAllGlobals());

const caller = { userId: 'alice', householdId: 'h-1', surface: 'whatsapp' as const, dailyCap: 200 };

describe('assistantCore — the server model call (W4)', () => {
  it('CON-UNIT-W4-005 · uses the production model (never a pilot meant for someone else), reserves the cap and meters as whatsapp', async () => {
    const { serverModelCall } = await import('../../../../supabase/functions/_shared/agent/assistantCore');
    const { api, usageUpdates } = admin();
    const text = await serverModelCall(api as never, caller)({ system: 'phrase', user: '{}' });
    expect(text).toBe('Here you go.');
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('https://api.example.com/v1/chat/completions');
    expect(api.rpc).toHaveBeenCalledWith('reserve_ai_usage', { p_user_id: 'alice', p_household_id: 'h-1', p_surface: 'whatsapp', p_cap: 200 });
    expect(usageUpdates[0]).toEqual(expect.objectContaining({ surface: 'whatsapp', prompt_tokens: 12, completion_tokens: 4 }));
    expect(usageUpdates[0]).not.toHaveProperty('user_id');
  });

  it('CON-UNIT-W4-006 · over the cap fails closed before any provider call; no model means unavailable', async () => {
    const { serverModelCall } = await import('../../../../supabase/functions/_shared/agent/assistantCore');
    const over = admin({ reserveError: { code: '42901', message: 'quota_exceeded' } });
    await expect(serverModelCall(over.api as never, caller)({ system: 's', user: 'u' })).rejects.toThrow('quota_exceeded');
    expect(fetch).not.toHaveBeenCalled();
    const none = admin({ rows: [PILOT] });                                   // only someone else's pilot → nothing
    await expect(serverModelCall(none.api as never, caller)({ system: 's', user: 'u' })).rejects.toThrow(/no model is enabled/);
    expect(none.api.rpc).not.toHaveBeenCalled();
  });

  it("Q7-106 · WhatsApp is held to Pip's limits too: always reserved, a refusal named, an off-topic classify recorded", async () => {
    const { serverModelCall } = await import('../../../../supabase/functions/_shared/agent/assistantCore');
    // 'off' at the gateway: still reserved, the database's own cap applies.
    const off = admin();
    await serverModelCall(off.api as never, { ...caller, dailyCap: null })({ system: 's', user: 'u' });
    expect(off.api.rpc).toHaveBeenCalledWith('reserve_ai_usage', { p_user_id: 'alice', p_household_id: 'h-1', p_surface: 'whatsapp', p_cap: null });
    for (const [error, thrown] of [[{ code: '42901', message: 'cooldown' }, 'cooldown'], [{ code: '42901', message: 'rate_limited' }, 'rate_limited'],
      [{ code: '42901', message: 'global_exceeded' }, 'global_exceeded'], [{ code: '55000', message: 'quota_misconfigured' }, 'misconfigured'],
      [{ code: 'XX000', message: 'boom' }, 'quota_check_failed']] as const) {
      const refused = admin({ reserveError: error });
      await expect(serverModelCall(refused.api as never, caller)({ system: 's', user: 'u' })).rejects.toThrow(thrown);
    }
    expect(fetch).toHaveBeenCalledOnce();
    const metered = admin();
    reply('{"id":"off_topic","entities":{},"confidence":0.8}');
    await serverModelCall(metered.api as never, caller)({ op: 'classify', system: 's', user: 'tell me a joke' });
    reply('{"id":"interpret.lookup"}');
    await serverModelCall(metered.api as never, caller)({ op: 'classify', system: 's', user: 'food?' });
    expect(metered.usageUpdates[0]).toEqual(expect.objectContaining({ intent: 'off_topic' }));
    expect(metered.usageUpdates[1]).not.toHaveProperty('intent');
  });
});
