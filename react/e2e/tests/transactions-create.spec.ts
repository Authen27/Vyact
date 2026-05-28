// ──────────────────────────────────────────────────────────────────────────
// GOLDEN TEMPLATE — Simple (S) tier
// ──────────────────────────────────────────────────────────────────────────
//
// What "Simple" means in our rubric:
//   • Single page, single form
//   • No time manipulation
//   • No cloud env
//   • Cross-module assertion limited to "row appears in list"
//
// Copy this file's STRUCTURE — not its content — when implementing the rest
// of §1 TXN-FC. The shape to preserve:
//
//   1. test.use({ seed }) at the top — `defaultSeed` for everything that
//      needs a household to exist, `seedWith({ override })` when you need
//      a small delta. NEVER mutate localStorage from inside the test body.
//
//   2. One test = one Test Case ID from the inventory, named in the
//      describe-then-test pattern below so failure traces read clean.
//
//   3. Arrange → Act → Assert, with comments calling out each phase.
//
//   4. Assertions use Playwright web-first matchers (toBeVisible, toHaveText,
//      toHaveCount) so they auto-retry. Never `await page.waitForTimeout(N)`
//      — if you reach for it, your locator is wrong.
//
// See e2e/REVIEW_CHECKLIST.md for the full set of reviewer-enforced rules.
// ──────────────────────────────────────────────────────────────────────────

import { test, expect } from '../fixtures/app';
import { defaultSeed } from '../fixtures/seed';

test.describe('§1 TXN-FC · Transaction Creation', () => {
  test.use({ seed: defaultSeed });

  test('CON-E2E-007 · [TXN-FC-001] Step 1: open Add Transaction modal and cancel', async ({
    page, transactions, txnModal,
  }) => {
    // Arrange: open the Transactions page and verify baseline
    await transactions.goto();
    await expect(transactions.row('E2E Salary')).toBeVisible();

    // Act: open Add Transaction modal
    await transactions.openAdd();
    await txnModal.waitOpen();
    await expect(txnModal.dialog).toBeVisible();

    // Act: close via Cancel (POM has fallbacks for obscured buttons)
    await txnModal.cancel();
    await txnModal.waitClosed();
    await expect(txnModal.dialog).toHaveCount(0);
  });
});
