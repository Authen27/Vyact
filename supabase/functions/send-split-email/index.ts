// Vyact v10.16 — transactional email for cross-household split sharing.
//
// In-app notifications only reach a participant once they open Vyact. This
// function sends real email so they're told a split was shared with them (and
// the owner is told when a share settles, and participants when a split is
// closed) even while they're away.
//
// Security: recipients are resolved SERVER-SIDE (service role) from the split id
// — the caller NEVER passes an arbitrary address, so this can't be used to spam.
// The caller's JWT is verified and authorised per event:
//   • 'shared' / 'closed' → caller must be the split's owner (emails participants)
//   • 'settled'           → caller must be the participant on `shareId` (emails owner)
//
// Copy/layout live in ../_shared/emailTemplates.ts (reusable across the app).
// The 'shared' event branches per recipient: members WITH a Vyact account get
// the full-info email; members WITHOUT one get a "sign up to view" invite.
//
// Transport (pick ONE via secrets, checked in this order): MailerSend (MailerLite
// transactional API) → SMTP (any provider) → Resend. Supabase's own email is
// auth-only, so a transport is required. Inert (email_not_configured) until set.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import {
  splitSharedEmail, splitInviteEmail, splitSettledEmail, splitClosedEmail,
  type SplitEmailData,
} from '../_shared/emailTemplates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const env = (k: string) => Deno.env.get(k) ?? '';

type Event = 'shared' | 'settled' | 'closed';

// Configured if ANY transport has its secrets set (MailerSend preferred).
const emailConfigured = () => Boolean(env('MAILERSEND_API_KEY') || env('SMTP_HOST') || env('RESEND_API_KEY'));

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
  return res.ok;
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
    connection: { hostname: env('SMTP_HOST'), port, tls: port === 465, auth: { username: env('SMTP_USER'), password: env('SMTP_PASS') } },
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

// Deliver a pre-rendered email via the first configured transport.
async function deliver(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const from = env('SPLIT_EMAIL_FROM') || 'Vyact <onboarding@resend.dev>';
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
    .select('id, owner_user_id, description, currency, total_amount, date').eq('id', sid).maybeSingle();
  if (!split) return json({ error: 'split_not_found' }, 404);

  const { data: shares } = await admin.from('shared_split_shares')
    .select('id, email, share').eq('split_id', sid);
  const allShares = shares ?? [];
  const callerEmail = (user.email ?? '').toLowerCase();
  const isOwner = user.id === split.owner_user_id;
  const desc = split.description || 'a shared split';

  const ownerRes = await admin.auth.admin.getUserById(split.owner_user_id).catch(() => null);
  const ownerName = (ownerRes?.data?.user?.user_metadata?.full_name as string | undefined)
    || (ownerRes?.data?.user?.email ?? 'Someone');

  if (!emailConfigured()) return json({ ok: false, reason: 'email_not_configured' });

  // Resolve which participant emails have Vyact accounts (+ display names).
  // Present in the map = has an active account.
  const emails = allShares.map(s => s.email);
  const nameMap: Record<string, string> = {};
  if (emails.length) {
    const { data: resolved } = await admin.rpc('resolve_participant_names', { p_emails: emails });
    for (const r of (resolved as { email: string; display_name: string | null }[] ?? [])) {
      if (r.display_name) nameMap[r.email.toLowerCase()] = r.display_name;
    }
  }
  const nameFor = (email: string) => nameMap[email.toLowerCase()] || email;

  let sent = 0;
  if (event === 'shared' || event === 'closed') {
    if (!isOwner) return json({ error: 'forbidden' }, 403);
    const recipients = allShares.filter(s => s.email.toLowerCase() !== callerEmail);
    for (const r of recipients) {
      let mail;
      if (event === 'closed') {
        mail = splitClosedEmail({ ownerName, description: desc, appUrl });
      } else {
        const data: SplitEmailData = {
          ownerName, description: desc, date: split.date, currency: split.currency,
          total: Number(split.total_amount), recipientShare: Number(r.share),
          participants: allShares.map(s => ({
            name: nameFor(s.email), share: Number(s.share), isRecipient: s.id === r.id,
          })),
          appUrl, recipientEmail: r.email,
        };
        const hasAccount = Boolean(nameMap[r.email.toLowerCase()]);
        mail = hasAccount ? splitSharedEmail(data) : splitInviteEmail(data);
      }
      if (await deliver(r.email, mail.subject, mail.html, mail.text)) sent++;
    }
  } else if (event === 'settled') {
    const share = allShares.find(s => s.id === shareId);
    if (!share || share.email.toLowerCase() !== callerEmail) return json({ error: 'forbidden' }, 403);
    const ownerEmail = ownerRes?.data?.user?.email;
    if (ownerEmail) {
      const mail = splitSettledEmail({
        settledLabel: nameFor(share.email), amount: Number(share.share),
        currency: split.currency, description: desc, appUrl,
      });
      if (await deliver(ownerEmail, mail.subject, mail.html, mail.text)) sent++;
    }
  }

  return json({ ok: true, sent });
});
