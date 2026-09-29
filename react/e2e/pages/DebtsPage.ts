import type { Page, Locator } from '@playwright/test';

/**
 * Page Object for `/debts`. Add/Edit open DebtFormModal at App root.
 * Recording payments opens the in-page "Record Payment" modal — see
 * the §7 DEBT-FC golden test for the interaction pattern.
 */
export class DebtsPage {
  readonly page: Page;
  readonly addButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addButton = page.getByRole('button', { name: /add debt/i });
  }

  async goto() {
    await this.page.goto('/debts');
    await this.page.waitForURL('**/debts');
  }

  /** Debt card located by its user-supplied `name` (e.g. "Chase Sapphire"). */
  card(name: string): Locator {
    // The name now appears in the list row, the selected card and the detail header;
    // the first match is the list row.
    return this.page.getByText(name, { exact: true }).filter({ visible: true }).first();
  }

  async openAdd() { await this.addButton.click(); }

  async openEdit(name: string) {
    await this.card(name).click();
  }

  /**
   * Click the "Record Payment" trigger inside the debt card. NOTE: selector
   * needs verification after junior runs locally — the trigger is currently
   * a button inline with the debt summary; if it moves to a row menu we
   * switch to getByRole('menuitem', {name: /record payment/i}).
   * TODO(junior): confirm exact accessible name and tighten this locator.
   */
  recordPaymentButton(debtName: string): Locator {
    return this.card(debtName)
      .locator('..')
      .getByRole('button', { name: /record payment/i });
  }
}
