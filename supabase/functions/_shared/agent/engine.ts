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
}

export interface WhatsAppAnswer { text: string; chipPrompts: string[] }

export const contextFromRows = generated.contextFromRows as (rows: HouseholdRows) => EngineContext;
export const answerOnServer = generated.answerOnServer as (
  utterance: string, ctx: EngineContext, call: ServerModelCall, prevAllowed?: readonly string[],
) => Promise<EngineTurn>;
export const renderForWhatsApp = generated.renderForWhatsApp as (turn: EngineTurn, appUrl: string) => WhatsAppAnswer;
