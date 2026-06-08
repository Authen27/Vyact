-- Userback #7830371 — recurring schedules should be household + user specific
-- (they were browser-local only via localStorage). New cloud table, household-
-- scoped via RLS, with user attribution (created_by = auth.uid()). Mirrors the
-- accounts table shape (RLS via is_member/role_in, updated_at trigger, delta-sync
-- index). The app keys this as the 'recurring' entity (tableName → this table).

BEGIN;

create table if not exists recurring_schedules (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references households(id) on delete cascade,
  created_by         uuid default auth.uid(),
  txn_template       jsonb not null default '{}'::jsonb,
  frequency          text not null check (frequency in ('weekly','monthly','yearly','custom_day')),
  day_of_month       int,
  weekday            int,
  start_date         date not null,
  next_due_date      date not null,
  last_generated     date,
  auto_confirm       boolean not null default false,
  active             boolean not null default true,
  reminder_lead_days int,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz
);

create index if not exists recurring_household
  on recurring_schedules (household_id) where deleted_at is null;
create index if not exists recurring_updated_idx
  on recurring_schedules (household_id, updated_at);

alter table recurring_schedules enable row level security;

drop policy if exists "recurring_read"   on recurring_schedules;
drop policy if exists "recurring_insert" on recurring_schedules;
drop policy if exists "recurring_update" on recurring_schedules;
drop policy if exists "recurring_delete" on recurring_schedules;

create policy "recurring_read" on recurring_schedules for select to authenticated
  using (is_member(household_id) or is_admin('roles'));
create policy "recurring_insert" on recurring_schedules for insert to authenticated
  with check (role_in(household_id) in ('owner','admin','member'));
create policy "recurring_update" on recurring_schedules for update to authenticated
  using (role_in(household_id) in ('owner','admin','member'))
  with check (role_in(household_id) in ('owner','admin','member'));
create policy "recurring_delete" on recurring_schedules for delete to authenticated
  using (role_in(household_id) in ('owner','admin','member'));

create or replace function set_updated_at_recurring()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_recurring_updated_at on recurring_schedules;
create trigger trg_recurring_updated_at
  before update on recurring_schedules
  for each row execute function set_updated_at_recurring();

COMMIT;
