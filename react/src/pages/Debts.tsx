import { useState } from 'react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { fmt, convert } from '../lib/format';
import { computeEmi, splitEmiPortions, totalLiabilities, totalMonthlyDebtPayment } from '../lib/calculations';
import { DEBT_TYPES } from '../constants';
import type { Debt, PartPaymentChoice } from '../types';

export default function Debts() {
  const { t } = useTranslation();
  const debts        = useStore(s => s.debts);
  const profile      = useStore(s => s.profile);
  const rates        = useStore(s => s.rates);
  const transactions = useStore(s => s.transactions);
  const removeDebt   = useStore(s => s.removeDebt);
  const recordDebtPayment = useStore(s => s.recordDebtPayment);
  const toast        = useStore(s => s.toast);
  const openAddDebt  = useStore(s => s.openAddDebt);
  const openEditDebt = useStore(s => s.openEditDebt);

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

  function openAdd() { openAddDebt(); }
  function openEdit(d: Debt) { openEditDebt(d); }

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

      {/* Add/Edit form lives in <DebtFormModal /> mounted at App root */}

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
                      <div className="num font-semibold text-terra text-lg">{fmt(balBase, c)}</div>
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
                      <div className="num text-sm font-semibold text-ink">{fmt(convert(d.minimumPayment, d.currency, c, rates), c)}</div>
                      <div className="font-mono text-[0.58rem] tracking-wider text-ink-dim uppercase">Min pay</div>
                    </div>
                    <div className="bg-bg3 border border-line rounded-md p-2 text-center">
                      <div className="num text-sm font-semibold text-honey">{fmt(convert(interest, d.currency, c, rates), c)}</div>
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
                        <span className="text-ink-mid">Calculated EMI</span><span className="num text-right font-semibold">{fmt(convert(emi, d.currency, c, rates), c)}</span>
                        <span className="text-ink-mid">Interest portion</span><span className="num text-right text-honey font-semibold">{fmt(convert(interest, d.currency, c, rates), c)}</span>
                        <span className="text-ink-mid">Principal portion</span><span className="num text-right text-sage font-semibold">{fmt(convert(prinPay, d.currency, c, rates), c)}</span>
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
