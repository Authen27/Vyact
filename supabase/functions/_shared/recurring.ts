// Vyact — server port of the recurring engine's POSTING step (W2b, v10.43.0).
//
// "paid Rent" on WhatsApp must do exactly what tapping Approve in the app does
// (`approveRecurring` in react/src/store/slices/recurringSlice.ts):
//   1. materialise the due occurrence with the SAME deterministic id the app would
//      use (`recurringInstanceId`), so the app and the server can never both
//      create it;
//   2. write the SAME row the app's `txnToRow` would write;
//   3. advance the schedule with the SAME `computeNextDueDate`.
// Posting without advancing would leave the bill due, and the app would ask for it
// again: a double count. The database does 2 and 3 in one transaction
// (`whatsapp_approve_recurring`).
//
// PARITY IS THE CONTRACT: `recurringPort.test.ts` runs these against the client
// originals. The client stays authoritative; if they disagree, this file is wrong.
//
// Time zone: the client's computeNextDueDate uses LOCAL-time Date maths. At +05:30
// (India, no DST) a `YYYY-MM-DD` parsed as UTC midnight is 05:30 the same local
// day, so local and UTC arithmetic agree; this port uses UTC and the parity test
// pins it. A household in a negative-offset zone would need this revisited.

// ── Deterministic occurrence id (client: lib/recurring.ts) ──────────────────
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function deterministicUuid(seed: string): string {
  const [a, b, c, d] = cyrb128(seed);
  const h = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  let hex = h(a) + h(b) + h(c) + h(d);
  hex = hex.slice(0, 12) + '8' + hex.slice(13);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  hex = hex.slice(0, 16) + variant + hex.slice(17);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function recurringInstanceId(scheduleId: string, occurrenceDate: string): string {
  return deterministicUuid(`vyact:recur:${scheduleId}:${occurrenceDate}`);
}

// ── Next due date (client: computeNextDueDate, in UTC — see the header) ─────
export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom_day';

export function computeNextDueDate(
  freq: RecurrenceFreq, startDate: string, lastGenerated?: string, dayOfMonth?: number, weekday?: number,
): string {
  const next = new Date(lastGenerated || startDate);
  if (freq === 'daily') {
    next.setUTCDate(next.getUTCDate() + 1);
  } else if (freq === 'weekly') {
    next.setUTCDate(next.getUTCDate() + 7);
    if (weekday !== undefined) next.setUTCDate(next.getUTCDate() + ((weekday - next.getUTCDay() + 7) % 7));
  } else if (freq === 'monthly' || freq === 'custom_day') {
    next.setUTCMonth(next.getUTCMonth() + 1);
    if (dayOfMonth) next.setUTCDate(dayOfMonth);
  } else if (freq === 'yearly') {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  }
  return next.toISOString().split('T')[0];
}

/** Client: MAX_CATCHUP_DAYS / isStaleOccurrence. Older than this is corrupt data, not a bill. */
export const MAX_CATCHUP_DAYS = 45;
export function isStaleOccurrence(occurrence: string, now: string): boolean {
  return (Date.parse(now) - Date.parse(occurrence)) / 86_400_000 > MAX_CATCHUP_DAYS;
}

// ── The row (client: generateTransaction → txnToRow) ────────────────────────
export interface ScheduleRow {
  id: string; household_id: string; frequency: RecurrenceFreq; start_date: string; next_due_date: string;
  last_generated: string | null; day_of_month: number | null; weekday: number | null;
  auto_confirm: boolean; active: boolean; owner_member_id: string | null;
  txn_template: Record<string, any>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fkOrNull = (v: unknown): string | null => (typeof v === 'string' && UUID_RE.test(v) ? v : null);

/**
 * The transaction row the app would write when this schedule's due occurrence is
 * approved. `created_by` is not here: the database sets it to the approver.
 */
export function occurrenceRow(s: ScheduleRow): Record<string, unknown> {
  const t = s.txn_template ?? {};
  const type = t.type as string;
  const transferClass = type === 'transfer' || type === 'investment';
  const memberId = s.owner_member_id ?? t.memberId;
  const initiatedBy = s.owner_member_id ?? t.initiatedBy;
  const row: Record<string, unknown> = {
    id: recurringInstanceId(s.id, s.next_due_date),
    household_id: s.household_id,
    member_id: memberId || null,
    type,
    amount: t.amount,
    currency: t.currency || 'USD',
    date: s.next_due_date,
    description: t.description,
    category: transferClass ? null : (t.category || null),
    note: t.note || null,
    recurring: s.frequency === 'custom_day' ? 'monthly' : s.frequency,
    account_id: type === 'income' ? null : fkOrNull(t.accountId),
    to_account_id: type === 'expense' ? null : fkOrNull(t.toAccountId) ?? (type === 'income' ? fkOrNull(t.accountId) : null),
    initiated_by: initiatedBy ?? memberId ?? null,
    recurring_schedule_id: s.id,
    debt_id: fkOrNull(t.debtId),
    extras: {
      time: t.time, paymentMethod: t.paymentMethod, excluded: t.excluded, linkedDebtId: t.linkedDebtId,
      linkedTxnId: t.linkedTxnId, split: t.split, emi_split: t.emiSplit,
    },
  };
  if (t.paymentMode !== undefined) row.payment_mode = type === 'investment' ? null : t.paymentMode;
  if (t.assetId !== undefined) row.asset_id = type === 'investment' ? fkOrNull(t.assetId) : null;
  for (const k of ['confidence', 'source'] as const) if (t[k] != null) row[k] = t[k];
  if (t.estimatedAt != null) row.estimated_at = t.estimatedAt;
  if (t.confirmedAt != null) row.confirmed_at = t.confirmedAt;
  // JSON drops undefined: the stored extras match what the client's upsert sends.
  row.extras = JSON.parse(JSON.stringify(row.extras));
  return row;
}

/** The schedule's next due date after posting its current one (client: advanceSchedule). */
export function advancedDueDate(s: ScheduleRow): string {
  return computeNextDueDate(s.frequency, s.start_date, s.next_due_date, s.day_of_month ?? undefined, s.weekday ?? undefined);
}
