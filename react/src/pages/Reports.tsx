import { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import { CategoryDonut } from '../components/charts/DonutCharts';
import {
  IncomeExpenseArea, NetBarChart, CategoryBars,
} from '../components/charts/ReportCharts';
import {
  reportableTxns, effectiveAmount, monthlyData, totalMonthlyDebtPayment,
} from '../lib/calculations';
import { fmt, fmtSigned, getMonthKey, nowMonthKey } from '../lib/format';
import { useCategoryClassifications } from '../lib/categorization';
import { computeNetWorth } from '../lib/netWorth';
import { buildPeriodData, reportAccountId, type ReportPeriod } from '../lib/reportsModel';
import Money from '../components/ui/Money';
import SavedViewsBar from '../components/savedViews/SavedViewsBar';

type Period = ReportPeriod;
const PERIOD_LABELS: Record<Period, string> = { day: 'Day', week: 'Week', month: 'Month', quarter: 'Quarter', year: 'Year' };
const PERIOD_TITLE: Record<Period, string>  = { day: 'Daily', week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Annual' };

export default function Reports() {
  const { t } = useTranslation();
  const txns = useStore(s => s.transactions);
  const profile = useStore(s => s.profile);
  const rates = useStore(s => s.rates);
  const members = useStore(s => s.members);
  const accounts = useStore(s => s.accounts);
  const assets = useStore(s => s.assets);
  const debts = useStore(s => s.debts);
  const baseCur = profile.baseCurrency;
  const classifications = useCategoryClassifications();
  const [period, setPeriod] = useState<Period>('month');
  const [searchParams, setSearchParams] = useSearchParams();
  const fromSavings = searchParams.get('from') === 'savings';
  // Savings banner: compute current-month income/expense for the formula display.
  const currentMk = nowMonthKey();
  const savingsIncome = useMemo(() =>
    reportableTxns(txns).filter(t => t.type === 'income' && getMonthKey(t.date) === currentMk)
      .reduce((s, t) => s + effectiveAmount(t, baseCur, rates), 0),
    [txns, baseCur, rates, currentMk]);
  const savingsExpense = useMemo(() =>
    reportableTxns(txns).filter(t => t.type === 'expense' && getMonthKey(t.date) === currentMk)
      .reduce((s, t) => s + effectiveAmount(t, baseCur, rates), 0),
    [txns, baseCur, rates, currentMk]);
  const savingsRate = savingsIncome > 0 ? Math.round((savingsIncome - savingsExpense) / savingsIncome * 100) : 0;
  const position = useMemo(() => computeNetWorth({ assets, accounts, debts, transactions: txns }, baseCur, rates), [assets, accounts, debts, txns, baseCur, rates]);
  const month = useMemo(() => monthlyData(txns, currentMk, baseCur, rates), [txns, currentMk, baseCur, rates]);
  const minimumPayments = totalMonthlyDebtPayment(debts, baseCur, rates);
  // R6 (g) — By-member / By-account breakouts are now a permanent part of Reports
  // (the money model is permanent). They fold over `reportableTxns`, so transfers
  // and balance adjustments are excluded and never skew the breakdowns.
  const showBreakouts = true;

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
    reportableTxns(txns).filter(t => t.type === 'expense' && t.date >= start && t.date <= end)
        .forEach(t => { by[t.category] = (by[t.category] || 0) + effectiveAmount(t, baseCur, rates); });
    return Object.entries(by).sort(([, a], [, b]) => b - a).map(([catId, amount]) => ({ catId, amount }));
  }, [txns, start, end, baseCur, rates]);

  // Needs vs Wants breakdown for this period
  const needsWants = useMemo(() => {
    let needs = 0, wants = 0, unclassified = 0;
    donutData.forEach(({ catId, amount }) => {
      const tag = classifications[catId];
      if (tag === 'need') needs += amount;
      else if (tag === 'want') wants += amount;
      else unclassified += amount;
    });
    return { needs, wants, unclassified };
  }, [donutData, classifications]);

  // Top expense categories all-time
  const topCats = useMemo(() => {
    const by: Record<string, number> = {};
    reportableTxns(txns).filter(t => t.type === 'expense').forEach(t => {
      by[t.category] = (by[t.category] || 0) + effectiveAmount(t, baseCur, rates);
    });
    return Object.entries(by).sort(([, a], [, b]) => b - a).slice(0, 8).map(([catId, amount]) => ({ catId, amount }));
  }, [txns, baseCur, rates]);

  const byMember = useMemo(() => {
    if (!showBreakouts) return [] as { id: string; name: string; income: number; expense: number; net: number }[];
    const map = new Map<string, { income: number; expense: number }>();
    reportableTxns(txns).forEach(tx => {
      const key = tx.initiatedBy || tx.memberId || '';
      const cur = map.get(key) || { income: 0, expense: 0 };
      const amt = effectiveAmount(tx, baseCur, rates);
      if (tx.type === 'income') cur.income += amt;
      else if (tx.type === 'expense') cur.expense += amt;
      map.set(key, cur);
    });
    const rows = [...map.entries()].map(([id, v]) => ({
      id,
      name: members.find(m => m.id === id)?.name || (id ? '—' : 'Unassigned'),
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
    rows.sort((a, b) => b.expense - a.expense);
    return rows;
  }, [txns, baseCur, rates, members, showBreakouts]);

  const byAccount = useMemo(() => {
    if (!showBreakouts) return [] as { id: string; name: string; income: number; expense: number; net: number }[];
    const map = new Map<string, { income: number; expense: number }>();
    reportableTxns(txns).forEach(tx => {
      const key = reportAccountId(tx, accounts);
      const cur = map.get(key) || { income: 0, expense: 0 };
      const amt = effectiveAmount(tx, baseCur, rates);
      if (tx.type === 'income') cur.income += amt;
      else if (tx.type === 'expense') cur.expense += amt;
      map.set(key, cur);
    });
    const rows = [...map.entries()].map(([id, v]) => {
      const acc = accounts.find(a => a.id === id || a.assetId === id);
      return {
        id,
        name: acc?.name || (id ? '—' : 'No account'),
        income: v.income,
        expense: v.expense,
        net: v.income - v.expense,
      };
    });
    rows.sort((a, b) => b.expense - a.expense);
    return rows;
  }, [txns, baseCur, rates, accounts, showBreakouts]);

  return (
    <div className="ui-pilot min-w-0" data-testid="reports-page">
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('reports')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Financial performance over time
          </p>
        </div>
        {/* Board D M1 §.srail — the period selector is an inset SEGMENTED rail
            (one sunken pill; the active segment is a raised accent-tinted chip),
            matching the Transactions type rail. */}
        <div
          className="inline-flex max-w-full gap-1 p-1 rounded-pill overflow-x-auto [&::-webkit-scrollbar]:hidden"
          style={{ background: 'var(--sunken)', boxShadow: 'var(--neu-inset)', scrollbarWidth: 'none' }}
          role="tablist" aria-label="Report period"
        >
          {(['day','week','month','quarter','year'] as Period[]).map(p => (
            <button
              key={p}
              role="tab" aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className="h-[30px] px-3.5 rounded-pill border-none cursor-pointer font-display font-semibold text-[11.5px] whitespace-nowrap flex-shrink-0"
              style={period === p
                ? { color: 'var(--accent)', boxShadow: 'var(--neu-inset)', background: 'color-mix(in srgb, var(--accent) 10%, var(--canvas))' }
                : { color: 'var(--ff-ink-3)', background: 'transparent' }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <section aria-label="Household position" className="mb-section border-y border-line py-5">
        <h2 className="text-xl font-display font-medium text-ink mb-4">Household position</h2>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { label: 'Net worth', value: position.netWorth },
            { label: 'Assets', value: position.totalAssets },
            { label: 'Liabilities', value: position.totalLiabilities },
            { label: 'Liquid assets', value: position.liquidAssets },
          ].map(item => <div key={item.label} className="min-w-0"><dt className="text-sm text-ink-dim">{item.label}</dt><dd className="num text-lg text-ink mt-1 [overflow-wrap:anywhere]">{item.value < 0 ? fmtSigned(item.value, baseCur) : fmt(item.value, baseCur)}</dd></div>)}
        </dl>
        <p className="text-xs text-ink-dim mt-3">Current ledger position, not a historical valuation chart. Liquid assets are not automatically spare cash.</p>
        <h3 className="text-base font-medium text-ink mt-5 mb-3">This month · {currentMk}</h3>
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="min-w-0"><dt className="text-sm text-ink-dim">Income</dt><dd className="num [overflow-wrap:anywhere]">{fmt(month.income, baseCur)}</dd></div>
          <div className="min-w-0"><dt className="text-sm text-ink-dim">Spending</dt><dd className="num [overflow-wrap:anywhere]">{fmt(month.expense, baseCur)}</dd></div>
          <div className="min-w-0"><dt className="text-sm text-ink-dim">Income retained</dt><dd className="num">{month.income > 0 ? `${savingsRate}%` : 'Not available'}</dd></div>
          <div className="min-w-0"><dt className="text-sm text-ink-dim">Tracked minimum debt payments / month</dt><dd className="num [overflow-wrap:anywhere]">{fmt(minimumPayments, baseCur)}</dd></div>
        </dl>
        <p className="text-xs text-ink-dim mt-3">Month still in progress. Payment commitments use recorded debt terms; untracked bills and card payments are not included.</p>
        <nav aria-label="Household planning details" className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-sm text-coral">
          <Link to="/budgets" className="py-2">Budget vs actual</Link><Link to="/recurring" className="py-2">Upcoming bills</Link><Link to="/debts" className="py-2">Debt payoff</Link><Link to="/networth" className="py-2">Assets and liabilities</Link>
        </nav>
      </section>

      <div className="mb-3 flex justify-end">
        <SavedViewsBar
          page="reports"
          filters={{ period }}
          onApply={f => {
            if (typeof f.period === 'string' && ['day','week','month','quarter','year'].includes(f.period)) {
              setPeriod(f.period as Period);
            }
          }}
        />
      </div>

      {/* v9.4.2 — Savings rate contextual banner (navigated from Dashboard savings card). */}
      {fromSavings && (
        <div className="mb-4 bg-honey/8 border border-honey/30 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-lg flex-shrink-0">💡</span>
          <div className="flex-1 text-[0.84rem] text-ink-mid">
            <span className="font-semibold text-ink">Savings rate {savingsRate}%</span>
            {' — '}
            {savingsIncome > 0
              ? `Income minus spending: ${fmtSigned(savingsIncome - savingsExpense, baseCur)} from ${fmt(savingsIncome, baseCur)} income this month.`
              : 'No income recorded this month.'}
            <div className="font-mono text-[0.62rem] tracking-wider text-ink-dim mt-1">
              Formula: (Income − Expenses) ÷ Income × 100
            </div>
          </div>
          <button
            onClick={() => { const next = new URLSearchParams(searchParams); next.delete('from'); setSearchParams(next, { replace: true }); }}
            className="text-ink-dim hover:text-ink text-[0.78rem] flex-shrink-0"
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      {/* Board D M1 §.stat — neu stat tiles with a delta subline, scrolling as a
          carousel on phones and settling into a row on wider screens.
          "Accidental Wealth" rule: expenses are INFORMATION, so the total spent
          renders in neutral ink — crit is reserved for genuine failures. */}
      {(() => {
        const kept = allInc > 0 ? Math.round(((allInc - allExp) / allInc) * 100) : 0;
        const avgIncome  = data.length ? data.reduce((s, d) => s + d.income, 0) / data.length : 0;
        const avgExpense = data.length ? data.reduce((s, d) => s + d.expense, 0) / data.length : 0;
        const per = PERIOD_LABELS[period].toLowerCase();
        const tiles: { lbl: string; value: React.ReactNode; delta: string }[] = [
          { lbl: 'Income · all time',   value: <Money amount={allInc} currency={baseCur} className="num font-bold text-[21px] leading-none text-sage" maxChars={9} />, delta: `avg ${fmt(Math.round(avgIncome), baseCur)}/${per}` },
          { lbl: 'Expenses · all time', value: <Money amount={allExp} currency={baseCur} className="num font-bold text-[21px] leading-none text-ink"  maxChars={9} />, delta: `avg ${fmt(Math.round(avgExpense), baseCur)}/${per}` },
          { lbl: 'Net flow',            value: <Money amount={allInc - allExp} currency={baseCur} className={`num font-bold text-[21px] leading-none ${allInc - allExp >= 0 ? 'text-sage' : 'text-terra'}`} maxChars={9} />, delta: allInc > 0 ? `kept ${kept}%` : 'no income yet' },
          { lbl: `Avg ${PERIOD_TITLE[period]} net`, value: <Money amount={avgNet} currency={baseCur} className={`num font-bold text-[21px] leading-none ${avgNet >= 0 ? 'text-sage' : 'text-terra'}`} maxChars={9} />, delta: `over ${data.length} ${per}${data.length === 1 ? '' : 's'}` },
        ];
        return (
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1 mb-3.5 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none' }}>
            {tiles.map(t => (
              <div key={t.lbl} className="min-w-[132px] flex-shrink-0 sm:min-w-0 rounded-r2 px-[15px] py-[13px]"
                style={{ background: 'var(--canvas)', boxShadow: 'var(--neu)' }}>
                <div className="mono-label mb-[7px]">{t.lbl}</div>
                {t.value}
                <div className="text-[10px] text-ink-dim mt-[5px]">{t.delta}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Income vs Expense area chart (Recharts) */}
      <p className="text-sm text-ink-dim mb-3">Chart window: {start} to {end}. Grouped by {PERIOD_LABELS[period].toLowerCase()}; the current interval may be incomplete. Headlines and member/account totals are all-time.</p>
      <Panel title="Income vs Expenses Trend" sub={PERIOD_TITLE[period]} className="mb-3.5 min-w-0">
        {data.length === 0 || data.every(d => d.income === 0 && d.expense === 0)
          ? <EmptyState icon="📊" message="No data for this period" />
          : <IncomeExpenseArea data={data} currency={baseCur} />
        }
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-3.5 min-w-0">
        <Panel title="Cash Flow Surplus / Shortfall" sub={`Income minus spending per ${period}; not a bank balance`} className="min-w-0">
          {data.length === 0
            ? <EmptyState icon="📊" message="No data" />
            : <NetBarChart data={data} currency={baseCur} />
          }
        </Panel>
        <Panel title="Category Breakdown" sub="Chart date range" className="min-w-0">
          <CategoryDonut data={donutData} currency={baseCur} animate={false} />
          {/* Board D — needs-vs-wants verdict split bar. Both segments round
              their OWN outer corner (rather than relying solely on the
              container's overflow-hidden to clip square corners into shape)
              and the wants segment fills via flex-1 instead of an explicit
              percent width, so independent per-child pixel rounding can never
              leave a 1px gap/seam or bleed past the pill's rounded ends. */}
          {(needsWants.needs > 0 || needsWants.wants > 0 || needsWants.unclassified > 0) && (() => {
            const total = needsWants.needs + needsWants.wants || 1;
            const nPct = (needsWants.needs / total) * 100;
            const wPct = (needsWants.wants / total) * 100;
            const bothVisible = needsWants.needs > 0 && needsWants.wants > 0;
            return (
              <section aria-label="Needs vs Wants" className="mt-4 px-4 pb-4 min-w-0 max-w-full">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                  <span className="mono-label">Needs vs Wants</span>
                  <span className="text-sm text-ink-mid">
                    {needsWants.needs + needsWants.wants > 0 ? `${Math.round(nPct)}% needs` : 'No classified spending'}
                  </span>
                </div>
                <div className="flex h-8 rounded-full overflow-hidden" style={{ boxShadow: 'var(--neu-inset)' }} aria-hidden>
                  {needsWants.needs > 0 && (
                    <div className={`flex items-center justify-center text-white font-display font-bold text-[11px] whitespace-nowrap overflow-hidden ${bothVisible ? 'rounded-l-full' : 'rounded-full'}`}
                      style={{ width: needsWants.wants > 0 ? `${nPct}%` : '100%', background: 'hsl(var(--sage))' }}>{nPct >= 16 ? `Needs ${Math.round(nPct)}%` : ''}</div>
                  )}
                  {needsWants.wants > 0 && (
                    <div className={`flex items-center justify-center font-display font-bold text-[11px] whitespace-nowrap overflow-hidden flex-1 ${bothVisible ? 'rounded-r-full' : 'rounded-full'}`}
                      style={{ background: 'hsl(var(--honey))', color: 'var(--accent-ink)' }}>{wPct >= 16 ? `Wants ${Math.round(wPct)}%` : ''}</div>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-3 mt-3 text-sm">
                  <div className="min-w-0"><dt className="text-ink-dim">Needs</dt><dd className="num text-sage whitespace-normal [overflow-wrap:anywhere]">{fmt(needsWants.needs, baseCur)}</dd></div>
                  <div className="min-w-0 text-right"><dt className="text-ink-dim">Wants</dt><dd className="num text-honey whitespace-normal [overflow-wrap:anywhere]">{fmt(needsWants.wants, baseCur)}</dd></div>
                </dl>
                {needsWants.unclassified > 0 && <p className="text-sm text-ink-mid mt-2 [overflow-wrap:anywhere]">Unclassified: {fmt(needsWants.unclassified, baseCur)}</p>}
                <p className="text-xs text-ink-dim mt-2 leading-relaxed">Share of classified spending, not a financial-health score.</p>
              </section>
            );
          })()}
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 min-w-0">
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
                    <div className="truncate min-w-0">{d.label}</div>
                    <div className="text-right min-w-0"><Money amount={d.income} currency={baseCur} maxChars={8} className="text-sage" /></div>
                    <div className="text-right min-w-0"><Money amount={d.expense} currency={baseCur} maxChars={8} className="text-terra" /></div>
                    <div className="text-right min-w-0"><Money amount={d.net} currency={baseCur} maxChars={8} signed className={d.net >= 0 ? 'text-sage' : 'text-terra'} /></div>
                  </div>
                ))}
              </div>
            )
          }
        </Panel>
        <Panel title="Top Expense Categories" sub="All-time, reportable" className="min-w-0">
          <CategoryBars data={topCats} currency={baseCur} />
        </Panel>
      </div>

      {/* v7.2 Money Map — By member / By account breakouts. Flag-gated. */}
      {showBreakouts && (byMember.length > 0 || byAccount.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mt-3.5 min-w-0">
          <Panel title="By member" sub="All-time, reportable">
            <BreakoutTable rows={byMember} currency={baseCur} />
          </Panel>
          <Panel title="By account" sub="All-time, reportable">
            <BreakoutTable rows={byAccount} currency={baseCur} />
          </Panel>
        </div>
      )}
    </div>
  );
}

function BreakoutTable(props: {
  rows: { id: string; name: string; income: number; expense: number; net: number }[];
  currency: string;
}) {
  const { rows, currency } = props;
  if (rows.length === 0) {
    return <div className="px-4 py-6 text-center text-sm text-ink-dim">No data.</div>;
  }
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-bg3 border-b border-line2 font-mono text-[0.56rem] tracking-[0.1em] uppercase text-ink-dim">
        <div>Name</div><div className="text-right">Income</div><div className="text-right">Expense</div><div className="text-right">Net</div>
      </div>
      {rows.map(r => (
        <div key={r.id || 'unassigned'} className="grid grid-cols-4 gap-2 px-4 py-2 border-b border-line last:border-b-0 text-[0.78rem]">
          <div className="truncate min-w-0">{r.name}</div>
          <div className="text-right min-w-0"><Money amount={r.income} currency={currency} maxChars={8} className="text-sage" /></div>
          <div className="text-right min-w-0"><Money amount={r.expense} currency={currency} maxChars={8} className="text-terra" /></div>
          <div className="text-right min-w-0"><Money amount={r.net} currency={currency} maxChars={8} signed className={r.net >= 0 ? 'text-sage' : 'text-terra'} /></div>
        </div>
      ))}
    </div>
  );
}
