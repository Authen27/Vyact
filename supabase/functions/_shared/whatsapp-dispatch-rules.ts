// Vyact WhatsApp — what the scheduler sends, and to whom (W2, v10.42.0).
//
// Pure rules over rows the dispatcher loaded: no Deno, no database, no Meta. Each
// rule returns the sends it wants; `whatsapp-dispatch` hands every one to
// `guardedSend`, which applies consent, mutes, approval, the cap and dedupe.
//
// MONEY: every spending figure here is the APP's own (Track E, v10.96.0; audit XC-ARC-06): rows are
// mapped by the app's adapter (`txnsFromRows`), and what counts as spending is the app's `spendRows`,
// both from the bundled engine (`./agent/engine.ts`). The hand-copied money port (`_shared/money`,
// with its own row mapping) is gone. And a rule SKIPS rather than guesses:
//   • W3b (v10.66.0; owner decision D14): a household has ONE currency and nothing is
//     converted — a row still labelled with an older currency counts at face value, so it
//     no longer silences a rule (it used to skip the whole household);
//   • v10.138.0: every amount a template carries is written in the household's own currency
//     (`templateMoney`, the app's `fmt`). The redesigned `_v2` templates have no symbol of their own, so
//     they suit any household; until one is approved, `guardedSend` sends the original, whose "₹" text
//     goes to INR households only (`versionToSend` in `whatsapp-templates.ts`);
//   • a private (excluded) transaction is never announced to anyone.

import {
  txnsFromRows, spendRows, spendByCategoryInRange, effectiveAmount, spendEntryKey, countSpendEntries, type EngineTxn,
  budgetLinesOnServer, staleAccountCount, fmt,
} from './agent/engine.ts';
import { zoneParts } from './localTime.ts';

/** MUST mirror react/src/constants.ts EXPENSE_CATEGORIES labels (parity test: WA-D-001). */
export const EXPENSE_LABEL: Record<string, string> = {
  food_dining: 'Food & Dining', groceries: 'Groceries', rent_mortgage: 'Rent / Mortgage',
  utilities: 'Utilities', travel: 'Travel', holiday_outstay: 'Holiday & Outstay', shopping: 'Shopping',
  electronics_decor: 'Electronics & Decor', personal_care: 'Personal Care', health: 'Health & Wellness',
  repairs_maintenance: 'Repairs & Maintenance', entertainment: 'Entertainment', education: 'Education',
  childcare: 'Childcare', gifts_donations: 'Gifts & Donations', insurance: 'Insurance',
  loan_emi: 'Loan / EMI payment', other_expense: 'Other',
};

export interface PlannedSend {
  template: string;
  householdId: string;
  /** The currency its amounts are written in (`guardedSend` picks the template version by it). */
  currency: string;
  toProfileId: string;
  values: string[];
  dedupeKey: string;
}

export interface TxnRow {
  id: string; household_id: string; created_by: string | null; type: string; amount: number | string;
  currency: string; date: string; description?: string | null; category: string | null;
  account_id?: string | null; to_account_id?: string | null; asset_id?: string | null;
  member_id?: string | null; debt_id?: string | null;
  recurring_schedule_id?: string | null; extras?: { excluded?: boolean; split?: unknown; emi_split?: unknown } | null;
  created_at?: string;
}

/** A database row as the app's Transaction: the app's own adapter mapping, through the engine. */
export function rowToTxn(r: TxnRow): EngineTxn {
  return txnsFromRows([r])[0];
}

/**
 * v10.138.0 — an amount for a template value, as the app writes it, symbol included: "₹1,540.50", "$64",
 * "64 €". Every amount a rule sends goes through this, in the household's currency. Never negative here: a
 * difference is sent as its size, with "more" or "less".
 */
export function templateMoney(n: number, currency: string): string {
  return fmt(n, currency.trim());
}

/** "₹600" — with the currency's own symbol (session replies). */
export function moneyText(n: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function countWord(n: number): string { return WORDS[n] ?? String(n); }

/** The calendar day in the household's zone (W3a: its own IANA zone; India time when unset). */
export function localDay(now: Date, tz?: string | null): string {
  return zoneParts(now, tz).day;
}

/**
 * The scheduled jobs and the LOCAL time each one is for (W3a). pg_cron runs them every 30 minutes;
 * a household is processed by the one run that falls in its own [at, at + 30 min) slot — so the bill
 * reminder reaches New York at 09:00 New York time, not at 23:30 the evening before. `alerts` runs
 * for everyone on every run. Every send also has a dedupe slot, so a repeated run sends nothing twice.
 */
export const JOB_SLOTS: Record<string, { at: number; weekday?: number }> = {
  bills: { at: 9 * 60 },
  monthly: { at: 9 * 60 },
  digest: { at: 20 * 60 + 30 },
  weekly: { at: 18 * 60, weekday: 0 },
};
export const SLOT_MINUTES = 30;

/** Is this household's local time inside the job's slot right now? */
export function inJobSlot(job: string, now: Date, tz?: string | null): boolean {
  const slot = JOB_SLOTS[job];
  if (!slot) return true;
  const local = zoneParts(now, tz);
  if (slot.weekday !== undefined && local.weekday !== slot.weekday) return false;
  return local.minutes >= slot.at && local.minutes < slot.at + SLOT_MINUTES;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface Household { id: string; base_currency: string; timezone?: string | null }
export interface Member { profile_id: string; household_id: string; first_name?: string | null }

// ── Large spend ─────────────────────────────────────────────────────────────
/**
 * A large expense someone logged → every OTHER linked member whose threshold it
 * meets. The person who logged it already knows. Scheduled payments are expected,
 * not news, so they are left out; a private row is never announced.
 */
export function largeSpendAlerts(input: {
  household: Household; txns: TxnRow[]; members: Member[];
  thresholds: Record<string, number>; accountNames: Record<string, string>;
}): PlannedSend[] {
  const { household } = input;
  const cur = household.base_currency.trim();
  const out: PlannedSend[] = [];
  // Track E: the rows the app counts as spending (reportable, not private), one alert per ENTRY: a loan
  // payment's interest and principal are one payment (owner decision E-10: it alerts like any big spend).
  const entries = new Map<string, { first: EngineTxn; amount: number }>();
  for (const t of spendRows(txnsFromRows(input.txns))) {
    if (t.recurringScheduleId) continue;
    // W8b (audit INT-PAR-10): the household's share, as every app total reads it — a split bill is
    // announced (and compared with the threshold) at the share this household paid, not the whole bill.
    const amount = effectiveAmount(t, household.base_currency.trim(), {});
    const key = spendEntryKey(t);
    const seen = entries.get(key);
    if (seen) seen.amount = Math.round((seen.amount + amount) * 100) / 100;
    else entries.set(key, { first: t, amount });
  }
  for (const [key, { first: t, amount }] of entries) {
    const account = t.accountId ? input.accountNames[t.accountId] : undefined;
    if (!account) continue;
    for (const m of input.members) {
      if (m.profile_id === t.created_by) continue;
      if (amount < (input.thresholds[m.profile_id] ?? 10000)) continue;
      out.push({
        template: 'large_transaction_alert', householdId: household.id, currency: cur, toProfileId: m.profile_id,
        values: [templateMoney(amount, cur), account], dedupeKey: `txn:${key}`,
      });
    }
  }
  return out;
}

// ── Budget threshold ────────────────────────────────────────────────────────
/** `budgets` / `budget_allocations` rows as the database returns them (`select *`: the app's mapper reads them). */
export interface BudgetRow { id: string; currency: string; period_start: string | null; period_end: string | null; [column: string]: unknown }
export interface AllocationRow { budget_id: string; category: string; amount: number | string; [column: string]: unknown }

/** The share of a budget line that sends the alert. Once per line per period. */
export const BUDGET_ALERT_AT = 80;

/**
 * A budget line in the current period that has reached 80% but not 100% → every linked member.
 * T5c (v10.122.0; audit XC-ARC-06): the lines are the APP's (`budgetLinesOnServer` → the bell's
 * `budgetThresholdLines`), so WhatsApp, the bell and push name the same lines at the same percentage.
 * This rule kept its own copy until then, which skipped a single-category budget the bell checks.
 * WhatsApp sends the 80% band only: at 100% the template's "… is still in the pot" would be untrue.
 */
export function budgetAlerts(input: {
  household: Household; today: string; budgets: BudgetRow[]; allocations: AllocationRow[];
  txns: TxnRow[]; members: Member[];
}): PlannedSend[] {
  const base = input.household.base_currency.trim();
  const out: PlannedSend[] = [];
  const lines = budgetLinesOnServer(
    { budgets: input.budgets, budgetAllocations: input.allocations, transactions: input.txns }, base, input.today,
  );
  for (const line of lines) {
    if (line.threshold !== BUDGET_ALERT_AT) continue;
    const daysLeft = daysBetween(input.today, line.end);
    if (daysLeft < 1) continue;
    const label = EXPENSE_LABEL[line.category];
    if (!label) continue;
    const pct = Math.round(line.share * 100);
    for (const m of input.members) {
      out.push({
        template: 'budget_threshold_alert', householdId: input.household.id, currency: base, toProfileId: m.profile_id,
        values: [label, String(pct), String(daysLeft), templateMoney(Math.round((line.limit - line.spent) * 100) / 100, base)],
        dedupeKey: `budget:${line.budgetId}:${line.category}:${BUDGET_ALERT_AT}`,
      });
    }
  }
  return out;
}

// ── Split settled ───────────────────────────────────────────────────────────
export interface SettledShare {
  share_id: string; share: number | string; payer_name: string;
  split_description: string; split_currency: string;
  owner_profile_id: string; owner_household_id: string;
}

/** Someone settled their share of a split you own → you. */
export function splitSettledAlerts(shares: SettledShare[]): PlannedSend[] {
  return shares
    .filter((s) => s.payer_name.trim() && s.split_description.trim())
    .map((s) => ({
      template: 'split_settled', householdId: s.owner_household_id, currency: String(s.split_currency).trim(), toProfileId: s.owner_profile_id,
      values: [s.payer_name.trim(), templateMoney(Number(s.share), String(s.split_currency)), s.split_description.trim()],
      dedupeKey: `split:${s.share_id}`,
    }));
}

// ── Weekly (marketing: only people who opted in) ────────────────────────────
/**
 * The last seven days, today included: spend, how many entries, the top category.
 * Nothing recorded → nothing sent (an empty summary is not news).
 */
export function weeklySummary(input: {
  household: Household; today: string; txns: TxnRow[]; member: Member; weekKey: string;
}): PlannedSend | null {
  const base = input.household.base_currency.trim();
  const start = new Date(Date.parse(`${input.today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  const txns = txnsFromRows(input.txns);
  const spend = spendByCategoryInRange(txns, start, input.today, base, {});
  const entries = countSpendEntries(spendRows(txns).filter((t) => t.date >= start && t.date <= input.today));
  const cats = Object.entries(spend).filter(([id]) => EXPENSE_LABEL[id]).sort((a, b) => b[1] - a[1]);
  if (!entries || !cats.length) return null;
  const total = Math.round(Object.values(spend).reduce((s, v) => s + v, 0) * 100) / 100;
  return {
    template: 'weekly_summary', householdId: input.household.id, currency: base, toProfileId: input.member.profile_id,
    values: [templateMoney(total, base), String(entries), EXPENSE_LABEL[cats[0][0]]],
    dedupeKey: `weekly:${input.weekKey}`,
  };
}

/** `accounts` rows as the database returns them (`select *`: the app's mapper reads kind, archive and the log). */
export interface AccountRow { id: string; created_at: string; last_reconciled_at: string | null; [column: string]: unknown }

/**
 * Stale balances → a nudge to the opted-in member, weekly at most.
 * T5c (v10.122.0; audit INT-PAR-05): counted by the APP's rule (`staleAccountCount` → `staleAccounts`), the
 * one the bell, push and "Reply UPDATE" use. This counted by its own 30-day cut until then: an account
 * reconciled only through its log still counted, so it could say "2" where the bell said 1.
 */
export function staleBalanceNudge(input: {
  household: Household; now: Date; accounts: AccountRow[]; member: Member; weekKey: string;
}): PlannedSend | null {
  const stale = staleAccountCount(input.accounts, input.now.getTime());
  if (!stale || !input.member.first_name) return null;
  return {
    template: 'balance_stale_nudge', householdId: input.household.id, currency: input.household.base_currency.trim(), toProfileId: input.member.profile_id,
    values: [input.member.first_name, countWord(stale)], dedupeKey: `balances:${input.weekKey}`,
  };
}

// ── Re-engagement (W6, v10.47.0) — the nudges that open a conversation ─────────
/** An expense this month still in Other, as the weekly job reads it. */
export interface UnnamedRow { amount: number | string; currency: string; created_by: string | null; extras: { excluded?: boolean } | null }

/** Nothing logged for this many days = quiet. */
export const QUIET_AFTER_DAYS = 7;
/** Unnamed spending worth a nudge: at least two entries and 500 together, in the household's currency. */
export const UNNAMED_MIN_COUNT = 2;
export const UNNAMED_MIN_TOTAL = 500;

/**
 * At most one re-engagement nudge a week per opted-in member (marketing):
 *   • quiet — nothing logged for 7+ days (the household has logged before):
 *     reengagement_nudge_quiet, answered by LOG;
 *   • otherwise unnamed spending this month (≥ 2 entries, ≥ 500 together;
 *     another member's private entry is not theirs to name): reengagement_nudge,
 *     answered by "Name them here".
 */
export function reengagementNudge(input: {
  household: Household; member: Member; weekKey: string; today: string;
  lastLoggedDay: string | null; unnamed: UnnamedRow[];
}): PlannedSend | null {
  const first = input.member.first_name;
  if (!first) return null;
  const cur = input.household.base_currency.trim();
  const base = { householdId: input.household.id, currency: cur, toProfileId: input.member.profile_id, dedupeKey: `nudge:${input.weekKey}` };
  if (input.lastLoggedDay) {
    const quiet = daysBetween(input.lastLoggedDay, input.today);
    if (quiet >= QUIET_AFTER_DAYS) return { ...base, template: 'reengagement_nudge_quiet', values: [first, String(quiet)] };
  }
  const mine = input.unnamed.filter((r) => !r.extras?.excluded || r.created_by === input.member.profile_id);
  const total = Math.round(mine.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
  if (mine.length < UNNAMED_MIN_COUNT || total < UNNAMED_MIN_TOTAL) return null;
  return { ...base, template: 'reengagement_nudge', values: [first, templateMoney(total, cur), countWord(mine.length)] };
}

// ── Bill reminders (W2b) ────────────────────────────────────────────────────
export interface BillSchedule {
  id: string; household_id: string; next_due_date: string; auto_confirm: boolean; active: boolean;
  txn_template: { type?: string; amount?: number | string; currency?: string; description?: string; category?: string; debtId?: string };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "25 Sep" — how the reminder names the due day. A fixed table: ICU builds differ ("Sept"). */
export function dueDayText(day: string): string {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/**
 * An approval bill due TODAY → every linked member who can approve it. Sent on the
 * due day, never before: "paid Rent" approves it, and the app never approves early.
 * A schedule that posts itself needs no reply, so it gets no reminder; an EMI,
 * transfer or investment cannot be approved from chat, so it gets none either.
 */
export function billReminders(input: { today: string; schedules: BillSchedule[]; approvers: Member[]; baseCurrency?: string }): PlannedSend[] {
  const out: PlannedSend[] = [];
  for (const s of input.schedules) {
    const t = s.txn_template ?? {};
    if (!s.active || s.auto_confirm || s.next_due_date !== input.today) continue;
    if (t.type !== 'expense' || t.category === 'loan_emi' || t.debtId) continue;
    const name = String(t.description ?? '').trim();
    const amount = Number(t.amount);
    const cur = input.baseCurrency ?? String(t.currency ?? '').trim();   // W3b: the household's currency
    if (!name || !(amount > 0) || !cur) continue;
    for (const m of input.approvers.filter((a) => a.household_id === s.household_id)) {
      out.push({
        template: 'bill_due_reminder', householdId: s.household_id, currency: cur, toProfileId: m.profile_id,
        values: [name, templateMoney(amount, cur), dueDayText(s.next_due_date), name],
        dedupeKey: `bill:${s.id}:${s.next_due_date}`,
      });
    }
  }
  return out;
}

/** The calendar day after `day` (YYYY-MM-DD). */
export function nextDay(day: string): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/**
 * v10.58.0 (owner, 3 Oct) — a bill that POSTS ITSELF (auto-confirm), due TOMORROW → every
 * linked member, the day before (bills job, 09:00 IST). Expenses only, EMIs included;
 * income, transfers and investments are not bills. Owner (4 Oct): no second template, so it
 * goes out as the approved `bill_due_reminder`, keyed `bill:<schedule>:<due day>` like the
 * due-day reminder, so a "paid Rent" reply finds it (the webhook then says it posts itself).
 */
export function billsTomorrow(input: { today: string; schedules: BillSchedule[]; members: Member[]; baseCurrency?: string }): PlannedSend[] {
  const tomorrow = nextDay(input.today);
  const out: PlannedSend[] = [];
  for (const s of input.schedules) {
    const t = s.txn_template ?? {};
    if (!s.active || !s.auto_confirm || s.next_due_date !== tomorrow || t.type !== 'expense') continue;
    const name = String(t.description ?? '').trim();
    const amount = Number(t.amount);
    const cur = input.baseCurrency ?? String(t.currency ?? '').trim();   // W3b: the household's currency
    if (!name || !(amount > 0) || !cur) continue;
    for (const m of input.members.filter((a) => a.household_id === s.household_id)) {
      out.push({
        template: 'bill_due_reminder', householdId: s.household_id, currency: cur, toProfileId: m.profile_id,
        values: [name, templateMoney(amount, cur), dueDayText(s.next_due_date), name],
        dedupeKey: `bill:${s.id}:${s.next_due_date}`,
      });
    }
  }
  return out;
}

/** An approval bill still waiting this many days after its due date gets the overdue reminder, once. */
export const OVERDUE_AFTER_DAYS = 3;

/**
 * v10.46.0 — an approval bill still due OVERDUE_AFTER_DAYS after its date → the
 * overdue reminder (no greeting, "Already paid" first), once per occurrence. The
 * schedule's pointer not having moved is what "still waiting" means: approving it
 * anywhere — app or chat — moves the pointer, and the rule stops matching.
 */
export function overdueBillReminders(input: { today: string; schedules: BillSchedule[]; approvers: Member[]; baseCurrency?: string }): PlannedSend[] {
  const due = new Date(Date.parse(`${input.today}T00:00:00Z`) - OVERDUE_AFTER_DAYS * 86_400_000).toISOString().slice(0, 10);
  const out: PlannedSend[] = [];
  for (const s of input.schedules) {
    const t = s.txn_template ?? {};
    if (!s.active || s.auto_confirm || s.next_due_date !== due) continue;
    if (t.type !== 'expense' || t.category === 'loan_emi' || t.debtId) continue;
    const name = String(t.description ?? '').trim();
    const amount = Number(t.amount);
    const cur = input.baseCurrency ?? String(t.currency ?? '').trim();   // W3b: the household's currency
    if (!name || !(amount > 0) || !cur) continue;
    for (const m of input.approvers.filter((a) => a.household_id === s.household_id)) {
      out.push({
        template: 'bill_overdue_reminder', householdId: s.household_id, currency: cur, toProfileId: m.profile_id,
        values: [name, `${countWord(OVERDUE_AFTER_DAYS)} days ago`, templateMoney(amount, cur), name],
        dedupeKey: `bill:${s.id}:${s.next_due_date}`,
      });
    }
  }
  return out;
}

/** A reminder this person was sent, read back from its audit row. */
export interface SentReminder { scheduleId: string; occurrence: string; replyWord: string }

/** The reminder a sent bill_due_reminder audit row stands for, or null. */
export function reminderFromAudit(row: { wa_message_id: string; payload?: { params?: unknown[] } | null }): SentReminder | null {
  const m = /:bill:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/i.exec(row.wa_message_id);
  const word = row.payload?.params?.[3];
  if (!m || typeof word !== 'string' || !word.trim()) return null;
  return { scheduleId: m[1], occurrence: m[2], replyWord: word.trim() };
}

/**
 * "paid Rent" / "paid rent 25000" → the name and any amount stated. Null when the
 * message is not a "paid <name>" reply at all.
 */
export function parsePaidReply(text: string): { name: string; amount?: number } | null {
  const m = /^paid\s+(.+)$/i.exec((text ?? '').trim().replace(/[.!]+$/, ''));
  if (!m) return null;
  const amountAtEnd = /^(.*?)\s+(?:rs\.?|inr|₹)?\s*(\d[\d,]*(?:\.\d+)?)$/i.exec(m[1]);
  if (amountAtEnd && amountAtEnd[1].trim()) {
    return { name: amountAtEnd[1].trim(), amount: Number(amountAtEnd[2].replace(/,/g, '')) };
  }
  return { name: m[1].trim() };
}

const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

/** The sent reminders a "paid <name>" reply answers (same name, any case). */
export function matchReminders(name: string, sent: SentReminder[]): SentReminder[] {
  const want = norm(name);
  const seen = new Set<string>();
  return sent.filter((r) => norm(r.replyWord) === want && !seen.has(r.scheduleId) && seen.add(r.scheduleId));
}

/** ISO week key ("2026-W39") for weekly dedupe. */
export function isoWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86_400_000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ── W6b (v10.47.0) — senders for the approved templates that had none ────────────
//
// Each rule is pure and states its trigger in one line. Every one sends only what it
// can state truly, in the household's currency (v10.138.0; until then ₹ templates went to
// INR households only), and a private (excluded) entry is never counted or announced. guardedSend then applies consent (insights / marketing), mutes, the
// approval list, the daily cap and the dedupe slot.

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-09" → "September". */
export function monthName(ym: string): string {
  return MONTH_NAMES[Number(ym.slice(5, 7)) - 1] ?? ym;
}

function daysInMonth(ym: string): number {
  return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
}

function addMonths(ym: string, n: number): string {
  const d = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

// ── split_shared_with_you: a split someone shared with you (alerts job) ──────────
export interface ShareRecipientRow {
  share_id: string; share: number | string; split_id: string; description: string; currency: string;
  total_amount: number | string; owner_user_id: string; recipient_profile_id: string; recipient_household_id: string;
}

/** Each new share of a split → the participant whose number is linked, in the split's currency. */
export function splitSharedAlerts(rows: ShareRecipientRow[], ownerNames: Record<string, string>): PlannedSend[] {
  return rows.filter((r) => String(r.currency ?? '').trim() && Number(r.share) > 0).map((r) => ({
    template: 'split_shared_with_you', householdId: r.recipient_household_id, currency: r.currency.trim(), toProfileId: r.recipient_profile_id,
    values: [ownerNames[r.owner_user_id] || 'Someone', templateMoney(Number(r.total_amount), r.currency), String(r.description ?? '').trim() || 'a shared expense', templateMoney(Number(r.share), r.currency)],
    dedupeKey: `share:${r.share_id}`,
  }));
}

// ── recurring_auto_logged: a schedule that posts itself just did (alerts job) ──────
export interface ScheduleRow { id: string; auto_confirm: boolean; created_by: string | null; txn_template?: { description?: string } | null }

/**
 * An entry the recurring engine posted (it carries recurring_schedule_id) for a
 * schedule that posts WITHOUT approval → the schedule's owner, once. Approval
 * schedules are announced by the bill reminder instead. The dedupe key doubles as
 * the button payload, so "Undo" and "Pause this one" know the entry.
 */
export function recurringLoggedAlerts(input: {
  household: Household; posted: TxnRow[]; schedules: ScheduleRow[]; members: Member[];
}): PlannedSend[] {
  const cur = input.household.base_currency.trim();
  const byId = new Map(input.schedules.map((s) => [s.id, s]));
  const linked = new Set(input.members.map((m) => m.profile_id));
  const out: PlannedSend[] = [];
  for (const r of input.posted) {
    const s = r.recurring_schedule_id ? byId.get(r.recurring_schedule_id) : undefined;
    if (!s || !s.auto_confirm || r.type !== 'expense' || r.extras?.excluded) continue;
    const to = [s.created_by, r.created_by].find((p): p is string => !!p && linked.has(p));
    if (!to) continue;
    const name = String(s.txn_template?.description || r.description || EXPENSE_LABEL[r.category ?? ''] || 'scheduled payment').trim();
    out.push({
      template: 'recurring_auto_logged', householdId: input.household.id, currency: cur, toProfileId: to,
      values: [name, templateMoney(Number(r.amount), cur), dueDayText(r.date)], dedupeKey: `rec:${r.id}`,
    });
  }
  return out;
}

// ── payday_headroom / payday_headroom_variable: a salary landed today (alerts job) ─
export interface FixedBills { count: number; total: number }

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * A salary dated today → its earner (if linked). Headroom = income − the household's
 * fixed monthly bills (active monthly expense schedules, at their template amounts:
 * "at last month's amounts"). Steady pay → payday_headroom; pay that differs from the
 * median of earlier salaries by 5% or more → payday_headroom_variable, which says by
 * how much. No fixed bills, or no room left, → nothing (the copy would be untrue).
 */
export function paydayAlerts(input: {
  household: Household; today: string; salaries: TxnRow[]; earlier: number[]; bills: FixedBills; members: Member[];
}): PlannedSend[] {
  if (input.bills.count < 1) return [];
  const cur = input.household.base_currency.trim();
  const out: PlannedSend[] = [];
  for (const r of input.salaries) {
    if (r.type !== 'income' || r.category !== 'salary' || r.date !== input.today || r.extras?.excluded) continue;
    const member = input.members.find((m) => m.profile_id === r.created_by);
    if (!member?.first_name) continue;
    const income = Number(r.amount);
    const headroom = Math.round((income - input.bills.total) * 100) / 100;
    if (!(headroom > 0)) continue;
    const base = { householdId: input.household.id, currency: cur, toProfileId: member.profile_id, dedupeKey: `payday:${r.id}` };
    const usual = input.earlier.length >= 2 ? median(input.earlier) : null;
    const diff = usual ? Math.round((income - usual) * 100) / 100 : 0;
    if (usual && Math.abs(diff) >= usual * 0.05) {
      out.push({ ...base, template: 'payday_headroom_variable', values: [
        member.first_name, templateMoney(income, cur), `${templateMoney(Math.abs(diff), cur)} ${diff > 0 ? 'more' : 'less'}`,
        templateMoney(headroom, cur), countWord(input.bills.count), templateMoney(input.bills.total, cur),
      ] });
    } else {
      out.push({ ...base, template: 'payday_headroom', values: [
        member.first_name, templateMoney(income, cur), templateMoney(headroom, cur), countWord(input.bills.count), templateMoney(input.bills.total, cur),
      ] });
    }
  }
  return out;
}

// ── household_daily_digest: the evening digest (digest job, 20:30 IST) ────────────
/**
 * One message a day per member, never one per spend. The total and the per-member line
 * count what the app's totals count: no private entries, no transfers, a split at your
 * share.
 * v10.58.0 (owner, 3 Oct) — every household of ONE or more gets it (it was two or more),
 * and a day with nothing logged gets the "nothing logged" message, so the evening
 * message comes every day: `daily_nothing_logged` once Meta approves it
 * (`nothingTemplateLive`), until then the approved digest saying "nothing logged yet"
 * (its original says ₹, so INR households only until its `_v2` is approved). A day with only private entries is not "nothing
 * logged", so it sends nothing.
 */
export const NOTHING_LOGGED_LINE = 'nothing logged yet. Reply here with what you spent, like 450 groceries';

export function dailyDigest(input: {
  household: Household; today: string; txns: TxnRow[]; members: Member[]; names: Record<string, string>; memberCount: number;
  nothingTemplateLive?: boolean;
}): PlannedSend[] {
  if (input.memberCount < 1) return [];
  const todays = txnsFromRows(input.txns.filter((r) => r.date === input.today));
  // "Logged anything today" counts private entries too (a private day is not "nothing logged").
  if (!spendRows(todays.map((t) => ({ ...t, excluded: false }))).length) return nothingLogged(input);
  const cur = input.household.base_currency.trim();
  const rows = spendRows(todays);
  if (!rows.length) return [];
  const byPerson = new Map<string, number>();
  for (const t of rows) byPerson.set(t.created_by ?? '', (byPerson.get(t.created_by ?? '') ?? 0) + effectiveAmount(t, cur, {}));
  const total = Math.round([...byPerson.values()].reduce((a, b) => a + b, 0) * 100) / 100;
  const out: PlannedSend[] = [];
  for (const m of input.members) {
    if (!m.first_name) continue;
    const ranked = [...byPerson.entries()].sort((a, b) => b[1] - a[1]);
    const shown = ranked.slice(0, 4).map(([id, amt]) =>
      `${id === m.profile_id ? 'you' : (input.names[id] || 'someone')} ${templateMoney(Math.round(amt * 100) / 100, cur)}`);
    const line = shown.join(' · ') + (ranked.length > 4 ? ` · +${ranked.length - 4} others` : '');
    out.push({
      template: 'household_daily_digest', householdId: input.household.id, currency: cur, toProfileId: m.profile_id,
      values: [m.first_name, templateMoney(total, cur), String(countSpendEntries(rows)), line], dedupeKey: `digest:${input.today}`,
    });
  }
  return out;
}

function nothingLogged(input: { household: Household; today: string; members: Member[]; nothingTemplateLive?: boolean }): PlannedSend[] {
  const fallback = !input.nothingTemplateLive;
  const cur = input.household.base_currency.trim();
  return input.members.filter((m) => m.first_name).map((m) => ({
    template: fallback ? 'household_daily_digest' : 'daily_nothing_logged',
    householdId: input.household.id, currency: cur, toProfileId: m.profile_id,
    values: fallback ? [m.first_name as string, templateMoney(0, cur), '0', NOTHING_LOGGED_LINE] : [m.first_name as string],
    dedupeKey: `digest:${input.today}`,
  }));
}

// ── month_close_summary: the month just closed (monthly job, on the 1st) ─────────
export function monthClose(input: { household: Household; today: string; txns: TxnRow[]; members: Member[] }): PlannedSend[] {
  if (input.today.slice(8, 10) !== '01') return [];
  const cur = input.household.base_currency.trim();
  const month = addMonths(input.today.slice(0, 7), -1);
  const prior = addMonths(month, -1);
  const inMonth = (ym: string) => input.txns.filter((r) => r.date.slice(0, 7) === ym);
  const spend = spendRows(txnsFromRows(input.txns));
  const spendIn = (ym: string) => spend.filter((t) => t.date.slice(0, 7) === ym);
  const range = (ym: string) => spendByCategoryInRange(spendIn(ym), `${ym}-01`, `${ym}-${String(daysInMonth(ym)).padStart(2, '0')}`, cur, {});
  const cats = range(month);
  const total = Math.round(Object.values(cats).reduce((a, b) => a + b, 0) * 100) / 100;
  if (!(total > 0)) return [];
  const priorTotal = Math.round(Object.values(range(prior)).reduce((a, b) => a + b, 0) * 100) / 100;
  const diff = Math.round((total - priorTotal) * 100) / 100;
  const comparison = priorTotal > 0
    ? (diff === 0 ? `the same as ${monthName(prior)}` : `${templateMoney(Math.abs(diff), cur)} ${diff < 0 ? 'less' : 'more'} than ${monthName(prior)}`)
    : 'nothing to compare with yet';
  const [topCat, topAmt] = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  const biggest = `${EXPENSE_LABEL[topCat] ?? topCat} ${templateMoney(Math.round(topAmt * 100) / 100, cur)}`;
  const days = new Set(inMonth(month).filter((r) => !r.extras?.excluded).map((r) => r.date)).size;
  return input.members.filter((m) => m.first_name).map((m) => ({
    template: 'month_close_summary', householdId: input.household.id, currency: cur, toProfileId: m.profile_id,
    values: [monthName(month), m.first_name!, templateMoney(total, cur), comparison, biggest, `${days} of ${daysInMonth(month)}`],
    dedupeKey: `month:${month}`,
  }));
}

// ── budget_setup_reminder: two days before a month with no budget (monthly job) ──
export function budgetSetup(input: {
  household: Household; today: string; categoriesWithSpend: number; hasNextMonthBudget: boolean; members: Member[];
}): PlannedSend[] {
  const next = addMonths(input.today.slice(0, 7), 1);
  const gap = Math.round((Date.parse(`${next}-01T00:00:00Z`) - Date.parse(`${input.today}T00:00:00Z`)) / 86_400_000);
  if (gap !== 2 || input.hasNextMonthBudget || input.categoriesWithSpend < 1) return [];
  return input.members.filter((m) => m.first_name).map((m) => ({
    template: 'budget_setup_reminder', householdId: input.household.id, currency: input.household.base_currency.trim(), toProfileId: m.profile_id,
    values: [m.first_name!, monthName(next), String(input.categoriesWithSpend)], dedupeKey: `setup:${next}`,
  }));
}

// ── runway_shift_alert / runway_recovered_alert: a real change (monthly job) ──────
export interface RuleState { value: number | null; detail: { lastSent?: string } }

/**
 * Only on a change of half a month or more against the last runway a person was told
 * (or the first one measured), and at most once a calendar month. The first
 * measurement is a silent baseline. Returns the new state to store.
 */
export function runwayAlerts(input: {
  household: Household; monthKey: string; months: number | null; quieterCategory: string | null;
  state: RuleState | null; members: Member[];
}): { sends: PlannedSend[]; state: RuleState | null } {
  if (input.months == null) return { sends: [], state: input.state };
  if (!input.state || input.state.value == null) return { sends: [], state: { value: input.months, detail: {} } };
  const before = input.state.value;
  const delta = Math.round((input.months - before) * 10) / 10;
  if (Math.abs(delta) < 0.5 || input.state.detail.lastSent === input.monthKey) return { sends: [], state: input.state };
  const one = (n: number) => n.toFixed(1);
  const now = input.months;
  const sends: PlannedSend[] = input.members.filter((m) => m.first_name).map((m) => delta < 0
    ? { template: 'runway_shift_alert', householdId: input.household.id, currency: input.household.base_currency.trim(), toProfileId: m.profile_id,
        values: [m.first_name!, one(now), one(before)], dedupeKey: `runway:${input.monthKey}` }
    : { template: 'runway_recovered_alert', householdId: input.household.id, currency: input.household.base_currency.trim(), toProfileId: m.profile_id,
        values: [m.first_name!, one(now), one(before),
          input.quieterCategory ? `A quieter month on ${input.quieterCategory.toLowerCase()}` : 'More left over each month'],
        dedupeKey: `runway:${input.monthKey}` });
  return { sends, state: { value: now, detail: { lastSent: input.monthKey } } };
}
