// Vyact WhatsApp webhook — connection + workflow phase.
//
// This is the callback URL registered in the Meta dashboard.
//   GET  → the verification handshake (echoes hub.challenge when the token matches).
//   POST → verifies the X-Hub-Signature-256 HMAC, ACKS 200 immediately, records the
//          inbound event for idempotency/audit, then processes it in the background
//          (EdgeRuntime.waitUntil) so a slow parse/RPC never triggers a Meta retry.
//
// MVP write-only logging: an inbound text → deterministic parser → whatsapp_log_transaction
// RPC → a session-text confirmation. Data queries are hard-blocked (nothing sensitive
// leaves over chat). Interactive/button replies are recorded, not acted on yet.
//
// v10.40.0 — a failure is recorded as one: a ledger error marks the inbox row
// 'failed' and it is replayed (up to 3 attempts) by the sweep — on every delivery,
// and on demand via POST ?mode=sweep with the service key.
//
// Deploy WITHOUT JWT (Meta has no Supabase JWT):
//   supabase functions deploy whatsapp-webhook --no-verify-jwt

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, verifyMetaSignature, sendText, sendInteractiveList, APP_URL, constantTimeEqual } from '../_shared/whatsapp.ts';
import {
  isReceptionistTrigger, isLogTrigger, receptionistList, menuReply, welcomeButtonAction, UNLINKED_GREETING, UNLINKED_OTHER,
} from '../_shared/whatsapp-receptionist.ts';
import { parseWhatsAppMessage, clarifyReply, PAYMENT_MODE_LABEL, type AccountLite, type ParsedTx } from '../_shared/whatsapp-parser.ts';
import {
  isUndo, yesNo, bareAmount, parseCorrection, categoryFitsType, worthAskingAmount, duplicateQuestion, undoReply,
  ASK_AMOUNT, SKIPPED, EXPIRED, UNDO_HINT, DUPLICATE_WINDOW_MINUTES, PENDING_MINUTES, type PendingKind,
} from '../_shared/whatsapp-conversation.ts';
import {
  parsePrefCommand, applyPrefCommand, prefsSummary, buttonReply, buttonQuestion, unsupportedButtonReply, READS_OFFER,
  LATE_TAP_DAYS, LATE_TAP_REPLY, type WaPrefs,
} from '../_shared/whatsapp-prefs.ts';
import { loadPrefs, advancesDelivery } from '../_shared/whatsapp-send.ts';
import { TEMPLATES } from '../_shared/whatsapp-templates.ts';
import {
  parsePaidReply, reminderFromAudit, matchReminders, moneyText, dueDayText, type SentReminder,
} from '../_shared/whatsapp-dispatch-rules.ts';
import { occurrenceRow, advancedDueDate, type ScheduleRow } from '../_shared/recurring.ts';
import { loadHouseholdRows } from '../_shared/agent/householdLoader.ts';
import {
  contextFromRows, answerOnServer, renderForWhatsApp, balancesToCheck, reconcileOnServer, type BalanceToCheck,
} from '../_shared/agent/engine.ts';
import {
  isNameTrigger, isUpdateTrigger, isStopWord, nameListReply, parseNamePicks, nameResultReply, statedAmount, isSame, isSkip,
  balancePrompt, UPDATE_HOW, updateStartReply, reconcileLine, updateSummary, type UnnamedEntry, type NameOutcome, type NamePick,
} from '../_shared/whatsapp-followups.ts';
import { serverModelCall } from '../_shared/agent/assistantCore.ts';

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

interface Profile { id: string; whatsapp_household_id: string | null }

// Audit S1: the verified phone ↔ profile ↔ household binding now lives in the
// server-owned `whatsapp_identities` table (RLS deny-all; service role only).
// A client can no longer self-assert phone_verified_at on `profiles`.
async function lookupIdentity(
  supabase: SupabaseClient, fromPhone: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from('whatsapp_identities')
    .select('profile_id, household_id')
    .eq('phone_number', fromPhone)
    .maybeSingle();
  if (!data) return null;
  return { id: data.profile_id, whatsapp_household_id: data.household_id };
}

/** Meta's report on a message we sent: move the outbound row's status forward. */
async function recordDeliveryStatus(supabase: SupabaseClient, status: any): Promise<void> {
  const wamid = String(status?.id ?? '');
  const next = String(status?.status ?? '');
  if (!wamid || !next) return;
  const { data: row } = await supabase.from('whatsapp_inbound_messages')
    .select('wa_message_id, delivery_status').eq('provider_message_id', wamid).maybeSingle();
  if (!row || !advancesDelivery((row as { delivery_status?: string }).delivery_status, next)) return;
  const error = next === 'failed' ? String(status?.errors?.[0]?.title ?? status?.errors?.[0]?.code ?? 'failed') : undefined;
  await supabase.from('whatsapp_inbound_messages').update({
    delivery_status: next,
    delivery_updated_at: new Date().toISOString(),
    ...(error ? { last_error: `delivery: ${error}` } : {}),
  }).eq('wa_message_id', (row as { wa_message_id: string }).wa_message_id);
}

/**
 * Meta's own "stop promotions" (the user_preferences webhook): marketing consent is
 * withdrawn and the source recorded. A "resume" is NOT taken as consent — turning
 * marketing back on is done in the app, where it is recorded properly.
 */
async function recordMetaOptOut(supabase: SupabaseClient, pref: any): Promise<void> {
  if (pref?.category !== 'marketing_messages' || pref?.value !== 'stop') return;
  const profile = await lookupIdentity(supabase, String(pref?.wa_id ?? '').replace(/[^\d]/g, ''));
  if (!profile) return;
  await supabase.from('whatsapp_preferences').upsert({
    profile_id: profile.id, marketing_opt_in: false, marketing_opt_in_at: null,
    marketing_source: 'meta_opt_out', updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id' });
}

/** Store preferences changed from chat (STOP / START / a Stop button). */
async function savePrefs(supabase: SupabaseClient, profileId: string, before: WaPrefs, after: WaPrefs): Promise<void> {
  await supabase.from('whatsapp_preferences').upsert({
    profile_id: profileId,
    marketing_opt_in: after.marketing_opt_in,
    insights_opt_in: after.insights_opt_in,
    reads_enabled: after.reads_enabled,
    muted_topics: after.muted_topics,
    // Consent withdrawn from chat clears when it was given. Marketing and insights are
    // given in the app; answers (v10.46.0) may be given here, and say so.
    ...(!before.reads_enabled && after.reads_enabled ? { reads_enabled_at: new Date().toISOString(), reads_source: 'whatsapp_keyword' } : {}),
    ...(before.reads_enabled && !after.reads_enabled ? { reads_enabled_at: null, reads_source: null } : {}),
    ...(before.marketing_opt_in && !after.marketing_opt_in ? { marketing_opt_in_at: null, marketing_source: null } : {}),
    ...(before.insights_opt_in && !after.insights_opt_in ? { insights_opt_in_at: null } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'profile_id' });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // 1. Verification handshake (Meta → us).
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === env('WHATSAPP_VERIFY_TOKEN')) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  // v10.40.0 — replay sweep. Called by a scheduler with the SERVICE key (never by
  // Meta, which signs its calls instead). Re-queues failed inbound rows that have
  // retries left, and claims abandoned by a worker that died mid-run.
  if (url.searchParams.get('mode') === 'sweep') {
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!serviceKey || !constantTimeEqual(bearer, serviceKey)) return new Response('Forbidden', { status: 403 });
    const supabase = createClient(env('SUPABASE_URL'), serviceKey);
    const replayed = await sweepInbox(supabase);
    return new Response(JSON.stringify({ status: 'ok', replayed }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Authenticate the payload (constant-time HMAC).
  const rawBody = await req.text();
  if (!(await verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256')))) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 3. ACK first; record EVERY message as a durable pending inbox row, then
  //    process claimed rows in the background (EdgeRuntime.waitUntil).
  //
  //    Audit A4 — the old handler read only entry[0].changes[0].messages[0],
  //    so every later message in the webhook was DROPPED, and it did the DB
  //    work before ACK with no record of pending-vs-processed. Now every
  //    message lands as a pending row BEFORE the ACK, and the claim step is
  //    atomic (pending→claimed only if still pending), so a Meta redelivery
  //    or a concurrent worker never double-processes and a crash after ACK
  //    loses nothing.
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawBody); } catch { /* keep {} */ }

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

  // Collect (message, phone) pairs across ALL entries/changes/messages.
  const incoming: Array<{ message: any; phone: string }> = [];
  for (const entry of (payload as any)?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      for (const message of value?.messages ?? []) {
        const phone = String(message?.from ?? value?.contacts?.[0]?.wa_id ?? '').replace(/[^\d]/g, '');
        if (message?.id) incoming.push({ message, phone });
      }
      // v10.42.0 (W2) — what happened to what we sent, and Meta's own marketing
      // opt-out. Small writes, recorded before the ACK; a failure here must not
      // cost Meta a retry of the whole batch, so each is best-effort.
      for (const status of value?.statuses ?? []) {
        try { await recordDeliveryStatus(supabase, status); } catch (_e) { /* recorded next status */ }
      }
      for (const pref of value?.user_preferences ?? []) {
        try { await recordMetaOptOut(supabase, pref); } catch (_e) { /* Meta also enforces it */ }
      }
    }
  }

  if (incoming.length) {
    // Record each as pending (PK on wa_message_id dedups a Meta redelivery).
    for (const { message, phone } of incoming) {
      const profile = await lookupIdentity(supabase, phone);
      await supabase.from('whatsapp_inbound_messages').upsert({
        wa_message_id: message.id,
        profile_id: profile?.id ?? null,
        household_id: profile?.whatsapp_household_id ?? null,
        direction: 'inbound',
        payload: message,
        status: 'pending',
        processed_at: null,
      }, { onConflict: 'wa_message_id', ignoreDuplicates: true });
    }

    // Opportunistic replay: every real delivery also retries a few failed rows, so a
    // transient outage heals on the next message even before a scheduler is wired.
    const work = drainInbox(supabase, incoming).then(() => sweepInbox(supabase, 5)).then(() => undefined);
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
    else await work;   // local/dev fallback
  }

  return new Response(JSON.stringify({ status: 'ok', recorded: incoming.length }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});

/** Retries a failed inbound row gets before it is left for a human. */
const MAX_ATTEMPTS = 3;
/** A claim older than this belonged to a worker that died; it is re-queued. */
const STALE_CLAIM_MS = 10 * 60_000;

/**
 * Claim-and-process each recorded message. The claim is atomic — status flips
 * pending→claimed only if still pending — so a redelivery recorded above and
 * this drain can never both process the same row. A failure re-marks the row
 * failed with an incremented attempt count (retried by a later sweep); a
 * success marks done.
 */
async function drainInbox(
  supabase: SupabaseClient,
  incoming: Array<{ message: any; phone: string }>,
): Promise<void> {
  for (const { message, phone } of incoming) {
    // Atomic claim. `attempts` comes back with it: v10.40.0 fixed the counter, which
    // read a field that never existed (`message.__attempts`) and so was always 1.
    const { data: claimed } = await supabase
      .from('whatsapp_inbound_messages')
      .update({ status: 'claimed', claimed_at: new Date().toISOString() })
      .eq('wa_message_id', message.id)
      .eq('status', 'pending')
      .select('wa_message_id, attempts');
    if (!claimed || claimed.length === 0) continue;   // already claimed/processed
    const priorAttempts = Number((claimed as any[])[0]?.attempts ?? 0);

    const profile = await lookupIdentity(supabase, phone);
    let outcome: InboundOutcome;
    try {
      outcome = await processInbound(supabase, message, phone, profile, priorAttempts);
    } catch (e) {
      outcome = { status: 'retry', error: (e as Error)?.message ?? String(e) };
    }
    if (outcome.status === 'done') {
      await supabase.from('whatsapp_inbound_messages')
        .update({ status: 'done', processed_at: new Date().toISOString(), last_error: outcome.note ?? null })
        .eq('wa_message_id', message.id);
    } else {
      // v10.40.0 — a failure is RECORDED as one. It used to be marked `done` (the
      // handler swallowed every error), so nothing could ever find it to replay.
      await supabase.from('whatsapp_inbound_messages')
        .update({ status: 'failed', attempts: priorAttempts + 1, last_error: outcome.error })
        .eq('wa_message_id', message.id);
    }
  }
}

/**
 * Re-queue failed rows with retries left, and stale claims, then drain them.
 * Replaying is safe: `whatsapp_log_transaction` claims the message id before it
 * writes, so a row whose transaction DID land comes back `duplicate` and is silent.
 */
async function sweepInbox(supabase: SupabaseClient, limit = 25): Promise<number> {
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data: failed } = await supabase
    .from('whatsapp_inbound_messages')
    .select('wa_message_id, payload')
    .eq('direction', 'inbound')
    .eq('status', 'failed')
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);
  const { data: stale } = await supabase
    .from('whatsapp_inbound_messages')
    .select('wa_message_id, payload')
    .eq('direction', 'inbound')
    .eq('status', 'claimed')
    .lt('claimed_at', staleBefore)
    .limit(limit);
  const rows = [...((failed as any[]) ?? []), ...((stale as any[]) ?? [])];
  const requeued: Array<{ message: any; phone: string }> = [];
  for (const row of rows) {
    const message = row.payload;
    if (!message?.id) continue;
    // Re-queue only if it is still in the state we read (another sweep may have won).
    const { data: flipped } = await supabase
      .from('whatsapp_inbound_messages')
      .update({ status: 'pending' })
      .eq('wa_message_id', row.wa_message_id)
      .in('status', ['failed', 'claimed'])
      .select('wa_message_id');
    if (flipped && (flipped as any[]).length) {
      requeued.push({ message, phone: String(message.from ?? '').replace(/[^\d]/g, '') });
    }
  }
  if (requeued.length) await drainInbox(supabase, requeued);
  return requeued.length;
}

/**
 * What happened to one inbound message.
 *  done  — finished (logged, clarified, refused…). `note` records a reply that could
 *          not be delivered, without replaying a transaction that did land.
 *  retry — the ledger could not be reached; the row is marked failed and replayed.
 */
type InboundOutcome = { status: 'done'; note?: string } | { status: 'retry'; error: string };

/** The sender's local calendar day, for "yesterday". Meta stamps each message in
 *  unix seconds; the offset defaults to IST, the market the ₹ copy is written for. */
function localDay(message: any): Date {
  const tsMs = Number(message?.timestamp) > 0 ? Number(message.timestamp) * 1000 : Date.now();
  const offsetMin = Number(env('VYACT_TZ_OFFSET_MINUTES', '330')) || 0;
  const local = new Date(tsMs + offsetMin * 60_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

const CAT_LABEL: Record<string, string> = {
  food_dining: 'Food & Dining', groceries: 'Groceries',
  rent_mortgage: 'Rent / Mortgage', utilities: 'Utilities', shopping: 'Shopping',
  health: 'Health', entertainment: 'Entertainment', education: 'Education', travel: 'Travel',
  holiday_outstay: 'Holiday & Outstay', electronics_decor: 'Electronics & Decor',
  personal_care: 'Personal Care', repairs_maintenance: 'Repairs & Maintenance',
  gifts_donations: 'Gifts & Donations',
  childcare: 'Childcare', insurance: 'Insurance', loan_emi: 'Loan / EMI', other_expense: 'Other',
  salary: 'Salary', freelance: 'Freelance', gift_bonus: 'Gift / Bonus',
  rental_income: 'Rental income', business_revenue: 'Business revenue', other_income: 'Other income',
};

/**
 * Send a reply without letting a delivery failure replay the message. The ledger
 * work is already done (or deliberately skipped) by the time we reply; retrying the
 * row would only re-run an idempotent RPC and still not deliver. So a failed reply
 * is RECORDED on the row, not retried.
 */
async function reply(to: string, body: string): Promise<string | undefined> {
  if (!to) return 'no_sender_phone';
  try { await sendText(to, body); return undefined; }
  catch (e) { return `reply_failed: ${(e as Error)?.message ?? String(e)}`; }
}

/**
 * The receptionist list, greeted by first name. Fails soft: a menu that cannot be
 * delivered is recorded on the row, never replayed as a ledger write.
 */
async function sendMenu(
  supabase: SupabaseClient, to: string, profileId: string, text: string,
): Promise<InboundOutcome> {
  let firstName: string | null = null;
  try {
    const { data } = await supabase.from('profiles').select('display_name').eq('id', profileId).maybeSingle();
    firstName = String((data as { display_name?: string } | null)?.display_name ?? '').trim().split(/\s+/)[0] || null;
  } catch (_e) { firstName = null; }
  try {
    await sendInteractiveList(to, receptionistList(text, firstName));
    return { status: 'done' };
  } catch (e) {
    return { status: 'done', note: `menu_failed: ${(e as Error)?.message ?? String(e)}` };
  }
}

/**
 * v10.42.0 (W2) — a tap on a template button (not the welcome's). Every tap gets a
 * reply that says what changed, or where to do it when nothing can change from
 * chat (design: "Template button replies"). A tap on a message older than a week
 * is not acted on. A payload we never issued is recorded and left alone.
 */
async function handleTemplateButton(
  supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile,
): Promise<InboundOutcome> {
  const profileId = profile.id;
  const m = /^([a-z0-9_]+):(\d+)(?::(.*))?$/.exec(String(message?.button?.payload ?? ''));
  const def = m ? TEMPLATES[m[1]] : undefined;
  if (!m || !def) return { status: 'done', note: 'ignored_button' };
  const label = def.buttons?.[Number(m[2])]?.text ?? String(message?.button?.text ?? '');

  // The message the tap answers, by Meta's id: how old is it?
  const repliedTo = String(message?.context?.id ?? '');
  if (repliedTo) {
    const { data: sent } = await supabase.from('whatsapp_inbound_messages')
      .select('created_at').eq('provider_message_id', repliedTo).maybeSingle();
    const at = Date.parse(String((sent as { created_at?: string } | null)?.created_at ?? ''));
    if (Number.isFinite(at) && Date.now() - at > LATE_TAP_DAYS * 86_400_000) {
      return { status: 'done', note: await reply(fromPhone, LATE_TAP_REPLY) };
    }
  }

  // v10.47.0 (W6) — the nudges' conversation buttons start the conversation here.
  if (def.name === 'reengagement_nudge' && label === 'Name them here') return startNaming(supabase, message, fromPhone, profile);
  if (def.name === 'balance_stale_nudge' && label === 'Update here') return startUpdate(supabase, fromPhone, profile);

  // v10.46.0 (W5) — a button that asks a question is answered by Pip in the chat when
  // answers are on, instead of linking out (the WhatsApp answer rule).
  const question = buttonQuestion(def.name, label, m[3] ?? '');
  if (question) {
    // The answer rule both ways: answered here, or answers offered here. Never a link.
    if (await readsEnabled(supabase, profileId)) return answerQuestion(supabase, fromPhone, profile, question);
    return offerAnswers(supabase, fromPhone, profile, question);
  }

  // v10.46.0 — "Already paid" on an overdue reminder approves THAT occurrence (its
  // payload context is `bill:<schedule>:<date>`), through the same atomic path as
  // "paid Rent": posted with the app's row and the schedule moved on.
  if (def.name === 'bill_overdue_reminder' && label === 'Already paid') {
    const occ = /^bill:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/i.exec(m[3] ?? '');
    if (!occ) return { status: 'done', note: await reply(fromPhone, unsupportedButtonReply(APP_URL)) };
    const outcome = await approveFromReply(supabase, message, fromPhone, profile, { name: '' }, 0,
      { scheduleId: occ[1], occurrence: occ[2], replyWord: '' });
    return outcome ?? { status: 'done' };
  }

  const answer = buttonReply(def.name, label, APP_URL);
  if (!answer) return { status: 'done', note: await reply(fromPhone, unsupportedButtonReply(APP_URL)) ?? `unsupported_button:${def.name}:${label}` };
  if (answer.mute) {
    const before = await loadPrefs(supabase, profileId);
    const after = { ...before, muted_topics: [...new Set([...before.muted_topics, answer.mute])].sort() };
    try { await savePrefs(supabase, profileId, before, after); }
    catch (e) { return { status: 'retry', error: `prefs: ${(e as Error)?.message ?? String(e)}` }; }
  }
  return { status: 'done', note: await reply(fromPhone, answer.reply) };
}

/** Background handler: parse → log → confirm (or clarify / hard-block / notice). */
async function processInbound(
  supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile | null,
  priorAttempts = 0,
): Promise<InboundOutcome> {
  const text: string | undefined = message?.text?.body;

  // Unregistered / unlinked sender: a greeting gets who we are and how to link;
  // anything else a one-line reminder. Never the menu, never a record, never data.
  if (!profile || !profile.whatsapp_household_id) {
    const note = await reply(fromPhone, text && isReceptionistTrigger(text) ? UNLINKED_GREETING : UNLINKED_OTHER);
    return { status: 'done', note };
  }
  const householdId = profile.whatsapp_household_id;

  // v10.41.0 — the receptionist. A tapped menu row gets its reply…
  const rowId: string | undefined = message?.interactive?.list_reply?.id;
  if (message?.type === 'interactive' && rowId) {
    // v10.45.0 (W4) — with answers on, a Check row asks Ask Vyact instead of linking out.
    const checkQuestion = CHECK_QUESTIONS[rowId];
    if (checkQuestion) {
      if (await readsEnabled(supabase, profile.id)) return answerQuestion(supabase, fromPhone, profile, checkQuestion);
      return offerAnswers(supabase, fromPhone, profile, checkQuestion);   // never a link as the answer
    }
    // v10.42.0 — "Messages I send you" reads this person's own preferences.
    const body = rowId === 'menu:messages'
      ? prefsSummary(await loadPrefs(supabase, profile.id), APP_URL)
      : menuReply(rowId, APP_URL);
    return { status: 'done', note: body ? await reply(fromPhone, body) : `unknown_menu_row:${rowId}` };
  }
  // A tap on a template's quick-reply button arrives as a `button` message whose
  // payload is `template:index:context` (set when we sent it).
  if (message?.type === 'button') {
    const action = welcomeButtonAction(message?.button?.payload, message?.button?.text);
    if (action === 'menu') return sendMenu(supabase, fromPhone, profile.id, 'menu');
    if (action) return { status: 'done', note: await reply(fromPhone, menuReply(action, APP_URL) ?? '') };
    return handleTemplateButton(supabase, message, fromPhone, profile);
  }
  if (!text) return { status: 'done', note: `ignored_${String(message?.type ?? 'unknown')}` };

  // v10.42.0 (W2) — STOP, STOP <TOPIC>, START <TOPIC>. Before anything else reads
  // the text: "stop" must never be parsed as a spend or answered with the menu.
  const command = parsePrefCommand(text);
  if (command) {
    const before = await loadPrefs(supabase, profile.id);
    const { prefs: after, reply: body } = applyPrefCommand(before, command);
    try { await savePrefs(supabase, profile.id, before, after); }
    catch (e) { return { status: 'retry', error: `prefs: ${(e as Error)?.message ?? String(e)}` }; }
    const said = await reply(fromPhone, body);
    // v10.46.0 — ANSWERS ON after an offer answers the question that prompted it.
    if (command.kind === 'answers_on') {
      const offer = await openPending(supabase, profile.id);
      if (offer?.kind === 'reads_offer' && typeof offer.payload?.question === 'string'
          && Date.parse(offer.expires_at) >= Date.now()) {
        await resolvePending(supabase, offer.id);
        return answerQuestion(supabase, fromPhone, profile, offer.payload.question);
      }
    }
    return { status: 'done', note: said };
  }

  // v10.44.0 (W3) — UNDO and a correction act on the entry WhatsApp just logged.
  if (isUndo(text)) {
    const { data, error } = await supabase.rpc('whatsapp_undo_last', {
      p_profile_id: profile.id, p_household_id: householdId, p_wa_message_id: message.id,
    });
    if (error) return retryOrGiveUp(fromPhone, priorAttempts, `undo: ${error.message}`);
    const r = (data ?? {}) as { status?: string; amount?: number; currency?: string; category_id?: string };
    if (r.status === 'duplicate') return { status: 'done' };
    const what = r.amount != null ? `${moneyOf(r.amount, r.currency ?? '')}${r.category_id ? ` · ${CAT_LABEL[r.category_id] ?? r.category_id}` : ''}` : undefined;
    return { status: 'done', note: await reply(fromPhone, blockedReply(r.status) ?? undoReply(r.status ?? '', what)) };
  }
  const corrected = parseCorrection(text);
  if (corrected) return correctLast(supabase, message, fromPhone, profile, corrected, priorAttempts);

  // An open question (a missing amount, a possible duplicate) takes the answer.
  // Anything else drops the question and is read as a new message.
  const pending = await openPending(supabase, profile.id);
  if (pending) {
    await resolvePending(supabase, pending.id);
    const expired = Date.parse(pending.expires_at) < Date.now();
    // v10.45.0 (W4) — "1", "2" or "3" after an answer asks that follow-up.
    if (pending.kind === 'chips') {
      const pick = /^\s*([1-3])\s*[.)]?\s*$/.exec(text)?.[1];
      const prompt = pick ? (pending.payload?.prompts ?? [])[Number(pick) - 1] : undefined;
      if (pick && expired) return { status: 'done', note: await reply(fromPhone, 'That list has expired. Ask again, or send MENU.') };
      if (prompt) return answerQuestion(supabase, fromPhone, profile, prompt, pending.payload?.allowedFigures ?? []);
    }
    // v10.47.0 (W6) — the two follow-up conversations. Each returns null when the
    // message is not an answer to it, and the message is then read as a new one.
    if (pending.kind === 'name_entries') {
      const outcome = await continueNaming(supabase, message, fromPhone, profile, pending, text, expired, priorAttempts);
      if (outcome) return outcome;
    }
    if (pending.kind === 'balance_update') {
      const outcome = await continueUpdate(supabase, message, fromPhone, profile, pending, text, expired, priorAttempts);
      if (outcome) return outcome;
    }
    // A chips list takes only its numbers; anything else is a new message.
    const answer = pending.kind === 'chips' || pending.kind === 'reads_offer'
      || pending.kind === 'name_entries' || pending.kind === 'balance_update' ? null
      : pending.kind === 'missing_amount' ? bareAmount(text) : yesNo(text);
    if (answer !== null && expired) return { status: 'done', note: await reply(fromPhone, EXPIRED) };
    if (answer !== null && pending.kind === 'missing_amount') {
      const again = parseWhatsAppMessage(`${answer} ${pending.payload.text}`, pending.payload.accounts ?? [],
        pending.payload.baseCurrency ?? 'INR', localDay(message));
      if (again.ok) return logParsed(supabase, message, fromPhone, profile, again.tx, priorAttempts, { skipDuplicateCheck: true });
    }
    if (answer === 'no') return { status: 'done', note: await reply(fromPhone, SKIPPED) };
    if (answer === 'yes' && pending.kind === 'duplicate_check') {
      return logParsed(supabase, message, fromPhone, profile, pending.payload.tx, priorAttempts, { skipDuplicateCheck: true });
    }
  }

  // …and a greeting, MENU or HELP opens the action list.
  if (isReceptionistTrigger(text)) return sendMenu(supabase, fromPhone, profile.id, text);
  // v10.46.0 — "LOG" (the re-engagement nudge's "Reply LOG") starts today's entry.
  if (isLogTrigger(text)) return { status: 'done', note: await reply(fromPhone, menuReply('menu:log_spend', APP_URL) ?? '') };
  // v10.47.0 (W6) — "Name them here" and "Reply UPDATE", typed.
  if (isNameTrigger(text)) return startNaming(supabase, message, fromPhone, profile);
  if (isUpdateTrigger(text)) return startUpdate(supabase, fromPhone, profile);

  // v10.43.0 (W2b) — "paid Rent" answering a bill reminder approves that bill.
  // Only when a reminder with that name was sent to this person in the last week;
  // otherwise "paid 450 lunch" is an ordinary entry and falls through to the parser.
  const paid = parsePaidReply(text);
  if (paid) {
    const outcome = await approveFromReply(supabase, message, fromPhone, profile, paid, priorAttempts);
    if (outcome) return outcome;
  }

  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('name, kind, currency')
    .eq('household_id', householdId)
    .eq('is_archived', false);
  // Without the accounts the parser cannot place the money, and guessing "cash"
  // would move the wrong balance. The ledger is unreachable: replay later.
  if (accountsError) return retryOrGiveUp(fromPhone, priorAttempts, `accounts: ${accountsError.message}`);
  // v10.26.0 (R4) — investments live in Net Worth as assets. Offer their names
  // to the parser so "invested 5000 in <fund>" resolves; the RPC matches the
  // alias against assets for an investment, never against accounts.
  // A READ for parser context only: if it fails, the message still logs — the
  // RPC resolves a household's only investment on its own, and every other
  // type never needs it. Nothing is written or dropped here.
  let investmentAssets: { name: string }[] = [];
  try {
    const { data } = await supabase
      .from('assets')
      .select('name')
      .eq('household_id', householdId)
      .eq('type', 'investment')
      .is('deleted_at', null);
    investmentAssets = (data as { name: string }[] | null) ?? [];
  } catch (_e) {
    investmentAssets = [];
  }
  const accountList: AccountLite[] = [
    ...(accounts ?? []).map((a: any) => ({ name: a.name, kind: a.kind })),
    ...(investmentAssets ?? []).map((a: any) => ({ name: a.name, kind: 'investment' })),
  ];
  const baseCurrency: string = (accounts as any)?.[0]?.currency ?? 'USD';

  const parsed = parseWhatsAppMessage(text, accountList, baseCurrency, localDay(message));
  if (!parsed.ok) {
    // v10.44.0 (W3) — "groceries hdfc" names what it was for: ask for the amount
    // and keep the rest, rather than asking for the whole line again.
    // v10.45.0 (W4) — a question is answered by Ask Vyact, but only for someone who
    // turned on "Answer my questions here" (figures reach the lock screen).
    if (parsed.reason === 'query') {
      if (await readsEnabled(supabase, profile.id)) return answerQuestion(supabase, fromPhone, profile, text);
      return offerAnswers(supabase, fromPhone, profile, text);
    }
    if (parsed.reason === 'no_amount' && worthAskingAmount(text)) {
      await askPending(supabase, profile.id, householdId, 'missing_amount', { text, accounts: accountList, baseCurrency });
      return { status: 'done', note: await reply(fromPhone, ASK_AMOUNT) };
    }
    return { status: 'done', note: await reply(fromPhone, clarifyReply(parsed.reason, `${APP_URL}/dashboard`)) };
  }
  return logParsed(supabase, message, fromPhone, profile, parsed.tx, priorAttempts);
}

/**
 * Log a parsed entry through `whatsapp_log_transaction` and confirm it. Unless the
 * person already answered a question about it, an expense or income matching one
 * logged in the last two hours (same amount, type and category) is asked about
 * first: nothing is written until they reply.
 */
async function logParsed(
  supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile, tx: ParsedTx,
  priorAttempts: number, opts: { skipDuplicateCheck?: boolean } = {},
): Promise<InboundOutcome> {
  const householdId = profile.whatsapp_household_id!;
  if (!opts.skipDuplicateCheck && (tx.transaction_type === 'expense' || tx.transaction_type === 'income')) {
    const since = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60_000).toISOString();
    const { data: twins, error: twinError } = await supabase.from('transactions').select('created_at')
      .eq('household_id', householdId).is('deleted_at', null).eq('type', tx.transaction_type)
      .eq('amount', tx.amount).eq('category', tx.category_id).gt('created_at', since)
      .order('created_at', { ascending: false }).limit(1);
    if (twinError) return retryOrGiveUp(fromPhone, priorAttempts, `duplicates: ${twinError.message}`);
    const twin = (twins as { created_at: string }[] | null)?.[0];
    if (twin) {
      await askPending(supabase, profile.id, householdId, 'duplicate_check', { tx });
      const minutes = Math.max(0, Math.round((Date.now() - Date.parse(twin.created_at)) / 60_000));
      return { status: 'done', note: await reply(fromPhone,
        duplicateQuestion(moneyOf(tx.amount, tx.currency), CAT_LABEL[tx.category_id ?? ''] ?? '', minutes)) };
    }
  }

  const { data: result, error } = await supabase.rpc('whatsapp_log_transaction', {
    p_profile_id: profile.id,
    p_household_id: householdId,
    p_amount: tx.amount,
    p_currency: tx.currency,
    p_txn_type: tx.transaction_type,
    p_category_id: tx.category_id,
    p_account_alias: tx.account_alias,
    p_to_account_alias: tx.to_account_alias,
    p_wa_message_id: message.id,
    p_description: tx.description,
    // v10.25.0 — stored only if the paying account uses this mode.
    p_payment_mode: tx.payment_mode,
    // v10.40.0 — a date the message stated ("yesterday", "15/09/2026"). The RPC
    // has accepted p_date since v10.20; the parser used to drop it, so every
    // WhatsApp entry was dated today.
    ...(tx.date ? { p_date: tx.date } : {}),
  });

  if (error) return retryOrGiveUp(fromPhone, priorAttempts, `rpc: ${error.message}`);
  const r = result as any;
  let body: string | null;
  if (r?.status === 'success') {
    body = confirmation(r, tx.date);
  } else if (r?.status === 'duplicate') {
    body = null;   // already handled (or a replay of one that landed) — stay silent
  } else if (r?.reason === 'not_a_member' || r?.reason === 'read_only_member') {
    // Audit S1: the RPC revalidates membership + write role on EVERY inbound
    // operation, so a revoked member (or a viewer) hears about it rather than
    // silently logging nothing.
    body = 'This number is no longer able to log to that household. Relink it in Settings → WhatsApp, or ask the household owner about your access.';
  } else if (r?.reason === 'no_investment_asset') {
    body = 'Which investment is this for? Name it as it appears in Net Worth, e.g. `invested 5000 in Nifty fund`.';
  } else if (r?.reason === 'no_destination_account' || r?.reason === 'same_account') {
    body = 'Which account should this move to? e.g. `moved 10000 to icici`.';
  } else {
    body = "I couldn't place that in an account. Try naming one, e.g. `850 groceries hdfc`.";
  }
  return { status: 'done', note: body ? await reply(fromPhone, body) : undefined };
}

/**
 * The ledger could not be reached. The user is told ONCE, on the first failure, that
 * the entry is queued (so they do not resend it and double-log). Only if every retry
 * fails are they asked to send it again.
 */
/**
 * "paid <name>" → the bill reminder it answers → `whatsapp_approve_recurring`, which
 * posts the due occurrence and moves the schedule on in one transaction, exactly as
 * Approve does in the app. Null when no reminder of that name was sent (the text is
 * then an ordinary entry). Never logs a plain transaction for a bill: that would
 * leave the bill due and the app would ask for it again.
 */
async function approveFromReply(
  supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile,
  paid: { name: string; amount?: number }, priorAttempts: number,
  /** v10.46.0 — the occurrence an "Already paid" tap names (its payload), skipping the name lookup. */
  direct?: SentReminder,
): Promise<InboundOutcome | null> {
  const householdId = profile.whatsapp_household_id!;
  let matches: SentReminder[];
  if (direct) {
    matches = [direct];
  } else {
    const since = new Date(Date.now() - LATE_TAP_DAYS * 86_400_000).toISOString();
    // Both reminders count: due today (bill_due_reminder) and overdue (bill_overdue_reminder).
    const { data: sentRows, error: sentError } = await supabase.from('whatsapp_inbound_messages')
      .select('wa_message_id, payload')
      .eq('profile_id', profile.id).eq('direction', 'outbound').eq('status', 'sent')
      .like('wa_message_id', `out:bill_%:${profile.id}:bill:%`)
      .gt('created_at', since)
      .order('created_at', { ascending: false });
    if (sentError) return retryOrGiveUp(fromPhone, priorAttempts, `reminders: ${sentError.message}`);
    const sent = ((sentRows ?? []) as any[]).map(reminderFromAudit).filter(Boolean) as SentReminder[];
    matches = matchReminders(paid.name, sent);
    if (!matches.length) return null;
    if (matches.length > 1) {
      return { status: 'done', note: await reply(fromPhone, `You have more than one bill called ${paid.name}, so I haven't guessed. Approve the right one in the app: ${APP_URL}/recurring`) };
    }
  }

  const { data: schedule, error: sError } = await supabase.from('recurring_schedules')
    .select('id, household_id, frequency, start_date, next_due_date, last_generated, day_of_month, weekday, auto_confirm, active, owner_member_id, txn_template')
    .eq('id', matches[0].scheduleId).eq('household_id', householdId).is('deleted_at', null).maybeSingle();
  if (sError) return retryOrGiveUp(fromPhone, priorAttempts, `schedule: ${sError.message}`);
  if (!schedule) {
    return { status: 'done', note: await reply(fromPhone, `I can't find that bill any more. It may have been changed in the app: ${APP_URL}/recurring`) };
  }
  const s = schedule as ScheduleRow;
  const template = s.txn_template ?? {};
  const amountText = moneyText(Number(template.amount), String(template.currency ?? 'INR').trim());
  if (paid.amount !== undefined && Math.abs(paid.amount - Number(template.amount)) > 0.005) {
    return { status: 'done', note: await reply(fromPhone,
      `${s.txn_template.description} is scheduled at ${amountText}, so I haven't logged ${paid.amount}. Reply "paid ${matches[0].replyWord}" to log ${amountText}, or change the amount in the app: ${APP_URL}/recurring`) };
  }

  const today = localDay(message).toISOString().slice(0, 10);
  const { data, error } = await supabase.rpc('whatsapp_approve_recurring', {
    p_profile_id: profile.id,
    p_household_id: householdId,
    p_schedule_id: s.id,
    p_occurrence: matches[0].occurrence,
    p_today: today,
    p_next_due: advancedDueDate(s),
    p_row: occurrenceRow(s),
    p_wa_message_id: message.id,
  });
  if (error) return retryOrGiveUp(fromPhone, priorAttempts, `approve: ${error.message}`);
  const r = (data ?? {}) as { status?: string; reason?: string; already_posted?: boolean; next_due_date?: string };
  const name = String(template.description ?? matches[0].replyWord);
  const on = dueDayText(matches[0].occurrence);
  let body: string | undefined;
  switch (r.status) {
    case 'duplicate': return { status: 'done' };   // a replay of a message that already landed stays silent
    case 'success':
      body = r.already_posted
        ? `${name} for ${on} was already in Vyact, so nothing was added twice. The schedule has moved on.`
        : `Logged: ${name}, ${amountText}, for ${on}, as scheduled.`;
      if (r.next_due_date) body += ` The next one is due ${dueDayText(r.next_due_date)}.`;
      break;
    case 'already_done':
      body = `${name} for ${on} was already approved in the app, so I've left it.`;
      break;
    default: {
      const why: Record<string, string> = {
        not_due_yet: `${name} isn't due until ${on}. You can approve it on the day.`,
        approve_in_app: `${name} has to be approved in the app: ${APP_URL}/recurring`,
        read_only_member: 'You can view this household but not record in it.',
        not_a_member: "This number isn't a member of that household any more.",
      };
      body = why[r.reason ?? ''] ?? `I couldn't approve ${name} from here. You can do it in the app: ${APP_URL}/recurring`;
    }
  }
  return { status: 'done', note: await reply(fromPhone, body) };
}

async function retryOrGiveUp(fromPhone: string, priorAttempts: number, error: string): Promise<InboundOutcome> {
  const attempt = priorAttempts + 1;
  if (attempt === 1) {
    await reply(fromPhone, "Your data is safe. I couldn't reach the ledger just now, so that entry is queued — it'll post by itself. Nothing for you to redo.");
  } else if (attempt >= MAX_ATTEMPTS) {
    await reply(fromPhone, "That entry still hasn't gone through after several tries, so I've stopped retrying. Please send it again, or add it in the app.");
  }
  return { status: 'retry', error };
}

/** Session-text confirmation (within the 24h window — no template needed). */
function confirmation(r: any, statedDate: string | null = null): string {
  // v10.41.0 — "₹450", not "450 INR" (design: receptionist canvas). Indian digit
  // grouping for INR; an unknown currency keeps its code.
  const amt = moneyOf(r.amount, r.currency);
  const cat = r.category_id ? ` · ${CAT_LABEL[r.category_id] ?? r.category_id}` : '';
  let where = '';
  if (r.type === 'income') where = r.to_account_name ? ` to ${r.to_account_name}` : '';
  else if (r.type === 'transfer' || r.type === 'investment') {
    where = r.account_name && r.to_account_name ? ` ${r.account_name} → ${r.to_account_name}` : '';
  } else where = r.account_name ? ` from ${r.account_name}` : '';
  // The RPC echoes the mode only when it was actually stored.
  const mode = r.payment_mode ? ` via ${PAYMENT_MODE_LABEL[r.payment_mode] ?? r.payment_mode}` : '';
  // v10.40.0 — say which day it was filed under when the message named one, so a
  // backdated entry is never mistaken for today's (capture_backdated_notice).
  const when = statedDate ? ` on ${statedDate}` : '';
  // v10.44.0 (W3) — the undo window is said once, where it applies.
  return `✅ Logged ${amt}${cat}${where}${mode}${when}. ${UNDO_HINT}`;
}

/** "₹450" — Indian grouping for INR; an unknown currency keeps its code. */
function moneyOf(amount: unknown, currency: string): string {
  const SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const n = Number(amount);
  const grouped = Number.isFinite(n)
    ? n.toLocaleString(currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })
    : String(amount);
  return SYMBOL[currency] ? `${SYMBOL[currency]}${grouped}` : `${grouped} ${currency}`;
}

/** The reply when the sender may not write here any more, or null. */
function blockedReply(status: string | undefined): string | null {
  if (status === 'not_a_member' || status === 'read_only_member') {
    return 'This number is no longer able to log to that household. Relink it in Settings → WhatsApp, or ask the household owner about your access.';
  }
  return null;
}

/** "no, that was groceries" → re-categorise the entry WhatsApp just logged (same type only). */
async function correctLast(
  supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile, category: string, priorAttempts: number,
): Promise<InboundOutcome> {
  const householdId = profile.whatsapp_household_id!;
  // The entry's type decides which categories fit (categories are type-scoped).
  const { data: last } = await supabase.from('whatsapp_inbound_messages').select('payload')
    .eq('direction', 'inbound').eq('profile_id', profile.id).neq('wa_message_id', message.id)
    .order('processed_at', { ascending: false }).limit(1).maybeSingle();
  const type = String((last as { payload?: { parsed?: { type?: string } } } | null)?.payload?.parsed?.type ?? '');
  if (type && !categoryFitsType(category, type)) {
    const label = CAT_LABEL[category] ?? category;
    return { status: 'done', note: await reply(fromPhone, `${label} isn't a category for ${type === 'income' ? 'income' : 'a spend'}, so I've left it. You can change it in the app.`) };
  }
  const { data, error } = await supabase.rpc('whatsapp_correct_last', {
    p_profile_id: profile.id, p_household_id: householdId, p_category: category, p_wa_message_id: message.id,
  });
  if (error) return retryOrGiveUp(fromPhone, priorAttempts, `correct: ${error.message}`);
  const r = (data ?? {}) as { status?: string; amount?: number; currency?: string };
  if (r.status === 'duplicate') return { status: 'done' };
  const REASON: Record<string, string> = {
    corrected: `Changed. ${moneyOf(r.amount, r.currency ?? '')} is now under ${CAT_LABEL[category] ?? category}.`,
    no_category: 'That entry is a transfer, so it has no category to change.',
    too_late: "That's past the 15 minutes, so I've left it. You can change it in the app.",
    edited: "That entry has been changed in the app since, so I've left it.",
  };
  const body = blockedReply(r.status) ?? REASON[r.status ?? ''] ?? "There's nothing I logged in the last 15 minutes to change.";
  return { status: 'done', note: await reply(fromPhone, body) };
}

// ── v10.47.0 (W6) — follow-up conversations ────────────────────────────────

/** Both conversations write, so a viewer is told before a list is shown. */
async function writeBlocked(supabase: SupabaseClient, profile: Profile): Promise<string | null> {
  const { data } = await supabase.from('memberships').select('role')
    .eq('household_id', profile.whatsapp_household_id!).eq('user_id', profile.id).limit(1).maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  return blockedReply(!role ? 'not_a_member' : role === 'viewer' ? 'read_only_member' : undefined);
}

/**
 * "Name them here": this month's expenses still in Other, biggest first, up to five.
 * Each line is amount · day · account — never the description.
 */
async function startNaming(supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile): Promise<InboundOutcome> {
  const blocked = await writeBlocked(supabase, profile);
  if (blocked) return { status: 'done', note: await reply(fromPhone, blocked) };
  const monthStart = `${localDay(message).toISOString().slice(0, 7)}-01`;
  const { data, error } = await supabase.rpc('whatsapp_unnamed_expenses', {
    p_profile_id: profile.id, p_household_id: profile.whatsapp_household_id, p_from: monthStart, p_limit: 5,
  });
  if (error) return { status: 'done', note: await reply(fromPhone, "I couldn't reach your entries just now. Please try again in a minute.") };
  const entries: UnnamedEntry[] = ((data ?? []) as { id: string; amount: number | string; currency: string; date: string; account_name: string | null }[])
    .map((r, i) => ({ n: i + 1, id: r.id, amount: Number(r.amount), currency: r.currency, date: String(r.date).slice(0, 10), account: r.account_name ?? null }));
  if (entries.length) await askPending(supabase, profile.id, profile.whatsapp_household_id!, 'name_entries', { entries });
  return { status: 'done', note: await reply(fromPhone, nameListReply(entries)) };
}

/** "1 groceries", "2 travel, 3 dining", DONE. Null when the message is not an answer. */
async function continueNaming(
  supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile, pending: PendingTurn,
  text: string, expired: boolean, priorAttempts: number,
): Promise<InboundOutcome | null> {
  const entries: UnnamedEntry[] = pending.payload?.entries ?? [];
  const picks = isStopWord(text) ? 'done' as const : parseNamePicks(text);
  if (!picks) return null;
  if (expired) return { status: 'done', note: await reply(fromPhone, 'That list has expired. Send NAME THEM to see it again.') };
  if (picks === 'done') {
    const body = entries.length
      ? `Stopped. ${entries.length === 1 ? 'One is' : `${entries.length} are`} still in Other; send NAME THEM any time.`
      : 'Stopped.';
    return { status: 'done', note: await reply(fromPhone, body) };
  }
  const byN = new Map(entries.map((e) => [e.n, e]));
  const outcomes: NameOutcome[] = [];
  const problems: NamePick[] = [];
  const items: { id: string; category: string; n: number }[] = [];
  for (const p of picks) {
    if (!('category' in p)) { problems.push(p); continue; }
    const e = byN.get(p.n);
    if (!e) outcomes.push({ n: p.n, status: 'no_such' });
    else items.push({ id: e.id, category: p.category, n: p.n });
  }
  const done = new Set<number>();
  if (items.length) {
    const { data, error } = await supabase.rpc('whatsapp_name_entries', {
      p_profile_id: profile.id, p_household_id: profile.whatsapp_household_id,
      p_wa_message_id: message.id, p_items: items.map(({ id, category }) => ({ id, category })),
    });
    if (error) return retryOrGiveUp(fromPhone, priorAttempts, `name: ${error.message}`);
    const r = (data ?? {}) as { status?: string; results?: { id: string; status: string; category: string }[] };
    if (r.status === 'duplicate') return { status: 'done' };
    const blocked = blockedReply(r.status);
    if (blocked) return { status: 'done', note: await reply(fromPhone, blocked) };
    const byId = new Map((r.results ?? []).map((x) => [x.id, x]));
    for (const it of items) {
      const x = byId.get(it.id);
      const status = x?.status ?? 'gone';
      outcomes.push({ n: it.n, status, category: it.category });
      if (status !== 'not_expense') done.add(it.n);   // named, or no longer nameable here
    }
  }
  const left = entries.filter((e) => !done.has(e.n));
  if (left.length) await askPending(supabase, profile.id, profile.whatsapp_household_id!, 'name_entries', { entries: left });
  return { status: 'done', note: await reply(fromPhone, nameResultReply(outcomes, problems, left)) };
}

interface UpdateState { queue: string[]; index: number; total: number; checked: number; net: number; skipped: string[]; currency: string }

/**
 * "Reply UPDATE": stale bank, card and cash balances, one at a time, oldest check
 * first — the list and the figures are the app's (balancesToCheck in the engine).
 */
async function startUpdate(supabase: SupabaseClient, fromPhone: string, profile: Profile): Promise<InboundOutcome> {
  const blocked = await writeBlocked(supabase, profile);
  if (blocked) return { status: 'done', note: await reply(fromPhone, blocked) };
  let items: BalanceToCheck[]; let currency = 'INR';
  try {
    const rows = await loadHouseholdRows(supabase, profile.id, profile.whatsapp_household_id!);
    currency = String(rows.household?.base_currency ?? 'INR');
    items = balancesToCheck(rows, Date.now());
  } catch (e) {
    console.error('[whatsapp-webhook] update list failed', (e as Error)?.message);
    return { status: 'done', note: await reply(fromPhone, "I couldn't reach your balances just now. Please try again in a minute.") };
  }
  if (!items.length) return { status: 'done', note: await reply(fromPhone, updateStartReply(0)) };
  const state: UpdateState = { queue: items.map((i) => i.id), index: 0, total: items.length, checked: 0, net: 0, skipped: [], currency };
  await askPending(supabase, profile.id, profile.whatsapp_household_id!, 'balance_update', state as unknown as Record<string, unknown>);
  return { status: 'done', note: await reply(fromPhone,
    `${updateStartReply(items.length)}\n\n${balancePrompt(items[0], 0, items.length, currency, Date.now())}\n\n${UPDATE_HOW}`) };
}

/**
 * An amount, SAME, SKIP or DONE for the balance being asked about. The correction is
 * the app's reconcile (reconcileOnServer), applied by `whatsapp_reconcile_account`:
 * an offset + dated log, never a transaction. Null when the message is not an answer.
 */
async function continueUpdate(
  supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile, pending: PendingTurn,
  text: string, expired: boolean, priorAttempts: number,
): Promise<InboundOutcome | null> {
  const same = isSame(text); const skip = isSkip(text); const stop = isStopWord(text);
  const amount = statedAmount(text);
  if (!same && !skip && !stop && amount === null) return null;
  if (expired) return { status: 'done', note: await reply(fromPhone, 'That update has expired. Send UPDATE to start again.') };
  const st = pending.payload as UpdateState;
  if (stop) return { status: 'done', note: await reply(fromPhone, updateSummary(st.checked, st.skipped, st.net, st.currency)) };

  const householdId = profile.whatsapp_household_id!;
  let rows: Awaited<ReturnType<typeof loadHouseholdRows>>;
  try { rows = await loadHouseholdRows(supabase, profile.id, householdId); }
  catch (e) { return retryOrGiveUp(fromPhone, priorAttempts, `update rows: ${(e as Error)?.message}`); }
  const accountId = st.queue[st.index];
  let line = '';
  const now = new Date();
  if (skip) {
    const name = (balancesToCheck(rows, now.getTime()).find((b) => b.id === accountId)?.name) ?? 'That one';
    st.skipped.push(name);
  } else {
    const plan = reconcileOnServer(rows, accountId, same ? 'same' : amount!, now.toISOString());
    if (!plan) {
      line = "That account isn't there any more, so I've moved on.";
    } else {
      const { data, error } = await supabase.rpc('whatsapp_reconcile_account', {
        p_profile_id: profile.id, p_household_id: householdId, p_wa_message_id: message.id,
        p_account_id: plan.accountId, p_expected_offset: plan.expectedOffset, p_offset: plan.offset,
        p_log: plan.log, p_at: plan.at, p_bridge: plan.bridge,
      });
      if (error) return retryOrGiveUp(fromPhone, priorAttempts, `reconcile: ${error.message}`);
      const r = (data ?? {}) as { status?: string };
      if (r.status === 'duplicate') return { status: 'done' };
      const blocked = blockedReply(r.status);
      if (blocked) return { status: 'done', note: await reply(fromPhone, blocked) };
      if (r.status === 'reconciled') {
        line = reconcileLine(plan, st.currency);
        st.checked += 1;
        st.net = Math.round((st.net + plan.delta) * 100) / 100;
      } else if (r.status === 'changed') {
        line = `${plan.name} was just updated somewhere else, so I've left it. Check it in the app.`;
      } else {
        line = `I couldn't update ${plan.name}, so I've left it.`;
      }
    }
  }

  // The next account still waiting (one checked in the app meanwhile drops out).
  const waiting = balancesToCheck(rows, now.getTime());
  let next: BalanceToCheck | null = null;
  while (++st.index < st.queue.length) {
    next = waiting.find((b) => b.id === st.queue[st.index]) ?? null;
    if (next) break;
  }
  if (!next) {
    const summary = updateSummary(st.checked, st.skipped, st.net, st.currency);
    return { status: 'done', note: await reply(fromPhone, [line, summary].filter(Boolean).join('\n\n')) };
  }
  await askPending(supabase, profile.id, householdId, 'balance_update', st as unknown as Record<string, unknown>);
  const prompt = balancePrompt(next, st.index, st.total, st.currency, now.getTime());
  return { status: 'done', note: await reply(fromPhone, [line, prompt].filter(Boolean).join('\n\n')) };
}

/** v10.45.0 (W4) — the menu's Check rows, asked of Ask Vyact when answers are on. */
const CHECK_QUESTIONS: Record<string, string> = {
  'menu:this_month': 'How much have I spent this month?',
  'menu:budgets': 'How are my budgets doing this month?',
  'menu:whats_due': 'What bills are due this week?',
};

/**
 * v10.46.0 — a question from someone with answers off. The WhatsApp answer rule: never
 * a link as the answer. Offer to answer here instead, and keep the question, so
 * ANSWERS ON answers it at once.
 */
async function offerAnswers(supabase: SupabaseClient, fromPhone: string, profile: Profile, question: string): Promise<InboundOutcome> {
  await askPending(supabase, profile.id, profile.whatsapp_household_id!, 'reads_offer', { question });
  return { status: 'done', note: await reply(fromPhone, READS_OFFER) };
}

/** Has this person turned on "Answer my questions here"? Off when unknown. */
async function readsEnabled(supabase: SupabaseClient, profileId: string): Promise<boolean> {
  const { data } = await supabase.from('whatsapp_preferences').select('reads_enabled').eq('profile_id', profileId).maybeSingle();
  return (data as { reads_enabled?: boolean } | null)?.reads_enabled === true;
}

/**
 * v10.45.0 (W4) — Ask Vyact on WhatsApp. The app's own engine (bundled from
 * react/src/lib/serverEngine.ts) answers from this household's rows, with the
 * production model through the same config, cap and metering as the gateway. Every
 * figure comes from resolve(); a reply carrying a figure no tool produced is
 * discarded by the engine's guard. Chips become a numbered follow-up list.
 * A read that fails is said plainly and not replayed: re-asking is the person's call.
 */
async function answerQuestion(
  supabase: SupabaseClient, fromPhone: string, profile: Profile, question: string, prevAllowed: readonly string[] = [],
): Promise<InboundOutcome> {
  const householdId = profile.whatsapp_household_id!;
  let rendered: { text: string; chipPrompts: string[] };
  let allowed: string[] = [];
  try {
    const rows = await loadHouseholdRows(supabase, profile.id, householdId);
    const call = serverModelCall(supabase, {
      userId: profile.id, householdId, surface: 'whatsapp',
      dailyCap: Number.parseInt(env('ASK_VYACT_DAILY_CALL_CAP', '200'), 10),
      timeoutMs: Number.parseInt(env('ASK_VYACT_TIMEOUT_MS', '20000'), 10) || undefined,
      waitUntil: typeof EdgeRuntime !== 'undefined' ? (p) => EdgeRuntime!.waitUntil(p) : undefined,
    });
    const turn = await answerOnServer(question, contextFromRows(rows), call, prevAllowed);
    rendered = renderForWhatsApp(turn, APP_URL);
    allowed = turn.allowedFigures ?? [];
  } catch (e) {
    console.error('[whatsapp-webhook] answer failed', (e as Error)?.message);
    return { status: 'done', note: await reply(fromPhone, "I couldn't reach your figures just now, so I haven't answered. Please ask again in a minute.") };
  }
  if (rendered.chipPrompts.length) {
    await askPending(supabase, profile.id, householdId, 'chips', { prompts: rendered.chipPrompts, allowedFigures: allowed });
  }
  return { status: 'done', note: await reply(fromPhone, rendered.text) };
}

interface PendingTurn { id: string; kind: PendingKind; payload: any; expires_at: string }

/** This person's open question, if any (an expired one too: its answer gets EXPIRED). */
async function openPending(supabase: SupabaseClient, profileId: string): Promise<PendingTurn | null> {
  const { data } = await supabase.from('whatsapp_pending_turns').select('id, kind, payload, expires_at')
    .eq('profile_id', profileId).is('resolved_at', null).maybeSingle();
  return (data as PendingTurn | null) ?? null;
}

async function resolvePending(supabase: SupabaseClient, id: string): Promise<void> {
  await supabase.from('whatsapp_pending_turns').update({ resolved_at: new Date().toISOString() }).eq('id', id);
}

/** Ask a question: it replaces any open one, and waits PENDING_MINUTES for its answer. */
async function askPending(
  supabase: SupabaseClient, profileId: string, householdId: string, kind: PendingKind, payload: Record<string, unknown>,
): Promise<void> {
  await supabase.from('whatsapp_pending_turns').update({ resolved_at: new Date().toISOString() })
    .eq('profile_id', profileId).is('resolved_at', null);
  await supabase.from('whatsapp_pending_turns').insert({
    profile_id: profileId, household_id: householdId, kind, payload,
    expires_at: new Date(Date.now() + PENDING_MINUTES * 60_000).toISOString(),
  });
}
