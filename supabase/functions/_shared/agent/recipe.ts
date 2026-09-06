// Vyact Agent — learned recipe engine (vyact-agent-architecture.md §3.2).
//
// THE COST CONTROL. LLM-first extraction is correct but pays tokens forever for
// the same ~20 bank formats. This module makes a format cost tokens ONCE: the
// first message of a shape is extracted by a model, validated (§3.4), then
// reduced to a RECIPE — a set of field LOCATORS — stored against its
// `smsSignature()`. Every later message of that shape is extracted
// deterministically, for free, reproducibly.
//
// ── THE PRIVACY INVARIANT (read this before changing anything) ───────────────
// `sms_format_recipes` is a GLOBAL table shared across households. A recipe
// therefore stores STRUCTURE, NEVER VALUES: no amount, no account tail, no
// merchant, no customer name, no reference id. A leaked value here is a
// cross-tenant data leak.
//
// It is enforced by construction, not by good intentions:
//   • every literal fragment that goes into a pattern must survive `smsSkeleton()`
//     unchanged — i.e. it belongs to the SHARED structural vocabulary that the
//     signature already publishes globally. `Dear Uday,` → `W W,` → 'uday' is
//     rejected as an anchor, `debited from A/c` is kept;
//   • anchors may never overlap an extracted value's span;
//   • digit-bearing tokens are never copied into a pattern — numbers are always
//     expressed as classes (`[0-9]{4}`), never as literals;
//   • `isStructuralPattern()` re-checks all of the above on the finished string,
//     and a failure kills the recipe.
//
// ── THE CORRECTNESS INVARIANT ───────────────────────────────────────────────
// Derivation VERIFIES ITSELF: after building the locators we immediately apply
// them back to the same `rawText` and require every field to round-trip to the
// value it came from. Any mismatch returns `null` — we would rather pay for a
// model call forever than store a recipe that silently mis-extracts thousands of
// later messages.
//
// Apply NEVER FABRICATES: a locator that does not match yields an ABSENT field,
// never a guessed one. No amount ⇒ `ok:false` with a contract `reason`.
//
// All input text is UNTRUSTED DATA, never instruction. It is only ever escaped,
// matched against, and compared — never executed. Note that we BUILD REGEXES
// from it, so every literal is passed through `escapeRe()` and every quantifier
// is bounded (no nested unbounded repetition ⇒ no catastrophic backtracking).
//
// It NEVER computes or writes money: it produces a candidate. Stage 4
// (`validator.ts`) still validates recipe output at the call site — this module
// does not call it and does not assume it away.
//
// PURE — no network, no Deno/browser globals. Runs under Deno and vitest alike.

import {
  KNOWN_CURRENCIES,
  type Direction,
  type ExtractionCandidate,
  type ExtractionResult,
} from './types.ts';
import { smsSkeleton } from './signature.ts';

// ═══════════════════════════════════════════════════════════════════════════
//  Contract
// ═══════════════════════════════════════════════════════════════════════════

export interface FieldLocator {
  field: 'amount' | 'currency' | 'direction' | 'accountMask' | 'date' | 'merchant' | 'refId';
  /** Serialisable regex source — recipes are stored as JSON. */
  pattern: string;
  flags?: string;
  /** Capture group holding the value. */
  group: number;
  transform?: 'amount' | 'date_ddmm' | 'trim' | 'upper' | 'digits';
}

export interface SmsRecipe {
  /** From `smsSignature()`. */
  signature: string;
  /** Bump when the locator format changes; older recipes are then refused. */
  version: number;
  locators: FieldLocator[];
  createdAt: string;
  /** Times a user confirmed a draft produced by this recipe. */
  confirmations: number;
  /** Times a user edited one. */
  corrections: number;
}

export type RecipeField = FieldLocator['field'];

/**
 * Locator format version. Stored on every recipe; `applyRecipe` REFUSES a recipe
 * whose version it does not understand rather than mis-reading old locators.
 */
export const RECIPE_FORMAT_VERSION = 1;

/**
 * Trust thresholds (§3.2: "promoted to trusted only after N successful,
 * user-confirmed extractions"; "a user correction demotes it").
 *
 *  minConfirmations   — a fresh recipe is USABLE but never TRUSTED. Three
 *                       independent human confirmations is the smallest number
 *                       that is not one enthusiastic user tapping twice.
 *  maxCorrectionRatio — 15%. Above this the format is not reliably readable.
 *  hardCorrectionLimit— 3 corrections ever ⇒ never trusted again, at any volume.
 *                       Banks DO silently change formats; a run of corrections is
 *                       the only signal we get, and re-earning trust after a real
 *                       drift is not something a ratio should be able to do.
 */
export const RECIPE_TRUST = {
  minConfirmations: 3,
  maxCorrectionRatio: 0.15,
  hardCorrectionLimit: 3,
} as const;

/**
 * Confidence BEFORE validation (the validator may still apply a penalty).
 * A trusted recipe is deterministic and human-verified — it earns the top of the
 * band. An untrusted one sits deliberately below it so the decision stage drafts
 * rather than writes.
 */
export const RECIPE_CONFIDENCE = {
  trusted: 0.95,
  untrusted: 0.75,
  /** Per optional locator that failed to match on this message. */
  missPenalty: 0.05,
  floor: 0.5,
} as const;

/**
 * Fields whose absence would change WHICH money moves, WHEN, FROM WHERE, or the
 * dedupe identity. If the candidate carries one and we cannot locate it, we
 * return null and keep paying the model — a recipe that permanently drops the
 * account tail would silently dump every future message into the default account.
 */
const STRICT_FIELDS: RecipeField[] = ['amount', 'direction', 'accountMask', 'date', 'refId'];

/** Hard caps — inputs are untrusted, so nothing here is unbounded. */
const MAX_TEXT = 2000;
const MAX_PATTERN = 400;
const MAX_ANCHOR_UNITS = 4;
const MAX_SUFFIX_UNITS = 3;
const MAX_VALUE_CHARS = 64;

// ═══════════════════════════════════════════════════════════════════════════
//  Vocabulary constants (structural — never derived from a message)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MIRRORS `validator.ts` DEBIT_VERBS / CREDIT_VERBS. Deliberately duplicated
 * rather than imported: `validator.ts` is off-limits for editing and exports the
 * verbs only behind `sourceDirection()`, which classifies a whole message. If a
 * verb is added there, add it here — a divergence costs coverage (a recipe is
 * refused), never correctness (a mismatch fails verification).
 */
const DEBIT_VERBS = [
  'debited', 'debit', 'spent', 'paid', 'withdrawn', 'sent', 'purchased', 'purchase', 'deducted',
];
const CREDIT_VERBS = [
  'credited', 'credit', 'received', 'deposited', 'refunded', 'refund', 'reversal', 'cashback',
];

/**
 * MIRRORS `validator.ts` BALANCE_LABELS. Used to refuse an amount occurrence
 * that sits behind a balance/limit label — the "available balance is not the
 * amount" bug, caught before it is ever baked into a recipe.
 */
const BALANCE_LABELS = [
  'avl bal', 'avl.bal', 'available balance', 'available bal', 'avbl bal', 'avl lmt',
  'available limit', 'avl limit', 'a/c bal', 'ac bal', 'account balance',
  'closing balance', 'closing bal', 'bal', 'balance', 'credit limit', 'cr limit',
  'total due', 'min due', 'minimum due', 'outstanding',
];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** token (lowercased, punctuation-stripped) → ISO currency code. */
const CURRENCY_TOKENS: Record<string, string> = {
  '\u20b9': 'INR', 'rs': 'INR', 'inr': 'INR',
  '$': 'USD', '\u00a3': 'GBP', '\u20ac': 'EUR',
};

// ═══════════════════════════════════════════════════════════════════════════
//  Value patterns — CONSTANTS. A value never becomes a literal.
// ═══════════════════════════════════════════════════════════════════════════

const AMOUNT_VALUE = '\\b([0-9][0-9,]{0,18}(?:\\.[0-9]{1,2})?)';
const MASK_VALUE = '\\b[Xx*]{0,6}([0-9]{4})\\b';
const REF_VALUE = '\\b([A-Za-z0-9][A-Za-z0-9/_-]{2,39})';
const MERCHANT_TOKEN_VALUE = "\\b([A-Za-z0-9][A-Za-z0-9._&'-]{0,48})";
const MERCHANT_PHRASE_VALUE = "\\b([A-Za-z0-9][A-Za-z0-9 ._&'-]{0,48}?)";

/** Ordered most-specific first — the first one that normalises to the expected
 *  ISO date wins. Day-first only (Indian bank traffic); a mm-dd format simply
 *  fails verification and the date locator is refused. */
const DATE_VALUES: string[] = [
  '\\b([0-9]{4}-[0-9]{2}-[0-9]{2})\\b',                        // 2025-08-14
  '\\b([0-9]{1,2}[-/.][0-9]{1,2}[-/.][0-9]{2,4})\\b',          // 14-08-25 / 14/08/2025
  '\\b([0-9]{1,2}[-\\s]?[A-Za-z]{3,9}[-\\s]?[0-9]{2,4})\\b',   // 05-Sep-25 / 05 Sep 2025
  '\\b([0-9]{1,2}[-\\s]?[A-Za-z]{3,9})\\b',                    // 05-Sep
  '\\b([0-9]{1,2}[-/.][0-9]{1,2})\\b',                         // 14-08
];

const DIRECTION_VALUE = (() => {
  const alts = DEBIT_VERBS.concat(CREDIT_VERBS)
    .slice()
    .sort((a, b) => b.length - a.length);
  return `\\b(${alts.join('|')})\\b`;
})();

const CURRENCY_VALUE = (() => {
  const codes = Array.from(KNOWN_CURRENCIES).sort();
  const alts = ['[\\u20b9$\\u00a3\\u20ac]', '\\bRs\\.?']
    .concat(codes.map(c => `\\b${c}\\b`));
  return `(${alts.join('|')})`;
})();

// ═══════════════════════════════════════════════════════════════════════════
//  Small pure helpers
// ═══════════════════════════════════════════════════════════════════════════

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const pad4 = (n: number) => `000${n}`.slice(-4);

/** Case/punctuation-insensitive comparison for label-ish fields. */
const softEq = (a: string, b: string) =>
  a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '');

function clampText(raw: unknown): string {
  return typeof raw === 'string' ? raw.slice(0, MAX_TEXT) : '';
}

/**
 * Is this literal safe to bake into a globally-shared recipe? Yes exactly when
 * `smsSkeleton()` leaves it alone — i.e. it is part of the shared structural
 * vocabulary the signature itself already exposes. Household data ('uday',
 * 'swiggy', 'hdfc') is masked to 'W' and therefore refused.
 */
function isStructuralWord(w: string): boolean {
  if (!w) return false;
  return smsSkeleton(w) === w.toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════════
//  Pattern safety — the privacy assertion, re-checked on the finished string
// ═══════════════════════════════════════════════════════════════════════════

/**
 * True when a pattern contains STRUCTURE ONLY:
 *   • no literal digit outside a character class or a `{m,n}` quantifier
 *     (a digit literal is, by construction, a copied value);
 *   • every literal word is either shared structural vocabulary or an ISO
 *     currency code.
 * Exported so the tests can assert the invariant on every stored locator.
 */
export function isStructuralPattern(pattern: string): boolean {
  if (typeof pattern !== 'string' || pattern.length === 0 || pattern.length > MAX_PATTERN) return false;
  let inClass = false;
  let inBrace = false;
  const literals: string[] = [];
  let cur = '';
  const flush = () => { if (cur) { literals.push(cur); cur = ''; } };

  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern.charAt(i);
    if (ch === '\\') { flush(); i += 1; continue; }          // \d \s \b … never a literal
    if (inClass) { if (ch === ']') inClass = false; continue; }
    if (inBrace) { if (ch === '}') inBrace = false; continue; }
    if (ch === '[') { flush(); inClass = true; continue; }
    if (ch === '{') { flush(); inBrace = true; continue; }
    if (ch >= '0' && ch <= '9') return false;                 // a leaked digit
    if (/[A-Za-z]/.test(ch)) { cur += ch; continue; }
    flush();
  }
  flush();

  for (const w of literals) {
    if (KNOWN_CURRENCIES.has(w.toUpperCase())) continue;
    if (w.toUpperCase() === 'RS') continue;
    if (!isStructuralWord(w)) return false;
  }
  return true;
}

/** Defensive shape check for a recipe loaded from JSON/DB. */
export function isRecipeShape(x: unknown): x is SmsRecipe {
  if (!x || typeof x !== 'object') return false;
  const r = x as Partial<SmsRecipe>;
  if (typeof r.signature !== 'string' || r.signature.length === 0) return false;
  if (typeof r.version !== 'number') return false;
  if (!Array.isArray(r.locators) || r.locators.length === 0) return false;
  if (typeof r.confirmations !== 'number' || typeof r.corrections !== 'number') return false;
  for (const l of r.locators) {
    if (!l || typeof l !== 'object') return false;
    const f = l as Partial<FieldLocator>;
    if (typeof f.field !== 'string' || !isRecipeField(f.field)) return false;
    if (typeof f.pattern !== 'string' || f.pattern.length === 0 || f.pattern.length > MAX_PATTERN) return false;
    if (typeof f.group !== 'number' || !isFinite(f.group) || f.group < 0 || f.group > 9) return false;
  }
  return true;
}

function isRecipeField(f: string): f is RecipeField {
  return f === 'amount' || f === 'currency' || f === 'direction'
    || f === 'accountMask' || f === 'date' || f === 'merchant' || f === 'refId';
}

// ═══════════════════════════════════════════════════════════════════════════
//  Transforms
// ═══════════════════════════════════════════════════════════════════════════

function transformAmount(s: string): number | undefined {
  const cleaned = s.replace(/[^0-9.]/g, '');
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(cleaned)) return undefined;
  const n = Number(cleaned);
  return isFinite(n) && n > 0 ? n : undefined;
}

function isoDate(y: number, m: number, d: number): string | undefined {
  if (!(m >= 1 && m <= 12) || !(d >= 1 && d <= 31) || !(y >= 1970 && y <= 2999)) return undefined;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return undefined;
  return `${pad4(y)}-${pad2(m)}-${pad2(d)}`;
}

/**
 * A bank SMS is frequently year-less ("on 14-08"). Assume the current year and
 * step back one when that would land in the future — a bank SMS is never for
 * tomorrow. This is the ONE clock-dependent step in the module; it is why a
 * year-less date locator can, at a year boundary, disagree with the model's
 * original reading (in which case derivation refuses it).
 */
function inferYear(month: number, day: number, now: Date): number {
  const y = now.getUTCFullYear();
  const guess = Date.UTC(y, month - 1, day);
  return guess > now.getTime() + 36 * 3600 * 1000 ? y - 1 : y;
}

/**
 * Day-first natural date string → ISO `yyyy-mm-dd`. Handles `14-08-25`,
 * `14/08/2025`, `05-Sep-25`, `05 Sep`, `14-08`, and passes ISO through.
 * (The transform id in the contract is `date_ddmm`; it covers all day-first
 * shapes, not only the numeric one.)
 */
function transformDate(s: string, now: Date): string | undefined {
  const t = s.trim();

  let m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(t);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));

  m = /^([0-9]{1,2})[-/.]([0-9]{1,2})(?:[-/.]([0-9]{2,4}))?$/.exec(t);
  if (m) {
    const day = Number(m[1]);
    const mon = Number(m[2]);
    const year = m[3] === undefined ? inferYear(mon, day, now) : normaliseYear(Number(m[3]));
    return isoDate(year, mon, day);
  }

  m = /^([0-9]{1,2})[-\s]?([A-Za-z]{3,9})(?:[-\s]?([0-9]{2,4}))?$/.exec(t);
  if (m) {
    const day = Number(m[1]);
    const mon = MONTHS[m[2].toLowerCase()];
    if (!mon) return undefined;
    const year = m[3] === undefined ? inferYear(mon, day, now) : normaliseYear(Number(m[3]));
    return isoDate(year, mon, day);
  }
  return undefined;
}

function normaliseYear(y: number): number {
  if (y >= 1000) return y;
  if (y >= 100) return y;          // nonsense — isoDate() will reject it
  return 2000 + y;
}

function applyTransform(value: string, transform: FieldLocator['transform'], now: Date): string | number | undefined {
  const v = (value || '').slice(0, MAX_VALUE_CHARS);
  switch (transform) {
    case 'amount': return transformAmount(v);
    case 'date_ddmm': return transformDate(v, now);
    case 'upper': return v.trim().toUpperCase();
    case 'digits': return v.replace(/[^0-9]/g, '');
    case 'trim':
    default: return v.trim().replace(/[\s.,;:_-]+$/, '');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Field-specific normalisation on apply
//
//  Two fields cannot be expressed by the contract's transform union without
//  baking a VALUE into the pattern, so they are normalised here instead:
//   • direction — the pattern matches the shared VERB vocabulary and the verb is
//     classified into debit/credit, so one constant pattern serves both
//     polarities and nothing message-specific is stored;
//   • currency  — the pattern matches the shared CURRENCY vocabulary and the
//     token is mapped to its ISO code ('Rs.' → 'INR').
// ═══════════════════════════════════════════════════════════════════════════

function classifyDirection(verb: string): Direction | undefined {
  const v = verb.trim().toLowerCase();
  if (DEBIT_VERBS.indexOf(v) >= 0) return 'debit';
  if (CREDIT_VERBS.indexOf(v) >= 0) return 'credit';
  return undefined;
}

function normaliseCurrency(token: string): string | undefined {
  const t = token.trim().toLowerCase().replace(/[.\s]/g, '');
  if (CURRENCY_TOKENS[t]) return CURRENCY_TOKENS[t];
  const up = t.toUpperCase();
  return KNOWN_CURRENCIES.has(up) ? up : undefined;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Tokenisation — anchors are built from UNITS, never from raw slices
// ═══════════════════════════════════════════════════════════════════════════

type UnitKind = 'word' | 'digits' | 'punct';
interface Unit { text: string; start: number; end: number; kind: UnitKind }
interface Span { start: number; end: number }

const UNIT_RE = /[A-Za-z]+|[0-9][0-9,]*(?:\.[0-9]+)?|[^\sA-Za-z0-9]+/g;

function unitsOf(text: string): Unit[] {
  const out: Unit[] = [];
  UNIT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UNIT_RE.exec(text)) !== null) {
    const t = m[0];
    const kind: UnitKind = /^[A-Za-z]/.test(t) ? 'word' : (/^[0-9]/.test(t) ? 'digits' : 'punct');
    out.push({ text: t, start: m.index, end: m.index + t.length, kind });
  }
  return out;
}

const overlaps = (u: Unit, spans: Span[]) =>
  spans.some(s => u.start < s.end && u.end > s.start);

/** An anchor unit must carry NO household data and NO digits. */
function admissibleAnchor(u: Unit, spans: Span[]): boolean {
  if (overlaps(u, spans)) return false;
  if (u.kind === 'digits') return false;
  if (u.kind === 'punct') return u.text.length <= 3;
  return isStructuralWord(u.text);
}

function literalFrom(text: string, units: Unit[]): string {
  let out = '';
  for (let i = 0; i < units.length; i++) {
    if (i > 0) {
      const gap = text.slice(units[i - 1].end, units[i].start);
      out += /\s/.test(gap) ? '\\s+' : '\\s*';
    }
    out += escapeRe(units[i].text);
  }
  return out;
}

/** Anchor levels walking LEFT from the value, longest first (most context wins). */
function prefixLevels(text: string, units: Unit[], spans: Span[], valueStart: number): Unit[][] {
  const chosen: Unit[] = [];
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.end > valueStart) continue;
    if (chosen.length >= MAX_ANCHOR_UNITS) break;
    if (!admissibleAnchor(u, spans)) break;
    chosen.unshift(u);
  }
  const levels: Unit[][] = [];
  for (let k = chosen.length; k >= 1; k--) levels.push(chosen.slice(chosen.length - k));
  // An anchor made only of punctuation carries no structure worth keeping.
  return levels.filter(l => l.some(u => u.kind === 'word'));
}

/** Anchor levels walking RIGHT from the value, longest first. */
function suffixLevels(text: string, units: Unit[], spans: Span[], valueEnd: number): Unit[][] {
  const chosen: Unit[] = [];
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.start < valueEnd) continue;
    if (chosen.length >= MAX_SUFFIX_UNITS) break;
    if (!admissibleAnchor(u, spans)) break;
    chosen.push(u);
  }
  const levels: Unit[][] = [];
  for (let k = chosen.length; k >= 1; k--) levels.push(chosen.slice(0, k));
  return levels.filter(l => l.some(u => u.kind === 'word'));
}

function prefixPattern(text: string, units: Unit[], valueStart: number): string {
  const lit = literalFrom(text, units);
  const gap = text.slice(units[units.length - 1].end, valueStart);
  const lead = /^[A-Za-z0-9]/.test(units[0].text) ? '\\b' : '';
  return lead + lit + (/\s/.test(gap) ? '\\s+' : '\\s*');
}

function suffixPattern(text: string, units: Unit[], valueEnd: number): string {
  const lit = literalFrom(text, units);
  const gap = text.slice(valueEnd, units[0].start);
  const tail = /[A-Za-z0-9]$/.test(units[units.length - 1].text) ? '\\b' : '';
  return (/\s/.test(gap) ? '\\s+' : '\\s*') + lit + tail;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Locator search — build, then PROVE it reproduces the value
// ═══════════════════════════════════════════════════════════════════════════

type Verify = (matched: string, m: RegExpExecArray, text: string) => boolean;

function tryPattern(
  field: RecipeField,
  pattern: string,
  transform: FieldLocator['transform'],
  text: string,
  verify: Verify,
): FieldLocator | null {
  if (pattern.length > MAX_PATTERN) return null;
  if (!isStructuralPattern(pattern)) return null;
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'i');
  } catch {
    return null;
  }
  const m = re.exec(text);
  if (!m || typeof m[1] !== 'string') return null;
  if (!verify(m[1], m, text)) return null;
  return { field, pattern, flags: 'i', group: 1, transform };
}

/**
 * Build an anchored locator for a value at [start,end). Tries, in order:
 * longest prefix anchor → prefix+suffix → suffix only. The FIRST pattern that
 * reproduces the expected value wins; if none does, the field has no locator.
 */
function searchLocator(
  field: RecipeField,
  text: string,
  units: Unit[],
  spans: Span[],
  start: number,
  end: number,
  valuePattern: string,
  transform: FieldLocator['transform'],
  verify: Verify,
  requireSuffix = false,
): FieldLocator | null {
  const pres = prefixLevels(text, units, spans, start);
  const sufs = suffixLevels(text, units, spans, end);

  if (!requireSuffix) {
    for (const p of pres) {
      const hit = tryPattern(field, prefixPattern(text, p, start) + valuePattern, transform, text, verify);
      if (hit) return hit;
    }
  }
  for (const p of pres) {
    for (const s of sufs) {
      const pattern = prefixPattern(text, p, start) + valuePattern + suffixPattern(text, s, end);
      const hit = tryPattern(field, pattern, transform, text, verify);
      if (hit) return hit;
    }
  }
  for (const s of sufs) {
    const hit = tryPattern(field, valuePattern + suffixPattern(text, s, end), transform, text, verify);
    if (hit) return hit;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Value location — where does each extracted field actually live in the text?
// ═══════════════════════════════════════════════════════════════════════════

const NUMBER_RE = /[0-9][0-9,]*(?:\.[0-9]{1,2})?/g;

/** Is this occurrence sitting behind an "Avl Bal"-style label? */
function behindBalanceLabel(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 32), index).toLowerCase();
  return BALANCE_LABELS.some(l => before.indexOf(l) >= 0);
}

/**
 * Every occurrence of the amount in the text.
 *  `all`   — all of them, so anchors can avoid every one (they are all "the value").
 *  `clean` — only those NOT sitting behind an "Avl Bal"-style label; a recipe is
 *            only ever anchored on one of these. If none are clean, the number we
 *            were handed is the balance and there is nothing safe to learn.
 */
function amountOccurrences(text: string, amount: number): { all: Span[]; clean: Span[] } {
  const all: Span[] = [];
  const clean: Span[] = [];
  NUMBER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUMBER_RE.exec(text)) !== null) {
    const n = Number(m[0].replace(/,/g, ''));
    if (!isFinite(n) || Math.abs(n - amount) >= 0.005) continue;
    const span = { start: m.index, end: m.index + m[0].length };
    all.push(span);
    if (!behindBalanceLabel(text, m.index)) clean.push(span);
  }
  return { all, clean };
}

function maskSpan(text: string, mask: string): Span | null {
  const re = new RegExp(`\\b[Xx*]{0,6}${escapeRe(mask)}\\b`);
  const m = re.exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

function literalSpan(text: string, value: string): Span | null {
  const i = text.toLowerCase().indexOf(value.trim().toLowerCase());
  return i < 0 ? null : { start: i, end: i + value.trim().length };
}

/** The date substring (and its pattern) that normalises to the expected ISO date. */
function dateSpan(text: string, expected: string, now: Date): { span: Span; source: string } | null {
  for (const source of DATE_VALUES) {
    let re: RegExp;
    try {
      re = new RegExp(source, 'gi');
    } catch {
      continue;
    }
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex += 1; continue; }
      if (transformDate(m[1], now) === expected) {
        return { span: { start: m.index, end: m.index + m[0].length }, source };
      }
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
//  deriveRecipe
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a recipe by LOCATING each extracted value inside its source text.
 * Returns null when the fields cannot be located reliably — never guesses.
 *
 * Policy, stated once:
 *  • `amount` is mandatory. No amount in the candidate, or an amount that is not
 *    findable in the source, ⇒ null.
 *  • STRICT_FIELDS present in the candidate but not locatable ⇒ null.
 *  • `currency` / `merchant` not locatable ⇒ the locator is simply omitted; they
 *    are labels, and burning a model call forever over a cosmetic field defeats
 *    the point of the cache.
 *  • ANY locator that fails to round-trip ⇒ null, always.
 */
export function deriveRecipe(
  rawText: string,
  candidate: ExtractionCandidate,
  signature: string,
): SmsRecipe | null {
  const text = clampText(rawText);
  if (!text || typeof signature !== 'string' || signature.length === 0) return null;
  if (!candidate || typeof candidate !== 'object') return null;

  const amount = candidate.amount;
  if (typeof amount !== 'number' || !isFinite(amount) || amount <= 0) return null;

  const now = new Date();
  const units = unitsOf(text);

  // ── pass 1: where does every value live? (spans first, so anchors can avoid
  //    every one of them — an anchor must never be somebody's merchant name) ──
  const amountSpans = amountOccurrences(text, amount);
  if (amountSpans.clean.length === 0) return null;

  // NOTE what is and is not a "value span". `direction` and `currency` are read
  // from SHARED vocabulary ('debited', 'Rs.') — those tokens are structure, are
  // already published by the signature, and are the best anchors in the message,
  // so they are deliberately NOT fenced off. Everything household-specific is.
  const spans: Span[] = amountSpans.all.slice();

  const mask = typeof candidate.accountMask === 'string' ? candidate.accountMask.trim() : '';
  const mSpan = /^[0-9]{4}$/.test(mask) ? maskSpan(text, mask) : null;
  if (mSpan) spans.push(mSpan);

  const dateHit = typeof candidate.date === 'string' && candidate.date
    ? dateSpan(text, candidate.date, now)
    : null;
  if (dateHit) spans.push(dateHit.span);

  const merchant = typeof candidate.merchant === 'string' ? candidate.merchant.trim() : '';
  const merSpan = merchant ? literalSpan(text, merchant) : null;
  if (merSpan) spans.push(merSpan);

  const refId = typeof candidate.refId === 'string' ? candidate.refId.trim() : '';
  const refSpan = refId ? literalSpan(text, refId) : null;
  if (refSpan) spans.push(refSpan);

  const locators: FieldLocator[] = [];
  const strictMissing = (f: RecipeField) => STRICT_FIELDS.indexOf(f) >= 0;

  // ── amount ────────────────────────────────────────────────────────────────
  let amountLocator: FieldLocator | null = null;
  for (const occ of amountSpans.clean) {
    amountLocator = searchLocator(
      'amount', text, units, spans, occ.start, occ.end, AMOUNT_VALUE, 'amount',
      (matched, m) => {
        const n = transformAmount(matched);
        if (n === undefined || Math.abs(n - amount) >= 0.005) return false;
        // Never learn a pattern that reads the available balance. Anchors are
        // digit-free by construction, so the last occurrence of the group inside
        // the match IS the value — that is the position we test.
        const valueAt = m.index + m[0].lastIndexOf(matched);
        return !behindBalanceLabel(text, valueAt);
      },
    );
    if (amountLocator) break;
  }
  if (!amountLocator) return null;
  locators.push(amountLocator);

  // ── direction — one CONSTANT pattern over the shared verb vocabulary ───────
  if (candidate.direction) {
    const hit = tryPattern('direction', DIRECTION_VALUE, 'trim', text,
      matched => classifyDirection(matched) === candidate.direction);
    if (!hit) return null;                       // strict: a wrong sign is a wrong ledger
    locators.push(hit);
  }

  // ── currency — one CONSTANT pattern over the shared currency vocabulary ────
  if (candidate.currency) {
    const want = String(candidate.currency).toUpperCase();
    const hit = tryPattern('currency', CURRENCY_VALUE, 'upper', text,
      matched => normaliseCurrency(matched) === want);
    if (hit) locators.push(hit);                 // best-effort: a label, not money
  }

  // ── account mask ──────────────────────────────────────────────────────────
  if (candidate.accountMask != null && String(candidate.accountMask).trim() !== '') {
    if (!mSpan) return null;
    const hit = searchLocator(
      'accountMask', text, units, spans, mSpan.start, mSpan.end, MASK_VALUE, 'digits',
      matched => matched.replace(/[^0-9]/g, '') === mask,
    );
    if (!hit && strictMissing('accountMask')) return null;
    if (hit) locators.push(hit);
  }

  // ── date ──────────────────────────────────────────────────────────────────
  if (candidate.date) {
    if (!dateHit) return null;
    const hit = searchLocator(
      'date', text, units, spans, dateHit.span.start, dateHit.span.end, dateHit.source, 'date_ddmm',
      matched => transformDate(matched, now) === candidate.date,
    );
    if (!hit && strictMissing('date')) return null;
    if (hit) locators.push(hit);
  }

  // ── merchant ──────────────────────────────────────────────────────────────
  if (merchant && merSpan) {
    const phrase = /\s/.test(text.slice(merSpan.start, merSpan.end));
    const hit = searchLocator(
      'merchant', text, units, spans, merSpan.start, merSpan.end,
      phrase ? MERCHANT_PHRASE_VALUE : MERCHANT_TOKEN_VALUE, 'trim',
      matched => softEq(matched, merchant),
      phrase,                                     // a multi-word merchant needs a terminator
    );
    if (hit) locators.push(hit);                  // best-effort: cosmetic
  }

  // ── refId ─────────────────────────────────────────────────────────────────
  if (refId) {
    if (!refSpan) return null;
    const hit = searchLocator(
      'refId', text, units, spans, refSpan.start, refSpan.end, REF_VALUE, 'trim',
      matched => softEq(matched, refId),
    );
    if (!hit && strictMissing('refId')) return null;
    if (hit) locators.push(hit);
  }

  const recipe: SmsRecipe = {
    signature,
    version: RECIPE_FORMAT_VERSION,
    locators,
    createdAt: now.toISOString(),
    confirmations: 0,
    corrections: 0,
  };

  // ── SELF-VERIFICATION: apply the finished recipe back to its own source ────
  // Anything short of a full round-trip is a recipe we refuse to store.
  const replay = applyRecipe(recipe, text);
  if (!replay.ok) return null;
  const got = replay.candidate;
  if (got.amount === undefined || Math.abs(got.amount - amount) >= 0.005) return null;
  if (candidate.direction && got.direction !== candidate.direction) return null;
  if (has(locators, 'currency') && String(got.currency) !== String(candidate.currency).toUpperCase()) return null;
  if (has(locators, 'accountMask') && got.accountMask !== mask) return null;
  if (has(locators, 'date') && got.date !== candidate.date) return null;
  if (has(locators, 'merchant') && !(got.merchant && softEq(got.merchant, merchant))) return null;
  if (has(locators, 'refId') && !(got.refId && softEq(got.refId, refId))) return null;

  // ── PRIVACY: belt and braces on every stored pattern ──────────────────────
  for (const l of recipe.locators) {
    if (!isStructuralPattern(l.pattern)) return null;
  }

  return recipe;
}

const has = (locators: FieldLocator[], f: RecipeField) => locators.some(l => l.field === f);

// ═══════════════════════════════════════════════════════════════════════════
//  applyRecipe
// ═══════════════════════════════════════════════════════════════════════════

function sanitiseFlags(f: unknown): string {
  const allowed = 'imsu';                    // never 'g'/'y' — stateful lastIndex
  let out = '';
  const src = typeof f === 'string' ? f : '';
  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    if (allowed.indexOf(ch) >= 0 && out.indexOf(ch) < 0) out += ch;
  }
  return out;
}

function runLocator(l: FieldLocator, text: string): string | undefined {
  if (l.pattern.length > MAX_PATTERN) return undefined;
  let re: RegExp;
  try {
    re = new RegExp(l.pattern, sanitiseFlags(l.flags));
  } catch {
    return undefined;
  }
  const m = re.exec(text);
  if (!m) return undefined;
  const g = m[l.group];
  return typeof g === 'string' && g.length > 0 ? g : undefined;
}

function fail(
  reason: NonNullable<ExtractionResult['reason']>,
  candidate: ExtractionCandidate,
  signature?: string,
): ExtractionResult {
  const out: ExtractionResult = { ok: false, candidate, extractor: 'recipe', confidence: 0, reason };
  if (signature) out.recipeSignature = signature;
  return out;
}

/**
 * Apply a stored recipe deterministically. Zero tokens, zero latency.
 *
 * NEVER FABRICATES: a locator that does not match leaves its field ABSENT. A
 * missing amount is `ok:false` + `reason:'no_amount'`; a direction locator that
 * stops matching (the classic bank-changed-its-wording signal) is
 * `reason:'no_direction'`. Output still goes through `validator.ts` at the call
 * site.
 */
export function applyRecipe(recipe: SmsRecipe, rawText: string): ExtractionResult {
  const text = clampText(rawText);
  if (!isRecipeShape(recipe)) return fail('not_parseable', {});
  if (recipe.version !== RECIPE_FORMAT_VERSION) return fail('not_parseable', {}, recipe.signature);
  if (!text) return fail('not_parseable', {}, recipe.signature);
  if (!has(recipe.locators, 'amount')) return fail('not_parseable', {}, recipe.signature);

  const now = new Date();
  const candidate: ExtractionCandidate = {};
  let misses = 0;
  let amountLocated = false;
  let directionLocated = false;
  let wantsDirection = false;

  for (const l of recipe.locators) {
    if (l.field === 'direction') wantsDirection = true;
    const raw = runLocator(l, text);
    if (raw === undefined) { misses += 1; continue; }
    const value = applyTransform(raw, l.transform, now);
    if (value === undefined || value === '') { misses += 1; continue; }

    switch (l.field) {
      case 'amount': {
        if (typeof value === 'number' && value > 0) { candidate.amount = value; amountLocated = true; }
        else misses += 1;
        break;
      }
      case 'currency': {
        const iso = normaliseCurrency(String(value));
        if (iso) candidate.currency = iso; else misses += 1;
        break;
      }
      case 'direction': {
        const dir = classifyDirection(String(raw));
        if (dir) { candidate.direction = dir; directionLocated = true; } else misses += 1;
        break;
      }
      case 'accountMask': {
        const digits = String(value).replace(/[^0-9]/g, '');
        if (/^[0-9]{4}$/.test(digits)) candidate.accountMask = digits; else misses += 1;
        break;
      }
      case 'date': {
        if (typeof value === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) candidate.date = value;
        else misses += 1;
        break;
      }
      case 'merchant': {
        const s = String(value).trim().slice(0, MAX_VALUE_CHARS);
        if (s) candidate.merchant = s; else misses += 1;
        break;
      }
      case 'refId': {
        const s = String(value).trim().slice(0, MAX_VALUE_CHARS);
        if (s) candidate.refId = s; else misses += 1;
        break;
      }
    }
  }

  // Provenance, not extraction: the source message, treated as DATA.
  candidate.description = text.trim().slice(0, 280);

  if (!amountLocated) return fail('no_amount', candidate, recipe.signature);
  if (wantsDirection && !directionLocated) return fail('no_direction', candidate, recipe.signature);

  const base = shouldTrustRecipe(recipe) ? RECIPE_CONFIDENCE.trusted : RECIPE_CONFIDENCE.untrusted;
  const confidence = Math.max(RECIPE_CONFIDENCE.floor, base - misses * RECIPE_CONFIDENCE.missPenalty);

  return {
    ok: true,
    candidate,
    extractor: 'recipe',
    confidence,
    recipeSignature: recipe.signature,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Trust management — learned from real usage, not from a config flag
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Is this recipe trusted enough for the deterministic (write-eligible) path?
 * A fresh recipe is USABLE but NOT trusted — its drafts still need confirming.
 * Corrections demote: they are the only signal that a bank quietly changed its
 * format, so they weigh far more than confirmations.
 */
export function shouldTrustRecipe(recipe: SmsRecipe): boolean {
  if (!isRecipeShape(recipe)) return false;
  if (recipe.version !== RECIPE_FORMAT_VERSION) return false;
  if (!has(recipe.locators, 'amount')) return false;

  const confirmations = Math.max(0, Math.floor(recipe.confirmations));
  const corrections = Math.max(0, Math.floor(recipe.corrections));

  if (corrections >= RECIPE_TRUST.hardCorrectionLimit) return false;
  if (confirmations < RECIPE_TRUST.minConfirmations) return false;

  const total = confirmations + corrections;
  if (total === 0) return false;
  return corrections / total <= RECIPE_TRUST.maxCorrectionRatio;
}

/**
 * Record a real outcome. PURE — returns a new recipe, never mutates the input
 * (recipes are shared rows; a caller holding a stale object must not see it move
 * under them).
 */
export function recordOutcome(recipe: SmsRecipe, outcome: 'confirmed' | 'corrected'): SmsRecipe {
  const confirmations = Math.max(0, Math.floor(recipe.confirmations || 0));
  const corrections = Math.max(0, Math.floor(recipe.corrections || 0));
  return {
    signature: recipe.signature,
    version: recipe.version,
    locators: recipe.locators.slice(),
    createdAt: recipe.createdAt,
    confirmations: outcome === 'confirmed' ? confirmations + 1 : confirmations,
    corrections: outcome === 'corrected' ? corrections + 1 : corrections,
  };
}
