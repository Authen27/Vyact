-- ============================================================================
-- v10.37.0 — Claude Code relay queue for Ask Vyact (TEST-WINDOW WORKAROUND).
--
-- WHY
-- The free OpenRouter model timed out (20 s gateway budget) on nearly every call,
-- so Ask Vyact answered "I can't reach the assistant". For the duration of a test
-- cycle the product owner asked for a developer's Claude Code session to stand in
-- as the model. The `ask-vyact` gateway queues the exact messages the model would
-- have received here; the Claude Code session writes the answer; the client polls.
--
-- CONTRACT
--   • Written and read ONLY by the service role (the gateway) and the operator's
--     Supabase access. RLS is enabled with NO policies and anon/authenticated hold
--     no privileges — no browser can read or write a row.
--   • 🔴 This table stores message CONTENT. That is a deliberate, TEMPORARY
--     exception to the ai_usage "metadata only" rule, scoped to the allowlisted
--     test account(s) in the relay's ai_model_configs row. Rows are purged when
--     testing ends, and the relay is removed (TECH_DEBT.md TD-44).
--   • Nothing else reads it; no money table, RPC or policy on an existing object
--     is touched.
-- ============================================================================

BEGIN;

create table if not exists public.ask_vyact_relay (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  household_id    uuid references public.households(id) on delete set null,
  reservation_id  uuid,
  call_kind       text not null default 'other',
  messages        jsonb not null,
  max_tokens      int,
  response        text,
  status          text not null default 'pending',
  answered_at     timestamptz,
  constraint ck_ask_vyact_relay_call_kind check (call_kind in ('classify','phrase','other')),
  constraint ck_ask_vyact_relay_status check (status in ('pending','answered','expired')),
  constraint ck_ask_vyact_relay_answered check (status <> 'answered' or (response is not null and answered_at is not null))
);

create index if not exists ix_ask_vyact_relay_pending
  on public.ask_vyact_relay (created_at) where status = 'pending';
create index if not exists ix_ask_vyact_relay_user
  on public.ask_vyact_relay (user_id, created_at desc);

alter table public.ask_vyact_relay enable row level security;
revoke all on public.ask_vyact_relay from anon, authenticated;

comment on table public.ask_vyact_relay is
  'TEMPORARY (v10.37.0, TD-44): Claude Code relay queue for Ask Vyact testing. Stores message content for allowlisted test accounts only; service role only; purge after testing.';

COMMIT;
