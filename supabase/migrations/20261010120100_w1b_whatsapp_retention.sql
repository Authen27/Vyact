-- W1b (audit 2026-10-04, XC-PRV-07 / BE-WA-10; owner decision D26) — WhatsApp messages are
-- kept for 90 days.
--
-- whatsapp_inbound_messages holds every message in both directions: the person's words, their
-- phone number (in payload) and errors. Nothing ever removed a row. From now on rows older than
-- 90 days are deleted every day (the schedule is in 20261010120200). Idempotency needs only
-- recent message ids (Meta retries within hours), so whole rows can go.
--
-- Expired OTPs and long-dead pending questions go too; neither is useful after a day.

BEGIN;

create or replace function public.purge_old_whatsapp_messages(p_days int default 90)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n_messages int;
  n_otps int;
  n_turns int;
begin
  if p_days is null or p_days < 1 then
    raise exception 'invalid_retention_days' using errcode = '22023';
  end if;
  delete from whatsapp_inbound_messages where created_at < now() - make_interval(days => p_days);
  get diagnostics n_messages = row_count;
  delete from whatsapp_verification_otps where expires_at < now() - interval '1 day';
  get diagnostics n_otps = row_count;
  delete from whatsapp_pending_turns where expires_at < now() - interval '1 day';
  get diagnostics n_turns = row_count;
  return jsonb_build_object('messages', n_messages, 'otps', n_otps, 'pending_turns', n_turns);
end;
$$;

revoke all on function public.purge_old_whatsapp_messages(int) from public;
revoke all on function public.purge_old_whatsapp_messages(int) from anon;
revoke all on function public.purge_old_whatsapp_messages(int) from authenticated;
grant execute on function public.purge_old_whatsapp_messages(int) to service_role;

COMMIT;
