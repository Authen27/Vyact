// ──────────────────────────────────────────────────────────────────────────
// GOLDEN TEMPLATE — Medium (M) tier
// ──────────────────────────────────────────────────────────────────────────
//
// What "Medium" adds over Simple:
//   • Touches two pages (drives one, asserts on another)
//   • Asserts a derived value (a total, not just row presence)
//   • Uses `parseMoney()` to read formatted figures back to a number
//
// IMPORTANT BEHAVIOUR ASSUMPTION (today, pre-Phase A of the Auto-Linking
// roadmap — see docs/ROADMAP_AUTO_LINKING.md): asset balances are
// user-maintained. A standalone income transaction with NO `linkedAssetId`
// does NOT change `Asset.value`. The cross-module assertion in this golden
// test therefore goes through the `paymentMethod` → asset link that the
// transaction form establishes for accounts that map to an asset.
//
// When Phase A ships and Asset Reflection becomes automatic, this test's
// expected total will become a happy path — DO NOT change the test ID,
// only update the Expected Result block in TEST_CASE_INVENTORY.md.
// ──────────────────────────────────────────────────────────────────────────

import { test, expect } from '../fixtures/app';
import { seedWith, defaultSeed } from '../fixtures/seed';
import { parseMoney } from '../pages/NetWorthPage';

// The default seed already has 'E2E Checking' $8,000 — perfect baseline.
// We just need a member who can be the linked-account payer.
const seed = seedWith({});

test.describe('§4 NWRT-FC · NetWorth Module Impact', () => {
  test.use({ seed });

  test('CON-E2E-009 · [NWRT-FC-002] income to a linked account moves NetWorth total assets', async ({
    page, transactions, txnModal, networth,
  }) => {
    // ── ARRANGE ─────────────────────────────────────────────────────────────
    // Read the seeded "Total Assets" so the assertion is dynamic and survives
    // future seed changes — we assert the DELTA, not a hard-coded total.
    await networth.goto();
    const totalBefore = await networth.readAmount(networth.totalAssetsRow);
    expect(totalBefore).toBeGreaterThan(0);   // seed sanity

    // ── ACT ─────────────────────────────────────────────────────────────────
    await transactions.goto();
    await transactions.openAdd();
    await txnModal.waitOpen();

    // The seeded 'E2E Checking' asset is rendered in the Account dropdown.
    // `selectOption` by VISIBLE label is the most stable cross-version
    // option — the underlying value is the asset's derived id which can
    // change when buildAccounts() in lib/accounts.ts is refactored.
    await txnModal.fill({
      type:        'income',
      amount:      1_000,
      date:        '2026-05-21',
      description: 'NWRT-FC-002 Freelance',
      category:    'salary',
    });
    // Use the robust flexibleSelect helper so this works with native
    // <select> controls and custom combobox widgets.
    await txnModal.flexibleSelect(txnModal.accountSelect, 'E2E Checking');
    await txnModal.submit();

    // ── ASSERT ──────────────────────────────────────────────────────────────
    // Navigate back to NetWorth and read the updated total. Web-first
    // matchers retry, so we don't need to wait for state propagation
    // explicitly — the assertion will retry until the store rehydrates.
    await networth.goto();
    await expect.poll(
      async () => networth.readAmount(networth.totalAssetsRow),
      {
        message: 'Total Assets should reflect the $1,000 deposit',
        timeout: 5_000,
      },
    ).toBeGreaterThanOrEqual(totalBefore + 1_000 - 0.01);  // tolerate FX rounding
  });
});
