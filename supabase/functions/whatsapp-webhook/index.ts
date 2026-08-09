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
// leaves over chat). Interactive/button replies are accepted & ignored for now.
//
// Deploy WITHOUT JWT (Meta has no Supabase JWT):
//   supabase functions deploy whatsapp-webhook --no-verify-jwt

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, verifyMetaSignature, sendText, APP_URL } from '../_shared/whatsapp.ts';
import { parseWhatsAppMessage, clarifyReply, type AccountLite } from '../_shared/whatsapp-parser.ts';

declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void } | undefined;

interface Profile { id: string; whatsapp_household_id: string | null }

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

  // 2. Authenticate the payload (constant-time HMAC).
  const rawBody = await req.text();
  if (!(await verifyMetaSignature(rawBody, req.headers.get('x-hub-signature-256')))) {
    return new Response('Invalid signature', { status: 401 });
  }

  // 3. ACK first; record + process in the background.
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(rawBody); } catch { /* keep {} */ }

  const change = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];

  if (message?.id) {
    const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
    const fromPhone = (change?.contacts?.[0]?.wa_id ?? '').replace(/[^\d]/g, '');

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, whatsapp_household_id')
      .eq('phone_number', fromPhone)
      .not('phone_verified_at', 'is', null)
      .maybeSingle();

    // Idempotent claim-first record (PK on wa_message_id rejects duplicates).
    await supabase.from('whatsapp_inbound_messages').upsert({
      wa_message_id: message.id,
      profile_id: profile?.id ?? null,
      household_id: profile?.whatsapp_household_id ?? null,
      direction: 'inbound',
      payload: message,
      processed_at: null,
    }, { onConflict: 'wa_message_id', ignoreDuplicates: true });

    const work = processInbound(supabase, message, fromPhone, (profile as Profile | null));
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
    else await work;   // local/dev fallback
  }

  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});

const CAT_LABEL: Record<string, string> = {
  food_dining: 'Food & Dining', groceries: 'Groceries', transport: 'Transport',
  rent_mortgage: 'Rent / Mortgage', utilities: 'Utilities', shopping: 'Shopping',
  health: 'Health', entertainment: 'Entertainment', education: 'Education', travel: 'Travel',
  childcare: 'Childcare', insurance: 'Insurance', loan_emi: 'Loan / EMI', other_expense: 'Other',
  salary: 'Salary', freelance: 'Freelance', gift_bonus: 'Gift / Bonus',
  rental_income: 'Rental income', business_revenue: 'Business revenue', other_income: 'Other income',
};

/** Background handler: parse → log → confirm (or clarify / hard-block / notice). */
async function processInbound(
  supabase: SupabaseClient, message: any, fromPhone: string, profile: Profile | null,
): Promise<void> {
  try {
    // Unregistered / unlinked sender.
    if (!profile || !profile.whatsapp_household_id) {
      if (fromPhone) await sendText(fromPhone, "This number isn't linked to a Vyact account yet. Link it in Settings → WhatsApp.");
      return;
    }
    const householdId = profile.whatsapp_household_id;

    // MVP: only free-text logging. Button/interactive replies are accepted & ignored.
    const text: string | undefined = message?.text?.body;
    if (!text) return;

    const { data: accounts } = await supabase
      .from('accounts')
      .select('name, kind, currency')
      .eq('household_id', householdId)
      .eq('is_archived', false);
    const accountList: AccountLite[] = (accounts ?? []).map((a: any) => ({ name: a.name, kind: a.kind }));
    const baseCurrency: string = (accounts as any)?.[0]?.currency ?? 'USD';

    const parsed = parseWhatsAppMessage(text, accountList, baseCurrency);
    if (!parsed.ok) {
      await sendText(fromPhone, clarifyReply(parsed.reason, `${APP_URL}/dashboard`));
      return;
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
    });

    if (error) {
      await sendText(fromPhone, "Couldn't log that just now — please try again in a moment.");
      return;
    }
    const r = result as any;
    if (r?.status === 'success') {
      await sendText(fromPhone, confirmation(r));
    } else if (r?.status === 'duplicate') {
      /* already handled — stay silent */
    } else if (r?.reason === 'no_destination_account' || r?.reason === 'same_account') {
      await sendText(fromPhone, 'Which account should this move to? e.g. `moved 10000 to icici`.');
    } else {
      await sendText(fromPhone, "I couldn't place that in an account. Try naming one, e.g. `850 groceries hdfc`.");
    }
  } catch (_e) {
    try { if (fromPhone) await sendText(fromPhone, 'Something went wrong logging that. Please try again.'); } catch { /* best effort */ }
  }
}

/** Session-text confirmation (within the 24h window — no template needed). */
function confirmation(r: any): string {
  const amt = `${r.amount} ${r.currency}`;
  const cat = r.category_id ? ` · ${CAT_LABEL[r.category_id] ?? r.category_id}` : '';
  let where = '';
  if (r.type === 'income') where = r.to_account_name ? ` to ${r.to_account_name}` : '';
  else if (r.type === 'transfer' || r.type === 'investment') {
    where = r.account_name && r.to_account_name ? ` ${r.account_name} → ${r.to_account_name}` : '';
  } else where = r.account_name ? ` from ${r.account_name}` : '';
  return `✅ Logged ${amt}${cat}${where}. Send another anytime.`;
}
