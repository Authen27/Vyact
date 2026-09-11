# UI Standardization Pilot

Status: first pilot implemented; category/navigation follow-up verified. Broader pilot checks and visual approval remain pending before broad rollout.

## Included

- Dashboard-only `FEATURES.dashboard.showPulse` and `showDebtSummary` default false for MVP. The corresponding sections are not rendered; the remaining metrics no longer reserve the Pulse column. Financial selectors and liabilities in Net Worth are unchanged.
- Semantic vertical spacing tokens: section 32/48px, heading-to-content 16/24px, group 24/32px, field 16/20px, related 8px and surface inset 16/24px. Desktop step is 1024px. CSS is the value source; Tailwind refers to it.
- The `.ui-pilot` scope applies lighter typography/CTAs and field styling to Dashboard, Transactions, Accounts and the two main forms. Other pages and dialogs retain their existing styling pending review.
- Native-radio segmented controls for transaction type/direction/part-payment choice and account type. Long transaction choices now use labelled category/account/asset/member/loan/payment-mode dropdowns. Existing persistence and the asset-based investment model are unchanged.
- Shared Field can describe hints/errors; dialogs accept an optional presentation class. Existing wrapper APIs remain compatible. Transaction page-object helpers and its keyboard category waypoint now target the new controls.

## Category Consistency Follow-up

The user approved one searchable icon + full-label financial category picker.
`CategoryPicker` uses Headless UI's native combobox behavior and the central
category registry, alphabetical ordering and type-scoped options. Transactions,
recurring, splits and filters now share it. Filters include All categories;
transfers/investments have no category selection. Budget allocations remain amount
rows with readable icon + label display, without changing allocation persistence.
The obsolete `CategoryChip` component is removed. Insights topic navigation is
not financial category selection and is unchanged.

Category popup portals stay inside the owning Radix dialog via `Portal.Group`;
otherwise modal pointer isolation blocks mouse selection. Mouse selection was
checked directly in the browser after correcting this integration.
The dialog defers Escape while the combobox is expanded, so the first Escape
closes its options and the next closes the dialog. Browser tests cover this.

Accounts has been restored under Plan by removing the obsolete Money Map flag
condition from `visiblePages`. The route is now available for all templates in
local and cloud mode, and is shared with command-palette navigation.

Focused unit coverage: `navigationVisibility.test.ts` and `categoryOptions.test.ts`.
Browser coverage: `e2e/tests/category-picker.spec.ts` (CAT-FC-001 through 004).
It runs in normal Lane A and can run against the pilot preview with:

```sh
npm --prefix react exec -- playwright test --config playwright.category.config.ts
```

The first browser run detected a test race with the existing delayed Amount
autofocus; the tests now wait for the intended initial focus before typing into
Category. Do not replace that expectation with arbitrary sleeps.

Installing Headless UI reported 17 npm audit findings in the current dependency
tree. No unrelated audit-fix or breaking dependency upgrade was attempted.

## Follow-up Verification (2026-09-11)

- Six focused category/navigation unit tests passed.
- Four Chromium category/navigation tests passed after the final styling change, with zero retries or skips. Coverage includes Plan visibility at 390/1440px, both themes, mouse/keyboard selection, Escape, type scoping, recurring/split controls and filter reset. These tests do not save transactions.
- Consumer typecheck and E2E-spec typecheck passed. Focused ESLint passed for the new picker, category options/tests, navigation, dialog and the four category consumers.
- Consumer production build passed, including PWA service-worker generation. Vite reported a chunk-size warning for the main bundle; no build errors.
- The full deterministic inventory run passed: 1,006 consumer and 20 admin cases across 62 files, with no failures or skips. Both generated inventory files were refreshed from these results.
- The final root `npm run test:ci` also passed: all 1,026 app cases, three inventory-tooling tests and the generated-inventory drift check.
- The scenario reconciler passed against those reports: 45 browser catalogue IDs in code and 45 in the document. This is catalogue consistency, not execution of those 45 browser workflows.

## Initial Pilot Evidence

- Three Dashboard static-render tests passed with Vitest, including independent feature flags and the expected Net Worth after liabilities. These tests exercise rendering/selectors, not browser focus or geometry.
- Chromium measured Dashboard desktop section gap at 48px, heading weight 500, and absent Pulse/Debt sections.
- Direct browser inspection confirmed the mobile Dashboard, Income radio -> Salary selection, the Account name initial focus, Bank/Credit Card switching and visible form footers. No form was saved in that direct inspection.
- Editor diagnostics reported no errors in the touched components, configuration and page-object files. This is not a completed TypeScript build.
- Initial before/after Dashboard screenshots are under ignored `test-results/ui-pilot/`. The earliest after screenshot predates the preview restart and lacks newly generated Tailwind horizontal-gap utilities; it is not an approval baseline.

## Remaining Pilot Gates

The initial pass was blocked by terminal calls returning no completion evidence. A working persistent shell subsequently completed the checks recorded above. The broader pilot save-flow/viewport harness has not produced `browser-result.json`; its pending checks are not covered by the category suite. Do not approve a release or broad rollout from direct screenshots or deterministic test counts alone.

With the local-only pilot server running at `http://127.0.0.1:5182`, run from the repository root:

```sh
node react/scripts/check-ui-pilot.mjs
npm --prefix react run lint
npm --prefix react run e2e -- --project=chromium keyboard-accessibility.spec.ts dialog-correction.spec.ts
```

The browser harness records Dashboard geometry for both themes at 320/390/768/1024/1440px and a transaction save in a fresh isolated browser context. Use only a local-only fixture; `UI_PILOT_URL` can point at a different local preview. It is not a substitute for keyboard, screen-reader, account-save, 200% zoom or WebKit checks. Add those gates before the pilot is declared complete.

The new Vitest files are classified and the generated inventory is current. Regenerate it after any later test additions, removals or renames; do not hand-edit counts or weaken the drift gate. Existing money invariants/regression/parity passed in the full deterministic run and remain required. No migration, backend, financial engine or investment-account recreation belongs to this pilot.

## Cash Summary Follow-up

Cash in Hand is now a standalone, unframed summary above Bank and Credit Card,
with direct Reconcile, Ledger and rename access. Bank totals/counts exclude cash;
aggregate cash/spendable totals, history-move compatibility and reconciliation
offset/log behavior are unchanged. Cash reconciliation uses "Cash counted" rather
than bank-statement wording. No account is created or migrated by this change.

The existing CAT-FC-001 browser case now checks separation and a no-drift cash
confirmation at 390/1440px, preserving its displayed balance; it passed. All 49
focused account-view and money invariant/regression/engine tests passed. Mobile
and desktop screenshots showed no overlap in the new summary. No unit-test case
was added, removed or renamed, so the generated inventory remains unchanged.

Separate unresolved issue observed before and after this layout change: the
preview shows Cash in Hand $95 and cards $0, but the animated "Spendable now"
summary displays -$95 (desktop "Cash available" also displays -$95). This is not
a new cash-grouping calculation and was not corrected in this UI-only follow-up.
Investigate the summary display path before release; the passing pure-money tests
do not establish correct rendered signs.

## Next Review

Review the spacious Dashboard and representative transaction/account forms in both themes after the remaining pilot checks. Then proceed to shared overlay/navigation work and remaining pages. Analyze routing, the Ask drawer redesign, native-confirm replacement, all-screen spacing rollout, investment creation preselection and admin standardization are not implemented in this first pilot.