// Vyact WhatsApp — consent, topics and STOP (W2, v10.42.0).
//
// Pure module: which topic each template belongs to, what consent it needs, how a
// STOP / START message or a "Stop these" tap changes a person's preferences, and
// the reply that says exactly what changed. The webhook, whatsapp-notify and the
// dispatcher all decide from here, so "can I send this?" has one answer.
//
// Three kinds of consent:
//   • service   — the person linked their number, which is consent to messages
//                 about their own money that they would expect (a large spend, a
//                 bill, a split). Some of these can be muted; bills and large-spend
//                 alerts cannot, so STOP never silences a possible fraud warning.
//   • insights  — interpretations of their data (payday room, the evening digest,
//                 the month close). Off until they say yes; never bundled with
//                 marketing.
//   • marketing — anything Meta classes as marketing. Off until they opt in, with
//                 the time and place they did so recorded.

import { TEMPLATES, type TemplateDef } from './whatsapp-templates.ts';

export type Consent = 'service' | 'insights' | 'marketing';

export interface TopicDef {
  /** What the person calls it: "No more <label>." */
  label: string;
  /** Can STOP silence it? Bills and large-spend alerts: never. */
  mutable: boolean;
  /** Consent for utility templates in this topic (marketing templates always need marketing). */
  consent: Consent;
}

export const TOPICS = {
  bills: { label: 'bill reminders', mutable: false, consent: 'service' },
  large_spend: { label: 'large-spend alerts', mutable: false, consent: 'service' },
  welcome: { label: 'the welcome', mutable: false, consent: 'service' },
  answers: { label: 'answers to your questions', mutable: false, consent: 'service' },
  budgets: { label: 'budget alerts', mutable: true, consent: 'service' },
  splits: { label: 'split updates', mutable: true, consent: 'service' },
  recurring: { label: 'scheduled-payment notes', mutable: true, consent: 'service' },
  payday: { label: 'payday messages', mutable: true, consent: 'insights' },
  digest: { label: 'evening digests', mutable: true, consent: 'insights' },
  summary: { label: 'month summaries', mutable: true, consent: 'insights' },
  runway: { label: 'savings-runway notes', mutable: true, consent: 'marketing' },
  setup: { label: 'budget set-up reminders', mutable: true, consent: 'marketing' },
  balances: { label: 'balance check reminders', mutable: true, consent: 'marketing' },
  weekly: { label: 'weekly summaries', mutable: true, consent: 'marketing' },
  tips: { label: 'tips', mutable: true, consent: 'marketing' },
} as const satisfies Record<string, TopicDef>;

export type TopicId = keyof typeof TOPICS;

export const TEMPLATE_TOPIC: Record<string, TopicId> = {
  bill_due_reminder: 'bills',
  large_transaction_alert: 'large_spend',
  whatsapp_welcome: 'welcome',
  affordability_reply: 'answers',
  budget_threshold_alert: 'budgets',
  partner_split_prompt: 'splits',
  split_shared_with_you: 'splits',
  split_settled: 'splits',
  recurring_auto_logged: 'recurring',
  payday_headroom: 'payday',
  household_daily_digest: 'digest',
  month_close_summary: 'summary',
  runway_shift_alert: 'runway',
  budget_setup_reminder: 'setup',
  balance_stale_nudge: 'balances',
  weekly_summary: 'weekly',
  reengagement_nudge: 'tips',
};

/** The words after STOP / START that name a topic. Footers promise the first six. */
const STOP_WORDS: Record<string, TopicId> = {
  payday: 'payday', digest: 'digest', runway: 'runway', summary: 'summary', setup: 'setup',
  balances: 'balances', balance: 'balances', budgets: 'budgets', budget: 'budgets',
  splits: 'splits', split: 'splits', weekly: 'weekly', tips: 'tips', recurring: 'recurring',
};

/** A person's WhatsApp preferences, as stored in `whatsapp_preferences`. */
export interface WaPrefs {
  marketing_opt_in: boolean;
  insights_opt_in: boolean;
  muted_topics: string[];
  large_txn_threshold: number;
}

export const DEFAULT_PREFS: WaPrefs = {
  marketing_opt_in: false, insights_opt_in: false, muted_topics: [], large_txn_threshold: 10000,
};

export function topicOf(def: TemplateDef): TopicId {
  return TEMPLATE_TOPIC[def.name] ?? 'tips';
}

/** The consent a template needs. Anything Meta treats as marketing needs marketing. */
export function consentOf(def: TemplateDef): Consent {
  return def.category === 'marketing' ? 'marketing' : TOPICS[topicOf(def)].consent;
}

/** Why this person must not get this template now, or null when they may. */
export function refusalFor(def: TemplateDef, prefs: WaPrefs): string | null {
  const consent = consentOf(def);
  if (consent === 'marketing' && !prefs.marketing_opt_in) return 'marketing_consent_required';
  if (consent === 'insights' && !prefs.insights_opt_in) return 'insights_consent_required';
  const topic = topicOf(def);
  if (TOPICS[topic].mutable && prefs.muted_topics.includes(topic)) return 'muted';
  return null;
}

export type PrefCommand =
  | { kind: 'stop_all' }
  | { kind: 'stop'; topic: TopicId }
  | { kind: 'start'; topic: TopicId }
  | { kind: 'unknown_topic'; word: string };

/**
 * STOP, STOP <TOPIC> or START <TOPIC>, as the WHOLE message. Bare START is not
 * here: it opens the menu (the receptionist), and turning marketing back on is
 * done in the app, where the consent is recorded properly.
 */
export function parsePrefCommand(text: string): PrefCommand | null {
  const t = (text ?? '').trim().toLowerCase().replace(/[.!]+$/, '').replace(/\s+/g, ' ');
  if (t === 'stop' || t === 'stop all' || t === 'unsubscribe') return { kind: 'stop_all' };
  const m = /^(stop|start) ([a-z]+)$/.exec(t);
  if (!m) return null;
  const topic = STOP_WORDS[m[2]];
  if (!topic) return m[1] === 'stop' ? { kind: 'unknown_topic', word: m[2] } : null;
  return { kind: m[1] as 'stop' | 'start', topic };
}

const STILL_COMES = 'Bill reminders and large-spend alerts still come. Change the rest under Messages I send you in the menu.';

/** Apply a command. Returns the new preferences and the reply that says what changed. */
export function applyPrefCommand(prefs: WaPrefs, cmd: PrefCommand): { prefs: WaPrefs; reply: string } {
  const muted = new Set(prefs.muted_topics);
  switch (cmd.kind) {
    case 'stop_all': {
      for (const [id, topic] of Object.entries(TOPICS)) if (topic.mutable) muted.add(id);
      return {
        prefs: { ...prefs, marketing_opt_in: false, insights_opt_in: false, muted_topics: [...muted].sort() },
        reply: `Done. I've stopped everything I can stop here: tips, summaries and alerts.\n\n${STILL_COMES.split('.')[0]}, because they can protect your money. Unlink the number in the app to stop those too.`,
      };
    }
    case 'stop': {
      const topic = TOPICS[cmd.topic];
      if (!topic.mutable) {
        return { prefs, reply: `${cap(topic.label)} can't be switched off here, because they can protect your money. Unlink the number in the app to stop all messages.` };
      }
      muted.add(cmd.topic);
      return { prefs: { ...prefs, muted_topics: [...muted].sort() }, reply: `Done. No more ${topic.label}.\n\n${STILL_COMES}` };
    }
    case 'start': {
      const topic = TOPICS[cmd.topic];
      muted.delete(cmd.topic);
      const next = { ...prefs, muted_topics: [...muted].sort() };
      if (topic.consent === 'marketing' && !prefs.marketing_opt_in) {
        return { prefs: next, reply: `${cap(topic.label)} are unmuted, but they're promotional, so they only come once you turn on tips and summaries in the app: Settings › WhatsApp.` };
      }
      if (topic.consent === 'insights' && !prefs.insights_opt_in) {
        return { prefs: next, reply: `${cap(topic.label)} are unmuted. They start once you turn on insights in the app: Settings › WhatsApp.` };
      }
      return { prefs: next, reply: `Done. ${cap(topic.label)} are back on.` };
    }
    case 'unknown_topic':
      return { prefs, reply: `I don't send anything called "${cmd.word}". Send STOP to stop everything I can, or MENU › Messages I send you to see the list.` };
  }
}

/** "Messages I send you" — what this person gets now, from their own preferences. */
export function prefsSummary(prefs: WaPrefs, appUrl: string): string {
  const on: string[] = ['Bill reminders and large-spend alerts (always)'];
  const off: string[] = [];
  for (const id of ['budgets', 'splits'] as TopicId[]) (prefs.muted_topics.includes(id) ? off : on).push(cap(TOPICS[id].label));
  (prefs.marketing_opt_in ? on : off).push('Tips and weekly summaries');
  const lines = [`What I send you here:\n• ${on.join('\n• ')}`];
  if (off.length) lines.push(`Off:\n• ${off.join('\n• ')}`);
  lines.push(`Send STOP <name>, like STOP BUDGETS, to switch one off. Change them all in the app: ${appUrl}/settings`);
  return lines.join('\n\n');
}

/**
 * The reply to a tap on a template's quick-reply button (W2). `label` is the
 * button text. Returns what to change (a topic to mute) and what to say, or null
 * for a button this release does not answer. Copy: the "Template button replies"
 * design board. Replies that would need a write we cannot do safely yet say where
 * to do it instead, never pretend it happened.
 */
export function buttonReply(
  templateName: string, label: string, appUrl: string,
): { mute?: TopicId; reply: string } | null {
  const def = TEMPLATES[templateName];
  if (!def) return null;
  const topic = topicOf(def);
  switch (label) {
    case 'Stop these':
      return { mute: topic, reply: `Done. No more ${TOPICS[topic].label}.\n\n${STILL_COMES}` };
    case 'Stop budget alerts':
      return { mute: 'budgets', reply: 'Done. No more budget alerts here. Your budgets still track in the app.' };
    case 'That was me':
      return { reply: 'Noted, nothing to do.' };
    case 'Flag it':
      return { reply: `If you don't recognise it, call your bank now. I can't block a card.\n\nYou can check and edit it in the app: ${appUrl}/transactions` };
    case 'Not now':
      return { reply: "No problem. I'll check again next week." };
    case 'Keep current limits':
      return { reply: 'Kept. Your limits stay as they are.' };
    case "What's driving it?":
      return { reply: `The category breakdown is in the app: ${appUrl}/budgets` };
    case 'What moved?':
      return { reply: `The detail is in the app: ${appUrl}/networth` };
    case 'Split it into budgets':
    case 'Show me the suggestions':
      return { reply: `Your budgets are in the app: ${appUrl}/budgets\nNothing changes until you save.` };
    default:
      return null;   // Undo, Pause, Split 50/50… need the W3 conversation state.
  }
}

/** A tap on a template message this old is not acted on (design: "any late tap"). */
export const LATE_TAP_DAYS = 7;
export const LATE_TAP_REPLY = "That message is from a while ago, so I haven't acted on it. Send MENU to see what I can do now.";

/** Reply for a button this release cannot act on: say where, never pretend. */
export function unsupportedButtonReply(appUrl: string): string {
  return `I can't do that from chat yet. You can do it in the app: ${appUrl}`;
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
