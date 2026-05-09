// FinFlow v7 — Amortisation engine
// Properly computes interest/principal split per payment from the
// outstanding balance — matches Bank of England standard PMT.
//
// On a £200,000 mortgage at 5% over 25 years:
//   Month 1:   £833 interest, £337 principal (of £1,170 EMI)
//   Month 120: £625 interest, £545 principal
//   Month 300: £5 interest, £1,165 principal
//
// Pre-v7 we incorrectly used a flat split. This file is the fix.

import type { Debt, AmortizationEntry, PartPaymentChoice, PaymentLogEntry } from '../types';
import { uid, today } from './format';

// Compute the EMI from principal, annual rate %, tenure months
export function computeEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate) return principal / tenureMonths;
  const r = annualRate / 100 / 12;
  const x = Math.pow(1 + r, tenureMonths);
  return (principal * r * x) / (x - 1);
}

// Compute remaining tenure given outstanding, EMI, rate
export function computeRemainingMonths(outstanding: number, emi: number, annualRate: number): number {
  if (!outstanding || !emi) return 0;
  if (!annualRate) return Math.ceil(outstanding / emi);
  const r = annualRate / 100 / 12;
  if (emi <= outstanding * r) return Infinity; // EMI doesn't even cover interest
  // n = -log(1 - rP/M) / log(1+r)
  return Math.ceil(-Math.log(1 - (r * outstanding) / emi) / Math.log(1 + r));
}

// Full amortisation schedule from current outstanding forward
export function calculateAmortizationSchedule(debt: Debt): AmortizationEntry[] {
  const out: AmortizationEntry[] = [];
  const annualRate = debt.interestRate;
  const monthsLeft = debt.remainingMonths ?? debt.tenureMonths ?? 0;
  if (monthsLeft <= 0) return out;
  const emi = debt.minimumPayment || computeEmi(debt.currentBalance, annualRate, monthsLeft);

  let outstanding = debt.currentBalance;
  const start = new Date(debt.dueDate || today());
  for (let m = 1; m <= monthsLeft && outstanding > 0.01; m++) {
    const r = annualRate / 100 / 12;
    const interest = outstanding * r;
    let principal = emi - interest;
    if (principal > outstanding) principal = outstanding;
    outstanding = Math.max(0, outstanding - principal);
    const d = new Date(start);
    d.setMonth(d.getMonth() + (m - 1));
    out.push({
      month: m,
      date: d.toISOString().split('T')[0],
      emi: emi,
      interest,
      principal,
      outstanding,
    });
    if (outstanding <= 0.01) break;
  }
  return out;
}

// Compute the interest/principal portions for a single payment
export function splitPayment(outstandingBefore: number, annualRate: number, paymentAmount: number): { interest: number; principal: number } {
  const r = annualRate / 100 / 12;
  const interest = outstandingBefore * r;
  const principal = Math.max(0, paymentAmount - interest);
  return { interest, principal };
}

// Apply a part-payment with the user's chosen re-amortisation strategy.
// Returns the updated debt. Caller is responsible for persisting.
export interface ApplyPaymentResult {
  debt: Debt;
  log: PaymentLogEntry;
  message: string;
}

export function applyPayment(
  debt: Debt,
  paymentAmount: number,
  partChoice?: PartPaymentChoice,
  paymentDate = today(),
): ApplyPaymentResult {
  const annualRate = debt.interestRate;
  const emi = debt.minimumPayment;
  const isPartPayment = paymentAmount > emi * 1.05; // > 5% over EMI = considered "part-payment"

  // Standard payment math: interest first, principal reduces balance
  const { interest, principal } = splitPayment(debt.currentBalance, annualRate, paymentAmount);
  const newOutstanding = Math.max(0, debt.currentBalance - principal);

  // Re-amortisation logic per user choice
  let newRemainingMonths = debt.remainingMonths ?? debt.tenureMonths ?? 0;
  let newEmi = emi;
  let message = '';

  if (isPartPayment && partChoice) {
    if (partChoice === 'reduce_tenure') {
      // EMI stays, recompute remaining months on new outstanding
      newRemainingMonths = computeRemainingMonths(newOutstanding, emi, annualRate);
      const monthsSaved = (debt.remainingMonths ?? debt.tenureMonths ?? 0) - newRemainingMonths - 1;
      message = `Loan now ends in ${newRemainingMonths} months · ${monthsSaved} months earlier.`;
    } else if (partChoice === 'reduce_emi') {
      // Tenure stays, recompute EMI on new outstanding
      newRemainingMonths = (debt.remainingMonths ?? debt.tenureMonths ?? 0) - 1;
      newEmi = computeEmi(newOutstanding, annualRate, newRemainingMonths);
      message = `EMI reduced to ${newEmi.toFixed(2)} from ${emi.toFixed(2)}.`;
    } else if (partChoice === 'apply_advance') {
      // Both stay. Advance N future EMIs (= floor((payment - thisMonthEmi) / emi))
      const advanceCount = Math.floor((paymentAmount - emi) / emi);
      newRemainingMonths = (debt.remainingMonths ?? debt.tenureMonths ?? 0) - 1 - advanceCount;
      message = `Next ${advanceCount} EMIs covered in advance.`;
    }
  } else {
    newRemainingMonths = Math.max(0, (debt.remainingMonths ?? debt.tenureMonths ?? 0) - 1);
    message = `Payment recorded · ${interest.toFixed(2)} interest, ${principal.toFixed(2)} principal.`;
  }

  const log: PaymentLogEntry = {
    id: uid(),
    date: paymentDate,
    amount: paymentAmount,
    interest,
    principal,
    outstandingAfter: newOutstanding,
    isPartPayment,
    partChoice,
  };

  const updated: Debt = {
    ...debt,
    currentBalance: newOutstanding,
    remainingMonths: newRemainingMonths,
    minimumPayment: newEmi,
    paymentLog: [...(debt.paymentLog || []), log],
  };

  return { debt: updated, log, message };
}

// Aggregate total interest paid (lifetime + YTD)
export function interestSummary(debt: Debt): { lifetime: number; ytd: number; principalPaid: number } {
  const log = debt.paymentLog || [];
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const lifetime = log.reduce((s, e) => s + e.interest, 0);
  const ytd = log.filter(e => e.date >= yearStart).reduce((s, e) => s + e.interest, 0);
  const principalPaid = log.reduce((s, e) => s + e.principal, 0);
  return { lifetime, ytd, principalPaid };
}
