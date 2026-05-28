-- TD-08 — server-side audit triggers on the six domain tables.
--
-- Populates `activity_log` whenever a row in `transactions`, `budgets`,
-- `goals`, `debts`, `assets`, or `memberships` is inserted/updated/deleted.
-- The pre-PR-#16 design intent for this lived at
-- db/migrations-superseded/20260524071000_audit_triggers.sql but was
-- never applied to prod (per TD-20's honest residual). This migration
-- re-lands it through the validated auto-apply pipeline.
--
-- Two correctness details from the original review pass, preserved here:
--   (a) the trigger list includes `memberships` (multi-household member
--       changes are exactly the audit signal we need).
--   (b) the SECURITY DEFINER function pins `search_path = public, pg_temp`
--       so a hostile schema on the caller's search_path can't shadow
--       `activity_log` or `auth.uid()` and tamper with the audit trail.

begin;

create or replace function public.log_domain_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  h       uuid;
  act     text;
  ent     text := tg_table_name;
  ent_id  uuid;
  ch      jsonb;
begin
  if tg_op = 'INSERT' then
    act    := 'created';
    h      := new.household_id;
    ent_id := new.id;
    ch     := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    act    := 'updated';
    h      := new.household_id;
    ent_id := new.id;
    ch     := jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    act    := 'deleted';
    h      := old.household_id;
    ent_id := old.id;
    ch     := to_jsonb(old);
  else
    return null;
  end if;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h, auth.uid(), act, ent, ent_id, ch);

  return null;
end;
$$;

-- Trigger names are stable so future migrations can drop/recreate them
-- cleanly. `if not exists` would be ideal but Postgres doesn't support
-- it on CREATE TRIGGER (yet), so we wrap in a DO block.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'activity_txn_trigger') then
    create trigger activity_txn_trigger
      after insert or update or delete on transactions
      for each row execute function public.log_domain_activity();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'activity_budgets_trigger') then
    create trigger activity_budgets_trigger
      after insert or update or delete on budgets
      for each row execute function public.log_domain_activity();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'activity_goals_trigger') then
    create trigger activity_goals_trigger
      after insert or update or delete on goals
      for each row execute function public.log_domain_activity();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'activity_debts_trigger') then
    create trigger activity_debts_trigger
      after insert or update or delete on debts
      for each row execute function public.log_domain_activity();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'activity_assets_trigger') then
    create trigger activity_assets_trigger
      after insert or update or delete on assets
      for each row execute function public.log_domain_activity();
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'activity_memberships_trigger') then
    create trigger activity_memberships_trigger
      after insert or update or delete on memberships
      for each row execute function public.log_domain_activity();
  end if;
end$$;

commit;
