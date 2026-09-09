-- ============================================================================
-- v10.21 — merge the `transport` category into `travel`.
--
-- WHY
-- The two were indistinguishable in practice: a taxi to the airport and the
-- flight it fed were filed apart for no reason a user could articulate. One
-- category now covers getting from A to B. (The holiday half of the old
-- `travel` becomes `holiday_outstay`, which is a NEW id — no existing row
-- carries it, so nothing needs moving for that one.)
--
-- REVERSIBLE BY DESIGN
-- Every table that stores a category gets a nullable `category_prev` column,
-- written with the value this migration replaced. Reverting is a single UPDATE
-- per table, and an auditor can always see what a row used to be. The column is
-- deliberately kept afterwards rather than dropped in a later cleanup — it is
-- the only record that the reclassification happened.
--
-- 🔴 THE HAZARD THIS MIGRATION EXISTS TO HANDLE
-- `budget_allocations` has a UNIQUE index `uq_balloc_cat (budget_id, category)
-- WHERE deleted_at IS NULL`. A budget holding BOTH a transport and a travel
-- allocation therefore CANNOT simply have transport renamed — the rename
-- collides and the migration aborts, which (since v10.20.5) blocks the whole
-- release. Verified against production before writing this: exactly one budget
-- is affected, holding transport 10000 and travel 200.
--
-- Colliding pairs are MERGED, not dropped: the amounts are summed into the
-- surviving travel row and the transport row is soft-deleted. Summing is the
-- only choice that keeps the budget's allocations reconciling against its
-- container total — picking one and discarding the other would silently change
-- how much the household had budgeted.
--
-- MONEY MODEL: no transaction is created, no amount changes, no account moves.
-- This is a reclassification. The sum of allocations per budget is preserved.
-- ============================================================================

BEGIN;

-- ── 1. Backup columns ──────────────────────────────────────────────────────
alter table public.transactions       add column if not exists category_prev text;
alter table public.budget_allocations add column if not exists category_prev text;
alter table public.budgets            add column if not exists category_prev text;

-- ── 2. budget_allocations — merge collisions FIRST, then rename the rest ───
-- Fold each colliding transport row into its budget's travel row.
with collisions as (
  select t.id  as transport_id,
         v.id  as travel_id,
         t.amount as transport_amount
  from public.budget_allocations t
  join public.budget_allocations v
    on v.budget_id = t.budget_id
   and v.category  = 'travel'
   and v.deleted_at is null
  where t.category = 'transport'
    and t.deleted_at is null
),
folded as (
  update public.budget_allocations v
     set amount        = v.amount + c.transport_amount,
         category_prev = coalesce(v.category_prev, 'travel'),
         updated_at    = now()
    from collisions c
   where v.id = c.travel_id
  returning v.id
)
update public.budget_allocations t
   set deleted_at    = now(),
       category_prev = 'transport',
       updated_at    = now()
  from collisions c
 where t.id = c.transport_id;

-- Everything left is a transport allocation with no travel sibling: rename it.
update public.budget_allocations
   set category      = 'travel',
       category_prev = 'transport',
       updated_at    = now()
 where category = 'transport'
   and deleted_at is null;

-- ── 3. transactions ────────────────────────────────────────────────────────
-- No unique constraint on category here, so a straight rename is safe.
update public.transactions
   set category      = 'travel',
       category_prev = 'transport',
       updated_at    = now()
 where category = 'transport';

-- ── 4. budgets (legacy per-category rows, pre-v9.1 container model) ────────
update public.budgets
   set category      = 'travel',
       category_prev = 'transport',
       updated_at    = now()
 where category = 'transport';

-- ── 5. recurring_schedules — category lives inside the jsonb template ──────
update public.recurring_schedules
   set txn_template = jsonb_set(txn_template, '{category}', '"travel"'),
       updated_at   = now()
 where txn_template->>'category' = 'transport';

-- ── 6. category_classifications — PK is the category itself ────────────────
-- A rename would collide with the existing travel row, so drop the transport
-- row only when travel is already classified; otherwise rename it.
update public.category_classifications
   set category = 'travel'
 where category = 'transport'
   and not exists (select 1 from public.category_classifications where category = 'travel');
delete from public.category_classifications where category = 'transport';

COMMIT;

-- Verify (run manually; not part of the migration):
--   select category, count(*) from public.budget_allocations
--    where deleted_at is null group by 1 order by 1;
--   -- expect: no 'transport' row anywhere, and for the previously colliding
--   -- budget a single travel allocation of 10200.
