// Vyact Agent — ambiguity engine (vyact-agent-architecture.md §3.5, stage 5→6).
//
// TURNS "WE ARE NOT SURE" INTO A CONCRETE QUESTION WITH 2-4 CONCRETE ANSWERS.
//
// This is the module that delivers the product requirement: *ask for the right
// input when there are multiple interpretations*. It never guesses on the
// user's behalf, and it never computes or writes money — it produces questions
// and merges the answer.
//
// Every option carries the PATCH it applies, so answering is a pure merge —
// no re-parse, no second model call (§3.5).
//
// UNTRUSTED TEXT: merchant/description/label text originates from an SMS or a
// chat message and flows into question strings. It is sanitised (`safeText`)
// before it is ever rendered so nothing in a candidate can be read as a
// directive, a markdown/WhatsApp formatting escape, or a template placeholder.
//
// PURE — no network, no Deno/browser globals, no imports from `react/src`.
// Runs under Deno (edge) and vitest alike.

import type {
  Ambiguity,
  AmbiguityKind,
  AmbiguityOption,
  Channel,
  ExtractionCandidate,
  ResolutionConflict,
} from './types.ts';

// ── the resolver seam ────────────────────────────────────────────────────────
// Collapsed at integration: the single definition now lives in types.ts, shared
// with resolver.ts, so the two can no longer drift apart. Re-exported here so
// existing importers keep working.
export type { ResolutionConflict } from './types.ts';

/** The subset of the validator's result this module consumes (§3.4). */
export interface ValidationLike {
  issues: { code: string; severity: 'reject' | 'degrade'; detail: string }[];
}

export interface AmbiguityContext {
  channel: Channel;
  /** Household is ALWAYS asked when this is > 1 (locked product decision). */
  householdCount: number;
  /** True when the matched account is a credit card — drives the txn_type split. */
  hasCardAccountMatch?: boolean;

  // ── optional, additive: the pinned shape above is still assignable ──────────
  /**
   * The households to offer. Without it we can only ask a generic
   * "Household 1 / Household 2" question, because `householdCount` alone
   * carries no names. The pipeline has this list — pass it.
   */
  households?: { id: string; name: string }[];
  /**
   * Ambiguities produced by a sibling module (stage 7 dedupe). They are merged
   * and ordered, never re-derived here.
   */
  duplicates?: Ambiguity[];
}

/**
 * Hard cap on questions per turn. Users abandon long clarification chains: one
 * safe assumption they can correct beats a six-question interrogation.
 */
export const MAX_QUESTIONS_PER_TURN = 3;

/** An option may hold 2-4 answers (§3.5). Anything past 4 is dropped. */
export const MAX_OPTIONS = 4;

/**
 * `ExtractionCandidate` has no household field, so a household choice cannot
 * ride in the patch. It rides in the option id instead: `household:<id>`.
 * Read it with `householdIdFromOptionId`.
 */
export const HOUSEHOLD_OPTION_PREFIX = 'household:';

/**
 * CONTRACT GAP: `AmbiguityKind` (types.ts) has no `'currency'` member, but
 * `ResolutionConflict.field` does. Currency is a question about how to read the
 * amount itself, so it is emitted under `'txn_type'`. One constant so the owner
 * of types.ts can flip it in a single place after adding `'currency'`.
 */
export const CURRENCY_AMBIGUITY_KIND: AmbiguityKind = 'txn_type';

// ── ordering ─────────────────────────────────────────────────────────────────
//
// Most consequential first: a wrong household misfiles business vs personal
// spend and is invisible afterwards; a wrong category is a two-tap fix.
const RANK = {
  household: 0,
  txn_type: 10,
  account: 20,
  to_account: 21,
  duplicate: 30,
  polarity: 40,
  date: 50,
  currency: 60,
  category: 70,
} as const;

// ── untrusted text ───────────────────────────────────────────────────────────

// Control chars C0/C1, plus zero-width and bidi-override code points (text that
// can visually reorder a rendered question). Expressed as numeric ranges so the
// source file stays plain ASCII.
const CONTROL_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x2029],
  [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x2069], [0xfeff, 0xfeff],
];

function stripControl(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    out += CONTROL_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi) ? ' ' : ch;
  }
  return out;
}

/** Markdown / WhatsApp formatting and template delimiters. */
const MARKUP_RE = /[`*_~<>{}[\]|\\]/g;
/** Leading characters that a client could read as a command or directive. */
const LEADING_DIRECTIVE_RE = /^[\s/!#@.:;,\-=+>]+/;

/**
 * Make untrusted text safe to embed in a question or an option label.
 * Data, never instruction: strips control/bidi characters, formatting markup
 * and command-ish prefixes, collapses whitespace, and truncates.
 */
export function safeText(raw: string | undefined | null, max = 40): string {
  if (raw == null) return '';
  let s = stripControl(String(raw))
    .replace(MARKUP_RE, ' ')
    .replace(LEADING_DIRECTIVE_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length > max) s = `${s.slice(0, Math.max(1, max - 1)).trimEnd()}…`;
  return s;
}

// ── money rendering (display only — this module never computes money) ────────

const SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥',
  AUD: 'A$', CAD: 'C$', SGD: 'S$', NZD: 'NZ$', AED: 'AED ', CHF: 'CHF ',
};

function group(n: number): string {
  const neg = n < 0;
  const [int, frac] = Math.abs(n).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${frac === '00' ? grouped : `${grouped}.${frac}`}`;
}

/** '1200' + 'INR' → '₹1,200'. Unknown/absent currency → the bare number. */
export function formatMoney(amount?: number, currency?: string): string {
  if (amount == null || !isFinite(amount)) return '';
  const code = (currency ?? '').toUpperCase();
  const sym = SYMBOLS[code];
  if (sym) return `${sym}${group(amount)}`;
  return code ? `${code} ${group(amount)}` : group(amount);
}

// ── phrase helpers ───────────────────────────────────────────────────────────

/** "the ₹1,200 at Swiggy" / "the ₹1,200" / "this" — always concrete when we can be. */
function subject(c: ExtractionCandidate): string {
  const amt = formatMoney(c.amount, c.currency);
  const merchant = safeText(c.merchant, 28);
  if (amt && merchant) return `the ${amt} at ${merchant}`;
  if (amt) return `the ${amt}`;
  if (merchant) return `the charge at ${merchant}`;
  return 'this';
}

/** ['A','B','C'] → 'A, B or C'. */
function orList(items: string[]): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(', ')} or ${clean[clean.length - 1]}`;
}

function optionLabels(options: AmbiguityOption[]): string[] {
  return options.map(o => safeText(o.label, 28));
}

function capOptions(options: AmbiguityOption[]): AmbiguityOption[] {
  return options.slice(0, MAX_OPTIONS);
}

// ── detectors ────────────────────────────────────────────────────────────────

function householdOptions(ctx: AmbiguityContext): AmbiguityOption[] {
  if (ctx.households && ctx.households.length >= 2) {
    return ctx.households.slice(0, MAX_OPTIONS).map(h => ({
      id: `${HOUSEHOLD_OPTION_PREFIX}${h.id}`,
      label: safeText(h.name, 28) || 'Household',
      patch: {},
    }));
  }
  // Degraded fallback: we must still ask (locked), but with no names the best we
  // can do is a positional list. The pipeline should pass `ctx.households`.
  const n = Math.min(Math.max(ctx.householdCount, 0), MAX_OPTIONS);
  return Array.from({ length: n }, (_, i) => ({
    id: `${HOUSEHOLD_OPTION_PREFIX}${i + 1}`,
    label: `Household ${i + 1}`,
    patch: {},
  }));
}

/**
 * "1200 amex" when the matched account is a card. Three readings, three patches:
 *   a) an expense charged to the card
 *   b) paying the card bill        → transfer INTO the card
 *   c) a transfer to the card      → transfer INTO the card
 * (b) and (c) move money identically in the money model and differ only in
 * label/description — see the note in the module report.
 */
function cardTxnTypeAmbiguity(c: ExtractionCandidate): Ambiguity {
  const card = safeText(c.account_alias, 24) || 'the card';
  const amt = formatMoney(c.amount, c.currency);
  const money = amt || 'this';

  return {
    kind: 'txn_type',
    question: `What is ${amt ? `the ${amt}` : 'this'} on ${card}?`,
    options: [
      {
        id: 'txn_type:expense_on_card',
        label: `Spent ${money} on ${card}`,
        patch: {
          transaction_type: 'expense',
          direction: 'debit',
          to_account_alias: null,
        },
      },
      {
        id: 'txn_type:card_bill_payment',
        label: `Paid ${money} to the ${card} bill`,
        patch: {
          transaction_type: 'transfer',
          direction: 'debit',
          // The card is the DESTINATION; the paying account is unknown, so it is
          // cleared and resolved (or asked) on the next turn.
          account_alias: undefined,
          to_account_alias: c.account_alias ?? card,
          category_id: null,
          description: `${card} bill payment`,
        },
      },
      {
        id: 'txn_type:transfer_to_card',
        label: `Moved ${money} to ${card}`,
        patch: {
          transaction_type: 'transfer',
          direction: 'debit',
          account_alias: undefined,
          to_account_alias: c.account_alias ?? card,
          category_id: null,
          description: `Transfer to ${card}`,
        },
      },
    ],
  };
}

function polarityAmbiguity(c: ExtractionCandidate): Ambiguity {
  const amt = formatMoney(c.amount, c.currency);
  const merchant = safeText(c.merchant, 28);
  const where = merchant ? ` at ${merchant}` : '';
  // Only touch transaction_type when it is an expense/income guess. A transfer
  // or an investment keeps its type; only the direction is in question.
  const keepsType = c.transaction_type === 'transfer' || c.transaction_type === 'investment';

  return {
    kind: 'polarity',
    question: `Did ${amt ? `${amt}${where}` : 'that'} go out or come in?`,
    options: [
      {
        id: 'polarity:debit',
        label: amt ? `${amt} went out` : 'Money out',
        patch: keepsType ? { direction: 'debit' } : { direction: 'debit', transaction_type: 'expense' },
      },
      {
        id: 'polarity:credit',
        label: amt ? `${amt} came in` : 'Money in',
        patch: keepsType ? { direction: 'credit' } : { direction: 'credit', transaction_type: 'income' },
      },
    ],
  };
}

function conflictQuestion(conflict: ResolutionConflict, c: ExtractionCandidate, options: AmbiguityOption[]): string {
  const choices = orList(optionLabels(options));
  const tail = choices ? ` — ${choices}?` : '?';
  const subj = subject(c);
  switch (conflict.field) {
    case 'account':
      return `Which account for ${subj}${tail}`;
    case 'to_account':
      return `Where did ${subj} go${tail}`;
    case 'category':
      return `Which category for ${subj}${tail}`;
    case 'date':
      return `When was ${subj}${tail}`;
    case 'currency':
      return `Which currency for ${subj}${tail}`;
    case 'household':
      return `Which household is ${subj} for${tail}`;
  }
}

const FIELD_TO_KIND: Record<ResolutionConflict['field'], AmbiguityKind> = {
  account: 'account',
  to_account: 'account',
  category: 'category',
  household: 'household',
  date: 'date',
  currency: CURRENCY_AMBIGUITY_KIND,
};

// ── the engine ───────────────────────────────────────────────────────────────

/**
 * Collect every open question for this turn, most consequential first, capped
 * at `MAX_QUESTIONS_PER_TURN`.
 *
 * `validation` is the validator's result (only `issues` is read).
 * Nothing here reads or writes money.
 */
export function detectAmbiguities(
  candidate: ExtractionCandidate,
  conflicts: ResolutionConflict[],
  validation: ValidationLike,
  ctx: AmbiguityContext,
): Ambiguity[] {
  const ranked: { rank: number; seq: number; a: Ambiguity }[] = [];
  const push = (rank: number, a: Ambiguity): void => {
    if (a.options.length < 2) return;           // a question needs ≥2 answers
    ranked.push({ rank, seq: ranked.length, a: { ...a, options: capOptions(a.options) } });
  };

  const list = Array.isArray(conflicts) ? conflicts : [];

  // 1. HOUSEHOLD — always asked when the user has more than one (locked).
  const householdConflict = list.find(x => x.field === 'household');
  if (ctx.householdCount > 1 || householdConflict) {
    const options = householdConflict && householdConflict.candidates.length >= 2
      ? householdConflict.candidates
      : householdOptions(ctx);
    push(RANK.household, {
      kind: 'household',
      question: householdConflict
        ? conflictQuestion(householdConflict, candidate, capOptions(options))
        : `Which household is ${subject(candidate)} for?`,
      options,
    });
  }

  // 2. TXN TYPE — "1200 amex": expense on the card, the card bill, or a transfer.
  const cardAlreadyDirected = candidate.to_account_alias != null
    || candidate.direction === 'credit'
    || candidate.transaction_type === 'income'
    || candidate.transaction_type === 'investment';
  if (ctx.hasCardAccountMatch === true && candidate.amount != null && !cardAlreadyDirected) {
    push(RANK.txn_type, cardTxnTypeAmbiguity(candidate));
  }

  // 3. RESOLVER CONFLICTS — one Ambiguity per conflict, its candidates as options.
  for (const conflict of list) {
    if (conflict.field === 'household') continue;                 // handled above
    const options = capOptions(conflict.candidates ?? []);
    if (options.length < 2) continue;                             // nothing to ask
    push(RANK[conflict.field], {
      kind: FIELD_TO_KIND[conflict.field],
      question: conflictQuestion(conflict, candidate, options),
      options,
    });
  }

  // 4. POLARITY — both debit and credit verbs present, or neither (§3.4).
  const polarityIssue = (validation?.issues ?? []).some(
    i => i.code === 'polarity_conflict' || i.code === 'polarity_missing',
  );
  if (polarityIssue) push(RANK.polarity, polarityAmbiguity(candidate));

  // 5. DUPLICATES — produced by the dedupe module; merged as-is, never re-derived.
  for (const dup of ctx.duplicates ?? []) push(RANK.duplicate, dup);

  return ranked
    .sort((x, y) => (x.rank - y.rank) || (x.seq - y.seq))
    .slice(0, MAX_QUESTIONS_PER_TURN)
    .map(x => x.a);
}

// ── presentation ─────────────────────────────────────────────────────────────

function replyLine(n: number): string {
  if (n <= 1) return 'Reply 1';
  const nums = Array.from({ length: n }, (_, i) => String(i + 1));
  return `Reply ${nums.slice(0, -1).join(', ')} or ${nums[n - 1]}`;
}

/**
 * Render for a channel: the question alone in-app (the app draws the options as
 * chips), a plain-text numbered list on WhatsApp.
 */
export function formatAmbiguity(a: Ambiguity, channel: Channel): string {
  const question = safeText(a.question, 160);
  if (channel !== 'whatsapp') return question;

  const lines = a.options
    .slice(0, MAX_OPTIONS)
    .map((o, i) => `${i + 1}. ${safeText(o.label, 60)}`);
  return [question, ...lines, replyLine(Math.min(a.options.length, MAX_OPTIONS))].join('\n');
}

// ── answering ────────────────────────────────────────────────────────────────

/**
 * Apply an answer. PURE MERGE — a new candidate, unrelated fields untouched,
 * no re-parse and no second model call. A key present in the patch wins;
 * an explicit `undefined` CLEARS the field (that is how the card-bill option
 * drops the wrongly-matched source account).
 *
 * An unknown `optionId` returns an unchanged copy — a stray WhatsApp reply must
 * never mutate a candidate, and throwing inside a webhook is worse than a no-op.
 */
export function applyAnswer(
  candidate: ExtractionCandidate,
  a: Ambiguity,
  optionId: string,
): ExtractionCandidate {
  const next: Record<string, unknown> = { ...candidate };
  const option = a.options.find(o => o.id === optionId);
  if (!option) return next as ExtractionCandidate;

  for (const [key, value] of Object.entries(option.patch)) {
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next as ExtractionCandidate;
}

/**
 * The household id behind a household option (`household:<id>`), since
 * `ExtractionCandidate` has no household field for the patch to carry.
 * Returns null for any other option.
 */
export function householdIdFromOptionId(optionId: string): string | null {
  if (!optionId.startsWith(HOUSEHOLD_OPTION_PREFIX)) return null;
  const id = optionId.slice(HOUSEHOLD_OPTION_PREFIX.length);
  return id.length > 0 ? id : null;
}
