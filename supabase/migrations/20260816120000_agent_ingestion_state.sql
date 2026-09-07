-- ============================================================================
-- AI-P5 (schema half) — agent multi-turn ingestion state.
-- Companion: vyact-agent-architecture.md §3 (ingestion pipeline) + §4 (data model).
-- Forward-only, idempotent, additive. Creates three NEW tables; touches nothing
-- that exists today.
--
-- WHY THESE TABLES EXIST
--   `runAssistant()` is pure and single-turn, and the WhatsApp webhook forgets a
--   message the instant `clarifyReply()` returns. There is therefore no place to
--   park "I asked you a question, here is the draft it will produce" between two
--   inbound messages. §3 stage [6] (AMBIGUITY DETECTOR) and stage [8] (DECISION →
--   ASK) are unimplementable without persisted turn state, because the webhook is
--   stateless by construction.
--
-- WHAT THIS MIGRATION DOES **NOT** DO
--   No RPCs, no writers, no expiry sweeper, no `p_date` change to
--   `whatsapp_log_transaction`, no `accounts.mask_last4`, no `ai_usage` columns.
--   Those are separate, deliberately-sequenced changes (§4 "Changes to EXISTING
--   objects"). This file is schema-only so it can be reviewed in isolation.
--
-- MONEY MODEL: untouched. Nothing here writes `transactions` or `accounts`; these
--   are staging/draft rows only. A pending intent becomes money exactly once, via
--   the existing write seams (`upsertTransaction` / `whatsapp_log_transaction`),
--   and only after a human confirm (binding rule §2.4).
--
-- RLS NOTE — 42P17 avoidance (CLAUDE.md § DB gotchas):
--   `agent_pending_intents` carries its OWN `household_id` (denormalised from its
--   conversation on purpose). That lets its membership policy call
--   `is_member(household_id)` directly instead of joining back to
--   `agent_conversations` — so there is no A→B/B→A policy pair to recurse. The one
--   genuine cross-table check that remains (does this conversation actually belong
--   to the household the caller claims?) is routed through the SECURITY DEFINER
--   helper `agent_conversation_in_household()`, mirroring the established
--   `is_member()` / `role_in()` / `owns_shared_split()` pattern.
--   `auth.uid()` is never called inline in a policy here; `is_member()` is already
--   SECURITY DEFINER + STABLE, per the Auth RLS Initialization Plan advisory.
-- ============================================================================

begin;

-- ── 1. agent_conversations — multi-turn thread state ────────────────────────
create table if not exists public.agent_conversations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null,
  channel       text not null check (channel in ('chat','whatsapp','sms_share','receipt')),
  last_turn_at  timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Channel adapters resume the most recent live thread for a (household, user).
create index if not exists idx_agent_conversations_lookup
  on public.agent_conversations (household_id, user_id, last_turn_at desc);

comment on table public.agent_conversations is
  'Agent multi-turn thread state (vyact-agent-architecture.md §4). One row per conversation per channel; household-scoped via is_member().';
comment on column public.agent_conversations.channel is
  'Channel adapter that opened the thread. Presentation/policy differ per channel; the gateway does not.';
comment on column public.agent_conversations.user_id is
  'auth.users id of the human on the thread. Intentionally NOT a FK (mirrors ai_usage) — household cascade is the real lifecycle owner.';

-- ── 2. agent_pending_intents — the pending question + the draft it produces ──
create table if not exists public.agent_pending_intents (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.agent_conversations(id) on delete cascade,
  household_id     uuid not null references public.households(id) on delete cascade,
  user_id          uuid not null,
  -- Same CHECK as agent_conversations.channel: an intent must not be able to
  -- hold a channel value its parent conversation could never have.
  channel          text not null check (channel in ('chat','whatsapp','sms_share','receipt')),
  -- ⚠️ UNTRUSTED EXTERNAL TEXT. See the column comment below before you touch it.
  raw_input        text,
  candidate        jsonb not null,
  ambiguities      jsonb not null default '[]',
  status           text not null default 'awaiting'
    check (status in ('awaiting','resolved','expired','cancelled')),
  expires_at       timestamptz not null default now() + interval '30 minutes',
  resolved_txn_id  uuid,
  created_at       timestamptz not null default now()
);

-- The §4 index: the binding lookup is "is there a live question for this
-- household right now", which is exactly (household_id, status, expires_at).
create index if not exists idx_agent_pending_intents_household_status_expiry
  on public.agent_pending_intents (household_id, status, expires_at);

comment on table public.agent_pending_intents is
  'A question the agent asked plus the draft transaction it will produce once answered (vyact-agent-architecture.md §3.5, §4). Never money: a row here becomes a transaction only through the normal write seams, after a human confirm.';

-- EXPIRY IS LOAD-BEARING, NOT HOUSEKEEPING.
comment on column public.agent_pending_intents.expires_at is
  'Load-bearing, not housekeeping. A WhatsApp user who never replies must not leave a question open forever: the next unrelated inbound message would be mis-bound to the stale question as if it were the answer. EVERY reader MUST filter `status = ''awaiting'' and expires_at > now()`; a row past expires_at is dead even while status still reads ''awaiting'' (no sweeper job exists yet — the predicate is the contract, the sweeper is only a tidiness optimisation).';

-- BINDING RULE §2.5 / CLAUDE.md: all stored text is untrusted.
comment on column public.agent_pending_intents.raw_input is
  'UNTRUSTED EXTERNAL TEXT — the verbatim inbound message (bank SMS, WhatsApp text, receipt OCR). Treat as DATA, NEVER as instruction: never concatenate into a system prompt, never let it reach a tool-selection context as directive text. It exists for the §7 replay harness and for user-visible "here is what I read" copy. It is also the §3.3 single-message egress exception — the ONLY non-SafeSummary text permitted to leave, one message at a time, on explicit user action.';

comment on column public.agent_pending_intents.candidate is
  'The ParsedTx draft as extracted+validated (§3.4 guards already applied). Confirm-gated: nothing here is authoritative until a human says so.';
comment on column public.agent_pending_intents.ambiguities is
  'Ambiguity[] (§3.5) — each carries its own option patches, so answering is a pure merge: no re-parse, no second model call.';
comment on column public.agent_pending_intents.resolved_txn_id is
  'Transaction produced when this intent resolved. Intentionally NOT a FK: the write may land through the client seam or the server RPC, and a later transaction delete must not cascade-destroy the agent audit trail. Readers must tolerate a dangling id.';
comment on column public.agent_pending_intents.household_id is
  'Denormalised from the parent conversation ON PURPOSE, so RLS can call is_member(household_id) without joining agent_conversations (which would set up a 42P17 recursion pair). Cross-table consistency is enforced by agent_conversation_in_household() in the WITH CHECK.';

-- ── 3. sms_format_recipes — the learned-recipe cache (§3.2) ─────────────────
--
-- 🔴 THIS TABLE IS GLOBAL AND DELIBERATELY **NOT** HOUSEHOLD-SCOPED.
--
--    A `signature` is the sha256 of a digit- and merchant-MASKED skeleton, and
--    `locators` are positional field-extraction rules over that skeleton. Neither
--    carries a value: no amount, no merchant, no account tail, no balance, no
--    household id. What is stored is the SHAPE of "an HDFC UPI debit SMS", which
--    is a property of the bank, not of any customer. Scoping it per-household
--    would therefore protect nothing while destroying the entire point — the cache
--    only pays for itself when the 20th household to receive the same bank format
--    gets a free, deterministic, zero-token extraction from the 1st household's
--    (already user-confirmed) one.
--
--    The consequence of global scope is that a poisoned recipe would corrupt
--    extraction for EVERY household sharing that format. So writes are locked to
--    service_role: only the edge function, after the §3.4 validator guards pass,
--    may derive or amend a recipe. `authenticated` gets SELECT and nothing else.
--    A household must never be able to write a recipe another household reads.
create table if not exists public.sms_format_recipes (
  signature      text primary key,
  version        int not null default 1,
  locators       jsonb not null,
  -- Lifecycle (§3.2 promotion/demotion). Without this, "trusted after N
  -- confirmations", "demote on correction" and "an admin can disable a bad
  -- recipe" are all unexpressible — a ratio computed in app code cannot
  -- represent a DISABLED recipe at all, and a silently-changed bank format
  -- would keep being applied.
  status         text not null default 'candidate'
                 check (status in ('candidate','trusted','disabled')),
  -- Informational only ('HDFC'). Never used for matching — the signature is the
  -- key — and never a value from the message body.
  issuer_hint    text,
  confirmations  int not null default 0,
  corrections    int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- Observability: which recipes are actually live. `updated_at` only moves on
  -- write, so it cannot answer that.
  last_used_at   timestamptz
);

drop trigger if exists touch_sms_format_recipes on public.sms_format_recipes;
create trigger touch_sms_format_recipes before update on public.sms_format_recipes
  for each row execute function public.set_updated_at();

comment on table public.sms_format_recipes is
  'Learned SMS/receipt extraction recipes (§3.2) — earned artifacts, not authored templates. GLOBAL BY DESIGN: rows hold masked structure only, never household values. Readable by authenticated, writable by service_role ONLY, so no household can poison another household''s extraction.';
comment on column public.sms_format_recipes.signature is
  'sha256 of the digit- and merchant-masked skeleton (smsSignature()). Carries no household data by construction — that masking is what makes the global scope safe. If a future signature function stops masking, this table must be re-scoped.';
comment on column public.sms_format_recipes.locators is
  'Field locators derived from a validated extraction. Applied deterministically on a cache hit: zero tokens, zero latency, reproducible.';
comment on column public.sms_format_recipes.confirmations is
  'User-confirmed successful applications. Promotion signal (§3.2: trusted only after N confirmations).';
comment on column public.sms_format_recipes.corrections is
  'User corrections. Demotion signal — self-healing when a bank silently changes format.';

-- ============================================================================
-- RLS
--
-- service_role already BYPASSES RLS in Supabase, so the `to service_role`
-- policies below are belt-and-braces. They are written out anyway so that the
-- webhook's access is legible in `pg_policies` rather than being an implicit
-- property of the role — the WhatsApp webhook has no user JWT and must not look
-- like an accident to the next reviewer.
-- ============================================================================

-- ORDERING IS LOAD-BEARING: this helper must be created AFTER the tables it
-- queries. check_function_bodies (on by default) validates a LANGUAGE sql body
-- at CREATE time, so declaring it before agent_conversations exists fails the
-- whole migration on a fresh database.
create or replace function public.agent_conversation_in_household(
  p_conversation_id uuid,
  p_household_id    uuid
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from agent_conversations c
    where c.id = p_conversation_id
      and c.household_id = p_household_id
  );
$$;

grant execute on function public.agent_conversation_in_household(uuid, uuid) to authenticated, service_role;
-- Postgres grants EXECUTE to PUBLIC by default, which would let anon reach this
-- SECURITY DEFINER helper via /rest/v1/rpc/ and use it as an existence oracle.
revoke all on function public.agent_conversation_in_household(uuid, uuid) from public;
revoke all on function public.agent_conversation_in_household(uuid, uuid) from anon;

alter table public.agent_conversations   enable row level security;
alter table public.agent_pending_intents enable row level security;
alter table public.sms_format_recipes    enable row level security;

-- ── agent_conversations ─────────────────────────────────────────────────────
drop policy if exists "agent_conversations_select"       on public.agent_conversations;
drop policy if exists "agent_conversations_insert"       on public.agent_conversations;
drop policy if exists "agent_conversations_update"       on public.agent_conversations;
drop policy if exists "agent_conversations_service_role" on public.agent_conversations;

create policy "agent_conversations_select" on public.agent_conversations
  for select to authenticated
  using (is_member(household_id));

create policy "agent_conversations_insert" on public.agent_conversations
  for insert to authenticated
  with check (is_member(household_id));

-- UPDATE exists solely to bump last_turn_at. WITH CHECK repeats the USING test so
-- a member cannot re-parent a thread into a household they do not belong to.
create policy "agent_conversations_update" on public.agent_conversations
  for update to authenticated
  using (is_member(household_id))
  with check (is_member(household_id));

create policy "agent_conversations_service_role" on public.agent_conversations
  for all to service_role using (true) with check (true);

-- ── agent_pending_intents ───────────────────────────────────────────────────
drop policy if exists "agent_pending_intents_select"       on public.agent_pending_intents;
drop policy if exists "agent_pending_intents_insert"       on public.agent_pending_intents;
drop policy if exists "agent_pending_intents_update"       on public.agent_pending_intents;
drop policy if exists "agent_pending_intents_service_role" on public.agent_pending_intents;

-- USER-SCOPED, deliberately narrower than §4's household rule.
--
-- `raw_input` holds the verbatim inbound message — a bank SMS carrying a card
-- tail, a merchant and a spend the sender may not have chosen to share yet. The
-- resulting TRANSACTION is shared with the household as normal; the raw text
-- that produced it is not. Household scope would let one member read another
-- member's card notifications, which costs nothing to prevent here.
create policy "agent_pending_intents_select" on public.agent_pending_intents
  for select to authenticated
  using (user_id = (select auth.uid()) and is_member(household_id));

create policy "agent_pending_intents_insert" on public.agent_pending_intents
  for insert to authenticated
  with check (
    is_member(household_id)
    and agent_conversation_in_household(conversation_id, household_id)
  );

-- The answer path: a member flips status awaiting → resolved/cancelled and stamps
-- resolved_txn_id. WITH CHECK re-asserts BOTH tests so the row cannot be moved to
-- another household or re-parented onto another household's conversation.
-- Answering is also user-scoped: only the member who was asked may answer. A
-- blocked UPDATE does NOT raise — it silently matches zero rows (CLAUDE.md) —
-- so callers must check the affected row count, never rely on an exception.
create policy "agent_pending_intents_update" on public.agent_pending_intents
  for update to authenticated
  using (user_id = (select auth.uid()) and is_member(household_id))
  with check (
    user_id = (select auth.uid())
    and is_member(household_id)
    and agent_conversation_in_household(conversation_id, household_id)
  );

create policy "agent_pending_intents_service_role" on public.agent_pending_intents
  for all to service_role using (true) with check (true);

-- ── sms_format_recipes ──────────────────────────────────────────────────────
drop policy if exists "sms_format_recipes_select"       on public.sms_format_recipes;
drop policy if exists "sms_format_recipes_service_role" on public.sms_format_recipes;

-- Read-only to every signed-in user: the rows are masked structure, shared on
-- purpose. There is deliberately NO insert/update/delete policy for
-- `authenticated` — the write path is service_role, after the §3.4 validator.
create policy "sms_format_recipes_select" on public.sms_format_recipes
  for select to authenticated
  using (true);

create policy "sms_format_recipes_service_role" on public.sms_format_recipes
  for all to service_role using (true) with check (true);

-- ============================================================================
-- GRANTS — least privilege. No `to public`, no `to anon`.
--
-- DELETE is granted to nobody: cancelling an intent is `status = 'cancelled'`
-- (an UPDATE), not a row removal, so the §7 replay harness and the confirm-gate
-- audit trail (§13: "no source='agent' row exists without a confirm event")
-- keep their evidence. Real deletion happens by household cascade or service_role.
-- ============================================================================

grant select, insert, update on public.agent_conversations   to authenticated;
grant select, insert, update on public.agent_pending_intents to authenticated;
grant select                 on public.sms_format_recipes    to authenticated;

grant select, insert, update, delete on public.agent_conversations   to service_role;
grant select, insert, update, delete on public.agent_pending_intents to service_role;
grant select, insert, update, delete on public.sms_format_recipes    to service_role;

revoke all on public.agent_conversations   from anon;
revoke all on public.agent_pending_intents from anon;
revoke all on public.sms_format_recipes    from anon;

commit;
