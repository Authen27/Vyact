import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for `/budgets`. Add/Edit flows open the global BudgetFormModal
 * (mounted at App root). This POM only navigates and exposes locators —
 * fill the modal via a future BudgetFormModal POM (junior task) once
 * §5 BDGT-FC tests begin.
 *
 * Shape mirrors GoalsPage / DebtsPage so the junior sees a single pattern.
 */
export class BudgetsPage {
  readonly page: Page;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: /add budget/i });
  }

  async goto() {
    await this.page.goto('/budgets');
    await this.page.waitForURL('**/budgets');
  }

  /** Row in the budgets list located by category label (e.g. "Food"). */
  row(category: string): Locator {
    return this.page.getByText(category, { exact: false });
  }

  async openAdd() { await this.addButton.click(); }

  async openEdit(category: string) {
    await this.row(category).click();
  }
}
