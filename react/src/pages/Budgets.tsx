import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { convert } from '../lib/format';
import { spendByCategoryInRange, budgetWindow, periodMonths } from '../lib/calculations';
import { BUDGET_COLORS, getCat } from '../constants';
import type { Budget, BudgetPeriod } from '../types';
import Money from '../components/ui/Money';

function pct(spent: number, limit: number) { return limit > 0 ? Math.min((spent / limit) * 100, 100) : 0; }
function status(p: number): { label: string; cls: string; bar: string } {
  if (p >= 100) return { label: 'Over',    cls: 'text-terra bg-terra/10 border-terra/30',   bar: 'bg-terra' };
  if (p >= 80)  return { label: 'Near',    cls: 'text-honey bg-honey/10 border-honey/30',   bar: 'bg-honey' };
  return              { label: 'On track', cls: 'text-sage  bg-sage/10  border-sage/30',    bar: 'bg-sage' };
}

const PERIOD_LABEL: Record<BudgetPeriod, string> = {
  monthly: 'monthly', quarterly: 'quarterly', half_yearly: '6-month', annual: 'annual', custom: 'custom',
};

type ViewMode = 'period' | 'monthly';

export default function Budgets() {
  const { t } = useTranslation();
  const budgets      = useStore(s => s.budgets);
  const transactions = useStore(s => s.transactions);
  const profile      = useStore(s => s.profile);
  const rates        = useStore(s => s.rates);
  const openAddBudget  = useStore(s => s.openAddBudget);
  const openEditBudget = useStore(s => s.openEditBudget);
  const removeBudget   = useStore(s => s.removeBudget);
  const toast          = useStore(s => s.toast);

  const [view, setView] = useState<ViewMode>('period');

  // Pre-compute window + spend per budget so the cards stay cheap.
  const today = useMemo(() => new Date(), []);
  const rows = useMemo(() => budgets.map(b => {
    const win = budgetWindow(b, today);
    const limitBase = convert(b.limit, b.currency, profile.baseCurrency, rates);
    const spendMap = spendByCategoryInRange(transactions, win.start, win.end, profile.baseCurrency, rates);
    const spent = spendMap[b.category] || 0;
    return { b, win, limitBase, spent };
  }), [budgets, transactions, today, profile.baseCurrency, rates]);

  const totalBudgeted = rows.reduce((s, r) => s + r.limitBase, 0);
  const totalSpent    = rows.reduce((s, r) => s + r.spent, 0);
  const overCount     = rows.filter(r => r.spent > r.limitBase).length;

  async function del(id: string) {
    if (!confirm('Delete this budget?')) return;
    await removeBudget(id);
    toast('Budget removed', 'info');
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('budgets')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Spending limits aggregated per budget period
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-bg3 border border-line rounded-md p-0.5 gap-px">
            {(['period','monthly'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`font-mono text-[0.6rem] tracking-[0.1em] uppercase font-medium px-3 py-1 rounded transition-all ${
                  view === v ? 'bg-coral text-white shadow-1' : 'text-ink-mid hover:text-ink hover:bg-bg4'
                }`}>
                {v === 'period' ? 'Period view' : 'Monthly view'}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={openAddBudget}>+ Add Budget</button>
        </div>
      </div>

      {/* Summary strip */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-bg border border-line rounded-lg p-4 text-center min-w-0">
            <Money amount={totalBudgeted} currency={profile.baseCurrency} className="text-xl font-semibold text-ink" maxChars={11} />
            <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mt-0.5">Budgeted</div>
          </div>
          <div className="bg-bg border border-line rounded-lg p-4 text-center min-w-0">
            <Money amount={totalSpent} currency={profile.baseCurrency} className="text-xl font-semibold text-terra" maxChars={11} />
            <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mt-0.5">Spent</div>
          </div>
          <div className="bg-bg border border-line rounded-lg p-4 text-center min-w-0">
            <div className={`text-xl font-semibold ${overCount > 0 ? 'text-terra' : 'text-sage'}`}>
              {overCount} {overCount === 1 ? 'category' : 'categories'}
            </div>
            <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mt-0.5">Over budget</div>
          </div>
        </div>
      )}

      {/* Budget grid */}
      {rows.length === 0 ? (
        <Panel>
          <div className="px-6 py-14 text-center">
            <div className="text-4xl mb-3 opacity-60">◎</div>
            <p className="text-ink-mid mb-4">No budgets yet. Add one to start tracking your spending.</p>
            <button className="btn-primary" onClick={openAddBudget}>Add First Budget</button>
          </div>
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map(({ b, win, limitBase, spent }) => {
            const period = b.period || 'monthly';
            const months = periodMonths(period);
            const displayLimit = view === 'monthly' && months > 1 ? limitBase / months : limitBase;
            const displaySpent = view === 'monthly' && months > 1 ? spent / months : spent;
            const p = pct(displaySpent, displayLimit);
            const st = status(p);
            const cat = getCat(b.category);
            const remaining = displayLimit - displaySpent;
            return (
              <div key={b.id} className="bg-bg border border-line rounded-xl p-4 hover:shadow-md transition-shadow min-w-0">
                <div className="flex items-start justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl flex-shrink-0">{cat.icon}</span>
                    <span className="font-semibold text-ink text-[0.9rem] truncate">{cat.label}</span>
                  </div>
                  <span className={`font-mono text-[0.6rem] tracking-widest px-2 py-0.5 rounded-full border flex-shrink-0 ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                <div className="font-mono text-[0.55rem] tracking-[0.12em] uppercase text-ink-dim mb-2.5">
                  {view === 'monthly' && months > 1
                    ? `${PERIOD_LABEL[period]} budget · per-month view`
                    : period === 'custom'
                      ? `${b.periodStart || '?'} → ${b.periodEnd || '?'}`
                      : `${PERIOD_LABEL[period]} · ${win.start.slice(0, 7)}${months > 1 ? '…' + win.end.slice(0, 7) : ''}`}
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-bg3 rounded-full mb-3 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${st.bar}`} style={{ width: `${p}%` }} />
                </div>
                <div className="flex justify-between items-end gap-2 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-[0.8rem] text-ink-mid flex items-center gap-1 min-w-0">
                      <Money amount={displaySpent} currency={profile.baseCurrency} className="font-semibold text-ink" maxChars={9} />
                      <span className="text-ink-dim">/</span>
                      <Money amount={displayLimit} currency={profile.baseCurrency} maxChars={9} />
                    </div>
                    <div className={`font-mono text-[0.62rem] tracking-wider mt-0.5 flex items-center gap-1 ${remaining >= 0 ? 'text-sage' : 'text-terra'}`}>
                      <Money amount={Math.abs(remaining)} currency={profile.baseCurrency} maxChars={8} />
                      <span>{remaining >= 0 ? 'left' : 'over'}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => openEditBudget(b)} className="btn-ghost py-1 px-2 text-xs">Edit</button>
                    <button onClick={() => del(b.id)}        className="btn-ghost py-1 px-2 text-xs text-terra">Del</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
