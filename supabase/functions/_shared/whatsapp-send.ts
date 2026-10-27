// Vyact WhatsApp — the ONE guarded path for a proactive template send (W2, v10.42.0).
//
// `whatsapp-notify` (a server job asking; since v10.118.0 never a member) and `whatsapp-dispatch` (the
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
import { env, sendTemplateMessage, gateReason, cleanParam, APP_URL, isTemplateApproved } from './whatsapp.ts';
import { versionToSend, type TemplateDef } from './whatsapp-templates.ts';
import { DEFAULT_PREFS, refusalFor, type WaPrefs } from './whatsapp-prefs.ts';

export interface SendRequest {
  /** The ORIGINAL template; its approved `_v2` goes in its place (`versionToSend`). */
  def: TemplateDef;
  /** The name the caller used (a legacy alias or the template name); part of the dedupe slot. */
  event: string;
  householdId: string;
  toProfileId: string;
  /** Every amount with its currency symbol (`templateMoney`). */
  values: readonly unknown[];
  /** The currency those amounts are in. Without it, a template whose text says ₹ is not sent. */
  currency?: string;
  /** Defaults to the UTC day. Rides on quick-reply payloads as their context. */
  dedupeKey?: string;
  caller: string;
}

export type SendResult =
  | { status: 'sent'; template: string }
  | { status: 'skipped'; reason: string; template: string }
  | { status: 'failed'; reason: 'meta_error' | 'audit_failed'; template: string };

/**
 * W1 (BE-WA-01) — is this profile still a member of this household? Fails closed: a query
 * error or no row is "no". Shared by the webhook (answers) and `guardedSend` (alerts).
 */
export async function isLiveMember(admin: SupabaseClient, householdId: string, profileId: string): Promise<boolean> {
  const { data, error } = await admin.from('memberships').select('id')
    .eq('household_id', householdId).eq('user_id', profileId).limit(1).maybeSingle();
  return !error && !!data;
}

/** A person's preferences, or the defaults when they have never changed one. */
export async function loadPrefs(admin: SupabaseClient, profileId: string): Promise<WaPrefs> {
  const { data } = await admin.from('whatsapp_preferences')
    .select('marketing_opt_in, insights_opt_in, reads_enabled, muted_topics, large_txn_threshold')
    .eq('profile_id', profileId).maybeSingle();
  if (!data) return { ...DEFAULT_PREFS };
  const row = data as Partial<WaPrefs>;
  return {
    marketing_opt_in: !!row.marketing_opt_in,
    insights_opt_in: !!row.insights_opt_in,
    reads_enabled: !!row.reads_enabled,
    muted_topics: Array.isArray(row.muted_topics) ? row.muted_topics : [],
    large_txn_threshold: Number(row.large_txn_threshold ?? DEFAULT_PREFS.large_txn_threshold),
  };
}

/**
 * Templates whose approved text promises a reply we cannot honour yet. Held here,
 * not just left off the approved list, so listing one by mistake still sends nothing.
 * (bill_due_reminder was held here in v10.42.0 until "paid Rent" could approve the
 * occurrence atomically; v10.43.0 released it.)
 */
const HELD: Record<string, string> = {};

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
  // v10.138.0: the redesigned `_v2` once Meta approved it, else the original (INR only where its text says ₹).
  // Consent, mutes and the dedupe slot stay with the original (`def`, `event`).
  const choice = versionToSend(def, req.values.map((v) => cleanParam(v)), req.currency, isTemplateApproved);
  const sendDef = 'def' in choice ? choice.def : def;
  const template = sendDef.name;

  const { data: recipient } = await admin
    .from('whatsapp_identities').select('phone_number, household_id')
    .eq('profile_id', toProfileId).maybeSingle();
  if (!recipient?.phone_number || recipient.household_id !== householdId) {
    return { status: 'skipped', reason: 'recipient_not_linked', template };
  }
  // W1 (audit 2026-10-04, BE-WA-01) — a link only counts while its person is still a
  // member of that household. A removed partner kept receiving bill and spend alerts
  // because nothing re-checked membership (the DB now also deletes the identity when the
  // membership goes; this is the second layer).
  if (!await isLiveMember(admin, householdId, toProfileId)) {
    return { status: 'skipped', reason: 'recipient_not_a_member', template };
  }

  const cleaned = 'values' in choice ? choice.values : req.values.map((v) => cleanParam(v));
  // v10.47.0 — the payload's `result` is rewritten when the send settles; it used to
  // keep the claim's { sent: false } on a message Meta had delivered.
  const payloadWith = (result: Record<string, unknown>) => ({ event, templateName: template, params: cleaned, caller: req.caller, result });
  const audit = (id: string, status: string, result: Record<string, unknown>) =>
    admin.from('whatsapp_inbound_messages').insert({
      wa_message_id: id,
      profile_id: toProfileId,
      household_id: householdId,
      direction: 'outbound',
      // Outbound audit rows are never inbox work: an explicit status keeps them
      // out of the replay sweep, which would otherwise see them as 'pending'.
      status,
      payload: payloadWith(result),
      processed_at: new Date().toISOString(),
    });

  // Refusals that need no Meta call are recorded with a unique id, so they never
  // occupy the dedupe slot a real send will need later.
  const skip = async (reason: string): Promise<SendResult> => {
    const { error } = await audit(`out:${template}:${toProfileId}:${crypto.randomUUID()}`, 'skipped', { sent: false, reason });
    // T2d (BE-WA-09): nothing was sent, so the answer stands; the missing audit row is logged, not hidden.
    if (error) console.error('[whatsapp-send] refusal not audited', { template, reason, error: error.message });
    return { status: 'skipped', reason, template };
  };

  const held = HELD[template];
  if (held) return skip(held);

  const refused = refusalFor(def, await loadPrefs(admin, toProfileId));
  if (refused) return skip(refused);

  if ('skip' in choice) return skip(choice.skip);

  const gated = gateReason(template);
  if (gated) return skip(gated);

  const cap = Number(env('WHATSAPP_DAILY_CAP', '6')) || 6;
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await admin
    .from('whatsapp_inbound_messages')
    .select('wa_message_id', { count: 'exact', head: true })
    .eq('profile_id', toProfileId)
    .eq('direction', 'outbound')
    // W8b (audit BE-WA-11): sends still in flight count too — two dispatchers racing used to both
    // read "under the cap" and both send.
    .in('status', ['sent', 'sending'])
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
    wamid = await sendTemplateMessage(recipient.phone_number, sendDef, cleaned, { appUrl: APP_URL, context: key });
  } catch (e) {
    // W8b (audit BE-WA-11): a send Meta refused frees its dedupe slot — the audit row moves to a unique
    // id — so the next run can send it. It used to keep the slot, and that message was never sent.
    await settleSlot(admin, slot, { wa_message_id: `${slot}:failed:${crypto.randomUUID()}`, status: 'failed',
      last_error: (e as Error)?.message ?? String(e), payload: payloadWith({ sent: false, reason: 'meta_error' }) });
    return { status: 'failed', reason: 'meta_error', template };
  }
  await settleSlot(admin, slot,
    { status: 'sent', provider_message_id: wamid, delivery_status: wamid ? 'accepted' : null, payload: payloadWith({ sent: true }) });
  return { status: 'sent', template };
}

/**
 * T2d (audit BE-WA-09): settle a send's audit row, checking the write and trying it once more. A 'sent' that
 * was never stored left the row 'sending', so "paid X" could not find the reminder; a refused send whose
 * slot was never freed blocked that message for good. A second failure is logged: the message itself was
 * (or was not) sent, and the answer says which.
 */
async function settleSlot(admin: SupabaseClient, slot: string, patch: Record<string, unknown>): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await admin.from('whatsapp_inbound_messages').update(patch).eq('wa_message_id', slot);
    if (!error) return;
    if (attempt === 2) console.error('[whatsapp-send] audit row not settled', { slot, status: patch.status, error: error.message });
  }
}
