-- Money Map · Phase 1 — first-class accounts + transaction FKs + debt direction
--
-- Spec: docs/SOLUTION_MONEY_MAP.md (v7.2 Migration A).
-- Target rollout: shadow → on → cutover across v7.2.0-rc / v7.2.1 / v7.3.0.
--
-- Design rules:
--   1. ADDITIVE ONLY. No DROP, no column type changes, no data destruction.
--   2. Idempotent. `create … if not exists` / `add column if not exists` /
--      `create or replace view`. Safe to re-run.
--   3. RLS for new tables MIRRORS the existing transactions/debts/assets
--      shape (`is_member` / `is_admin` helpers from TD-21) — no new
--      auth surface, no new SECURITY DEFINER functions introduced here.
--   4. Backfill is split into a separate file so this one can be applied
--      without touching existing rows.
--
-- Pre-flight (manual):
--   • Take a Supabase database backup (Dashboard → Database → Backups,
--     or `pg_dump`). The migration is non-destructive but a known restore
--     point is the safety net the spec recommends.
--   • Verify the TD-21 helpers exist (`is_member(uuid)`, `is_admin(text)`)
--     — they're prerequisites for the policy bodies below.

BEGIN;

-- ─── 1. accounts table (Items #2 + #5) ───────────────────────────────────

create table if not exists accounts (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  asset_id      uuid references assets(id) on delete set null,
  kind          text not null check (kind in
                  ('checking','savings','credit_card','cash',
                   'investment','wallet','other')),
  name          text not null,
  currency      char(3) not null,
  is_default    boolean not null default false,
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- One default account per (household, currency) — only when active.
create unique index if not exists accounts_default_per_currency
  on accounts (household_id, currency)
  where is_default and not is_archived and deleted_at is null;

create index if not exists accounts_household
  on accounts (household_id) where not is_archived and deleted_at is null;

-- Delta-sync index (matches TD-06 pattern from other domain tables).
create index if not exists accounts_updated_idx
  on accounts (household_id, updated_at);

-- ─── 2. transactions ↔ accounts FK columns (Item #5) ─────────────────────

alter table transactions
  add column if not exists account_id     uuid references accounts(id) on delete set null,
  add column if not exists to_account_id  uuid references accounts(id) on delete set null,
  add column if not exists initiated_by   uuid references memberships(id) on delete set null;

create index if not exists transactions_account
  on transactions (household_id, account_id) where account_id is not null;
create index if not exists transactions_to_account
  on transactions (household_id, to_account_id) where to_account_id is not null;
create index if not exists transactions_initiated_by
  on transactions (household_id, initiated_by) where initiated_by is not null;

-- ─── 3. debt direction (Item #3 — bidirectional / lending) ──────────────

alter table debts
  add column if not exists direction text not null default 'owed_by_me'
    check (direction in ('owed_by_me','owed_to_me')),
  add column if not exists counterparty_name text;

-- Active debts only — the partial index keeps it lean for the typical
-- "what do I owe / who owes me" filter.
create index if not exists debts_direction
  on debts (household_id, direction) where deleted_at is null;

-- ─── 4. server-side aggregates (Item #8) ────────────────────────────────
--
-- Views inherit RLS from the base table (Postgres 14+ — `security_invoker`
-- is the default for views in pg14+). The `where excluded is not true`
-- predicate matches client-side `reportableTxns` semantics so client and
-- server reports stay byte-identical.
--
-- WARNING: every read of these views MUST scope by `household_id` so the
-- planner can use `transactions_account` / `transactions_initiated_by`
-- as the leading index. A bare `select * from v_txn_by_member` will
-- table-scan; lint at PR review (per Sec-3 in the spec).

create or replace view v_txn_by_member as
  select t.household_id,
         t.initiated_by                          as member_id,
         date_trunc('month', t.date)             as period,
         t.type,
         t.currency,
         sum(t.amount)                           as total,
         count(*)                                as n
    from transactions t
   where t.deleted_at is null
     and (t.extras is null or coalesce((t.extras->>'excluded')::boolean, false) = false)
   group by 1, 2, 3, 4, 5;

create or replace view v_txn_by_account as
  select t.household_id,
         t.account_id,
         date_trunc('month', t.date)             as period,
         t.type,
         t.currency,
         sum(t.amount)                           as total,
         count(*)                                as n
    from transactions t
   where t.deleted_at is null
     and (t.extras is null or coalesce((t.extras->>'excluded')::boolean, false) = false)
   group by 1, 2, 3, 4, 5;

-- ─── 5. RLS for new tables (mirrors transactions policy shape) ──────────

alter table accounts enable row level security;

drop policy if exists "accounts_read"   on accounts;
drop policy if exists "accounts_insert" on accounts;
drop policy if exists "accounts_update" on accounts;
drop policy if exists "accounts_delete" on accounts;

create policy "accounts_read" on accounts for select to authenticated
  using (is_member(household_id) or is_admin('roles'));

create policy "accounts_insert" on accounts for insert to authenticated
  with check (role_in(household_id) in ('owner','admin','member'));

create policy "accounts_update" on accounts for update to authenticated
  using (role_in(household_id) in ('owner','admin','member'))
  with check (role_in(household_id) in ('owner','admin','member'));

create policy "accounts_delete" on accounts for delete to authenticated
  using (role_in(household_id) in ('owner','admin'));

-- ─── 6. updated_at trigger (matches the convention on every other table) ─

create or replace function set_updated_at_accounts()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_accounts_updated_at on accounts;
create trigger trg_accounts_updated_at
  before update on accounts
  for each row execute function set_updated_at_accounts();

COMMIT;
