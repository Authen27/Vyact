# Vyact Agent — ingestion eval corpus

The golden corpus and harness for `runIngestion` (`supabase/functions/_shared/agent/pipeline.ts`),
i.e. **layer 6** of `vyact-agent-architecture.md` §7.

```bash
node evals/runner.mjs                    # score the corpus, gate on it
node evals/runner.mjs --verbose          # every case + every known gap
node evals/runner.mjs --bucket=free_text # one bucket
node evals/runner.mjs --record           # observed outcomes as JSON (authoring aid)
node evals/runner.mjs --json             # machine-readable report
```

Exit codes: `0` green · `1` gate failed · `2` harness error.

**It runs offline, with no model, no API key, no network and no database.** The default
`--provider=null` hands `runIngestion` an empty `IngestionDeps` bag, which is byte-identically
the deterministic path that ships today. It costs nothing to run and it cannot leak anything.
If it ever needs a key, something has been built wrong — see the header of `providers.mjs`.

The clock is **frozen** at `2026-08-20T10:00:00Z` (`resolveCandidate` takes an injected clock
precisely so a corpus does not rot).

---

## What the current number does and does not prove

As of this writing the harness reports **94.0% over 84 scored cases, and the gate is RED**
(threshold 95%, plus one failing `safety` case). That is the correct and intended state:
the failures are real defects in the pipeline, documented below, and the threshold has
deliberately **not** been tuned down to hide them.

**It proves:**

- The deterministic free path works for the shorthand it claims to support. English and
  Hinglish shorthand with a category keyword and an account resolves cleanly to a `write`,
  with the money model intact (transfers/investments are one neutral row, both account
  slots, category `null`).
- Questions are never logged. All 17 `block` cases pass, including traps that contain an
  amount, a category, a date and a resolvable account inside an interrogative.
- Prompt injection through message text is inert. 13 adversarial cases pass; none produces
  a write it should not, and an unresolvable account drafts rather than writing.
- Ambiguity is asked, not guessed: household (always, when there is more than one),
  a tied alias, a tied category, conflicting polarity.
- The 4 bank-SMS `ignore` cases (OTP, promo, statement notice, bare balance) still refuse.

**It does not prove:**

- **Anything about extraction quality**, because with no model and no recipe cache nothing
  extracts a bank SMS at all. 25 of the 29 `bank_sms` cases are known gaps by construction.
  This bucket is the instrument for the future bake-off, not a current measurement.
- **Anything about dedupe.** `checkDuplicate` needs a date, and `extractByGrammar` never
  emits one, so the dedupe stage is unreachable on the deterministic path. The two passing
  duplicate cases only prove dedupe does not fire when it should not.
- **Anything about Telugu**, beyond "it does not corrupt anything". The 5 passing Telugu
  cases are the script-agnostic classifiers (query, chitchat) and mixed-script sentences
  whose amount and account happen to be Latin. There is no Telugu vocabulary table yet.
- **That a model would help.** That is the question the corpus exists to answer later, by
  re-running it with `--provider=<name>` and diffing the bucket table.

A green run here is a statement about the *deterministic* pipeline only.

---

## Buckets

| file | what it covers | shape |
| --- | --- | --- |
| `bank_sms.jsonl` | Fabricated bank/card SMS across 5 issuers: UPI, POS, ATM, NEFT/IMPS, EMI, FX, refunds, plus the OTP / promo / statement / bare-balance traps | mostly known gaps — the headline measurement of what a model buys |
| `free_text.jsonl` | English typed shorthand — the free fast path | the regression net for what ships today |
| `hinglish.jsonl` | Roman-script Hindi mixed with English (`500 kharcha`, `khana 300`, `paise bheje 2000`) | mostly passing |
| `telugu.jsonl` | Telugu script, required Telugu-ready from day one | mostly known gaps, marked honestly |
| `ambiguous.jsonl` | Inputs that must produce a **question**, each naming the ambiguity kind | multi-household, tied alias, tied category, polarity conflict, card three-way |
| `duplicates.jsonl` | Exact-by-reference (→ `ignore`) and near-match (→ `ask`), plus no-false-positive controls | dedupe is unreachable today; controls pass |
| `queries.jsonl` | Questions that must `block` | passing |
| `adversarial.jsonl` | Prompt injection via message text, and inputs engineered to write an unresolvable account | **none of these may ever produce `write`** unless the write is the plainly correct reading of the text as data |

**Everything in every file is fabricated.** No real account numbers, no real names, no real
merchant tied to a person. Masks (`4471` / `8802` / `3319` / `1207` / `6650`) and references
are obviously synthetic; merchants are invented (TESTMART, SAMPLECAFE, QUICKCART, METROFUEL,
TESTSTREAM, testvendor). Do not add a case containing anything real.

---

## Real defects this corpus currently catches

These are **left scored and red on purpose**. They are bugs, not missing features, and the
pipeline was not patched to make the number look better.

**BUG A — scaled shorthand is silently dropped** (`ft-scale-k-transfer`, `ft-scale-k-expense`,
`ft-scale-lakh`). `grammar.scaleMultiplier` expands `10k` → `10000` and `2 lakh` → `200000`.
`validator.amountAppearsInSource` then looks for the literal expanded figure in the raw text,
finds only `10` / `2`, and raises `amount_not_in_source` at severity **reject**. The message is
dropped with no question and no draft. Two modules that ship together disagree about what an
amount is. `2 lakh rent` is ordinary Indian phrasing, so this is high-traffic.

**BUG B — every spend typed against a credit card is dropped** (`ft-credit-card-debit-dropped`).
`validator.CREDIT_VERBS` matches the bare word `credit`, so the phrase **"credit card"** makes
`sourceDirection()` report `credit`. An explicit debit verb (`bought`, `spent`, `paid`) then
trips `polarity_contradicts_type` at severity **reject**. `bought 999 shoes with kotak credit
card` is silently lost; `spent 700 on netflix from kotak` — the same account, named without the
word "card" — writes fine (`ft-netflix-kotak-alias` is the control that isolates it).

**BUG C — the card three-way question is unreachable** (`amb-card-three-way`, marked `safety`).
`ambiguity.cardTxnTypeAmbiguity()` implements the architecture's flagship §3.5 example (the
`1200 amex` split: spend on the card / pay the card bill / transfer to the card) and gates it on
`AmbiguityContext.hasCardAccountMatch`. `pipeline.ts` never sets that field when it builds the
context, so the branch is dead and `1200 on kotak credit card` **writes silently** instead of
asking. This is the one failing `safety` case, and it fails the gate on its own.

Also worth knowing, filed as known gaps rather than red because they are cosmetic or are
missing data rather than wrong behaviour:

- **BUG D** (`adv-zero-amount-reason`): `pipeline.ts` stage 3B only assigns `extraction` when
  `g.ok` is true, so a failed grammar result is discarded and `extraction?.reason` is dead code.
  Every non-query grammar decline reports `not_parseable`; `no_amount` can never surface, which
  makes ingestion telemetry unable to tell "nothing to log here" from "I could not read this".
- **Dedupe is unreachable** on the deterministic path (`extractByGrammar` emits no date).
- `in` is a filler, not a preposition, so `in <account>` never fills the account slot.
- Hindi `se` is a postposition, but `fromWords` are compiled as prepositions.
- `trailingAlias()` only scans after a matched category keyword, so `1200 kotak` sees no account.
- `validator.DEBIT_VERBS` is narrower than `grammar.debitVerbs` and is English-only, so a
  Hinglish verb reads as inferred polarity and produces an extra confirmation question. Safe,
  but the two vocabularies should agree.

---

## Adding a case

One JSON object per line in the relevant `evals/cases/*.jsonl`. Blank lines and `//` lines are
ignored, so keep the file commented. Schema — **only `id` and `expect.outcome` are required**,
and `diff()` checks only the keys you actually assert:

```jsonc
{
  "id": "ft-groceries-hdfc",        // unique across the whole corpus; the runner rejects duplicates
  "bucket": "free_text",            // defaults to the filename
  "text": "850 groceries hdfc",
  "channel": "chat",                // chat | whatsapp | sms_share | receipt   (default: chat)
  "ctx": "one_household",           // one_household | two_households | hdfc_twice (default: one_household)
  "recent": "none",                 // none | same_day_groceries | cafe_auth | with_reference | unrelated
  "householdId": "h1",              // default h1; set to null to test the unknown-household path
  "hasImage": false,
  "safety": false,                  // true => a failure fails the GATE regardless of accuracy
  "expect": {
    "outcome": "write",             // write | draft | ask | block | ignore   (required)
    "reason": "chitchat",           // only for ignore/block
    "format": "free_text",
    "extractor": "grammar",
    "ambiguityKinds": ["account"],  // SUBSET assertion — the engine may add more, never drop these
    "minOptions": 2,                // floor on options per question
    "candidate": { "amount": 850 }, // per-key equality on the resolved candidate
    "issues": ["polarity_missing"]  // validator issue codes that MUST be raised
  },
  "note": "why this case exists"
}
```

The fixtures (`CONTEXTS`, `RECENT_SETS`) live at the top of `runner.mjs`. Add a fixture there
rather than inventing account names inside a case.

**Write the expectation as product ground truth first, then run it.** `--record` prints what the
pipeline actually did, which is the fastest way to author a case — but do not paste the observed
value in as the expectation without deciding it is correct. A corpus that only contains passing
cases measures nothing.

### `expectedFailure`

Mark a case `expectedFailure: true` **only when the pipeline genuinely cannot handle it today** —
a capability that has not been built (no model, no recipe cache, no Telugu vocabulary table), not
a bug that produces a wrong or dangerous answer. The runner enforces two things:

- `baseline: { "outcome": ..., "reason": ... }` — the observed behaviour today, and
- `note` — one line saying **why**.

A known-gap case that stops matching its baseline is reported as **BASELINE DRIFT** and fails the
gate. That includes the good direction: when the gap closes, the case starts passing, the runner
says `NOW PASSES — retire the expectedFailure`, and the drift keeps the build red until someone
deletes the marker. Known gaps are excluded from the accuracy denominator.

Do **not** use `expectedFailure` to silence a red case you do not want to explain. If the pipeline
does the wrong thing, leave it scored and let the gate go red — that is the whole point of a gate.

---

## The gate

Red when **any** of these holds:

1. accuracy over scored cases `< --threshold` (default **0.95**);
2. any case marked `safety: true` fails;
3. any `expectedFailure` case drifts from its recorded baseline.

Do not lower the threshold to get a green build. If a real bucket drops the number, the number
is the news.

## Boundaries

Agent evals live **outside** `docs/TEST_SCENARIOS.md` — no TS-IDs here, and that catalogue is not
touched. This harness reads `supabase/functions/_shared/agent/**` and nothing else; it imports no
`react/src` module, starts no server, and writes nothing anywhere.
