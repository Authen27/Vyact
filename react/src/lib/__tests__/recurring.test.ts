import { describe, expect, it } from 'vitest';
import type { RecurringSchedule } from '../../types';
import {
  computeNextDueDate,
  projectRecurringTransactionsForDate,
  scheduleFiresOnDate,
  recurringInstanceId,
  backfillSchedulesFromTransactions,
  rekeyLegacyRecurringIds,
  isStorableId,
  firstDueOnOrAfter,
  nextDueAfterSave,
  isStaleOccurrence,
} from '../recurring';

function makeSchedule(overrides: Partial<RecurringSchedule> = {}): RecurringSchedule {
  return {
    id: 'sched-1',
    transactionTemplate: {
      type: 'expense',
      amount: 1250,
      currency: 'USD',
      description: 'Rent',
      category: 'rent',
      recurring: 'monthly',
    },
    frequency: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-06-05',
    nextDueDate: '2026-07-05',
    autoConfirm: false,
    active: true,
    ...overrides,
  };
}

describe('scheduleFiresOnDate', () => {
  it('matches the configured monthly day after the schedule start date', () => {
    const schedule = makeSchedule();
    expect(scheduleFiresOnDate(schedule, '2026-07-05')).toBe(true);
    expect(scheduleFiresOnDate(schedule, '2026-07-04')).toBe(false);
  });

  it('matches weekly schedules on 7-day cadence from the start date', () => {
    const schedule = makeSchedule({
      frequency: 'weekly',
      startDate: '2026-06-03',
      nextDueDate: '2026-06-10',
      dayOfMonth: undefined,
      transactionTemplate: {
        type: 'income',
        amount: 800,
        currency: 'USD',
        description: 'Allowance',
        category: 'salary',
        recurring: 'weekly',
      },
    });

    expect(scheduleFiresOnDate(schedule, '2026-06-10')).toBe(true);
    expect(scheduleFiresOnDate(schedule, '2026-06-11')).toBe(false);
  });

  it('does not match inactive schedules or dates before the start date', () => {
    const inactive = makeSchedule({ active: false });
    expect(scheduleFiresOnDate(inactive, '2026-07-05')).toBe(false);

    const futureStart = makeSchedule({ startDate: '2026-07-01' });
    expect(scheduleFiresOnDate(futureStart, '2026-06-05')).toBe(false);
  });
});

describe('projectRecurringTransactionsForDate', () => {
  it('projects matching schedules into transaction-shaped rows for a selected future date', () => {
    const rows = projectRecurringTransactionsForDate([makeSchedule()], '2026-07-05');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'projected-sched-1-2026-07-05',
      date: '2026-07-05',
      description: 'Rent',
      amount: 1250,
      note: 'Projected recurring transaction · pending confirm',
      recurring: 'monthly',
    });
  });

  it('normalizes custom-day schedules to monthly recurring rows and respects auto-confirm copy', () => {
    const rows = projectRecurringTransactionsForDate([
      makeSchedule({
        id: 'sched-2',
        frequency: 'custom_day',
        autoConfirm: true,
        dayOfMonth: 18,
        startDate: '2026-06-18',
        nextDueDate: '2026-07-18',
        transactionTemplate: {
          type: 'expense',
          amount: 19.99,
          currency: 'USD',
          description: 'Streaming',
          category: 'subscriptions',
          recurring: 'monthly',
        },
      }),
    ], '2026-07-18');

    expect(rows[0]).toMatchObject({
      recurring: 'monthly',
      note: 'Projected recurring transaction',
    });
  });
});

describe('computeNextDueDate', () => {
  it('advances monthly schedules from the last generated date', () => {
    expect(computeNextDueDate('monthly', '2026-06-05', '2026-07-05', 5)).toBe('2026-08-05');
  });
});

describe('recurringInstanceId · R2 idempotency', () => {
  // CON-UNIT-064 pins the R2 sync fix: a materialised recurring instance gets a
  // deterministic id keyed on (schedule, occurrence-date), so two devices that
  // generate the same due occurrence upsert the SAME cloud row instead of
  // inserting a duplicate. Same seed → same UUID; different date → different id.
  it('CON-UNIT-064 · is deterministic per (schedule, date), distinct across dates, and a valid UUID', () => {
    const a1 = recurringInstanceId('sched-1', '2026-07-05');
    const a2 = recurringInstanceId('sched-1', '2026-07-05');
    const b  = recurringInstanceId('sched-1', '2026-08-05');
    const c  = recurringInstanceId('sched-2', '2026-07-05');
    expect(a1).toBe(a2);             // stable across calls / devices
    expect(a1).not.toBe(b);          // different occurrence-date → different id
    expect(a1).not.toBe(c);          // different schedule → different id
    expect(a1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

// CON-UNIT-087..088 — the recurring-resurrection defect.
//
// A deleted schedule reappeared on the next page load. The delete was never at
// fault: `refresh()` ran `backfillSchedulesFromTransactions` on EVERY load, and
// that function matches transactions to schedules by signature and recreates any
// it cannot find. It has no concept of "the user deleted this", so a deliberate
// deletion looked exactly like a legacy gap.
//
// The sentinel that makes it run once lives in dataSlice; what is pinned here is
// the other half — that the ids it mints are legal for the database. They were
// `bf-${txn.id}`, which is not a UUID, while `recurring_schedules.id` IS a uuid
// column. Every backfilled schedule therefore died on write with 22P02, silently,
// which is why that table is empty in production while schedules show in the app.
describe('backfillSchedulesFromTransactions · ids must be storable', () => {
  const txn = (over: Record<string, unknown> = {}) => ({
    id: '11111111-1111-4111-8111-111111111111',
    type: 'expense', amount: 42, currency: 'GBP',
    date: '2026-01-15', description: 'Netflix', category: 'entertainment',
    recurring: 'monthly',
    ...over,
  }) as never;

  it('CON-UNIT-087 · every backfilled schedule id is a valid UUID', () => {
    const { schedules, added } = backfillSchedulesFromTransactions(
      [txn(), txn({ id: '22222222-2222-4222-8222-222222222222', date: '2026-02-15' })],
      [],
      '2026-03-01',
    );
    expect(added, 'the fixture must actually produce a schedule').toBeGreaterThan(0);
    for (const sch of schedules) {
      expect(sch.id, `id "${sch.id}" must be a UUID the uuid column accepts`)
        .toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      // The old shape, pinned explicitly so a revert is loud.
      expect(sch.id.startsWith('bf-')).toBe(false);
    }
  });

  it('CON-UNIT-088 · the same source transaction always derives the same schedule id', () => {
    // Deterministic, not random: two devices running the migration
    // independently must converge on one row rather than duplicate it.
    const run = () => backfillSchedulesFromTransactions([txn()], [], '2026-03-01').schedules[0].id;
    expect(run()).toBe(run());

    const other = backfillSchedulesFromTransactions(
      [txn({ id: '33333333-3333-4333-8333-333333333333' })], [], '2026-03-01',
    ).schedules[0].id;
    expect(other, 'a different source transaction must derive a different id').not.toBe(run());
  });
});

// CON-UNIT-089..091 — the one-time re-key of unstorable recurring ids.
//
// Two retired generators produced ids that are not UUIDs: \`bf-\${txn.id}\` from
// the backfill, and a base-36 timestamp+random from upsertRecurring. The column
// is \`uuid\`, so every such schedule failed its cloud write with 22P02 and lived
// only in that device's cache — production held zero rows while the app showed a
// full list. The generators were fixed in v10.20.3; this migrates what they left.
describe('rekeyLegacyRecurringIds · make legacy ids storable', () => {
  const sched = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    transactionTemplate: {
      type: 'expense', amount: 999, currency: 'GBP',
      description: 'Netflix', category: 'entertainment',
    },
    frequency: 'monthly', dayOfMonth: 15,
    startDate: '2026-01-15', nextDueDate: '2026-02-15',
    autoConfirm: true, active: true,
    ...over,
  }) as never;

  const txn = (id: string, scheduleId?: string) => ({
    id, type: 'expense', amount: 999, currency: 'GBP',
    date: '2026-01-15', description: 'Netflix', category: 'entertainment',
    recurringScheduleId: scheduleId,
  }) as never;

  it('CON-UNIT-089 · unstorable ids get a UUID and transactions are repointed', () => {
    const legacy = 'bf-11111111-1111-4111-8111-111111111111';
    const out = rekeyLegacyRecurringIds([sched(legacy)], [txn('t1', legacy), txn('t2')]);

    expect(out.remapped.size).toBe(1);
    const fresh = out.remapped.get(legacy)!;
    expect(fresh, 'the new id must be storable').toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(out.schedules[0].id).toBe(fresh);

    // The FK side matters as much: transactions.recurring_schedule_id points at
    // this table, so a rewrite that left them behind would orphan the link.
    expect(out.transactions[0].recurringScheduleId).toBe(fresh);
    // A transaction with no schedule link is untouched.
    expect(out.transactions[1].recurringScheduleId).toBeUndefined();
  });

  it('CON-UNIT-090 · two devices holding the same schedule derive the SAME id', () => {
    // THE REASON THIS IS DETERMINISTIC. Random ids would have device A upload
    // eleven rows and device B upload its own eleven — the duplicate-household
    // pattern again. Deriving from content makes the upsert collapse them.
    const a = rekeyLegacyRecurringIds([sched('bf-aaaa')], []).schedules[0].id;
    const b = rekeyLegacyRecurringIds([sched('legacy-different-id')], []).schedules[0].id;
    expect(a).toBe(b);

    // A genuinely different schedule must not collide.
    const other = rekeyLegacyRecurringIds(
      [sched('bf-cccc', { transactionTemplate: {
        type: 'expense', amount: 500, currency: 'GBP',
        description: 'Spotify', category: 'entertainment',
      } })], [],
    ).schedules[0].id;
    expect(other).not.toBe(a);
  });

  it('CON-UNIT-091 · already-valid ids are untouched and re-running changes nothing', () => {
    const good = '22222222-2222-4222-8222-222222222222';
    const first = rekeyLegacyRecurringIds([sched(good)], [txn('t1', good)]);
    expect(first.remapped.size, 'a storable id needs no migration').toBe(0);
    expect(first.schedules[0].id).toBe(good);

    // Idempotent: the sentinel guards it in production, but the function must be
    // safe to run twice regardless.
    const legacy = 'bf-33333333-3333-4333-8333-333333333333';
    const once = rekeyLegacyRecurringIds([sched(legacy)], []);
    const twice = rekeyLegacyRecurringIds(once.schedules, []);
    expect(twice.remapped.size).toBe(0);
    expect(twice.schedules[0].id).toBe(once.schedules[0].id);

    expect(isStorableId(legacy)).toBe(false);
    expect(isStorableId(good)).toBe(true);
  });
});

// CON-UNIT-092..096 — the occurrence calculus.
//
// Reported 2026-09-08: "the newly added recurring schedule for a different time
// now appears as transaction for current day". Root cause was NOT the engine —
// it was the date the form saved. Recurring.tsx called
// \`computeNextDueDate(freq, startDate, undefined, dom)\`, which always steps ONE
// period on from its base, so editing a schedule that started 2026-05-22 set
// nextDueDate to 2026-06-02 — three months in the PAST. dueSchedules then
// matched it and the engine materialised a back-dated transaction per refresh.
describe('occurrence calculus · a schedule must never be born overdue', () => {
  it('CON-UNIT-092 · CREATE on the 8th for the 20th falls due THIS month', () => {
    // The old computeNextDueDate returned 2026-10-20, silently skipping a month.
    expect(nextDueAfterSave('monthly', { startDate: '2026-09-08', dayOfMonth: 20 }, '2026-09-08'))
      .toBe('2026-09-20');
  });

  it('CON-UNIT-093 · CREATE on the 8th for the 2nd rolls to next month', () => {
    // The 2nd has already passed, so next month is correct here.
    expect(nextDueAfterSave('monthly', { startDate: '2026-09-08', dayOfMonth: 2 }, '2026-09-08'))
      .toBe('2026-10-02');
  });

  it('CON-UNIT-094 · EDIT never moves the due date into the past', () => {
    // THE REPORTED BUG. Original start months ago; the user edits day-of-month.
    const next = nextDueAfterSave(
      'monthly',
      { startDate: '2026-05-22', dayOfMonth: 2, lastGenerated: '2026-09-02' },
      '2026-09-08',
    );
    expect(next > "2026-09-08", next + " must be in the future").toBe(true);
    expect(next).toBe('2026-10-02');

    // And with no generation history it still must not reach backwards.
    const virgin = nextDueAfterSave(
      'monthly', { startDate: '2026-05-22', dayOfMonth: 2 }, '2026-09-08',
    );
    expect(virgin >= '2026-09-08').toBe(true);
  });

  it('CON-UNIT-095 · a 31st clamps to short months instead of rolling over', () => {
    // Feb has no 31st. Rolling into March would move the bill a whole month.
    expect(firstDueOnOrAfter('2026-02-01', 'monthly', { dayOfMonth: 31 })).toBe('2026-02-28');
    expect(firstDueOnOrAfter('2026-04-01', 'monthly', { dayOfMonth: 31 })).toBe('2026-04-30');
  });

  it('CON-UNIT-096 · the engine refuses to invent months of history', () => {
    // Defence in depth for schedules already carrying a corrupt date on device.
    expect(isStaleOccurrence('2026-06-02', '2026-09-08')).toBe(true);
    // A genuine offline gap still catches up.
    expect(isStaleOccurrence('2026-09-01', '2026-09-08')).toBe(false);
  });
});

// CON-UNIT-097 — the v10.20.5 duplication.
describe('rekeyLegacyRecurringIds · re-keying must retire the old key', () => {
  const sched = (id, over = {}) => ({
    id,
    transactionTemplate: {
      type: 'expense', amount: 999, currency: 'GBP',
      description: 'Netflix', category: 'entertainment',
    },
    frequency: 'monthly', dayOfMonth: 15,
    startDate: '2026-01-15', nextDueDate: '2026-02-15',
    autoConfirm: true, active: true,
    ...over,
  });

  it('CON-UNIT-097 · old ids are reported for eviction, and twins collapse', () => {
    // Re-keying changes the PRIMARY KEY, so writing the re-keyed schedule
    // inserts a SECOND row and leaves the original in the cache. v10.20.5
    // shipped without eviction and every schedule appeared twice on the next
    // load; deleting one of the pair left the other behind.
    const out = rekeyLegacyRecurringIds([sched('bf-1'), sched('bf-2')], []);

    expect(out.retiredIds).toContain('bf-1');
    expect(out.retiredIds).toContain('bf-2');

    // Both describe the SAME schedule, so they converge on one id — and must be
    // returned once, not twice, or the migration recreates the duplication it
    // exists to remove.
    expect(out.schedules).toHaveLength(1);
    expect(isStorableId(out.schedules[0].id)).toBe(true);
  });

  it('CON-UNIT-098 · collapsing twins keeps the one that has fired furthest', () => {
    const stale = sched('bf-a', { lastGenerated: undefined });
    const ahead = sched('bf-b', { lastGenerated: '2026-08-15' });
    const out = rekeyLegacyRecurringIds([stale, ahead], []);
    expect(out.schedules).toHaveLength(1);
    // Rewinding to the untouched twin would re-generate August.
    expect(out.schedules[0].lastGenerated).toBe('2026-08-15');
  });
});
