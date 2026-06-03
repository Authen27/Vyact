import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { convert } from '../lib/format';
import { GOAL_ICONS, GOAL_COLORS } from '../constants';
import type { Goal } from '../types';
import { useState } from 'react';
import { Pencil, Trash2, Check, RotateCcw, Plus } from 'lucide-react';
import Money from '../components/ui/Money';

function daysLeft(deadline?: string) {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

export default function Goals() {
  const { t } = useTranslation();
  const goals       = useStore(s => s.goals);
  const profile     = useStore(s => s.profile);
  const rates       = useStore(s => s.rates);
  const upsertGoal  = useStore(s => s.upsertGoal);
  const removeGoal  = useStore(s => s.removeGoal);
  const toast       = useStore(s => s.toast);
  const openAddGoal      = useStore(s => s.openAddGoal);
  const openEditGoal     = useStore(s => s.openEditGoal);
  const openGoalProgress = useStore(s => s.openGoalProgress);

  const [showCompleted, setShowCompleted] = useState(false);

  const active    = goals.filter(g => !g.completed);
  const completed = goals.filter(g => g.completed);

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
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl flex-shrink-0">{icon}</span>
            <div className="min-w-0">
              <div className="font-semibold text-ink text-[0.9rem] truncate">{g.name}</div>
              <div className="font-mono text-[0.6rem] tracking-wider text-ink-dim uppercase">{g.type}</div>
            </div>
          </div>
          {g.completed && (
            <span className="font-mono text-[0.6rem] tracking-widest px-2 py-0.5 rounded-full bg-sage/10 border border-sage/30 text-sage flex-shrink-0">
              Done
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-2.5 bg-bg3 rounded-full mb-2 overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: color }} />
        </div>
        <div className="flex justify-between items-center text-[0.78rem] text-ink-mid mb-3 gap-2 min-w-0">
          <Money amount={currentBase} currency={profile.baseCurrency} className="font-semibold text-ink" maxChars={10} />
          <span className="flex items-center gap-1 flex-shrink-0">
            {Math.round(p)}% · <Money amount={targetBase} currency={profile.baseCurrency} maxChars={10} />
          </span>
        </div>

        {days !== null && !g.completed && (
          <div className={`font-mono text-[0.62rem] tracking-wider mb-3 ${days < 0 ? 'text-terra' : days < 30 ? 'text-honey' : 'text-ink-dim'}`}>
            {days < 0 ? `${-days}d overdue` : `${days}d remaining`} · {g.deadline}
          </div>
        )}

        <div className="flex gap-1 items-center">
          {!g.completed && (
            <button className="row-action" onClick={() => openGoalProgress(g)} aria-label="Add progress" title="Add progress">
              <Plus size={14} strokeWidth={1.8} />
            </button>
          )}
          <button className="row-action" onClick={() => openEditGoal(g)} aria-label="Edit goal" title="Edit">
            <Pencil size={14} strokeWidth={1.6} />
          </button>
          <button className="row-action" onClick={() => toggleComplete(g)} aria-label={g.completed ? 'Reopen goal' : 'Mark goal complete'} title={g.completed ? 'Reopen' : 'Mark done'}>
            {g.completed ? <RotateCcw size={14} strokeWidth={1.6} /> : <Check size={14} strokeWidth={1.8} />}
          </button>
          <button className="row-action danger ml-auto" onClick={() => del(g.id)} aria-label="Delete goal" title="Delete">
            <Trash2 size={14} strokeWidth={1.6} />
          </button>
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
        <button className="btn-primary" onClick={openAddGoal}>+ Add Goal</button>
      </div>

      {active.length === 0 ? (
        <Panel>
          <div className="px-6 py-14 text-center">
            <div className="text-4xl mb-3 opacity-60">◇</div>
            <p className="text-ink-mid mb-4">No goals yet. Set a target to work towards.</p>
            <button className="btn-primary" onClick={openAddGoal}>Add First Goal</button>
          </div>
        </Panel>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {active.map(g => <GoalCard key={g.id} g={g} />)}
        </div>
      )}

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
