-- v10.117.0 — Track T2, part c: ledger integrity.
-- Audit DB-SEC-09 and DB-INT-09 (owner decisions 18 Oct 2026: T2 reopens Batch E; DB-INT-09 "all three guards").
--
-- DB-SEC-09. The tenant checks (audit S3, 20260909120000) proved an entry's account, member and loan were
-- the household's own, but not its investment asset, who initiated it, or its schedule; accounts and
-- schedules had no check at all. A member who learnt another household's asset id could buy into it: the
-- link (ON DELETE RESTRICT) then blocked that household's erase and deletion, and it could not even see
-- why. Every link now stays inside its household:
--   transactions: asset_id (and its account, member and loan links, as before), initiated_by,
--                 recurring_schedule_id;
--   accounts:     asset_id, debt_id;
--   schedules:    owner_member_id, and the template's accountId / toAccountId / assetId.
-- S3's header said its checks run "in the table owner's definer context"; none did. The checks here are
-- SECURITY DEFINER, so row security can't hide a row from them. (S3's allocation and split checks stay as
-- they are: they run as the caller, which refuses rather than allows when a row is hidden.)
--
-- DB-INT-09. A delete was decided by delete_account / move_account_and_delete, but nothing else held to it:
--   1. Cash in Hand can't be archived, deleted, or turned into another kind (and nothing becomes Cash);
--   2. an account is soft-deleted only by delete_account or move_account_and_delete (they set a
--      transaction-local flag), a delete is final from the app, and the app can't hard-delete accounts
--      (the unused accounts_delete policy is dropped);
--   3. an entry never makes a NEW link to a deleted account or asset: a new entry, a changed account or
--      asset, or a deleted entry brought back. Editing an old entry still works. The account or asset is
--      locked while the entry is written, so a delete running at the same moment either sees the entry
--      (and refuses: account_in_use / asset_in_use) or the entry sees the delete (and is refused).
--   ensure_cash_account never hands back an archived Cash in Hand: an archived one is restored, here and
--   whenever it is asked for.
--
-- Apart from restoring an archived Cash in Hand, rows already in place are left as they are: only new
-- writes are checked.
-- MONEY MODEL: no figure changes. An entry the database used to accept onto a deleted account (where it
-- moved no visible balance) is now refused and set aside on the device that wrote it.

begin;

-- ── 1. Entries: every link inside the household; no new link to a deleted account or asset ─────────
create or replace function public.assert_txn_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prev     public.transactions;  -- the stored row this write replaces (an UPDATE, or an upsert's INSERT)
  had      boolean := false;
  live     boolean := new.deleted_at is null;
  revived  boolean;              -- a live entry that was not live before: a new one, or one brought back
  acc_new  boolean;
  to_new   boolean;
  asset_new boolean;
  r        record;
begin
  if tg_op = 'UPDATE' then
    prev := old; had := true;
  else
    select * into prev from public.transactions where id = new.id;
    had := found and prev.household_id = new.household_id;
  end if;
  revived   := live and (not had or prev.deleted_at is not null);
  acc_new   := live and new.account_id is not null and (revived or prev.account_id is distinct from new.account_id);
  to_new    := live and new.to_account_id is not null and (revived or prev.to_account_id is distinct from new.to_account_id);
  asset_new := live and new.asset_id is not null and (revived or prev.asset_id is distinct from new.asset_id);

  -- Every link is the household's own (account, member and loan on every write, as S3 did).
  if new.account_id is not null and not exists (
    select 1 from public.accounts where id = new.account_id and household_id = new.household_id
  ) then
    raise exception 'transactions.account_id belongs to a different household' using errcode = '23503';
  end if;
  if new.to_account_id is not null and not exists (
    select 1 from public.accounts where id = new.to_account_id and household_id = new.household_id
  ) then
    raise exception 'transactions.to_account_id belongs to a different household' using errcode = '23503';
  end if;
  if new.member_id is not null and not exists (
    select 1 from public.memberships where id = new.member_id and household_id = new.household_id
  ) then
    raise exception 'transactions.member_id belongs to a different household' using errcode = '23503';
  end if;
  if new.debt_id is not null and not exists (
    select 1 from public.debts where id = new.debt_id and household_id = new.household_id
  ) then
    raise exception 'transactions.debt_id belongs to a different household' using errcode = '23503';
  end if;
  if new.asset_id is not null and not exists (
    select 1 from public.assets where id = new.asset_id and household_id = new.household_id
  ) then
    raise exception 'transactions.asset_id belongs to a different household' using errcode = '23503';
  end if;
  -- Who initiated it, and the schedule it came from: when the link is made or changed.
  if new.initiated_by is not null and (not had or prev.initiated_by is distinct from new.initiated_by)
     and not exists (select 1 from public.memberships where id = new.initiated_by and household_id = new.household_id) then
    raise exception 'transactions.initiated_by belongs to a different household' using errcode = '23503';
  end if;
  if new.recurring_schedule_id is not null
     and (not had or prev.recurring_schedule_id is distinct from new.recurring_schedule_id)
     and not exists (select 1 from public.recurring_schedules
                      where id = new.recurring_schedule_id and household_id = new.household_id) then
    raise exception 'transactions.recurring_schedule_id belongs to a different household' using errcode = '23503';
  end if;

  -- A NEW link needs a live account or asset. It is read under a share lock (accounts in id order, so two
  -- writers never wait on each other), which a delete running at the same moment waits for: either the
  -- delete then sees this entry and refuses (account_in_use / asset_in_use), or this sees the delete.
  if acc_new or to_new then
    for r in
      select a.id, a.deleted_at from public.accounts a
       where (acc_new and a.id = new.account_id) or (to_new and a.id = new.to_account_id)
       order by a.id
         for share
    loop
      if r.deleted_at is not null then
        raise exception 'account_deleted: the account was deleted' using errcode = '23503', detail = r.id::text;
      end if;
    end loop;
  end if;
  if asset_new then
    select a.deleted_at into r from public.assets a where a.id = new.asset_id for share;
    if r.deleted_at is not null then
      raise exception 'asset_deleted: the investment was deleted' using errcode = '23503', detail = new.asset_id::text;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.assert_txn_tenant_consistency() from public, anon, authenticated;

drop trigger if exists trg_txn_tenant_consistency on public.transactions;
create trigger trg_txn_tenant_consistency
  before insert or update on public.transactions
  for each row execute function public.assert_txn_tenant_consistency();

-- ── 2. Accounts: their asset and loan are the household's own ──────────────────────────────────────
create or replace function public.assert_account_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.asset_id is not null and (tg_op = 'INSERT' or old.asset_id is distinct from new.asset_id)
     and not exists (select 1 from public.assets where id = new.asset_id and household_id = new.household_id) then
    raise exception 'accounts.asset_id belongs to a different household' using errcode = '23503';
  end if;
  if new.debt_id is not null and (tg_op = 'INSERT' or old.debt_id is distinct from new.debt_id)
     and not exists (select 1 from public.debts where id = new.debt_id and household_id = new.household_id) then
    raise exception 'accounts.debt_id belongs to a different household' using errcode = '23503';
  end if;
  return new;
end $$;
revoke all on function public.assert_account_tenant_consistency() from public, anon, authenticated;

drop trigger if exists trg_account_tenant_consistency on public.accounts;
create trigger trg_account_tenant_consistency
  before insert or update on public.accounts
  for each row execute function public.assert_account_tenant_consistency();

-- ── 3. Accounts: Cash in Hand stays; a delete is the delete functions' alone, and final ────────────
-- Checked for the app (a request carrying the 'authenticated' role), directly or through a function it
-- calls. The service role, scheduled jobs and migrations carry no such claim.
create or replace function public.accounts_guard_lifecycle()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_claims text := nullif(current_setting('request.jwt.claims', true), '');
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
  return new;
end $$;
revoke all on function public.accounts_guard_lifecycle() from public, anon, authenticated;

drop trigger if exists trg_accounts_guard_lifecycle on public.accounts;
create trigger trg_accounts_guard_lifecycle
  before update on public.accounts
  for each row execute function public.accounts_guard_lifecycle();

-- The app never removes an account row (it tombstones through the delete functions). A hard delete set
-- every entry's account to null and took its money out of every balance.
drop policy if exists "accounts_delete" on public.accounts;

-- delete_account and move_account_and_delete: unchanged but for the flag around their tombstone.
create or replace function public.delete_account(p_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  acc  public.accounts;
  deps jsonb;
begin
  select * into acc from public.accounts
   where id = p_account_id and deleted_at is null
   for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  -- Owners and admins only.
  if auth.uid() is null or coalesce(public.role_in(acc.household_id), '') not in ('owner', 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if acc.kind = 'cash' then
    raise exception 'cash_account_protected' using errcode = '22023';
  end if;
  if acc.kind = 'loan' then
    raise exception 'system_account_protected' using errcode = '22023';
  end if;

  deps := public.account_dependencies(p_account_id);
  if (deps #>> '{transactions,count}')::int > 0
     or jsonb_array_length(deps->'recurring') > 0
     or jsonb_array_length(deps->'openSplits') > 0
     or (deps->>'loanEvents')::int > 0 then
    raise exception 'account_in_use' using errcode = '23503', detail = deps::text;
  end if;

  -- A tombstone, not a row delete: under refresh-based sync another device still
  -- holding the row would otherwise upload it again. Unrecoverable from the app.
  perform set_config('vyact.account_delete', 'on', true);
  update public.accounts set deleted_at = now(), is_default = false where id = p_account_id;
  perform set_config('vyact.account_delete', '', true);
  return jsonb_build_object('status', 'deleted', 'accountId', p_account_id);
end $fn$;

create or replace function public.move_account_and_delete(p_from uuid, p_to uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  src      public.accounts;
  dst      public.accounts;
  deps     jsonb;
  n_debit  int;
  n_credit int;
  n_sched  int;
  n_sched2 int;
  folded   numeric;
begin
  if p_from = p_to then
    raise exception 'same_account' using errcode = '22023';
  end if;

  select * into src from public.accounts where id = p_from and deleted_at is null for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  select * into dst from public.accounts where id = p_to and deleted_at is null for update;
  if not found then
    raise exception 'destination_not_found' using errcode = 'P0002';
  end if;
  if src.household_id <> dst.household_id then
    raise exception 'different_household' using errcode = '22023';
  end if;
  if auth.uid() is null or coalesce(public.role_in(src.household_id), '') not in ('owner', 'admin') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if src.kind not in ('bank', 'credit_card') then
    raise exception 'source_not_movable' using errcode = '22023';
  end if;
  if dst.is_archived then
    raise exception 'destination_archived' using errcode = '22023';
  end if;
  -- Same group only: bank/cash ↔ bank/cash, card ↔ card.
  if (src.kind = 'credit_card') <> (dst.kind = 'credit_card')
     or dst.kind not in ('bank', 'cash', 'credit_card') then
    raise exception 'destination_different_group' using errcode = '22023';
  end if;

  deps := public.account_dependencies(p_from);
  if jsonb_array_length(deps->'openSplits') > 0 then
    raise exception 'unsettled_splits' using errcode = '23503', detail = deps::text;
  end if;
  if (deps->>'loanEvents')::int > 0 then
    raise exception 'loan_history_attached' using errcode = '23503', detail = deps::text;
  end if;
  -- A transfer between the two would become a transfer from an account to
  -- itself.
  if exists (
    select 1 from public.transactions t
     where t.household_id = src.household_id
       and t.deleted_at is null
       and ((t.account_id = p_from and t.to_account_id = p_to)
         or (t.account_id = p_to and t.to_account_id = p_from))
  ) then
    raise exception 'transfers_between_accounts' using errcode = '23514';
  end if;

  -- Every row, tombstoned ones included, so no history points at a deleted account.
  update public.transactions set account_id = p_to
   where household_id = src.household_id and account_id = p_from;
  get diagnostics n_debit = row_count;
  update public.transactions set to_account_id = p_to
   where household_id = src.household_id and to_account_id = p_from;
  get diagnostics n_credit = row_count;

  update public.recurring_schedules
     set txn_template = jsonb_set(txn_template, '{accountId}', to_jsonb(p_to::text))
   where household_id = src.household_id and txn_template->>'accountId' = p_from::text;
  get diagnostics n_sched = row_count;
  update public.recurring_schedules
     set txn_template = jsonb_set(txn_template, '{toAccountId}', to_jsonb(p_to::text))
   where household_id = src.household_id and txn_template->>'toAccountId' = p_from::text;
  get diagnostics n_sched2 = row_count;

  -- The source's starting point and its reconciled drift move with its rows.
  folded := coalesce(src.opening_balance, 0) + coalesce(src.reconciliation_offset, 0);
  if folded <> 0 then
    update public.accounts
       set reconciliation_offset = reconciliation_offset + folded,
           reconciliation_log = reconciliation_log || jsonb_build_array(jsonb_build_object(
             'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
             'delta', folded,
             'kind', 'merge',
             'stated_value', null,
             'note', 'Moved from ' || src.name))
     where id = p_to;
  end if;

  perform set_config('vyact.account_delete', 'on', true);
  update public.accounts set deleted_at = now(), is_default = false where id = p_from;
  perform set_config('vyact.account_delete', '', true);

  return jsonb_build_object(
    'status', 'moved', 'from', p_from, 'to', p_to,
    'transactions', n_debit + n_credit, 'schedules', n_sched + n_sched2, 'folded', folded);
end $fn$;

revoke all on function public.delete_account(uuid) from public;
revoke all on function public.delete_account(uuid) from anon;
grant execute on function public.delete_account(uuid) to authenticated;
revoke all on function public.move_account_and_delete(uuid, uuid) from public;
revoke all on function public.move_account_and_delete(uuid, uuid) from anon;
grant execute on function public.move_account_and_delete(uuid, uuid) to authenticated;

-- ── 4. Cash in Hand is never handed back archived ───────────────────────────────────────────────────
-- An archived Cash in Hand could only come from a direct write the guard above now refuses. Restore any
-- (keeping it the default only if no other live account is), so WhatsApp and the app see it again.
update public.accounts a
   set is_archived = false,
       is_default = a.is_default and not exists (
         select 1 from public.accounts d
          where d.household_id = a.household_id and d.id <> a.id
            and d.is_default and not d.is_archived and d.deleted_at is null)
 where a.kind = 'cash' and a.is_archived and a.deleted_at is null;

create or replace function public.ensure_cash_account(p_household uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
  acc public.accounts;
begin
  caller_role := public.role_in(p_household);
  if auth.uid() is null or caller_role is null then
    raise exception 'not_a_household_member' using errcode = '42501';
  end if;

  if caller_role in ('owner', 'admin', 'member') then
    insert into public.accounts (household_id, kind, name, currency, is_default, opening_balance, source)
    select h.id, 'cash', 'Cash in Hand', h.base_currency,
           not exists (select 1 from public.accounts d
                        where d.household_id = h.id
                          and d.is_default and not d.is_archived and d.deleted_at is null),
           0, 'user'
      from public.households h
     where h.id = p_household
    on conflict (household_id) where kind = 'cash' and deleted_at is null do nothing;
    -- T2c (DB-INT-09): Cash in Hand is never archived; one that was is restored.
    update public.accounts a
       set is_archived = false,
           is_default = a.is_default and not exists (
             select 1 from public.accounts d
              where d.household_id = a.household_id and d.id <> a.id
                and d.is_default and not d.is_archived and d.deleted_at is null)
     where a.household_id = p_household and a.kind = 'cash' and a.is_archived and a.deleted_at is null;
  end if;

  select * into acc
    from public.accounts
   where household_id = p_household and kind = 'cash' and deleted_at is null;
  if not found then
    return null;
  end if;
  return to_jsonb(acc);
end $$;

revoke all on function public.ensure_cash_account(uuid) from public;
revoke all on function public.ensure_cash_account(uuid) from anon;
grant execute on function public.ensure_cash_account(uuid) to authenticated;

-- ── 5. Schedules: their owner and the template's account and asset are the household's own ────────
-- A template id that is not a UUID, or names no row, links nothing and is left alone.
create or replace function public.assert_recurring_tenant_consistency()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  k   text;
  v   text;
  uid uuid;
  hid uuid;
begin
  if new.owner_member_id is not null and (tg_op = 'INSERT' or old.owner_member_id is distinct from new.owner_member_id)
     and not exists (select 1 from public.memberships where id = new.owner_member_id and household_id = new.household_id) then
    raise exception 'recurring_schedules.owner_member_id belongs to a different household' using errcode = '23503';
  end if;
  foreach k in array array['accountId', 'toAccountId', 'assetId'] loop
    v := new.txn_template ->> k;
    continue when v is null or v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    continue when tg_op = 'UPDATE' and (old.txn_template ->> k) is not distinct from v;
    uid := v::uuid;
    if k = 'assetId' then
      select household_id into hid from public.assets where id = uid;
    else
      select household_id into hid from public.accounts where id = uid;
    end if;
    if found and hid <> new.household_id then
      raise exception 'recurring_schedules.txn_template.% belongs to a different household', k using errcode = '23503';
    end if;
  end loop;
  return new;
end $$;
revoke all on function public.assert_recurring_tenant_consistency() from public, anon, authenticated;

drop trigger if exists trg_recurring_tenant_consistency on public.recurring_schedules;
create trigger trg_recurring_tenant_consistency
  before insert or update on public.recurring_schedules
  for each row execute function public.assert_recurring_tenant_consistency();

commit;
