-- W1a (audit 2026-10-04, DB-SEC-01 / DB-INT-01 / DB-OPS-01 / INT-CON-02 / INT-CON-04) —
-- drop the bulk replace RPCs.
--
-- Each replace_<entity>(h, rows) was SECURITY DEFINER and checked only is_member(h), then
-- deleted every row of that entity in the household and inserted whatever the caller sent.
-- RLS does not apply inside a definer function, so any member — a viewer or child included —
-- could call replace_memberships to delete every membership (the real owner's too) and
-- insert themselves as owner, or wipe the ledger, budgets, debts, assets and accounts.
--
-- They were built (TD-09, 29 May 2026) for the vanilla shell's "restore a backup", which was
-- archived on 1 Jun; the React app never had a restore screen. The only remaining caller is
-- the first-run demo seed, which runs only in local mode and never reaches the cloud. The
-- app (SupabaseAdapter.replaceAll) now refuses a cloud bulk replace. A future "restore from
-- backup" is in the backlog as a new owner-only command.

BEGIN;

drop function if exists public.replace_transactions(uuid, jsonb);
drop function if exists public.replace_budgets(uuid, jsonb);
drop function if exists public.replace_goals(uuid, jsonb);
drop function if exists public.replace_debts(uuid, jsonb);
drop function if exists public.replace_assets(uuid, jsonb);
drop function if exists public.replace_memberships(uuid, jsonb);
drop function if exists public.replace_accounts(uuid, jsonb);
drop function if exists public.replace_saved_views(uuid, jsonb);

COMMIT;
