// Vyact WhatsApp — the ONE guarded path for a proactive template send (W2, v10.42.0).
//
// `whatsapp-notify` (a member or a server job asking) and `whatsapp-dispatch` (the
// scheduler) both send through `guardedSend`, so every business-initiated message
// meets the same rules, whoever triggered it:
//   • the recipient has a verified identity linked to THIS household;
//   • consent: marketing and insights only with the person's own opt-in, and a
//     muted topic is not sent (bills and large-spend alerts cannot be muted);
//   • the template is enabled and approved (WHATSAPP_OUTBOUND_ENABLED + list);
//   • at most WHATSAPP_DAILY_CAP sends to one person in 24 hours (default 6);
//   • one send per (event, recipient, dedupeKey): the slot is CLAIMED before the
//     Meta call, so two concurrent callers cannot both send;
//   • every outcome leaves an audit row; a sent one carries Meta's message id,
//     which delivery statuses and button taps are matched against.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, sendTemplateMessage, gateReason, cleanParam, APP_URL } from './whatsapp.ts';
import type { TemplateDef } from './whatsapp-templates.ts';
import { DEFAULT_PREFS, refusalFor, type WaPrefs } from './whatsapp-prefs.ts';

export interface SendRequest {
  def: TemplateDef;
  /** The name the caller used (a legacy alias or the template name); part of the dedupe slot. */
  event: string;
  householdId: string;
  toProfileId: string;
  values: readonly unknown[];
  /** Defaults to the UTC day. Rides on quick-reply payloads as their context. */
  dedupeKey?: string;
  caller: string;
}

export type SendResult =
  | { status: 'sent'; template: string }
  | { status: 'skipped'; reason: string; template: string }
  | { status: 'failed'; reason: 'meta_error' | 'audit_failed'; template: string };

/** A person's preferences, or the defaults when they have never changed one. */
export async function loadPrefs(admin: SupabaseClient, profileId: string): Promise<WaPrefs> {
  const { data } = await admin.from('whatsapp_preferences')
    .select('marketing_opt_in, insights_opt_in, muted_topics, large_txn_threshold')
    .eq('profile_id', profileId).maybeSingle();
  if (!data) return { ...DEFAULT_PREFS };
  const row = data as Partial<WaPrefs>;
  return {
    marketing_opt_in: !!row.marketing_opt_in,
    insights_opt_in: !!row.insights_opt_in,
    muted_topics: Array.isArray(row.muted_topics) ? row.muted_topics : [],
    large_txn_threshold: Number(row.large_txn_threshold ?? DEFAULT_PREFS.large_txn_threshold),
  };
}

/**
 * Templates whose approved text promises a reply we cannot honour yet. Held here,
 * not just left off the approved list, so listing one by mistake still sends nothing.
 * bill_due_reminder says "Reply 'paid Rent' to log it": logging without advancing
 * the recurring schedule would make the app ask for the same bill again. W2b.
 */
const HELD: Record<string, string> = { bill_due_reminder: 'held_until_paid_reply_approves' };

const DELIVERY_RANK: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3 };

/**
 * Should a delivery status from Meta replace the one on record? Meta's callbacks can
 * arrive out of order (a "delivered" after the "read"), so a status only moves
 * forward; "failed" is final and always recorded.
 */
export function advancesDelivery(current: string | null | undefined, next: string): boolean {
  if (next === 'failed') return current !== 'failed';
  if (!(next in DELIVERY_RANK)) return false;
  if (!current) return true;
  if (current === 'failed') return false;
  return DELIVERY_RANK[next] > (DELIVERY_RANK[current] ?? -1);
}

export async function guardedSend(admin: SupabaseClient, req: SendRequest): Promise<SendResult> {
  const { def, event, householdId, toProfileId } = req;
  const template = def.name;

  const { data: recipient } = await admin
    .from('whatsapp_identities').select('phone_number, household_id')
    .eq('profile_id', toProfileId).maybeSingle();
  if (!recipient?.phone_number || recipient.household_id !== householdId) {
    return { status: 'skipped', reason: 'recipient_not_linked', template };
  }

  const cleaned = req.values.map((v) => cleanParam(v));
  const audit = (id: string, status: string, result: Record<string, unknown>) =>
    admin.from('whatsapp_inbound_messages').insert({
      wa_message_id: id,
      profile_id: toProfileId,
      household_id: householdId,
      direction: 'outbound',
      // Outbound audit rows are never inbox work: an explicit status keeps them
      // out of the replay sweep, which would otherwise see them as 'pending'.
      status,
      payload: { event, templateName: template, params: cleaned, caller: req.caller, result },
      processed_at: new Date().toISOString(),
    });

  // Refusals that need no Meta call are recorded with a unique id, so they never
  // occupy the dedupe slot a real send will need later.
  const skip = async (reason: string): Promise<SendResult> => {
    await audit(`out:${template}:${toProfileId}:${crypto.randomUUID()}`, 'skipped', { sent: false, reason });
    return { status: 'skipped', reason, template };
  };

  const held = HELD[template];
  if (held) return skip(held);

  const refused = refusalFor(def, await loadPrefs(admin, toProfileId));
  if (refused) return skip(refused);

  const gated = gateReason(template);
  if (gated) return skip(gated);

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

  const key = cleanParam(req.dedupeKey ?? new Date().toISOString().slice(0, 10), 120);
  const slot = `out:${event}:${toProfileId}:${key}`;
  const { error: claimError } = await audit(slot, 'sending', { sent: false });
  if (claimError) {
    return (claimError as { code?: string }).code === '23505'
      ? { status: 'skipped', reason: 'duplicate', template }
      : { status: 'failed', reason: 'audit_failed', template };
  }

  let wamid: string | null;
  try {
    wamid = await sendTemplateMessage(recipient.phone_number, def, cleaned, { appUrl: APP_URL, context: key });
  } catch (e) {
    await admin.from('whatsapp_inbound_messages')
      .update({ status: 'failed', last_error: (e as Error)?.message ?? String(e) })
      .eq('wa_message_id', slot);
    return { status: 'failed', reason: 'meta_error', template };
  }
  await admin.from('whatsapp_inbound_messages')
    .update({ status: 'sent', provider_message_id: wamid, delivery_status: wamid ? 'accepted' : null })
    .eq('wa_message_id', slot);
  return { status: 'sent', template };
}
