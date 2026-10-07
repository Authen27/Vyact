-- W3a (v10.65.0) — audit 2026-10-04 INT-TZC-03/04/05, INT-PAR-04, BE-FN-08. Owner decision D12:
-- "today" is LOCAL — the device's day in the app, the HOUSEHOLD's day on the server.
--
-- The server (WhatsApp, the scheduler, web push) has no device to ask, and its clock is UTC, so a
-- household now carries its zone:
--
--   1. households.timezone (IANA name, NOT NULL, default 'Asia/Kolkata' — every existing household
--      starts on India time, which is what the server assumed until now) and timezone_set_at
--      (null = still the default, nobody has set it).
--   2. A trigger validates every zone against pg_timezone_names, and a new household takes its
--      creator's zone from the signup metadata when the app sent one.
--   3. set_household_timezone(): the owner's device stamps its own zone, once (p_only_if_unset),
--      so a household created through Google or a magic link — which carry no metadata — still
--      ends up on the owner's real zone.
--   4. The scheduler's daily and weekly jobs run every 30 minutes instead of at one fixed UTC time
--      meant as IST; the dispatcher picks the households whose LOCAL time is in the job's slot
--      (bills 09:00, digest 20:30, monthly 09:00, weekly Sunday 18:00). Their dedupe slots already
--      make a repeated run send nothing twice. IST households see no change in timing.

alter table public.households add column if not exists timezone text not null default 'Asia/Kolkata';
alter table public.households add column if not exists timezone_set_at timestamptz;

create or replace function public.is_valid_timezone(p text)
returns boolean
language sql
stable
set search_path = public, pg_catalog
as $$
  select p is not null and exists (select 1 from pg_catalog.pg_timezone_names where name = p);
$$;

create or replace function public.households_timezone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta text;
begin
  -- A new household takes its creator's device zone when the signup sent one.
  if tg_op = 'INSERT' and new.timezone_set_at is null and new.created_by is not null then
    select u.raw_user_meta_data ->> 'timezone' into v_meta from auth.users u where u.id = new.created_by;
    if public.is_valid_timezone(v_meta) then
      new.timezone := v_meta;
      new.timezone_set_at := now();
    end if;
  end if;
  if not public.is_valid_timezone(new.timezone) then
    raise exception 'invalid_timezone' using errcode = '22023', detail = coalesce(new.timezone, 'null');
  end if;
  return new;
end $$;

drop trigger if exists trg_households_timezone on public.households;
create trigger trg_households_timezone
  before insert or update of timezone on public.households
  for each row execute function public.households_timezone();

create or replace function public.set_household_timezone(
  p_household     uuid,
  p_tz            text,
  p_only_if_unset boolean default true
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if public.role_in(p_household) is distinct from 'owner' then
    raise exception 'only_owner_sets_timezone' using errcode = '42501';
  end if;
  if not public.is_valid_timezone(p_tz) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  update public.households
     set timezone = p_tz, timezone_set_at = now()
   where id = p_household
     and (not p_only_if_unset or timezone_set_at is null)
  returning timezone into v_tz;
  if v_tz is null then
    select timezone into v_tz from public.households where id = p_household;
  end if;
  return v_tz;
end $$;

revoke all on function public.set_household_timezone(uuid, text, boolean) from public, anon;
grant execute on function public.set_household_timezone(uuid, text, boolean) to authenticated, service_role;
revoke all on function public.households_timezone() from public, anon, authenticated;

-- 4. The scheduler's slots follow each household's own clock (see whatsapp-dispatch).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.alter_job(jobid, schedule := '0,30 * * * *')
       from cron.job
      where jobname in ('whatsapp-dispatch-weekly', 'whatsapp-dispatch-bills',
                        'whatsapp-dispatch-digest', 'whatsapp-dispatch-monthly');
  end if;
end $$;
