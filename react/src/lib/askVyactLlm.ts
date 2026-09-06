// Ask Vyact — model-backed assistant (architecture P3).
//
// This replaces the deterministic classify (stage 3) and phrase (stage 5) stages
// with model calls. Stage 4 — `resolve()` — is deliberately NOT replaced: it
// stays the sole source of every figure. The model chooses WHAT to look up and
// says it in words; it never does arithmetic on money.
//
// That split is the whole safety story. A model that invents "you spent ₹42,000"
// in a finance app is a liability; a model that reads a computed figure aloud is
// not. `assertNoInventedFigures` below enforces it mechanically rather than
// trusting the prompt — prompts are requests, guards are guarantees.
//
// PROVIDER-AGNOSTIC by construction: the only outside dependency is a `ModelCall`
// function, so this module is fully testable with no network, no key and no
// provider, and swapping vLLM for anything OpenAI-compatible changes nothing here.

import type { AssistantContext } from './askVyactBackend';
import type { AssistantIntentId, IntentResult } from './askVyactIntents';
import type { ResolveResult } from './askVyactResponses';

/** The 14 intents `resolve()` implements. The model must return one of these. */
export const INTENT_IDS = [
  'capture.expense', 'capture.income', 'capture.transfer', 'capture.investment',
  'capture.split',
  'interpret.lookup', 'interpret.status', 'interpret.diagnostic',
  'interpret.budgets', 'interpret.debts', 'interpret.bills',
  'forecast.affordability', 'forecast.runway', 'forecast.prescriptive',
] as const;
export type KnownIntentId = typeof INTENT_IDS[number];

const BUCKET_OF: Record<string, IntentResult['bucket']> = {
  capture: 'capture', interpret: 'interpret', forecast: 'forecast',
};

/** One model round-trip. Injected, so tests and evals run offline. */
export interface ModelCall {
  (req: {
    system: string;
    user: string;
    /** Ask for strict JSON. Providers that support it get response_format. */
    json?: boolean;
    maxTokens?: number;
  }): Promise<string>;
}

export class ModelUnavailableError extends Error {
  constructor(cause: string) {
    super(`Ask Vyact could not reach the model: ${cause}`);
    this.name = 'ModelUnavailableError';
  }
}

export class InventedFigureError extends Error {
  readonly offending: string[];
  constructor(offending: string[]) {
    super(`Model reply contained figures no tool produced: ${offending.join(', ')}`);
    this.name = 'InventedFigureError';
    this.offending = offending;
  }
}

// ── stage 3: classify ────────────────────────────────────────────────────────

const CLASSIFY_SYSTEM = `You classify a personal-finance question into exactly one intent.

Return ONLY minified JSON: {"id":"<intent>","entities":{...},"confidence":0.0-1.0}

Valid ids: ${INTENT_IDS.join(', ')}

Entities you may extract when the user states them explicitly:
  amount (number), currency (3-letter code), category (string), account (string),
  toAccount (string), merchant (string), period (string), target (string)

RULES
- Never invent an entity the user did not state. Omit it instead.
- capture.* means the user is RECORDING a transaction they made.
- interpret.* means they are ASKING about existing data.
- forecast.* means they are asking about the future or affordability.
- If you cannot tell, use the closest interpret.* and set confidence below 0.5.
- Output JSON only. No prose, no markdown, no code fences.`;

function stripFences(raw: string): string {
  return raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

/**
 * Ask the model which intent this is. Entities are extracted but NEVER trusted
 * for money: `resolve()` re-derives every figure from the household's own data.
 */
export async function classifyIntentViaModel(
  utterance: string,
  _ctx: AssistantContext,
  call: ModelCall,
): Promise<IntentResult> {
  let raw: string;
  try {
    raw = await call({ system: CLASSIFY_SYSTEM, user: utterance, json: true, maxTokens: 256 });
  } catch (err) {
    throw new ModelUnavailableError(err instanceof Error ? err.message : String(err));
  }

  let parsed: { id?: unknown; entities?: unknown; confidence?: unknown };
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    // A model that cannot produce JSON cannot be trusted to have understood the
    // question either. Fall through to the caller's fallback rather than guess.
    return { id: 'fallback', bucket: 'none', entities: { text: utterance }, confidence: 0 };
  }

  const id = typeof parsed.id === 'string' ? parsed.id : '';
  if (!(INTENT_IDS as readonly string[]).includes(id)) {
    return { id: 'fallback', bucket: 'none', entities: { text: utterance }, confidence: 0 };
  }

  // `text` is always the user's own words, never the model's paraphrase.
  const entities: IntentResult['entities'] = {
    ...(parsed.entities && typeof parsed.entities === 'object' ? parsed.entities : {}),
    text: utterance,
  };
  const confidence = typeof parsed.confidence === 'number'
    ? Math.min(1, Math.max(0, parsed.confidence))
    : 0.5;

  return {
    id: id as AssistantIntentId,
    bucket: BUCKET_OF[id.split('.')[0]] ?? 'none',
    entities,
    confidence,
  };
}

// ── the anti-hallucination guard ─────────────────────────────────────────────

/** Numbers that carry no money meaning and may legitimately appear in prose. */
const HARMLESS = new Set(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '24', '30', '31', '100']);

/** Every numeric token in a string, commas stripped. */
function figuresIn(text: string): string[] {
  const out: string[] = [];
  const re = /\d[\d,]*(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || '')) !== null) out.push(m[0].replace(/,/g, ''));
  return out;
}

/**
 * THE "SERVICES COMPUTE" GUARD, mechanised.
 *
 * Every money-shaped figure in the model's reply must trace back to a value
 * `resolve()` produced. This is the automated form of the binding rule, and it
 * is what makes a model-written answer safe to show in a finance app: a
 * hallucinated total cannot reach the user, because it did not come from a tool.
 */
export function assertNoInventedFigures(
  reply: string,
  vars: Record<string, string | number>,
): void {
  // Everything the tools computed, normalised the same way as the reply.
  const allowed = new Set<string>();
  for (const v of Object.values(vars ?? {})) {
    for (const f of figuresIn(String(v))) {
      allowed.add(f);
      // Accept 850 for a computed 850.00 and vice versa.
      if (f.includes('.')) allowed.add(f.replace(/\.0+$/, ''));
      else allowed.add(`${f}.00`);
    }
  }

  const offending = figuresIn(reply).filter(f => {
    if (allowed.has(f) || HARMLESS.has(f)) return false;
    if (f.includes('.') && allowed.has(f.replace(/\.0+$/, ''))) return false;
    if (!f.includes('.') && allowed.has(`${f}.00`)) return false;
    // A 4-digit number in a sentence is far more likely a year than a total.
    if (/^(19|20)\d{2}$/.test(f)) return false;
    return true;
  });

  if (offending.length > 0) throw new InventedFigureError([...new Set(offending)]);
}

// ── stage 5: phrase ──────────────────────────────────────────────────────────

const PHRASE_SYSTEM = `You are Vyact's finance assistant. You will be given the
COMPUTED RESULT of a user's question as structured data. Put it into one or two
short, calm sentences.

ABSOLUTE RULES
- Use ONLY the numbers given to you. Never calculate, estimate, round, convert,
  total, or infer any figure. If a number is not in the data, it does not exist.
- Never add advice, caveats, disclaimers or apologies unless the data says so.
- Plain language. No markdown, no bullet points, no emoji, no headings.
- Speak to the user as "you". Be direct and warm, never chirpy.
- If the outcome indicates something is missing, say plainly what you need.`;

/**
 * Turn a computed `ResolveResult` into prose.
 *
 * The model sees ONLY the resolved variables — never the raw transaction list —
 * so it cannot leak detail the summary deliberately excludes, and cannot base a
 * figure on anything but a computed one.
 */
export async function phraseViaModel(
  intent: IntentResult,
  result: ResolveResult,
  call: ModelCall,
): Promise<string> {
  const payload = JSON.stringify({
    question_type: intent.id,
    outcome: result.outcome,
    data: result.vars ?? {},
  });

  let reply: string;
  try {
    reply = (await call({ system: PHRASE_SYSTEM, user: payload, maxTokens: 200 })).trim();
  } catch (err) {
    throw new ModelUnavailableError(err instanceof Error ? err.message : String(err));
  }

  reply = stripFences(reply);
  if (!reply) throw new ModelUnavailableError('empty reply');

  // Guard, then return. A reply that invents money is discarded, never shown.
  assertNoInventedFigures(reply, result.vars ?? {});
  return reply;
}
