# Ask Vyact — LLM run log

> Every question ever sent through the Ask Vyact LLM gateway, reconstructed from production
> `public.ai_usage` (all 64 `backend='llm'` rows) and `function_edge_logs`.
> Project `dmxqkvploojokffuhxnz` · compiled 2026-09-13.

## Read this first — what this log can and cannot show

**It cannot show what the model said.** Reply text is never persisted, by design:
`logAiUsage` ([aiUsage.ts](../react/src/lib/aiUsage.ts)) records "intent + sentiment + length
only — NEVER message text", and the gateway meters metadata only. So this log proves each
question **completed**, how fast, at what cost, and through which model. It does **not** prove any
answer was **correct**. Correctness needs the live harness (`react/vitest.live.config.ts`), which
prints the reply and the model's chosen `intentId` per scenario.

**The question text isn't stored either.** Scenarios are attributed by matching two stored fields
— `message_len` and the client's regex `intent` — against each scenario's exact prompt. A match
means "consistent with that prompt", not certainty. An ad-hoc question of the same length and
intent class would be indistinguishable.

**How rows become questions.** Each question writes one client row (`provider` null, carries
`message_len`/`intent`/total latency) plus one gateway row per model call. A healthy question makes
two calls — classify, then phrase. A question whose classify call fails stops there: one gateway
row, not two.

---

## Summary

**24 questions across 4 periods.** 8 of 14 scenarios have passed at least once.

| | Sonnet 5 | Nemotron 3 Super (free) |
|---|---|---|
| questions | 4 | 14 |
| completed | **4 (100%)** | **12 (86%)** — 11 ok, 1 clarify |
| errors | 0 | 2 — HTTP 502 |
| median turn | **7.4s** | **10.2s** |
| mean turn | 8.0s | 11.7s |
| turn range | 6.6 – 10.6s | 5.4 – **21.7s** |
| classify output tokens | 31 – 71 | 87 – **564** |
| phrase output tokens | 21 – 31 | 76 – 192 |
| total cost | **$0.0081** | **$0.00** |
| cost / question | $0.0020 | $0.00 |

The 6 questions before 2026-09-13 never reached a model — see period 1.

**Same scenario, both models (`cut-back`):** Sonnet 6.6s for $0.0019; Nemotron 21.7s for $0.00.
Nemotron was 3.3× slower on an identical prompt.

---

## Scenario coverage

| scenario | kind | exact prompt | status | evidence |
|---|---|---|---|---|
| spend-month | ask | How much did I spend this month? | ✅ Sonnet · ❌ Nemotron 502 | Q8 · Q24 |
| health | ask | How am I doing financially? | ⬜ **not run** | — |
| net-worth | ask | What's my net worth? | ⬜ **not run** | see Q15 note |
| budgets-risk | ask | Which budgets are at risk? | ⬜ **not run** | — |
| top-categories | ask | What are my top spending categories this month? | ✅ Nemotron | Q14 |
| upcoming-bills | ask | What are my upcoming bills? | ✅ Nemotron | Q19 |
| emergency | ask | How long would my money last without income? | ✅ Nemotron | Q12 |
| debts | ask | Tell me about my debts and the best payoff strategy. | ✅ Nemotron | Q13 |
| affordability | ask | Can I afford a 1200 purchase? | ✅ Nemotron | Q20 |
| cut-back | ask | Where can I cut back on spending? | ✅ both | Q10 · Q11 |
| cap-expense | capture | spent 45 on fuel | ⬜ **not run** | — |
| cap-income | capture | received 5000 salary today | ❌ Nemotron 502 | Q22 |
| cap-transfer | capture | transferred 200 from my bank to cash | ✅ Sonnet | Q7 |
| cap-investment | capture | invested 500 in my index fund | ⬜ **not run** | — |

**Outstanding: 6** — never run: `health`, `net-worth`, `budgets-risk`, `cap-expense`,
`cap-investment`; failed: `cap-income`. For a Nemotron-specific verdict, also retry `spend-month`,
which passed on Sonnet but 502'd on Nemotron.

---

## Full question log

Columns: classify and phrase show *prompt/output tokens · latency*. Scenario ✓ = matches that
scenario's length+intent signature; `?` = no scenario matches (ad-hoc question).

### Period 1 — secret not set · 2026-09-11 → 09-12 · every call HTTP 503

No model was ever called. The router returned `missing_key` before any provider request, so each
question has a single failed classify call and no phrase call.

| # | time (UTC) | len/intent | scenario | outcome | HTTP | turn |
|---|---|---|---|---|---|---:|
| Q1 | 09-11 14:02:18 | 27 / other | upcoming-bills ✓ | error | 503 | 5.0s |
| Q2 | 09-11 14:02:37 | 29 / spending | affordability ✓ | error | 503 | 1.6s |
| Q3 | 09-11 14:03:07 | 27 / spending | ? | error | 503 | 1.9s |
| Q4 | 09-12 09:54:46 | 21 / spending | ? | error | 503 | 4.7s |
| Q5 | 09-12 09:54:58 | 29 / spending | affordability ✓ | error | 503 | 1.6s |
| Q6 | 09-12 13:51:39 | 26 / other | cap-income ✓ | error | 503 | 4.1s |

### Period 2 — Claude Sonnet 5 · 2026-09-13 11:52 → 11:53 · all HTTP 200

| # | time | len/intent | scenario | outcome | turn | classify | phrase | cost |
|---|---|---|---|---|---:|---|---|---:|
| Q7 | 11:52:06 | 36 / other | cap-transfer ✓ | ok | 10.6s | 392/71 · 3.8s | 279/22 · 2.7s | $0.00227 |
| Q8 | 11:52:59 | 32 / spending | spend-month ✓ | ok | 7.4s | 387/38 · 2.4s | 288/31 · 3.1s | $0.00204 |
| Q9 | 11:53:17 | 39 / spending | ? | ok | 7.4s | 388/38 · 2.7s | 288/21 · 2.4s | $0.00194 |
| Q10 | 11:53:31 | 33 / spending | cut-back ✓ | ok | 6.6s | 389/31 · 2.4s | 288/21 · 2.4s | $0.00187 |

### Period 3 — Nemotron free · 2026-09-13 12:03 → 12:10 · all HTTP 200

| # | time | len/intent | scenario | outcome | turn | classify | phrase |
|---|---|---|---|---|---:|---|---|
| Q11 | 12:03:44 | 33 / spending | cut-back ✓ | ok | **21.7s** | 277/346 · **17.8s** | 209/77 · 1.3s |
| Q12 | 12:04:06 | 44 / other | emergency ✓ | ok | 7.1s | 278/150 · 4.0s | 199/76 · 1.1s |
| Q13 | 12:04:31 | 52 / debt | debts ✓ | ok | 16.3s | 281/211 · 1.8s | 239/192 · **12.6s** |
| Q14 | 12:05:01 | 47 / spending | top-categories ✓ | ok | 9.0s | 278/265 · 5.6s | 220/127 · 2.1s |
| Q15 | 12:05:29 | 20 / other | ? *(see note)* | ok | **19.6s** | 274/316 · **16.5s** | 220/77 · 1.1s |
| Q16 | 12:07:36 | 42 / spending | ? | ok | 10.2s | 278/122 · 7.1s | 209/83 · 1.1s |
| Q17 | 12:08:17 | 32 / other | ? | **clarify** | 10.4s | 280/296 · 3.3s | 198/131 · 4.5s |
| Q18 | 12:08:46 | 8 / other | ? | ok | 10.0s | 273/**564** · 5.9s | 210/94 · 2.2s |
| Q19 | 12:09:14 | 27 / other | upcoming-bills ✓ | ok | 10.3s | 275/87 · 3.3s | 215/176 · 5.3s |
| Q20 | 12:09:34 | 29 / spending | affordability ✓ | ok | 5.4s | 280/127 · 1.2s | 218/133 · 2.1s |
| Q21 | 12:10:11 | 27 / spending | ? | ok | 10.5s | 279/136 · 5.3s | 208/113 · 1.7s |

**Q15 note.** Earlier analysis attributed this to `net-worth`. That was wrong. "What's my net worth?"
matches the client's `networth` intent pattern (`/\b(net worth|networth|…)\b/`), but this question
logged as `other` — so it was a different 20-character question. `net-worth` has never been run.

### Period 4 — Nemotron free · 2026-09-13 14:10 → 14:11 · mixed

| # | time | len/intent | scenario | outcome | HTTP | turn | classify | phrase |
|---|---|---|---|---|---|---:|---|---|
| Q22 | 14:10:41 | 26 / other | cap-income ✓ | **error** | **502** | 1.6s | 0/0 · 0.5s *rejected* | — |
| Q23 | 14:11:09 | 9 / other | ? | ok | 200 | 10.0s | 271/193 · 3.6s | 210/78 · 4.6s |
| Q24 | 14:11:35 | 32 / spending | spend-month ✓ | **error** | **502** | 1.1s | 0/0 · 0.2s *rejected* | — |

---

## Performance analysis

### Reliability
- **Sonnet: 4/4.** No failures.
- **Nemotron: 12/14.** Both failures were HTTP 502 with the gateway row showing `provider`
  populated and zero tokens, rejected in 216–525ms. That combination means a real call to OpenRouter
  was made and refused instantly — `http_error`, not a config fault (which returns 503) or a
  timeout (504). A success landed between the two failures, so this is intermittent, not an outage.
  Best-fitting cause is free-tier throttling, but **the exact upstream status is unconfirmed**: the
  gateway returns it in the response body and never logs it.

### Latency
- **Nemotron is slower and much less predictable.** Median 10.2s vs 7.4s, but the real issue is the
  tail: three turns ran 16–22s, and in each case one call spiked (17.8s, 16.5s, 12.6s) while its
  partner was normal. For a chat UI that variance matters more than the median.
- **Sonnet is tightly clustered**, 6.6–10.6s, with every individual call between 2.4 and 3.8s.

### Tokens
- **Nemotron emits 3–8× more output tokens.** Classify should return a few bytes of JSON; Sonnet
  used 31–71 tokens, Nemotron 87–564. This is reasoning output, and it is free here.
- **These counts do not threaten truncation.** Classify is capped at 256 tokens in code, yet Q18
  reported 564 and succeeded — `completion_tokens` includes reasoning that the visible-output cap
  doesn't bound. (`params.max_tokens` in `ai_model_configs` is never read for this seam; see
  `ASK_VYACT_STATUS.md`.)

### Cost
- **Sonnet: $0.0081 for 4 questions, $0.0020 each.** Prompt tokens dominate (~390 in / ~280 in per
  call pair) because the classify system prompt carries the full intent catalogue.
- **Nemotron: $0.00**, confirmed on all 24 successful calls.

### Answer quality
**Not measurable from this data.** One turn returned `clarify` (Q17), which means the model routed
a question to a clarifying answer rather than an error — but whether any of the 20 completed answers
was *right* cannot be determined without reply text.

---

## To finish coverage

Ask these exactly as written, so the length+intent signature can identify them:

```
How am I doing financially?
What's my net worth?
Which budgets are at risk?
spent 45 on fuel
received 5000 salary today
invested 500 in my index fund
How much did I spend this month?
```

The first six have never passed; the last is a Nemotron retry. Pace them roughly a minute apart on
the free tier. Any 502 is a provider rejection — retry it rather than recording it as a failure of
Ask Vyact.
