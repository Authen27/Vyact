# Insights, Ask and Household Reports

Date: 2026-09-11. **All three parts are implemented.** Ask guidance and Reports
corrections shipped in v10.27.0; the Insights merge shipped in v10.29.0.
Verification results are recorded below.
No tax content, financial writer, schema or model-provider change is included.

## Insights: One Personal View

**Implemented in v10.29.0** (`pages/Insights.tsx`, `lib/personalInsights.ts`). Two
tabs, **For You** and **Learn**. Plan is absorbed into For You; the separate Plan tab,
its duplicated desktop recommendation rail and the standalone Planner page are
removed (`/planner` and `?tab=plan` open For You).
For You is the household's review-and-act view. Learn remains the educational
library, not a competing personal recommendation feed.

Proposed order:

1. **Your next steps.** Up to three materially useful actions, ordered by urgency
   and impact. Examples: review an upcoming commitment, inspect a budget category,
   review an expensive debt. Show the relevant period and evidence.
2. **What changed.** Income/spending/category changes, each paired with its next
   useful action rather than an isolated statistic. Include positive progress
   without presenting incomplete data as proof of financial health.
3. **Keep an eye on.** Lower-priority patterns, estimates and data-quality gaps.
   Distinguish an estimate from a recorded figure and show the basis.
4. **Learn about this.** A small contextual link to an appropriate lesson. The
   full library stays under Learn.

Each item has one reading path:

```text
Topic and period
What changed / the verified figure
Why it matters to this household
Review transactions | Open budget | Review debt
```

- Desktop: one readable primary column; an optional narrow rail may show upcoming
  commitments and related learning, not repeat the same recommendations.
- Mobile: the same order in one column, with full labels and 44px action targets.
- Keep Aurora colours and fonts, medium headings, normal body text, and the
  approved 32/48px section spacing. Unframed sections; a repeated insight may be
  framed, but no card inside another card.
- The reel becomes an optional **Review highlights** action. Opening an insight
  should show its evidence and action directly, not force a slideshow.
- Deduplicate using the underlying issue, category/account and period, not title
  similarity. A category-spend observation and a budget warning about the same
  spending should be one item with supporting detail.
- Reuse existing calculators, but verify both engines have the same account,
  allocation, exclusion and period inputs before merging their outputs. They
  currently have different input shapes; a visual merge alone cannot prove parity.
- Preserve existing routes/deep links and existing actions. No new generated
  financial arithmetic or automatic writes. Personal insights remain private.
- Empty means **Not enough recorded activity yet**, not **Your finances are
  healthy**. Likewise, no critical flags is not a health certification.
- Do not reintroduce Goals, Tax or the hidden Dashboard Pulse through the merge.

## Ask: Examples Versus Actions

The old grid mixed direct form shortcuts and immediate model questions. The
updated interface separates them:

| Control | Behaviour |
| --- | --- |
| Use example | Fills and focuses the composer; the user can edit before Send |
| Open form | Opens the existing editor; no model call and no record saved |
| Send | Starts a model-backed turn; unavailable service stays explicitly unavailable |
| Follow-up question | Shows the full question and fills the composer instead of silently sending |
| Show examples | Restores the examples after a conversation has started |
| Voice input | Existing speech-to-text path; browser support and microphone permission still apply |
| Clear history | Existing confirmation and household-scoped transcript clearing; not a ledger action |

The Use example action is now a 16px pencil icon inline with each query title,
not a separate text button. Its borderless 44px target retains the tooltip and
accessible name, and still only fills the composer. Ask (including its drawer
title) and Help use regular-weight headings, labels and controls within their
own presentation scope; font families, input sizes and other pages are unchanged.

Examples are maintained in the existing intent registry. Amounts below are
illustrative in the household currency, not recommended spending targets.

| Task | Example |
| --- | --- |
| Expense | Spent 45 on groceries today |
| Income | Received 5000 salary today |
| Transfer | Transferred 200 from my bank to cash |
| Investment buy | Invested 500 in my index fund |
| Spending | How much did I spend this month? |
| Household overview | How am I doing financially? |
| Net worth | What's my net worth? |
| Budget pressure | Which budgets are at risk? |
| Category review | What are my top spending categories this month? |
| Bills | What are my upcoming bills? |
| Income interruption | How long would my money last without income? |
| Debt payoff | Tell me about my debts and the best payoff strategy. |
| Purchase decision | Can I afford a 1200 purchase? |
| Cut back | Where can I cut back on spending? |

Budget, debt and asset creation remain form-only shortcuts, with sample field
values rather than invented chat commands. Transaction examples may prepare an
editor; the user must check accounts, amounts, dates and any asset before saving.
The examples test supported intent vocabulary, not live provider accuracy.

The extra category-shortcut step was removed. It carried stale category IDs and
competed with the shared searchable category picker. Neutral movements have no
category seed. Pulse is not promoted as the primary household-health question.

Not expanded here: voice cancellation, native-confirm replacement, drawer
navigation/focus architecture, provider availability or the legacy split capture
path. Do not advertise unverified multi-turn or write capabilities.

## Reports: A Family Review

The useful conversation is not "Is this score green?" It is "What is changing,
what is already committed, and what can we decide next?"

| Consultation question | Evidence retained or added | Interpretation limit |
| --- | --- | --- |
| Is income covering spending? | Income/expense trend, surplus/shortfall chart and period table | Cash flow is not an account balance or proof of invested savings |
| What is driving spending? | Category donut/legend, top-category bars, Needs vs Wants | Classification is descriptive; a high needs share is not automatically healthy |
| What do we own and owe? | Current assets, liabilities, Net Worth and liquid assets from the canonical projection | Current position only; do not manufacture historical Net Worth from transactions |
| How much income remains this month? | Current-month income, spending and retained-income percentage | Current month is incomplete; no income means percentage unavailable |
| What payments are already committed? | Tracked minimum debt payments; direct links to upcoming bills and debt payoff | Untracked commitments and card-only minimums are not implied to be included |
| Are we following our plan? | Direct Budget vs actual link to the authoritative budget screen | A new cross-period budget chart needs scope/allocation coverage, not duplicated arithmetic |
| Who and which accounts contributed? | All-time member/account tables with consistent reportable entries and FX | Attribution is not blame; account net flow is not its current balance |

### Corrections

- Needs/Wants container and full amount rows wrap at narrow widths; chart grid
  tracks can shrink. Category legends retain full labels in a scrollable list,
  and category bars stack their tracks below labels on narrow layouts.
- Removed "solid/balanced" health judgements based only on needs percentage.
- Unclassified spending is shown explicitly rather than disappearing from the
  mix. Negative current-position values and cash-flow details retain their signs.
- Reports plots render their geometry immediately. A live preview showed animated
  pie groups with data but no visible sectors; the report-only nonanimated donut
  resolves that display failure without changing Dashboard donut animation.
- Calendar buckets now have valid month/quarter ends and do not skip February
  when today is the 31st. Excluded, transfer and reconciliation rows use the same
  reportability rule as the rest of the app.
- Income is attributed to the receiving account, expenses to the paying account;
  missing accounts remain unassigned. The full ledger already loaded by Reports
  now drives all breakdowns, removing a duplicate cloud path with inverse FX and
  stale same-row-count refresh risks.
- Chart-window dates are explicit; all-time headings/breakdowns remain labelled
  separately. Current position and current-month figures do not masquerade as
  historical rolling-window data.
- Tax is excluded. No financial-health score or invented target is added.

### Further Product Work

Originally listed for a fuller consultation: a single date-range filter across all
flow views; budget-versus-actual trends by matching scope; essential-spend runway
using a stated completed-month baseline; an approval-aware bill calendar; and
historical Net Worth only after reliable valuation/balance history exists. Each
needs its own calculation or data contract. They were taken up after v10.29.0, and
this table records each contract as it ships.

| Item | Status | Contract |
| --- | --- | --- |
| Historical Net Worth | **Recording since v10.30.0.** The history chart appears once two months are recorded. | One snapshot per household per month (`net_worth_snapshots`). The first write for a month wins, and only for the current month in the household currency. Snapshots are taken from the canonical projection, and in cloud mode only after this session has confirmed the inputs with the cloud. History is recorded, never reconstructed, because standalone assets and debts keep only their current value. |
| Single date range across all flow views | Next | Not yet defined |
| Budget-versus-actual trends by matching scope | Next | Not yet defined |
| Essential-spend runway | Next | A stated completed-month baseline (not yet defined in detail) |
| Approval-aware bill calendar | Next | Not yet defined |

## Verification

Unit coverage pins calendar boundaries, central FX, neutral/excluded entries,
income attribution, missing-account handling and sample-intent vocabulary.
Browser coverage uses a local-only test-mode build and awaited IndexedDB fixture;
it exercises wide amounts at 320/390/768/1024/1440px, period controls, every Ask
example and form shortcut, and follow-up editing without provider calls.
Live model/WhatsApp/cloud permissions are not certified by these checks.

Results for this pass:
- Nine new unit cases passed; existing Ask/category and money/Net Worth regression
  suites also passed.
- Four Chromium browser cases passed on the final build (25.6s), covering actual
  chart geometry, full amounts at all five widths, negative Net Worth, unclassified
  spending, every example/form shortcut, the embedded drawer and editable follow-ups.
  Their catalogue IDs are `FIN-FC-001` through `FIN-FC-004`.
- Source and E2E typechecks, scoped lint and the production-style test build passed,
  including PWA generation. The existing main-bundle size warning remains.
- Generated inventory update and root `test:ci` passed: 1,040 app cases in 65 files,
  plus three inventory-tooling tests. Catalogue reconciliation and `git diff --check`
  passed. No skipped cases were used to reach these results.
- Final test screenshots were inspected at mobile and desktop widths; the category
  donut is visible and the full Needs/Wants amounts remain inside their container.

### Insights merge (v10.29.0)

- **Unit:** ten `personalInsights` cases cover:
  - an empty household;
  - merging by issue and period, and deduplication that does not rely on titles;
  - allocation budgets over their own period with central FX;
  - account-aware investment values, counted once;
  - withdrawals and private rows kept out of the contribution rate;
  - active schedules as the source of repeating bills;
  - the three-item cap on next steps, with no duplicates and deterministic output;
  - estimates marked, including on highlight cards;
  - no Tax, Goals or Pulse, and future or private entries ignored without mutating inputs.

  The generated inventory reads 1,068 passing cases in 68 files.
- **Browser** (Chromium, local-only test build):
  - `INS-FC-001` at 390 and 1440px:
    - only the For You and Learn tabs;
    - one to three next steps, each with an action and its 2026-05 period;
    - Calculation basis and Learn about this present;
    - no Pulse, Tax or "healthy" wording, unique item titles, and no horizontal scroll.
  - `INS-FC-002`:
    - Review highlights opens and closes the reel, and focus returns to the button;
    - the arrow keys move to Learn and update `?tab=learn`;
    - `/planner` and `?tab=plan` open For You.
  - `INS-FC-003`: a household with only a transfer sees Not enough recorded activity yet, with no next steps, no highlights and no health verdict. A household with no transactions at all would get the local demo data instead.
- **Smoke:** `CON-E2E-041` passes with `/planner` removed from its route list, because it now redirects. `CON-E2E-040`, `011` and `042` fail identically on an origin/main build, so they predate this change (TD-29).
- **Release gate:** 13 of 13 steps, 238 of 238 scenarios.

### Net Worth history recording (v10.30.0)

- **Unit:** seven `netWorthSnapshots` cases:
  - a snapshot comes from the canonical projection, rounded, with net worth derived from the two sides;
  - only a loaded, non-empty position is recorded, for a month not yet recorded;
  - the first write wins and months stay ordered;
  - history is drawn only from two or more months in the household currency;
  - the local adapter keeps the first write;
  - the cloud adapter sends the two sides and the first of the month (never net worth), maps the stored row, and surfaces read errors.

  The generated inventory reads 1,075 passing cases in 69 files.
- **Browser** (Chromium, local-only test build, `e2e/tests/networth-history.spec.ts`):
  - `NWH-FC-001`: the month is recorded once from the loaded position (1,500), and a reload does not add a second row.
  - `NWH-FC-002`: an earlier recorded month makes the chart draw both months.
  - `NWH-FC-003`: a month recorded in another currency is counted but not drawn.
- **Existing specs on the same page:** `networth-assets` and smoke fail exactly the same tests as origin/main (ASSET-FC-001/002/004 and NWRT-FC-004; CON-E2E-040/011/042), so this change introduces no new failures (TD-29).
- **Production pre-check (read-only):**
  - `is_member`, `role_in` and `households.base_currency` exist;
  - the table and the recorder did not exist yet, and the latest applied migration was 20260911120000;
  - the live `erase_household_data` body matched the repository line for line, apart from the added delete;
  - its grants had no anon or public.
- **Release gate:** 13 of 13 steps and 238 of 238 scenarios passed.

Local review: `http://127.0.0.1:5182/reports` and `http://127.0.0.1:5182/chat`.
The isolated browser runner uses the existing test-mode preview on port 5183.
No commit, deployment or live-provider request was made for this work.