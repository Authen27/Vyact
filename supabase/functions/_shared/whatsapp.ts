// Shared helpers for the Vyact WhatsApp Business integration (Supabase Edge / Deno).
// No secrets are hard-coded — everything comes from Supabase Function secrets.
//
// Required secrets (set with `supabase secrets set ...`):
//   WHATSAPP_VERIFY_TOKEN      — random string; matched in the GET webhook handshake
//   WHATSAPP_APP_SECRET        — Meta App Secret; verifies the X-Hub-Signature-256 HMAC
//   WHATSAPP_ACCESS_TOKEN      — System User permanent token (whatsapp_business_messaging)
//   WHATSAPP_PHONE_NUMBER_ID   — the sending number's Phone Number ID (NOT the WABA ID)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — injected by the platform
//   WHATSAPP_GRAPH_VERSION     — optional, defaults to v21.0

export const env = (k: string, fallback = ''): string => Deno.env.get(k) ?? fallback;

export const GRAPH_VERSION = env('WHATSAPP_GRAPH_VERSION', 'v21.0');

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** Normalise a phone to bare E.164 digits (no '+', no spaces). "+1 (415) 555" → "1415555". */
export function normalisePhone(raw: string): string {
  return (raw || '').replace(/[^\d]/g, '');
}

/** Hex SHA-256 of a UTF-8 string. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare — avoids leaking match position via timing (OTP + signature). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify Meta's `X-Hub-Signature-256: sha256=<hex>` HMAC over the raw body. */
export async function verifyMetaSignature(rawBody: string, header: string | null): Promise<boolean> {
  const appSecret = env('WHATSAPP_APP_SECRET');
  if (!appSecret || !header || !header.startsWith('sha256=')) return false;
  const provided = header.slice('sha256='.length);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(provided, expected);
}

/** Send an approved WhatsApp template message. `params` fill {{1}},{{2}},… in the body. */
export async function sendTemplate(to: string, templateName: string, params: string[] = [], lang = 'en_US'): Promise<void> {
  const phoneId = env('WHATSAPP_PHONE_NUMBER_ID');
  const token = env('WHATSAPP_ACCESS_TOKEN');
  if (!phoneId || !token) throw new Error('WhatsApp sender not configured (PHONE_NUMBER_ID / ACCESS_TOKEN).');
  const components = params.length
    ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }]
    : [];
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: { name: templateName, language: { code: lang }, components },
    }),
  });
  if (!res.ok) throw new Error(`Meta dispatch failed (${res.status}): ${await res.text()}`);
}

/** 6-digit numeric OTP from a CSPRNG. */
export function generateOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}
