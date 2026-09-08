import { describe, expect, it } from 'vitest';
import type { RecurringSchedule } from '../../types';
import {
  computeNextDueDate,
  projectRecurringTransactionsForDate,
  scheduleFiresOnDate,
  recurringInstanceId,
  backfillSchedulesFromTransactions,
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
