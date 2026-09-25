# WhatsApp templates — what is submitted to Meta

> **Source of truth for the W1 template manifest** (`supabase/functions/_shared/whatsapp-templates.ts`).
> Every body, variable order, button and category below is exactly what was submitted, so a send must
> match it field for field or Meta rejects the message.
>
> WABA **Vyact App `1887272231954080`** (+91 88978 82803). All templates are language **English (US)**
> (`en_US`). Submitted through WhatsApp Manager on 24–25 Sep 2026.

## ⚠️ Before any image template can be sent

Once a template has an IMAGE header, Meta requires the image (a link or an uploaded media id) on
**every** send. `sendTemplate` in `_shared/whatsapp.ts` sends body parameters only. **W1.6 must add the
header component before any template below is added to `WHATSAPP_APPROVED_TEMPLATES`**, or every send
fails. The 11 header images are in
`WhatsApp & Ask Vyact Message Templates/Vyact/vyact-templates/media/` (1200×628 PNG).

## Status snapshot (25 Sep 2026)

| Template | Category | Image | Change | Status |
|---|---|---|---|---|
| `bill_due_reminder` | Utility | 01-bill-reminder | Image added; body unchanged | In review |
| `split_settled` | Utility | 08-split-settled | Image added; body unchanged | In review |
| `weekly_summary` | Utility → **flagged as Marketing** | 09-weekly-summary | Image added; body unchanged | In review · ⚠ Meta: "did not meet our utility guidelines". Review can be requested until **15 Oct 2026** |
| `reengagement_nudge` | Marketing | 04-reengagement | Image added; body unchanged. ⚠ The image says "Some spending has no name" while the body is about inactivity | In review |
| `payday_headroom` | Utility | 02-payday | New | In review |
| `household_daily_digest` | Utility | 03-household-digest | New | In review |
| `runway_shift_alert` | **Marketing** (Meta's pre-check: "Utility will be rejected") | 05-runway-shift | New | In review |
| `month_close_summary` | Utility | 06-month-close | New | In review |
| `budget_setup_reminder` | **Marketing** (as planned) | 07-budget-setup | New | In review |
| `balance_stale_nudge` | **Marketing** (as planned) | 10-balance-recheck | New | In review |
| `affordability_reply` | Utility | 11-forecast-response | New | In review |

**Unchanged and text-only, all Active:** `partner_split_prompt`, `split_shared_with_you`,
`budget_threshold_alert`, `large_transaction_alert` and `recurring_auto_logged`. No image was designed
for any of these.

The runbook's 15 Aug "In review" for the original nine was stale: on 24 Sep all nine showed
**Active – Quality pending** (approved) before these edits.

**Marketing** templates are sent only to people who have opted in to marketing messages
(`whatsapp-notify` refuses them until the W2 consent record exists).

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
- **`reengagement_nudge`**. `It's been a while since you tracked an expense. A quick tap keeps your money picture accurate.`
  - Button: link "Open Vyact", which points at an old `vyact-twentyx…` Vercel URL, not vyact.app. **Fix this in a later edit.**

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

## Not submitted yet

- **Every design variant B** (overdue bill, variable income, quiet day, recovered runway, first month,
  one budget off, "you paid them", barely logged, one stale account, "it'd be tight"). Each is its own
  template under Meta's rules.
- **The four B variants whose shared image contradicts the body** (T01-B, T02-B, T04-B, T05-B) need new
  images from design first.
- **Quick-reply buttons need handlers:** "Stop these" / "STOP …" (W2 mutes) and "What moved?" /
  "Show the working" / "Split it into budgets" / "Show me the suggestions" (W3 turns). Until those
  exist, a tap is recorded but not acted on.
