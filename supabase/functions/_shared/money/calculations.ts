// Vyact Agent — SERVER-SIDE MONEY TOOLS (architecture §6, "compute location").
//
// WHY THIS FILE EXISTS
// -------------------
// An inbound WhatsApp/SMS message has no browser, no session and no Zustand
// store, so the client-side money layer (`react/src/lib/calculations.ts`,
// `react/src/lib/accountBalance.ts`) is unreachable from a server-hosted agent.
// This module is the Deno-side port of the PURE AGGREGATES from those two files:
// it takes data and returns numbers, and nothing else.
//
// Binding rule from CLAUDE.md: **the LLM never computes money.** It selects a
// function here and phrases the return. Every figure the agent states about a
// household's money originates in this file, so it must agree with the client
// to the cent.
//
// PARITY IS THE CONTRACT
// ----------------------
// This is a SECOND implementation, not a refactor. The client originals are
// untouched and remain authoritative: if the two disagree, THIS FILE IS WRONG.
// The gate is `react/src/lib/__tests__/moneyPortParity.test.ts`, which imports
// both sides and asserts identical results over shared fixtures. Money-model
// truth is separately pinned by `moneyModel.invariants.test.ts` (INV-1..9).
//
// SELF-CONTAINED BY DESIGN (precedent: `_shared/whatsapp-parser.ts`)
// -----------------------------------------------------------------
// Edge deploy cannot import from `react/src`, and `dinero.js` is only installed
// under `react/node_modules` — it is not resolvable from this tree and would
// need an `npm:` specifier that the parity typecheck cannot resolve. So the
// dinero boundary layer of `react/src/lib/money.ts` is reimplemented below in
// plain integer minor-unit arithmetic that reproduces dinero v2's semantics
// exactly (scale arithmetic, `convert` = multiply-then-transform-scale,
// `add` = normalise-scale-then-integer-add), plus the app's own banker's
// rounding re-quantisation. No imports. No network. No Deno/browser globals.
//
// MONEY MODEL (binding — see CLAUDE.md):
//   • transfers AND investments are spend/income-NEUTRAL (both account FKs, no
//     category) — `reportableTxns` drops them, `computeAccountBalance` moves
//     both legs;
//   • reconciliation is an account offset + dated log, NEVER a transaction —
//     the offset is read by balances/net worth and is structurally invisible to
//     every spend/income aggregator;
//   • `loan_emi` is a SYSTEM_SPLIT (visible interest expense + system principal
//     transfer) — only the interest leg is spend;
//   • categories are type-scoped; transfers/investments carry none.
//
// NOT PORTED (deliberate — see the P1 report):
//   • `reconcileAccount` — a WRITE-path helper that mints `new Date()` and
//     returns a patch to persist. Server writes go through the RPC; duplicating
//     the write rule here is exactly how the money model would drift.
//   • `computePulseScore` / `getInsights` / `pulseStatus` — presentation and
//     scoring (emoji, copy, CSS vars), not aggregates.
//   • `simulatePayoffInterest` — a projection the source itself documents as
//     outside the money model.

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — structural mirrors of `react/src/types.ts`. Kept local (no imports
// from the client tree) but deliberately assignment-compatible so the parity
// test can hand the SAME fixture objects to both implementations.
// ─────────────────────────────────────────────────────────────────────────────

export type TxnType = 'income' | 'expense' | 'investment' | 'transfer';
export type Liquidity = 'liquid' | 'short' | 'long';
export type AccountKind = 'cash' | 'bank' | 'credit_card' | 'investment' | 'loan';
export type BudgetPeriod = 'monthly' | 'quarterly' | 'half_yearly' | 'annual' | 'custom';
export type BudgetScope = 'month' | 'annual';

export interface ExchangeRates { [currencyCode: string]: number }

export interface SplitParticipant {
  name: string;
  isYou?: boolean;
  share: number;
  paid: boolean;
  paidOn?: string | null;
  email?: string;
  sharedSplitId?: string;
}

export interface SplitInfo {
  isSplit: true;
  totalAmount: number;
  yourShare: number;
  paidBy: 'me' | 'external';
  participants: SplitParticipant[];
}

export interface Transaction {
  id: string;
  type: TxnType;
  amount: number;
  currency: string;
  date: string;            // YYYY-MM-DD
  description: string;
  category: string;
  excluded?: boolean;
  paymentMethod?: string;
  accountId?: string;
  toAccountId?: string;
  linkedToAssetId?: string;
  /** v10.26.0 (R4) — investment rows move money between an account and an asset. */
  assetId?: string;
  split?: SplitInfo;
}

export interface ReconciliationEntry {
  at: string;
  delta: number;
  kind: 'bank' | 'investment';
  stated_value: number | null;
}

export interface Account {
  id: string;
  assetId?: string;
  kind: AccountKind;
  name: string;
  currency: string;
  isArchived?: boolean;
  openingBalance?: number;
  reconciliationOffset?: number;
  reconciliationLog?: ReconciliationEntry[];
}

export interface Asset {
  id: string;
  type: string;
  name: string;
  value: number;
  currency: string;
  liquidity: Liquidity;
  /** v10.26.0 (R4) — see computeAssetValue. */
  valuationOffset?: number;
  valuationLog?: ReconciliationEntry[];
}

export interface Debt {
  id: string;
  type: string;
  name: string;
  principal: number;
  currentBalance: number;
  interestRate: number;
  minimumPayment: number;
  currency: string;
  direction?: 'owed_by_me' | 'owed_to_me';
}

export interface Budget {
  id: string;
  category?: string;
  limit: number;
  currency: string;
  scope?: BudgetScope;
  periodYear?: number;
  periodMonth?: number;
  period?: BudgetPeriod;
  periodStart?: string;
  periodEnd?: string;
}

export interface BudgetAllocation {
  id: string;
  budgetId: string;
  category: string;
  amount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// MONEY PRIMITIVES — zero-dependency port of `react/src/lib/money.ts`.
//
// Representation mirrors a dinero v2 snapshot: an INTEGER `amount` in units of
// 10^-scale of `currency`. Every fold below happens in this integer space, so
// `0.10 + 0.10 + 0.10` is exactly `0.30` here as it is on the client.
// ─────────────────────────────────────────────────────────────────────────────

export interface MoneyCurrency { code: string; base: number; exponent: number }
export interface Money { amount: number; scale: number; currency: MoneyCurrency }

/** Mirrors CURRENCY_REGISTRY in `react/src/lib/money.ts` (the @dinero.js/currencies
 *  definitions for the 12 currencies the consumer app supports). JPY is the
 *  0-decimal case; every supported currency is base 10. If a currency is added
 *  to `constants.ts`/`money.ts`, add it here too or its amounts silently fall
 *  back to USD's 2-decimal scale. */
export const CURRENCY_REGISTRY: Record<string, MoneyCurrency> = {
  USD: { code: 'USD', base: 10, exponent: 2 },
  EUR: { code: 'EUR', base: 10, exponent: 2 },
  GBP: { code: 'GBP', base: 10, exponent: 2 },
  INR: { code: 'INR', base: 10, exponent: 2 },
  JPY: { code: 'JPY', base: 10, exponent: 0 },
  AUD: { code: 'AUD', base: 10, exponent: 2 },
  CAD: { code: 'CAD', base: 10, exponent: 2 },
  CHF: { code: 'CHF', base: 10, exponent: 2 },
  CNY: { code: 'CNY', base: 10, exponent: 2 },
  AED: { code: 'AED', base: 10, exponent: 2 },
  SGD: { code: 'SGD', base: 10, exponent: 2 },
  BRL: { code: 'BRL', base: 10, exponent: 2 },
};

/** Unknown codes fall back to USD — matching the documented client behaviour
 *  (rate-defaults-to-1, currency-treated-as-USD). */
export function currencyOf(code: string): MoneyCurrency {
  return CURRENCY_REGISTRY[code] ?? CURRENCY_REGISTRY.USD;
}

/** dinero v2 `transformScale` with the default `down` divisor.
 *  Scaling UP multiplies by base^Δ; scaling DOWN integer-divides and rounds
 *  toward −∞ (dinero's `down`: truncate, then decrement when the quotient is
 *  negative and inexact). */
function transformScale(d: Money, newScale: number): Money {
  if (newScale === d.scale) return d;
  if (newScale > d.scale) {
    const factor = Math.pow(d.currency.base, newScale - d.scale);
    return { amount: d.amount * factor, scale: newScale, currency: d.currency };
  }
  const factor = Math.pow(d.currency.base, d.scale - newScale);
  const quotient = Math.trunc(d.amount / factor);
  const isExact = d.amount % factor === 0;
  const isPositive = d.amount > 0;
  return {
    amount: isPositive || isExact ? quotient : quotient - 1,
    scale: newScale,
    currency: d.currency,
  };
}

/** Convert a JS-number amount in MAJOR units to integer minor units.
 *  `Math.round` (half-away-from-zero) matches the client exactly. */
export function toDinero(amount: number, code: string): Money {
  const currency = currencyOf(code);
  const scale = Math.pow(currency.base, currency.exponent);
  return { amount: Math.round((amount || 0) * scale), scale: currency.exponent, currency };
}

/** Back to a JS-number in major units, using the snapshot's own scale so a
 *  higher-precision intermediate is not silently truncated. */
export function fromDinero(d: Money): number {
  return d.amount / Math.pow(10, d.scale);
}

/** dinero v2 `add`: normalise both operands to the higher scale, then add the
 *  integers. Throws on mixed currencies, same as the client. */
export function addDinero(augend: Money, addend: Money): Money {
  if (augend.currency.code !== addend.currency.code) {
    throw new Error('[money] Objects must have the same currency.');
  }
  const highest = Math.max(augend.scale, addend.scale);
  const a = transformScale(augend, highest);
  const b = transformScale(addend, highest);
  return { amount: a.amount + b.amount, scale: highest, currency: a.currency };
}

export function dineroZero(code: string): Money {
  const currency = currencyOf(code);
  return { amount: 0, scale: currency.exponent, currency };
}

/** Fold items into one Money in `baseCode`. All addition is integer arithmetic
 *  in the target currency's minor units — no float drift across the reduction,
 *  however many rows are summed. */
export function sumDinero<T>(items: readonly T[], getDinero: (t: T) => Money, baseCode: string): Money {
  let acc = dineroZero(baseCode);
  for (const it of items) acc = addDinero(acc, getDinero(it));
  return acc;
}

/** Express a JS-number FX rate as dinero's `{ amount, scale }` shape.
 *  Scale 10 ≈ 10 digits of rate precision, well inside Number.MAX_SAFE_INTEGER
 *  for any realistic rate. */
function rateToScaled(rate: number, scale = 10): { amount: number; scale: number } {
  return { amount: Math.round(rate * Math.pow(10, scale)), scale };
}

/** dinero v2 `convert` for a single scaled rate: multiply the integer amount by
 *  the scaled rate and carry the summed scale. */
function dineroConvert(d: Money, newCurrency: MoneyCurrency, rate: { amount: number; scale: number }): Money {
  const newScale = d.scale + rate.scale;
  const raw: Money = { amount: d.amount * rate.amount, scale: newScale, currency: newCurrency };
  return transformScale(raw, Math.max(newScale, newCurrency.exponent));
}

/** Banker's rounding (half-to-even) — used only at the FX re-quantisation edge
 *  so chained conversions are not biased up or down. */
function bankersRound(n: number): number {
  const trunc = Math.trunc(n);
  const frac = n - trunc;
  if (frac === 0.5) return trunc % 2 === 0 ? trunc : trunc + 1;
  if (frac === -0.5) return trunc % 2 === 0 ? trunc : trunc - 1;
  return Math.round(n);
}

/** A dinero conversion leaves scale = source scale + rate scale (i.e. sub-cent
 *  precision). Re-quantise to the currency's native exponent with banker's
 *  rounding so the value round-trips cleanly through later operations. */
function quantizeToCurrency(d: Money): Money {
  const native = d.currency.exponent;
  if (d.scale <= native) return d;
  const factor = Math.pow(10, d.scale - native);
  return { amount: bankersRound(d.amount / factor), scale: native, currency: d.currency };
}

/** Convert across currencies using the per-USD rate table (DEFAULT_RATES
 *  semantics). Two-step through USD, exactly matching the legacy
 *  `(amount / rFrom) * rTo`, quantised at each hop. No-op on same currency. */
export function convertViaUsdRates(d: Money, toCode: string, rates: Record<string, number>): Money {
  const fromCode = d.currency.code;
  if (fromCode === toCode) return d;

  const dUsd = fromCode === 'USD'
    ? d
    : quantizeToCurrency(
        dineroConvert(d, CURRENCY_REGISTRY.USD, rateToScaled(1 / (rates[fromCode] ?? 1))),
      );

  if (toCode === 'USD') return dUsd;
  const target = currencyOf(toCode);
  // Rates are keyed by the RESOLVED code (target.code); these differ only when
  // `toCode` is unknown and falls back to USD, in which case the lookup must
  // also use 'USD'. Mirrors the client comment verbatim.
  return quantizeToCurrency(dineroConvert(dUsd, target, rateToScaled(rates[toCode] ?? 1)));
}

/** Port of `react/src/lib/format.ts` → `convert()`. */
export function convert(amount: number, from: string, to: string, rates: ExchangeRates): number {
  if (!amount || from === to) return amount;
  return fromDinero(convertViaUsdRates(toDinero(amount, from), to, rates));
}

/** Port of `react/src/lib/format.ts` → `getMonthKey()`. */
export function getMonthKey(d: string): string { return d.slice(0, 7); }

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTION AMOUNT + REPORTABILITY
// ─────────────────────────────────────────────────────────────────────────────

export function txnAmountInBase(t: Transaction, baseCurrency: string, rates: ExchangeRates): number {
  return convert(t.amount, t.currency || baseCurrency, baseCurrency, rates);
}

/** The amount that actually belongs to this household: a split row contributes
 *  only `yourShare`. FX is applied per-row before any fold. */
function effectiveDinero(t: Transaction, baseCurrency: string, rates: ExchangeRates): Money {
  const cur = t.currency || baseCurrency;
  const raw = t.split?.isSplit && typeof t.split.yourShare === 'number'
    ? t.split.yourShare
    : t.amount;
  return convertViaUsdRates(toDinero(raw, cur), baseCurrency, rates);
}

export function effectiveAmount(t: Transaction, baseCurrency: string, rates: ExchangeRates): number {
  return fromDinero(effectiveDinero(t, baseCurrency, rates));
}

/** Reportable = the rows that are genuinely spend or income.
 *  Excludes private/excluded rows and BOTH transfer encodings:
 *    • v7.0.3 paired rows — type income/expense with category === 'transfer';
 *    • v7.2 single-row    — type === 'transfer' (and 'investment'), dropped by
 *      the type filter.
 *  Also excludes `balance_adjustment` — reconciliation corrections move an
 *  account but are not spend or earn (Money-Model B1.3). */
export function reportableTxns(transactions: Transaction[]): Transaction[] {
  return transactions.filter(t =>
    !t.excluded
    && (t.type === 'income' || t.type === 'expense')
    && t.category !== 'transfer'
    && t.category !== 'balance_adjustment'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CASH FLOW
// ─────────────────────────────────────────────────────────────────────────────

export interface MonthData { income: number; expense: number; net: number }

export function monthlyData(
  transactions: Transaction[], monthKey: string, baseCurrency: string, rates: ExchangeRates,
): MonthData {
  const txns = reportableTxns(transactions).filter(t => getMonthKey(t.date) === monthKey);
  const incomeD = sumDinero(txns.filter(t => t.type === 'income'), t => effectiveDinero(t, baseCurrency, rates), baseCurrency);
  const expenseD = sumDinero(txns.filter(t => t.type === 'expense'), t => effectiveDinero(t, baseCurrency, rates), baseCurrency);
  const income = fromDinero(incomeD);
  const expense = fromDinero(expenseD);
  return { income, expense, net: income - expense };
}

/** Lifetime income − expense across the reportable stream. (Not an account
 *  balance — see `computeAccountBalance` for that.) */
export function totalBalance(transactions: Transaction[], baseCurrency: string, rates: ExchangeRates): number {
  const txns = reportableTxns(transactions);
  const incomeD = sumDinero(txns.filter(t => t.type === 'income'), t => effectiveDinero(t, baseCurrency, rates), baseCurrency);
  const expenseD = sumDinero(txns.filter(t => t.type === 'expense'), t => effectiveDinero(t, baseCurrency, rates), baseCurrency);
  return fromDinero(incomeD) - fromDinero(expenseD);
}

// ─────────────────────────────────────────────────────────────────────────────
// SPEND BY CATEGORY / PERIOD
// ─────────────────────────────────────────────────────────────────────────────

export function spendByCategory(
  transactions: Transaction[], monthKey: string, baseCurrency: string, rates: ExchangeRates,
): Record<string, number> {
  const buckets: Record<string, Money> = {};
  for (const t of reportableTxns(transactions)) {
    if (t.type !== 'expense' || getMonthKey(t.date) !== monthKey) continue;
    const inBase = effectiveDinero(t, baseCurrency, rates);
    buckets[t.category] = buckets[t.category] ? addDinero(buckets[t.category], inBase) : inBase;
  }
  const out: Record<string, number> = {};
  for (const [k, d] of Object.entries(buckets)) out[k] = fromDinero(d);
  return out;
}

export function spendByCategoryInRange(
  transactions: Transaction[], start: string, end: string, baseCurrency: string, rates: ExchangeRates,
): Record<string, number> {
  const buckets: Record<string, Money> = {};
  for (const t of reportableTxns(transactions)) {
    if (t.type !== 'expense' || t.date < start || t.date > end) continue;
    const inBase = effectiveDinero(t, baseCurrency, rates);
    buckets[t.category] = buckets[t.category] ? addDinero(buckets[t.category], inBase) : inBase;
  }
  const out: Record<string, number> = {};
  for (const [k, d] of Object.entries(buckets)) out[k] = fromDinero(d);
  return out;
}

/** Cumulative spend at the end of each calendar day in `[start, upto]`,
 *  restricted to `categories`. Same machinery as `spendByCategoryInRange`, so
 *  the final `cumulative` equals that function's total over the same window.
 *
 *  ⚠ TZ NOTE (faithful to the original): the day walk uses `new Date('…T00:00:00')`
 *  and `getFullYear/getMonth/getDate`, i.e. the RUNTIME'S LOCAL TIMEZONE. Edge
 *  functions run UTC while browsers do not, so this is the one ported function
 *  whose output can legitimately differ by host. Parity is proven in-process. */
export function cumulativeSpendSeries(
  transactions: Transaction[],
  categories: Set<string>,
  start: string,
  upto: string,
  baseCurrency: string,
  rates: ExchangeRates,
): { date: string; cumulative: number }[] {
  if (upto < start) return [];
  const perDay = new Map<string, Money>();
  for (const t of reportableTxns(transactions)) {
    if (t.type !== 'expense' || !categories.has(t.category)) continue;
    if (t.date < start || t.date > upto) continue;
    const d = effectiveDinero(t, baseCurrency, rates);
    const prev = perDay.get(t.date);
    perDay.set(t.date, prev ? addDinero(prev, d) : d);
  }
  const out: { date: string; cumulative: number }[] = [];
  let running: Money | null = null;
  const cur = new Date(`${start}T00:00:00`);
  const end = new Date(`${upto}T00:00:00`);
  // Guard against a malformed range spinning forever.
  for (let guard = 0; cur <= end && guard < 400; guard++) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const day = perDay.get(key);
    if (day) running = running ? addDinero(running, day) : day;
    out.push({ date: key, cumulative: running ? fromDinero(running) : 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET WINDOWS / LINES (period resolution for the spend aggregates above)
// ─────────────────────────────────────────────────────────────────────────────

/** Flatten container budgets + their allocations into concrete `{category, limit}`
 *  lines. A legacy budget carrying its own category emits one line; a v9.1
 *  container emits one line per allocation, inheriting the parent's window. */
export function budgetLines(budgets: Budget[], allocations: BudgetAllocation[]): Budget[] {
  const lines: Budget[] = [];
  for (const b of budgets) {
    const allocs = allocations.filter(a => a.budgetId === b.id);
    if (allocs.length) {
      for (const a of allocs) lines.push({
        id: a.id, category: a.category, limit: a.amount, currency: b.currency,
        period: b.period, periodStart: b.periodStart, periodEnd: b.periodEnd,
        scope: b.scope, periodYear: b.periodYear, periodMonth: b.periodMonth,
      });
    } else if (b.category) {
      lines.push(b);
    }
  }
  return lines;
}

/** Resolve a budget's scope+identity into a concrete inclusive [start, end]. */
export function resolveBudgetPeriod(
  scope: 'month' | 'annual', year: number, month: number,
): { periodStart: string; periodEnd: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (scope === 'annual') return { periodStart: `${year}-01-01`, periodEnd: `${year}-12-31` };
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return { periodStart: iso(start), periodEnd: iso(end) };
}

/** The inclusive ISO window of a budget's ACTIVE period, anchored at `today`.
 *  Calendar-aligned for monthly/quarterly/half_yearly/annual.
 *  ⚠ Same TZ caveat as `cumulativeSpendSeries`: `today` is read with local
 *  getters. Pass an explicit `today` server-side rather than relying on now. */
export function budgetWindow(
  b: Pick<Budget, 'period' | 'periodStart' | 'periodEnd'>, today: Date = new Date(),
): { start: string; end: string } {
  const period: BudgetPeriod = b.period || 'monthly';
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-indexed
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const startOf = (year: number, month: number) => new Date(Date.UTC(year, month, 1));
  const endOf = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0));
  if (period === 'custom') {
    return { start: b.periodStart || iso(startOf(y, m)), end: b.periodEnd || iso(endOf(y, m)) };
  }
  if (period === 'annual') return { start: iso(startOf(y, 0)), end: iso(endOf(y, 11)) };
  if (period === 'half_yearly') {
    const half = m < 6 ? 0 : 6;
    return { start: iso(startOf(y, half)), end: iso(endOf(y, half + 5)) };
  }
  if (period === 'quarterly') {
    const q = Math.floor(m / 3) * 3;
    return { start: iso(startOf(y, q)), end: iso(endOf(y, q + 2)) };
  }
  return { start: iso(startOf(y, m)), end: iso(endOf(y, m)) };
}

/** How many calendar months the period covers. */
export function periodMonths(period: BudgetPeriod | undefined): number {
  switch (period) {
    case 'annual': return 12;
    case 'half_yearly': return 6;
    case 'quarterly': return 3;
    case 'monthly':
    case undefined: return 1;
    case 'custom': return 1; // approximation; UI shows literal dates
  }
}

/** Read-only recurring EXPENSE forecast over [periodStart, periodEnd], bucketed
 *  by category, in the target currency. Approximate (period-length × per-period
 *  rate); informs a budget, writes nothing. Transfers/investments/income are
 *  excluded from spend forecast by construction. */
export function recurringForecastByCategory(
  schedules: { transactionTemplate: { type?: string; amount?: number; currency?: string; category?: string }; frequency: string }[],
  periodStart: string, periodEnd: string,
  baseCurrency: string, rates: ExchangeRates,
): Record<string, number> {
  const start = new Date(periodStart + 'T00:00:00Z').getTime();
  const end = new Date(periodEnd + 'T00:00:00Z').getTime();
  const days = Math.max(0, (end - start) / 86_400_000 + 1);
  const out: Record<string, number> = {};
  for (const s of schedules) {
    const t = s.transactionTemplate;
    if (!t || t.type !== 'expense' || !t.amount || !t.category) continue;
    const perPeriod =
      s.frequency === 'weekly' ? t.amount * (days / 7) :
      s.frequency === 'yearly' ? t.amount * (days / 365) :
      /* monthly / custom_day */ t.amount * (days / 30.4375);
    const inBase = convert(perPeriod, t.currency || baseCurrency, baseCurrency, rates);
    out[t.category] = (out[t.category] || 0) + Math.round(inBase * 100) / 100;
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANCE SHEET — net worth components
// ─────────────────────────────────────────────────────────────────────────────

export const totalAssets = (assets: Asset[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(assets, a => convertViaUsdRates(toDinero(a.value, a.currency), baseCurrency, rates), baseCurrency));

/** Only debts the household OWES are liabilities. `direction === 'owed_to_me'`
 *  rows are receivables and surface as their own Net Worth line. */
export const totalLiabilities = (debts: Debt[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(
    debts.filter(d => (d.direction || 'owed_by_me') !== 'owed_to_me'),
    d => convertViaUsdRates(toDinero(d.currentBalance, d.currency), baseCurrency, rates),
    baseCurrency,
  ));

export const totalReceivables = (debts: Debt[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(
    debts.filter(d => d.direction === 'owed_to_me'),
    d => convertViaUsdRates(toDinero(d.currentBalance, d.currency), baseCurrency, rates),
    baseCurrency,
  ));

export const liquidAssets = (assets: Asset[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(
    assets.filter(a => a.liquidity === 'liquid'),
    a => convertViaUsdRates(toDinero(a.value, a.currency), baseCurrency, rates),
    baseCurrency,
  ));

/** Receivables have no recurring minimum payment; only true liabilities
 *  contribute to the household's monthly outflow. */
export const totalMonthlyDebtPayment = (debts: Debt[], baseCurrency: string, rates: ExchangeRates): number =>
  fromDinero(sumDinero(
    debts.filter(d => (d.direction || 'owed_by_me') !== 'owed_to_me'),
    d => convertViaUsdRates(toDinero(d.minimumPayment, d.currency), baseCurrency, rates),
    baseCurrency,
  ));

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT BALANCES — port of `react/src/lib/accountBalance.ts` (read side)
//
//   balance(account) = opening_balance
//     + Σ(amount WHERE credited: income / transfer-in / investment-in)
//     − Σ(amount WHERE debited:  expense / transfer-out / investment-out)
//     + reconciliation_offset                                          (D2)
//
// Matching accepts both encodings: post-migration rows carry real account uuids
// in accountId/toAccountId; pre-migration caches may still hold the legacy
// paymentMethod scheme ('cash' / 'asset:<id>' / 'debt:<id>').
// ─────────────────────────────────────────────────────────────────────────────

/** The encoded legacy account key for an Account (paymentMethod scheme).
 *  Audit F2: liability accounts prefer the explicit debtId link (the old
 *  assetId: debt.id overload violated the FK). Kept in parity with the client
 *  accountBalance.ts — the money-port parity test pins this. */
export function accountValueOf(account: Account): string {
  if (account.kind === 'cash') return 'cash';
  if (account.kind === 'credit_card') return `debt:${account.debtId ?? account.assetId ?? account.id}`;
  if (account.kind === 'loan') return `debt:${account.debtId ?? account.assetId ?? account.id}`;
  return `asset:${account.assetId || account.id}`;
}

function matches(account: Account, value: string | undefined): boolean {
  if (!value) return false;
  return value === account.id || value === accountValueOf(account);
}

/** The account a transaction's money LEFT (expense / transfer-out / investment-out). */
export function debitAccountOf(t: Transaction): string | undefined {
  return t.accountId ?? t.paymentMethod ?? undefined;
}

/** The account a transaction's money ARRIVED in (income / transfer-in /
 *  investment-in). Income falls back to the legacy single-field encoding. */
export function creditAccountOf(t: Transaction): string | undefined {
  if (t.type === 'income') return t.toAccountId ?? t.accountId ?? t.paymentMethod ?? undefined;
  return t.toAccountId ?? t.linkedToAssetId ?? undefined;
}

/** An account's current balance. Pure fold over real transactions plus the D2
 *  reconciliation offset. Excluded-from-reports txns STILL count here — money
 *  moved even if the row is hidden from spend reports. Transfers/investments
 *  move both legs, which is exactly why they are spend/income-neutral. */
export function computeAccountBalance(
  account: Account, txns: Transaction[], baseCurrency: string, rates: ExchangeRates,
): number {
  let bal = (account.openingBalance ?? 0) + (account.reconciliationOffset ?? 0);
  for (const t of txns) {
    const amt = effectiveAmount(t, baseCurrency, rates);
    if (t.type === 'income') {
      if (matches(account, creditAccountOf(t))) bal += amt;
    } else if (t.type === 'expense') {
      if (matches(account, debitAccountOf(t))) bal -= amt;
    } else if (t.type === 'transfer' || t.type === 'investment') {
      if (matches(account, debitAccountOf(t))) bal -= amt;
      if (matches(account, creditAccountOf(t))) bal += amt;
    }
  }
  return Math.round(bal * 100) / 100;
}

/** v10.26.0 (R4) — port of the client's computeAssetValue: opening value + buys
 *  into the asset − withdrawals out of it + the valuation offset, in the asset's
 *  own currency. */
export function computeAssetValue(asset: Asset, txns: Transaction[], rates: ExchangeRates): number {
  let v = asset.value + (asset.valuationOffset ?? 0);
  for (const t of txns) {
    if (t.type !== 'investment' || t.assetId !== asset.id) continue;
    const amt = effectiveAmount(t, asset.currency, rates);
    // A withdrawal names ONLY a receiving account; anything else is a buy (v10.27.0).
    if (t.toAccountId && !t.accountId) v -= amt;
    else v += amt;
  }
  return Math.round(v * 100) / 100;
}

export interface LiveAssetRow {
  id: string;
  name: string;
  /** Converted to the household's base currency. */
  value: number;
  currency: string;
  liquidity: Liquidity;
  source: 'account' | 'asset';
  account?: Account;
  asset?: Asset;
}

const ACCOUNT_LIQUIDITY: Partial<Record<AccountKind, Liquidity>> = {
  cash: 'liquid', bank: 'liquid', investment: 'short',
};

/** The de-duped asset-side rows Net Worth sums: live balances for every
 *  spendable account (cash/bank/investment — credit_card/loan are liabilities),
 *  plus any legacy asset NOT already represented by one of those accounts.
 *  Folding both would double-count. */
export function liveAssetRows(
  assets: Asset[], accounts: Account[], txns: Transaction[],
  baseCurrency: string, rates: ExchangeRates,
): LiveAssetRow[] {
  const linkedAssetIds = new Set(accounts.map(a => a.assetId).filter((id): id is string => !!id));
  const accountRows: LiveAssetRow[] = accounts
    .filter(a => !a.isArchived && (a.kind === 'cash' || a.kind === 'bank' || a.kind === 'investment'))
    .map(a => ({
      id: a.id,
      name: a.name,
      value: computeAccountBalance(a, txns, baseCurrency, rates),
      currency: baseCurrency,
      liquidity: ACCOUNT_LIQUIDITY[a.kind] ?? 'liquid',
      source: 'account' as const,
      account: a,
    }));
  const assetRows: LiveAssetRow[] = assets
    .filter(a => !linkedAssetIds.has(a.id))
    .map(a => ({
      id: a.id,
      name: a.name,
      value: convert(computeAssetValue(a, txns, rates), a.currency, baseCurrency, rates),
      currency: a.currency,
      liquidity: a.liquidity,
      source: 'asset' as const,
      asset: a,
    }));
  return [...accountRows, ...assetRows];
}

export function liveTotalAssets(rows: LiveAssetRow[]): number {
  return Math.round(rows.reduce((s, r) => s + r.value, 0) * 100) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAN / EMI — `loan_emi` is a SYSTEM_SPLIT: the interest portion is visible
// spend, the principal portion is a system transfer into the loan account.
// Only `splitEmiPortions` decides that boundary, so it is ported verbatim.
// ─────────────────────────────────────────────────────────────────────────────

export function computeEmi(principal: number, annualRate: number, tenureMonths: number): number {
  if (!principal || !tenureMonths) return 0;
  if (!annualRate) return principal / tenureMonths;
  const r = annualRate / 100 / 12;
  const x = Math.pow(1 + r, tenureMonths);
  return (principal * r * x) / (x - 1);
}

export function splitEmiPortions(
  currentBalance: number, annualRate: number, payment: number,
): { interest: number; principal: number } {
  const r = annualRate / 100 / 12;
  const interest = currentBalance * r;
  const principal = Math.max(0, payment - interest);
  return { interest, principal };
}

// ─────────────────────────────────────────────────────────────────────────────
// SPLITS — outstanding balances owed to / by the household
// ─────────────────────────────────────────────────────────────────────────────

type SplitDetailParticipant = { name: string; share: number; paid: boolean; isYou?: boolean; email?: string };

export interface SplitOutstanding {
  owedToYou: number;
  youOwe: number;
  owedDetails: Array<{ txn: Transaction; participant: SplitDetailParticipant }>;
  youOweDetails: Array<{ txn: Transaction; participant: SplitDetailParticipant }>;
}

/** Income splits invert polarity: when YOU received the total (`paidBy === 'me'`)
 *  each other participant holds a share you owe them; when someone else received
 *  it and hasn't forwarded yours, they owe you. Expense splits keep their
 *  original meaning. */
export function splitsOutstanding(
  transactions: Transaction[], baseCurrency: string, rates: ExchangeRates,
): SplitOutstanding {
  let owedToYouD = dineroZero(baseCurrency);
  let youOweD = dineroZero(baseCurrency);
  const owedDetails: SplitOutstanding['owedDetails'] = [];
  const youOweDetails: SplitOutstanding['youOweDetails'] = [];
  transactions.forEach(t => {
    if (!t.split?.isSplit) return;
    const cur = t.currency || baseCurrency;
    const isIncome = t.type === 'income';
    (t.split.participants || []).forEach(p => {
      if (p.paid) return;
      const shareInBase = convertViaUsdRates(toDinero(p.share, cur), baseCurrency, rates);
      if (!isIncome && t.split!.paidBy === 'me' && !p.isYou) {
        owedToYouD = addDinero(owedToYouD, shareInBase);
        owedDetails.push({ txn: t, participant: p });
      } else if (!isIncome && t.split!.paidBy === 'external' && p.isYou) {
        youOweD = addDinero(youOweD, shareInBase);
        youOweDetails.push({ txn: t, participant: p });
      } else if (isIncome && t.split!.paidBy === 'me' && !p.isYou) {
        youOweD = addDinero(youOweD, shareInBase);
        youOweDetails.push({ txn: t, participant: p });
      } else if (isIncome && t.split!.paidBy === 'external' && p.isYou) {
        owedToYouD = addDinero(owedToYouD, shareInBase);
        owedDetails.push({ txn: t, participant: p });
      }
    });
  });
  return {
    owedToYou: fromDinero(owedToYouD),
    youOwe: fromDinero(youOweD),
    owedDetails,
    youOweDetails,
  };
}
