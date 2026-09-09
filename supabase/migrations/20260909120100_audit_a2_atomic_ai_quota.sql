-- ============================================================================
-- Audit A2 (2026-09-09) — AI spend cap becomes an ATOMIC reservation, not a
-- count-then-call race.
--
-- THE HOLE
-- The gateway did: SELECT count(*) … → call the provider → INSERT usage. Every
-- concurrent request passed the same count check, a failed count read was
-- treated as zero usage, and a failed metering write was ignored. Under any
-- parallelism the cap was advisory, and it failed OPEN.
--
-- THE FIX
-- `reserve_ai_usage(user_id, cap)` — one SECURITY DEFINER function that takes
-- a row lock on the user's profile (serialising their requests), counts their
-- LLM calls in the window, and either inserts a reservation row (a pending
-- ai_usage marker) or raises 42901. Counting and reserving are one statement
-- sequence under one lock: no two concurrent requests can both pass. A failed
-- count now fails CLOSED (the error aborts the reservation, and the gateway
-- does not call the provider). After the provider answers, the gateway
-- finalises the reservation row with the real tokens/cost/latency.
-- ============================================================================

BEGIN;

-- A reservation is a normal ai_usage row with outcome='reserved' written
-- BEFORE the provider call; the gateway UPDATEs it to the real outcome after.
-- The metering migration's outcome CHECK predates reservations — widen it.
alter table public.ai_usage drop constraint if exists ai_usage_outcome_chk;
alter table public.ai_usage add constraint ai_usage_outcome_chk
  check (outcome is null or outcome in ('ok','error','blocked','fallback','clarify','reserved'));

create or replace function public.reserve_ai_usage(
  p_user_id      uuid,
  p_household_id uuid,
  p_surface      text,
  p_cap          int
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_id    uuid;
begin
  -- Serialise this user's quota decisions on their profile row. Two of their
  -- concurrent requests now run one-after-another here, so the count below is
  -- exact at decision time.
  perform 1 from public.profiles where id = p_user_id for update;

  select count(*) into v_count
    from public.ai_usage
   where user_id = p_user_id
     and backend = 'llm'
     and ts >= now() - interval '24 hours';

  if v_count >= p_cap then
    raise exception 'quota_exceeded' using errcode = '42901';
  end if;

  insert into public.ai_usage (user_id, household_id, surface, backend, outcome, ts)
  values (p_user_id, p_household_id, p_surface, 'llm', 'reserved', now())
  returning id into v_id;
  return v_id;
end $$;

-- Called by the ask-vyact Edge Function with the service role; it must NOT be
-- client-callable (a client could reserve-then-abandon to inflate usage, or
-- call with a huge cap).
revoke all on function public.reserve_ai_usage(uuid, uuid, text, int) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, uuid, text, int) to service_role;

comment on function public.reserve_ai_usage(uuid, uuid, text, int) is
  'Audit A2 — atomic AI quota reservation. Row-locks the user profile, counts 24h llm usage, inserts a reservation row (outcome=reserved) or raises 42901. Fail-closed: a count error aborts the reservation. The gateway finalises the row after the provider answers.';

COMMIT;
