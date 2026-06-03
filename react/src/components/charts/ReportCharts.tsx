import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtShort, fmt } from '../../lib/format';
import { getCat } from '../../constants';

const hsl = (name: string) => `hsl(var(--${name}))`;

interface PeriodPoint {
  label: string;
  income: number;
  expense: number;
  net: number;
}

interface ChartProps {
  data: PeriodPoint[];
  currency: string;
}

interface CategoryEntry {
  catId: string;
  amount: number;
}

interface CategoryChartProps {
  data: CategoryEntry[];
  currency: string;
}

export function IncomeExpenseArea({ data, currency }: ChartProps) {
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
            tickFormatter={(value: number) => fmtShort(value, currency)}
            width={50}
          />
          <Tooltip formatter={(value: number, name: string) => [fmt(value, currency), name]} />
          <Legend iconType="circle" />
          <Area type="monotone" dataKey="income" name="Income" stroke={hsl('sage')} strokeWidth={2.2} fill="url(#incomeGrad)" />
          <Area type="monotone" dataKey="expense" name="Expense" stroke={hsl('terra')} strokeWidth={2.2} fill="url(#expenseGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function NetBarChart({ data, currency }: ChartProps) {
  return (
    <div className="px-4 pt-4 pb-2 h-[230px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 3" stroke={hsl('line')} vertical={false} />
          <XAxis dataKey="label" stroke={hsl('ink-dim')} tick={{ fontSize: 10 }} />
          <YAxis
            stroke={hsl('ink-dim')}
            tick={{ fontSize: 10 }}
            tickFormatter={(value: number) => fmtShort(value, currency)}
            width={50}
          />
          <Tooltip formatter={(value: number) => fmt(value, currency)} />
          <Bar dataKey="net" name="Net" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.net >= 0 ? hsl('sage') : hsl('terra')} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBars({ data, currency }: CategoryChartProps) {
  if (!data.length) {
    return <div className="text-center py-9 text-ink-dim font-mono text-xs uppercase tracking-wider">No data</div>;
  }
  const sorted = [...data].sort((left, right) => right.amount - left.amount).slice(0, 8);
  const max = sorted[0].amount;
  return (
    <div className="py-2">
      {sorted.map(entry => {
        const category = getCat(entry.catId);
        const width = Math.round(entry.amount / max * 100);
        return (
          <div key={entry.catId} className="grid grid-cols-[130px_1fr_76px] items-center gap-2.5 px-4 py-2 border-b border-line last:border-b-0">
            <div className="text-[0.76rem] text-ink-mid truncate">
              {category.icon} {category.label}
            </div>
            <div className="bg-bg3 h-1.5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{ width: `${width}%`, background: category.color }}
              />
            </div>
            <div className="font-mono text-[0.66rem] text-ink-mid text-right">{fmtShort(entry.amount, currency)}</div>
          </div>
        );
      })}
    </div>
  );
}