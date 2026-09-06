// Vyact Agent — ingestion pipeline orchestrator (architecture §3, stages 1-8).
//
// One pipeline, every channel and format. Each stage is independently testable
// and may short-circuit. This module OWNS THE DECISION (stage 7) — it is where
// the binding rules are actually enforced rather than merely documented:
//
//   • "If a model touched it, a human confirms it."  An `llm` extraction can
//     never return `write`, no matter how confident it claims to be.
//   • The money model.  A transfer/investment is ONE spend/income-neutral row:
//     both account slots, never a category. Re-asserted here as a final guard,
//     because this is the last point before a writer sees the candidate.
//   • Never silently destroy a real transaction.  Duplicates ask; only a
//     matching bank reference is treated as definitively the same txn.
//
// Dependencies are INJECTED (the fn-bag pattern used by onboardingWiring.ts —
// the repo's best testable-seam precedent), so the whole pipeline runs in a unit
// test with no network, no model, and no database.
//
// With no `llmExtract` injected this module is fully deterministic and spends
// nothing — which is the current shipping posture.
//
// PURE — no network, no Deno/browser globals, no imports from react/src.

import { classifyInput } from './classify.ts';
import { extractByGrammar } from './grammar.ts';
import { resolveCandidate, type ResolveContext } from './resolver.ts';
import { detectAmbiguities, type AmbiguityContext } from './ambiguity.ts';
import { checkDuplicate, type DupeCandidate, type DedupeInput } from './dedupe.ts';
import { validateExtraction, type ValidationResult } from './validator.ts';
import { smsSignature } from './signature.ts';
import type {
  Ambiguity,
  Channel,
  ExtractionCandidate,
  ExtractionResult,
  InputFormat,
  PipelineAction,
} from './types.ts';

export interface IngestionInput {
  /** UNTRUSTED. Pattern-matched and stored; never interpreted as instruction. */
  text: string;
  channel: Channel;
  hasImage?: boolean;
  /** Accounts, households, base currency, and the injected clock. */
  ctx: ResolveContext;
  /** Recent transactions for the dedupe window. Empty is safe (no dedupe). */
  recent?: DupeCandidate[];
  /** Known when the user has exactly one household; otherwise we ask. */
  householdId?: string;
}

export interface IngestionDeps {
  /**
   * Learned-recipe lookup (§3.2). A hit is deterministic, free and reproducible.
   * Absent = every unknown format falls through to the model (or to nothing).
   */
  applyRecipe?: (signature: string, text: string) => ExtractionResult | undefined;
  /**
   * Model extraction. ABSENT = deterministic-only: no tokens, no egress.
   * Anything it returns is confirm-gated, unconditionally.
   */
  llmExtract?: (text: string, format: InputFormat) => Promise<ExtractionResult>;
}

/** Everything the pipeline learned, for telemetry and for the confirm UI. */
export interface IngestionTrace {
  format: InputFormat;
  formatConfidence: number;
  extractor?: ExtractionResult['extractor'];
  signature?: string;
  validation?: ValidationResult;
  ambiguityKinds: string[];
}

export interface IngestionOutcome {
  action: PipelineAction;
  trace: IngestionTrace;
}

/** Extractors whose output is provably deterministic — the only ones allowed to
 *  write without a human in the loop. */
const DETERMINISTIC_EXTRACTORS = new Set(['grammar', 'recipe', 'manual']);

function normaliseRef(raw: string | undefined): string {
  return (raw ?? '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/**
 * Final money-model guard. Runs on every candidate that is about to be written
 * or drafted, regardless of which extractor produced it.
 *
 * This duplicates rules the extractors already apply — deliberately. It is the
 * last point before a writer, and a money-model violation is a corrupt ledger,
 * not a bad suggestion.
 */
export function enforceMoneyModel(candidate: ExtractionCandidate): ExtractionCandidate {
  const out: ExtractionCandidate = { ...candidate };
  const neutral = out.transaction_type === 'transfer' || out.transaction_type === 'investment';
  if (neutral) {
    // One spend/income-neutral row: both account FKs, NO category. Ever.
    out.category_id = null;
  } else if (out.category_id === undefined) {
    delete out.category_id;
  }
  return out;
}

/**
 * Run the ingestion pipeline.
 *
 * Returns the DECISION, never a side effect: this module writes nothing, calls
 * nothing, and spends nothing. The caller (channel adapter) performs the write.
 */
export async function runIngestion(
  input: IngestionInput,
  deps: IngestionDeps = {},
): Promise<IngestionOutcome> {
  const text = typeof input.text === 'string' ? input.text : '';
  const trace: IngestionTrace = { format: 'chitchat', formatConfidence: 0, ambiguityKinds: [] };

  // ── [2] format classifier ──────────────────────────────────────────────────
  const classified = classifyInput(text, { hasImage: input.hasImage });
  trace.format = classified.format;
  trace.formatConfidence = classified.confidence;

  // A question is never logged. Channel policy decides whether it may be
  // ANSWERED; the pipeline's job is only to refuse to treat it as a write.
  if (classified.format === 'query') {
    return { action: { kind: 'block', reason: 'query' }, trace };
  }
  if (classified.format === 'chitchat') {
    return { action: { kind: 'ignore', reason: 'chitchat' }, trace };
  }
  if (classified.format === 'receipt_img' && !deps.llmExtract) {
    return { action: { kind: 'ignore', reason: 'receipt_ocr_unavailable' }, trace };
  }

  // ── [3] extractor cascade — cheapest confident hit wins ────────────────────
  let extraction: ExtractionResult | undefined;

  // A. learned recipe: free, deterministic, reproducible.
  if (deps.applyRecipe && classified.format === 'bank_sms') {
    const signature = smsSignature(text);
    trace.signature = signature;
    const hit = deps.applyRecipe(signature, text);
    if (hit?.ok) extraction = hit;
  }

  // B. command grammar: free. Declines bank SMS itself, but the classifier has
  //    already routed those away, so this is belt-and-braces.
  if (!extraction && classified.format === 'free_text') {
    const g = extractByGrammar(text);
    if (g.ok) extraction = g;
    else if (g.reason === 'query') {
      return { action: { kind: 'block', reason: 'query' }, trace };
    }
  }

  // C. the model: only on a miss, and everything it returns is confirm-gated.
  if (!extraction && deps.llmExtract) {
    const l = await deps.llmExtract(text, classified.format);
    if (l.ok) extraction = l;
  }

  if (!extraction || !extraction.ok) {
    return { action: { kind: 'ignore', reason: extraction?.reason ?? 'not_parseable' }, trace };
  }
  trace.extractor = extraction.extractor;
  if (extraction.recipeSignature) trace.signature = extraction.recipeSignature;

  // ── [3.5] validate against the raw source ──────────────────────────────────
  // Runs on EVERY path (recipe | grammar | llm) so no extractor can bypass it.
  const validation = validateExtraction(extraction.candidate, text, { now: input.ctx.now });
  trace.validation = validation;

  // ── [4] resolve to real entities ───────────────────────────────────────────
  const resolved = resolveCandidate(extraction.candidate, input.ctx);
  let candidate = enforceMoneyModel(resolved.candidate);

  // ── [6] dedupe ─────────────────────────────────────────────────────────────
  const householdId = candidate.household_id ?? input.householdId ?? '';
  let duplicateAmbiguity: Ambiguity | undefined;
  if (householdId && (input.recent?.length ?? 0) > 0) {
    const verdict = checkDuplicate(candidate as DedupeInput, householdId, input.recent ?? []);
    if (verdict.kind === 'near') {
      duplicateAmbiguity = verdict.ambiguity;
    } else if (verdict.kind === 'exact') {
      // A matching bank reference is definitive — the same txn, re-ingested.
      const ref = normaliseRef(candidate.refId);
      const refMatched = ref.length >= 4
        && (input.recent ?? []).some(r => normaliseRef(r.refId) === ref);
      if (refMatched) {
        return { action: { kind: 'ignore', reason: 'duplicate_reference' }, trace };
      }
      // Fingerprint-only match: two identical purchases on one day are REAL
      // (the same coffee twice). Collapsing silently would destroy a genuine
      // transaction the user could never discover. So we ask.
      duplicateAmbiguity = {
        kind: 'duplicate',
        question: 'This looks identical to something already logged today. Add it anyway?',
        options: [
          { id: 'dupe:add', label: 'Add it anyway', patch: {} },
          { id: 'dupe:skip', label: 'Skip — already logged', patch: {} },
        ],
      };
    }
  }

  // ── [5] ambiguities ────────────────────────────────────────────────────────
  //
  // A charge naming a CREDIT CARD is genuinely three-way (§3.5): an expense on
  // the card, paying the card bill, or a transfer to it. The ambiguity engine
  // implements that split but gates it on `hasCardAccountMatch` — which this
  // orchestrator never set, so the branch was unreachable and `1200 on kotak
  // credit card` WROTE SILENTLY instead of asking. Resolving the matched
  // account's kind here is what makes that question reachable at all.
  // ...but ONLY when nothing else already says what this is. A category or a
  // merchant settles it: "999 shoes on kotak credit card" is plainly a purchase,
  // and asking there is an interrogation, not a clarification. The genuinely
  // three-way case is a BARE amount against a card name — §3.5's "1200 amex" —
  // where nothing distinguishes a charge from paying the bill.
  const matchedAlias = (candidate.account_alias ?? '').toLowerCase();
  const cardAccountNamed = !!matchedAlias && (input.ctx.accounts ?? []).some(a =>
    /card|credit/i.test(a.kind ?? '')
    && (a.name ?? '').toLowerCase().includes(matchedAlias));
  const purposeAlreadyKnown = !!candidate.category_id || !!candidate.merchant;
  const hasCardAccountMatch = cardAccountNamed && !purposeAlreadyKnown;

  const ambiguityCtx: AmbiguityContext = {
    channel: input.channel,
    householdCount: input.ctx.households?.length ?? 0,
    households: input.ctx.households,
    hasCardAccountMatch,
    duplicates: duplicateAmbiguity ? [duplicateAmbiguity] : undefined,
  };
  const ambiguities = detectAmbiguities(candidate, resolved.conflicts, validation, ambiguityCtx);
  trace.ambiguityKinds = ambiguities.map(a => a.kind);

  // ── [7] the decision ───────────────────────────────────────────────────────

  // A rejected extraction cannot proceed. If we have a concrete question, ask
  // it; otherwise say nothing rather than write something we know is wrong.
  if (!validation.ok) {
    return ambiguities.length > 0
      ? { action: { kind: 'ask', ambiguities, candidate }, trace }
      : { action: { kind: 'ignore', reason: 'validation_rejected' }, trace };
  }

  if (ambiguities.length > 0) {
    return { action: { kind: 'ask', ambiguities, candidate }, trace };
  }

  candidate = enforceMoneyModel(candidate);

  // A conflict the ambiguity engine could not turn into a question has NOT gone
  // away — it just has no answers worth offering (an alias matching no account,
  // say). Those conflicts are invisible by design: a question needs >= 2 options.
  // Writing here would commit an under-specified candidate silently, so anything
  // still unresolved drops to a draft for a human to finish.
  if (resolved.conflicts.length > 0) {
    const confidence = Math.max(0, extraction.confidence - validation.confidencePenalty);
    return { action: { kind: 'draft', candidate, confidence }, trace };
  }

  // 🔒 THE CONFIRM GATE. A model-touched candidate is ALWAYS a draft, and a
  // validator degrade always forces confirmation, however confident the
  // extractor was. Only a deterministic, clean extraction writes directly —
  // which is exactly the behaviour already proven in production today.
  const deterministic = DETERMINISTIC_EXTRACTORS.has(extraction.extractor);
  if (!deterministic || validation.mustConfirm) {
    const confidence = Math.max(0, extraction.confidence - validation.confidencePenalty);
    return { action: { kind: 'draft', candidate, confidence }, trace };
  }

  return { action: { kind: 'write', candidate }, trace };
}
