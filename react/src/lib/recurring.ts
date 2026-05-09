// FinFlow v7 — Recurring schedule engine
// Handles weekly / monthly / yearly / custom-day-of-month schedules.
// Computes next-due-date and generates pending transactions when due.

import type { RecurringSchedule, RecurrenceFreq, Transaction } from '../types';
import { uid, today } from './format';

export function computeNextDueDate(
  freq: RecurrenceFreq,
  startDate: string,
  lastGenerated?: string,
  dayOfMonth?: number,
  weekday?: number,
): string {
  const base = new Date(lastGenerated || startDate);
  const next = new Date(base);
  if (freq === 'weekly') {
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
    id: uid(),
    date: schedule.nextDueDate,
    recurring: schedule.frequency === 'custom_day' ? 'monthly' : schedule.frequency,
  } as Transaction;
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
