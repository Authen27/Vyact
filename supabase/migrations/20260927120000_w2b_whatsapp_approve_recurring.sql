-- ============================================================================
-- v10.43.0 (W2b) — "paid Rent" on WhatsApp approves the due bill, atomically.
--
-- The bill reminder says: Reply "paid Rent" to log it. Doing that by logging a
-- plain transaction would leave the recurring schedule due, and the app would ask
-- for the same bill again — a double count. So the reply does what Approve does in
-- the app (`approveRecurring`), in ONE transaction:
--   1. claim the inbound message (a replay comes back 'duplicate');
--   2. check the approver holds a write role in the household;
--   3. lock the schedule and check THIS occurrence is the one due, and is due
--      today or earlier (the app never approves early);
--   4. check the row the Edge Function built matches the locked template
--      (type, amount, currency, date, schedule) — the service computes the row with
--      the parity-tested port, the database refuses one that disagrees;
--   5. insert it under the deterministic occurrence id (the app would use the same
--      id, so if the app already posted it, nothing is inserted twice);
--   6. advance the schedule.
-- Loan EMIs, transfers and investments are refused ('approve_in_app'): the app
-- posts an EMI through the loan-payment split, never as a plain expense.
--
-- Service role only. MONEY MODEL: the row is exactly the app's own row for this
-- occurrence; nothing here computes an amount.
-- ============================================================================

create or replace function public.whatsapp_approve_recurring(
  p_profile_id    uuid,
  p_household_id  uuid,
  p_schedule_id   uuid,
  p_occurrence    date,
  p_today         date,
  p_next_due      date,
  p_row           jsonb,
  p_wa_message_id text
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
  if p_next_due is null or p_next_due <= p_occurrence then
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
     set last_generated = p_occurrence, next_due_date = p_next_due
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
    'next_due_date', p_next_due
  );
end;
$$;

revoke all on function public.whatsapp_approve_recurring(uuid, uuid, uuid, date, date, date, jsonb, text) from public, anon, authenticated;
grant execute on function public.whatsapp_approve_recurring(uuid, uuid, uuid, date, date, date, jsonb, text) to service_role;

-- Daily at 09:00 IST (03:30 UTC): bill reminders for approval schedules due today.
-- Inert until whatsapp_dispatch_secret exists, like the other dispatch jobs.
select cron.schedule('whatsapp-dispatch-bills', '30 3 * * *', $job$
  select net.http_post(
    url     := 'https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-dispatch?job=bills',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000)
  from vault.decrypted_secrets s where s.name = 'whatsapp_dispatch_secret';
$job$);
