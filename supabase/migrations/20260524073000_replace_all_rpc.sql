-- TD-09: Atomic replace RPCs for bulk imports
-- Adds `replace_<entity>(h uuid, rows jsonb)` functions that soft-delete
-- existing rows for a household and insert the provided rows inside a
-- single transaction, returning the inserted rows.

BEGIN;

-- TRANSACTIONS
CREATE OR REPLACE FUNCTION public.replace_transactions(h uuid, rows jsonb)
RETURNS SETOF transactions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT is_member(h) THEN RAISE EXCEPTION 'Not a member of this household'; END IF;

  -- soft-delete existing
  UPDATE transactions SET deleted_at = now() WHERE household_id = h AND deleted_at IS NULL;

  -- insert new rows
  RETURN QUERY
  INSERT INTO transactions (id, household_id, created_by, member_id, type, amount, currency, date, description, category, note, recurring, attachment_url, extras, created_at, updated_at, deleted_at)
  SELECT t.id::uuid, h, t.created_by::uuid, t.member_id::uuid, t.type, t.amount::numeric, t.currency, t.date::date, t.description, t.category, t.note, t.recurring, t.attachment_url, t.extras::jsonb, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  FROM jsonb_populate_recordset(NULL::transactions, rows) as t;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_transactions(uuid, jsonb) TO authenticated;

-- BUDGETS
CREATE OR REPLACE FUNCTION public.replace_budgets(h uuid, rows jsonb)
RETURNS SETOF budgets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT is_member(h) THEN RAISE EXCEPTION 'Not a member of this household'; END IF;

  UPDATE budgets SET deleted_at = now() WHERE household_id = h AND deleted_at IS NULL;

  RETURN QUERY
  INSERT INTO budgets (id, household_id, category, monthly_limit, currency, color, period, period_start, period_end, created_at, updated_at, deleted_at)
  SELECT t.id::uuid, h, t.category, t.monthly_limit::numeric, t.currency, t.color, t.period, t.period_start::date, t.period_end::date, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  FROM jsonb_populate_recordset(NULL::budgets, rows) as t;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_budgets(uuid, jsonb) TO authenticated;

-- GOALS
CREATE OR REPLACE FUNCTION public.replace_goals(h uuid, rows jsonb)
RETURNS SETOF goals
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT is_member(h) THEN RAISE EXCEPTION 'Not a member of this household'; END IF;

  UPDATE goals SET deleted_at = now() WHERE household_id = h AND deleted_at IS NULL;

  RETURN QUERY
  INSERT INTO goals (id, household_id, type, name, target_amount, current_amount, currency, deadline, completed, created_at, updated_at, deleted_at)
  SELECT t.id::uuid, h, t.type, t.name, t.target_amount::numeric, t.current_amount::numeric, t.currency, t.deadline::date, t.completed::boolean, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  FROM jsonb_populate_recordset(NULL::goals, rows) as t;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_goals(uuid, jsonb) TO authenticated;

-- DEBTS
CREATE OR REPLACE FUNCTION public.replace_debts(h uuid, rows jsonb)
RETURNS SETOF debts
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT is_member(h) THEN RAISE EXCEPTION 'Not a member of this household'; END IF;

  UPDATE debts SET deleted_at = now() WHERE household_id = h AND deleted_at IS NULL;

  RETURN QUERY
  INSERT INTO debts (id, household_id, type, name, lender, account_last4, principal, current_balance, interest_rate, minimum_payment, due_date, currency, extras, created_at, updated_at, deleted_at)
  SELECT t.id::uuid, h, t.type, t.name, t.lender, t.account_last4, t.principal::numeric, t.current_balance::numeric, t.interest_rate::numeric, t.minimum_payment::numeric, t.due_date::date, t.currency, t.extras::jsonb, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  FROM jsonb_populate_recordset(NULL::debts, rows) as t;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_debts(uuid, jsonb) TO authenticated;

-- ASSETS
CREATE OR REPLACE FUNCTION public.replace_assets(h uuid, rows jsonb)
RETURNS SETOF assets
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT is_member(h) THEN RAISE EXCEPTION 'Not a member of this household'; END IF;

  UPDATE assets SET deleted_at = now() WHERE household_id = h AND deleted_at IS NULL;

  RETURN QUERY
  INSERT INTO assets (id, household_id, type, name, value, currency, liquidity, note, last_updated, created_at, updated_at, deleted_at)
  SELECT t.id::uuid, h, t.type, t.name, t.value::numeric, t.currency, t.liquidity, t.note, t.last_updated::date, t.created_at::timestamptz, t.updated_at::timestamptz, t.deleted_at::timestamptz
  FROM jsonb_populate_recordset(NULL::assets, rows) as t;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_assets(uuid, jsonb) TO authenticated;

-- MEMBERSHIPS (members)
CREATE OR REPLACE FUNCTION public.replace_memberships(h uuid, rows jsonb)
RETURNS SETOF memberships
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be signed in'; END IF;
  IF NOT is_member(h) THEN RAISE EXCEPTION 'Not a member of this household'; END IF;

  DELETE FROM memberships WHERE household_id = h;

  RETURN QUERY
  INSERT INTO memberships (id, household_id, user_id, role, display_name, household_role, joined_at)
  SELECT t.id::uuid, h, t.user_id::uuid, t.role, t.display_name, t.household_role, t.joined_at::timestamptz
  FROM jsonb_populate_recordset(NULL::memberships, rows) as t;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_memberships(uuid, jsonb) TO authenticated;

COMMIT;
