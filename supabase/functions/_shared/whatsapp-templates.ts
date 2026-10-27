// Vyact WhatsApp — the template manifest (W1, v10.41.0).
//
// ONE source for every template Vyact sends: name, Meta category, language, header
// image, body, footer, buttons, and the ordered values each send must supply. It is
// what was actually submitted to Meta (docs/WHATSAPP_TEMPLATES.md records the
// submission), so a send built from here matches the approved template field for
// field. A mismatch is not a formatting nit: Meta rejects the message.
//
// Pure data + pure checks, no Deno or Node APIs, so the edge functions, the unit
// tests and the owner-run scripts (scripts/whatsapp/*.mjs) all read this one file.
//
// ⚠️ Changing a body here does NOT change it at Meta. Edit the template in WhatsApp
// Manager (or with templates-submit.mjs), wait for approval, THEN change it here —
// and `templates-status.mjs` reports any drift between the two.

export type TemplateCategory = 'utility' | 'marketing';

export interface TemplateParam {
  /** What the sender fills in — for code and review, never sent to Meta. */
  name: string;
  /** The sample Meta reviewed. Also used by the Meta-rules test. */
  sample: string;
  note?: string;
}

export interface TemplateButton {
  type: 'url' | 'quick_reply';
  text: string;
  /** Static URL buttons only. Undefined where the approved URL was not recorded. */
  url?: string;
}

export interface TemplateDef {
  name: string;
  /**
   * The category Vyact TREATS the template as. Where Meta has flagged a utility
   * template as marketing, this says marketing, so it is only sent with consent
   * while the flag stands.
   */
  category: TemplateCategory;
  language: 'en_US';
  /** File under react/public/whatsapp/, served at `${APP_URL}/whatsapp/<file>`. */
  headerImage?: string;
  body: string;
  params: readonly TemplateParam[];
  footer?: string;
  buttons?: readonly TemplateButton[];
  /** A redesigned version: the original template it replaces (v10.138.0). Payloads and dedupe use this name. */
  family?: string;
  /** Meta status when last checked (templates-status.mjs refreshes this view). */
  status: 'active' | 'in_review';
  note?: string;
}

const t = (def: TemplateDef): TemplateDef => def;

export const TEMPLATES: Record<string, TemplateDef> = {
  // ── Existing templates, image header added 24 Sep ────────────────────────────
  bill_due_reminder: t({
    name: 'bill_due_reminder', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '01-bill-reminder.jpg',
    body: "🧾 Bill reminder\n\n📌 {{1}}\n💰 *{{2}}*\n📅 Due on {{3}}\n\nReply \"paid {{4}}\" once it's paid and I'll log it.",
    params: [
      { name: 'biller', sample: 'Rent' },
      { name: 'amount', sample: '₹25,000', note: 'formatted WITH the currency symbol' },
      { name: 'dueDate', sample: '5 Aug' },
      { name: 'replyWord', sample: 'Rent', note: 'the word the user replies with, usually the biller' },
    ],
  }),
  split_settled: t({
    name: 'split_settled', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '08-split-settled.jpg',
    body: "Settled ✅\n\n🤝 {{1}} paid their *{{2}}* share of \"{{3}}\"\n⚖️ You're all square now.",
    params: [
      { name: 'person', sample: 'Priya' },
      { name: 'amount', sample: '₹600', note: 'formatted WITH the currency symbol' },
      { name: 'what', sample: 'Dinner at Olive' },
    ],
  }),
  weekly_summary: t({
    // Meta flagged it as marketing on 24 Sep ("did not meet our utility
    // guidelines"); treated as marketing until that is resolved. Meta now files it
    // as Utility. 26 Sep: a sample was sent to the owner and delivered; then the
    // See details link was edited from the old vyact-twentyx site to /reports (in review).
    name: 'weekly_summary', category: 'utility', language: 'en_US', status: 'active',
    headerImage: '09-weekly-summary.jpg',
    body: 'Your week on Vyact: {{1}} spent across {{2}} transactions. Top category: {{3}} this week.',
    params: [
      { name: 'spent', sample: '₹12,400', note: 'formatted WITH the currency symbol' },
      { name: 'transactionCount', sample: '23' },
      { name: 'topCategory', sample: 'Food & Dining' },
    ],
    buttons: [{ type: 'url', text: 'See details', url: 'https://vyact.app/reports' }],
  }),
  reengagement_nudge: t({
    name: 'reengagement_nudge', category: 'marketing', language: 'en_US', status: 'in_review',
    // v10.47.0 — edited in place 26 Sep (in review): the board's variant A, unnamed
    // spending. "Name them here" starts the naming conversation in the chat; the
    // Open Vyact link now points at vyact.app. Meta's button order: URL first.
    headerImage: '04-reengagement.jpg',
    body: "Hi {{1}} 👋\n\n🔍 *{{2}}* of this month's spending has no category yet\n🧾 That's {{3}} entries\n\nUntil they're named, your category totals are guessing. Tap *Name them here* and we'll sort them in this chat, one line each.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'unnamedTotal', sample: '₹6,850', note: 'formatted WITH the currency symbol' },
      { name: 'unnamedCount', sample: 'four', note: 'spelled out' },
    ],
    footer: 'You opted into tips. Reply STOP TIPS to end them.',
    buttons: [
      { type: 'url', text: 'Open Vyact', url: 'https://vyact.app' },
      { type: 'quick_reply', text: 'Name them here' },
    ],
  }),

  // ── Existing templates, enriched 25 Sep ───────────────────────────────────────
  large_transaction_alert: t({
    name: 'large_transaction_alert', category: 'utility', language: 'en_US', status: 'in_review',
    body: "Heads-up 🔔\n\n💳 *{{1}}* just went out on your {{2}}\n\nIf that was you, there's nothing to do. If it wasn't, tap *Flag it* and I'll mark it for review.",
    params: [
      { name: 'amount', sample: '₹18,000', note: 'formatted WITH the currency symbol' },
      { name: 'account', sample: 'HDFC card' },
    ],
    buttons: [
      { type: 'url', text: 'Review', url: 'https://vyact.app/transactions' },
      { type: 'quick_reply', text: 'Flag it' },
      { type: 'quick_reply', text: 'That was me' },
    ],
  }),
  budget_threshold_alert: t({
    name: 'budget_threshold_alert', category: 'utility', language: 'en_US', status: 'in_review',
    body: "Budget heads-up: {{1}} 📌\n\n📊 {{2}}% of the budget used\n📅 {{3}} days to go\n💰 *{{4}}* still in the pot",
    params: [
      { name: 'category', sample: 'Dining' },
      { name: 'percentUsed', sample: '78' },
      { name: 'daysLeft', sample: '18' },
      { name: 'remaining', sample: '₹1,540', note: 'formatted WITH the currency symbol' },
    ],
    buttons: [
      { type: 'url', text: 'View budget', url: 'https://vyact.app/budgets' },
      { type: 'quick_reply', text: "What's driving it?" },
      { type: 'quick_reply', text: 'Stop budget alerts' },
    ],
  }),
  partner_split_prompt: t({
    name: 'partner_split_prompt', category: 'utility', language: 'en_US', status: 'in_review',
    body: "New shared expense 🧾\n\n👤 {{1}} logged *{{2}}*\n📝 For \"{{3}}\"\n\nHow should it split? Nothing changes until you pick.",
    params: [
      { name: 'person', sample: 'Priya' },
      { name: 'amount', sample: '₹1,200', note: 'formatted WITH the currency symbol' },
      { name: 'what', sample: 'Dinner at Olive' },
    ],
    buttons: [
      { type: 'quick_reply', text: 'Split 50/50' },
      { type: 'quick_reply', text: "It's all mine" },
      { type: 'quick_reply', text: 'Not shared' },
    ],
  }),
  split_shared_with_you: t({
    name: 'split_shared_with_you', category: 'utility', language: 'en_US', status: 'in_review',
    body: "New split from {{1}} on Vyact 🤝\n\n🧾 {{2}} for \"{{3}}\"\n💰 Your share: *{{4}}*\n\nSettle it in the app whenever you're ready.",
    params: [
      { name: 'person', sample: 'Priya' },
      { name: 'total', sample: '₹2,400', note: 'formatted WITH the currency symbol' },
      { name: 'what', sample: 'Dinner at Olive' },
      { name: 'yourShare', sample: '₹800', note: 'formatted WITH the currency symbol' },
    ],
    buttons: [{ type: 'url', text: 'See your share', url: 'https://vyact.app/splits' }],
  }),
  recurring_auto_logged: t({
    // 26 Sep: edit submitted adding header 17-recurring-logged.jpg (in review). Add
    // headerImage here only once Meta approves it: until then a send with an image
    // header would not match the live template.
    name: 'recurring_auto_logged', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '17-recurring-logged.jpg',
    body: "Logged as scheduled 🔁\n\n📌 {{1}}\n💰 *{{2}}*\n📅 {{3}}\n\nIf it didn't go out this time, tap *Undo* within 15 minutes.",
    params: [
      { name: 'schedule', sample: 'Netflix' },
      { name: 'amount', sample: '₹649', note: 'formatted WITH the currency symbol' },
      { name: 'date', sample: '1 Aug' },
    ],
    buttons: [
      { type: 'quick_reply', text: 'Undo' },
      { type: 'quick_reply', text: 'Pause this one' },
    ],
  }),

  // ── New image templates, submitted 24–25 Sep ─────────────────────────────────
  payday_headroom: t({
    name: 'payday_headroom', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '02-payday.jpg',
    body: "Payday's in, {{1}} 💼\n\n💰 {{2}} landed today\n🧮 About *{{3}}* of room this month, after your usual bills\n\n📌 Assumes your {{4}} fixed bills at last month's amounts, {{5}} together.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'income', sample: '₹92,000', note: 'formatted WITH the currency symbol' },
      { name: 'headroom', sample: '₹56,900', note: 'formatted WITH the currency symbol' },
      { name: 'fixedBillCount', sample: 'five', note: 'spelled out' },
      { name: 'fixedBillTotal', sample: '₹35,100', note: 'formatted WITH the currency symbol' },
    ],
    footer: 'Once a pay cycle. Reply STOP PAYDAY to end these.',
    buttons: [
      { type: 'quick_reply', text: 'Split it into budgets' },
      { type: 'quick_reply', text: 'Stop these' },
    ],
  }),
  household_daily_digest: t({
    name: 'household_daily_digest', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '03-household-digest.jpg',
    body: "Evening, {{1}} 🌙\n\n🏠 Your household spent *{{2}}* today\n🧾 {{3}} entries\n👥 Who spent: {{4}}\n\nOne message a day, never one per spend.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'dayTotal', sample: '₹5,410', note: 'formatted WITH the currency symbol' },
      { name: 'entryCount', sample: '4' },
      { name: 'perMember', sample: 'Priya ₹3,200 · you ₹2,210', note: 'composed on the server, max 4 members' },
    ],
    footer: 'Reply STOP DIGEST to end these.',
    buttons: [
      { type: 'url', text: 'See the breakdown', url: 'https://vyact.app/transactions' },
      { type: 'quick_reply', text: 'Stop these' },
    ],
  }),
  runway_shift_alert: t({
    name: 'runway_shift_alert', category: 'marketing', language: 'en_US', status: 'in_review',
    headerImage: '05-runway-shift.jpg',
    body: "Heads-up, {{1}} 📌\n\n🧭 At this month's pace, your savings would cover about *{{2}} months*\n📉 Down from {{3}}\nℹ️ Assumes your recent spending continues\n\nNothing's wrong, and nothing needs doing today. Better to see it now than in three months.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'coverNow', sample: '4.2', note: 'one decimal' },
      { name: 'coverBefore', sample: '5.1' },
    ],
    footer: 'Only on a real change. Reply STOP RUNWAY to end these.',
    buttons: [
      { type: 'quick_reply', text: 'What moved?' },
      { type: 'quick_reply', text: 'Stop these' },
    ],
    note: "Meta's pre-check said Utility would be rejected; submitted as Marketing.",
  }),
  month_close_summary: t({
    name: 'month_close_summary', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '06-month-close.jpg',
    body: "Your {{1}} summary is ready, {{2}} 📊\n\n💸 Spent: *{{3}}*\n⚖️ Compared with last month: {{4}}\n🏷️ Biggest slice: {{5}}\n✍️ Something logged on {{6}} days",
    params: [
      { name: 'month', sample: 'September' },
      { name: 'firstName', sample: 'Rohan' },
      { name: 'spent', sample: '₹64,180', note: 'formatted WITH the currency symbol' },
      { name: 'comparison', sample: '₹2,900 less than August', note: 'composed, direction in words' },
      { name: 'biggestSlice', sample: 'Dining ₹12,400' },
      { name: 'daysLogged', sample: '24 of 30' },
    ],
    footer: 'On the 1st of each month. Reply STOP SUMMARY to end these.',
    buttons: [
      { type: 'url', text: 'See the full month', url: 'https://vyact.app/reports' },
      { type: 'quick_reply', text: 'Stop these' },
    ],
  }),
  budget_setup_reminder: t({
    name: 'budget_setup_reminder', category: 'marketing', language: 'en_US', status: 'in_review',
    headerImage: '07-budget-setup.jpg',
    body: "Next month starts in two days, {{1}} 🗓️\n\n📅 That's {{2}}\n🎯 I can suggest a limit for each of your {{3}} categories, from what you actually spent this month\n\nYou adjust anything before it goes live. Nothing locks in without you.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'month', sample: 'October' },
      { name: 'categoryCount', sample: '7' },
    ],
    footer: 'Two days before each month. Reply STOP SETUP to end these.',
    buttons: [
      { type: 'quick_reply', text: 'Show me the suggestions' },
      { type: 'quick_reply', text: 'Keep current limits' },
    ],
  }),
  balance_stale_nudge: t({
    name: 'balance_stale_nudge', category: 'marketing', language: 'en_US', status: 'in_review',
    headerImage: '10-balance-recheck.jpg',
    body: "Quick one, {{1}} 👋\n\n🏦 Balances not updated in a month: {{2}}\nℹ️ Your net worth is drifting from what's actually there\n\nA couple of minutes in Vyact brings it back in line.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'staleCount', sample: 'four', note: 'spelled out' },
    ],
    footer: 'At most once a week. Reply STOP BALANCES to end these.',
    buttons: [
      { type: 'url', text: 'Update balances', url: 'https://vyact.app/accounts' },
      { type: 'quick_reply', text: 'Not now' },
    ],
  }),
  affordability_reply: t({
    name: 'affordability_reply', category: 'utility', language: 'en_US', status: 'active',
    headerImage: '11-forecast-response.jpg',
    body: "Here's how that would land, {{1}}.\n\nIt fits. ₹{{2}} would still leave about ₹{{3}} above your safety floor.\n\nAssumes your card dues are paid first, and a floor of ₹{{4}} (three months of essential spending).",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'purchase', sample: '40,000' },
      { name: 'cushion', sample: '4,300' },
      { name: 'floor', sample: '50,000' },
    ],
    buttons: [{ type: 'quick_reply', text: 'Show the working' }],
    note: 'Only for a reply after the 24-hour window; inside it Ask Vyact answers as session text.',
  }),

  // ── The welcome, submitted 25 Sep ─────────────────────────────────────────────
  whatsapp_welcome: t({
    // Sent once, right after a number is linked: the only moment Vyact speaks
    // first without the person having messaged. A greeting inside the 24-hour
    // window needs no template; the receptionist list answers it as session text.
    name: 'whatsapp_welcome', category: 'utility', language: 'en_US', status: 'active',
    headerImage: '12-welcome.jpg',
    body: "You're linked, {{1}}. This number now logs to {{2}} in Vyact.\n\nSend me a spend in one line, like 450 lunch hdfc, or tap Menu to see everything I can do.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'householdName', sample: 'Mehta Household' },
    ],
    footer: 'Sent once, when a number is linked.',
    buttons: [
      { type: 'quick_reply', text: 'Menu' },
      { type: 'quick_reply', text: 'Log a spend' },
      { type: 'quick_reply', text: 'What can I send?' },
    ],
    note: 'Meta template id 2569691853498726. Its quick replies are answered by the webhook (welcomeButtonReply).',
  }),

  // ── Design variant B, submitted 26 Sep (W5) — each a separate template because the
  //    sentence differs, with its own header image. ─────────────────────────────
  bill_overdue_reminder: t({
    // Sent once, three days after an APPROVAL bill fell due and is still waiting.
    // No greeting and no emoji: an overdue bill is not neutral news. "Already paid"
    // is the likeliest truth by then, so it leads.
    name: 'bill_overdue_reminder', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '13-bill-overdue.jpg',
    body: "Overdue bill ⚠️\n\n🧾 {{1}}, due {{2}}\n💰 Amount: *{{3}}*\n\nIf you've already paid it, tap *Already paid* or reply \"paid {{4}}\" and I'll close it off. If not, it's worth paying before a late fee lands.",
    params: [
      { name: 'biller', sample: 'BESCOM' },
      { name: 'dueWhen', sample: '3 days ago', note: 'relative within a week, else "on 15 Sep"' },
      { name: 'amount', sample: '₹3,200', note: 'formatted WITH the currency symbol' },
      { name: 'replyWord', sample: 'BESCOM' },
    ],
    buttons: [{ type: 'quick_reply', text: 'Already paid' }],
  }),
  payday_headroom_variable: t({
    // For pay that is not the same twice: the fact that matters is the difference from
    // a usual month. No 🎉 — a light month should not be cheered. Needs #68 to send.
    name: 'payday_headroom_variable', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '14-payday-variable.jpg',
    body: "Money's in, {{1}} 💼\n\n💰 {{2}} landed, {{3}} than your usual month\n🧮 About *{{4}}* of room after your bills\n\n📌 Assumes your {{5}} fixed bills at last month's amounts, {{6}} together.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'income', sample: '₹92,000', note: 'formatted WITH the currency symbol' },
      { name: 'versusUsual', sample: '₹8,400 more', note: 'composed: amount and direction' },
      { name: 'headroom', sample: '₹56,900', note: 'formatted WITH the currency symbol' },
      { name: 'fixedBillCount', sample: 'five', note: 'spelled out' },
      { name: 'fixedBillTotal', sample: '₹35,100', note: 'formatted WITH the currency symbol' },
    ],
    footer: 'Once a pay cycle. Reply STOP PAYDAY to end these.',
    buttons: [
      { type: 'quick_reply', text: 'Plan this month' },
      { type: 'quick_reply', text: 'Stop these' },
    ],
  }),
  reengagement_nudge_quiet: t({
    // Nothing pending, so no invented urgency: it names the gap and one small ask.
    // "Reply LOG" is answered by the webhook (isLogTrigger / the Log today button).
    name: 'reengagement_nudge_quiet', category: 'marketing', language: 'en_US', status: 'in_review',
    headerImage: '15-reengage-quiet.jpg',
    body: "Hi {{1}} 👋\n\n📅 It's been {{2}} days since anything was logged\nℹ️ This month's picture is going stale\n\nA week of logging is usually enough for a forecast worth trusting. Reply *LOG* and we'll do today's in one line.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'daysQuiet', sample: '11' },
    ],
    footer: 'You opted into tips. Reply STOP TIPS to end them.',
    buttons: [
      { type: 'quick_reply', text: 'Log today' },
      { type: 'url', text: 'Open Vyact', url: 'https://vyact.app' },
    ],
  }),
  runway_recovered_alert: t({
    // Pip should be able to give good news about the same metric, or the runway note
    // becomes a message people learn to dread. Keeps the assumption line.
    name: 'runway_recovered_alert', category: 'marketing', language: 'en_US', status: 'in_review',
    headerImage: '16-runway-recovered.jpg',
    body: "Good news, {{1}} 🎉\n\n🧭 Your savings would now cover about *{{2}} months*\n📈 Up from {{3}}\n💡 What moved it: {{4}}\n\nAssumes your recent spending continues.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'coverNow', sample: '5.1', note: 'one decimal' },
      { name: 'coverBefore', sample: '4.2' },
      { name: 'mainDriver', sample: 'A quieter month on dining', note: 'the single biggest driver, named' },
    ],
    footer: 'Only on a real change. Reply STOP RUNWAY to end these.',
    buttons: [
      { type: 'quick_reply', text: 'See the detail' },
      { type: 'quick_reply', text: 'Stop these' },
    ],
  }),
  daily_nothing_logged: t({
    // v10.58.0 (owner, 3 Oct) — the evening digest on a day with nothing logged, so the
    // household hears from Vyact every evening. No currency symbol, so it suits any
    // household. Approved by Meta (Active, checked in WhatsApp Manager on 23 Oct 2026). Until
    // it is on WHATSAPP_APPROVED_TEMPLATES, the dispatcher sends the approved digest with a
    // "nothing logged yet" line instead (INR households only, its body says ₹).
    name: 'daily_nothing_logged', category: 'utility', language: 'en_US', status: 'in_review',
    headerImage: '18-nothing-logged.jpg',
    body: "Evening, {{1}} 🌙\n\n📝 Nothing has been logged in Vyact today\n💬 Spent anything? Reply here with it, like \"450 groceries\", and I'll add it for you\n\nOne message a day, never one per spend.",
    params: [{ name: 'firstName', sample: 'Rohan' }],
    footer: 'Reply STOP DIGEST to end these.',
    buttons: [
      { type: 'url', text: 'Open Vyact', url: 'https://vyact.app/transactions' },
      { type: 'quick_reply', text: 'Stop these' },
    ],
  }),
};

// ── v10.139.0 — the redesigned copy (owner, 27 Oct 2026) ────────────────────────────────────────────────
// One fact per line behind a neutral emoji marker, a blank line before the explanation, the one key amount in
// bold. The originals above were edited in place to it (28 Oct 2026; owner: "fine with them going into review"),
// and their amounts now carry the currency symbol themselves (`templateMoney`), so they suit any household.
//
// Meta does not change an approved template's category, and its pre-check files the redesign of three originals
// as Marketing. Those three are `_v2` templates in the Marketing category (owner, 28 Oct 2026). Each keeps its
// original's values in order, header, footer and buttons; consent, mutes, dedupe and button payloads use the
// original's name (`family`). `guardedSend` sends the `_v2` to someone who has opted in to marketing, once it
// is on WHATSAPP_APPROVED_TEMPLATES; everyone else still gets the original (`versionToSend`).

/** The `{{n}}` an original writes straight after "₹": an amount it takes WITHOUT the symbol. */
export function rupeeParams(def: TemplateDef): number[] {
  return [...def.body.matchAll(/₹\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
}

function marketingCopy(family: string, body: string): TemplateDef {
  const original = TEMPLATES[family];
  const rupee = rupeeParams(original);
  return {
    ...original,
    name: `${family}_v2`,
    family,
    category: 'marketing',
    status: 'in_review',
    body,
    params: original.params.map((p, i) => rupee.includes(i + 1)
      ? { ...p, sample: `₹${p.sample}`, note: "formatted WITH the household's currency symbol" }
      : p),
    note: `Redesigned copy of ${family}, submitted as Marketing (28 Oct 2026).`,
  };
}

const MARKETING_COPY: Record<string, string> = {
  weekly_summary:
    "Your week on Vyact 📊\n\n💸 *{{1}}* spent\n🧾 {{2}} entries\n🏷️ Top category: {{3}}\n\nTap below for the details.",
  affordability_reply:
    "Here's how that would land, {{1}} 🧮\n\n✅ *It fits.* {{2}} would still leave about *{{3}}* above your safety floor\n📌 Assumes your card dues are paid first, and a floor of {{4}} (three months of essential spending)\n\nTap below to see the working.",
  whatsapp_welcome:
    "You're linked, {{1}} 🎉\n\n🏠 This number now logs to {{2}} in Vyact\n✍️ Send me a spend in one line, like 450 lunch hdfc\n📋 Or tap *Menu* to see everything I can do",
};

/** The Marketing copies, keyed by their ORIGINAL's name. */
export const TEMPLATES_V2: Record<string, TemplateDef> = Object.fromEntries(
  Object.entries(MARKETING_COPY).map(([family, body]) => [family, marketingCopy(family, body)]),
);

/** Every template Meta holds for Vyact, by its own name: what the owner scripts check and submit. */
export const ALL_TEMPLATES: Record<string, TemplateDef> = {
  ...TEMPLATES,
  ...Object.fromEntries(Object.values(TEMPLATES_V2).map((d) => [d.name, d])),
};

export type VersionChoice = { def: TemplateDef; values: string[] } | { skip: 'currency_needs_v2' };

/**
 * Which version of a template goes out, with its values. The values arrive as the rules write them: every
 * amount with its symbol, in `currency`. The `_v2` goes once it is approved and `allows` it (the recipient's
 * consent to marketing). Otherwise the original goes; where its text still says "₹{{n}}", that value goes without
 * its symbol, and only to an INR household.
 */
export function versionToSend(
  def: TemplateDef, values: readonly string[], currency: string | undefined, isApproved: (name: string) => boolean,
  allows: (v2: TemplateDef) => boolean = () => true,
): VersionChoice {
  const next = TEMPLATES_V2[def.name];
  if (next && isApproved(next.name) && allows(next)) return { def: next, values: [...values] };
  const rupee = rupeeParams(def);
  if (!rupee.length) return { def, values: [...values] };
  if (String(currency ?? '').trim() !== 'INR') return { skip: 'currency_needs_v2' };
  return { def, values: values.map((v, i) => rupee.includes(i + 1) ? v.replace(/^₹\s*/, '') : v) };
}

/** Legacy `whatsapp-notify` event names → template. New templates use their own name. */
export const EVENT_ALIASES: Record<string, string> = {
  partner_split: 'partner_split_prompt',
  split_shared: 'split_shared_with_you',
  split_settled: 'split_settled',
  budget_threshold: 'budget_threshold_alert',
  bill_due: 'bill_due_reminder',
  large_transaction: 'large_transaction_alert',
  recurring_logged: 'recurring_auto_logged',
  weekly_summary: 'weekly_summary',
  reengagement: 'reengagement_nudge',
};

/** The template an event (legacy alias or template name) sends, or null. */
export function templateForEvent(event: string): TemplateDef | null {
  return TEMPLATES[EVENT_ALIASES[event] ?? event] ?? null;
}

// ── Meta's template rules, as checks ─────────────────────────────────────────
// A template that breaks one of these is rejected at submission, or — for a
// wrong value count — every send fails. The unit test runs lintTemplate over the
// whole manifest, so a bad template cannot land here quietly.

const LIMITS = { footer: 60, buttonText: 25, body: 1024, header: 60, payload: 128 } as const;

/** `{{n}}` numbers in the order they first appear in `text`. */
export function variablesIn(text: string): number[] {
  const seen: number[] = [];
  for (const m of text.matchAll(/\{\{(\d+)\}\}/g)) {
    const n = Number(m[1]);
    if (!seen.includes(n)) seen.push(n);
  }
  return seen;
}

/** Every rule this template breaks, in words. Empty means it passes. */
export function lintTemplate(def: TemplateDef): string[] {
  const problems: string[] = [];
  const vars = variablesIn(def.body);
  if (!/^[a-z0-9_]+$/.test(def.name)) problems.push('name must be lowercase letters, digits and underscores');
  vars.forEach((n, i) => {
    if (n !== i + 1) problems.push(`variables must run {{1}}…{{n}} in reading order; found {{${n}}} at position ${i + 1}`);
  });
  if (vars.length !== def.params.length) {
    problems.push(`body has ${vars.length} variables but ${def.params.length} params are declared`);
  }
  if (/^\s*\{\{\d+\}\}/.test(def.body)) problems.push('body must not start with a variable');
  if (/\{\{\d+\}\}\s*$/.test(def.body)) problems.push('body must not end with a variable');
  if (/\}\}\s*\{\{/.test(def.body)) problems.push('two variables may not sit side by side');
  if (def.body.length > LIMITS.body) problems.push(`body is over ${LIMITS.body} characters`);
  const words = def.body.replace(/\{\{\d+\}\}/g, ' ').split(/\s+/).filter(Boolean).length;
  // Meta rejects a body that is "mostly variables". Its threshold is not published;
  // two fixed words per variable is what every approved Vyact template clears.
  if (vars.length > 0 && words < vars.length * 2) problems.push('too many variables for the length of the body');
  if (def.footer && def.footer.length > LIMITS.footer) problems.push(`footer is over ${LIMITS.footer} characters`);
  if (def.footer && /\{\{/.test(def.footer)) problems.push('footer may not contain variables');
  for (const b of def.buttons ?? []) {
    if (b.text.length > LIMITS.buttonText) problems.push(`button "${b.text}" is over ${LIMITS.buttonText} characters`);
    if (b.url && !b.url.startsWith('https://')) problems.push(`button "${b.text}" must link to https`);
  }
  for (const p of def.params) {
    if (!p.sample.trim()) problems.push(`param ${p.name} has no sample`);
    if (/[\n\t]/.test(p.sample) || / {5,}/.test(p.sample)) problems.push(`sample for ${p.name} contains a newline, tab or run of spaces`);
  }
  if (def.headerImage && !/\.(jpe?g|png)$/i.test(def.headerImage)) problems.push('header image must be a JPEG or PNG');
  return problems;
}

/** Longest payload Meta accepts on a quick-reply button. */
export const MAX_PAYLOAD = LIMITS.payload;

// ── Submission (owner-run scripts only) ──────────────────────────────────────

/**
 * The `components` Meta's template-management API takes to create or edit this
 * template. The header image is referenced by an upload handle (from Meta's
 * resumable upload), which the script obtains; everything else is here.
 * Throws where the manifest cannot produce a valid submission (a URL button with
 * no recorded URL) — better than submitting something that differs from intent.
 */
export function metaSubmissionComponents(def: TemplateDef, headerHandle?: string): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = [];
  if (def.headerImage) {
    if (!headerHandle) throw new Error(`${def.name}: an image header needs an upload handle`);
    components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerHandle] } });
  }
  components.push(def.params.length
    ? { type: 'BODY', text: def.body, example: { body_text: [def.params.map((p) => p.sample)] } }
    : { type: 'BODY', text: def.body });
  if (def.footer) components.push({ type: 'FOOTER', text: def.footer });
  if (def.buttons?.length) {
    components.push({
      type: 'BUTTONS',
      buttons: def.buttons.map((b) => {
        if (b.type === 'quick_reply') return { type: 'QUICK_REPLY', text: b.text };
        if (!b.url) throw new Error(`${def.name}: button "${b.text}" has no recorded URL`);
        return { type: 'URL', text: b.text, url: b.url };
      }),
    });
  }
  return components;
}
