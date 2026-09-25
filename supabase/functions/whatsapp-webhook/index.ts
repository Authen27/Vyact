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
  isReceptionistTrigger, receptionistList, menuReply, UNLINKED_GREETING, UNLINKED_OTHER,
} from '../_shared/whatsapp-receptionist.ts';
import { parseWhatsAppMessage, clarifyReply, PAYMENT_MODE_LABEL, type AccountLite } from '../_shared/whatsapp-parser.ts';

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
    const body = menuReply(rowId, APP_URL);
    return { status: 'done', note: body ? await reply(fromPhone, body) : `unknown_menu_row:${rowId}` };
  }
  // Template quick-reply taps (Flag it, Undo, Stop these…) are handled in W2/W3;
  // until then they are recorded, not acted on.
  if (!text) return { status: 'done', note: `ignored_${String(message?.type ?? 'unknown')}` };

  // …and a greeting, MENU or HELP opens the action list. Fails soft: a menu that
  // cannot be delivered is recorded on the row, never replayed as a ledger write.
  if (isReceptionistTrigger(text)) {
    let firstName: string | null = null;
    try {
      const { data } = await supabase.from('profiles').select('display_name').eq('id', profile.id).maybeSingle();
      firstName = String((data as { display_name?: string } | null)?.display_name ?? '').trim().split(/\s+/)[0] || null;
    } catch (_e) { firstName = null; }
    try {
      await sendInteractiveList(fromPhone, receptionistList(text, firstName));
      return { status: 'done' };
    } catch (e) {
      return { status: 'done', note: `menu_failed: ${(e as Error)?.message ?? String(e)}` };
    }
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
    return { status: 'done', note: await reply(fromPhone, clarifyReply(parsed.reason, `${APP_URL}/dashboard`)) };
  }
  const tx = parsed.tx;

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
  const SYMBOL: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
  const n = Number(r.amount);
  const grouped = Number.isFinite(n)
    ? n.toLocaleString(r.currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 })
    : String(r.amount);
  const amt = SYMBOL[r.currency] ? `${SYMBOL[r.currency]}${grouped}` : `${grouped} ${r.currency}`;
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
  return `✅ Logged ${amt}${cat}${where}${mode}${when}. Send another anytime.`;
}
