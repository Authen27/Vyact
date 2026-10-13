// Vyact v10.16 — transactional email for cross-household split sharing.
//
// In-app notifications only reach a participant once they open Vyact. This
// function sends real email so they're told a split was shared with them (and
// the owner is told when a share settles, and participants when a split is
// closed) even while they're away.
//
// Security: recipients are resolved SERVER-SIDE (service role) from the split id
// — the caller NEVER passes an arbitrary address. The caller's JWT is verified and
// authorised per event, BEFORE any other work:
//   • 'shared'  → caller owns the split and it is still open (emails participants)
//   • 'closed'  → caller owns the split and it is closed (emails participants)
//   • 'settled' → caller is the participant on `shareId` and it is paid (emails owner)
// W1c (v10.64.0, audit BE-FN-06): the split's owner still chooses the addresses, so every send
// is CLAIMED first (`claim_split_emails`): one email per share per event, ever, and at most
// SPLIT_EMAIL_DAILY_CAP emails per sender per 24 hours. A second 'shared' call mails only the
// people added since; a failed delivery releases its claim so a retry can send it.
//
// Copy/layout live in ../_shared/emailTemplates.ts (reusable across the app).
// The 'shared' event branches per recipient: members WITH a Vyact account get
// the full-info email; members WITHOUT one get a "sign up to view" invite.
//
// Transport: ../_shared/emailTransport.ts (MailerSend → SMTP → Resend), shared with
// send-invite-email since v10.94.0. Inert (email_not_configured) until one is set.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  splitSharedEmail, splitInviteEmail, splitSettledEmail, splitClosedEmail,
  type SplitEmailData,
} from '../_shared/emailTemplates.ts';
import { env, emailConfigured, parseDailyCap, deliver as send } from '../_shared/emailTransport.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

type Event = 'shared' | 'settled' | 'closed';

/** Emails one person may cause in 24 hours. A malformed setting keeps the default, never "off". */
export const DEFAULT_DAILY_CAP = 50;
export function dailyCap(raw: string): number {
  return parseDailyCap(raw, DEFAULT_DAILY_CAP);
}

const deliver = (to: string, subject: string, html: string, text: string) =>
  send('send-split-email', to, subject, html, text);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const appUrl = env('APP_URL') || 'https://vyact.app';

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
    .select('id, owner_user_id, description, currency, total_amount, date, closed_at').eq('id', sid).maybeSingle();
  if (!split) return json({ error: 'split_not_found' }, 404);

  const { data: shares } = await admin.from('shared_split_shares')
    .select('id, email, share, paid').eq('split_id', sid);
  const allShares = (shares ?? []) as { id: string; email: string; share: number; paid?: boolean }[];
  const callerEmail = (user.email ?? '').toLowerCase();
  const isOwner = user.id === split.owner_user_id;

  // Authorise, and pick the shares this event is about, before anything is resolved or sent.
  let targets: typeof allShares;
  if (event === 'shared' || event === 'closed') {
    if (!isOwner) return json({ error: 'forbidden' }, 403);
    if (event === 'shared' && split.closed_at) return json({ error: 'split_closed' }, 409);
    if (event === 'closed' && !split.closed_at) return json({ error: 'split_not_closed' }, 409);
    targets = allShares.filter(s => s.email.toLowerCase() !== callerEmail);
  } else {
    const share = allShares.find(s => s.id === shareId);
    if (!share || share.email.toLowerCase() !== callerEmail) return json({ error: 'forbidden' }, 403);
    if (!share.paid) return json({ error: 'share_not_settled' }, 409);
    targets = [share];
  }

  if (!emailConfigured()) {
    console.warn(JSON.stringify({ fn: 'send-split-email', event, outcome: 'email_not_configured' }));
    return json({ ok: false, reason: 'email_not_configured' });
  }

  // One email per share per event, and a daily cap per sender — claimed atomically.
  const { data: claim, error: claimErr } = await admin.rpc('claim_split_emails', {
    p_sender: user.id, p_split: sid, p_event: event,
    p_share_ids: targets.map(t => t.id), p_daily_cap: dailyCap(env('SPLIT_EMAIL_DAILY_CAP')),
  });
  if (claimErr) {
    console.error(JSON.stringify({ fn: 'send-split-email', event, outcome: 'claim_failed' }));
    return json({ ok: false, reason: 'claim_failed' }, 500);
  }
  const claimedIds = new Set((claim as { claimed?: string[] } | null)?.claimed ?? []);
  const limited = Number((claim as { limited?: number } | null)?.limited ?? 0);
  const claimed = targets.filter(t => claimedIds.has(t.id));
  // A delivery that failed gives its claim back, so the next call can try that person again.
  const release = (id: string) =>
    admin.from('split_email_log').delete().eq('share_id', id).eq('event', event);

  const desc = split.description || 'a shared split';
  const ownerRes = claimed.length ? await admin.auth.admin.getUserById(split.owner_user_id).catch(() => null) : null;
  const ownerName = (ownerRes?.data?.user?.user_metadata?.full_name as string | undefined)
    || (ownerRes?.data?.user?.email ?? 'Someone');

  // Resolve which participant emails have Vyact accounts (+ display names).
  // Present in the map = has an active account.
  const nameMap: Record<string, string> = {};
  if (claimed.length && allShares.length) {
    const { data: resolved } = await admin.rpc('resolve_participant_names', { p_emails: allShares.map(s => s.email) });
    for (const r of (resolved as { email: string; display_name: string | null }[] ?? [])) {
      if (r.display_name) nameMap[r.email.toLowerCase()] = r.display_name;
    }
  }
  const nameFor = (email: string) => nameMap[email.toLowerCase()] || email;

  let sent = 0;
  let recipients = 0;
  for (const r of claimed) {
    let to: string | undefined;
    let mail;
    if (event === 'closed') {
      to = r.email;
      mail = splitClosedEmail({ ownerName, description: desc, appUrl });
    } else if (event === 'shared') {
      to = r.email;
      const data: SplitEmailData = {
        ownerName, description: desc, date: split.date, currency: split.currency,
        total: Number(split.total_amount), recipientShare: Number(r.share),
        participants: allShares.map(s => ({
          name: nameFor(s.email), share: Number(s.share), isRecipient: s.id === r.id,
        })),
        appUrl, recipientEmail: r.email,
        ownerEmail: ownerRes?.data?.user?.email ?? undefined,
      };
      const hasAccount = Boolean(nameMap[r.email.toLowerCase()]);
      mail = hasAccount ? splitSharedEmail(data) : splitInviteEmail(data);
    } else {
      to = ownerRes?.data?.user?.email ?? undefined;
      mail = splitSettledEmail({
        settledLabel: nameFor(r.email), amount: Number(r.share),
        currency: split.currency, description: desc, appUrl,
      });
    }
    if (!to) { await release(r.id); continue; }
    recipients++;
    if (await deliver(to, mail.subject, mail.html, mail.text)) sent++;
    else await release(r.id);
  }

  console.log(JSON.stringify({ fn: 'send-split-email', event, recipients, sent, limited }));
  if (limited > 0) return json({ ok: false, reason: 'daily_limit', sent, recipients, limited });
  return json({ ok: true, sent, recipients });
});
