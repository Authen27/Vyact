// Vyact WhatsApp — proactive follow-through dispatch (authenticated; deploy WITH JWT).
//
// A single server endpoint the app (or other edge functions) call to fire a
// business-initiated WhatsApp template — partner-split prompt, budget alert, bill
// reminder, split notifications, digests, etc. It is INERT by design: nothing is
// sent unless BOTH `WHATSAPP_OUTBOUND_ENABLED` is on AND the mapped template name
// is in `WHATSAPP_APPROVED_TEMPLATES`. So "activation" is setting two secrets once
// Meta approves — no code change, no accidental sends while templates are in review.
//
// Body: { event, householdId, toProfileId, params?: string[], dedupeKey?: string }
//
// Two callers (v10.40.0):
//   • a signed-in household member (their Supabase JWT) — must hold a WRITE role
//     (owner / admin / member); a viewer or child cannot message other members;
//   • a server job (a scheduler, a DB-triggered function) — the SERVICE key as the
//     bearer. It used to be refused with 401, which is why no scheduled message
//     could ever have been sent.
//
// Every send is guarded the same way, whichever caller asked:
//   • the recipient must be linked to THIS household;
//   • MARKETING templates are refused until the recipient has opted in (W2 adds the
//     consent record — until then, refused outright rather than assumed);
//   • one send per (event, recipient, dedupeKey) — dedupeKey defaults to the UTC day,
//     so a caller retrying the same event cannot message someone twice;
//   • a per-recipient cap on sends in any 24 hours (WHATSAPP_DAILY_CAP, default 6).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import {
  env, json, corsHeaders, sendTemplateMessage, gateReason, cleanParam, constantTimeEqual, APP_URL,
} from '../_shared/whatsapp.ts';
import { templateForEvent } from '../_shared/whatsapp-templates.ts';

// W1 (v10.41.0) — the event → template table and each template's category now come
// from the manifest (_shared/whatsapp-templates.ts), the one record of what Meta
// approved. An event is a legacy alias (bill_due, partner_split…) or a template name.

/** Roles that may send on the household's behalf. Viewers and children read only. */
const WRITE_ROLES = new Set(['owner', 'admin', 'member']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(env('SUPABASE_URL'), serviceKey);

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const asService = !!serviceKey && constantTimeEqual(bearer, serviceKey);
  let callerId: string | null = null;
  if (!asService) {
    const { data: { user }, error: aErr } = await admin.auth.getUser(bearer);
    if (aErr || !user) return json({ error: 'unauthorized' }, 401);
    callerId = user.id;
  }

  const { event, householdId, toProfileId, params, dedupeKey } = await req.json().catch(() => ({}));
  const def = templateForEvent(String(event ?? ''));
  if (!def) return json({ error: 'unknown_event' }, 400);
  if (!householdId || !toProfileId) return json({ error: 'missing_target' }, 400);
  const templateName = def.name;
  // Every value the approved template needs, no more, no fewer: Meta rejects a
  // mismatch, so it is refused here with the names of what was expected.
  const values = Array.isArray(params) ? params : [];
  if (values.length !== def.params.length) {
    return json({ error: 'param_count', expected: def.params.map((p) => p.name), got: values.length }, 400);
  }

  // A member may only notify about their own household, and only with a write role.
  if (callerId) {
    const { data: membership } = await admin
      .from('memberships').select('role')
      .eq('household_id', householdId).eq('user_id', callerId).maybeSingle();
    if (!membership) return json({ error: 'not_a_member' }, 403);
    if (!WRITE_ROLES.has(String((membership as { role?: string }).role))) {
      return json({ error: 'read_only_member' }, 403);
    }
  }

  // The recipient must have a VERIFIED WhatsApp identity linked to THIS
  // household (audit S1: read the server-owned identity table, not profiles).
  const { data: recipient } = await admin
    .from('whatsapp_identities').select('phone_number, household_id')
    .eq('profile_id', toProfileId).maybeSingle();
  if (!recipient?.phone_number || recipient.household_id !== householdId) {
    return json({ status: 'skipped', reason: 'recipient_not_linked', template: templateName });
  }

  const cleaned = values.map((p: unknown) => cleanParam(p));
  const audit = (id: string, status: string, result: Record<string, unknown>) =>
    admin.from('whatsapp_inbound_messages').insert({
      wa_message_id: id,
      profile_id: toProfileId,
      household_id: householdId,
      direction: 'outbound',
      // Outbound audit rows are never inbox work: an explicit status keeps them out
      // of the replay sweep, which used to see them as 'pending' (the default).
      status,
      payload: { event, templateName, params: cleaned, caller: asService ? 'service' : callerId, result },
      processed_at: new Date().toISOString(),
    });

  // Refusals that need no Meta call are recorded with a unique id, so they never
  // occupy the dedupe slot a real send will need later.
  const skip = async (reason: string) => {
    await audit(`out:${templateName}:${toProfileId}:${crypto.randomUUID()}`, 'skipped', { sent: false, reason });
    return json({ status: 'skipped', reason, template: templateName });
  };

  // Marketing needs the recipient's own opt-in. The consent record arrives in W2;
  // until it exists, a marketing send is refused rather than assumed.
  if (def.category === 'marketing') return skip('marketing_consent_required');

  const gated = gateReason(templateName);
  if (gated) return skip(gated);

  // Per-recipient cap across every template, sent in the last 24 hours.
  const cap = Number(env('WHATSAPP_DAILY_CAP', '6')) || 6;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from('whatsapp_inbound_messages')
    .select('wa_message_id', { count: 'exact', head: true })
    .eq('profile_id', toProfileId)
    .eq('direction', 'outbound')
    .eq('status', 'sent')
    .gt('created_at', since);
  if ((count ?? 0) >= cap) return skip('daily_cap');

  // Dedupe by CLAIMING the slot before sending: the primary key refuses a second
  // claim, so two concurrent callers cannot both send.
  const key = cleanParam(dedupeKey ?? new Date().toISOString().slice(0, 10), 120);
  const slot = `out:${event}:${toProfileId}:${key}`;
  const { error: claimError } = await audit(slot, 'sending', { sent: false });
  if (claimError) {
    return (claimError as { code?: string }).code === '23505'
      ? json({ status: 'skipped', reason: 'duplicate', template: templateName })
      : json({ error: 'audit_failed' }, 500);
  }

  try {
    // The dedupe key rides on quick-reply payloads, so a tap can be traced back to
    // the exact event it answers.
    await sendTemplateMessage(recipient.phone_number, def, cleaned, { appUrl: APP_URL, context: key });
  } catch (e) {
    await admin.from('whatsapp_inbound_messages')
      .update({ status: 'failed', last_error: (e as Error)?.message ?? String(e) })
      .eq('wa_message_id', slot);
    return json({ status: 'failed', reason: 'meta_error', template: templateName }, 502);
  }
  await admin.from('whatsapp_inbound_messages').update({ status: 'sent' }).eq('wa_message_id', slot);
  return json({ status: 'sent', template: templateName });
});
