# Vyact — v9.0.1 Feedback: Triage & Solution Spec

```yaml
meta:
  doc_type: pm_triage + solution_architecture
  audience: product + engineering
  baseline: consumer v9.0.1
  source: large feedback batch (9 distinct items) post-v9.0.1
  companion: vyact-v9-developer-investigation-prompt.md  (the two deep-dive bugs)
  authority: BINDING for the build/remove items; INVESTIGATE-FIRST for the bugs
```

This document wears both hats. For each feedback item it gives a **PM verdict** (what to do and why it matters), then an **architect spec** (data model, files, acceptance) precise enough to build from. Two items need a code-level root-cause pass first — those are handed to the companion developer prompt rather than guessed at.

---

## §0 — SECURITY (read first, act first)

```yaml
incident:
  what: "A live Google OAuth client secret was shared in plaintext in the feedback."
  severity: HIGH
  required_action:
    - "ROTATE the secret now in Google Cloud Console → Credentials (regenerate)."
    - "Store the new secret ONLY in the Supabase dashboard (Auth → Providers → Google). Never in the repo, .env committed files, or any doc."
    - "The Client ID is not sensitive and may live in config; the secret never does."
  note: "This spec references the SSO config by role, never by secret value."
```

---

## §1 — Triage Scorecard

| # | Item | Verdict | Type | Priority | Where it's handled |
|---|---|---|---|---|---|
| 1 | Google SSO integration | **FIX + FINISH** | Config + un-stub | P0 | §3 |
| 2 | Budgets diverge across two devices (same login) | **INVESTIGATE** | Bug | P0 | Dev prompt → Investigation A |
| 3 | Recurring ↔ Transaction confusion; RRULE; owner; remove toggle | **BUILD** | Feature (major) | P1 | §5 |
| 4 | Can't create/manage "owed to me" debt (receivable) | **INVESTIGATE + BUILD** | Bug/Gap | P1 | §6 + Dev prompt → Investigation B |
| 5 | Remove split-among-accounts from form + DB | **REMOVE** | Deletion | P2 | §7 |
| 6 | Click a budget → its transactions | **BUILD** | Feature | P2 | §8 (unified) |
| 7 | Budgets by month+year / annual / custom; sub-allocations; recurring forecast | **BUILD** | Feature (major) | P1 | §4 |
| 8 | Click a debt → its payments/EMIs | **BUILD** | Feature | P2 | §8 (unified) |
| 9 | Dashboard month income/expense → month-filtered Transactions | **BUILD** | Feature | P2 | §8 (unified) |

---

## §2 — Two architectural consolidations (do not build these as 9 separate tickets)

A good chunk of this list collapses into two coherent pieces of work. Build the shared mechanism once.

```yaml
cluster_A_unified_transaction_deeplink:
  covers: [item 6, item 8, item 9]
  insight: >
    "Click X → see the transactions behind X" is ONE feature, not three. Budget
    drill-down, debt drill-down, and dashboard-month drill-down are all "open the
    Transactions view pre-filtered to a context." Build a single query-param filter
    contract; all three fall out of it. See §8.

cluster_B_budget_data_model:
  covers: [item 2, item 7]
  insight: >
    The cross-device budget bug (item 2) is most likely rooted in fuzzy or
    per-device budget period identity / local overlays. Item 7's redesign gives
    budgets a STRICT identity (scope + year + month) and proper cloud-synced
    allocation rows. Fixing the data model for item 7 likely removes the class of
    bug in item 2 — BUT item 2 still gets a root-cause pass first (don't assume the
    redesign fixes a bug you haven't diagnosed). Sequence: investigate item 2,
    then build item 7 on a clean diagnosis.
```

---

## §3 — Item 1: Google SSO (FIX + FINISH)

```yaml
status_today:
  - "GoogleButton exists (v6.6.0 / v7.0.1), gated on isCloudEnabled, shows a 'coming soon' toast."
  - "The provider was never configured in Supabase → the button is a stub."
  verdict: "This is a config task + un-stubbing, not a new build. Most of the work is in dashboards, not code."
```

### §3.1 — The configuration the feedback got wrong (correct these)

The provided config conflates two different redirect concepts. With Supabase-brokered OAuth there are **two** redirect URLs and they are not interchangeable:

```yaml
correct_config:
  google_cloud_console:
    authorized_redirect_uris:
      MUST_BE: "https://<PROJECT_REF>.supabase.co/auth/v1/callback"
      why: >
        Google sends the auth code to Supabase's callback, NOT to the app. The
        provided 'https://vyact-twentyx.vercel.app/dashboard' is WRONG here — that
        is the app's post-login destination, not Google's redirect target. This is
        the single most common reason Supabase Google SSO fails with redirect_uri_mismatch.
    authorized_javascript_origins:
      - "https://vyact-twentyx.vercel.app"          # correct as provided
      - "http://localhost:5173"                      # dev — NOTE: http, port 5173 (repo dev port), not 'https://localhost:5200'
      flag: "The provided 'https://localhost:5200' is suspect — Vite dev is http on 5173 per CLAUDE.md. Confirm the actual dev origin; mismatched origin silently blocks the button locally."
  supabase_dashboard:
    auth_providers_google: "paste Client ID + (rotated) secret here — the ONLY home for the secret."
    auth_url_configuration_redirect_allowlist:
      - "https://vyact-twentyx.vercel.app/**"
      - "http://localhost:5173/**"
      why: "The app's post-OAuth redirectTo must be allowlisted here or Supabase rejects it."
  app_code:
    call: "supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })"
    redirectTo: "https://vyact-twentyx.vercel.app/dashboard  (this is where the app's redirect belongs — and it must be in the Supabase allowlist above)"
    recommendation: >
      Prefer a dedicated '/auth/callback' route that completes the session then
      routes to /dashboard, rather than landing OAuth directly on /dashboard.
      Cleaner session handling and avoids AuthGate race on the hash fragment.
```

### §3.2 — Code change (un-stub)

```yaml
files:
  - "components/auth/GoogleButton (or wherever the button lives): remove the 'coming soon' toast; call the real signInWithOAuth with redirectTo."
  - "AuthGate / a new pages/auth/Callback.tsx: handle the returning session (exchange/Detect session from URL), then navigate to /dashboard."
  - "config: PROJECT_REF / Supabase URL already in .env.production (public); no secret in code."
acceptance:
  - "Clicking 'Continue with Google' on Sign In and Sign Up opens the Google consent screen (no 'coming soon' toast)."
  - "After consent, the user lands authenticated on /dashboard with a valid session that survives refresh."
  - "A brand-new Google user gets a household created (the auth-method-agnostic onboarding trigger from v8.0.0 already keys off household state, not auth method — verify it fires for OAuth signups)."
  - "Works on prod origin; local dev works on the confirmed dev origin."
  - "The secret exists only in the Supabase dashboard."
```

---

## §4 — Item 7: Budget redesign (BUILD, major) — month+year / annual / custom + allocations + recurring forecast

This is the largest build and the highest-value one. It also fixes the "which month am I even looking at?" vagueness the user called out.

```yaml
PM_framing:
  problem: >
    "Monthly" budgets have no explicit identity — the user can't tell which month a
    budget tracks, there's no timeline, and there's no way to budget for an annual
    horizon or a one-off goal like a trip. Category-level control is missing.
  user_value: >
    A budget the household can trust and navigate: "June 2026 vs last month," "our
    2025 annual plan," "the Maldives trip envelope," each with per-category limits
    and a forecast of what's already committed via recurring payments.
  PRODUCT_FLAG: >
    ⚠ This REINTRODUCES sub-category allocations, which were deliberately REMOVED in
    v8.8.0 (the Budget.allocations jsonb + column were dropped). The removal was a
    simplification call; this is genuine, specific user demand to bring them back.
    Recommendation: reintroduce — but as a proper cloud-synced CHILD TABLE, not the
    dropped jsonb (the jsonb was per-budget-row and harder to sync cleanly; a child
    table is row-synced and cross-device-safe, which also helps the item-2 bug class).
    Confirm the product owner accepts the re-add before building.
```

### §4.1 — Data model

```yaml
budgets_table_changes:
  scope:
    type: "text NOT NULL"
    enum: [month, annual, custom]
  period_year:   "int  — set for month & annual; NULL for custom"
  period_month:  "int 1..12 — set for month only; NULL for annual & custom"
  custom_name:   "text — set for custom only (e.g. 'Maldives Trip'); NULL otherwise"
  period_start:  "date — RESOLVED range start (reuse TD-13 column)"
  period_end:    "date — RESOLVED range end   (reuse TD-13 column)"
  resolution_rule: >
    month  → period_start = first day of (period_year, period_month); period_end = last day of that month.
    annual → period_start = Jan 1 period_year; period_end = Dec 31 period_year.
    custom → period_start/period_end = user-entered range; custom_name required.
  identity_constraint: >
    UNIQUE (household_id, scope, period_year, period_month) for scope='month';
    UNIQUE (household_id, scope, period_year) for scope='annual'.
    Custom budgets are identified by id (multiple allowed). This strict identity is
    what makes a budget the SAME budget on every device (relevant to item 2).

budget_allocations_table_NEW:   # the reintroduced allocations, done right
  columns:
    id, budget_id (fk), household_id (RLS), category (text), amount (numeric),
    created_at, updated_at
  rules:
    - "Σ allocation.amount ≤ budgets.amount (the parent). Show allocated vs unallocated; warn if exceeded (do not hard-block — warn)."
    - "category ∈ the type-scoped expense categories (CATEGORIES_BY_TYPE)."
  sync: "First-class adapter entity ('budgetAllocations') — row-synced + RLS, NOT a jsonb blob. This is the cross-device-safe choice."
```

### §4.2 — Behaviour

```yaml
behaviour:
  scope_picker: "Budget create form leads with scope: Month / Annual / Custom."
  month_budget: "Pick month + year explicitly (e.g. June 2026). Header always shows 'June 2026', never bare 'Monthly'."
  annual_budget: "Pick year (e.g. 2025)."
  custom_budget: "Name + date range (e.g. 'Maldives Trip', 2026-09-01 → 2026-09-14)."
  category_allocations: "Within any budget, split the total into per-category sub-limits (budget_allocations). Progress bar per category + overall."
  rollover_prompts:
    - "If no budget exists for the CURRENT month → nudge 'Create June 2026 budget'."
    - "When a month ends (last day) → nudge to create next month's."
    - "Same cadence for annual (prompt to create the new year's budget)."
  recurring_as_forecast:    # the genuinely smart bit (read-only intelligence, A8 from money-model)
    rule: >
      Expand the household's recurring schedules (item 3) over the budget's
      [period_start, period_end], sum by category, and surface as a FORECAST line:
      "₹X already committed via recurring this period." Optionally pre-fill suggested
      allocations from it. READ-ONLY — it informs the budget, it never writes phantom
      budget rows or transactions. Mirrors the money-model A8 principle.
  timeline: "Keep the 6-month budget-vs-actual timeline (shipped v8.5.0) and make it scope-aware (month timeline vs annual)."
```

### §4.3 — Acceptance

```yaml
acceptance:
  - "A budget always renders its explicit identity (month+year, year, or custom name) — never ambiguous 'Monthly'."
  - "Two devices on the same login see the SAME budget for the same (scope, year, month) — no parallel budgets (this is also the item-2 regression gate)."
  - "Category allocations sum-check works; over-allocation warns, under-allocation shows unallocated remainder."
  - "Recurring forecast line shows committed-by-recurring per category for the period; it writes nothing."
  - "Missing current/next-period budget triggers a create nudge."
```

---

## §5 — Item 3: Recurring redesign (BUILD, major) — single source of truth + RRULE + owner + remove toggle

```yaml
PM_framing:
  problem: >
    Recurring is captured in BOTH the Recurring section and the Transaction form,
    which is confusing and lets the two diverge. Recurring is also expense-only,
    the schedule has no owner field, and there's a meaningless active/deactivate switch.
  decision: >
    Recurring schedules are authored/managed ONLY in the Recurring section. The
    Transaction form stops capturing recurrence. When a schedule fires, it MATERIALISES
    a real transaction that appears in the Transactions module like any other.
    Recurring = the template; Transactions = the instances.
```

### §5.1 — Single source of truth

```yaml
source_of_truth:
  recurring_section: "The ONLY place to create/read/update/delete a recurring schedule."
  transaction_form: "REMOVE all recurrence inputs from TransactionFormModal (the v9.0.1 autoConfirm-on-the-txn-form path goes away here — autoConfirm becomes a property of the SCHEDULE, set in the Recurring form)."
  materialisation: >
    The generator (lib/recurring.ts) expands the schedule's RRULE and writes real
    transactions, each linked back via a new transactions.recurring_schedule_id FK.
    A generated transaction is a normal transaction (shows in Transactions, counts in
    totals per its type) and is tagged as 'from recurring' for display + the §8 drill-down.
```

### §5.2 — RRULE (RFC 5545) — the industry standard the feedback (correctly) asked for

```yaml
recurrence_model:
  storage: "recurring_schedules.rrule  text  — an RFC 5545 RRULE string."
  library: >
    Use rrule.js (the de-facto JS implementation of RFC 5545). It correctly handles
    month-end, leap years, COUNT/UNTIL, and is what Google/Apple/Outlook-class systems
    rely on. Hand-rolling recurrence math is a known foot-gun — do not.
  supported_frequencies:
    daily:     "FREQ=DAILY;INTERVAL=1"
    weekly:    "FREQ=WEEKLY;INTERVAL=1  (optionally BYDAY=MO,…)"
    monthly:   "FREQ=MONTHLY;INTERVAL=1 (optionally BYMONTHDAY=…)"
    quarterly: "FREQ=MONTHLY;INTERVAL=3   ← quarterly is monthly-interval-3, the standard encoding"
    yearly:    "FREQ=YEARLY;INTERVAL=1"
  end_condition:
    occurrences: "COUNT=n        — ends after n instances"
    end_date:    "UNTIL=YYYYMMDD — ends on/after a date"
    note: "COUNT and UNTIL are mutually exclusive (RFC 5545). The form exposes 'Ends: never / after N times / on date'."
```

### §5.3 — The form (mimics the Transaction form + recurrence)

```yaml
recurring_form:
  mirrors: "TransactionFormModal field-for-field, so the user sees the same shape they already know."
  types_supported: [expense, income, investment]    # the feedback explicitly named these three
  note_on_transfer: "Transfer recurring not requested; out of scope for v1. Flag if a use case emerges (e.g. recurring savings transfer) — it's a one-line type addition."
  fields:
    - amount, category (type-scoped per v9 model), account (per-type FK matrix from the txn-redesign spec)
    - OWNER (household member) — the missing field. This is the member the generated transactions are attributed to (initiated_by). Add a member picker.
    - recurrence: frequency (daily/weekly/monthly/quarterly/yearly) + interval + ends (never / after N / on date) → composed into the rrule string
    - start date (DTSTART)
    - autoConfirm (per-schedule): auto-post the instance, or drop it into a review queue
  removed:
    - "The active/deactivate toggle — REMOVE (the feedback is right: it's meaningless). Lifecycle = runs until COUNT/UNTIL is exhausted, or the schedule is deleted. Optionally a 'End now' action that sets UNTIL=today; but NO on/off switch."
```

### §5.4 — Acceptance

```yaml
acceptance:
  - "Recurrence can only be created/edited in the Recurring section; the Transaction form has no recurrence inputs."
  - "A fired schedule creates a real transaction in Transactions, linked by recurring_schedule_id, attributed to the schedule's owner."
  - "Expense, Income, and Investment schedules all work."
  - "Daily/weekly/monthly/quarterly/yearly all generate correct dates via rrule.js (incl. month-end + leap-year edge cases)."
  - "Ends-after-N and ends-on-date both stop generation correctly; never = open-ended."
  - "No active/deactivate toggle exists anywhere."
  - "Owner is a required field and flows to the generated transactions' member attribution."
```

---

## §6 — Item 4: Debt "owed to me" / receivables (INVESTIGATE → then BUILD)

```yaml
PM_framing:
  symptom: "User cannot create or manage a debt owed TO them — it 'appears a stub'."
  context: >
    v7.2.0-rc shipped debts.direction ('owed_by_me'|'owed_to_me') + counterparty_name,
    All/Owe/Owed-to-me FILTER tabs, totalReceivables, and Net-Worth handling. But the
    CREATE path may never have exposed a direction selector — i.e. you can FILTER for
    receivables but can't CREATE one. That's the likely 'stub'.
  action: >
    Quick investigation (companion dev prompt, Investigation B) to confirm root cause
    — missing create-UI vs flag-gated vs regression — THEN the build below.
```

### §6.1 — Intended model (the "They Owe" side, from the event-stream PDF)

```yaml
receivable_model:
  what_it_is: "A receivable is an ASSET (money owed to you). It is NOT spend or income at creation."
  create: "DebtFormModal gains a direction selector (I owe / Owed to me) + counterparty_name + amount + optional due/terms."
  repayment: >
    When the counterparty repays, it's an INFLOW (income-class to a cash account) that
    REDUCES the receivable balance — the dual ripple. Net worth: the asset shifts from
    'receivable' to 'cash' (neutral). Already consistent with totalReceivables (v7.2.0-rc).
  net_worth: "Receivables add to assets (Net Worth = assets + owed-to-me − liabilities), already supported."
```

### §6.2 — Acceptance

```yaml
acceptance:
  - "User can CREATE a debt with direction = owed-to-me, naming the counterparty."
  - "It appears under the 'Owed to me' tab and contributes to assets / Net Worth (not liabilities)."
  - "Recording a repayment reduces the receivable and lands cash in the chosen account; spend/income totals are not distorted (it's an asset shift)."
  - "The §8 debt drill-down works for receivables too (see all repayments toward it)."
```

---

## §7 — Item 5: Remove split-among-accounts (REMOVE)

```yaml
PM_framing:
  request: "Splitting one transaction across multiple ACCOUNTS is rare — remove it from the form and the DB."
  CRITICAL_DISAMBIGUATION: >
    This is the AccountDrawer / multi-account split (v7.3.0, stored on
    transactions.extras.accountSplits) — one transaction drawn from several ACCOUNTS.
    It is NOT the bill-split-among-PEOPLE feature (SplitInfo, who-paid, v6.4.8 auto-even
    split). DO NOT remove people-splitting — that's a core, used feature. Remove ONLY
    the account-split. A developer must not conflate the two.
```

```yaml
removal_spec:
  ui: "Remove the AccountDrawer from TransactionFormModal (the collapsible multi-account split with running sum / balanced indicator / apply-remaining)."
  store_adapter: "Stop reading/writing transactions.extras.accountSplits."
  db_migration:
    - "Forward-only scrub: strip the accountSplits key from transactions.extras for all rows."
    - "Any transaction that was multi-account becomes single-account on its primary account_id (the FK already exists post-v9 txn-redesign) — verify the primary account is set; if a split row's primary is ambiguous, assign to the largest leg and log to a migration_issues table (never drop the transaction)."
    - "Assert post-migration: no transactions.extras contains accountSplits."
  keep_intact: "SplitInfo / people-splitting / who-paid — untouched."
acceptance:
  - "No multi-account split UI in the transaction form."
  - "No transactions.extras.accountSplits remains in the DB."
  - "People bill-splitting still works exactly as before."
```

---

## §8 — Items 6, 8, 9: Unified transaction deep-link (BUILD, one mechanism)

```yaml
PM_framing:
  problem: >
    Users can't get from a budget, a debt, or a dashboard month-figure to the
    transactions behind it. Three asks, one underlying need: open the Transactions
    view pre-filtered to a context.
  decision: "Build ONE query-param filter contract. Each drill-down is just a different param set."
```

### §8.1 — The filter contract (extend v7.4.4's ?type / ?cat)

```yaml
transactions_view_params:
  existing: "?type=income|expense   ?cat=<category>"
  add:
    "?month=YYYY-MM": "filter to a single month (item 9)"
    "?from=YYYY-MM-DD&to=YYYY-MM-DD": "explicit date range (budget period, custom budgets)"
    "?budgetId=<id>": "resolve to (categories ∈ budget_allocations) AND (date ∈ budget period) (item 6)"
    "?debtId=<id>":   "resolve to transactions linked to that debt (item 8)"
  behaviour: "On mount, Transactions reads params → seeds the existing filter bar (chips show the active context, Clear all resets). Reuses the v7.4.3 slim filter bar."
```

### §8.2 — Per-item wiring

```yaml
item_6_budget_drilldown:
  trigger: "Click a budget (or a category row within it) on the Budgets page."
  nav: "→ /transactions?budgetId=<id>   (or ?budgetId=<id>&cat=<category> for a single allocation)"
  resolve: "budgetId → period_start/period_end + the allocation categories → date+category filter."

item_8_debt_drilldown:
  trigger: "Click a debt on the Debts page."
  nav: "→ /transactions?debtId=<id>"
  resolve: >
    debtId → the linked loan account (kind='loan') and/or extras.emi_split.debt_id from
    the v9 txn-redesign EMI split → show all payments/EMIs (interest expense legs +
    principal transfer legs) toward that debt. For receivables, show repayment inflows.
  data_need: >
    Ensure debt-linked transactions are resolvable. The v9 model links EMIs to a
    kind='loan' account and carries extras.emi_split.debt_id — use that. If a direct
    transactions.debt_id is cleaner for the query, add it (nullable FK) and backfill
    from the EMI metadata.

item_9_dashboard_month_drilldown:
  trigger: "Click monthly Income or Expense on the Dashboard."
  nav: "→ /transactions?type=income&month=YYYY-MM  (carry the dashboard's selected period)"
  note: "Today the dashboard passes ?type= (v7.4.4) but not the month. Add the selected period as ?month= (or ?from/&to= when the dashboard period isn't a calendar month)."
acceptance:
  - "Clicking a budget opens Transactions filtered to that budget's categories AND period."
  - "Clicking a debt opens Transactions filtered to that debt's payments/EMIs."
  - "Clicking dashboard month income/expense opens Transactions filtered to that month AND type."
  - "All three reuse the one param contract + the existing filter bar; chips reflect the context; Clear all resets."
```

---

## §9 — Sequencing

```yaml
order:
  P0_now:
    - "§0 rotate the secret (do before any SSO work)."
    - "§3 Google SSO config + un-stub."
    - "Investigation A (budget cross-device) — root-cause BEFORE building item 7 on top of it."
  P1_next:
    - "§4 Budget redesign (month+year/annual/custom + allocations child table + recurring forecast) — confirm the allocation re-add with product owner first."
    - "§5 Recurring redesign (RRULE, owner, single source of truth, remove toggle)."
    - "§6 Debt receivables (after Investigation B confirms root cause)."
  P2_then:
    - "§8 Unified transaction deep-link (items 6/8/9 — one mechanism)."
    - "§7 Remove account-split (+ DB scrub)."
dependencies:
  - "§8 budget drill-down depends on §4's budget identity + allocations."
  - "§4's recurring-forecast depends on §5's RRULE schedules."
  - "Item 2 fix should precede §4 build, or be confirmed fixed-by-redesign with a regression test."
test_discipline:
  - "Reuse the established gate: tsc + vitest + build + dev-boot; extend CON-UNIT-* / CON-E2E-* with the new acceptance criteria."
  - "For §4 + §7 (schema-touching): forward-only migration, dry-run on a prod clone, reconcile totals before/after (the v9 txn-redesign discipline)."
```

---

*End of triage. The two INVESTIGATE items are in the companion developer prompt — diagnose before fixing. Everything else is specced to build. Rotate the secret first.*
