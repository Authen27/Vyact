# Vyact — Money-Model Overhaul: Execution Plan & Regression Analysis

> **For:** Engineering team
> **From:** Product
> **Status:** APPROVED for build — phased
> **Baseline:** consumer v8.0.1 (per `VERSIONS.md`)
> **Combines:** `vyact-alpha-feedback-triage.docx` (the 13 alpha items) + the goal/debt/tax modeling decision
> **Companion specs:** `vyact-onboarding-engineering-spec.md`, `vyact-ask-vyact-engineering-spec.md`

This is the buildable contract. Part A is the modeling principle that governs everything. Part B is the ordered change list. Part C is the regression analysis — what breaks, what to protect, what to test. Read Part C before estimating; the regression surface is concentrated and real.

---

## 0. TL;DR

The alpha feedback and the goal/debt/tax decision converge on one program of work: **make money feel real, then make everything else a lens over it.**

- **One source of truth:** real accounts + real transactions. Every transaction moves an account.
- **Goals, tax = lenses, not wiring.** A goal is a progress bar over real money, never a virtual sub-balance carved out of an account. Tax is a calculation surfaced as a nudge, never an entity with a balance.
- **Debt stays as-is** — it is already correctly part of the money model (real liability, EMI = real transaction with interest/principal split).
- **Dashboard = two honest numbers:** Cash Flow (a flow) and Net Worth (a stock). Net Worth silently absorbs debt, real goal accounts, and reserved tax. Nothing else needs connecting.

Everything below executes that. **The work is sequenced so the money-model core lands first, behind flags, with the aggregation engine protected.**

---

# PART A — The Governing Principle (read first)

Every change in Part B is downstream of this. If a proposed implementation violates Part A, stop and escalate.

## A1. One source of truth
Accounts hold real balances. Transactions move money between accounts. This is the *only* place money lives. Nothing else (goal, budget, tax) may hold or carve out money.

## A2. Every transaction moves an account
- Expense → debits one account.
- Income → credits one account.
- Transfer → debits one account, credits another (the From → To model).
- Default to a system **Cash** account when none is chosen, so the rule never blocks fast entry.
- Enforced at the data layer: **no transaction may exist without an account.**

## A3. Accounts have a real, finite balance
`balance = opening_balance + credits − debits`. Opening balance captured at account creation / onboarding, tagged `estimated` until confirmed (provenance already exists, v8.0.1). A balance that can run low is a balance that can be trusted, reconciled, and drawn down.

## A4. Goals are lenses, not containers
- **Default (virtual goal):** a target + a measured progress number. Progress is *counted* from tagged contributions; money never leaves the real account's ownership. Contributes **nothing** to Net Worth (correct — no money has moved).
- **Opt-in (real goal):** the user creates a real savings account and transfers real money in. The goal points at that account and reads its balance. This is the *only* truthful "allocation." It shows in Net Worth because it is a real asset.
- **NEVER build the in-between:** a virtual sub-balance carved out of a real account. That is the #1 way finance apps produce balances that don't match the bank. Forbidden.

## A5. Tax is a calculation, not an entity
- Tax owed = derived from income + rules. It is a *number*, surfaced as a nudge ("you'll likely owe ~₹X; you've set aside ₹Y").
- Money actually set aside for tax = a transfer to a real "Tax Reserve" account (an asset, already in Net Worth).
- Do **not** create a tax entity with a phantom balance.

## A6. Debt is already in the model — leave it
A debt is a real liability; an EMI payment is a real transaction that debits an account and splits into interest (expense) + principal (liability reduction). This is the correct connection and already built. Do not "re-connect" debt; do not duplicate it.

## A7. The dashboard is two numbers
- **Cash Flow** = money in vs money out over a period (a *flow*). The behavioral, tracking layer.
- **Net Worth** = assets − liabilities, right now (a *stock*). The position layer. It **automatically** absorbs debt (liability ↓ as principal is paid), real goal accounts (assets), and tax reserves (assets). No special wiring.
- The two must never look alike or blur. Different questions, different visual treatment.

## A8. The only "connection" worth building is read-only intelligence
Reading recurring + debts + goals to *suggest* a budget (alpha item 6) is the right kind of connection: read-only inference over the truth. It never writes phantom money. Build that; build no other cross-entity wiring.

---

# PART B — The Change List (ordered by epic)

Four epics, sequenced by impact. **Epic 1 is the foundation; nothing in Epics 2–4 is trustworthy until Epic 1 ships.** Each change notes its alpha-item origin and a feature flag.

## Epic 1 — Money Feels Real *(the foundation — build first)*

Flag: `FEATURES.moneyModel` (umbrella; sub-flags per change). Builds on the existing Money Map work (`vt_feature_money_map`, accounts table, FK columns) — extend it, do not fork it.

### B1.1 — Enforce account-on-every-transaction *(alpha 8)* — BLOCKING
- Make `account_id` required on expense/income; `account_id` + `to_account_id` required on transfer.
- System **Cash** account auto-created per household; default when unspecified.
- Data-layer guard: reject/repair any accountless transaction (including legacy rows — see B1.6 migration).
- **This is the invariant the rest of Epic 1 depends on. Land it first.**

### B1.2 — Real account balances *(alpha 7)*
- Add `opening_balance` to accounts (provenance-tagged `estimated`/`confirmed`).
- Current balance derived: `opening + credits − debits`. Surface it as a real, finite number.
- Remove the "infinite money" failure mode: an account with no opening balance prompts for one (or defaults to 0 with an `estimated` tag), it does not silently imply unlimited funds.

### B1.3 — Reconciliation *(alpha 9)*
- "Fix balance" on each account: user enters real balance → Vyact computes delta → writes a dated **Balance Adjustment** transaction (an adjustment entry, **never** a silent overwrite).
- Post-reconcile, mark the balance `confirmed`.
- The adjustment is a normal transaction (so it respects A2 and shows in the ledger).

### B1.4 — Per-account ledger *(alpha 10)*
- Account-detail screen: header (balance + reconcile action) → reverse-chronological ledger with All / In / Out / Adjustments filters.
- Each row shows running impact so the balance is explicable line-by-line.
- Largely a presentation layer over existing per-account data once B1.1 holds; reuse `v_txn_by_account`.

### B1.5 — Categories scoped by type *(alpha 13)*
- Extend the existing `CATEGORIES_BY_TYPE` (shipped flag-gated in v7.0.3) to be the single source of truth.
- Expense → consumption categories; Income → source categories; Transfer → **no spend/earn category** (structural only: self-transfer, savings move, debt principal, card payment).
- **Hard rule:** a transfer never carries a spend/earn category and never counts in spending/income totals (prevents the double-count bug).

### B1.6 — Migration (existing data) — BLOCKING with B1.1
- Backfill `account_id` on legacy transactions: map from existing payment-mode/linked-account data where present (v6.4.6 linked payments, Money Map FKs); assign to the system Cash account where absent.
- Existing balances: treat as `confirmed` (data is real; never re-tag as estimate — consistent with the v8 onboarding migration rule).
- Idempotent; reversible; verified no-op where data already conformant.

## Epic 2 — Budgets That Build the Habit

Flag: `FEATURES.budgetsV2`.

### B2.1 — Remove colour-code picker *(alpha 2)* — quick win, do anytime
- Delete colour selection from budget creation. Derive category colour deterministically (stable hash → palette) so it is consistent app-wide with zero user input.

### B2.2 — Budget history & timeline *(alpha 4)*
- First-class, scannable month-by-month timeline: budget vs actual, saved/overspent, %.
- A 6-month mini-trend / sparkline answering "are we improving?" at a glance. Tie to Pulse where possible.

### B2.3 — Category allocations within a budget *(alpha 5)*
- Category sub-limits that **roll up** to the parent budget, with a visible **allocated vs unallocated** indicator and a warning when sub-limits exceed the parent.
- Per-category progress (saved/overspent) bars. Creation stays lean (no colour picker per B2.1).
- Transparency of the roll-up math is mandatory (A1 discipline applied to budgets).

### B2.4 — Copy + suggest budget *(alpha 6 + principle A8)*
- (a) Copy-from-previous-month (easy, immediate value).
- (b) **Suggested budget**: pre-fill category allocations from recurring + debts + goals, presented as an *editable proposal* the user confirms. Framed in Ask Vyact's voice. Reuses the Planner rules — **read-only inference, no new math, no LLM, no phantom money** (A8).

## Epic 3 — Goals & Tax as Lenses *(the modeling decision, made concrete)*

Flag: `FEATURES.goalsLens`, `FEATURES.taxNudge`.

### B3.1 — Goal = progress bar over real money *(principle A4)*
- Reframe goals to the virtual model by default: target + measured progress from tagged contributions. No virtual sub-balance. Contributes nothing to Net Worth.
- Opt-in "back this goal with a real account": user links/creates a real savings account; goal reads its balance; it appears in Net Worth as the asset it is.
- **Remove any UI that implies carving money out of a bank account into a goal.** If such allocation exists today, migrate it to either virtual-progress or a real-account link.

### B3.2 — Tax nudge, not entity *(principle A5)*
- Surface tax as a derived nudge ("likely owe ~₹X; reserved ₹Y") computed from income.
- "Set aside for tax" = a transfer to a real Tax Reserve account (asset, already in Net Worth).
- No tax entity, no phantom tax balance.
- *(Scope note: full tax computation is a later concern; v1 is the reserve-account pattern + a simple estimate. Do not over-build.)*

## Epic 4 — Entry & Surface Polish

Flag: `FEATURES.entryV2` (sub-flags per change).

### B4.1 — Stop keypad auto-launch *(alpha 11a)* — low effort, do immediately
- Remove auto-focus on the amount field on open **and** on edit. On edit especially, the user often wants a non-amount field.

### B4.2 — Shorten the form *(alpha 11b)*
- Primary fields visible: amount, category, **account** (now first-class per Epic 1). Secondary (note, tags, attachment, time) behind a "More details" disclosure.

### B4.3 — Demote time; do NOT add a clock dial *(alpha 12 + 11c)*
- Default time to "now"; move it inside "More details" (B4.2).
- If edited, offer a compact modern input — **not** the dated Material clock dial (it would worsen the "old-school" complaint and lengthen the form). Confirm with alpha users whether editable time is needed at all.

### B4.4 — Flag-off Saved Views *(alpha 3)*
- Hide the `SavedViewsBar` behind a flag (default OFF). **Keep** the `saved_views` table + RPC dormant. Do **not** hard-delete (preserves recent v7.3.0 work; re-enableable for power users).

### B4.5 — Re-theme: PARKED *(alpha 11c)*
- Do not act on "looks old-school" from one user. Collect specific, repeated evidence from 3–5 users; treat any restyle as a separate, evidence-led design pass. **Not in this program.**

---

# PART C — Regression Analysis

This is the section to read before estimating. The money-model changes (Epic 1) sit *underneath* the aggregation engine, which feeds almost every screen. The blast radius is concentrated there.

## C1. The dependency map — what sits downstream of the money model

Per `VERSIONS.md`, these systems consume transactions/accounts and will be affected by Epic 1:

| Downstream system | What it computes | Why Epic 1 touches it |
|---|---|---|
| `monthlyData`, `totalBalance`, `spendByCategory` | Core aggregation engine | Reads transactions; now every txn has an account + transfers are structural. Totals must still exclude transfers. |
| `reportableTxns` | The filtered set Reports/Analysis fold over | Transfer-exclusion logic must hold under the new transfer model (B1.5). |
| `v_txn_by_member`, `v_txn_by_account` | Cloud aggregate views | `v_txn_by_account` becomes load-bearing for the ledger (B1.4); must reflect account_id correctly post-migration. |
| Pulse Score | Composite health signal | Reads budget/savings/debt/trend. Category re-scoping (B1.5) and budget changes (Epic 2) shift its inputs. |
| `aiSummary.ts` | Privacy-safe aggregation for Ask Vyact | Reads the same totals; Ask Vyact answers must stay consistent with the dashboard after the model change. |
| Net Worth | Assets − liabilities | Now also absorbs real goal accounts + tax reserves; must NOT absorb virtual goals. |
| Transfer tagging (`__tg:`, `linkedToAssetId`) | Self-cancelling transfer rows | The new From→To transfer model (B1.1) must not double-count against the legacy tag scheme during migration. |

## C2. Highest-risk regressions (guard explicitly)

### R1 — Transfers double-counting in spend/income totals — CRITICAL
- **Risk:** the new transfer model (B1.1, debit+credit two accounts) interacting with the legacy `__tg:`/linked-row scheme could cause transfers to appear in `spendByCategory` / `monthlyData` / `reportableTxns`, inflating spending or income.
- **Protect:** transfers must self-cancel in all totals (A2 + B1.5). One canonical transfer representation post-migration; retire or reconcile the `__tg:` scheme. 
- **Test:** seed transfers across accounts → assert spending total, income total, and category breakdowns are unchanged by the transfer; assert Net Worth is unchanged by an internal transfer.

### R2 — Migration mis-assigning accounts — CRITICAL
- **Risk:** B1.6 backfill assigns the wrong account (or all to Cash), corrupting per-account balances and the new ledger.
- **Protect:** prefer existing linked-payment/FK data; only fall back to Cash when truly absent; idempotent; dry-run with counts before apply (mirror the documented Supabase MCP migration discipline).
- **Test:** on a copy of real data, assert sum of per-account balances reconciles to the prior global total; assert no transaction is orphaned.

### R3 — Net Worth contaminated by virtual goals — HIGH
- **Risk:** a virtual goal (A4) accidentally counts as an asset, double-counting money that's still in the user's bank account.
- **Protect:** virtual goals contribute **zero** to Net Worth by construction; only real-account-backed goals appear (as the account, not the goal).
- **Test:** create a virtual goal with progress → assert Net Worth unchanged. Back it with a real account → assert Net Worth reflects the account exactly once (not account + goal).

### R4 — Reconciliation as overwrite instead of adjustment — HIGH
- **Risk:** B1.3 implemented as a silent balance overwrite breaks auditability and the ledger (B1.4), and violates A2.
- **Protect:** reconciliation always writes a dated Balance Adjustment transaction; never mutates balance directly.
- **Test:** reconcile an account → assert a new adjustment transaction exists, appears in the ledger, and the balance equals opening + entries including the adjustment.

### R5 — Pulse Score / aiSummary drift — MEDIUM
- **Risk:** category re-scoping (B1.5) and budget changes (Epic 2) silently change Pulse inputs, so the score jumps for reasons users can't see; or Ask Vyact answers diverge from the dashboard.
- **Protect:** keep Pulse component definitions stable across the change; re-validate `aiSummary` totals equal dashboard totals after Epic 1.
- **Test:** golden-file the Pulse components and `aiSummary` payload for a fixture household before/after; diff must be explainable (only expected shifts).

### R6 — Reports breakouts (by member / by account) — MEDIUM
- **Risk:** the v7.2 `By member` / `By account` panels fold over `reportableTxns`; transfer-exclusion or account-attribution changes could skew them.
- **Protect:** breakouts read the same canonical transfer-excluded set.
- **Test:** by-account sums reconcile to per-account ledger debits; by-member unaffected by internal transfers.

### R7 — Onboarding estimates vs real balances — MEDIUM
- **Risk:** Epic 1's opening-balance + provenance interacts with the v8 onboarding temporary-baseline model; an estimated onboarding balance could be mistaken for a confirmed real balance (or vice versa).
- **Protect:** reuse the existing `confidence`/`source` columns; opening balance from onboarding is `estimated` until reconciled (B1.3 confirms it).
- **Test:** onboarding-seeded account reads `estimated`; after reconcile, reads `confirmed`; the 21-day nudge cadence still fires.

## C3. Flows that REMAIN and must keep working (the protect-list)

These are not being changed, but they consume the changed core. Each needs a regression pass:

- **Add/Edit transaction** (all types) — still creates valid, account-bound records; splits still work; recurring still generates correctly.
- **Splits** (v6.4.8 auto-even) — a split expense still debits one account; only the user's share counts as expense; transfers never split.
- **EMI / debt payments** (the interest/principal split) — still splits correctly, principal still books as a transfer (liability reduction), interest as expense. **This is the one existing goal/debt/tax connection — protect it precisely.**
- **Recurring transactions + notifications** — still fire; generated transactions are account-bound (A2).
- **Net Worth balance sheet + ratios** — still computes; now includes real goal accounts + tax reserves; excludes virtual goals.
- **Reports / Analysis (incl. predicted spend)** — totals unchanged by transfers; trend/projection still valid.
- **Dashboard cards + navigation** (v7.4.4 click-throughs) — Cash Flow and Net Worth still correct; card links still resolve.
- **Ask Vyact** (Capture/Interpret/Forecast) — answers stay consistent with the dashboard; Capture still seeds account-bound transactions.
- **Multi-household + RLS** — per-household account scoping holds; system Cash account is per-household; no cross-household leak.
- **Sync / concurrency** (HybridAdapter, replace_* RPCs, conflict banner) — new fields (opening_balance, etc.) round-trip; bulk replace stays atomic.
- **Multi-device / provenance** — confidence/source survive sync; reconciliation on one device reflects on another.

## C4. Test strategy (minimum bar before each epic ships)

1. **Golden-file the aggregation engine** for a representative fixture household *before* Epic 1: `monthlyData`, `totalBalance`, `spendByCategory`, `reportableTxns`, Net Worth, Pulse components, `aiSummary`. Every Epic-1 PR diffs against it; only expected changes allowed.
2. **Migration dry-run harness** (R2): run B1.6 on a copy, assert balance reconciliation + zero orphans, before any prod apply.
3. **Transfer invariant suite** (R1): transfers never move spending/income totals or Net Worth.
4. **Provenance lifecycle test** (R7): estimated → confirmed transitions through reconciliation; onboarding cadence intact.
5. Extend the existing Playwright suite (v6.5.0, the `CON-E2E-*` / `CON-UNIT-*` catalogue) with the above; keep the code↔doc reconciler green.
6. **Per-epic flag-off test:** each epic's flag OFF = current v8.0.1 behaviour, clean no-op (the established pattern).

---

# PART D — Sequencing & flags summary

| Order | Epic | Flag | Gate to next |
|---|---|---|---|
| 1 | Money Feels Real (B1.1→B1.6) | `FEATURES.moneyModel` | Golden-file diff clean; migration reconciles; transfer invariant green |
| 2 | Budgets (B2.1→B2.4) | `FEATURES.budgetsV2` | Roll-up math transparent; Pulse drift explained |
| 3 | Goals & Tax as Lenses (B3.1→B3.2) | `FEATURES.goalsLens`, `FEATURES.taxNudge` | Net Worth uncontaminated by virtual goals |
| 4 | Entry & Surface Polish (B4.1→B4.5) | `FEATURES.entryV2` | Form regression pass; Saved Views flag-off clean |

**Quick wins extractable anytime** (low risk, no dependency on Epic 1): B2.1 (colour picker), B4.1 (keypad auto-focus), B4.4 (Saved Views flag-off).

**Build the flag + verify OFF-state first in every epic** — the established Vyact discipline. With each flag off, the app must be indistinguishable from v8.0.1.

---

*End of spec. Part A governs; if an implementation would make any number untrue, stop. The whole program exists to make money feel real — do not let the wiring make it lie.*
