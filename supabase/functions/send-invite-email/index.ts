// Vyact v10.94.0 — email a household invitation to the person it is addressed to (#9; owner decision
// 13 Oct 2026: an invitation may carry the invitee's email, and Vyact sends it).
//
// Security, in this order, before any email work:
//   • The caller's JWT is verified, and the caller must be an owner or admin of the invitation's
//     household (the rule for creating one).
//   • The address is the invitation's own `recipient_email` (stored and constraint-checked). The caller
//     never passes an address, and an invitation to the caller's own email is refused.
//   • Only a pending invitation (not accepted, not expired) is sent.
//   • Every send is CLAIMED first (`claim_invite_email`): one email per invitation, ever, and at most
//     INVITE_EMAIL_DAILY_CAP per sender per 24 hours. A failed delivery gives its claim back.
//
// Copy: ../_shared/emailTemplates.ts (householdInviteEmail). Transport: ../_shared/emailTransport.ts.
// Logs carry outcomes only, never an address, a name or the link.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { householdInviteEmail } from '../_shared/emailTemplates.ts';
import { env, emailConfigured, parseDailyCap, deliver } from '../_shared/emailTransport.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const log = (outcome: string) => console.log(JSON.stringify({ fn: 'send-invite-email', outcome }));

/** Invitation emails one person may send in 24 hours. A malformed setting keeps the default. */
export const DEFAULT_DAILY_CAP = 20;
export function dailyCap(raw: string): number {
  return parseDailyCap(raw, DEFAULT_DAILY_CAP);
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', member: 'Member', viewer: 'Viewer (read-only)' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const appUrl = env('APP_URL') || 'https://vyact.app';

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authErr } = await admin.auth.getUser(jwt);
  if (authErr || !user) return json({ error: 'unauthorized' }, 401);

  const { invitationId } = await req.json().catch(() => ({})) as { invitationId?: unknown };
  if (typeof invitationId !== 'string' || !UUID.test(invitationId)) return json({ error: 'bad_request' }, 400);

  const { data: inv } = await admin.from('invitations')
    .select('id, household_id, recipient_email, role, token, expires_at, accepted_at')
    .eq('id', invitationId).maybeSingle();
  if (!inv) return json({ error: 'invitation_not_found' }, 404);

  const { data: me } = await admin.from('memberships').select('role')
    .eq('household_id', inv.household_id).eq('user_id', user.id).maybeSingle();
  if (!me || !['owner', 'admin'].includes(String(me.role))) return json({ error: 'forbidden' }, 403);

  const to = String(inv.recipient_email ?? '');
  if (!to) return json({ error: 'no_recipient' }, 409);
  if (inv.accepted_at || !(new Date(inv.expires_at).getTime() > Date.now())) return json({ error: 'invitation_closed' }, 409);
  if (to === (user.email ?? '').toLowerCase()) return json({ error: 'own_email' }, 409);

  if (!emailConfigured()) {
    log('email_not_configured');
    return json({ ok: false, reason: 'email_not_configured' });
  }

  const { data: claim, error: claimErr } = await admin.rpc('claim_invite_email', {
    p_sender: user.id, p_invitation: inv.id, p_daily_cap: dailyCap(env('INVITE_EMAIL_DAILY_CAP')),
  });
  if (claimErr || !['claimed', 'already_sent', 'daily_limit'].includes(String(claim))) {
    log('claim_failed');
    return json({ ok: false, reason: 'claim_failed' }, 500);
  }
  if (claim !== 'claimed') {
    log(String(claim));
    return json({ ok: false, reason: claim });
  }

  const { data: household } = await admin.from('households').select('name').eq('id', inv.household_id).maybeSingle();
  const { data: profile } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  const inviterName = String(profile?.display_name ?? '').trim()
    || String((user.user_metadata as { full_name?: string } | undefined)?.full_name ?? '').trim()
    || user.email || 'Someone';
  const mail = householdInviteEmail({
    inviterName,
    inviterEmail: user.email ?? undefined,
    household: String(household?.name ?? '') || 'a household',
    roleLabel: ROLE_LABEL[String(inv.role)] ?? 'Member',
    inviteUrl: `${appUrl}/invite/${encodeURIComponent(String(inv.token))}`,
    expiresOn: String(inv.expires_at).slice(0, 10),
  });

  if (!(await deliver('send-invite-email', to, mail.subject, mail.html, mail.text))) {
    // Give the claim back, so a retry can send it.
    await admin.from('invite_email_log').delete().eq('invitation_id', inv.id);
    log('send_failed');
    return json({ ok: false, reason: 'send_failed' });
  }
  log('sent');
  return json({ ok: true });
});
