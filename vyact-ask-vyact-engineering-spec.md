# Ask Vyact — Engineering Solution Document

> **For:** Engineering team
> **From:** Product
> **Status:** APPROVED for build
> **Builds on:** Consumer **v8.0.1** (per `VERSIONS.md`)
> **Companion docs:** `vyact-ask-vyact-prd.docx` (product rationale + simulation), `vyact-onboarding-engineering-spec.md` (the spec pattern this follows), `react/CHANGELOG.md`
> **Target app:** `react/` (React 18 + TypeScript + Tailwind + Zustand + Vite)

The PRD explains *why*; this document is the buildable contract — *what to build, where, and how to verify it*. Where they differ, this document wins.

---

## 0. TL;DR for engineering

Grow the **existing Ask Vyact launcher** into a real assistant across **three buckets — Capture, Interpret, Forecast** — using a **deterministic, no-LLM** pipeline phrased in a warm human voice, behind a **single feature flag**, architected so a future LLM is a **drop-in behind two function signatures**.

**This is NOT a greenfield build.** The launcher, the chat-backend selector, the seed-into-modal plumbing, the rules-based Planner, and the privacy-safe aggregation all already ship. You are wiring existing parts together and adding a free-text parser + response layer.

**Three hard rules:**
1. **No foundational LLM in this build.** Deterministic rules only. The LLM is the already-roadmapped future-major; this validates demand for it.
2. **The assistant phrases; services compute.** No number Ask Vyact says is ever produced by a template — every figure comes from the same services that power the dashboard.
3. **Plug-n-play toggle.** Entire feature behind `FEATURES.askVyact`. Off → the launcher reverts to its current v7.4.5 behaviour, zero side effects.

---

## 1. What already exists — reuse, do not rebuild

Confirmed against `VERSIONS.md`. Read this before writing any code.

| Already shipped | Location | How this build uses it |
|---|---|---|
| Ask Vyact launcher (two-tap, buckets Capture / Inquire / Plan / Manage) | `lib/askVyactIntents.ts` (v7.4.5) | **Extend** the `Intent[]` registry + `IntentAction` union. Do not build a new chat UI. |
| Free-text chat routing | `selectChatBackend()` (v7.4.5) | Register the rules engine as the **default backend**. The future LLM is a second backend here. |
| Seed-into-modal | `seedTxn` slot + `openAddTxn(seed?)` (v7.4.5) | Capture intents seed the **existing** `TransactionFormModal`. No parallel entry path. |
| Rules-based Finance Planner (no LLM) | v7.5 Planner | Forecast bucket calls **this** engine. No new forecasting math. |
| Privacy-safe aggregation | `aiSummary.ts` | Interpret bucket reads from **this**. It is also the exact payload a future LLM would receive. |
| Baseline-delta + subscription registry | onboarding data-enrichment work | Diagnostic answers ("why am I low", "double-paying") reuse **these**. |
| Record provenance (`confidence`/`source`) | normalized columns (v8.0.1) | Interpret answers respect provenance automatically — "based on confirmed data" vs flags estimates. |
| Privacy-safe usage logging (intent/sentiment) | `admin_ai_usage_summary()` + Admin AI Intelligence page (v6.4.6 / v1.0.4) | Emit the **same** events so the admin dashboard measures adoption — the LLM validation signal. |
| Feature-flag pattern | `src/config/features.ts` (`FEATURES.onboarding`, v8.0.0) | Mirror it exactly for `FEATURES.askVyact`. |

**Mandate:** add (a) a free-text parser, (b) extended intent rules, (c) a response/tone layer, and (d) thin handlers that call existing Planner + aggregation. Nothing else is new.

---

## 2. The feature flag (build FIRST)

Mirror the onboarding flag pattern so QA flips one value to test both states.

```ts
// src/config/features.ts  (extend the existing FEATURES object)
export const FEATURES = {
  onboarding: { /* …existing… */ },
  askVyact: {
    enabled: true,            // master switch — false reverts the launcher to v7.4.5 behaviour
    capture: true,            // bucket toggles (all default true; allow staged rollout)
    interpret: true,
    forecast: true,
    proactiveInsight: true,   // the single "here's what to know" card on open (§5)
    backend: 'rules',         // 'rules' now; 'llm' is the future drop-in — selected via selectChatBackend()
  },
} as const;
```

### Toggle contract
| State | Behaviour |
|---|---|
| `askVyact.enabled = true` | Full three-bucket assistant per this doc. |
| `askVyact.enabled = false` | **The launcher reverts to its current v7.4.5 two-tap behaviour.** No free-text parsing, no Interpret/Forecast answers, no proactive insight, no new events. App identical to pre-build. No dead UI, no console errors. |

Per-bucket flags allow shipping Capture first, then Interpret, then Forecast if you want a staged rollout. Each handler checks its bucket flag at entry.

**Acceptance:** flipping `enabled` to `false` and reloading produces the exact v7.4.5 launcher. This is the definition of plug-n-play.

---

## 3. Architecture — the five-stage pipeline

Every free-text utterance flows through five deterministic stages. Same pipeline, all three buckets. The LLM later replaces exactly two stages and inherits the other three.

```
utterance
   │
   ▼
[1] normalise        pure string hygiene
   │
   ▼
[2] entityExtract    amount (k/lakh), category (reuse KEYWORD_MAP), merchant, date, participants
   │
   ▼
[3] classifyIntent   ◀── INTERFACE. rules now; LLM augments fuzzy cases later
   │
   ▼
[4] resolve          Capture→seed modal · Interpret→aggregates · Forecast→Planner
   │                 ◀── NEVER delegated to an LLM. This is where money is computed.
   ▼
[5] phraseResponse   ◀── INTERFACE. template variants now; LLM generates phrasing later
   │
   ▼
warm human reply (+ next-step chip)
```

### The two interfaces that make the LLM a drop-in
Define these as TypeScript interfaces **now**, implemented by the rules engine, registered via the existing `selectChatBackend()`:

```ts
interface AssistantBackend {
  classifyIntent(utterance: string, ctx: AssistantContext): IntentResult;
  phraseResponse(intent: IntentResult, result: ResolveResult, ctx: AssistantContext): string;
}
```

- `RulesBackend implements AssistantBackend` — ship this.
- `LlmBackend implements AssistantBackend` — future, no rewrite of stages 1/2/4.
- Stages 1, 2, 4 are **pure functions on Vyact data** — model-agnostic, reused forever.

**The non-negotiable:** stages 2 and 4 (the parts that touch real money) are never delegated to a model. The assistant is a voice over the existing calculation engine, not a second source of truth.

---

## 4. Bucket 1 — Capture

The daily-habit hook. Sentence → seeded transaction → one-tap confirm.

### Intents
- `capture.expense` — "spent 45 on fuel at Shell", "netflix 199", "coffee 5 bucks"
- `capture.income` — "got paid 85000", "received 5000 from client"
- `capture.split` — "split the 3600 dinner 4 ways", "dinner 80 between me and 2 friends"
- `capture.transfer` — "moved 10k to savings", "transfer 500 from checking"

### Workflow
1. User types into the Ask Vyact bar (routes through `selectChatBackend()` → rules engine).
2. Pipeline extracts amount + category + merchant + (split) participant count.
3. **Required slot = amount.** If present → call existing `openAddTxn(seed)` with everything pre-filled → user taps Confirm.
4. If amount missing → **one** clarifying chip ("How much was it?"), not a re-ask of the whole sentence.
5. On confirm → written through the normal store path, `source: 'user'`, `confidence: 'confirmed'`. Counts immediately.

### Notes
- **Income before expense** in rule order (the "got paid salary" / "spent" collision — see simulation).
- Bare phrasings with no verb ("netflix 199") classify via amount + category match.
- Splits reuse the existing `SplitInfo` structure and auto-even-split (v6.4.8). Capture only needs to seed it.

### Acceptance
- The 11 reference capture phrasings (§9 appendix) resolve to correct intent (11/11 in simulation).
- ≥ 9/11 immediately loggable with amount captured; rest need exactly one clarifying tap.
- No phrasing produces a wrong transaction.
- Median taps to log via assistant ≤ 2.

---

## 5. Bucket 2 — Interpret

Read the data back in plain language. Descriptive + diagnostic, grounded in deterministic queries.

### Intents
- `interpret.lookup` (descriptive) — "how much on dining this month", "show me my biggest expenses"
- `interpret.diagnostic` (why/where) — "why am I low on cash", "where's my money going", "am I double-paying"
- `interpret.status` — "what's my pulse score / net worth / balance"

### Resolution
- **Lookup** → query aggregates via existing selectors / `aiSummary`. Compare to budget if one exists.
- **Diagnostic** → reuse baseline-delta engine (category vs rolling average) + subscription registry (duplicate/forgotten subs).
- **Status** → read Pulse / Net Worth / balance + add a one-line human read.

### Proactive "what to know" layer (gated by `proactiveInsight`)
On opening Ask Vyact, surface **at most ONE** insight, ranked by materiality:
- "Your dining is 38% above your usual — want to see why?"
- "A £199 subscription renews in 3 days. Still want it?"
- "You're on track to beat your savings target this month." *(positive observations count too)*

Rate-limit: one proactive card per session. Dismissible. Off entirely when the flag or bucket is off.

### Honesty by inheritance
Because v8.0.1 tags provenance, answers are honest automatically:
> "Based on what you've logged plus your setup estimates, dining looks like ~£420 — confirm a couple and I'll tighten that."

Never present an estimate as hard fact. Use the existing `<EstimatedTag/>` semantics in any rendered figures.

### Acceptance
- Every numeric answer is traceable to a deterministic query and **matches the dashboard exactly**.
- Provenance respected — estimated-derived figures are flagged in the phrasing.
- Intent routing degrades to a clarifying chip on miss; never an error.

---

## 6. Bucket 3 — Forecast

The stickiest bucket. Forward-looking answers via the **existing Planner engine**.

### Intents → deterministic basis
| Intent | Example | Basis (from Planner) |
|---|---|---|
| `forecast.affordability` | "can I afford a £1,200 flight next week?" | liquid − upcoming fixed outflows − emergency-fund floor, vs amount |
| `forecast.runway` | "if I quit, how many months?" | (liquid + low-risk) ÷ monthly fixed burn (runway cache) |
| `forecast.goal` | "will I hit my down-payment goal by December?" | goal target/date vs current pace (Goals engine) |
| `forecast.prescriptive` | "I need £500 by next month — where do I cut?" | rank discretionary categories by overage vs rolling avg; suggest least-painful trims |

### Workflow — affordability (worked)
1. Parse → `forecast.affordability`, amount=1200, horizon=next week.
2. Planner pulls liquid balance, fixed outflows due in window, emergency-fund floor.
3. Computes headroom = liquid − due − floor; compares to 1200.
4. Phrases verdict + cushion: *"Yes — after rent and bills next week you'd have about £1,850 above your emergency fund, so £1,200 fits, leaving £650 cushion."*
5. If it doesn't fit → constructive alternative, never just "no": *"It'd be tight — you'd dip £300 into your emergency fund. Wait 9 days till payday and it's comfortable."*

### Guardrail (enforced in templates, code-reviewed)
Educate and compute against the user's own data. **No specific securities/products.** "Free up £500 by trimming dining" ✓. "Buy fund X" ✗.

### Acceptance
- The 8 reference forecast phrasings (§9) resolve to correct intent (8/8 in simulation; ensure goal-vs-runway ordering: "save <amount>" → goal, "last/quit" → runway).
- Every projection produced by the Planner — the assistant adds **no arithmetic of its own**.

---

## 7. Voice & tone — human, not a questionnaire

Tone is a first-class requirement. Rules-based ≠ robotic-sounding.

### Implementation
- One module: `lib/askVyactResponses.ts` — **variant arrays keyed by `intent + outcome`**.
- **≥ 3 phrasing variants** per intent+outcome so it never repeats verbatim.
- This is also the exact layer the future LLM replaces (`phraseResponse()` seam) — tone tuning never touches logic.

### Rules baked into templates
- **Answer-first** — verdict before reasoning.
- **Specific** — "your dining's up £80 this week", not "you may be overspending".
- **Open-ended** — every reply offers a next step / chip / alternative. Never a dead end.
- **Warm, not chummy** — a sharp friend who's good with money.
- **Honest** — says when it's leaning on estimates.

### Reference (from PRD)
| Reject (robotic) | Ship (human) |
|---|---|
| "Affordability check: NEGATIVE." | "It'd be a stretch this week — you'd dip into your emergency fund. Wait till payday Friday and it's comfortable." |
| "Insufficient data. Specify amount, category, date." | "Got it — how much was the coffee?" |

---

## 8. Privacy & the LLM seam

### v1 privacy (a selling point — state it to users)
- All parsing is **on-device**. No utterance leaves the client (there's no LLM call to make). Worth surfacing in-product.

### When the LLM lands (future, not now)
- The **only** payload sent is the existing `aiSummary` aggregation — aggregates, never raw transactions or merchant strings. PII-stripping is already the pattern.
- `LlmBackend` implements the two interfaces (§3); `selectChatBackend()` selects it via `FEATURES.askVyact.backend = 'llm'`. No change to extraction or compute.

### The validation gate (what unlocks LLM spend)
Promote to the LLM track only when v1 clears the §9 targets. Hitting them = users find this valuable enough to justify inference cost.

---

## 9. New modules, wiring, acceptance

### New modules (small, contained)
- `lib/askVyactParser.ts` — stages 1–2 (normalise + entityExtract). Pure, unit-tested.
- `lib/askVyactIntents.ts` — **extend**: ordered free-text intent rules + `classifyIntent()` (`RulesBackend`).
- `lib/askVyactResponses.ts` — template variant arrays + `phraseResponse()`.
- Thin bucket handlers calling **existing** Planner (Forecast) and aggregation (Interpret). **No new math.**

### Wiring
- Register `RulesBackend` as default in existing `selectChatBackend()`.
- Capture → existing `openAddTxn(seed)` / `seedTxn`.
- Emit existing privacy-safe intent/sentiment event on every resolution (feeds Admin AI Intelligence).
- All behind `FEATURES.askVyact`.

### Acceptance criteria (build checklist)
- [ ] **Flag off** → launcher is exactly the v7.4.5 two-tap behaviour; no free-text parsing, no new events, no console errors.
- [ ] **Capture** → 11/11 reference phrasings correct intent; ≥9 immediately loggable; one-tap clarify otherwise; no wrong transaction; ≤2 median taps.
- [ ] **Interpret** → every number traceable to a deterministic query, matches dashboard exactly; provenance flagged in phrasing.
- [ ] **Forecast** → every projection from the Planner; assistant adds no arithmetic; constructive alternative on "no".
- [ ] **Tone** → ≥3 variants per intent+outcome; no dead-end response.
- [ ] **Fallback** → unmatched utterance → warm clarifying chip + bucket launcher; never an error/blank.
- [ ] **Seam** → `classifyIntent()` + `phraseResponse()` exist as interfaces; a stub `LlmBackend` swaps in with zero change to stages 1/2/4.
- [ ] **Guardrail** → no response recommends a specific security/product (template review).
- [ ] **Tests** → grow the §appendix utterance set into the fixture; add UK/India phrasings per launch market.

---

## 10. Success metrics (also the LLM gate)

| Metric | Target | Bucket |
|---|---|---|
| Ask Vyact weekly-active (% of WAU) | ≥ 30% | All |
| Transactions logged via assistant (% of all) | ≥ 25% | Capture |
| Median taps to log via assistant | ≤ 2 | Capture |
| Interpret answer thumbs-up | ≥ 75% | Interpret |
| Forecast answer thumbs-up | ≥ 70% | Forecast |
| Fallback rate (unmatched utterances) | < 15% | All |

> Targets are Product's recommended starting thresholds — calibrate against actual WAU before sign-off. Hitting them is the signal to build the LLM backend.

---

## 11. Build order (suggested)

1. **Feature flag + toggle contract** (§2) — verify the OFF state reverts to v7.4.5 first.
2. **Parser** (`askVyactParser.ts`, stages 1–2) + unit tests on the appendix set.
3. **Intent rules + `classifyIntent()` interface** (§3) — `RulesBackend`, registered in `selectChatBackend()`.
4. **Capture bucket** (§4) — highest-frequency hook; reuses `openAddTxn`. Ship behind `askVyact.capture`.
5. **Response/tone module** (`askVyactResponses.ts`, §7) + `phraseResponse()` interface.
6. **Interpret bucket** (§5) — aggregates + diagnostic reuse + proactive insight.
7. **Forecast bucket** (§6) — Planner wiring + guardrail templates.
8. **Usage-event emission** (§9) → Admin AI Intelligence.
9. **Acceptance pass** (§9), incl. the OFF-state test and the seam stub-swap test.

---

## 12. Out of scope (so it isn't accidentally built)

- Foundational LLM / external model integration → already-roadmapped future-major v7.0.
- Voice input → fast-follow once text parsing is proven.
- Regulated financial advice (specific securities/products) → permanently out for this assistant.
- Bank-statement ingestion to power answers → assistant works off data already in Vyact.

---

*End of spec. Build the flag first; verify OFF reverts cleanly to the v7.4.5 launcher before building any bucket. The assistant phrases — services compute.*
