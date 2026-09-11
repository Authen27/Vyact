-- ============================================================================
-- v10.30.0 — recorded monthly Net Worth snapshots.
--
-- WHY
-- Reports and Net Worth can only show the position TODAY. A historical Net
-- Worth cannot be reconstructed honestly: standalone assets and debts store
-- only their current value, so any past figure would be invented. History is
-- therefore RECORDED from now on — one snapshot per household per calendar
-- month, taken from the app's canonical projection (react/src/lib/netWorth.ts).
-- Nothing is back-filled.
--
-- CONTRACT
--   • One row per (household, month). The FIRST write for a month wins
--     (`on conflict do nothing`), so two devices cannot overwrite each other
--     and a recorded month is never edited.
--   • Written only through record_net_worth_snapshot (SECURITY DEFINER), by a
--     member who may write, for the CURRENT month, in the household's base
--     currency — the last check refuses a snapshot taken before the profile
--     loaded (the app's profile currency is 'USD' until then).
--   • net_worth is derived in the database (assets − liabilities), never sent.
--   • Readable by household members (RLS). No client write policies.
-- ============================================================================

BEGIN;

create table if not exists public.net_worth_snapshots (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households(id) on delete cascade,
  month             date not null,
  total_assets      numeric(15,2) not null,
  total_liabilities numeric(15,2) not null,
  net_worth         numeric(15,2) generated always as (total_assets - total_liabilities) stored,
  liquid_assets     numeric(15,2) not null,
  currency          text not null,
  recorded_by       uuid references auth.users(id) on delete set null,
  recorded_at       timestamptz not null default now(),
  constraint uq_net_worth_snapshot_month unique (household_id, month),
  constraint ck_net_worth_snapshot_first_of_month check (extract(day from month) = 1),
  constraint ck_net_worth_snapshot_liabilities check (total_liabilities >= 0),
  constraint ck_net_worth_snapshot_currency check (currency ~ '^[A-Z]{3}$')
);

alter table public.net_worth_snapshots enable row level security;

drop policy if exists "net_worth_snapshots_member_read" on public.net_worth_snapshots;
create policy "net_worth_snapshots_member_read" on public.net_worth_snapshots
  for select to authenticated
  using (public.is_member(household_id));

-- No insert/update/delete policies: writes go through the function below, and
-- a recorded month is never changed.
revoke insert, update, delete on public.net_worth_snapshots from anon, authenticated;

create or replace function public.record_net_worth_snapshot(
  p_household uuid,
  p_month date,
  p_total_assets numeric,
  p_total_liabilities numeric,
  p_liquid_assets numeric,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_role text;
  base text;
  snap public.net_worth_snapshots;
begin
  caller_role := public.role_in(p_household);
  if auth.uid() is null or caller_role is null then
    raise exception 'not_a_household_member' using errcode = '42501';
  end if;

  if p_month is null or extract(day from p_month) <> 1 then
    raise exception 'snapshot_month_must_be_first_of_month' using errcode = '22023';
  end if;

  -- A snapshot records NOW. One day of slack either side absorbs time zones at
  -- a month boundary; anything else would be a back-dated or future record.
  if p_month < date_trunc('month', now() - interval '1 day')::date
     or p_month > date_trunc('month', now() + interval '1 day')::date then
    raise exception 'snapshot_month_not_current' using errcode = '22023';
  end if;

  select h.base_currency into base from public.households h where h.id = p_household;
  if p_currency is distinct from base then
    raise exception 'snapshot_currency_not_household_base' using errcode = '22023';
  end if;

  if caller_role in ('owner', 'admin', 'member') then
    insert into public.net_worth_snapshots
      (household_id, month, total_assets, total_liabilities, liquid_assets, currency, recorded_by)
    values
      (p_household, p_month, p_total_assets, p_total_liabilities, p_liquid_assets, p_currency, auth.uid())
    on conflict (household_id, month) do nothing;
  end if;

  select * into snap
    from public.net_worth_snapshots
   where household_id = p_household and month = p_month;
  if not found then
    return null;
  end if;
  return to_jsonb(snap);
end $$;

-- Postgres grants EXECUTE to PUBLIC by default and anon inherits it; an
-- explicit grant to authenticated does not take that away (see
-- 20260909150000_v1022_lock_down_definer_functions.sql).
revoke all on function public.record_net_worth_snapshot(uuid, date, numeric, numeric, numeric, text) from public;
revoke all on function public.record_net_worth_snapshot(uuid, date, numeric, numeric, numeric, text) from anon;
grant execute on function public.record_net_worth_snapshot(uuid, date, numeric, numeric, numeric, text) to authenticated;

-- "Erase my data" must erase recorded history too. Body identical to
-- 20260908120200_audit_s6_erase_onboarding_fix.sql plus the snapshots delete.
create or replace function erase_household_data(h_id uuid)
returns void
language plpgsql
security definer
set search_path = public
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

  delete from transactions        where household_id = h_id;
  delete from budgets              where household_id = h_id;
  delete from budget_allocations   where household_id = h_id;
  delete from goals                where household_id = h_id;
  delete from debts                where household_id = h_id;
  delete from assets               where household_id = h_id;
  delete from accounts             where household_id = h_id;
  delete from recurring_schedules  where household_id = h_id;
  delete from saved_views          where household_id = h_id;
  delete from net_worth_snapshots  where household_id = h_id;
  delete from activity_log         where household_id = h_id;

  -- Onboarding baseline/reference overlay (v9.7.0) lives in households.onboarding.
  -- NOT NULL + object CHECK ⇒ reset to the empty baseline, never null (audit S6).
  update households set onboarding = '{}'::jsonb where id = h_id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h_id, auth.uid(), 'erase_household_data', 'household', h_id, jsonb_build_object('erased_at', now()));
end;
$$;

-- `create or replace` keeps existing grants; re-assert the v10.22 lock-down.
revoke all on function erase_household_data(uuid) from public;
revoke all on function erase_household_data(uuid) from anon;
grant execute on function erase_household_data(uuid) to authenticated;

COMMIT;
