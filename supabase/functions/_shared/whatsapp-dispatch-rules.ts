// Vyact WhatsApp — what the scheduler sends, and to whom (W2, v10.42.0).
//
// Pure rules over rows the dispatcher loaded: no Deno, no database, no Meta. Each
// rule returns the sends it wants; `whatsapp-dispatch` hands every one to
// `guardedSend`, which applies consent, mutes, approval, the cap and dedupe.
//
// MONEY: every figure here comes from the server money port
// (`_shared/money/calculations.ts`, parity-tested against the client), or is a
// plain sum/count of rows the port calls reportable. And a rule SKIPS rather than
// guesses:
//   • a household with any spend or limit outside its base currency is skipped —
//     `convert()` treats a missing rate as 1, so a mixed-currency figure could be
//     silently wrong, and there are no rates on the server;
//   • templates with "₹" in the approved text go only to INR households;
//   • a private (excluded) transaction is never announced to anyone.

import { spendByCategoryInRange, reportableTxns, type Transaction } from './money/calculations.ts';

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
  toProfileId: string;
  values: string[];
  dedupeKey: string;
}

export interface TxnRow {
  id: string; household_id: string; created_by: string | null; type: string; amount: number | string;
  currency: string; date: string; description?: string | null; category: string | null;
  account_id?: string | null; to_account_id?: string | null; asset_id?: string | null;
  recurring_schedule_id?: string | null; extras?: { excluded?: boolean; split?: unknown } | null;
  created_at?: string;
}

/** A database row as the money port's Transaction (the client's supabaseAdapter mapping). */
export function rowToTxn(r: TxnRow): Transaction {
  return {
    id: r.id, type: r.type as Transaction['type'], amount: Number(r.amount), currency: String(r.currency).trim(),
    date: r.date, description: r.description ?? '', category: r.category ?? '',
    excluded: r.extras?.excluded, accountId: r.account_id ?? undefined, toAccountId: r.to_account_id ?? undefined,
    assetId: r.asset_id ?? undefined, split: r.extras?.split as Transaction['split'],
  };
}

/** "18,000" / "1,540.50" — en-IN grouping, no symbol (for templates with ₹ in the text). */
export function amountText(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
}

/** "₹600" — with the currency's own symbol (for params whose note says WITH the symbol). */
export function moneyText(n: number, currency: string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function countWord(n: number): string { return WORDS[n] ?? String(n); }

/** The calendar day in the household's zone (IST unless configured). */
export function localDay(now: Date, offsetMinutes = 330): string {
  return new Date(now.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export interface Household { id: string; base_currency: string }
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
  if (household.base_currency.trim() !== 'INR') return [];
  const out: PlannedSend[] = [];
  for (const r of input.txns) {
    if (r.type !== 'expense' || r.recurring_schedule_id || r.extras?.excluded) continue;
    if (String(r.currency).trim() !== household.base_currency.trim()) continue;
    const account = r.account_id ? input.accountNames[r.account_id] : undefined;
    if (!account) continue;
    const amount = Number(r.amount);
    for (const m of input.members) {
      if (m.profile_id === r.created_by) continue;
      if (amount < (input.thresholds[m.profile_id] ?? 10000)) continue;
      out.push({
        template: 'large_transaction_alert', householdId: household.id, toProfileId: m.profile_id,
        values: [amountText(amount), account], dedupeKey: `txn:${r.id}`,
      });
    }
  }
  return out;
}

// ── Budget threshold ────────────────────────────────────────────────────────
export interface BudgetRow { id: string; currency: string; period_start: string | null; period_end: string | null }
export interface AllocationRow { budget_id: string; category: string; amount: number | string }

/** The share of a budget line that sends the alert. Once per line per period. */
export const BUDGET_ALERT_AT = 80;

/**
 * A budget line in the current period that has reached 80% but not 100% → every
 * linked member. Spend is the Budgets screen's own figure: `spendByCategoryInRange`
 * over the budget's period. At 100% the template's "₹… is still in the pot" would
 * be untrue, so nothing is sent.
 */
export function budgetAlerts(input: {
  household: Household; today: string; budgets: BudgetRow[]; allocations: AllocationRow[];
  txns: TxnRow[]; members: Member[];
}): PlannedSend[] {
  const base = input.household.base_currency.trim();
  if (base !== 'INR') return [];
  if (input.txns.some((r) => String(r.currency).trim() !== base)) return [];
  const txns = input.txns.map(rowToTxn);
  const out: PlannedSend[] = [];
  for (const b of input.budgets) {
    if (!b.period_start || !b.period_end || b.period_start > input.today || b.period_end < input.today) continue;
    if (String(b.currency).trim() !== base) continue;
    const daysLeft = daysBetween(input.today, b.period_end);
    if (daysLeft < 1) continue;
    const spend = spendByCategoryInRange(txns, b.period_start, b.period_end, base, {});
    for (const a of input.allocations.filter((x) => x.budget_id === b.id)) {
      const limit = Number(a.amount);
      const spent = spend[a.category] ?? 0;
      if (!(limit > 0)) continue;
      const pct = Math.floor((spent / limit) * 100);
      if (pct < BUDGET_ALERT_AT || spent >= limit) continue;
      const label = EXPENSE_LABEL[a.category];
      if (!label) continue;
      for (const m of input.members) {
        out.push({
          template: 'budget_threshold_alert', householdId: input.household.id, toProfileId: m.profile_id,
          values: [label, String(pct), String(daysLeft), amountText(Math.round((limit - spent) * 100) / 100)],
          dedupeKey: `budget:${b.id}:${a.category}:${BUDGET_ALERT_AT}`,
        });
      }
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
      template: 'split_settled', householdId: s.owner_household_id, toProfileId: s.owner_profile_id,
      values: [s.payer_name.trim(), moneyText(Number(s.share), String(s.split_currency).trim()), s.split_description.trim()],
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
  if (input.txns.some((r) => String(r.currency).trim() !== base)) return null;
  const start = new Date(Date.parse(`${input.today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
  const txns = input.txns.map(rowToTxn);
  const spend = spendByCategoryInRange(txns, start, input.today, base, {});
  const entries = reportableTxns(txns).filter((t) => t.type === 'expense' && t.date >= start && t.date <= input.today).length;
  const cats = Object.entries(spend).filter(([id]) => EXPENSE_LABEL[id]).sort((a, b) => b[1] - a[1]);
  if (!entries || !cats.length) return null;
  const total = Math.round(Object.values(spend).reduce((s, v) => s + v, 0) * 100) / 100;
  return {
    template: 'weekly_summary', householdId: input.household.id, toProfileId: input.member.profile_id,
    values: [moneyText(total, base), String(entries), EXPENSE_LABEL[cats[0][0]]],
    dedupeKey: `weekly:${input.weekKey}`,
  };
}

export interface AccountRow { id: string; created_at: string; last_reconciled_at: string | null }

/** Balances untouched for 30 days or more → a nudge to the opted-in member, weekly at most. */
export function staleBalanceNudge(input: {
  household: Household; now: Date; accounts: AccountRow[]; member: Member; weekKey: string;
}): PlannedSend | null {
  const cutoff = input.now.getTime() - 30 * 86_400_000;
  const stale = input.accounts.filter((a) => Date.parse(a.last_reconciled_at ?? a.created_at) < cutoff).length;
  if (!stale || !input.member.first_name) return null;
  return {
    template: 'balance_stale_nudge', householdId: input.household.id, toProfileId: input.member.profile_id,
    values: [input.member.first_name, countWord(stale)], dedupeKey: `balances:${input.weekKey}`,
  };
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
