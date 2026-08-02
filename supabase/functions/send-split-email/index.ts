// Vyact v10.15.0 — transactional email for cross-household split sharing.
//
// The app's in-app notifications only reach a participant once they open Vyact.
// This function sends a real email so they're told a split was shared with them
// (and the owner is told when a share settles, and participants when a split is
// closed) even while they're away.
//
// Security: recipients are resolved SERVER-SIDE (service role) from the split id
// — the caller NEVER passes an arbitrary address, so this can't be used to spam.
// The caller's JWT is verified and authorised per event:
//   • 'shared' / 'closed' → caller must be the split's owner (emails participants)
//   • 'settled'           → caller must be the participant on `shareId` (emails owner)
//
// Transport: pick ONE (checked in this order), all via function secrets —
//   1. MailerSend (MailerLite's TRANSACTIONAL email API — https://mailersend.com):
//        supabase secrets set MAILERSEND_API_KEY=mlsn_xxx \
//          SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"
//      (MailerLite's own API is marketing/subscriber-oriented; MailerSend is its
//       transactional arm and the right fit for one-off split emails. MailerSend
//       also offers SMTP — smtp.mailersend.net:587 — usable via transport #2.)
//   2. SMTP (any provider, incl. MailerSend or the one you set as Auth Custom SMTP):
//        supabase secrets set SMTP_HOST=smtp.provider.com SMTP_PORT=465 \
//          SMTP_USER=... SMTP_PASS=... SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"
//   3. Resend REST API:
//        supabase secrets set RESEND_API_KEY=re_xxx \
//          SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"
// NOTE: Supabase's own email service is AUTH-ONLY (confirm/magic-link/reset/invite)
// with no general send-email API, so one of the transports above is required.
// Until one is configured the function is a graceful no-op (email_not_configured),
// so the app keeps working before email is provisioned. Optional: APP_URL for links.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) ?? '';

type Event = 'shared' | 'settled' | 'closed';

const CUR_SYMBOL: Record<string, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$' };
const money = (amt: number, cur: string) => `${CUR_SYMBOL[cur] ?? ''}${amt}${CUR_SYMBOL[cur] ? '' : ' ' + cur}`;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// Configured if ANY transport has its secrets set (MailerSend preferred).
const emailConfigured = () => Boolean(env('MAILERSEND_API_KEY') || env('SMTP_HOST') || env('RESEND_API_KEY'));

// "Name <email>" | "email" → { email, name? } for APIs that want a structured sender.
function parseFrom(raw: string): { email: string; name?: string } {
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) return { email: m[2].trim(), name: m[1] || undefined };
  return { email: raw.trim() };
}

async function sendViaMailerSend(from: string, to: string, subject: string, html: string, text: string): Promise<boolean> {
  const res = await fetch('https://api.mailersend.com/v1/email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('MAILERSEND_API_KEY')}`,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({ from: parseFrom(from), to: [{ email: to }], subject, html, text }),
  });
  return res.ok; // 202 Accepted on success
}

async function sendViaResend(from: string, to: string, subject: string, html: string, text: string): Promise<boolean> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  return res.ok;
}

async function sendViaSmtp(from: string, to: string, subject: string, html: string, text: string): Promise<boolean> {
  const port = Number(env('SMTP_PORT') || '465');
  const client = new SMTPClient({
    connection: {
      hostname: env('SMTP_HOST'),
      port,
      tls: port === 465,   // 465 = implicit TLS; 587 = STARTTLS (denomailer upgrades)
      auth: { username: env('SMTP_USER'), password: env('SMTP_PASS') },
    },
  });
  try {
    await client.send({ from, to, subject, content: text, html });
    return true;
  } catch (_e) {
    return false;
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

async function sendEmail(to: string, subject: string, heading: string, lines: string[], appUrl: string): Promise<boolean> {
  const from = env('SPLIT_EMAIL_FROM') || 'Vyact <onboarding@resend.dev>';
  const body = lines.map(l => `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.5">${l}</p>`).join('');
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px">${esc(heading)}</h1>
    ${body}
    <a href="${esc(appUrl)}/splits" style="display:inline-block;margin-top:8px;background:#f97316;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600">Open in Vyact</a>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">You're receiving this because someone shared a bill split with this email on Vyact.</p>
  </div>`;
  const text = `${heading}\n\n${lines.map(l => l.replace(/<[^>]+>/g, '')).join('\n')}\n\nOpen: ${appUrl}/splits`;
  // MailerSend first (MailerLite's transactional API), then SMTP, then Resend.
  if (env('MAILERSEND_API_KEY')) return sendViaMailerSend(from, to, subject, html, text);
  if (env('SMTP_HOST')) return sendViaSmtp(from, to, subject, html, text);
  if (env('RESEND_API_KEY')) return sendViaResend(from, to, subject, html, text);
  return false;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const appUrl = env('APP_URL') || 'https://vyact-twentyx.vercel.app';

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  const { splitId, shareId, event } = await req.json().catch(() => ({})) as
    { splitId?: string; shareId?: string; event?: Event };
  if (!event || !['shared', 'settled', 'closed'].includes(event)) return json({ error: 'bad_event' }, 400);

  // Resolve the split — from splitId, or derived from shareId (settle path).
  let sid = splitId;
  if (!sid && shareId) {
    const { data: sh } = await admin.from('shared_split_shares').select('split_id').eq('id', shareId).maybeSingle();
    sid = sh?.split_id;
  }
  if (!sid) return json({ error: 'split_not_found' }, 404);

  const { data: split } = await admin.from('shared_splits')
    .select('id, owner_user_id, description, currency, total_amount').eq('id', sid).maybeSingle();
  if (!split) return json({ error: 'split_not_found' }, 404);

  const { data: shares } = await admin.from('shared_split_shares')
    .select('id, email, share').eq('split_id', sid);
  const callerEmail = (user.email ?? '').toLowerCase();
  const isOwner = user.id === split.owner_user_id;
  const desc = split.description || 'a shared split';

  // Resolve display names (best-effort) for nicer copy.
  const ownerRes = await admin.auth.admin.getUserById(split.owner_user_id).catch(() => null);
  const ownerName = (ownerRes?.data?.user?.user_metadata?.full_name as string | undefined)
    || (ownerRes?.data?.user?.email ?? 'Someone');

  if (!emailConfigured()) return json({ ok: false, reason: 'email_not_configured' });

  let sent = 0;
  if (event === 'shared' || event === 'closed') {
    if (!isOwner) return json({ error: 'forbidden' }, 403);
    const others = (shares ?? []).filter(s => s.email.toLowerCase() !== callerEmail);
    for (const s of others) {
      const ok = event === 'shared'
        ? await sendEmail(s.email, `${ownerName} shared a split with you`, `${ownerName} shared "${esc(desc)}" with you`,
            [`Your share is <strong>${money(s.share, split.currency)}</strong>.`,
             `Sign in to Vyact with this email to see it and settle up.`], appUrl)
        : await sendEmail(s.email, `A shared split was closed`, `"${esc(desc)}" was closed`,
            [`${esc(ownerName)} marked this shared split as closed.`], appUrl);
      if (ok) sent++;
    }
  } else if (event === 'settled') {
    // Caller must be the participant on shareId; email the owner.
    const share = (shares ?? []).find(s => s.id === shareId);
    if (!share || share.email.toLowerCase() !== callerEmail) return json({ error: 'forbidden' }, 403);
    const ownerEmail = ownerRes?.data?.user?.email;
    if (ownerEmail) {
      const ok = await sendEmail(ownerEmail, `A split share was settled`, `${callerEmail} settled their share`,
        [`${esc(callerEmail)} settled <strong>${money(share.share, split.currency)}</strong> on "${esc(desc)}".`], appUrl);
      if (ok) sent++;
    }
  }

  return json({ ok: true, sent });
});
