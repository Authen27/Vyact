import { test, expect } from '../fixtures/app';

test('CON-E2E-043 - budget dialog stays in bounds and restores focus to its opener', async ({ page }) => {
  await page.goto('/budgets');
  const opener = page.getByRole('button', { name: '+ Add Budget', exact: true });
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await opener.click();
    const dialog = page.getByRole('dialog', { name: 'Add Budget' });
    await expect(dialog).toBeVisible();
    const title = await dialog.getByRole('heading', { name: 'Add Budget' }).boundingBox();
    const panel = await dialog.boundingBox();
    expect(title).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(title!.y).toBeGreaterThanOrEqual(panel!.y);
    expect(title!.y + title!.height).toBeLessThanOrEqual(panel!.y + panel!.height);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  }
});