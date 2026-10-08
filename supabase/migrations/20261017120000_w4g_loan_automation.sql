-- W4g (v10.76.0) — loans run themselves (owner decision D19; audit BE-WA-08, INT-TXN-07).
--
--   1. whatsapp_pay_loan — "paid car EMI 15000" on WhatsApp pays the loan's due instalment through
--      loan_payment_core (the server's split: interest first, then principal). Before, the parser
--      called it a Loan / EMI expense and whatsapp_log_transaction booked the WHOLE EMI as spending,
--      never touching the loan. The message is claimed first, so a replay never pays twice; a refusal
--      (more than due, paid off, no account to pay from) comes back with its figure for the reply.
--   2. auto_record_due_emis — a loan with auto_record on has each EMI recorded ON ITS DATE (in the
--      household's zone, W3a) from its funding account, by pg_cron every 30 minutes. The operation id
--      is the loan + instalment, so a second run never records it twice. A loan whose funding account
--      is gone is skipped and counted, never half-recorded.
--   3. EMI recurring schedules move onto their loan: the loan takes the schedule's auto-approve and
--      its paying account, and the schedule is closed. (An EMI schedule posted the whole EMI as one
--      expense; the app stopped posting them in v10.75.0.) A schedule naming no live loan is left for
--      the app to flag.
--   4. record_loan_payment is dropped: the app stopped calling it in v10.75.0 (pay_loan replaced it).

-- ── 1. Paying a loan from WhatsApp ─────────────────────────────────────────────────────────
create or replace function public.whatsapp_pay_loan(
  p_profile_id    uuid,
  p_household_id  uuid,
  p_debt_id       uuid,
  p_amount        numeric,
  p_date          date,
  p_wa_message_id text,
  p_account_alias text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member  uuid;
  v_role    text;
  v_claimed int;
  d         public.debts%rowtype;
  v_funding uuid;
  v_result  jsonb;
  v_code    text;
  v_detail  text;
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
  if v_claimed = 0 then return jsonb_build_object('status', 'duplicate'); end if;

  -- 2. A write role in this household.
  select id, role into v_member, v_role from public.memberships
   where household_id = p_household_id and user_id = p_profile_id limit 1;
  if v_member is null then return jsonb_build_object('status', 'error', 'reason', 'not_a_member'); end if;
  if v_role = 'viewer' then return jsonb_build_object('status', 'error', 'reason', 'read_only_member'); end if;

  select * into d from public.debts where id = p_debt_id and household_id = p_household_id and deleted_at is null;
  if not found then return jsonb_build_object('status', 'error', 'reason', 'debt_unavailable'); end if;

  -- 3. The account it was paid from: the one named, else the loan's own, else the household default.
  if nullif(btrim(p_account_alias), '') is not null then
    select id into v_funding from public.accounts
     where household_id = p_household_id and kind in ('bank', 'cash') and deleted_at is null and not is_archived
       and lower(name) like '%' || lower(btrim(p_account_alias)) || '%'
     order by is_default desc, created_at limit 1;
  end if;
  v_funding := coalesce(v_funding,
    (select id from public.accounts where id = d.funding_account_id and kind in ('bank', 'cash') and deleted_at is null and not is_archived),
    (select id from public.accounts where household_id = p_household_id and kind in ('bank', 'cash') and deleted_at is null
        and not is_archived order by is_default desc, (kind = 'bank') desc, created_at limit 1));

  -- 4. The server's split. A refusal is an answer, not a failure: the message stays claimed.
  begin
    v_result := public.loan_payment_core(p_profile_id, md5('wa-loan:' || p_wa_message_id)::uuid, d.id, 'emi',
      p_amount, coalesce(p_date, (now() at time zone 'Asia/Kolkata')::date), v_funding, v_member, null, null, null, null);
  exception when sqlstate '22023' or sqlstate '42501' then
    get stacked diagnostics v_code = message_text, v_detail = pg_exception_detail;
    return jsonb_build_object('status', 'refused', 'reason', v_code, 'figure', nullif(v_detail, ''),
      'loan', d.name);
  end;

  update public.whatsapp_inbound_messages
     set payload = coalesce(payload, '{}'::jsonb) || jsonb_build_object('loan_payment',
           jsonb_build_object('debt_id', d.id, 'operation_id', v_result->>'operation_id'))
   where wa_message_id = p_wa_message_id;
  return v_result || jsonb_build_object('loan', d.name);
end;
$$;

revoke all on function public.whatsapp_pay_loan(uuid, uuid, uuid, numeric, date, text, text) from public, anon, authenticated;
grant execute on function public.whatsapp_pay_loan(uuid, uuid, uuid, numeric, date, text, text) to service_role;

-- ── 2. EMIs recorded on their date ─────────────────────────────────────────────────────────
create or replace function public.auto_record_due_emis(p_limit integer default 500)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d        record;
  cur      public.debts%rowtype;
  s        record;
  v_actor  uuid;
  v_today  date;
  v_scale  integer;
  v_owed   numeric;
  v_left   numeric;
  v_posted integer := 0;
  v_errors integer := 0;
  v_steps  integer;
begin
  for d in
    select x.id, x.household_id, coalesce(nullif(h.timezone, ''), 'Asia/Kolkata') as tz, h.base_currency
      from public.debts x join public.households h on h.id = x.household_id
     where x.deleted_at is null and x.auto_record and x.paid_off_at is null
       and coalesce(x.direction, 'owed_by_me') = 'owed_by_me' and x.due_date is not null
       and x.due_date <= (now() at time zone coalesce(nullif(h.timezone, ''), 'Asia/Kolkata'))::date
     order by x.due_date
     limit greatest(1, p_limit)
  loop
    v_today := (now() at time zone d.tz)::date;
    v_scale := public.loan_minor_scale(d.base_currency);
    -- Recorded as the household's owner (the person who answers for its books).
    select user_id into v_actor from public.memberships
     where household_id = d.household_id and role = 'owner' and user_id is not null order by joined_at limit 1;
    if v_actor is null then v_errors := v_errors + 1; continue; end if;
    v_steps := 0;
    -- A loan a few EMIs behind catches up, one instalment at a time (bounded).
    loop
      select * into cur from public.debts where id = d.id;
      exit when not cur.auto_record or cur.paid_off_at is not null or cur.due_date is null or cur.due_date > v_today or v_steps >= 6;
      v_owed := public.loan_outstanding(cur);
      exit when v_owed <= 0;
      select * into s from public.loan_instalment_state(cur, v_owed, v_scale, cur.due_date);
      v_left := greatest(s.due - s.paid, 0);
      exit when v_left <= 0;
      begin
        perform public.loan_payment_core(v_actor, md5('auto-emi:' || cur.id || ':' || s.instalment_no)::uuid, cur.id, 'emi',
          v_left, cur.due_date, cur.funding_account_id, null, cur.name || ' EMI', null, null, null);
        v_posted := v_posted + 1;
      exception when others then
        v_errors := v_errors + 1;
        exit;
      end;
      v_steps := v_steps + 1;
    end loop;
  end loop;
  return jsonb_build_object('posted', v_posted, 'errors', v_errors);
end;
$$;

revoke all on function public.auto_record_due_emis(integer) from public, anon, authenticated;
grant execute on function public.auto_record_due_emis(integer) to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'loan-auto-record';
    perform cron.schedule('loan-auto-record', '20,50 * * * *', 'select public.auto_record_due_emis()');
  end if;
end;
$$;

-- ── 3. EMI schedules move onto their loan ─────────────────────────────────────────────────
with emi as (
  select r.id, r.active, r.auto_confirm, r.txn_template->>'accountId' as account_text,
         coalesce(nullif(r.txn_template->>'linkedDebtId', ''), nullif(r.txn_template->>'debtId', '')) as debt_text
    from public.recurring_schedules r
   where r.deleted_at is null and r.txn_template->>'category' = 'loan_emi'
), resolved as (
  select e.*, d.id as debt_id, d.household_id
    from emi e join public.debts d
      on e.debt_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and d.id = e.debt_text::uuid and d.deleted_at is null and coalesce(d.direction, 'owed_by_me') = 'owed_by_me'
), moved as (
  update public.debts d
     set auto_record = d.auto_record or (r.active and r.auto_confirm),
         funding_account_id = coalesce(d.funding_account_id, (
           select a.id from public.accounts a
            where r.account_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              and a.id = r.account_text::uuid and a.household_id = d.household_id
              and a.kind in ('bank', 'cash') and a.deleted_at is null and not a.is_archived)),
         updated_at = now()
    from resolved r
   where d.id = r.debt_id
  returning d.id
)
-- Every resolved schedule closes (two schedules for one loan included); the loan update above runs once.
update public.recurring_schedules set deleted_at = now(), active = false, updated_at = now()
 where id in (select id from resolved) and exists (select 1 from moved);

-- ── 4. The client-computed payment command is gone ────────────────────────────────────────
drop function if exists public.record_loan_payment(uuid, uuid, uuid, numeric, text, date, numeric, numeric, uuid, text, numeric, integer, numeric, jsonb);
