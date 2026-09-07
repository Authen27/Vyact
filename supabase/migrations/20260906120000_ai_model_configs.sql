-- ============================================================================
-- AI-P2 — `ai_model_configs`: the model router's configuration table.
-- Companion: vyact-agent-architecture.md §5 (topology), §6 (hosting/secrets),
--            §8 phase P2, §11 (locked decisions).
--
-- Forward-only, additive, idempotent. Creates ONE new table. Touches nothing
-- that exists today: no money table, no RPC, no policy on any existing object.
--
-- WHY THIS TABLE EXISTS
--   Binding rule §2.7a: "providers are OpenAI-compatible so a model swap is a DB
--   ROW, not a deploy." Everything that varies between vLLM, Ollama, Groq,
--   Together, OpenRouter and OpenAI is a value in a row here — endpoint, model
--   id, sampling params, pricing, which secret holds the key. The edge function
--   `ask-vyact` reads this table and changes behaviour without being redeployed.
--
-- 🔴 INERT BY DEFAULT — THIS IS THE POINT, NOT A PRECAUTION.
--   `enabled` DEFAULTS FALSE and this migration inserts NO ROWS. With an empty
--   (or all-disabled) table the gateway resolves no config, calls no provider,
--   spends nothing, and writes no `ai_usage` row — binding rule §2.7b, "the
--   feature's off state is provably byte-identical to today". Applying this
--   migration to production changes observable behaviour by exactly zero.
--
-- 🔴 NO SECRET IS EVER STORED HERE.
--   `key_env_var` holds the NAME of a Supabase Function secret (e.g. the string
--   'OPENROUTER_API_KEY'). The VALUE is read from `Deno.env` inside the edge
--   function and never reaches this table, the repo, a log, or a client bundle
--   (§6 "Secrets"). Two CHECK constraints enforce that mechanically: the name
--   must look like an env var name, and it must not name a platform secret
--   (SUPABASE_*, SERVICE_ROLE, WHATSAPP_*, …) — otherwise one bad row could make
--   the router POST the service-role key to an attacker-chosen `base_url`.
--   A third CHECK rejects anything key-shaped pasted into `params`.
--
-- MONEY MODEL: untouched. Nothing here reads or writes `transactions`,
--   `accounts`, `budgets` or any balance. Binding rule §2.1 — the LLM never
--   computes money — is enforced upstream (the router returns text and tool
--   selections only, and holds no database client at all).
--
-- RLS / GRANT STYLE mirrors 20260816120000_agent_ingestion_state.sql:
--   SECURITY DEFINER helpers (`is_admin`) only, never an inline `auth.uid()` in a
--   policy; explicit service_role policies written out even though service_role
--   bypasses RLS, so the gateway's access is legible in `pg_policies` instead of
--   being an implicit property of the role; no `to public`, no `to anon`.
-- ============================================================================

begin;

create table if not exists public.ai_model_configs (
  id           uuid primary key default gen_random_uuid(),

  -- 🔴 LOAD-BEARING. The app has TWO parallel model selectors (§10.2):
  --    `AssistantBackend` (flag-driven, live) and `ChatBackend` (env-driven,
  --    with a complete but unreachable GeminiChatBackend). A config row that did
  --    not name its seam would let an admin flip a toggle and silently configure
  --    the path they were not looking at. The CHECK is the guard; the router
  --    filters on this column before anything else.
  seam         text not null check (seam in ('chat','assistant')),

  -- Free text on purpose: 'vllm' | 'ollama' | 'groq' | 'together' | 'openrouter'
  -- | 'openai' | … Adding a provider must not need a migration (§2.7a). It is
  -- telemetry and human labelling only — the router branches on nothing here.
  provider     text not null check (length(btrim(provider)) between 1 and 64),

  -- The provider's model id, verbatim, e.g. 'meta-llama/llama-3.3-70b-instruct'.
  model        text not null check (length(btrim(model)) between 1 and 200),

  -- Origin (optionally + path prefix) of an OpenAI-compatible API. The router
  -- appends '/v1/chat/completions'. A localhost value is ACCEPTED here on
  -- purpose — it is a legitimate dev target — and rejected at call time with a
  -- clear "Edge runs in the cloud and cannot reach your machine" result rather
  -- than a crash or a hang.
  base_url     text not null check (base_url ~ '^https?://[^[:space:]]+$'),

  -- 🔴 The NAME of a Supabase secret. NEVER a key. Null/empty = unauthenticated
  --    endpoint, which is the normal case for a local vLLM or Ollama server.
  key_env_var  text,

  -- Sampling + pricing, e.g.
  --   {"temperature":0.2,"max_tokens":800,
  --    "price_per_mtok_input":0.15,"price_per_mtok_output":0.6}
  -- Pricing feeds `ai_usage.cost_usd` — OPERATIONAL SPEND, never ledger money.
  params       jsonb not null default '{}'::jsonb,

  -- 🔴 FALSE BY DEFAULT. This single column is the kill switch.
  enabled      boolean not null default false,

  -- Selection order when more than one row is enabled for a seam:
  -- **HIGHER WINS** (the router sorts `priority desc, id asc`, so selection is
  -- deterministic and reproducible for evals). Exists so P11's model cascade —
  -- primary, then cheaper fallback — is expressible without a schema change.
  priority     int not null default 0 check (priority between 0 and 1000),

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- ── mechanical secret hygiene ────────────────────────────────────────────
  -- 1. If a key_env_var is given it must LOOK like an env var name. A pasted
  --    API key (mixed case, dashes, dots, > 64 chars) cannot satisfy this.
  constraint ai_model_configs_key_env_var_shape_chk
    check (key_env_var is null or key_env_var ~ '^[A-Z][A-Z0-9_]{2,63}$'),

  -- 2. …and it must not name a PLATFORM secret. Without this, an admin row
  --    could make the router read SUPABASE_SERVICE_ROLE_KEY and send it as a
  --    bearer token to any base_url it likes. Deny by pattern so a future
  --    secret is denied by default rather than forgotten. Mirrors
  --    FORBIDDEN_KEY_ENV in supabase/functions/_shared/agent/router.ts.
  constraint ai_model_configs_key_env_var_reserved_chk
    check (
      key_env_var is null
      or (key_env_var !~ '^(SUPABASE|WHATSAPP|SMTP|RESEND|VERCEL|GITHUB|VYACT)_'
          and key_env_var !~ 'SERVICE_ROLE'
          and key_env_var !~ 'JWT'
          and key_env_var !~ '(^|_)(DB|DATABASE)_')
    ),

  -- 3. Nothing key-shaped in `params`. The router already allowlists the body
  --    keys it forwards, so a smuggled credential would be dropped — but it
  --    would still be sitting in a DB row, readable by every admin. Reject it
  --    at write time instead. Text-level regex so nesting cannot hide it.
  --
  --    The key name must EQUAL (or end with `_` + ) a credential word — it is
  --    deliberately not a substring match, because the single most common
  --    legitimate param is `max_tokens`, and `"...token..."` would reject it.
  --      blocked : "key", "api_key", "OPENROUTER_API_KEY", "secret", "token",
  --                "password", "authorization", "bearer", "credential"
  --      allowed : "max_tokens", "temperature", "top_p", "seed", "stop",
  --                "price_per_mtok_input", "price_per_mtok_output"
  constraint ai_model_configs_params_no_secrets_chk
    check (params::text !~* '"([A-Za-z0-9_]*_)?(api_?key|apikey|key|secret|token|password|passwd|authorization|bearer|credential)"[[:space:]]*:'),

  -- 4. An ENABLED row must be complete. A half-configured row that is switched
  --    on is the one way this table could produce a surprise at runtime.
  constraint ai_model_configs_enabled_complete_chk
    check (
      enabled = false
      or (length(btrim(model)) > 0 and length(btrim(base_url)) > 0 and provider is not null)
    )
);

-- The router's read path, verbatim: enabled rows for one seam, best first.
create index if not exists idx_ai_model_configs_seam_enabled_priority
  on public.ai_model_configs (seam, enabled, priority desc);

-- One row per (seam, provider, model, endpoint). Stops the "I enabled the wrong
-- duplicate" class of incident; still allows the same model on two seams, which
-- is a legitimate configuration.
create unique index if not exists uq_ai_model_configs_identity
  on public.ai_model_configs (seam, provider, model, base_url);

drop trigger if exists touch_ai_model_configs on public.ai_model_configs;
create trigger touch_ai_model_configs before update on public.ai_model_configs
  for each row execute function public.set_updated_at();

comment on table public.ai_model_configs is
  'Model router configuration (vyact-agent-architecture.md §5/§6, P2). A model swap is a ROW CHANGE here, not a deploy. INERT BY DEFAULT: enabled defaults false and no rows ship, so the gateway calls nothing and spends nothing until a super-admin turns one on. Holds NO SECRETS — key_env_var is the NAME of a Supabase Function secret; the value lives only in the edge runtime.';
comment on column public.ai_model_configs.seam is
  'LOAD-BEARING. Which of the app''s two model selectors this row configures: ''chat'' (ChatBackend) or ''assistant'' (AssistantBackend). Two selectors exist (§10.2); without this column an admin toggle could silently configure the path they were not looking at.';
comment on column public.ai_model_configs.provider is
  'Human/telemetry label (''vllm'',''ollama'',''groq'',''openrouter'',''openai'',…). Copied to ai_usage.provider. The router branches on NOTHING here — every provider is called through the same OpenAI-compatible contract, which is what makes a swap a row change.';
comment on column public.ai_model_configs.base_url is
  'Origin of an OpenAI-compatible API; the router appends ''/v1/chat/completions''. A localhost/LAN value is allowed and is a normal dev target, but Supabase Edge runs in the cloud and cannot reach a developer machine — the router detects that BEFORE calling and returns a clear, non-fatal ''unreachable'' result instead of hanging.';
comment on column public.ai_model_configs.key_env_var is
  '🔴 The NAME of a Supabase Function secret (e.g. ''OPENROUTER_API_KEY''), never a key. The value is read from Deno.env inside ask-vyact and never reaches this table, the repo, a log or any client bundle (§6). NULL means the endpoint needs no auth — the normal case for a local vLLM/Ollama server. Two CHECK constraints stop this naming a platform secret, so a bad row cannot exfiltrate the service-role key to an arbitrary base_url.';
comment on column public.ai_model_configs.params is
  'Sampling + pricing as jsonb. price_per_mtok_input/output feed ai_usage.cost_usd — OPERATIONAL SPEND (our provider bill), never ledger money: binding rule §2.1 keeps every user-facing figure coming from resolve()/an RPC. Values are clamped by the router; unknown keys are dropped.';
comment on column public.ai_model_configs.enabled is
  '🔴 THE KILL SWITCH. Defaults FALSE. With no enabled row for a seam the gateway performs no provider call, writes no ai_usage row, and leaves existing behaviour byte-identical to today (binding rule §2.7b). Flipping this to true authorises real spend.';
comment on column public.ai_model_configs.priority is
  'Selection order among enabled rows for one seam: HIGHER WINS (router sorts priority desc, id asc — deterministic, so evals are reproducible). Exists so the P11 model cascade (primary → cheaper fallback) needs no schema change.';

-- ============================================================================
-- RLS
--
-- Read: ANY admin (`is_admin()` with no minimum role) — the AI Config page needs
--       to render current state, and the row carries no secret to leak.
-- Write: `is_admin('super')` ONLY. Enabling a row authorises real money to be
--       spent against a provider, and choosing base_url decides where an API key
--       is sent. That is a super-admin decision, matching how the admin console
--       gates its other destructive surfaces.
-- Normal users: NO access at all. The gateway reads this table with the service
--       role on their behalf; an end user never needs, and never gets, sight of
--       the model configuration.
-- ============================================================================

alter table public.ai_model_configs enable row level security;

drop policy if exists "ai_model_configs_select"       on public.ai_model_configs;
drop policy if exists "ai_model_configs_insert"       on public.ai_model_configs;
drop policy if exists "ai_model_configs_update"       on public.ai_model_configs;
drop policy if exists "ai_model_configs_delete"       on public.ai_model_configs;
drop policy if exists "ai_model_configs_service_role" on public.ai_model_configs;

create policy "ai_model_configs_select" on public.ai_model_configs
  for select to authenticated
  using (is_admin());

create policy "ai_model_configs_insert" on public.ai_model_configs
  for insert to authenticated
  with check (is_admin('super'));

-- WITH CHECK repeats the USING test so a super-admin check cannot be dodged by
-- an UPDATE that would otherwise be evaluated only against the OLD row.
create policy "ai_model_configs_update" on public.ai_model_configs
  for update to authenticated
  using (is_admin('super'))
  with check (is_admin('super'));

create policy "ai_model_configs_delete" on public.ai_model_configs
  for delete to authenticated
  using (is_admin('super'));

create policy "ai_model_configs_service_role" on public.ai_model_configs
  for all to service_role using (true) with check (true);

-- ============================================================================
-- GRANTS — least privilege. No `to public`, no `to anon`.
-- Table privileges are granted to `authenticated` and NARROWED BY RLS above to
-- admins (read) / super-admins (write) — the same layering used by the agent
-- ingestion tables. `anon` is explicitly revoked.
-- ============================================================================

grant select, insert, update, delete on public.ai_model_configs to authenticated;
grant select, insert, update, delete on public.ai_model_configs to service_role;

revoke all on public.ai_model_configs from anon;

-- ============================================================================
-- NO SEED ROWS. Deliberately.
--
-- Switching the gateway on is an explicit, auditable act by a super-admin, not a
-- side effect of applying a migration. For reference, an operator enables a
-- provider with (values below are ILLUSTRATIVE — note that key_env_var is a
-- variable NAME; the key itself is set out-of-band with
-- `supabase secrets set <NAME>=…` and never appears in SQL):
--
--   insert into public.ai_model_configs
--     (seam, provider, model, base_url, key_env_var, params, enabled, priority)
--   values
--     ('assistant', 'vllm', 'qwen2.5-7b-instruct',
--      'https://your-inference-host.example.com', null,
--      '{"temperature":0.2,"max_tokens":800}'::jsonb, false, 100);
--
-- …then flips `enabled = true` only after the §7 evals and the §9 spend gate say
-- so. Until that flip the endpoint is a no-op that costs nothing.
-- ============================================================================

commit;
