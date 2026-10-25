// Vyact Agent — format classifier (vyact-agent-architecture.md §3, stage 2).
//
// "What IS this?" — asked BEFORE any extractor runs. It is a routing decision,
// and routing wrong is expensive in both directions:
//
//   bank_sms mistaken for free_text → the command grammar greedily matches a
//     reference number or an available balance as the amount, and writes wrong
//     money. This is the single worst failure mode in the pipeline.
//   query mistaken for anything else → we try to LOG a question instead of
//     answering it (or, worse, leak data over a channel that must hard-block).
//
// So the bank_sms detector is deliberately HIGH-RECALL: when a message carries
// two or more structural banking signals we route it to the recipe/LLM path,
// which is guarded by validator.ts. Over-triaging to the safe path costs a cache
// lookup; under-triaging costs a wrong transaction.
//
// PURE — no model, no network, no globals. Runs under Deno and vitest alike.

import type { InputFormat } from './types.ts';

export interface ClassificationResult {
  format: InputFormat;
  /** 0..1. Low confidence on a write path should route to confirmation, not silence. */
  confidence: number;
  /** Which signals fired. Kept for telemetry and for debugging misroutes. */
  signals: string[];
}

export interface ClassifyOptions {
  /** The channel adapter already knows an image came in; it short-circuits. */
  hasImage?: boolean;
}

/** Balance/limit vocabulary. Mirrors validator.ts BALANCE_LABELS by intent. */
const BANK_BALANCE = /\b(avl\.?\s*bal|available\s+bal(?:ance)?|avbl\s*bal|avl\s*lmt|credit\s+limit|closing\s+bal(?:ance)?|total\s+due|min(?:imum)?\s+due|outstanding)\b/i;
/** A masked account/card tail: "A/c XX4471", "Acct ending 9920", "card no. XX1234". */
const MASKED_ACCOUNT = /\b(a\/c|ac|acct|account|card)\b[^.\n]{0,24}?(x{2,}\s*\d{2,}|ending\s*\d{3,}|\b\d{4}\b)/i;
/** A bank reference: "Ref 4429911", "UTR 123456789012", "Txn ID ...". */
const BANK_REF = /\b(ref(?:erence)?(?:\s*(?:no|id|num))?|utr|txn\s*(?:id|no)|transaction\s*id)\b\s*[:.#]?\s*[a-z0-9]{4,}/i;
/** Explicit banking polarity verbs in the passive voice banks use. */
const BANK_VERB = /\b(debited|credited|withdrawn|deposited|has\s+been\s+(?:debited|credited)|transferred)\b/i;
/** Payment rails that only ever appear in machine-generated messages. */
const BANK_RAIL = /\b(upi|vpa|imps|neft|rtgs|atm|pos|nach|ecs|mandate)\b/i;
/** Bank-notice boilerplate. */
const BANK_BOILER = /\b(not\s+you\??\s*call|dispute|do\s+not\s+share|never\s+shares?|customer\s+care|toll\s*free|-\s*[a-z]{2,}\s*bank\b|helpline)\b/i;

/** Interrogative openers — English + common Hinglish. */
const QUERY_OPENER = /^\s*(what|what's|whats|how\s+much|how\s+many|how\s+do|when|where|which|who|why|can\s+i|could\s+i|do\s+i|did\s+i|am\s+i|is\s+my|are\s+my|show|list|tell\s+me|give\s+me|kitna|kitne|kaise|kab)\b/i;
/** Query intent that can appear mid-sentence. */
const QUERY_PHRASE = /\b(how\s+much\s+(?:did|do|have|is|are)|what(?:'s| is| are)\s+my|show\s+me|tell\s+me|remind\s+me|summar(?:y|ise|ize)|breakdown|report)\b/i;

const GREETING = /^\s*(hi|hello|hey|yo|hola|namaste|thanks|thank\s+you|thx|ty|ok|okay|k|cool|nice|great|good\s+(?:morning|evening|night|afternoon)|bye|sorry|help)\b[\s!.?]*$/i;

/** Any recoverable money-ish figure, incl. Indian grouping and k/lakh/cr shorthand. */
const HAS_AMOUNT = /(?:\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lac|lakhs|cr|crore)?)/i;

/**
 * Classify a raw input. `text` is UNTRUSTED — it is pattern-matched only, never
 * interpreted as instruction.
 */
export function classifyInput(text: string, opts: ClassifyOptions = {}): ClassificationResult {
  const raw = (text ?? '').trim();

  // An image is settled by the adapter, not by the text.
  if (opts.hasImage) {
    return { format: 'receipt_img', confidence: 0.99, signals: ['has_image'] };
  }
  if (!raw) {
    return { format: 'chitchat', confidence: 0.5, signals: ['empty'] };
  }

  // ── bank signals (counted, not short-circuited) ─────────────────────────────
  const bankSignals: string[] = [];
  if (BANK_BALANCE.test(raw)) bankSignals.push('balance_label');
  if (MASKED_ACCOUNT.test(raw)) bankSignals.push('masked_account');
  if (BANK_REF.test(raw)) bankSignals.push('bank_ref');
  if (BANK_VERB.test(raw)) bankSignals.push('bank_verb');
  if (BANK_RAIL.test(raw)) bankSignals.push('payment_rail');
  if (BANK_BOILER.test(raw)) bankSignals.push('bank_boilerplate');
  // Machine messages are long and impersonal; a human logging a spend is short.
  if (raw.length > 70 && !/\b(i|my|me|we|our)\b/i.test(raw)) bankSignals.push('impersonal_long');

  // ── query ───────────────────────────────────────────────────────────────────
  // Checked BEFORE bank_sms so "what's my balance?" is a question, not a
  // statement of balance — but only when the bank evidence is weak, so a real
  // SMS that happens to contain "Bal" is never mistaken for a question.
  const looksQuery = QUERY_OPENER.test(raw) || QUERY_PHRASE.test(raw) || /\?\s*$/.test(raw);
  if (looksQuery && bankSignals.length < 2) {
    return {
      format: 'query',
      confidence: /\?\s*$/.test(raw) && QUERY_OPENER.test(raw) ? 0.95 : 0.85,
      signals: ['query_form'],
    };
  }

  // ── bank_sms ────────────────────────────────────────────────────────────────
  // Two independent structural signals is the bar. One alone is too weak: a
  // human may well type "upi 500" or "paid via neft".
  if (bankSignals.length >= 2) {
    return {
      format: 'bank_sms',
      confidence: Math.min(0.96, 0.6 + 0.12 * bankSignals.length),
      signals: bankSignals,
    };
  }

  // ── chitchat ────────────────────────────────────────────────────────────────
  if (GREETING.test(raw)) {
    return { format: 'chitchat', confidence: 0.9, signals: ['greeting'] };
  }

  // ── free_text ───────────────────────────────────────────────────────────────
  // A human-typed log. Requires a figure; without one there is nothing to log,
  // so it is conversation.
  if (HAS_AMOUNT.test(raw) && /\d/.test(raw)) {
    return {
      format: 'free_text',
      confidence: bankSignals.length === 1 ? 0.6 : 0.8,   // one bank signal = less sure
      signals: bankSignals.length ? ['amount_present', ...bankSignals] : ['amount_present'],
    };
  }

  return { format: 'chitchat', confidence: 0.6, signals: ['no_amount'] };
}
