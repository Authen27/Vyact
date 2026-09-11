import { test, expect } from '../fixtures/app';
import { seedWith } from '../fixtures/seed';

test.use({ seed: seedWith({ goals: [], debts: [], recurringSchedules: [] }) });

test('CAT-FC-001 - Accounts stays reachable under Plan on mobile and desktop', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/budgets');
    const accounts = page.locator('a[href="/accounts"]:visible');
    await expect(accounts).toHaveText('Accounts');
    await accounts.click();
    await expect(page.getByRole('heading', { name: 'Accounts', exact: true })).toBeVisible();
    const cash = page.getByRole('region', { name: 'Cash in Hand', exact: true });
    await expect(cash).toBeVisible();
    for (const name of ['Bank', 'Credit Card']) {
      await expect(page.getByRole('region', { name, exact: true }).getByRole('button', { name: 'Edit Cash in Hand' })).toHaveCount(0);
    }
    const balanceBefore = await cash.locator('.num').innerText();
    await cash.getByRole('button', { name: 'Reconcile', exact: true }).click();
    const reconcile = page.getByRole('dialog', { name: 'Cash in Hand', exact: true });
    await expect(reconcile.getByRole('textbox', { name: 'Cash counted', exact: true })).toBeVisible();
    await reconcile.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(reconcile).toHaveCount(0);
    await expect(page.getByText('Cash balance confirmed', { exact: true }).first()).toBeVisible();
    await expect(cash.locator('.num')).toHaveText(balanceBefore);
  }
});

test('CAT-FC-002 - category search and icon selection stay inside the transaction dialog', async ({ page, txnModal }, testInfo) => {
  for (const theme of ['dark', 'warm']) {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/transactions');
      await page.evaluate(value => document.documentElement.setAttribute('data-theme', value), theme);
      await page.keyboard.press('n');
      await txnModal.waitOpen();
      await expect(txnModal.amountDisplay).toBeFocused();
      const picker = txnModal.dialog.getByRole('combobox', { name: 'Category', exact: true });
      await picker.fill('REPAIRS');
      const option = txnModal.dialog.getByRole('option', { name: 'Repairs & Maintenance', exact: true });
      await expect(option).toBeVisible();
      await expect(option.locator('.category-option-icon')).toHaveText('🔧');
      await option.click();
      await expect(picker).toHaveValue('Repairs & Maintenance');
      await expect(txnModal.dialog.locator('.category-picker-icon')).toHaveText('🔧');
      await picker.fill('does not exist');
      await expect(txnModal.dialog.getByText('No categories found', { exact: true })).toBeVisible();
      await picker.press('Escape');
      await expect(txnModal.dialog).toBeVisible();
      await expect(picker).toHaveValue('Repairs & Maintenance');
      await picker.fill('groceries');
      await picker.press('ArrowDown');
      await picker.press('Enter');
      await expect(picker).toHaveValue('Groceries');
      await expect(picker).toBeFocused();
      await txnModal.setType('income');
      await expect(picker).toHaveValue('Salary');
      await txnModal.setType('investment');
      await expect(picker).toHaveCount(0);
      await txnModal.setType('transfer');
      await expect(picker).toHaveCount(0);
      await txnModal.setType('expense');
      await txnModal.dialog.getByRole('button', { name: 'Show category options' }).click();
      await expect(txnModal.dialog.getByRole('listbox')).toBeVisible();
      await testInfo.attach(`category-${theme}-${width}`, { body: await page.screenshot(), contentType: 'image/png' });
      await picker.press('Escape');
      await txnModal.cancel();
    }
  }
});

test('CAT-FC-003 - recurring and split forms use the same searchable category control', async ({ page }) => {
  for (const surface of [{ path: '/recurring', button: '+ Add Schedule' }, { path: '/splits', button: '+ Add Split' }]) {
    await page.goto(surface.path);
    await page.getByRole('button', { name: surface.button, exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    if (surface.path === '/splits') await expect(dialog.getByRole('textbox', { name: 'Amount', exact: true })).toBeFocused();
    const picker = dialog.getByRole('combobox', { name: 'Category', exact: true });
    await picker.fill('groceries');
    await dialog.getByRole('option', { name: 'Groceries', exact: true }).click();
    await expect(picker).toHaveValue('Groceries');
    await expect(dialog.locator('.category-picker-icon')).toHaveText('🛒');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
});

test('CAT-FC-004 - transaction filters offer All categories through the same control', async ({ page }) => {
  await page.goto('/transactions');
  await page.getByRole('button', { name: /^Filters/ }).click();
  const dialog = page.getByRole('dialog');
  const picker = dialog.getByRole('combobox', { name: 'Category', exact: true });
  await expect(picker).toHaveValue('All categories');
  await picker.fill('salary');
  await dialog.getByRole('option', { name: 'Salary', exact: true }).click();
  await expect(picker).toHaveValue('Salary');
  await picker.fill('All categories');
  await dialog.getByRole('option', { name: 'All categories', exact: true }).click();
  await expect(picker).toHaveValue('All categories');
  await picker.fill('Groceries');
  await dialog.getByRole('option', { name: 'Groceries', exact: true }).click();
  await dialog.getByRole('button', { name: 'Transfer', exact: true }).click();
  await expect(picker).toHaveCount(0);
  await dialog.getByRole('button', { name: 'All', exact: true }).first().click();
  await expect(picker).toHaveValue('All categories');
});