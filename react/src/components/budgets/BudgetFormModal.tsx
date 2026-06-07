// Vyact v6.4 — BudgetFormModal
//
// Modal-driven Budget create/edit form. Mirrors TransactionFormModal /
// GoalFormModal so the three creation surfaces feel consistent.
//
// Period selector (monthly / quarterly / half-yearly / annual / custom)
// persists to the budgets.period / period_start / period_end columns
// added in PR #20. The earlier client-side overlay (lib/budgetMeta.ts)
// was removed on 2026-06-01 now that the schema carries the fields.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Field, FieldRow } from '../ui/Input';
import { useStore } from '../../store';
import { uid, today } from '../../lib/format';
import { EXPENSE_CATEGORIES, BUDGET_COLORS, deterministicColor } from '../../constants';
import { FEATURES } from '../../config/features';
import { rollupAllocations } from '../../lib/budgetIntel';
import type { BudgetAllocation } from '../../types';
import type { Budget, BudgetPeriod } from '../../types';

interface Props {
  open?: boolean;
  initial?: Budget | null;
  onClose?: () => void;
}

interface FormState {
  category: string;
  limit: string;
  currency: string;
  color: string;
  period: BudgetPeriod;
  periodStart: string;
  periodEnd: string;
}

const blank = (currency: string): FormState => ({
  category: 'food',
  limit: '',
  currency,
  color: BUDGET_COLORS[0],
  period: 'monthly',
  periodStart: '',
  periodEnd: '',
});

const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  monthly:     'Monthly',
  quarterly:   'Quarterly (3 months)',
  half_yearly: 'Half-yearly (6 months)',
  annual:      'Annual (12 months)',
  custom:      'Custom date range',
};

const PERIOD_HINT: Record<BudgetPeriod, string> = {
  monthly:     'limit applies to the current calendar month',
  quarterly:   'limit applies to the current calendar quarter',
  half_yearly: 'limit applies to the current half-year',
  annual:      'limit applies to the current calendar year',
  custom:      'limit applies between your chosen dates',
};

const CURRENCIES = ['USD','EUR','GBP','INR','JPY','AUD','CAD','CHF','CNY','AED','SGD','BRL'];

export default function BudgetFormModal(props: Props) {
  const profile      = useStore(s => s.profile);
  const upsertBudget = useStore(s => s.upsertBudget);
  const removeBudget = useStore(s => s.removeBudget);
  const toast        = useStore(s => s.toast);

  const storeOpen    = useStore(s => s.budgetModalOpen);
  const storeInitial = useStore(s => s.editingBudget);
  const storeClose   = useStore(s => s.closeBudgetModal);
  const open    = props.open    ?? storeOpen;
  const initial = props.initial ?? storeInitial;
  const onClose = props.onClose ?? storeClose;

  const [form, setForm]    = useState<FormState>(blank(profile.baseCurrency));
  const [saving, setSaving] = useState(false);
  // B2.3 — category sub-limits (allocations). Held separate from the string form.
  const [allocs, setAllocs] = useState<BudgetAllocation[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        category: initial.category,
        limit: String(initial.limit),
        currency: initial.currency,
        color: initial.color || BUDGET_COLORS[0],
        period: initial.period || 'monthly',
        periodStart: initial.periodStart || '',
        periodEnd: initial.periodEnd || '',
      });
      setAllocs(initial.allocations ?? []);
    } else {
      setForm(blank(profile.baseCurrency));
      setAllocs([]);
    }
  }, [open, initial, profile.baseCurrency]);

  async function save() {
    const lim = parseFloat(form.limit);
    if (!form.category) { toast('Choose a category', 'error'); return; }
    if (isNaN(lim) || lim <= 0) { toast('Enter a limit greater than 0', 'error'); return; }
    if (form.period === 'custom') {
      if (!form.periodStart || !form.periodEnd) {
        toast('Enter start and end dates for custom period', 'error'); return;
      }
      if (form.periodStart > form.periodEnd) {
        toast('Start date must be before end date', 'error'); return;
      }
    }
    setSaving(true);
    try {
      await upsertBudget({
        id: initial?.id ?? uid(),
        category: form.category,
        limit: lim,
        currency: form.currency,
        // B2.1 — when the colour picker is removed, derive a stable colour from
        // the category so it's consistent app-wide with zero user input.
        color: FEATURES.budgetsV2.removeColorPicker ? deterministicColor(form.category) : form.color,
        period: form.period,
        periodStart: form.period === 'custom' ? form.periodStart : undefined,
        periodEnd:   form.period === 'custom' ? form.periodEnd   : undefined,
        // B2.3 — persist only valid, named sub-limits; undefined when none.
        allocations: FEATURES.budgetsV2.allocations
          ? (() => { const v = allocs.filter(a => a.category.trim() && a.limit > 0); return v.length ? v : undefined; })()
          : initial?.allocations,
      });
      toast(initial ? 'Budget updated' : 'Budget added', 'success');
      onClose();
    } catch (e) {
      toast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!initial) return;
    if (!confirm('Delete this budget?')) return;
    try {
      await removeBudget(initial.id);
      toast('Budget deleted', 'info');
      onClose();
    } catch (e) {
      toast(`Delete failed: ${(e as Error).message}`, 'error');
    }
  }

  return (
    <Modal open={open} title={initial ? 'Edit Budget' : 'Add Budget'} onClose={onClose}>
      <Field label="Category">
        <Select autoFocus value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </Select>
      </Field>

      <FieldRow>
        <Field label="Limit">
          <Input
            type="number" min="0" step="0.01" value={form.limit}
            onChange={e => setForm(f => ({ ...f, limit: e.target.value }))}
            placeholder="500"
          />
        </Field>
        <Field label="Currency">
          <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
      </FieldRow>

      <Field label="Period" hint={PERIOD_HINT[form.period]}>
        <Select value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value as BudgetPeriod }))}>
          {(Object.keys(PERIOD_LABELS) as BudgetPeriod[]).map(p => (
            <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
          ))}
        </Select>
      </Field>

      {form.period === 'custom' && (
        <FieldRow>
          <Field label="Start date">
            <Input type="date" value={form.periodStart}
              onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} />
          </Field>
          <Field label="End date">
            <Input type="date" value={form.periodEnd} min={form.periodStart || today()}
              onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} />
          </Field>
        </FieldRow>
      )}

      {/* B2.1 (alpha item 2) — colour picker removed by default; colour is derived
          deterministically from the category. Flip budgetsV2.removeColorPicker to
          restore the manual picker. */}
      {!FEATURES.budgetsV2.removeColorPicker && (
        <Field label="Colour">
          <div className="flex gap-2 flex-wrap">
            {BUDGET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-ink scale-110' : 'border-transparent'}`}
                style={{ background: c }}
                aria-label={`Choose colour ${c}`}
              />
            ))}
          </div>
        </Field>
      )}

      {/* B2.3 — category allocations that roll up to the parent limit, with a
          transparent allocated / unallocated indicator and an over-allocation
          warning (A1 discipline applied to budgets). */}
      {FEATURES.budgetsV2.allocations && (() => {
        const parent = parseFloat(form.limit) || 0;
        const roll = rollupAllocations(parent, allocs.map(a => a.limit || 0));
        return (
          <Field label="Allocations (optional)">
            <div className="space-y-2">
              {allocs.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Sub-category" value={a.category}
                    onChange={e => setAllocs(prev => prev.map((x, j) => j === i ? { ...x, category: e.target.value } : x))} />
                  <Input type="number" placeholder="0" value={a.limit ? String(a.limit) : ''} className="w-28"
                    onChange={e => setAllocs(prev => prev.map((x, j) => j === i ? { ...x, limit: parseFloat(e.target.value) || 0 } : x))} />
                  <button type="button" onClick={() => setAllocs(prev => prev.filter((_, j) => j !== i))}
                    className="text-ink-dim hover:text-terra px-1" aria-label="Remove allocation">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => setAllocs(prev => [...prev, { category: '', limit: 0 }])}
                className="font-mono text-[0.62rem] tracking-wider uppercase text-coral hover:underline">+ Add allocation</button>
              {allocs.length > 0 && (
                <div className={`flex justify-between font-mono text-[0.62rem] tracking-wider mt-1 ${roll.overAllocated ? 'text-terra' : 'text-ink-dim'}`}>
                  <span>Allocated {Math.round(roll.allocated)} / {Math.round(parent)}</span>
                  <span>{roll.overAllocated ? `Over by ${Math.round(roll.allocated - parent)}` : `${Math.round(roll.unallocated)} unallocated`}</span>
                </div>
              )}
            </div>
          </Field>
        );
      })()}

      <div className="flex items-center justify-between gap-2 mt-2">
        {initial ? (
          <button type="button" onClick={del}
            className="font-mono text-[0.62rem] tracking-wider uppercase text-terra hover:underline">
            Delete
          </button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Update' : 'Add'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
