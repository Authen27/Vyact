# WhatsApp templates — what is submitted to Meta

> **Source of truth for the W1 template manifest** (`supabase/functions/_shared/whatsapp-templates.ts`).
> Every body, variable order, button and category below is exactly what was submitted, so a send must
> match it field for field or Meta rejects the message.
>
> WABA **Vyact App `1887272231954080`** (+91 88978 82803). All templates are language **English (US)**
> (`en_US`). Submitted through WhatsApp Manager on 24–25 Sep 2026.

## Sending image templates (resolved in v10.41.0)

> **Resolved.** `sendTemplateMessage` adds the header image from `vyact.app/whatsapp/` (optimised JPEGs
> in `react/public/whatsapp/`), and the manifest `_shared/whatsapp-templates.ts` mirrors this file.
> The original warning is kept below for history.


Once a template has an IMAGE header, Meta requires the image (a link or an uploaded media id) on
**every** send. `sendTemplate` in `_shared/whatsapp.ts` sends body parameters only. **W1.6 must add the
header component before any template below is added to `WHATSAPP_APPROVED_TEMPLATES`**, or every send
fails. The 11 header images are in
`WhatsApp & Ask Vyact Message Templates/Vyact/vyact-templates/media/` (1200×628 PNG).

## Status snapshot (25 Sep 2026)

| Template | Category | Image | Change | Status |
|---|---|---|---|---|
| `bill_due_reminder` | Utility | 01-bill-reminder | Image added; body unchanged | Active, verified field by field on 26 Sep |
| `split_settled` | Utility | 08-split-settled | Image added; body unchanged | Active, verified field by field on 26 Sep |
| `weekly_summary` | Utility → **flagged as Marketing** | 09-weekly-summary | Image added; body unchanged | Sample sent to the owner and **delivered** 26 Sep 15:05 UTC. Then the See details link was edited from the old vyact-twentyx site to https://vyact.app/reports (link tracking off): **in review**, and out of the approved list until approved |
| `reengagement_nudge` | Marketing | 04-reengagement | **Edited 26 Sep (W6)**: the board's unnamed-spending variant, a **Name them here** quick reply, Open Vyact → vyact.app. The image now matches the body | Approved version active; edit in review |
| `payday_headroom` | Utility | 02-payday | New | Active, verified field by field on 26 Sep |
| `household_daily_digest` | Utility | 03-household-digest | New | Active, verified field by field on 26 Sep |
| `runway_shift_alert` | **Marketing** (Meta's pre-check: "Utility will be rejected") | 05-runway-shift | New | Active, verified field by field on 26 Sep |
| `month_close_summary` | Utility | 06-month-close | New | Active, verified field by field on 26 Sep |
| `budget_setup_reminder` | **Marketing** (as planned) | 07-budget-setup | New | Active, verified field by field on 26 Sep |
| `balance_stale_nudge` | **Marketing** (as planned) | 10-balance-recheck | New. An "Update here" button + "Reply UPDATE" line is planned (W6); Meta locks a template during its first review, so the edit waits for approval | Active, verified field by field on 26 Sep |
| `affordability_reply` | Utility | 11-forecast-response | New | Active, verified field by field on 26 Sep |
| `large_transaction_alert` | Utility | — | Enriched 25 Sep (below) | Active, verified field by field on 26 Sep |
| `budget_threshold_alert` | Utility | — | Enriched 25 Sep | Active, verified field by field on 26 Sep |
| `partner_split_prompt` | Utility | — (split image requested from design) | Enriched 25 Sep | Active, verified field by field on 26 Sep |
| `split_shared_with_you` | Utility | — | Enriched 25 Sep | Active, verified field by field on 26 Sep |
| `recurring_auto_logged` | Utility | 17-recurring-logged (pending) | Enriched 25 Sep. **26 Sep:** edit submitted adding the image header; the manifest gets `headerImage` after approval | Was active and verified 26 Sep; image edit in review |
| `whatsapp_welcome` | Utility | 12-welcome | New; sent once after linking. Its buttons already work | Active, verified field by field on 26 Sep |
| `bill_overdue_reminder` | Utility | 13-bill-overdue | Variant B of the bill reminder (W5). Sent once, 3 days past due | Active, verified field by field on 26 Sep |
| `payday_headroom_variable` | Utility | 14-payday-variable | Variant B of payday (W5). Sends once payday is a date (#68) | Active, verified field by field on 26 Sep |
| `reengagement_nudge_quiet` | **Marketing** | 15-reengage-quiet | Variant B of re-engagement (W5). "Reply LOG" works; the weekly job sends it after 7 quiet days (W6) | Active, verified field by field on 26 Sep |
| `runway_recovered_alert` | **Marketing** | 16-runway-recovered | Variant B of the runway note (W5) | In review (submitted 25 Sep) |
| `hello_world` | Utility | — | Meta sample; cannot be deleted. Kept for test sends | Active |

**Activation (26 Sep).** `WHATSAPP_OUTBOUND_ENABLED=true`, and `WHATSAPP_APPROVED_TEMPLATES` lists the templates verified above: 16 on 26 Sep 03:07 UTC, then 18 at 13:25 UTC (adding bill_overdue_reminder, payday_headroom_variable and reengagement_nudge_quiet; recurring_auto_logged removed while its image edit is in review), then 17 at 15:09 UTC (weekly_summary out while its link edit is in review). Each one was checked field by field against the manifest in the Meta edit form: body, variables, samples, header, footer, buttons and links. Templates still in review are left out; add each one only after it is approved and checked. The scheduler (`whatsapp-dispatch`) still needs the Vault secret `whatsapp_dispatch_secret` and the matching `WHATSAPP_DISPATCH_SECRET` before any scheduled message goes out.

**Deleted 25 Sep:** `recurring` (a "pay now" overdue-card message that Vyact never sends),
`feedback`, and `3p_direct_integration_test_template`. None was used by the app.

The runbook's 15 Aug "In review" for the original nine was stale: on 24 Sep all nine showed
**Active – Quality pending** (approved) before these edits.

**Marketing** templates are sent only to people who have opted in to marketing messages
(`whatsapp-notify` refuses them until the W2 consent record exists).

## Validation (26 Sep 2026, v10.47.0)

Live samples went to the owner's number (+91 97405 56606) through `whatsapp-notify` with the service key; delivery is from Meta's status callbacks (`delivery_status`).

| Template | Meta | Sender in code | Buttons answered | Live sample |
|---|---|---|---|---|
| `bill_due_reminder` | Active | dispatch `bills` | Mark as paid, Remind me tomorrow | Delivered |
| `bill_overdue_reminder` | Active | dispatch `bills` | Already paid | Delivered |
| `split_settled` | Active | dispatch `alerts` | — | Delivered |
| `split_shared_with_you` | Active | dispatch `alerts` (**new, W6b**) | — | Delivered |
| `large_transaction_alert` | Active | dispatch `alerts` | — | Delivered |
| `budget_threshold_alert` | Active | dispatch `alerts` | yes | Delivered |
| `payday_headroom` / `_variable` | Active | dispatch `alerts` (**new, W6b**) | yes | Delivered / Delivered |
| `household_daily_digest` | Active | dispatch `digest` (**new, W6b**, 15:00 UTC) | — | Delivered |
| `month_close_summary` | Active | dispatch `monthly` on the 1st (**new, W6b**) | — | Delivered |
| `budget_setup_reminder` | Active | dispatch `monthly`, 2 days before month end (**new, W6b**) | — | Delivered |
| `runway_shift_alert` | Active | dispatch `monthly` (**new, W6b**; first reading is a silent baseline) | yes | Delivered |
| `runway_recovered_alert` | In review | dispatch `monthly` (**new, W6b**) | yes | Not sendable until approved |
| `balance_stale_nudge` | Active | dispatch `weekly` | UPDATE (typed) | Delivered |
| `reengagement_nudge_quiet` | Active | dispatch `weekly` | LOG | Delivered |
| `reengagement_nudge` | Edit in review | dispatch `weekly` | Name them here | Held until the edit is approved |
| `weekly_summary` | Link edit in review | dispatch `weekly` | — | Delivered 15:05 (before the edit) |
| `partner_split_prompt` | Active | webhook: an expense logged with "shared" (**new, W6b**) | Split 50/50, It's all mine, Not shared | Delivered |
| `recurring_auto_logged` | Image edit in review | dispatch `alerts` for auto-confirm schedules (**new, W6b**) | Undo (15 min), Pause | Held until the edit is approved |
| `affordability_reply` | Active | webhook: a "can I afford" answer that fits (**new, W6b**) | Show the working | **Accepted by Meta, no delivery receipt** — owner to check the phone |
| `whatsapp_welcome` | Active | `whatsapp-verify-otp` after linking | yes | Delivered |
| `phone_verification_otp` | Does not exist | `whatsapp-send-otp` now says "not available yet" (503 `otp_unavailable`) | — | Blocked on Meta business verification |

**Bugs found and fixed in v10.47.0:** "can I afford 40000 for a phone?" was logged as a ₹40,000 spend (parser); the outbound audit row recorded `result: {sent:false}` on a successful send; linking by code failed with a raw error while the OTP template does not exist; Settings had no insights consent, so payday/digest/runway could never be switched on in the app.

**Open (owner / Meta):** approvals for the four templates in review, then add each to `WHATSAPP_APPROVED_TEMPLATES` after a field check; the `balance_stale_nudge` UPDATE button edit (now possible); the `weekly_summary` STOP footer after its approval; the Vault secret `whatsapp_dispatch_secret` + `WHATSAPP_DISPATCH_SECRET` before anything scheduled goes out; Meta business verification for linking.

## Bodies as submitted

Variables are numbered in reading order. The sample values are the ones Meta reviewed.

### Existing templates (bodies unchanged; image header added)

- **`bill_due_reminder`**. `Reminder: your {{1}} of {{2}} is due on {{3}}. Reply "paid {{4}}" to log it.`
  - Samples: Rent · ₹25,000 · 5 Aug · Rent.
- **`split_settled`**. `Update: {{1}} settled their {{2}} share of "{{3}}". You're all square.`
  - Samples: Priya · ₹600 · Dinner at Olive.
- **`weekly_summary`**. `Your week on Vyact: {{1}} spent across {{2}} transactions. Top category: {{3}} this week.`
  - Samples: ₹12,400 · 23 · Food & Dining.
  - Button: link "See details".
- **`reengagement_nudge`** (approved version, until the 26 Sep edit is approved). `It's been a while since you tracked an expense. A quick tap keeps your money picture accurate.`
  - Button: link "Open Vyact" to the old `vyact-twentyx…` URL.
  - **Edit submitted 26 Sep (W6):** `Hi {{1}}, ₹{{2}} of this month's spending has no category yet. That's {{3}} entries, and until they're named your category totals are guessing.` / `Tap Name them here and we'll sort them in this chat, one line each.`
    - Samples: Rohan · 6,850 · four. Footer: `You opted into tips. Reply STOP TIPS to end them.`
    - Buttons (Meta's order): link "Open Vyact" → https://vyact.app (link tracking off), quick reply "Name them here".

### Enriched 25 Sep (text only; wording, values and buttons changed)

⚠️ The values changed for several of these. The W1 send code must send exactly these.

- **`large_transaction_alert`**. `Heads-up: ₹{{1}} just went out on your {{2}}.⏎⏎If that was you, there's nothing to do. If it wasn't, tap Flag it and I'll mark it for review.`
  - {{1}} amount without ₹ · {{2}} **account name** (was the payee).
  - Samples: 18,000 · HDFC card.
  - Buttons: link `Review` → https://vyact.app/transactions (was the old domain) · quick replies `Flag it` · `That was me`.
- **`budget_threshold_alert`**. `Heads-up: {{1}} is at {{2}}% of its budget, with {{3}} days to go.⏎⏎₹{{4}} is still in the pot.`
  - {{1}} category · {{2}} % used (a number) · {{3}} days left · {{4}} remaining, without ₹. **Was 3 values in a different order.**
  - Samples: Dining · 78 · 18 · 1,540.
  - Buttons: link `View budget` → https://vyact.app/budgets · quick replies `What's driving it?` · `Stop budget alerts`.
- **`partner_split_prompt`**. `New shared expense: {{1}} logged ₹{{2}} for "{{3}}".⏎⏎How should it split? Nothing changes until you pick.`
  - {{2}} amount **without ₹** (the symbol is now in the wording).
  - Samples: Priya · 1,200 · Dinner at Olive.
  - Quick replies unchanged: `Split 50/50` · `It's all mine` · `Not shared`.
- **`split_shared_with_you`**. `Update: {{1}} shared a split with you on Vyact: ₹{{2}} for "{{3}}".⏎⏎Your share: ₹{{4}}. Settle it in the app whenever you're ready.`
  - {{2}} total without ₹ · **{{4}} the recipient's share (new)**.
  - Samples: Priya · 2,400 · Dinner at Olive · 800.
  - Button: link `See your share` → https://vyact.app/splits (was "Open Vyact", old domain).
- **`recurring_auto_logged`**. `Logged as scheduled: your {{1}} of ₹{{2}} on {{3}}.⏎⏎If it didn't go out this time, tap Undo within 15 minutes.`
  - {{1}} schedule name · {{2}} amount without ₹ · {{3}} date.
  - Samples: Netflix · 649 · 1 Aug.
  - Quick replies: `Undo` · `Pause this one`.

### New templates

**`payday_headroom`** · Utility
```
Payday's in, {{1}}.

₹{{2}} landed today.
After your usual bills, you've got about ₹{{3}} of room this month.

Assumes your {{4}} fixed bills at last month's amounts, ₹{{5}} together.
```
- Footer: `Once a pay cycle. Reply STOP PAYDAY to end these.`
- Quick replies: `Split it into budgets` · `Stop these`.
- Variables: 1 name · 2 income landed · 3 headroom · 4 fixed-bill count (a word) · 5 fixed-bill total.
- Samples: Rohan · 92,000 · 56,900 · five · 35,100.

**`household_daily_digest`** · Utility. This is the design's version without the private-entries line; "private" is unresolved (ticket #72).
```
Evening, {{1}}.

Your household spent ₹{{2}} today, across {{3}} entries.

Who spent: {{4}}

One message a day, never one per spend.
```
- Footer: `Reply STOP DIGEST to end these.`
- Buttons: link `See the breakdown` → https://vyact.app/transactions · quick reply `Stop these`.
- Variables: 1 name · 2 household day total · 3 entry count · 4 per-member line composed on the server.
- Samples: Rohan · 5,410 · 4 · Priya ₹3,200 · you ₹2,210.

**`runway_shift_alert`** · Marketing
```
Heads-up, {{1}}.

At this month's pace, your savings would cover about {{2}} months, down from {{3}}.

Assumes your recent spending continues.

Nothing's wrong, and nothing needs doing today. Better to see it now than in three months.
```
- Footer: `Only on a real change. Reply STOP RUNWAY to end these.`
- Quick replies: `What moved?` · `Stop these`.
- Variables: 1 name · 2 new cover (1 decimal) · 3 previous cover.
- Samples: Rohan · 4.2 · 5.1.

**`month_close_summary`** · Utility. The Pulse change was dropped because Pulse history is not stored yet (#64).
```
Your {{1}} summary is ready, {{2}}.

Spent: ₹{{3}}
Compared with last month: {{4}}
Biggest slice: {{5}}

You logged something on {{6}} days this month.
```
- Footer: `On the 1st of each month. Reply STOP SUMMARY to end these.`
- Buttons: link `See the full month` → https://vyact.app/reports · quick reply `Stop these`.
- Variables: 1 month · 2 name · 3 total spent · 4 composed comparison ("₹2,900 less than August") · 5 top category with amount · 6 days logged ("24 of 30").
- Samples: September · Rohan · 64,180 · ₹2,900 less than August · Dining ₹12,400 · 24 of 30.

**`budget_setup_reminder`** · Marketing
```
Next month starts in two days, {{1}}. That's {{2}}.

Want me to set your budgets from what you actually spent this month? I'll suggest a limit for each of your {{3}} categories.

You adjust anything before it goes live. Nothing locks in without you.
```
- Footer: `Two days before each month. Reply STOP SETUP to end these.`
- Quick replies: `Show me the suggestions` · `Keep current limits`.
- Variables: 1 name · 2 upcoming month · 3 count of categories with history.
- Samples: Rohan · October · 7.

**`balance_stale_nudge`** · Marketing. It routes to the app because the reply-with-balances conversation is not built.
```
Quick one, {{1}}.

Some of your balances, {{2}} in all, haven't been updated in a month, so your net worth is drifting from what's actually there.

A couple of minutes in Vyact brings it back in line.
```
- Footer: `At most once a week. Reply STOP BALANCES to end these.`
- Buttons: link `Update balances` → https://vyact.app/accounts · quick reply `Not now`.
- Variables: 1 name · 2 stale-account count (a word).
- Samples: Rohan · four.

**`affordability_reply`** · Utility. Normally Ask Vyact on WhatsApp answers inside the 24-hour window as session text; this template is only for replies after the window closes. The floor is the app's real one: three months of essential spending, after card dues.
```
Here's how that would land, {{1}}.

It fits. ₹{{2}} would still leave about ₹{{3}} above your safety floor.

Assumes your card dues are paid first, and a floor of ₹{{4}} (three months of essential spending).
```
- Quick reply: `Show the working`.
- Variables: 1 name · 2 purchase · 3 cushion above floor · 4 floor.
- Samples: Rohan · 40,000 · 4,300 · 50,000.

### The welcome (submitted 25 Sep)

**`whatsapp_welcome`** · Utility · header `12-welcome.jpg` · Meta id 2569691853498726. Sent once,
right after a number is linked (`whatsapp-verify-otp` → `whatsapp-notify`, dedupe key
`link:<household>:<phone>`). It is the one moment Vyact speaks first. A greeting the person sends
needs no template: inside the 24-hour window the receptionist list answers it as session text.
```
You're linked, {{1}}. This number now logs to {{2}} in Vyact.

Send me a spend in one line, like 450 lunch hdfc, or tap Menu to see everything I can do.
```
- Footer: `Sent once, when a number is linked.`
- Quick replies: `Menu` (opens the receptionist list) · `Log a spend` · `What can I send?` (answer as
  the matching menu rows). Handled by the webhook today (`welcomeButtonAction`), not deferred to W2.
- Variables: 1 first name (falls back to "friend") · 2 household name (falls back to "your household").
- Samples: Rohan · Mehta Household.
- Image: warm coral card, "Your money, one message away", with a one-line message and a ticked reply.

### Variant B templates (W5, submitted 26 Sep)

Four design variants whose sentence differs from variant A, so each is its own template with its own
header image (the shared image would have contradicted the body). The images are generated by
`variant-cards.ps1` (session scratchpad) in each family's tint.

**`bill_overdue_reminder`** · Utility · header `13-bill-overdue.jpg`
```
Overdue: your {{1}} bill was due {{2}}.
Amount: {{3}}

If you've already paid it, tap Already paid or reply "paid {{4}}" and I'll close it off. If not, it's worth paying before a late fee lands.
```
- Quick reply: `Already paid` (approves that occurrence through `whatsapp_approve_recurring`).
- Variables: 1 biller · 2 due, relative ("three days ago") · 3 amount WITH symbol · 4 reply word.
- Samples: BESCOM · 3 days ago · ₹3,200 · BESCOM.

**`payday_headroom_variable`** · Utility · header `14-payday-variable.jpg`
```
Money's in, {{1}}.

₹{{2}} landed. That's {{3}} than your usual month.
After your bills, you've got about ₹{{4}} of room.

Assumes your {{5}} fixed bills at last month's amounts, ₹{{6}} together.
```
- Footer: `Once a pay cycle. Reply STOP PAYDAY to end these.`
- Quick replies: `Plan this month` (asked of Pip) · `Stop these`.
- Samples: Rohan · 92,000 · ₹8,400 more · 56,900 · five · 35,100.

**`reengagement_nudge_quiet`** · Marketing · header `15-reengage-quiet.jpg`
```
Hi {{1}}, it's been {{2}} days since anything was logged, so this month's picture is going stale.

A week of logging is usually enough for a forecast worth trusting. Reply LOG and we'll do today's in one line.
```
- Footer: `You opted into tips. Reply STOP TIPS to end them.`
- Buttons: quick reply `Log today` · link `Open Vyact` → https://vyact.app.
- Samples: Rohan · 11.

**`runway_recovered_alert`** · Marketing · header `16-runway-recovered.jpg`
```
Good news, {{1}}.

Your savings would now cover about {{2}} months, up from {{3}}. {{4}} is what moved it.

Assumes your recent spending continues.
```
- Footer: `Only on a real change. Reply STOP RUNWAY to end these.`
- Quick replies: `See the detail` (asked of Pip) · `Stop these`.
- Samples: Rohan · 5.1 · 4.2 · A quieter month on dining.

## Not submitted yet

- **The other design variants B** (first month, one budget off, "you paid them", barely logged, one
  stale account, "it'd be tight", quiet digest day). Each is its own template under Meta's rules.
- **Quick-reply buttons need handlers:** "Stop these" / "STOP …" (W2 mutes) and "What moved?" /
  "Show the working" / "Split it into budgets" / "Show me the suggestions" (W3 turns). Until those
  exist, a tap is recorded but not acted on.
