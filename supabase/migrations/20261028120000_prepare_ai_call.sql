-- v10.107.1 · Pip gateway: one database round trip before the model (17 Oct 2026).
--
-- WHY
--   Each Pip answer makes two gateway requests (classify, then phrase). Prod timings on 16 Oct 2026
--   (`[ask-vyact] timing`, v10.106.3): before the model is called, each request waited for
--   getUser() ‖ config read ‖ membership read (150–750 ms, run together), THEN reserve_ai_usage()
--   (140–430 ms). That second, sequential round trip is what this function removes: the gateway now
--   runs getUser() ‖ config read ‖ prepare_ai_call(), and the reservation is already made when they
--   return.
--
-- WHO IT ACTS FOR: THE CALLER, AND ONLY THE CALLER
--   The gateway calls this with the user's own JWT, so PostgREST verifies the token's signature and
--   expiry and auth.uid() is that user. There is no user id parameter: a signed-in user who calls it
--   directly can only check their own membership and reserve against their own daily cap (as calling
--   the gateway itself would), never anyone else's. The cap is clamped to 1,000, so a direct caller
--   cannot use a huge p_cap to write unbounded rows. reserve_ai_usage() stays service-only and is still
--   used by the WhatsApp assistant and as the gateway's fallback.
--
-- WHAT IT DOES, IN ORDER (the gateway's own order)
--   1. Membership of p_household_id (when given). Not a member ⇒ no reservation.
--   2. Only when asked to reserve (p_reserve), with a cap, and an enabled model row applies to this
--      user — the same rule as the gateway's filterRowsForUser() + selectModelConfig(): enabled, this
--      seam, a model and base_url, and `params.allowed_user_ids` honoured (a relay row REQUIRES the
--      caller in it). So the OFF state still writes nothing.
--   3. The quota decision exactly as reserve_ai_usage(): the profile row locked, gateway rows of the
--      last 24 h counted, and a 'reserved' row inserted when under the cap. Over the cap is returned
--      as quota = 'exceeded' (not raised), so the membership answer still comes back with it.
--   If the gateway later refuses the request for another reason (the session is no longer valid, no
--   model applies after all), it deletes the reservation it did not use.

begin;

create or replace function public.prepare_ai_call(
  p_household_id uuid,
  p_seam         text,
  p_surface      text,
  p_cap          int,
  p_reserve      boolean
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_member     boolean := null;
  v_applicable boolean;
  v_count      int;
  v_id         uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_surface is null or p_surface not in ('chat', 'whatsapp', 'sms_share', 'receipt') then
    raise exception 'invalid_surface' using errcode = '22023';
  end if;

  if p_household_id is not null then
    select exists (
      select 1 from public.memberships where user_id = v_uid and household_id = p_household_id
    ) into v_member;
    if not v_member then
      return jsonb_build_object('member', false, 'reservation_id', null, 'quota', 'skipped');
    end if;
  end if;

  if not coalesce(p_reserve, false) or p_cap is null or p_cap < 0 or p_cap > 1000 then
    return jsonb_build_object('member', v_member, 'reservation_id', null, 'quota', 'skipped');
  end if;

  select exists (
    select 1 from public.ai_model_configs c
     where c.seam = p_seam
       and c.enabled
       and coalesce(btrim(c.model), '') <> ''
       and coalesce(btrim(c.base_url), '') <> ''
       and case
             when c.provider = 'claude-code-relay'
               then jsonb_typeof(c.params -> 'allowed_user_ids') = 'array'
                    and (c.params -> 'allowed_user_ids') ? v_uid::text
             when jsonb_typeof(c.params -> 'allowed_user_ids') = 'array'
               then (c.params -> 'allowed_user_ids') ? v_uid::text
             else true
           end
  ) into v_applicable;
  if not v_applicable then
    return jsonb_build_object('member', v_member, 'reservation_id', null, 'quota', 'skipped');
  end if;

  -- Serialise this user's quota decisions on their profile row (audit A2), as reserve_ai_usage() does.
  perform 1 from public.profiles where id = v_uid for update;

  select count(*) into v_count
    from public.ai_usage
   where user_id = v_uid
     and source = 'gateway'
     and backend = 'llm'
     and ts >= now() - interval '24 hours';

  if v_count >= p_cap then
    return jsonb_build_object('member', v_member, 'reservation_id', null, 'quota', 'exceeded');
  end if;

  insert into public.ai_usage (user_id, household_id, surface, backend, outcome, ts, source)
  values (v_uid, p_household_id, p_surface, 'llm', 'reserved', now(), 'gateway')
  returning id into v_id;

  return jsonb_build_object('member', v_member, 'reservation_id', v_id, 'quota', 'ok');
end $$;

revoke all on function public.prepare_ai_call(uuid, text, text, int, boolean) from public, anon;
grant execute on function public.prepare_ai_call(uuid, text, text, int, boolean) to authenticated, service_role;

comment on function public.prepare_ai_call(uuid, text, text, int, boolean) is
  'v10.107.1: the ask-vyact gateway''s pre-model checks in one round trip, for auth.uid() only: household membership, then (when asked, with a cap ≤ 1000 and an applicable enabled model row) the reserve_ai_usage() quota decision. Returns {member, reservation_id, quota: ok|exceeded|skipped}.';

commit;
