-- v10.118.0 — Track T2, part d: WhatsApp's replay sweep runs on its own.
-- Audit BE-WA-12 (owner decisions 18–19 Oct 2026: every 5 minutes; "Sorry, I couldn't process that. Please
-- send it again.").
--
-- The webhook stores every message before it answers Meta, then processes it. A message whose processing
-- failed, or whose worker died, or that was never claimed, is replayed by the sweep (`?mode=sweep`). The
-- sweep only ran when some other message arrived, so a household that went quiet kept a failed message
-- waiting, and a stale claim waited for unrelated traffic. Now pg_cron calls it every 5 minutes, with a
-- secret generated into Vault here (the recurring-post pattern, 20261015120000): the webhook checks the
-- header through `whatsapp_sweep_cron_ok`, and nobody handles the value. The webhook (deployed without JWT
-- verification, because Meta has no Supabase JWT) still accepts the service key, as before.
--
-- MONEY MODEL: untouched. A replay is safe: `whatsapp_log_transaction` claims the message id first, so a
-- message whose entry already landed comes back `duplicate`.

begin;

-- The cron secret check (plpgsql: its body is resolved at call time, not here).
create or replace function public.whatsapp_sweep_cron_ok(p text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return length(coalesce(p, '')) >= 32
     and exists (select 1 from vault.decrypted_secrets s where s.name = 'whatsapp_sweep_cron_secret' and s.decrypted_secret = p);
end;
$$;
revoke all on function public.whatsapp_sweep_cron_ok(text) from public, anon, authenticated;
grant execute on function public.whatsapp_sweep_cron_ok(text) to service_role;

-- The secret (generated here; it never leaves the database and the function) and the job.
do $$
begin
  -- Nested, so a database without Vault (the PGlite tests) never plans the inner query.
  if exists (select 1 from pg_namespace where nspname = 'vault') then
    if not exists (select 1 from vault.secrets where name = 'whatsapp_sweep_cron_secret') then
      perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'whatsapp_sweep_cron_secret',
                                  'pg_cron -> whatsapp-webhook sweep');
    end if;
  end if;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'whatsapp-inbox-sweep';
    perform cron.schedule('whatsapp-inbox-sweep', '*/5 * * * *', $job$
      select net.http_post(
        url     := 'https://dmxqkvploojokffuhxnz.supabase.co/functions/v1/whatsapp-webhook?mode=sweep',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', s.decrypted_secret),
        body    := '{}'::jsonb,
        timeout_milliseconds := 55000)
      from vault.decrypted_secrets s where s.name = 'whatsapp_sweep_cron_secret';
    $job$);
  end if;
end;
$$;

commit;
