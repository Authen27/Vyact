// Vyact Agent — command grammar extractor (vyact-agent-architecture.md §3.1, stage 3B).
//
// THE FREE FAST PATH. This runs after the learned-recipe cache and BEFORE any
// model: a human typing `850 groceries hdfc` must never cost a token. The LLM is
// the fallback, not the front door.
//
// It is the generalised successor to the parsing half of `whatsapp-parser.ts`
// (deliberately NOT imported — that module is the live WhatsApp path and owns its
// own contract; this one speaks `ExtractionCandidate`). Differences that matter:
//   • it emits `direction` only when the phrasing DETERMINES it (the validator
//     penalises an inferred polarity — that is the correct outcome, not a bug);
//   • it leaves `category_id` undefined when nothing matched instead of forcing
//     `other_expense`, so the ambiguity detector (§3.5) can ask;
//   • it DECLINES anything that smells like a bank SMS, so the cascade falls
//     through to the recipe/LLM path. A greedy grammar match on a bank SMS is
//     exactly the "available balance is not the amount" bug that `validator.ts`
//     exists to catch — we do not create it upstream.
//
// It NEVER computes or writes money. It produces a candidate; stage 4 validates
// it, stage 5 resolves it, stage 9 writes it.
//
// All input text is UNTRUSTED DATA, never instruction. A message saying "ignore
// previous instructions" is just a line with no amount in it — it gets declined.
//
// PURE — no network, no Deno/browser globals. Runs under Deno and vitest alike.

import {
  EXPENSE_IDS,
  INCOME_IDS,
  type Direction,
  type ExtractionCandidate,
  type ExtractionResult,
  type TxnType,
} from './types.ts';

// ═══════════════════════════════════════════════════════════════════════════
//  LANGUAGE VOCABULARY TABLES — the extension seam.
//
//  Every language-specific word lives HERE, never inline in a regex. Adding
//  Telugu (or Tamil, or Marathi) is DATA: write one more `GrammarVocabulary`
//  and push it into `GRAMMAR_VOCABULARIES`. No regex is rewritten, no branch is
//  added. The regexes below are compiled from these tables at module load.
// ═══════════════════════════════════════════════════════════════════════════

export interface GrammarVocabulary {
  /** BCP-47-ish tag. Informational — matching is language-agnostic (all tables merge). */
  lang: string;
  /** Verbs that mean money LEFT the user. Sets direction 'debit'. */
  debitVerbs: string[];
  /** Verbs that mean money ARRIVED. Sets direction 'credit'. */
  creditVerbs: string[];
  /** Verbs that mean money moved between the user's own accounts (spend/income-NEUTRAL). */
  transferVerbs: string[];
  /** Verbs that mean money moved into an investment holding (also NEUTRAL). */
  investmentVerbs: string[];
  /** Prepositions introducing the SOURCE account ("from hdfc", "hdfc se"). */
  fromWords: string[];
  /** Prepositions introducing the DESTINATION account ("to icici", "in vanguard"). */
  toWords: string[];
  /** Prepositions introducing a MERCHANT ("at starbucks"). */
  atWords: string[];
  /** Words that can never be an account alias or a merchant. */
  fillers: string[];
  /** Phrases that make this a READ request — hard-declined as `query`. */
  queryPhrases: string[];
  /** keyword → category id. Must be an id from EXPENSE_IDS / INCOME_IDS. */
  categories: Record<string, string>;
}

export const VOCAB_EN: GrammarVocabulary = {
  lang: 'en',
  debitVerbs: [
    'spent', 'spend', 'paid', 'pay', 'bought', 'buy', 'purchased', 'purchase',
    'withdrew', 'withdrawn', 'sent', 'gave', 'debited', 'charged', 'billed',
  ],
  creditVerbs: [
    'got', 'received', 'receive', 'credited', 'deposited', 'earned', 'collected',
    'reimbursed', 'refunded', 'cashback',
  ],
  transferVerbs: ['transfer', 'transferred', 'moved', 'move', 'shifted', 'shift'],
  investmentVerbs: ['invested', 'investing', 'invest', 'sip'],
  fromWords: ['from'],
  toWords: ['to', 'into'],
  atWords: ['at'],
  fillers: [
    'a', 'an', 'the', 'my', 'our', 'i', 'we', 'me', 'us', 'on', 'for', 'of', 'in',
    'and', 'some', 'please', 'pls', 'plz', 'today', 'yesterday', 'yday', 'was',
    'is', 'it', 'this', 'that', 'rs', 'rupees', 'rupee', 'inr', 'usd', 'eur', 'gbp',
    'dollars', 'dollar', 'bucks', 'quid', 'money', 'amount', 'txn',
  ],
  queryPhrases: [
    'how much', 'how many', "what's", 'what is', 'what did', 'what have', 'whats',
    'show me', 'tell me', 'give me', 'net worth', 'networth', 'balance', 'remaining',
    'left over', 'leftover', 'statement', 'summary', 'report', 'history',
    'total spent', 'total spend', 'am i', 'do i owe', 'i owe', 'owed',
  ],
  categories: {
    coffee: 'food_dining', lunch: 'food_dining', dinner: 'food_dining', breakfast: 'food_dining',
    restaurant: 'food_dining', dining: 'food_dining', food: 'food_dining', snacks: 'food_dining',
    'eating out': 'food_dining', starbucks: 'food_dining', mcdonalds: 'food_dining',
    swiggy: 'food_dining', zomato: 'food_dining', takeaway: 'food_dining',
    groceries: 'groceries', grocery: 'groceries', supermarket: 'groceries', bigbasket: 'groceries',
    fuel: 'travel', petrol: 'travel', diesel: 'travel', uber: 'travel',
    taxi: 'travel', cab: 'travel', ola: 'travel', train: 'travel',
    bus: 'travel', metro: 'travel', parking: 'travel', toll: 'travel',
    amazon: 'shopping', shopping: 'shopping', clothes: 'shopping', shoes: 'shopping',
    flipkart: 'shopping', myntra: 'shopping',
    netflix: 'entertainment', spotify: 'entertainment', movie: 'entertainment',
    movies: 'entertainment', cinema: 'entertainment', subscription: 'entertainment',
    pharmacy: 'health', doctor: 'health', gym: 'health', medicine: 'health',
    dentist: 'health', hospital: 'health',
    electricity: 'utilities', water: 'utilities', internet: 'utilities', wifi: 'utilities',
    broadband: 'utilities', 'phone bill': 'utilities', bill: 'utilities', bills: 'utilities',
    rent: 'rent_mortgage', mortgage: 'rent_mortgage',
    emi: 'loan_emi', 'loan payment': 'loan_emi', loan: 'loan_emi',
    school: 'education', college: 'education', course: 'education', tuition: 'education',
    childcare: 'childcare', daycare: 'childcare', nanny: 'childcare', creche: 'childcare',
    flight: 'travel', hotel: 'travel', trip: 'travel', holiday: 'travel', vacation: 'travel',
    insurance: 'insurance', premium: 'insurance',
    salary: 'salary', payday: 'salary', wage: 'salary', wages: 'salary', payslip: 'salary',
    freelance: 'freelance', client: 'freelance', invoice: 'freelance', consulting: 'freelance',
    bonus: 'gift_bonus', gift: 'gift_bonus',
    refund: 'other_income', reimbursement: 'other_income', cashback: 'other_income',
    rental: 'rental_income',
  },
};

/**
 * Hinglish — Roman-script Hindi mixed with English. In scope for MVP.
 * NOTE the deliberate overlap: `bheje` ("sent") is a DEBIT verb here, not a
 * transfer verb, matching `validator.ts`'s treatment of "sent".
 */
export const VOCAB_HINGLISH: GrammarVocabulary = {
  lang: 'hi-Latn',
  debitVerbs: [
    'kharcha', 'kharch', 'kharche', 'kharida', 'kharide', 'kharidi', 'diya', 'diye',
    'bheja', 'bheje', 'bheji', 'lagaya', 'lagaye', 'nikala', 'nikale',
  ],
  creditVerbs: ['mila', 'mile', 'mili', 'aaya', 'aaye', 'aayi'],
  transferVerbs: ['bhejaa'],
  investmentVerbs: [],
  fromWords: ['se'],
  toWords: ['ko'],
  atWords: [],
  fillers: ['ka', 'ke', 'ki', 'kar', 'karo', 'hai', 'tha', 'the', 'wala', 'wale', 'paise', 'paisa', 'rupaye'],
  queryPhrases: ['kitna', 'kitne', 'kitni', 'kitna bacha', 'kya hai', 'batao', 'dikhao'],
  categories: {
    khana: 'food_dining', nashta: 'food_dining', chai: 'food_dining', khane: 'food_dining',
    kirana: 'groceries', sabzi: 'groceries', doodh: 'groceries', raashan: 'groceries',
    kiraya: 'rent_mortgage', kiraye: 'rent_mortgage',
    bijli: 'utilities', 'phone ka bill': 'utilities',
    dawai: 'health', dawa: 'health', ilaj: 'health',
    padhai: 'education', school_fees: 'education',
    kapde: 'shopping', kapda: 'shopping',
    safar: 'travel', auto: 'travel', rickshaw: 'travel', petrol_pump: 'travel',
    tankhwah: 'salary', tankhwa: 'salary', vetan: 'salary',
    inaam: 'gift_bonus', tohfa: 'gift_bonus',
  },
};

/** Ordered list of active vocabularies. Adding a language = pushing a table here. */
export const GRAMMAR_VOCABULARIES: GrammarVocabulary[] = [VOCAB_EN, VOCAB_HINGLISH];

// ═══════════════════════════════════════════════════════════════════════════
//  Compiled lookups (built once, from the tables above)
// ═══════════════════════════════════════════════════════════════════════════

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function merged(pick: (v: GrammarVocabulary) => string[]): string[] {
  const out: string[] = [];
  for (const v of GRAMMAR_VOCABULARIES) {
    for (const w of pick(v)) if (w && out.indexOf(w) === -1) out.push(w);
  }
  return out;
}

/** Longest-first alternation so `credit card` beats `card` and `lunch` beats `l`. */
function wordsRe(words: string[]): RegExp {
  const alts = words.slice().sort((a, b) => b.length - a.length).map(escapeRe);
  if (alts.length === 0) return /(?!)/;   // never matches
  return new RegExp(`\\b(?:${alts.join('|')})\\b`);
}

const DEBIT_RE = wordsRe(merged(v => v.debitVerbs));
const CREDIT_RE = wordsRe(merged(v => v.creditVerbs));
const TRANSFER_RE = wordsRe(merged(v => v.transferVerbs));
const INVESTMENT_RE = wordsRe(merged(v => v.investmentVerbs));
const QUERY_RE = wordsRe(merged(v => v.queryPhrases));

const FROM_RE = new RegExp(`\\b(?:${merged(v => v.fromWords).map(escapeRe).join('|')})\\s+([a-z][a-z0-9&._-]*)`);
const TO_RE = new RegExp(`\\b(?:${merged(v => v.toWords).map(escapeRe).join('|')})\\s+([a-z][a-z0-9&._-]*)`);
const AT_RE = new RegExp(`\\b(?:${merged(v => v.atWords).map(escapeRe).join('|')})\\s+([a-z][a-z0-9&._-]*)`);

const CATEGORY_MAP: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const v of GRAMMAR_VOCABULARIES) for (const k of Object.keys(v.categories)) out[k] = v.categories[k];
  return out;
})();
const CATEGORY_KEYS = Object.keys(CATEGORY_MAP).sort((a, b) => b.length - a.length);

/** Tokens that can never be an account alias. */
const NOT_AN_ALIAS = (() => {
  const s = new Set<string>();
  const add = (w: string) => { for (const part of w.split(/[\s_]+/)) if (part) s.add(part); };
  for (const v of GRAMMAR_VOCABULARIES) {
    for (const list of [v.debitVerbs, v.creditVerbs, v.transferVerbs, v.investmentVerbs,
                        v.fromWords, v.toWords, v.atWords, v.fillers]) list.forEach(add);
  }
  for (const k of CATEGORY_KEYS) add(k);
  // amount scale + currency words, and masked-account noise
  ['k', 'l', 'm', 'mn', 'cr', 'lakh', 'lakhs', 'lac', 'lacs', 'crore', 'crores',
   'ac', 'acct', 'account', 'no', 'nos', 'ref', 'utr', 'rrn', 'id', 'xx', 'xxxx'].forEach(add);
  return s;
})();

/** kind word → canonical alias. Used when no account is named explicitly. */
const KIND_ALIASES: Array<[RegExp, string]> = [
  [/\bcredit card\b/, 'credit_card'],
  [/\bdebit card\b/, 'debit_card'],
  [/\bcard\b/, 'credit_card'],
  [/\bcash\b/, 'cash'],
  [/\bbank\b/, 'bank'],
  [/\bupi\b/, 'upi'],
  [/\bwallet\b/, 'wallet'],
];

/** Default source alias for a transfer that only names a destination. Resolver-facing
 *  label, NOT a money decision — mirrors `whatsapp-parser.ts`. */
const DEFAULT_TRANSFER_SOURCE = 'cash';

export const GRAMMAR_CONFIDENCE = {
  /** An explicit verb or sign determined the polarity. */
  explicit: 0.9,
  /** Shape parsed cleanly but the polarity was left to the resolver. */
  implicit: 0.85,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
//  [1] normalise
// ═══════════════════════════════════════════════════════════════════════════

/** NFKC + quote/dash folding + whitespace collapse + lowercase. Mirrors the
 *  WhatsApp parser so the two paths agree on what a "word" is. */
export function normaliseGrammarText(raw: string): string {
  return (raw || '')
    .normalize('NFKC')
    .replace(/[‘’“”]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════════
//  [2] bank-SMS detector — the DECLINE that matters most
// ═══════════════════════════════════════════════════════════════════════════

/** Labels that mark a number as a BALANCE or LIMIT. Any hit ⇒ decline outright:
 *  the grammar must never be the thing that books an available balance. */
const BALANCE_LABELS = [
  'avl bal', 'avbl bal', 'avlbl bal', 'available balance', 'available bal',
  'a/c bal', 'ac bal', 'account balance', 'closing balance', 'closing bal',
  'opening balance', 'avl lmt', 'avl limit', 'available limit', 'credit limit',
  'cr limit', 'total due', 'min due', 'minimum due', 'amount due', 'outstanding balance',
  'bal rs', 'bal inr', 'bal is', 'balance is', 'balance rs',
];

/** Structural tells of a machine-generated bank/card message. Two or more ⇒ decline. */
const BANK_STRUCTURE: RegExp[] = [
  // masked account / card reference
  /\b(?:a\/c|acct|account|card)\b[^a-z0-9]{0,6}(?:no\.?|ending|num(?:ber)?)?[^a-z0-9]{0,4}[x*]{0,6}\d{3,}/,
  /\b[x*]{2,}\d{3,}\b/,
  // payment rails a human does not type
  /\b(?:imps|neft|rtgs|vpa|ecs|ach|nach|pos txn|upi ref|upi id)\b/,
  // reference / UTR ids
  /\b(?:ref|reference|utr|rrn|txn|trxn|transaction)\b[^a-z0-9]{0,6}(?:no\.?|id)?[^a-z0-9]{0,4}[a-z0-9]{5,}/,
  // statement-style date
  /\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/,
  // issuer boilerplate
  /\b(?:not you|dear customer|do not share|never share|sms block|helpline|toll free|customer care|thank you for banking)\b/,
  /\bcall\s*\d{7,}/,
  // bank phrasing
  /\b(?:debited|credited)\s+(?:from|to|by|in)\b/,
  /\bhas been (?:debited|credited)\b/,
  /\bavl\b/,
];

/**
 * Does this look like a bank/card SMS rather than something a human typed?
 * If so the grammar DECLINES so the cascade falls through to the learned-recipe
 * / LLM path, which is built (with the validator) to read these safely.
 */
export function looksLikeBankSms(text: string): boolean {
  const t = normaliseGrammarText(text);
  if (!t) return false;
  // Flatten dots/spacing so 'avl.bal' ≡ 'avl bal' and 'rs.12,340' ≡ 'rs 12,340'.
  const flat = t.replace(/[.\s]+/g, ' ');
  for (const label of BALANCE_LABELS) if (flat.indexOf(label) !== -1) return true;

  let signals = 0;
  for (const re of BANK_STRUCTURE) {
    if (re.test(t) || re.test(flat)) signals += 1;
    if (signals >= 2) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
//  [3] query detector — never answer a READ over the ingestion path
// ═══════════════════════════════════════════════════════════════════════════

/** A request to READ data. `850 groceries` is a log line; "what did I spend" is not. */
export function isQueryText(text: string): boolean {
  const t = normaliseGrammarText(text);
  if (!t) return false;
  const startsWithAmount = /^[+-]?\s*(?:[₹$£€]|rs\.?|inr)?\s*\d/.test(t);
  if (startsWithAmount) return false;
  if (QUERY_RE.test(t)) return true;
  return /\?\s*$/.test(t) && /^(?:what|how|when|where|why|which|who|can|did|is|are|do|does)\b/.test(t);
}

// ═══════════════════════════════════════════════════════════════════════════
//  [4] amount — never a year, an account tail, or a reference number
// ═══════════════════════════════════════════════════════════════════════════

const CURRENCY_PREFIX = '(?:\\u20b9|rs\\.?|inr|usd|aed|sgd|\\$|£|€)';
const SCALE = '(?:k|lakhs?|lacs?|l|crores?|cr|m|mn)';
const AMOUNT_RE = new RegExp(`(${CURRENCY_PREFIX})?\\s*(\\d[\\d,]*(?:\\.\\d+)?)(?:\\s*(${SCALE})\\b)?`, 'gi');

/** Look-back that marks the following number as an IDENTIFIER, not money. */
const IDENTIFIER_LOOKBACK =
  /(?:\b(?:a\/c|ac|acct|account|card|ending|ref|reference|utr|rrn|txn|trxn|id|otp|pin|invoice|no\.|nos\.)|(?:^|\s)[x*]+|#)\s*[:\-]?\s*$/;
/** Look-back that marks the following number as a BALANCE/LIMIT, not money. */
const BALANCE_LOOKBACK = /\b(?:bal|balance|lmt|limit|due|outstanding)\s*[:\-]?\s*$/;
/** Look-back that marks a bare 4-digit number as a YEAR. */
const YEAR_LOOKBACK = /\b(?:in|since|during|fy|year|yr|of|by)\s*$/;

function scaleMultiplier(scale: string): number {
  const s = scale.toLowerCase();
  if (s === 'k') return 1_000;
  if (s === 'm' || s === 'mn') return 1_000_000;
  if (s === 'l' || s.indexOf('lakh') === 0 || s.indexOf('lac') === 0) return 100_000;
  if (s === 'cr' || s.indexOf('crore') === 0) return 10_000_000;
  return 1;
}

/** Blank out date and clock substrings (index-preserving) so they never yield amounts. */
function maskDatesAndTimes(t: string): string {
  const blank = (m: string) => new Array(m.length + 1).join(' ');
  return t
    .replace(/\b\d{1,4}[-/]\d{1,2}(?:[-/]\d{2,4})?\b/g, blank)
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, blank);
}

interface AmountHit { value: number; index: number; marked: boolean }

function amountCandidates(t: string): AmountHit[] {
  const scanned = maskDatesAndTimes(t);
  const hits: AmountHit[] = [];
  AMOUNT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = AMOUNT_RE.exec(scanned)) !== null) {
    if (m[0].length === 0) { AMOUNT_RE.lastIndex += 1; continue; }
    const digits = m[2];
    if (!digits) continue;
    const before = t.slice(Math.max(0, m.index - 24), m.index);
    if (IDENTIFIER_LOOKBACK.test(before)) continue;
    if (BALANCE_LOOKBACK.test(before)) continue;

    const scale = m[3] || '';
    const currency = m[1] || '';
    const bare4 = /^\d{4}$/.test(digits);
    const base = Number(digits.replace(/,/g, ''));
    if (!isFinite(base) || base <= 0) continue;
    // A bare 4-digit number in year range, with year context and no money marker.
    if (bare4 && !scale && !currency && base >= 1900 && base <= 2100 && YEAR_LOOKBACK.test(before)) continue;

    const value = Math.round(base * scaleMultiplier(scale) * 100) / 100;
    if (!(value > 0)) continue;
    hits.push({ value, index: m.index, marked: Boolean(currency || scale) });
  }
  return hits;
}

/**
 * The transaction amount, or undefined. Handles `1.2k`, `2 lakh`, `1.5cr`, `₹850`,
 * `Rs.850` and Indian grouping (`1,23,456.78`). Never invents a number.
 */
export function parseGrammarAmount(text: string): number | undefined {
  const hits = amountCandidates(normaliseGrammarText(text));
  if (hits.length === 0) return undefined;
  const marked = hits.filter(h => h.marked);
  return (marked.length > 0 ? marked[0] : hits[0]).value;
}

// ═══════════════════════════════════════════════════════════════════════════
//  [5] currency / category / accounts
// ═══════════════════════════════════════════════════════════════════════════

/** Only ever from an EXPLICIT symbol or code — never guessed from a locale. */
function detectCurrency(t: string): string | undefined {
  if (/₹|\b(?:inr|rs|rupees?)\b/.test(t)) return 'INR';
  if (/€|\beur\b/.test(t)) return 'EUR';
  if (/£|\bgbp\b/.test(t)) return 'GBP';
  if (/\$|\busd\b/.test(t)) return 'USD';
  const code = /\b(aed|sgd|aud|cad|jpy|chf|nzd)\b/.exec(t)?.[1];
  return code ? code.toUpperCase() : undefined;
}

function matchCategoryAt(t: string): { id: string; index: number } | undefined {
  for (const kw of CATEGORY_KEYS) {
    const m = new RegExp(`\\b${escapeRe(kw)}\\b`).exec(t);
    if (m) return { id: CATEGORY_MAP[kw], index: m.index };
  }
  return undefined;
}

/** keyword → category id (longest keyword wins), or undefined. */
export function matchCategoryId(text: string): string | undefined {
  return matchCategoryAt(normaliseGrammarText(text))?.id;
}

function cleanAlias(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const w = raw.replace(/[.,;:]+$/, '');
  if (w.length < 2) return undefined;
  if (NOT_AN_ALIAS.has(w)) return undefined;
  if (/^\d+$/.test(w)) return undefined;
  return w;
}

function kindAlias(t: string): string | undefined {
  for (const [re, alias] of KIND_ALIASES) if (re.test(t)) return alias;
  return undefined;
}

/** The bare token trailing the category (`850 groceries hdfc` → `hdfc`). */
function trailingAlias(t: string, categoryIndex: number): string | undefined {
  if (categoryIndex < 0) return undefined;
  const re = /\b[a-z][a-z0-9&._-]*/g;
  const toks: Array<{ w: string; at: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) toks.push({ w: m[0], at: m.index });
  for (let i = toks.length - 1; i >= 0; i--) {
    if (toks[i].at <= categoryIndex) break;
    const alias = cleanAlias(toks[i].w);
    if (alias) return alias;
  }
  return undefined;
}

/** 4-digit masked tail, e.g. `a/c xx4471` → '4471'. */
function accountMask(t: string): string | undefined {
  const m = /\b(?:a\/c|ac|acct|account|card)\b[^a-z0-9]{0,6}(?:no\.?|ending)?[^a-z0-9]{0,4}[x*]{0,6}(\d{4})\b/.exec(t)
    || /\b[x*]{2,}(\d{4})\b/.exec(t);
  return m ? m[1] : undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
//  [6] polarity / type
// ═══════════════════════════════════════════════════════════════════════════

const indexOfMatch = (re: RegExp, t: string): number => {
  const m = re.exec(t);
  return m ? m.index : -1;
};

interface Polarity { type: TxnType; direction?: Direction; explicit: boolean }

function detectPolarity(t: string, categoryId: string | undefined, bothSlots: boolean): Polarity {
  if (INVESTMENT_RE.test(t)) return { type: 'investment', explicit: true };
  if (TRANSFER_RE.test(t)) return { type: 'transfer', explicit: true };

  const deb = indexOfMatch(DEBIT_RE, t);
  const cre = indexOfMatch(CREDIT_RE, t);
  if (deb >= 0 && cre >= 0) {
    // Both polarities present — pick the type from the leading verb but leave
    // `direction` UNSET. Guessing here is exactly what §3.5 'polarity' asks about.
    return { type: deb < cre ? 'expense' : 'income', explicit: true };
  }

  const sign = /^\s*([+-])\s*\d/.exec(t)?.[1];
  if (cre >= 0 || sign === '+') return { type: 'income', direction: 'credit', explicit: true };
  if (deb >= 0 || sign === '-') return { type: 'expense', direction: 'debit', explicit: true };

  // "5000 from hdfc to icici" — two of the user's own accounts, no verb, no category.
  if (bothSlots && !categoryId) return { type: 'transfer', explicit: false };
  // An income-only category with no verb ("50000 salary") is income, but the
  // polarity was never STATED, so direction stays undefined.
  if (categoryId && INCOME_IDS.has(categoryId)) return { type: 'income', explicit: false };
  return { type: 'expense', explicit: false };
}

// ═══════════════════════════════════════════════════════════════════════════
//  extractByGrammar
// ═══════════════════════════════════════════════════════════════════════════

function decline(reason: NonNullable<ExtractionResult['reason']>): ExtractionResult {
  return { ok: false, candidate: {}, extractor: 'grammar', confidence: 0, reason };
}

/**
 * Deterministic, zero-cost extraction from human-typed shorthand.
 *
 * Returns `ok: false` — deliberately, so the cascade falls through — for a bank
 * SMS, a query, or any text with no recoverable amount. It NEVER invents an
 * amount and never treats a year, a 4-digit account tail or a reference number
 * as one.
 */
export function extractByGrammar(text: string): ExtractionResult {
  const raw = typeof text === 'string' ? text : '';
  const t = normaliseGrammarText(raw);
  if (!t) return decline('not_parseable');
  // Order matters: a bank SMS contains balance/limit words that would otherwise
  // read as a query, and the cascade needs 'not_parseable' to reach the LLM.
  if (looksLikeBankSms(t)) return decline('not_parseable');
  if (isQueryText(t)) return decline('query');

  const hits = amountCandidates(t);
  if (hits.length === 0) return decline('no_amount');
  const markedHits = hits.filter(h => h.marked);
  const amount = (markedHits.length > 0 ? markedHits[0] : hits[0]).value;

  const cat = matchCategoryAt(t);
  const fromSlot = cleanAlias(FROM_RE.exec(t)?.[1]);
  const toSlot = cleanAlias(TO_RE.exec(t)?.[1]);
  const kind = kindAlias(t);
  const trailing = trailingAlias(t, cat ? cat.index : -1);
  const mask = accountMask(t);

  const polarity = detectPolarity(t, cat?.id, Boolean(fromSlot && toSlot));
  const neutral = polarity.type === 'transfer' || polarity.type === 'investment';

  const candidate: ExtractionCandidate = {
    amount,
    transaction_type: polarity.type,
    description: raw.trim().slice(0, 280),
  };
  if (polarity.direction) candidate.direction = polarity.direction;

  const currency = detectCurrency(t);
  if (currency) candidate.currency = currency;
  if (mask) candidate.accountMask = mask;

  if (neutral) {
    // Money model: a transfer/investment is ONE spend/income-neutral row — both
    // account FKs, NO category. Never a category here, ever.
    candidate.category_id = null;
    const dest = toSlot ?? trailing ?? (fromSlot ? undefined : kind);
    const source = fromSlot ?? (dest && kind !== dest ? kind : undefined) ?? DEFAULT_TRANSFER_SOURCE;
    candidate.account_alias = source;
    candidate.to_account_alias = dest && dest !== source ? dest : null;
  } else {
    // Category is clamped to the id set valid for this type; a mismatch is
    // dropped rather than coerced, so the resolver can ask instead of guessing.
    if (cat) {
      const valid = polarity.type === 'income' ? INCOME_IDS.has(cat.id) : EXPENSE_IDS.has(cat.id);
      if (valid) candidate.category_id = cat.id;
    }
    const alias = fromSlot ?? kind ?? trailing;
    if (alias) candidate.account_alias = alias;
    const merchant = cleanAlias(AT_RE.exec(t)?.[1]) ?? (polarity.type === 'expense' ? toSlot : undefined);
    if (merchant && merchant !== alias) candidate.merchant = merchant;
  }

  return {
    ok: true,
    candidate,
    extractor: 'grammar',
    confidence: polarity.explicit ? GRAMMAR_CONFIDENCE.explicit : GRAMMAR_CONFIDENCE.implicit,
  };
}
