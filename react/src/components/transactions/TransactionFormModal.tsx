import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { Input, Select, Field, FieldRow } from '../ui/Input';
import { useStore } from '../../store';
import { uid, today } from '../../lib/format';
import {
  ALL_CATEGORIES,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CURRENCIES,
} from '../../constants';
import { buildAccounts, resolveAccount, ACCOUNT_REQUIRED_TYPES } from '../../lib/accounts';
import type { Transaction, TxnType, Recurrence } from '../../types';

interface Props {
  /** Optional override props — when omitted, the modal binds to the global store
   *  state (txnModalOpen / editingTxn / closeTxnModal). Used at App root. */
  open?: boolean;
  initial?: Transaction | null;
  onClose?: () => void;
}

interface SplitParticipantForm {
  name: string;
  share: string;
  isYou: boolean;
  paid: boolean;
  paidOn?: string | null;
}

interface FormState {
  type: TxnType;
  amount: string;
  currency: string;
  date: string;
  description: string;
  category: string;
  note: string;
  memberId: string;
  paymentMethod: string;
  recurring: Recurrence | '';
  excluded: boolean;
  // ── split ──
  splitEnabled: boolean;
  splitPaidBy: 'me' | 'external';
  splitParticipants: SplitParticipantForm[];
  // When true, shares are kept auto-balanced to an even split; flips to false the
  // moment the user edits a share by hand (so manual amounts are never clobbered).
  splitAuto: boolean;
}

const defaultParticipants = (): SplitParticipantForm[] => ([
  { name: 'You', share: '', isYou: true,  paid: true },
  { name: '',    share: '', isYou: false, paid: false },
]);

const blank = (currency: string): FormState => ({
  type: 'expense',
  amount: '',
  currency,
  date: today(),
  description: '',
  category: 'food',
  note: '',
  memberId: '',
  paymentMethod: '',
  recurring: '',
  excluded: false,
  splitEnabled: false,
  splitPaidBy: 'me',
  splitParticipants: defaultParticipants(),
  splitAuto: true,
});

// Even split of `bill` across `n` people; rounding remainder goes to the first.
function evenShares(bill: number, n: number): string[] {
  if (n < 1) return [];
  const base = Math.floor((bill / n) * 100) / 100;
  const shares = Array(n).fill(base);
  const remainder = Math.round((bill - base * n) * 100) / 100;
  shares[0] = Math.round((shares[0] + remainder) * 100) / 100;
  return shares.map(s => (bill > 0 ? s.toFixed(2) : ''));
}

function categoriesFor(type: TxnType) {
  if (type === 'income')   return INCOME_CATEGORIES;
  if (type === 'expense')  return EXPENSE_CATEGORIES;
  return ALL_CATEGORIES;
}

export default function TransactionFormModal(props: Props) {
  const profile           = useStore(s => s.profile);
  const members           = useStore(s => s.members);
  const assets            = useStore(s => s.assets);
  const debts             = useStore(s => s.debts);
  const upsertTransaction = useStore(s => s.upsertTransaction);
  const removeTransaction = useStore(s => s.removeTransaction);
  const toast             = useStore(s => s.toast);

  // Bind to the global store unless explicit props are passed
  const storeOpen     = useStore(s => s.txnModalOpen);
  const storeInitial  = useStore(s => s.editingTxn);
  const storeClose    = useStore(s => s.closeTxnModal);
  const open          = props.open    ?? storeOpen;
  const initial       = props.initial ?? storeInitial;
  const onClose       = props.onClose ?? storeClose;

  const [form, setForm]    = useState<FormState>(blank(profile.baseCurrency));
  const [saving, setSaving] = useState(false);

  // Linked spending accounts derived from Net Worth (cash + bank assets + credit cards).
  const accounts = useMemo(() => buildAccounts(assets, debts), [assets, debts]);
  const accountRequired = ACCOUNT_REQUIRED_TYPES.includes(
    form.type as (typeof ACCOUNT_REQUIRED_TYPES)[number],
  );

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const sp = initial.split;
      setForm({
        type: initial.type,
        amount: String(sp?.isSplit ? sp.totalAmount : initial.amount),
        currency: initial.currency,
        date: initial.date,
        description: initial.description,
        category: initial.category,
        note: initial.note ?? '',
        memberId: initial.memberId ?? '',
        paymentMethod: initial.paymentMethod ?? '',
        recurring: initial.recurring ?? '',
        excluded: Boolean(initial.excluded),
        splitEnabled: Boolean(sp?.isSplit),
        splitPaidBy: sp?.paidBy ?? 'me',
        // Existing splits keep their explicit shares (no auto-rebalance);
        // a fresh split starts in auto-even mode.
        splitAuto: !sp?.isSplit,
        splitParticipants: sp?.isSplit && sp.participants.length
          ? sp.participants.map(p => ({
              name: p.isYou ? 'You' : p.name,
              share: String(p.share),
              isYou: Boolean(p.isYou),
              paid: p.paid,
              paidOn: p.paidOn,
            }))
          : defaultParticipants(),
      });
    } else {
      setForm(blank(profile.baseCurrency));
    }
  }, [open, initial, profile.baseCurrency]);

  const cats = categoriesFor(form.type);

  // Reset category to a valid one if type change orphans it
  useEffect(() => {
    if (!cats.find(c => c.id === form.category)) {
      setForm(f => ({ ...f, category: cats[0]?.id ?? f.category }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type]);

  // ── split helpers ──
  function updateName(i: number, name: string) {
    // Editing a name never disturbs auto-balanced shares.
    setForm(f => ({ ...f, splitParticipants: f.splitParticipants.map((x, j) => j === i ? { ...x, name } : x) }));
  }
  function editShare(i: number, share: string) {
    // Manual edit → leave auto mode so we respect the user's numbers.
    setForm(f => ({ ...f, splitAuto: false, splitParticipants: f.splitParticipants.map((x, j) => j === i ? { ...x, share } : x) }));
  }
  function addParticipant() {
    // Keep whatever mode we're in; the rebalance effect re-evens shares in auto mode.
    setForm(f => ({ ...f, splitParticipants: [...f.splitParticipants, { name: '', share: '', isYou: false, paid: false }] }));
  }
  function removeParticipant(i: number) {
    setForm(f => ({ ...f, splitParticipants: f.splitParticipants.filter((_, j) => j !== i) }));
  }
  function resetEvenSplit() {
    setForm(f => ({ ...f, splitAuto: true }));
  }

  // Auto-balance: while in auto mode, keep every share at an even split of the bill.
  // Re-runs when the bill or the number of participants changes.
  useEffect(() => {
    if (!form.splitEnabled || !form.splitAuto) return;
    const bill = parseFloat(form.amount) || 0;
    const shares = evenShares(bill, form.splitParticipants.length);
    setForm(f => {
      if (!f.splitAuto) return f;
      const changed = f.splitParticipants.some((p, i) => p.share !== shares[i]);
      if (!changed) return f;
      return { ...f, splitParticipants: f.splitParticipants.map((p, i) => ({ ...p, share: shares[i] })) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.amount, form.splitEnabled, form.splitAuto, form.splitParticipants.length]);

  async function save() {
    const amount = parseFloat(form.amount);
    if (isNaN(amount) || amount <= 0) {
      toast('Enter a valid amount greater than 0', 'error');
      return;
    }
    if (!form.description.trim()) {
      toast('Description is required', 'error');
      return;
    }
    // ── Account required for money that moves in/out of an account ──
    if (accountRequired && !form.paymentMethod) {
      toast('Choose an account (cash, bank or card) for this transaction', 'error');
      return;
    }

    // ── Build split info (expense only) ──
    let split: Transaction['split'] | undefined = undefined;
    if (form.type === 'expense' && form.splitEnabled) {
      const parts = form.splitParticipants
        .map(p => ({ ...p, shareNum: parseFloat(p.share) }))
        .filter(p => (p.isYou || p.name.trim()) && !isNaN(p.shareNum) && p.shareNum >= 0);
      const you = parts.find(p => p.isYou);
      if (!you) { toast('A split needs your share', 'error'); return; }
      if (parts.length < 2) { toast('A split needs at least one other participant', 'error'); return; }
      if (parts.some(p => !p.isYou && !p.name.trim())) { toast('All participants must have a name', 'error'); return; }
      const sumShares = parts.reduce((s, p) => s + p.shareNum, 0);
      if (Math.abs(sumShares - amount) > 0.01) {
        toast(`Participant shares (${sumShares.toFixed(2)}) must add up to the total bill (${amount.toFixed(2)})`, 'error');
        return;
      }
      split = {
        isSplit: true,
        totalAmount: amount,
        yourShare: you.shareNum,
        paidBy: form.splitPaidBy,
        participants: parts.map(p => ({
          name: p.isYou ? 'You' : p.name.trim(),
          isYou: p.isYou || undefined,
          share: p.shareNum,
          paid: form.splitPaidBy === 'me' ? Boolean(p.isYou || p.paid) : Boolean(!p.isYou || p.paid),
          paidOn: p.paidOn ?? null,
        })),
      };
    }

    setSaving(true);
    try {
      const txn: Transaction = {
        id: initial?.id ?? uid(),
        type: form.type,
        amount,
        currency: form.currency,
        date: form.date,
        description: form.description.trim(),
        category: form.category,
        note: form.note.trim() || undefined,
        memberId: form.memberId || undefined,
        paymentMethod: form.paymentMethod || undefined,
        recurring: form.recurring || undefined,
        excluded: form.excluded || undefined,
        linkedAssetId: initial?.linkedAssetId,
        linkedDebtId:  initial?.linkedDebtId,
        linkedTxnId:   initial?.linkedTxnId,
        split,
      };
      await upsertTransaction(txn);
      toast(initial ? 'Transaction updated' : 'Transaction added', 'success');
      onClose();
    } catch (e) {
      toast(`Save failed: ${(e as Error).message}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!initial) return;
    if (!confirm('Delete this transaction?')) return;
    try {
      await removeTransaction(initial.id);
      toast('Transaction deleted', 'info');
      onClose();
    } catch (e) {
      toast(`Delete failed: ${(e as Error).message}`, 'error');
    }
  }

  // The current value may be a legacy method not in the derived list — keep it selectable.
  const currentAccount = resolveAccount(form.paymentMethod, assets, debts);
  const currentInList = accounts.some(a => a.value === form.paymentMethod);

  return (
    <Modal open={open} title={initial ? 'Edit Transaction' : 'Add Transaction'} onClose={onClose}>
      <FieldRow>
        <Field label="Type">
          <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as TxnType }))}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="investment">Investment</option>
            <option value="transfer">Transfer</option>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </Field>
      </FieldRow>

      <Field label="Description">
        <Input
          autoFocus
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="e.g. Tesco grocery run"
        />
      </Field>

      <FieldRow>
        <Field label="Amount">
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0.00"
          />
        </Field>
        <Field label="Currency">
          <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
            {Object.entries(CURRENCIES).map(([code, c]) => (
              <option key={code} value={code}>{c.symbol} {code}</option>
            ))}
          </Select>
        </Field>
      </FieldRow>

      <Field label="Category">
        <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
          {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </Select>
      </Field>

      <FieldRow>
        <Field label="Member" hint="optional">
          <Select value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))}>
            <option value="">— None —</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
        </Field>
        <Field label="Account" hint={accountRequired ? 'required' : 'optional'}>
          <Select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
            <option value="">{accountRequired ? '— Select an account —' : '— None —'}</option>
            {accounts.map(a => (
              <option key={a.value} value={a.value}>
                {a.kind === 'card' ? '💳 ' : a.kind === 'bank' ? '🏦 ' : '💵 '}{a.label}
              </option>
            ))}
            {/* Preserve a legacy / unlisted value so editing never silently drops it */}
            {form.paymentMethod && !currentInList && (
              <option value={form.paymentMethod}>
                {currentAccount ? currentAccount.label : form.paymentMethod} (legacy)
              </option>
            )}
          </Select>
        </Field>
      </FieldRow>
      {accountRequired && accounts.length <= 1 && (
        <p className="-mt-2 mb-3 text-[0.7rem] text-ink-dim leading-snug">
          Tip: add your bank accounts and credit cards on the <strong>Net Worth</strong> page to
          spend from them here. Only Cash is available until then.
        </p>
      )}

      <FieldRow>
        <Field label="Recurring" hint="optional">
          <Select value={form.recurring} onChange={e => setForm(f => ({ ...f, recurring: e.target.value as Recurrence | '' }))}>
            <option value="">— Not recurring —</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </Field>
        <Field label="Note" hint="optional">
          <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="" />
        </Field>
      </FieldRow>

      <label className="flex items-center gap-2 mb-3 text-[0.84rem] text-ink-mid cursor-pointer select-none">
        <input
          type="checkbox"
          checked={form.excluded}
          onChange={e => setForm(f => ({ ...f, excluded: e.target.checked }))}
        />
        <span>🔒 Private — exclude from totals, charts and Pulse Score</span>
      </label>

      {/* ── Split a bill (expense only) ── */}
      {form.type === 'expense' && (
        <div className="mb-4 border border-line rounded-lg overflow-hidden">
          <label className="flex items-center gap-2 px-3 py-2.5 bg-bg3 text-[0.84rem] text-ink cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.splitEnabled}
              onChange={e => setForm(f => ({ ...f, splitEnabled: e.target.checked, splitAuto: e.target.checked ? true : f.splitAuto }))}
            />
            <span>🤝 Split this bill with others</span>
          </label>

          {form.splitEnabled && (
            <div className="p-3 space-y-3">
              <Field label="Who paid the bill?">
                <Select
                  value={form.splitPaidBy}
                  onChange={e => setForm(f => ({ ...f, splitPaidBy: e.target.value as 'me' | 'external' }))}
                >
                  <option value="me">You paid — others owe you</option>
                  <option value="external">Someone else paid — you owe your share</option>
                </Select>
              </Field>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="mono-label">Participants &amp; shares ({form.currency})</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={resetEvenSplit}
                      className={`font-mono text-[0.6rem] tracking-wider uppercase hover:underline ${form.splitAuto ? 'text-sage' : 'text-ink-dim'}`}
                      title="Reset to an even split"
                    >
                      {form.splitAuto ? '⚖ Even (auto)' : '⚖ Even split'}
                    </button>
                    <button
                      type="button"
                      onClick={addParticipant}
                      className="font-mono text-[0.6rem] tracking-wider uppercase text-coral hover:underline"
                    >
                      + Add person
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {form.splitParticipants.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        className="input flex-1 py-1.5"
                        value={p.isYou ? 'You' : p.name}
                        disabled={p.isYou}
                        placeholder="Name"
                        onChange={e => updateName(i, e.target.value)}
                        onKeyDown={e => {
                          if (!p.isYou && (e.key === 'Backspace' || e.key === 'Delete') && !p.name && form.splitParticipants.length > 2) {
                            e.preventDefault();
                            removeParticipant(i);
                          }
                        }}
                      />
                      <input
                        className="input w-28 py-1.5 text-right"
                        type="number" min="0" step="0.01"
                        value={p.share}
                        placeholder="0.00"
                        onChange={e => editShare(i, e.target.value)}
                      />
                      {!p.isYou ? (
                        <button
                          type="button"
                          onClick={() => removeParticipant(i)}
                          className="text-ink-dim hover:text-terra w-7 flex-shrink-0 text-center"
                          aria-label="Remove participant"
                        >✕</button>
                      ) : <span className="w-7 flex-shrink-0" />}
                    </div>
                  ))}
                </div>
                {/* Running total vs bill + live validation */}
                {(() => {
                  const bill = parseFloat(form.amount) || 0;
                  const sum = form.splitParticipants.reduce((s, p) => s + (parseFloat(p.share) || 0), 0);
                  const ok = Math.abs(sum - bill) < 0.01 && bill > 0;
                  let error = '';
                  if (bill === 0) error = 'Enter the total bill amount above.';
                  else if (form.splitParticipants.length < 2) error = 'Add at least one other participant.';
                  else if (form.splitParticipants.some(p => !p.isYou && !p.name.trim())) error = 'All participants must have a name.';
                  else if (!ok) error = `Shares (${sum.toFixed(2)}) must add up to the bill (${bill.toFixed(2)}).`;
                  return (
                    <div className={`mt-2 font-mono text-[0.62rem] tracking-wider ${ok ? 'text-sage' : 'text-honey'}`}>
                      Shares total {sum.toFixed(2)} / bill {bill.toFixed(2)} {ok ? '✓' : '— must match'}
                      {error && <div className="text-terra mt-1 normal-case tracking-normal">{error}</div>}
                    </div>
                  );
                })()}
                <p className="mt-1.5 text-[0.7rem] text-ink-dim leading-snug">
                  Shares default to an <strong>even split</strong> and rebalance as you add people —
                  just type a number to override any share. The <strong>Amount</strong> above is the
                  full bill; only your share counts toward your expenses, the rest is tracked as IOUs
                  on the Splits page.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        {initial ? (
          <button
            type="button"
            onClick={del}
            className="font-mono text-[0.62rem] tracking-wider uppercase text-terra hover:underline"
          >
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
