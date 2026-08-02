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
// Provider: Resend (https://resend.com) via its REST API. Configure two secrets:
//   supabase secrets set RESEND_API_KEY=re_xxx
//   supabase secrets set SPLIT_EMAIL_FROM="Vyact <splits@yourdomain.com>"
// Until RESEND_API_KEY is set the function is a graceful no-op (email_not_configured),
// so the app keeps working before email is provisioned. Optional: APP_URL for links.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

async function sendEmail(to: string, subject: string, heading: string, lines: string[], appUrl: string): Promise<boolean> {
  const key = env('RESEND_API_KEY');
  const from = env('SPLIT_EMAIL_FROM') || 'Vyact <onboarding@resend.dev>';
  if (!key) return false;
  const body = lines.map(l => `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.5">${l}</p>`).join('');
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px">${esc(heading)}</h1>
    ${body}
    <a href="${esc(appUrl)}/splits" style="display:inline-block;margin-top:8px;background:#f97316;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600">Open in Vyact</a>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">You're receiving this because someone shared a bill split with this email on Vyact.</p>
  </div>`;
  const text = `${heading}\n\n${lines.map(l => l.replace(/<[^>]+>/g, '')).join('\n')}\n\nOpen: ${appUrl}/splits`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  return res.ok;
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

  if (!env('RESEND_API_KEY')) return json({ ok: false, reason: 'email_not_configured' });

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
