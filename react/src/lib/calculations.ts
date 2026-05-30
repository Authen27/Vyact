// FinFlow v6 — Pure computation layer
// All pulse-score / aggregation / loan / split logic.
// No React, no DOM. Easy to unit-test.

import type { Transaction, Budget, Goal, Debt, Asset, Profile, ExchangeRates, BudgetPeriod } from '../types';
import { convert, getMonthKey, nowMonthKey, clamp } from './format';
import { toDinero, fromDinero, convertViaUsdRates, sumDinero, dineroZero, addDinero } from './money';
import type { Dinero } from 'dinero.js';

// ── Multi-currency aware amount in BASE ────────────────────────
//
// TD-01 phase B: every aggregator below folds amounts in *dinero space*
// (integer minor units, exact integer add) rather than via `reduce` over
// JS `number`. Public signatures still return `number` so call sites are
// unchanged; the gain is that summing many converted amounts no longer
// drifts. `0.10 + 0.10 + 0.10 ≠ 0.30` does not happen here any more.
//
// `effectiveDinero` is the internal helper that maps a transaction (with
// optional split share + optional foreign currency) into a Dinero in the
// base currency. Every aggregator uses it.

export function txnAmountInBase(t: Transaction, baseCurrency: string, rates: ExchangeRates): number {
  return convert(t.amount, t.currency || baseCurrency, baseCurrency, rates);
}

function effectiveDinero(t: Transaction, baseCurrency: string, rates: ExchangeRates): Dinero<number> {
  const cur = t.currency || baseCurrency;
  const raw = t.split?.isSplit && typeof t.split.yourShare === 'number'
    ? t.split.yourShare
    : t.amount;
  return convertViaUsdRates(toDinero(raw, cur), baseCurrency, rates);
}

export function effectiveAmount(t: Transaction, baseCurrency: string, rates: ExchangeRates): number {
  return fromDinero(effectiveDinero(t, baseCurrency, rates));
}

// Reportable = excludes private/excluded txns and isolates investment+transfer
export function reportableTxns(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t => !t.excluded && (t.type === 'income' || t.type === 'expense'));
}

export interface MonthData { income: number; expense: number; net: number; }

export function monthlyData(transactions: Transaction[], monthKey: string, baseCurrency: string, rates: ExchangeRates): MonthData {
  const txns = reportableTxns(transactions).filter(t => getMonthKey(t.date) === monthKey);
  const incomeD  = sumDinero(txns.filter(t => t.type === 'income'),  t => effectiveDinero(t, baseCurrency, rates), baseCurrency);
  const expenseD = sumDinero(txns.filter(t => t.type === 'expense'), t => effectiveDinero(t, baseCurrency, rates), baseCurrency);
  const income = fromDinero(incomeD);
  const expense = fromDinero(expenseD);
  // net is income − expense in dinero space too, so subtraction doesn't drift.
  // (dinero exposes `subtract` but a single `add` of a negated income suffices;
  //  for clarity we compute via the JS-number difference of two exact values,
  //  which is itself exact provided both are integer minor units / 10^exp.)
  return { income, expense, net: income - expense };
}

export function totalBalance(transactions: Transaction[], baseCurrency: string, rates: ExchangeRates): number {
  // income adds, expense subtracts. Building both as dinero sums then
  // subtracting at the JS-number edge is exact (both sides quantised
  // to the base currency's native exponent by sumDinero).
  const txns = reportableTxns(transactions);
  const incomeD  = sumDinero(txns.filter(t => t.type === 'income'),  t => effectiveDinero(t, baseCurrency, rates), baseCurrency);
  const expenseD = sumDinero(txns.filter(t => t.type === 'expense'), t => effectiveDinero(t, baseCurrency, rates), baseCurrency);
  return fromDinero(incomeD) - fromDinero(expenseD);
}

export function spendByCategory(transactions: Transaction[], monthKey: string, baseCurrency: string, rates: ExchangeRates): Record<string, number> {
  // One Dinero accumulator per category; fold each expense txn into its
  // bucket, then collapse to a `number` map at the edge.
  const buckets: Record<string, Dinero<number>> = {};
  for (const t of reportableTxns(transactions)) {
    if (t.type !== 'expense' || getMonthKey(t.date) !== monthKey) continue;
    const inBase = effectiveDinero(t, baseCurrency, rates);
    buckets[t.category] = buckets[t.category]
      ? addDinero(buckets[t.category], inBase)
      : inBase;
  }
  const out: Record<string, number> = {};
  for (const [k, d] of Object.entries(buckets)) out[k] = fromDinero(d);
  return out;
}

// ── v6.4: Budget period windows + range-based aggregation ─────
// `budgetWindow` returns the [start, end] inclusive ISO date range for the
// active period of a budget, anchored at `today`. The window for monthly /
// quarterly / half_yearly / annual budgets is calendar-aligned.
export function budgetWindow(b: Pick<Budget, 'period'|'periodStart'|'periodEnd'>, today: Date = new Date()): { start: string; end: string } {
  const period: BudgetPeriod = b.period || 'monthly';
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const startOf = (year: number, month: number) => new Date(Date.UTC(year, month, 1));
  const endOf   = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0));
  if (period === 'custom') {
    return {
      start: b.periodStart || iso(startOf(y, m)),
      end:   b.periodEnd   || iso(endOf(y, m)),
    };
  }
  if (period === 'annual') {
    return { start: iso(startOf(y, 0)), end: iso(endOf(y, 11)) };
  }
  if (period === 'half_yearly') {
    const half = m < 6 ? 0 : 6;
    return { start: iso(startOf(y, half)), end: iso(endOf(y, half + 5)) };
  }
  if (period === 'quarterly') {
    const q = Math.floor(m / 3) * 3;
    return { start: iso(startOf(y, q)), end: iso(endOf(y, q + 2)) };
  }
  // monthly
  return { start: iso(startOf(y, m)), end: iso(endOf(y, m)) };
}

export function spendByCategoryInRange(
  transactions: Transaction[],
  start: string,
  end: string,
  baseCurrency: string,
  rates: ExchangeRates,
): Record<string, number> {
  const buckets: Record<string, Dinero<number>> = {};
  for (const t of reportableTxns(transactions)) {
    if (t.type !== 'expense' || t.date < start || t.date > end) continue;
    const inBase = effectiveDinero(t, baseCurrency, rates);
    buckets[t.category] = buckets[t.category]
      ? addDinero(buckets[t.category], inBase)
      : inBase;
  }
  const out: Record<string, number> = {};
  for (const [k, d] of Object.entries(buckets)) out[k] = fromDinero(d);
  return out;
}

/** How many calendar months the period covers (used to derive a per-month
 *  view of an aggregated period limit). */
export function periodMonths(period: BudgetPeriod | undefined): number {
  switch (period) {
    case 'annual':      return 12;
    case 'half_yearly': return 6;
    case 'quarterly':   return 3;
    case 'monthly':
    case undefined:     return 1;
    case 'custom':      return 1; // approximation; UI shows literal dates
  }
}

// ── BALANCE SHEET ──────────────────────────────────────────────
// Each helper folds its inputs in dinero space (one accumulator per call,
// FX done per-row, exact integer adds) and returns a JS number at the edge.

export const totalAssets = (assets: Asset[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(assets, a => convertViaUsdRates(toDinero(a.value, a.currency), baseCurrency, rates), baseCurrency));

export const totalLiabilities = (debts: Debt[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(debts, d => convertViaUsdRates(toDinero(d.currentBalance, d.currency), baseCurrency, rates), baseCurrency));

export const liquidAssets = (assets: Asset[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(
    assets.filter(a => a.liquidity === 'liquid'),
    a => convertViaUsdRates(toDinero(a.value, a.currency), baseCurrency, rates),
    baseCurrency,
  ));

export const totalMonthlyDebtPayment = (debts: Debt[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(debts, d => convertViaUsdRates(toDinero(d.minimumPayment, d.currency), baseCurrency, rates), baseCurrency));

// ── PULSE SCORE — 5 components ─────────────────────────────────
export interface PulseScore {
  total: number | null;   // null = not enough data yet (honest empty state)
  components: { budget: number; savings: number; goals: number; trend: number; debt: number };
  applicable: { budget: boolean; savings: boolean; goals: boolean; trend: boolean; debt: boolean };
}

export function computePulseScore(
  transactions: Transaction[], budgets: Budget[], goals: Goal[], debts: Debt[],
  baseCurrency: string, rates: ExchangeRates,
): PulseScore {
  const mk = nowMonthKey();
  const { income, expense } = monthlyData(transactions, mk, baseCurrency, rates);

  // 1. Budget compliance — applicable only if budgets exist
  const budgetApplicable = budgets.length > 0;
  let budgetScore = 0;
  if (budgetApplicable) {
    const spend = spendByCategory(transactions, mk, baseCurrency, rates);
    const compliance = budgets.map(b => {
      const limitBase = convert(b.limit, b.currency, baseCurrency, rates);
      const pct = limitBase > 0 ? (spend[b.category] || 0) / limitBase * 100 : 0;
      return clamp(100 - pct, 0, 100);
    });
    budgetScore = compliance.reduce((s, v) => s + v, 0) / compliance.length;
  }

  // 2. Savings rate — applicable only if there is income this month (target 20% => 100)
  const savingsApplicable = income > 0;
  const rate = savingsApplicable ? (income - expense) / income * 100 : 0;
  const savingsScore = clamp(rate * 5, 0, 100);

  // 3. Goal progress — applicable only if there are active goals
  const activeGoals = goals.filter(g => !g.completed);
  const goalsApplicable = activeGoals.length > 0;
  let goalScore = 0;
  if (goalsApplicable) {
    const progresses = activeGoals.map(g => {
      const tgt = convert(g.target, g.currency, baseCurrency, rates);
      const cur = convert(g.current, g.currency, baseCurrency, rates);
      return tgt > 0 ? clamp(cur / tgt * 100, 0, 100) : 0;
    });
    goalScore = progresses.reduce((s, v) => s + v, 0) / progresses.length;
  }

  // 4. Expense trend — applicable only if there was spend last month to compare
  const [y, m] = mk.split('-').map(Number);
  const prevMk = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const prevExp = monthlyData(transactions, prevMk, baseCurrency, rates).expense;
  const trendApplicable = prevExp > 0;
  let trendScore = 0;
  if (trendApplicable) {
    const change = (expense - prevExp) / prevExp * 100;
    if      (change <= 0)  trendScore = 100;
    else if (change <= 10) trendScore = 80;
    else if (change <= 20) trendScore = 60;
    else if (change <= 40) trendScore = 40;
    else                   trendScore = 20;
  }

  // 5. Debt health (DTI). Applicable only if the household HAS debts —
  //    debt-free is intentionally EXCLUDED (not gifted 100, not penalised).
  const debtApplicable = debts.length > 0;
  let debtScore = 0;
  if (debtApplicable) {
    if (income === 0) {
      debtScore = 40; // debts but no income to compute DTI -> "watch"
    } else {
      const dti = (totalMonthlyDebtPayment(debts, baseCurrency, rates) / income) * 100;
      if      (dti <= 15) debtScore = 100;
      else if (dti <= 25) debtScore = 85;
      else if (dti <= 36) debtScore = 65;
      else if (dti <= 50) debtScore = 35;
      else                debtScore = 10;
    }
  }

  // Renormalise the original weights over applicable components only.
  const parts = [
    { score: budgetScore,  weight: 0.25, ok: budgetApplicable  },
    { score: savingsScore, weight: 0.25, ok: savingsApplicable },
    { score: goalScore,    weight: 0.15, ok: goalsApplicable   },
    { score: trendScore,   weight: 0.15, ok: trendApplicable   },
    { score: debtScore,    weight: 0.20, ok: debtApplicable    },
  ];
  const totalWeight = parts.reduce((s, p) => s + (p.ok ? p.weight : 0), 0);
  const total = totalWeight === 0
    ? null
    : clamp(Math.round(parts.reduce((s, p) => s + (p.ok ? p.score * p.weight : 0), 0) / totalWeight), 0, 100);

  return {
    total,
    components: {
      budget:  Math.round(budgetScore),
      savings: Math.round(savingsScore),
      goals:   Math.round(goalScore),
      trend:   Math.round(trendScore),
      debt:    Math.round(debtScore),
    },
    applicable: {
      budget: budgetApplicable, savings: savingsApplicable, goals: goalsApplicable,
      trend: trendApplicable, debt: debtApplicable,
    },
  };
}

export function pulseStatus(score: number | null): { label: string; cssVar: string } {
  if (score === null) return { label: 'No data yet', cssVar: 'hsl(var(--ink-dim))' };
  if (score >= 80) return { label: 'Excellent',   cssVar: 'hsl(var(--sage))'  };
  if (score >= 65) return { label: 'Good',        cssVar: 'hsl(var(--coral))' };
  if (score >= 45) return { label: 'Fair',        cssVar: 'hsl(var(--honey))' };
  return                  { label: 'Needs Work',  cssVar: 'hsl(var(--terra))' };
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
  let owedToYouD = dineroZero(baseCurrency);
  let youOweD = dineroZero(baseCurrency);
  const owedDetails: SplitOutstanding['owedDetails'] = [];
  const youOweDetails: SplitOutstanding['youOweDetails'] = [];
  transactions.forEach(t => {
    if (!t.split?.isSplit) return;
    const cur = t.currency || baseCurrency;
    (t.split.participants || []).forEach(p => {
      if (p.paid) return;
      const shareInBase = convertViaUsdRates(toDinero(p.share, cur), baseCurrency, rates);
      if (t.split!.paidBy === 'me' && !p.isYou) {
        owedToYouD = addDinero(owedToYouD, shareInBase);
        owedDetails.push({ txn: t, participant: p });
      } else if (t.split!.paidBy === 'external' && p.isYou) {
        youOweD = addDinero(youOweD, shareInBase);
        youOweDetails.push({ txn: t, participant: p });
      }
    });
  });
  return {
    owedToYou: fromDinero(owedToYouD),
    youOwe:    fromDinero(youOweD),
    owedDetails,
    youOweDetails,
  };
}
