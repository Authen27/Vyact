// Vyact Agent — shared ingestion types (vyact-agent-architecture.md §3).
//
// Self-contained by design: the edge runtime cannot import from `react/src`, so
// these mirror the app types rather than importing them. Anything marked "MUST
// mirror" is checked by the parity tests (§7 layer 2).
//
// PURE TYPES ONLY — no runtime deps, no Deno/browser globals, so this compiles
// under both Deno (edge) and vitest (react/).

// ── category id sets — MUST mirror react/src/constants.ts CATEGORIES_BY_TYPE ──
export const EXPENSE_IDS = new Set([
  'food_dining', 'groceries', 'transport', 'rent_mortgage', 'utilities', 'shopping',
  'health', 'entertainment', 'education', 'travel', 'childcare', 'insurance',
  'loan_emi', 'other_expense',
]);
export const INCOME_IDS = new Set([
  'salary', 'freelance', 'gift_bonus', 'rental_income', 'business_revenue', 'other_income',
]);

/** MUST mirror the CURRENCY_REGISTRY keys in react/src/lib/money.ts. */
export const KNOWN_CURRENCIES = new Set([
  'INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED', 'JPY', 'CHF', 'NZD',
]);

export type TxnType = 'expense' | 'income' | 'transfer' | 'investment';
export type Direction = 'debit' | 'credit';

/** The channel a message arrived on. Drives the presenter + policy, not the parse. */
export type Channel = 'chat' | 'whatsapp' | 'sms_share' | 'receipt';

/** What kind of thing the user sent us (stage 2 of the pipeline). */
export type InputFormat = 'bank_sms' | 'free_text' | 'receipt_img' | 'query' | 'chitchat';

export interface AccountLite {
  name: string;
  kind: string;
  /** Last 4 of the real account/card number, for `A/c XX4471` matching. */
  maskLast4?: string;
}

/**
 * A transaction candidate at any stage of the cascade. Every field is optional
 * because extraction is incremental — the resolver and the user's answers to
 * ambiguities fill the gaps.
 */
export interface ExtractionCandidate {
  amount?: number;
  currency?: string;
  direction?: Direction;
  transaction_type?: TxnType;
  category_id?: string | null;
  merchant?: string;
  /** Masked tail from the source, e.g. '4471'. */
  accountMask?: string;
  account_alias?: string;
  to_account_alias?: string | null;
  /**
   * Which household this belongs to. Always ASKED when the user has more than
   * one (locked decision) — so it must be patchable like any other field, or
   * "answering is a pure merge" would be false for the one question we always
   * ask. Resolved silently only when there is exactly one household.
   */
  household_id?: string;
  /** ISO yyyy-mm-dd. A bank SMS is frequently BACKDATED — never assume today. */
  date?: string;
  /** Bank reference / UTR — the strongest natural dedupe key when present. */
  refId?: string;
  description?: string;
}

/** Which extractor produced a candidate — drives confidence and the confirm gate. */
export type ExtractorId = 'recipe' | 'grammar' | 'llm' | 'manual';

export interface ExtractionResult {
  ok: boolean;
  candidate: ExtractionCandidate;
  extractor: ExtractorId;
  /** 0..1 BEFORE validation. The validator may apply a penalty. */
  confidence: number;
  /** Set when a learned recipe produced this (§3.2). */
  recipeSignature?: string;
  reason?: 'no_amount' | 'no_direction' | 'not_parseable' | 'query';
}

// ── Ambiguity (§3.5) ─────────────────────────────────────────────────────────

export type AmbiguityKind =
  | 'txn_type'    // "1200 amex" → expense on card | paying the card bill | transfer
  | 'account'
  | 'household'   // ALWAYS asked when the user has >1 household
  | 'category'
  | 'date'
  | 'duplicate'
  | 'polarity';   // neither/both debit and credit verbs present

export interface AmbiguityOption {
  id: string;
  label: string;
  /** The patch this option applies. Answering is a PURE MERGE — no re-parse,
   *  no second model call. */
  patch: Partial<ExtractionCandidate>;
}

/**
 * The resolver→ambiguity seam (stage 4 → stage 5). Lives here because two
 * modules share it: the resolver emits conflicts, the ambiguity engine turns
 * them into questions. One definition, so the two can never drift apart.
 */
export interface ResolutionConflict {
  field: 'account' | 'to_account' | 'category' | 'household' | 'date' | 'currency';
  /** Human-readable — becomes the body of the question text at stage 5. */
  reason: string;
  /** 0..N concrete choices. Empty means "we have nothing to offer — just ask". */
  candidates: AmbiguityOption[];
}

export interface Ambiguity {
  kind: AmbiguityKind;
  question: string;
  /** 2-4 concrete choices. Renders as chips in-app, numbered list on WhatsApp. */
  options: AmbiguityOption[];
}

/** What the pipeline decided to do with an input (stage 8). */
export type PipelineAction =
  | { kind: 'ask'; ambiguities: Ambiguity[]; candidate: ExtractionCandidate }
  | { kind: 'draft'; candidate: ExtractionCandidate; confidence: number }
  | { kind: 'write'; candidate: ExtractionCandidate }   // deterministic path only
  | { kind: 'block'; reason: 'query' }                   // never leak data over chat
  | { kind: 'ignore'; reason: string };
