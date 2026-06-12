# Vyact — Developer Investigation Prompt

```yaml
meta:
  for: implementing developer (code + DB access required)
  from: product / solution architect
  baseline: consumer v9.0.1 · admin v1.1.0 · Supabase cloud (HybridAdapter)
  companion: vyact-v9-feedback-triage-and-solutions.md
  rule: >
    DIAGNOSE before you fix. For each investigation, report root cause + a proposed
    fix BEFORE changing behaviour. Do not paper over a symptom. If you find the cause
    is in the data model, say so — a redesign (item 7 budgets) may be the right fix
    rather than a patch.
```

You have two root-cause investigations. **Investigation A is P0** (data-integrity / trust). Investigation B is a scoped "is this a stub or a regression" check. Work A first.

---

## Investigation A — Budgets diverge across two devices on the same login (P0)

### Symptom
A user logged into the **same account** on **two different devices** sees the **budgets module behaving independently** — budgets created/edited on one device don't appear (or differ) on the other. Money data that doesn't agree across a user's own devices is a trust-breaking, P0-class defect.

### Why this is suspicious (context you should know before digging)
The repo history shows several places where budget state has lived **per-device**, any of which could be the culprit:

- `budgetMeta.ts` — budget `period` was stored in a **per-device localStorage overlay** (`ff_budget_periods`) "until a v6.5 schema migration." TD-13 (PR #20) later added real `period` / `period_start` / `period_end` columns to `budgets`. **If any budget identity (period/month) is still being read from the local overlay instead of the synced columns, two devices will key budgets differently and diverge.** This is hypothesis #1.
- `budgets.allocations` jsonb was added in **v8.7.0** then **dropped in v8.8.0**. A device holding a **stale cached build or stale local cache** referencing allocations could behave differently from an updated one.
- The `HybridAdapter` cache-no-clobber / per-`(household, entity)` sync sentinel (`ff_cloud_synced_<hid>_<entity>`) governs whether an empty cloud response is trusted. **If the `budgets` entity's sentinel or sync path is mishandled, one device's budgets may never round-trip or may be clobbered.** Hypothesis #2.
- Budget **identity / id generation**: if a budget's effective key is derived locally (e.g. from period overlay) rather than a stable synced id, each device can mint a *parallel* budget for "the same" month. Hypothesis #3.
- The "numberSystemPref" / overlay pattern is documented as the sanctioned approach for un-migrated schema — confirm budgets aren't still leaning on an overlay for anything **identity-bearing** (period is identity; a display pref is not).

### Ranked hypotheses (test in this order)
1. **Per-device period overlay still authoritative.** Budget period/identity is read from `budgetMeta.ts` / `ff_budget_periods` localStorage rather than the synced `budgets.period_*` columns → devices disagree on which budget is which.
2. **Budgets entity not round-tripping through the adapter.** The `budgets` cloud write/read path or the sync sentinel is broken/misconfigured → writes stay local.
3. **Parallel-budget minting.** No stable cross-device identity for "June 2026 budget" → each device creates its own row.
4. **RLS / household scoping.** Budgets written under the wrong `household_id`, or a household mismatch between devices.
5. **Stale build on one device** (SW cache) masking a fixed issue — rule this out early (hard refresh both devices to the same `version.json`).

### Where to look
```
react/src/lib/budgetMeta.ts            — the per-device overlay; is it still authoritative for period/identity?
react/src/lib/hybridAdapter.ts         — applyCloudList no-clobber, ff_cloud_synced_<hid>_budgets sentinel, replaceAll('budgets')
react/src/lib/supabaseAdapter.ts       — budgets row mappers; does period_year/month/period_* round-trip? tableName('budgets')
react/src/store.ts                     — upsertBudget / budget slice; where does budget identity come from?
react/src/pages/Budgets.tsx            — how a budget is keyed/looked-up for the current period
supabase migrations                    — 20260529150000_td13_budgets_add_period.sql (the real period columns);
                                         20260607150000_v8_drop_budget_allocations.sql (the dropped jsonb)
```

### Concrete steps
1. Reproduce on two browsers/profiles (same login, same household). Confirm both are on the **same build** (`version.json`) and **same household_id**.
2. Create a budget on Device 1. In Supabase, query the `budgets` table directly: **did a row actually get written**, with correct `household_id`, `period_year`, `period_month`, `period_start/end`?
3. On Device 2, check the network: does the `budgets` list request **return that row**? If yes-in-DB but not-shown → read/identity bug (hyp 1/3). If not-in-DB → write/sync bug (hyp 2).
4. Inspect `localStorage` on both devices for `ff_budget_periods` / budgetMeta keys. Are they driving which budget is shown? If Device 1's budget identity exists only in its localStorage, that's the smoking gun (hyp 1).
5. Check the `ff_cloud_synced_<hid>_budgets` sentinel behaviour for the budgets entity.

### What to report back (before fixing)
- Which hypothesis is correct, with the evidence (DB row screenshot/query result + network payload + localStorage contents).
- Whether the fix is a **patch** (route budget identity through synced columns; fix the sentinel) or a **data-model fix** (give budgets the strict `(scope, year, month)` identity that §4 of the solution spec specifies).
- **Important architectural link:** §4 (budget redesign) introduces a strict, cloud-synced budget identity + an allocations **child table**. If your root cause is per-device identity (hyp 1/3), the §4 redesign likely **fixes this bug as a side effect** — coordinate so you don't patch then immediately rebuild. Recommend whether to (a) hotfix now + redesign later, or (b) fold the fix into the §4 build with a regression test. Add a test asserting **two clients see the same budget for the same (scope, year, month)**.

### Guardrail
Do not "fix" by forcing a full resync that hides the identity problem. If budgets are minting in parallel, a resync just merges duplicates. Find the identity/sync root cause first.

---

## Investigation B — "Owed to me" debt cannot be created (scoped)

### Symptom
The user cannot create or manage a debt **owed to them** (a receivable). It "appears a stub."

### Context
v7.2.0-rc shipped the receivable plumbing: `debts.direction ('owed_by_me'|'owed_to_me')`, `counterparty_name`, the `All / Owe / Owed to me` **filter** tabs, `totalReceivables`, and Net-Worth handling for receivables. The likely gap: the **create** path (`DebtFormModal`) never exposed a **direction selector**, so you can *filter* for receivables but not *create* one — i.e. the feature is read-only / half-wired.

### Ranked hypotheses
1. **Missing create-UI.** `DebtFormModal` has no direction toggle / counterparty field → every debt is created `owed_by_me`. (Most likely.)
2. **Flag-gated off.** The direction feature sits behind a flag that's off in the current build. (Less likely post v8.8 flag-freeze, but confirm.)
3. **Regression.** A later refactor dropped the direction control that once existed.

### Where to look
```
react/src/components/debts/DebtFormModal.tsx  — is there a direction selector + counterparty_name input?
react/src/pages/Debts.tsx                     — the All/Owe/Owed-to-me tabs: filter-only, or do they seed create?
react/src/store.ts                            — upsertDebt: does it accept/persist direction + counterparty_name?
react/src/lib/supabaseAdapter.ts             — debts mappers: do direction / counterparty_name round-trip?
supabase migrations                           — 20260602120000_money_map_phase1_accounts.sql (adds debts.direction + counterparty_name + the owed_by_me|owed_to_me check)
```

### Concrete steps
1. Open Add Debt. Is there any way to choose "owed to me"? (Confirm hyp 1.)
2. Manually insert a `direction='owed_to_me'` debt row in Supabase. Does it render under the "Owed to me" tab and count toward assets/Net Worth? If yes → the only gap is the create UI (clean, small fix). If no → the read/aggregation path also regressed (wider fix).
3. Confirm `upsertDebt` + the adapter mappers persist `direction` and `counterparty_name`.

### What to report back
- Confirmed root cause (which hypothesis) + evidence.
- Scope of fix: create-UI only, or create-UI + read/aggregation.
- Then implement §6 of the solution spec (direction selector + counterparty + receivable repayment behaviour). Add the §8 debt drill-down to cover receivables too.

### Guardrail
A receivable is an **asset**, never spend/income at creation; a repayment is an **inflow that reduces the receivable** (asset shift, Net-Worth-neutral). Don't let a receivable or its repayment leak into spending/income totals.

---

## Reporting format (both investigations)

```yaml
report_each:
  - root_cause: "the confirmed cause, with evidence (DB query, network payload, localStorage, code ref)"
  - blast_radius: "what else touches this path"
  - proposed_fix: "patch vs data-model fix; effort; risk"
  - regression_test: "the assertion that proves it fixed and stays fixed"
  - coordination_note: "does this overlap a planned build (§4 budgets / §6 debts)? hotfix-now or fold-in?"
```

*Diagnose, report, then fix. Investigation A is P0 — a user's budgets must agree across their own devices.*
