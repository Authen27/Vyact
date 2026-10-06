-- W1b (audit 2026-10-04, D26) — run the 90-day WhatsApp retention every day at 02:40 UTC
-- (08:10 IST, after the overnight jobs). Kept apart from the function so the function can be
-- tested without pg_cron.

create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'whatsapp-retention';
select cron.schedule('whatsapp-retention', '40 2 * * *', $job$
  select public.purge_old_whatsapp_messages(90);
$job$);
