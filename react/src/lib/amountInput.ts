// W8a (audit FE-UIC-10) — one reader for typed money amounts. Amount fields used to strip every comma,
// so a decimal-comma user's "12,50" was saved as 1250.
// v10.133.0 (Track Q5; FE-UIC-10, owner 20 Oct 2026) — the dot-grouped, comma-decimal form ("1.234,56", "1.234")
// was still read about 1000x too small. One rule for both separators, whatever the household's currency:
//   • the LAST separator (. or ,) followed by one or two digits is the decimal mark: "12,50" → 12.5,
//     "1.234,56" → 1234.56, "1,234.56" → 1234.56, "46." → 46;
//   • a separator followed by exactly three digits is grouping: "1.234" → 1234, "150,000" → 150000,
//     "1,50,000" → 150000 (lakh groups of two between the first group and the last three); a lone "0" before
//     it is a decimal instead ("0.125" → 0.13);
//   • anything else (a last group of four or more digits after a separator, mixed grouping marks, a decimal mark
//     that is also used for grouping, a group of the wrong size) is not an amount: NaN.
// Spaces, non-breaking spaces and apostrophes (1 234,56 · 1'234.56) are grouping too, and are dropped.
// Returns NaN for text that is not an amount (callers already treat NaN / ≤ 0 as "enter an amount").

const GROUPING_SPACES = /[\s\u00a0\u202f'\u2019]+/g;

function readAmount(raw: string | null | undefined): number {
  let s = String(raw ?? '').replace(GROUPING_SPACES, '');
  if (!s) return NaN;
  let sign = '';
  if (s[0] === '-') { sign = '-'; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return NaN;

  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (lastSep < 0) return Number(sign + s);
  const tail = s.slice(lastSep + 1);
  let intPart = s;
  let fraction = '';
  if (tail.length <= 2) {
    // The last separator is the decimal mark when one or two digits (or none: "46.") follow it.
    intPart = s.slice(0, lastSep);
    fraction = tail;
    if (intPart.includes(s[lastSep])) return NaN;           // "1,234,56": the decimal mark is also grouping
  } else if (tail.length !== 3 || /^0+$/.test(s.slice(0, lastSep))) {
    // Four or more digits after the separator, or "0.125": a plain decimal if there is only one separator.
    return /^\d+[.,]\d+$/.test(s) ? Number(`${sign}${s.replace(',', '.')}`) : NaN;
  }

  if (/[.,]/.test(intPart)) {
    if (new Set(intPart.match(/[.,]/g)).size > 1) return NaN; // "1.234,567": two grouping marks
    const groups = intPart.split(/[.,]/);
    const [first, ...rest] = groups;
    if (!/^\d{1,3}$/.test(first) || rest[rest.length - 1].length !== 3) return NaN;
    // Western groups are all three digits; Indian ones are two between the first and the last three.
    const middle = rest.slice(0, -1);
    const western = middle.every(g => g.length === 3);
    const indian = middle.every(g => g.length === 2) && first.length <= 2;
    if (!western && !indian) return NaN;
    intPart = groups.join('');
  }
  if (!intPart && !fraction) return NaN;
  return Number(`${sign}${intPart || '0'}.${fraction || '0'}`);
}

/** A money amount: the typed number to the minor unit (two places), or NaN. */
export function parseAmount(raw: string | null | undefined): number {
  const n = readAmount(raw);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/** A rate or percentage ("8.125", "8,5"): one decimal mark, either one, no grouping, full precision; or NaN. */
export function parseRate(raw: string | null | undefined): number {
  const s = String(raw ?? '').replace(/\s+/g, '');
  return /^-?(\d+([.,]\d*)?|[.,]\d+)$/.test(s) ? Number(s.replace(',', '.')) : NaN;
}
