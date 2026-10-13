// Vyact — the one email transport for the send-* Edge Functions (moved out of send-split-email in
// v10.94.0, when send-invite-email became the second sender).
//
// Transport (pick ONE via secrets, checked in this order): MailerSend (MailerLite transactional API)
// → SMTP (any provider) → Resend. Supabase's own email is auth-only, so a transport is required.
// Every function is inert (`email_not_configured`) until one is set. docs/EMAIL_TEMPLATES.md §0.

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

export const env = (k: string) => Deno.env.get(k) ?? '';

/** Configured if ANY transport has its secrets set (MailerSend preferred). */
export const emailConfigured = () => Boolean(env('MAILERSEND_API_KEY') || env('SMTP_HOST') || env('RESEND_API_KEY'));

/** Emails one person may cause in 24 hours. A malformed setting keeps the default, never "off". */
export function parseDailyCap(raw: string, fallback: number): number {
  return /^\d{1,5}$/.test(raw.trim()) ? Number(raw.trim()) : fallback;
}

function parseFrom(raw: string): { email: string; name?: string } {
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim(), name: m[1] || undefined };
  return { email: raw.trim() };
}

// v10.60.0 — every email comes from vyact.app (docs/EMAIL_TEMPLATES.md §0); replies go to support.
// SPLIT_EMAIL_FROM is the sender secret's historical name; it is the sender for every send-* email.
const DEFAULT_FROM = 'Vyact <hello@vyact.app>';
const replyTo = () => env('EMAIL_REPLY_TO') || 'support@vyact.app';

/** A provider refusal, logged by status only — never the address or the body. */
async function refused(fn: string, provider: string, res: Response): Promise<false> {
  let code = '';
  try { code = String(((await res.json()) as { name?: string; message?: string })?.name ?? ''); } catch { /* not json */ }
  console.error(JSON.stringify({ fn, provider, status: res.status, code }));
  return false;
}

async function sendViaMailerSend(fn: string, from: string, to: string, subject: string, html: string, text: string): Promise<boolean> {
  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('MAILERSEND_API_KEY')}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ from: parseFrom(from), to: [{ email: to }], reply_to: { email: replyTo() }, subject, html, text }),
  });
  return res.ok || refused(fn, 'mailersend', res);
}

async function sendViaResend(fn: string, from: string, to: string, subject: string, html: string, text: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, reply_to: replyTo(), subject, html, text }),
  });
  return res.ok || refused(fn, 'resend', res);
}

async function sendViaSmtp(fn: string, from: string, to: string, subject: string, html: string, text: string): Promise<boolean> {
  const port = Number(env('SMTP_PORT') || '465');
  const client = new SMTPClient({
    connection: { hostname: env('SMTP_HOST'), port, tls: port === 465, auth: { username: env('SMTP_USER'), password: env('SMTP_PASS') } },
  });
  try {
    await client.send({ from, to, subject, content: text, html });
    return true;
  } catch (e) {
    console.error(JSON.stringify({ fn, provider: 'smtp', error: String((e as Error)?.name ?? 'error') }));
    return false;
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

/** Deliver a pre-rendered email via the first configured transport. `fn` names the caller in logs. */
export async function deliver(fn: string, to: string, subject: string, html: string, text: string): Promise<boolean> {
  const from = env('SPLIT_EMAIL_FROM') || DEFAULT_FROM;
  if (env('MAILERSEND_API_KEY')) return sendViaMailerSend(fn, from, to, subject, html, text);
  if (env('SMTP_HOST')) return sendViaSmtp(fn, from, to, subject, html, text);
  if (env('RESEND_API_KEY')) return sendViaResend(fn, from, to, subject, html, text);
  return false;
}
