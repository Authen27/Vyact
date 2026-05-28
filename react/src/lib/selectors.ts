import {
  monthlyData, totalBalance, computePulseScore, getInsights, spendByCategory,
  totalAssets, totalLiabilities, totalMonthlyDebtPayment,
} from './calculations';
import type { ExchangeRates } from '../types';

// Simple memoize-one implementation that compares args by reference.
function memoizeOne<T extends (...args: any[]) => any>(fn: T): T {
  let lastArgs: any[] | null = null;
  let lastRes: any;
  return ((...args: any[]) => {
    if (lastArgs && args.length === lastArgs.length && args.every((a, i) => a === lastArgs![i])) {
      return lastRes;
    }
    lastArgs = args;
    lastRes = fn(...args);
    return lastRes;
  }) as T;
}

const memoMonthlyData = memoizeOne((transactions: any[], mk: string, base: string, rates: ExchangeRates) =>
  monthlyData(transactions, mk, base, rates),
);
export const selectMonthlyData = (mk: string) => (s: any) => memoMonthlyData(s.transactions, mk, s.profile.baseCurrency, s.rates);

const memoTotalBalance = memoizeOne((transactions: any[], base: string, rates: ExchangeRates) =>
  totalBalance(transactions, base, rates),
);
export const selectTotalBalance = (s: any) => memoTotalBalance(s.transactions, s.profile.baseCurrency, s.rates);

const memoPulse = memoizeOne((transactions: any[], budgets: any[], goals: any[], debts: any[], base: string, rates: ExchangeRates) =>
  computePulseScore(transactions, budgets, goals, debts, base, rates),
);
export const selectPulse = (s: any) => memoPulse(s.transactions, s.budgets, s.goals, s.debts, s.profile.baseCurrency, s.rates);

const memoInsights = memoizeOne((transactions: any[], budgets: any[], goals: any[], debts: any[], assets: any[], base: string, rates: ExchangeRates) =>
  getInsights(transactions, budgets, goals, debts, assets, base, rates),
);
export const selectInsights = (s: any) => memoInsights(s.transactions, s.budgets, s.goals, s.debts, s.assets, s.profile.baseCurrency, s.rates);

const memoSpend = memoizeOne((transactions: any[], mk: string, base: string, rates: ExchangeRates) =>
  spendByCategory(transactions, mk, base, rates),
);
export const selectSpendByCategory = (mk: string) => (s: any) => memoSpend(s.transactions, mk, s.profile.baseCurrency, s.rates);

const memoRecent = memoizeOne((transactions: any[]) => [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5));
export const selectRecentTxns = (s: any) => memoRecent(s.transactions);

const memoTotalAssets = memoizeOne((assets: any[], base: string, rates: ExchangeRates) => totalAssets(assets, base, rates));
export const selectTotalAssets = (s: any) => memoTotalAssets(s.assets, s.profile.baseCurrency, s.rates);

const memoTotalLiabilities = memoizeOne((debts: any[], base: string, rates: ExchangeRates) => totalLiabilities(debts, base, rates));
export const selectTotalLiabilities = (s: any) => memoTotalLiabilities(s.debts, s.profile.baseCurrency, s.rates);

const memoMonthlyDebt = memoizeOne((debts: any[], base: string, rates: ExchangeRates) => totalMonthlyDebtPayment(debts, base, rates));
export const selectMonthlyDebtPayment = (s: any) => memoMonthlyDebt(s.debts, s.profile.baseCurrency, s.rates);
