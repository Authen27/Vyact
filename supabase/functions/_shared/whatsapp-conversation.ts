// Vyact WhatsApp — the capture conversation (W3, v10.44.0).
//
// Pure module: recognising the short replies that continue a conversation, and the
// words said back. The webhook keeps the state (`whatsapp_pending_turns`) and does
// the writes through RPCs; nothing here touches the database.
//
// The binding rule: NOTHING is written without an answer. A missing amount, a
// possible duplicate — each asks first, and only writes after the person replies.
// UNDO and a correction act only on the entry WhatsApp itself just logged.

import { normalise, matchCategory, parseAmount, EXPENSE_IDS, INCOME_IDS } from './whatsapp-parser.ts';

/** How long a question waits for its answer. */
export const PENDING_MINUTES = 30;
/** How long UNDO and a correction reach back. */
export const UNDO_MINUTES = 15;
/** A second entry of the same amount and category this soon is asked about first. */
export const DUPLICATE_WINDOW_MINUTES = 120;

export type PendingKind = 'missing_amount' | 'duplicate_check';

export function isUndo(text: string): boolean {
  return /^(undo|undo that|undo it|delete (that|it|last)|remove (that|it|last))[.!]*$/i.test((text ?? '').trim());
}

/** "1" / "yes" / "log it" → yes; "2" / "no" / "skip" → no; anything else → null. */
export function yesNo(text: string): 'yes' | 'no' | null {
  const t = (text ?? '').trim().toLowerCase().replace(/[.!]+$/, '');
  if (/^(1|yes|y|yeah|yep|log it|log|ok|okay)$/.test(t)) return 'yes';
  if (/^(2|no|n|nope|skip|don'?t|cancel)$/.test(t)) return 'no';
  return null;
}

/** The whole message is just an amount ("450", "₹1,200", "rs 80.50"). */
export function bareAmount(text: string): number | null {
  const t = (text ?? '').trim();
  if (!/^(?:rs\.?|inr|₹)?\s*\d[\d,]*(?:\.\d{1,2})?$/i.test(t)) return null;
  const n = Number(t.replace(/^(?:rs\.?|inr|₹)\s*/i, '').replace(/,/g, ''));
  return n > 0 ? n : null;
}

/**
 * "no, that was groceries" / "change it to fuel" / "make that dining" → the new
 * category id. Null when the message is not a correction or names no category.
 */
export function parseCorrection(text: string): string | null {
  const m = /^(?:no[,.!]?\s+)?(?:that was|it was|that's|thats|change (?:it |that )?to|make (?:it|that)|should be|actually)\s+(.+)$/i
    .exec((text ?? '').trim());
  if (!m) return null;
  return matchCategory(normalise(m[1])) ?? null;
}

/** The category belongs to the entry's type (categories are type-scoped). */
export function categoryFitsType(category: string, type: string): boolean {
  if (type === 'expense') return EXPENSE_IDS.has(category);
  if (type === 'income') return INCOME_IDS.has(category);
  return false;   // transfers and investments carry no category
}

/**
 * A message that names what it was for but no amount ("groceries hdfc") is worth
 * asking about; one with nothing recognisable is not (it gets the normal help).
 */
export function worthAskingAmount(text: string): boolean {
  const t = normalise(text ?? '');
  return !parseAmount(t) && !!matchCategory(t);
}

export const ASK_AMOUNT = 'How much was it? Reply with just the amount, like 450.';
export const SKIPPED = 'Skipped. Nothing was logged.';
export const EXPIRED = "That question has expired, so nothing was logged. Send the entry again whenever you're ready.";
export const UNDO_HINT = 'Reply UNDO within 15 minutes to remove it.';

export function duplicateQuestion(amountText: string, categoryLabel: string, minutesAgo: number): string {
  const when = minutesAgo < 1 ? 'just now' : minutesAgo === 1 ? 'a minute ago' : `${minutesAgo} minutes ago`;
  return `You logged ${amountText}${categoryLabel ? ` · ${categoryLabel}` : ''} ${when}. Log this one too?\n\nReply 1 to log it, 2 to skip.`;
}

export function undoReply(status: string, amountText?: string): string {
  switch (status) {
    case 'undone': return `Undone. ${amountText ?? 'That entry'} is removed from Vyact.`;
    case 'too_late': return `That's past the ${UNDO_MINUTES} minutes, so I've left it. You can delete it in the app.`;
    case 'edited': return "That entry has been changed in the app since, so I've left it. You can delete it there.";
    default: return "There's nothing I logged in the last 15 minutes to undo.";
  }
}
