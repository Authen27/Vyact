-- ============================================================================
-- v10.47.0 (W6) — two follow-up conversations on WhatsApp.
--
--   1. "Name them here": this month's expenses still in Other are listed (up to
--      five, biggest first) and named from the chat ("1 groceries").
--      * `whatsapp_unnamed_expenses` lists them: the household's live expenses in
--        Other, never another member's private (excluded) entry.
--      * `whatsapp_name_entries` changes ONLY the category, on entries that are
--        still unnamed — never the amount, the account or the date. The caller
--        checked each category is an expense category (type-scoped).
--   2. "Reply UPDATE": stale bank, card and cash balances, one at a time.
--      * `whatsapp_reconcile_account` applies the reconcile the APP computes
--        (serverEngine.reconcileOnServer → accountBalance.reconcileAccount): the
--        new reconciliation offset, the log with its dated entry, and the stamp
--        `last_reconciled_at`, with provenance confirmed/user — exactly what
--        reconcileSlice writes. It also bridges the stated value to the linked
--        Asset or Debt, as the slice does. It refuses when the offset has moved
--        since the plan was made (another reconcile raced it).
--   3. `whatsapp_pending_turns` may hold 'name_entries' and 'balance_update'.
--
-- All three claim the message first (a replay is silent) and need a write role.
-- Service role only.
--
-- MONEY MODEL: a category change on ordinary expense rows (the app's own edit),
-- and a reconciliation that is an account offset + dated log, NEVER a
-- transaction (D2). No amount is changed; nothing is inserted into transactions.
-- ============================================================================

BEGIN;

alter table public.whatsapp_pending_turns drop constraint if exists ck_wa_pending_kind;
alter table public.whatsapp_pending_turns add constraint ck_wa_pending_kind
  check (kind in ('missing_amount', 'duplicate_check', 'chips', 'reads_offer', 'name_entries', 'balance_update'));

-- ── 1. Unnamed expenses ─────────────────────────────────────────────────────
create or replace function public.whatsapp_unnamed_expenses(
  p_profile_id uuid, p_household_id uuid, p_from date, p_limit int default 5
) returns table (id uuid, amount numeric, currency text, date date, account_name text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.id, t.amount, t.currency::text, t.date, a.name
    from public.transactions t
    left join public.accounts a on a.id = t.account_id
   where t.household_id = p_household_id
     and t.deleted_at is null
     and t.type = 'expense'
     and t.category in ('other_expense', 'other')
     and t.date >= p_from
     -- Someone else's private entry is theirs to name.
     and not (coalesce((t.extras->>'excluded')::boolean, false) and t.created_by is distinct from p_profile_id)
   order by t.amount desc, t.date desc, t.id
   limit greatest(1, least(coalesce(p_limit, 5), 10));
$$;

create or replace function public.whatsapp_name_entries(
  p_profile_id uuid, p_household_id uuid, p_wa_message_id text, p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_block text; v_item jsonb; t record; v_out jsonb := '[]'::jsonb; v_status text;
begin
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 10 then
    return jsonb_build_object('status', 'bad_request');
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select x.id, x.type, x.category, x.deleted_at, x.created_by,
           coalesce((x.extras->>'excluded')::boolean, false) as excluded
      into t
      from public.transactions x
     where x.id = (v_item->>'id')::uuid and x.household_id = p_household_id
     for update;
    if not found or t.deleted_at is not null then v_status := 'gone';
    elsif t.type <> 'expense' then v_status := 'not_expense';
    elsif t.excluded and t.created_by is distinct from p_profile_id then v_status := 'private';
    elsif t.category not in ('other_expense', 'other') then v_status := 'already_named';
    else
      update public.transactions set category = v_item->>'category' where id = t.id;
      v_status := 'named';
    end if;
    v_out := v_out || jsonb_build_object('id', v_item->>'id', 'status', v_status, 'category', v_item->>'category');
  end loop;
  return jsonb_build_object('status', 'done', 'results', v_out);
end;
$$;

-- ── 2. Reconcile one account from the chat ──────────────────────────────────
create or replace function public.whatsapp_reconcile_account(
  p_profile_id uuid, p_household_id uuid, p_wa_message_id text,
  p_account_id uuid, p_expected_offset numeric, p_offset numeric, p_log jsonb, p_at timestamptz,
  p_bridge jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_block text; a record;
begin
  v_block := public.whatsapp_claim_for_write(p_profile_id, p_household_id, p_wa_message_id);
  if v_block is not null then return jsonb_build_object('status', v_block); end if;

  select x.id, x.kind, x.is_archived, x.deleted_at, coalesce(x.reconciliation_offset, 0) as off
    into a
    from public.accounts x
   where x.id = p_account_id and x.household_id = p_household_id
   for update;
  if not found or a.deleted_at is not null or a.is_archived then return jsonb_build_object('status', 'gone'); end if;
  if a.kind not in ('bank', 'credit_card', 'cash') then return jsonb_build_object('status', 'not_supported'); end if;
  -- The plan was computed from this offset; if it moved, the plan is stale.
  if round(a.off, 2) <> round(coalesce(p_expected_offset, 0), 2) then
    return jsonb_build_object('status', 'changed');
  end if;
  if jsonb_typeof(p_log) <> 'array' then return jsonb_build_object('status', 'bad_request'); end if;

  update public.accounts set
    reconciliation_offset = round(p_offset, 2),
    reconciliation_log    = p_log,
    last_reconciled_at    = p_at,
    confidence = 'confirmed', source = 'user', confirmed_at = p_at
   where id = p_account_id;

  -- §6 R-AGG-5 / D2 — the stated value flows to the linked entity (reconcileSlice).
  if p_bridge is not null and p_bridge->>'debt_id' is not null then
    update public.debts set current_balance = greatest(0, (p_bridge->>'current_balance')::numeric),
           confidence = 'confirmed', source = 'user', confirmed_at = p_at
     where id = (p_bridge->>'debt_id')::uuid and household_id = p_household_id and deleted_at is null;
  elsif p_bridge is not null and p_bridge->>'asset_id' is not null then
    update public.assets set value = (p_bridge->>'value')::numeric, last_updated = (p_at at time zone 'UTC')::date,
           confidence = 'confirmed', source = 'user', confirmed_at = p_at
     where id = (p_bridge->>'asset_id')::uuid and household_id = p_household_id and deleted_at is null;
  end if;
  return jsonb_build_object('status', 'reconciled', 'offset', round(p_offset, 2));
end;
$$;

revoke all on function public.whatsapp_unnamed_expenses(uuid, uuid, date, int) from public, anon, authenticated;
revoke all on function public.whatsapp_name_entries(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.whatsapp_reconcile_account(uuid, uuid, text, uuid, numeric, numeric, jsonb, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.whatsapp_unnamed_expenses(uuid, uuid, date, int) to service_role;
grant execute on function public.whatsapp_name_entries(uuid, uuid, text, jsonb) to service_role;
grant execute on function public.whatsapp_reconcile_account(uuid, uuid, text, uuid, numeric, numeric, jsonb, timestamptz, jsonb) to service_role;

COMMIT;
