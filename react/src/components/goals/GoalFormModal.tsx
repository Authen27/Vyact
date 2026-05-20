// FinFlow v6.4 — GoalFormModal
//
// Modal-driven Goal create/edit form mirroring the pattern of
// TransactionFormModal so the two surfaces feel consistent. Bound to the
// global store (goalModalOpen / editingGoal / closeGoalModal) and mounted
// once at the App root.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Field, FieldRow } from '../ui/Input';
import { useStore } from '../../store';
import { uid, today } from '../../lib/format';
import { CURRENCIES, GOAL_ICONS } from '../../constants';
import type { Goal, GoalType } from '../../types';

interface Props {
  open?: boolean;
  initial?: Goal | null;
  onClose?: () => void;
}

interface FormState {
  type: GoalType;
  name: string;
  target: string;
  current: string;
  currency: string;
  deadline: string;
}

const blank = (currency: string): FormState => ({
  type: 'savings', name: '', target: '', current: '0', currency, deadline: '',
});

const GOAL_TYPES: { key: GoalType; label: string }[] = [
  { key: 'emergency',  label: 'Emergency Fund' },
  { key: 'savings',    label: 'Savings' },
  { key: 'debt',       label: 'Debt Payoff' },
  { key: 'investment', label: 'Investment' },
  { key: 'purchase',   label: 'Purchase' },
  { key: 'custom',     label: 'Custom' },
];

export default function GoalFormModal(props: Props) {
  const profile     = useStore(s => s.profile);
  const upsertGoal  = useStore(s => s.upsertGoal);
  const removeGoal  = useStore(s => s.removeGoal);
  const toast       = useStore(s => s.toast);

  const storeOpen    = useStore(s => s.goalModalOpen);
  const storeInitial = useStore(s => s.editingGoal);
  const storeClose   = useStore(s => s.closeGoalModal);
  const open    = props.open    ?? storeOpen;
  const initial = props.initial ?? storeInitial;
  const onClose = props.onClose ?? storeClose;

  const [form, setForm]    = useState<FormState>(blank(profile.baseCurrency));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        type: initial.type,
        name: initial.name,
        target: String(initial.target),
        current: String(initial.current),
        currency: initial.currency,
        deadline: initial.deadline ?? '',
      });
    } else {
      setForm(blank(profile.baseCurrency));
    }
  }, [open, initial, profile.baseCurrency]);

  async function save() {
    const target  = parseFloat(form.target);
    const current = parseFloat(form.current);
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    if (isNaN(target) || target <= 0) { toast('Target must be greater than 0', 'error'); return; }
    setSaving(true);
    try {
      await upsertGoal({
        id: initial?.id ?? uid(),
        type: form.type,
        name: form.name.trim(),
        target,
        current: isNaN(current) ? 0 : current,
        currency: form.currency,
        deadline: form.deadline || undefined,
        completed: initial?.completed ?? false,
      });
      toast(initial ? 'Goal updated' : 'Goal added', 'success');
      onClose();
    } catch (e) {
      toast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!initial) return;
    if (!confirm('Delete this goal?')) return;
    try {
      await removeGoal(initial.id);
      toast('Goal deleted', 'info');
      onClose();
    } catch (e) {
      toast(`Delete failed: ${(e as Error).message}`, 'error');
    }
  }

  return (
    <Modal open={open} title={initial ? 'Edit Goal' : 'Add Goal'} onClose={onClose}>
      <FieldRow>
        <Field label="Type">
          <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as GoalType }))}>
            {GOAL_TYPES.map(g => (
              <option key={g.key} value={g.key}>{GOAL_ICONS[g.key]} {g.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Deadline" hint="optional">
          <Input type="date" min={today()} value={form.deadline}
            onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
        </Field>
      </FieldRow>

      <Field label="Name">
        <Input
          autoFocus
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Emergency Fund"
        />
      </Field>

      <FieldRow>
        <Field label="Target Amount">
          <Input type="number" min="0" step="0.01" value={form.target}
            onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
            placeholder="10000" />
        </Field>
        <Field label="Currency">
          <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <option key={code} value={code}>{c.symbol} {code}</option>
            ))}
          </Select>
        </Field>
      </FieldRow>

      <Field label="Current Progress" hint="amount saved so far">
        <Input type="number" min="0" step="0.01" value={form.current}
          onChange={e => setForm(f => ({ ...f, current: e.target.value }))} placeholder="0" />
      </Field>

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
