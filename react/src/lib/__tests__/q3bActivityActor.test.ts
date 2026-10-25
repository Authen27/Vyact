import { describe, expect, it } from 'vitest';
import { formatActivity, type ActivityRow } from '../activityFormat';

// Q3B-001 — v10.131.0 (Track Q3b; audit INT-TXN-14; owner, 20 Oct 2026: "the person, else Vyact"). Since v10.130.0
// the activity log names the person a WhatsApp entry came from; an entry with no actor was written by a scheduled
// job (a bill posted, an EMI recorded) and reads "Vyact (automatic)", never a bare "System".

const ctx = { transactions: [], budgets: [], goals: [], debts: [], assets: [], baseCurrency: 'INR',
  members: [{ userId: 'u-1', name: 'Asha' }] };
const row = (actor_id: string | null, action = 'created'): ActivityRow =>
  ({ id: 'a', actor_id, action, entity_type: 'transactions', entity_id: 't', created_at: '2026-10-25T10:00:00Z' });

describe('the activity log names who acted (INT-TXN-14)', () => {
  it('Q3B-001 · no actor is Vyact on a schedule; a member is named; a delete reads as one', () => {
    expect(formatActivity(row(null), ctx as never).actorName).toBe('Vyact (automatic)');
    expect(formatActivity(row('u-1'), ctx as never).actorName).toBe('Asha');
    const deleted = formatActivity(row('u-1', 'deleted'), ctx as never);
    expect(deleted.tone).toBe('terra');
    expect(deleted.verb).not.toMatch(/updated/);
  });
});
