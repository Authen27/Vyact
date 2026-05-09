import { useState } from 'react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { fmt, convert, nowMonthKey, getMonthKey } from '../lib/format';
import { spendByCategory } from '../lib/calculations';
import { EXPENSE_CATEGORIES, BUDGET_COLORS, getCat } from '../constants';
import type { Budget } from '../types';
import { uid } from '../lib/format';

function pct(spent: number, limit: number) { return limit > 0 ? Math.min((spent / limit) * 100, 100) : 0; }
function status(p: number): { label: string; cls: string; bar: string } {
  if (p >= 100) return { label: 'Over',    cls: 'text-terra bg-terra/10 border-terra/30',   bar: 'bg-terra' };
  if (p >= 80)  return { label: 'Near',    cls: 'text-honey bg-honey/10 border-honey/30',   bar: 'bg-honey' };
  return              { label: 'On track', cls: 'text-sage  bg-sage/10  border-sage/30',    bar: 'bg-sage' };
}

interface FormState { category: string; limit: string; currency: string; color: string; }
const blank = (currency: string): FormState => ({ category: 'food', limit: '', currency, color: BUDGET_COLORS[0] });

export default function Budgets() {
  const { t } = useTranslation();
  const budgets     = useStore(s => s.budgets);
  const transactions = useStore(s => s.transactions);
  const profile     = useStore(s => s.profile);
  const rates       = useStore(s => s.rates);
  const upsertBudget = useStore(s => s.upsertBudget);
  const removeBudget = useStore(s => s.removeBudget);
  const toast        = useStore(s => s.toast);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<FormState>(blank(profile.baseCurrency));
  const [editId, setEditId]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  const mk    = nowMonthKey();
  const spend = spendByCategory(transactions, mk, profile.baseCurrency, rates);

  const totalBudgeted = budgets.reduce((s, b) => s + convert(b.limit, b.currency, profile.baseCurrency, rates), 0);
  const totalSpent    = budgets.reduce((s, b) => s + (spend[b.category] || 0), 0);
  const overCount     = budgets.filter(b => (spend[b.category] || 0) > convert(b.limit, b.currency, profile.baseCurrency, rates)).length;

  function openAdd() { setEditId(null); setForm(blank(profile.baseCurrency)); setShowForm(true); }
  function openEdit(b: Budget) {
    setEditId(b.id);
    setForm({ category: b.category, limit: String(b.limit), currency: b.currency, color: b.color || BUDGET_COLORS[0] });
    setShowForm(true);
  }

  async function save() {
    const lim = parseFloat(form.limit);
    if (!form.category || isNaN(lim) || lim <= 0) { toast('Fill all fields', 'error'); return; }
    setSaving(true);
    try {
      await upsertBudget({ id: editId || uid(), category: form.category, limit: lim, currency: form.currency, color: form.color });
      toast(editId ? 'Budget updated' : 'Budget added', 'success');
      setShowForm(false);
    } catch { toast('Save failed', 'error'); }
    finally { setSaving(false); }
  }

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
            Monthly spending limits · {mk}
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Budget</button>
      </div>

      {/* Summary strip */}
      {budgets.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Budgeted',  value: fmt(totalBudgeted, profile.baseCurrency), cls: 'text-ink' },
            { label: 'Spent',     value: fmt(totalSpent,    profile.baseCurrency), cls: 'text-terra' },
            { label: 'Over budget', value: `${overCount} category${overCount !== 1 ? 's' : ''}`, cls: overCount > 0 ? 'text-terra' : 'text-sage' },
          ].map(s => (
            <div key={s.label} className="bg-bg border border-line rounded-lg p-4 text-center">
              <div className={`text-xl font-semibold ${s.cls}`}>{s.value}</div>
              <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <Panel title={editId ? 'Edit Budget' : 'New Budget'} className="mb-4">
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mono-label mb-1.5 block">Category</label>
              <select className="input w-full" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Monthly Limit</label>
              <div className="flex gap-2">
                <select className="input w-24" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {['USD','EUR','GBP','INR','JPY','AUD','CAD','CHF','CNY','AED','SGD','BRL'].map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="input flex-1" type="number" min="0" value={form.limit} onChange={e => setForm(f => ({ ...f, limit: e.target.value }))} placeholder="500" />
              </div>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Colour</label>
              <div className="flex gap-2 flex-wrap">
                {BUDGET_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-ink scale-110' : 'border-transparent'}`}
                    style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex items-end gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </Panel>
      )}

      {/* Budget grid */}
      {budgets.length === 0 ? (
        <Panel>
          <div className="px-6 py-14 text-center">
            <div className="text-4xl mb-3 opacity-60">◎</div>
            <p className="text-ink-mid mb-4">No budgets yet. Add one to start tracking your spending.</p>
            <button className="btn-primary" onClick={openAdd}>Add First Budget</button>
          </div>
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {budgets.map(b => {
            const limitBase  = convert(b.limit, b.currency, profile.baseCurrency, rates);
            const spent      = spend[b.category] || 0;
            const p          = pct(spent, limitBase);
            const st         = status(p);
            const cat        = getCat(b.category);
            const remaining  = limitBase - spent;
            return (
              <div key={b.id} className="bg-bg border border-line rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.icon}</span>
                    <span className="font-semibold text-ink text-[0.9rem]">{cat.label}</span>
                  </div>
                  <span className={`font-mono text-[0.6rem] tracking-widest px-2 py-0.5 rounded-full border ${st.cls}`}>
                    {st.label}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-bg3 rounded-full mb-3 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${st.bar}`} style={{ width: `${p}%` }} />
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <div className="text-[0.8rem] text-ink-mid">
                      <span className="font-semibold text-ink">{fmt(spent, profile.baseCurrency)}</span>
                      {' '}/ {fmt(limitBase, profile.baseCurrency)}
                    </div>
                    <div className={`font-mono text-[0.62rem] tracking-wider mt-0.5 ${remaining >= 0 ? 'text-sage' : 'text-terra'}`}>
                      {remaining >= 0 ? `${fmt(remaining, profile.baseCurrency)} left` : `${fmt(-remaining, profile.baseCurrency)} over`}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={() => openEdit(b)} className="btn-ghost py-1 px-2 text-xs">Edit</button>
                    <button onClick={() => del(b.id)}   className="btn-ghost py-1 px-2 text-xs text-terra">Del</button>
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
