import { describe, expect, it } from 'vitest';
import { STAFF_TABLE_LABEL, staffChangeSummary } from '../auditLabels';
import type { StaffAuditRow } from '../adminApi';

// Q7-ADM-001 — admin v1.6.1 (Track Q7; audit OPS-11). A change to Pip's limits (ai_limits, consumer v10.135.0) is in the
// staff audit trail like a change to Pip's model; Staff actions names it and says which numbers moved.

describe("Pip's limits in Staff actions (Q7)", () => {
  it('Q7-ADM-001 · a limits change reads as each number that moved, before → after', () => {
    const row = (r: Partial<StaffAuditRow>): StaffAuditRow => ({ id: 1, at: '2026-10-25T00:00:00Z', actor_id: null, actor_email: null,
      action: 'update', target_table: 'ai_limits', target_id: 'ai_limits', changed: [], detail: {}, ...r });
    expect(STAFF_TABLE_LABEL.ai_limits).toBe("Pip's limits");
    expect(staffChangeSummary(row({ changed: ['cooldown_min', 'global_daily_calls'],
      detail: { before: { cooldown_min: 15, global_daily_calls: 5000 }, after: { cooldown_min: 30, global_daily_calls: 8000 } } })))
      .toBe('cooldown_min 15 → 30 · global_daily_calls 5000 → 8000');
    expect(staffChangeSummary(row({ action: 'insert', changed: [], detail: { after: { cooldown_min: 15 } } }))).toBe('insert');
  });
});
