-- Q3a (v10.130.0; audit DB-OPS-09; owner, 20 Oct 2026: "indexes only").
--
-- Foreign keys that the app, the RLS policies or a delete look up by, with no index leading on them; and three
-- indexes created twice under different names (v9.1 and its feedback batch). The policy rewrite the audit also
-- suggested is not done: it pays off at a scale Vyact is far from, and the Q2 access matrix will guard it then.

-- Balances, ledgers, account_dependencies and delete/move read transactions by account.
create index if not exists ix_txn_account    on public.transactions (account_id)    where account_id is not null;
create index if not exists ix_txn_to_account on public.transactions (to_account_id) where to_account_id is not null;
-- account_dependencies, delete_account and the funding-account guard.
create index if not exists ix_debts_funding_account on public.debts (funding_account_id) where funding_account_id is not null;
-- loan_account_for and the loan functions find a loan's account by debt.
create index if not exists ix_accounts_debt on public.accounts (debt_id) where debt_id is not null;
-- Policies and the household views read these by household.
create index if not exists ix_invitations_household        on public.invitations (household_id);
create index if not exists ix_loan_events_household        on public.loan_payment_events (household_id);
create index if not exists ix_ai_feedback_household        on public.ai_feedback (household_id);
-- The household erase, a member's unlink and the account purge.
create index if not exists ix_wa_inbound_household on public.whatsapp_inbound_messages (household_id);
create index if not exists ix_wa_inbound_profile   on public.whatsapp_inbound_messages (profile_id);
create index if not exists ix_wa_pending_household on public.whatsapp_pending_turns (household_id);
create index if not exists ix_wa_identities_household on public.whatsapp_identities (household_id);
-- A shared split's transaction, and the loan events that point at a deleted transaction.
create index if not exists ix_shared_splits_txn on public.shared_splits (txn_id) where txn_id is not null;
create index if not exists ix_loan_events_expense_txn  on public.loan_payment_events (expense_txn_id)  where expense_txn_id is not null;
create index if not exists ix_loan_events_transfer_txn on public.loan_payment_events (transfer_txn_id) where transfer_txn_id is not null;

-- The same index twice: keep the v9.1 names.
drop index if exists public.ix_balloc_budget;    -- = idx_balloc_budget
drop index if exists public.ix_txn_schedule;     -- = idx_txn_recurring
drop index if exists public.ix_txn_debt;         -- = idx_txn_debt
