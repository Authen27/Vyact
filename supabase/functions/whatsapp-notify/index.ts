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
// Every send then goes through `guardedSend` (_shared/whatsapp-send.ts, v10.42.0),
// the same path the scheduler uses: linked recipient, consent and mutes from the
// person's own preferences, approval gate, daily cap, dedupe slot, audit row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, json, corsHeaders } from '../_shared/whatsapp.ts';
import { templateForEvent } from '../_shared/whatsapp-templates.ts';
import { guardedSend } from '../_shared/whatsapp-send.ts';
import { isServiceCaller } from '../_shared/service-auth.ts';

/** Roles that may send on the household's behalf. Viewers and children read only. */
const WRITE_ROLES = new Set(['owner', 'admin', 'member']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const admin = createClient(env('SUPABASE_URL'), serviceKey);

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const asService = await isServiceCaller(bearer);
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

  const result = await guardedSend(admin, {
    def, event: String(event), householdId, toProfileId, values, dedupeKey,
    caller: asService ? 'service' : String(callerId),
  });
  if (result.status === 'failed') {
    return result.reason === 'audit_failed'
      ? json({ error: 'audit_failed' }, 500)
      : json({ status: 'failed', reason: result.reason, template: result.template }, 502);
  }
  return json(result);
});
