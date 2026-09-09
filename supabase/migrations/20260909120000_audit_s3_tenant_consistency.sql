-- ============================================================================
-- Audit S3 (2026-09-09) — foreign keys prove a row EXISTS, not that it belongs
-- to the same household. These triggers enforce tenant consistency at the
-- database, so no API path (form, WhatsApp, RPC, direct PostgREST) can link
-- entities across households.
--
-- Rules enforced:
--   transactions.household_id == account_id.household_id
--   transactions.household_id == to_account_id.household_id
--   transactions.household_id == member_id.household_id
--   transactions.household_id == debt_id.household_id
--   budget_allocations.household_id == budget_id.household_id
--   shared_splits.owner_household_id: the owner is a member of it, and the
--     linked txn (if any) belongs to it.
--
-- Triggers (not composite FKs) because the references carry ON DELETE SET NULL
-- and nullable columns — a trigger checks only the non-null ones. Runs as the
-- table owner's definer context so RLS on the referenced table can't mask a
-- violation from the check itself.
-- ============================================================================

BEGIN;

create or replace function public.assert_txn_tenant_consistency()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.account_id is not null and not exists (
    select 1 from public.accounts
     where id = new.account_id and household_id = new.household_id
  ) then
    raise exception 'transactions.account_id belongs to a different household'
      using errcode = '23503';
  end if;
  if new.to_account_id is not null and not exists (
    select 1 from public.accounts
     where id = new.to_account_id and household_id = new.household_id
  ) then
    raise exception 'transactions.to_account_id belongs to a different household'
      using errcode = '23503';
  end if;
  if new.member_id is not null and not exists (
    select 1 from public.memberships
     where id = new.member_id and household_id = new.household_id
  ) then
    raise exception 'transactions.member_id belongs to a different household'
      using errcode = '23503';
  end if;
  if new.debt_id is not null and not exists (
    select 1 from public.debts
     where id = new.debt_id and household_id = new.household_id
  ) then
    raise exception 'transactions.debt_id belongs to a different household'
      using errcode = '23503';
  end if;
  return new;
end $$;

drop trigger if exists trg_txn_tenant_consistency on public.transactions;
create trigger trg_txn_tenant_consistency
before insert or update on public.transactions
for each row execute function public.assert_txn_tenant_consistency();

create or replace function public.assert_allocation_tenant_consistency()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.budgets
     where id = new.budget_id and household_id = new.household_id
  ) then
    raise exception 'budget_allocations.budget_id belongs to a different household'
      using errcode = '23503';
  end if;
  return new;
end $$;

drop trigger if exists trg_allocation_tenant_consistency on public.budget_allocations;
create trigger trg_allocation_tenant_consistency
before insert or update on public.budget_allocations
for each row execute function public.assert_allocation_tenant_consistency();

create or replace function public.assert_split_tenant_consistency()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- The owner must actually be a member of the household they name.
  if not exists (
    select 1 from public.memberships
     where household_id = new.owner_household_id and user_id = new.owner_user_id
  ) then
    raise exception 'shared_splits.owner_household_id is not a household the owner belongs to'
      using errcode = '23503';
  end if;
  -- A linked transaction must live in that same household.
  if new.txn_id is not null and not exists (
    select 1 from public.transactions
     where id = new.txn_id and household_id = new.owner_household_id
  ) then
    raise exception 'shared_splits.txn_id belongs to a different household'
      using errcode = '23503';
  end if;
  return new;
end $$;

drop trigger if exists trg_split_tenant_consistency on public.shared_splits;
create trigger trg_split_tenant_consistency
before insert or update on public.shared_splits
for each row execute function public.assert_split_tenant_consistency();

COMMIT;
