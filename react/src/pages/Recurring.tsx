import { useState } from 'react';
import { Plus, Repeat, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useStore } from '../store';
import { Panel } from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { Input, Select, Field, FieldRow } from '../components/ui/Input';
import Modal from '../components/ui/Modal';
import { fmt, formatDate } from '../lib/format';
import { getCat, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';
import type { RecurrenceFreq } from '../types';
import { computeNextDueDate } from '../lib/recurring';

export default function Recurring() {
  const schedules = useStore(s => s.recurringSchedules);
  const upsert = useStore(s => s.upsertRecurring);
  const remove = useStore(s => s.removeRecurring);
  const baseCur = useStore(s => s.profile.baseCurrency);
  const dateFormat = useStore(s => s.profile.dateFormat);
  const toast = useStore(s => s.toast);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [freq, setFreq] = useState<RecurrenceFreq>('monthly');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('rent');
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [reminderLead, setReminderLead] = useState<1|3|7>(3);

  async function save() {
    if (!name || !amount) return;
    const startDate = new Date().toISOString().split('T')[0];
    const next = computeNextDueDate(freq, startDate, undefined, dayOfMonth);
    await upsert({
      transactionTemplate: {
        type, amount: parseFloat(amount), description: name,
        category, currency: baseCur, recurring: freq === 'custom_day' ? 'monthly' : freq,
      },
      frequency: freq,
      dayOfMonth,
      startDate,
      nextDueDate: next,
      autoConfirm,
      active: true,
      reminderLeadDays: reminderLead,
    });
    setOpen(false);
    setName(''); setAmount('');
    toast('Recurring schedule created', 'success');
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">Recurring</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Auto-generated bills, subscriptions &amp; salary · {schedules.length} schedule{schedules.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus size={14} /> Add Schedule
        </Button>
      </div>

      <Panel title="Active Schedules">
        {schedules.length === 0
          ? <EmptyState icon={<Repeat size={36} />} message="No recurring schedules yet — set up rent, salary, subscriptions" />
          : schedules.map(s => {
              const cat = getCat(s.transactionTemplate.category);
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center text-base flex-shrink-0" style={{ background: cat.color + '22' }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-ink truncate">{s.transactionTemplate.description}</div>
                    <div className="font-mono text-[0.62rem] text-ink-dim mt-px">
                      {s.frequency.toUpperCase()} · next {formatDate(s.nextDueDate, dateFormat)} · {s.autoConfirm ? 'auto' : 'pending confirm'}
                    </div>
                  </div>
                  <div className={`font-mono text-[0.86rem] font-medium ${s.transactionTemplate.type === 'income' ? 'text-sage' : 'text-terra'}`}>
                    {s.transactionTemplate.type === 'income' ? '+' : '−'}{fmt(s.transactionTemplate.amount, s.transactionTemplate.currency)}
                  </div>
                  <button onClick={() => upsert({ ...s, active: !s.active })} className="p-1.5 text-ink-mid hover:text-ink" title={s.active ? 'Pause' : 'Resume'}>
                    {s.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => { if (confirm('Delete this schedule?')) { remove(s.id); toast('Schedule deleted', 'info'); } }} className="p-1.5 text-ink-mid hover:text-terra" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
        }
      </Panel>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Recurring Schedule">
        <div>
          <Field label="Type">
            <div className="grid grid-cols-2 gap-1 bg-bg3 p-1 rounded-md">
              {(['expense','income'] as const).map(t => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`py-2 font-mono text-[0.66rem] tracking-wider uppercase rounded transition ${type === t ? (t === 'expense' ? 'bg-terra/15 text-terra' : 'bg-sage/15 text-olive') : 'text-ink-mid'}`}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Description"><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rent · Salary · Netflix" /></Field>
          <FieldRow>
            <Field label="Amount"><Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></Field>
            <Field label="Category">
              <Select value={category} onChange={e => setCategory(e.target.value)}>
                {(type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(c =>
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                )}
              </Select>
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Frequency">
              <Select value={freq} onChange={e => setFreq(e.target.value as RecurrenceFreq)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom_day">Custom day of month</option>
              </Select>
            </Field>
            {(freq === 'monthly' || freq === 'custom_day') && (
              <Field label="Day of month">
                <Input type="number" min={1} max={31} value={dayOfMonth} onChange={e => setDayOfMonth(parseInt(e.target.value) || 1)} />
              </Field>
            )}
          </FieldRow>
          <FieldRow>
            <Field label="Reminder lead time">
              <Select value={reminderLead} onChange={e => setReminderLead(parseInt(e.target.value) as 1|3|7)}>
                <option value="1">1 day before</option>
                <option value="3">3 days before</option>
                <option value="7">7 days before</option>
              </Select>
            </Field>
            <Field label="Confirmation">
              <label className="flex items-center gap-2 mt-2.5 text-[0.84rem] text-ink cursor-pointer">
                <input type="checkbox" checked={autoConfirm} onChange={e => setAutoConfirm(e.target.checked)} className="accent-coral" />
                Auto-confirm (no manual approval)
              </label>
            </Field>
          </FieldRow>
          <div className="flex gap-2 mt-5 pt-4 border-t border-line">
            <Button variant="ghost" onClick={() => setOpen(false)} full>Cancel</Button>
            <Button onClick={save} full>Save Schedule</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
