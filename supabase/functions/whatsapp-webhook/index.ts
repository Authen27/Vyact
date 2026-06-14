// Vyact WhatsApp webhook — connection foundation.
//
// This is the callback URL you register in the Meta dashboard. It does two jobs:
//   GET  → the verification handshake Meta uses to VALIDATE the callback URL
//          (echoes hub.challenge when hub.verify_token === WHATSAPP_VERIFY_TOKEN).
//   POST → verifies the X-Hub-Signature-256 HMAC, ACKS 200 immediately, and records
//          the inbound event for idempotency/audit. Use-case processing (parsing,
//          ledger writes, partner split) is intentionally NOT here yet — it will be
//          added behind this same entry point in the workflow phase.
//
// Deploy WITHOUT JWT (Meta has no Supabase JWT):
//   supabase functions deploy whatsapp-webhook --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, verifyMetaSignature } from '../_shared/whatsapp.ts';

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1. Verification handshake (Meta → us). This is how the callback URL is validated.
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === env('WHATSAPP_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // 2. Authenticate the payload cryptographically (constant-time HMAC).
  const rawBody = await req.text();
  if (!(await verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256')))) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 3. ACK first; record for idempotency. (Meta expects 200 within ~10s and retries
  //    on non-200 — never block the ack on downstream work.)
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawBody); } catch { /* keep {} */ }

  const change = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];

  // Status callbacks (delivered/read) and non-message events: accept and ignore.
  if (message?.id) {
    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const fromPhone = (change?.contacts?.[0]?.wa_id ?? '').replace(/[^\d]/g, '');
    // Resolve the linked, verified profile (if any) for attribution/audit.
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, whatsapp_household_id')
      .eq('phone_number', fromPhone)
      .not('phone_verified_at', 'is', null)
      .maybeSingle();

    // Idempotent claim-first: PK on wa_message_id rejects duplicates.
    await supabase.from('whatsapp_inbound_messages').upsert({
      wa_message_id: message.id,
      profile_id: profile?.id ?? null,
      household_id: profile?.whatsapp_household_id ?? null,
      direction: 'inbound',
      payload: message,
      processed_at: null,   // workflow phase will set this after handling
    }, { onConflict: 'wa_message_id', ignoreDuplicates: true });

    // NOTE (workflow phase): dispatch processing here via EdgeRuntime.waitUntil(...)
    // — deterministic parser (MVP) or Gemini (MVP++) → whatsapp_log_transaction RPC.
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
