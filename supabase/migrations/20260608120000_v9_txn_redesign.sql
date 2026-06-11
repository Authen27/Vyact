-- v9 — Transaction Forms & Categories Rebuild (vyact-txn-redesign-architect-spec_1).
--
-- Forward-only, data-first, constraints LAST (§5). Applied to prod 2026-06-08 with:
--   • M0 restore point: _backup_v9_{transactions,accounts,budgets} tables (in-DB;
--     PITR not triggerable via MCP — capture a dashboard backup before re-running
--     elsewhere).
--   • INV-9 verified: spend 91,390.10 and income 301,232.00 identical before/after;
--     40 rows preserved; 0 violations; 3 unresolvable cases logged to
--     migration_issues (legacy paymentMethod keys → system Cash; transfer
--     destination best-effort) — never dropped.
--
-- Key decisions implemented (spec §0):
--   D1: transfers are ONE row (type='transfer', both FKs, category NULL).
--   D2: reconciliation / investment value = accounts.reconciliation_offset (+ log),
--       NEVER a transactions row. Legacy balance_adjustment rows are folded into
--       the offset and deleted.
--   §2.4 account matrix: expense(account_id only) · income(to_account_id only) ·
--       transfer/investment(both).
--   §3: type-scoped category enums; renames keep spend/income sums identical.
--   Deviation (documented): extras functional keys (time/excluded/split/
--       paymentMethod/accountSplits) are RETAINED — §4.2 itself requires the
--       Private toggle (extras.excluded); only the forbidden linkage keys
--       (__tg / linkedToAssetId / linkedAssetId) are scrubbed.

BEGIN;

create table if not exists migration_issues (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  step text not null,
  ref_id uuid,
  detail text
);

-- M2 — accounts: strict kind enum + reconciliation fields (D2)
alter table accounts drop constraint if exists accounts_kind_check;
update accounts set kind = 'bank' where kind in ('checking','savings','wallet','other');

alter table accounts
  add column if not exists reconciliation_offset numeric not null default 0,
  add column if not exists reconciliation_log jsonb not null default '[]'::jsonb;

comment on column accounts.reconciliation_offset is
  'D2 forgiveness term: drift between computed and stated balance. Feeds net worth; NEVER spend/income.';
comment on column accounts.reconciliation_log is
  'Dated audit trail [{at, delta, kind: bank|investment, stated_value}] — account history only.';

alter table transactions alter column category drop not null;

-- FK backfill from the encoded extras.paymentMethod scheme
create or replace function _v9_resolve_account(hh uuid, pm text) returns uuid language sql stable as $$
  select case
    when pm is null or pm = '' or pm = 'cash' then
      (select id from accounts a where a.household_id = hh and a.kind = 'cash' and a.deleted_at is null limit 1)
    when pm like 'asset:%' or pm like 'debt:%' then
      coalesce(
        (select id from accounts a where a.household_id = hh and a.asset_id::text = split_part(pm, ':', 2) and a.deleted_at is null limit 1),
        (select id from accounts a where a.household_id = hh and a.kind = 'cash' and a.deleted_at is null limit 1))
    else
      (select id from accounts a where a.household_id = hh and a.kind = 'cash' and a.deleted_at is null limit 1)
  end
$$;

insert into migration_issues (step, ref_id, detail)
select 'fk_backfill_legacy_pm', t.id, 'legacy paymentMethod "'||(t.extras->>'paymentMethod')||'" mapped to system Cash'
from transactions t
where t.extras->>'paymentMethod' is not null
  and t.extras->>'paymentMethod' not in ('cash')
  and t.extras->>'paymentMethod' not like 'asset:%'
  and t.extras->>'paymentMethod' not like 'debt:%'
  and not exists (select 1 from migration_issues mi where mi.step='fk_backfill_legacy_pm' and mi.ref_id = t.id);

update transactions t set
  account_id = coalesce(t.account_id, _v9_resolve_account(t.household_id, t.extras->>'paymentMethod')),
  to_account_id = null
where t.type = 'expense' and t.account_id is null;

update transactions t set
  to_account_id = coalesce(t.to_account_id, t.account_id, _v9_resolve_account(t.household_id, t.extras->>'paymentMethod')),
  account_id = null
where t.type = 'income' and t.to_account_id is null;
update transactions set account_id = null where type = 'income' and account_id is not null;

-- M1 — single-row transfers
insert into migration_issues (step, ref_id, detail)
select 'transfer_missing_to', id, 'transfer had no destination; assigned system Cash best-effort'
from transactions t
where t.type='transfer' and t.to_account_id is null
  and not exists (select 1 from migration_issues mi where mi.step='transfer_missing_to' and mi.ref_id=t.id);

update transactions t set
  category = null,
  account_id = coalesce(t.account_id, _v9_resolve_account(t.household_id, t.extras->>'paymentMethod')),
  to_account_id = coalesce(t.to_account_id,
    nullif(_v9_resolve_account(t.household_id, t.extras->>'linkedToAssetId'), t.account_id),
    (select id from accounts a where a.household_id=t.household_id and a.kind='cash' and a.deleted_at is null limit 1))
where t.type = 'transfer';

update transactions t set to_account_id =
  coalesce((select id from accounts a where a.household_id=t.household_id and a.id <> t.account_id and a.deleted_at is null limit 1), t.to_account_id)
where t.type='transfer' and t.account_id = t.to_account_id;

-- M3..M6 — category remaps (pure renames; sums unchanged)
update transactions set category='food_dining'      where category='food';
update transactions set category='rent_mortgage'    where category='rent';
update transactions set category='other_expense'    where category='other_exp';
update transactions set category='gift_bonus'       where category='gift';
update transactions set category='rental_income'    where category='rental';
update transactions set category='business_revenue' where category='business';
update transactions set category='other_income'     where category='other_inc';
update transactions set category='other_income'     where category='investment' and type='income';
update transactions set category='loan_emi'         where category in ('debt_payment','debt_interest');
update transactions set category='other_expense'    where category like 'goal_%' or category like 'tax_%';
update transactions set type='transfer', category=null where category='debt_principal';

update budgets set category='food_dining'   where category='food';
update budgets set category='rent_mortgage' where category='rent';
update budgets set category='other_expense' where category='other_exp';

update recurring_schedules set txn_template = jsonb_set(txn_template, '{category}',
  to_jsonb(case txn_template->>'category'
    when 'food' then 'food_dining' when 'rent' then 'rent_mortgage'
    when 'other_exp' then 'other_expense' when 'gift' then 'gift_bonus'
    when 'rental' then 'rental_income' when 'business' then 'business_revenue'
    when 'other_inc' then 'other_income' else txn_template->>'category' end))
where txn_template ? 'category';

-- M2b — legacy balance_adjustment rows → reconciliation_offset (D2)
do $$
declare r record;
begin
  for r in select * from transactions where category='balance_adjustment' loop
    update accounts set
      reconciliation_offset = reconciliation_offset + (case when r.type='income' then r.amount else -r.amount end),
      reconciliation_log = reconciliation_log || jsonb_build_object('at', r.created_at, 'delta',
        (case when r.type='income' then r.amount else -r.amount end), 'kind', 'bank', 'stated_value', null)
    where id = coalesce(r.account_id, r.to_account_id);
    delete from transactions where id = r.id;
  end loop;
end $$;

-- M7 — scrub forbidden linkage keys
update transactions set extras = (extras - '__tg' - 'linkedToAssetId' - 'linkedAssetId')
where extras ?| array['__tg','linkedToAssetId','linkedAssetId'];

-- M8 — constraints LAST
alter table transactions drop constraint if exists CK_txn_type;
alter table transactions add constraint CK_txn_type
  check (type in ('expense','income','investment','transfer'));

alter table transactions drop constraint if exists CK_txn_category_by_type;
alter table transactions add constraint CK_txn_category_by_type
  check ((type in ('expense','income') and category is not null)
      or (type in ('investment','transfer') and category is null));

alter table transactions drop constraint if exists CK_txn_accounts_by_type;
alter table transactions add constraint CK_txn_accounts_by_type
  check ((type='expense'    and account_id is not null and to_account_id is null)
      or (type='income'     and account_id is null     and to_account_id is not null)
      or (type='transfer'   and account_id is not null and to_account_id is not null)
      or (type='investment' and account_id is not null and to_account_id is not null));

alter table accounts drop constraint if exists CK_account_kind;
alter table accounts add constraint CK_account_kind
  check (kind in ('cash','bank','credit_card','investment','loan'));

drop function if exists _v9_resolve_account(uuid, text);

COMMIT;
