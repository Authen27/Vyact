-- T5d (v10.123.0; audit DB-OPS-07, BE-FN-11; owner, 19 Oct 2026: "Deploy writes it").
--
-- Every scheduled job that calls an Edge Function named the PRODUCTION host in its command
-- (https://dmxqkvploojokffuhxnz.supabase.co/...). A database restored from these migrations, such as
-- vyact-test, generated its own cron secrets and then called production with them every few minutes
-- (production refused them, so nothing ran, but every call left a 403 in its logs and nothing in the test
-- project ever ran its jobs).
--
-- Each project now stores its own base URL in Vault as `project_url`, written by its deploy workflow
-- (deploy.yml for production, deploy-test-functions.yml for vyact-test) through set_project_url() below.
-- Every job builds its URL from it. A database with no `project_url` calls nothing: the job's query
-- finds no row, so net.http_post is never reached.
--
-- The eight jobs, each keeping its schedule, header and secret:
--   whatsapp-dispatch-alerts / -weekly / -bills / -digest / -monthly   x-dispatch-secret  whatsapp_dispatch_secret
--   web-push-dispatch                                                  x-cron-secret      web_push_cron_secret
--   recurring-post                                                     x-cron-secret      recurring_post_cron_secret
--   whatsapp-inbox-sweep                                               x-cron-secret      whatsapp_sweep_cron_secret
-- (whatsapp-retention and loan-auto-record run SQL only and call no URL.)

-- ── set_project_url: the one writer of `project_url` ────────────────────────────────────────────────
-- Only a Supabase project URL is accepted, so a typo can't point every job somewhere else. Not callable
-- from the app (anon / authenticated); the deploy workflows call it through the Management API.
create or replace function public.set_project_url(p_url text)
  returns text language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_url text := rtrim(trim(p_url), '/');
        v_id uuid;
begin
  if v_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' then
    raise exception 'project_url_invalid' using errcode = '22023',
      detail = 'Expected https://<20-character project ref>.supabase.co';
  end if;
  select id into v_id from vault.secrets where name = 'project_url';
  if v_id is null then
    perform vault.create_secret(v_url, 'project_url', 'This project''s base URL: pg_cron jobs call its Edge Functions (T5d)');
  else
    perform vault.update_secret(v_id, v_url);
  end if;
  return v_url;
end;
$$;
revoke all on function public.set_project_url(text) from public, anon, authenticated;
grant execute on function public.set_project_url(text) to service_role;
comment on function public.set_project_url(text) is
  'T5d (v10.123.0): stores this project''s base URL in Vault (project_url) for the pg_cron jobs. Called by the deploy workflows; https://<ref>.supabase.co only.';

-- ── The jobs read it ──────────────────────────────────────────────────────────────────────────────────
do $$
declare
  j record;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return; end if;
  for j in
    select * from (values
      ('whatsapp-dispatch-alerts',  '/functions/v1/whatsapp-dispatch?job=alerts',  'x-dispatch-secret', 'whatsapp_dispatch_secret'),
      ('whatsapp-dispatch-weekly',  '/functions/v1/whatsapp-dispatch?job=weekly',  'x-dispatch-secret', 'whatsapp_dispatch_secret'),
      ('whatsapp-dispatch-bills',   '/functions/v1/whatsapp-dispatch?job=bills',   'x-dispatch-secret', 'whatsapp_dispatch_secret'),
      ('whatsapp-dispatch-digest',  '/functions/v1/whatsapp-dispatch?job=digest',  'x-dispatch-secret', 'whatsapp_dispatch_secret'),
      ('whatsapp-dispatch-monthly', '/functions/v1/whatsapp-dispatch?job=monthly', 'x-dispatch-secret', 'whatsapp_dispatch_secret'),
      ('web-push-dispatch',         '/functions/v1/web-push?mode=dispatch',        'x-cron-secret',     'web_push_cron_secret'),
      ('recurring-post',            '/functions/v1/recurring-post',                'x-cron-secret',     'recurring_post_cron_secret'),
      ('whatsapp-inbox-sweep',      '/functions/v1/whatsapp-webhook?mode=sweep',   'x-cron-secret',     'whatsapp_sweep_cron_secret')
    ) as t(jobname, path, header, secret)
  loop
    perform cron.alter_job(c.jobid, command := format($cmd$
  select net.http_post(
    url     := u.decrypted_secret || %L,
    headers := jsonb_build_object('Content-Type', 'application/json', %L, s.decrypted_secret),
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000)
  from vault.decrypted_secrets s, vault.decrypted_secrets u
  where s.name = %L and u.name = 'project_url';
$cmd$, j.path, j.header, j.secret))
    from cron.job c where c.jobname = j.jobname;
  end loop;
end;
$$;
