# UI Consistency and Help Refresh

Date: 2026-09-11. Scope: recommendations for empty states and app-wide text inputs;
implementation of the Help & Guide refresh. The first two are proposals, not a
claim that every page has been migrated.

## 1. Empty States

Use the existing Splits composition as the reference: a relevant icon, a short
sentence-case heading, one useful explanation and one primary action. Extract
that composition into the existing `EmptyState` component with additive `title`
and `description` props, preserving legacy callers while screens migrate.

| Surface | Heading | Supporting copy | Action |
| --- | --- | --- | --- |
| Splits | No splits yet | Split a shared bill or payout. Keep your share and what others owe in one place. | Add split |
| Debts | No debts tracked | Add an existing loan to track its balance, payments and payoff plan. | Add debt |
| Recurring | No recurring schedules yet | Plan repeating bills or income and choose which entries need your confirmation. | Add schedule |
| Net Worth - Assets | No assets added yet | Add an investment, property or another asset to complete your balance sheet. | Add asset |

- Keep the same centered icon/text/action order, constrained text width, normal
  body type and vertical rhythm. Avoid uppercase monospace explanatory text.
- Use the existing modal/store action, never create records from an empty state.
- Adapt to available width: Assets sits inside a column, not a full-width page.
  No nested decorative cards; the surrounding section owns its layout.
- A debt-free household is valid. No warning colour, pressure to add a debt or
  claim that the household setup is incomplete.
- Distinguish initial emptiness, filter results, loading, permission restrictions
  and load failures. "No matching results" offers Clear filters, not Add.
- Honour permissions. A read-only user sees an explanation instead of an Add
  control that fails after entering data.
- After save, the new record replaces the empty state. Cancel leaves it unchanged.

## 2. Open Text Fields

The current differences come from raw `.input` elements, shared `Input` components
and page-scoped CSS overrides. Converge on `Field` + `Input` / `Textarea`, with
tokens owning appearance rather than per-page classes.

- Visible sentence-case labels; placeholders give examples, never replace labels.
- Inter 16px regular input text, medium labels, zero letter spacing. Preserve
  Outfit headings and JetBrains Mono money figures.
- One inset background, border, radius and padding contract from the Aurora
  control tokens. Single-line controls keep at least 44px touch height.
- Notes/messages use the shared multiline `Textarea`, at least four lines and
  vertically resizable. Names and descriptions remain single-line unless the
  domain genuinely calls for more text.
- Shared focus outline, disabled/read-only distinction and invalid state.
  Associate hints/errors using `aria-describedby`; errors also set `aria-invalid`.
- Use appropriate native `type`, `inputMode`, `autoComplete` and length limits.
  Do not force uppercase or silently rewrite names/descriptions.
- Keep the dedicated money amount field and numeric allocation controls. Do not
  turn categories/accounts into open-text fields: category selection remains the
  searchable icon + full-label picker already approved.
- Migrate a screen at a time and verify initial focus, long text, error recovery,
  mobile keyboard/footer reachability and both themes. No untested global reset.

Help is the first adoption of the shared textarea. Other consumer forms and admin
retain their current presentation until the proposed rollout is approved.

## 3. Help & Guide

Implemented direction:
- Task-oriented questions in Start here, Everyday money, Planning and Access and
  support. Answers distinguish account setup, transactions, cash reconciliation,
  transfers, independent splits, budgets, recurring approval, debt payments and
  investment assets.
- Search matches question, answer, steps, caveats and keywords, including text
  previously hidden inside JSX. Multiword queries require all words, ignoring case.
- Native keyboard-operable disclosures, meaningful headings, direct route links,
  explicit no-result recovery and a visible missing-image fallback.
- Current interface PNGs from isolated fictional data. No screenshots of shared
  user sessions. Each has alt text, actual dimensions, an example-data caption
  and a full-size link.
- Removed legacy Goals/Saved Views instructions, obsolete Pulse formula,
  split-in-transaction guidance and old media references.
- Support follows self-service help, with a top contact shortcut. The form opens
  an email draft and never claims a ticket was submitted. Do not send passwords,
  OTPs or unredacted financial screenshots.
- Document real limitations: cloud/role requirements, non-instant refresh,
  unavailable model service, conditional WhatsApp linking and incomplete backup
  restore guarantees. Help is not certification of deployed integrations.

### Verification

- Five focused content contracts passed: full-text search, stable topics, current
  destinations, retired-copy exclusion and six PNGs with matching dimensions.
- Three Chromium browser cases passed: fictional form capture, Help search and
  task navigation at 390/1440px in both themes, labelled support fields, image
  loading and explicit missing-media fallback. The final recurring capture also
  passed after selecting its paying account.
- Source typecheck, E2E typecheck and scoped lint passed during implementation.
  Production-style test builds completed with PWA generation; Vite retains its
  main-bundle size warning.
- The generated deterministic inventory was refreshed from passing runs:
  1,011 consumer and 20 admin cases across 63 files, with zero skipped cases.
- The root `npm run test:ci` gate passed against the updated inventory, including
  its three inventory-tooling tests.
- This does not verify live cloud budgets, invitations, WhatsApp, model service,
  screen-reader behavior or every user workflow. No email was sent by tests.

### Source and Capture Ownership

- Content: `react/src/lib/helpContent.ts`.
- Presentation: `react/src/pages/Help.tsx`.
- Screenshot metadata: generated `react/src/lib/helpMedia.json`.
- Images: `react/public/help/current/`.
- Capture and browser checks: `react/e2e/tests/help-guide.spec.ts`.
- Focused runner: `react/playwright.help.config.ts`, against a local-only production
  preview at `http://127.0.0.1:5183` (or `HELP_PREVIEW_URL`).

Build using `vite build --mode test` with both Supabase Vite variables explicitly empty in the build process,
then serve that build with `vite preview --host 127.0.0.1 --port 5183 --strictPort`
from `react/`. The test mode is required: an ordinary production build enables a
public cloud fallback even when those variables are empty. Do not run capture
against a cloud-connected build.
Run `playwright test --config playwright.help.config.ts` from `react/`.
Set `UPDATE_HELP_MEDIA=1` for `HELP-FC-001` only when deliberately regenerating
approved guide images; normal tests attach screenshots without modifying sources.
Review the new images, rebuild the local-only bundle to include the new manifest
and PNGs, then run the suite again so it checks the shipped media.

Capture seeds and awaits real IndexedDB on a blank same-origin fixture page before
starting the app. It uses fixed fictional account/member names and no cloud connection.
It opens and fills forms without posting records or contacting email support.
The capture crops the real dialog and temporarily hides the unrelated app root
behind its transparent glass. It does not replace any fields, text or figures.
This prevents background page text bleeding through the guide image; a backdrop
remaining transparent in some modal flows is an observed separate UI issue,
not fixed or certified by these screenshots.
Do not publish a screenshot containing a known incorrect money figure. The
pre-existing animated summary sign issue is outside this refresh, so the capture
uses task forms rather than the misleading Dashboard/Accounts summary tiles.
Development-mode startup was observed replacing the fixture with demo rows; the
exact cause needs separate investigation. The capture uses the repository's
production-style test build and asserts the expected salary and cash balance
instead of silently accepting a reset.
The transaction form's local legacy mode still offers asset-derived account
choices, so the expense example explicitly uses Cash. No rollout flag is changed
by Help or the capture.

### Adoption Follow-through

Assess whether people can finish their first entry, find an existing record,
create a split and understand whether a recurring entry has posted. A Help page
view alone is not adoption. No new analytics or personal query logging was added.
Future measurement should use consent-aware aggregate topic/action events, never
free-text search, support messages or financial details.

When a label, route, account model, approval rule or modal changes, update the
matching answer and recapture its image in the same change. Keep unsupported
features out of Help until their actual entrypoint is available and verified.