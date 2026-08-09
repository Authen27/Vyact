// Vyact WhatsApp — proactive follow-through dispatch (authenticated; deploy WITH JWT).
//
// A single server endpoint the app (or other edge functions) call to fire a
// business-initiated WhatsApp template — partner-split prompt, budget alert, bill
// reminder, split notifications, digests, etc. It is INERT by design: nothing is
// sent unless BOTH `WHATSAPP_OUTBOUND_ENABLED` is on AND the mapped template name
// is in `WHATSAPP_APPROVED_TEMPLATES`. So "activation" is setting two secrets once
// Meta approves — no code change, no accidental sends while templates are in review.
//
// Body: { event: string, householdId: string, toProfileId: string, params?: string[] }
// Auth: the caller's Supabase JWT; the caller must be a member of householdId.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, json, corsHeaders, dispatchTemplate } from '../_shared/whatsapp.ts';

// event → approved template name (see whatsapp template catalog).
const EVENT_TEMPLATE: Record<string, string> = {
  partner_split: 'partner_split_prompt',
  split_shared: 'split_shared_with_you',
  split_settled: 'split_settled',
  budget_threshold: 'budget_threshold_alert',
  bill_due: 'bill_due_reminder',
  large_transaction: 'large_transaction_alert',
  recurring_logged: 'recurring_auto_logged',
  weekly_summary: 'weekly_summary',
  reengagement: 'reengagement_nudge',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: { user }, error: aErr } = await admin.auth.getUser(jwt);
  if (aErr || !user) return json({ error: 'unauthorized' }, 401);

  const { event, householdId, toProfileId, params } = await req.json().catch(() => ({}));
  const templateName = EVENT_TEMPLATE[event ?? ''];
  if (!templateName) return json({ error: 'unknown_event' }, 400);
  if (!householdId || !toProfileId) return json({ error: 'missing_target' }, 400);

  // The caller must belong to the household they're notifying about.
  const { data: membership } = await admin
    .from('memberships').select('id')
    .eq('household_id', householdId).eq('user_id', user.id).maybeSingle();
  if (!membership) return json({ error: 'not_a_member' }, 403);

  // The recipient must have a VERIFIED WhatsApp number linked to THIS household.
  const { data: recipient } = await admin
    .from('profiles').select('phone_number, phone_verified_at, whatsapp_household_id')
    .eq('id', toProfileId).maybeSingle();
  if (!recipient?.phone_verified_at || !recipient.phone_number
      || recipient.whatsapp_household_id !== householdId) {
    return json({ status: 'skipped', reason: 'recipient_not_linked' });
  }

  const res = await dispatchTemplate(recipient.phone_number, templateName, Array.isArray(params) ? params : []);

  // Audit every attempt (idempotency key = event+target+time bucket is not needed
  // here; record for observability).
  await admin.from('whatsapp_inbound_messages').insert({
    wa_message_id: `out_${templateName}_${toProfileId}_${Date.now()}`,
    profile_id: toProfileId,
    household_id: householdId,
    direction: 'outbound',
    payload: { event, templateName, params: params ?? [], result: res },
    processed_at: new Date().toISOString(),
  });

  return json({ status: res.sent ? 'sent' : 'skipped', reason: res.reason ?? null, template: templateName });
});
