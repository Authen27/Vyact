import { useState } from 'react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { fmt, convert, today, uid } from '../lib/format';
import { computeEmi, splitEmiPortions, totalLiabilities, totalMonthlyDebtPayment } from '../lib/calculations';
import { DEBT_TYPES, CURRENCIES } from '../constants';
import type { Debt, PartPaymentChoice } from '../types';

interface FormState {
  type: string; name: string; lender: string; account: string;
  principal: string; currentBalance: string; interestRate: string;
  minimumPayment: string; tenureMonths: string; dueDate: string; currency: string;
}
const blank = (currency: string): FormState => ({
  type: 'credit_card', name: '', lender: '', account: '',
  principal: '', currentBalance: '', interestRate: '', minimumPayment: '',
  tenureMonths: '', dueDate: '', currency,
});

export default function Debts() {
  const { t } = useTranslation();
  const debts        = useStore(s => s.debts);
  const profile      = useStore(s => s.profile);
  const rates        = useStore(s => s.rates);
  const transactions = useStore(s => s.transactions);
  const upsertDebt   = useStore(s => s.upsertDebt);
  const removeDebt   = useStore(s => s.removeDebt);
  const recordDebtPayment = useStore(s => s.recordDebtPayment);
  const toast        = useStore(s => s.toast);

  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState<FormState>(blank(profile.baseCurrency));
  const [editId, setEditId]       = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [expandId, setExpandId]   = useState<string | null>(null);
  const [payDebtId, setPayDebtId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payChoice, setPayChoice] = useState<PartPaymentChoice>('reduce_tenure');
  const [paying, setPaying]       = useState(false);

  const c    = profile.baseCurrency;
  const totalDebt    = totalLiabilities(debts, c, rates);
  const totalMinPay  = totalMonthlyDebtPayment(debts, c, rates);
  const income       = transactions.filter(tx => tx.type === 'income')
    .reduce((s, tx) => s + convert(tx.amount, tx.currency, c, rates), 0) || 1;
  const dti          = (totalMinPay / (income / 12)) * 100;

  const sorted = [...debts].sort((a, b) => {
    if (profile.payoffStrategy === 'snowball')
      return convert(a.currentBalance, a.currency, c, rates) - convert(b.currentBalance, b.currency, c, rates);
    return b.interestRate - a.interestRate;
  });

  function openAdd() { setEditId(null); setForm(blank(profile.baseCurrency)); setShowForm(true); }
  function openEdit(d: Debt) {
    setEditId(d.id);
    setForm({
      type: d.type, name: d.name, lender: d.lender || '', account: d.account || '',
      principal: String(d.principal), currentBalance: String(d.currentBalance),
      interestRate: String(d.interestRate), minimumPayment: String(d.minimumPayment),
      tenureMonths: String(d.tenureMonths || ''), dueDate: d.dueDate || '', currency: d.currency,
    });
    setShowForm(true);
  }

  async function save() {
    const p = parseFloat(form.principal), b = parseFloat(form.currentBalance);
    const r = parseFloat(form.interestRate), m = parseFloat(form.minimumPayment);
    if (!form.name || isNaN(b) || b < 0) { toast('Name and balance required', 'error'); return; }
    setSaving(true);
    try {
      await upsertDebt({
        id: editId || uid(), type: form.type, name: form.name,
        lender: form.lender || undefined, account: form.account || undefined,
        principal: isNaN(p) ? b : p, currentBalance: b,
        interestRate: isNaN(r) ? 0 : r,
        minimumPayment: isNaN(m) ? 0 : m,
        tenureMonths: parseInt(form.tenureMonths) || undefined,
        dueDate: form.dueDate || undefined, currency: form.currency,
      });
      toast(editId ? 'Debt updated' : 'Debt added', 'success');
      setShowForm(false);
    } catch { toast('Save failed', 'error'); }
    finally { setSaving(false); }
  }

  async function del(id: string) {
    if (!confirm('Delete this debt?')) return;
    await removeDebt(id);
    toast('Debt removed', 'info');
  }

  async function submitPayment(d: Debt) {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
    const isPartPayment = amount > d.minimumPayment;
    setPaying(true);
    try {
      const { message } = await recordDebtPayment(d.id, amount, isPartPayment ? payChoice : undefined);
      toast(message || 'Payment recorded', 'success');
      setPayDebtId(null); setPayAmount('');
    } catch (e: any) { toast(e.message || 'Error', 'error'); }
    finally { setPaying(false); }
  }

  function monthsToPayoff(d: Debt): number | null {
    if (!d.currentBalance || d.currentBalance <= 0) return 0;
    const r = d.interestRate / 100 / 12;
    const pmt = d.minimumPayment + convert(profile.extraPayment, c, d.currency, rates);
    if (pmt <= 0) return null;
    if (r === 0) return Math.ceil(d.currentBalance / pmt);
    const n = -Math.log(1 - (r * d.currentBalance) / pmt) / Math.log(1 + r);
    return isFinite(n) && n > 0 ? Math.ceil(n) : null;
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('debts')}</h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            {profile.payoffStrategy === 'avalanche' ? 'Avalanche strategy · highest APR first' : 'Snowball strategy · smallest balance first'}
          </p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Debt</button>
      </div>

      {/* Summary strip */}
      {debts.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Total Debt',     value: fmt(totalDebt, c),                   cls: 'text-terra' },
            { label: 'Min. Monthly',   value: fmt(totalMinPay, c),                 cls: 'text-honey' },
            { label: 'Debt-to-Income', value: `${dti.toFixed(1)}%`,               cls: dti > 36 ? 'text-terra' : dti > 25 ? 'text-honey' : 'text-sage' },
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
        <Panel title={editId ? 'Edit Debt' : 'New Debt'} className="mb-4">
          <div className="p-5 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="mono-label mb-1.5 block">Debt Type</label>
              <select className="input w-full" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {Object.entries(DEBT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Name</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chase Sapphire" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Lender (optional)</label>
              <input className="input w-full" value={form.lender} onChange={e => setForm(f => ({ ...f, lender: e.target.value }))} placeholder="Bank name" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Account / Last 4 (optional)</label>
              <input className="input w-full" value={form.account} onChange={e => setForm(f => ({ ...f, account: e.target.value }))} placeholder="••••1234" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Original Principal</label>
              <div className="flex gap-2">
                <select className="input w-24" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  {Object.keys(CURRENCIES).map(c => <option key={c}>{c}</option>)}
                </select>
                <input className="input flex-1" type="number" min="0" value={form.principal} onChange={e => setForm(f => ({ ...f, principal: e.target.value }))} placeholder="10000" />
              </div>
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Current Balance</label>
              <input className="input w-full" type="number" min="0" value={form.currentBalance} onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))} placeholder="8500" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Interest Rate (% p.a.)</label>
              <input className="input w-full" type="number" min="0" step="0.01" value={form.interestRate} onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))} placeholder="18.99" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Min. Monthly Payment</label>
              <input className="input w-full" type="number" min="0" value={form.minimumPayment} onChange={e => setForm(f => ({ ...f, minimumPayment: e.target.value }))} placeholder="250" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Tenure (months, optional)</label>
              <input className="input w-full" type="number" min="1" value={form.tenureMonths} onChange={e => setForm(f => ({ ...f, tenureMonths: e.target.value }))} placeholder="36" />
            </div>
            <div>
              <label className="mono-label mb-1.5 block">Due Date (optional)</label>
              <input className="input w-full" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </Panel>
      )}

      {/* Debt list */}
      {debts.length === 0 ? (
        <Panel>
          <div className="px-6 py-14 text-center">
            <div className="text-4xl mb-3 opacity-60">🏦</div>
            <p className="text-ink-mid mb-4">No debts tracked. Add one to see your payoff plan.</p>
            <button className="btn-primary" onClick={openAdd}>Add First Debt</button>
          </div>
        </Panel>
      ) : (
        <div className="space-y-3">
          {sorted.map((d, i) => {
            const balBase   = convert(d.currentBalance, d.currency, c, rates);
            const prinBase  = convert(d.principal, d.currency, c, rates);
            const paidPct   = prinBase > 0 ? Math.min(((prinBase - balBase) / prinBase) * 100, 100) : 0;
            const meta      = DEBT_TYPES[d.type] || DEBT_TYPES.other;
            const months    = monthsToPayoff(d);
            const emi       = computeEmi(d.currentBalance, d.interestRate, d.tenureMonths || months || 12);
            const { interest, principal: prinPay } = splitEmiPortions(d.currentBalance, d.interestRate, d.minimumPayment);
            const expanded  = expandId === d.id;
            const isPaying  = payDebtId === d.id;

            return (
              <div key={d.id} className="bg-bg border border-line rounded-xl overflow-hidden">
                {/* Priority badge */}
                {i === 0 && (
                  <div className="bg-coral px-4 py-1.5 flex items-center gap-2">
                    <span className="font-mono text-[0.6rem] tracking-widest text-white uppercase">
                      {profile.payoffStrategy === 'avalanche' ? '⚡ Highest APR — pay this first' : '🎯 Smallest balance — pay this first'}
                    </span>
                  </div>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{meta.icon}</span>
                      <div>
                        <div className="font-semibold text-ink">{d.name}</div>
                        {d.lender && <div className="font-mono text-[0.62rem] tracking-wider text-ink-dim">{d.lender}{d.account ? ` · ${d.account}` : ''}</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-terra text-lg">{fmt(balBase, c)}</div>
                      <div className="font-mono text-[0.62rem] tracking-wider text-ink-dim">{d.interestRate}% APR</div>
                    </div>
                  </div>

                  {/* Payoff progress bar */}
                  <div className="h-1.5 bg-bg3 rounded-full mb-3 overflow-hidden">
                    <div className="h-full rounded-full bg-sage transition-all" style={{ width: `${paidPct}%` }} />
                  </div>
                  <div className="text-[0.75rem] text-ink-dim mb-3">
                    {paidPct.toFixed(0)}% paid off · {fmt(prinBase - balBase, c)} cleared
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-bg3 border border-line rounded-md p-2 text-center">
                      <div className="text-sm font-semibold text-ink">{fmt(convert(d.minimumPayment, d.currency, c, rates), c)}</div>
                      <div className="font-mono text-[0.58rem] tracking-wider text-ink-dim uppercase">Min pay</div>
                    </div>
                    <div className="bg-bg3 border border-line rounded-md p-2 text-center">
                      <div className="text-sm font-semibold text-honey">{fmt(convert(interest, d.currency, c, rates), c)}</div>
                      <div className="font-mono text-[0.58rem] tracking-wider text-ink-dim uppercase">Interest</div>
                    </div>
                    <div className="bg-bg3 border border-line rounded-md p-2 text-center">
                      <div className="text-sm font-semibold text-sage">{months !== null ? `${months}mo` : '∞'}</div>
                      <div className="font-mono text-[0.58rem] tracking-wider text-ink-dim uppercase">To payoff</div>
                    </div>
                  </div>

                  {/* EMI breakdown expanded */}
                  {expanded && d.tenureMonths && (
                    <div className="bg-bg3 border border-line rounded-md p-3 mb-3 text-[0.82rem]">
                      <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mb-2">EMI Breakdown</div>
                      <div className="grid grid-cols-2 gap-y-1">
                        <span className="text-ink-mid">Calculated EMI</span><span className="text-right font-semibold">{fmt(convert(emi, d.currency, c, rates), c)}</span>
                        <span className="text-ink-mid">Interest portion</span><span className="text-right text-honey font-semibold">{fmt(convert(interest, d.currency, c, rates), c)}</span>
                        <span className="text-ink-mid">Principal portion</span><span className="text-right text-sage font-semibold">{fmt(convert(prinPay, d.currency, c, rates), c)}</span>
                        <span className="text-ink-mid">Remaining months</span><span className="text-right font-semibold">{d.remainingMonths ?? d.tenureMonths}</span>
                      </div>
                    </div>
                  )}

                  {/* Payment form */}
                  {isPaying && (
                    <div className="bg-bg3 border border-line rounded-md p-3 mb-3 space-y-2">
                      <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mb-1">Record Payment</div>
                      <div className="flex gap-2">
                        <input className="input flex-1" type="number" min="0" value={payAmount}
                          onChange={e => setPayAmount(e.target.value)} placeholder={String(d.minimumPayment)} />
                        <span className="self-center text-ink-dim text-sm">{d.currency}</span>
                      </div>
                      {parseFloat(payAmount) > d.minimumPayment && (
                        <div>
                          <div className="font-mono text-[0.6rem] tracking-wider text-ink-dim uppercase mb-1">Part-payment: apply excess to</div>
                          <div className="flex gap-2 flex-wrap">
                            {(['reduce_tenure','reduce_emi','apply_advance'] as PartPaymentChoice[]).map(ch => (
                              <button key={ch} onClick={() => setPayChoice(ch)}
                                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${payChoice === ch ? 'bg-coral text-white border-coral' : 'bg-bg border-line text-ink-mid hover:border-coral/40'}`}>
                                {ch === 'reduce_tenure' ? 'Reduce tenure' : ch === 'reduce_emi' ? 'Reduce EMI' : 'Apply advance'}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button className="btn-ghost text-sm" onClick={() => setPayDebtId(null)}>Cancel</button>
                        <button className="btn-primary text-sm" onClick={() => submitPayment(d)} disabled={paying}>
                          {paying ? 'Recording…' : 'Record Payment'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <button className="btn-primary text-xs py-1.5 px-3" onClick={() => { setPayDebtId(d.id); setPayAmount(String(d.minimumPayment)); }}>
                      Record Payment
                    </button>
                    <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => setExpandId(expanded ? null : d.id)}>
                      {expanded ? 'Less' : 'EMI Details'}
                    </button>
                    <button className="btn-ghost text-xs py-1.5 px-3" onClick={() => openEdit(d)}>Edit</button>
                    <button className="btn-ghost text-xs py-1.5 px-3 text-terra ml-auto" onClick={() => del(d.id)}>Del</button>
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
