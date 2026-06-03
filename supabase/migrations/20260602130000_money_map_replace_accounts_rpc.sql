-- Money Map · v7.2 — replace_accounts RPC.
--
-- Mirrors `replace_assets` (TD-09 pattern). Required by the
-- `HybridAdapter.replaceAll('accounts', ...)` path so bulk import /
-- restore works once accounts are first-class.
--
-- Idempotent (`create or replace`). Soft-delete + insert inside a single
-- transaction so partial failures roll back. SECURITY DEFINER with the
-- same `is_member` guard the other replace_* functions use.

BEGIN;

create or replace function public.replace_accounts(h uuid, rows jsonb)
returns setof accounts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;
  if not is_member(h) then raise exception 'Not a member of this household'; end if;

  update accounts set deleted_at = now() where household_id = h and deleted_at is null;

  return query
  insert into accounts (
    id, household_id, asset_id, kind, name, currency,
    is_default, is_archived, created_at, updated_at, deleted_at
  )
  select
    t.id::uuid, h, t.asset_id::uuid, t.kind, t.name, t.currency,
    coalesce(t.is_default, false),
    coalesce(t.is_archived, false),
    coalesce(t.created_at::timestamptz, now()),
    coalesce(t.updated_at::timestamptz, now()),
    t.deleted_at::timestamptz
  from jsonb_populate_recordset(null::accounts, rows) as t;
end;
$$;

-- Lock down execute grants the same way TD-09 does for every other
-- replace_* function (see 20260529151500_td08_td09_harden_execute_grants.sql).
revoke execute on function public.replace_accounts(uuid, jsonb) from public, anon;
grant  execute on function public.replace_accounts(uuid, jsonb) to authenticated;

COMMIT;
