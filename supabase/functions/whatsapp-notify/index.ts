// Vyact WhatsApp — proactive follow-through dispatch (authenticated; deploy WITH JWT).
//
// A single server endpoint other edge functions call to fire a business-initiated
// WhatsApp template (the welcome after a number is linked, and any server job that
// needs one). It is INERT by design: nothing is sent unless BOTH
// `WHATSAPP_OUTBOUND_ENABLED` is on AND the mapped template name is in
// `WHATSAPP_APPROVED_TEMPLATES`. So "activation" is setting two secrets once Meta
// approves — no code change, no accidental sends while templates are in review.
//
// Body: { event, householdId, toProfileId, params?: string[], dedupeKey?: string }
//
// v10.118.0 (T2d, audit BE-WA-07): the SERVICE key only. A signed-in member could call
// it with any template, any text and any button payload, and it went out from Vyact's
// number: a fake "call this number" alert, or a "bill overdue" whose "Already paid"
// approved a real bill. The app never called it. A member-triggered message, if one is
// ever wanted, is a named event whose values the server reads from ids.
//
// Every send goes through `guardedSend` (_shared/whatsapp-send.ts, v10.42.0), the same
// path the scheduler uses: linked recipient, consent and mutes from the person's own
// preferences, approval gate, daily cap, dedupe slot, audit row.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, json, corsHeaders } from '../_shared/whatsapp.ts';
import { templateForEvent } from '../_shared/whatsapp-templates.ts';
import { guardedSend } from '../_shared/whatsapp-send.ts';
import { isServiceCaller } from '../_shared/service-auth.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!(await isServiceCaller(bearer))) return json({ error: 'service_only' }, 403);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

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

  const result = await guardedSend(admin, {
    def, event: String(event), householdId, toProfileId, values, dedupeKey, caller: 'service',
  });
  if (result.status === 'failed') {
    return result.reason === 'audit_failed'
      ? json({ error: 'audit_failed' }, 500)
      : json({ status: 'failed', reason: result.reason, template: result.template }, 502);
  }
  return json(result);
});
