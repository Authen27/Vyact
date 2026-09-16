// Vyact Agent — CLAUDE CODE RELAY STATUS (v10.37.0, TEST-ONLY, TD-44).
//
// GET → { "pending": <n> }   — the number of queued relay calls still inside their TTL.
//
// Exists only so the operator's local watcher can wake the Claude Code session that
// answers `ask_vyact_relay` rows, without that watcher holding ANY credential. It
// deliberately returns a count and nothing else: no ids, no user, no content. The
// session reads and answers rows through its own authorised database access.
//
// DEPLOY: WITHOUT JWT verification (the watcher is anonymous by design).
//   supabase functions deploy ask-vyact-relay-status --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { RELAY_TTL_MS } from '../_shared/agent/relay.ts';

const HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers: HEADERS });
  }
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'not_configured' }), { status: 500, headers: HEADERS });
  }
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const since = new Date(Date.now() - RELAY_TTL_MS).toISOString();
  const { count, error } = await admin
    .from('ask_vyact_relay')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gt('created_at', since);
  if (error) {
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: HEADERS });
  }
  return new Response(JSON.stringify({ pending: count ?? 0 }), { status: 200, headers: HEADERS });
});
