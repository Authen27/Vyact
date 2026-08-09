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
  'food_dining', 'groceries', 'transport', 'rent_mortgage', 'utilities', 'shopping',
  'health', 'entertainment', 'education', 'travel', 'childcare', 'insurance',
  'loan_emi', 'other_expense',
]);
export const INCOME_IDS = new Set([
  'salary', 'freelance', 'gift_bonus', 'rental_income', 'business_revenue', 'other_income',
]);

export type TxnType = 'expense' | 'income' | 'transfer' | 'investment';

export interface ParsedTx {
  amount: number;
  currency: string;
  transaction_type: TxnType;
  category_id: string | null;      // null for transfer/investment (v9 CHECK)
  account_alias: string;           // source (expense/transfer/investment) or dest (income); RPC resolves
  to_account_alias: string | null; // dest for transfer/investment
  description: string;             // original text, for the txn description + audit
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
export function parseAmount(text: string): number | undefined {
  const t = text
    .replace(/[$£€₹]/g, ' ')
    .replace(/\b(rs|inr|usd|gbp|eur|bucks?|rupees?|dollars?|quid)\b/gi, ' ');
  const m = t.match(/(\d[\d,]*\.?\d*)\s*(k|lakhs?|lacs?|l|cr|crores?|m|mn)?\b/i);
  if (!m) return undefined;
  const base = Number(m[1].replace(/,/g, ''));
  if (!isFinite(base)) return undefined;
  const scale = (m[2] || '').toLowerCase();
  let mult = 1;
  if (scale === 'k') mult = 1_000;
  else if (scale === 'm' || scale === 'mn') mult = 1_000_000;
  else if (scale === 'l' || scale.startsWith('lakh') || scale.startsWith('lac')) mult = 100_000;
  else if (scale === 'cr' || scale.startsWith('crore')) mult = 10_000_000;
  const value = base * mult;
  return value > 0 ? Math.round(value * 100) / 100 : undefined;
}

// ── keyword → category id (ported; longest keyword wins) ──────────────────────
const KEYWORD_MAP: Record<string, string> = {
  coffee: 'food_dining', lunch: 'food_dining', dinner: 'food_dining', breakfast: 'food_dining',
  restaurant: 'food_dining', dining: 'food_dining', food: 'food_dining', eat: 'food_dining',
  'eating out': 'food_dining', starbucks: 'food_dining', mcdonalds: 'food_dining',
  swiggy: 'food_dining', zomato: 'food_dining', takeaway: 'food_dining',
  groceries: 'groceries', grocery: 'groceries', supermarket: 'groceries',
  fuel: 'transport', petrol: 'transport', gas: 'transport', uber: 'transport', taxi: 'transport',
  cab: 'transport', ola: 'transport', train: 'transport', bus: 'transport', parking: 'transport',
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

/** Hard-block detector: a request to READ data (never answered over chat). */
export function isQueryAttempt(text: string): boolean {
  return /\b(how much|how many|what'?s|what is|balance|net worth|networth|left|remaining|owe|owed|statement|summary|report|show me|list|history|total)\b/.test(text)
    && !/^\s*[+\-]?\s*\d/.test(text);   // "how much..." but NOT a leading amount like "1200 lunch"
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

/** Parse a WhatsApp line into a structured transaction, or a reason to clarify. */
export function parseWhatsAppMessage(
  raw: string,
  accounts: AccountLite[] = [],
  baseCurrency = 'USD',
): ParseResult {
  const norm = normalise(raw);
  if (!norm) return { ok: false, reason: 'empty' };
  if (isQueryAttempt(norm)) return { ok: false, reason: 'query' };

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
