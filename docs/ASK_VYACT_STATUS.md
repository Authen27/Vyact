# Ask Vyact — implementation status (done vs pending)

> **Audited against production 2026-09-13** (project `dmxqkvploojokffuhxnz`), not against
> the repo alone. Every claim below cites either a `file:line` or a live query result.
> Consumer v10.35.0 · Admin v1.3.2 · `ask-vyact` edge function ACTIVE v32.

---

## TL;DR

**Ask Vyact works in production as of 2026-09-13.** It was broken for two days by a single
unset secret, that has been fixed, and success is confirmed by real traffic.

| | |
|---|---|
| **Gateway** | `ask-vyact`, **ACTIVE v32**, redeployed by CI on every push to `main` |
| **2026-09-11 → 09-12** | 6 requests, **all HTTP 503**, zero succeeded, $0.00 spend |
| **Root cause** | `OPENROUTER_API_KEY` was never set as a Supabase Function secret → router `missing_key` |
| **Fix** | `supabase secrets set OPENROUTER_API_KEY=…` — no code change, no deploy, no migration |
| **2026-09-13 11:51-11:53** | **8 requests, all HTTP 200**, `outcome='ok'`, real tokens, 2.4-3.8s |

Those successful runs were on `anthropic/claude-sonnet-5` and cost **$0.0081 for 4 questions**
($0.0020 each). *(Corrected from "$0.0064 for 3", which came from a partial view of the rows.)* The enabled model has since been switched to
**`nvidia/nemotron-3-super-120b-a12b:free`** (priority 110, pricing zeroed) — which is **not yet
validated**; every success recorded here is Sonnet's.

**Cost note.** At Sonnet rates a question is ~2 model calls ≈ $0.002. That is cheap per question
and unbounded per month — the `ASK_VYACT_DAILY_CALL_CAP` (default 200/user/day) is the only
ceiling, and at Sonnet rates that cap permits roughly $0.40/user/day.

---

## v10.36.0 — answer quality fix (shipped 2026-09-14)

Every answer recorded in [`ASK_VYACT_LLM_RUN_LOG.md`](ASK_VYACT_LLM_RUN_LOG.md) predates this fix,
so **none of that log measures the fixed pipeline**. The diagnosis behind it:

| cause | symptom | fix |
|---|---|---|
| the phrase model never saw the user's question | irrelevant answers | payload now includes `question` |
| `resolve()` passed one pre-written sentence, discarding what it computed | high-level answers | new structured `facts` field |
| prompt capped replies at 1–2 sentences and forbade advice | advice questions got a restated number | prompt rewritten; 200 → 700 tokens |
| classify saw bare intent ids with no meaning | misrouting | intents defined with examples |

The "services compute" rule is unchanged: every figure in `facts` is computed in code and formatted
through `money()`, and `assertNoInventedFigures` still discards any reply containing a number the
data did not supply.

The chat also now prints each real pipeline stage while it works, then collapses them into
"Analysed in Ns · N steps"; the composer shows an animated ring while thinking and accepts
multi-line input.

**Still to validate:** answer *quality* on the live model. Re-run the 14 scenarios after deploy —
in the app, or with `npm --prefix react run test:live` — and compare against the run log.

---

## How the diagnosis was reached

Stated explicitly because the conclusion is inferred, not read — Supabase does not expose
secret *values*, and it should not.

1. Every `ask-vyact` POST in `function_edge_logs` returned **503** with
   `sb_error_code: EDGE_FUNCTION_ERROR` (deployment versions 25, 31 and 32; a real Android
   browser session from Hyderabad).
2. `STATUS_FOR` ([ask-vyact/index.ts:156-167](../supabase/functions/ask-vyact/index.ts#L156))
   maps exactly three failure codes to 503: `missing_key`, `forbidden_key`, `invalid_config`.
   Everything else maps to 200, 400, 502 or 504.
3. `invalid_config` is ruled out — the enabled row has a valid `https` base_url, a known seam,
   and a well-formed env var name, so no branch in `checkConfig`
   ([router.ts:296-345](../supabase/functions/_shared/agent/router.ts#L296)) fires.
4. `forbidden_key` is ruled out — `OPENROUTER_API_KEY` is the router's own *recommended*
   name, not on the `FORBIDDEN_KEY_ENV` denylist.
5. That leaves **`missing_key`** ([router.ts:459](../supabase/functions/_shared/agent/router.ts#L459)):
   *"Secret `OPENROUTER_API_KEY` is not set for this project."*
6. **Independent corroboration.** `missing_key` is in `NO_SPEND_CODES`
   ([router.ts:683](../supabase/functions/_shared/agent/router.ts#L683)), so `buildUsageRow`
   returns null and the metering step writes exactly
   `{outcome:'error', prompt_tokens:0, completion_tokens:0}` with `provider` and `model` left
   null. That is the precise shape of all 12 rows in production.

---

## Production evidence

**`ai_model_configs` — 8 rows, 1 enabled**

| model | priority | enabled |
|---|---:|---|
| `anthropic/claude-sonnet-5` | 100 | ✅ **true** |
| `anthropic/claude-opus-5` | 90 | false |
| `openai/gpt-5.1` | 80 | false |
| `google/gemini-2.5-pro` | 70 | false |
| `openai/gpt-oss-120b` | 40 | false |
| `meta-llama/llama-3.3-70b-instruct` | 30 | false |
| `qwen/qwen3-235b-a22b-2507` | 20 | false |
| `deepseek/deepseek-v4-flash` | 10 | false |

All `provider=openrouter`, `base_url=https://openrouter.ai/api`, `key_env_var=OPENROUTER_API_KEY`.
The catalogue ships from
[`20260906140000_seed_model_catalogue.sql`](../supabase/migrations/20260906140000_seed_model_catalogue.sql)
with every row disabled; the Sonnet row was enabled by hand afterwards.

**`ai_usage` — 84 rows, none from a successful model call**

| rows | backend | outcome | window | meaning |
|---:|---|---|---|---|
| 64 | `null` | `null` | 2026-05-22 → 2026-08-08 | legacy v6.4.6 regex intent/sentiment |
| 7 | `rules` | `ok` | 2026-08-17 | retired rules backend |
| 1 | `rules` | `clarify` | 2026-08-17 | retired rules backend |
| **12** | **`llm`** | **`error`** | **2026-09-11 → 2026-09-12** | **the gateway, failing** |

`reserve_ai_usage` writes its row with `backend='llm', outcome='reserved'` *before* the provider
is called, and step 10 rewrites it — so these rows prove auth, config resolution and quota
reservation all succeeded, and the failure is downstream at the provider call.

**On the count.** `function_edge_logs` records exactly **6 POSTs (all 503)** and 3 CORS preflights
over that window, against **12 metering rows** — i.e. **2 rows per request**, so 6 requests, not 12.
`runAssistant` normally makes two model calls per question (`classifyIntent`, then
`phraseResponse`) — but it **returns immediately when classify fails**, so none of these questions
ever reached phrase. That makes it **6 user questions**, each one gateway call plus one client row.
*(Corrected: an earlier revision said "~3 questions", wrongly assuming two calls each.)*

✅ **The multiple-rows-per-question pattern is explained, and it is not a bug.** There are **two
independent writers** to `ai_usage`:

1. **The gateway** — one row per *model call*, carrying `provider`, `model`, tokens and `cost_usd`.
2. **The client** — `logAiUsage` ([aiUsage.ts:84](../react/src/lib/aiUsage.ts#L84)) inserts one row
   per *user question* with `backend='llm'` and total turn latency, but **null `provider`/`model`**,
   because the browser never learns which model answered.

Since `runAssistant` makes two model calls per question (`classifyIntent`, then `phraseResponse`),
a single question yields **3 rows: 2 gateway + 1 client**. The 2026-09-13 traffic matches exactly —
8 gateway POSTs and 4 client rows across ~4 questions.

🔴 **Consequence for cost reporting.** `ai_usage` cannot be summed or averaged naively. Client rows
carry a null `cost_usd` and would silently dilute any per-row average, and counting rows
over-reports question volume by ~3×. Any spend report must filter to `provider is not null`.

---

## Live validation — Nemotron free tier, 2026-09-13 12:03-12:10

11 real questions through the **deployed** gateway (not the local harness), after switching the
enabled row to `nvidia/nemotron-3-super-120b-a12b:free`. 22 gateway calls, 26 POSTs, **all HTTP
200, all `outcome='ok'`, every `cost_usd = 0.000000`.** One turn returned `clarify`; zero
invented-figure rejections.

Scenario attribution is inferred from `message_len` matched against the known prompt strings in
`askVyactIntents.ts` — reply text is never stored, so this is the strongest attribution available.

| scenario | len | outcome | turn | classify completion tokens |
|---|---:|---|---:|---:|
| cut-back | 33 | ok | 21.7s | 346 |
| emergency | 44 | ok | 7.1s | 150 |
| debts | 52 | ok | 16.3s | 211 |
| top-categories | 47 | ok | 9.0s | 265 |
| ~~net-worth~~ *misattributed — see below* | 20 | ok | 19.6s | 316 |
| upcoming-bills | 27 | ok | 10.3s | 87 |
| affordability | 29 | ok | 5.4s | 127 |
| *4 ad-hoc questions* | 8-42 | ok ×3, clarify ×1 | 5.4-10.5s | 122-564 |

**Correction — `net-worth` was never run.** The 20-character row above was attributed to "What's my
net worth?", but that prompt matches the client's `networth` intent pattern and this row logged as
`other`, so it was a different question.

**The authoritative per-question record now lives in
[`ASK_VYACT_LLM_RUN_LOG.md`](ASK_VYACT_LLM_RUN_LOG.md)** — all 24 questions across both models, with
coverage of all 14 scenarios. As of 2026-09-13: **8 of 14 scenarios have passed at least once**;
`health`, `net-worth`, `budgets-risk`, `cap-expense` and `cap-investment` have never run, and
`cap-income` has only failed.

### Nemotron vs Sonnet, measured

| | claude-sonnet-5 (11:51-11:53) | nemotron-3-super:free (12:03-12:10) |
|---|---|---|
| cost / question | ~$0.002 | **$0.00** |
| median turn | ~7.4s | **~10.3s** (worst 21.7s) |
| classify completion tokens | 21-71 | **87-564** |
| failures | 0 | 0 |

### ⚠️ `params.max_tokens` is dead config for Ask Vyact (corrected 2026-09-13)

An earlier revision of this section claimed a classify call burned "564 of 600 tokens" and
recommended raising `params.max_tokens`. **Both halves were wrong**, and the recommended UPDATE
would have been a no-op:

- The Ask Vyact client hardcodes its own limits: **classify `maxTokens: 256`**
  ([askVyactLlm.ts:97](../react/src/lib/askVyactLlm.ts#L97)) and **phrase `maxTokens: 200`**
  ([askVyactLlm.ts:261](../react/src/lib/askVyactLlm.ts#L261)). These reach the router as
  `maxOutputTokens`.
- The router resolves `opts.maxOutputTokens ?? params.max_tokens ?? DEFAULT`
  ([router.ts:466-468](../supabase/functions/_shared/agent/router.ts#L466)), so the caller's value
  always wins. **`params.max_tokens` is never read for this seam** — the `600` on every seeded row
  is inert, and editing it changes nothing.

**What the 564 actually means.** That classify call was capped at **256** yet reported **564
completion tokens** — and succeeded. The coherent explanation is that OpenRouter's
`completion_tokens` includes Nemotron's *reasoning* tokens, which are not bound by the
visible-output cap. The visible JSON stays within 256; the reasoning is metered on top. All 22
Nemotron calls returned `outcome='ok'`, so **no truncation risk has materialised.**

**Residual watch item, not a fix.** If a provider ever starts counting reasoning against
`max_tokens`, 256 would be tight for a reasoning model and classify would truncate into
`bad_response` → HTTP 502. The signal to watch is any `bad_response`/`empty_response` in the
gateway response body. If that appears, the fix is in **code** (`askVyactLlm.ts:97`), not in
`ai_model_configs` — and the router's `HARD_MAX_OUTPUT_TOKENS` ceiling of 4096 still applies.

**Why this matters beyond Nemotron.** A config column that looks authoritative but is silently
overridden is a trap: it misled this very analysis. Either remove `max_tokens` from the seed rows or
make the precedence visible where the column is defined.

### What this evidence does NOT show

It proves every question *completed*. It does not prove any answer was *correct* — reply text is
never persisted, and the `intent` column is the client's regex bucket (`spending`/`debt`/`other`),
not the LLM's chosen `intentId`. Verifying routing accuracy and answer quality needs the harness
(`vitest.live.config.ts`), which prints `intentId` and reply per scenario.

---

## DONE — consumer

Substantially more is built than the architecture doc's phase table implies.

- **`LlmBackend` is the only backend.** The deterministic `RulesBackend` was removed in v10.20;
  there is no rules fallback by design
  ([askVyactBackend.ts:393-426](../react/src/lib/askVyactBackend.ts#L393)).
- **The browser never holds a provider key.** It invokes the edge function
  ([askVyactModelCall.ts:33-66](../react/src/lib/askVyactModelCall.ts#L33)).
- **Gateway is complete**: JWT auth (and it refuses service-role/anon tokens), origin-pinned
  CORS, priority-based model selection, atomic quota reservation, bounded provider call,
  metering, and an OpenAI-compatible provider contract so a model swap is a DB row.
- **Fails honestly.** With no model reachable it returns an explicit unavailable turn and never
  degrades to a canned answer. The three reason codes are distinct so telemetry can tell
  "never set up" from "set up but broken" from "the model misbehaved"
  ([askVyactBackend.ts:481-498](../react/src/lib/askVyactBackend.ts#L481)).
- **Figures never come from the model.** `resolve()` is the sole source, enforced by
  `assertNoInventedFigures`.
- **Spend controls exist server-side**: a daily call cap (default 200) enforced by the
  row-locking `reserve_ai_usage` RPC, which fails closed.

## DONE — schema (live in production, currently unused)

Migration [`20260816120000_agent_ingestion_state.sql`](../supabase/migrations/20260816120000_agent_ingestion_state.sql)
creates three tables, all present in production with 0 rows, all with full RLS, indexes, grants,
and a `SECURITY DEFINER` helper that avoids 42P17 policy recursion:

- **`agent_conversations`** — multi-turn thread state (phase P5).
- **`agent_pending_intents`** — the pending question plus the draft transaction it produces.
  The confirm-gate is already encoded: *"a row here becomes a transaction only through the
  normal write seams, after a human confirm"* (phases P6/P8).
- **`sms_format_recipes`** — the learned-recipe cache, global by design, service-role writable
  only so no household can poison another's extraction (phase P4).

> This corrects a common misreading: **P5/P6/P8's data model is not "pure spec" — it is built
> and migrated.** What is missing is the runtime code that reads and writes these tables.

---

## PENDING — to make it actually work

1. **Set the secret** (above). Single blocking item.
2. **Verify end to end after setting it.** Ask one question on vyact.app, then confirm a row
   lands in `ai_usage` with `outcome='ok'`, a non-null `provider`/`model`, and a non-zero
   `cost_usd`. Until that row exists, the integration remains unproven.
3. **The failure is invisible in logs.** `function_logs` for these 12 requests contain only
   Boot/Shutdown lifecycle events — the gateway returns the failure code in the HTTP body but
   never `console.error`s it, so a silent outage looks like nothing at all in Supabase logs.
   Worth adding one log line on the `!result.ok` path
   ([index.ts:402-410](../supabase/functions/ask-vyact/index.ts#L402)).
4. **Finish P0.** Per the architecture doc's own table, metering shipped; honesty strings,
   the consent model, and the kill switch remain (~1.5 weeks).

## PENDING — validation

- **No test has ever exercised the deployed gateway against a real model.**
  `gatewayWorkflow.test.ts` is fully mocked. `askVyactLive.test.ts` is the only real-provider
  test, and it is `describe.skipIf(!KEY)` — excluded from default CI, run only via
  `npm --prefix react run test:live`. Its own header states it *"does not validate deployed
  gateway authentication, quota, consent, configuration or metering"*
  ([askVyactLive.test.ts:28-32](../react/src/lib/__tests__/askVyactLive.test.ts#L28)).
  Had such a test existed, this outage would have been caught on day one.
- **`assertNoInventedFigures` is defence in depth, not proof of correctness.** It matches
  numeric *tokens*, not meaning. Per its own documentation
  ([askVyactLlm.ts:180-193](../react/src/lib/askVyactLlm.ts#L180)): a tool-derived figure
  described with the wrong sign, unit or framing passes cleanly; small counts are exempt, so
  "3 budgets are over" can be wrong about the 3; and a magnitude word beside a right number
  ("2.4 million") is unchecked. The independent engineering audit reaches the same conclusion
  and recommends the honest end state — services return facts with units, **the UI renders the
  amounts**, and the model only explains them. *This is a product decision worth taking
  deliberately, not a bug to quietly patch.*
- **No cloud-mode or Deno-runtime unit coverage** (tracked as TD-32): the unit suite pins
  `VITE_SUPABASE_URL: ''`, and edge handlers are tested against the npm `supabase-js` build
  rather than the `esm.sh` build Deno actually loads.

---

## Admin app — one read-only surface, nothing else

**Present:** an AI Intelligence dashboard (`admin/src/pages/Intelligence.tsx`) rendering
`admin_ai_usage_summary()` — totals, distinct users, last 7/30 days, intent distribution,
sentiment split, per-user segments. Privacy-safe by construction: intent, sentiment and length
only, never message content.

**Absent:**
- No model or provider configuration UI. `ai_model_configs` is not referenced anywhere in
  `admin/src`; it is edited by hand in SQL. Scheduled as phase P11.
- No enable/disable switch, no spend cap control, no kill switch. The only lever is a manual
  `UPDATE` in Supabase.
- No API-key or quota management.
- No conversation moderation or audit view — and this one is **correct by design**: message
  content is never stored, so there is nothing to review.

⚠️ **Verify once live:** `Intelligence.tsx` reads the older v6.4.6 intent/sentiment lineage,
while the gateway writes the newer columns (`provider`, `model`, `prompt_tokens`, `cost_usd`,
`latency_ms`) onto the same physical table. No test ties the dashboard to gateway-sourced rows,
so the dashboard may under-report or ignore real LLM usage entirely.

---

## NOT STARTED — phases P1 to P13

From [`vyact-agent-architecture.md`](../vyact-agent-architecture.md) §8. Total **≈36-38 weeks
solo, ≈20-22 weeks with two engineers**. P14 (self-hosted inference) is deferred/optional.

Three worth calling out because they are commonly assumed to exist:

- **P8 — writes.** No write tools, no actions role, no propose→confirm runtime code. The
  *tables* exist (above); the code does not.
- **P9 — WhatsApp/OCR into the agent.** WhatsApp today is a separate deterministic parser
  pipeline with no AI and no egress; `whatsapp-webhook` imports nothing from `_shared/agent/`.
- **P4 — learned-recipe cache.** `recipeStore.ts` closed the internal wiring gap between
  `recipe.ts` and `pipeline.ts`, but no runtime entrypoint constructs an `IngestionDeps`, so
  `runIngestion` is still never reached in production.

The architecture doc also proposes a **~8-week first shippable slice with no LLM at all**
(P0-finish → P3 → P5 → P6): *"forward/paste an SMS and Vyact drafts it, asking when unsure"* —
zero token spend, and it generates the shadow traffic that would justify model spend later.

---

## Stale claims to correct

Each actively misleads a reader; all three are contradicted by the evidence above.

| Location | Claim | Reality |
|---|---|---|
| [`vyact-agent-architecture.md:10-12`](../vyact-agent-architecture.md#L10) | "The agent is NOT live. Ask Vyact today is 100% rules-based and on-device." | Model-backed since v10.20; `RulesBackend` deleted. |
| [`ask-vyact/index.ts:90`](../supabase/functions/ask-vyact/index.ts#L90) | "STATUS: UNDEPLOYED AND UNEXECUTED. Written, typechecked, never run." | ACTIVE v32, CI-deployed, executed 12 times. |
| [`react/src/config/features.ts:25-36`](../react/src/config/features.ts#L25) | `backend: 'rules'` + "no LLM in this build" | Dead config — nothing reads it; backend selection always goes through `resolveConfiguredModelCall()`. |

---

## Recommended sequence

1. **Set `OPENROUTER_API_KEY`** and ask one question on vyact.app. *(you — credential)*
2. **Confirm the first successful `ai_usage` row** (`outcome='ok'`, non-null model, non-zero cost).
3. **Add the missing error log line** so the next provider outage is visible in Supabase logs.
4. **Add one real end-to-end test** against the deployed gateway, gated on a key being present
   in CI, so "enabled but broken" can never again go unnoticed for two days.
5. **Decide the figures question** — keep model-authored prose with a token guard, or move
   authoritative amounts into UI rendering as the audit recommends.
6. **Then** choose between finishing P0 (~1.5 wks) and the no-LLM first slice (~8 wks).
