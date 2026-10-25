// Vyact Agent — THE GATEWAY (`ask-vyact`). vyact-agent-architecture.md §1, §5, P2.
//
// One HTTPS endpoint. Every channel (PWA · Android · iOS · WhatsApp) reaches the
// agent through here; only presentation and policy differ per channel adapter.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 OFF IS THE DEFAULT AND OFF IS INERT.
//
// With no enabled row in `ai_model_configs` for the requested seam this function
// performs only READS: it verifies the user, reads the config table (cached in the
// isolate for up to CONFIG_CACHE_TTL_MS, v10.106.3) and, when the request names a
// household, looks up the caller's membership alongside those two. No provider is
// called. No token is spent. No `ai_usage` row is written.
// No existing table is touched. It answers 200 `{ ok: true, enabled: false }`
// and the caller falls back to the deterministic on-device path exactly as it
// does today — binding rule §2.7b, "the off state is provably byte-identical to
// today". Nothing in the app calls this endpoint yet, so today that off state is
// the whole story.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FUNCTION GUARANTEES
//
//   AUTH   Verifies the caller's USER JWT and explicitly REFUSES a service-role
//          or anon key. Supabase's platform `--verify-jwt` accepts BOTH of those
//          as structurally valid JWTs, so the platform check alone is not enough:
//          without the check below, anyone holding the publishable anon key (it
//          is in the client bundle, by design) could spend money here.
//   CORS   Pinned to an explicit origin allowlist. NEVER `*`. This is a paid
//          endpoint; a wildcard turns every website on the internet into a way to
//          spend a logged-in user's budget.
//   COST   Per-request timeout, message/character caps, output-token clamp, and a
//          per-user daily call cap — all applied BEFORE the provider is called.
//   MONEY  The model never computes money (§2.1). This function forwards text and
//          relays tool SELECTIONS; it holds no write tool, no transaction path,
//          and no arithmetic on any amount. The `ai_usage` cost figure is our
//          provider bill, not a user's ledger.
//   PROMPT The system prompt is the SERVER's (W1c, v10.64.0; audit BE-PIP-02). A
//          request names an op from a closed set and sends the user text; the
//          gateway builds the messages (_shared/agent/prompts.ts). It is not a
//          general-purpose proxy for the provider key.
//   TRUST  Everything from the client and everything from the model is DATA.
//          No eval, no dynamic import, no string-built SQL. All DB access goes
//          through parameterised PostgREST calls.
//   SPEND  Every attempted provider call writes an `ai_usage` row (§9 spend gate)
//          with metadata only — never message content.
//
// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT CONTRACT
//
//   POST /functions/v1/ask-vyact
//   Authorization: Bearer <SUPABASE USER JWT>        (required; not the anon key)
//   Origin:        <must be on the allowlist when present>
//   Content-Type:  application/json
//
//   Request:
//     {
//       "seam": "assistant" | "chat",        // default "assistant"
//       "op": "classify" | "phrase",         // which of Pip's prompts (server-owned, W1c)
//       "input": "...",                      // the question, or the phrase payload (facts)
//       "offending": ["42000", ...],         // phrase retry only: figures the guard rejected
//       "householdId": "<uuid>",             // optional; must be one the caller belongs to
//       "surface": "chat" | "whatsapp" | …,  // telemetry label only
//       "probe": true                        // optional: report readiness, call nothing
//     }
//
//   200 — model answered:
//     { "ok": true, "enabled": true, "seam", "text", "toolCalls": [...],
//       "usage": { promptTokens, completionTokens, totalTokens },
//       "costUsd", "latencyMs", "finishReason", "truncatedInput", "requestId" }
//
//   200 — OFF (no enabled config). THE DEFAULT:
//     { "ok": true, "enabled": false, "seam", "reason": "no_enabled_model_config",
//       "message", "requestId" }
//
//   200 — probe:
//     { "ok": true, "enabled", "seam", "ready", "reason"?, "message"?, "hint"?, "requestId" }
//
//   4xx/5xx — structured error, never an HTML page or a stack trace:
//     { "ok": false, "enabled"?, "error": "<code>", "message", "hint"?, "requestId" }
//
//   Callers MUST branch on `enabled` and on `ok`, and MUST fall back to the
//   deterministic path for every non-200 and for `enabled: false`. There is no
//   response from this endpoint that a client is required to trust.
//
// ─────────────────────────────────────────────────────────────────────────────
// SECRETS (all read from Supabase Function secrets — never from the DB, never
// hardcoded). None is required for the OFF state:
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  — injected by the platform
//   ASK_VYACT_ALLOWED_ORIGINS  — comma-separated CORS allowlist (see DEFAULT_ORIGINS)
//   ASK_VYACT_TIMEOUT_MS       — per-request provider budget (default 20000)
//   ASK_VYACT_DAILY_CALL_CAP   — per-user model calls per 24h (default 200; anything unparseable keeps 200 —
//                                parseDailyCallCap). v10.135.0: it can only LOWER the database's own cap
//                                (ai_limits.per_user_daily_calls); 'off' sends no cap, so the database's applies.
//   <whatever `ai_model_configs.key_env_var` names>  — the provider API key
//   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (/ AWS_SESSION_TOKEN) — a Bedrock row signing with
//                                SigV4 (key_env_var = 'AWS_ACCESS_KEY_ID'); see _shared/agent/bedrock.ts
//
// DEPLOY: WITH JWT verification (this function identifies the user).
//   supabase functions deploy ask-vyact
//
// STATUS: deployed by deploy.yml on every push to main.
//
// v10.135.0 (Track Q7; audit OPS-11, BE-PIP-06): every model call is checked against Pip's limits in the database
// (ai_limits: the person's 24 hours, a minute, an off-topic cool-down, everyone's 24 hours; no row = closed) and a
// refused one is answered 429 (503 when the limits cannot be read) with `error` naming the limit and, where it ends,
// `retryAfter` seconds. A classify call the model placed off topic is recorded as 'off_topic' on its own usage row:
// that is what the cool-down counts. The v10.37 test relay is gone.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  buildUsageRow,
  chatCompletion,
  checkConfig,
  createConfigRowsCache,
  isSeam,
  parseDailyCallCap,
  sanitiseMessages,
  selectModelConfig,
  type ConfigRowsLoad,
  type ModelConfigRow,
  type Seam,
} from '../_shared/agent/router.ts';
import { filterRowsForUser } from '../_shared/agent/modelRows.ts';
import { isQuota, limitAnswer, offTopicIntent, quotaFromReserveError, retryAfterSeconds, type Quota } from '../_shared/agent/limits.ts';
import { composeAssistantMessages } from '../_shared/agent/prompts.ts';

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

const env = (k: string, fallback = ''): string => Deno.env.get(k) ?? fallback;

// ── CORS — pinned, never '*' ─────────────────────────────────────────────────
//
// Default = the production consumer origin only. Dev origins (localhost:5173)
// are DELIBERATELY not defaulted in: this endpoint spends money, and an
// allowlisted origin is a standing capability, not a convenience. Add them
// explicitly for a dev project:
//   supabase secrets set ASK_VYACT_ALLOWED_ORIGINS="https://vyact.app,http://localhost:5173"
const DEFAULT_ORIGINS = ['https://vyact.app'];

const ALLOWED_ORIGINS: string[] = (() => {
  const configured = env('ASK_VYACT_ALLOWED_ORIGINS')
    .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
  const list = configured.length > 0 ? configured : DEFAULT_ORIGINS;
  // A wildcard is refused even if someone configures one. There is no legitimate
  // reason for a paid, user-authenticated endpoint to accept any origin.
  return list.filter(o => o !== '*');
})();

const BASE_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
};

function corsHeadersFor(origin: string | null): Record<string, string> {
  // No Origin header ⇒ not a browser cross-origin request (server-to-server, a
  // channel adapter, curl). Nothing to grant; nothing is exposed either.
  if (!origin) return {};
  const normalised = origin.replace(/\/+$/, '');
  if (!ALLOWED_ORIGINS.includes(normalised)) return {};
  return {
    'Access-Control-Allow-Origin': normalised,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '600',
  };
}

const originAllowed = (origin: string | null): boolean =>
  !origin || ALLOWED_ORIGINS.includes(origin.replace(/\/+$/, ''));

const respond = (body: Record<string, unknown>, status: number, origin: string | null, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...corsHeadersFor(origin), ...extra },
  });

// ── HTTP status for a router failure. Everything here means "fall back". ─────
const STATUS_FOR: Record<string, number> = {
  invalid_request: 400,
  timeout: 504,
  unreachable: 502,
  http_error: 502,
  bad_response: 502,
  empty_response: 502,
  missing_key: 503,
  forbidden_key: 503,
  invalid_config: 503,
  not_configured: 200,
};

interface RequestBody {
  seam?: unknown;
  /** W1c: one of Pip's server-owned prompts, and the text it is applied to. */
  op?: unknown;
  input?: unknown;
  offending?: unknown;
  /** Pre-v10.64.0 clients only; accepted when it is exactly a server prompt (prompts.ts). */
  messages?: unknown;
  householdId?: unknown;
  surface?: unknown;
  probe?: unknown;
  maxOutputTokens?: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SURFACES = new Set(['chat', 'whatsapp', 'sms_share', 'receipt']);
const MAX_BODY_BYTES = 64 * 1024;

// v10.106.3: the enabled config rows, kept in this isolate for CONFIG_CACHE_TTL_MS (router.ts).
const configCache = createConfigRowsCache();

async function loadEnabledConfigRows(admin: SupabaseClient, seam: Seam): Promise<ConfigRowsLoad> {
  const { data, error } = await admin
    .from('ai_model_configs')
    .select('id, seam, provider, model, base_url, key_env_var, params, enabled, priority')
    .eq('seam', seam)
    .eq('enabled', true);
  return error ? { ok: false } : { ok: true, rows: (data ?? []) as ModelConfigRow[] };
}

/** prepare_ai_call()'s answer, or null when it failed (the gateway then takes the sequential path). */
interface Prepared { member: boolean | null; reservationId: string | null; quota: Quota; retryAt: string | null }

function readPrepared(r: { data: unknown; error: unknown }): Prepared | null {
  if (r.error || !r.data || typeof r.data !== 'object') return null;
  const d = r.data as Record<string, unknown>;
  if (!isQuota(d.quota)) return null;
  return {
    member: typeof d.member === 'boolean' ? d.member : null,
    reservationId: typeof d.reservation_id === 'string' && UUID_RE.test(d.reservation_id) ? d.reservation_id : null,
    quota: d.quota,
    retryAt: typeof d.retry_at === 'string' ? d.retry_at : null,
  };
}

type BodyParse =
  | { ok: true; body: RequestBody }
  | { ok: false; status: number; error: string; message: string };

function parseBody(rawBody: string): BodyParse {
  if (rawBody.length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: 'payload_too_large', message: 'Request body is too large.' };
  }
  try {
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    return { ok: true, body: parsed as RequestBody };
  } catch {
    return { ok: false, status: 400, error: 'invalid_request', message: 'Body must be a JSON object.' };
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const requestId = crypto.randomUUID();
  // v10.106.3: per-stage timings, logged once per model call (metadata only, never text).
  const startedAt = performance.now();
  const sinceStart = () => Math.round(performance.now() - startedAt);

  // ── 1. CORS preflight + origin pinning ────────────────────────────────────
  if (req.method === 'OPTIONS') {
    const headers = corsHeadersFor(origin);
    // An origin we do not know gets no CORS grant, so the browser blocks the
    // real request. 403 (rather than a silent 204) makes the misconfiguration
    // visible to an operator instead of looking like a network fault.
    return Object.keys(headers).length > 0
      ? new Response(null, { status: 204, headers: { ...headers, Vary: 'Origin' } })
      : new Response(null, { status: 403, headers: { Vary: 'Origin' } });
  }
  if (!originAllowed(origin)) {
    return respond({ ok: false, error: 'origin_not_allowed', message: 'Origin is not permitted.', requestId }, 403, null);
  }
  if (req.method !== 'POST') {
    return respond({ ok: false, error: 'method_not_allowed', message: 'Use POST.', requestId }, 405, origin);
  }

  // ── 2. Authenticate the CALLER. A user JWT, and only a user JWT. ──────────
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return respond({ ok: false, error: 'unauthorized', message: 'Missing bearer token.', requestId }, 401, origin);
  }

  // Refuse a machine key BEFORE spending a verification round-trip. The anon key
  // ships in the client bundle and the service-role key must never come from a
  // browser; either would otherwise pass `getUser()`-adjacent checks on some
  // paths and hand an anonymous caller a paid endpoint.
  const claims = decodeJwtClaims(jwt);
  const claimedRole = typeof claims?.role === 'string' ? claims.role : '';
  if (claimedRole === 'service_role' || claimedRole === 'anon' || !claims?.sub) {
    return respond({
      ok: false, error: 'unauthorized',
      message: 'A signed-in user token is required (machine keys are refused).',
      requestId,
    }, 401, origin);
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return respond({ ok: false, error: 'internal_error', message: 'Gateway is not configured.', requestId }, 500, origin);
  }
  const admin: SupabaseClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 3. Body — read first (no network) so the lookups below can start together.
  // Its errors are still answered only after the caller is verified.
  const parsedBody = parseBody(await req.text().catch(() => ''));
  const body: RequestBody = parsedBody.ok ? parsedBody.body : {};
  const seam: Seam = isSeam(body.seam) ? body.seam : 'assistant';
  const isProbe = body.probe === true;
  const surface = typeof body.surface === 'string' && SURFACES.has(body.surface) ? body.surface : 'chat';
  const requestedHousehold = typeof body.householdId === 'string' && UUID_RE.test(body.householdId)
    ? body.householdId : null;
  const sub = String(claims.sub);

  // v10.107.1: the conversation is composed before any lookup (pure, no network), so the quota is
  // reserved below only for a request that can actually be sent. Its errors are still answered in
  // the old order (step 6).
  const composedEarly = parsedBody.ok && !isProbe ? composeAssistantMessages(body) : null;
  const cleanEarly = composedEarly?.ok ? sanitiseMessages(composedEarly.messages) : null;
  const dailyCap = parseDailyCallCap(env('ASK_VYACT_DAILY_CALL_CAP'));

  // v10.107.1: prepare_ai_call() runs as the CALLER (their JWT, verified by PostgREST; auth.uid() in
  // SQL), so it can only ever check this user's membership and reserve against this user's cap.
  // Without the anon key the gateway falls back to the sequential path below.
  const anonKey = env('SUPABASE_ANON_KEY');
  const asCaller: SupabaseClient | null = anonKey
    ? createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    : null;
  const wantsPrepare = parsedBody.ok && !isProbe && asCaller !== null;

  // ── 3a. Verify the user, read the config and prepare the call TOGETHER (v10.106.3, v10.107.1). ──
  // v10.106.3 ran getUser ‖ config ‖ membership, then reserve_ai_usage() as a fourth, sequential round
  // trip (140–430 ms in prod). v10.107.1 folds membership AND the reservation into prepare_ai_call(),
  // so nothing waits after these three. Every gate still answers in the old order below — verified
  // user, then config (the OFF path), then membership, then the quota — and a reservation the request
  // turns out not to need is deleted (releaseReservation). Each lookup settles to a value, so a
  // rejected promise fails closed (or falls back to the sequential path) instead of throwing.
  const stageMs: Record<string, number | boolean> = {};
  const [authResult, configResult, prepared, membershipResult] = await Promise.all([
    admin.auth.getUser(jwt)
      .then(r => r, () => ({ data: { user: null }, error: new Error('auth lookup failed') }))
      .finally(() => { stageMs.authMs = sinceStart(); }),
    parsedBody.ok
      ? configCache.rows(seam, () => loadEnabledConfigRows(admin, seam))
        .finally(() => { stageMs.configMs = sinceStart(); })
      : Promise.resolve(null),
    wantsPrepare
      ? Promise.resolve(asCaller!.rpc('prepare_ai_call', {
        p_household_id: requestedHousehold,
        p_seam: seam,
        p_surface: surface,
        // v10.135.0: always reserved when the request can be sent; the database's limits apply with or without a cap.
        p_cap: dailyCap,
        p_reserve: cleanEarly?.ok === true,
      }))
        .then(r => readPrepared(r), () => null)
        .finally(() => { stageMs.prepareMs = sinceStart(); })
      : Promise.resolve(null),
    // The v10.106.3 path, when prepare_ai_call() is not used (no anon key): the membership read runs
    // here too, for the token's `sub`; its answer is used only after getUser() verifies that id.
    !wantsPrepare && parsedBody.ok && !isProbe && requestedHousehold
      ? Promise.resolve(admin.from('memberships')
        .select('household_id')
        .eq('user_id', sub)
        .eq('household_id', requestedHousehold)
        .maybeSingle())
        .then(r => r, () => ({ data: null, error: new Error('membership lookup failed') }))
        .finally(() => { stageMs.membershipMs = sinceStart(); })
      : Promise.resolve(null),
  ]);
  if (configResult?.cached) stageMs.configCached = true;

  // A reservation made above that this request will not use is deleted, so a refused request
  // spends nothing — the OFF state included. Never awaited on the answer's path.
  const releaseReservation = () => {
    const id = prepared?.reservationId;
    if (!id) return;
    const done = Promise.resolve(admin.from('ai_usage').delete().eq('id', id).eq('outcome', 'reserved'))
      .then(() => undefined, () => undefined);
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(done);
  };

  // Cryptographic verification (signature + expiry) happens in getUser(), not above.
  const user = authResult.data?.user;
  if (authResult.error || !user?.id || user.id !== sub) {
    releaseReservation();
    return respond({ ok: false, error: 'unauthorized', message: 'Invalid or expired session.', requestId }, 401, origin);
  }
  if (!parsedBody.ok) {
    return respond({ ok: false, error: parsedBody.error, message: parsedBody.message, requestId }, parsedBody.status, origin);
  }

  // Tool schemas are NOT accepted from a client. The tool registry is
  // server-owned (P7/P8) and read tools are separated from write tools there; a
  // client-supplied schema would be both an unbounded token cost and a way to
  // describe a capability the server never granted.

  // ── 4. Resolve configuration. THE OFF PATH ENDS HERE. ─────────────────────
  // Read in step 3a (cached per isolate for CONFIG_CACHE_TTL_MS; a failed read is never cached).
  if (!configResult?.ok) {
    // Cannot tell enabled from disabled ⇒ behave as if disabled. Failing closed
    // is the only safe default for a spend decision.
    releaseReservation();
    return respond({
      ok: true, enabled: false, seam, reason: 'config_unavailable',
      message: 'Model configuration could not be read; the gateway stayed off.', requestId,
    }, 200, origin);
  }

  // v10.38: a row carrying `params.allowed_user_ids` applies only to those users — a self-hosted model
  // being piloted on some accounts before it is promoted to the household. Everyone else resolves the next
  // row by priority. Remove the key to promote the row to all users, no deploy (modelRows.ts).
  const eligibleRows = filterRowsForUser(configResult.rows as ModelConfigRow[], user.id);
  const config = selectModelConfig(eligibleRows, seam);

  if (!config) {
    // 🔴 THE INERT DEFAULT. One read happened. Nothing was called, nothing was
    // written, nothing was spent. The caller falls back to the rules path.
    // (prepare_ai_call() applies the same row rule, so it reserved nothing; if it ever did, it is undone.)
    releaseReservation();
    return respond({
      ok: true, enabled: false, seam, reason: 'no_enabled_model_config',
      message: 'No model is enabled for this seam. Falling back to the deterministic path.',
      requestId,
    }, 200, origin);
  }

  // ── 5. Probe: report readiness without calling anything. ──────────────────
  // Deliberately omits provider/model — readiness is operational, model identity
  // is not something an end user needs from this endpoint.
  if (isProbe) {
    const check = checkConfig(config);
    return respond({
      ok: true, enabled: true, seam, ready: check.ok,
      reason: check.ok ? undefined : check.code,
      message: check.ok ? 'Provider configuration looks usable.' : check.message,
      hint: check.hint,
      requestId,
    }, 200, origin);
  }

  // ── 6. Compose the conversation from the server's own prompts (W1c). ───────
  const composed = composedEarly ?? composeAssistantMessages(body);
  if (!composed.ok) {
    return respond({
      ok: false, enabled: true, seam, error: 'invalid_request', message: composed.reason, requestId,
    }, 400, origin);
  }
  const clean = cleanEarly ?? sanitiseMessages(composed.messages);
  if (!clean.ok) {
    return respond({
      ok: false, enabled: true, seam, error: 'invalid_request',
      message: clean.reason ?? 'messages is required.', requestId,
    }, 400, origin);
  }

  // ── 7. Household attribution — verified, never trusted from the body. ─────
  // Answered in step 3a: by prepare_ai_call() for auth.uid(), or by the membership read for `sub`
  // (which getUser() has confirmed is this user's id). If prepare_ai_call() failed, read it now.
  let householdId: string | null = null;
  if (requestedHousehold) {
    const isMember = prepared
      ? prepared.member === true
      : !wantsPrepare
      ? !!membershipResult?.data
      : await Promise.resolve(admin.from('memberships')
        .select('household_id')
        .eq('user_id', user.id)
        .eq('household_id', requestedHousehold)
        .maybeSingle())
        .then(r => !r.error && !!r.data, () => false);
    if (!isMember) {
      return respond({
        ok: false, enabled: true, seam, error: 'forbidden',
        message: 'Not a member of that household.', requestId,
      }, 403, origin);
    }
    householdId = requestedHousehold;
  }

  // ── 8. Limits and the spend cap — ATOMIC reservation BEFORE the provider is called. ─────
  // Audit A2: the old sequence (count → call → insert) let every concurrent
  // request pass the same count check, and a failed count read was treated as
  // zero usage. reserve_ai_usage() row-locks the user, counts, and inserts a
  // 'reserved' row in one locked step — concurrent requests serialise, and a
  // count failure aborts here (fail-CLOSED; the provider is never called).
  // v10.107.1: normally already decided in step 3a by prepare_ai_call(). The sequential call below is
  // the fallback: no anon key, the function missing (a database not yet migrated), or a row-rule
  // disagreement where it reserved nothing although a model applies.
  // v10.135.0 (Q7, OPS-11): always reserved, and the database checks Pip's limits (ai_limit_state) — the
  // person's 24 hours, a minute, the off-topic cool-down and everyone's 24 hours. A refusal names its limit.
  const refused = (quota: Quota, retryAt: unknown): Response | null => {
    const answer = limitAnswer(quota);
    if (!answer) return null;
    const retryAfter = retryAfterSeconds(retryAt);
    return respond({
      ok: false, enabled: true, seam, error: answer.error, message: answer.message,
      ...(retryAfter ? { retryAfter } : {}), requestId,
    }, answer.status, origin, retryAfter ? { 'Retry-After': String(retryAfter) } : {});
  };
  let reservationId: string | null = null;
  const early = prepared ? refused(prepared.quota, prepared.retryAt) : null;
  if (early) return early;
  if (prepared?.reservationId) {
    reservationId = prepared.reservationId;
  } else {
    const reserveStart = sinceStart();
    const { data: resId, error: resErr } = await admin.rpc('reserve_ai_usage', {
      p_user_id: user.id,
      p_household_id: householdId,
      p_surface: surface,
      p_cap: dailyCap,
    });
    stageMs.reserveMs = sinceStart() - reserveStart;
    if (resErr) {
      const quota = quotaFromReserveError(resErr);
      return (quota && refused(quota, null)) ?? respond({
        ok: false, enabled: true, seam, error: 'quota_check_failed',
        message: 'Could not verify your usage allowance. Not calling the model.', requestId,
      }, 503, origin);
    }
    reservationId = resId as string;
  }

  // ── 9. The call. Bounded, and it cannot throw. ────────────────────────────
  const timeoutMs = Number.parseInt(env('ASK_VYACT_TIMEOUT_MS', '20000'), 10);
  stageMs.preModelMs = sinceStart();
  const result = await chatCompletion(clean.messages, {
    config,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
    signal: req.signal,
  });
  // v10.106.3: one line per model call, so a slow answer can be split into the gateway's own work
  // (auth/config/membership finish times, the reservation, all of it before the model) and the model.
  // Metadata only: never the question, the reply or the facts.
  console.log('[ask-vyact] timing', {
    requestId,
    op: body.op === 'classify' || body.op === 'phrase' ? body.op : 'other',
    ok: result.ok,
    ...stageMs,
    modelMs: result.latencyMs,
  });

  // ── 10. Finalise the reservation with the real outcome (§9 spend gate).
  // Metadata only — never message content. The row already exists (the
  // reservation), so this UPDATE carries tokens/cost/latency; if there was no
  // reservation (cap disabled) we insert as before. Metering never fails the
  // user's request — but a FAILED finalise is no longer invisible (audit A2):
  // it is logged with the reservation id so an orphaned 'reserved' row can be
  // reconciled against provider billing.
  const usageRow = buildUsageRow(result, {
    householdId,
    userId: user.id,
    surface,
    tier: 't1',
  });
  // v10.135.0 (Q7): a classify call the model placed off topic is recorded as such: the cool-down counts these.
  const intent = result.ok ? offTopicIntent(body.op, result.text) : null;
  if (usageRow && intent) usageRow.intent = intent;
  const meter = (async () => {
    try {
      if (reservationId) {
        const patch = usageRow
          ? { ...usageRow, id: undefined, user_id: undefined, household_id: undefined }
          : { outcome: 'error', prompt_tokens: 0, completion_tokens: 0 };
        delete (patch as Record<string, unknown>).id;
        const { error } = await admin.from('ai_usage').update(patch).eq('id', reservationId);
        if (error) console.error('[ask-vyact] metering finalise failed', reservationId, error.message);
      } else if (usageRow) {
        const { error } = await admin.from('ai_usage').insert(usageRow);
        if (error) console.error('[ask-vyact] metering insert failed', error.message);
      }
    } catch (e) {
      console.error('[ask-vyact] metering threw', reservationId, (e as Error)?.message);
    }
  })();
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(meter);
  else await meter;

  // ── 11. Answer. ───────────────────────────────────────────────────────────
  if (!result.ok) {
    // W8b (audit BE-PIP-07): every provider failure is logged — they were silent — and the configuration
    // hint (base_url, key names, provider advice) goes only to an admin. End users get the code and a
    // request id to quote.
    const status = STATUS_FOR[result.code] ?? 502;
    console.error('[ask-vyact] provider failure', { requestId, code: result.code, status, provider: config.provider, model: config.model });
    let showHint = false;
    if (result.hint) {
      const { data: role } = await admin.from('admin_roles').select('user_id').eq('user_id', user.id).maybeSingle();
      showHint = Boolean(role);
    }
    return respond({
      ok: false, enabled: true, seam,
      error: result.code,
      message: result.message,
      ...(showHint ? { hint: result.hint } : {}),
      latencyMs: result.latencyMs,
      requestId,
    }, status, origin);
  }

  return respond({
    ok: true,
    enabled: true,
    seam,
    // UNTRUSTED MODEL OUTPUT. The caller must render it as text and must not
    // treat any number in it as authoritative — every figure a user sees comes
    // from resolve()/an RPC (binding rule §2.1), never from here.
    text: result.text,
    toolCalls: result.toolCalls,
    // W1c: provider and model are not returned — which model backs Pip is not the caller's
    // business (audit BE-PIP-02). They are still metered in ai_usage.
    usage: result.usage,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    finishReason: result.finishReason,
    truncatedInput: clean.truncated,
    requestId,
  }, 200, origin);
});

/**
 * Read a JWT's claims WITHOUT verifying it.
 *
 * Used only to REJECT (a service-role or anon token) before doing real work.
 * Acceptance is always decided by `admin.auth.getUser()`, which verifies the
 * signature and expiry. Never grant anything on the strength of this.
 */
function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const padded = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}
