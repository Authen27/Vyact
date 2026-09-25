// Ask Vyact — the SAME engine, run on the server (W4, v10.45.0).
//
// WhatsApp has no browser, and money must be computed server-side. Rather than a
// second, hand-ported implementation of every money rule (which drifts — the v10.37
// bug class), the server runs THIS code: `scripts/build-agent-engine.mjs` bundles
// this module and everything it imports into
// `supabase/functions/_shared/agent/engine.generated.js`, and the gate fails if that
// file is stale. One implementation; parity by construction.
//
// This module must stay PURE: no store, no browser APIs, no Supabase client. It is
// handed plain database rows and a model call, and returns a turn.
//
// What it does, in the order the app does it (pages/Chat.tsx):
//   1. rows → app shapes with the adapter's own mappers (`mapCloudRow`,
//      `profileFromRows`) — so a server figure is computed from exactly the objects
//      the app would hold;
//   2. `buildSafeSummary` over them — the one egress shape;
//   3. `runAssistant` with the injected model call — classify → resolve → phrase,
//      with `assertNoInventedFigures` guarding the reply;
//   4. render for WhatsApp: plain text, chips as a numbered list.

import type {
  Transaction, Budget, BudgetAllocation, Goal, Debt, Asset, Account, RecurringSchedule, ExchangeRates,
} from '../types';
import { DEFAULT_RATES } from '../constants';
import { mapCloudRow, profileFromRows, type ProfileRowCols, type HouseholdRowCols } from './supabaseAdapter';
import { buildSafeSummary } from './aiSummary';
import { runAssistant, LlmBackend, type AssistantContext, type AssistantTurn } from './askVyactBackend';
import type { ModelCall } from './askVyactLlm';

/** Everything the engine needs about one household, as rows straight from Postgres. */
export interface HouseholdRows {
  transactions: unknown[];
  budgets: unknown[];
  budgetAllocations: unknown[];
  goals: unknown[];
  debts: unknown[];
  assets: unknown[];
  accounts: unknown[];
  recurring: unknown[];
  memberCount: number;
  rates: { currency_code: string; rate_to_usd: number | string }[];
  profile: ProfileRowCols;
  household: HouseholdRowCols;
  email: string;
}

/** The AssistantContext Chat.tsx would build for this household. */
export function contextFromRows(rows: HouseholdRows): AssistantContext {
  const map = <T>(entity: Parameters<typeof mapCloudRow>[0], list: unknown[]): T[] =>
    list.map((r) => mapCloudRow(entity, r) as T);
  const transactions = map<Transaction>('transactions', rows.transactions);
  const budgets = map<Budget>('budgets', rows.budgets);
  const budgetAllocations = map<BudgetAllocation>('budgetAllocations', rows.budgetAllocations);
  const goals = map<Goal>('goals', rows.goals);
  const debts = map<Debt>('debts', rows.debts);
  const assets = map<Asset>('assets', rows.assets);
  const accounts = map<Account>('accounts', rows.accounts);
  const recurring = map<RecurringSchedule>('recurring', rows.recurring);
  const profile = profileFromRows(rows.profile, rows.household, rows.email);
  // The store's rule: the household's saved rates when it has any, else the defaults.
  const saved: ExchangeRates = Object.fromEntries(rows.rates.map((r) => [r.currency_code, Number(r.rate_to_usd)]));
  const rates: ExchangeRates = Object.keys(saved).length ? saved : { ...DEFAULT_RATES };

  const summary = buildSafeSummary(transactions, budgets, goals, debts, assets, profile, rates, accounts, budgetAllocations);
  summary.household.members = rows.memberCount;
  return {
    summary, transactions, budgets, goals, debts, assets, recurring,
    profile, rates, baseCurrency: profile.baseCurrency,
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
  };
}

/** One question, answered by the app's own pipeline with the given model call. */
export function answerOnServer(
  utterance: string, ctx: AssistantContext, call: ModelCall, prevAllowed: readonly string[] = [],
): Promise<AssistantTurn> {
  return runAssistant(utterance, ctx, new LlmBackend(call), Date.now(), undefined, prevAllowed);
}

export interface WhatsAppAnswer {
  text: string;
  /** What each numbered reply sends as the next question. */
  chipPrompts: string[];
}

/** WhatsApp's hard limit on a text message. */
export const WHATSAPP_MAX_CHARS = 4096;

/**
 * A turn as a WhatsApp message: no markdown (WhatsApp would show the asterisks), and
 * chips as a numbered list the person answers with "1", "2" or "3".
 */
export function renderForWhatsApp(turn: AssistantTurn, appUrl: string): WhatsAppAnswer {
  // In the app these open a pre-filled form; WhatsApp has none. Say what works here.
  if (turn.recurringSeed) {
    return { text: `Recurring bills are set up in the app, so you can check the schedule before it starts: ${appUrl}/recurring`, chipPrompts: [] };
  }
  if (turn.seed) {
    return { text: 'To record it here, send it as one line, like 450 lunch hdfc.', chipPrompts: [] };
  }
  const plain = turn.reply
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .trim();
  const chips = (turn.chips ?? []).slice(0, 3);
  const menu = chips.length
    ? `\n\n${chips.map((c, i) => `${i + 1}. ${c.label}`).join('\n')}\n\nReply with a number, or ask anything.`
    : '';
  const room = WHATSAPP_MAX_CHARS - menu.length;
  const body = plain.length > room ? `${plain.slice(0, room - 1).trimEnd()}…` : plain;
  return { text: `${body}${menu}`, chipPrompts: chips.map((c) => c.prompt) };
}
