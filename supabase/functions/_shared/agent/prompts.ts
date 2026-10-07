// Pip's prompts are composed HERE, never taken from a client (W1c, v10.64.0; audit 2026-10-04
// BE-PIP-02).
//
// Before this, the browser built `{ role: 'system', content: … }` and the gateway forwarded any
// messages it was sent, so a signed-in account could use Vyact's model key as a general-purpose
// LLM with a system prompt of its own. Now a request names an op from a CLOSED set
// (`classify` | `phrase`) and the user text; the system prompt comes from the app's own bundled
// engine (`systemPromptFor`), byte-identical to what the app used to send.
//
// Transitional, one release: an app build from before v10.64.0 still sends `messages`. That form
// is accepted only when it is EXACTLY one of the server's own prompts plus one user message, so it
// is no longer a way to send a prompt of your own. Remove `fromLegacyMessages` in the next release.

import { cleanOffending, systemPromptFor, type ModelOp } from './engine.ts';
import type { ChatMessage } from './router.ts';

export type Composed =
  | { ok: true; op: ModelOp; messages: ChatMessage[]; legacy: boolean }
  | { ok: false; reason: string };

export interface PromptRequest {
  op?: unknown;
  input?: unknown;
  offending?: unknown;
  messages?: unknown;
}

const REFUSE = 'Prompts are composed by the server: send op ("classify" or "phrase") and input.';

function compose(op: ModelOp, offending: readonly string[], input: string, legacy: boolean): Composed {
  return {
    ok: true, op, legacy,
    messages: [{ role: 'system', content: systemPromptFor(op, offending) }, { role: 'user', content: input }],
  };
}

export function composeAssistantMessages(body: PromptRequest): Composed {
  if (body.op === undefined && body.input === undefined) return fromLegacyMessages(body.messages);
  if (body.op !== 'classify' && body.op !== 'phrase') return { ok: false, reason: REFUSE };
  if (typeof body.input !== 'string' || !body.input.trim()) return { ok: false, reason: 'input is required.' };
  if (body.messages !== undefined) return { ok: false, reason: REFUSE };
  const offending = cleanOffending(body.offending);
  if (!offending) return { ok: false, reason: 'offending must be a list of at most 12 figures.' };
  if (body.op === 'classify' && offending.length) return { ok: false, reason: 'offending applies to phrase only.' };
  return compose(body.op, offending, body.input, false);
}

const RETRY = /^\n\nIMPORTANT: your previous attempt was rejected for using figures that are not in FACTS: (.*?)\. Write the answer again/s;

function fromLegacyMessages(raw: unknown): Composed {
  if (!Array.isArray(raw) || raw.length !== 2) return { ok: false, reason: REFUSE };
  const [sys, usr] = raw as { role?: unknown; content?: unknown }[];
  if (sys?.role !== 'system' || usr?.role !== 'user') return { ok: false, reason: REFUSE };
  if (typeof sys.content !== 'string' || typeof usr.content !== 'string' || !usr.content.trim()) {
    return { ok: false, reason: REFUSE };
  }
  if (sys.content === systemPromptFor('classify')) return compose('classify', [], usr.content, true);
  const phrase = systemPromptFor('phrase');
  if (sys.content === phrase) return compose('phrase', [], usr.content, true);
  if (sys.content.startsWith(phrase)) {
    const m = RETRY.exec(sys.content.slice(phrase.length));
    const offending = m ? cleanOffending(m[1].split(', ')) : null;
    if (offending?.length && systemPromptFor('phrase', offending) === sys.content) {
      return compose('phrase', offending, usr.content, true);
    }
  }
  return { ok: false, reason: REFUSE };
}
