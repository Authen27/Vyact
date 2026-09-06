// Vyact Agent — recipe persistence seam (architecture §3.2).
//
// WHY THIS FILE EXISTS
// `recipe.ts` can derive and apply a learned recipe, but the pipeline's
// `applyRecipe` hook had NO SUPPLIER — so the whole learned-recipe cache was
// dead code: built, tested, and never reached at runtime. This is the seam that
// connects them.
//
// ⚠️ THE SYNC/ASYNC MISMATCH, AND WHY WE PREFETCH
// `IngestionDeps.applyRecipe` is SYNCHRONOUS by design — the pipeline is a pure
// decision function and must stay unit-testable with no I/O. A database-backed
// store is inherently async. The resolution is NOT to make the pipeline async
// (that would push I/O into the one module that must have none); it is to
// PREFETCH: the caller computes the signature, awaits one lookup, then hands the
// pipeline a plain synchronous closure over the result.
//
// That works because the signature is derivable from the raw text alone, before
// any parsing — which is precisely what `smsSignature()` is for.
//
// PURE — no network, no Deno/browser globals, no imports from react/src. The
// Supabase-backed store is injected as a plain async function, so this module
// (and everything that uses it) stays testable with no database.

import { smsSignature } from './signature.ts';
import {
  applyRecipe, isRecipeShape, recordOutcome, shouldTrustRecipe,
  RECIPE_CONFIDENCE, type SmsRecipe,
} from './recipe.ts';
import type { ExtractionResult } from './types.ts';

/** Persistence contract. One row per signature (`sms_format_recipes`). */
export interface RecipeStore {
  get(signature: string): Promise<SmsRecipe | undefined>;
  put(recipe: SmsRecipe): Promise<void>;
  /** Promotion/demotion signal from real usage (§3.2). */
  observe(signature: string, outcome: 'confirmed' | 'corrected'): Promise<void>;
}

/** In-memory store — for tests, evals, and the shadow-mode dry run. */
export class InMemoryRecipeStore implements RecipeStore {
  private rows = new Map<string, SmsRecipe>();

  constructor(seed: SmsRecipe[] = []) {
    for (const r of seed) this.rows.set(r.signature, r);
  }

  get(signature: string): Promise<SmsRecipe | undefined> {
    return Promise.resolve(this.rows.get(signature));
  }

  put(recipe: SmsRecipe): Promise<void> {
    this.rows.set(recipe.signature, recipe);
    return Promise.resolve();
  }

  observe(signature: string, outcome: 'confirmed' | 'corrected'): Promise<void> {
    const existing = this.rows.get(signature);
    if (existing) this.rows.set(signature, recordOutcome(existing, outcome));
    return Promise.resolve();
  }

  /** Test/eval affordance only — never part of the contract. */
  size(): number { return this.rows.size; }
}

/**
 * What a prefetch produced. `apply` is the synchronous closure handed to
 * `IngestionDeps.applyRecipe`; it is `undefined` when nothing was cached, which
 * the pipeline reads as a cache miss and falls through to the model.
 */
export interface PreparedRecipe {
  signature: string;
  recipe?: SmsRecipe;
  trusted: boolean;
  apply?: (signature: string, text: string) => ExtractionResult | undefined;
}

/**
 * Look up the recipe for `text` and build the pipeline's sync hook.
 *
 * A store failure is a CACHE MISS, never an error: the cache is an optimisation,
 * and losing it must degrade cost and latency, never correctness. The model path
 * still runs, and the validator still guards whatever comes back.
 */
export async function prepareRecipe(store: RecipeStore, text: string): Promise<PreparedRecipe> {
  const signature = smsSignature(text);

  let recipe: SmsRecipe | undefined;
  try {
    const found = await store.get(signature);
    // Rows arrive as JSON from a shared, globally-readable table. Validate the
    // shape before trusting it — a malformed row must not reach the extractor.
    if (found && isRecipeShape(found)) recipe = found;
  } catch {
    recipe = undefined;
  }
  if (!recipe) return { signature, trusted: false };

  const trusted = shouldTrustRecipe(recipe);
  return {
    signature,
    recipe,
    trusted,
    apply: (sig, raw) => {
      // Defence in depth: never apply a recipe learned from a DIFFERENT format,
      // even if a caller passes a mismatched signature.
      if (sig !== recipe.signature) return undefined;
      const result = applyRecipe(recipe, raw);
      if (!result.ok) return result;
      // An untrusted recipe still extracts, but at reduced confidence so the
      // pipeline's confirm gate drafts it for a human rather than writing it.
      return trusted
        ? result
        : { ...result, confidence: Math.min(result.confidence, RECIPE_CONFIDENCE.untrusted) };
    },
  };
}

/**
 * Learn from a successful extraction: derive a recipe and store it.
 *
 * Deliberately best-effort and non-throwing — failing to LEARN must never fail
 * the user's transaction. `deriveRecipe` returns null when it cannot locate the
 * fields reliably, and that null is the correct, common outcome.
 */
export async function learnRecipe(
  store: RecipeStore,
  derived: SmsRecipe | null,
): Promise<boolean> {
  if (!derived) return false;
  try {
    await store.put(derived);
    return true;
  } catch {
    return false;
  }
}
