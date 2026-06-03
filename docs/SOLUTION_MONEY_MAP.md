# Solution Direction — Money Map (Backend-Dependent Initiatives)

**Status:** **Phase 1 shipped (v7.1.x → v7.2.0-rc, 2026-06-02)** · **Owner:** Product + Eng Lead · **Target:** v7.2 (migration) → v7.3 (full cutover)
**Backend impact:** **High** — schema, RLS, dual-write, indexed aggregates
**Pairs with:** [SOLUTION_TRACK_TXN_MODAL.md](SOLUTION_TRACK_TXN_MODAL.md) (zero-backend, v7.1)
**Resolves Auto-Linking phases:** A (in full), B (partial), foundational for D
**Last reviewed:** 2026-06-02

---

## Implementation status (2026-06-02)

> Source-of-truth ledger of what's actually in `main` against the design
> below. Update this table when each row's gate flips. Cross-reference for
> reviewers and continuity sessions.

| # | Item | Where in this doc | Status | Shipped in |
|---:|---|---|---|---|
| 2 | Accounts as first-class | [Migration A · schema](#schema), [App-layer](#app-layer-changes) | ✅ Done | Migration `20260602120000_money_map_phase1_accounts.sql`; consumer `v7.1.2` (entity slice) + `v7.1.3` (Accounts UI) + `v7.2.0-rc` (`replace_accounts` RPC) |
| 5 | Net Worth → payment-method linking | [Migration A · schema](#schema), [App-layer](#app-layer-changes) | ✅ Shipped | FK columns + dual-write live in `v7.1.1`; Net Worth shows receivables in `v7.2.0-rc`; `AccountDrawer.tsx` (multi-account split UI on transactions) shipped in `v7.3.0` (persists onto `extras.accountSplits`; dedicated `transaction_splits` table queued for v7.4). |
| 3 | Bidirectional debt (lending) | [Migration A · schema](#schema) | ✅ Done | `debts.direction`/`counterparty_name` in migration; consumer `v7.2.0-rc` adds direction tabs on Debts, separates receivables on Net Worth, excludes them from `totalLiabilities`/`totalMonthlyDebtPayment`/DTI |
| 8 | Reports by member / payment method | [Migration A · schema](#schema) | ✅ Shipped | `v_txn_by_member` / `v_txn_by_account` views shipped; `By member` / `By account` panels live in `v7.2.0-rc`; `v7.3.0` swaps the read path onto the cloud views when Money Map is `'on'` (transparent client-side fold fall-back for shadow/off/local). |
| 4 | Saved filter views | [Migration C](#v73-migration-c--2026_07_saved_viewssql-item-4) | ✅ Shipped | `saved_views` table + RLS + `replace_saved_views` RPC + adapter + `SavedViewsBar` UI on Transactions / Reports / Insights shipped in `v7.3.0`. Per-row `is_shared` opt-in for household sharing. |
| 7 | Education progress | [Migration B](#v72-migration-b--2026_06_education_progresssql-item-7) | ✅ Shipped | `profiles.education_progress jsonb` wired through `getProfile`/`updateProfile` and `markEducation` store action; new `WhyChip` primitive + `lib/educationProgress.ts` (50-key LRU `localStorage` map for local-only mode). Shipped in `v7.3.0`. Insights/Education *surface* placement is a follow-up. |

### Rollout window status

| Window | Flag default | App writes | App reads | Status |
|---|---|---|---|---|
| **v7.2.0-rc** (current) | `'shadow'` (auto on cloud builds) | dual: `linked_asset_id` + `account_id` | legacy first, FK fallback | ✅ Shipped 2026-06-02 |
| **v7.2.1** | `'on'` | `account_id` only | FK first, legacy fallback | ⏳ Pending — gate is parity dashboards over the shadow window |
| **v7.3.0** | flag retired | `account_id` only | `account_id` only | ⏳ Pending — pairs with saved views + education progress |

### Pending checklist (shortest path to v7.3)

- [ ] **DEBT-FC-010** — lending direction E2E test (consumer)
- [ ] **NWRT-FC-007** — account drawer / multi-account-split E2E test
- [ ] **`AccountDrawer.tsx`** — multi-account split UI on the transaction modal (Item #5 M-tier)
- [ ] Wire `v_txn_by_*` views as the Reports read path on mobile (Item #8 mobile perf)
- [ ] Promote `getMoneyMapMode()` default to `'on'` (v7.2.1) once shadow-mode parity is confirmed
- [ ] `2026_06_education_progress.sql` migration + Education progress UI (Item #7)
- [ ] `2026_07_saved_views.sql` migration + entity slice + Saved Views UI (Item #4, v7.3)
- [ ] Retire the `vt_feature_money_map` flag (v7.3)

---

## Target user groups (sticks throughout)

Drawn from [ARCHITECTURE.md](../ARCHITECTURE.md) `Household.type` and
[CLAUDE.md](../CLAUDE.md):

| Group | Profile | Sensitivity |
|---|---|---|
| **Multi-gen family** (primary persona) | 2–6 members across roles `primary / partner / child / elder`; mobile-first; mixed financial literacy | Highest — privacy between members, simple UX for elders/children |
| **Small business / freelancer** | 1–3 members; uses receivables, debt direction, multi-currency | Needs structured reports, audit trail |
| **Personal** | Single user | Low setup overhead, fast entry |
| **Shared (roommates)** | 2–5 unrelated members | Strict per-member privacy on excluded transactions |

Every design choice below is justified against these groups.

---

## Scope — items that genuinely require backend change

| # | Item | Why backend |
|---:|---|---|
| 2 | Accounts as first-class | Indexed FK from transactions; cross-device |
| 5 | Net Worth → payment-method linking | Server-side join from `transactions` to `accounts` for filters/aggregates |
| 3 | Bidirectional debt (lending) | `debts.direction` affects Net Worth math at the SQL view layer |
| 8 | Reports by member / payment method | Indexed aggregates over 5k+ rows; client-side groupby is too slow on mobile |
| 4 | Saved filter views | Cross-device persistence |
| 7 | Education progress | Resumable across devices |

Items **1, 6, 9** stay zero-backend (already in v7.1 plan).

---

## v7.2 Migration A — `2026_06_money_map.sql`

Single migration; covers items **2, 3, 5, 8**. Designed to be **additive only**
— no column drops, no breaking renames, no data destruction.

### Schema

```sql
-- Phase 1 — first-class accounts (Items #2, #5)
create table if not exists accounts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  asset_id      uuid references assets(id) on delete set null,  -- legacy back-link
  kind          text not null check (kind in
                  ('checking','savings','credit_card','cash',
                   'investment','wallet','other')),
  name          text not null,
  currency      char(3) not null,
  is_default    boolean not null default false,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index accounts_default_per_currency
  on accounts (household_id, currency)
  where is_default and not is_archived;

create index accounts_household
  on accounts (household_id) where not is_archived;

-- Phase 2 — link transactions to accounts (Item #5)
alter table transactions
  add column if not exists account_id     uuid references accounts(id),
  add column if not exists to_account_id  uuid references accounts(id),
  add column if not exists initiated_by   uuid references members(id);

create index transactions_account
  on transactions (household_id, account_id);
create index transactions_to_account
  on transactions (household_id, to_account_id);
create index transactions_member
  on transactions (household_id, initiated_by);

-- Phase 3 — debt direction (Item #3, lending)
alter table debts
  add column if not exists direction text not null default 'owed_by_me'
    check (direction in ('owed_by_me','owed_to_me')),
  add column if not exists counterparty_name text;

create index debts_direction
  on debts (household_id, direction) where status = 'active';

-- Phase 4 — server-side aggregates (Item #8)
create or replace view v_txn_by_member as
  select household_id, initiated_by as member_id,
         date_trunc('month', date) as period,
         type, currency,
         sum(amount) as total, count(*) as n
    from transactions
   where excluded is not true
   group by 1,2,3,4,5;

create or replace view v_txn_by_account as
  select household_id, account_id,
         date_trunc('month', date) as period,
         type, currency,
         sum(amount) as total
    from transactions
   where excluded is not true
   group by 1,2,3,4,5;

-- Phase 5 — RLS (mirrors existing transactions policies)
alter table accounts enable row level security;

create policy accounts_select on accounts for select
  using (household_id in (
    select household_id from household_members where user_id = auth.uid()));

create policy accounts_write on accounts for all
  using (household_id in (
    select household_id from household_members
     where user_id = auth.uid() and role in ('primary','partner')))
  with check (household_id in (
    select household_id from household_members
     where user_id = auth.uid() and role in ('primary','partner')));
```

### Backfill (idempotent, runs once per household)

```sql
insert into accounts (household_id, asset_id, kind, name, currency, is_default)
select a.household_id, a.id,
       case a.type
         when 'checking'    then 'checking'
         when 'savings'     then 'savings'
         when 'credit_card' then 'credit_card'
         when 'cash'        then 'cash'
         else 'other'
       end,
       a.name, a.currency,
       row_number() over (partition by a.household_id, a.currency
                          order by a.value desc) = 1
  from assets a
 where a.type in ('checking','savings','credit_card','cash')
on conflict do nothing;

update transactions t
   set account_id = ac.id
  from accounts ac
 where ac.asset_id = t.linked_asset_id
   and t.account_id is null;
```

---

## v7.2 Migration B — `2026_06_education_progress.sql` (Item #7)

```sql
alter table profiles
  add column if not exists education_progress jsonb not null default '{}'::jsonb;
-- Shape: { "<topic_id>": { completed_at: iso, dismissed_at: iso? } }
```

Trivial — additive jsonb column, no RLS change (inherits `profiles` policy).

---

## v7.3 Migration C — `2026_07_saved_views.sql` (Item #4)

```sql
create table saved_views (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  household_id  uuid not null references households(id) on delete cascade,
  page          text not null check (page in ('transactions','reports','insights')),
  name          text not null,
  filters       jsonb not null,
  is_shared     boolean not null default false,
  created_at    timestamptz default now()
);

create index saved_views_user on saved_views (user_id, page);

alter table saved_views enable row level security;

create policy saved_views_self on saved_views for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy saved_views_household_shared on saved_views for select
  using (is_shared and household_id in (
    select household_id from household_members where user_id = auth.uid()));
```

---

## App-layer changes

| File | Change |
|---|---|
| [react/src/types.ts](../react/src/types.ts) | New `Account`, `SavedView`; extend `Transaction` with `accountId`, `toAccountId`, `initiatedBy`; extend `Debt` with `direction`, `counterpartyName` |
| [react/src/lib/dataAdapter.ts](../react/src/lib/dataAdapter.ts) | Add `accounts` and `savedViews` CRUD to interface |
| [react/src/lib/hybridAdapter.ts](../react/src/lib/hybridAdapter.ts) | Add `accounts`, `savedViews` to per-`(household, entity)` sync sentinel list (preserves v6.4 cache no-clobber rule) |
| [react/src/lib/supabaseAdapter.ts](../react/src/lib/supabaseAdapter.ts) | New table mappings; numeric serialization stays per `parseMoneyFromCloud` (FX-FC-004) |
| [react/src/lib/accounts.ts](../react/src/lib/accounts.ts) | Switch from synthesized-from-assets to read-from-store; preserve `LocalStorageAdapter` synthesis fallback for local-only mode |
| [react/src/store.ts](../react/src/store.ts) | New slots `accounts`, `savedViews`; CRUD actions follow the v6.4 modal-via-store-slots convention |
| `react/src/pages/Accounts.tsx` | **NEW** — Item #2 Variant A |
| `react/src/components/networth/AccountDrawer.tsx` | **NEW** — Item #2 Variant B |
| [react/src/pages/Reports.tsx](../react/src/pages/Reports.tsx) | New "By member" + "By account" toggles fed by `v_txn_by_*` views |
| [react/src/pages/Debts.tsx](../react/src/pages/Debts.tsx) | Direction tabs (Owe / Owed-to-me); separate liability vs. receivable in Net Worth |

Local-only mode is preserved: `LocalStorageAdapter` keeps deriving accounts
from `assets` so the app works offline-first without env vars (per
[CLAUDE.md](../CLAUDE.md)).

---

## Rollout — three release windows

| Window | Flag state | App writes | App reads | Risk |
|---|---|---|---|---|
| **v7.2.0-rc** | `vt_feature_money_map = 'shadow'` | `linked_asset_id` AND `account_id` (dual-write) | `linked_asset_id` first, `account_id` fallback | Low |
| **v7.2.1** | `'on'` | `account_id` only | `account_id` first, legacy fallback | Medium — first user-visible cutover |
| **v7.3.0** | flag retired | `account_id` only | `account_id` only; legacy column kept for historical rows | Low |

The dual-write window guarantees that **a v7.2 client and a v7.1 client
viewing the same household see the same data**. Critical for households
where one device upgrades before another (typical for elders / children
who do not auto-update).

---

## Regression impact on the v7.1 track-txn modal

The v7.1 modal ([SOLUTION_TRACK_TXN_MODAL.md](SOLUTION_TRACK_TXN_MODAL.md))
ships with `linkedToAssetId` as a TS-only field, persisted inside the
existing JSON shape. Money Map introduces a real FK column. The interaction
points need explicit handling:

### What breaks if we do nothing

| Scenario | Bug |
|---|---|
| User on v7.2 creates a transfer; reports filter by account | `to_account_id` was never written → transfer destination disappears from "By account" view |
| User on v7.1 creates a transfer; same household opened on v7.2 | `linkedToAssetId` lives in JSON but the v7.2 query reads `to_account_id` → row appears unlinked |
| Investment categories from v7.1 sent to v7.2 reports | New category ids (`dividend`, `capital_gain`, `rebalance`) not in any v7.1-era budget → silently uncategorised |
| `txn_saved` analytics event keeps `account_type` from v7.1 | Now redundant with `account_id`; double-source risk |

### What the cutover must do

1. **TypeScript field rename, semantic-preserving:**
   ```diff
   - linkedToAssetId?: string;     // v7.1 — points at an asset id
   + accountId?: string;            // v7.2 — points at an account id
   + toAccountId?: string;          // v7.2 — transfer destination
   ```
   The v7.1 field is removed from the type but kept readable by the
   adapter for one release for forward-compatibility.

2. **Adapter shim (one release window):**
   `LocalStorageAdapter.read()` maps any persisted `linkedToAssetId` →
   look up the account whose `asset_id` matches → set `toAccountId`.
   Same trick the [localStorageCompat.ts](../react/src/lib/localStorageCompat.ts)
   shim used for the v7.0 `ff_*` → `vt_*` migration. **Same pattern; no
   new technique required.**

3. **Transfer encoding upgrade:**
   The v7.1 two-row trick (`note: '__tg:<groupId>'`) is preserved on read
   but **new** transfers in v7.2 write a single row with both `account_id`
   and `to_account_id`. Reports must dedupe both encodings until v7.3 ships.
   This is the single highest-risk piece of the cutover — see Risk R-1.

4. **Analytics:**
   `txn_saved` keeps the same param schema. `account_type` value is now
   sourced from `accounts.kind` rather than `assets.type` — same enum,
   no GA4 admin change required. `events.yaml` notes the source change in
   the `added_in: v7.2` comment.

5. **Test inventory:**
   - **TXN-FC-003** (transfer) — already un-fixme'd in v7.1; assertion
     extends in v7.2 to expect `account_id` + `to_account_id` set, plus
     paired-row trick still observable for legacy data.
   - **NWRT-FC-001 / -002 / -005 / -006** — flip from 🟠 to 🟡 designed,
     then ✅ once v7.2.1 is on.
   - **NEW NWRT-FC-007** — Account drawer renders linked transactions
     for the selected account (M-tier, ~6 h).
   - **NEW DEBT-FC-010** — Lending (`direction='owed_to_me'`) appears
     as a receivable on Net Worth (M-tier, ~6 h).

---

## How both solutions deliver in harmony

The two releases are **deliberately layered** rather than competing:

```
┌─────────────────────────────────────────────────────────────┐
│  v7.1 (zero-backend)  — TRACK-SPECIFIC MODAL                │
│  Item 1, 6, 9                                                │
│  TypeScript field `linkedToAssetId`, JSON-persisted          │
│  Two-row transfer encoding via note prefix                   │
│                                                              │
│      ▼ Same UI shape, same field labels stay stable ▼        │
│                                                              │
│  v7.2 (backend)  — MONEY MAP                                 │
│  Item 2, 3, 5, 8                                             │
│  `account_id` / `to_account_id` columns + indexes            │
│  Single-row transfer; legacy two-row still readable          │
│  Server-side aggregates power "By member / by account"       │
│                                                              │
│      ▼ Filter views become cross-device ▼                    │
│                                                              │
│  v7.3 (additive)  — SAVED VIEWS                              │
│  Item 4                                                      │
└─────────────────────────────────────────────────────────────┘
```

User-facing harmony principles:

1. **The v7.1 modal UI is the v7.2 modal UI.** Field labels, track picker,
   keyboard shortcuts — none change. The schema underneath swaps; the
   field that was called "Linked account" still says "Linked account."
2. **Account list source of truth** — `lib/accounts.ts:buildAccounts` is
   the single read path for the picker. v7.1 synthesises from assets;
   v7.2 reads the `accounts` table. The component contract is
   `Account[]`, identical signature.
3. **Reports gain a tab, not a redesign.** v7.1's existing donut + period
   selector is preserved; v7.2 adds a new "By member / By account" toggle
   on the same page. No layout regression for users on v7.1.
4. **Local-only households are unaffected.** The synthesis fallback in
   `LocalStorageAdapter` remains; users without Supabase env vars see
   the v7.1 experience indefinitely (per
   [CLAUDE.md](../CLAUDE.md) "Cloud is opt-in").
5. **Analytics stays one schema.** Events from v7.1 and v7.2 share the
   same `track`, `account_type`, `currency`, `amount_bucket` parameters
   — no funnel discontinuity.

---

## Risks

### Usability — multi-gen / mobile-first family is the hardest test

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| U-1 | Elders/children see new mandatory "From / To account" fields and abandon entry | High | v7.2 keeps `account_id` **optional** in the form; auto-populates from `is_default` per currency. Hard requirement only at v7.3 |
| U-2 | Account list grows unwieldy for households with mixed currencies | Medium | Default-per-currency invariant (unique index) caps to 12 currencies × N accounts; UI groups by currency |
| U-3 | "Owed to me" lending changes Net Worth in ways elders find confusing | Medium | Receivables show as separate line item on Net Worth, not merged into Assets |
| U-4 | Saved views shared across household leak privacy intent | Medium | `is_shared = false` default; privacy reviewer sign-off before flipping the toggle UI on |
| U-5 | Mobile keyboard hides amount field while user picks account | Low | Account picker collapses on focus of amount field (existing pattern in `TransactionFormModal`) |

### Scalability

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| S-1 | `v_txn_by_*` views slow on households with > 50k transactions | Medium | Indexes `transactions_account`, `transactions_member` make these views index-only scans; benchmark in PERF-FC at v7.2-rc |
| S-2 | Backfill blocks production write traffic on large tenants | Medium | Run backfill in batches of 5k rows with `commit` per batch; behind feature-flag, no user impact during shadow window |
| S-3 | jsonb `education_progress` grows unbounded | Low | Cap at 50 keys app-side; prune on write |
| S-4 | Dual-write doubles write QPS for one release window | Low | Supabase free tier headroom is sufficient; revisit before scale-out |

### Security

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| Sec-1 | New `accounts` RLS policy mis-scoped → cross-household leak | **Critical** | Mirror existing `transactions` policy verbatim; AUTH_HARDENING.md sign-off; cloud E2E test SYNC-FC-002 extended to assert account isolation |
| Sec-2 | `saved_views` shared rows expose filter shape that implies private data | High | `filters` jsonb is sanitised app-side before save; no transaction ids stored, only filter parameters |
| Sec-3 | New views (`v_txn_by_*`) bypass row-level filters if used incorrectly | High | Views must include `household_id` predicate in every query; lint at PR review; no `select *` from views |
| Sec-4 | `direction='owed_to_me'` debts surface counterparty names — potential PII | Medium | `counterparty_name` is free-text from the user, never sent to GA4; treat as transaction-description-equivalent in `events.yaml` `forbidden_params` |
| Sec-5 | Dual-write window doubles attack surface on writes | Low | Same RLS gate on both columns; no new endpoints |

### Adoption

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| A-1 | Households on v7.1 mobile (iOS PWA, slow update) see "missing data" when v7.2 web user creates a transfer | High | Dual-write guarantees both encodings present until v7.3; in-app banner on v7.1 prompts update once dual-write window ends |
| A-2 | Multi-gen family — primary upgrades, child still on v7.1 | High | Same as A-1; child sees v7.1 view, edits propagate via dual-read for one release |
| A-3 | Small business needs receivables NOW; fragmented release schedule frustrates | Medium | Ship `direction` column in v7.2 so the lending UI lands together with accounts, not split across two releases |
| A-4 | Local-only users feel left behind from server-side aggregates | Low | Reports' "By member" toggle still works locally via in-memory groupby (just slower past 5k rows); messaging emphasises cloud as opt-in benefit |
| A-5 | Education progress sync surprise — user dismisses tip on phone, sees it again on web | Low | jsonb column resolves it post-v7.2; messaging not required |

---

## Cross-cutting acceptance criteria

A v7.2 release ships **only if** all six gates pass:

1. Cloud E2E suite includes a new `SYNC-FC-007` — RLS isolation between
   two households on the new `accounts` table.
2. Dual-write window verified: v7.1 client + v7.2 client on same Supabase
   project see the same transfer end-state (Playwright cross-version test
   in `react/e2e/tests/cross-version.spec.ts`).
3. Backfill is idempotent — running it twice produces identical counts.
4. PERF-FC-002 — Reports period switch on a 5k-row dataset stays
   < 800 ms with the new `By member` aggregation.
5. AUTH-FC-008 (accept invitation) still passes — household membership
   path is unchanged.
6. Local-only mode (no Supabase env vars) — full E2E suite still passes.
   Defends the "Cloud is opt-in" promise.

---

## Effort estimate

| Bucket | Hours |
|---|---:|
| Migration SQL + backfill + RLS | ~24 |
| Adapter (Hybrid + Supabase) updates | ~32 |
| App pages (Accounts, AccountDrawer, Debts direction, Reports tabs) | ~80 |
| Test inventory (10 new + 4 unblocked rows) | ~70 |
| Cross-version Playwright suite | ~24 |
| Release management (3 windows, 2 flag flips) | ~16 |
| **Total** | **~246 h** |

Roughly 6–8 weeks for one engineer with normal interruption — substantially
larger than v7.1's ~3 days, justifying the separation.

---

## Open questions for product

1. **Receivables and Pulse Score.** Does "owed to me" debt contribute
   positively to **Debt Health**, or is it segregated entirely? Recommendation:
   segregated — Debt Health is liabilities-only by definition.
2. **Default account per category.** Item #5 Variant B suggested smart
   defaults from last-used. Should this be **per (household, category)**
   or **per (member, category)**? Multi-gen family case differs.
3. **Saved-view sharing scope.** Household-wide or per-(household, role)?
   The latter is privacy-friendlier for the **shared / roommates** group.

These do not block migration design; they shape the v7.3 follow-up.
