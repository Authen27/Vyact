import { describe, it, expect } from 'vitest';
import { budgetIdentityId } from '../budgetIdentity';

// CON-UNIT-065 — pins the deterministic budget container identity that fixes the
// v9.3.0 multi-device budget-sync bug. Two devices creating the SAME period must
// derive the SAME id so the write upserts one row (ON CONFLICT id) instead of
// minting two random ids that collide on uq_budget_month / uq_budget_annual and
// dead-letter. Mirrors the recurringInstanceId idempotency (CON-UNIT-064).

const H1 = '1c859cf7-6a30-4db5-b615-3ecf94c8a02c';
const H2 = '42a2e5c5-5f74-46de-a14a-e8ab9dcc91b1';
const UUID_V8 = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('budgetIdentityId · CON-UNIT-065 deterministic budget identity', () => {
  it('is stable: same slot → same id on every device', () => {
    expect(budgetIdentityId(H1, 'month', 2026, 6)).toBe(budgetIdentityId(H1, 'month', 2026, 6));
    expect(budgetIdentityId(H1, 'annual', 2026)).toBe(budgetIdentityId(H1, 'annual', 2026));
  });

  it('is a valid RFC-9562 UUIDv8', () => {
    expect(budgetIdentityId(H1, 'month', 2026, 6)).toMatch(UUID_V8);
    expect(budgetIdentityId(H1, 'annual', 2026)).toMatch(UUID_V8);
  });

  it('separates distinct slots (month vs month, month vs annual, household, year, month)', () => {
    const jun = budgetIdentityId(H1, 'month', 2026, 6);
    expect(jun).not.toBe(budgetIdentityId(H1, 'month', 2026, 7));   // different month
    expect(jun).not.toBe(budgetIdentityId(H1, 'month', 2025, 6));   // different year
    expect(jun).not.toBe(budgetIdentityId(H2, 'month', 2026, 6));   // different household
    expect(jun).not.toBe(budgetIdentityId(H1, 'annual', 2026));     // different scope
  });

  it('annual ignores month (annual identity is household + year only)', () => {
    // periodMonth is irrelevant for an annual budget; the slot is (household, year).
    expect(budgetIdentityId(H1, 'annual', 2026, 6)).toBe(budgetIdentityId(H1, 'annual', 2026, 11));
  });
});
