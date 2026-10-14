-- Track E, E7 (v10.102.0; owner decisions: E-8 "only the orphan fix" (13 Oct 2026) and "reconcile to zero
-- + archive" (14 Oct 2026)). Audit FE-MNY-04, part 1.
--
-- Before v10.74.0 (W4e) a loan could be deleted while its loan ACCOUNT stayed live with a balance. A loan's
-- outstanding is its account's ledger, and net worth counts every liability account, archived or not
-- (lib/netWorth.ts liveLiabilityRows), so each such account kept a debt in net worth that no loan
-- explained: a phantom liability.
--
-- This clears them exactly as "Mark paid off" (`mark_loan_paid_off`) clears a loan:
--   • an orphan is a live `kind = 'loan'` account LINKED to a loan that has been deleted (`debt_id` set,
--     the debt soft-deleted). A loan account with no link at all is left alone: it may be a household's
--     only record of a real loan (the PR lists the read-only query to find any);
--   • its ledger goes to zero through the account's reconciliation OFFSET with a dated log entry
--     (kind 'loan', stated value 0), never a transaction; then it is archived. Its transactions and
--     history stay;
--   • net worth RISES by each orphan's leftover (the phantom debt leaves); no other figure moves;
--   • updated_at moves, so devices pick the change up through the delta sync;
--   • idempotent: a cleared, archived account is not touched again.

with orphans as (
  select a.id, -public.loan_ledger_balance(a.id) as owed
    from public.accounts a
    left join public.debts d on d.id = a.debt_id
   where a.kind = 'loan' and a.deleted_at is null and a.debt_id is not null
     and (d.id is null or d.deleted_at is not null)
)
update public.accounts a
   set reconciliation_offset = coalesce(a.reconciliation_offset, 0) + o.owed,
       reconciliation_log = case when o.owed <> 0
         then coalesce(a.reconciliation_log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'at', now(), 'delta', o.owed, 'kind', 'loan', 'stated_value', 0,
           'note', 'Loan deleted before v10.74: balance cleared'))
         else a.reconciliation_log end,
       last_reconciled_at = case when o.owed <> 0 then now() else a.last_reconciled_at end,
       is_archived = true,
       updated_at = now()
  from orphans o
 where a.id = o.id and (o.owed <> 0 or not a.is_archived);
