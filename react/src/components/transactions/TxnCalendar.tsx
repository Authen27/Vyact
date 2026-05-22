import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Transaction, RecurringSchedule } from '../../types';
import { nowMonthKey, today, monthName } from '../../lib/format';

interface TxnCalendarProps {
  transactions: Transaction[];          // all transactions (filtered to the viewed month internally)
  schedules?: RecurringSchedule[];      // recurring schedules → projected future payments
  initialMonth?: string;                // YYYY-MM to open on (defaults to current month)
  selectedDate?: string | null;         // currently selected day (YYYY-MM-DD)
  onSelectDate?: (date: string) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const DAY_MS = 86_400_000;

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

// Does a recurring schedule fire on the given day of the viewed month?
function scheduleFiresOn(s: RecurringSchedule, dStr: string, dom: number, ym: string): boolean {
  if (s.active === false) return false;
  if (s.transactionTemplate?.type !== 'expense') return false; // calendar tracks payments
  if (s.startDate && dStr < s.startDate) return false;
  const [sy, sm, sd] = (s.startDate || dStr).split('-').map(Number);
  switch (s.frequency) {
    case 'weekly': {
      const diff = Math.round((Date.parse(dStr) - Date.parse(s.startDate)) / DAY_MS);
      return diff >= 0 && diff % 7 === 0;
    }
    case 'monthly':
    case 'custom_day':
      return dom === (s.dayOfMonth || sd);
    case 'yearly': {
      const [, vm] = ym.split('-').map(Number);
      return vm === sm && dom === sd;
    }
    default:
      return false;
  }
}

export default function TxnCalendar({
  transactions, schedules = [], initialMonth, selectedDate, onSelectDate,
}: TxnCalendarProps) {
  const [viewMonth, setViewMonth] = useState(initialMonth || nowMonthKey());
  const todayStr = today();

  const { leading, daysInMonth } = useMemo(() => {
    const [y, m] = viewMonth.split('-').map(Number);
    return {
      leading: new Date(y, m - 1, 1).getDay(),
      daysInMonth: new Date(y, m, 0).getDate(),
    };
  }, [viewMonth]);

  // Days in the viewed month that have a counted (non-private) expense.
  const expenseDays = useMemo(() => {
    const set = new Set<string>();
    for (const t of transactions) {
      if (t.type === 'expense' && !t.excluded && t.date.startsWith(viewMonth + '-')) set.add(t.date);
    }
    return set;
  }, [transactions, viewMonth]);

  // Future days in the viewed month with a projected recurring payment.
  const projectedDays = useMemo(() => {
    const set = new Set<string>();
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = `${viewMonth}-${pad2(d)}`;
      if (dStr <= todayStr) continue;            // future only
      if (expenseDays.has(dStr)) continue;       // already logged
      if (schedules.some(s => scheduleFiresOn(s, dStr, d, viewMonth))) set.add(dStr);
    }
    return set;
  }, [schedules, daysInMonth, viewMonth, todayStr, expenseDays]);

  const loggedCount = expenseDays.size;

  return (
    <div className="bg-bg3 rounded-md border border-line mb-6 p-3">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth(m => shiftMonth(m, -1))}
          className="p-1 rounded hover:bg-bg2 text-ink-mid hover:text-ink"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <span className="display-italic text-ink text-lg">{monthName(viewMonth)}</span>
          {viewMonth !== nowMonthKey() && (
            <button
              type="button"
              onClick={() => setViewMonth(nowMonthKey())}
              className="font-mono text-[0.56rem] tracking-wider uppercase text-coral hover:underline"
            >
              Today
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setViewMonth(m => shiftMonth(m, 1))}
          className="p-1 rounded hover:bg-bg2 text-ink-mid hover:text-ink"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={`h${i}`} className="h-6 flex items-center justify-center font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim">
            {w}
          </div>
        ))}

        {Array.from({ length: leading }).map((_, i) => <div key={`b${i}`} className="h-9" />)}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const d = i + 1;
          const dStr = `${viewMonth}-${pad2(d)}`;
          const logged = expenseDays.has(dStr);
          const projected = projectedDays.has(dStr);
          const isToday = dStr === todayStr;
          const isSelected = dStr === selectedDate;

          const tone = logged
            ? 'bg-sage/20 text-sage border-sage/40'
            : projected
              ? 'bg-denim/15 text-denim border-denim/40'
              : 'bg-bg text-ink-dim border-line';

          const title = `${dStr}: ${
            logged ? 'expense logged' : projected ? 'upcoming recurring payment' : 'no expense logged'
          }`;

          return (
            <button
              key={dStr}
              type="button"
              onClick={() => onSelectDate?.(dStr)}
              title={title}
              className={`h-9 flex items-center justify-center rounded font-mono text-[0.82rem] border transition-colors hover:brightness-95
                ${tone}
                ${isToday ? 'ring-1 ring-coral ring-offset-1 ring-offset-bg3' : ''}
                ${isSelected ? 'outline outline-2 outline-coral' : ''}
              `}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-2.5 font-mono text-[0.56rem] tracking-wider uppercase text-ink-dim flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-sage/20 border border-sage/40" /> Expense logged</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-denim/15 border border-denim/40" /> Upcoming (recurring)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-bg border border-line" /> None</span>
        <span className="ml-auto normal-case tracking-normal text-ink-dim">{loggedCount}/{daysInMonth} days logged · tap a day to filter</span>
      </div>
    </div>
  );
}
