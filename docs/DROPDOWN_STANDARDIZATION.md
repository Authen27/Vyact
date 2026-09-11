# Select-Only Dropdowns

Requested 2026-09-11. Reference: Add Debt -> Type. This supersedes the earlier
searchable category combobox design. Scope: consumer app, not the separate admin.

All active fixed-choice dropdowns use `Select` from `components/ui/Input.tsx`:
native browser selection, no editable text, no new custom values. They share the
same typography, border, chevron, spacing, focus and disabled treatment. Options
and permission/validation rules are retained. Browser/OS popup styling may vary;
it is the same native control in each location, not a simulated menu.

## Fields

| Surface | Fixed-choice fields | Change |
| --- | --- | --- |
| Add/Edit Transaction | Category | Editable combobox replaced with native select |
| Transaction filters | Category / All categories | Editable combobox replaced with native select |
| Add/Edit Recurring Schedule | Category; Pay from / Deposit to / Invest from; Invest into; Owner | Category converted; account, investment and owner chip lists replaced |
| Add/Edit Split | Category; Paid with / Paid into | Category converted; account chips replaced |
| Settings | Date Format; Language; Base Currency; Number System; Payoff Strategy | Separate raw selects migrated and labelled |
| Onboarding | Currency | Separate styled select migrated and labelled |
| Account deletion/move | Move history to | Separate raw select migrated; guard unchanged |
| Split across accounts | Account for each leg | Separate raw select migrated; amounts unchanged |
| Add/Edit Transaction | Loan; source/destination account or investment; Payment mode; Member | Existing shared selects receive unified styling |
| Add/Edit Account | Billing cycle day; Payment due day | Existing shared selects receive unified styling |
| Add/Edit Asset | Type; Liquidity; Currency | Existing shared selects receive unified styling |
| Add/Edit Debt | Type; Currency | Reference shared selects receive unified styling |
| Households | Household type; creation currency; App role; Household role; member role; activity member filter | Existing shared selects receive unified styling |
| WhatsApp connection | Household | Existing shared select receives unified styling; availability unchanged |

Categories retain central IDs, icons, full labels, alphabetical order and
type-scoped options. Saved legacy category values remain representable. Transfers
and investments still have no category. Native type-to-select may jump to a
matching existing option; it never inserts a new value.

Names, descriptions, notes, amounts, dates and invitation emails remain inputs.
Email suggestions are not an allowlist: a person outside the household must still
be inviteable. Short mode/period segments, weekday multi-selection, payment-mode
checkboxes and navigation/action menus are not converted to single-select fields.
The hidden Saved Views menu remains hidden; no removed feature is restored.

## Verification

`category-picker.spec.ts` checks parity against Debt Type, native option selection,
icons/labels, type restrictions, category-free transfers/investments, filters,
Recurring/Split account selection and the five Settings dropdowns. Help capture
uses the new controls so its screenshots and instructions stay aligned.

No financial engine, schema, account identity or permissions change is intended.
Cloud-only membership and WhatsApp actions require deployment verification; local
tests establish component behavior, not live service availability.

Results for this pass:
- Source and E2E typechecks passed; scoped ESLint reported no errors (three
	existing Settings warnings remain).
- The test-mode build and PWA generation passed. The existing bundle-size warning
	remains; the unused Headless UI dependency was removed.
- Five dropdown browser cases passed on the final build (26.7s), including direct
	style comparison to Debt Type on mobile/desktop and both themes.
- Six Help images were refreshed, inspected and validated. All three Help browser
	cases passed (18.1s). The 37 focused category/Help/money unit cases passed.
- Full root CI is NOT green: the consumer run reported 1,021 passed and one failed
	case, `ledgerWorkflow.test.ts`'s legacy-encoded investment buy. The store rejects
	its unresolved `asset:legacy-only` paying account. This test calls the store
	directly, not a dropdown; concurrently changed money-model files were left
	untouched. No failed report was used to regenerate a passing inventory.
- Scoped `git diff --check` passed. No commit or deployment was performed.

Local test preview: `http://127.0.0.1:5185/transactions`.