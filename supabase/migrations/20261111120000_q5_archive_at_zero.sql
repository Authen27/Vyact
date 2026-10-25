-- v10.133.0 — Track Q5: an account is archived at zero (audit FE-MNY-12; owner decision 20 Oct 2026: "refuse
-- archiving an account with a balance", shipped with the app's dialog so no one meets a bare error).
--
-- An archived account left the Accounts screen's "Spendable now" while Net Worth and Pip still counted its money, so
-- the three disagreed. From the app (an authenticated request), archiving an account whose balance is not zero is now
-- refused: `account_has_balance` (23514, so a queued save is set aside, never lost). Move the money out (a transfer,
-- or move_account_and_delete) or reconcile it to zero first. It applies to the kinds the Accounts summary reads: bank
-- accounts and cards. Cash in Hand could never be archived; a loan's account is archived by the loan functions
-- (mark_loan_paid_off, delete_debt) and is never part of "Spendable now". Accounts archived before this
-- keep what they hold, and the app now counts it everywhere (FE-UIC-12).
--
-- account_ledger_balance() is the app's fold (lib/accountBalance.ts computeAccountBalance), on the server: opening
-- balance + reconciliation offset + what arrived (income, transfers and investment withdrawals into it) − what left
-- (expenses, transfers and investment buys out of it), deleted entries excluded, a split entry at YOUR share
-- (`extras.split.yourShare`, as effectiveAmount reads it). Q5-SQL-001 holds the two folds equal.
--
-- MONEY MODEL: untouched. Nothing is written; an archive the balance forbids does not happen.

begin;

create or replace function public.account_ledger_balance(p_account uuid)
returns numeric
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with amounts as (
    select t.type, t.account_id, t.to_account_id,
           case when t.extras -> 'split' ->> 'isSplit' = 'true'
                 and jsonb_typeof(t.extras -> 'split' -> 'yourShare') = 'number'
                then (t.extras -> 'split' ->> 'yourShare')::numeric
                else t.amount end as amount
      from public.transactions t
     where t.deleted_at is null and (t.account_id = p_account or t.to_account_id = p_account)
  )
  select round(coalesce(a.opening_balance, 0) + coalesce(a.reconciliation_offset, 0)
       + coalesce((select sum(m.amount) from amounts m
                    where m.to_account_id = a.id and m.type in ('income', 'transfer', 'investment')), 0)
       - coalesce((select sum(m.amount) from amounts m
                    where m.account_id = a.id and m.type in ('expense', 'transfer', 'investment')), 0), 2)
    from public.accounts a where a.id = p_account
$$;
revoke all on function public.account_ledger_balance(uuid) from public, anon, authenticated;
grant execute on function public.account_ledger_balance(uuid) to service_role;
comment on function public.account_ledger_balance(uuid) is
  'Q5 (v10.133.0): an account''s balance as the app folds it (computeAccountBalance; a split at your share). Read by accounts_guard_lifecycle.';

create or replace function public.accounts_guard_lifecycle()
returns trigger
language plpgsql
security definer   -- v10.119.0: it reads loans, which row security must not hide from it
set search_path = public, pg_temp
as $$
declare
  v_claims  text := nullif(current_setting('request.jwt.claims', true), '');
  v_loan    text;
  v_balance numeric;
begin
  if v_claims is null or (v_claims::jsonb ->> 'role') is distinct from 'authenticated' then
    return new;
  end if;
  if old.kind = 'cash' and (new.kind is distinct from 'cash'
       or (new.is_archived and not old.is_archived)
       or (new.deleted_at is not null and old.deleted_at is null)) then
    raise exception 'cash_account_protected: Cash in Hand can be renamed, never archived or deleted'
      using errcode = '22023';
  end if;
  if new.kind = 'cash' and old.kind is distinct from 'cash' then
    raise exception 'cash_account_protected: Cash in Hand is created by the household, never converted'
      using errcode = '22023';
  end if;
  if new.deleted_at is not null and old.deleted_at is null
     and current_setting('vyact.account_delete', true) is distinct from 'on' then
    raise exception 'account_delete_guarded: delete an account with delete_account or move_account_and_delete'
      using errcode = '42501';
  end if;
  if old.deleted_at is not null and new.deleted_at is null then
    raise exception 'account_delete_final: a deleted account stays deleted' using errcode = '42501';
  end if;
  -- v10.119.0 (owner, 19 Oct 2026): a loan's automatic EMI would be refused from an archived account.
  if new.is_archived and not old.is_archived then
    select string_agg(d.name, ', ' order by d.name) into v_loan
      from public.debts d
     where d.household_id = old.household_id and d.funding_account_id = old.id
       and d.deleted_at is null and d.paid_off_at is null and d.auto_record
       and coalesce(d.direction, 'owed_by_me') = 'owed_by_me';
    if v_loan is not null then
      raise exception 'account_pays_a_loan: % records its EMIs from this account; change its paying account first', v_loan
        using errcode = '23503';
    end if;
    -- v10.133.0 (Q5, FE-MNY-12): a bank account or card is archived at zero. The balance is the NEW row's (its offset
    -- as this write leaves it), so a reconcile to zero and the archive can be one write.
    if old.kind in ('bank', 'credit_card') then
    v_balance := round(coalesce(new.opening_balance, 0) + coalesce(new.reconciliation_offset, 0)
                 - coalesce(old.opening_balance, 0) - coalesce(old.reconciliation_offset, 0)
                 + public.account_ledger_balance(old.id), 2);
    if abs(v_balance) >= 0.005 then
      raise exception 'account_has_balance: % still holds %; move the money out or reconcile it to zero before archiving',
        new.name, v_balance using errcode = '23514';
    end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.accounts_guard_lifecycle() from public, anon, authenticated;

commit;
