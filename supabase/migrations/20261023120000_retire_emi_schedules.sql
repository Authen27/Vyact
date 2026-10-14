-- Track E, E6b (v10.101.0; owner decisions 13–14 Oct 2026: E-3 "retire the old EMI schedules",
-- E-11 "soft-delete them now, without a count first").
--
-- A loan's EMI is paid by the LOAN (`pay_loan`; `auto_record_due_emis` records it on its date when the
-- loan's auto_record is on), never by a recurring schedule. W4g (20261017120000) moved every EMI schedule
-- it could match to a live loan onto that loan and soft-deleted it. The ones left are those it could not
-- match: no loan link, a deleted loan, or a receivable. They no longer post (the app's engine and the
-- server's recurring-post job skip them: isLoanEmiSchedule / serverPostsSchedule), and since v10.100.0
-- (E6a) the app lists them nowhere (Recurring, the bill calendar, the bell).
--
-- This retires them in the database:
--   • the set is exactly the app's `isLoanEmiSchedule` (lib/recurring.ts): a template in Loan / EMI, or
--     one carrying a loan link (debtId / linkedDebtId), the schedules that read "no longer posts";
--   • a SOFT delete (deleted_at + active = false). The transactions any of them made keep their history
--     (their recurring_schedule_id is untouched), and nothing is recreated from other rows;
--   • updated_at moves, so every device drops its cached copy through the delta sync (a tombstone),
--     as W4g's soft delete did; no cache reset is needed;
--   • idempotent: a second run matches nothing.

update public.recurring_schedules
   set deleted_at = now(), active = false, updated_at = now()
 where deleted_at is null
   and (txn_template->>'category' = 'loan_emi'
        or nullif(txn_template->>'debtId', '') is not null
        or nullif(txn_template->>'linkedDebtId', '') is not null);
