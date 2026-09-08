// Vyact v7 — Recurring schedule engine
// Handles weekly / monthly / yearly / custom-day-of-month schedules.
// Computes next-due-date and generates pending transactions when due.

import type { RecurringSchedule, RecurrenceFreq, Transaction } from '../types';
import { today } from './format';

const DAY_MS = 86_400_000;

// R2 (sync fix): deterministic instance id.
// A materialised recurring instance must get the SAME id on every device for a
// given (schedule, occurrence-date) so that two devices generating the same due
// occurrence upsert the SAME cloud row instead of inserting two — the multi-
// device "duplicate transaction" bug. We derive a stable UUIDv8 from the seed
// via cyrb128, so no randomness and no DB round-trip is needed.
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
/** Stable UUIDv8 (RFC 9562) derived from a seed string. Same seed → same id. */
export function deterministicUuid(seed: string): string {
  const [a, b, c, d] = cyrb128(seed);
  const h = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  let hex = h(a) + h(b) + h(c) + h(d);
  // version 8 (custom) in the 13th nibble; RFC-4122 variant in the 17th.
  hex = hex.slice(0, 12) + '8' + hex.slice(13);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  hex = hex.slice(0, 16) + variant + hex.slice(17);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
/** The deterministic id a given schedule occurrence will always materialise as. */
export function recurringInstanceId(scheduleId: string, occurrenceDate: string): string {
  return deterministicUuid(`vyact:recur:${scheduleId}:${occurrenceDate}`);
}

export function scheduleFiresOnDate(schedule: RecurringSchedule, date: string): boolean {
  if (schedule.active === false) return false;
  if (schedule.startDate && date < schedule.startDate) return false;

  const [, startMonth, startDay] = (schedule.startDate || date).split('-').map(Number);
  const [, viewMonth] = date.split('-').map(Number);
  const dayOfMonth = Number(date.slice(-2));

  switch (schedule.frequency) {
    case 'daily': {
      const diff = Math.round((Date.parse(date) - Date.parse(schedule.startDate)) / DAY_MS);
      return diff >= 0;
    }
    case 'weekly': {
      const diff = Math.round((Date.parse(date) - Date.parse(schedule.startDate)) / DAY_MS);
      return diff >= 0 && diff % 7 === 0;
    }
    case 'monthly':
    case 'custom_day':
      return dayOfMonth === (schedule.dayOfMonth || startDay);
    case 'yearly':
      return viewMonth === startMonth && dayOfMonth === startDay;
    default:
      return false;
  }
}

export function projectRecurringTransactionsForDate(
  schedules: RecurringSchedule[],
  date: string,
): Transaction[] {
  return schedules
    .filter(schedule => scheduleFiresOnDate(schedule, date))
    .map((schedule) => {
      const recurring = schedule.frequency === 'custom_day' ? 'monthly' : schedule.frequency;
      return {
        ...schedule.transactionTemplate,
        id: `projected-${schedule.id}-${date}`,
        date,
        note: schedule.autoConfirm
          ? 'Projected recurring transaction'
          : 'Projected recurring transaction · pending confirm',
        recurring,
      };
    });
}

export function computeNextDueDate(
  freq: RecurrenceFreq,
  startDate: string,
  lastGenerated?: string,
  dayOfMonth?: number,
  weekday?: number,
): string {
  const base = new Date(lastGenerated || startDate);
  const next = new Date(base);
  if (freq === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (freq === 'weekly') {
    next.setDate(next.getDate() + 7);
    if (weekday !== undefined) {
      const diff = (weekday - next.getDay() + 7) % 7;
      next.setDate(next.getDate() + diff);
    }
  } else if (freq === 'monthly') {
    next.setMonth(next.getMonth() + 1);
    if (dayOfMonth) next.setDate(dayOfMonth);
  } else if (freq === 'yearly') {
    next.setFullYear(next.getFullYear() + 1);
  } else if (freq === 'custom_day') {
    next.setMonth(next.getMonth() + 1);
    if (dayOfMonth) next.setDate(dayOfMonth);
  }
  return next.toISOString().split('T')[0];
}

// Returns schedules that are due now or in the past — they need transactions generated
export function dueSchedules(schedules: RecurringSchedule[], now = today()): RecurringSchedule[] {
  return schedules.filter(s => s.active && s.nextDueDate <= now);
}

// Returns schedules upcoming within `leadDays` — for upcoming-bill notifications
export function upcomingSchedules(schedules: RecurringSchedule[], leadDays = 3, now = today()): RecurringSchedule[] {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() + leadDays);
  const cutoffISO = cutoff.toISOString().split('T')[0];
  return schedules.filter(s => s.active && s.nextDueDate <= cutoffISO && s.nextDueDate > now);
}

// Generate a transaction draft from a schedule on its due date
export function generateTransaction(schedule: RecurringSchedule): Transaction {
  return {
    ...schedule.transactionTemplate,
    // R2 (sync fix): deterministic id keyed on (schedule, occurrence-date) so a
    // concurrent generation on another device upserts the same row, not a dupe.
    id: recurringInstanceId(schedule.id, schedule.nextDueDate),
    date: schedule.nextDueDate,
    recurring: schedule.frequency === 'custom_day' ? 'monthly' : schedule.frequency,
    // v9.1 §5 — materialised instances link back to their template and are
    // attributed to the schedule's owner member.
    recurringScheduleId: schedule.id,
    memberId: schedule.ownerMemberId ?? schedule.transactionTemplate.memberId,
    initiatedBy: schedule.ownerMemberId ?? schedule.transactionTemplate.initiatedBy,
  } as Transaction;
}

// v9.1 §5.2 — compose an RFC-5545 RRULE string from the form's simple inputs.
// quarterly is encoded as monthly-interval-3 (the standard). COUNT and UNTIL are
// mutually exclusive; 'never' yields an open-ended rule.
export function buildRRule(
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
  ends: { kind: 'never' } | { kind: 'count'; count: number } | { kind: 'until'; date: string },
): string {
  const base =
    frequency === 'daily'     ? 'FREQ=DAILY;INTERVAL=1' :
    frequency === 'weekly'    ? 'FREQ=WEEKLY;INTERVAL=1' :
    frequency === 'quarterly' ? 'FREQ=MONTHLY;INTERVAL=3' :
    frequency === 'yearly'    ? 'FREQ=YEARLY;INTERVAL=1' :
                                'FREQ=MONTHLY;INTERVAL=1';
  if (ends.kind === 'count') return `${base};COUNT=${ends.count}`;
  if (ends.kind === 'until') return `${base};UNTIL=${ends.date.replace(/-/g, '')}`;
  return base;
}

// After generating, advance the schedule
export function advanceSchedule(schedule: RecurringSchedule): RecurringSchedule {
  const lastGenerated = schedule.nextDueDate;
  return {
    ...schedule,
    lastGenerated,
    nextDueDate: computeNextDueDate(
      schedule.frequency,
      schedule.startDate,
      lastGenerated,
      schedule.dayOfMonth,
      schedule.weekday,
    ),
  };
}

// v7.3 — Backfill RecurringSchedule rows from legacy transactions whose
// `recurring` field is set but never produced a schedule (e.g. txns added
// before v7.0 mirrored every recurring row into a schedule, or rows
// imported from another tool). The Recurring page and the Transactions
// calendar both read from `recurringSchedules`, not `transaction.recurring`,
// so without this backfill those legacy rows show up nowhere as future cost.
export interface BackfillResult {
  schedules: RecurringSchedule[];
  added: number;
}

export function backfillSchedulesFromTransactions(
  transactions: Transaction[],
  existing: RecurringSchedule[],
  now = today(),
): BackfillResult {
  const sigOf = (t: { type?: string; description?: string; recurring?: string; currency?: string }) =>
    `${t.type ?? ''}|${(t.description ?? '').trim().toLowerCase()}|${t.recurring ?? ''}|${t.currency ?? ''}`;

  const seen = new Set<string>();
  for (const s of existing) {
    seen.add(sigOf({
      type: s.transactionTemplate.type,
      description: s.transactionTemplate.description,
      recurring: s.frequency === 'custom_day' ? 'monthly' : s.frequency,
      currency: s.transactionTemplate.currency,
    }));
  }

  const buckets = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (!t.recurring) continue;
    if (t.split?.isSplit) continue;
    if (t.category === 'transfer') continue;
    const sig = sigOf(t);
    if (seen.has(sig)) continue;
    const arr = buckets.get(sig) ?? [];
    arr.push(t);
    buckets.set(sig, arr);
  }

  const added: RecurringSchedule[] = [];
  for (const [, group] of buckets) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    const earliest = sorted[0];
    const latest = sorted[sorted.length - 1];
    const freq = earliest.recurring as RecurrenceFreq;
    if (freq !== 'weekly' && freq !== 'monthly' && freq !== 'yearly') continue;

    const [, , dd] = earliest.date.split('-').map(Number);
    const dayOfMonth = freq === 'monthly' ? dd : undefined;
    let nextDue = computeNextDueDate(freq, earliest.date, latest.date, dayOfMonth);
    while (nextDue <= now) {
      nextDue = computeNextDueDate(freq, earliest.date, nextDue, dayOfMonth);
    }

    const { id: _id, date: _date, ...template } = earliest;
    void _id; void _date;
    added.push({
      // `bf-${earliest.id}` produced ids like `bf-6f0c…` — NOT a valid UUID,
      // and `recurring_schedules.id` is a `uuid` column. Every backfilled
      // schedule therefore failed its cloud write with 22P02 and lived only in
      // the local cache, which is why that table is empty in production while
      // schedules appear in the app.
      //
      // Deterministic rather than random: the same source transaction must
      // always derive the same schedule id, so a device that re-runs the
      // migration (or two devices running it independently) converge on one row
      // instead of duplicating. Same primitive the recurring engine already
      // uses for occurrence ids.
      id: deterministicUuid(`vyact:recur:backfill:${earliest.id}`),
      transactionTemplate: template,
      frequency: freq,
      dayOfMonth,
      startDate: earliest.date,
      nextDueDate: nextDue,
      lastGenerated: latest.date,
      autoConfirm: true,
      active: true,
      reminderLeadDays: 3,
    });
  }

  return { schedules: [...existing, ...added], added: added.length };
}


// ── Legacy id re-key (v10.20.5) ──────────────────────────────────────────────
//
// Two id generators in this app produced values that are NOT UUIDs:
//
//   `bf-${txn.id}`                              — backfillSchedulesFromTransactions
//   Date.now().toString(36) + Math.random()…     — recurringSlice.upsertRecurring
//
// `recurring_schedules.id` is a `uuid` column, so every one of those cloud
// writes died with 22P02 and the schedule lived only in that device's local
// cache. Production held ZERO rows while the app showed a full list. Both
// generators were fixed in v10.20.3; this migrates the rows they already made.
//
// WHY DETERMINISTIC, NOT RANDOM. Each device has its own local copy of the same
// schedules. Random ids would mean device A uploads eleven rows and device B
// uploads its own eleven — the duplicate-household pattern all over again.
// Deriving the id from the schedule's CONTENT makes two devices holding the
// same schedule compute the same id, so the upsert collapses them into one row.
//
// The transaction side matters as much: `transactions.recurring_schedule_id`
// is an FK to this table, and `fkOrNull` in the adapter silently nulls any
// non-UUID — so cloud transactions lost their schedule link entirely. Rewriting
// the schedule id without remapping the transactions would leave that link
// broken locally too, so both are remapped together.

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when an id is storable in a `uuid` column. */
export const isStorableId = (id: string | undefined | null): boolean =>
  !!id && UUID_SHAPE.test(id);

/**
 * The stable identity of a schedule, independent of its id.
 *
 * Deliberately excludes anything that drifts as the engine runs — nextDueDate,
 * lastGenerated, startDate — so a schedule that has fired on one device still
 * derives the same id as the same schedule on a device that has not.
 */
function scheduleSignature(s: RecurringSchedule): string {
  const t = s.transactionTemplate;
  return [
    t?.type ?? '',
    (t?.description ?? '').trim().toLowerCase(),
    t?.currency ?? '',
    String(t?.amount ?? ''),
    s.frequency ?? '',
    String(s.dayOfMonth ?? ''),
    String(s.weekday ?? ''),
  ].join('|');
}

export interface RekeyResult {
  schedules: RecurringSchedule[];
  transactions: Transaction[];
  /** old id → new id, for callers that need to fix up anything else. */
  remapped: Map<string, string>;
  /**
   * The ids that must be EVICTED from local storage.
   *
   * 🔴 Shipping this without eviction is what caused the v10.20.5 duplicates.
   * Re-keying is not an update — the row's primary key changes, so writing the
   * re-keyed schedule INSERTS a second row and leaves the original sitting in
   * the cache under its old id. The next load listed both and every schedule
   * appeared twice; deleting one of the pair left the other behind, which read
   * as "delete doesn't work". The caller must remove these.
   */
  retiredIds: string[];
}

/**
 * Give every schedule whose id cannot be stored a deterministic UUID, and
 * repoint the transactions that referenced it.
 *
 * Pure and idempotent: a schedule that already has a valid UUID is untouched,
 * so running this twice changes nothing the second time.
 */
export function rekeyLegacyRecurringIds(
  schedules: RecurringSchedule[],
  transactions: Transaction[],
): RekeyResult {
  const remapped = new Map<string, string>();

  const rekeyed = schedules.map((s) => {
    if (isStorableId(s.id)) return s;
    const fresh = deterministicUuid(`vyact:recur:rekey:${scheduleSignature(s)}`);
    remapped.set(s.id, fresh);
    return { ...s, id: fresh };
  });

  // Collapse on id. The id is derived from the schedule's CONTENT, so two
  // legacy rows describing the same schedule (the backfill could produce one
  // per matching transaction) land on the same id — and returning both would
  // re-create the very duplication this migration exists to end. Keep the one
  // that has progressed furthest, so a schedule that has already fired is not
  // rewound by an untouched twin.
  const byId = new Map<string, RecurringSchedule>();
  for (const s of rekeyed) {
    const prior = byId.get(s.id);
    if (!prior) { byId.set(s.id, s); continue; }
    const better = (s.lastGenerated ?? '') > (prior.lastGenerated ?? '') ? s : prior;
    byId.set(s.id, better);
  }
  const nextSchedules = [...byId.values()];

  if (remapped.size === 0) {
    return { schedules, transactions, remapped, retiredIds: [] };
  }

  const nextTransactions = transactions.map((t) => {
    const to = t.recurringScheduleId ? remapped.get(t.recurringScheduleId) : undefined;
    return to ? { ...t, recurringScheduleId: to } : t;
  });

  // Two legacy schedules can share a content signature and therefore collapse
  // onto ONE new id — that is the intended convergence, not a fault. Retire
  // every old key regardless; the survivor is keyed by the new id.
  const retiredIds = [...remapped.keys()];

  return { schedules: nextSchedules, transactions: nextTransactions, remapped, retiredIds };
}


// ── Occurrence calculus (v10.20.6) ──────────────────────────────────────────
//
// `computeNextDueDate` answers a different question than the UI needs: it always
// steps ONE period on from its base. That is right after generating an
// occurrence, and wrong everywhere else:
//
//   • CREATE — picking "the 20th" on the 8th gave 2026-10-20. The 20th of THIS
//     month had not happened yet, so the first bill silently skipped a month.
//
//   • EDIT — Recurring.tsx passed `lastGenerated: undefined`, so the base was
//     the schedule's ORIGINAL startDate. Editing a schedule that began
//     2026-05-22 produced nextDueDate 2026-06-02 — three months in the PAST.
//     `dueSchedules` then saw it as due and the engine materialised a
//     back-dated transaction, advancing one month per page refresh:
//     2026-06-02, 2026-07-02, 2026-08-02, 2026-09-02. That is the reported
//     "recurring schedule appears as a transaction for the current day".
//
// The question both paths actually ask is "when does this NEXT fall due, on or
// after some anchor date?" — which is what this function answers. All maths is
// in UTC: the app stores plain YYYY-MM-DD, and local-time `setDate`/`setMonth`
// on a UTC-parsed date drifts a day either side of the date line.

const isoOf = (d: Date): string => d.toISOString().split('T')[0];
const parseISO = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
/** Last day of the given (year, zero-based month) — 31 → 28/29/30 as needed. */
const lastDayOfMonth = (y: number, m0: number): number =>
  new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
}

/** The later of two ISO dates. */
export const maxISO = (a: string, b: string): string => (a >= b ? a : b);

/**
 * The first occurrence of this recurrence on or after `from` (inclusive).
 *
 * Pure and total: it never returns a date before `from`, which is the property
 * that stops a schedule from being born overdue.
 */
export function firstDueOnOrAfter(
  from: string,
  freq: RecurrenceFreq,
  opts: { startDate?: string; dayOfMonth?: number; weekday?: number } = {},
): string {
  // A schedule cannot fire before it starts.
  const anchor = opts.startDate ? maxISO(from, opts.startDate) : from;
  const d = parseISO(anchor);

  switch (freq) {
    case 'daily':
      return anchor;

    case 'weekly': {
      if (opts.weekday === undefined) return anchor;
      const diff = (opts.weekday - d.getUTCDay() + 7) % 7;   // 0 => today counts
      return addDaysISO(anchor, diff);
    }

    case 'yearly': {
      // Same month/day as the start date, this year or next.
      const start = parseISO(opts.startDate ?? anchor);
      const candidate = isoOf(new Date(Date.UTC(
        d.getUTCFullYear(),
        start.getUTCMonth(),
        Math.min(start.getUTCDate(), lastDayOfMonth(d.getUTCFullYear(), start.getUTCMonth())),
      )));
      if (candidate >= anchor) return candidate;
      const y = d.getUTCFullYear() + 1;
      return isoOf(new Date(Date.UTC(
        y, start.getUTCMonth(),
        Math.min(start.getUTCDate(), lastDayOfMonth(y, start.getUTCMonth())),
      )));
    }

    case 'monthly':
    case 'custom_day':
    default: {
      const dom = opts.dayOfMonth ?? parseISO(opts.startDate ?? anchor).getUTCDate();
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      // This month first — the case the old code could not express. A 31st in a
      // 30-day month clamps to the last day rather than rolling into the next.
      const thisMonth = isoOf(new Date(Date.UTC(y, m, Math.min(dom, lastDayOfMonth(y, m)))));
      if (thisMonth >= anchor) return thisMonth;
      const ny = m === 11 ? y + 1 : y;
      const nm = (m + 1) % 12;
      return isoOf(new Date(Date.UTC(ny, nm, Math.min(dom, lastDayOfMonth(ny, nm)))));
    }
  }
}

/**
 * The nextDueDate a schedule should carry after the user saves the form.
 *
 * Never in the past, and never on or before an occurrence already generated —
 * so editing a schedule cannot re-materialise history.
 */
export function nextDueAfterSave(
  freq: RecurrenceFreq,
  opts: { startDate: string; dayOfMonth?: number; weekday?: number; lastGenerated?: string },
  now: string = today(),
): string {
  const floor = opts.lastGenerated
    ? maxISO(now, addDaysISO(opts.lastGenerated, 1))
    : now;
  return firstDueOnOrAfter(maxISO(floor, opts.startDate), freq, opts);
}

/**
 * How far back the engine will still materialise a missed occurrence.
 *
 * A device offline for a few weeks SHOULD catch up — that is the feature. But a
 * schedule carrying a nextDueDate months in the past is corrupt data, not a
 * backlog, and silently inventing half a year of expenses would misstate every
 * month it touches. Past this horizon the engine fast-forwards WITHOUT writing.
 */
export const MAX_CATCHUP_DAYS = 45;

/** True when this occurrence is too old to materialise honestly. */
export function isStaleOccurrence(
  occurrence: string,
  now: string = today(),
  maxDays: number = MAX_CATCHUP_DAYS,
): boolean {
  return (Date.parse(now) - Date.parse(occurrence)) / DAY_MS > maxDays;
}
