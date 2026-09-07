# Ask Vyact — response spec, reconciled

**Status:** decisions recorded · 11 engine tickets open ([`ask-vyact-engine`](https://github.com/Authen27/Vyact/labels/ask-vyact-engine)) · no engine work started.
**Audience:** conversation design + the engineer implementing the response layer.

---

## 0. Where the truth lives

| Artefact | Owns |
| :--- | :--- |
| `WhatsApp & Ask Vyact Message Templates/Vyact/vyact-templates/Vyact - Ask Vyact Responses.html` | **Design intent** — 24 composed responses, response anatomy, variable legends, boundaries |
| `react/src/lib/askVyactResponses.ts` | **Shipping copy** — 19 outcome states × 3 rotating phrasings |
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

### D3 · Three variants for common turns; one composed response elsewhere.

Rotation is kept where a user genuinely repeats themselves — capture
confirmations and the missing-amount ask — so a repeated message does not echo
verbatim. Everywhere else, one composed response in the spec's four-part anatomy.

Two conventions in one file is a real maintenance cost. Mark which is which in
`askVyactResponses.ts` so the next person does not "tidy" one into the other.

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
| Same point last month (“₹2,100 more than the same point in August”) | Not computed | Month-to-date total for the *equivalent day* of the prior month | [#63](https://github.com/Authen27/Vyact/issues/63) |
| Pulse movement (“up 6 from last month”) | Pulse is computed; **history is not stored** | Persist a monthly Pulse snapshot, or recompute over historical data | [#64](https://github.com/Authen27/Vyact/issues/64) |
| Logging streak (“12 days running”) | Not computed | Consecutive days with ≥1 entry | [#65](https://github.com/Authen27/Vyact/issues/65) |
| Budgets on pace (“5 of 7”) | Per-budget state exists | Aggregate count of budgets within pace | [#66](https://github.com/Authen27/Vyact/issues/66) |
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

### 3.1 Chips are produced and then thrown away

`resolve()` already returns `chip: { label, prompt }` on several outcomes. The
orchestrator never forwards it — **`AssistantTurn` has no chip field** — so no
chip has ever reached a user.

The spec needs **two or three chips per response**, as the next question rather
than navigation. So this is two pieces of work, not one:

1. Thread chips through `AssistantTurn` to the UI (the existing single chip).
2. Widen `ResolveResult.chip` to an ordered list, max three.

Ticket: [#62](https://github.com/Authen27/Vyact/issues/62) — the highest-leverage
item in this document. Until it lands, every Interpret and Forecast response in
the deck is undeliverable regardless of what the engine can compute.

Until then, every "two or three likely follow-ups" in the design spec is
undeliverable.

### 3.2 Capture verbs the parser does not have

| Designed | Status | Ticket |
| :--- | :--- | :--- |
| `delete that last one` → removes it, offers **“Put it back”** | No delete/undo intent exists. Needs an intent, a reference to “last”, and a restore path | [#71](https://github.com/Authen27/Vyact/issues/71) |
| `4200 dinner private` → trigger word sets the private flag | The transaction form has *“Private — exclude from totals”*; **the parser has no trigger word for it** | [#72](https://github.com/Authen27/Vyact/issues/72) |
| `i spent some money on food` → offers three amount chips from history | Needs 3.1 plus the chip-amount calculation in §2 | [#70](https://github.com/Authen27/Vyact/issues/70) |

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
2. **Name check — “pip.”** The assistant is called *pip* throughout the design
   spec. Nothing in the product, the code or any user-facing string uses that
   name today. Confirm it is an approved product name rather than a working
   label, because it appears in every response.
3. **Mark which responses use three variants** and which are single composed
   replies (D3), so the boundary is explicit in the copy deck.
4. **The three uncovered WhatsApp templates** — `partner_split_prompt`,
   `split_shared_with_you`, `recurring_auto_logged` — still need a design pass
   (see `whatsapp-vyact-solutioning.md` §2).
