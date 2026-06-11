# Vyact — Transaction Forms & Categories Rebuild: Architect Solution Spec

```yaml
meta:
  doc_type: solution_architecture
  audience: implementing_developer
  authority: BINDING   # where this conflicts with the PRD, this wins
  baseline: consumer v8.9.1
  source_prd: vyact-forms-categories-redesign.docx
  governing_principle: vyact-money-model-execution-and-regression.md (A1–A9)
  rollout: big_bang_single_release
  ambiguity_policy: >
    Every decision needed to build is stated here. If a value is not stated,
    STOP and ask — do not invent. No field, enum, or behaviour is "implied".
```

This document is written so a developer can implement without a second interpretation. It is structured as YAML-style contracts plus prose rationale. Read §0 (decisions) first; it removes the guesswork the PRD left open.

---

## §0 — Architectural Decisions (locked)

These resolve every open question. They are not up for re-interpretation during build.

```yaml
decisions:
  D1_transfer_storage:
    decision: SINGLE_ROW_WITH_FKS
    detail: >
      A transfer is ONE transactions row with type='transfer', account_id (from)
      and to_account_id (to) both NOT NULL, category_id NULL. The legacy
      v7.0.3 two-row `__tg:<gid>` scheme is RETIRED and migrated (see §5).
    rationale: >
      Two self-cancelling rows double the row count, force every aggregator to
      special-case the tag, and are the standing source of the R1 double-count
      risk. A single row with FKs is the cleaner long-term model and makes
      "transfers never count as spend/income" a single WHERE clause.

  D2_reconciliation_and_investment_value:
    decision: BALANCE_CORRECTION_NOT_A_TRANSACTION
    detail: >
      Reconciliation (a bank account OR an investment holding) is a CORRECTION TO
      THE ACCOUNT'S BALANCE, never a row in `transactions`. A reconciliation gap is
      the accumulated drift of forgotten/uncaptured transactions; the system
      FORGIVES it by absorbing the delta into an account-level
      `reconciliation_offset`, NOT by inventing a transaction to explain it.
      Investment "current value" updates use the EXACT same mechanism: setting a
      holding's value adjusts that investment account's offset so its balance reads
      the user-stated value. There is NO `value_adjustment` transaction type.
    storage:
      account_field: "accounts.reconciliation_offset numeric NOT NULL DEFAULT 0"
      history: >
        accounts → reconciliation_log jsonb array; each entry
        { at: timestamptz, delta: numeric, kind: 'bank'|'investment', stated_value: numeric }.
        Kept for an honest, dated audit trail ("reconciled ±₹X on <date>"), shown in
        the account's history ONLY. NEVER read by any spend/income/cash-flow aggregator.
      visibility: QUIET_LOG    # user choice: fix balance + dated note in account history; never in totals
    rationale: >
      A transaction is something that HAPPENED (real money moved, has a category,
      date, counterparty). A reconciliation is an ADMISSION that something happened
      you didn't capture — forgiven by correcting the balance, not recorded as an
      event. Modelling it as a transaction would (a) give it a fake date/category,
      and (b) risk it being counted as spend or income, which it is not.
    net_worth_vs_cashflow:
      net_worth: "DOES reflect the offset — the user's true position really is the corrected balance."
      cash_flow_spend_income: "NEVER reflects the offset — it lives outside the transaction stream those aggregators read. Structurally impossible to contaminate."
    accepted_tradeoff: >
      Forgiving an ₹800 deficit keeps the BALANCE honest but leaves the SPENDING
      total understated by that ₹800 (the un-logged spend is never categorised).
      This is correct and intended: balance truth > category completeness for drift
      the user cannot reconstruct. The quiet log makes the correction visible without
      pretending to know what it was.

  D3_track_picker:
    decision: RETIRE_V703_AND_REBUILD
    detail: >
      The v7.0.3 track-picker (vt_feature_track_picker), INVESTMENT_CATEGORIES,
      and CATEGORIES_BY_TYPE as currently shaped are RETIRED. Build the fresh
      four-form system in §4. Salvage only the enum NAMES that survive (§3).
    rationale: User decision. Fresh system avoids inheriting the flat-pool shape.

  D4_rollout:
    decision: BIG_BANG_SINGLE_RELEASE
    detail: >
      One release flips forms + categories + storage model + migration together,
      behind ONE umbrella flag FEATURES.txnRedesign that gates the new UI. The
      DB migration is forward-only and runs in the same deploy.
    rationale: User decision.
    MANDATORY_RISK_CONTROL:   # the price of big-bang — non-negotiable
      - A full DB backup / PITR restore point is captured immediately before the
        migration runs (Supabase dashboard or `pg_dump`).
      - The migration is dry-run on a CLONE of production first; the §5
        reconciliation assertions MUST pass on the clone before prod apply.
      - FEATURES.txnRedesign defaults TRUE on release, but the flag exists so a
        UI rollback is one config flip if a non-data defect appears. (Data
        migration is NOT reversible by the flag — hence the backup above.)
      - Ship in a low-traffic window. Monitor the §7 invariants for 24h.

  D5_goals_tax:
    decision: ABSENT
    detail: Goals and Tax modules are permanently removed. No enum, column, form,
            category, or migration branch references them. If found in legacy
            data, see §5 M5.
```

---

## §1 — Scope

```yaml
in_scope:
  - Four transaction types, each a purpose-built form: expense, income, investment, transfer
  - Type-scoped category enums (no shared flat pool)
  - Single-row transfer model (D1) + migration off `__tg:`
  - Investment = contribution events + value-adjustment "reconciliation" (D2)
  - Collapse of debt mechanics into one "Loan / EMI payment" expense category, system-split
  - Progressive-disclosure form layout (3 visible fields + "More")
  - Forward-only data migration of all legacy rows (§5)
  - Aggregation-engine alignment (transfers/investments never counted as spend/income) (§6)

out_of_scope:
  - Bank/brokerage live sync (no API price feeds — value is user-entered)
  - Goals, Tax (removed — D5)
  - Re-theme of the app shell (separate, evidence-led design pass)
  - New analytics dashboards (only keep existing ones correct)
```

---

## §2 — Data Model

All changes are additive-or-migrating on the existing `transactions` and `accounts` tables. No new core tables. RLS inherits existing `transactions` / `accounts` policies (do not author new policies; reuse).

### §2.1 `transactions` table — target shape

```yaml
table: transactions
columns_existing_reused:
  id: uuid pk
  household_id: uuid           # RLS scope
  account_id: uuid fk -> accounts.id      # FROM account (was Money Map v7.1)
  to_account_id: uuid fk -> accounts.id   # TO account (transfers/investments)
  initiated_by: uuid           # member attribution
  amount: numeric              # store positive; sign is derived from type (see rule)
  currency: text
  occurred_on: date
  occurred_at: timestamptz      # time; defaults now() (see form rule F-TIME)
  description: text
  extras: jsonb                 # see §2.3 for the only permitted keys post-rebuild
  confidence: text             # provenance (v8.0.1)
  source: text                 # provenance (v8.0.1)
  estimated_at: timestamptz
  confirmed_at: timestamptz
  created_at / updated_at: timestamptz

columns_changed:
  type:
    was: "enum-ish: expense | income | transfer | investment (+ legacy free use)"
    now: "STRICT enum, exactly: expense | income | investment | transfer"
    note: >
      There is NO value_adjustment type (D2 correction). Reconciliation and
      investment-value updates are account-level balance corrections
      (accounts.reconciliation_offset), NOT transactions. See §2.4 and §2.6.
  category_id:
    rule: >
      REQUIRED when type IN (expense, income).
      MUST BE NULL when type IN (transfer, investment).
      Enforced by CHECK constraint CK_txn_category_by_type (§2.5).
  to_account_id:
    rule: >
      REQUIRED (NOT NULL) when type IN (transfer, investment).
      NULL for expense/income.
      See §2.4 for the per-type account matrix — this is the crux, read it.

columns_removed_from_use:
  - "extras.__tg / extras tag scheme for transfers — RETIRED (migrated in §5 M1)"
  - "extras.linkedToAssetId — RETIRED (migrated in §5 M3)"
  - "extras.linkedAssetId (legacy dual-write) — RETIRED (migrated in §5 M3)"
```

### §2.2 `accounts` table — add account kind + investment fields

```yaml
table: accounts
columns_existing_reused:
  id, household_id, name, currency, is_default, archived_at, created_at, updated_at
columns_added:
  kind:
    type: "text NOT NULL DEFAULT 'bank'"
    enum: [cash, bank, credit_card, investment, loan]
    migration_default: >
      Backfill from existing account semantics where known; else 'bank'.
      The single system Cash account per household is kind='cash' (money-model A2).
    purpose: >
      Drives form behaviour: only kind='investment' accounts appear in the
      Investment form's "investment account" picker and support value updates via
      reconciliation_offset (D2). kind='credit_card' and kind='loan' are liabilities (negative to net worth).
  opening_balance:
    type: "numeric NOT NULL DEFAULT 0"
    provenance: "tagged via confidence/source columns already present (money-model B1.2)"
    note: "preserved as the original starting point; never silently re-based (use reconciliation_offset instead)"
  reconciliation_offset:
    type: "numeric NOT NULL DEFAULT 0"
    purpose: >
      The "forgiveness" term (D2). Absorbs the drift between the app's computed
      balance and the user's stated real balance, for BOTH bank reconciliation and
      investment value updates. NOT a transaction. NEVER read by spend/income/
      cash-flow aggregators. DOES feed net worth (it makes the balance true).
  reconciliation_log:
    type: "jsonb NOT NULL DEFAULT '[]'"
    shape: "array of { at: timestamptz, delta: numeric, kind: 'bank'|'investment', stated_value: numeric }"
    purpose: "dated audit trail for the quiet log ('reconciled ±₹X on <date>'), shown in account history ONLY"
  current_balance_formula:
    note: >
      current balance = opening_balance
        + Σ(inflows: income/transfer-in/investment-in)
        − Σ(outflows: expense/transfer-out/investment-out)
        + reconciliation_offset
      For an investment account, current value == this balance (the offset is what
      the user's value updates move). See §2.6 and R-AGG-4.
constraint:
  name: CK_account_kind
  check: "kind IN ('cash','bank','credit_card','investment','loan')"
```

### §2.3 `transactions.extras` — the ONLY permitted keys after rebuild

```yaml
extras_allowed_keys:
  accountSplits: "existing multi-account split array (v7.3 AccountDrawer) — unchanged"
  emi_split: >
    object { interest: numeric, principal: numeric, debt_id: uuid } — written by
    the system when category = loan_emi (§4.1 / §6.3). Read-only to the user.
extras_forbidden_after_migration:
  - __tg            # transfers are first-class rows now
  - linkedToAssetId
  - linkedAssetId
rule: >
  Any extras key not in extras_allowed_keys MUST be dropped or migrated by §5.
  A post-migration assertion scans for forbidden keys and fails the deploy if found.
```

### §2.4 The per-type account matrix — THE critical contract

This table removes the biggest ambiguity. For every type, exactly which account columns are set and how net worth / cash-flow react.

```yaml
account_matrix:
  expense:
    account_id: REQUIRED (the account money LEFT; defaults to system Cash)
    to_account_id: NULL
    category_id: REQUIRED (expense category)
    balance_effect: "account_id balance DECREASES (for credit_card kind: liability INCREASES)"
    counts_as_spend: true
    networth: "decreases (asset side for cash/bank; liability side for credit_card)"

  income:
    account_id: NULL
    to_account_id: REQUIRED (the account money LANDED in)
    category_id: REQUIRED (income source)
    balance_effect: "to_account_id balance INCREASES"
    counts_as_income: true
    networth: increases

  transfer:
    account_id: REQUIRED (from)
    to_account_id: REQUIRED (to)
    category_id: NULL
    balance_effect: "account_id DECREASES and to_account_id INCREASES (atomic, A9)"
    counts_as_spend: false
    counts_as_income: false
    networth: "NEUTRAL (both legs internal)"

  investment:
    # An investment contribution is modelled as a transfer INTO a kind='investment' account.
    direction_in:    # "Added money"
      account_id: REQUIRED (cash/bank source)
      to_account_id: REQUIRED (the kind='investment' account)
      category_id: NULL    # NB: investment contributions carry NO category (they are transfers)
      networth: NEUTRAL    # cash converted to investment asset
      counts_as_spend: false
    direction_out:   # "Took money out"
      account_id: REQUIRED (the kind='investment' account)
      to_account_id: REQUIRED (cash/bank destination)
      category_id: NULL
      networth: NEUTRAL
      counts_as_income: false
    CLARIFICATION: >
      type stored is 'investment' (not 'transfer') so the Investment ledger and
      contribution history are queryable, BUT the aggregation rules treat it with
      the SAME exclusion as transfer (never spend/income). type='investment' is a
      "transfer-class" type for aggregation. See §6 R-AGG-2.

  # NOTE: there is NO value_adjustment transaction row. Reconciliation of a bank
  # account AND investment value updates are account-level balance corrections
  # (accounts.reconciliation_offset), NOT transactions. See §2.6.
```

> **Single most important implementation note:** an investment contribution is stored with `type='investment'` but is **aggregated like a transfer** (excluded from spend/income, net-worth-neutral). Do not let it leak into spending. This is the §6 R-AGG-2 guard. Reconciliation and investment-value updates are **NOT transactions at all** — they adjust `accounts.reconciliation_offset` (§2.6), are excluded from every spend/income aggregator, and feed net worth only.

### §2.5 Constraints (author these exactly)

```yaml
constraints:
  - name: CK_txn_type
    check: "type IN ('expense','income','investment','transfer')"
  - name: CK_txn_category_by_type
    check: >
      (type IN ('expense','income') AND category_id IS NOT NULL)
      OR (type IN ('investment','transfer') AND category_id IS NULL)
    # expense & income REQUIRE category; investment & transfer REQUIRE null.
  - name: CK_txn_accounts_by_type
    check: >
      (type='expense'         AND account_id IS NOT NULL AND to_account_id IS NULL)
      OR (type='income'       AND account_id IS NULL     AND to_account_id IS NOT NULL)
      OR (type='transfer'     AND account_id IS NOT NULL AND to_account_id IS NOT NULL)
      OR (type='investment'   AND account_id IS NOT NULL AND to_account_id IS NOT NULL)
  - name: CK_account_kind
    check: "kind IN ('cash','bank','credit_card','investment','loan')"
enforcement: >
  Constraints are authored in the migration (§5) AFTER data is migrated/cleaned,
  else legacy rows will violate them. Order matters: clean → then constrain.
```

### §2.6 — Reconciliation operation (NOT a transaction)

The single most important correction in this revision. Reconciling a bank account or updating an investment's value is a **balance correction**, never a `transactions` row.

```yaml
reconciliation_operation:
  trigger:
    bank: "Account detail → 'Fix balance' → user enters their real balance."
    investment: "Investment account detail → 'Update value' → user enters today's value."
  computation:
    computed_balance: "opening_balance + Σinflows − Σoutflows + current reconciliation_offset"
    delta: "stated_value − computed_balance"
    apply: "reconciliation_offset += delta   (so balance now equals stated_value)"
  write:
    - "UPDATE accounts SET reconciliation_offset = reconciliation_offset + :delta,
       reconciliation_log = reconciliation_log || :entry  WHERE id = :account_id."
    - "entry = { at: now(), delta: :delta, kind: 'bank'|'investment', stated_value: :stated_value }."
    - "NO row is written to transactions. NO category, no occurred_on as an event."
  forgiveness_semantics: >
    The delta is the accumulated drift of forgotten/uncaptured transactions. The
    system FORGIVES it — it does not try to reconstruct what moved. The balance
    becomes true; the lost detail is not invented.
  visibility: QUIET_LOG
    # Fix the balance silently in totals; surface a dated "Reconciled ±₹X on <date>"
    # line in the account's history view ONLY (read from reconciliation_log).
    # It NEVER appears in spending, income, cash-flow, or category breakdowns.
  aggregation_contract:
    net_worth: "INCLUDES reconciliation_offset (balance is now the user's true position)."
    spend_income_cashflow: "EXCLUDES it entirely — it is not in the transaction stream."
  accepted_tradeoff: >
    A forgiven deficit leaves the spending total understated by that amount (the
    un-logged spend is never categorised). Intended: balance truth > category
    completeness for unreconstructable drift. The quiet log records THAT a
    correction happened without fabricating WHAT it was.
```

---

## §3 — Category Enums (exact, type-scoped)

These are the canonical sets. Store `category_id` referencing a categories table OR a string enum — match whatever the existing categories implementation uses (it is a seeded reference set today). **Names and the type they belong to are binding.** Icons are advisory.

```yaml
categories_expense:   # consumption only — debt mechanics / transfer / investment REMOVED
  - { key: food_dining,    label: "Food & Dining",      icon: "🍽" }
  - { key: groceries,      label: "Groceries",           icon: "🛒" }
  - { key: transport,      label: "Transport",           icon: "🚗" }
  - { key: rent_mortgage,  label: "Rent / Mortgage",     icon: "🏠" }
  - { key: utilities,      label: "Utilities",           icon: "⚡" }
  - { key: shopping,       label: "Shopping",            icon: "🛍" }
  - { key: health,         label: "Health & Wellness",   icon: "💊" }
  - { key: entertainment,  label: "Entertainment",       icon: "🎬" }
  - { key: education,      label: "Education",           icon: "📚" }
  - { key: travel,         label: "Travel",              icon: "✈" }
  - { key: childcare,      label: "Childcare",           icon: "👶" }
  - { key: insurance,      label: "Insurance",           icon: "🛡" }
  - { key: loan_emi,       label: "Loan / EMI payment",  icon: "💳", special: SYSTEM_SPLIT }  # §6.3
  - { key: other_expense,  label: "Other",               icon: "📦" }

categories_income:    # source only — "Investment Income" REMOVED (handled in Investment track)
  - { key: salary,           label: "Salary",            icon: "💼" }
  - { key: freelance,        label: "Freelance",         icon: "💻" }
  - { key: gift_bonus,       label: "Gift / Bonus",      icon: "🎁" }
  - { key: rental_income,    label: "Rental income",     icon: "🏠" }
  - { key: business_revenue, label: "Business revenue",  icon: "🏢" }
  - { key: other_income,     label: "Other income",      icon: "💰" }

categories_transfer: NONE   # transfers carry NO category (D1, §2.4). The "kinds" below are
                            # DERIVED for display only, never stored as category_id:
  transfer_display_kinds_derived:
    - account_to_account   # default
    - to_investment        # when to_account_id.kind = 'investment'  (also type='investment')
    - credit_card_payment  # when to_account_id.kind = 'credit_card'
    - loan_principal       # system-generated leg of an EMI split (§6.3)

categories_investment: NONE  # investment contributions carry NO category (§2.4).
                             # Direction (in/out) is a form control, not a category.

removed_permanently:   # must not appear anywhere; migrated in §5
  - debt_payment
  - debt_interest
  - debt_principal
  - transfer            # (as an expense category)
  - investment_buy
  - investment_sell
  - investment_income   # (as an income category)
  - any goal_* or tax_* category
```

---

## §4 — Form Contracts (per type)

```yaml
form_global_rules:
  F-DISCLOSURE: "Exactly 3 primary fields visible; everything else under a 'More details' collapse."
  F-NO-KEYPAD-AUTOFOCUS: "Amount field is NOT auto-focused on open or edit (alpha fix)."
  F-TIME: "occurred_at defaults to now(); time control lives under 'More details', not primary."
  F-DATE: "occurred_on defaults to today; editable in primary row as a compact date chip."
  F-ACCOUNT-DEFAULT: "If no account chosen on expense, default to the system Cash account (A2)."
  F-VALIDATION: "Block save only on missing REQUIRED-primary fields; everything else optional."
  F-FLAG: "All four forms render only when FEATURES.txnRedesign = true; else legacy form (until cutover removes it)."
```

### §4.1 Expense form

```yaml
form: expense
primary_fields:
  - amount            # required
  - category_id       # required, from categories_expense
  - account_id        # 'Paid from'; default system Cash
more_details: [occurred_on(if moved), description, tags, member(initiated_by), occurred_at, attachment]
special_behaviour:
  loan_emi_category:
    when: "category_id = loan_emi"
    then:
      - "Reveal a 'Which loan?' picker (debt_id) + the EMI amount."
      - "On save, system writes extras.emi_split { interest, principal, debt_id } via the
         amortisation engine (existing splitPayment), and:"
      - "  • books the interest portion as the expense (counts as spend),"
      - "  • writes a system transfer leg (type='transfer', display-kind loan_principal)
            that reduces the linked debt balance — user never sees/edits this leg."
      - "All legs are ONE atomic DB transaction (A9 / R8)."
```

### §4.2 Income form

```yaml
form: income
primary_fields:
  - amount            # required
  - category_id       # required, from categories_income
  - to_account_id     # 'Deposited to'; required
more_details: [occurred_on, description, tags, member, occurred_at,
               private_toggle]   # keep existing "Private — exclude from totals/charts/Pulse"
```

### §4.3 Investment form (the big simplification — D2/§2.4)

```yaml
form: investment
moment_1_contribution:
  primary_fields:
    - direction        # two-way toggle: 'added' | 'withdrew'  (replaces Buy/Sell/Dividend/CapGain/Rebalance)
    - amount           # required
    - investment_account_id   # picker shows ONLY accounts.kind='investment'
  also_required_under_more_or_inline:
    - cash_account_id  # the bank/cash side (from when added, to when withdrew)
  storage:
    type: investment
    mapping_added:   { account_id: cash_account_id, to_account_id: investment_account_id }
    mapping_withdrew:{ account_id: investment_account_id, to_account_id: cash_account_id }
    category_id: NULL
  more_details: [occurred_on, description]
  REMOVED_VS_LEGACY: [investment_vehicle_required, capital_gain, rebalance, dividend, units, price]

moment_2_value_update:
  entry_point: "On a kind='investment' account detail screen: 'Update value' action."
  input: "user enters today's total value of the holding"
  storage:
    mechanism: RECONCILIATION_OFFSET   # §2.6 — NOT a transaction
    operation: "accounts.reconciliation_offset += (stated_value − current_computed_value)"
    log_entry: "{ at: now(), delta, kind: 'investment', stated_value }"
    writes_no_transaction: true
  display: "implied gain/loss = current_value − sum(net contributions); SHOWN, never asked."
  parity: "Identical mechanism to bank-account reconciliation (§2.6). Same code path, kind='investment'."
  aggregation: "net worth reflects the new value; spend/income/cash-flow never do."
```

### §4.4 Transfer form

```yaml
form: transfer
primary_fields:
  - amount            # required
  - account_id        # from; required
  - to_account_id     # to; required
more_details: [occurred_on, description]
storage: { type: transfer, category_id: NULL }
guards:
  - "Never appears in spend/income totals (§6)."
  - "from ≠ to (CHECK or form validation; reject equal accounts)."
```

---

## §5 — Migration (forward-only, single deploy, D4)

```yaml
migration:
  file: "supabase/migrations/<ts>_txn_redesign.sql"   # follow existing timestamp convention
  apply_method: >
    Same discipline as PR #20 / v8 migrations: dry-run on a production CLONE via
    Supabase MCP execute_sql, verify §7 assertions, capture PITR point, then apply.
  ordering: "CLEAN/MIGRATE data FIRST, then add CHECK constraints LAST (else legacy rows fail)."

  steps:
    M0_backup:
      - "Capture PITR restore point / pg_dump. Record the timestamp in the deploy log."

    M1_transfers_to_single_row:
      desc: "Collapse v7.0.3 __tg:<gid> linked pairs into one type='transfer' row."
      logic:
        - "Group transactions where extras->>'__tg' IS NOT NULL by the gid."
        - "For each pair: the expense leg gives account_id (from); the income leg gives
           to_account_id (to); amount from either; occurred_on/description preserved."
        - "INSERT one consolidated row type='transfer', account_id, to_account_id, category_id NULL."
        - "DELETE the two legacy legs."
        - "Edge: orphan __tg with no matching pair → log to a migration_issues temp table,
           assign to system Cash as to/from best-effort, DO NOT drop silently."

    M2_account_kind_backfill:
      - "ALTER accounts ADD kind (default 'bank'), opening_balance (default 0)."
      - "ALTER accounts ADD reconciliation_offset numeric NOT NULL DEFAULT 0,
         reconciliation_log jsonb NOT NULL DEFAULT '[]' (D2 / §2.6)."
      - "Set kind by best-known mapping (name heuristics / existing asset class) where available."
      - "Ensure exactly one kind='cash' system account per household (create if missing)."
      - "If any legacy 'balance adjustment' style rows exist in transactions, convert them to a
         reconciliation_offset on the target account (sum into the offset + append a
         reconciliation_log entry), then DELETE the rows. They must NOT survive as transactions."

    M3_investment_rows:
      desc: "Migrate legacy investment representations to the new model."
      logic:
        - "Rows with extras.linkedToAssetId / linkedAssetId pointing at an investment asset,
           or legacy category in (investment_buy, investment_sell):"
        - "  • ensure a kind='investment' account exists for that asset (create from the asset)."
        - "  • investment_buy  → type='investment', account_id=cash(best-known or Cash), to_account_id=investment_acct, category NULL."
        - "  • investment_sell → type='investment', account_id=investment_acct, to_account_id=cash, category NULL."
        - "Strip linkedToAssetId / linkedAssetId from extras."

    M4_debt_category_collapse:
      desc: "Remap removed debt categories."
      logic:
        - "category debt_interest → category loan_emi (the interest is the expense leg); keep as expense."
        - "category debt_principal → convert row to a type='transfer' (display-kind loan_principal)
           reducing the linked debt; remove category. If no linked debt resolvable, log to
           migration_issues and leave as expense 'other' (never drop)."
        - "category debt_payment (undifferentiated) → category loan_emi, and IF an amortisation
           split is derivable, write extras.emi_split; else leave whole as loan_emi expense."

    M5_goals_tax_purge:
      - "Any goal_* / tax_* category → remap to 'other_expense' or 'other_income' by sign;
         log counts. (Modules are gone; data is preserved as generic.)"

    M6_income_investment_income:
      - "category investment_income (income) → if it maps to a known investment account, record
         as a value-relevant note; otherwise remap to 'other_income'. Never double-count."

    M7_extras_scrub:
      - "Assert no transactions.extras contains __tg / linkedToAssetId / linkedAssetId.
         Fail deploy if any remain."

    M8_constraints:
      - "NOW add CK_txn_type, CK_txn_category_by_type, CK_txn_accounts_by_type, CK_account_kind."
      - "If any constraint fails to validate, the data steps above missed a case → ROLL BACK,
         inspect migration_issues, fix, re-run on clone. Do not force-add with NOT VALID to bypass."

  idempotency: "Each step guarded so re-running is a no-op (check-before-write). Required."
  provenance_rule: "Migrated rows keep existing confidence/source; never re-tag real data as estimated."
```

---

## §6 — Aggregation Engine Alignment

The aggregation refactor is already listed as pending ("`monthlyData`/`totalBalance`/`spendByCategory`/Pulse/Net Worth respect the new types and the excluded flag"). Pin the rules:

```yaml
aggregation_rules:
  R-AGG-1_spend:
    spending_total: "SUM(amount) WHERE type='expense'  (only)."
    note: "Transfers, investments, income are excluded by definition. Reconciliation offsets are not transactions and are excluded structurally."
  R-AGG-2_transfer_class_exclusion:
    rule: >
      type IN ('transfer','investment') are NEVER counted in spending or income.
      investment is 'transfer-class' for aggregation even though it is its own type
      for ledger/history. Reconciliation offsets (accounts.reconciliation_offset)
      are NOT in the transaction stream at all — they cannot be counted as spend/income.
  R-AGG-3_income:
    income_total: "SUM(amount) WHERE type='income' AND NOT private."
  R-AGG-4_account_balance:
    formula: >
      balance(account) = opening_balance
        + SUM(amount WHERE to_account_id = account AND type IN ('income','transfer','investment'))
        − SUM(amount WHERE account_id   = account AND type IN ('expense','transfer','investment'))
        + account.reconciliation_offset
    credit_card: "kind='credit_card' balance is a liability; sign into net worth as negative."
  R-AGG-5_networth:
    formula: "SUM(asset-kind balances) − SUM(liability-kind balances: credit_card, loan, debts)."
    investment_value: "investment account balance already reflects reconciliation_offset (the user-set current value)."
    reconciliation: "net worth INCLUDES each account's reconciliation_offset; spend/income never do."
    goals_tax: "N/A — removed."
  R-AGG-6_emi_split:
    rule: >
      For category=loan_emi rows, ONLY the interest portion counts as spend; the
      principal portion is the system transfer leg (reduces debt), excluded from spend.
  R-AGG-7_private_flag:
    rule: "Income rows with the Private toggle are excluded from totals, charts, and Pulse."
  views_to_update:
    - v_txn_by_account   # must use R-AGG-4
    - v_txn_by_member
    - any monthlyData / spendByCategory / reportableTxns client aggregator
  consistency_check: "aiSummary output MUST equal dashboard totals after the change (R5)."
```

---

## §7 — Acceptance Criteria & Invariants (test these exactly)

```yaml
acceptance:
  data_model:
    - "CK_txn_category_by_type: expense/income require category; investment/transfer forbid it."
    - "CK_txn_accounts_by_type: per-type account columns exactly as §2.4; violations rejected."
    - "No transactions.extras contains __tg / linkedToAssetId / linkedAssetId (M7)."
  invariants:
    INV-1_transfer_neutral:  "Create a transfer A→B: spending total, income total UNCHANGED; net worth UNCHANGED."
    INV-2_investment_neutral:"'Added money' to an investment: not counted as spend; net worth UNCHANGED (cash→investment asset)."
    INV-3_value_update:      "Update investment value +X: net worth changes by exactly +X; spend/income UNCHANGED; NO transaction row is created; accounts.reconciliation_offset increases by X and a dated reconciliation_log entry exists."
    INV-3b_reconcile_no_txn: "Reconcile a bank account to a stated balance: balance becomes the stated value; spend/income/cash-flow totals UNCHANGED; zero rows added to transactions; a 'Reconciled ±₹X' entry appears in account history only."
    INV-4_emi_split:         "Log loan_emi of T (interest i, principal p, i+p=T): spend increases by i only; linked debt drops by p; account drops by T; all atomic."
    INV-5_account_balance:   "Per-account balance = R-AGG-4 formula; reconciles to ledger line-by-line."
    INV-6_networth_recon:    "Net worth = Σ assets − Σ liabilities using R-AGG-5; matches sum of account balances minus debts."
    INV-7_atomicity:         "Force-fail any leg of an EMI or transfer: ENTIRE event rolls back, zero state change (A9/R8)."
    INV-8_category_scope:    "Expense form shows only categories_expense; income only categories_income; transfer/investment show none."
    INV-9_migration_recon:   "On the production clone: SUM(spend), SUM(income), per-account balances, and net worth BEFORE vs AFTER migration are explainably equal (transfers/investments that were mis-counted as spend will CORRECT — document the delta; everything else equal)."
  ux:
    - "Keypad does not auto-focus on open or edit."
    - "Each form shows exactly 3 primary fields; rest under 'More details'."
    - "occurred_at defaults to now and is not in the primary row."
  flag:
    - "FEATURES.txnRedesign=false renders the legacy form with zero new behaviour (until cutover removes legacy)."
    - "FEATURES.txnRedesign=true renders the four new forms."
  regression_suite:
    - "Extend the existing Playwright catalogue (CON-E2E-*) + unit pins (CON-UNIT-*) with INV-1..INV-9."
    - "Golden-file monthlyData / totalBalance / spendByCategory / Pulse components / aiSummary on a fixture household; diff must be explainable."
```

---

## §8 — File / Module Change Map

```yaml
files:
  config:
    - "src/config/features.ts → add FEATURES.txnRedesign (umbrella flag, default true on release)."
    - "RETIRE vt_feature_track_picker (D3) once cutover confirmed."
  categories:
    - "Replace INVESTMENT_CATEGORIES / CATEGORIES_BY_TYPE with the §3 type-scoped sets (single source of truth)."
  forms:
    - "New form components per §4: ExpenseForm, IncomeForm, InvestmentForm (2 moments), TransferForm."
    - "Retire the v7.0.3 track-picker modal."
    - "Investment value update reuses the account-reconciliation component (D2/§2.6) — shared, not duplicated. Both write accounts.reconciliation_offset; NEITHER writes a transaction."
    - "Account entity mapper (supabaseAdapter): add reconciliation_offset + reconciliation_log round-trip; replace_accounts RPC carries both."
  store_adapter:
    - "supabaseAdapter: map the strict type enum, to_account_id for all relevant types, kind+opening_balance on accounts."
    - "Writes for EMI / investment / transfer go through a single atomic path (RPC) — reuse replace_<entity> / a new SECURITY DEFINER fn if multi-row atomicity needs it (A9/R8)."
  aggregation:
    - "Apply §6 rules to monthlyData / totalBalance / spendByCategory / reportableTxns / Pulse / Net Worth."
    - "Update v_txn_by_account / v_txn_by_member SQL views (R-AGG-4)."
  migration:
    - "supabase/migrations/<ts>_txn_redesign.sql per §5 (forward-only; constraints last)."
  ask_vyact:
    - "Update intent→type/category mapping so 'paid my loan EMI' → expense:loan_emi, 'put 10k in SIP' → investment:added, etc. (keeps Ask Vyact Capture consistent — money-model R-assistant)."
  tests:
    - "INV-1..INV-9 + golden files as §7."
```

---

## §9 — The one risk your big-bang choice carries (stated plainly)

```yaml
risk_note:
  choice: D4_big_bang
  the_risk: >
    A single release flips storage model + forms + categories + a destructive
    data migration (collapsing transfer pairs, rewriting debt/investment rows)
    simultaneously. If the migration mis-maps an account or a transfer pair on
    real data, the error is live for all users at once, and the data steps are
    NOT reversible by the feature flag (the flag only hides the new UI).
  why_it_is_acceptable: >
    It is acceptable ONLY because the D4 MANDATORY_RISK_CONTROL is honoured:
    PITR backup before apply, a full dry-run on a production clone with the §7
    INV-9 reconciliation passing, constraints added last, every migration step
    idempotent and logging unresolved cases to migration_issues rather than
    dropping data, and a low-traffic deploy window with 24h invariant monitoring.
  the_one_thing_not_to_skip: >
    Do NOT apply the migration to production until INV-9 (before/after
    reconciliation) passes on a clone of TODAY's production data. That single
    gate is what separates a clean cutover from a silent, app-wide data-integrity
    incident. If INV-9 cannot pass, the big-bang is not ready — fix the mapping,
    not the assertion.
```

---

*End of spec. Build order: §5 migration (on clone) → §2 schema + constraints → §3 categories → §4 forms → §6 aggregation → §7 invariants green → flip FEATURES.txnRedesign. Nothing ships to production until INV-9 passes on a production clone.*
