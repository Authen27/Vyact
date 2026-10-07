-- W4a (v10.70.0) — the SERVER posts due bills (owner decision D16; audit INT-TXN-06, FE-SYN-02).
--
-- Until now every device ran the recurring engine on its own cached copy of the schedules and
-- posted whatever it thought was due. A device that had not yet pulled a pause, an edit or a
-- delete made on another device posted the bill anyway: money that should not have moved, moved.
--
-- Now, in cloud mode, an auto-approved bill is posted by the server from the database's own copy:
--   1. post_recurring_occurrence() — posts ONE due occurrence and moves the schedule on, in one
--      transaction, with the schedule row locked. The row and the next date are computed by the
--      APP's engine (bundled into the `recurring-post` Edge Function: serverEngine.recurringPostPlan,
--      the same generateTransaction → txnToRow → advanceSchedule the app runs), under the app's
--      deterministic occurrence id, so a device that still posts the same occurrence writes the
--      same row (ON CONFLICT DO NOTHING here; an upsert of identical values there).
--      The function re-checks everything it can on its own copy: the schedule is live, active and
--      auto-approved, the occurrence is the one due, it is due in the HOUSEHOLD's zone (D12), and
--      the row is that occurrence of that template. A pointer older than the catch-up horizon is
--      moved on without posting (p_post = false), as the app does.
--   2. Loan EMIs are NOT posted here: an EMI is an interest expense plus a principal transfer, and
--      the loan model that posts it (D19) is not built yet. The app keeps posting those.
--   3. pg_cron calls the function every 30 minutes (each household's day starts at its own
--      midnight), authenticated by a secret generated into Vault here; nobody handles it.
--
-- Approval-gated bills are unchanged: they wait for Approve in the app or "paid X" on WhatsApp.

create or replace function public.post_recurring_occurrence(
  p_schedule_id    uuid,
  p_occurrence     date,
  p_post           boolean,
  p_row            jsonb,
  p_next_due       date,
  p_last_generated date,
  p_exhausted      boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_s        public.recurring_schedules%rowtype;
  v_t        jsonb;
  v_today    date;
  v_type     text;
  v_mode     text;
  v_paying   uuid;
  v_inserted int := 0;
begin
  -- 1. The schedule, locked: nobody else moves it while this runs.
  select * into v_s
    from public.recurring_schedules
   where id = p_schedule_id and deleted_at is null
   for update;
  if not found then
    return jsonb_build_object('status', 'skipped', 'reason', 'schedule_unavailable');
  end if;
  if not v_s.active or not v_s.auto_confirm then
    return jsonb_build_object('status', 'skipped', 'reason', 'not_auto');
  end if;
  if v_s.next_due_date <> p_occurrence then
    return jsonb_build_object('status', 'skipped', 'reason', 'moved', 'next_due_date', v_s.next_due_date);
  end if;

  -- 2. Due in the household's own day (W3a, D12), never the server's.
  select (now() at time zone coalesce(nullif(h.timezone, ''), 'Asia/Kolkata'))::date into v_today
    from public.households h where h.id = v_s.household_id;
  if v_today is null then
    return jsonb_build_object('status', 'skipped', 'reason', 'household_unavailable');
  end if;
  if p_occurrence > v_today then
    return jsonb_build_object('status', 'skipped', 'reason', 'not_due_yet');
  end if;

  v_t := v_s.txn_template;
  v_type := v_t->>'type';
  if v_type not in ('expense', 'income', 'transfer', 'investment')
     or coalesce(v_t->>'category', '') = 'loan_emi'
     or nullif(v_t->>'debtId', '') is not null or nullif(v_t->>'linkedDebtId', '') is not null then
    return jsonb_build_object('status', 'skipped', 'reason', 'posted_in_app');
  end if;
  if not coalesce(p_exhausted, false) and (p_next_due is null or p_next_due <= p_occurrence) then
    return jsonb_build_object('status', 'error', 'reason', 'bad_next_due');
  end if;
  if p_last_generated is null or p_last_generated < p_occurrence then
    return jsonb_build_object('status', 'error', 'reason', 'bad_last_generated');
  end if;

  if coalesce(p_post, false) then
    -- 3. The row must be this occurrence of this template.
    if (p_row->>'recurring_schedule_id')::uuid is distinct from p_schedule_id
       or (p_row->>'household_id')::uuid is distinct from v_s.household_id
       or (p_row->>'date')::date is distinct from p_occurrence
       or p_row->>'type' is distinct from v_type
       or (p_row->>'amount')::numeric is distinct from (v_t->>'amount')::numeric then
      return jsonb_build_object('status', 'error', 'reason', 'row_mismatch');
    end if;

    -- A mode the paying account does not use is dropped, never an error (the store's rule).
    v_mode := nullif(p_row->>'payment_mode', '');
    if v_mode is not null then
      v_paying := case when v_type = 'income' then nullif(p_row->>'to_account_id', '')::uuid
                       else nullif(p_row->>'account_id', '')::uuid end;
      if v_type = 'investment' or exists (
           select 1 from public.accounts a where a.id = v_paying
              and coalesce(array_length(a.payment_modes, 1), 0) > 0
              and not (v_mode = any (a.payment_modes))) then
        v_mode := null;
      end if;
    end if;

    -- 4. The app's own row, under the deterministic id. A row the ledger refuses (a template
    --    with no account, say) is reported and the schedule is left due, never half-applied.
    begin
      insert into public.transactions (
        id, household_id, created_by, member_id, type, amount, currency, date, description,
        category, note, recurring, account_id, to_account_id, asset_id, initiated_by,
        recurring_schedule_id, debt_id, payment_mode, extras, confidence, source, estimated_at, confirmed_at
      ) values (
        (p_row->>'id')::uuid,
        v_s.household_id,
        v_s.created_by,
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
        nullif(p_row->>'asset_id', '')::uuid,
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
    exception when check_violation or foreign_key_violation or not_null_violation or invalid_text_representation then
      return jsonb_build_object('status', 'error', 'reason', 'row_rejected', 'detail', sqlerrm);
    end;
  end if;

  -- 5. Move the schedule on (or close it when its rule has run out).
  update public.recurring_schedules
     set last_generated = p_last_generated,
         next_due_date  = case when coalesce(p_exhausted, false) then next_due_date else p_next_due end,
         active         = not coalesce(p_exhausted, false)
   where id = p_schedule_id;

  return jsonb_build_object(
    'status', case when coalesce(p_post, false) then 'posted' else 'fast_forwarded' end,
    'transaction_id', case when coalesce(p_post, false) then p_row->>'id' end,
    'already_posted', coalesce(p_post, false) and v_inserted = 0,
    'next_due_date', case when coalesce(p_exhausted, false) then null else p_next_due end,
    'finished', coalesce(p_exhausted, false)
  );
end;
$$;

revoke all on function public.post_recurring_occurrence(uuid, date, boolean, jsonb, date, date, boolean) from public, anon, authenticated;
grant execute on function public.post_recurring_occurrence(uuid, date, boolean, jsonb, date, date, boolean) to service_role;

-- The cron secret check (plpgsql: its body is resolved at call time, not here).
create or replace function public.recurring_post_cron_ok(p text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return length(coalesce(p, '')) >= 32
     and exists (select 1 from vault.decrypted_secrets s where s.name = 'recurring_post_cron_secret' and s.decrypted_secret = p);
end;
$$;
revoke all on function public.recurring_post_cron_ok(text) from public, anon, authenticated;
grant execute on function public.recurring_post_cron_ok(text) to service_role;

-- The secret (generated here; it never leaves the database and the function) and the job.
do $$
begin
  -- Nested, so a database without Vault (the PGlite tests) never plans the inner query.
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    if not exists (select 1 from vault.secrets where name = 'recurring_post_cron_secret') then
      perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'recurring_post_cron_secret',
                                  'pg_cron -> recurring-post');
    end if;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'recurring-post';
    -- Every 30 minutes, so each household's bills post shortly after ITS midnight.
    perform cron.schedule('recurring-post', '10,40 * * * *', $job$
      select net.http_post(
        url     := 'https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/recurring-post',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.decrypted_secret),
        body    := '{}'::jsonb,
        timeout_milliseconds := 55000)
      from vault.decrypted_secrets s where s.name = 'recurring_post_cron_secret';
    $job$);
  end if;
end;
$$;
