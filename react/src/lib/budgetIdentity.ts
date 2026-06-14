// Vyact — deterministic budget container identity.
//
// ROOT CAUSE (v9.3.1): a budget's business identity is (household, scope, year,
// month) — enforced in the DB by the partial unique indexes uq_budget_month /
// uq_budget_annual. But the client minted a RANDOM uid() for every new budget,
// so two devices creating "the June budget" produced two different primary keys
// for the same identity slot. The first INSERT wins; the second violates the
// unique index, is retried, and lands in the sync_failed dead-letter — the
// "Account B's budget never syncs" / "each device shows a different budget" bug.
//
// FIX: derive the budget container id DETERMINISTICALLY from its identity, the
// same idempotency principle used for recurring instances (recurringInstanceId).
// Every device computes the SAME id for the same slot, so the write becomes an
// upsert-by-id (ON CONFLICT (id) DO UPDATE) that CONVERGES instead of colliding.
import { deterministicUuid } from './recurring';
import type { BudgetScope } from '../types';

/**
 * The stable id a budget container will always have for a given identity slot.
 * Month budgets key on (household, year, month); annual budgets on (household,
 * year). Same inputs → same UUID on every device, with no DB round-trip.
 */
export function budgetIdentityId(
  householdId: string,
  scope: BudgetScope,
  periodYear: number,
  periodMonth?: number,
): string {
  const slot = scope === 'month' ? `month:${periodYear}:${periodMonth}` : `annual:${periodYear}`;
  return deterministicUuid(`vyact:budget:${householdId}:${slot}`);
}
