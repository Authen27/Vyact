# Vyact Agent Service — Architecture & Delivery Plan

**Status:** APPROVED FOR BUILD · **P0 in progress** (metering shipped v10.19.0)
**Companions:** [`vyact-ask-vyact-engineering-spec.md`](vyact-ask-vyact-engineering-spec.md) (the 5-stage
pipeline this extends) · [`whatsapp-vyact-solutioning.md`](whatsapp-vyact-solutioning.md) (the second channel)
**Scope:** turn Ask Vyact from a deterministic rules assistant into an **LLM agent that answers every
user query**, serving **all Vyact clients as one service**.

> ⚠️ **The agent is NOT live yet.** Today Ask Vyact is still 100% rules-based and on-device. This
> document is the design being built against; each phase states what actually shipped.

---

## 1. The core decision — a service, not an app

**There is no separate agent app.** The agent is a **server-side service** behind one HTTPS endpoint.
PWA, Android (future Capacitor), iOS (future) and WhatsApp all call the same gateway. A second app
would triple the surface for zero gain.

```
CHANNEL ADAPTERS                    AGENT CORE (Supabase Edge, Deno)          MODEL ROUTER (OpenAI-compatible)
┌──────────────────┐                ┌────────────────────────────────┐        ┌──────────────────────────┐
│ Ask Vyact (PWA/  │───┐            │ authn + RLS (user JWT)         │        │ PROD: OpenRouter / Groq  │
│  Android/iOS)    │   │            │ ─────────────────────────────  │───────►│       (hosted OSS)       │
│  cards, confirm  │   ├───────────►│ T0 rules router   (free)       │        │ DEV : local GPU + vLLM   │
├──────────────────┤   │            │ T1 agent + tools  (1 model)    │        │ OPT : frontier fallback  │
│ WhatsApp         │───┘            │ T2 supervisor + specialists    │        └──────────────────────────┘
│  plain text,     │                │ ─────────────────────────────  │
│  24h window,     │                │ tools ──► DETERMINISTIC MONEY  │  _shared/ ports + Postgres RPCs
│  opt-in insights │                │ memory ─► pgvector             │
└──────────────────┘                │ metering ► ai_usage (spend gate)│
                                    └────────────────────────────────┘
```

### Why the gateway is a Supabase Edge Function
Vercel is a **pure static host** here (`vercel.json` has no `functions` block, there is no `api/`
directory) — Supabase Edge Functions are the *only* server compute in this stack. They are also
co-located with the data/RLS, already hold service-role secrets, and already have a CI deploy path.
LLM calls are I/O-bound, so the CPU cap is not the binding constraint (**verify wall-clock limits
against the live project — they are undocumented in-repo**).

---

## 2. Binding rules (violating one is a regression)

1. **The LLM never computes money.** It selects tools and phrases their returns. Every figure comes
   from `resolve()` or a Postgres RPC. This preserves the existing spec §3 non-negotiable — *"the
   assistant phrases; services compute"* — and is simultaneously the anti-hallucination guarantee.
   A model that invents "you spent ₹42,000" is a liability in a finance app.
2. **Hybrid, not replacement.** Rules classify first (T0); the LLM runs only on a miss. Preserves
   today's provable correctness on the common path and is the single biggest cost lever.
3. **Reads and writes are separated.** `planner` holds read tools only. `actions` holds write tools
   and is **propose → user confirms**; nothing mutates money without an explicit tap.
4. **All stored text is untrusted.** `transactions.description` now carries WhatsApp-ingested
   external text — treat every DB string as potential prompt injection, never as instruction.
5. **"Learning" = context + memory, never fine-tuning.** Retrieval of the user's own data + an
   `agent_memory` table. Fine-tuning on per-household financial data is slow, costly and creates
   cross-tenant leakage risk. Explicitly out of scope.
6. **Plug-n-play has two meanings here, both binding.**
   *(a)* Provider-level: every model speaks **OpenAI-compatible `/v1/chat/completions`**, so a swap is
   a DB row change, not a deploy. *(b)* House meaning (spec §0/§2): the feature ships behind a kill
   switch whose **off state is provably byte-identical to today**, enforced by test.
7. **Only `SafeSummary`-shaped data may egress**, and only with consent. No merchant names, no
   descriptions, no notes.

---

## 3. Compute location — settled by WhatsApp

Every money function is client-side TypeScript today. An inbound WhatsApp message has **no browser,
no session, no React store** — so client-side computation cannot serve the agent.

**Resolution: port pure money functions to `supabase/functions/_shared/` and expose aggregates as
Postgres RPCs.** Precedent already exists — `_shared/whatsapp-parser.ts` was ported from
`askVyactParser.ts` exactly this way.

The cost is dual maintenance (client TS for UI, server for the agent). Mitigations, both mandatory:
- **Prefer Postgres RPCs** for pure aggregates — one source of truth in SQL, no duplication.
- **Parity tests** asserting the Deno port and the TS original return identical results on shared
  golden fixtures — the same discipline as the money-invariant suite.

---

## 4. Agent topology (cheapest path wins)

| Tier | Handles | Cost |
|---|---|---|
| **T0 · Rules router** | Known intents via existing `classifyIntent` → deterministic answer | **Free, ~0ms**; target ~50-60% of traffic |
| **T1 · Single agent + tools** | Most real questions, follow-ups, comparisons | 1 model + tool loop |
| **T2 · Supervisor + specialists** | Compound/long-horizon ("12-month payoff + savings plan") | Multi-hop; **only when evals prove T1 fails** |

Specialists split by **tool + context isolation**, registered through the already-empty `SubAgent`
seam (`react/src/lib/aiSummary.ts:54-75`, async by design): **Analyst** (read/historical) ·
**Forecaster/Planner** (projection/scenarios) · **Actions** (writes, confirm-gated, isolated) ·
**Educator** (the existing 100+ evergreen card library).

**Framework:** Vercel AI SDK (TypeScript) for the T0/T1 tool loop. **LangGraph.js only at T2**, where
its checkpointing/human-in-the-loop interrupts genuinely earn their complexity. LangGraph is
orchestration — it is *not* a training tool.

---

## 5. Streaming vs. job pattern

There is **no streaming anywhere in the repo today**, and the Workbox service worker `NetworkFirst`-
caches Supabase REST with a 4s timeout. Use both patterns:
- **Interactive chat → SSE** from the edge function (a first for this codebase). Must be added to the
  SW cache-exclusion list and must never hit `navigateFallback`. Replaces the *simulated*
  `streamReply()` in `Chat.tsx`, which merely reveals an already-complete string word-by-word.
- **Long / proactive work → 202 + job row + poll/realtime**, reusing the existing
  `EdgeRuntime.waitUntil` pattern from `whatsapp-webhook`. Matches the documented
  "sync is refresh-based, not a live socket" convention.

---

## 6. Channels

| Channel | Presenter | Policy |
|---|---|---|
| **Ask Vyact** (PWA/Android/iOS) | Rich — cards, chips, Confirm dialogs | Authenticated session |
| **WhatsApp** | Plain text only, inside the 24h session window | Insights are **opt-in per user**; non-opted-in users keep the v10.18 hard-block. Logging works regardless |

Same tools, same roles, same memory — only presentation and policy differ.

---

## 7. Model hosting

Production runs on **hosted OSS via an OpenAI-compatible gateway**; self-hosting stays one config
line away.

- A **local 8-16GB GPU runs 7-8B 4-bit only** — excellent for dev/eval/sensitive workloads, not
  viable as production serving (concurrency ~5-20, home-ISP uptime, security exposure, ops time).
- At 10k MAU, **cloud self-hosting is ~3-4× more expensive** than hosted OSS APIs (a GPU bills 24/7,
  an API bills per token). Self-hosting wins on privacy/residency and becomes cost-competitive
  around ~30-40k MAU, or immediately versus frontier models.
- **Secrets rule:** the config row stores `key_env_var` (the *name*); the key itself lives in Supabase
  secrets and is read only inside the edge function. No key ever reaches the admin or consumer bundle.

---

## 8. Delivery phases

| # | Phase | Status |
|---|---|---|
| **P0** | Metering + guardrails (the LLM-spend gate) | **🟡 in progress** — metering shipped v10.19.0 |
| P1 | Server-side money tools (`_shared` ports + RPCs + parity tests) | pending |
| P2 | Gateway + model router (`ask-vyact` edge fn, `ai_model_configs`) | pending |
| P3 | T0/T1 agent + Planner/Advisor role — *first user-visible agent* | pending |
| P4 | Actions role + prompt-injection hardening | pending |
| P5 | WhatsApp channel adapter (opt-in insights) | pending |
| P6 | Memory + RAG (pgvector) | pending |
| P7 | Admin AI console + cost control | pending |
| P8 | T2 supervisor + specialist sub-agents | pending |
| P9 | Evals, load test, launch hardening | pending |
| P10 | Self-hosted inference | *deferred / optional* |

≈25 weeks for one senior dev, ≈14-15 with two. First user-visible agent at **P3**; WhatsApp parity at **P5**.

---

## 9. The spend gate (why P0 comes first)

Spec §8/§10 makes adoption + cost measurement the **precondition** for authorising LLM spend:
≥30% WAU · ≥25% txns via the assistant · ≤2 median taps · ≥75% interpret 👍 · <15% fallback.

`ai_usage` previously recorded intent/sentiment/length only — the gate could not be evaluated.
**v10.19.0 adds** `backend · tier · provider · model · prompt_tokens · completion_tokens · cost_usd ·
latency_ms · outcome · tool_calls · helpful · tap_depth`, and extends `admin_ai_usage_summary()` with
cost/token/latency/fallback/helpful/**deterministic-rate** metrics.

The headline number is **`deterministicRate30`** — the share answered by rules alone. Every such row
is an LLM call never paid for, so this figure directly sizes the future bill.

**Privacy contract preserved: still no message content, ever.**

---

## 10. Known constraints carried into the build

1. The `AssistantBackend` seam is **synchronous** — an LLM needs async (touches `runAssistant`,
   `Chat.tsx`, 5 test call sites).
2. **Two parallel seams exist**: `AssistantBackend` (flag-driven, live) and `ChatBackend` (env-driven,
   with a complete but **unreachable** `GeminiChatBackend`). Admin config must name its seam.
3. Backends resolve at **module scope** in `Chat.tsx` — DB-driven config requires lazy resolution.
4. **User-facing honesty strings must change in the same release** as any egress:
   `Chat.tsx` "nothing leaves it" · `Planner.tsx` "No AI · Zero hallucination" ·
   `Insights.tsx` "🔒 rules, no AI".
5. **Insights cards are a closed code set** — an LLM may select/order them but never author one.
6. **RAG fan-out risk**: `shared_splits` rows are legitimately readable by non-members; household
   retrieval must exclude them.
7. Supabase + Vercel are on **free tiers** today; `ARCHITECTURE.md` prices 10K-100K MAU at $599/mo
   Team. The platform tier — not the AI layer — is the dominant cost at scale.
8. CI deploys only the WhatsApp functions; `ask-vyact` must be added to `deploy.yml` explicitly.

## 11. Verification contract
`CON-UNIT-ASK-052` (LLM ≡ rules on `seed`/`intentId`) · money invariants INV-1..9 · **parity gate**
(Deno ports ≡ client TS) · **kill-switch acceptance** (off ≡ today, byte-identical) · **channel
parity** (same question, same figures in-app and on WhatsApp) · **agent evals** asserting every money
figure traces to a tool return · injection red-team · consent/privacy egress checks.
