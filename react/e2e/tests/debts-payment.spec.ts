// ──────────────────────────────────────────────────────────────────────────
// GOLDEN TEMPLATE — Complex (C) tier
// ──────────────────────────────────────────────────────────────────────────
//
// What "Complex" adds over Medium:
//   • Precision math: interest/principal splits MUST match dinero arithmetic
//     to the cent, not eyeballed decimals. Tolerate ±$0.01 only for the
//     final assertion if the source-of-truth schedule uses banker's
//     rounding (which `lib/amortization.ts` does — see TD-01 notes).
//   • Deep state inspection: we read directly from the in-browser Zustand
//     store via `page.evaluate()` for fields the UI does not surface (the
//     paymentLog entry's `interest` / `principal` breakdown).
//
// DO NOT compute the expected interest/principal in the test by re-deriving
// it from APR — that puts the test and the implementation on the same logic
// and they will silently agree on a bug. Hard-code the dinero-correct value
// from a known-good reference computation (Excel, a calculator, or the
// vitest unit suite under `react/src/lib/__tests__/amortization.test.ts`).
// ──────────────────────────────────────────────────────────────────────────

import { test, expect } from '../fixtures/app';
import { seedWith, sampleCreditCardDebt } from '../fixtures/seed';

const seed = seedWith({ debts: [sampleCreditCardDebt] });

test.describe('§7 DEBT-FC · Debt Payment Cascading', () => {
  test.use({ seed });

  test('CON-E2E-008 · [DEBT-FC-002] payment splits interest and principal at the configured APR', async ({
    page, debts,
  }) => {
    // ── ARRANGE ─────────────────────────────────────────────────────────────
    // Debt: $5,000 balance, 18.5% APR, $150 minimum payment.
    // Expected at the configured APR with monthly compounding:
    //   monthlyRate    = 0.185 / 12     = 0.01541666…
    //   interestPortion = 5000 * monthlyRate = 77.0833…  → $77.08 (banker)
    //   principalPortion = 150 - 77.08 = $72.92
    //   balanceAfter   = 5000 - 72.92 = $4,927.08
    //
    // These numbers come from `react/src/lib/__tests__/amortization.test.ts`
    // (vitest source of truth). NEVER recompute in this file — that puts
    // test and implementation on the same logic.
    const EXPECTED_INTEREST   = 77.08;
    const EXPECTED_PRINCIPAL  = 72.92;
    const EXPECTED_BALANCE    = 4_927.08;

    await debts.goto();
    await expect(debts.card(sampleCreditCardDebt.name)).toBeVisible();

    // ── ACT ─────────────────────────────────────────────────────────────────
    // TODO(junior): the Record Payment trigger is not yet wired in
    // DebtsPage POM. Once `recordPaymentButton(name)` is confirmed
    // against the real UI, replace this block with the modal-driven
    // interaction. For now, we drive the store action directly via
    // page.evaluate(). The assertion is identical either way — that
    // is the point of using the store as our oracle.
    await page.evaluate(({ debtId, amount }) => {
      // Reach into the Zustand store via the well-known global hook —
      // exposed by `src/store.ts` so DevTools can introspect.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const store = (window as any).__ff_store;
      if (!store) throw new Error(
        'window.__ff_store not exposed — add it to src/store.ts under a ' +
        '`if (import.meta.env.MODE !== "production")` guard before running.',
      );
      return store.getState().recordDebtPayment(debtId, amount, '2026-05-22');
    }, { debtId: sampleCreditCardDebt.id, amount: 150 });

    // ── ASSERT ──────────────────────────────────────────────────────────────
    // Inspect the debt's `paymentLog` directly. This is the strictest possible
    // assertion: any drift between displayed and stored values gets caught.
    const log = await page.evaluate(({ debtId }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const debts = (window as any).__ff_store.getState().debts;
      type LogEntry = { interest: number; principal: number; outstandingAfter: number };
      type Debt = { id: string; paymentLog?: LogEntry[] };
      const d = debts.find((d: Debt) => d.id === debtId);
      return d?.paymentLog?.at(-1) ?? null;
    }, { debtId: sampleCreditCardDebt.id });

    expect(log).not.toBeNull();
    // ±0.01 tolerance — banker's rounding at the cent.
    expect(log!.interest).toBeCloseTo(EXPECTED_INTEREST,  2);
    expect(log!.principal).toBeCloseTo(EXPECTED_PRINCIPAL, 2);
    expect(log!.outstandingAfter).toBeCloseTo(EXPECTED_BALANCE, 2);

    // UI assertion — the displayed balance should match. This is a separate
    // assertion (not folded into the page.evaluate) so a UI-formatting bug
    // surfaces independently from a store-math bug.
    await expect(debts.card(sampleCreditCardDebt.name)).toContainText('4,927');
  });
});
