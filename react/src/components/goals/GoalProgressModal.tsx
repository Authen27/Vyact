// Vyact v6.4 — GoalProgressModal
//
// Replaces the old `prompt()` flow used to add progress to a goal so that
// the UX matches the rest of the app (Modal + Field + Button) and works on
// mobile/desktop consistently.

import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Field } from '../ui/Input';
import { useStore } from '../../store';

export default function GoalProgressModal() {
  const open      = useStore(s => s.goalProgressModalOpen);
  const goal      = useStore(s => s.progressGoal);
  const onClose   = useStore(s => s.closeGoalProgress);
  const upsertGoal = useStore(s => s.upsertGoal);
  const toast     = useStore(s => s.toast);

  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setAmount(''); }, [open]);

  if (!open || !goal) return null;

  async function save() {
    if (!goal) return;
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) { toast('Enter an amount greater than 0', 'error'); return; }
    setSaving(true);
    try {
      const newCurrent = goal.current + n;
      await upsertGoal({ ...goal, current: newCurrent, completed: newCurrent >= goal.target });
      toast('Progress updated', 'success');
      onClose();
    } catch (e) {
      toast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} title={`Add Progress · ${goal.name}`} onClose={onClose}>
      <div className="text-[0.84rem] text-ink-mid mb-3">
        Currently <span className="font-semibold text-ink">{goal.current.toLocaleString()}</span> of{' '}
        <span className="font-semibold text-ink">{goal.target.toLocaleString()} {goal.currency}</span>
      </div>
      <Field label={`Amount to add (${goal.currency})`}>
        <Input
          autoFocus
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); }}
          placeholder="100"
        />
      </Field>
      <div className="flex justify-end gap-2 mt-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button>
      </div>
    </Modal>
  );
}
