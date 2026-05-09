// Recharts-powered chart suite for FinFlow.
//   • IncomeExpenseArea — overlapping area chart (income vs expense over period)
//   • NetBarChart      — bar chart, colored positive/negative
//   • CategoryDonut    — donut/pie with custom legend
//   • CategoryBars     — horizontal bars by category
// All charts inherit theme via CSS vars; themes swap automatically.

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Bar, Cell, PieChart, Pie, ResponsiveContainer,
} from 'recharts';
import { fmtShort, fmt } from '../../lib/format';
import { getCat } from '../../constants';

// HSL-channel helpers — we read CSS variables at render time so charts
// reflect the active theme without a remount.
const hsl = (name: string) => `hsl(var(--${name}))`;

interface PeriodPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

interface Props { data: PeriodPoint[]; currency: string; }

// ── INCOME vs EXPENSE AREA ────────────────────────────────────
export function IncomeExpenseArea({ data, currency }: Props) {
  return (
    <div className="px-4 pt-4 pb-2 h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={hsl('sage')} stopOpacity={0.35} />
              <stop offset="100%" stopColor={hsl('sage')} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={hsl('terra')} stopOpacity={0.30} />
              <stop offset="100%" stopColor={hsl('terra')} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 3" stroke={hsl('line')} />
          <XAxis dataKey="label" stroke={hsl('ink-dim')} tick={{ fontSize: 10 }} />
          <YAxis
            stroke={hsl('ink-dim')}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => fmtShort(v, currency)}
            width={50}
          />
          <Tooltip formatter={(v: number, name: string) => [fmt(v, currency), name]} />
          <Legend iconType="circle" />
          <Area type="monotone" dataKey="income"  name="Income"  stroke={hsl('sage')}  strokeWidth={2.2} fill="url(#incomeGrad)"  />
          <Area type="monotone" dataKey="expense" name="Expense" stroke={hsl('terra')} strokeWidth={2.2} fill="url(#expenseGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── NET BAR CHART ─────────────────────────────────────────────
export function NetBarChart({ data, currency }: Props) {
  return (
    <div className="px-4 pt-4 pb-2 h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 3" stroke={hsl('line')} vertical={false} />
          <XAxis dataKey="label" stroke={hsl('ink-dim')} tick={{ fontSize: 10 }} />
          <YAxis
            stroke={hsl('ink-dim')}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => fmtShort(v, currency)}
            width={50}
          />
          <Tooltip formatter={(v: number) => fmt(v, currency)} />
          <Bar dataKey="net" name="Net" radius={[3, 3, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.net >= 0 ? hsl('sage') : hsl('terra')} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── CATEGORY DONUT ────────────────────────────────────────────
interface DonutEntry { catId: string; amount: number; }
interface DonutProps { data: DonutEntry[]; currency: string; }

export function CategoryDonut({ data, currency }: DonutProps) {
  if (!data.length) {
    return <div className="text-center py-9 text-ink-dim font-mono text-xs uppercase tracking-wider">No data</div>;
  }
  const total = data.reduce((s, d) => s + d.amount, 0);
  const enriched = data.map(d => {
    const cat = getCat(d.catId);
    return { ...d, name: `${cat.icon} ${cat.label}`, color: cat.color };
  });

  return (
    <div className="grid md:grid-cols-[180px_1fr] gap-4 p-4 items-center">
      <div className="h-[180px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={enriched}
              dataKey="amount"
              cx="50%" cy="50%"
              innerRadius={52}
              outerRadius={78}
              paddingAngle={1}
              startAngle={90}
              endAngle={-270}
              isAnimationActive
            >
              {enriched.map((e, i) => (
                <Cell key={i} fill={e.color} stroke="hsl(var(--bg2))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmt(v, currency)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="display-italic text-[1.3rem] leading-none text-ink">{fmtShort(total, currency)}</div>
          <div className="font-mono text-[0.55rem] tracking-[0.14em] uppercase text-ink-dim mt-0.5">Total</div>
        </div>
      </div>
      <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto">
        {enriched.slice(0, 8).map(e => {
          const pct = Math.round(e.amount / total * 100);
          return (
            <div key={e.catId} className="grid grid-cols-[10px_1fr_auto_auto] gap-2 items-center py-1 border-b border-line text-[0.74rem] text-ink-mid">
              <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
              <div className="font-medium text-ink truncate">{e.name}</div>
              <div className="font-mono text-[0.68rem] text-ink">{fmtShort(e.amount, currency)}</div>
              <div className="font-mono text-[0.6rem] text-ink-dim w-8 text-right">{pct}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── HORIZONTAL CATEGORY BARS ──────────────────────────────────
export function CategoryBars({ data, currency }: DonutProps) {
  if (!data.length) {
    return <div className="text-center py-9 text-ink-dim font-mono text-xs uppercase tracking-wider">No data</div>;
  }
  const sorted = [...data].sort((a, b) => b.amount - a.amount).slice(0, 8);
  const max = sorted[0].amount;
  return (
    <div className="py-2">
      {sorted.map(d => {
        const cat = getCat(d.catId);
        const w = Math.round(d.amount / max * 100);
        return (
          <div key={d.catId} className="grid grid-cols-[130px_1fr_76px] items-center gap-2.5 px-4 py-2 border-b border-line last:border-b-0">
            <div className="text-[0.76rem] text-ink-mid truncate">
              {cat.icon} {cat.label}
            </div>
            <div className="bg-bg3 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${w}%`, background: cat.color }}
              />
            </div>
            <div className="font-mono text-[0.66rem] text-ink-mid text-right">{fmtShort(d.amount, currency)}</div>
          </div>
        );
      })}
    </div>
  );
}
