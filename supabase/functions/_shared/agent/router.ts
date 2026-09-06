// Vyact Agent — MODEL ROUTER (vyact-agent-architecture.md §5, §6, P2).
//
// One provider abstraction for every model Vyact will ever call. Providers are
// OpenAI-compatible (`POST {base_url}/v1/chat/completions`) — vLLM, Ollama, Groq,
// Together, OpenRouter and OpenAI all speak it — so **swapping a model is a DB row
// change in `ai_model_configs`, not a deploy** (binding rule §2.7a).
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS MODULE MAY AND MAY NOT DO
//
//   ✅ Send messages to an OpenAI-compatible endpoint and return TEXT plus the
//      model's TOOL-CALL SELECTIONS (name + arguments, verbatim).
//   ✅ Report failure as a value. It NEVER throws for a provider problem.
//   ❌ It does NOT compute money. No arithmetic on any transaction amount, ever
//      (binding rule §2.1). The only arithmetic here is token→USD *operational
//      spend* accounting for `ai_usage`, which is billing telemetry, not ledger
//      money and never reaches a balance.
//   ❌ It has NO database client, NO service-role key, NO write path. That is
//      structural, not a convention: this file imports nothing. A model cannot
//      reach a transaction from here even if it asks to.
//   ❌ It never evaluates, executes, or interpolates model output. Output is a
//      string and a JSON blob. `eval` and template-into-SQL do not appear here.
//
// ─────────────────────────────────────────────────────────────────────────────
// SECRETS
// The config row stores `key_env_var` — the NAME of a Supabase Function secret.
// The VALUE is read from the process env inside the edge function and never
// touches the DB, the repo, a client bundle, a log line or an error message.
// Reading is denylisted (see FORBIDDEN_KEY_ENV): a mistaken or malicious config
// row must not be able to POST the service-role key to an arbitrary `base_url`.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE UNREACHABLE-PROVIDER CASE IS NORMAL, NOT EXCEPTIONAL
// The first target is a local vLLM server. Supabase Edge runs in the cloud and
// **cannot reach a developer's localhost**. So a loopback `base_url` is detected
// BEFORE any fetch and returned as a plain `unreachable` result with a hint —
// no crash, no 20-second hang, no retry storm. Everything else that fails to
// connect is classified the same way.
//
// PURE-ISH: no imports. The only ambient global touched is `Deno.env`, behind a
// feature test, so this file also typechecks and runs under plain tsc/vitest.

// ── Deno env access, feature-tested so this module compiles without Deno types ─
interface EnvLike { get(name: string): string | undefined }
const ambientEnv: EnvLike | undefined =
  (globalThis as { Deno?: { env?: EnvLike } }).Deno?.env;

/** Read a Supabase Function secret by NAME. Returns '' when unset/unavailable. */
export const readSecret = (name: string): string => {
  try { return ambientEnv?.get(name) ?? ''; } catch { return ''; }
};

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Which selector this config drives. LOAD-BEARING.
 * The app has TWO parallel model seams (architecture §10.2): `AssistantBackend`
 * (flag-driven, live) and `ChatBackend` (env-driven). A config row that does not
 * name its seam would let an admin toggle silently configure the wrong path.
 */
export type Seam = 'chat' | 'assistant';

export const SEAMS: readonly Seam[] = ['chat', 'assistant'] as const;
export const isSeam = (v: unknown): v is Seam =>
  typeof v === 'string' && (SEAMS as readonly string[]).includes(v);

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  /** UNTRUSTED whenever it originates from a user, an SMS, or a DB string. */
  content: string;
  /** OpenAI tool-result plumbing. Opaque — passed through, never interpreted. */
  tool_call_id?: string;
  name?: string;
}

/** Model parameters, stored as `ai_model_configs.params` jsonb. */
export interface ModelParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  /**
   * USD per 1,000,000 tokens, for `ai_usage.cost_usd`.
   * OPERATIONAL SPEND ONLY — this is our bill, never a user's money.
   */
  price_per_mtok_input?: number;
  price_per_mtok_output?: number;
  /** Extra OpenAI-compatible body fields. Allowlisted keys only (see EXTRA_KEYS). */
  extra?: Record<string, unknown>;
}

/** One row of `ai_model_configs`. Mirrors 20260906120000_ai_model_configs.sql. */
export interface ModelConfigRow {
  id: string;
  seam: string;
  provider: string;
  model: string;
  base_url: string;
  /** The NAME of a Supabase secret. Never the key itself. Null = unauthenticated
   *  endpoint (the normal case for a local vLLM / Ollama server). */
  key_env_var: string | null;
  params: ModelParams | null;
  enabled: boolean;
  priority: number;
}

/** A tool the model may select. Vyact's tool bodies live elsewhere; the router
 *  only forwards the schema and relays the selection back. */
export interface ToolDefinition {
  type: 'function';
  function: { name: string; description?: string; parameters?: Record<string, unknown> };
}

/** What the model chose. NOT executed here — the caller decides, and a write
 *  tool is confirm-gated by the pipeline (binding rule §2.4). */
export interface ToolCallSelection {
  id: string;
  name: string;
  /** Verbatim arguments string as the model emitted it. */
  argumentsRaw: string;
  /** Defensively JSON.parse'd. `null` when the model emitted invalid JSON. */
  arguments: Record<string, unknown> | null;
}

export interface RouterUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type RouterFailureCode =
  | 'not_configured'   // no enabled row for this seam — the OFF state. No spend.
  | 'invalid_config'   // a row exists but is unusable (bad base_url, bad seam…)
  | 'missing_key'      // key_env_var names a secret that is not set
  | 'forbidden_key'    // key_env_var names a secret the router refuses to read
  | 'invalid_request'  // caller sent unusable messages
  | 'unreachable'      // could not connect (localhost from the cloud, DNS, TLS…)
  | 'timeout'          // exceeded the per-request budget
  | 'http_error'       // provider answered non-2xx
  | 'bad_response'     // provider answered 2xx with a shape we cannot read
  | 'empty_response';  // provider answered with neither text nor a tool call

export interface ChatCompletionSuccess {
  ok: true;
  /** Model text. Truncated at MAX_REPLY_CHARS. UNTRUSTED — never eval, never SQL. */
  text: string;
  toolCalls: ToolCallSelection[];
  provider: string;
  model: string;
  usage: RouterUsage;
  /** Operational spend in USD, or null when the config carries no pricing. */
  costUsd: number | null;
  latencyMs: number;
  finishReason: string | null;
}

export interface ChatCompletionFailure {
  ok: false;
  code: RouterFailureCode;
  /** Safe for a client. Never contains a secret, a key name value, or a body. */
  message: string;
  /** Operator-facing next step. Also safe for a client. */
  hint?: string;
  provider: string;
  model: string;
  status?: number;
  latencyMs: number;
}

export type ChatCompletionResult = ChatCompletionSuccess | ChatCompletionFailure;

export interface ChatCompletionOptions {
  /** The resolved config. `null`/absent ⇒ OFF: returns `not_configured`, spends nothing. */
  config: ModelConfigRow | null;
  tools?: ToolDefinition[];
  /** Per-request wall-clock budget. Clamped to [1s, 55s]. */
  timeoutMs?: number;
  /** Caller-side cancellation (e.g. the client hung up). */
  signal?: AbortSignal;
  /** Hard ceiling on completion tokens, on top of `params.max_tokens`. */
  maxOutputTokens?: number;
  /** Injectable for tests. Defaults to `Deno.env` / process env. */
  readEnv?: (name: string) => string;
  /** Injectable for tests. Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
  /** Injectable clock (ms). Defaults to `Date.now`. */
  now?: () => number;
}

// ── Limits (cost control lives here, not in the caller) ──────────────────────

export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 8_000;
export const MAX_TOTAL_INPUT_CHARS = 24_000;
export const MAX_REPLY_CHARS = 8_000;
export const MAX_TOOL_CALLS = 8;
export const DEFAULT_TIMEOUT_MS = 20_000;
export const MIN_TIMEOUT_MS = 1_000;
export const MAX_TIMEOUT_MS = 55_000;
export const DEFAULT_MAX_OUTPUT_TOKENS = 1_024;
export const HARD_MAX_OUTPUT_TOKENS = 4_096;

/** Body keys a config row may add. Anything else in `params.extra` is dropped —
 *  a config row must not be able to smuggle arbitrary fields at a provider. */
const EXTRA_KEYS = new Set([
  'stop', 'presence_penalty', 'frequency_penalty', 'seed',
  'response_format', 'tool_choice', 'top_k', 'repetition_penalty',
]);

/**
 * Secrets the router will NEVER read, whatever a config row says.
 *
 * `key_env_var` is admin-controlled data, and its value is sent to an
 * admin-controlled `base_url`. Without this, one bad row exfiltrates the
 * service-role key. Deny by pattern, not by list, so a new secret is denied
 * by default rather than forgotten.
 */
const FORBIDDEN_KEY_ENV = [
  /^SUPABASE_/i,
  /SERVICE_ROLE/i,
  /^WHATSAPP_/i,
  /^SMTP_/i,
  /^RESEND_/i,
  /^VERCEL_/i,
  /^GITHUB_/i,
  /(^|_)(DB|DATABASE)_/i,
  /JWT/i,
  /^VYACT_/i,
];

/** A plausible env-var name. Rejects paths, spaces and lower-case typos. */
const KEY_ENV_NAME = /^[A-Z][A-Z0-9_]{2,63}$/;

// ── Config selection ─────────────────────────────────────────────────────────

/**
 * Pick the config that serves `seam`.
 *
 * PRECEDENCE: **higher `priority` wins.** Ties break on `id` so selection is
 * deterministic (the same rows always pick the same model — a requirement for
 * reproducible evals, §7).
 *
 * Returns `null` when nothing is enabled — which is the shipping default and
 * the OFF state: no call, no spend, no behaviour change.
 */
export function selectModelConfig(
  rows: readonly ModelConfigRow[] | null | undefined,
  seam: Seam,
): ModelConfigRow | null {
  const usable = (rows ?? []).filter(r =>
    !!r
    && r.enabled === true
    && r.seam === seam
    && typeof r.model === 'string' && r.model.trim().length > 0
    && typeof r.base_url === 'string' && r.base_url.trim().length > 0);
  if (usable.length === 0) return null;
  usable.sort((a, b) =>
    (b.priority ?? 0) - (a.priority ?? 0) || String(a.id).localeCompare(String(b.id)));
  return usable[0];
}

// ── Validation helpers ───────────────────────────────────────────────────────

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

/** Hosts an edge function in the cloud will never reach, or must never call. */
function classifyHost(hostname: string): 'loopback' | 'private' | 'metadata' | 'public' {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (LOOPBACK_HOSTS.has(h) || LOOPBACK_HOSTS.has(hostname.toLowerCase())) return 'loopback';
  if (h.endsWith('.localhost') || h.endsWith('.local') || h === 'host.docker.internal') return 'loopback';
  if (h === '169.254.169.254' || h.startsWith('169.254.')) return 'metadata';
  if (/^10\./.test(h)) return 'private';
  if (/^192\.168\./.test(h)) return 'private';
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return 'private';
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return 'private';
  return 'public';
}

export interface ConfigCheck {
  ok: boolean;
  /** Fully-qualified endpoint, only when ok. */
  endpoint?: string;
  code?: RouterFailureCode;
  message?: string;
  hint?: string;
}

/**
 * Validate a config row WITHOUT calling anything.
 *
 * Used by the gateway's health path so an operator can see "this row is broken"
 * or "this row points at localhost and will never work from the cloud" without
 * spending a token.
 */
export function checkConfig(config: ModelConfigRow | null | undefined): ConfigCheck {
  if (!config) {
    return {
      ok: false, code: 'not_configured',
      message: 'No enabled model configuration for this seam.',
      hint: 'This is the default. Enable a row in ai_model_configs to switch the gateway on.',
    };
  }
  if (!isSeam(config.seam)) {
    return { ok: false, code: 'invalid_config', message: 'Config row has an unknown seam.' };
  }
  let url: URL;
  try {
    url = new URL(String(config.base_url).replace(/\/+$/, '') + '/v1/chat/completions');
  } catch {
    return { ok: false, code: 'invalid_config', message: 'base_url is not a valid URL.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, code: 'invalid_config', message: 'base_url must be http or https.' };
  }
  const host = classifyHost(url.hostname);
  if (host === 'metadata') {
    return { ok: false, code: 'invalid_config', message: 'base_url points at a link-local address.' };
  }
  if (url.protocol === 'http:' && host === 'public') {
    return {
      ok: false, code: 'invalid_config',
      message: 'A public base_url must use https (the API key would travel in clear text).',
    };
  }
  if (host === 'loopback') {
    return {
      ok: false, code: 'unreachable',
      message: 'base_url points at localhost.',
      hint: 'Supabase Edge Functions run in the cloud and cannot reach a developer machine. '
        + 'Expose the vLLM server on a public https URL (tunnel or host it) and update base_url.',
    };
  }
  const keyName = (config.key_env_var ?? '').trim();
  if (keyName) {
    if (!KEY_ENV_NAME.test(keyName)) {
      return { ok: false, code: 'invalid_config', message: 'key_env_var is not a valid env var name.' };
    }
    if (FORBIDDEN_KEY_ENV.some(rx => rx.test(keyName))) {
      return {
        ok: false, code: 'forbidden_key',
        message: 'key_env_var names a reserved platform secret and will not be read.',
        hint: 'Use a dedicated secret name such as VLLM_API_KEY or OPENROUTER_API_KEY.',
      };
    }
  }
  return { ok: true, endpoint: url.toString() };
}

export interface SanitisedMessages {
  ok: boolean;
  messages: ChatMessage[];
  truncated: boolean;
  reason?: string;
}

/**
 * Normalise and CAP the caller's messages.
 *
 * This is cost control, not politeness: an unbounded message array is an
 * unbounded bill. It is also a safety boundary — roles are allowlisted so a
 * client cannot inject a fabricated `tool` result, and content is coerced to a
 * plain string so no object survives into the request body.
 */
export function sanitiseMessages(input: unknown): SanitisedMessages {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, messages: [], truncated: false, reason: 'messages must be a non-empty array' };
  }
  const out: ChatMessage[] = [];
  let total = 0;
  let truncated = false;
  for (const raw of input.slice(0, MAX_MESSAGES)) {
    if (!raw || typeof raw !== 'object') continue;
    const m = raw as Record<string, unknown>;
    const role = m.role;
    if (role !== 'system' && role !== 'user' && role !== 'assistant' && role !== 'tool') continue;
    let content = typeof m.content === 'string' ? m.content : '';
    if (!content.trim()) continue;
    if (content.length > MAX_MESSAGE_CHARS) { content = content.slice(0, MAX_MESSAGE_CHARS); truncated = true; }
    if (total + content.length > MAX_TOTAL_INPUT_CHARS) {
      content = content.slice(0, Math.max(0, MAX_TOTAL_INPUT_CHARS - total));
      truncated = true;
      if (!content) break;
    }
    total += content.length;
    const msg: ChatMessage = { role, content };
    if (typeof m.tool_call_id === 'string') msg.tool_call_id = m.tool_call_id.slice(0, 128);
    if (typeof m.name === 'string') msg.name = m.name.slice(0, 64);
    out.push(msg);
  }
  if (input.length > MAX_MESSAGES) truncated = true;
  if (out.length === 0) {
    return { ok: false, messages: [], truncated, reason: 'no usable messages' };
  }
  return { ok: true, messages: out, truncated };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Operational spend for one call, in USD.
 * Explicitly NOT ledger money (binding rule §2.1) — this never touches a
 * balance, a transaction or a budget. Returns null when pricing is unconfigured
 * so `ai_usage.cost_usd` stays honestly empty rather than silently zero.
 */
export function estimateCostUsd(usage: RouterUsage, params: ModelParams | null | undefined): number | null {
  const pin = params?.price_per_mtok_input;
  const pout = params?.price_per_mtok_output;
  if (typeof pin !== 'number' && typeof pout !== 'number') return null;
  const cost = (usage.promptTokens / 1e6) * (typeof pin === 'number' ? pin : 0)
    + (usage.completionTokens / 1e6) * (typeof pout === 'number' ? pout : 0);
  if (!Number.isFinite(cost) || cost < 0) return null;
  return Math.round(cost * 1e6) / 1e6;   // ai_usage.cost_usd is numeric(12,6)
}

// ── The call ─────────────────────────────────────────────────────────────────

/**
 * One OpenAI-compatible chat completion.
 *
 * NEVER THROWS for a provider condition. Every failure — no config, missing
 * secret, localhost, DNS, TLS, 429, 500, malformed JSON, timeout — comes back
 * as `{ ok: false, code, message }`. The caller decides whether to fall back to
 * the deterministic path; it never has to catch.
 */
export async function chatCompletion(
  messages: readonly ChatMessage[] | unknown,
  opts: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const now = opts.now ?? (() => Date.now());
  const started = now();
  const config = opts.config ?? null;
  const provider = config?.provider ?? 'none';
  const model = config?.model ?? 'none';
  const fail = (code: RouterFailureCode, message: string, extra?: Partial<ChatCompletionFailure>)
    : ChatCompletionFailure => ({
      ok: false, code, message, provider, model, latencyMs: Math.max(0, now() - started), ...extra,
    });

  // 1. OFF is the default and costs nothing. No fetch, no secret read, no row.
  const check = checkConfig(config);
  if (!check.ok || !check.endpoint || !config) {
    return fail(check.code ?? 'not_configured', check.message ?? 'Model router is not configured.',
      check.hint ? { hint: check.hint } : undefined);
  }

  // 2. Caller input.
  const clean = sanitiseMessages(messages);
  if (!clean.ok) return fail('invalid_request', clean.reason ?? 'Unusable messages.');

  // 3. Resolve the key BY NAME. The value never leaves this function.
  const readEnv = opts.readEnv ?? readSecret;
  const keyName = (config.key_env_var ?? '').trim();
  let apiKey = '';
  if (keyName) {
    apiKey = (readEnv(keyName) ?? '').trim();
    if (!apiKey) {
      // Deliberately names the VARIABLE, never a value.
      return fail('missing_key', `Secret ${keyName} is not set for this project.`,
        { hint: `Run: supabase secrets set ${keyName}=…` });
    }
  }

  // 4. Body. Params are clamped: a config row cannot ask for an unbounded bill.
  const params = config.params ?? {};
  const maxTokens = clamp(
    Math.floor(opts.maxOutputTokens ?? params.max_tokens ?? DEFAULT_MAX_OUTPUT_TOKENS),
    1, HARD_MAX_OUTPUT_TOKENS);
  const body: Record<string, unknown> = {
    model: config.model,
    messages: clean.messages,
    max_tokens: maxTokens,
    stream: false,
  };
  if (typeof params.temperature === 'number') body.temperature = clamp(params.temperature, 0, 2);
  if (typeof params.top_p === 'number') body.top_p = clamp(params.top_p, 0, 1);
  if (Array.isArray(opts.tools) && opts.tools.length > 0) body.tools = opts.tools;
  for (const [k, v] of Object.entries(params.extra ?? {})) {
    if (EXTRA_KEYS.has(k)) body[k] = v;
  }

  // 5. Timeout. Bounded on our side so a hung provider can never hang the edge
  //    function until the platform kills it.
  const timeoutMs = clamp(Math.floor(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS), MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  const onAbort = () => controller.abort();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', onAbort, { once: true });
  }

  const doFetch = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': 'vyact-agent-router/1',
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let res: Response;
  try {
    res = await doFetch(check.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (timedOut) {
      return fail('timeout', `Provider did not answer within ${timeoutMs}ms.`);
    }
    if (opts.signal?.aborted) {
      return fail('timeout', 'Request cancelled before the provider answered.');
    }
    // A connection-level failure. The overwhelmingly likely cause in dev is a
    // base_url the cloud cannot route to. Report it; never crash.
    return fail('unreachable', 'Could not reach the model provider.', {
      hint: 'Check that base_url is publicly reachable over https from Supabase Edge. '
        + 'A developer machine or LAN address is not reachable from the cloud.',
    });
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }

  // 6. HTTP outcome. The provider body may echo our request — never surface it.
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 200); } catch { /* best effort */ }
    const retryAfter = res.headers?.get?.('retry-after') ?? '';
    return fail('http_error', `Provider returned HTTP ${res.status}.`, {
      status: res.status,
      hint: res.status === 401 || res.status === 403
        ? 'The API key was rejected. Rotate the secret named by key_env_var.'
        : res.status === 429
          ? `Provider rate limit hit${retryAfter ? ` (retry after ${retryAfter}s)` : ''}.`
          : detail ? 'Provider reported an error.' : undefined,
    });
  }

  let data: Record<string, unknown>;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return fail('bad_response', 'Provider returned a body that is not JSON.', { status: res.status });
  }

  const parsed = parseCompletion(data);
  if (!parsed) {
    return fail('bad_response', 'Provider returned an unrecognised completion shape.', { status: res.status });
  }
  if (!parsed.text && parsed.toolCalls.length === 0) {
    return fail('empty_response', 'Provider returned no text and no tool call.', { status: res.status });
  }

  return {
    ok: true,
    text: parsed.text,
    toolCalls: parsed.toolCalls,
    provider,
    model: parsed.model || model,
    usage: parsed.usage,
    costUsd: estimateCostUsd(parsed.usage, config.params),
    latencyMs: Math.max(0, now() - started),
    finishReason: parsed.finishReason,
  };
}

// ── Response parsing (defensive: every provider bends the shape a little) ─────

interface ParsedCompletion {
  text: string;
  toolCalls: ToolCallSelection[];
  usage: RouterUsage;
  finishReason: string | null;
  model: string;
}

const asInt = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

/** OpenAI allows `content` to be a string OR an array of typed parts. */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string')
        ? (part as { text: string }).text
        : '')
      .join('');
  }
  return '';
}

function parseCompletion(data: Record<string, unknown>): ParsedCompletion | null {
  const choices = data.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const choice = choices[0] as Record<string, unknown> | undefined;
  if (!choice || typeof choice !== 'object') return null;
  const message = (choice.message ?? {}) as Record<string, unknown>;

  let text = contentToText(message.content);
  if (text.length > MAX_REPLY_CHARS) text = text.slice(0, MAX_REPLY_CHARS);

  const toolCalls: ToolCallSelection[] = [];
  const rawCalls = message.tool_calls;
  if (Array.isArray(rawCalls)) {
    for (const rc of rawCalls.slice(0, MAX_TOOL_CALLS)) {
      if (!rc || typeof rc !== 'object') continue;
      const fn = (rc as { function?: unknown }).function as Record<string, unknown> | undefined;
      const name = typeof fn?.name === 'string' ? fn.name : '';
      if (!name) continue;
      const argumentsRaw = typeof fn?.arguments === 'string' ? fn.arguments.slice(0, MAX_MESSAGE_CHARS) : '';
      // JSON.parse only. Never eval, never Function(), never interpolate.
      let args: Record<string, unknown> | null = null;
      try {
        const p: unknown = argumentsRaw ? JSON.parse(argumentsRaw) : {};
        args = (p && typeof p === 'object' && !Array.isArray(p)) ? p as Record<string, unknown> : null;
      } catch { args = null; }
      toolCalls.push({
        id: typeof (rc as { id?: unknown }).id === 'string' ? (rc as { id: string }).id : `call_${toolCalls.length}`,
        name,
        argumentsRaw,
        arguments: args,
      });
    }
  }

  const rawUsage = (data.usage ?? {}) as Record<string, unknown>;
  const promptTokens = asInt(rawUsage.prompt_tokens);
  const completionTokens = asInt(rawUsage.completion_tokens);
  const usage: RouterUsage = {
    promptTokens,
    completionTokens,
    totalTokens: asInt(rawUsage.total_tokens) || (promptTokens + completionTokens),
  };

  return {
    text,
    toolCalls,
    usage,
    finishReason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null,
    model: typeof data.model === 'string' ? data.model : '',
  };
}

// ── ai_usage — the spend gate (architecture §9), not decoration ───────────────

/**
 * The `ai_usage` row shape this router produces.
 *
 * PRIVACY CONTRACT (baseline migration comment, preserved): **no message
 * content, no merchant names, no descriptions — metadata only.** Every field
 * below is either an id, an enum, a count or a duration. If you are ever tempted
 * to add prompt or reply text here, don't.
 */
export interface AiUsageRow {
  household_id: string | null;
  user_id: string | null;
  surface: string;
  backend: 'llm';
  tier: 't0' | 't1' | 't2';
  provider: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number | null;
  latency_ms: number;
  outcome: 'ok' | 'error' | 'blocked' | 'fallback' | 'clarify';
  tool_calls: number;
}

export interface UsageContext {
  householdId?: string | null;
  userId?: string | null;
  surface?: string;
  tier?: 't0' | 't1' | 't2';
}

/** Failure codes that mean "we never called a provider", i.e. nothing was spent. */
const NO_SPEND_CODES = new Set<RouterFailureCode>([
  'not_configured', 'invalid_config', 'missing_key', 'forbidden_key', 'invalid_request',
]);

/**
 * Build the metering row for one router call.
 *
 * Returns `null` when NO provider call was attempted — the OFF state and every
 * pre-flight rejection. Writing a row there would make the gateway's off state
 * observably different from today, which binding rule §2.7b forbids.
 */
export function buildUsageRow(
  result: ChatCompletionResult,
  ctx: UsageContext = {},
): AiUsageRow | null {
  if (!result.ok && NO_SPEND_CODES.has(result.code)) return null;
  const base = {
    household_id: ctx.householdId ?? null,
    user_id: ctx.userId ?? null,
    surface: ctx.surface ?? 'chat',
    backend: 'llm' as const,
    tier: ctx.tier ?? 't1',
    provider: result.provider,
    model: result.model,
    latency_ms: Math.round(result.latencyMs),
  };
  if (result.ok) {
    return {
      ...base,
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      cost_usd: result.costUsd,
      outcome: 'ok',
      tool_calls: result.toolCalls.length,
    };
  }
  // A call WAS attempted: it may have consumed provider-side tokens we cannot
  // see. Record it as an error with zero counts rather than not at all — an
  // unrecorded call is an unmeasured one, and this table is the spend gate.
  return {
    ...base,
    prompt_tokens: 0,
    completion_tokens: 0,
    cost_usd: null,
    outcome: 'error',
    tool_calls: 0,
  };
}
