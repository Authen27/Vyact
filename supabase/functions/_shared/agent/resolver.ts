// Vyact Agent — entity resolver (vyact-agent-architecture.md §3.1 stage 5, §3.5).
//
// Takes a raw ExtractionCandidate (loose strings straight off an extractor) plus
// household context, and resolves it to REAL app entities: accounts, category,
// household, currency, and the actual — frequently BACKDATED — date.
//
// THE WHOLE POINT: it never guesses when the input is genuinely ambiguous. It
// reports the conflict, with concrete option patches, and lets stage 6 turn
// those into a question. A silent pick here is a silently-misfiled transaction
// that the user will never notice.
//
// Three rules this module exists to enforce:
//   1. NO DEFAULT DATE. A missing date stays undefined. A bank SMS forwarded on
//      Monday about Friday's spend must not be booked on Monday, and "today" is
//      the caller's decision to make explicitly, not ours to make silently.
//   2. NO ARBITRATION BETWEEN EQUAL MATCHES. Two accounts match "hdfc"? Both are
//      reported. Picking the first would be a coin flip on the user's money.
//   3. HOUSEHOLD IS ALWAYS ASKED when there is more than one (locked product
//      decision §3.5) — business vs personal spend must never be inferred.
//
// It resolves IDENTIFIERS ONLY. It never reads, computes, scales or writes an
// amount; `candidate.amount` passes through untouched by construction.
//
// All candidate text (alias, merchant, description) is UNTRUSTED INPUT. It is
// only ever pattern-matched against, never interpreted as instruction.
//
// PURE — no network, no Deno/browser globals, no react/src imports. Compiles and
// runs under both Deno (edge) and vitest.

import {
  EXPENSE_IDS,
  INCOME_IDS,
  KNOWN_CURRENCIES,
  type AccountLite,
  type AmbiguityOption,
  type ExtractionCandidate,
  type ResolutionConflict,
  type TxnType,
} from './types.ts';

// ── the pinned seam (stage 5 consumes these shapes verbatim) ─────────────────
// `ResolutionConflict` now lives in types.ts — one definition shared with the
// ambiguity engine. Re-exported here so existing importers keep working.
export type { ResolutionConflict } from './types.ts';

export interface ResolveContext {
  accounts: AccountLite[];
  households: { id: string; name: string }[];
  baseCurrency: string;
  /** Injected, never `new Date()` internally — resolution must be deterministic. */
  now: Date;
}

export interface ResolveOutput {
  /** A NEW candidate — the input is never mutated. */
  candidate: ExtractionCandidate;
  /** Stable order: account · to_account · date · currency · category · household. */
  conflicts: ResolutionConflict[];
}

/**
 * Household options carry their answer in `patch.household_id` like every other
 * field, so applying an answer is a pure merge. The `id` stays namespaced purely
 * to keep option ids unique and stable across a turn (a household name can
 * collide with an account name); `householdIdFromOption` reads it back when a
 * caller has the option but not the patch.
 */
export const HOUSEHOLD_OPTION_PREFIX = 'household:';

export function householdIdFromOption(option: AmbiguityOption): string | undefined {
  return option.id.startsWith(HOUSEHOLD_OPTION_PREFIX)
    ? option.id.slice(HOUSEHOLD_OPTION_PREFIX.length)
    : undefined;
}

// ── small pure helpers ───────────────────────────────────────────────────────

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Trim, and treat '' / null / undefined identically as "absent". */
function present(v: string | null | undefined): string | undefined {
  const t = (v ?? '').trim();
  return t.length > 0 ? t : undefined;
}

/** Lowercase + collapse whitespace. The comparison key for names and aliases. */
function normKey(s: string): string {
  return (s || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}

function tokens(s: string): string[] {
  return s.split(/[^a-z0-9]+/i).filter(Boolean);
}

// ── accounts ─────────────────────────────────────────────────────────────────

/**
 * Case-insensitive alias → accounts. Two tiers, deliberately:
 *
 *   1. EXACT full-name equality wins outright and returns ONLY the exact hits.
 *      Without this tier a household holding "HDFC" and "HDFC Credit" could
 *      never resolve either — answering the ambiguity with the full name would
 *      re-trigger the same ambiguity forever. Tier 1 makes an option patch a
 *      fixed point (merge → re-resolve → clean), which the pure-merge contract
 *      requires.
 *   2. Otherwise token-containment / substring, both directions ("hdfc" →
 *      "HDFC Savings"; "icici sapphiro card" → "ICICI Sapphiro").
 *
 * Returns EVERY match. Choosing among them is not this function's job.
 */
export function matchAccountsByAlias(alias: string, accounts: AccountLite[]): AccountLite[] {
  const needle = normKey(alias);
  if (!needle) return [];

  const exact = accounts.filter(a => normKey(a.name) === needle);
  if (exact.length > 0) return exact;

  const needleTokens = tokens(needle);
  const out: AccountLite[] = [];
  for (const a of accounts) {
    const name = normKey(a.name);
    if (!name) continue;
    const nameTokens = tokens(name);

    // "hdfc" ⊆ "hdfc savings"
    const aliasTokensInName =
      needleTokens.length > 0 && needleTokens.every(t => nameTokens.includes(t));
    // "icici sapphiro card" ⊇ "icici sapphiro"
    const nameTokensInAlias =
      nameTokens.length > 0 && nameTokens.every(t => needleTokens.includes(t));
    // "hdfc" inside "hdfcbank" — 3-char floor so "ic" can't sweep the list.
    const aliasInsideName = needle.length >= 3 && name.includes(needle);
    // The name as a WHOLE WORD inside a longer alias — word-bounded so the
    // account "Cash" does not match the merchant alias "cashew traders".
    const nameWordInAlias = new RegExp(`\\b${escapeRe(name)}\\b`).test(needle);

    if (aliasTokensInName || nameTokensInAlias || aliasInsideName || nameWordInAlias) {
      out.push(a);
    }
  }
  return out;
}

interface AccountResolution {
  account?: AccountLite;
  /** Set when we could NOT land on exactly one account. */
  conflict?: { reason: string; matches: AccountLite[] };
}

/**
 * mask first (a masked tail from a bank SMS is the strongest signal we get),
 * then alias. Never falls back to "the first account" or "cash".
 */
function resolveAccountRef(
  mask: string | undefined,
  alias: string | undefined,
  accounts: AccountLite[],
): AccountResolution {
  if (mask) {
    const byMask = accounts.filter(a => present(a.maskLast4) === mask);
    if (byMask.length === 1) return { account: byMask[0] };
    if (byMask.length > 1) {
      return {
        conflict: {
          reason: `More than one account ends in ${mask}.`,
          matches: byMask,
        },
      };
    }
    // Mask matched nothing (an account the user has not added yet, or a typo).
    // Fall through to the alias — but say both parts in the reason.
  }

  if (alias) {
    const byAlias = matchAccountsByAlias(alias, accounts);
    if (byAlias.length === 1) return { account: byAlias[0] };
    if (byAlias.length > 1) {
      return {
        conflict: {
          reason: `"${alias}" matches ${byAlias.length} accounts.`,
          matches: byAlias,
        },
      };
    }
    return {
      conflict: {
        reason: mask
          ? `No account ends in ${mask}, and "${alias}" matches no account.`
          : `No account matches "${alias}".`,
        // Deliberately empty: enumerating the whole list tells the user nothing
        // about why their alias failed. The caller asks with its own copy.
        matches: [],
      },
    };
  }

  if (mask) {
    return { conflict: { reason: `No account ends in ${mask}.`, matches: [] } };
  }

  // Nothing was said at all. HERE the full list IS the useful option set —
  // there is no failed guess to explain, only a missing choice to make.
  return { conflict: { reason: 'No account was named.', matches: accounts } };
}

function accountLabel(a: AccountLite): string {
  const mask = present(a.maskLast4);
  return mask ? `${a.name} ••${mask}` : a.name;
}

function accountOptions(
  field: 'account' | 'to_account',
  matches: AccountLite[],
): AmbiguityOption[] {
  return matches.map(a => ({
    id: `${field}:${normKey(a.name)}`,
    label: accountLabel(a),
    // A full resolution of the field: the alias AND the mask, so merging cannot
    // leave a stale/unmatched mask behind to re-trigger the same conflict.
    patch: field === 'account'
      ? { account_alias: a.name, accountMask: present(a.maskLast4) }
      : { to_account_alias: a.name },
  }));
}

// ── dates ────────────────────────────────────────────────────────────────────
//
// INDIAN CONVENTION IS ABSOLUTE: a bare numeric pair is DD-MM, never MM-DD.
// `03-04` is 3 April. There is no locale switch and there must not be one — a
// silent MM-DD reading misfiles a third of the year's transactions by months.

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** ISO yyyy-mm-dd, or undefined if (y,m,d) is not a real calendar date. */
function buildIso(y: number, m: number, d: number): string | undefined {
  if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return undefined;
  if (y < 1900 || y > 2999 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Round-trip rejects 31-04, 29-02 in a non-leap year, etc.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return undefined;
  }
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function isoOfUtcDay(date: Date, dayOffset = 0): string {
  const dt = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + dayOffset,
  ));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Compare two ISO day strings — lexicographic works for zero-padded ISO. */
function notAfter(iso: string, todayIso: string): boolean {
  return iso <= todayIso;
}

/**
 * A day+month with NO year. Resolve to the most recent such date that is not in
 * the future: `14-08` seen on 2026-01-02 is 2025-08-14, not 2026-08-14. A bank
 * SMS that crossed a new year must not land eleven months ahead.
 */
function inferYear(day: number, month: number, now: Date): string | undefined {
  const todayIso = isoOfUtcDay(now);
  const thisYear = now.getUTCFullYear();
  const current = buildIso(thisYear, month, day);
  if (current && notAfter(current, todayIso)) return current;
  const previous = buildIso(thisYear - 1, month, day);
  if (previous && notAfter(previous, todayIso)) return previous;
  return undefined;
}

/**
 * Parse the loose date string an extractor produced into ISO yyyy-mm-dd.
 * Accepts: `today` · `yesterday` · `2026-08-14` · `14-08-2025` · `14/08/25` ·
 * `14-Aug-25` · `14 Aug` · `14-08`. Returns undefined when it cannot be read —
 * NEVER a fallback to today.
 */
export function parseLooseDate(raw: string | undefined, now: Date): string | undefined {
  let t = normKey(raw ?? '');
  if (!t) return undefined;
  t = t.replace(/^(?:on|dated|dt)\s+/, '').replace(/[.,;]+$/, '').trim();
  if (!t) return undefined;

  if (t === 'today') return isoOfUtcDay(now);
  if (t === 'yesterday') return isoOfUtcDay(now, -1);

  // yyyy-mm-dd (already ISO, or ISO-ish with / or .)
  let m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return buildIso(Number(m[1]), Number(m[2]), Number(m[3]));

  // dd-mm-yy | dd-mm-yyyy  — DD FIRST, ALWAYS.
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) {
    const yy = m[3];
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    return buildIso(year, Number(m[2]), Number(m[1]));
  }

  // dd-mmm-yy | dd mmm yyyy
  m = t.match(/^(\d{1,2})[-/. ]([a-z]{3,9})[-/. ](\d{2}|\d{4})$/);
  if (m) {
    const month = MONTH_NAMES[m[2]];
    if (!month) return undefined;
    const yy = m[3];
    const year = yy.length === 2 ? 2000 + Number(yy) : Number(yy);
    return buildIso(year, month, Number(m[1]));
  }

  // dd mmm (no year) → same not-in-the-future inference as dd-mm
  m = t.match(/^(\d{1,2})[-/. ]([a-z]{3,9})$/);
  if (m) {
    const month = MONTH_NAMES[m[2]];
    if (!month) return undefined;
    return inferYear(Number(m[1]), month, now);
  }

  // dd-mm (no year)
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) return inferYear(Number(m[1]), Number(m[2]), now);

  return undefined;
}

// ── currency ─────────────────────────────────────────────────────────────────

/** Symbols and colloquial forms → ISO code. Codes are validated separately. */
const CURRENCY_ALIASES: Record<string, string> = {
  '₹': 'INR', '₨': 'INR', 'rs': 'INR', 'rs.': 'INR', 'inr': 'INR',
  'rupee': 'INR', 'rupees': 'INR',
  '$': 'USD', 'us$': 'USD', 'usd': 'USD', 'dollar': 'USD', 'dollars': 'USD',
  '€': 'EUR', 'eur': 'EUR', 'euro': 'EUR', 'euros': 'EUR',
  '£': 'GBP', 'gbp': 'GBP', 'pound': 'GBP', 'pounds': 'GBP',
  'a$': 'AUD', 'aud': 'AUD', 'c$': 'CAD', 'cad': 'CAD', 's$': 'SGD', 'sgd': 'SGD',
  'aed': 'AED', 'dhs': 'AED', 'dirham': 'AED', 'dirhams': 'AED',
  '¥': 'JPY', 'jpy': 'JPY', 'yen': 'JPY',
  'chf': 'CHF', 'nzd': 'NZD', 'nz$': 'NZD',
};

/**
 * `₹` / `Rs.` / `INR` → 'INR'. Returns undefined for anything not in
 * KNOWN_CURRENCIES — the caller keeps the raw text and asks, rather than
 * quietly booking a foreign amount as base currency.
 *
 * NOTE `$` maps to USD. That is a real, accepted lossiness: A$/C$/S$ are only
 * distinguished when the source wrote the prefix.
 */
export function normaliseCurrencyCode(raw: string | undefined): string | undefined {
  const t = normKey(raw ?? '').replace(/\s+/g, '');
  if (!t) return undefined;
  const alias = CURRENCY_ALIASES[t] ?? CURRENCY_ALIASES[t.replace(/\.$/, '')];
  if (alias) return alias;
  const up = t.toUpperCase();
  return KNOWN_CURRENCIES.has(up) ? up : undefined;
}

// ── categories ───────────────────────────────────────────────────────────────
//
// Same keyword vocabulary as the WhatsApp parser, but with two deliberate
// differences: matching is TYPE-SCOPED before anything else (an expense can
// never land on `salary`), and a tie between two DIFFERENT categories is a
// conflict rather than a first-wins pick. There is no `other_expense` fallback
// here — category is optional on a candidate, so "no confident match" means
// leave it undefined, not invent a bucket.

const KEYWORD_MAP: Record<string, string> = {
  coffee: 'food_dining', lunch: 'food_dining', dinner: 'food_dining', breakfast: 'food_dining',
  restaurant: 'food_dining', dining: 'food_dining', food: 'food_dining',
  'eating out': 'food_dining', starbucks: 'food_dining', mcdonalds: 'food_dining',
  swiggy: 'food_dining', zomato: 'food_dining', takeaway: 'food_dining', cafe: 'food_dining',
  groceries: 'groceries', grocery: 'groceries', supermarket: 'groceries',
  bigbasket: 'groceries', dmart: 'groceries', blinkit: 'groceries', zepto: 'groceries',
  fuel: 'travel', petrol: 'travel', diesel: 'travel', uber: 'travel',
  taxi: 'travel', cab: 'travel', ola: 'travel', train: 'travel',
  bus: 'travel', parking: 'travel', metro: 'travel', irctc: 'travel',
  amazon: 'shopping', shopping: 'shopping', clothes: 'shopping', shoes: 'shopping',
  flipkart: 'shopping', myntra: 'shopping', ikea: 'shopping',
  netflix: 'entertainment', spotify: 'entertainment', movie: 'entertainment',
  cinema: 'entertainment', pvr: 'entertainment', subscription: 'entertainment',
  pharmacy: 'health', doctor: 'health', gym: 'health', medicine: 'health',
  dentist: 'health', hospital: 'health', apollo: 'health', clinic: 'health',
  electricity: 'utilities', water: 'utilities', internet: 'utilities',
  broadband: 'utilities', wifi: 'utilities', airtel: 'utilities', jio: 'utilities',
  rent: 'rent_mortgage', mortgage: 'rent_mortgage', landlord: 'rent_mortgage',
  emi: 'loan_emi', 'loan payment': 'loan_emi', loan: 'loan_emi',
  school: 'education', course: 'education', tuition: 'education', college: 'education',
  childcare: 'childcare', daycare: 'childcare', nanny: 'childcare', creche: 'childcare',
  flight: 'travel', hotel: 'travel', airbnb: 'travel', holiday: 'travel',
  vacation: 'travel', indigo: 'travel',
  insurance: 'insurance', premium: 'insurance', policy: 'insurance',
  salary: 'salary', payroll: 'salary', payday: 'salary', wages: 'salary',
  freelance: 'freelance', consulting: 'freelance', invoice: 'freelance',
  bonus: 'gift_bonus', gift: 'gift_bonus', inheritance: 'gift_bonus',
  'rental income': 'rental_income', tenant: 'rental_income',
  dividend: 'business_revenue', 'business revenue': 'business_revenue',
  refund: 'other_income', cashback: 'other_income', reimbursement: 'other_income',
};

const KEYWORDS_BY_LEN = Object.keys(KEYWORD_MAP).sort((a, b) => b.length - a.length);

/** Presentation-only labels for the question text. Not an app constant mirror. */
const CATEGORY_LABELS: Record<string, string> = {
  food_dining: 'Food & Dining', groceries: 'Groceries', transport: 'Transport',
  rent_mortgage: 'Rent / Mortgage', utilities: 'Utilities', shopping: 'Shopping',
  health: 'Health', entertainment: 'Entertainment', education: 'Education',
  travel: 'Travel', childcare: 'Childcare', insurance: 'Insurance',
  loan_emi: 'Loan / EMI', other_expense: 'Other expense',
  salary: 'Salary', freelance: 'Freelance', gift_bonus: 'Gift / Bonus',
  rental_income: 'Rental income', business_revenue: 'Business revenue',
  other_income: 'Other income',
};

function categoryLabel(id: string): string {
  return CATEGORY_LABELS[id] ?? id.replace(/_/g, ' ');
}

/**
 * Keyword/merchant text → the tied-best category ids for this transaction type.
 *
 * Longest matched keyword wins (more specific beats more general). Two DIFFERENT
 * categories matching at the same keyword length is a genuine 50/50 and both are
 * returned — the caller turns that into a question.
 */
export function matchCategoryCandidates(text: string, type: 'expense' | 'income'): string[] {
  const allowed = type === 'expense' ? EXPENSE_IDS : INCOME_IDS;
  const hay = normKey(text);
  if (!hay) return [];

  let bestLen = 0;
  const ids: string[] = [];
  for (const kw of KEYWORDS_BY_LEN) {
    const id = KEYWORD_MAP[kw];
    if (!allowed.has(id)) continue;                       // TYPE SCOPE, first gate
    if (kw.length < bestLen) break;                        // sorted desc — done
    if (!new RegExp(`\\b${escapeRe(kw)}\\b`).test(hay)) continue;
    if (kw.length > bestLen) {
      bestLen = kw.length;
      ids.length = 0;
      ids.push(id);
    } else if (!ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

/** expense | income for category purposes, inferring from direction if needed. */
function categoryScope(candidate: ExtractionCandidate): 'expense' | 'income' | undefined {
  const t: TxnType | undefined = candidate.transaction_type;
  if (t === 'expense' || t === 'income') return t;
  if (t === 'transfer' || t === 'investment') return undefined;
  if (candidate.direction === 'debit') return 'expense';
  if (candidate.direction === 'credit') return 'income';
  return undefined;
}

// ── the resolver ─────────────────────────────────────────────────────────────

/**
 * Resolve a raw candidate against household context.
 *
 * Enriches what it can prove and reports everything else as a conflict. The
 * returned candidate is always safe to show the user; it is NOT always safe to
 * write — `conflicts.length === 0` is the write gate, and the caller owns it.
 */
export function resolveCandidate(
  candidate: ExtractionCandidate,
  ctx: ResolveContext,
): ResolveOutput {
  const accounts = ctx.accounts ?? [];
  const households = ctx.households ?? [];
  const out: ExtractionCandidate = { ...candidate };   // never mutate the input
  const conflicts: ResolutionConflict[] = [];

  // ── 1. source account ─────────────────────────────────────────────────────
  const mask = present(candidate.accountMask);
  const alias = present(candidate.account_alias);
  const src = resolveAccountRef(mask, alias, accounts);
  if (src.account) {
    out.account_alias = src.account.name;
    const m = present(src.account.maskLast4);
    if (m) out.accountMask = m;
  } else if (src.conflict) {
    // Keep the raw alias/mask on the candidate so the question can quote it.
    conflicts.push({
      field: 'account',
      reason: src.conflict.reason,
      candidates: accountOptions('account', src.conflict.matches),
    });
  }

  // ── 2. destination account (transfers / investments) ──────────────────────
  const type = candidate.transaction_type;
  const movesBetweenAccounts = type === 'transfer' || type === 'investment';
  const toAlias = present(candidate.to_account_alias);
  if (movesBetweenAccounts || toAlias) {
    // No mask seam exists for the destination — ExtractionCandidate has only the
    // one `accountMask`, and it belongs to the source.
    const dst = resolveAccountRef(undefined, toAlias, accounts);
    if (dst.account) {
      out.to_account_alias = dst.account.name;
    } else if (dst.conflict) {
      conflicts.push({
        field: 'to_account',
        reason: dst.conflict.reason,
        candidates: accountOptions('to_account', dst.conflict.matches),
      });
    }
  }

  // ── 3. date — the one field allowed to stay empty in silence ──────────────
  const rawDate = present(candidate.date);
  if (!rawDate) {
    // DELIBERATE: no date, no conflict, no default. Defaulting to today would
    // misfile every late-arriving bank SMS, and doing it silently would hide
    // that. Whether "today" is acceptable is the caller's call to make loudly.
    delete out.date;
  } else {
    const iso = parseLooseDate(rawDate, ctx.now);
    if (iso) {
      out.date = iso;
    } else {
      conflicts.push({
        field: 'date',
        reason: `Could not read the date "${rawDate}".`,
        candidates: [],
      });
    }
  }

  // ── 4. currency ───────────────────────────────────────────────────────────
  const rawCurrency = present(candidate.currency);
  if (rawCurrency) {
    const code = normaliseCurrencyCode(rawCurrency);
    if (code) {
      out.currency = code;
    } else {
      // Keep the raw value — losing it would erase the evidence of the problem.
      out.currency = rawCurrency;
      const base = normaliseCurrencyCode(ctx.baseCurrency);
      conflicts.push({
        field: 'currency',
        reason: `"${rawCurrency}" is not a supported currency.`,
        candidates: base
          ? [{ id: `currency:${base}`, label: `Use ${base}`, patch: { currency: base } }]
          : [],
      });
    }
  } else {
    const base = normaliseCurrencyCode(ctx.baseCurrency);
    if (base) {
      out.currency = base;
    } else {
      // A household configured with a currency we don't know is a config fault,
      // not a user ambiguity — but it still has to surface rather than default.
      out.currency = present(ctx.baseCurrency) ?? out.currency;
      conflicts.push({
        field: 'currency',
        reason: `The household base currency "${ctx.baseCurrency}" is not supported.`,
        candidates: [],
      });
    }
  }

  // ── 5. category (type-scoped) ─────────────────────────────────────────────
  const scope = categoryScope(candidate);
  if (movesBetweenAccounts) {
    // Money-model invariant: a transfer/investment is ONE spend/income-neutral
    // row with no category (v9 CHECK). An extractor that guessed one is wrong.
    out.category_id = null;
  } else if (scope) {
    const allowed = scope === 'expense' ? EXPENSE_IDS : INCOME_IDS;
    const given = present(candidate.category_id ?? undefined);
    if (given && allowed.has(given)) {
      out.category_id = given;                 // already valid for this type
    } else {
      const haystack = [candidate.merchant, candidate.description]
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .join(' ');
      const hits = matchCategoryCandidates(haystack, scope);
      if (hits.length === 1) {
        out.category_id = hits[0];
      } else if (hits.length > 1) {
        delete out.category_id;
        conflicts.push({
          field: 'category',
          reason: `"${haystack}" fits ${hits.map(categoryLabel).join(' and ')} equally.`,
          candidates: hits.map(id => ({
            id: `category:${id}`,
            label: categoryLabel(id),
            patch: { category_id: id },
          })),
        });
      } else {
        // No confident match. Category is optional — leave it undefined and do
        // NOT raise a conflict; asking about every uncategorised coffee would
        // make the agent unusable. An out-of-scope id (e.g. `salary` on an
        // expense) is dropped here rather than carried into a CHECK violation.
        delete out.category_id;
      }
    }
  }

  // ── 6. household — ALWAYS asked when there is more than one (locked) ───────
  if (households.length > 1) {
    conflicts.push({
      field: 'household',
      // No "likely" household exists as far as this module is concerned. Even a
      // 95%-obvious personal spend gets asked: misfiling business vs personal is
      // a tax-visible error the user will not catch months later.
      reason: 'This user has more than one household — which one is this for?',
      candidates: households.map(h => ({
        id: `${HOUSEHOLD_OPTION_PREFIX}${h.id}`,
        label: h.name,
        patch: { household_id: h.id },
      })),
    });
  } else if (households.length === 0) {
    conflicts.push({
      field: 'household',
      reason: 'No household is available for this user.',
      candidates: [],
    });
  }
  // Exactly one household → resolved silently, nothing to record on the candidate.

  return { candidate: out, conflicts };
}
