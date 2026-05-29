// FinFlow v6.4 — Money
//
// Adaptive currency renderer that prevents very large or long values from
// breaking adjacent layout (KPI tiles, transaction rows, budget cards).
//
// Behaviour:
//   • By default renders the full value via fmt() with tabular-nums.
//   • If `compact` is requested or the rendered length exceeds `maxChars`,
//     falls back to fmtShort() (e.g. $1.2M, $999K).
//   • Always sets the `title` attribute to the precise value so hover
//     reveals full precision.
//   • Adds `truncate` so a constrained parent still clips gracefully.
//
// Important: the parent flex container should set `min-w-0` so `truncate`
// can take effect inside flex layouts.

import { fmt, fmtShort } from '../../lib/format';

interface Props {
  amount: number;
  currency?: string;
  /** Force compact (K/M/B) rendering regardless of length. */
  compact?: boolean;
  /** Switch to compact when the full string exceeds this many characters. */
  maxChars?: number;
  /** Additional Tailwind classes applied to the wrapping span. */
  className?: string;
  /** Forces a leading sign even for positive numbers (useful for deltas). */
  signed?: boolean;
}

export default function Money({ amount, currency = 'USD', compact, maxChars = 12, className = '', signed }: Props) {
  const n = Number(amount) || 0;
  const full = fmt(n, currency);
  const useShort = compact || full.length > maxChars;
  const shown = useShort ? fmtShort(n, currency) : full;
  const sign = signed && n > 0 ? '+' : '';
  const display = (n < 0 ? '−' : sign) + shown.replace(/^-/, '');
  const titleSign = n < 0 ? '−' : sign;
  const title = `${titleSign}${full.replace(/^-/, '')}`;
  return (
    <span
      className={`num truncate inline-block max-w-full ${className}`}
      title={title}
    >
      {display}
    </span>
  );
}
