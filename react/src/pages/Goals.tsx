import { useState } from 'react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { fmt, convert, today, uid } from '../lib/format';
import { GOAL_ICONS, GOAL_COLORS, CURRENCIES } from '../constants';
import type { Goal, GoalType } from '../types';

const GOAL_TYPES: { key: GoalType; label: string }[] = [
  { key: 'emergency',  label: 'Emergency Fund' },
  { key: 'savings',    label: 'Savings' },
  { key: 'debt',       label: 'Debt Payoff' },
  { key: 'investment', label: 'Investment' },
  { key: 'purchase',   label: 'Purchase' },
  { key: 'custom',     label: 'Custom' },
];

interface FormState {
  type: GoalType; name: string; target: string;
  current: string; currency: string; deadline: string;
}
const blank = (currency: string): FormState => ({
  type: 'savings', name: '', target: '', current: '0', currency, deadline: '',
});

function daysLeft(deadline?: string) {
  if (!deadline) return null;
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return d;
}

export default function Goals() {
  const { t } = useTranslation();
  const goals       = useStore(s => s.goals);
  const profile     = useStore(s => s.profile);
  const rates       = useStore(s => s.rates);
  const upsertGoal  = useStore(s => s.upsertGoal);
  const removeGoal  = useStore(s => s.removeGoal);
  const toast       = useStore(s => s.toast);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState<FormState>(blank(profile.baseCurrency));
  const [editId, setEditId]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const active    = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);

  function openAdd() { setEditId(null); setForm(blank(profile.baseCurrency)); setShowForm(true); }
  function openEdit(g: Goal) {
    setEditId(g.id);
    setForm({ type: g.type, name: g.name, target: String(g.target), current: String(g.current), currency: g.currency, deadline: g.deadline || '' });
    setShowForm(true);
  }

  async function save() {
    const target  = parseFloat(form.target);
    const current = parseFloat(form.current);
    if (!form.name || isNaN(target) || target <= 0) { toast('Name and target are required', 'error'); return; }
    setSaving(true);
    try {
      await upsertGoal({
        id: editId || uid(), type: form.type, name: form.name,
        target, current: isNaN(current) ? 0 : current,
        currency: form.currency, deadline: form.deadline || undefined,
        completed: false,
      });
      toast(editId ? 'Goal updated' : 'Goal added', 'success');
      setShowForm(false);
    } catch { toast('Save failed', 'error'); }
    finally { setSaving(false); }
  }

  async function addProgress(g: Goal) {
    const amount = parseFloat(prompt(`Add progress to "${g.name}" (${g.currency}):`) || '');
    if (isNaN(amount) || amount <= 0) return;
    const newCurrent = g.current + amount;
    await upsertGoal({ ...g, current: newCurrent, completed: newCurrent >= g.target });
    toast('Progress updated', 'success');
  }

  async function toggleComplete(g: Goal) {
    await upsertGoal({ ...g, completed: !g.completed });
    toast(g.completed ? 'Goal reopened' : 'Goal marked complete!', 'success');
  }

  async function del(id: string) {
    if (!confirm('Delete this goal?')) return;
    await removeGoal(id);
    toast('Goal removed', 'info');
  }

  function GoalCard({ g }: { g: Goal }) {
    const targetBase  = convert(g.target, g.currency, profile.baseCurrency, rates);
    const currentBase = convert(g.current, g.currency, profile.baseCurrency, rates);
    const p           = targetBase > 0 ? Math.min((currentBase / targetBase) * 100, 100) : 0;
    const color       = GOAL_COLORS[g.type];
    const icon        = GOAL_ICONS[g.type];
    const days        = daysLeft(g.deadline);

    return (
      <div className={`bg-bg border border-line rounded-xl p-5 transition-shadow hover:shadow-md ${g.completed ? 'opacity-70' : ''}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{icon}</span>
            <div>
              <div className="font-semibold text-ink text-[0.9rem]">{g.name}</div>
              <div className="font-mono text-[0.6rem] tracking-wider text-ink-dim uppercase">{g.type}</div>
            </div>
          </div>
          {g.completed && (
            <span className="font-mono text-[0.6rem] tracking-widest px-2 py-0.5 rounded-full bg-sage/10 border border-sage/30 text-sage">
              Done
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-bg3 rounded-full mb-2 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: color }} />
        </div>
        <div className="flex justify-between text-[0.78rem] text-ink-mid mb-3">
          <span className="font-semibold text-ink">{fmt(currentBase, profile.baseCurrency)}</span>
          <span>{Math.round(p)}% · {fmt(targetBase, profile.baseCurrency)}</span>
        </div>

        {days !== null && !g.completed && (
          <div className={`font-mono text-[0.62rem] tracking-wider mb-3 ${days < 0 ? 'text-terra' : days < 30 ? 'text-honey' : 'text-ink-dim'}`}>
            {days < 0 ? `${-days}d overdue` : `${days}d remaining`} · {g.deadline}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {!g.completed && (
            <button className="btn-secondary text-xs py-1 px-2.5" onClick={() => addProgress(g)}>+ Progress</button>
          )}
          <button className="btn-ghost text-xs py-1 px-2.5" onClick={() => openEdit(g)}>Edit</button>
          <button className="btn-ghost text-xs py-1 px-2.5" onClick={() => toggleComplete(g)}>
            {g.completed ? 'Reopen' : 'Mark done'}
          </button>
          <button className="btn-ghost text-xs py-1 px-2.5 text-terra ml-auto" onClick={() => del(g.id)}>Del</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('goals')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            {active.length} active · {completed.length} completed
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Goal</button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <Panel title={editId ? 'Edit Goal' : 'New Goal'} className="mb-4">
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mono-label mb-1.5 block">Goal Type</label>
              <select className="input w-full" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as GoalType }))}>
                {GOAL_TYPES.map(gt => <option key={gt.key} value={gt.key}>{GOAL_ICONS[gt.key]} {gt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Name</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Emergency Fund" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Target Amount</label>
              <div className="flex gap-2">
                <select className="input w-24" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {Object.keys(CURRENCIES).map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="input flex-1" type="number" min="0" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} placeholder="10000" />
              </div>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Current Amount</label>
              <input className="input w-full" type="number" min="0" value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Deadline (optional)</label>
              <input className="input w-full" type="date" value={form.deadline} min={today()} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div className="flex items-end gap-2 justify-end">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </Panel>
      )}

      {/* Active goals */}
      {active.length === 0 && !showForm ? (
        <Panel>
          <div className="px-6 py-14 text-center">
            <div className="text-4xl mb-3 opacity-60">◇</div>
            <p className="text-ink-mid mb-4">No goals yet. Set a target to work towards.</p>
            <button className="btn-primary" onClick={openAdd}>Add First Goal</button>
          </div>
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {active.map(g => <GoalCard key={g.id} g={g} />)}
        </div>
      )}

      {/* Completed goals toggle */}
      {completed.length > 0 && (
        <div className="mt-6">
          <button className="text-[0.8rem] text-ink-dim hover:text-ink transition-colors flex items-center gap-1.5"
            onClick={() => setShowCompleted(s => !s)}>
            <span>{showCompleted ? '▾' : '▸'}</span>
            {completed.length} completed goal{completed.length !== 1 ? 's' : ''}
          </button>
          {showCompleted && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {completed.map(g => <GoalCard key={g.id} g={g} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
