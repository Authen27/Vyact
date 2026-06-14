-- ============================================================================
-- Vyact v9.3.3 — upsert_budget(): the single DB authority for budget identity
--
-- Supersedes the v9.3.1 client-side deterministic-id approach, which coupled the
-- primary key to the business identity and broke in two ways: (a) delete+recreate
-- a month landed on the soft-deleted same-id row via ON CONFLICT (id) and never
-- cleared deleted_at → the budget came back invisible; (b) recovered rows kept
-- their original random ids, so a fresh deterministic-id create collided on
-- uq_budget_month and dead-lettered.
--
-- Identity belongs in the database. This RPC is the one writer all entry points
-- use (the Budgets form today; Ask Vyact / WhatsApp / 3rd-party API next):
--   • mode='create'  → INSERT … ON CONFLICT (identity) WHERE deleted_at IS NULL
--                       DO NOTHING. If nothing inserted, the slot is taken →
--                       raise BUDGET_EXISTS (errcode 23505). Race-proof, and it
--                       fires for another member's not-yet-synced budget too.
--   • mode='replace' → INSERT … ON CONFLICT (identity) DO UPDATE …, deleted_at=NULL
--                       (idempotent set / revive — for the machine entry points).
-- Identity = (household, period_year, period_month) for month; (household,
-- period_year) for annual. The DB assigns the id; the client never sends one.
--
-- Forward-only, idempotent (CREATE OR REPLACE). Validated against the live
-- function with an auto-rollback scenario harness (create / duplicate-reject /
-- delete+recreate / replace-converge / replace-revive / annual) — all PASS.
-- ============================================================================
create or replace function public.upsert_budget(h uuid, b jsonb, p_mode text default 'create')
returns setof budgets
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v   budgets%rowtype;
  rec budgets%rowtype;
  sc  text := nullif(b->>'scope','');
begin
  if auth.uid() is null then raise exception 'Must be signed in' using errcode = '28000'; end if;
  if not is_member(h) then raise exception 'Not a member of this household' using errcode = '42501'; end if;
  if p_mode not in ('create','replace') then raise exception 'bad mode %', p_mode; end if;

  v := jsonb_populate_record(null::budgets, b);
  v.household_id := h;
  if v.id is null then v.id := gen_random_uuid(); end if;
  if v.currency   is null or v.currency   = '' then v.currency   := 'USD';       end if;
  if v.period     is null or v.period     = '' then v.period     := 'monthly';   end if;
  if v.confidence is null or v.confidence = '' then v.confidence := 'confirmed'; end if;
  if v.source     is null or v.source     = '' then v.source     := 'user';      end if;
  if v.created_at is null then v.created_at := now(); end if;
  v.updated_at := now();
  v.deleted_at := null;   -- a write always yields a LIVE row

  if p_mode = 'create' then
    if sc = 'month' then
      insert into budgets (id,household_id,category,monthly_limit,currency,color,period,period_start,period_end,scope,period_year,period_month,custom_name,confidence,source,estimated_at,confirmed_at,created_at,updated_at,deleted_at)
      values (v.id,h,v.category,v.monthly_limit,v.currency,v.color,v.period,v.period_start,v.period_end,'month',v.period_year,v.period_month,v.custom_name,v.confidence,v.source,v.estimated_at,v.confirmed_at,v.created_at,v.updated_at,null)
      on conflict (household_id,period_year,period_month) where scope='month' and deleted_at is null
      do nothing returning * into rec;
    elsif sc = 'annual' then
      insert into budgets (id,household_id,category,monthly_limit,currency,color,period,period_start,period_end,scope,period_year,period_month,custom_name,confidence,source,estimated_at,confirmed_at,created_at,updated_at,deleted_at)
      values (v.id,h,v.category,v.monthly_limit,v.currency,v.color,v.period,v.period_start,v.period_end,'annual',v.period_year,v.period_month,v.custom_name,v.confidence,v.source,v.estimated_at,v.confirmed_at,v.created_at,v.updated_at,null)
      on conflict (household_id,period_year) where scope='annual' and deleted_at is null
      do nothing returning * into rec;
    else
      insert into budgets (id,household_id,category,monthly_limit,currency,color,period,period_start,period_end,scope,period_year,period_month,custom_name,confidence,source,estimated_at,confirmed_at,created_at,updated_at,deleted_at)
      values (v.id,h,v.category,v.monthly_limit,v.currency,v.color,v.period,v.period_start,v.period_end,v.scope,v.period_year,v.period_month,v.custom_name,v.confidence,v.source,v.estimated_at,v.confirmed_at,v.created_at,v.updated_at,null)
      on conflict (id) do nothing returning * into rec;
    end if;

    if rec.id is null then
      raise exception 'BUDGET_EXISTS'
        using errcode = '23505',
              detail = concat('scope=', coalesce(sc,''), ' year=', v.period_year, ' month=', coalesce(v.period_month::text,''));
    end if;
    return next rec; return;
  end if;

  -- p_mode = 'replace'
  if sc = 'month' then
    insert into budgets (id,household_id,category,monthly_limit,currency,color,period,period_start,period_end,scope,period_year,period_month,custom_name,confidence,source,estimated_at,confirmed_at,created_at,updated_at,deleted_at)
    values (v.id,h,v.category,v.monthly_limit,v.currency,v.color,v.period,v.period_start,v.period_end,'month',v.period_year,v.period_month,v.custom_name,v.confidence,v.source,v.estimated_at,v.confirmed_at,v.created_at,v.updated_at,null)
    on conflict (household_id,period_year,period_month) where scope='month' and deleted_at is null
    do update set category=excluded.category, monthly_limit=excluded.monthly_limit, currency=excluded.currency, color=excluded.color, period=excluded.period, period_start=excluded.period_start, period_end=excluded.period_end, custom_name=excluded.custom_name, confidence=excluded.confidence, source=excluded.source, updated_at=now(), deleted_at=null
    returning * into rec;
  elsif sc = 'annual' then
    insert into budgets (id,household_id,category,monthly_limit,currency,color,period,period_start,period_end,scope,period_year,period_month,custom_name,confidence,source,estimated_at,confirmed_at,created_at,updated_at,deleted_at)
    values (v.id,h,v.category,v.monthly_limit,v.currency,v.color,v.period,v.period_start,v.period_end,'annual',v.period_year,v.period_month,v.custom_name,v.confidence,v.source,v.estimated_at,v.confirmed_at,v.created_at,v.updated_at,null)
    on conflict (household_id,period_year) where scope='annual' and deleted_at is null
    do update set category=excluded.category, monthly_limit=excluded.monthly_limit, currency=excluded.currency, color=excluded.color, period=excluded.period, period_start=excluded.period_start, period_end=excluded.period_end, custom_name=excluded.custom_name, confidence=excluded.confidence, source=excluded.source, updated_at=now(), deleted_at=null
    returning * into rec;
  else
    insert into budgets (id,household_id,category,monthly_limit,currency,color,period,period_start,period_end,scope,period_year,period_month,custom_name,confidence,source,estimated_at,confirmed_at,created_at,updated_at,deleted_at)
    values (v.id,h,v.category,v.monthly_limit,v.currency,v.color,v.period,v.period_start,v.period_end,v.scope,v.period_year,v.period_month,v.custom_name,v.confidence,v.source,v.estimated_at,v.confirmed_at,v.created_at,v.updated_at,null)
    on conflict (id) do update set category=excluded.category, monthly_limit=excluded.monthly_limit, currency=excluded.currency, color=excluded.color, period=excluded.period, period_start=excluded.period_start, period_end=excluded.period_end, custom_name=excluded.custom_name, confidence=excluded.confidence, source=excluded.source, updated_at=now(), deleted_at=null
    returning * into rec;
  end if;
  return next rec; return;
end;
$$;
grant execute on function public.upsert_budget(uuid, jsonb, text) to authenticated;
