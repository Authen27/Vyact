// Vyact Agent evals — the model seam (vyact-agent-architecture.md §7 layer 7).
//
// THIS FILE CONTAINS NO PROVIDER. That is the point.
//
// The harness must run green, offline, with no API key and no network. So the
// only thing shipped here is the INTERFACE a future bake-off plugs into, plus a
// `null` provider that is the default and does nothing.
//
//   ModelRunner = { id: string, extract(text, format) -> ExtractionResult|null }
//
// `extract` mirrors `IngestionDeps.llmExtract` exactly (architecture §3.1 stage
// 3C), so registering a provider is the whole integration — the runner does not
// change. A provider may be sync or async; the adapter awaits either.
//
// ─────────────────────────────────────────────────────────────────────────────
// ADDING A REAL PROVIDER LATER (§7 layer 7 — the multi-model bake-off)
//
//   1. Write `evals/providers/<name>.mjs` exporting a ModelRunner.
//   2. `registerProvider(await import('./providers/<name>.mjs').then(m => m.default))`
//      from a file that is NOT imported by default.
//   3. Run `node evals/runner.mjs --provider=<name>`.
//
// Rules that must survive that change:
//   • the DEFAULT provider stays `null`, so `node evals/runner.mjs` is always
//     offline, free and deterministic;
//   • a provider NEVER computes money — it returns an ExtractionCandidate and
//     the pipeline's validator (§3.4) and confirm gate (§3.1 stage 8) decide;
//   • anything a provider returns is confirm-gated by the pipeline itself
//     (`extractor: 'llm'` can never produce `write`), so a provider cannot
//     weaken the safety properties this corpus asserts.
//
// PURE — no network, no SDKs, no keys, no filesystem.

/**
 * @typedef {'bank_sms'|'free_text'|'receipt_img'|'query'|'chitchat'} InputFormat
 *
 * @typedef {object} ExtractionResultLike
 * @property {boolean} ok
 * @property {object} candidate
 * @property {'recipe'|'grammar'|'llm'|'manual'} extractor
 * @property {number} confidence
 * @property {string} [reason]
 *
 * @typedef {object} ModelRunner
 * @property {string} id                Stable key used by `--provider=<id>`.
 * @property {string} [label]           Human name for the report header.
 * @property {(text: string, format: InputFormat)
 *            => (ExtractionResultLike | null | Promise<ExtractionResultLike|null>)} extract
 * @property {() => (object|Promise<object>)} [applyRecipe]  Optional §3.2 recipe cache.
 */

/**
 * The default. Extracts nothing, so `runIngestion` runs with an EMPTY dep bag
 * and is byte-identically the deterministic pipeline that ships today.
 *
 * It is deliberately not "an LLM that returns nothing": `toIngestionDeps` omits
 * `llmExtract` entirely for this provider, because injecting a stub that always
 * declines is NOT the same code path as injecting nothing (the cascade's
 * receipt_img short-circuit at pipeline.ts:135 branches on the dep's presence).
 *
 * @type {ModelRunner}
 */
export const nullProvider = {
  id: 'null',
  label: 'null (deterministic pipeline, no model)',
  extract() {
    return null;
  },
};

/** @type {Map<string, ModelRunner>} */
const REGISTRY = new Map([[nullProvider.id, nullProvider]]);

/**
 * Register a ModelRunner so `--provider=<id>` can select it.
 * Throws on a duplicate id — silently shadowing a provider would make a
 * bake-off matrix lie about which model produced which column.
 *
 * @param {ModelRunner} runner
 * @returns {ModelRunner}
 */
export function registerProvider(runner) {
  if (!runner || typeof runner.id !== 'string' || !runner.id) {
    throw new Error('registerProvider: a ModelRunner needs a non-empty string `id`.');
  }
  if (typeof runner.extract !== 'function') {
    throw new Error(`registerProvider("${runner.id}"): \`extract(text, format)\` is required.`);
  }
  if (REGISTRY.has(runner.id)) {
    throw new Error(`registerProvider("${runner.id}"): that id is already registered.`);
  }
  REGISTRY.set(runner.id, runner);
  return runner;
}

/** Every registered provider id, in registration order. @returns {string[]} */
export function providerIds() {
  return [...REGISTRY.keys()];
}

/**
 * Look up a provider by id. Unknown id throws with the list of valid ones,
 * rather than silently falling back to `null` and reporting a model's score
 * against a run that never used it.
 *
 * @param {string} [id]
 * @returns {ModelRunner}
 */
export function resolveProvider(id) {
  const key = id ?? process.env.VYACT_EVAL_PROVIDER ?? nullProvider.id;
  const found = REGISTRY.get(key);
  if (!found) {
    throw new Error(
      `Unknown provider "${key}". Registered: ${providerIds().join(', ')}.\n`
      + 'Real providers are not shipped — see the header of evals/providers.mjs.',
    );
  }
  return found;
}

/**
 * ModelRunner → the pipeline's `IngestionDeps`.
 *
 * For the null provider this returns `{}` — no `llmExtract`, no `applyRecipe` —
 * so the pipeline is provably in its zero-token, zero-egress posture.
 *
 * @param {ModelRunner} runner
 * @returns {{ llmExtract?: Function, applyRecipe?: Function }}
 */
export function toIngestionDeps(runner) {
  if (!runner || runner.id === nullProvider.id) return {};

  /** @type {{ llmExtract?: Function, applyRecipe?: Function }} */
  const deps = {
    llmExtract: async (text, format) => {
      const out = await runner.extract(text, format);
      // A provider that declines must produce a well-formed decline, not undefined —
      // the cascade reads `.ok` (pipeline.ts:163).
      return out ?? { ok: false, candidate: {}, extractor: 'llm', confidence: 0, reason: 'not_parseable' };
    },
  };
  if (typeof runner.applyRecipe === 'function') {
    deps.applyRecipe = (signature, text) => runner.applyRecipe(signature, text);
  }
  return deps;
}
