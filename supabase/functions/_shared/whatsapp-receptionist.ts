// Vyact WhatsApp — the receptionist (v10.41.0).
//
// A greeting ("hi", "hello", "good morning") or MENU / HELP / START is the most
// common way a chat starts, and used to get "I couldn't read that". It is now the
// entry point: a WhatsApp LIST message (a "Choose an action" button opening up to
// ten rows) offering the frequent actions. A list is a session message — allowed
// only inside the 24 hours after the person writes, which a greeting always is — so
// it needs no Meta template and no approval.
//
// Design: the "Vyact receptionist and button replies" canvas (WhatsApp row).
// Pure module: wording, the list payload and the row replies. The webhook sends.
//
// Rules it keeps:
//   • Record rows TEACH the one-line format; they never write anything themselves.
//   • Check rows link to the app: WhatsApp does not answer data questions until W4
//     (Ask Vyact on WhatsApp). The copy says so plainly rather than half-answering.
//   • An unlinked number never gets the menu, never records, never sees data.

export interface ListRow { id: string; title: string; description: string }
export interface ListSection { title: string; rows: ListRow[] }
export interface InteractiveList {
  body: string;
  footer?: string;
  button: string;
  sections: ListSection[];
}

/** Meta's limits for a list message; the unit test holds the menu to them. */
export const LIST_LIMITS = { body: 1024, footer: 60, button: 20, sectionTitle: 24, rowTitle: 24, rowDescription: 72, rows: 10, rowId: 200 } as const;

/** True when the WHOLE message is a greeting or a request for the menu. */
export function isReceptionistTrigger(text: string): boolean {
  const t = (text ?? '').toLowerCase().normalize('NFKC')
    .replace(/[!?.,:;~*]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\s+(vyact|there|team)$/, '');
  return /^(hi+|hello|hey|hiya|yo|namaste|namaskar|good (morning|afternoon|evening)|menu|help|start|options)$/.test(t);
}

/** "Hi Rohan." / "Morning, Rohan." — mirrors the greeting's time of day. */
function salutation(text: string, firstName?: string | null): string {
  const tod = /good (morning|afternoon|evening)/i.exec(text ?? '')?.[1];
  const word = tod ? tod.charAt(0).toUpperCase() + tod.slice(1).toLowerCase() : 'Hi';
  return firstName ? `${word}, ${firstName}.` : `${word}.`;
}

export const MENU: ListSection[] = [
  { title: 'Record', rows: [
    { id: 'menu:log_spend', title: 'Log a spend', description: 'Like 450 lunch hdfc' },
    { id: 'menu:log_income', title: 'Log income', description: 'Like +50000 salary' },
    { id: 'menu:move_money', title: 'Move money', description: 'Between your own accounts' },
  ] },
  { title: 'Check', rows: [
    { id: 'menu:this_month', title: 'This month', description: "What you've spent so far" },
    { id: 'menu:budgets', title: 'Budgets', description: 'Which are close to the limit' },
    { id: 'menu:whats_due', title: "What's due", description: 'Bills coming up' },
  ] },
  { title: 'Help and settings', rows: [
    { id: 'menu:what_can_i_send', title: 'What can I send?', description: 'Everything I understand here' },
    { id: 'menu:messages', title: 'Messages I send you', description: 'Reminders and summaries' },
  ] },
];

/** The greeting + menu, for a LINKED number. `menuOnly` = the shorter MENU/HELP lead. */
export function receptionistList(text: string, firstName?: string | null): InteractiveList {
  const asked = /^(menu|help|options|start)$/i.test((text ?? '').trim());
  return {
    body: asked
      ? "Here's everything I can do in this chat."
      : `${salutation(text, firstName)} What would you like to do?\n\nRecord something, check where you stand, or change what I send you.`,
    footer: asked ? undefined : 'Or just send a line, like 450 lunch hdfc',
    button: 'Choose an action',
    sections: MENU,
  };
}

/** The reply to a tapped menu row, or null for an id this menu never issued. */
export function menuReply(rowId: string, appUrl: string): string | null {
  const inApp = (label: string, path: string) =>
    `Your figures stay in the app for now, so they never sit in a chat thread.\n${label}: ${appUrl}${path}`;
  switch (rowId) {
    case 'menu:log_spend':
      return "Send it in one line:\n450 lunch hdfc\n1200 groceries\n450 lunch yesterday\n\nName the account if it wasn't cash, and the day if it wasn't today.";
    case 'menu:log_income':
      return "Start it with a plus:\n+50000 salary\n+2000 refund hdfc\n\nName the account it went into if it wasn't cash.";
    case 'menu:move_money':
      return 'Say where it went:\nmoved 10000 to icici\nmoved 5000 from hdfc to cash';
    case 'menu:this_month': return inApp('This month', '/dashboard');
    case 'menu:budgets': return inApp('Budgets', '/budgets');
    case 'menu:whats_due': return inApp("What's due", '/recurring');
    case 'menu:what_can_i_send':
      return "In this chat I record a spend, income or a transfer from one line, like 450 lunch hdfc. Balances and reports stay in the app for now.\n\nSend MENU any time for this list.";
    case 'menu:messages':
      return "Right now I only reply to what you send me. When reminders and summaries switch on, you'll choose which ones you get here, and STOP will always turn them off.";
    default:
      return null;
  }
}

/** A greeting from a number that is not linked: who we are, and how to link. No data. */
export const UNLINKED_GREETING =
  "Hi. I'm Vyact, the household money app.\n\nThis number isn't linked to an account yet, so I can't record anything for it.\n\n"
  + 'Already use Vyact? Link this number in the app, under Settings › WhatsApp.\nNew to it? Start here: https://vyact.app';

/** Anything else from an unlinked number: one short reminder, never logged. */
export const UNLINKED_OTHER = "I can't record that until this number is linked. Settings › WhatsApp in the app.";
