-- ============================================================================
-- v10.47.0 (W6b) — senders for the approved templates that had none, and the
-- replies their buttons promise (the "Template button replies" board).
--
--   1. `whatsapp_rule_state`: the last value a rule saw (the runway baseline), so a
--      runway note fires only on a real change and at most once a month.
--   2. `whatsapp_split_share_recipients`: shares created since a time, with the
--      linked WhatsApp identity of the person they were shared with (by the
--      participant's verified sign-in email, the same key shared splits use).
--   3. `whatsapp_split_even`: "Split 50/50" on partner_split_prompt. Writes the
--      SAME two things the app's split form writes: the transaction's
--      extras.split (only yourShare then counts, INV money model) and the
--      shared_splits + shared_split_shares rows the partner sees.
--   4. `whatsapp_undo_recurring_post`: "Undo" on recurring_auto_logged — removes
--      that posted entry (a soft delete, like deleting it in the app). The
--      schedule stays advanced, as the board says: "The schedule stays on for
--      next month." The 15-minute window is checked by the webhook against the
--      message it answers.
--   5. `whatsapp_pause_schedule`: "Pause this one" — the schedule's active flag,
--      exactly the app's pause.
--   6. Two scheduler jobs: the evening digest (20:30 IST) and a daily 09:10 IST
--      pass for the month close (the 1st), budget set-up (two days before a month)
--      and the runway check.
--
-- All writers claim the message first (a replay is silent) and need a write role.
-- Service role only.
-- ============================================================================

BEGIN;

create table if not exists public.whatsapp_rule_state (
  household_id uuid not null references public.households(id) on delete cascade,
  rule         text not null,
  value        numeric,
  detail       jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (household_id, rule)
);
alter table public.whatsapp_rule_state enable row level security;
revoke all on public.whatsapp_rule_state from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_rule_state to service_role;

-- ── 2. Shares created since a time, with the recipient's linked number ──────
create or replace function public.whatsapp_split_share_recipients(p_since timestamptz)
returns table (
  share_id uuid, share numeric, split_id uuid, description text, currency text, total_amount numeric,
  owner_user_id uuid, recipient_profile_id uuid, recipient_household_id uuid
)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select sh.id, sh.share, sp.id, sp.description, sp.currency::text, sp.total_amount,
         sp.owner_user_id, i.profile_id, i.household_id
    from public.shared_split_shares sh
    join public.shared_splits sp on sp.id = sh.split_id and sp.closed_at is null
    join auth.users u on lower(u.email) = lower(sh.email)
    join public.whatsapp_identities i on i.profile_id = u.id
   where sh.created_at > p_since
     and not sh.paid
     and i.profile_id <> sp.owner_user_id;
$$;

-- ── 3. Split 50/50 from the chat ────────────────────────────────────────────
create or replace function public.whatsapp_split_even(
  p_profile_id uuid, p_household_id uuid, p_wa_message_id text,
  p_txn_id uuid, p_partner_email text, p_split jsonb, p_partner_share numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_block text; t record; v_split uuid;
begin
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;

  select x.id, x.type, x.amount, x.currency, x.date, x.description, x.created_by, x.deleted_at, x.extras
    into t from public.transactions x
   where x.id = p_txn_id and x.household_id = p_household_id for update;
  if not found or t.deleted_at is not null then return jsonb_build_object('status', 'gone'); end if;
  if t.type <> 'expense' then return jsonb_build_object('status', 'not_expense'); end if;
  if t.created_by is distinct from p_profile_id then return jsonb_build_object('status', 'not_yours'); end if;
  if t.extras ? 'split' or exists (select 1 from public.shared_splits s where s.txn_id = t.id) then
    return jsonb_build_object('status', 'already_split');
  end if;
  -- The caller built the split from this row; refuse a mismatch rather than store it.
  if round((p_split->>'totalAmount')::numeric, 2) <> round(t.amount, 2)
     or round((p_split->>'yourShare')::numeric + p_partner_share, 2) <> round(t.amount, 2) then
    return jsonb_build_object('status', 'bad_request');
  end if;

  update public.transactions
     set extras = coalesce(extras, '{}'::jsonb) || jsonb_build_object('split', p_split)
   where id = t.id;
  insert into public.shared_splits (owner_user_id, owner_household_id, txn_id, description, currency, total_amount, txn_type, date)
    values (p_profile_id, p_household_id, t.id, t.description, t.currency, t.amount, 'expense', t.date)
    returning id into v_split;
  insert into public.shared_split_shares (split_id, email, share)
    values (v_split, lower(trim(p_partner_email)), p_partner_share);
  return jsonb_build_object('status', 'split', 'split_id', v_split, 'description', t.description,
    'currency', t.currency, 'your_share', (p_split->>'yourShare')::numeric, 'partner_share', p_partner_share);
end;
$$;

-- The person someone splits with most often (their "usual split partner"), with a
-- first name when that email belongs to a Vyact account. Null when they have never
-- shared a split: the prompt is then not sent.
create or replace function public.whatsapp_usual_split_partner(p_profile_id uuid)
returns table (email text, first_name text, times int)
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select lower(sh.email) as email,
         nullif(split_part(trim(coalesce(max(p.display_name), '')), ' ', 1), '') as first_name,
         count(*)::int as times
    from public.shared_splits sp
    join public.shared_split_shares sh on sh.split_id = sp.id
    left join auth.users u on lower(u.email) = lower(sh.email)
    left join public.profiles p on p.id = u.id
   where sp.owner_user_id = p_profile_id
   group by lower(sh.email)
   order by count(*) desc, max(sp.created_at) desc
   limit 1;
$$;

-- ── 4. Undo a recurring post ────────────────────────────────────────────────
create or replace function public.whatsapp_undo_recurring_post(
  p_profile_id uuid, p_household_id uuid, p_wa_message_id text, p_txn_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_block text; t record;
begin
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  select x.id, x.amount, x.currency, x.date, x.description, x.recurring_schedule_id, x.deleted_at, x.created_at, x.updated_at
    into t from public.transactions x
   where x.id = p_txn_id and x.household_id = p_household_id for update;
  if not found or t.deleted_at is not null then return jsonb_build_object('status', 'gone'); end if;
  if t.recurring_schedule_id is null then return jsonb_build_object('status', 'not_scheduled'); end if;
  -- Edited in the app since it posted: that edit is the person's; leave it.
  if t.updated_at > t.created_at + interval '5 seconds' then return jsonb_build_object('status', 'edited'); end if;
  update public.transactions set deleted_at = now() where id = t.id;
  return jsonb_build_object('status', 'undone', 'description', t.description, 'amount', t.amount,
    'currency', t.currency, 'date', t.date);
end;
$$;

-- ── 5. Pause a schedule ─────────────────────────────────────────────────────
create or replace function public.whatsapp_pause_schedule(
  p_profile_id uuid, p_household_id uuid, p_wa_message_id text, p_schedule_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_block text; s record;
begin
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  select x.id, x.active, x.deleted_at, x.txn_template into s from public.recurring_schedules x
   where x.id = p_schedule_id and x.household_id = p_household_id for update;
  if not found or s.deleted_at is not null then return jsonb_build_object('status', 'gone'); end if;
  if s.active then update public.recurring_schedules set active = false where id = s.id; end if;
  return jsonb_build_object('status', case when s.active then 'paused' else 'already_paused' end,
    'name', coalesce(nullif(s.txn_template->>'description', ''), 'that schedule'));
end;
$$;

revoke all on function public.whatsapp_split_share_recipients(timestamptz) from public, anon, authenticated;
revoke all on function public.whatsapp_usual_split_partner(uuid) from public, anon, authenticated;
revoke all on function public.whatsapp_split_even(uuid, uuid, text, uuid, text, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.whatsapp_undo_recurring_post(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.whatsapp_pause_schedule(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.whatsapp_split_share_recipients(timestamptz) to service_role;
grant execute on function public.whatsapp_usual_split_partner(uuid) to service_role;
grant execute on function public.whatsapp_split_even(uuid, uuid, text, uuid, text, jsonb, numeric) to service_role;
grant execute on function public.whatsapp_undo_recurring_post(uuid, uuid, text, uuid) to service_role;
grant execute on function public.whatsapp_pause_schedule(uuid, uuid, text, uuid) to service_role;

-- ── 6. Scheduler jobs (inert until the Vault secret exists, like the others) ──
select cron.unschedule(jobid) from cron.job where jobname in ('whatsapp-dispatch-digest', 'whatsapp-dispatch-monthly');

-- 20:30 IST (15:00 UTC): the evening household digest.
select cron.schedule('whatsapp-dispatch-digest', '0 15 * * *', $job$
  select net.http_post(
    url     := 'https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-dispatch?job=digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000)
  from vault.decrypted_secrets s where s.name = 'whatsapp_dispatch_secret';
$job$);

-- 09:10 IST (03:40 UTC) daily: month close (the 1st), budget set-up (two days before a
-- month), and the runway check (at most one note a month).
select cron.schedule('whatsapp-dispatch-monthly', '40 3 * * *', $job$
  select net.http_post(
    url     := 'https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-dispatch?job=monthly',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-dispatch-secret', s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000)
  from vault.decrypted_secrets s where s.name = 'whatsapp_dispatch_secret';
$job$);

COMMIT;
