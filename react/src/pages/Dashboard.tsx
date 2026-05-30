import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Card, Panel } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import PulseGauge from '../components/charts/PulseGauge';
import { CategoryDonut } from '../components/charts/Charts';
import TxnRow from '../components/transactions/TxnRow';
import {
  selectMonthlyData, selectTotalBalance, selectPulse, selectInsights,
  selectSpendByCategory, selectRecentTxns, selectTotalAssets, selectTotalLiabilities,
  selectMonthlyDebtPayment,
} from '../lib/selectors';
import { fmt, fmtShort, monthName, nowMonthKey, convert } from '../lib/format';
import Money from '../components/ui/Money';
import { getCat } from '../constants';

export default function Dashboard() {
  const { t } = useTranslation();
  const budgets = useStore(s => s.budgets);
  const goals = useStore(s => s.goals);
  const debts = useStore(s => s.debts);
  const assets = useStore(s => s.assets);
  const profile = useStore(s => s.profile);
  const baseCur = profile.baseCurrency;
  const openAddTxn = useStore(s => s.openAddTxn);
  // TD-12 review-fix (lead): the dev's selector refactor removed these two
  // subscriptions but kept references to `txns.length` and `rates` later in
  // the JSX. The selectors return derived values, not the raw collections
  // — these need to stay live for the count and the per-row `convert()`
  // calls in the budget/goal lists.
  const txns = useStore(s => s.transactions);
  const rates = useStore(s => s.rates);

  const mk = nowMonthKey();
  const month = useStore(selectMonthlyData(mk));
  const balance = useStore(selectTotalBalance);
  const rate = month.income > 0 ? Math.round((month.income - month.expense) / month.income * 100) : 0;
  const pulse = useStore(selectPulse);
  const insights = useStore(selectInsights);
  const spend = useStore(selectSpendByCategory(mk));
  const donutData = Object.entries(spend).map(([catId, amount]) => ({ catId, amount }));
  const recent = useStore(selectRecentTxns);
  const activeGoals = goals.filter(g => !g.completed).slice(0, 3);

  const ta = useStore(selectTotalAssets);
  const tl = useStore(selectTotalLiabilities);
  const monthlyDebtPmt = useStore(selectMonthlyDebtPayment);
  const dti = month.income > 0 ? (monthlyDebtPmt / month.income) * 100 : 0;

  return (
    <div>
      {/* Page header */}
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('dashboard')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Family Finance Overview · {monthName(mk)}
          </p>
        </div>
        <Button onClick={openAddTxn}>
          <Plus size={14} /> {t('add-transaction')}
        </Button>
      </div>

      {/* Top: Pulse + 4 metric cards */}
      <div className="grid lg:grid-cols-[220px_1fr] gap-3.5 mb-3.5">
        <div>
          <PulseGauge score={pulse} />
          {pulse.total === null && (
            <p className="text-ink-mid text-[0.78rem] mt-2 text-center">
              Building your Pulse — add income and a budget to begin.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Card label={t('total-balance')}    accent="coral" value={<Money amount={balance} currency={baseCur} className={balance >= 0 ? 'text-sage' : 'text-terra'} maxChars={10} />} sub={`Across all ${txns.length} transactions`} />
          <Card label={t('monthly-income')}   accent="sage"  value={<Money amount={month.income}  currency={baseCur} maxChars={10} />} sub={t('this-month')} />
          <Card label={t('monthly-expenses')} accent="terra" value={<Money amount={month.expense} currency={baseCur} maxChars={10} />} sub={t('this-month')} />
          <Card label={t('savings-rate')}     accent="honey" value={<span className={rate >= 20 ? 'text-sage' : rate >= 0 ? 'text-honey' : 'text-terra'}>{rate}%</span>} sub={t('of-income-saved')} />
        </div>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="flex gap-2 mb-3.5 flex-wrap">
          {insights.map((c, i) => {
            const tone = c.cls === 'chip-good' ? 'border-l-sage'
                       : c.cls === 'chip-warn' ? 'border-l-honey'
                       : c.cls === 'chip-alert' ? 'border-l-terra'
                       :                          'border-l-denim';
            return (
              <div key={i} className={`flex items-center gap-2.5 bg-bg2 border border-line ${tone} border-l-[3px] rounded-md px-3.5 py-2.5 text-[0.78rem] text-ink-mid flex-1 min-w-[180px]`}>
                <span className="text-base flex-shrink-0">{c.icon}</span>
                <span>{c.text}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Two-col: Budgets + Recent transactions */}
      <div className="grid lg:grid-cols-2 gap-3.5 mb-3.5">
        <Panel
          title={t('budget-progress')}
          action={<Link to="/budgets" className="font-mono text-[0.6rem] tracking-wider uppercase text-coral hover:opacity-70">{t('view-all')}</Link>}
        >
          {budgets.length === 0 ? (
            <EmptyState icon="◎" message="No budgets yet" />
          ) : (
            budgets.slice(0, 5).map(b => {
              const cat = getCat(b.category);
              const limitBase = convert(b.limit, b.currency, baseCur, rates);
              const spent = spend[b.category] || 0;
              const pct = limitBase > 0 ? Math.min(100, Math.round(spent / limitBase * 100)) : 0;
              const color = pct >= 100 ? 'hsl(var(--terra))' : pct >= 80 ? 'hsl(var(--honey))' : (b.color || 'hsl(var(--coral))');
              return (
                <div key={b.id} className="px-4 py-3 border-b border-line last:border-b-0">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[0.84rem] font-semibold text-ink">{cat.icon} {cat.label}</span>
                    <span className="font-mono text-[0.68rem] text-ink-mid">{fmtShort(spent, baseCur)} / {fmtShort(limitBase, baseCur)}</span>
                  </div>
                  <div className="bg-bg3 h-1.5 rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="font-mono text-[0.58rem] text-ink-dim">{pct}% used</div>
                </div>
              );
            })
          )}
        </Panel>

        <Panel
          title={t('recent-transactions')}
          action={<Link to="/transactions" className="font-mono text-[0.6rem] tracking-wider uppercase text-coral hover:opacity-70">{t('view-all')}</Link>}
        >
          {recent.length === 0 ? (
            <EmptyState icon="⟺" message="No transactions yet" />
          ) : (
            recent.map(t => <TxnRow key={t.id} txn={t} />)
          )}
        </Panel>
      </div>

      {/* Two-col: Goals + Category donut */}
      <div className="grid lg:grid-cols-2 gap-3.5 mb-3.5">
        <Panel
          title={t('active-goals')}
          action={<Link to="/goals" className="font-mono text-[0.6rem] tracking-wider uppercase text-coral hover:opacity-70">{t('view-all')}</Link>}
        >
          {activeGoals.length === 0 ? (
            <EmptyState icon="◇" message="No active goals" />
          ) : (
            activeGoals.map(g => {
              const tgt = convert(g.target, g.currency, baseCur, rates);
              const cur = convert(g.current, g.currency, baseCur, rates);
              const pct = tgt > 0 ? Math.min(100, Math.round(cur / tgt * 100)) : 0;
              return (
                <div key={g.id} className="px-4 py-3 border-b border-line last:border-b-0">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[0.84rem] font-semibold text-ink">{g.name}</span>
                    <span className="font-mono text-[0.68rem] text-ink-mid">{fmtShort(cur, baseCur)} / {fmtShort(tgt, baseCur)}</span>
                  </div>
                  <div className="bg-bg3 h-1.5 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-coral rounded-full transition-[width] duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="font-mono text-[0.58rem] text-ink-dim">{pct}% complete</div>
                </div>
              );
            })
          )}
        </Panel>

        <Panel title={t('spending-by-category')} sub={t('this-month')}>
          {donutData.length === 0
            ? <EmptyState icon="🥯" message="No expenses this month" />
            : <CategoryDonut data={donutData} currency={baseCur} />
          }
        </Panel>
      </div>

      {/* Net worth + Debt overview */}
      <div className="grid lg:grid-cols-2 gap-3.5">
        <Panel
          title={t('net-worth-snapshot')}
          action={<Link to="/networth" className="font-mono text-[0.6rem] tracking-wider uppercase text-coral hover:opacity-70">View →</Link>}
        >
          {(assets.length === 0 && debts.length === 0) ? (
            <EmptyState icon="⚖️" message="No assets or debts tracked" />
          ) : (
            <div className="px-4 py-3 space-y-2">
              <Row label="Assets"      value={fmt(ta, baseCur)} valueClass="text-sage" />
              <Row label="Liabilities" value={fmt(tl, baseCur)} valueClass="text-terra" />
              <div className="border-t border-line pt-2 flex justify-between items-center">
                <span className="display-italic text-[1.1rem] text-ink">Net Worth</span>
                <span className={`num font-semibold text-[1.4rem] ${ta - tl >= 0 ? 'text-sage' : 'text-terra'}`}>
                  {fmt(ta - tl, baseCur)}
                </span>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title={t('debt-overview')}
          action={<Link to="/debts" className="font-mono text-[0.6rem] tracking-wider uppercase text-coral hover:opacity-70">View →</Link>}
        >
          {debts.length === 0 ? (
            <EmptyState icon="✓" message="Debt-free!" />
          ) : (
            <div className="px-4 py-3 space-y-2">
              <Row label={`Total · ${debts.length} accounts`} value={fmt(tl, baseCur)} valueClass="text-terra" />
              <Row label="Monthly minimum" value={fmt(monthlyDebtPmt, baseCur)} valueClass="text-honey" />
              <Row
                label="Debt-to-income"
                value={`${dti.toFixed(0)}%`}
                valueClass={dti <= 25 ? 'text-sage' : dti <= 36 ? 'text-honey' : 'text-terra'}
              />
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center text-[0.84rem]">
      <span className="text-ink-mid">{label}</span>
      <span className={`num ${valueClass}`}>{value}</span>
    </div>
  );
}
