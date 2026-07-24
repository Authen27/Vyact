-- Fix: deleting a household always fails with
--   `insert or update on table "activity_log" violates foreign key
--   constraint "activity_log_household_id_fkey"`
--
-- Root cause (confirmed live via a zero-cost DO-block repro before this fix
-- was written): `activity_log.household_id` is `references households(id)
-- on delete cascade`. Deleting a household cascades to delete every row that
-- references it — memberships, transactions, budgets, goals, debts, assets —
-- and EACH of those cascaded deletes fires its own `log_domain_activity()`
-- AFTER DELETE trigger (TD-08, 20260529150500_td08_audit_triggers.sql),
-- which tries to INSERT a fresh 'deleted' row into `activity_log` for that
-- household. By the time those child-table cascades fire, `households(id)`
-- has ALREADY been removed from the table within the same transaction (that
-- removal is what triggered the cascade), so the new activity_log insert's
-- own FK check fails — the whole DELETE rolls back and the household is
-- never actually deleted. This reproduces for ANY household with at least
-- one row in a logged child table, which in practice is every real
-- household (every household has at least its owner's membership row).
--
-- Fix: swallow `foreign_key_violation` specifically on this insert. A log
-- entry for a household that's disappearing in the same transaction has no
-- reader anyway — activity_log's own household_id FK is ALSO `on delete
-- cascade`, so any activity_log rows that already exist for this household
-- are removed automatically once the delete completes. Skipping the insert
-- here just avoids trying to create a row that would be immediately
-- orphaned, instead of aborting the entire household deletion over it.

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

  begin
    insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
    values (h, auth.uid(), act, ent, ent_id, ch);
  exception when foreign_key_violation then
    -- household_id no longer exists — we're mid-cascade-delete of the
    -- household itself in this same transaction. See header comment.
    null;
  end;

  return null;
end;
$$;

commit;
