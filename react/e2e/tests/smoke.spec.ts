import { test, expect } from '../fixtures/app';
import { defaultSeed } from '../fixtures/seed';

// Test scenarios CON-E2E-001..004. See docs/TEST_SCENARIOS.md.
// ── Lane A · Foundation smoke tests ──────────────────────────────────────────
// Prove: (1) the app boots in local-only mode, (2) the determinism + seeding
// fixtures work end to end. Journey tests (add txn, budgets, debts, splits,
// backup/restore, persistence-on-refresh) build on this in Phase 2.

test.describe('App shell (unseeded)', () => {
  test('CON-E2E-001 · boots into the dashboard in local-only mode', async ({ page, dashboard }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FinFlow/);
    // '/' redirects to /dashboard, and the app shell renders (no auth gate,
    // confirming local-only mode — a cloud build would show the sign-in route).
    await page.waitForURL('**/dashboard');
    await expect(dashboard.logoLink).toBeVisible();
  });

  test('CON-E2E-002 · does not render a cloud auth screen', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/\/auth\//);
  });
});

test.describe('Seeded household', () => {
  test.use({ seed: defaultSeed });

  test('CON-E2E-003 · seeded transactions are visible on the Transactions page', async ({ transactions }) => {
    await transactions.goto();
    await expect(transactions.row('E2E Salary')).toBeVisible();
    await expect(transactions.row('E2E Rent')).toBeVisible();
    await expect(transactions.row('E2E Grocery')).toBeVisible();
  });

  test('CON-E2E-004 · seeded data survives a full page reload (persistence guard)', async ({ page, transactions }) => {
    await transactions.goto();
    await expect(transactions.row('E2E Salary')).toBeVisible();
    await page.reload();
    // Regression guard for the v6.4 "data lost on refresh" class of bug.
    await expect(transactions.row('E2E Salary')).toBeVisible();
  });
});
