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
  /** Meta status when last checked (templates-status.mjs refreshes this view). */
  status: 'active' | 'in_review';
  note?: string;
}

const t = (def: TemplateDef): TemplateDef => def;

export const TEMPLATES: Record<string, TemplateDef> = {
  // ── Existing templates, image header added 24 Sep ────────────────────────────
  bill_due_reminder: t({
    name: 'bill_due_reminder', category: 'utility', language: 'en_US', status: 'active',
    headerImage: '01-bill-reminder.jpg',
    body: 'Reminder: your {{1}} of {{2}} is due on {{3}}. Reply "paid {{4}}" to log it.',
    params: [
      { name: 'biller', sample: 'Rent' },
      { name: 'amount', sample: '₹25,000', note: 'formatted WITH the currency symbol' },
      { name: 'dueDate', sample: '5 Aug' },
      { name: 'replyWord', sample: 'Rent', note: 'the word the user replies with, usually the biller' },
    ],
  }),
  split_settled: t({
    name: 'split_settled', category: 'utility', language: 'en_US', status: 'active',
    headerImage: '08-split-settled.jpg',
    body: 'Update: {{1}} settled their {{2}} share of "{{3}}". You\'re all square.',
    params: [
      { name: 'person', sample: 'Priya' },
      { name: 'amount', sample: '₹600', note: 'formatted WITH the currency symbol' },
      { name: 'what', sample: 'Dinner at Olive' },
    ],
  }),
  weekly_summary: t({
    // Meta flagged it as marketing on 24 Sep ("did not meet our utility
    // guidelines"); treated as marketing until that is resolved.
    name: 'weekly_summary', category: 'marketing', language: 'en_US', status: 'active',
    headerImage: '09-weekly-summary.jpg',
    body: 'Your week on Vyact: {{1}} spent across {{2}} transactions. Top category: {{3}} this week.',
    params: [
      { name: 'spent', sample: '₹12,400', note: 'formatted WITH the currency symbol' },
      { name: 'transactionCount', sample: '23' },
      { name: 'topCategory', sample: 'Food & Dining' },
    ],
    buttons: [{ type: 'url', text: 'See details' }],
    note: 'Flagged as marketing by Meta 24 Sep; a review can be requested until 15 Oct 2026.',
  }),
  reengagement_nudge: t({
    name: 'reengagement_nudge', category: 'marketing', language: 'en_US', status: 'in_review',
    // v10.47.0 — edited in place 26 Sep (in review): the board's variant A, unnamed
    // spending. "Name them here" starts the naming conversation in the chat; the
    // Open Vyact link now points at vyact.app. Meta's button order: URL first.
    headerImage: '04-reengagement.jpg',
    body: "Hi {{1}}, ₹{{2}} of this month's spending has no category yet. That's {{3}} entries, and until they're named your category totals are guessing.\n\nTap Name them here and we'll sort them in this chat, one line each.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'unnamedTotal', sample: '6,850', note: 'WITHOUT the currency symbol' },
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
    name: 'large_transaction_alert', category: 'utility', language: 'en_US', status: 'active',
    body: "Heads-up: ₹{{1}} just went out on your {{2}}.\n\nIf that was you, there's nothing to do. If it wasn't, tap Flag it and I'll mark it for review.",
    params: [
      { name: 'amount', sample: '18,000', note: 'WITHOUT the currency symbol' },
      { name: 'account', sample: 'HDFC card' },
    ],
    buttons: [
      { type: 'url', text: 'Review', url: 'https://vyact.app/transactions' },
      { type: 'quick_reply', text: 'Flag it' },
      { type: 'quick_reply', text: 'That was me' },
    ],
  }),
  budget_threshold_alert: t({
    name: 'budget_threshold_alert', category: 'utility', language: 'en_US', status: 'active',
    body: 'Heads-up: {{1}} is at {{2}}% of its budget, with {{3}} days to go.\n\n₹{{4}} is still in the pot.',
    params: [
      { name: 'category', sample: 'Dining' },
      { name: 'percentUsed', sample: '78' },
      { name: 'daysLeft', sample: '18' },
      { name: 'remaining', sample: '1,540', note: 'WITHOUT the currency symbol' },
    ],
    buttons: [
      { type: 'url', text: 'View budget', url: 'https://vyact.app/budgets' },
      { type: 'quick_reply', text: "What's driving it?" },
      { type: 'quick_reply', text: 'Stop budget alerts' },
    ],
  }),
  partner_split_prompt: t({
    name: 'partner_split_prompt', category: 'utility', language: 'en_US', status: 'active',
    body: 'New shared expense: {{1}} logged ₹{{2}} for "{{3}}".\n\nHow should it split? Nothing changes until you pick.',
    params: [
      { name: 'person', sample: 'Priya' },
      { name: 'amount', sample: '1,200', note: 'WITHOUT the currency symbol' },
      { name: 'what', sample: 'Dinner at Olive' },
    ],
    buttons: [
      { type: 'quick_reply', text: 'Split 50/50' },
      { type: 'quick_reply', text: "It's all mine" },
      { type: 'quick_reply', text: 'Not shared' },
    ],
  }),
  split_shared_with_you: t({
    name: 'split_shared_with_you', category: 'utility', language: 'en_US', status: 'active',
    body: 'Update: {{1}} shared a split with you on Vyact: ₹{{2}} for "{{3}}".\n\nYour share: ₹{{4}}. Settle it in the app whenever you\'re ready.',
    params: [
      { name: 'person', sample: 'Priya' },
      { name: 'total', sample: '2,400', note: 'WITHOUT the currency symbol' },
      { name: 'what', sample: 'Dinner at Olive' },
      { name: 'yourShare', sample: '800', note: 'WITHOUT the currency symbol' },
    ],
    buttons: [{ type: 'url', text: 'See your share', url: 'https://vyact.app/splits' }],
  }),
  recurring_auto_logged: t({
    // 26 Sep: edit submitted adding header 17-recurring-logged.jpg (in review). Add
    // headerImage here only once Meta approves it: until then a send with an image
    // header would not match the live template.
    name: 'recurring_auto_logged', category: 'utility', language: 'en_US', status: 'in_review',
    body: "Logged as scheduled: your {{1}} of ₹{{2}} on {{3}}.\n\nIf it didn't go out this time, tap Undo within 15 minutes.",
    params: [
      { name: 'schedule', sample: 'Netflix' },
      { name: 'amount', sample: '649', note: 'WITHOUT the currency symbol' },
      { name: 'date', sample: '1 Aug' },
    ],
    buttons: [
      { type: 'quick_reply', text: 'Undo' },
      { type: 'quick_reply', text: 'Pause this one' },
    ],
  }),

  // ── New image templates, submitted 24–25 Sep ─────────────────────────────────
  payday_headroom: t({
    name: 'payday_headroom', category: 'utility', language: 'en_US', status: 'active',
    headerImage: '02-payday.jpg',
    body: "Payday's in, {{1}}.\n\n₹{{2}} landed today.\nAfter your usual bills, you've got about ₹{{3}} of room this month.\n\nAssumes your {{4}} fixed bills at last month's amounts, ₹{{5}} together.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'income', sample: '92,000' },
      { name: 'headroom', sample: '56,900' },
      { name: 'fixedBillCount', sample: 'five', note: 'spelled out' },
      { name: 'fixedBillTotal', sample: '35,100' },
    ],
    footer: 'Once a pay cycle. Reply STOP PAYDAY to end these.',
    buttons: [
      { type: 'quick_reply', text: 'Split it into budgets' },
      { type: 'quick_reply', text: 'Stop these' },
    ],
  }),
  household_daily_digest: t({
    name: 'household_daily_digest', category: 'utility', language: 'en_US', status: 'active',
    headerImage: '03-household-digest.jpg',
    body: 'Evening, {{1}}.\n\nYour household spent ₹{{2}} today, across {{3}} entries.\n\nWho spent: {{4}}\n\nOne message a day, never one per spend.',
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'dayTotal', sample: '5,410' },
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
    name: 'runway_shift_alert', category: 'marketing', language: 'en_US', status: 'active',
    headerImage: '05-runway-shift.jpg',
    body: "Heads-up, {{1}}.\n\nAt this month's pace, your savings would cover about {{2}} months, down from {{3}}.\n\nAssumes your recent spending continues.\n\nNothing's wrong, and nothing needs doing today. Better to see it now than in three months.",
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
    name: 'month_close_summary', category: 'utility', language: 'en_US', status: 'active',
    headerImage: '06-month-close.jpg',
    body: 'Your {{1}} summary is ready, {{2}}.\n\nSpent: ₹{{3}}\nCompared with last month: {{4}}\nBiggest slice: {{5}}\n\nYou logged something on {{6}} days this month.',
    params: [
      { name: 'month', sample: 'September' },
      { name: 'firstName', sample: 'Rohan' },
      { name: 'spent', sample: '64,180' },
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
    name: 'budget_setup_reminder', category: 'marketing', language: 'en_US', status: 'active',
    headerImage: '07-budget-setup.jpg',
    body: "Next month starts in two days, {{1}}. That's {{2}}.\n\nWant me to set your budgets from what you actually spent this month? I'll suggest a limit for each of your {{3}} categories.\n\nYou adjust anything before it goes live. Nothing locks in without you.",
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
    name: 'balance_stale_nudge', category: 'marketing', language: 'en_US', status: 'active',
    headerImage: '10-balance-recheck.jpg',
    body: "Quick one, {{1}}.\n\nSome of your balances, {{2}} in all, haven't been updated in a month, so your net worth is drifting from what's actually there.\n\nA couple of minutes in Vyact brings it back in line.",
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
    body: 'Overdue: your {{1}} bill was due {{2}}.\nAmount: {{3}}\n\nIf you\'ve already paid it, tap Already paid or reply "paid {{4}}" and I\'ll close it off. If not, it\'s worth paying before a late fee lands.',
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
    body: "Money's in, {{1}}.\n\n₹{{2}} landed. That's {{3}} than your usual month.\nAfter your bills, you've got about ₹{{4}} of room.\n\nAssumes your {{5}} fixed bills at last month's amounts, ₹{{6}} together.",
    params: [
      { name: 'firstName', sample: 'Rohan' },
      { name: 'income', sample: '92,000' },
      { name: 'versusUsual', sample: '₹8,400 more', note: 'composed: amount and direction' },
      { name: 'headroom', sample: '56,900' },
      { name: 'fixedBillCount', sample: 'five', note: 'spelled out' },
      { name: 'fixedBillTotal', sample: '35,100' },
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
    body: "Hi {{1}}, it's been {{2}} days since anything was logged, so this month's picture is going stale.\n\nA week of logging is usually enough for a forecast worth trusting. Reply LOG and we'll do today's in one line.",
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
    body: 'Good news, {{1}}.\n\nYour savings would now cover about {{2}} months, up from {{3}}. {{4}} is what moved it.\n\nAssumes your recent spending continues.',
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
};

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
