-- "Erase all data" works for a household with a loan, and erases everything (audit 2026-10-04
-- follow-up R1, XC-PRV-08, DB-SEC-08; owner decisions 13 Oct 2026).
--
-- What was wrong:
--   • R1 (regression from W4e, 20261016120000): erase_household_data deleted the debts while the
--     loan account still existed. debts_refuse_unpaid_delete saw money owed and raised
--     debt_not_paid_off, so the WHOLE erase rolled back for any household with an unpaid loan.
--     Reordering alone does not help: once the loan account is gone, loan_outstanding falls back to
--     the cached debts.current_balance.
--   • XC-PRV-08 / DB-SEC-08: the erase left notifications (amounts, payees), open WhatsApp
--     questions, Pip agent conversations, relay messages (question text), loan payment history and
--     the household's shared splits behind.
--
-- Now (owner decisions, 13 Oct 2026):
--   • Inside the erase only, the loans are cleared first: the loan accounts go, the cached balance
--     is zeroed, then the debts go. The guard still protects every other delete of a debt.
--   • Every household table that holds the household's money or words is erased. Kept: the
--     household row, memberships, invitations, subscriptions, WhatsApp links and preferences, push
--     subscriptions, and usage metering without text (ai_usage, ai_feedback); exchange_rates is
--     unused. react/src/lib/__tests__/eraseHouseholdSql.test.ts fails when a new household table is
--     in neither list.
--   • The household's shared splits are DELETED, for everyone in them (owner's choice).
--   • The re-authentication rule (W1b) and the owner/admin check are unchanged.

BEGIN;

create or replace function erase_household_data(h_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
begin
  select role into caller_role
  from memberships
  where household_id = h_id and user_id = auth.uid()
  limit 1;

  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'not authorized to erase this household''s data';
  end if;
  if not public.recently_reauthenticated() then
    raise exception 'reauth_required' using errcode = '42501',
      hint = 'Confirm with the emailed code, then erase within 10 minutes.';
  end if;

  -- Splits shared with people outside the household: deleted for everyone (shares cascade).
  delete from shared_splits        where owner_household_id = h_id;

  delete from transactions         where household_id = h_id;
  delete from budgets              where household_id = h_id;
  delete from budget_allocations   where household_id = h_id;
  delete from goals                where household_id = h_id;

  -- Loans first (R1): with no transactions left, a loan account still holds its opening balance, so
  -- debts_refuse_unpaid_delete would see money owed. Remove the loan accounts, zero the cached
  -- balance the guard falls back to, then delete the debts.
  delete from loan_payment_events  where household_id = h_id;
  delete from accounts             where household_id = h_id and kind = 'loan';
  update debts set current_balance = 0 where household_id = h_id;
  delete from debts                where household_id = h_id;

  delete from assets               where household_id = h_id;
  delete from accounts             where household_id = h_id;
  delete from recurring_schedules  where household_id = h_id;
  delete from saved_views          where household_id = h_id;
  delete from net_worth_snapshots  where household_id = h_id;
  delete from notifications        where household_id = h_id;
  delete from whatsapp_inbound_messages where household_id = h_id;
  delete from whatsapp_pending_turns    where household_id = h_id;
  delete from whatsapp_rule_state       where household_id = h_id;
  delete from agent_pending_intents     where household_id = h_id;
  delete from agent_conversations       where household_id = h_id;
  delete from ask_vyact_relay           where household_id = h_id;
  delete from activity_log         where household_id = h_id;

  update households set onboarding = '{}'::jsonb where id = h_id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h_id, auth.uid(), 'deleted', 'household', h_id,
          jsonb_build_object('kind', 'erase_household_data', 'erased_at', now()));
end;
$$;

revoke all on function erase_household_data(uuid) from public;
revoke all on function erase_household_data(uuid) from anon;
grant execute on function erase_household_data(uuid) to authenticated;

COMMIT;
