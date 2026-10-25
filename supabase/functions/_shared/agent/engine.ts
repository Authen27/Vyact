// Typed door to the generated Ask Vyact engine (W4, v10.45.0).
//
// `engine.generated.js` is the app's own engine (react/src/lib/serverEngine.ts and
// what it imports), bundled by scripts/build-agent-engine.mjs. These types mirror
// serverEngine.ts; the bundle is plain JS so the edge runtime can load it without
// react/src on its path.

import * as generated from './engine.generated.js';
import type { ServerModelCall } from './assistantCore.ts';

export interface HouseholdRows {
  transactions: unknown[]; budgets: unknown[]; budgetAllocations: unknown[]; goals: unknown[];
  debts: unknown[]; assets: unknown[]; accounts: unknown[]; recurring: unknown[];
  memberCount: number;
  rates: { currency_code: string; rate_to_usd: number | string }[];
  profile: { display_name?: string | null; default_currency?: string | null; language?: string | null; date_format?: string | null; education_progress?: unknown };
  household: { type?: string | null; base_currency?: string | null; language?: string | null; payoff_strategy?: string | null; extra_payment?: number | string | null; timezone?: string | null };
  email: string;
  /** Track E, E4 — `category_classifications` rows (the live need/want map). */
  classifications?: { category: string; classification: string }[];
}

/** Opaque here: built and read only by the engine. */
export type EngineContext = { readonly __engineContext: unique symbol };

export interface EngineTurn {
  reply: string;
  intentId: string;
  chips?: { label: string; prompt: string }[];
  allowedFigures?: string[];
  seed?: unknown;
  recurringSeed?: unknown;
  /** v10.47.0 — what resolve() decided (see EngineResolved). */
  resolved?: EngineResolved;
}

export interface WhatsAppAnswer { text: string; chipPrompts: string[] }

export const contextFromRows = generated.contextFromRows as unknown as (rows: HouseholdRows) => EngineContext;   // opaque: deno infers the bundle's own type
export const answerOnServer = generated.answerOnServer as (
  utterance: string, ctx: EngineContext, call: ServerModelCall, prevAllowed?: readonly string[],
) => Promise<EngineTurn>;
export const renderForWhatsApp = generated.renderForWhatsApp as (turn: EngineTurn, appUrl: string) => WhatsAppAnswer;

// ── Pip's prompts, a closed set (W1c, v10.64.0) ──────────────────────────────
export type ModelOp = 'classify' | 'phrase';
export const systemPromptFor = generated.systemPromptFor as (op: ModelOp, offending?: readonly string[]) => string;
export const cleanOffending = generated.cleanOffending as (input: unknown) => string[] | null;

// ── "Reply UPDATE" (W6, v10.47.0) ────────────────────────────────────────────
export interface BalanceToCheck {
  id: string; name: string; kind: string; balance: number; owed?: number; lastChecked: string;
}
export interface ReconcilePlan {
  accountId: string; name: string; kind: string;
  before: number; after: number; delta: number;
  expectedOffset: number; offset: number; log: unknown[]; at: string;
  bridge: { debt_id: string; current_balance: number } | { asset_id: string; value: number } | null;
}
export const STALE_AFTER_DAYS = generated.STALE_AFTER_DAYS as number;
export const balancesToCheck = generated.balancesToCheck as (rows: HouseholdRows, nowMs: number) => BalanceToCheck[];
export const reconcileOnServer = generated.reconcileOnServer as (
  rows: HouseholdRows, accountId: string, stated: number | 'same', at: string,
) => ReconcilePlan | null;

// ── "paid X" (W3e, v10.69.0) — the app's Approve on the server ───────────────
export interface ApprovalPlan { row: Record<string, unknown>; nextDue: string | null; exhausted: boolean }
/** A `recurring_schedules` row → the occurrence row and the next due date, by the app's own engine. */
export const approveOccurrenceOnServer = generated.approveOccurrenceOnServer as (
  scheduleRow: unknown, householdId: string,
) => ApprovalPlan;

// ── Posting due bills (W4a, v10.70.0) ───────────────────────────────────────────
export interface PostingPlan {
  occurrence: string; post: boolean; row: Record<string, unknown> | null;
  nextDue: string | null; lastGenerated: string; exhausted: boolean;
}
/** What the app's engine would do with this schedule on the household's `today`; null = nothing. */
export const recurringPostPlan = generated.recurringPostPlan as (
  scheduleRow: unknown, householdId: string, today: string,
) => PostingPlan | null;

// ── Spending for the WhatsApp scheduler (Track E, v10.96.0; XC-ARC-06) ───────
/** A transaction as the app holds it (the fields the scheduler reads). */
export interface EngineTxn {
  id: string; type: string; amount: number; currency: string; date: string; category: string;
  accountId?: string; recurringScheduleId?: string; created_by?: string; excluded?: boolean;
}
/** `transactions` rows → the app's own Transactions (the adapter's mapper: `emi_split`, splits, privacy). */
export const txnsFromRows = generated.txnsFromRows as (rows: readonly unknown[]) => EngineTxn[];
/** The rows that count as spending: the app's one rule. */
export const spendRows = generated.spendRows as (txns: readonly EngineTxn[]) => EngineTxn[];
export const spendByCategoryInRange = generated.spendByCategoryInRange as (
  txns: readonly EngineTxn[], start: string, end: string, baseCurrency: string, rates: Record<string, number>,
) => Record<string, number>;
/** What a row adds to spending: the household's share for a split, else the amount. */
export const effectiveAmount = generated.effectiveAmount as (t: EngineTxn, baseCurrency: string, rates: Record<string, number>) => number;
/** The entry a spending row belongs to (a loan payment's interest and principal share one key; v10.97.0). */
export const spendEntryKey = generated.spendEntryKey as (t: EngineTxn) => string;
/** How many entries these spending rows are (a loan payment counts once). */
export const countSpendEntries = generated.countSpendEntries as (rows: readonly EngineTxn[]) => number;

// ── WhatsApp's scheduled nudges on the app's own rules (T5c, v10.122.0) ──────────
/** A budget line at or past a threshold today (the app's `budgetThresholdLines`). */
export interface BudgetThresholdLine {
  budgetId: string; category: string; start: string; end: string; period: string;
  limit: number; spent: number; share: number; threshold: 80 | 100;
}
/** Audit XC-ARC-06 — the bell's budget rule over `budgets` / `budget_allocations` / `transactions` rows. */
export const budgetLinesOnServer = generated.budgetLinesOnServer as (
  rows: { budgets: readonly unknown[]; budgetAllocations: readonly unknown[]; transactions: readonly unknown[] },
  baseCurrency: string, today: string,
) => BudgetThresholdLine[];
/** Audit INT-PAR-05 — how many `accounts` rows the app calls stale (`staleAccounts`). */
export const staleAccountCount = generated.staleAccountCount as (accountRows: readonly unknown[], nowMs: number) => number;

// ── Runway (W6b, v10.47.0) ───────────────────────────────────────────────────
export interface RunwaySnapshot { months: number | null; quieterCategory: string | null }
export const runwaySnapshot = generated.runwaySnapshot as (rows: HouseholdRows, now: Date) => RunwaySnapshot;

/** What resolve() decided for a turn (v10.47.0): the affordability card reads its amounts. */
export interface EngineResolved { outcome: string; amounts?: Record<string, number> }

// ── Notifications for web push (v10.48.0) ────────────────────────────────────
/** A `notifications` row as the app writes it (lib/notificationRows.ts). */
export interface NotifInsertRow {
  household_id: string; type: string; priority: 'P1' | 'P2'; title: string; body: string | null;
  status: 'unread' | 'read' | 'dismissed'; created_at: string; due_at: string | null; member_id: string | null;
  amount_ref: number | null; deep_link: string | null; tint: string | null; actions: unknown[] | null;
  context: Record<string, string> | null; dedupe_key: string;
}
export const notificationsOnServer = generated.notificationsOnServer as (
  rows: HouseholdRows, existingKeys: readonly string[], householdId: string,
  /** v10.135.0 (Q7): the household's Pip rows from either source, with their dates (Pip's nudge allowance). */
  pipRows?: readonly { dedupe_key: string; created_at: string }[], nowMs?: number,
) => NotifInsertRow[];
/** v10.126.0 (T4c, BE-FN-12) — the private line a device with "Show details on the lock screen" off gets. */
export const lockScreenTextOnServer = generated.lockScreenTextOnServer as (type: string) => { title: string; body: string };
