-- ============================================================================
-- Vyact v9.8.0 — consent tracking + data erasure / account deactivation /
-- account deletion controls
--
-- Ships the backend for three consumer-facing rights promised by the new
-- Privacy Policy / Terms of Service:
--   1. Consent is recorded at sign-up (tos_accepted_at / privacy_accepted_at)
--      instead of being an unenforced UI checkbox.
--   2. "Erase all my data" — wipes every financial row for a household
--      (transactions, budgets, debts, goals, assets, accounts, recurring
--      schedules, activity log, onboarding baseline) while the household
--      shell + membership + login survive. Owner/admin only.
--   3. Deactivate (temporary) vs delete (permanent) at the *account* level:
--        - deactivated_at: soft-lock, cleared automatically the next time
--          the owning user authenticates (client calls reactivate_my_account
--          right after sign-in — see lib/auth.ts reactivateIfNeeded()).
--        - deletion_requested_at / deletion_scheduled_for: a 30-day undo
--          window for permanent deletion. Signing back in inside the window
--          cancels the scheduled purge (same reactivate path). The actual
--          hard delete (auth.users row + all owned data) is performed by the
--          `delete-account` edge function using the service role, since a
--          client-side RLS-scoped connection cannot drop auth.users.
-- ============================================================================

-- ── 1. Consent + lifecycle columns on profiles ─────────────────────────────
alter table profiles
  add column if not exists tos_accepted_at        timestamptz,
  add column if not exists tos_version             text,
  add column if not exists privacy_accepted_at     timestamptz,
  add column if not exists privacy_version         text,
  add column if not exists deactivated_at          timestamptz,
  add column if not exists deletion_requested_at   timestamptz,
  add column if not exists deletion_scheduled_for  timestamptz;

comment on column profiles.deactivated_at is
  'Temporary account hold. Set by deactivate_my_account(); cleared by reactivate_my_account() the next time the user signs back in.';
comment on column profiles.deletion_scheduled_for is
  'Permanent-delete undo deadline (request time + 30 days). The delete-account edge function purges the account once this passes; signing in before it cancels the request.';

-- ── 2. erase_household_data — wipe financial data, keep the shell ──────────
-- Caller must be an owner/admin member of h_id. Deletes rows scoped to the
-- household from every money/content table; leaves `households` and
-- `memberships` themselves untouched so the household and its members still
-- exist (this is a data reset, not a household deletion).
drop function if exists erase_household_data(uuid);
create or replace function erase_household_data(h_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  select role into caller_role
  from memberships
  where household_id = h_id and user_id = auth.uid()
  limit 1;

  if caller_role is null or caller_role not in ('owner', 'admin') then
    raise exception 'not authorized to erase this household''s data';
  end if;

  delete from transactions        where household_id = h_id;
  delete from budgets              where household_id = h_id;
  delete from budget_allocations   where household_id = h_id;
  delete from goals                where household_id = h_id;
  delete from debts                where household_id = h_id;
  delete from assets               where household_id = h_id;
  delete from accounts             where household_id = h_id;
  delete from recurring_schedules  where household_id = h_id;
  delete from saved_views          where household_id = h_id;
  delete from activity_log         where household_id = h_id;

  -- Onboarding baseline/reference overlay (v9.7.0) lives in households.onboarding.
  update households set onboarding = null where id = h_id;

  insert into activity_log (household_id, actor_id, action, entity_type, entity_id, changes)
  values (h_id, auth.uid(), 'erase_household_data', 'household', h_id, jsonb_build_object('erased_at', now()));
end;
$$;

grant execute on function erase_household_data(uuid) to authenticated;

-- ── 3. Deactivate / reactivate — operate on the caller only ────────────────
drop function if exists deactivate_my_account();
create or replace function deactivate_my_account()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set deactivated_at = now() where id = auth.uid();
$$;

grant execute on function deactivate_my_account() to authenticated;

drop function if exists reactivate_my_account();
create or replace function reactivate_my_account()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles
  set deactivated_at = null,
      deletion_requested_at = null,
      deletion_scheduled_for = null
  where id = auth.uid();
$$;

grant execute on function reactivate_my_account() to authenticated;

-- ── 4. Request permanent deletion (30-day undo window) ─────────────────────
drop function if exists request_account_deletion();
create or replace function request_account_deletion()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  scheduled timestamptz := now() + interval '30 days';
begin
  update profiles
  set deactivated_at = now(),
      deletion_requested_at = now(),
      deletion_scheduled_for = scheduled
  where id = auth.uid();
  return scheduled;
end;
$$;

grant execute on function request_account_deletion() to authenticated;
