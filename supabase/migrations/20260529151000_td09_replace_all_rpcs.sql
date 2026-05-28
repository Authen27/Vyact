-- TD-09 — atomic `replace_<entity>(h uuid, rows jsonb)` RPCs for bulk import.
--
-- Each function soft-deletes existing rows for the household and inserts
-- the provided rows in one transaction, returning the inserted set. Every
-- RPC is SECURITY DEFINER and gated by:
--   • auth.uid() must be set
--   • is_member(h) must be true
-- so a signed-in member of one household can't import into another.
--
-- The pre-PR-#16 design intent for this lived at
-- db/migrations-superseded/20260524073000_replace_all_rpc.sql but was
-- never applied to prod. This migration re-lands it through the
-- validated auto-apply pipeline. It depends on TD-13's period columns
-- (see 20260529150000_td13_budgets_add_period.sql which sorts first),
-- so the budgets replace function can use them.

begin;

-- ── transactions ─────────────────────────────────────────────────
create or replace function public.replace_transactions(h uuid, rows jsonb)
returns setof transactions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;
  if not is_member(h) then raise exception 'Not a member of this household'; end if;

  update transactions set deleted_at = now() where household_id = h and deleted_at is null;

  return query
  insert into transactions (id, household_id, created_by, member_id, type, amount, currency, date, description, category, note, recurring, attachment_url, extras, created_at, updated_at, deleted_at)
  select t.id::uuid, h, t.created_by::uuid, t.member_id::uuid, t.type, t.amount::numeric, t.currency, t.date::date, t.description, t.category, t.note, t.recurring, t.attachment_url, t.extras::jsonb, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  from jsonb_populate_recordset(null::transactions, rows) as t;
end;
$$;
grant execute on function public.replace_transactions(uuid, jsonb) to authenticated;

-- ── budgets ──────────────────────────────────────────────────────
create or replace function public.replace_budgets(h uuid, rows jsonb)
returns setof budgets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;
  if not is_member(h) then raise exception 'Not a member of this household'; end if;

  update budgets set deleted_at = now() where household_id = h and deleted_at is null;

  return query
  insert into budgets (id, household_id, category, monthly_limit, currency, color, period, period_start, period_end, created_at, updated_at, deleted_at)
  select t.id::uuid, h, t.category, t.monthly_limit::numeric, t.currency, t.color, t.period, t.period_start::date, t.period_end::date, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  from jsonb_populate_recordset(null::budgets, rows) as t;
end;
$$;
grant execute on function public.replace_budgets(uuid, jsonb) to authenticated;

-- ── goals ────────────────────────────────────────────────────────
create or replace function public.replace_goals(h uuid, rows jsonb)
returns setof goals
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;
  if not is_member(h) then raise exception 'Not a member of this household'; end if;

  update goals set deleted_at = now() where household_id = h and deleted_at is null;

  return query
  insert into goals (id, household_id, type, name, target_amount, current_amount, currency, deadline, completed, created_at, updated_at, deleted_at)
  select t.id::uuid, h, t.type, t.name, t.target_amount::numeric, t.current_amount::numeric, t.currency, t.deadline::date, t.completed::boolean, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  from jsonb_populate_recordset(null::goals, rows) as t;
end;
$$;
grant execute on function public.replace_goals(uuid, jsonb) to authenticated;

-- ── debts ────────────────────────────────────────────────────────
create or replace function public.replace_debts(h uuid, rows jsonb)
returns setof debts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;
  if not is_member(h) then raise exception 'Not a member of this household'; end if;

  update debts set deleted_at = now() where household_id = h and deleted_at is null;

  return query
  insert into debts (id, household_id, type, name, lender, account_last4, principal, current_balance, interest_rate, minimum_payment, due_date, currency, extras, created_at, updated_at, deleted_at)
  select t.id::uuid, h, t.type, t.name, t.lender, t.account_last4, t.principal::numeric, t.current_balance::numeric, t.interest_rate::numeric, t.minimum_payment::numeric, t.due_date::date, t.currency, t.extras::jsonb, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  from jsonb_populate_recordset(null::debts, rows) as t;
end;
$$;
grant execute on function public.replace_debts(uuid, jsonb) to authenticated;

-- ── assets ───────────────────────────────────────────────────────
create or replace function public.replace_assets(h uuid, rows jsonb)
returns setof assets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;
  if not is_member(h) then raise exception 'Not a member of this household'; end if;

  update assets set deleted_at = now() where household_id = h and deleted_at is null;

  return query
  insert into assets (id, household_id, type, name, value, currency, liquidity, note, last_updated, created_at, updated_at, deleted_at)
  select t.id::uuid, h, t.type, t.name, t.value::numeric, t.currency, t.liquidity, t.note, t.last_updated::date, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  from jsonb_populate_recordset(null::assets, rows) as t;
end;
$$;
grant execute on function public.replace_assets(uuid, jsonb) to authenticated;

-- ── memberships ──────────────────────────────────────────────────
-- Memberships have no `deleted_at` column in the baseline (membership
-- removal is a hard delete with cascade implications). We match that
-- pattern instead of soft-deleting.
create or replace function public.replace_memberships(h uuid, rows jsonb)
returns setof memberships
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;
  if not is_member(h) then raise exception 'Not a member of this household'; end if;

  delete from memberships where household_id = h;

  return query
  insert into memberships (id, household_id, user_id, role, display_name, household_role, joined_at)
  select t.id::uuid, h, t.user_id::uuid, t.role, t.display_name, t.household_role, t.joined_at::timestamptz
  from jsonb_populate_recordset(null::memberships, rows) as t;
end;
$$;
grant execute on function public.replace_memberships(uuid, jsonb) to authenticated;

commit;
