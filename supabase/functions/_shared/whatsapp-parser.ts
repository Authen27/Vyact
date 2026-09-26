// Vyact WhatsApp — deterministic message parser (MVP; NO AI, NO third-party egress).
//
// Ports the pure extractor from `react/src/lib/askVyactParser.ts` (normalise,
// parseAmount, matchCategory + KEYWORD_MAP) into the Deno edge runtime — kept
// self-contained because edge deploy can't import from `react/src`. Same seam as
// the app's Ask Vyact: deterministic extraction now, a model swap later.
//
// Turns a chat line like `850 groceries hdfc`, `+50000 salary`, or
// `moved 10000 to icici` into a structured transaction the ledger RPC can insert.
// On ambiguity it returns a reason so the caller can send a deterministic
// clarify reply — it never guesses. Queries ("what's my balance") are flagged so
// the caller can hard-block (no financial data leaves over chat).

// ── category id sets — MUST mirror react/src/constants.ts (CATEGORIES_BY_TYPE) ──
export const EXPENSE_IDS = new Set([
  'food_dining', 'groceries', 'rent_mortgage', 'utilities', 'travel',
  'holiday_outstay', 'shopping', 'electronics_decor', 'personal_care', 'health',
  'repairs_maintenance', 'entertainment', 'education', 'childcare',
  'gifts_donations', 'insurance', 'loan_emi', 'other_expense',
]);
export const INCOME_IDS = new Set([
  'salary', 'freelance', 'gift_bonus', 'rental_income', 'business_revenue', 'other_income',
]);

// ── payment modes — MUST mirror react/src/lib/accountsView.ts (PAYMENT_MODE_LABEL)
// and the ck_account_payment_modes / ck_txn_payment_mode CHECKs ──────────────
export const PAYMENT_MODE_IDS = new Set([
  'upi', 'debit_card', 'net_banking', 'cheque', 'auto_debit',
  'swipe', 'upi_on_card', 'online', 'standing_instruction', 'cash',
]);
export const PAYMENT_MODE_LABEL: Record<string, string> = {
  upi: 'UPI', debit_card: 'Debit card', net_banking: 'Net banking', cheque: 'Cheque',
  auto_debit: 'Auto-debit', swipe: 'Swipe / tap', upi_on_card: 'UPI on card',
  online: 'Online', standing_instruction: 'Standing instruction', cash: 'Cash',
};

export type TxnType = 'expense' | 'income' | 'transfer' | 'investment';

export interface ParsedTx {
  amount: number;
  currency: string;
  transaction_type: TxnType;
  category_id: string | null;      // null for transfer/investment (v9 CHECK)
  account_alias: string;           // source (expense/transfer/investment) or dest (income); RPC resolves
  to_account_alias: string | null; // dest for transfer/investment
  description: string;             // original text, for the txn description + audit
  /** How the account was used, when the message says so. The RPC keeps it only
   *  if the paying account lists that mode; null for every investment. */
  payment_mode: string | null;
  /** v10.40.0 — the date the message stated (ISO), or null for "today". Sent as p_date. */
  date: string | null;
}

export interface AccountLite { name: string; kind: string }

export type ParseResult =
  | { ok: true; tx: ParsedTx }
  | { ok: false; reason: 'empty' | 'query' | 'no_amount' };

// ── [1] normalise (ported) ──────────────────────────────────────────────────
export function normalise(raw: string): string {
  return (raw || '')
    .normalize('NFKC')
    .replace(/[‘’“”]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── [2] amount (ported: k / lakh / cr shorthands, grouping commas) ────────────
// v10.39.1 (P8) — ported from askVyactParser.isIdentifierRun; keep the two identical
// (whatsappParser.test.ts pins the pair). A message reading "…Send from 8897882803"
// was logged as an ₹8.9bn expense because the phone number was the first number.
const IDENTIFIER_CUE = /(?:^|[^a-z])(?:phone|mobile|mob|number|no\.?|num|a\/c|acct|account\s+(?:no|number)|upi(?:\s+id)?|ref(?:erence)?(?:\s+no)?|txn\s*id|transaction\s+id|order\s*id|otp|id|card\s+(?:ending(?:\s+in|\s+with)?|no\.?|number)|ending(?:\s+in|\s+with)?|call)\s*[:#.-]?\s*$|(?:x{2,}|\*{2,})$/i;

export function isIdentifierRun(run: string, before: string): boolean {
  if (/^\d+$/.test(run) && run.length >= 10) return true;
  return IDENTIFIER_CUE.test(before.slice(-32));
}

export function parseAmount(text: string): number | undefined {
  const t = text
    .replace(/[$£€₹]/g, ' ')
    .replace(/\b(rs|inr|usd|gbp|eur|bucks?|rupees?|dollars?|quid)\b/gi, ' ');
  const re = /(\d[\d,]*\.?\d*)\s*(k|lakhs?|lacs?|l|cr|crores?|m|mn)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    if (isIdentifierRun(m[1], t.slice(0, m.index))) continue;
    const base = Number(m[1].replace(/,/g, ''));
    if (!isFinite(base)) continue;
    const scale = (m[2] || '').toLowerCase();
    let mult = 1;
    if (scale === 'k') mult = 1_000;
    else if (scale === 'm' || scale === 'mn') mult = 1_000_000;
    else if (scale === 'l' || scale.startsWith('lakh') || scale.startsWith('lac')) mult = 100_000;
    else if (scale === 'cr' || scale.startsWith('crore')) mult = 10_000_000;
    const value = base * mult;
    if (value > 0) return Math.round(value * 100) / 100;
  }
  return undefined;
}

// ── keyword → category id (ported; longest keyword wins) ──────────────────────
const KEYWORD_MAP: Record<string, string> = {
  coffee: 'food_dining', lunch: 'food_dining', dinner: 'food_dining', breakfast: 'food_dining',
  restaurant: 'food_dining', dining: 'food_dining', food: 'food_dining', eat: 'food_dining',
  'eating out': 'food_dining', starbucks: 'food_dining', mcdonalds: 'food_dining',
  swiggy: 'food_dining', zomato: 'food_dining', takeaway: 'food_dining',
  groceries: 'groceries', grocery: 'groceries', supermarket: 'groceries',
  fuel: 'travel', petrol: 'travel', gas: 'travel', uber: 'travel', taxi: 'travel',
  cab: 'travel', ola: 'travel', train: 'travel', bus: 'travel', parking: 'travel',
  amazon: 'shopping', shopping: 'shopping', clothes: 'shopping', shoes: 'shopping', flipkart: 'shopping',
  netflix: 'entertainment', spotify: 'entertainment', movie: 'entertainment', cinema: 'entertainment',
  prime: 'entertainment', subscription: 'entertainment', game: 'entertainment',
  pharmacy: 'health', doctor: 'health', gym: 'health', medicine: 'health', dentist: 'health',
  electricity: 'utilities', water: 'utilities', internet: 'utilities', phone: 'utilities',
  bill: 'utilities', bills: 'utilities', wifi: 'utilities', broadband: 'utilities',
  rent: 'rent_mortgage', mortgage: 'rent_mortgage',
  emi: 'loan_emi', 'loan payment': 'loan_emi', loan: 'loan_emi',
  school: 'education', course: 'education', tuition: 'education', books: 'education',
  childcare: 'childcare', daycare: 'childcare', nanny: 'childcare',
  flight: 'travel', hotel: 'travel', trip: 'travel', holiday: 'travel', vacation: 'travel',
  insurance: 'insurance', premium: 'insurance',
  salary: 'salary', paid: 'salary', payday: 'salary', wage: 'salary',
  freelance: 'freelance', client: 'freelance', invoice: 'freelance',
  bonus: 'gift_bonus', gift: 'gift_bonus', refund: 'other_income',
};
const KEYWORDS_BY_LEN = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function matchCategory(text: string): string | undefined {
  for (const kw of KEYWORDS_BY_LEN) {
    if (new RegExp(`\\b${escapeRe(kw)}\\b`).test(text)) return KEYWORD_MAP[kw];
  }
  return undefined;
}

// ── WhatsApp-specific extraction ──────────────────────────────────────────────

/**
 * Hard-block detector: a request to READ data (never answered over chat).
 *
 * v10.40.0 — narrowed. Any line containing "total", "list" or "left" used to be
 * refused unless it began with a digit, so "paid 1200 total groceries" was treated
 * as a question. A line that opens like a question, or ends with "?", is still a
 * question; otherwise a spend/income verb plus an amount means the user is LOGGING.
 */
const AFFORDABILITY_ASK = [
  /\bafford(able|ability)?\b/,
  /\b(can|could|should|shall|may)\s+(i|we)\s+(really\s+)?(buy|spend|get|splurge|go for)\b/,
  /\b(is|would) it\s+(be\s+)?(ok|okay|fine|alright|wise|safe|sensible)\s+(for (me|us)\s+)?to\s+(spend|buy|get)\b/,
  /\b(do|have)\s+(i|we)\s+(got\s+|have\s+)?enough\b/,
  /\b(am i|are we)\s+(able|allowed)\s+to\s+(spend|buy)\b/,
];

/** "Can I afford …", "is it ok to spend …", "do I have enough for …": a question,
 *  wherever it sits in the line and with or without a "?". */
export function isAffordabilityAsk(text: string): boolean {
  return AFFORDABILITY_ASK.some(re => re.test(text));
}

export function isQueryAttempt(text: string): boolean {
  if (isAffordabilityAsk(text)) return true;         // even "5k tea, can I afford it"
  if (/^\s*[+\-]?\s*\d/.test(text)) return false;   // "1200 lunch …" — a leading amount
  // v10.47.0 — a line ending in "?", or "can/should I afford/buy/spend …", is a
  // question even with no data word. "can I afford 40000 for a phone?" used to be
  // LOGGED as a ₹40,000 spend, because "afford" was not a data word.
  // 27 Sep: "Can I afford to spend 5 rupees for tea" (no "?") was logged as ₹5 on
  // production. The ask can sit anywhere in the line ("pip, can I afford…"), and
  // "afford" is never how anyone LOGS a spend.
  if (/\?\s*$/.test(text) || isAffordabilityAsk(text)) return true;
  const asksForData = /\b(how much|how many|what'?s|what is|balance|net worth|networth|left|remaining|owe|owed|statement|summary|report|show me|list|history|total|afford)\b/.test(text);
  if (!asksForData) return false;
  const opensAsQuestion = /^\s*(how|what|which|when|where|why|show|list|tell|give|can|do|did|am|is|are)\b/.test(text) || /\?\s*$/.test(text);
  if (opensAsQuestion) return true;
  const logs = /\b(spent|spend|paid|pay|bought|received|got|credited|debited|moved|transferred|invested|gave|lent)\b/.test(text);
  return !(logs && parseAmount(text) != null);
}

const DATE_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * v10.40.0 — a date the message states, as ISO `YYYY-MM-DD`, plus the text with that
 * date REMOVED. Removing it matters: "15/09/2026 450 lunch" used to log ₹15, because
 * the day was the first number in the line.
 *
 * `today` is the user's local calendar day (the webhook derives it from the message
 * timestamp). Relative words resolve against it; a future or impossible date is
 * ignored rather than guessed, and the RPC still clamps whatever it receives.
 * Ported from askVyactParser.parseDateEntity — keep the formats aligned.
 */
export function extractStatedDate(text: string, today: Date): { date: string | null; rest: string } {
  const iso = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  const day0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const build = (y: number, m: number, d: number): string | null => {
    if (y < 2000 || m < 0 || m > 11 || d < 1 || d > 31) return null;
    const t = Date.UTC(y, m, d);
    const back = new Date(t);
    if (back.getUTCMonth() !== m || back.getUTCDate() !== d) return null;   // 31 Feb
    if (t > day0) return null;                                              // future
    return iso(back);
  };
  const year = (s: string) => (s.length === 2 ? 2000 + Number(s) : Number(s));
  const PATTERNS: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/\byesterday\b/, () => iso(new Date(day0 - 86_400_000))],
    [/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/, m => build(Number(m[1]), Number(m[2]) - 1, Number(m[3]))],
    // Year is 2 or 4 digits only, so "15 sep 450 lunch" never reads 450 as a year.
    [/\b(\d{1,2})[-/ ]([a-z]{3,9})[-/ ](\d{4}|\d{2})\b/, m => {
      const mi = DATE_MONTHS.indexOf(m[2].slice(0, 3));
      return mi < 0 ? null : build(year(m[3]), mi, Number(m[1]));
    }],
    [/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})\b/, m => build(year(m[3]), Number(m[2]) - 1, Number(m[1]))],
    // "on 15 sep" — no year: the most recent such day that is not in the future.
    [/\bon (\d{1,2})(?:st|nd|rd|th)? ([a-z]{3,9})\b/, m => {
      const mi = DATE_MONTHS.indexOf(m[2].slice(0, 3));
      if (mi < 0) return null;
      const y = today.getUTCFullYear();
      return build(y, mi, Number(m[1])) ?? build(y - 1, mi, Number(m[1]));
    }],
  ];
  for (const [re, toIso] of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    const date = toIso(m);
    const rest = text.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
    // An unusable date is still removed from the amount search — it was a date.
    return { date, rest };
  }
  return { date: null, rest: text };
}

function detectCurrency(text: string, base: string): string {
  if (/₹|\b(inr|rs|rupees?)\b/i.test(text)) return 'INR';
  if (/€|\beur\b/i.test(text)) return 'EUR';
  if (/£|\bgbp\b/i.test(text)) return 'GBP';
  if (/\$|\busd\b/i.test(text)) return 'USD';
  const code = text.match(/\b([a-z]{3})\b/i)?.[1]?.toUpperCase();
  if (code && ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'JPY'].includes(code)) return code;
  return base || 'USD';
}

/** Ordered account-token matches (by first position in the text). Matches an
 *  account by NAME (preferred) or by kind word (cash/bank/card/credit card/investment). */
function matchedAccounts(text: string, accounts: AccountLite[]): string[] {
  const hits: { alias: string; at: number }[] = [];
  for (const a of accounts) {
    const name = (a.name || '').trim();
    if (name && new RegExp(`\\b${escapeRe(name.toLowerCase())}\\b`).test(text)) {
      hits.push({ alias: name, at: text.indexOf(name.toLowerCase()) });
    }
  }
  const KIND_WORDS: [RegExp, string][] = [
    [/\bcredit card\b/, 'credit_card'], [/\bcard\b/, 'credit_card'],
    [/\bcash\b/, 'cash'], [/\bbank\b/, 'bank'], [/\binvestment\b/, 'investment'],
  ];
  for (const [re, kind] of KIND_WORDS) {
    const m = text.match(re);
    if (m && m.index != null && !hits.some(h => h.alias.toLowerCase() === kind)) {
      hits.push({ alias: kind, at: m.index });
    }
  }
  return hits.sort((x, y) => x.at - y.at).map(h => h.alias);
}

function detectType(text: string, accounts: AccountLite[]): TxnType {
  if (/\b(invest(ed|ing)?|sip|mutual fund|stocks?|shares?|equity)\b/.test(text)) return 'investment';
  if (/\b(transfer|transferred|moved|move)\b/.test(text)) return 'transfer';
  if (/^\s*\+/.test(text) || /\b(salary|received|credited|got paid|deposit(ed)?|refund|reimburse(d|ment)?|payout)\b/.test(text)) {
    return 'income';
  }
  // "X to <account>" with a destination account and no expense verb → transfer.
  if (/\bto\b/.test(text)) {
    const afterTo = text.split(/\bto\b/)[1] ?? '';
    if (matchedAccounts(afterTo, accounts).length > 0 && !/\b(spent|paid|bought|for)\b/.test(text)) {
      return 'transfer';
    }
  }
  return 'expense';
}

/** The payment mode a message names, or null. Ordered most-specific first, so
 *  "upi on card" is not read as plain UPI and "debit card" is not a swipe. */
const MODE_PATTERNS: [RegExp, string][] = [
  [/\b(upi on (credit )?card|rupay upi|credit card upi)\b/, 'upi_on_card'],
  [/\bdebit card\b/, 'debit_card'],
  [/\b(upi|gpay|google pay|phonepe|phone pe|paytm|bhim)\b/, 'upi'],
  [/\b(net ?banking|neft|imps|rtgs)\b/, 'net_banking'],
  [/\b(cheque|chq)\b/, 'cheque'],
  [/\b(auto[- ]?debit|nach|ecs|mandate)\b/, 'auto_debit'],
  [/\bstanding instruction\b/, 'standing_instruction'],
  [/\bonline\b/, 'online'],
  [/\b(swipe|swiped|tap|tapped|pos)\b/, 'swipe'],
];
export function detectPaymentMode(text: string): string | null {
  for (const [re, mode] of MODE_PATTERNS) if (re.test(text)) return mode;
  return null;
}

/** Parse a WhatsApp line into a structured transaction, or a reason to clarify. */
export function parseWhatsAppMessage(
  raw: string,
  accounts: AccountLite[] = [],
  baseCurrency = 'USD',
  /** The sender's local calendar day, for "yesterday". Defaults to now (UTC). */
  today: Date = new Date(),
): ParseResult {
  const whole = normalise(raw);
  if (!whole) return { ok: false, reason: 'empty' };
  if (isQueryAttempt(whole)) return { ok: false, reason: 'query' };

  // The stated date is taken out BEFORE anything else reads the line, so its digits
  // can never become the amount.
  const { date, rest: norm } = extractStatedDate(whole, today);
  const amount = parseAmount(norm);
  if (amount == null) return { ok: false, reason: 'no_amount' };

  const type = detectType(norm, accounts);
  const currency = detectCurrency(norm, baseCurrency);

  // category — only for expense/income, clamped to the valid id set for that type.
  let category_id: string | null = null;
  if (type === 'expense' || type === 'income') {
    const cat = matchCategory(norm);
    if (type === 'expense') category_id = cat && EXPENSE_IDS.has(cat) ? cat : 'other_expense';
    else category_id = cat && INCOME_IDS.has(cat) ? cat : 'other_income';
  }

  // accounts
  const hits = matchedAccounts(norm, accounts);
  let account_alias = 'cash';
  let to_account_alias: string | null = null;
  if (type === 'transfer' || type === 'investment') {
    // Prefer the destination named after "to"; source = the other hit, else cash.
    const afterTo = norm.split(/\bto\b/)[1] ?? '';
    const dest = matchedAccounts(afterTo, accounts)[0] ?? hits[hits.length - 1] ?? null;
    const src = hits.find(h => h !== dest) ?? 'cash';
    account_alias = src;
    to_account_alias = dest ?? null;
  } else {
    // expense source / income destination → the first named account, else cash.
    account_alias = hits[0] ?? 'cash';
  }

  return {
    ok: true,
    tx: {
      amount,
      currency,
      transaction_type: type,
      category_id,
      account_alias,
      to_account_alias,
      description: (raw || '').trim().slice(0, 280),
      payment_mode: type === 'investment' ? null : detectPaymentMode(norm),
      date,
    },
  };
}

/** The deterministic clarify reply for a given parse failure. */
export function clarifyReply(reason: 'empty' | 'query' | 'no_amount', appUrl: string): string {
  if (reason === 'query') {
    return `For your security, balances and reports live in the app 🔒 Open Vyact: ${appUrl}`;
  }
  return "I couldn't read that. Try: <amount> <category> <account> — e.g. `850 groceries hdfc`, `+50000 salary`, or `moved 10000 to icici`.";
}
