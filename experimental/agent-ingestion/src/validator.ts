// Vyact Agent — extraction validator (vyact-agent-architecture.md §3.4).
//
// THE SAFETY LAYER FOR LLM-FIRST EXTRACTION. NON-NEGOTIABLE.
//
// A model reading a bank SMS can mistake the AVAILABLE BALANCE for the
// transaction amount, invent a number outright, or book a credit as an expense.
// We never trust an extraction — we verify it against the raw source with
// deterministic rules. These guards run on EVERY path (llm | recipe | grammar),
// so a model regression cannot silently corrupt the ledger.
//
// A guard never silently drops a message:
//   severity 'reject'  → cannot proceed; ask the user instead
//   severity 'degrade' → proceed but force confirmation (confidence penalty)
//
// PURE — no network, no globals. Runs under Deno and vitest alike.

import { KNOWN_CURRENCIES, type ExtractionCandidate } from './types.ts';

export type IssueCode =
  | 'amount_missing'
  | 'amount_not_in_source'   // the model invented a number
  | 'amount_is_balance'      // it grabbed "Avl Bal" — the classic failure
  | 'polarity_missing'
  | 'polarity_conflict'
  | 'polarity_contradicts_type'
  | 'date_future'
  | 'date_too_old'
  | 'mask_not_in_source'
  | 'currency_unknown'
  | 'amount_out_of_range';

export interface ValidationIssue {
  code: IssueCode;
  severity: 'reject' | 'degrade';
  detail: string;
}

export interface ValidationResult {
  /** false when ANY issue is a 'reject'. */
  ok: boolean;
  issues: ValidationIssue[];
  /** Subtract from the extractor's confidence. */
  confidencePenalty: number;
  /** True when the result must be confirmed by a human regardless of confidence. */
  mustConfirm: boolean;
}

export interface ValidateOptions {
  /** Defaults to now. Injected so tests are deterministic. */
  now?: Date;
  /** Reject amounts above this (per-household sanity ceiling). */
  maxAmount?: number;
  /** How many months back a transaction date may plausibly be. */
  maxAgeMonths?: number;
}

/** Labels that mark a number as a BALANCE or LIMIT, never a transaction amount. */
const BALANCE_LABELS = [
  'avl bal', 'avl.bal', 'available balance', 'available bal', 'avbl bal', 'avl lmt',
  'available limit', 'avl limit', 'a/c bal', 'ac bal', 'account balance',
  'closing balance', 'closing bal', 'bal', 'balance', 'credit limit', 'cr limit',
  'total due', 'min due', 'minimum due', 'outstanding',
];

// The bare words `debit` and `credit` name an INSTRUMENT at least as often as a
// direction: "bought shoes with my kotak credit card" is a DEBIT. Without this
// lookahead, "credit card" made sourceDirection() return credit, which then
// contradicted the explicit debit verb and REJECTED the extraction — silently
// dropping every spend a user typed against a card. The inflected forms
// (credited/debited) are unambiguous and need no guard.
// `bought`/`buy` were missing, which is the commonest spend verb in English.
// Their absence made sourceDirection() return 'none' for "bought 999 shoes",
// so the extractor's (correct) debit was flagged polarity_missing and the user
// got asked "money in or out?" about a purchase they had just described.
const DEBIT_VERBS =
  /\b(?:debited|debit(?!\s*(?:card|cards|limit|lmt|line))|spent|spend|paid|bought|buy|withdrawn|sent|purchased?|deducted)\b/i;
const CREDIT_VERBS =
  /\b(?:credited|credit(?!\s*(?:card|cards|limit|lmt|line))|received|deposited|refunded?|reversal|cashback)\b/i;

/**
 * Indian scale shorthand. `2 lakh` and `10k` are ordinary phrasing here, not an
 * edge case — this is a finance app used in India.
 */
const SCALE_MULTIPLIERS: Record<string, number> = {
  k: 1_000, m: 1_000_000, mn: 1_000_000,
  l: 100_000, lac: 100_000, lacs: 100_000, lakh: 100_000, lakhs: 100_000,
  cr: 10_000_000, crore: 10_000_000, crores: 10_000_000,
};

/**
 * All numeric literals in the text, normalised (commas stripped) to numbers.
 *
 * Emits BOTH the literal figure and its scaled expansion when a scale word
 * follows it, because the extractor legitimately reports the expanded value:
 * `2 lakh rent` yields an amount of 200000, which appears nowhere in the source
 * as digits. Without the expansion here, `amountAppearsInSource` rejected it as
 * a hallucination and the message was DROPPED — the extractor and the guard
 * disagreeing about what an amount is. Emitting both keeps the guard's real
 * intent (the amount must be derivable from the source) while accepting the way
 * people actually write.
 */
export function numbersInText(text: string): number[] {
  const out: number[] = [];
  const re = /(\d[\d,]*(?:\.\d{1,2})?)\s*([a-z]{1,6})?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || '')) !== null) {
    const n = Number(m[1].replace(/,/g, ''));
    if (!isFinite(n)) continue;
    out.push(n);
    const scale = m[2] ? SCALE_MULTIPLIERS[m[2].toLowerCase()] : undefined;
    if (scale) out.push(n * scale);
  }
  return out;
}

/**
 * Does `amount` actually appear in the source? Tolerates grouping and trailing
 * decimals (850 ≡ 850.00 ≡ "1,23,456.78" → 123456.78). This is what stops a
 * hallucinated figure reaching the ledger.
 */
export function amountAppearsInSource(amount: number, text: string): boolean {
  return numbersInText(text).some(n => Math.abs(n - amount) < 0.005);
}

/**
 * Is the matched amount preceded by a balance/limit label? Looks back a short
 * window from each occurrence — "Avl Bal Rs.12,340" must never be the amount.
 */
export function amountLooksLikeBalance(amount: number, text: string): boolean {
  const hay = (text || '').toLowerCase();
  const re = /\d[\d,]*(?:\.\d{1,2})?/g;
  let m: RegExpExecArray | null;
  let sawOccurrence = false;
  let allAreBalance = true;

  while ((m = re.exec(hay)) !== null) {
    const n = Number(m[0].replace(/,/g, ''));
    if (!isFinite(n) || Math.abs(n - amount) >= 0.005) continue;
    sawOccurrence = true;
    // Window back far enough to cover "Avl Bal Rs." + spacing, short enough not
    // to catch the previous clause.
    const start = Math.max(0, m.index - 32);
    const before = hay.slice(start, m.index);
    const isBalanceHere = BALANCE_LABELS.some(l => before.includes(l));
    if (!isBalanceHere) allAreBalance = false;   // at least one clean occurrence
  }
  return sawOccurrence && allAreBalance;
}

/** Explicit polarity from the source. Never inferred from position alone. */
export function sourceDirection(text: string): 'debit' | 'credit' | 'both' | 'none' {
  const t = text || '';
  const d = DEBIT_VERBS.test(t);
  const c = CREDIT_VERBS.test(t);
  if (d && c) return 'both';
  if (d) return 'debit';
  if (c) return 'credit';
  return 'none';
}

function monthsBetween(a: Date, b: Date): number {
  return Math.abs((b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()));
}

/**
 * Validate an extraction against its raw source.
 * `rawText` is UNTRUSTED input — it is only ever compared against, never executed
 * or interpreted as instruction.
 */
export function validateExtraction(
  candidate: ExtractionCandidate,
  rawText: string,
  opts: ValidateOptions = {},
): ValidationResult {
  const now = opts.now ?? new Date();
  const maxAmount = opts.maxAmount ?? 10_000_000;      // ₹1cr sanity ceiling
  const maxAgeMonths = opts.maxAgeMonths ?? 13;
  const issues: ValidationIssue[] = [];
  const add = (code: IssueCode, severity: 'reject' | 'degrade', detail: string) =>
    issues.push({ code, severity, detail });

  // ── amount ────────────────────────────────────────────────────────────────
  if (candidate.amount == null) {
    add('amount_missing', 'reject', 'No amount extracted.');
  } else if (!(candidate.amount > 0)) {
    add('amount_out_of_range', 'reject', `Amount must be > 0 (got ${candidate.amount}).`);
  } else if (candidate.amount > maxAmount) {
    add('amount_out_of_range', 'degrade', `Amount ${candidate.amount} exceeds the sanity ceiling.`);
  }

  if (candidate.amount != null && rawText) {
    if (!amountAppearsInSource(candidate.amount, rawText)) {
      add('amount_not_in_source', 'reject',
        `Extracted amount ${candidate.amount} does not appear in the source text.`);
    } else if (amountLooksLikeBalance(candidate.amount, rawText)) {
      add('amount_is_balance', 'reject',
        `Amount ${candidate.amount} is labelled as a balance/limit, not a transaction.`);
    }
  }

  // ── polarity ──────────────────────────────────────────────────────────────
  if (rawText) {
    const src = sourceDirection(rawText);
    if (src === 'none' && candidate.direction) {
      add('polarity_missing', 'degrade',
        'Source has no explicit debit/credit verb; direction was inferred.');
    } else if (src === 'both') {
      add('polarity_conflict', 'degrade',
        'Source contains both debit and credit verbs — ask rather than guess.');
    } else if ((src === 'debit' || src === 'credit') && candidate.direction && candidate.direction !== src) {
      add('polarity_contradicts_type', 'reject',
        `Extracted direction '${candidate.direction}' contradicts the source ('${src}').`);
    }
  }
  if (candidate.direction && candidate.transaction_type) {
    const expected = candidate.direction === 'debit' ? 'expense' : 'income';
    if (candidate.transaction_type !== expected
        && candidate.transaction_type !== 'transfer'
        && candidate.transaction_type !== 'investment') {
      add('polarity_contradicts_type', 'reject',
        `direction '${candidate.direction}' implies '${expected}', got '${candidate.transaction_type}'.`);
    }
  }

  // ── date ──────────────────────────────────────────────────────────────────
  if (candidate.date) {
    const d = new Date(`${candidate.date}T00:00:00Z`);
    if (isNaN(d.getTime())) {
      add('date_future', 'degrade', `Unparseable date '${candidate.date}'.`);
    } else {
      // 36h skew tolerance for timezone/clock differences.
      if (d.getTime() > now.getTime() + 36 * 3600 * 1000) {
        add('date_future', 'reject', `Date ${candidate.date} is in the future.`);
      } else if (monthsBetween(d, now) > maxAgeMonths) {
        add('date_too_old', 'degrade', `Date ${candidate.date} is more than ${maxAgeMonths} months old.`);
      }
    }
  }

  // ── account mask ──────────────────────────────────────────────────────────
  if (candidate.accountMask) {
    if (!/^\d{4}$/.test(candidate.accountMask)) {
      add('mask_not_in_source', 'degrade', `Mask '${candidate.accountMask}' is not 4 digits.`);
    } else if (rawText && !rawText.includes(candidate.accountMask)) {
      add('mask_not_in_source', 'degrade',
        `Mask '${candidate.accountMask}' does not appear in the source.`);
    }
  }

  // ── currency ──────────────────────────────────────────────────────────────
  if (candidate.currency && !KNOWN_CURRENCIES.has(candidate.currency.toUpperCase())) {
    add('currency_unknown', 'degrade', `Unknown currency '${candidate.currency}'.`);
  }

  const rejected = issues.some(i => i.severity === 'reject');
  // Each degrade costs 0.15 of confidence; a reject zeroes it out anyway.
  const confidencePenalty = rejected
    ? 1
    : Math.min(0.6, issues.filter(i => i.severity === 'degrade').length * 0.15);

  return {
    ok: !rejected,
    issues,
    confidencePenalty,
    mustConfirm: rejected || issues.length > 0,
  };
}
