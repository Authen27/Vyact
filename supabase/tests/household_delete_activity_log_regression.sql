-- Regression check for HH-REG-001 (react/e2e/TEST_CASE_INVENTORY.md §16).
--
-- Bug: deleting ANY household with at least one row in a logged child table
-- (memberships/transactions/budgets/goals/debts/assets — in practice every
-- real household, since every household has its owner's membership row)
-- failed with:
--   insert or update on table "activity_log" violates foreign key
--   constraint "activity_log_household_id_fkey"
-- because deleting `households` cascades to delete those child rows, each
-- of which fires `log_domain_activity()` (TD-08) trying to INSERT a fresh
-- activity_log row for a household_id that, within the same transaction,
-- households(id) no longer contains. See
-- supabase/migrations/20260724120000_fix_household_delete_activity_log_fk.sql
-- for the fix and full root-cause writeup.
--
-- Zero-cost: this whole block ends with `raise exception`, so Postgres rolls
-- back everything it did — safe to run against a real project (including
-- prod) with no lasting effect. Never remove that trailing RAISE.
--
-- Run: paste into the Supabase SQL editor, or
--   supabase db execute --file supabase/tests/household_delete_activity_log_regression.sql
-- A PASS reads "household_gone=t" with no earlier ERROR; a regression of
-- this bug re-surfaces as the exact foreign_key_violation message above
-- instead of reaching the final RAISE at all.

do $$
declare
  test_hh_id        uuid;
  test_user_id      uuid;
  membership_count  int;
  orphan_log_rows   int;
begin
  select id into test_user_id from auth.users limit 1;
  if test_user_id is null then
    raise exception 'TEST ABORTED — no auth.users row available to borrow as the test household owner';
  end if;

  insert into households (name, type, base_currency, created_by)
  values ('__hh_reg_001_test__', 'family', 'USD', test_user_id)
  returning id into test_hh_id;
  -- handle_new_household() (AFTER INSERT trigger) has already inserted the
  -- owner's membership row — this is the exact precondition that always
  -- triggered the bug, so we don't need to insert one ourselves.

  select count(*) into membership_count from memberships where household_id = test_hh_id;
  if membership_count = 0 then
    raise exception 'TEST SETUP FAILED — expected an owner membership row, found none';
  end if;

  -- THE ASSERTION: this must NOT raise foreign_key_violation.
  delete from households where id = test_hh_id;

  select count(*) into orphan_log_rows from activity_log where household_id = test_hh_id;

  raise exception
    'HH-REG-001 regression check — PASS if household_gone=t and orphan_activity_log_rows=0. memberships_before=% household_gone=% orphan_activity_log_rows=%',
    membership_count,
    not exists(select 1 from households where id = test_hh_id),
    orphan_log_rows;
end $$;
