import { useState, useMemo } from 'react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Card, Panel } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import {
  IncomeExpenseArea, NetBarChart, CategoryDonut, CategoryBars,
} from '../components/charts/Charts';
import {
  reportableTxns, effectiveAmount,
} from '../lib/calculations';
import { fmt, fmtSigned, getMonthKey } from '../lib/format';
import { useCategoryClassifications } from '../lib/categorization';
import Money from '../components/ui/Money';

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year';
const PERIOD_LABELS: Record<Period, string> = { day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year' };
const PERIOD_TITLE: Record<Period, string>  = { day: 'Daily', week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Annual' };

export default function Reports() {
  const { t } = useTranslation();
  const txns = useStore(s => s.transactions);
  const profile = useStore(s => s.profile);
  const rates = useStore(s => s.rates);
  const baseCur = profile.baseCurrency;
  const classifications = useCategoryClassifications();
  const [period, setPeriod] = useState<Period>('month');

  // Build period buckets
  const data = useMemo(() => buildPeriodData(period, txns, baseCur, rates), [period, txns, baseCur, rates]);

  const allInc = reportableTxns(txns).filter(t => t.type === 'income').reduce((s, t) => s + effectiveAmount(t, baseCur, rates), 0);
  const allExp = reportableTxns(txns).filter(t => t.type === 'expense').reduce((s, t) => s + effectiveAmount(t, baseCur, rates), 0);
  const avgNet = data.length ? data.reduce((s, d) => s + d.net, 0) / data.length : 0;

  // Donut: aggregate spend across the period range
  const start = data[0]?.start || '0000-00-00';
  const end   = data[data.length - 1]?.end || '9999-12-31';
  const donutData = useMemo(() => {
    const by: Record<string, number> = {};
    txns.filter(t => t.type === 'expense' && !t.excluded && t.date >= start && t.date <= end)
        .forEach(t => { by[t.category] = (by[t.category] || 0) + effectiveAmount(t, baseCur, rates); });
    return Object.entries(by).sort(([, a], [, b]) => b - a).map(([catId, amount]) => ({ catId, amount }));
  }, [txns, start, end, baseCur, rates]);

  // Needs vs Wants breakdown for this period
  const needsWants = useMemo(() => {
    let needs = 0, wants = 0;
    donutData.forEach(({ catId, amount }) => {
      const tag = classifications[catId];
      if (tag === 'need') needs += amount;
      else if (tag === 'want') wants += amount;
    });
    return { needs, wants };
  }, [donutData, classifications]);

  // Top expense categories all-time
  const topCats = useMemo(() => {
    const by: Record<string, number> = {};
    reportableTxns(txns).filter(t => t.type === 'expense').forEach(t => {
      by[t.category] = (by[t.category] || 0) + effectiveAmount(t, baseCur, rates);
    });
    return Object.entries(by).sort(([, a], [, b]) => b - a).slice(0, 8).map(([catId, amount]) => ({ catId, amount }));
  }, [txns, baseCur, rates]);

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('reports')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Financial performance over time
          </p>
        </div>
        <div className="flex bg-bg3 border border-line rounded-md p-0.5 gap-px">
          {(['day','week','month','quarter','year'] as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`font-mono text-[0.62rem] tracking-[0.1em] uppercase font-medium px-3.5 py-1.5 rounded transition-all ${
                period === p ? 'bg-coral text-white shadow-1' : 'text-ink-mid hover:text-ink hover:bg-bg4'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-3.5">
        <Card label="All-Time Income"   accent="sage"  value={<Money amount={allInc} currency={baseCur} className="text-sage" maxChars={10} />} />
        <Card label="All-Time Expenses" accent="terra" value={<Money amount={allExp} currency={baseCur} className="text-terra" maxChars={10} />} />
        <Card label="Net Flow"          accent="coral" value={<Money amount={allInc - allExp} currency={baseCur} className={allInc - allExp >= 0 ? 'text-sage' : 'text-terra'} maxChars={10} />} />
        <Card label={`Avg ${PERIOD_TITLE[period]} Net`} accent="honey" value={<Money amount={avgNet} currency={baseCur} className={avgNet >= 0 ? 'text-sage' : 'text-terra'} maxChars={10} />} />
      </div>

      {/* Income vs Expense area chart (Recharts) */}
      <Panel title="Income vs Expenses Trend" sub={PERIOD_TITLE[period]} className="mb-3.5">
        {data.length === 0 || data.every(d => d.income === 0 && d.expense === 0)
          ? <EmptyState icon="📊" message="No data for this period" />
          : <IncomeExpenseArea data={data} currency={baseCur} />
        }
      </Panel>

      <div className="grid lg:grid-cols-2 gap-3.5 mb-3.5">
        <Panel title="Net by Period">
          {data.length === 0
            ? <EmptyState icon="📊" message="No data" />
            : <NetBarChart data={data} currency={baseCur} />
          }
        </Panel>
        <Panel title="Category Breakdown" sub="This period">
          <CategoryDonut data={donutData} currency={baseCur} />
          {/* Needs vs Wants breakdown */}
          <div className="mt-4 flex gap-4 text-[0.98rem]">
            <div className="flex-1 bg-bg3 rounded-lg p-3 border border-line flex flex-col items-center">
              <div className="font-mono text-[0.7rem] tracking-wider uppercase text-ink-dim mb-1">Needs</div>
              <div className="num font-bold text-sage text-lg">{fmt(needsWants.needs, baseCur)}</div>
            </div>
            <div className="flex-1 bg-bg3 rounded-lg p-3 border border-line flex flex-col items-center">
              <div className="font-mono text-[0.7rem] tracking-wider uppercase text-ink-dim mb-1">Wants</div>
              <div className="num font-bold text-honey text-lg">{fmt(needsWants.wants, baseCur)}</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-3.5">
        <Panel title="Period Summary">
          {data.length === 0
            ? <EmptyState icon="📊" message="No data" />
            : (
              <div>
                <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-bg3 border-b border-line2 font-mono text-[0.56rem] tracking-[0.1em] uppercase text-ink-dim">
                  <div>Period</div><div className="text-right">Income</div><div className="text-right">Expense</div><div className="text-right">Net</div>
                </div>
                {[...data].reverse().map((d, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2 border-b border-line last:border-b-0 text-[0.78rem]">
                    <div>{d.label}</div>
                    <div className="font-mono text-right text-sage">{fmt(d.income, baseCur)}</div>
                    <div className="font-mono text-right text-terra">{fmt(d.expense, baseCur)}</div>
                    <div className={`font-mono text-right ${d.net >= 0 ? 'text-sage' : 'text-terra'}`}>{fmtSigned(d.net, baseCur)}</div>
                  </div>
                ))}
              </div>
            )
          }
        </Panel>
        <Panel title="Top Expense Categories">
          <CategoryBars data={topCats} currency={baseCur} />
        </Panel>
      </div>
    </div>
  );
}

// ── Period bucketing ─────────────────────────────────────────
interface Bucket { label: string; start: string; end: string; income: number; expense: number; net: number; }

function buildPeriodData(period: Period, txns: typeof reportableTxns extends (a: infer T) => infer R ? T : never[], baseCur: string, rates: Record<string, number>): Bucket[] {
  const data: Bucket[] = [];
  const counts: Record<Period, number> = { day: 30, week: 12, month: 12, quarter: 8, year: 5 };
  const count = counts[period];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    let label = '', start = '', end = '';
    if (period === 'day') {
      d.setDate(d.getDate() - i);
      const s = d.toISOString().split('T')[0];
      start = s; end = s;
      label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (period === 'week') {
      d.setDate(d.getDate() - i * 7);
      const wkStart = new Date(d); wkStart.setDate(wkStart.getDate() - wkStart.getDay());
      const wkEnd = new Date(wkStart); wkEnd.setDate(wkEnd.getDate() + 6);
      start = wkStart.toISOString().split('T')[0];
      end   = wkEnd.toISOString().split('T')[0];
      label = wkStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else if (period === 'month') {
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear(); const m = d.getMonth();
      start = `${y}-${String(m+1).padStart(2,'0')}-01`;
      end   = `${y}-${String(m+1).padStart(2,'0')}-31`;
      label = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    } else if (period === 'quarter') {
      d.setMonth(d.getMonth() - i * 3);
      const y = d.getFullYear(); const q = Math.floor(d.getMonth() / 3);
      const sm = q*3, em = sm + 2;
      start = `${y}-${String(sm+1).padStart(2,'0')}-01`;
      end   = `${y}-${String(em+1).padStart(2,'0')}-31`;
      label = `Q${q+1} '${String(y).slice(2)}`;
    } else {
      d.setFullYear(d.getFullYear() - i);
      const y = d.getFullYear();
      start = `${y}-01-01`; end = `${y}-12-31`;
      label = String(y);
    }
    const filtered = (txns as Array<{ type: string; date: string; excluded?: boolean; amount: number; currency: string; split?: { isSplit?: boolean; yourShare?: number } }>)
      .filter(t => !t.excluded && (t.type === 'income' || t.type === 'expense') && t.date >= start && t.date <= end);
    let income = 0, expense = 0;
    for (const t of filtered) {
      const amt = effectiveAmount(t as any, baseCur, rates);
      if (t.type === 'income') income += amt;
      else                     expense += amt;
    }
    data.push({ label, start, end, income, expense, net: income - expense });
  }
  return data;
  // Suppress unused getMonthKey (imported defensively)
  void getMonthKey;
}
