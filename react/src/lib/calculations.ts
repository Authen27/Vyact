// FinFlow v6 — Pure computation layer
// All pulse-score / aggregation / loan / split logic.
// No React, no DOM. Easy to unit-test.

import type { Transaction, Budget, Goal, Debt, Asset, Profile, ExchangeRates } from '../types';
import { convert, getMonthKey, nowMonthKey, clamp } from './format';

// ── Multi-currency aware amount in BASE ────────────────────────
export function txnAmountInBase(t: Transaction, baseCurrency: string, rates: ExchangeRates): number {
  return convert(t.amount, t.currency || baseCurrency, baseCurrency, rates);
}
export function effectiveAmount(t: Transaction, baseCurrency: string, rates: ExchangeRates): number {
  if (t.split?.isSplit && typeof t.split.yourShare === 'number') {
    return convert(t.split.yourShare, t.currency || baseCurrency, baseCurrency, rates);
  }
  return txnAmountInBase(t, baseCurrency, rates);
}

// Reportable = excludes private/excluded txns and isolates investment+transfer
export function reportableTxns(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => !t.excluded && (t.type === 'income' || t.type === 'expense'));
}

export interface MonthData { income: number; expense: number; net: number; }

export function monthlyData(transactions: Transaction[], monthKey: string, baseCurrency: string, rates: ExchangeRates): MonthData {
  const txns = reportableTxns(transactions).filter(t => getMonthKey(t.date) === monthKey);
  const income  = txns.filter(t => t.type === 'income').reduce((s,t) => s + effectiveAmount(t, baseCurrency, rates), 0);
  const expense = txns.filter(t => t.type === 'expense').reduce((s,t) => s + effectiveAmount(t, baseCurrency, rates), 0);
  return { income, expense, net: income - expense };
}

export function totalBalance(transactions: Transaction[], baseCurrency: string, rates: ExchangeRates): number {
  return reportableTxns(transactions).reduce(
    (s, t) => t.type === 'income' ? s + effectiveAmount(t, baseCurrency, rates) : s - effectiveAmount(t, baseCurrency, rates), 0
  );
}

export function spendByCategory(transactions: Transaction[], monthKey: string, baseCurrency: string, rates: ExchangeRates): Record<string, number> {
  return reportableTxns(transactions)
    .filter(t => t.type === 'expense' && getMonthKey(t.date) === monthKey)
    .reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + effectiveAmount(t, baseCurrency, rates);
      return acc;
    }, {});
}

// ── BALANCE SHEET ──────────────────────────────────────────────
export const totalAssets = (assets: Asset[], baseCurrency: string, rates: ExchangeRates): number =>
  assets.reduce((s,a) => s + convert(a.value, a.currency, baseCurrency, rates), 0);

export const totalLiabilities = (debts: Debt[], baseCurrency: string, rates: ExchangeRates): number =>
  debts.reduce((s,d) => s + convert(d.currentBalance, d.currency, baseCurrency, rates), 0);

export const liquidAssets = (assets: Asset[], baseCurrency: string, rates: ExchangeRates): number =>
  assets.filter(a => a.liquidity === 'liquid')
        .reduce((s,a) => s + convert(a.value, a.currency, baseCurrency, rates), 0);

export const totalMonthlyDebtPayment = (debts: Debt[], baseCurrency: string, rates: ExchangeRates): number =>
  debts.reduce((s,d) => s + convert(d.minimumPayment, d.currency, baseCurrency, rates), 0);

// ── PULSE SCORE — 5 components ─────────────────────────────────
export interface PulseScore {
  total: number;
  components: { budget: number; savings: number; goals: number; trend: number; debt: number };
}

export function computePulseScore(
  transactions: Transaction[], budgets: Budget[], goals: Goal[], debts: Debt[],
  baseCurrency: string, rates: ExchangeRates,
): PulseScore {
  const mk = nowMonthKey();
  const { income, expense } = monthlyData(transactions, mk, baseCurrency, rates);

  let budgetScore = 60;
  if (budgets.length) {
    const spend = spendByCategory(transactions, mk, baseCurrency, rates);
    const compliance = budgets.map(b => {
      const limitBase = convert(b.limit, b.currency, baseCurrency, rates);
      const pct = limitBase > 0 ? (spend[b.category] || 0) / limitBase * 100 : 0;
      return clamp(100 - pct, 0, 100);
    });
    budgetScore = compliance.reduce((s,v) => s+v, 0) / compliance.length;
  }

  const rate = income > 0 ? (income - expense) / income * 100 : 0;
  const savingsScore = clamp(rate * 5, 0, 100);

  let goalScore = 60;
  const activeGoals = goals.filter(g => !g.completed);
  if (activeGoals.length) {
    const progresses = activeGoals.map(g => {
      const tgt = convert(g.target, g.currency, baseCurrency, rates);
      const cur = convert(g.current, g.currency, baseCurrency, rates);
      return tgt > 0 ? clamp(cur / tgt * 100, 0, 100) : 0;
    });
    goalScore = progresses.reduce((s,v) => s+v, 0) / progresses.length;
  }

  const [y, m] = mk.split('-').map(Number);
  const prevMk = m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
  const prevExp = monthlyData(transactions, prevMk, baseCurrency, rates).expense;
  let trendScore = 70;
  if (prevExp > 0) {
    const change = (expense - prevExp) / prevExp * 100;
    if      (change <= 0)   trendScore = 100;
    else if (change <= 10)  trendScore = 80;
    else if (change <= 20)  trendScore = 60;
    else if (change <= 40)  trendScore = 40;
    else                    trendScore = 20;
  }

  let debtScore = 100;
  if (debts.length) {
    if (income === 0) debtScore = 40;
    else {
      const dti = (totalMonthlyDebtPayment(debts, baseCurrency, rates) / income) * 100;
      if      (dti <= 15) debtScore = 100;
      else if (dti <= 25) debtScore = 85;
      else if (dti <= 36) debtScore = 65;
      else if (dti <= 50) debtScore = 35;
      else                debtScore = 10;
    }
  }

  const total = Math.round(
    budgetScore * 0.25 + savingsScore * 0.25 + goalScore * 0.15 + trendScore * 0.15 + debtScore * 0.20
  );

  return {
    total: clamp(total, 0, 100),
    components: {
      budget: Math.round(budgetScore),
      savings: Math.round(savingsScore),
      goals: Math.round(goalScore),
      trend: Math.round(trendScore),
      debt: Math.round(debtScore),
    },
  };
}

export function pulseStatus(score: number): { label: string; cssVar: string } {
  if (score >= 80) return { label: 'Excellent',   cssVar: 'var(--sage)' };
  if (score >= 65) return { label: 'Good',        cssVar: 'var(--coral)' };
  if (score >= 45) return { label: 'Fair',        cssVar: 'var(--honey)' };
  return                  { label: 'Needs Work',  cssVar: 'var(--terra)' };
}

// ── INSIGHTS ───────────────────────────────────────────────────
export interface Insight { icon: string; text: string; cls: 'chip-good'|'chip-warn'|'chip-alert'|'chip-info'; }

export function getInsights(
  transactions: Transaction[], budgets: Budget[], goals: Goal[], debts: Debt[], assets: Asset[],
  baseCurrency: string, rates: ExchangeRates,
): Insight[] {
  const chips: Insight[] = [];
  const mk = nowMonthKey();
  const { income, expense } = monthlyData(transactions, mk, baseCurrency, rates);
  const spend = spendByCategory(transactions, mk, baseCurrency, rates);
  const rate = income > 0 ? Math.round((income - expense) / income * 100) : 0;

  if (income > 0) {
    if (rate >= 20) chips.push({ icon:'💚', text:`Savings rate ${rate}% — great work!`, cls:'chip-good' });
    else if (rate >= 10) chips.push({ icon:'📊', text:`Savings rate ${rate}% — target 20%+`, cls:'chip-warn' });
    else chips.push({ icon:'⚠️', text:`Low savings rate (${rate}%)`, cls:'chip-alert' });
  }

  const over = budgets.filter(b => (spend[b.category] || 0) > convert(b.limit, b.currency, baseCurrency, rates));
  if (over.length) chips.push({ icon:'🚨', text:`${over.length} budget${over.length>1?'s':''} exceeded`, cls:'chip-alert' });

  if (debts.length) {
    const dti = income > 0 ? (totalMonthlyDebtPayment(debts, baseCurrency, rates) / income) * 100 : 0;
    if (dti > 36) chips.push({ icon:'📉', text:`DTI ${dti.toFixed(0)}% — above 36% threshold`, cls:'chip-alert' });
    else if (dti > 0 && dti <= 25) chips.push({ icon:'📈', text:`DTI ${dti.toFixed(0)}% — healthy`, cls:'chip-good' });
  }

  if (assets.length || debts.length) {
    const nw = totalAssets(assets, baseCurrency, rates) - totalLiabilities(debts, baseCurrency, rates);
    if (nw > 0) chips.push({ icon:'🏆', text:`Net worth building`, cls:'chip-good' });
    else        chips.push({ icon:'⬇️', text:`Net worth — focus on payoff`, cls:'chip-warn' });
  }
  return chips.slice(0, 4);
}

// ── LOAN / EMI ─────────────────────────────────────────────────
export function computeEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate) return principal / tenureMonths;
  const r = annualRate / 100 / 12;
  const x = Math.pow(1 + r, tenureMonths);
  return (principal * r * x) / (x - 1);
}

export function splitEmiPortions(currentBalance: number, annualRate: number, payment: number): { interest: number; principal: number } {
  const r = annualRate / 100 / 12;
  const interest = currentBalance * r;
  const principal = Math.max(0, payment - interest);
  return { interest, principal };
}

// ── SPLITS ─────────────────────────────────────────────────────
export interface SplitOutstanding {
  owedToYou: number;
  youOwe: number;
  owedDetails: Array<{ txn: Transaction; participant: { name: string; share: number; paid: boolean; isYou?: boolean } }>;
  youOweDetails: Array<{ txn: Transaction; participant: { name: string; share: number; paid: boolean; isYou?: boolean } }>;
}

export function splitsOutstanding(transactions: Transaction[], baseCurrency: string, rates: ExchangeRates): SplitOutstanding {
  let owedToYou = 0;
  let youOwe = 0;
  const owedDetails: SplitOutstanding['owedDetails'] = [];
  const youOweDetails: SplitOutstanding['youOweDetails'] = [];
  transactions.forEach(t => {
    if (!t.split?.isSplit) return;
    const cur = t.currency || baseCurrency;
    (t.split.participants || []).forEach(p => {
      if (p.paid) return;
      const shareInBase = convert(p.share, cur, baseCurrency, rates);
      if (t.split!.paidBy === 'me' && !p.isYou) {
        owedToYou += shareInBase;
        owedDetails.push({ txn: t, participant: p });
      } else if (t.split!.paidBy === 'external' && p.isYou) {
        youOwe += shareInBase;
        youOweDetails.push({ txn: t, participant: p });
      }
    });
  });
  return { owedToYou, youOwe, owedDetails, youOweDetails };
}
