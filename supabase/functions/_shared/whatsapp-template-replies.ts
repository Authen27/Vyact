// Replies to the W6b template buttons, and the split they create (v10.47.0) — pure.
//
// Copy is the "Template button replies" board, word for word where it gives words.
// The 50/50 split is built in EXACTLY the shape the app's split form writes
// (SplitFormModal → Transaction.split): the logger is "You" and has paid, the
// partner owes their half. Only `yourShare` then counts toward spending, which is the
// money model's rule for a split (calculations.effectiveAmount).

import { moneyText, dueDayText } from './whatsapp-dispatch-rules.ts';

/** "1200 dinner shared" → shared, and the line without the word, for the parser. */
export function sharedCapture(text: string): { shared: boolean; text: string } {
  const t = (text ?? '');
  if (!/\bshared\b/i.test(t)) return { shared: false, text: t };
  return { shared: true, text: t.replace(/\s*\bshared\b\s*/ig, ' ').replace(/\s+/g, ' ').trim() };
}

export interface EvenSplit {
  split: {
    isSplit: true; totalAmount: number; yourShare: number; paidBy: 'me';
    participants: { name: string; isYou?: true; share: number; paid: boolean; paidOn: null; email?: string }[];
  };
  yourShare: number;
  partnerShare: number;
}

/** Half each; an odd paisa goes to the partner, so the two always add to the total. */
export function evenSplit(total: number, partner: { email: string; name: string | null }): EvenSplit {
  const yourShare = Math.floor(total * 50) / 100;
  const partnerShare = Math.round((total - yourShare) * 100) / 100;
  const email = partner.email.trim().toLowerCase();
  return {
    yourShare, partnerShare,
    split: {
      isSplit: true, totalAmount: total, yourShare, paidBy: 'me',
      participants: [
        { name: 'You', isYou: true, share: yourShare, paid: true, paidOn: null },
        { name: partner.name || email, share: partnerShare, paid: false, paidOn: null, email },
      ],
    },
  };
}

export function splitDoneReply(what: string, yourShare: number, partnerShare: number, partner: string, currency: string): string {
  const same = Math.abs(yourShare - partnerShare) < 0.005;
  return same
    ? `Split. Your share of ${what} is ${moneyText(yourShare, currency)}, and so is ${partner}'s. It's under Splits in Vyact.`
    : `Split. Your share of ${what} is ${moneyText(yourShare, currency)}, and ${partner}'s is ${moneyText(partnerShare, currency)}. It's under Splits in Vyact.`;
}

export function keptAsYoursReply(amount: number, what: string, currency: string): string {
  return `Kept as yours: ${moneyText(amount, currency)} for ${what}.`;
}

export const SPLIT_REFUSED: Record<string, string> = {
  already_split: "That one is already split, so I've left it.",
  gone: "That entry isn't there any more, so there's nothing to split.",
  not_yours: 'Only the person who logged it can split it.',
  not_expense: 'Only a spend can be split.',
  no_partner: "You haven't shared a split with anyone yet, so I don't know who to split it with. Split it in the app.",
};

/** Undo on recurring_auto_logged, answered within the 15 minutes. */
export function recurringUndoneReply(what: string, amount: number, currency: string, date: string): string {
  return `Undone. ${what} ${moneyText(amount, currency)} for ${dueDayText(date)} is removed. The schedule stays on for next month.`;
}

export const RECURRING_UNDO_MINUTES = 15;
export const RECURRING_TOO_LATE = "That's past the 15 minutes, so I've left it. You can delete it in the app: vyact.app/transactions";

export function pausedReply(name: string, already: boolean): string {
  return already
    ? `${name} was already paused. Turn it back on in Recurring whenever you like.`
    : `Paused ${name}. Nothing more will post until you turn it back on in Recurring.`;
}
