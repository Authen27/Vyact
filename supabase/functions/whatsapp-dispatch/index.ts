// Vyact WhatsApp — the scheduler's dispatcher (W2, v10.42.0). Deploy --no-verify-jwt.
//
// pg_cron calls this through pg_net (migration 20260926120000):
//   POST ?job=alerts  every 15 minutes — large spends, budget lines at 80%, settled splits
//   POST ?job=weekly  Sundays 18:00 IST — weekly summary and stale balances (marketing:
//                     only people who opted in)
//
// Auth: the `x-dispatch-secret` header must equal WHATSAPP_DISPATCH_SECRET, or the
// bearer must be the service key (for a manual run). With no secret configured the
// function refuses every call, so it is inert until the owner sets it.
//
// What is sent is decided by the pure rules in `_shared/whatsapp-dispatch-rules.ts`;
// every send then goes through `guardedSend` — consent, mutes, the template
// approval gate, the daily cap and the dedupe slot — exactly like whatsapp-notify.
// A window of 30 minutes (twice the cadence) means a missed run is caught by the
// next one, and the dedupe slot means nothing is sent twice.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, json, constantTimeEqual } from '../_shared/whatsapp.ts';
import { TEMPLATES } from '../_shared/whatsapp-templates.ts';
import { guardedSend, type SendResult } from '../_shared/whatsapp-send.ts';
import {
  largeSpendAlerts, budgetAlerts, splitSettledAlerts, weeklySummary, staleBalanceNudge,
  localDay, isoWeek, type PlannedSend, type Household, type Member, type TxnRow,
} from '../_shared/whatsapp-dispatch-rules.ts';

const WINDOW_MS = 30 * 60_000;
const TXN_COLUMNS = 'id, household_id, created_by, type, amount, currency, date, description, category, account_id, to_account_id, asset_id, recurring_schedule_id, extras, created_at';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = env('WHATSAPP_DISPATCH_SECRET');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const given = req.headers.get('x-dispatch-secret') ?? '';
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const allowed = (!!secret && constantTimeEqual(given, secret)) || (!!serviceKey && constantTimeEqual(bearer, serviceKey));
  if (!allowed) return json({ error: 'forbidden' }, 403);

  const job = new URL(req.url).searchParams.get('job');
  if (job !== 'alerts' && job !== 'weekly') return json({ error: 'unknown_job' }, 400);

  const admin = createClient(env('SUPABASE_URL'), serviceKey);
  const now = new Date();
  const today = localDay(now, Number(env('VYACT_TZ_OFFSET_MINUTES', '330')) || 330);

  // Only households someone has linked a number to can receive anything.
  const { data: identities, error } = await admin.from('whatsapp_identities').select('profile_id, household_id');
  if (error) return json({ error: 'identities_unavailable' }, 500);
  const byHousehold = new Map<string, Member[]>();
  for (const i of (identities ?? []) as Member[]) {
    byHousehold.set(i.household_id, [...(byHousehold.get(i.household_id) ?? []), i]);
  }

  const planned: PlannedSend[] = [];
  const problems: string[] = [];
  for (const [householdId, members] of byHousehold) {
    try {
      const household = await loadHousehold(admin, householdId);
      if (!household) continue;
      if (job === 'alerts') planned.push(...await alertsFor(admin, household, members, now, today));
      else planned.push(...await weeklyFor(admin, household, members, now, today));
    } catch (e) {
      problems.push(`${householdId}: ${(e as Error)?.message ?? String(e)}`);   // one household never stops the rest
    }
  }
  if (job === 'alerts') {
    try { planned.push(...await settledSplits(admin, now)); }
    catch (e) { problems.push(`splits: ${(e as Error)?.message ?? String(e)}`); }
  }

  const results: SendResult[] = [];
  for (const p of planned) {
    const def = TEMPLATES[p.template];
    results.push(await guardedSend(admin, {
      def, event: p.template, householdId: p.householdId, toProfileId: p.toProfileId,
      values: p.values, dedupeKey: p.dedupeKey, caller: `dispatch:${job}`,
    }));
  }
  const tally: Record<string, number> = {};
  for (const r of results) {
    const k = r.status === 'sent' ? 'sent' : `${r.status}:${r.reason}`;
    tally[k] = (tally[k] ?? 0) + 1;
  }
  return json({ status: 'ok', job, planned: planned.length, results: tally, problems });
});

async function loadHousehold(admin: SupabaseClient, id: string): Promise<Household | null> {
  const { data } = await admin.from('households').select('id, base_currency').eq('id', id).maybeSingle();
  return (data as Household | null) ?? null;
}

async function alertsFor(
  admin: SupabaseClient, household: Household, members: Member[], now: Date, today: string,
): Promise<PlannedSend[]> {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const out: PlannedSend[] = [];

  // Large spends logged in the window.
  const { data: recent, error: rErr } = await admin.from('transactions').select(TXN_COLUMNS)
    .eq('household_id', household.id).is('deleted_at', null).eq('type', 'expense').gt('created_at', since);
  if (rErr) throw new Error(`transactions: ${rErr.message}`);
  if ((recent ?? []).length) {
    const { data: prefs } = await admin.from('whatsapp_preferences').select('profile_id, large_txn_threshold')
      .in('profile_id', members.map((m) => m.profile_id));
    const thresholds = Object.fromEntries(((prefs ?? []) as { profile_id: string; large_txn_threshold: number }[])
      .map((p) => [p.profile_id, Number(p.large_txn_threshold)]));
    const { data: accounts } = await admin.from('accounts').select('id, name').eq('household_id', household.id);
    const accountNames = Object.fromEntries(((accounts ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));
    out.push(...largeSpendAlerts({ household, txns: recent as TxnRow[], members, thresholds, accountNames }));
  }

  // Budget lines in the current period. Only worth computing when something moved.
  const { data: budgets } = await admin.from('budgets').select('id, currency, period_start, period_end')
    .eq('household_id', household.id).is('deleted_at', null).lte('period_start', today).gte('period_end', today);
  if ((budgets ?? []).length && (recent ?? []).length) {
    const from = (budgets as { period_start: string }[]).map((b) => b.period_start).sort()[0];
    const { data: allocations } = await admin.from('budget_allocations').select('budget_id, category, amount')
      .in('budget_id', (budgets as { id: string }[]).map((b) => b.id)).is('deleted_at', null);
    const { data: txns, error: tErr } = await admin.from('transactions').select(TXN_COLUMNS)
      .eq('household_id', household.id).is('deleted_at', null).gte('date', from).lte('date', today);
    if (tErr) throw new Error(`budget transactions: ${tErr.message}`);
    out.push(...budgetAlerts({
      household, today, budgets: budgets as never, allocations: (allocations ?? []) as never,
      txns: (txns ?? []) as TxnRow[], members,
    }));
  }
  return out;
}

/** Shares marked paid in the window, with what the owner's message needs. */
async function settledSplits(admin: SupabaseClient, now: Date): Promise<PlannedSend[]> {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const { data: shares, error } = await admin.from('shared_split_shares')
    .select('id, share, email, settled_user_id, split_id').eq('paid', true).gt('paid_at', since);
  if (error) throw new Error(error.message);
  if (!shares?.length) return [];
  const { data: splits } = await admin.from('shared_splits')
    .select('id, owner_user_id, owner_household_id, description, currency')
    .in('id', [...new Set((shares as { split_id: string }[]).map((s) => s.split_id))]);
  const splitById = new Map(((splits ?? []) as any[]).map((s) => [s.id, s]));
  const payerIds = (shares as { settled_user_id: string | null }[]).map((s) => s.settled_user_id).filter(Boolean) as string[];
  const { data: payers } = payerIds.length
    ? await admin.from('profiles').select('id, display_name').in('id', payerIds)
    : { data: [] };
  const nameById = new Map(((payers ?? []) as { id: string; display_name: string | null }[])
    .map((p) => [p.id, String(p.display_name ?? '').trim().split(/\s+/)[0]]));
  return splitSettledAlerts((shares as any[]).flatMap((s) => {
    const split = splitById.get(s.split_id);
    if (!split) return [];
    return [{
      share_id: s.id, share: s.share,
      payer_name: nameById.get(s.settled_user_id) || String(s.email ?? '').split('@')[0],
      split_description: String(split.description ?? ''), split_currency: String(split.currency ?? ''),
      owner_profile_id: split.owner_user_id, owner_household_id: split.owner_household_id,
    }];
  }));
}

async function weeklyFor(
  admin: SupabaseClient, household: Household, members: Member[], now: Date, today: string,
): Promise<PlannedSend[]> {
  // Marketing: compute only for members who opted in (guardedSend checks again).
  const { data: prefs } = await admin.from('whatsapp_preferences').select('profile_id')
    .in('profile_id', members.map((m) => m.profile_id)).eq('marketing_opt_in', true);
  const optedIn = new Set(((prefs ?? []) as { profile_id: string }[]).map((p) => p.profile_id));
  const audience = members.filter((m) => optedIn.has(m.profile_id));
  if (!audience.length) return [];

  const weekKey = isoWeek(today);
  const start = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  const { data: txns, error } = await admin.from('transactions').select(TXN_COLUMNS)
    .eq('household_id', household.id).is('deleted_at', null).gte('date', start).lte('date', today);
  if (error) throw new Error(`weekly transactions: ${error.message}`);
  const { data: accounts } = await admin.from('accounts').select('id, created_at, last_reconciled_at')
    .eq('household_id', household.id).is('deleted_at', null).eq('is_archived', false)
    .in('kind', ['bank', 'credit_card', 'cash']);
  const { data: names } = await admin.from('profiles').select('id, display_name').in('id', audience.map((m) => m.profile_id));
  const first = new Map(((names ?? []) as { id: string; display_name: string | null }[])
    .map((p) => [p.id, String(p.display_name ?? '').trim().split(/\s+/)[0] || null]));

  const out: PlannedSend[] = [];
  for (const m of audience) {
    const member = { ...m, first_name: first.get(m.profile_id) ?? null };
    const w = weeklySummary({ household, today, txns: (txns ?? []) as TxnRow[], member, weekKey });
    if (w) out.push(w);
    const s = staleBalanceNudge({ household, now, accounts: (accounts ?? []) as never, member, weekKey });
    if (s) out.push(s);
  }
  return out;
}
