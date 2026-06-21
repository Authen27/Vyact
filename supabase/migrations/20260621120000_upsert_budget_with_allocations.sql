-- Vyact — Budget-sync fix (docs/budget-sync-fix-plan.md, Phase 1).
--
-- Root cause: the parent budget was written online-synchronously (upsert_budget),
-- but each child allocation went through the fire-and-forget optimistic queue and
-- could silently dead-letter — so allocations created on one device never reached
-- the cloud (nothing for realtime to broadcast; a fresh login showed nothing).
--
-- Fix: one RPC that writes the parent budget AND its full allocation set in a
-- SINGLE transaction. Reuses upsert_budget for identity/dedup + the owner/admin
-- guard + BUDGET_EXISTS (so create still rejects a duplicate slot). The allocation
-- write is a scoped REPLACE: soft-delete this budget's live allocations (tombstones
-- ride the delta-sync window), then insert the provided set fresh. Last-writer-wins.

create or replace function public.upsert_budget_with_allocations(
  h uuid, b jsonb, allocs jsonb, p_mode text default 'create'
) returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  bud budgets%rowtype;
begin
  -- Parent — reuse the single writer (auth, owner/admin guard, identity/dedup,
  -- BUDGET_EXISTS on a taken slot). Runs in THIS transaction.
  select * into bud from public.upsert_budget(h, b, p_mode) limit 1;

  -- Children — atomic replace scoped strictly to the resolved budget_id.
  -- 1) tombstone the current live set (bump updated_at so other devices pull the
  --    delete as a tombstone inside their delta window).
  update public.budget_allocations
     set deleted_at = now(), updated_at = now()
   where budget_id = bud.id and deleted_at is null;

  -- 2) insert the provided set fresh.
  insert into public.budget_allocations (id, budget_id, household_id, category, amount)
  select gen_random_uuid(), bud.id, h, a->>'category', coalesce((a->>'amount')::numeric, 0)
    from jsonb_array_elements(coalesce(allocs, '[]'::jsonb)) a
   where coalesce(a->>'category','') <> '';

  return jsonb_build_object(
    'budget', to_jsonb(bud),
    'allocations', coalesce(
      (select jsonb_agg(to_jsonb(ba) order by ba.created_at)
         from public.budget_allocations ba
        where ba.budget_id = bud.id and ba.deleted_at is null),
      '[]'::jsonb)
  );
end;
$$;

grant execute on function public.upsert_budget_with_allocations(uuid, jsonb, jsonb, text) to authenticated;
