// WhatsApp follow-up conversations (W6, v10.47.0) — the pure parts.
//
//   "Name them here": this month's expenses still in Other, named from the chat.
//     Only the category changes. The category must be an expense category, and
//     never Loan / EMI (an EMI is a system split: interest plus a principal
//     transfer, recorded in the app — relabelling a plain expense would make the
//     debt figures untrue). An unknown word is answered with the real options,
//     never guessed.
//   "Reply UPDATE": stale bank, card and cash balances, one at a time. A card is
//     asked what is OWED. The correction is the app's reconcile (offset + dated
//     log), never a transaction; that happens in the engine and the RPC.
//
// Nothing here touches the database; the webhook does, through the W6 RPCs.

import { normalise, matchCategory, EXPENSE_IDS, INCOME_IDS } from './whatsapp-parser.ts';
import { EXPENSE_LABEL, moneyText, countWord, dueDayText } from './whatsapp-dispatch-rules.ts';

// ── Triggers ─────────────────────────────────────────────────────────────────
export function isNameTrigger(text: string): boolean {
  return /^(name them|name them here|name entries|name my entries)[.!]*$/i.test((text ?? '').trim());
}
export function isUpdateTrigger(text: string): boolean {
  return /^(update|update here|update balances?|update my balances)[.!]*$/i.test((text ?? '').trim());
}
export function isStopWord(text: string): boolean {
  return /^(done|that'?s all|finish|finished|cancel|no more)[.!]*$/i.test((text ?? '').trim());
}

// ── "Name them here" ─────────────────────────────────────────────────────────
export interface UnnamedEntry { n: number; id: string; amount: number; currency: string; date: string; account: string | null }

/** How the list names one entry: "₹2,400 · 12 Sep · HDFC". Never a description. */
export function entryLine(e: UnnamedEntry): string {
  return [moneyText(e.amount, e.currency), dueDayText(e.date), e.account].filter(Boolean).join(' · ');
}

export function nameListReply(entries: UnnamedEntry[]): string {
  if (!entries.length) return 'Everything logged this month has a category. Nothing to name.';
  const head = entries.length === 1 ? 'One entry this month has no category:' : `${cap(countWord(entries.length))} entries this month have no category. Biggest first:`;
  const lines = entries.map((e) => `${e.n}. ${entryLine(e)}`).join('\n');
  const eg = entries.length > 1 ? ` Several at once works too: ${entries[1].n} travel, ${entries[0].n} dining.` : '';
  return `${head}\n${lines}\n\nReply with the number and a category, like ${entries[0].n} groceries.${eg}`;
}

export type NamePick =
  | { n: number; category: string }
  | { n: number; unknown: string }
  | { n: number; notAllowed: 'income' | 'emi'; word: string };

/**
 * "1 groceries", "2 travel, 3 dining", "2 travel and 4 shopping" → picks. Returns
 * null when the message is not a naming reply at all (so the webhook treats it as
 * a normal message).
 */
export function parseNamePicks(text: string): NamePick[] | null {
  const parts = (text ?? '').split(/\s*(?:,|;|\band\b|\n)\s*/i).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const picks: NamePick[] = [];
  for (const p of parts) {
    const m = /^(\d{1,2})[.)]?\s+(.+)$/.exec(p);
    if (!m) return null;
    const n = Number(m[1]);
    const word = m[2].trim();
    const cat = matchCategory(normalise(word)) ?? idFromLabel(word);
    if (!cat) picks.push({ n, unknown: word });
    else if (INCOME_IDS.has(cat)) picks.push({ n, notAllowed: 'income', word });
    else if (cat === 'loan_emi') picks.push({ n, notAllowed: 'emi', word });
    else if (EXPENSE_IDS.has(cat)) picks.push({ n, category: cat });
    else picks.push({ n, unknown: word });
  }
  return picks;
}

/** "Food & Dining" / "food and dining" / "personal care" → its id. */
function idFromLabel(word: string): string | undefined {
  const w = normalise(word).replace(/&/g, 'and');
  for (const [id, label] of Object.entries(EXPENSE_LABEL)) {
    if (normalise(label).replace(/&/g, 'and') === w || id.replace(/_/g, ' ') === w) return id;
  }
  return undefined;
}

/** The categories a person can name an entry with (Other and Loan / EMI excluded). */
export const NAMEABLE = Object.entries(EXPENSE_LABEL)
  .filter(([id]) => id !== 'other_expense' && id !== 'loan_emi')
  .map(([, label]) => label);

export interface NameOutcome { n: number; status: string; category?: string }

/** The reply after a naming message. `left` is what is still unnamed afterwards. */
export function nameResultReply(outcomes: NameOutcome[], problems: NamePick[], left: UnnamedEntry[]): string {
  const out: string[] = [];
  const named = outcomes.filter((o) => o.status === 'named');
  if (named.length === 1) out.push(`Done. ${named[0].n} is now ${EXPENSE_LABEL[named[0].category!] ?? named[0].category}.`);
  else if (named.length > 1) out.push(`Done. ${named.map((o) => `${o.n} is ${EXPENSE_LABEL[o.category!] ?? o.category}`).join(', ')}.`);
  for (const o of outcomes) {
    if (o.status === 'already_named') out.push(`${o.n} already has a category now, so I left it.`);
    else if (o.status === 'gone') out.push(`${o.n} has been deleted, so I left it.`);
    else if (o.status === 'private') out.push(`${o.n} is someone else's private entry, so I left it.`);
    else if (o.status === 'no_such') out.push(`There's no ${o.n} on the list.`);
  }
  for (const p of problems) {
    if ('unknown' in p) out.push(`I don't have "${p.unknown}" as a category. Reply ${p.n} with one of: ${NAMEABLE.join(', ')}.`);
    else if ('notAllowed' in p && p.notAllowed === 'income') out.push(`"${p.word}" is an income category, and ${p.n} is an expense.`);
    else if ('notAllowed' in p) out.push(`An EMI is recorded in the app, because it's split into interest and the loan repayment.`);
  }
  if (!left.length) out.push(named.length ? 'Everything on the list is named.' : 'Nothing is left to name.');
  else if (left.length === 1) out.push(`One left, ${entryLine(left[0])}: reply ${left[0].n} and a category, or DONE.`);
  else out.push(`${cap(countWord(left.length))} left: reply ${left[0].n} and a category, or DONE to stop here.`);
  return out.join(' ');
}

// ── "Reply UPDATE" ───────────────────────────────────────────────────────────
export interface BalanceItem { id: string; name: string; kind: string; balance: number; owed?: number; lastChecked: string }

/** A stated balance: "51300", "₹51,300", "0", "-2,000" (an overdrawn bank). */
export function statedAmount(text: string): number | null {
  const t = (text ?? '').trim().replace(/^(?:rs\.?|inr|₹)\s*/i, '');
  if (!/^-?\d[\d,]*(?:\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
export function isSame(text: string): boolean {
  return /^(same|same as before|matches|correct|it matches|that'?s right|right)[.!]*$/i.test((text ?? '').trim());
}
export function isSkip(text: string): boolean {
  return /^(skip|next|pass|don'?t know|not sure)[.!]*$/i.test((text ?? '').trim());
}

function daysAgo(iso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 86_400_000));
}

/** "1 of 4 · HDFC Savings\nVyact has ₹48,200, last checked 34 days ago. What does the bank show now?" */
export function balancePrompt(item: BalanceItem, index: number, total: number, currency: string, nowMs: number): string {
  const head = `${index + 1} of ${total} · ${item.name}`;
  const ago = item.lastChecked ? `, last checked ${daysAgo(item.lastChecked, nowMs)} days ago` : '';
  if (item.kind === 'credit_card') {
    return `${head}\nVyact has ${moneyText(item.owed ?? 0, currency)} owed${ago}. What does the card say you owe now?`;
  }
  if (item.kind === 'cash') {
    return `${head}\nVyact has ${moneyText(item.balance, currency)}${ago}. Roughly how much cash is on you?`;
  }
  return `${head}\nVyact has ${moneyText(item.balance, currency)}${ago}. What does the bank show now?`;
}

export const UPDATE_HOW = 'Reply with the amount, SAME if it matches, or SKIP.';

export function updateStartReply(total: number): string {
  if (!total) return `All your balances were checked in the last 30 days. Nothing to update.`;
  return total === 1 ? 'One balance to check.' : `${cap(countWord(total))} balances, one at a time. Oldest first.`;
}

/** What one correction did, in the app's terms: a correction, not income or spend. */
export function reconcileLine(p: { name: string; kind: string; after: number; delta: number }, currency: string): string {
  if (p.delta === 0) return `${p.name} matches. Marked as checked today.`;
  if (p.kind === 'credit_card') return `${p.name} now shows ${moneyText(Math.max(0, -p.after), currency)} owed.`;
  const gap = moneyText(Math.abs(p.delta), currency);
  return `${p.name} is now ${moneyText(p.after, currency)}. The ${gap} gap is recorded as a balance correction dated today, not as ${p.delta > 0 ? 'income' : 'spending'}, so this month's figures don't move.`;
}

export function updateSummary(checked: number, skipped: string[], netChange: number, currency: string): string {
  const parts: string[] = [];
  if (skipped.length === 1) parts.push(`Left ${skipped[0]} as it is.`);
  else if (skipped.length > 1) parts.push(`Left ${skipped.length} as they are.`);
  if (!checked) parts.push('Nothing was changed.');
  else if (netChange === 0) parts.push(`${cap(countWord(checked))} checked, and nothing needed correcting.`);
  else parts.push(`${cap(countWord(checked))} checked. Your net worth ${netChange > 0 ? 'rose' : 'fell'} by ${moneyText(Math.abs(netChange), currency)} from the corrections.`);
  return parts.join(' ');
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
