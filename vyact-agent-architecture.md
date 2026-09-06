# Vyact Agent Service — Architecture & Implementation Plan

**Status:** DESIGN APPROVED · awaiting implementation sign-off · **P0 partially shipped** (metering, v10.19.0)
**Audience:** the implementing engineer. **This document is self-contained** — it is the only file you
need to load to build the agent. Do not re-derive context from the wider app.
**Companions (read only if a section points you there):**
[`vyact-ask-vyact-engineering-spec.md`](vyact-ask-vyact-engineering-spec.md) (the 5-stage pipeline this
extends) · [`whatsapp-vyact-solutioning.md`](whatsapp-vyact-solutioning.md) (channel 2).

> ⚠️ **The agent is NOT live.** Ask Vyact today is 100% rules-based and on-device. Every "no AI /
> nothing leaves this device" string in the product is currently **true** and must stay true until the
> release that changes it. See §12.

---

## 0. Service boundary (read this first — it is why the doc is short)

The agent is an **independent service** with a hard boundary. Everything it owns lives in three places:

| Owns | Path |
|---|---|
| Gateway + agent loop | `supabase/functions/ask-vyact/` |
| Agent internals (pure, portable) | `supabase/functions/_shared/agent/` |
| Persistence | `agent_*` tables + `ai_model_configs` + `ai_usage` |

It **consumes** the app through three narrow, already-existing seams and nothing else:
1. `useStore().upsertTransaction` (client writes) / `whatsapp_log_transaction` RPC (server writes)
2. `resolve()` + `lib/calculations.ts` (money computation — via `_shared/agent/tools/*`)
3. `buildSafeSummary()` (the only shape allowed to egress)

**Consequence for implementation:** a session building the agent loads *this file* plus the specific
seam it is touching. It does not need the Aurora design system, the Insights hub, onboarding, or the
admin CMS. Keep it that way — the boundary is a token-budget decision as much as an architectural one.

---

## 1. The core decision — a service, not an app

**There is no separate agent app.** One server-side service behind one HTTPS endpoint. PWA, Android
(future Capacitor), iOS (future) and WhatsApp all call the same gateway through **channel adapters**;
only presentation and policy differ per channel.

```
CHANNEL ADAPTERS                    AGENT CORE (Supabase Edge, Deno)          MODEL ROUTER (OpenAI-compatible)
┌──────────────────┐                ┌────────────────────────────────┐        ┌──────────────────────────┐
│ Ask Vyact (PWA/  │───┐            │ authn + RLS (user JWT)         │        │ PROD: OpenRouter / Groq  │
│  Android/iOS)    │   │            │ ─────────────────────────────  │───────►│       (hosted OSS)       │
│  chips, confirm  │   ├───────────►│ T0 rules router   (free)       │        │ DEV : local GPU + vLLM   │
├──────────────────┤   │            │ T1 agent + tools  (1 model)    │        │ OPT : Claude / frontier  │
│ WhatsApp         │   │            │ T2 supervisor + specialists    │        └──────────────────────────┘
│  plain text,     │───┤            │ ─────────────────────────────  │
│  numbered replies│   │            │ INGESTION PIPELINE (§3)        │
├──────────────────┤   │            │ tools ──► DETERMINISTIC MONEY  │  _shared/agent/tools + Postgres RPCs
│ Shared SMS /     │───┘            │ memory ─► pgvector             │
│ receipt photo    │                │ metering ► ai_usage (spend gate)│
└──────────────────┘                └────────────────────────────────┘
```

**Why a Supabase Edge Function:** Vercel here is a *pure static host* (no `api/`, no `functions` block
in `vercel.json`), so Edge Functions are the only server compute. They are co-located with data/RLS,
already hold service-role secrets, and already have a CI deploy path. LLM calls are I/O-bound so the
CPU cap is not binding. ⚠️ **Verify wall-clock limits against the live project — undocumented in-repo.**

---

## 2. Binding rules (violating one is a regression)

1. **The LLM never computes money.** It selects tools, *extracts fields*, and phrases returns. Every
   figure comes from `resolve()` or a Postgres RPC. Extraction ≠ computation: reading "850" out of an
   SMS is allowed; deciding what 850 does to your balance is not.
2. **Hybrid, not replacement.** Rules answer first (T0); the model runs only on a miss.
3. **Reads and writes are separated.** `planner` holds read tools only. `actions` writes and is
   **propose → user confirms**.
4. **"If a model touched it, a human confirms it."** The existing deterministic parser keeps writing
   instantly (provably correct, already validated in prod). **100% of model-originated writes are
   confirm-gated.**
5. **All stored text is untrusted.** `transactions.description` already carries WhatsApp-ingested
   external text; SMS adds more. Treat every DB string and every inbound message as *data*, never as
   instruction.
6. **"Learning" = context + memory, never fine-tuning.** Per-household financial data creates
   cross-tenant leakage risk.
7. **Plug-n-play, two meanings, both binding.** *(a)* providers are OpenAI-compatible so a model swap
   is a DB row; *(b)* house meaning (spec §0/§2) — the feature's **off state is provably
   byte-identical to today**, enforced by test.
8. **Only `SafeSummary`-shaped data may egress, and only with consent.** No merchant names, no
   descriptions, no notes — except the single inbound message being parsed (§3.3).

---

## 3. THE INGESTION PIPELINE

**Requirement:** *understand an SMS, or any other way a user logs a transaction, and ask for the right
input when there are multiple interpretations.*

**Design decision (locked):** bank/card SMS formats vary enormously across banks, card issuers and
locales, and change without notice. Hand-maintained templates do not scale. So: **the LLM does the
extraction, and the system LEARNS a reusable recipe from it.** Templates are *earned artifacts*, not
authored code.

### 3.1 Stages
```
RAW INPUT ─ chat · WhatsApp · shared SMS · receipt photo · voice ─┐
                                                                  ▼
[1] CHANNEL ADAPTER    → { text, imageRef?, channel, userId, householdCandidates[] }
[2] FORMAT CLASSIFIER  → bank_sms | free_text | receipt_img | query | chitchat   (cheap, rules-first)
[3] EXTRACTOR CASCADE  → A. learned-recipe cache hit   (deterministic, FREE)     ─┐ first
                         B. command grammar (existing)  (deterministic, FREE)     ─┤ confident
                         C. LLM structured extraction   (model, costs tokens)     ─┘ hit wins
[4] VALIDATOR          → deterministic guards on the model's output (§3.4) ← NON-NEGOTIABLE
[5] RESOLVER           → accounts · categories · household · currency · REAL date (may be backdated)
[6] AMBIGUITY DETECTOR → Ambiguity[] each with a question + 2-4 option patches
[7] DEDUPE CHECK       → content-addressed id + fuzzy near-match
[8] DECISION           → ambiguous → ASK · duplicate → ASK · clean+rules → WRITE · clean+model → DRAFT
[9] WRITER             → upsertTransaction (client) | whatsapp_log_transaction RPC (server)
                         provenance: source='agent', confidence='estimated' until confirmed
```

### 3.2 The learned-recipe cache (this is the cost control — do not skip)
A naive "LLM per SMS" is correct but pays tokens forever for the same 20 formats. Instead:

```ts
/** digits→#, amounts→#, dates→# … so every HDFC UPI debit collapses to ONE signature. */
export function smsSignature(text: string): string;   // → sha256 of the skeleton
```

- **Cache miss** → LLM extracts structured fields → validator (§3.4) → derive a recipe (field
  locators) → store in `sms_format_recipes` keyed by signature.
- **Cache hit** → apply the recipe deterministically. **Zero tokens, zero latency, reproducible.**
- A recipe is **promoted to trusted** only after N successful, user-confirmed extractions; until then
  its output still requires confirmation.
- Admin can **inspect/disable** a recipe (observability without authoring). A user correction on a
  cached recipe **demotes** it — self-healing when a bank silently changes format.

This gives template-grade determinism and cost with zero template maintenance, in any locale.

### 3.3 Privacy note — the one deliberate exception
Rule 8 says only `SafeSummary` egresses. SMS/receipt extraction necessarily sends **the single message
being parsed**. That is a conscious, scoped exception: one message, on explicit user action (they
shared/forwarded it), never the ledger. It must be stated in the consent copy and the privacy policy.

### 3.4 Validator — deterministic guards on model output (NON-NEGOTIABLE)
An LLM reading a bank SMS can mistake the **available balance** for the transaction amount. Never
trust the extraction; verify it:

| Guard | Rule |
|---|---|
| **Amount present in source** | The extracted amount must appear verbatim (modulo grouping) in the raw text. Rejects invention. |
| **Not a balance** | Reject if the matched amount's nearest preceding label is `Avl Bal · Available Balance · Bal · Avl Lmt · Credit Limit · Total Due · Min Due`. |
| **Polarity explicit** | `debit` requires a debit verb (`debited/spent/paid/withdrawn/sent`), `credit` a credit verb. If both or neither → **ambiguity**, not a guess. |
| **Date sane** | Parsed date must be ≤ today (+36h skew) and within ~13 months. |
| **Account mask** | If a masked tail is extracted it must be 4 digits and appear in source. |
| **Currency** | Must be an ISO code present in `CURRENCY_REGISTRY`. |
| **Range sanity** | Amount > 0 and below a configurable per-household ceiling → else confirm. |

Guards run on **every** extraction path (LLM, recipe, grammar). A guard failure degrades confidence
and forces confirmation; it never silently drops the message.

### 3.5 Ambiguity model (drives the quick-reply UX)
```ts
export type AmbiguityKind =
  | 'txn_type'   // "1200 amex" → expense on card | paying the card bill | transfer
  | 'account' | 'household' | 'category' | 'date' | 'duplicate' | 'polarity';
export interface Ambiguity {
  kind: AmbiguityKind;
  question: string;
  options: { id: string; label: string; patch: Partial<ParsedTx> }[];  // 2-4
}
```
Each option carries the **patch** it applies, so answering is a pure merge — **no re-parse, no second
model call**. Renders as chips in-app, numbered list on WhatsApp (`Reply 1, 2 or 3`).
**Household is always asked when the user has >1 household** (locked; you have 4).

---

## 4. Data model

```sql
-- Multi-turn state. NONE exists today: runAssistant() is pure/single-turn and
-- WhatsApp forgets immediately after clarifyReply().
create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null,
  channel text not null check (channel in ('chat','whatsapp','sms_share','receipt')),
  last_turn_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- The pending question + the draft it will produce. Makes "ask for the right
-- input" possible across a stateless webhook.
create table public.agent_pending_intents (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references agent_conversations(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null,
  channel text not null,
  raw_input text,                    -- UNTRUSTED. never fed as instruction
  candidate jsonb not null,
  ambiguities jsonb not null default '[]',
  status text not null default 'awaiting'
    check (status in ('awaiting','resolved','expired','cancelled')),
  expires_at timestamptz not null default now() + interval '30 minutes',
  resolved_txn_id uuid,
  created_at timestamptz not null default now()
);
create index on agent_pending_intents (household_id, status, expires_at);

-- Learned SMS/receipt recipes (§3.2). Replaces hand-authored templates.
create table public.sms_format_recipes (
  signature text primary key,        -- sha256 of the digit-masked skeleton
  issuer_hint text,                  -- 'HDFC' if detectable; informational only
  recipe jsonb not null,             -- field locators derived from the LLM extraction
  status text not null default 'candidate'
    check (status in ('candidate','trusted','disabled')),
  success_count int not null default 0,
  correction_count int not null default 0,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
```
**RLS:** `agent_*` = household members via `is_member()`, service_role for the webhook.
`sms_format_recipes` holds **no household data** (skeletons only, digits masked) — readable by
authenticated, writable by service_role + `is_admin('super')`.

### Changes to EXISTING objects (each load-bearing)
| Object | Change | Why |
|---|---|---|
| `whatsapp_log_transaction` RPC | **add `p_date date default null`** | Hardcodes `current_date` → **cannot backdate**; breaks every late-arriving SMS |
| `types.ts` `ProvenanceSource` | add `'agent'` | Reusing `'bank'` would be dishonest |
| `EstimatedTag.tsx` | source-aware copy | Current text says *"during setup"* — wrong for an agent row |
| Transaction list rows | render `<EstimatedTag/>` | **No transaction sets `confidence` today**; agent rows are the first |
| `accounts` | add `mask_last4 text` | Map `A/c XX4471` → a Vyact account |
| `AssistantTurn` | carry `chip` + `ambiguities` | `ResolveResult.chip` is **dead code** — dropped at the `runAssistant` boundary. It is the disambiguation surface |
| `AssistantBackend` | make **async** | Touches `runAssistant`, `Chat.tsx`, 5 test call sites |
| `ai_usage` | add `conversation_id`, `ambiguity_kind`, `confirmed` | Ties telemetry to acceptance rate (§7) |

### Dedupe (reuse a proven primitive)
`deterministicUuid()` from `react/src/lib/recurring.ts` (the R2 multi-device fix) — content-addressed
ids collapse the same purchase at the PK on `upsert`, **no schema change**:
```ts
const txnFingerprint = (householdId, dateISO, amountMinor, merchantNorm) =>
  deterministicUuid(`vyact:txn:${householdId}:${dateISO}:${amountMinor}:${merchantNorm}`);
```
Exact → silent collapse. **Near-match** (±1 day, ±2% for auth-vs-settlement, same account) → new logic
→ surfaces as `Ambiguity{kind:'duplicate'}` and **asks**. Never auto-merge: a wrong merge silently
destroys a real transaction. Bank `refId`/UTR, when present, is the strongest natural key.

---

## 5. Agent topology
| Tier | Handles | Cost |
|---|---|---|
| **T0 · Rules router** | Known intents via existing `classifyIntent` | **Free, ~0ms**; target ~50-60% |
| **T1 · Single agent + tools** | Most real questions, follow-ups, comparisons | 1 model + tool loop |
| **T2 · Supervisor + specialists** | Compound/long-horizon plans | Multi-hop; **only when evals prove T1 fails** |

Specialists split by **tool + context isolation**, registered via the already-empty `SubAgent` seam
(`react/src/lib/aiSummary.ts:54-75`, async by design): **Analyst** · **Forecaster/Planner** ·
**Actions** (writes, confirm-gated, isolated) · **Educator** (the 100+ evergreen card library).

**Framework:** Vercel AI SDK for the T0/T1 tool loop. **LangGraph.js only at T2**, where checkpointing
and human-in-the-loop interrupts earn their complexity. LangGraph is orchestration, not training.

## 6. Compute location, streaming, channels, hosting

**Compute (settled by WhatsApp):** an inbound WhatsApp/SMS message has **no browser, no session, no
React store** — client-side computation cannot serve the agent. Port pure money functions to
`_shared/agent/tools/` and expose aggregates as **Postgres RPCs** (precedent: `_shared/whatsapp-parser.ts`).
Mitigate dual-maintenance with **parity tests** vs the client TS originals; prefer RPCs (one source).

**Streaming:** no streaming exists in the repo today, and Workbox `NetworkFirst`-caches Supabase REST
(4s timeout). Use **SSE for interactive chat** (add to the SW cache-exclusion list; never hit
`navigateFallback`; replaces the *simulated* `streamReply()`), and **202 + job row + poll** for long or
proactive work via `EdgeRuntime.waitUntil` (the `whatsapp-webhook` pattern).

**Channels:** Ask Vyact = rich (chips, Confirm dialogs). WhatsApp = plain text in the 24h window;
insights **opt-in per user**, non-opted-in keep the v10.18 hard-block; logging works regardless.
**SMS MVP = share/forward** (PWA Web Share Target + WhatsApp forward) — no new permissions. Android
auto-read/notification-listener is later and note `vyact-android` is only a **6-file scaffold** today
(no `android/`, no manifest, no plugins) that builds a *forked* repo.

**Hosting:** production on **hosted OSS via an OpenAI-compatible gateway**; the local 8-16GB GPU runs
7-8B 4-bit — great for dev/eval/sensitive work, not production (concurrency ~5-20, home-ISP uptime).
At 10k MAU cloud self-hosting is ~3-4× *more* expensive than hosted APIs; it wins on privacy/residency
and becomes cost-competitive ~30-40k MAU. **Secrets:** the config row stores `key_env_var` (the *name*);
the key lives in Supabase secrets, read only inside the edge function. No key reaches any bundle.

---

## 7. VALIDATION — 12 layers

Agent evals live in a **separate harness outside the TEST_SCENARIOS catalog** (`evals/` + its own CI
job): they are non-deterministic and may call live models. *(Note: the catalog reconciler regex already
silently ignores every `CON-UNIT-ASK-*`, `CON-UNIT-MM-*` and `INV-*` test — pre-existing hole, tracked
separately.)*

**Deterministic — blocking, every commit:**
1. **Unit tests** — validator guards (§3.4), signature/recipe derivation, dedupe fingerprints,
   ambiguity detection, Indian grouping `1,23,456.78`, `Avl Bal` trap. No model.
2. **Parity gate** — Deno tool ports ≡ client TS originals on shared fixtures.
3. **Money invariants INV-1..9** green.
4. **Kill-switch acceptance** — feature off ⇒ byte-identical to today; `CON-UNIT-ASK-052` (LLM ≡ rules).
5. **Tool-trace assertion** — every currency-shaped token in a reply must trace to a tool return.
   Mechanically catches hallucinated numbers.

**Model-dependent — nightly / pre-release:**
6. **Golden eval set** ≥200 cases: real anonymised SMS per bank/card, free text, Hinglish, Telugu,
   ambiguous inputs with an expected `Ambiguity`, duplicates, hard-block queries, adversarial payloads.
7. **Multi-model bake-off** — same set across **Claude · OpenRouter (Llama/Qwen/DeepSeek) · Gemini ·
   local vLLM** → matrix of accuracy · ambiguity precision · tool-call validity · p50/p95 · cost/1k.
   The production model is chosen **on evidence**.
8. **LLM-as-judge** — Claude scores other models' phrasing/question quality against a versioned rubric;
   ~10% human spot-check keeps the judge honest.
9. **Adversarial/red-team** — injection via `transactions.description` and SMS text; attempts to make
   `planner` invoke write tools. **Any success blocks release.**

**Behavioural — the real predictors:**
10. **Shadow mode** ⭐ — agent runs on real traffic, **writes nothing**, logs its proposal beside the
    deterministic result. Weeks of evidence at zero user risk. Do this before any user sees it.
11. **Acceptance rate** ⭐⭐ — because model writes are confirm-gated, **the share of drafts confirmed
    unedited IS the quality metric**. Track confirmed / edited / rejected per model, format, language.
    The confirm gate doubles as the eval instrument. **Primary release criterion.**
12. **Staged rollout + review sampling** — per-household opt-in flag (dogfood Mallela first), weekly
    human review of a random sample, auto-rollback on acceptance/`errorRate30` breach.

**Replay harness:** inbound messages are already persisted; store agent inputs the same way so any new
model/prompt can be replayed against real historical traffic before promotion.

---

## 8. Delivery phases

| # | Phase | Key work | Effort |
|---|---|---|---|
| **P0** | Metering + guardrails | ✅ metering shipped (v10.19.0). Remaining: async seam · lazy backend resolution · **honesty strings** (§12) · consent model · kill switch | 1.5 wks left |
| **P1** | Server-side money tools | Port pure calcs → `_shared/agent/tools/`; aggregate RPCs; **parity tests**; JSON-schema tool defs | 3 wks |
| **P2** | Gateway + model router | `ask-vyact` edge fn (JWT, SSE + SW exclusion, waitUntil job path); OpenAI-compatible router; `ai_model_configs` (+**`seam`** col); real `LlmBackend`; add to `deploy.yml`; pin CORS; retire dead `ChatBackend`/`SupabaseChatBackend` | 3 wks |
| **P3** | Ingestion pipeline + validator | The 9 stages as a **pure orchestrator with an injected fn-bag** (mirror `onboardingWiring.ts`); validator guards; extractor cascade registry; confidence scoring | 2.5 wks |
| **P4** | Learned-recipe cache | `smsSignature`, recipe derivation, `sms_format_recipes`, promotion/demotion, admin inspect | 2 wks |
| **P5** | Multi-turn + quick-reply UX | `agent_conversations`/`agent_pending_intents` + RLS + expiry; wire `chip`/`ambiguities` through `AssistantTurn`; chips in-app, numbered on WhatsApp; answer→patch merge; **household always-ask** | 2.5 wks |
| **P6** | Dedupe + provenance + confirm gate | `txnFingerprint`; near-match ambiguity; `'agent'` provenance; source-aware `EstimatedTag` + txn-row render; **`p_date`** on the RPC; grandfather rules path | 2 wks |
| **P7** | T0/T1 agent + Planner role | Rules fast-path routing, AI-SDK tool loop, prompts, scenario/forecast answers | 2.5 wks |
| **P8** | Actions role + injection hardening | Write tools behind propose→confirm; untrusted-text handling; allowlist + per-tool authz; audit trail | 2.5 wks |
| **P9** | WhatsApp + share-target + OCR | Agent behind the webhook; opt-in consent; PWA `share_target` + `/share-target` route (+ PNG icons); receipt vision → same pipeline. *iOS Safari has no Share Target — WhatsApp forward is the iOS path* | 3 wks |
| **P10** | Memory + RAG | pgvector, `agent_memory`, household-scoped retrieval (**exclude cross-household `shared_splits` fan-out**), history summarisation | 2.5 wks |
| **P11** | Admin console + cost control | AI Config page (super-gated, 3-edit nav pattern, per-seam); quotas (reuse OTP-cooldown pattern); model cascade; prompt caching; kill-switch acceptance test | 2.5 wks |
| **P12** | T2 supervisor + specialists | LangGraph.js supervisor + sub-agents via the `SubAgent` seam | 2.5 wks |
| **P13** | Evals, load, launch | The §7 harness, red-team, 10k-MAU load test, plan-tier upgrade, PWA offline states | 3 wks |
| *P14* | *Self-hosted inference* | *deferred/optional* | *2-3 wks* |
| **P-EVAL** | Eval harness — **runs alongside from P3** | `evals/` runner, golden set, bake-off, judge, shadow mode, acceptance dashboard | 3 wks |

**≈ 36-38 weeks solo · ≈ 20-22 weeks with two engineers.**

### Recommended first shippable slice (~8 weeks, NO LLM)
**P0-finish → P3 pipeline → P5 state/chips → P6 dedupe/confirm**, with only the deterministic
extractors wired. Delivers *"forward/paste an SMS and Vyact drafts it, asking when unsure"* with zero
token spend, and produces the shadow-mode traffic that justifies the model spend afterwards.

---

## 9. The spend gate (why metering came first)
Spec §8/§10 makes measurement the **precondition** for authorising LLM spend: ≥30% WAU · ≥25% txns via
assistant · ≤2 median taps · ≥75% interpret 👍 · <15% fallback. v10.19.0 added `backend · tier ·
provider · model · tokens · cost_usd · latency_ms · outcome · tool_calls · helpful · tap_depth` plus
`deterministicRate30` — the share answered by rules alone, i.e. **LLM calls never paid for**.
Privacy: **no message content, ever.**

## 10. Known constraints carried into the build
1. `AssistantBackend` is **synchronous** — async touches `runAssistant`, `Chat.tsx`, 5 test call sites.
2. **Two parallel seams**: `AssistantBackend` (flag-driven, live) and `ChatBackend` (env-driven, with a
   complete but **unreachable** `GeminiChatBackend`). Admin config must name its seam.
3. Backends resolve at **module scope** in `Chat.tsx` — DB config needs lazy resolution.
4. **Insights cards are a closed code set** — the agent may select/order, never author.
5. **RAG fan-out**: `shared_splits` rows are readable by non-members; exclude from household retrieval.
6. Supabase + Vercel on **free tiers**; `ARCHITECTURE.md` prices 10K-100K MAU at $599/mo Team. The
   platform tier, not the AI layer, dominates cost at scale.
7. CI deploys only the WhatsApp functions — `ask-vyact` must be added to `deploy.yml`.
8. `db/schema.sql` is stale since 2026-06-04 (duplicate migration timestamp aborts `--fix`) — tracked.

## 11. Locked decisions
Roles Planner+Actions · 10k MAU · multi-channel · WhatsApp insights **opt-in** · local GPU = dev/eval
only · **confirm everything except the existing rules path** · ambiguity → **quick-reply options** ·
duplicates → **detect & ask** · ingest = chat/WhatsApp + shared SMS + receipt OCR · languages =
English+Hinglish MVP, **designed for Telugu** · household → **always ask when >1** · evals in a
**separate harness** · rollout = **per-household opt-in flag** · SMS parsing = **LLM-first + learned
recipes**, no hand-maintained templates.

## 12. Product-honesty checklist (same release as any egress)
These strings are rendered to users and become false the moment the agent ships:
`Chat.tsx` "Private by design… nothing leaves it" · `Planner.tsx` "No AI · Zero hallucination" /
"no AI, no guessing" · `Insights.tsx` "🔒 rules, no AI" / "never guessed".
Plus: privacy-policy update, consent capture, and the §3.3 single-message egress exception.

## 13. Verification contract
`CON-UNIT-ASK-052` · INV-1..9 · parity gate · kill-switch acceptance · channel parity · tool-trace ·
injection red-team · **confirm-gate proof** (no `source='agent'` row exists without a confirm event) ·
acceptance rate ≥ target for 2 consecutive weeks before widening rollout.
