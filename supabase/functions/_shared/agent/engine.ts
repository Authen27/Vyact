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
  household: { type?: string | null; base_currency?: string | null; language?: string | null; payoff_strategy?: string | null; extra_payment?: number | string | null };
  email: string;
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

export const contextFromRows = generated.contextFromRows as (rows: HouseholdRows) => EngineContext;
export const answerOnServer = generated.answerOnServer as (
  utterance: string, ctx: EngineContext, call: ServerModelCall, prevAllowed?: readonly string[],
) => Promise<EngineTurn>;
export const renderForWhatsApp = generated.renderForWhatsApp as (turn: EngineTurn, appUrl: string) => WhatsAppAnswer;

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

// ── Runway (W6b, v10.47.0) ───────────────────────────────────────────────────
export interface RunwaySnapshot { months: number | null; quieterCategory: string | null }
export const runwaySnapshot = generated.runwaySnapshot as (rows: HouseholdRows, now: Date) => RunwaySnapshot;

/** What resolve() decided for a turn (v10.47.0): the affordability card reads its amounts. */
export interface EngineResolved { outcome: string; amounts?: Record<string, number> }
