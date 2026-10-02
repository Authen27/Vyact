-- WhatsApp scheduler secret, generated in the database (2 Oct 2026).
--
-- The pg_cron jobs from 20260926120000 (alerts, weekly, bills, digest, monthly) post to
-- `whatsapp-dispatch` with `x-dispatch-secret` read from Vault `whatsapp_dispatch_secret`.
-- That secret was left for the owner to create by hand (plus the same value as the
-- function's WHATSAPP_DISPATCH_SECRET) and never was, so every run selected zero rows
-- and no scheduled WhatsApp message ever went out.
--
-- Same pattern as web push (20261003120000): the secret is generated here and never
-- leaves the database and the function. The function checks a header against Vault
-- through `whatsapp_dispatch_ok()` (service role only); WHATSAPP_DISPATCH_SECRET still
-- works if it is ever set. No person handles the value.

begin;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'whatsapp_dispatch_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'whatsapp_dispatch_secret',
                                'pg_cron -> whatsapp-dispatch');
  end if;
end;
$$;

create or replace function public.whatsapp_dispatch_ok(p text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select length(coalesce(p, '')) >= 32
     and exists (select 1 from vault.decrypted_secrets s where s.name = 'whatsapp_dispatch_secret' and s.decrypted_secret = p);
$$;

revoke all on function public.whatsapp_dispatch_ok(text) from public, anon, authenticated;
grant execute on function public.whatsapp_dispatch_ok(text) to service_role;

commit;
