import { useMemo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { convert } from '../lib/format';
import { spendByCategoryInRange, budgetWindow, periodMonths } from '../lib/calculations';
import { BUDGET_COLORS, getCat, deterministicColor } from '../constants';
import type { Budget, BudgetPeriod } from '../types';
import Money from '../components/ui/Money';
import { budgetHistory, suggestBudget, budgetRollup, type BudgetSuggestion } from '../lib/budgetIntel';
import { uid } from '../lib/format';
import { Sparkles } from 'lucide-react';

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
  const debts          = useStore(s => s.debts);
  const goals          = useStore(s => s.goals);
  const recurringSchedules = useStore(s => s.recurringSchedules);
  const openAddBudget  = useStore(s => s.openAddBudget);
  const openEditBudget = useStore(s => s.openEditBudget);
  const removeBudget   = useStore(s => s.removeBudget);
  const upsertBudget   = useStore(s => s.upsertBudget);
  const toast          = useStore(s => s.toast);

  const [view, setView] = useState<ViewMode>('period');

  // Budgets v2 — history, Suggest/Copy, and the monthly/annual hierarchy are
  // permanent.
  const [suggestions, setSuggestions] = useState<BudgetSuggestion[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const history = useMemo(
    () => budgetHistory(transactions, budgets, profile.baseCurrency, rates, 6),
    [transactions, budgets, profile.baseCurrency, rates],
  );

  function generateSuggestions() {
    const all = suggestBudget({ transactions, debts, goals, recurring: recurringSchedules, baseCurrency: profile.baseCurrency, rates });
    // Only propose categories the user doesn't already budget for.
    const have = new Set(budgets.map(b => b.category));
    const fresh = all.filter(s => !have.has(s.category));
    setSuggestions(fresh);
    setPicked(new Set(fresh.map(s => s.category)));
  }



  // (d) — edit a suggested amount before saving.
  function editSuggestion(category: string, value: string) {
    const n = parseFloat(value) || 0;
    setSuggestions(prev => prev ? prev.map(s => s.category === category ? { ...s, limit: n } : s) : prev);
  }

  async function applySuggestions() {
    if (!suggestions) return;
    const chosen = suggestions.filter(s => picked.has(s.category));
    for (const s of chosen) {
      await upsertBudget({ id: uid(), category: s.category, limit: s.limit, currency: profile.baseCurrency, period: 'monthly', color: deterministicColor(s.category) });
    }
    setSuggestions(null);
    toast(`Added ${chosen.length} budget${chosen.length === 1 ? '' : 's'}`, 'success');
  }

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

  // (c) — category budgets roll up into monthly + annual parents.
  const rollup = useMemo(
    () => budgetRollup(rows.map(r => ({ category: r.b.category, limitBase: r.limitBase, period: r.b.period }))),
    [rows],
  );

  async function del(id: string) {
    if (!confirm('Delete this budget?')) return;
    await removeBudget(id);
    toast('Budget removed', 'info');
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4">
        <div className="min-w-0">
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('budgets')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Spending limits aggregated per budget period
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="hidden sm:flex bg-bg3 border border-line rounded-md p-0.5 gap-px">
            {(['period','monthly'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`font-mono text-[0.6rem] tracking-[0.1em] uppercase font-medium px-3 py-1 rounded transition-all ${
                  view === v ? 'bg-coral text-white shadow-1' : 'text-ink-mid hover:text-ink hover:bg-bg4'
                }`}>
                {v === 'period' ? 'Period view' : 'Monthly view'}
              </button>
            ))}
          </div>
          <button className="btn-secondary inline-flex items-center justify-center p-2" onClick={generateSuggestions} title="Suggest budgets">
            <Sparkles size={15} />
          </button>
          <button className="btn-primary" onClick={openAddBudget}>+ Add Budget</button>
        </div>
      </div>

      {/* B2.4 — suggested budget (editable proposal from recurring + debts + goals + history). */}
      {suggestions && (
        <Panel>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold text-ink text-[0.92rem]">Suggested budgets</div>
              <button onClick={() => setSuggestions(null)} className="text-[0.72rem] text-ink-dim hover:text-ink">Dismiss</button>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-[0.84rem] text-ink-mid">You already budget for everything we'd suggest. Nice.</p>
            ) : (
              <>
                <p className="text-[0.78rem] text-ink-dim mb-3">Each line comes from your real recurring bills, debts, goals, or recent spending — edit after adding.</p>
                <div className="space-y-1.5 mb-4">
                  {suggestions.map(s => {
                    const cat = getCat(s.category);
                    const on = picked.has(s.category);
                    return (
                      <label key={s.category} className="flex items-center gap-3 cursor-pointer py-1">
                        <input type="checkbox" checked={on} onChange={() => setPicked(p => { const n = new Set(p); if (on) n.delete(s.category); else n.add(s.category); return n; })} />
                        <span className="text-lg">{cat.icon}</span>
                        <span className="flex-1 text-[0.86rem] text-ink">{cat.label}</span>
                        <span className="font-mono text-[0.58rem] tracking-wider uppercase text-ink-dim">{s.basis}</span>
                        {/* (d) — amount editable before saving. */}
                        <input type="number" inputMode="decimal" value={s.limit ? String(s.limit) : ''}
                          onChange={e => editSuggestion(s.category, e.target.value)}
                          onClick={e => e.preventDefault()}
                          className="w-24 bg-bg3 border border-line rounded-md px-2 py-1 text-right num text-[0.84rem]" />
                      </label>
                    );
                  })}
                </div>
                <button className="btn-primary" onClick={applySuggestions} disabled={picked.size === 0}>
                  Add {picked.size} budget{picked.size === 1 ? '' : 's'}
                </button>
              </>
            )}
          </div>
        </Panel>
      )}

      {/* B2.2 — budget history & timeline (are we improving?). */}
      {history.length > 0 && (
        <Panel>
          <div className="p-4">
            <div className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim mb-3">Budget vs actual · last {history.length} months</div>
            <div className="flex items-end gap-2 h-24">
              {history.map(h => {
                const max = Math.max(h.budgeted, h.actual, 1);
                return (
                  <div key={h.monthKey} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="flex items-end gap-0.5 h-16">
                      <div className="w-2.5 bg-line rounded-t" style={{ height: `${(h.budgeted / max) * 100}%` }} title={`Budgeted ${h.budgeted}`} />
                      <div className={`w-2.5 rounded-t ${h.variance >= 0 ? 'bg-sage' : 'bg-terra'}`} style={{ height: `${(h.actual / max) * 100}%` }} title={`Actual ${h.actual}`} />
                    </div>
                    <span className="font-mono text-[0.5rem] text-ink-dim">{h.monthKey.slice(5)}</span>
                    <span className={`font-mono text-[0.5rem] ${h.variance >= 0 ? 'text-sage' : 'text-terra'}`}>{h.variance >= 0 ? '+' : ''}{Math.round(h.variance)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>
      )}

      {/* (c) — monthly / annual budget totals; the category budgets below are the
          children that roll up into these parents. */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-bg2 border border-line rounded-lg p-4">
            <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mb-1">Monthly budget</div>
            <Money amount={rollup.monthlyTotal} currency={profile.baseCurrency} className="text-2xl font-semibold text-ink" maxChars={10} />
            <div className="text-[0.7rem] text-ink-dim mt-0.5">{rollup.children.length} categor{rollup.children.length === 1 ? 'y' : 'ies'}</div>
          </div>
          <div className="bg-ink/[0.03] border border-line rounded-lg p-4">
            <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mb-1">Annual budget</div>
            <Money amount={rollup.annualTotal} currency={profile.baseCurrency} className="text-2xl font-semibold text-ink" maxChars={10} />
            <div className="text-[0.7rem] text-ink-dim mt-0.5">monthly × 12</div>
          </div>
        </div>
      )}

      {/* Summary strip */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-bg border border-line rounded-lg p-4 text-center min-w-0">
            <Money amount={totalBudgeted} currency={profile.baseCurrency} className="text-xl font-semibold text-ink" maxChars={9} />
            <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mt-0.5">Budgeted</div>
          </div>
          <div className="bg-bg border border-line rounded-lg p-4 text-center min-w-0">
            <Money amount={totalSpent} currency={profile.baseCurrency} className="text-xl font-semibold text-terra" maxChars={9} />
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
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEditBudget(b)} className="row-action" aria-label={`Edit ${cat.label} budget`} title="Edit">
                      <Pencil size={14} strokeWidth={1.6} />
                    </button>
                    <button onClick={() => del(b.id)} className="row-action danger" aria-label={`Delete ${cat.label} budget`} title="Delete">
                      <Trash2 size={14} strokeWidth={1.6} />
                    </button>
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
