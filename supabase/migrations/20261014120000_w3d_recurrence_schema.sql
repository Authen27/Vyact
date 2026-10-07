-- W3d (v10.68.0) — the recurrence schema, ahead of the app that needs it (owner decision D13: every
-- option the schedule form offers works; the month-end rule is chosen per schedule). Audit INT-TXN-05,
-- DB-INT-07/08, INT-CON-03, FE-MNY-01, XC-ARC-01.
--
--   1. 'daily' is allowed on recurring_schedules.frequency and transactions.recurring. The form
--      offered Daily, and both CHECKs refused it, so a daily schedule never reached the cloud and
--      posted money on one device only (INT-TXN-05).
--   2. recurring_schedules.short_month_policy: what a schedule on the 29th–31st does in a shorter
--      month — 'last_day' (the 28th/30th; default) or 'next_month_first' (the 1st of the next month).
--   3. Every schedule carries an RRULE. The v9.1 backfill wrote 'FREQ=MONTHLY;INTERVAL=1' with no
--      day, so read by the rule a bill on the 20th would move to its creation day. Those rows, and
--      rows with no rule, get one derived from their own columns (day_of_month / weekday / start
--      date) — the same derivation the app uses. A trigger fills it whenever an older app saves a
--      schedule without one.
--   4. whatsapp_approve_recurring takes p_exhausted: the app's engine says this was the last
--      occurrence (COUNT / UNTIL), and the schedule is closed instead of advanced. Otherwise the
--      function is unchanged (body copied from 20260927120000). The old 8-argument call still
--      resolves to it (the new argument has a default), so the deployed webhook keeps working.

-- 1. 'daily' on both CHECKs (inline, auto-named constraints: found by definition).
do $$
declare c record;
begin
  for c in
    select conrelid::regclass::text as tbl, conname
      from pg_constraint
     where contype = 'c'
       and ((conrelid = 'public.recurring_schedules'::regclass and pg_get_constraintdef(oid) ilike '%frequency = any%')
         or (conrelid = 'public.transactions'::regclass and pg_get_constraintdef(oid) ilike '%(recurring = any%'))
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.recurring_schedules
  add constraint ck_recurring_frequency check (frequency in ('daily', 'weekly', 'monthly', 'yearly', 'custom_day'));
alter table public.transactions
  add constraint ck_txn_recurring check (recurring in ('', 'daily', 'weekly', 'monthly', 'yearly'));

-- 2. The month-end rule, per schedule.
alter table public.recurring_schedules
  add column if not exists short_month_policy text not null default 'last_day';
alter table public.recurring_schedules drop constraint if exists ck_recurring_short_month_policy;
alter table public.recurring_schedules
  add constraint ck_recurring_short_month_policy check (short_month_policy in ('last_day', 'next_month_first'));

-- 3. One RRULE per schedule, derived from its own columns where it has none. Weekday 0 = Sunday.
create or replace function public.recurrence_rrule_from_legacy(
  p_frequency text, p_day_of_month int, p_weekday int, p_start date
) returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case p_frequency
    when 'daily'  then 'FREQ=DAILY;INTERVAL=1'
    when 'weekly' then 'FREQ=WEEKLY;INTERVAL=1;BYDAY='
                       || (array['SU','MO','TU','WE','TH','FR','SA'])[coalesce(p_weekday, extract(dow from p_start)::int) + 1]
    when 'yearly' then 'FREQ=YEARLY;INTERVAL=1;BYMONTH=' || extract(month from p_start)::int
                       || ';BYMONTHDAY=' || extract(day from p_start)::int
    else 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=' || coalesce(p_day_of_month, extract(day from p_start)::int)
  end
$$;

update public.recurring_schedules
   set rrule = public.recurrence_rrule_from_legacy(frequency, day_of_month, weekday, start_date)
 where rrule is null
    or rrule in ('FREQ=WEEKLY;INTERVAL=1', 'FREQ=MONTHLY;INTERVAL=1', 'FREQ=YEARLY;INTERVAL=1');

create or replace function public.recurring_schedules_fill_rrule()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.rrule is null or btrim(new.rrule) = '' then
    new.rrule := public.recurrence_rrule_from_legacy(new.frequency, new.day_of_month, new.weekday, new.start_date);
  end if;
  return new;
end $$;

drop trigger if exists trg_recurring_fill_rrule on public.recurring_schedules;
create trigger trg_recurring_fill_rrule
  before insert or update on public.recurring_schedules
  for each row execute function public.recurring_schedules_fill_rrule();

-- 4. Approving the last occurrence closes the schedule.
drop function if exists public.whatsapp_approve_recurring(uuid, uuid, uuid, date, date, date, jsonb, text);

create or replace function public.whatsapp_approve_recurring(
  p_profile_id    uuid,
  p_household_id  uuid,
  p_schedule_id   uuid,
  p_occurrence    date,
  p_today         date,
  p_next_due      date,
  p_row           jsonb,
  p_wa_message_id text,
  -- W3d: the app's engine says this was the LAST occurrence (COUNT / UNTIL reached): the
  -- schedule is closed (active = false) instead of being moved to a date that never comes.
  p_exhausted     boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id  uuid;
  v_role       text;
  v_s          public.recurring_schedules%rowtype;
  v_t          jsonb;
  v_claimed    int;
  v_inserted   int;
  v_type       text;
  v_mode       text;
  v_paying     uuid;
begin
  -- 1. Claim the message, exactly as whatsapp_log_transaction does.
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
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- 2. A write role in this household.
  select id, role into v_member_id, v_role
    from public.memberships
   where household_id = p_household_id and user_id = p_profile_id
   limit 1;
  if v_member_id is null then
    return jsonb_build_object('status', 'error', 'reason', 'not_a_member');
  end if;
  if v_role = 'viewer' then
    return jsonb_build_object('status', 'error', 'reason', 'read_only_member');
  end if;

  -- 3. The schedule, locked, and this occurrence the one due.
  select * into v_s
    from public.recurring_schedules
   where id = p_schedule_id and household_id = p_household_id and deleted_at is null
   for update;
  if not found or not v_s.active then
    return jsonb_build_object('status', 'error', 'reason', 'schedule_unavailable');
  end if;
  v_t := v_s.txn_template;
  if v_s.next_due_date > p_occurrence then
    return jsonb_build_object('status', 'already_done', 'next_due_date', v_s.next_due_date);
  end if;
  if v_s.next_due_date < p_occurrence then
    return jsonb_build_object('status', 'error', 'reason', 'not_the_due_occurrence');
  end if;
  if p_occurrence > p_today then
    return jsonb_build_object('status', 'error', 'reason', 'not_due_yet');
  end if;
  if not coalesce(p_exhausted, false) and (p_next_due is null or p_next_due <= p_occurrence) then
    return jsonb_build_object('status', 'error', 'reason', 'bad_next_due');
  end if;

  v_type := v_t->>'type';
  if v_type not in ('expense', 'income') or coalesce(v_t->>'category', '') = 'loan_emi'
     or nullif(v_t->>'debtId', '') is not null then
    return jsonb_build_object('status', 'error', 'reason', 'approve_in_app');
  end if;

  -- 4. The row must be this occurrence of this template.
  if (p_row->>'recurring_schedule_id')::uuid is distinct from p_schedule_id
     or (p_row->>'household_id')::uuid is distinct from p_household_id
     or (p_row->>'date')::date is distinct from p_occurrence
     or p_row->>'type' is distinct from v_type
     or (p_row->>'amount')::numeric is distinct from (v_t->>'amount')::numeric
     or coalesce(p_row->>'currency', 'USD') is distinct from coalesce(nullif(v_t->>'currency', ''), 'USD') then
    return jsonb_build_object('status', 'error', 'reason', 'row_mismatch');
  end if;

  -- A mode the paying account does not use is dropped, never an error (the
  -- store's rule, and whatsapp_log_transaction's).
  v_mode := nullif(p_row->>'payment_mode', '');
  if v_mode is not null then
    v_paying := case when v_type = 'income' then nullif(p_row->>'to_account_id', '')::uuid
                     else nullif(p_row->>'account_id', '')::uuid end;
    if exists (select 1 from public.accounts a where a.id = v_paying
                 and coalesce(array_length(a.payment_modes, 1), 0) > 0
                 and not (v_mode = any (a.payment_modes))) then
      v_mode := null;
    end if;
  end if;

  -- 5. The app's own row, under the deterministic id.
  insert into public.transactions (
    id, household_id, created_by, member_id, type, amount, currency, date, description,
    category, note, recurring, account_id, to_account_id, initiated_by,
    recurring_schedule_id, debt_id, payment_mode, extras, confidence, source, estimated_at, confirmed_at
  ) values (
    (p_row->>'id')::uuid,
    p_household_id,
    p_profile_id,
    nullif(p_row->>'member_id', '')::uuid,
    v_type,
    (p_row->>'amount')::numeric,
    coalesce(nullif(p_row->>'currency', ''), 'USD'),
    p_occurrence,
    coalesce(p_row->>'description', ''),
    nullif(p_row->>'category', ''),
    nullif(p_row->>'note', ''),
    nullif(p_row->>'recurring', ''),
    nullif(p_row->>'account_id', '')::uuid,
    nullif(p_row->>'to_account_id', '')::uuid,
    nullif(p_row->>'initiated_by', '')::uuid,
    p_schedule_id,
    null,
    v_mode,
    coalesce(p_row->'extras', '{}'::jsonb),
    coalesce(nullif(p_row->>'confidence', ''), 'confirmed'),
    coalesce(nullif(p_row->>'source', ''), 'user'),
    nullif(p_row->>'estimated_at', '')::timestamptz,
    nullif(p_row->>'confirmed_at', '')::timestamptz
  )
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;

  -- 6. Move the schedule on.
  update public.recurring_schedules
     set last_generated = p_occurrence,
         next_due_date  = case when coalesce(p_exhausted, false) then next_due_date else p_next_due end,
         active         = not coalesce(p_exhausted, false)
   where id = p_schedule_id;

  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object(
           'approved', jsonb_build_object('schedule_id', p_schedule_id, 'occurrence', p_occurrence,
                                          'transaction_id', p_row->>'id', 'inserted', v_inserted = 1))
   where wa_message_id = p_wa_message_id;

  return jsonb_build_object(
    'status', 'success',
    'transaction_id', p_row->>'id',
    'already_posted', v_inserted = 0,
    'amount', (p_row->>'amount')::numeric,
    'currency', coalesce(nullif(p_row->>'currency', ''), 'USD'),
    'description', p_row->>'description',
    'next_due_date', case when coalesce(p_exhausted, false) then null else p_next_due end,
    'finished', coalesce(p_exhausted, false)
  );
end;
$$;

revoke all on function public.whatsapp_approve_recurring(uuid, uuid, uuid, date, date, date, jsonb, text, boolean) from public, anon, authenticated;
grant execute on function public.whatsapp_approve_recurring(uuid, uuid, uuid, date, date, date, jsonb, text, boolean) to service_role;
