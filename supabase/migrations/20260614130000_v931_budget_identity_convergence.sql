-- ============================================================================
-- Vyact v9.3.1 — budget multi-device convergence (root-cause fix)
--
-- SYMPTOM (prod v9.3.0): budgets do not sync across a household's devices —
-- one device's budgets vanish, another's never appear, a third shows a budget
-- that matches neither.
--
-- ROOT CAUSE: a budget's business identity is (household, scope, year, month),
-- enforced by the partial unique indexes uq_budget_month / uq_budget_annual.
-- But the client minted a RANDOM id for every new budget, so two devices
-- creating the same period produced two different primary keys for the same
-- identity slot. The first INSERT wins; the second violates the unique index,
-- is retried, and dead-letters — silent cross-device loss. (Fixed client-side
-- by deriving a DETERMINISTIC container id from the identity — see
-- react/src/lib/budgetIdentity.ts.)
--
-- This migration closes the two DATABASE-side defects that compound it:
--
--   1. replace_budgets (the bulk import / backup-restore path) was schema-STALE
--      and structurally broken:
--        • its INSERT column list omitted scope / period_year / period_month /
--          custom_name → every restore STRIPPED the v9.1 identity, leaving rows
--          the unique indexes can't tell apart;
--        • it soft-deleted then plain-INSERTed the SAME ids → a real restore
--          (same-id rows) collided on budgets_pkey and aborted.
--      Rewritten: schema-correct columns + ON CONFLICT (id) DO UPDATE, so it is
--      a true atomic "replace" (un-deletes/updates rows in the set; rows not in
--      the set stay soft-deleted).
--
--   2. The legacy per-category unique index budgets_household_category_uniq
--      (household_id, category) coexisted with the v9.1 per-period indexes — two
--      competing identity models on one table. Containers carry category=NULL,
--      so it no longer matches the app's model; drop it.
--
-- Forward-only, idempotent. Touches only the budgets RPC + indexes; no data
-- rewrite. (Recovery of the already-soft-deleted budgets is handled separately.)
-- ============================================================================

begin;

-- 1. replace_budgets — schema-correct, idempotent atomic replace ---------------
create or replace function public.replace_budgets(h uuid, rows jsonb)
returns setof budgets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Must be signed in'; end if;
  if not is_member(h) then raise exception 'Not a member of this household'; end if;

  -- Soft-delete the current set; rows present in the incoming set are revived by
  -- the ON CONFLICT branch below, rows absent from it stay deleted.
  update budgets set deleted_at = now(), updated_at = now()
    where household_id = h and deleted_at is null;

  return query
  insert into budgets (
    id, household_id, category, monthly_limit, currency, color,
    period, period_start, period_end,
    scope, period_year, period_month, custom_name,
    confidence, source, estimated_at, confirmed_at,
    created_at, updated_at, deleted_at)
  select
    t.id, h, t.category, t.monthly_limit, coalesce(t.currency, 'USD'), t.color,
    coalesce(t.period, 'monthly'), t.period_start, t.period_end,
    t.scope, t.period_year, t.period_month, t.custom_name,
    coalesce(t.confidence, 'confirmed'), coalesce(t.source, 'user'), t.estimated_at, t.confirmed_at,
    coalesce(t.created_at, now()), coalesce(t.updated_at, now()), t.deleted_at
  from jsonb_populate_recordset(null::budgets, rows) as t
  on conflict (id) do update set
    category      = excluded.category,
    monthly_limit = excluded.monthly_limit,
    currency      = excluded.currency,
    color         = excluded.color,
    period        = excluded.period,
    period_start  = excluded.period_start,
    period_end    = excluded.period_end,
    scope         = excluded.scope,
    period_year   = excluded.period_year,
    period_month  = excluded.period_month,
    custom_name   = excluded.custom_name,
    confidence    = excluded.confidence,
    source        = excluded.source,
    estimated_at  = excluded.estimated_at,
    confirmed_at  = excluded.confirmed_at,
    updated_at    = excluded.updated_at,
    deleted_at    = excluded.deleted_at;
end;
$$;
grant execute on function public.replace_budgets(uuid, jsonb) to authenticated;

-- 2. Drop the legacy competing identity model ---------------------------------
drop index if exists public.budgets_household_category_uniq;

commit;
