-- ============================================================================
-- v10.26.0 (Accounts R4) — investments become Net Worth assets.
--
-- Before: an investment was a transaction between two ACCOUNTS, one of them a
-- kind='investment' account. After: it moves money between an ACCOUNT and an
-- investment ASSET.
--
--   buy         account_id  = paying account,     asset_id = the asset
--   withdrawal  to_account_id = receiving account, asset_id = the asset
--
-- An investment asset's live value folds EXACTLY like an account (decision
-- "mirror accounts"):
--
--   live = assets.value (opening) + Σ buys − Σ withdrawals + valuation_offset
--
-- "Update value" moves valuation_offset with a dated valuation_log entry —
-- never `value`, never a transaction. assets.value therefore stays >= 0.
--
-- CONVERSION — every live investment account becomes an asset carrying the
-- account's opening balance, reconciliation offset and log verbatim; its
-- transactions and recurring templates are re-pointed; the account is
-- tombstoned. Inside the same transaction each converted value, and every OTHER
-- account's balance, is recomputed and the migration RAISES (rolls back) on any
-- difference. Production today: one account, "Delhi Investment Serivices",
-- live value 48,780.00 INR.
--
-- Archive-first: the affected rows are copied to maintenance.* before anything
-- changes.
-- ============================================================================

BEGIN;

-- ── 0. archive ──────────────────────────────────────────────────────────────
create table if not exists maintenance.r4_accounts_archive_20260911
  as select * from public.accounts with no data;
insert into maintenance.r4_accounts_archive_20260911
  select * from public.accounts where kind = 'investment';

create table if not exists maintenance.r4_transactions_archive_20260911
  as select * from public.transactions with no data;
insert into maintenance.r4_transactions_archive_20260911
  select t.* from public.transactions t
   where exists (select 1 from public.accounts a where a.kind = 'investment'
                   and (a.id = t.account_id or a.id = t.to_account_id));

create table if not exists maintenance.r4_recurring_archive_20260911
  as select * from public.recurring_schedules with no data;
insert into maintenance.r4_recurring_archive_20260911
  select s.* from public.recurring_schedules s
   where exists (select 1 from public.accounts a where a.kind = 'investment'
                   and (a.id::text = s.txn_template->>'accountId' or a.id::text = s.txn_template->>'toAccountId'));

-- ── 1. asset valuation (mirrors accounts.reconciliation_offset / _log) ─────
alter table public.assets
  add column if not exists valuation_offset numeric(15,2) not null default 0,
  add column if not exists valuation_log    jsonb        not null default '[]'::jsonb;

-- ── 2. transactions.asset_id ───────────────────────────────────────────────
alter table public.transactions
  add column if not exists asset_id uuid references public.assets(id) on delete restrict;
create index if not exists ix_txn_asset on public.transactions (asset_id) where asset_id is not null;

-- The old matrix requires both account FKs on an investment; the new one
-- forbids it. Swapped around the conversion, re-added below.
alter table public.transactions drop constraint if exists ck_txn_accounts_by_type;

-- ── 3. convert ─────────────────────────────────────────────────────────────
do $conv$
declare
  a            record;
  v_asset      uuid;
  v_before     numeric;
  v_after      numeric;
  v_others     jsonb;
  v_others_now jsonb;
  v_converted  int := 0;
begin
  -- Every non-investment account's balance, before. The conversion only ever
  -- NULLS the investment side of a row, so these must not move.
  select coalesce(jsonb_object_agg(x.id, x.bal), '{}'::jsonb) into v_others from (
    select ac.id,
           coalesce(ac.opening_balance, 0) + coalesce(ac.reconciliation_offset, 0)
           + coalesce((select sum(t.amount) from public.transactions t where t.to_account_id = ac.id and t.deleted_at is null), 0)
           - coalesce((select sum(t.amount) from public.transactions t where t.account_id    = ac.id and t.deleted_at is null), 0) as bal
      from public.accounts ac where ac.kind <> 'investment') x;

  for a in select * from public.accounts where kind = 'investment' and deleted_at is null loop
    if exists (select 1 from public.transactions t
                where (t.account_id = a.id or t.to_account_id = a.id) and t.type <> 'investment') then
      raise exception 'R4: account % has non-investment rows; convert by hand', a.id;
    end if;
    if exists (select 1 from public.transactions t
                where (t.account_id = a.id or t.to_account_id = a.id) and t.deleted_at is null and t.currency <> a.currency) then
      raise exception 'R4: account % has foreign-currency rows; convert by hand', a.id;
    end if;
    if coalesce(a.opening_balance, 0) < 0 then
      raise exception 'R4: account % has a negative opening balance', a.id;
    end if;

    v_before := coalesce(a.opening_balance, 0) + coalesce(a.reconciliation_offset, 0)
      + coalesce((select sum(t.amount) from public.transactions t where t.to_account_id = a.id and t.deleted_at is null), 0)
      - coalesce((select sum(t.amount) from public.transactions t where t.account_id    = a.id and t.deleted_at is null), 0);

    insert into public.assets (household_id, type, name, value, currency, liquidity, note, last_updated,
                               valuation_offset, valuation_log, confidence, source)
    values (a.household_id, 'investment', a.name, coalesce(a.opening_balance, 0), a.currency, 'short',
            'Converted from the investment account on 2026-09-11 (v10.26.0).',
            coalesce((select max((e->>'at')::timestamptz)::date from jsonb_array_elements(coalesce(a.reconciliation_log, '[]'::jsonb)) e),
                     a.created_at::date),
            coalesce(a.reconciliation_offset, 0), coalesce(a.reconciliation_log, '[]'::jsonb),
            coalesce(a.confidence, 'confirmed'), coalesce(a.source, 'user'))
    returning id into v_asset;

    -- buys: money arrived in the investment account → arrives in the asset
    update public.transactions set asset_id = v_asset, to_account_id = null
     where to_account_id = a.id and type = 'investment';
    -- withdrawals: money left the investment account → leaves the asset
    update public.transactions set asset_id = v_asset, account_id = null
     where account_id = a.id and type = 'investment';

    update public.recurring_schedules
       set txn_template = (txn_template - 'toAccountId') || jsonb_build_object('assetId', v_asset::text)
     where txn_template->>'toAccountId' = a.id::text;
    update public.recurring_schedules
       set txn_template = (txn_template - 'accountId') || jsonb_build_object('assetId', v_asset::text)
     where txn_template->>'accountId' = a.id::text;

    update public.accounts set deleted_at = now(), is_default = false where id = a.id;

    select s.value + s.valuation_offset
           + coalesce((select sum(t.amount) from public.transactions t
                        where t.asset_id = v_asset and t.account_id is not null and t.deleted_at is null), 0)
           - coalesce((select sum(t.amount) from public.transactions t
                        where t.asset_id = v_asset and t.account_id is null and t.deleted_at is null), 0)
      into v_after from public.assets s where s.id = v_asset;

    if v_after is distinct from v_before then
      raise exception 'R4: value moved converting % (% → %)', a.id, v_before, v_after;
    end if;
    v_converted := v_converted + 1;
  end loop;

  select coalesce(jsonb_object_agg(x.id, x.bal), '{}'::jsonb) into v_others_now from (
    select ac.id,
           coalesce(ac.opening_balance, 0) + coalesce(ac.reconciliation_offset, 0)
           + coalesce((select sum(t.amount) from public.transactions t where t.to_account_id = ac.id and t.deleted_at is null), 0)
           - coalesce((select sum(t.amount) from public.transactions t where t.account_id    = ac.id and t.deleted_at is null), 0) as bal
      from public.accounts ac where ac.kind <> 'investment') x;
  if v_others_now is distinct from v_others then
    raise exception 'R4: an account balance moved during the conversion';
  end if;

  raise notice 'R4: converted % investment account(s)', v_converted;
end
$conv$;

-- ── 4. the new per-type matrix ─────────────────────────────────────────────
alter table public.transactions add constraint ck_txn_accounts_by_type check (
     (type = 'expense'    and account_id is not null and to_account_id is null     and asset_id is null)
  or (type = 'income'     and account_id is null     and to_account_id is not null and asset_id is null)
  or (type = 'transfer'   and account_id is not null and to_account_id is not null and asset_id is null)
  or (type = 'investment' and asset_id is not null
        and ((account_id is not null and to_account_id is null) or (account_id is null and to_account_id is not null)))
);

-- ── 5. no live investment accounts, ever again ─────────────────────────────
-- Tombstoned ones stay (history); a live one is refused.
alter table public.accounts drop constraint if exists ck_account_no_live_investment;
alter table public.accounts add constraint ck_account_no_live_investment
  check (kind <> 'investment' or deleted_at is not null);

-- ── 6. an asset with live transactions cannot be deleted ───────────────────
-- Assets are soft-deleted. Removing one its buys still point at would take its
-- value out of net worth while the paying accounts stay debited.
create or replace function public.assets_refuse_delete_in_use()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.deleted_at is not null and old.deleted_at is null
     and exists (select 1 from public.transactions t where t.asset_id = new.id and t.deleted_at is null) then
    raise exception 'asset_in_use' using errcode = 'P0001';
  end if;
  return new;
end
$$;
drop trigger if exists assets_refuse_delete_in_use on public.assets;
create trigger assets_refuse_delete_in_use
  before update of deleted_at on public.assets
  for each row execute function public.assets_refuse_delete_in_use();
revoke all on function public.assets_refuse_delete_in_use() from public, anon, authenticated;

-- ── 7. WhatsApp writer: an investment lands in an investment ASSET ─────────
create or replace function public.whatsapp_log_transaction(
  p_profile_id      uuid,
  p_household_id    uuid,
  p_amount          numeric,
  p_currency        text,
  p_txn_type        text,
  p_category_id     text,
  p_account_alias   text,
  p_to_account_alias text,
  p_wa_message_id   text,
  p_description     text,
  p_date            date default null,
  p_payment_mode    text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id     uuid;
  v_member_role   text;
  v_account_id    uuid;
  v_to_account_id uuid;
  v_asset_id      uuid;
  v_cash_id       uuid;
  v_txn_id        uuid;
  v_claimed       int;
  v_date          date;
  v_mode          text;
begin
  v_date := coalesce(p_date, current_date);
  if v_date > current_date + interval '2 days' or v_date < current_date - interval '5 years' then
    v_date := current_date;
  end if;
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('status','error','reason','invalid_amount');
  end if;
  if p_txn_type not in ('expense','income','investment','transfer') then
    return jsonb_build_object('status','error','reason','invalid_type');
  end if;

  insert into public.whatsapp_inbound_messages (wa_message_id, profile_id, household_id, direction)
    values (p_wa_message_id, p_profile_id, p_household_id, 'inbound')
    on conflict (wa_message_id) do nothing;

  update public.whatsapp_inbound_messages
     set processed_at = now(),
         profile_id   = coalesce(profile_id, p_profile_id),
         household_id = coalesce(household_id, p_household_id)
   where wa_message_id = p_wa_message_id and processed_at is null;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return jsonb_build_object('status','duplicate');
  end if;

  select id, role into v_member_id, v_member_role
    from public.memberships
   where household_id = p_household_id and user_id = p_profile_id
   limit 1;
  if v_member_id is null then
    return jsonb_build_object('status','error','reason','not_a_member');
  end if;
  if v_member_role = 'viewer' then
    return jsonb_build_object('status','error','reason','read_only_member');
  end if;

  select id into v_cash_id
    from public.accounts
   where household_id = p_household_id and lower(kind) = 'cash'
     and coalesce(is_archived,false) = false and deleted_at is null
   limit 1;

  if p_account_alias is not null and p_account_alias <> '' then
    select id into v_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
       and deleted_at is null
       and (lower(name) = lower(p_account_alias) or lower(kind) = lower(p_account_alias))
     limit 1;
  end if;

  if p_txn_type = 'investment' then
    -- R4: the destination is an investment ASSET — by name, or the household's
    -- only one when the message names none ("invested 5000").
    if p_to_account_alias is not null and p_to_account_alias <> '' and lower(p_to_account_alias) <> 'investment' then
      select id into v_asset_id from public.assets
       where household_id = p_household_id and deleted_at is null and type = 'investment'
         and lower(name) = lower(p_to_account_alias)
       limit 1;
    end if;
    if v_asset_id is null and (select count(*) from public.assets
                                where household_id = p_household_id and deleted_at is null and type = 'investment') = 1 then
      select id into v_asset_id from public.assets
       where household_id = p_household_id and deleted_at is null and type = 'investment';
    end if;
  elsif p_to_account_alias is not null and p_to_account_alias <> '' then
    select id into v_to_account_id
      from public.accounts
     where household_id = p_household_id
       and coalesce(is_archived,false) = false
       and deleted_at is null
       and (lower(name) = lower(p_to_account_alias) or lower(kind) = lower(p_to_account_alias))
     limit 1;
  end if;

  if p_txn_type = 'expense' then
    v_account_id := coalesce(v_account_id, v_cash_id);
    v_to_account_id := null;
    if v_account_id is null then
      return jsonb_build_object('status','error','reason','no_source_account');
    end if;
  elsif p_txn_type = 'income' then
    v_to_account_id := coalesce(v_to_account_id, v_account_id, v_cash_id);
    v_account_id := null;
    if v_to_account_id is null then
      return jsonb_build_object('status','error','reason','no_destination_account');
    end if;
  elsif p_txn_type = 'investment' then
    v_account_id := coalesce(v_account_id, v_cash_id);
    v_to_account_id := null;
    if v_account_id is null then
      return jsonb_build_object('status','error','reason','no_source_account');
    end if;
    if v_asset_id is null then
      return jsonb_build_object('status','error','reason','no_investment_asset');
    end if;
  else
    v_account_id := coalesce(v_account_id, v_cash_id);
    if v_account_id is null then
      return jsonb_build_object('status','error','reason','no_source_account');
    end if;
    if v_to_account_id is null then
      return jsonb_build_object('status','error','reason','no_destination_account');
    end if;
    if v_to_account_id = v_account_id then
      return jsonb_build_object('status','error','reason','same_account');
    end if;
  end if;

  if p_payment_mode is not null and p_txn_type <> 'investment' then
    select p_payment_mode into v_mode
      from public.accounts
     where id = case when p_txn_type = 'income' then v_to_account_id else v_account_id end
       and p_payment_mode = any (payment_modes);
  end if;

  insert into public.transactions (
    household_id, created_by, member_id, amount, currency, type, category,
    account_id, to_account_id, asset_id, date, description, payment_mode
  ) values (
    p_household_id,
    p_profile_id,
    v_member_id,
    p_amount,
    coalesce(nullif(p_currency,''), 'USD'),
    p_txn_type,
    case when p_txn_type in ('expense','income')
         then coalesce(nullif(p_category_id,''), case when p_txn_type='expense' then 'other_expense' else 'other_income' end)
         else null end,
    v_account_id,
    v_to_account_id,
    v_asset_id,
    v_date,
    coalesce(nullif(p_description,''), 'Logged via WhatsApp'),
    v_mode
  ) returning id into v_txn_id;

  update public.whatsapp_inbound_messages
     set payload = coalesce(payload,'{}'::jsonb) || jsonb_build_object(
           'parsed', jsonb_build_object(
             'transaction_id', v_txn_id, 'amount', p_amount, 'currency', p_currency,
             'type', p_txn_type, 'category_id', p_category_id,
             'account_id', v_account_id, 'to_account_id', v_to_account_id, 'asset_id', v_asset_id,
             'payment_mode', p_payment_mode, 'payment_mode_stored', v_mode))
   where wa_message_id = p_wa_message_id;

  return jsonb_build_object(
    'status','success',
    'transaction_id', v_txn_id,
    'amount', p_amount,
    'currency', coalesce(nullif(p_currency,''),'USD'),
    'type', p_txn_type,
    'category_id', p_category_id,
    'payment_mode', v_mode,
    'account_name',    (select name from public.accounts where id = v_account_id),
    -- the confirmation reads "from → to"; for an investment "to" is the asset
    'to_account_name', coalesce((select name from public.accounts where id = v_to_account_id),
                                (select name from public.assets   where id = v_asset_id))
  );
end;
$$;

revoke all on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date,text) from public, anon, authenticated;
grant execute on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date,text) to service_role;

comment on function public.whatsapp_log_transaction(uuid,uuid,numeric,text,text,text,text,text,text,text,date,text) is
  'v10.26.0 — WhatsApp/agent transaction writer. v9 CHECK-safe (R4 matrix: an investment moves money from an account into an investment asset), claim-first idempotent, p_date backdate-aware, audit-S1 membership gate, p_payment_mode kept only when the paying account lists it. Service-role only.';

COMMIT;
