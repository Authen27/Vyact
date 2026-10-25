-- Q3a (v10.130.0; audit DB-SEC-03, DB-OPS-03; owner decision D4, 20 Oct 2026).
--
-- upsert_budget is the single writer of budgets (CLAUDE.md, "Budget identity lives in the DB"). It is SECURITY
-- DEFINER and checked only that the caller was a member of the household it was given, so:
--   - a member or viewer could write a budget, which the budgets policies keep to owners and admins (production
--     carried an owner/admin guard the repo never had: DB-OPS-03);
--   - in replace mode, an id naming another household's budget rewrote THAT budget (`on conflict (id) do
--     update`): DB-SEC-03, pinned by the Q2 access matrix (Q2-AZ-007, Q2-AZ-009).
-- This is the function as the migrations left it, with those two checks added. upsert_budget_with_allocations
-- calls it first, so it inherits both.

CREATE OR REPLACE FUNCTION public.upsert_budget(h uuid, b jsonb, p_mode text DEFAULT 'create'::text)
 RETURNS SETOF budgets
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v   budgets%rowtype;
  rec budgets%rowtype;
  sc  text := nullif(b->>'scope','');
begin
  if auth.uid() is null then raise exception 'Must be signed in' using errcode = '28000'; end if;
  if not is_member(h) then raise exception 'Not a member of this household' using errcode = '42501'; end if;
  -- Q3a (DB-SEC-03; owner decision D4): budgets are the owner's and admins', as the budgets policies say.
  if coalesce(public.role_in(h), '') not in ('owner', 'admin') then
    raise exception 'budget_owner_or_admin: only the owner or an admin can change budgets' using errcode = '42501';
  end if;
  if p_mode not in ('create','replace') then raise exception 'bad mode %', p_mode; end if;

  v := jsonb_populate_record(null::budgets, b);
  v.household_id := h;
  if v.id is null then v.id := gen_random_uuid(); end if;
  -- Q3a (DB-SEC-03): an id that names another household's budget is refused, never rewritten through this one
  -- (replace mode's `on conflict (id) do update` rewrote it).
  if exists (select 1 from budgets where id = v.id and household_id is distinct from h) then
    raise exception 'budget_not_found' using errcode = 'P0002';
  end if;
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
$function$;
