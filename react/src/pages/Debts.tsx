// Vyact — Debts (W4f, v10.75.0; owner decisions D19, D17, D30).
//
// A loan's OUTSTANDING is its loan account's ledger (lib/loanSchedule.ts loanView) — the same figure
// Net Worth and Pip read, so the Debts page can no longer disagree with them. Each loan shows the EMI
// due (number, date, amount), when it clears, the instalments and interest still to come, and its
// schedule. Paying goes through the server (LoanPaymentSheet → pay_loan); only the LATEST payment can
// be undone (owner); a loan is deleted only once nothing is owed (D17), after "Mark paid off" if need be.
//
// Credit cards are ACCOUNTS (D30, owner): they are not listed here, but what they owe still counts —
// the summary is loans + card dues, read from the card accounts.
import { useState, useMemo, useEffect, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pencil, Trash2, ChevronDown, ChevronUp, CreditCard, Undo2, CheckCircle2 } from 'lucide-react';
import { useStore } from '../store';
import { useTranslation } from '../hooks';
import { Panel } from '../components/ui/Card';
import { fmt, today, nowMonthKey } from '../lib/format';
import { debtToIncomePct, pctLabel } from '../lib/ratios';
import Money from '../components/ui/Money';
import EstimatedTag from '../components/ui/EstimatedTag';
import LoanPaymentSheet from '../components/debts/LoanPaymentSheet';
import { simulatePayoffInterest, monthlyData, totalMonthlyDebtPayment } from '../lib/calculations';
import { computeNetWorth, cardDues } from '../lib/netWorth';
import { loanView, clearsLabel, latestLoanPayment, loanErrorMessage, LoanPaymentRefused, type LoanView } from '../lib/loanSchedule';
import { DEBT_TYPES } from '../constants';
import type { Debt } from '../types';

export default function Debts() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const debts        = useStore(s => s.debts);
  const accounts     = useStore(s => s.accounts);
  const assets       = useStore(s => s.assets);
  const profile      = useStore(s => s.profile);
  const rates        = useStore(s => s.rates);
  const transactions = useStore(s => s.transactions);
  const deleteDebt   = useStore(s => s.deleteDebt);
  const reverseLoanPayment = useStore(s => s.reverseLoanPayment);
  const markLoanPaidOff = useStore(s => s.markLoanPaidOff);
  const toast        = useStore(s => s.toast);
  const openAddDebt  = useStore(s => s.openAddDebt);
  const openEditDebt = useStore(s => s.openEditDebt);
  const updateProfile = useStore(s => s.updateProfile);

  const [expandId, setExpandId]     = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payingId, setPayingId]     = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);

  const c = profile.baseCurrency;
  const money = (n: number) => fmt(n, c);
  const onDay = today();

  // The household's loans, as the ledger has them.
  const owedByMe = debts.filter(d => (d.direction || 'owed_by_me') !== 'owed_to_me');
  const views = useMemo(() => new Map(owedByMe.map(d => [d.id, loanView(d, accounts, transactions, c, onDay)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [debts, accounts, transactions, c, onDay]);
  const active = owedByMe.filter(d => !views.get(d.id)?.paidOff);
  const paidOff = owedByMe.filter(d => views.get(d.id)?.paidOff);
  const receivables = debts.filter(d => d.direction === 'owed_to_me');

  // D30 (owner) — cards are accounts; what they owe still counts here, as one figure.
  const cardsOwe = useMemo(() => cardDues(computeNetWorth({ assets, accounts, debts, transactions }, c, rates)),
    [assets, accounts, debts, transactions, c, rates]);
  const loansOwe = active.reduce((s, d) => s + (views.get(d.id)?.outstanding ?? 0), 0);
  const totalDebt = Math.round((loansOwe + cardsOwe) * 100) / 100;
  const totalEmi = active.reduce((s, d) => s + d.minimumPayment, 0);
  // W6 (audit FE-UIC-07): the Dashboard's definition — this month's minimum payments over this month's
  // income — not all-time income ÷ 12 with a fake 1 when there was none.
  const dti = debtToIncomePct(totalMonthlyDebtPayment(debts, c, rates), monthlyData(transactions, nowMonthKey(), c, rates).income);

  // The payoff order, on what is really owed.
  const planning = useMemo(() => active.map(d => ({ ...d, currentBalance: views.get(d.id)?.outstanding ?? d.currentBalance })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active.map(d => d.id).join(','), views]);
  const strategyTradeoff = useMemo(() => {
    if (planning.filter(d => d.currentBalance > 0).length < 2) return null;
    const av = simulatePayoffInterest(planning, profile.extraPayment, 'avalanche', c, rates);
    const sn = simulatePayoffInterest(planning, profile.extraPayment, 'snowball', c, rates);
    if (!av.terminates || !sn.terminates) return null;
    const sel = profile.payoffStrategy === 'snowball' ? sn : av;
    const oth = profile.payoffStrategy === 'snowball' ? av : sn;
    return { delta: oth.totalInterest - sel.totalInterest, sel, oth };
  }, [planning, profile.extraPayment, profile.payoffStrategy, c, rates]);
  const sorted = [...active].sort((a, b) => profile.payoffStrategy === 'snowball'
    ? (views.get(a.id)?.outstanding ?? 0) - (views.get(b.id)?.outstanding ?? 0)
    : b.interestRate - a.interestRate);
  const detailDebt = sorted.find(d => d.id === selectedId) ?? sorted[0];

  // A bill notification's "Record payment" lands here (?pay=<loan>).
  useEffect(() => {
    const pay = params.get('pay');
    if (pay && debts.some(d => d.id === pay && !views.get(d.id)?.paidOff)) {
      setPayingId(pay);
      params.delete('pay');
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const fail = (e: unknown) => toast(e instanceof LoanPaymentRefused ? loanErrorMessage(e.code, e.figure, money) : `Failed: ${(e as Error).message}`, 'error');

  async function undoLast(d: Debt) {
    const latest = latestLoanPayment(d.id, transactions);
    if (!latest) return;
    if (!confirm(`Undo the latest payment on ${d.name} (${money(latest.amount)}${latest.date ? ` on ${latest.date}` : ''})? Its entries are removed and the loan goes back to how it was.`)) return;
    try { await reverseLoanPayment(d.id, latest.operationId); toast('Payment undone', 'info'); } catch (e) { fail(e); }
  }

  async function closeLoan(d: Debt, view: LoanView) {
    const note = prompt(`Mark ${d.name} paid off? ${view.outstanding > 0 ? `The ${money(view.outstanding)} still showing is written off the loan (a reconcile, not a payment).` : ''} Note (optional):`, 'Closed with the bank');
    if (note === null) return;
    try { await markLoanPaidOff(d.id, note || undefined); toast(`${d.name} marked paid off`, 'success'); } catch (e) { fail(e); }
  }

  async function del(d: Debt) {
    if (!confirm(`Delete ${d.name}? Its payments stay in your history.`)) return;
    try { await deleteDebt(d.id); toast('Removed', 'info'); } catch (e) { fail(e); }
  }

  const paying = debts.find(d => d.id === payingId) ?? null;

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5">{t('debts')}</h1>
        </div>
        <button className="btn-primary" onClick={openAddDebt}>+ Add Loan</button>
      </div>

      {(active.length > 0 || cardsOwe > 0) && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-1.5">
            {[
              { label: 'Total Debt',     node: <Money amount={totalDebt} currency={c} maxChars={11} className="text-ink" />, cls: 'text-ink' },
              { label: 'EMIs a month',   node: <Money amount={totalEmi} currency={c} maxChars={11} className="text-honey" />, cls: 'text-honey' },
              { label: 'Debt-to-Income', node: <span title={dti == null ? 'No income recorded this month' : undefined}>{pctLabel(dti, 1)}</span>,
                cls: dti == null ? 'text-ink-dim' : dti > 36 ? 'text-terra' : dti > 25 ? 'text-honey' : 'text-sage' },
            ].map(s => (
              <div key={s.label} className="rounded-r3 p-4 text-center min-w-0" style={{ background: 'var(--canvas)', boxShadow: 'var(--neu)' }}>
                <div className={`num text-xl font-semibold ${s.cls}`}>{s.node}</div>
                <div className="font-mono text-[0.6rem] tracking-widest text-ink-dim uppercase mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-[0.72rem] text-ink-dim mb-4" data-testid="debts-breakdown">
            Loans {money(loansOwe)} · Credit cards to pay {money(cardsOwe)}
            {cardsOwe > 0 && <> — <button type="button" className="underline" onClick={() => navigate('/accounts')}>see cards</button></>}
          </p>
        </>
      )}

      {active.length > 1 && (
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <div className="inline-flex gap-1 p-1 rounded-pill" style={{ background: 'var(--sunken)', boxShadow: 'var(--neu-inset)' }}
            role="tablist" aria-label="Payoff strategy">
            {(['avalanche', 'snowball'] as const).map(st => (
              <button key={st} role="tab" aria-selected={profile.payoffStrategy === st}
                onClick={() => updateProfile({ payoffStrategy: st })}
                className="h-[28px] px-4 rounded-pill border-none cursor-pointer font-display font-semibold text-[11.5px] capitalize"
                style={profile.payoffStrategy === st
                  ? { color: 'var(--accent)', boxShadow: 'var(--neu-inset)', background: 'color-mix(in srgb, var(--accent) 10%, var(--canvas))' }
                  : { color: 'var(--ff-ink-3)', background: 'transparent' }}>
                {st}
              </button>
            ))}
          </div>
          {strategyTradeoff && (
            <span className="text-[10.5px]">
              {strategyTradeoff.delta > 1
                ? <span className="text-sage">saves you {money(Math.round(strategyTradeoff.delta))} in interest</span>
                : strategyTradeoff.delta < -1
                  ? <span className="text-ink-dim">{money(Math.round(-strategyTradeoff.delta))} more interest — but frees a balance sooner</span>
                  : <span className="text-ink-dim">{profile.payoffStrategy === 'avalanche' ? 'targets the highest APR first' : 'clears the smallest balance first'}</span>}
            </span>
          )}
        </div>
      )}

      {active.length === 0 ? (
        <Panel>
          <div className="px-6 py-14 text-center">
            <div className="text-4xl mb-3 opacity-60">🏦</div>
            <p className="text-ink-mid mb-4">No loans being repaid. Add one to see when it clears.</p>
            <button className="btn-primary" onClick={openAddDebt}>Add a loan</button>
          </div>
        </Panel>
      ) : (
        <>
          {/* Mobile / tablet — cards. */}
          <div className="space-y-3 lg:hidden">
            {sorted.map((d, i) => {
              const v = views.get(d.id)!;
              const expanded = expandId === d.id;
              return (
                <LoanCard key={d.id} view={v} priority={i === 0} strategy={profile.payoffStrategy} money={money} currency={c}
                  expanded={expanded} showAllRows={showAllRows}
                  canUndo={!!latestLoanPayment(d.id, transactions)}
                  onToggle={() => { setExpandId(expanded ? null : d.id); setShowAllRows(false); }}
                  onShowAll={() => setShowAllRows(true)}
                  onPay={() => setPayingId(d.id)} onUndo={() => undoLast(d)} onEdit={() => openEditDebt(d)}
                  onClose={() => closeLoan(d, v)} onPayments={() => navigate(`/transactions?debtId=${d.id}`)} />
              );
            })}
          </div>

          {/* Desktop — payoff order + the selected loan. */}
          <div className="hidden lg:grid lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-6 lg:items-start">
            <div className="space-y-2">
              <div className="mono-label mb-1">Payoff order</div>
              {sorted.map((d, i) => {
                const v = views.get(d.id)!;
                const meta = DEBT_TYPES[d.type] || DEBT_TYPES.other;
                const isActive = d.id === detailDebt?.id;
                const pct = (d.principal || 0) > 0 ? Math.min((v.cleared / d.principal) * 100, 100) : 0;
                return (
                  <button key={d.id} type="button" onClick={() => setSelectedId(d.id)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 rounded-r2 text-left border-none cursor-pointer"
                    style={isActive ? { background: 'var(--canvas)', boxShadow: 'var(--neu-sm), 0 0 0 1.5px var(--accent)' } : { background: 'var(--canvas)', boxShadow: 'var(--neu-sm)' }}>
                    <span className="num w-[22px] font-bold flex-shrink-0 text-center" style={{ color: i === 0 ? 'var(--accent)' : 'var(--ff-ink-3)' }}>{i + 1}</span>
                    <span className="text-base flex-shrink-0" aria-hidden>{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13.5px] text-ink truncate">{d.name}</div>
                      <div className="num text-[10px] text-ink-dim">{d.interestRate}% APR{pct > 0 ? ` · ${pct.toFixed(0)}% paid` : ''}</div>
                    </div>
                    <Money amount={v.outstanding} currency={c} maxChars={10} className="num font-semibold text-ink flex-shrink-0" />
                  </button>
                );
              })}
            </div>
            {detailDebt && (() => {
              const v = views.get(detailDebt.id)!;
              return (
                <LoanCard view={v} priority={detailDebt.id === sorted[0].id} strategy={profile.payoffStrategy} money={money} currency={c}
                  expanded={expandId === detailDebt.id} showAllRows={showAllRows} sticky
                  canUndo={!!latestLoanPayment(detailDebt.id, transactions)}
                  onToggle={() => { setExpandId(expandId === detailDebt.id ? null : detailDebt.id); setShowAllRows(false); }}
                  onShowAll={() => setShowAllRows(true)}
                  onPay={() => setPayingId(detailDebt.id)} onUndo={() => undoLast(detailDebt)} onEdit={() => openEditDebt(detailDebt)}
                  onClose={() => closeLoan(detailDebt, v)} onPayments={() => navigate(`/transactions?debtId=${detailDebt.id}`)} />
              );
            })()}
          </div>
        </>
      )}

      {/* Paid off — kept for their history; deletable now that nothing is owed (D17). */}
      {paidOff.length > 0 && (
        <Panel title="Paid off">
          {paidOff.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0">
              <CheckCircle2 size={16} className="text-sage flex-shrink-0" aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink truncate">{d.name}</div>
                <div className="text-[0.7rem] text-ink-dim">{d.paidOffAt ? `Closed ${d.paidOffAt.slice(0, 10)}` : 'Nothing owed'}</div>
              </div>
              {latestLoanPayment(d.id, transactions) && (
                <button className="row-action" onClick={() => undoLast(d)} aria-label={`Undo the last payment on ${d.name}`} title="Undo last payment"><Undo2 size={14} /></button>
              )}
              <button className="row-action danger" onClick={() => del(d)} aria-label={`Delete ${d.name}`} title="Delete"><Trash2 size={14} strokeWidth={1.6} /></button>
            </div>
          ))}
        </Panel>
      )}

      {/* Owed to you — money others owe this household. Not a debt: never in the totals above. */}
      {receivables.length > 0 && (
        <Panel title="Owed to you">
          {receivables.map(d => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3 border-b border-line last:border-b-0">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-ink truncate">{d.counterpartyName || d.name}</div>
                {d.counterpartyName && <div className="text-[0.7rem] text-ink-dim truncate">{d.name}</div>}
              </div>
              <Money amount={d.currentBalance} currency={c} maxChars={10} className="num font-semibold text-sage" />
              <button className="row-action" onClick={() => openEditDebt(d)} aria-label={`Edit ${d.name}`} title="Edit"><Pencil size={14} strokeWidth={1.6} /></button>
              <button className="row-action danger" onClick={() => del(d)} aria-label={`Delete ${d.name}`} title="Delete"><Trash2 size={14} strokeWidth={1.6} /></button>
            </div>
          ))}
        </Panel>
      )}

      <LoanPaymentSheet debt={paying} open={!!paying} onClose={() => setPayingId(null)} />
    </div>
  );
}

interface CardProps {
  view: LoanView; priority: boolean; strategy: string; money: (n: number) => string; currency: string;
  expanded: boolean; showAllRows: boolean; canUndo: boolean; sticky?: boolean;
  onToggle: () => void; onShowAll: () => void; onPay: () => void; onUndo: () => void; onEdit: () => void; onClose: () => void; onPayments: () => void;
}

/** One loan: what is owed, the EMI due, when it clears, and its schedule. */
function LoanCard({ view: v, priority, strategy, money, currency, expanded, showAllRows, canUndo, sticky,
  onToggle, onShowAll, onPay, onUndo, onEdit, onClose, onPayments }: CardProps) {
  const d = v.debt;
  const meta = DEBT_TYPES[d.type] || DEBT_TYPES.other;
  const pct = (d.principal || 0) > 0 ? Math.min((v.cleared / d.principal) * 100, 100) : 0;
  const clears = clearsLabel(v.clearsOn);
  const rows = showAllRows ? v.schedule : v.schedule.slice(0, 12);
  return (
    <div className={`rounded-r3 overflow-hidden ${sticky ? 'lg:sticky lg:top-[124px]' : ''}`}
      style={{ background: 'var(--canvas)', boxShadow: priority ? 'var(--neu), 0 0 0 1.5px color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--neu-sm)' }}>
      {priority && (
        <div className="px-4 py-1.5" style={{ background: 'var(--accent)' }}>
          <span className="font-mono text-[0.6rem] tracking-widest uppercase" style={{ color: 'var(--accent-ink)' }}>
            {strategy === 'avalanche' ? '⚡ Highest APR — pay this first' : '🎯 Smallest balance — pay this first'}
          </span>
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-4 mb-3">
          <PayoffRing pct={pct} clears={clears} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span aria-hidden>{meta.icon}</span>
              <span className="font-semibold text-ink truncate">{d.name}</span>
              {v.estimated && <EstimatedTag confidence="estimated" title="These terms were worked out from what this loan recorded. Confirm them in Edit." />}
            </div>
            {d.lender && <div className="font-mono text-[0.62rem] tracking-wider text-ink-dim">{d.lender}{d.account ? ` · ${d.account}` : ''}</div>}
            <div className="text-lg font-semibold text-ink"><Money amount={v.outstanding} currency={currency} maxChars={12} /></div>
            <div className="text-[0.72rem] text-ink-dim">
              {d.interestRate}% APR · {money(v.cleared)} cleared{d.principal ? ` of ${money(d.principal)}` : ''}
            </div>
          </div>
        </div>

        <div className="text-[0.8rem] text-ink-mid mb-3" data-testid="loan-due-line">
          EMI #{v.state.no}{v.state.date ? ` due ${v.state.date}` : ''} · {money(v.state.remaining)}{v.state.started ? ' left' : ''}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {([
            ['EMI', money(d.minimumPayment), 'text-ink'],
            ['Interest left', money(v.interestLeft), 'text-honey'],
            [v.clears ? `Clears · ${v.monthsLeft} mo` : 'Never clears', v.clears ? (clears ?? `${v.monthsLeft} mo`) : 'raise the EMI', v.clears ? 'text-sage' : 'text-terra'],
          ] as [string, string, string][]).map(([label, value, cls]) => (
            <div key={label} className="bg-bg3 border border-line rounded-md p-2 text-center">
              <div className={`num text-sm font-semibold ${cls}`}>{value}</div>
              <div className="font-mono text-[0.58rem] tracking-wider text-ink-dim uppercase">{label}</div>
            </div>
          ))}
        </div>

        {expanded && (
          <div className="bg-bg3 border border-line rounded-md p-3 mb-3 text-[0.78rem] overflow-x-auto" data-testid="loan-schedule">
            <table className="w-full num">
              <thead>
                <tr className="text-ink-dim text-left">
                  <th className="font-normal pr-2">#</th><th className="font-normal pr-2">Date</th>
                  <th className="font-normal text-right pr-2">Payment</th><th className="font-normal text-right pr-2">Interest</th>
                  <th className="font-normal text-right pr-2">Principal</th><th className="font-normal text-right">Left</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.no}>
                    <td className="pr-2">{r.no}</td><td className="pr-2">{r.date ?? '—'}</td>
                    <td className="text-right pr-2">{money(r.payment)}</td><td className="text-right pr-2 text-honey">{money(r.interest)}</td>
                    <td className="text-right pr-2 text-sage">{money(r.principal)}</td><td className="text-right">{money(r.outstandingAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!showAllRows && v.schedule.length > rows.length && (
              <button type="button" className="mt-2 underline text-ink-mid" onClick={onShowAll}>Show all {v.schedule.length} instalments</button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          <button className="btn-primary btn-sm" onClick={onPay}><CreditCard size={13} strokeWidth={1.8} /> Pay</button>
          <button className="btn-ghost btn-sm" onClick={onToggle}>
            {expanded ? <><ChevronUp size={13} strokeWidth={1.8} /> Hide schedule</> : <><ChevronDown size={13} strokeWidth={1.8} /> Schedule</>}
          </button>
          <button className="btn-ghost btn-sm" onClick={onPayments}>Payments</button>
          {canUndo && <button className="btn-ghost btn-sm" onClick={onUndo}><Undo2 size={13} /> Undo last</button>}
          <div className="ml-auto flex gap-1">
            <button className="row-action" onClick={onEdit} aria-label={`Edit ${d.name}`} title="Edit"><Pencil size={14} strokeWidth={1.6} /></button>
            <button className="row-action" onClick={onClose} aria-label={`Mark ${d.name} paid off`} title="Mark paid off"><CheckCircle2 size={14} strokeWidth={1.6} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Board C — the payoff-journey ring: % of the sanctioned amount cleared, and the month it clears. */
function PayoffRing({ pct, clears }: { pct: number; clears: string | null }) {
  const r = 30, circ = 2 * Math.PI * r;
  const off = circ * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
      <svg width="76" height="76" viewBox="0 0 76 76">
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--sunken)" strokeWidth="7" />
        <circle cx="38" cy="38" r={r} fill="none" stroke="hsl(var(--sage))" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off} transform="rotate(-90 38 38)"
          className="ring-grow" style={{ '--ring-from': circ } as CSSProperties} />
        <text x="38" y="43" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--ff-ink)" className="num">{Math.round(pct)}%</text>
      </svg>
      {clears && <div className="mono-label">by {clears}</div>}
    </div>
  );
}
