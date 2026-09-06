// Vyact Agent — THE GATEWAY (`ask-vyact`). vyact-agent-architecture.md §1, §5, P2.
//
// One HTTPS endpoint. Every channel (PWA · Android · iOS · WhatsApp) reaches the
// agent through here; only presentation and policy differ per channel adapter.
//
// ─────────────────────────────────────────────────────────────────────────────
// 🔴 OFF IS THE DEFAULT AND OFF IS INERT.
//
// With no enabled row in `ai_model_configs` for the requested seam this function
// performs, in total: one authenticated SELECT of the config table, and nothing
// else. No provider is called. No token is spent. No `ai_usage` row is written.
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
//       "messages": [ { "role": "system"|"user"|"assistant"|"tool",
//                       "content": "..." } ],
//       "householdId": "<uuid>",             // optional; must be one the caller belongs to
//       "surface": "chat" | "whatsapp" | …,  // telemetry label only
//       "probe": true                        // optional: report readiness, call nothing
//     }
//
//   200 — model answered:
//     { "ok": true, "enabled": true, "seam", "text", "toolCalls": [...],
//       "provider", "model", "usage": { promptTokens, completionTokens, totalTokens },
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
//   ASK_VYACT_DAILY_CALL_CAP   — per-user model calls per 24h (default 200, 0 = off)
//   <whatever `ai_model_configs.key_env_var` names>  — the provider API key
//
// DEPLOY: WITH JWT verification (this function identifies the user).
//   supabase functions deploy ask-vyact
//
// STATUS: UNDEPLOYED AND UNEXECUTED. Written, typechecked, never run.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  buildUsageRow,
  chatCompletion,
  checkConfig,
  isSeam,
  sanitiseMessages,
  selectModelConfig,
  type ModelConfigRow,
  type Seam,
} from '../_shared/agent/router.ts';

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

const env = (k: string, fallback = ''): string => Deno.env.get(k) ?? fallback;

// ── CORS — pinned, never '*' ─────────────────────────────────────────────────
//
// Default = the production consumer origin only. Dev origins (localhost:5173)
// are DELIBERATELY not defaulted in: this endpoint spends money, and an
// allowlisted origin is a standing capability, not a convenience. Add them
// explicitly for a dev project:
//   supabase secrets set ASK_VYACT_ALLOWED_ORIGINS="https://vyact-twentyx.vercel.app,http://localhost:5173"
const DEFAULT_ORIGINS = ['https://vyact-twentyx.vercel.app'];

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

const respond = (body: Record<string, unknown>, status: number, origin: string | null): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...corsHeadersFor(origin) },
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
  messages?: unknown;
  householdId?: unknown;
  surface?: unknown;
  probe?: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SURFACES = new Set(['chat', 'whatsapp', 'sms_share', 'receipt']);
const MAX_BODY_BYTES = 64 * 1024;

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const requestId = crypto.randomUUID();

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

  // Cryptographic verification (signature + expiry) happens here, not above.
  const { data: userData, error: authErr } = await admin.auth.getUser(jwt);
  const user = userData?.user;
  if (authErr || !user?.id) {
    return respond({ ok: false, error: 'unauthorized', message: 'Invalid or expired session.', requestId }, 401, origin);
  }

  // ── 3. Body ───────────────────────────────────────────────────────────────
  const rawBody = await req.text().catch(() => '');
  if (rawBody.length > MAX_BODY_BYTES) {
    return respond({ ok: false, error: 'payload_too_large', message: 'Request body is too large.', requestId }, 413, origin);
  }
  let body: RequestBody;
  try {
    const parsed: unknown = rawBody ? JSON.parse(rawBody) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    body = parsed as RequestBody;
  } catch {
    return respond({ ok: false, error: 'invalid_request', message: 'Body must be a JSON object.', requestId }, 400, origin);
  }

  const seam: Seam = isSeam(body.seam) ? body.seam : 'assistant';
  const isProbe = body.probe === true;
  const surface = typeof body.surface === 'string' && SURFACES.has(body.surface) ? body.surface : 'chat';

  // Tool schemas are NOT accepted from a client. The tool registry is
  // server-owned (P7/P8) and read tools are separated from write tools there; a
  // client-supplied schema would be both an unbounded token cost and a way to
  // describe a capability the server never granted.

  // ── 4. Resolve configuration. THE OFF PATH ENDS HERE. ─────────────────────
  const { data: configRows, error: configErr } = await admin
    .from('ai_model_configs')
    .select('id, seam, provider, model, base_url, key_env_var, params, enabled, priority')
    .eq('seam', seam)
    .eq('enabled', true);

  if (configErr) {
    // Cannot tell enabled from disabled ⇒ behave as if disabled. Failing closed
    // is the only safe default for a spend decision.
    return respond({
      ok: true, enabled: false, seam, reason: 'config_unavailable',
      message: 'Model configuration could not be read; the gateway stayed off.', requestId,
    }, 200, origin);
  }

  const config = selectModelConfig((configRows ?? []) as ModelConfigRow[], seam);

  if (!config) {
    // 🔴 THE INERT DEFAULT. One read happened. Nothing was called, nothing was
    // written, nothing was spent. The caller falls back to the rules path.
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

  // ── 6. Validate the conversation. ─────────────────────────────────────────
  const clean = sanitiseMessages(body.messages);
  if (!clean.ok) {
    return respond({
      ok: false, enabled: true, seam, error: 'invalid_request',
      message: clean.reason ?? 'messages is required.', requestId,
    }, 400, origin);
  }

  // ── 7. Household attribution — verified, never trusted from the body. ─────
  let householdId: string | null = null;
  if (typeof body.householdId === 'string' && UUID_RE.test(body.householdId)) {
    const { data: membership } = await admin
      .from('memberships')
      .select('household_id')
      .eq('user_id', user.id)
      .eq('household_id', body.householdId)
      .maybeSingle();
    if (!membership) {
      return respond({
        ok: false, enabled: true, seam, error: 'forbidden',
        message: 'Not a member of that household.', requestId,
      }, 403, origin);
    }
    householdId = body.householdId;
  }

  // ── 8. Spend cap — checked BEFORE the provider is called. ─────────────────
  const dailyCap = Number.parseInt(env('ASK_VYACT_DAILY_CALL_CAP', '200'), 10);
  if (Number.isFinite(dailyCap) && dailyCap > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('backend', 'llm')
      .gte('ts', since);
    if ((count ?? 0) >= dailyCap) {
      return respond({
        ok: false, enabled: true, seam, error: 'quota_exceeded',
        message: 'Daily assistant limit reached. Try again tomorrow.', requestId,
      }, 429, origin);
    }
  }

  // ── 9. The call. Bounded, and it cannot throw. ────────────────────────────
  const timeoutMs = Number.parseInt(env('ASK_VYACT_TIMEOUT_MS', '20000'), 10);
  const result = await chatCompletion(clean.messages, {
    config,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
    signal: req.signal,
  });

  // ── 10. Meter it (§9 spend gate). Metadata only — never message content. ──
  const usageRow = buildUsageRow(result, {
    householdId,
    userId: user.id,
    surface,
    tier: 't1',
  });
  if (usageRow) {
    const write = admin.from('ai_usage').insert(usageRow).then(
      () => undefined,
      () => undefined,   // metering must never fail the user's request
    );
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(write);
    else await write;
  }

  // ── 11. Answer. ───────────────────────────────────────────────────────────
  if (!result.ok) {
    return respond({
      ok: false, enabled: true, seam,
      error: result.code,
      message: result.message,
      hint: result.hint,
      latencyMs: result.latencyMs,
      requestId,
    }, STATUS_FOR[result.code] ?? 502, origin);
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
    provider: result.provider,
    model: result.model,
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
