-- v10.132.0 — Track Q, part 4: every scheduled job leaves a record, and the owner is told when one stops.
-- Audit OPS-06, DB-OPS-08 (owner decision D9, 20 Oct 2026: "job_runs, a Health page, an email when a job fails or
-- misses").
--
-- Eleven pg_cron jobs do Vyact's server work. A run's answer lived only in net._http_response, which pg_net keeps for
-- about 6 hours, so "nothing to send" and "broken" looked the same, and nobody was told when a job stopped running.
--
--   1. job_runs: one row per run of each job: when it started and finished, how it ended (ok · partial · failed),
--      what it did (counts only, never a household's data) and the error. The Edge jobs record their own runs
--      (`_shared/jobRuns.ts` → record_job_run); the two SQL jobs now run through wrappers that do. Kept 30 days.
--   2. job_health(): each job Vyact schedules (job_expectations) against its cadence: the latest run, runs and
--      failures in 24 hours, and the problem, if any: failed (the latest run), partial (the latest two), late (no
--      run for two of its intervals). admin_job_health() / admin_job_runs() are the admin Health page's reads
--      (roles tier). A job only ever late, never recorded, counts from the first run recorded anywhere.
--   3. job-health (pg_cron, hourly, the T5d form) asks the `job-health` Edge Function to email the owner
--      (HEALTH_ALERT_EMAIL) about the problems; claim_job_alert keeps it to one email per job and problem a day.
--
-- MONEY MODEL: untouched. The wrappers call the same functions; a run that fails rolls its own writes back, as
-- before, and is recorded as failed.

begin;

-- ── 1. job_runs ───────────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.job_runs (
  id          bigint generated always as identity primary key,
  job         text not null check (job ~ '^[a-z0-9-]{1,64}$'),
  started_at  timestamptz not null,
  finished_at timestamptz not null default now(),
  status      text not null check (status in ('ok', 'partial', 'failed')),
  summary     jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object'),
  error       text check (char_length(error) <= 500)
);
create index if not exists ix_job_runs_job_started on public.job_runs (job, started_at desc);
create index if not exists ix_job_runs_started on public.job_runs (started_at);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from public, anon, authenticated;
comment on table public.job_runs is
  'Q4 (v10.132.0, OPS-06): one row per scheduled job run (counts only). Server-only; read by job_health(). Kept 30 days (run_retention).';

-- One email per job and problem a day (claim first, as split and invite emails are).
create table if not exists public.job_alerts (
  job          text not null,
  kind         text not null check (kind in ('failed', 'partial', 'late')),
  last_sent_at timestamptz not null default now(),
  primary key (job, kind)
);
alter table public.job_alerts enable row level security;
revoke all on public.job_alerts from public, anon, authenticated;

create or replace function public.record_job_run(p_job text, p_started_at timestamptz, p_status text,
                                                 p_summary jsonb default '{}'::jsonb, p_error text default null)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  insert into job_runs (job, started_at, finished_at, status, summary, error)
  values (p_job, coalesce(p_started_at, now()), clock_timestamp(), p_status,
          -- A summary is a few counts; anything else (or anything large) is not kept.
          case when jsonb_typeof(p_summary) = 'object' and pg_column_size(p_summary) <= 4096 then p_summary else '{}'::jsonb end,
          left(nullif(btrim(p_error), ''), 500))
  returning id into v_id;
  return v_id;
end;
$$;

-- ── The two SQL jobs record their runs ──────────────────────────────────────────────────────────────────────
create or replace function public.run_loan_auto_record()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_result jsonb;
begin
  begin
    v_result := public.auto_record_due_emis();
  exception when others then
    -- The block's writes are rolled back (as a failed run's always were); the failure is kept.
    perform public.record_job_run('loan-auto-record', v_started, 'failed', '{}'::jsonb, sqlerrm);
    return jsonb_build_object('status', 'failed');
  end;
  perform public.record_job_run('loan-auto-record', v_started,
    case when coalesce((v_result->>'errors')::int, 0) > 0 then 'partial' else 'ok' end, v_result, null);
  return v_result;
end;
$$;

create or replace function public.run_retention()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_started timestamptz := clock_timestamp();
  v_result jsonb;
  v_runs int;
begin
  begin
    v_result := public.purge_old_whatsapp_messages(90);
    delete from job_runs where started_at < now() - interval '30 days';
    get diagnostics v_runs = row_count;
  exception when others then
    perform public.record_job_run('whatsapp-retention', v_started, 'failed', '{}'::jsonb, sqlerrm);
    return jsonb_build_object('status', 'failed');
  end;
  v_result := v_result || jsonb_build_object('job_runs', v_runs);
  perform public.record_job_run('whatsapp-retention', v_started, 'ok', v_result, null);
  return v_result;
end;
$$;

-- ── 2. Health ─────────────────────────────────────────────────────────────────────────────────────────────────
-- Every job Vyact schedules and how often it runs. migrationReplaySql (Q4-RP-007) fails when cron.job and this
-- list disagree, so a new job is watched from the day it ships.
create or replace function public.job_expectations()
returns table (job text, every_minutes int)
language sql
immutable
set search_path = public, pg_temp
as $$
  select * from (values
    ('job-health', 60), ('loan-auto-record', 30), ('recurring-post', 30), ('web-push-dispatch', 15),
    ('whatsapp-dispatch-alerts', 15), ('whatsapp-dispatch-bills', 30), ('whatsapp-dispatch-digest', 30),
    ('whatsapp-dispatch-monthly', 30), ('whatsapp-dispatch-weekly', 30), ('whatsapp-inbox-sweep', 5),
    ('whatsapp-retention', 1440)
  ) as t(job, every_minutes);
$$;

create or replace function public.job_health()
returns table (job text, every_minutes int, last_started_at timestamptz, last_finished_at timestamptz,
               last_status text, last_summary jsonb, last_error text, runs_24h int, failed_24h int, problem text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with watch as (select min(r.started_at) as since from job_runs r),
  latest as (
    select e.job, e.every_minutes, l1.started_at, l1.finished_at, l1.status, l1.summary, l1.error, l2.status as prev_status,
           (select count(*)::int from job_runs r where r.job = e.job and r.started_at > now() - interval '24 hours') as runs_24h,
           (select count(*)::int from job_runs r
             where r.job = e.job and r.started_at > now() - interval '24 hours' and r.status = 'failed') as failed_24h
      from job_expectations() e
      left join lateral (select r.* from job_runs r where r.job = e.job order by r.started_at desc limit 1) l1 on true
      left join lateral (select r.status from job_runs r where r.job = e.job order by r.started_at desc offset 1 limit 1) l2 on true
  )
  select l.job, l.every_minutes, l.started_at, l.finished_at, l.status, l.summary, l.error, l.runs_24h, l.failed_24h,
         case
           -- Two of its intervals (and 10 minutes' grace) with no run. A job never recorded counts from the first
           -- run recorded anywhere, so nothing is late before recording starts.
           when coalesce(l.started_at, w.since) < now() - make_interval(mins => 2 * l.every_minutes + 10) then 'late'
           when l.status = 'failed' then 'failed'
           when l.status = 'partial' and l.prev_status = 'partial' then 'partial'
         end
    from latest l cross join watch w
   order by l.job;
$$;

create or replace function public.admin_job_health()
returns table (job text, every_minutes int, last_started_at timestamptz, last_finished_at timestamptz,
               last_status text, last_summary jsonb, last_error text, runs_24h int, failed_24h int, problem text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin('roles') then
    raise exception 'forbidden: admin role required' using errcode = '42501';
  end if;
  return query select * from public.job_health();
end;
$$;

create or replace function public.admin_job_runs(p_job text, p_limit int default 20)
returns table (id bigint, job text, started_at timestamptz, finished_at timestamptz, status text, summary jsonb, error text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin('roles') then
    raise exception 'forbidden: admin role required' using errcode = '42501';
  end if;
  return query
    select r.id, r.job, r.started_at, r.finished_at, r.status, r.summary, r.error
      from public.job_runs r
     where r.job = p_job
     order by r.started_at desc
     limit greatest(1, least(coalesce(p_limit, 20), 100));
end;
$$;

-- ── 3. The alert ──────────────────────────────────────────────────────────────────────────────────────────────
-- True when this run may email about (job, kind): nothing was sent about it in the last p_hours.
create or replace function public.claim_job_alert(p_job text, p_kind text, p_hours int default 24)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_claimed boolean;
begin
  insert into job_alerts as a (job, kind, last_sent_at) values (p_job, p_kind, now())
  on conflict (job, kind) do update set last_sent_at = excluded.last_sent_at
    where a.last_sent_at < now() - make_interval(hours => greatest(1, coalesce(p_hours, 24)))
  returning true into v_claimed;
  return coalesce(v_claimed, false);
end;
$$;

-- An email that could not be sent gives its claim back, so the next hourly check tries again.
create or replace function public.release_job_alert(p_job text, p_kind text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from job_alerts where job = p_job and kind = p_kind;
$$;

create or replace function public.job_health_cron_ok(p text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return length(coalesce(p, '')) >= 32
     and exists (select 1 from vault.decrypted_secrets s where s.name = 'job_health_cron_secret' and s.decrypted_secret = p);
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'record_job_run(text,timestamptz,text,jsonb,text)', 'run_loan_auto_record()', 'run_retention()',
    'job_expectations()', 'job_health()', 'claim_job_alert(text,text,integer)', 'release_job_alert(text,text)',
    'job_health_cron_ok(text)', 'admin_job_health()', 'admin_job_runs(text,integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end;
$$;
-- The Health page's reads check the staff tier themselves.
grant execute on function public.admin_job_health() to authenticated;
grant execute on function public.admin_job_runs(text, integer) to authenticated;

-- ── The jobs ──────────────────────────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- Nested, so a database without Vault never plans the inner query.
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    if not exists (select 1 from vault.secrets where name = 'job_health_cron_secret') then
      perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'job_health_cron_secret',
                                  'pg_cron -> job-health');
    end if;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'cron') then
    -- The SQL jobs run through their recording wrappers.
    perform cron.alter_job(c.jobid, command := 'select public.run_loan_auto_record()')
       from cron.job c where c.jobname = 'loan-auto-record';
    perform cron.alter_job(c.jobid, command := 'select public.run_retention()')
       from cron.job c where c.jobname = 'whatsapp-retention';
    -- The hourly check, in the T5d form: this project's own URL from Vault, or no call.
    perform cron.unschedule(c.jobid) from cron.job c where c.jobname = 'job-health';
    perform cron.schedule('job-health', '55 * * * *', $job$
  select net.http_post(
    url     := u.decrypted_secret || '/functions/v1/job-health',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000)
  from vault.decrypted_secrets s, vault.decrypted_secrets u
  where s.name = 'job_health_cron_secret' and u.name = 'project_url';
$job$);
  end if;
end;
$$;

commit;
