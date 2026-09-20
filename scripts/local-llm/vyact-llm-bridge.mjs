// Vyact — local-LLM bridge. Runs on the machine hosting LM Studio.
//
// WHY THIS EXISTS: LM Studio's server has NO AUTHENTICATION. The moment it is
// exposed through a tunnel, anyone who learns the hostname can spend the GPU and
// send it whatever they like. This process sits in front of it and refuses every
// request that does not carry the shared secret the Vyact gateway sends as
// `Authorization: Bearer <key>` (the same header the gateway sends any provider).
//
// It also:
//   • forwards ONLY /v1/* chat-completions traffic — nothing else is proxied;
//   • answers /healthz without the secret, so a tunnel check needs no credential;
//   • caps request size and applies its own timeout, so a hung model cannot pin
//     the connection open for ever.
//
// Zero dependencies. Node 18+.
//
// Usage (PowerShell):
//   $env:VYACT_LLM_KEY = "<the secret you also give Supabase>"
//   node vyact-llm-bridge.mjs
//
// Env:
//   VYACT_LLM_KEY   required — the shared secret. Refuses to start without it.
//   UPSTREAM        default http://127.0.0.1:1234   (LM Studio)
//   PORT            default 1235                    (what the tunnel points at)
//   TIMEOUT_MS      default 120000

import { createServer } from 'node:http';

const KEY = process.env.VYACT_LLM_KEY ?? '';
const UPSTREAM = process.env.UPSTREAM ?? 'http://127.0.0.1:1234';
const PORT = Number(process.env.PORT ?? 1235);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 120_000);
const MAX_BODY = 256 * 1024;

if (KEY.length < 24) {
  console.error('VYACT_LLM_KEY is missing or too short (24+ chars). Refusing to start:');
  console.error('an unauthenticated bridge is worse than no bridge.');
  process.exit(1);
}

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

// Constant-time-ish comparison; the secret is long and random, but do not leak
// length information through early exit any more than necessary.
function secretMatches(header) {
  const given = String(header ?? '').replace(/^Bearer\s+/i, '').trim();
  if (given.length !== KEY.length) return false;
  let diff = 0;
  for (let i = 0; i < KEY.length; i++) diff |= given.charCodeAt(i) ^ KEY.charCodeAt(i);
  return diff === 0;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');

  // Unauthenticated liveness check — reveals nothing about the model or the host.
  if (req.method === 'GET' && url.pathname === '/healthz') {
    return send(res, 200, { ok: true, service: 'vyact-llm-bridge' });
  }

  if (!secretMatches(req.headers.authorization)) {
    console.warn(`[${new Date().toISOString()}] refused ${req.method} ${url.pathname}`);
    return send(res, 401, { error: 'unauthorized' });
  }
  // Only the inference path is proxied. /v1/models is allowed because the gateway's
  // operator may want to confirm which model is loaded.
  if (!url.pathname.startsWith('/v1/')) {
    return send(res, 404, { error: 'not_found' });
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) return send(res, 413, { error: 'payload_too_large' });
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
      method: req.method,
      headers: { 'Content-Type': req.headers['content-type'] ?? 'application/json' },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      signal: controller.signal,
    });
    const text = await upstream.text();
    console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname} → ${upstream.status} in ${Date.now() - started}ms`);
    res.writeHead(upstream.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(text);
  } catch (err) {
    const timedOut = controller.signal.aborted;
    console.error(`[${new Date().toISOString()}] upstream ${timedOut ? 'timeout' : 'error'}: ${err.message}`);
    send(res, timedOut ? 504 : 502, { error: timedOut ? 'upstream_timeout' : 'upstream_unreachable' });
  } finally {
    clearTimeout(timer);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`vyact-llm-bridge listening on http://127.0.0.1:${PORT}`);
  console.log(`  upstream : ${UPSTREAM}`);
  console.log(`  auth     : Bearer <VYACT_LLM_KEY>  (${KEY.length} chars)`);
  console.log('  point the tunnel at THIS port, never at LM Studio directly.');
});
