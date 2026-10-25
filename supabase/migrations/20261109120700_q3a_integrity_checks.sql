-- Q3a (v10.130.0; audit DB-INT-14, INT-HH-08; owner decisions 20 Oct 2026).
--
-- DB-INT-14: two money rules the app keeps but the database did not.
--   - A transfer moves money between two DIFFERENT accounts (one to itself changes nothing and reads as
--     activity). The WhatsApp writer already refused it; now every writer is held to it.
--   - A budget line's amount is never below zero.
--   Both are NOT VALID: they hold every new or changed row from now on, and a row that already breaks one
--   cannot fail this deploy. (Loan / EMI through WhatsApp is refused in 20261109120600; budget scope stays
--   optional, because the older category budgets have none.)
-- INT-HH-08 (database half): language becomes per person. profiles.language unset means "follow the
--   household" (households.language); the stored default 'en' is cleared to unset, so nobody's language changes
--   today. The app reads and writes the person's own language in Track Q5.

alter table public.transactions drop constraint if exists ck_txn_transfer_accounts_differ;
alter table public.transactions
  add constraint ck_txn_transfer_accounts_differ
  check (type <> 'transfer' or account_id is distinct from to_account_id) not valid;

alter table public.budget_allocations drop constraint if exists ck_balloc_amount_not_negative;
alter table public.budget_allocations
  add constraint ck_balloc_amount_not_negative check (amount >= 0) not valid;

alter table public.profiles alter column language drop default;
alter table public.profiles alter column language drop not null;
update public.profiles set language = null where language = 'en';
