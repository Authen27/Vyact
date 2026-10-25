// Vyact Agent — SMS structural signature (vyact-agent-architecture.md §3.2).
//
// The cost control for LLM-first extraction. A naive "one model call per SMS"
// pays tokens forever for the same ~20 bank formats. Instead we reduce a message
// to its STRUCTURAL SKELETON so that every SMS of the same format collapses to
// one signature, regardless of amount, date, account tail or merchant:
//
//   "Rs.850.00 debited from A/c XX4471 on 14-08 to VPA swiggy@ybl. Ref 4429911"
//   "Rs.1,299.50 debited from A/c XX9920 on 02-09 to VPA amazon@apl. Ref 8123344"
//        ↓ both →
//   "rs.# debited from a/c x# on #-# to vpa @. ref #"
//
// First occurrence → LLM extracts → validator checks → we store a recipe keyed by
// this signature. Every later message with the same signature is extracted
// deterministically for FREE. Templates become LEARNED artifacts, not maintained
// code — which is what makes this viable across banks, card issuers and locales.
//
// PRIVACY: the skeleton is digit- and merchant-masked, so a signature carries no
// household data. That is why `sms_format_recipes` can be a global table.
//
// PURE — no crypto/Deno/browser globals, so it runs under Deno and vitest alike.

/**
 * Banking vocabulary that DEFINES a format. Everything outside this list is
 * masked to `W`, so a merchant/payee name never changes the signature.
 * Kept deliberately small — adding a word here splits signatures, it never merges
 * them, so err on the side of leaving words out.
 */
const STRUCTURAL_WORDS = new Set([
  // polarity + action
  'debited', 'debit', 'credited', 'credit', 'spent', 'paid', 'withdrawn', 'sent',
  'received', 'deposited', 'refund', 'refunded', 'reversal', 'cashback', 'purchase',
  'purchased', 'deducted', 'transferred', 'transfer',
  // instruments + rails
  'a', 'c', 'ac', 'acct', 'account', 'card', 'upi', 'vpa', 'imps', 'neft', 'rtgs',
  'atm', 'pos', 'txn', 'transaction', 'ref', 'reference', 'utr', 'no', 'number',
  // balance/limit vocabulary (structural — its presence defines the format)
  'avl', 'bal', 'balance', 'available', 'lmt', 'limit', 'closing', 'due', 'total',
  'min', 'minimum', 'outstanding',
  // currency + connectives
  'rs', 'inr', 'usd', 'on', 'to', 'from', 'at', 'by', 'for', 'is', 'was', 'has', 'been',
  'your', 'the', 'and', 'with', 'via', 'info', 'not', 'you', 'call', 'if', 'this',
  'dear', 'customer', 'bank', 'towards', 'linked',
]);

/**
 * Reduce a message to its structural skeleton.
 * Order matters: mask VPAs/emails BEFORE words, and digits BEFORE word masking so
 * alphanumeric refs don't survive as `W`.
 */
export function smsSkeleton(raw: string): string {
  let t = (raw || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[–—]/g, '-');

  // VPA / email handles → '@'  (swiggy@ybl, a.b@okhdfcbank)
  t = t.replace(/[a-z0-9._%-]+@[a-z0-9.-]+/g, '@');
  // Long alphanumeric reference ids (mixed letters+digits) → '#'
  t = t.replace(/\b(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]{6,}\b/g, '#');
  // Any digit run (amounts, dates, masks, refs) → '#'
  t = t.replace(/\d[\d,]*(?:\.\d+)?/g, '#');
  // Collapse repeated masks: '#-#-#' stays structural, but '# #' → '#'
  t = t.replace(/#(?:\s*#)+/g, '#');

  // Mask non-structural words. `x`/`xx` prefixes on masked accounts are kept as
  // 'x' because they are part of the format, not the value.
  t = t.replace(/[a-z]+/g, (w) => {
    if (STRUCTURAL_WORDS.has(w)) return w;
    if (/^x+$/.test(w)) return 'x';
    return 'W';
  });
  // Collapse runs of masked words (a 3-word merchant ≡ a 1-word merchant).
  t = t.replace(/W(?:\s+W)+/g, 'W');

  return t.replace(/\s+/g, ' ').trim();
}

/**
 * cyrb128-style 128-bit hash → hex. Mirrors the approach already used by
 * `deterministicUuid` in react/src/lib/recurring.ts: sync, dependency-free and
 * stable across runtimes (crypto.subtle is async and unavailable in some test envs).
 */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

const hex8 = (n: number) => (n >>> 0).toString(16).padStart(8, '0');

/** Stable cache key for a message format. Same format ⇒ same signature. */
export function smsSignature(raw: string): string {
  const skeleton = smsSkeleton(raw);
  const [a, b, c, d] = cyrb128(skeleton);
  return `v1_${hex8(a)}${hex8(b)}${hex8(c)}${hex8(d)}`;
}
