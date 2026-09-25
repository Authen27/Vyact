# Ask Vyact — response spec, reconciled

**Status (v10.46.0):** the assistant is **Pip**. One response contract for the app and WhatsApp (`PHRASE_SYSTEM`). Engine tickets delivered: [#62](https://github.com/Authen27/Vyact/issues/62) (chips), [#63](https://github.com/Authen27/Vyact/issues/63) (same point last month), [#65](https://github.com/Authen27/Vyact/issues/65) (logging streak), [#66](https://github.com/Authen27/Vyact/issues/66) (budgets on pace), plus day windows, entry counts and shares, bills this week. Open: #64, #67–#72.
**Audience:** conversation design + the engineer implementing the response layer.

---

## 0. Where the truth lives

| Artefact | Owns |
| :--- | :--- |
| `WhatsApp & Ask Vyact Message Templates/Vyact/vyact-templates/Vyact - Ask Vyact Responses.html` | **Design intent** — 24 composed responses, response anatomy, variable legends, boundaries |
| `react/src/lib/askVyactLlm.ts` → `PHRASE_SYSTEM` | **The response contract** — how Pip speaks, on both channels. Every figure still comes from `resolve()` |
| `react/src/lib/askVyactResponses.ts` | Chips (max three, must ask something) and their numbered WhatsApp rendering |
| **This file** | **The reconciliation.** Where the two disagree, the resolution is here |

Do not re-derive the answer from either side alone. The design spec describes a
product that does not exist yet; the code describes one nobody designed.

---

## 1. Decisions

### D1 · No PIN. Last turn's decision stands.

The responses spec states that net worth *"on WhatsApp… asks for four digits."*
`read_pin_challenge` was **not adopted**. The rule is unchanged: **answer only
what the user explicitly asked for in that message**, never proactively, with no
PIN gate.

The consequence is already recorded and must reach the consent copy rather than
stay implicit: **without a PIN, whoever is holding the phone can read figures.**

> **UX action:** the responses spec's in-app / WhatsApp asymmetry ("no PIN in-app
> — you're already authenticated") is now only half true. In-app is still
> authenticated; WhatsApp is *not gated at all*, it is merely *narrower*. That
> line needs rewriting so nobody designs the four-digit turn.

### D2 · Build the calculation, then ship its copy.

Several designed responses rest on figures `resolve()` cannot produce. This is
not a copy problem — it is a **fail-closed** problem, because
`assertNoInventedFigures` discards any reply containing a number no calculation
backed. A response designed around a missing figure does not degrade; it becomes
*"I couldn't verify the numbers in that answer."*

Each missing figure is therefore an **engine requirement with its own ticket**,
and its copy is held until the number exists. See §2.

### D3 · One contract, phrased by the model. (Superseded v10.46.0.)

The rotating phrase tables (19 outcomes × 3) were removed in v10.46.0: since v10.20
the model phrases every answer and v10.38 acknowledges captures deterministically,
so none of that copy had reached a user. The contract that replaces them, in
`PHRASE_SYSTEM`:

* **Shape:** the answer, then the context that explains it, then the assumption it
  rests on. Follow-ups are chips, never listed in the prose.
* **Forecasts always state their assumption** (history used, the floor, card dues).
* **Thin history** (0–1 completed months) says "not enough history yet" instead of
  estimating.
* **Only the user's own past** as a comparison. No exclamation marks, no apology, no
  praise for recording.
* **Channel:** WhatsApp gets at most four short sentences, no links, English only;
  the app mirrors Hinglish (D4).

### D4 · Hinglish in-app only. Never on WhatsApp.

Input parsing already understands Hinglish on every surface. **Replies** mirror
the user's script **in-app only**. Category names stay English; the sentence
around them mirrors.

WhatsApp is excluded for a concrete reason: templates are approved **per
language**, so a second reply language means a second submission for every
template, each with its own review cycle and its own drift.

---

## 2. Engine requirements

Verified against the shipping code. Copy that needs these is **blocked until the
figure exists** (D2).

| Figure the spec uses | Today | Requirement | Ticket |
| :--- | :--- | :--- | :--- |
| Same point last month (“₹2,100 more than the same point in August”) | ✅ v10.46.0 `compared_with_same_point` | Month-to-date total for the *equivalent day* of the prior month | [#63](https://github.com/Authen27/Vyact/issues/63) |
| Pulse movement (“up 6 from last month”) | Pulse is computed; **history is not stored** | Persist a monthly Pulse snapshot, or recompute over historical data | [#64](https://github.com/Authen27/Vyact/issues/64) |
| Logging streak (“12 days running”) | ✅ v10.46.0 `logging_streak` | Consecutive days with ≥1 entry | [#65](https://github.com/Authen27/Vyact/issues/65) |
| Budgets on pace (“5 of 7”) | ✅ v10.46.0 `within_pace` | Aggregate count of budgets within pace | [#66](https://github.com/Authen27/Vyact/issues/66) |
| Per-merchant order count + average order value (“9 Swiggy orders at ₹233”) | Not computed | Group by merchant, count + mean, over a window | [#67](https://github.com/Authen27/Vyact/issues/67) |
| Days to payday (“11 days”, “after the 28th”) | **`payday` is a keyword only, never a modelled date** | A recurring-income date the assistant can read | [#68](https://github.com/Authen27/Vyact/issues/68) |
| Median monthly burn | `monthlyBurn()` returns a **mean** over `trend6m` | Median, or an explicit decision to keep the mean and change the copy | [#69](https://github.com/Authen27/Vyact/issues/69) |
| Chip amounts from the user's own past spends | Not computed | Three most common amounts for a category, rounded to real past values | [#70](https://github.com/Authen27/Vyact/issues/70) |

### The mean/median difference is not pedantry

`monthlyBurn()` averages six months of expense. One unusual month — a deposit, a
medical bill, a wedding — pulls the mean and quietly changes every runway and
affordability answer that rests on it. The spec asks for a median for exactly
that reason. Either change the calculation or change the copy; do not leave the
word "usual" describing a mean.

### Payday is currently a word, not a date

`payday` appears only as a trigger keyword in the intent regex and the parser's
category map. Nothing models when payday actually is.

**Shipping copy already writes cheques on this:** *"Wait till payday and it's
comfortable"* and *"Right after payday it's fine."* Both are safe only because
they are vague. The spec's *"After the 28th it's comfortable"* is better copy and
strictly requires the date. Until it exists, the vague form is the honest one.

---

## 3. Delivery gaps

### 3.1 Chips — ✅ delivered ([#62](https://github.com/Authen27/Vyact/issues/62))

Was: `resolve()` returned `chip: { label, prompt }` on several outcomes and the
orchestrator dropped it, because `AssistantTurn` had no chip field. No chip had
ever reached a user.

Now: `ResolveResult.chips` is an ordered list, `AssistantTurn` carries it, and
`Chat.tsx` renders it as a row of Aurora chips under the newest reply. Tapping
one sends its `prompt` as the next turn.

Rules the implementation pins, so the deck and the code cannot drift:

* **Max three, extras dropped** — never wrapped onto a second line. Enforced once
  in `normaliseChips` at the orchestrator boundary, not per call site.
* **A chip must ask something.** A chip with no `prompt` is dropped rather than
  rendered — the pre-#62 `{ label: 'Add details' }` placeholders would have been
  untappable dead ends, which is what the open-ended rule exists to prevent.
* **Never model-authored.** Chips come from stage 4 alongside the figures. Stage 5
  is handed `vars` only, so `assertNoInventedFigures` — which guards prose, not
  chip labels — has no blind spot to cover.
* **One definition, two renderings** (CONV-09). `renderChipsAsNumberedList()` and
  `chipPromptFromReply()` give WhatsApp the same list as numbered options.
  WhatsApp uses them since v10.45.0: the server runs this code itself (the bundled
  engine), so nothing was ported.

**Still blocked on the engine, and deliberately not shipped:**

| Designed chip | Needs |
| :--- | :--- |
| Three amounts from spend history ("₹200 · ₹500 · ₹1,000") | [#70](https://github.com/Authen27/Vyact/issues/70) |
| "When is it comfortable?" after a tight affordability verdict | [#68](https://github.com/Authen27/Vyact/issues/68) — payday as a date |
| "Show a payoff plan", "What's the Pulse made of?", "Every order" | No intent covers these yet ([#67](https://github.com/Authen27/Vyact/issues/67) for the last) |

The chips that DID ship are limited to follow-ups the existing intents can
already answer — a chip that leads to "I couldn't verify the numbers" is worse
than no chip.

### 3.2 Capture verbs the parser does not have

| Designed | Status | Ticket |
| :--- | :--- | :--- |
| `delete that last one` → removes it, offers **“Put it back”** | No delete/undo intent exists. Needs an intent, a reference to “last”, and a restore path | [#71](https://github.com/Authen27/Vyact/issues/71) |
| `4200 dinner private` → trigger word sets the private flag | The transaction form has *“Private — exclude from totals”*; **the parser has no trigger word for it** | [#72](https://github.com/Authen27/Vyact/issues/72) |
| `i spent some money on food` → offers three amount chips from history | 3.1 has landed; still needs the chip-amount calculation in §2 | [#70](https://github.com/Authen27/Vyact/issues/70) |

---

## 4. What carries over unchanged

These parts of the design spec are already true in code and need no work:

* **The seven turn types** — the spec is written in them.
* **Never a figure the app did not calculate** — enforced mechanically by
  `assertNoInventedFigures`, not left to the prompt.
* **Never a flat “no”** to affordability — shipping copy already says
  *“It'd be tight”* and names when the answer changes.
* **Comparisons are the user against their own past**, never a cohort or an
  average. Nothing in the code compares users to each other.
* **No investment, tax or legal advice** — the spec's card-vs-invest boundary
  (refuse the advice, give the interest arithmetic) is the right pattern and has
  no equivalent in shipping copy today. Worth adding as a real Refuse turn.

---

## 5. Open for UX

1. **Rewrite the PIN line** in the responses spec per D1, so nobody designs a
   four-digit turn.
2. ~~Name check — “pip.”~~ **Decided (owner, v10.46.0): the assistant is Pip**, in
   every user-facing string. Code identifiers (`askVyact*`) are unchanged.
3. **Mark which responses use three variants** and which are single composed
   replies (D3), so the boundary is explicit in the copy deck.
4. **The three uncovered WhatsApp templates** — `partner_split_prompt`,
   `split_shared_with_you`, `recurring_auto_logged` — still need a design pass
   (see `whatsapp-vyact-solutioning.md` §2).

---

## 6. The WhatsApp answer rule (v10.46.0)

**A question asked on WhatsApp is answered on WhatsApp. A link is never the answer.**

| Reply is… | On WhatsApp |
| :--- | :--- |
| **A question** (typed, a menu "Check" row, a question-shaped template button) | Answered in the chat by Pip, from the same engine as the app. Buttons carry their context (a budget alert's category) so the answer is about exactly that. |
| **An action the chat can do** (log, undo, correct, approve a reminded bill, mute) | Done in the chat, and said. |
| **An action that needs the app's screens** (set up a recurring bill, edit a budget, approve an EMI, edit an older entry) | Say what cannot happen here and why, in one sentence. The link is the last line, one link at most. |
| **Onboarding** (an unlinked number) | A link to sign up is the answer. |

Answers require the person's own consent ("Answer my questions here",
`reads_enabled`, off by default), because figures reach the lock screen. **Open
decision (owner):** what a person with answers OFF gets instead of today's link. See
the W5 recommendation in the PR.
