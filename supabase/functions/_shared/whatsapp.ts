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

import { MAX_PAYLOAD, type TemplateDef } from './whatsapp-templates.ts';
import type { InteractiveList } from './whatsapp-receptionist.ts';

export const env = (k: string, fallback = ''): string => Deno.env.get(k) ?? fallback;

export const GRAPH_VERSION = env('WHATSAPP_GRAPH_VERSION', 'v21.0');

// Meta identifiers. Phone Number ID = the sending number; WABA ID = the WhatsApp
// Business Account.
//
// v10.40.0 — NO in-code fallbacks. The old defaults ('1180086958501828' /
// '1690737521937003') were the retired TEST account, which holds only the +1 555
// test number; a missing secret would have silently sent from it. A missing value
// now fails loudly at send time ("sender not configured") instead.
export const WHATSAPP_PHONE_NUMBER_ID = env('WHATSAPP_PHONE_NUMBER_ID');
export const WHATSAPP_BUSINESS_ACCOUNT_ID = env('WHATSAPP_WABA_ID');

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

/**
 * A template parameter Meta will accept. Parameters may not contain newlines or
 * tabs, nor more than four consecutive spaces (error 132018), and are capped here
 * well under Meta's limit so a runaway value cannot fill a whole message.
 */
export function cleanParam(value: unknown, max = 200): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max);
}

/** Send an approved WhatsApp template message. `params` fill {{1}},{{2}},… in the body. */
export async function sendTemplate(to: string, templateName: string, params: string[] = [], lang = 'en_US'): Promise<void> {
  const phoneId = WHATSAPP_PHONE_NUMBER_ID;
  const token = env('WHATSAPP_ACCESS_TOKEN');
  if (!phoneId || !token) throw new Error('WhatsApp sender not configured (PHONE_NUMBER_ID / ACCESS_TOKEN).');
  const components = params.length
    ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: cleanParam(text) })) }]
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

/**
 * W1 (v10.41.0) — the template message for a manifest template, exactly as Meta
 * needs it on the wire. `sendTemplate` above sent a text body only; every image
 * template now requires its header image on EVERY send (Meta fixes the header TYPE
 * at approval, not the image), and quick replies carry a payload so a tap can be
 * routed back to what it was about (W2/W3 handlers read `template:index:context`).
 *
 * Throws on a wrong value count rather than letting Meta reject the send: the
 * caller's contract is broken, and that is a bug to surface, not retry.
 */
export function buildTemplateMessage(
  def: TemplateDef,
  values: readonly unknown[],
  opts: { appUrl: string; context?: string },
): { name: string; language: { code: string }; components: Record<string, unknown>[] } {
  if (values.length !== def.params.length) {
    throw new Error(`${def.name} needs ${def.params.length} values (${def.params.map((p) => p.name).join(', ')}), got ${values.length}`);
  }
  const components: Record<string, unknown>[] = [];
  if (def.headerImage) {
    components.push({ type: 'header', parameters: [{ type: 'image', image: { link: `${opts.appUrl}/whatsapp/${def.headerImage}` } }] });
  }
  if (values.length) {
    components.push({ type: 'body', parameters: values.map((v) => ({ type: 'text', text: cleanParam(v) })) });
  }
  (def.buttons ?? []).forEach((b, index) => {
    if (b.type !== 'quick_reply') return;   // static URL buttons take no send-time value
    const payload = `${def.name}:${index}:${cleanParam(opts.context ?? '', 60)}`.slice(0, MAX_PAYLOAD);
    components.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload }] });
  });
  return { name: def.name, language: { code: def.language }, components };
}

/**
 * Send a manifest template (see `buildTemplateMessage`). Returns Meta's message id
 * (wamid), which delivery statuses and button taps refer back to, or null when
 * Meta's reply carries none.
 */
export async function sendTemplateMessage(
  to: string, def: TemplateDef, values: readonly unknown[], opts: { appUrl: string; context?: string },
): Promise<string | null> {
  const phoneId = WHATSAPP_PHONE_NUMBER_ID;
  const token = env('WHATSAPP_ACCESS_TOKEN');
  if (!phoneId || !token) throw new Error('WhatsApp sender not configured (PHONE_NUMBER_ID / ACCESS_TOKEN).');
  const template = buildTemplateMessage(def, values, opts);
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template', template }),
  });
  if (!res.ok) throw new Error(`Meta dispatch failed (${res.status}): ${await res.text()}`);
  const sent = await res.json().catch(() => null) as { messages?: { id?: string }[] } | null;
  return sent?.messages?.[0]?.id ?? null;
}

/**
 * v10.41.0 — send an interactive LIST message (the receptionist's "Choose an
 * action"). Session-only: allowed inside the 24-hour window after the person
 * writes, which is the only time the receptionist runs. No template needed.
 */
export async function sendInteractiveList(to: string, list: InteractiveList): Promise<void> {
  const phoneId = WHATSAPP_PHONE_NUMBER_ID;
  const token = env('WHATSAPP_ACCESS_TOKEN');
  if (!phoneId || !token) throw new Error('WhatsApp sender not configured (PHONE_NUMBER_ID / ACCESS_TOKEN).');
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: list.body },
        ...(list.footer ? { footer: { text: list.footer } } : {}),
        action: { button: list.button, sections: list.sections },
      },
    }),
  });
  if (!res.ok) throw new Error(`Meta list dispatch failed (${res.status}): ${await res.text()}`);
}

/** Send a free-form session text. Allowed within the 24h customer-service window
 *  (i.e. after the user has messaged us) — no template approval needed. This is
 *  what the MVP write-only flow uses for confirmations / clarify / hard-block. */
export async function sendText(to: string, body: string): Promise<void> {
  const phoneId = WHATSAPP_PHONE_NUMBER_ID;
  const token = env('WHATSAPP_ACCESS_TOKEN');
  if (!phoneId || !token) throw new Error('WhatsApp sender not configured (PHONE_NUMBER_ID / ACCESS_TOKEN).');
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body },
    }),
  });
  if (!res.ok) throw new Error(`Meta text dispatch failed (${res.status}): ${await res.text()}`);
}

/** The consumer app URL used in reply links (override via env). */
export const APP_URL = env('VYACT_APP_URL', 'https://vyact.app');

// ── Outbound follow-through gating ────────────────────────────────────────────
// Proactive template sends (partner split, budget alert, bill reminder, …) stay
// INERT until BOTH: outbound is enabled AND the specific template name is on the
// approved allowlist. So the trigger machinery ships now and "activation" is just
// setting two secrets once Meta approves — no code change, no accidental sends.
export const OUTBOUND_ENABLED = /^(1|true|yes)$/i.test(env('WHATSAPP_OUTBOUND_ENABLED'));
const APPROVED_TEMPLATES = new Set(
  env('WHATSAPP_APPROVED_TEMPLATES').split(',').map((s) => s.trim()).filter(Boolean),
);
export function isTemplateApproved(name: string): boolean { return APPROVED_TEMPLATES.has(name); }

/** Why a proactive send would be skipped before reaching Meta, or null to send. */
export function gateReason(templateName: string): 'outbound_disabled' | 'template_not_approved' | null {
  if (!OUTBOUND_ENABLED) return 'outbound_disabled';
  if (!isTemplateApproved(templateName)) return 'template_not_approved';
  return null;
}

/** Guarded proactive template send. Never throws for a gating miss — returns the
 *  reason so callers can log-and-continue. Real dispatch failures still throw. */
export async function dispatchTemplate(
  to: string, templateName: string, params: string[] = [], lang = 'en_US',
): Promise<{ sent: boolean; reason?: string }> {
  const gated = gateReason(templateName);
  if (gated) return { sent: false, reason: gated };
  await sendTemplate(to, templateName, params, lang);
  return { sent: true };
}

/** 6-digit numeric OTP from a CSPRNG. */
export function generateOtp(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return String(n).padStart(6, '0');
}
