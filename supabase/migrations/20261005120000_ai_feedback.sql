-- ============================================================================
-- Pip answer feedback (owner request, 2 Oct 2026): a 👍 / 👎 under each Ask Vyact
-- reply, counted for the admin console.
--
-- PRIVACY — same rule as ai_usage: NO message content. A row is the rating, the
-- intent of the question it answered (classified on the client, as ai_usage does),
-- the reply's length and the surface. Never the question or the answer, which can
-- carry a household's figures.
--
-- One rating per answer per person: (user_id, turn_id) is unique, so changing your
-- mind updates the row and taking the rating back deletes it.
--
-- SCHEMA FIRST: this ships, and its Deploy run goes green, before the app change
-- that writes it (CLAUDE.md, "Schema ships before the app that needs it").
-- MONEY MODEL: untouched. No money table, row or amount.
-- ============================================================================

BEGIN;

create table if not exists public.ai_feedback (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  surface       text not null default 'app' check (surface in ('app', 'whatsapp')),
  rating        smallint not null check (rating in (-1, 1)),
  intent        text check (char_length(intent) <= 64),
  response_len  integer check (response_len >= 0),
  -- The client's per-answer id (ChatMessage.turnId). Not content.
  turn_id       text not null check (char_length(turn_id) between 1 and 64),
  constraint ai_feedback_one_per_answer unique (user_id, turn_id)
);

create index if not exists ai_feedback_created_at_idx on public.ai_feedback (created_at desc);

alter table public.ai_feedback enable row level security;

-- A member rates answers in their own household, as themselves; reads and changes
-- only their own ratings. Admins read the aggregate through the definer function.
drop policy if exists "ai_feedback_insert" on public.ai_feedback;
create policy "ai_feedback_insert" on public.ai_feedback for insert to authenticated
  with check (public.is_member(household_id) and user_id = (select auth.uid()));

drop policy if exists "ai_feedback_update_own" on public.ai_feedback;
create policy "ai_feedback_update_own" on public.ai_feedback for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_member(household_id));

drop policy if exists "ai_feedback_delete_own" on public.ai_feedback;
create policy "ai_feedback_delete_own" on public.ai_feedback for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "ai_feedback_select_own" on public.ai_feedback;
create policy "ai_feedback_select_own" on public.ai_feedback for select to authenticated
  using (user_id = (select auth.uid()));

-- Admin console: totals, the helpful rate, per-intent split and the latest ratings.
-- Content-admin and up, like admin_ai_usage_summary.
create or replace function public.admin_ai_feedback_summary()
  returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare result jsonb;
begin
  if not public.is_admin('content') then
    raise exception 'forbidden: admin role required';
  end if;

  select jsonb_build_object(
    'total',  (select count(*) from ai_feedback),
    'up',     (select count(*) from ai_feedback where rating = 1),
    'down',   (select count(*) from ai_feedback where rating = -1),
    'last30', (select count(*) from ai_feedback where created_at > now() - interval '30 days'),
    'byIntent', (
      select coalesce(jsonb_agg(jsonb_build_object('intent', intent, 'up', up, 'down', down) order by up + down desc), '[]'::jsonb)
      from (
        select coalesce(intent, 'other') as intent,
               count(*) filter (where rating = 1)  as up,
               count(*) filter (where rating = -1) as down
        from ai_feedback group by 1
      ) t
    ),
    'recent', (
      select coalesce(jsonb_agg(r order by (r->>'at') desc), '[]'::jsonb)
      from (
        select jsonb_build_object('at', created_at, 'rating', rating, 'intent', intent,
                                  'surface', surface, 'responseLen', response_len) as r
        from ai_feedback order by created_at desc limit 50
      ) t
    )
  ) into result;
  return result;
end $$;

-- Not reachable without signing in (v10.22 rule: revoke the PUBLIC default anon inherits).
revoke all on function public.admin_ai_feedback_summary() from public, anon;
grant execute on function public.admin_ai_feedback_summary() to authenticated, service_role;

COMMIT;
