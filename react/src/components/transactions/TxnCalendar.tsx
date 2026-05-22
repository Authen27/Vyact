import { useMemo } from 'react';
import type { Transaction } from '../../types';

interface TxnCalendarProps {
  transactions: Transaction[];
  month: string; // YYYY-MM
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad2 = (n: number) => String(n).padStart(2, '0');

// A compact month grid showing which days have a (non-private) expense logged
// vs. missed. Native Date only — no extra dependency. Display-only.
export default function TxnCalendar({ transactions, month }: TxnCalendarProps) {
  const { leading, daysInMonth } = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    return {
      leading: new Date(y, m - 1, 1).getDay(), // 0=Sun … 6=Sat
      daysInMonth: new Date(y, m, 0).getDate(),
    };
  }, [month]);

  // Days that have at least one expense that counts (private/excluded don't).
  const expenseDays = useMemo(
    () => new Set(transactions.filter(t => t.type === 'expense' && !t.excluded).map(t => t.date)),
    [transactions],
  );

  const loggedCount = useMemo(() => {
    let n = 0;
    for (let d = 1; d <= daysInMonth; d++) if (expenseDays.has(`${month}-${pad2(d)}`)) n++;
    return n;
  }, [expenseDays, daysInMonth, month]);

  return (
    <div className="bg-bg3 rounded-md border border-line mb-6 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="mono-label">Expense activity</span>
        <span className="font-mono text-[0.62rem] tracking-wider text-ink-dim">
          {loggedCount}/{daysInMonth} days logged
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={`h${i}`} className="h-6 flex items-center justify-center font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim">
            {w}
          </div>
        ))}

        {/* Leading blanks so day 1 lands under its weekday */}
        {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} className="h-9" />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dStr = `${month}-${pad2(d)}`;
          const logged = expenseDays.has(dStr);
          return (
            <div
              key={dStr}
              title={`${dStr}: ${logged ? 'expense logged' : 'no expense logged'}`}
              className={`h-9 flex items-center justify-center rounded font-mono text-[0.82rem] border ${
                logged
                  ? 'bg-sage/20 text-sage border-sage/40'
                  : 'bg-bg text-ink-dim border-line'
              }`}
            >
              {d}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-2.5 font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sage/20 border border-sage/40" /> Expense logged</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-bg border border-line" /> None</span>
      </div>
    </div>
  );
}
