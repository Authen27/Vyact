// Ask Vyact — model transport (architecture P3).
//
// The ONE place the app talks to a model. Everything else takes a `ModelCall`
// function, so the assistant, its tests and the eval harness are all provider-
// agnostic and run offline.
//
// 🔴 THE MODEL IS NEVER CALLED FROM THE BROWSER DIRECTLY.
// Requests go to the `ask-vyact` Edge Function, which holds the provider key in
// Supabase secrets. A browser-side key would ship in the bundle and be readable
// by anyone who opens devtools — that is exactly the mistake the retired
// geminiBackend made, and the reason the key is server-side now.
//
// Returns null when nothing is configured. Null means UNAVAILABLE; it must never
// be interpreted as permission to answer from somewhere else.

import { supabase } from './supabase';
import { MODEL_LIMITS, ModelLimitError, type ModelCall, type ModelLimit } from './askVyactLlm';

/** Shape the `ask-vyact` gateway returns. `enabled:false` is a normal, expected
 *  state — the kill switch is a DB row, and off is the default. */
interface GatewayResponse {
  ok: boolean;
  enabled?: boolean;
  text?: string;
  error?: string;
  message?: string;
  /** v10.135.0 (Q7): seconds until a refused call may be asked again. */
  retryAfter?: number;
}

/**
 * v10.135.0 (Track Q7; audit OPS-11) — a refusal by one of Pip's limits (429) as a ModelLimitError, so Pip says
 * which limit applies. Any other failure, or a body that cannot be read, stays a plain transport error.
 */
async function limitFrom(error: unknown): Promise<ModelLimitError | null> {
  let body: GatewayResponse | undefined;
  try { body = await (error as { context?: Response }).context?.json(); } catch { /* fault-ok: an unreadable error body is reported as the transport error it came with */ }
  if (!body || !(MODEL_LIMITS as readonly string[]).includes(body.error ?? '')) return null;
  const wait = typeof body.retryAfter === 'number' && Number.isFinite(body.retryAfter) ? body.retryAfter : null;
  return new ModelLimitError(body.error as ModelLimit, wait);
}

/** W8a (audit FE-PIP-16): the longest the app waits for one gateway answer before giving up. */
export const CLIENT_DEADLINE_MS = 30_000;

/** One call's signal: aborted by the turn (Stop, New chat, leaving the chat) or by the deadline.
 *  Built by hand rather than with `AbortSignal.any` so older Safari is covered. */
function callSignal(turn: AbortSignal | undefined, deadlineMs: number | null): { signal: AbortSignal; done: () => void } {
  const c = new AbortController();
  const onAbort = () => c.abort(turn?.reason ?? new DOMException('Stopped', 'AbortError'));
  if (turn?.aborted) onAbort(); else turn?.addEventListener('abort', onAbort, { once: true });
  const timer = deadlineMs == null ? null : setTimeout(() => c.abort(new DOMException('The answer took too long', 'TimeoutError')), deadlineMs);
  return { signal: c.signal, done: () => { if (timer) clearTimeout(timer); turn?.removeEventListener('abort', onAbort); } };
}

const stoppedError = () => new DOMException('Stopped', 'AbortError');

/** A real household to attribute the call to (the gateway checks membership), or nothing. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Build the transport, or null when the app has no cloud backend at all
 * (localStorage-only mode has no Edge Function to call).
 *
 * W1c (v10.64.0, audit BE-PIP-02/03): the request names the op and carries the text; the
 * gateway composes the system prompt itself, so `system` is never sent. `householdId` lets the
 * gateway attribute the call (before this every web row had household_id = null).
 */
export function resolveConfiguredModelCall(householdId?: string | null, turnSignal?: AbortSignal): ModelCall | null {
  const client = supabase;
  if (!client) return null;
  const hid = householdId && UUID_RE.test(householdId) ? householdId : undefined;

  return async ({ op, user, offending, maxTokens }) => {
    // W8a (audit FE-PIP-16): Stop / New chat / leaving the chat abort the request, and a gateway
    // that never answers is given up on after CLIENT_DEADLINE_MS (it used to run on regardless).
    if (turnSignal?.aborted) throw stoppedError();
    const call = callSignal(turnSignal, CLIENT_DEADLINE_MS);
    const { data, error } = await client.functions.invoke<GatewayResponse>('ask-vyact', {
      body: {
        seam: 'assistant',
        surface: 'chat',
        op,
        input: user,
        ...(offending?.length ? { offending } : {}),
        ...(hid ? { householdId: hid } : {}),
        ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
      },
      signal: call.signal,
    }).finally(call.done);

    // Transport failure — the caller turns this into an "unavailable" turn; one of Pip's limits says which.
    if (error) throw (await limitFrom(error)) ?? new Error(error.message ?? 'gateway request failed');
    if (!data) throw new Error('empty gateway response');

    // The kill switch is off, or no model row is enabled. This is a normal
    // configuration state, not a bug, and it must surface as unavailable rather
    // than as a silent empty answer.
    if (data.enabled === false) {
      throw new Error(data.message ?? 'no model is enabled for the assistant');
    }
    if (!data.ok) throw new Error(data.message ?? data.error ?? 'gateway error');
    if (!data.text) throw new Error('model returned no text');

    return data.text;
  };
}
