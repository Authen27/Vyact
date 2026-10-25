// Vyact Agent — dedupe check (vyact-agent-architecture.md §3.1 stage 7, §4 "Dedupe").
//
// Two mechanisms, deliberately asymmetric:
//
//   EXACT  → the SAME purchase yields the SAME content-addressed uuid, so a
//            re-ingest of an identical message collapses at the PRIMARY KEY on
//            upsert. No schema change, no read-before-write, no merge logic.
//            Safe to do silently *because the inputs are identical by
//            construction* — there is nothing to lose.
//
//   NEAR   → same account, ±1 day, ±2% on amount. This window exists because a
//            card AUTHORISATION and its later SETTLEMENT legitimately differ
//            (tip added, FX re-rate, fuel pre-auth). We ASK.
//
// 🔴 A near-match is NEVER auto-merged. Locked product decision. A wrong merge
//    silently destroys a real transaction the user made and they can never
//    discover it; a needless question costs one tap. Asking is always correct.
//
// This module NEVER computes or writes money. It compares candidates and returns
// a verdict. Amounts are compared in MINOR UNITS (integers) only — no float
// equality anywhere.
//
// All merchant / refId / description text originates from bank SMS, receipts and
// chat: UNTRUSTED DATA, never instruction. It is only normalised, compared, and
// (sanitised) echoed back into a question string.
//
// PURE — no network, no Deno globals, no browser globals, no imports from
// react/src. Runs under Deno (edge) and vitest alike.

import type { Ambiguity, AmbiguityOption, ExtractionCandidate } from './types.ts';

// ── the ported primitive ─────────────────────────────────────────────────────
//
// ⚠️ PARITY-CRITICAL. This is a byte-for-byte port of `deterministicUuid` /
// `cyrb128` in react/src/lib/recurring.ts (the R2 multi-device idempotency fix).
// The edge runtime cannot import from react/src, so the algorithm is duplicated.
// A silent divergence would break cross-device idempotency and only surface in
// production as duplicate rows — so the port is pinned by a parity test in
// react/src/lib/__tests__/agentDedupe.test.ts which imports BOTH implementations
// and asserts identical output. Do not "tidy" anything below without re-running it.
//
// NOTE: `cyrb128` in ./signature.ts is a DIFFERENT variant (its final tuple is
// `(h2 ^ h1)`, not `h2`). Do not import from there — it would silently change ids.

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
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Stable UUIDv8 (RFC 9562) derived from a seed string. Same seed → same id.
 * PORT of react/src/lib/recurring.ts — see the parity note above.
 */
export function deterministicUuid(seed: string): string {
  const [a, b, c, d] = cyrb128(seed);
  const h = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  let hex = h(a) + h(b) + h(c) + h(d);
  // version 8 (custom) in the 13th nibble; RFC-4122 variant in the 17th.
  hex = hex.slice(0, 12) + '8' + hex.slice(13);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  hex = hex.slice(0, 16) + variant + hex.slice(17);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// ── merchant normalisation ───────────────────────────────────────────────────

/**
 * Payment-rail vocabulary that carries no merchant identity. Stripping it is what
 * makes `SWIGGY*ORDER 4429`, `UPI/SWIGGY/4429911` and `swiggy` converge.
 *
 * Deliberately small. Every word added here MERGES more merchants together, and a
 * merge that goes too far can make two genuinely different purchases share a
 * fingerprint. Add a word only when it is pure rail noise.
 */
const RAIL_NOISE = new Set([
  'upi', 'pos', 'vpa', 'imps', 'neft', 'rtgs', 'atm', 'ecs', 'nach', 'ach',
  'txn', 'trxn', 'tx', 'ref', 'refno', 'utr', 'rrn', 'auth', 'authcode',
  'order', 'orderid', 'ord', 'no', 'id', 'inv', 'invoice',
  'payment', 'payments', 'pymt', 'pmt', 'purchase', 'purchased', 'debit', 'credit',
  'card', 'mandate', 'autopay', 'billdesk',
]);

/**
 * Stable, lossy-in-the-right-direction merchant key.
 *
 *   'SWIGGY*ORDER 4429'      → 'swiggy'
 *   'UPI/SWIGGY/4429911'     → 'swiggy'
 *   '  Swiggy.  '            → 'swiggy'
 *   'AMAZON RETAIL INDIA'    → 'amazon retail india'   (brand words are kept)
 *
 * Rules: NFKC → lowercase → punctuation to spaces → drop rail-noise tokens →
 * drop pure-digit tokens → strip a >=3-digit reference tail off a word.
 * If stripping would empty the string we keep the punctuation-stripped form
 * instead, so a numeric-only merchant still produces a stable (non-empty) key.
 */
export function normaliseMerchant(raw: string): string {
  const base = (raw || '')
    .normalize('NFKC')
    .toLowerCase()
    // every non-alphanumeric becomes a separator: '*', '/', '-', '.', '@', '#' ...
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!base) return '';

  const kept: string[] = [];
  for (const tok of base.split(' ')) {
    if (!tok) continue;
    if (RAIL_NOISE.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;                 // bare reference / order number
    // trailing reference tail welded to the brand: 'swiggy4429911' → 'swiggy'
    const trimmed = tok.replace(/(?<=[a-z]{2})\d{3,}$/, '');
    kept.push(trimmed);
  }
  // Everything was noise (e.g. 'UPI/4429911') — fall back to the flattened form
  // so the key stays stable and non-empty rather than collapsing every such
  // message onto ''.
  return (kept.length ? kept.join(' ') : base).replace(/\s+/g, ' ').trim();
}

// ── fingerprint ──────────────────────────────────────────────────────────────

/**
 * Content-addressed txn id. The SAME purchase always yields the SAME uuid, so an
 * exact re-ingest collapses at the primary key on upsert — no schema change.
 *
 * `amountMinor` MUST already be an integer in minor units (see `toMinorUnits`);
 * passing a float would make the id unstable across float round-trips.
 */
export function txnFingerprint(
  householdId: string,
  dateISO: string,
  amountMinor: number,
  merchantNorm: string,
): string {
  return deterministicUuid(
    `vyact:txn:${householdId}:${dateISO}:${Math.trunc(amountMinor)}:${merchantNorm}`,
  );
}

/**
 * Major units (850.07) → minor units (85007). Rounds once, at the boundary, so
 * every downstream comparison is integer-only.
 * This is a UNIT CONVERSION, not money computation — nothing here decides,
 * aggregates or writes a figure.
 *
 * ASSUMPTION: 2 decimal places. Vyact stores amounts as major-unit numbers and
 * every currency in KNOWN_CURRENCIES except JPY is 2-decimal; a 0-decimal
 * currency simply gets a x100 scale, which stays internally consistent because
 * both sides of every comparison go through this same function.
 */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/** Inverse of `toMinorUnits`, for patches (ExtractionCandidate.amount is major). */
function toMajorUnits(amountMinor: number): number {
  return Math.trunc(amountMinor) / 100;
}

// ── verdict types ────────────────────────────────────────────────────────────

/** A recently-written row to compare against. Amounts are ALREADY minor units. */
export interface DupeCandidate {
  id: string;
  date: string;
  amountMinor: number;
  merchant?: string;
  accountId?: string;
  refId?: string;
}

export type DupeVerdict =
  | { kind: 'none' }
  | { kind: 'exact'; matchId: string }       // same fingerprint or same refId → collapse silently
  | { kind: 'near'; ambiguity: Ambiguity };  // ASK. never auto-merge.

/**
 * LOCALLY DEFINED (types.ts is owned by a sibling agent this sprint, so it is
 * not edited here).
 *
 * `ExtractionCandidate` has no resolved `accountId` — it carries `account_alias`
 * / `accountMask`, which live in a different namespace from `DupeCandidate.accountId`
 * and therefore cannot be compared. The resolver (stage 5) runs BEFORE dedupe and
 * does know the resolved account, so dedupe accepts it as an optional extra field.
 *
 * Every added field is optional, so a plain `ExtractionCandidate` is assignable
 * here and the documented `checkDuplicate(candidate, householdId, recent)` shape
 * is unchanged. If `accountId` is ever added to `ExtractionCandidate` upstream,
 * delete this interface and use it directly.
 */
export interface DedupeInput extends ExtractionCandidate {
  /** Resolved account id from stage 5, when known. */
  accountId?: string;
  /** Pre-converted minor units. Preferred over `amount` when present. */
  amountMinor?: number;
}

// ── near-match window ────────────────────────────────────────────────────────

/** +/-1 calendar day. */
const NEAR_DAY_WINDOW = 1;
/** +/-2% on amount — the card auth-vs-settlement drift. Applied as an integer
 *  comparison (`diff * 50 <= max`) so no float ever decides a match. */
const NEAR_AMOUNT_INVERSE_PCT = 50;

const DAY_MS = 86_400_000;

/** Whole days between two ISO yyyy-mm-dd dates, parsed as UTC so no local tz
 *  shift can move a transaction across midnight. NaN when either is unparseable. */
function dayDiff(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (!isFinite(ta) || !isFinite(tb)) return NaN;
  return Math.abs(Math.round((ta - tb) / DAY_MS));
}

/** Within +/-2%, decided on integers. */
function withinAmountWindow(a: number, b: number): boolean {
  const diff = Math.abs(a - b);
  const max = Math.max(Math.abs(a), Math.abs(b));
  if (max === 0) return diff === 0;
  return diff * NEAR_AMOUNT_INVERSE_PCT <= max;
}

/** Bank refs are printed inconsistently (`Ref 4429911`, `ref#4429-911`). */
function normaliseRef(raw: string | undefined): string {
  return (raw || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}

/**
 * Accounts are compatible unless BOTH sides know their account and disagree.
 * Erring open here can only cause an extra QUESTION; erring closed would let a
 * real duplicate through silently. The asymmetry is intentional.
 */
function accountsCompatible(candidate: DedupeInput, row: DupeCandidate): boolean {
  if (!candidate.accountId || !row.accountId) return true;
  return candidate.accountId === row.accountId;
}

/**
 * Merchants are compatible when either side is unknown or they share a token.
 * An auth row often has a terser merchant than its settlement ('SWIGGY' vs
 * 'SWIGGY*ORDER 4429'), so exact equality would miss the very case the window
 * exists for.
 */
function merchantsCompatible(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  const ta = new Set(a.split(' '));
  return b.split(' ').some(t => ta.has(t));
}

/**
 * Untrusted text → safe to embed in a question shown to a human or handed to a
 * presenter. Drops control characters (an SMS could otherwise inject fake chat
 * turns), collapses whitespace and truncates. Never executed, never interpreted.
 */
function safeLabel(raw: string | undefined, max = 40): string {
  let cleaned = '';
  for (const ch of raw || '') {
    const cp = ch.codePointAt(0) ?? 0;
    cleaned += (cp < 0x20 || cp === 0x7f) ? ' ' : ch;
  }
  const t = cleaned.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}...` : t;
}

// ── the check ────────────────────────────────────────────────────────────────

/**
 * Compare one extraction candidate against the household's recent rows.
 *
 * `recent` MUST already be scoped to `householdId` by the caller (dedupe never
 * queries). Precedence, strongest first:
 *   1. refId / UTR match  → exact (a bank reference is a natural key; amount and
 *      date drift between auth and settlement, the reference does not).
 *   2. identical fingerprint, or a recent row whose id IS the fingerprint → exact.
 *   3. same account, +/-1 day, +/-2%, compatible merchant → near → ASK.
 * Otherwise `none`.
 *
 * A candidate with no amount or no date cannot be fingerprinted; it returns
 * `none` rather than guessing.
 */
export function checkDuplicate(
  candidate: DedupeInput,
  householdId: string,
  recent: DupeCandidate[],
): DupeVerdict {
  const rows = recent || [];

  // 1 ── refId is the strongest signal, and it outranks amount/date drift.
  const candRef = normaliseRef(candidate.refId);
  if (candRef.length >= 4) {
    const hit = rows.find(r => normaliseRef(r.refId) === candRef);
    if (hit) return { kind: 'exact', matchId: hit.id };
  }

  const minor = candidate.amountMinor != null
    ? Math.trunc(candidate.amountMinor)
    : candidate.amount != null && isFinite(candidate.amount)
      ? toMinorUnits(candidate.amount)
      : null;
  const date = candidate.date;
  if (minor == null || !date) return { kind: 'none' };

  const merchantNorm = normaliseMerchant(candidate.merchant || '');
  const fp = txnFingerprint(householdId, date, minor, merchantNorm);

  // 2 ── exact: identical content ⇒ identical id ⇒ the PK collapses it on upsert.
  for (const r of rows) {
    if (r.id === fp) return { kind: 'exact', matchId: r.id };
    const rFp = txnFingerprint(
      householdId, r.date, Math.trunc(r.amountMinor), normaliseMerchant(r.merchant || ''),
    );
    if (rFp === fp) return { kind: 'exact', matchId: r.id };
  }

  // 3 ── near: auth-vs-settlement drift. Pick the single closest row so the
  // question is deterministic when several rows qualify.
  let best: DupeCandidate | null = null;
  let bestKey: [number, number, string] | null = null;
  for (const r of rows) {
    if (!accountsCompatible(candidate, r)) continue;
    const dd = dayDiff(date, r.date);
    if (!isFinite(dd) || dd > NEAR_DAY_WINDOW) continue;
    const rMinor = Math.trunc(r.amountMinor);
    if (!withinAmountWindow(minor, rMinor)) continue;
    if (!merchantsCompatible(merchantNorm, normaliseMerchant(r.merchant || ''))) continue;

    const key: [number, number, string] = [Math.abs(minor - rMinor), dd, r.id];
    if (
      !bestKey
      || key[0] < bestKey[0]
      || (key[0] === bestKey[0] && key[1] < bestKey[1])
      || (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2])
    ) {
      best = r;
      bestKey = key;
    }
  }
  if (!best) return { kind: 'none' };

  return { kind: 'near', ambiguity: buildDuplicateAmbiguity(candidate, best) };
}

/**
 * The question we ask instead of merging. Both options carry a CONCRETE patch:
 *
 *  • 'skip_duplicate' patches the candidate to the matched row's (date, amount,
 *    merchant) — which makes its fingerprint EQUAL the matched row's, so the
 *    write collapses at the PK. "Skip" is expressed in the same content-addressed
 *    mechanism as everything else; nothing has to special-case it.
 *  • 'add_anyway' re-asserts the candidate's own (date, amount, merchant), so the
 *    fingerprint is unchanged and a genuinely distinct row is written.
 *
 * Answering stays a PURE MERGE — no re-parse, no second model call (§3.5).
 * Labels carry no amounts: this module does not render or compute money, the
 * presenter does.
 */
function buildDuplicateAmbiguity(candidate: DedupeInput, match: DupeCandidate): Ambiguity {
  const who = safeLabel(match.merchant || candidate.merchant);

  const options: AmbiguityOption[] = [
    {
      id: 'skip_duplicate',
      label: 'Skip — already logged',
      patch: {
        date: match.date,
        amount: toMajorUnits(match.amountMinor),
        merchant: match.merchant ?? candidate.merchant,
      },
    },
    {
      id: 'add_anyway',
      label: 'Add it anyway — separate purchase',
      patch: {
        date: candidate.date,
        amount: candidate.amount,
        merchant: candidate.merchant,
      },
    },
  ];

  return {
    kind: 'duplicate',
    question: who
      ? `I already have a similar ${who} transaction on ${match.date}. Is this the same one?`
      : `I already have a similar transaction on ${match.date}. Is this the same one?`,
    options,
  };
}
