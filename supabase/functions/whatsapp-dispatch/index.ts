// Vyact WhatsApp — the scheduler's dispatcher (W2, v10.42.0). Deploy --no-verify-jwt.
//
// pg_cron calls this through pg_net (migration 20260926120000):
//   POST ?job=alerts  every 15 minutes — large spends, budget lines at 80%, settled splits
//   POST ?job=weekly  Sundays 18:00 IST — weekly summary and stale balances (marketing:
//                     only people who opted in)
//   POST ?job=bills   daily 09:00 IST (W2b, v10.43.0) — approval bills due today, to the
//                     linked members who can approve them ("paid Rent" in reply)
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
import { isServiceCaller } from '../_shared/service-auth.ts';
import { TEMPLATES } from '../_shared/whatsapp-templates.ts';
import { guardedSend, type SendResult } from '../_shared/whatsapp-send.ts';
import {
  largeSpendAlerts, budgetAlerts, splitSettledAlerts, weeklySummary, staleBalanceNudge, billReminders, overdueBillReminders, OVERDUE_AFTER_DAYS,
  reengagementNudge, localDay, isoWeek, type PlannedSend, type Household, type Member, type TxnRow, type UnnamedRow,
  splitSharedAlerts, recurringLoggedAlerts, paydayAlerts, dailyDigest, monthClose, budgetSetup, runwayAlerts,
  type ShareRecipientRow, type ScheduleRow, type RuleState,
} from '../_shared/whatsapp-dispatch-rules.ts';
import { loadHouseholdRows } from '../_shared/agent/householdLoader.ts';
import { runwaySnapshot } from '../_shared/agent/engine.ts';

const WINDOW_MS = 30 * 60_000;
const TXN_COLUMNS = 'id, household_id, created_by, type, amount, currency, date, description, category, account_id, to_account_id, asset_id, recurring_schedule_id, extras, created_at';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = env('WHATSAPP_DISPATCH_SECRET');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const given = req.headers.get('x-dispatch-secret') ?? '';
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const allowed = (!!secret && constantTimeEqual(given, secret)) || (await isServiceCaller(bearer));
  if (!allowed) return json({ error: 'forbidden' }, 403);

  const job = new URL(req.url).searchParams.get('job');
  if (!['alerts', 'weekly', 'bills', 'digest', 'monthly'].includes(job ?? '')) return json({ error: 'unknown_job' }, 400);

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
      else if (job === 'weekly') planned.push(...await weeklyFor(admin, household, members, now, today));
      else if (job === 'bills') planned.push(...await billsFor(admin, household, members, today));
      else if (job === 'digest') planned.push(...await digestFor(admin, household, members, today));
      else planned.push(...await monthlyFor(admin, household, members, now, today));
    } catch (e) {
      problems.push(`${householdId}: ${(e as Error)?.message ?? String(e)}`);   // one household never stops the rest
    }
  }
  if (job === 'alerts') {
    try { planned.push(...await settledSplits(admin, now)); }
    catch (e) { problems.push(`splits: ${(e as Error)?.message ?? String(e)}`); }
    try { planned.push(...await newSharedSplits(admin, now)); }
    catch (e) { problems.push(`shared splits: ${(e as Error)?.message ?? String(e)}`); }
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

  // v10.47.0 (W6b) — a schedule that posts itself just did; a salary landed today.
  out.push(...await recurringPosted(admin, household, members, since));
  out.push(...await paydayFor(admin, household, members, since, today));
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
  // v10.47.0 (W6) — what the re-engagement nudges read: when anything was last
  // logged, and this month's expenses still in Other.
  const { data: lastRow } = await admin.from('transactions').select('created_at')
    .eq('household_id', household.id).is('deleted_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const lastLogged = (lastRow as { created_at?: string } | null)?.created_at;
  const lastLoggedDay = lastLogged ? localDay(new Date(lastLogged)) : null;
  const { data: unnamed } = await admin.from('transactions').select('amount, currency, created_by, extras')
    .eq('household_id', household.id).is('deleted_at', null).eq('type', 'expense')
    .in('category', ['other_expense', 'other']).gte('date', `${today.slice(0, 7)}-01`).lte('date', today);
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
    const r = reengagementNudge({ household, member, weekKey, today, lastLoggedDay, unnamed: (unnamed ?? []) as UnnamedRow[] });
    if (r) out.push(r);
  }
  return out;
}

/** Approval bills due today, to the linked members who hold a write role. */
async function billsFor(admin: SupabaseClient, household: Household, members: Member[], today: string): Promise<PlannedSend[]> {
  const { data: schedules, error } = await admin.from('recurring_schedules')
    .select('id, household_id, next_due_date, auto_confirm, active, txn_template')
    .eq('household_id', household.id).is('deleted_at', null).eq('active', true).eq('auto_confirm', false)
    // Due today, or OVERDUE_AFTER_DAYS past due and still waiting (v10.46.0).
    .in('next_due_date', [today, new Date(Date.parse(`${today}T00:00:00Z`) - OVERDUE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10)]);
  if (error) throw new Error(`schedules: ${error.message}`);
  if (!schedules?.length) return [];
  const { data: roles } = await admin.from('memberships').select('user_id, role')
    .eq('household_id', household.id).in('user_id', members.map((m) => m.profile_id));
  const writers = new Set(((roles ?? []) as { user_id: string; role: string }[])
    .filter((r) => r.role !== 'viewer').map((r) => r.user_id));
  const approvers = members.filter((m) => writers.has(m.profile_id));
  return [
    ...billReminders({ today, schedules: schedules as never, approvers }),
    ...overdueBillReminders({ today, schedules: schedules as never, approvers }),
  ];
}

// ── v10.47.0 (W6b) — the senders for templates that had none ────────────────────

/** First names for profile ids ("Rohan Mehta" → "Rohan"). */
async function firstNames(admin: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await admin.from('profiles').select('id, display_name').in('id', [...new Set(ids)]);
  return Object.fromEntries(((data ?? []) as { id: string; display_name: string | null }[])
    .map((p) => [p.id, String(p.display_name ?? '').trim().split(/\s+/)[0]]).filter(([, n]) => n));
}

async function withNames(admin: SupabaseClient, members: Member[]): Promise<Member[]> {
  const names = await firstNames(admin, members.map((m) => m.profile_id));
  return members.map((m) => ({ ...m, first_name: names[m.profile_id] ?? null }));
}

/** Shares created in the window → the participant, if their number is linked. */
async function newSharedSplits(admin: SupabaseClient, now: Date): Promise<PlannedSend[]> {
  const since = new Date(now.getTime() - WINDOW_MS).toISOString();
  const { data, error } = await admin.rpc('whatsapp_split_share_recipients', { p_since: since });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as ShareRecipientRow[];
  if (!rows.length) return [];
  return splitSharedAlerts(rows, await firstNames(admin, rows.map((r) => r.owner_user_id)));
}

/** Entries a self-posting schedule created in the window. */
async function recurringPosted(admin: SupabaseClient, household: Household, members: Member[], since: string): Promise<PlannedSend[]> {
  const { data: posted, error } = await admin.from('transactions').select(TXN_COLUMNS)
    .eq('household_id', household.id).is('deleted_at', null).not('recurring_schedule_id', 'is', null).gt('created_at', since);
  if (error) throw new Error(`recurring posts: ${error.message}`);
  if (!posted?.length) return [];
  const ids = [...new Set((posted as TxnRow[]).map((r) => r.recurring_schedule_id).filter(Boolean))] as string[];
  if (!ids.length) return [];
  const { data: schedules } = await admin.from('recurring_schedules').select('id, auto_confirm, created_by, txn_template').in('id', ids);
  return recurringLoggedAlerts({ household, posted: posted as TxnRow[], schedules: (schedules ?? []) as ScheduleRow[], members });
}

/** A salary dated today, logged in the window → the payday note for its earner. */
async function paydayFor(admin: SupabaseClient, household: Household, members: Member[], since: string, today: string): Promise<PlannedSend[]> {
  const { data: salaries, error } = await admin.from('transactions').select(TXN_COLUMNS)
    .eq('household_id', household.id).is('deleted_at', null).eq('type', 'income').eq('category', 'salary')
    .eq('date', today).gt('created_at', since);
  if (error) throw new Error(`salaries: ${error.message}`);
  const landed = ((salaries ?? []) as TxnRow[]).filter((r) => r.type === 'income' && r.category === 'salary' && r.date === today);
  if (!landed.length) return [];
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 190 * 86_400_000).toISOString().slice(0, 10);
  const { data: earlierRows } = await admin.from('transactions').select('id, amount, currency, date, extras')
    .eq('household_id', household.id).is('deleted_at', null).eq('type', 'income').eq('category', 'salary')
    .gte('date', from).lt('date', today);
  const earlier = ((earlierRows ?? []) as { amount: number | string; currency: string; extras: { excluded?: boolean } | null }[])
    .filter((r) => String(r.currency).trim() === 'INR' && !r.extras?.excluded).map((r) => Number(r.amount));
  const { data: schedules } = await admin.from('recurring_schedules').select('frequency, rrule, txn_template')
    .eq('household_id', household.id).is('deleted_at', null).eq('active', true);
  const monthly = ((schedules ?? []) as { frequency: string | null; rrule: string | null; txn_template: { type?: string; amount?: number | string; currency?: string } }[])
    .filter((s) => s.txn_template?.type === 'expense' && String(s.txn_template?.currency ?? '').trim() === 'INR'
      && (s.frequency === 'monthly' || /FREQ=MONTHLY/i.test(s.rrule ?? '')) && Number(s.txn_template?.amount) > 0);
  const bills = { count: monthly.length, total: Math.round(monthly.reduce((a, s) => a + Number(s.txn_template.amount), 0) * 100) / 100 };
  return paydayAlerts({ household, today, salaries: landed, earlier, bills, members: await withNames(admin, members) });
}

/** The evening digest: today's household spending, to each linked member. */
async function digestFor(admin: SupabaseClient, household: Household, members: Member[], today: string): Promise<PlannedSend[]> {
  const { count: memberCount } = await admin.from('memberships').select('id', { count: 'exact', head: true }).eq('household_id', household.id);
  if ((memberCount ?? 0) < 2) return [];
  const { data: txns, error } = await admin.from('transactions').select(TXN_COLUMNS)
    .eq('household_id', household.id).is('deleted_at', null).eq('type', 'expense').eq('date', today);
  if (error) throw new Error(`digest: ${error.message}`);
  const rows = (txns ?? []) as TxnRow[];
  if (!rows.length) return [];
  const names = await firstNames(admin, rows.map((r) => r.created_by).filter(Boolean) as string[]);
  return dailyDigest({ household, today, txns: rows, members: await withNames(admin, members), names, memberCount: memberCount ?? 0 });
}

/** Month close (the 1st), budget set-up (two days before a month), runway (on a real change). */
async function monthlyFor(admin: SupabaseClient, household: Household, members: Member[], now: Date, today: string): Promise<PlannedSend[]> {
  const named = await withNames(admin, members);
  const out: PlannedSend[] = [];
  const ym = today.slice(0, 7);

  if (today.slice(8, 10) === '01') {
    const from = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 3, 1)).toISOString().slice(0, 10);
    const { data: txns, error } = await admin.from('transactions').select(TXN_COLUMNS)
      .eq('household_id', household.id).is('deleted_at', null).gte('date', from).lt('date', today);
    if (error) throw new Error(`month close: ${error.message}`);
    out.push(...monthClose({ household, today, txns: (txns ?? []) as TxnRow[], members: named }));
  }

  const next = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 1));
  if (Math.round((next.getTime() - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) === 2) {
    const { data: budgets } = await admin.from('budgets').select('id')
      .eq('household_id', household.id).is('deleted_at', null).eq('scope', 'month')
      .eq('period_year', next.getUTCFullYear()).eq('period_month', next.getUTCMonth() + 1).limit(1);
    const { data: spend } = await admin.from('transactions').select('category, extras')
      .eq('household_id', household.id).is('deleted_at', null).eq('type', 'expense').gte('date', `${ym}-01`).lte('date', today);
    const cats = new Set(((spend ?? []) as { category: string | null; extras: { excluded?: boolean } | null }[])
      .filter((r) => r.category && r.category !== 'transfer' && r.category !== 'balance_adjustment' && !r.extras?.excluded).map((r) => r.category));
    const { data: roles } = await admin.from('memberships').select('user_id, role').eq('household_id', household.id);
    const setters = new Set(((roles ?? []) as { user_id: string; role: string }[]).filter((r) => r.role === 'owner' || r.role === 'admin').map((r) => r.user_id));
    out.push(...budgetSetup({ household, today, categoriesWithSpend: cats.size, hasNextMonthBudget: !!budgets?.length, members: named.filter((m) => setters.has(m.profile_id)) }));
  }

  // Runway: the app's own forecast, against the last value this household was told.
  const anyone = members[0];
  if (anyone) {
    const rows = await loadHouseholdRows(admin, anyone.profile_id, household.id);
    const snap = runwaySnapshot(rows, now);
    const { data: st } = await admin.from('whatsapp_rule_state').select('value, detail')
      .eq('household_id', household.id).eq('rule', 'runway').maybeSingle();
    const state: RuleState | null = st
      ? { value: (st as { value: number | null }).value == null ? null : Number((st as { value: number }).value), detail: ((st as { detail: RuleState['detail'] }).detail ?? {}) }
      : null;
    const r = runwayAlerts({ household, monthKey: ym, months: snap.months, quieterCategory: snap.quieterCategory, state, members: named });
    if (r.state && r.state !== state) {
      await admin.from('whatsapp_rule_state').upsert({ household_id: household.id, rule: 'runway', value: r.state.value, detail: r.state.detail, updated_at: new Date().toISOString() });
    }
    out.push(...r.sends);
  }
  return out;
}
