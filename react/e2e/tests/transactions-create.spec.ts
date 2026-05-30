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
//      toHaveCount) so they auto-retry. Never `await page.waitForTimeout(N)`.
//
//   5. Assert through the UI by default. Reach into window.__ff_store ONLY
//      for state the UI does not surface as text (e.g. the stored currency
//      code, a duplicate count). Each such use carries a one-line reason.
//
// See e2e/REVIEW_CHECKLIST.md for the full set of reviewer-enforced rules.
// ──────────────────────────────────────────────────────────────────────────

import { test, expect } from '../fixtures/app';
import { defaultSeed } from '../fixtures/seed';

test.describe('§1 TXN-FC · Transaction Creation', () => {
  test.use({ seed: defaultSeed });

  test('CON-E2E-007 · [TXN-FC-001] creates an income transaction with the minimum required fields', async ({
    page, transactions, txnModal,
  }) => {
    // ── ARRANGE ──────────────────────────────────────────────────────────
    await transactions.goto();
    await expect(transactions.row('E2E Salary')).toBeVisible();  // seed sanity

    // ── ACT ──────────────────────────────────────────────────────────────
    await transactions.openAdd();
    await txnModal.waitOpen();
    await txnModal.fill({
      type:        'income',
      amount:      2_500,
      date:        '2026-05-20',
      description: 'TXN-FC-001 Bonus',
      category:    'salary',
    });
    // income requires an account (ACCOUNT_REQUIRED_TYPES); the seed ships
    // 'E2E Checking' — pick it by its bare name (helper handles the prefix).
    await txnModal.selectByValueOrText(txnModal.accountSelect, 'E2E Checking');
    await txnModal.submit();

    // ── ASSERT (UI) ──────────────────────────────────────────────────────
    const row = transactions.row('TXN-FC-001 Bonus');
    await expect(row).toBeVisible();
    await expect(row).toHaveCount(1);

    // ── REGRESSION GUARD — persistence across reload (v6.4 "data lost") ───
    await page.reload();
    await expect(transactions.row('TXN-FC-001 Bonus')).toBeVisible();
  });

  test('CON-E2E-010 · [TXN-FC-002] creates an expense with all optional fields and persists', async ({
    page, transactions, txnModal,
  }) => {
    await transactions.goto();

    await transactions.openAdd();
    await txnModal.waitOpen();
    await txnModal.fill({
      type:        'expense',
      amount:      42.50,
      date:        '2026-05-20',
      description: 'TXN-FC-002 Full',
      category:    'food',
      note:        'all optional fields',
    });
    await txnModal.selectByValueOrText(txnModal.accountSelect, 'E2E Checking');
    await txnModal.submit();

    // Assert through the UI, then confirm it survives a reload.
    await expect(transactions.row('TXN-FC-002 Full')).toBeVisible();
    await page.reload();
    await expect(transactions.row('TXN-FC-002 Full')).toBeVisible();
  });

  test.fixme('CON-E2E-011 · [TXN-FC-003] transfer moves money between two assets', async () => {
    // BLOCKED ON APP UX: the transaction modal exposes a single "Account"
    // picker. A transfer needs a source AND a target account; that second
    // picker does not exist yet. Leaving as fixme (row stays 🟡 in the
    // inventory) rather than asserting a partial transfer. Revisit when the
    // transfer UX lands (tracked alongside Auto-Linking Phase A).
  });

  test('CON-E2E-012 · [TXN-FC-004] investment records its type and account', async ({
    transactions, txnModal,
  }) => {
    await transactions.goto();
    await transactions.openAdd();
    await txnModal.waitOpen();
    await txnModal.fill({
      type:        'investment',
      amount:      123.45,
      date:        '2026-05-20',
      description: 'TXN-FC-004 Invest',
      category:    'investment_in',
    });
    await txnModal.selectByValueOrText(txnModal.accountSelect, 'E2E Checking');
    await txnModal.submit();

    // The row exists and the account chip renders. NOTE: automatic
    // asset linkage (linkedAssetId set + Asset.value moved) is NOT
    // implemented pre-Phase A of the Auto-Linking roadmap, so we do NOT
    // assert it here. When Phase A ships, extend this test (same ID) to
    // assert linkedAssetId + the asset-balance delta.
    await expect(transactions.row('TXN-FC-004 Invest')).toBeVisible();
  });

  test('CON-E2E-013 · [TXN-FC-005] form rejects negative, zero, and non-numeric amounts', async ({
    transactions, txnModal,
  }) => {
    await transactions.goto();
    await transactions.openAdd();
    await txnModal.waitOpen();

    // (a) Negative and zero are caught by the app's `amount <= 0` guard:
    //     the modal stays open and no row is created.
    for (const bad of ['-100', '0']) {
      await txnModal.fill({
        type:        'expense',
        date:        '2026-05-20',
        description: `TXN-FC-005 Invalid ${bad}`,
        category:    'food',
      });
      await txnModal.amountInput.fill(bad);
      await txnModal.selectByValueOrText(txnModal.accountSelect, 'E2E Checking');
      await txnModal.submitButton.click();

      await expect(txnModal.dialog).toBeVisible();                         // blocked
      await expect(transactions.row(`TXN-FC-005 Invalid ${bad}`)).toHaveCount(0);
    }

    // (b) Non-numeric is blocked at the browser layer: a type="number" input
    //     simply refuses letters, so the field cannot even hold "abc".
    await txnModal.amountInput.fill('');
    await txnModal.amountInput.pressSequentially('abc');
    await expect(txnModal.amountInput).toHaveValue('');

    await txnModal.cancel();
  });

  test('CON-E2E-014 · [TXN-FC-007] preserves unicode and emoji in the description', async ({
    page, transactions, txnModal,
  }) => {
    const desc = '🏠 Rent @ 123 Main St — ありがとう €1200';

    await transactions.goto();
    await transactions.openAdd();
    await txnModal.waitOpen();
    await txnModal.fill({
      type:        'expense',
      amount:      10,
      date:        '2026-05-20',
      description: desc,
      category:    'rent',
    });
    await txnModal.selectByValueOrText(txnModal.accountSelect, 'E2E Checking');
    await txnModal.submit();

    // Round-trips byte-for-byte in the rendered row and across a reload.
    await expect(transactions.row(desc)).toBeVisible();
    await page.reload();
    await expect(transactions.row(desc)).toBeVisible();
  });

  test('CON-E2E-015 · [TXN-FC-008] stores the original currency of the transaction', async ({
    page, transactions, txnModal,
  }) => {
    await transactions.goto();
    await transactions.openAdd();
    await txnModal.waitOpen();
    await txnModal.fill({
      type:        'expense',
      amount:      55,
      date:        '2026-05-20',
      description: 'TXN-FC-008 EUR',
      category:    'food',
    });
    await txnModal.selectByValueOrText(txnModal.currencySelect, 'EUR');
    await txnModal.selectByValueOrText(txnModal.accountSelect, 'E2E Checking');
    await txnModal.submit();

    await expect(transactions.row('TXN-FC-008 EUR')).toBeVisible();

    // ORACLE (justified): the stored currency CODE is not rendered as literal
    // text in the row (the Money component shows the € symbol, not "EUR"),
    // so we read it from the store to assert it was persisted as 'EUR'.
    const currency = await page.evaluate(() => {
      const s = (window as { __ff_store?: { getState(): { transactions: { description: string; currency: string }[] } } }).__ff_store;
      return s?.getState().transactions.find(t => t.description === 'TXN-FC-008 EUR')?.currency ?? null;
    });
    expect(currency).toBe('EUR');
  });

  test('CON-E2E-016 · [TXN-FC-009] a rapid double-submit creates only one transaction', async ({
    page, transactions, txnModal,
  }) => {
    const desc = 'TXN-FC-009 DoubleSubmit';

    await transactions.goto();
    await transactions.openAdd();
    await txnModal.waitOpen();
    await txnModal.fill({
      type:        'expense',
      amount:      7,
      date:        '2026-05-20',
      description: desc,
      category:    'food',
    });
    await txnModal.selectByValueOrText(txnModal.accountSelect, 'E2E Checking');

    // Double-click the submit button; the form's `saving` guard should
    // collapse this into a single upsert.
    await txnModal.submitButton.dblclick();
    await txnModal.waitClosed();

    // UI: exactly one row.
    await expect(transactions.row(desc)).toHaveCount(1);

    // ORACLE (justified): a count of stored records is not something the
    // list surfaces directly; read it to harden the dedupe assertion.
    const count = await page.evaluate((d: string) => {
      const s = (window as { __ff_store?: { getState(): { transactions: { description: string }[] } } }).__ff_store;
      return s?.getState().transactions.filter(t => t.description === d).length ?? -1;
    }, desc);
    expect(count).toBe(1);
  });
});
