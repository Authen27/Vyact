// Vyact — Ask Vyact assistant backend (engineering spec §3, §4, §5, §6).
//
// Orchestrates the five-stage deterministic pipeline:
//   [1] normalise → [2] entityExtract → [3] classifyIntent → [4] resolve → [5] phraseResponse
//
// The two SEAMS a future LlmBackend swaps in are stages 3 and 5, expressed as the
// `AssistantBackend` interface. Stages 1, 2, 4 are pure functions over Vyact data
// and are model-agnostic — they are NEVER delegated to a model. In particular
// stage 4 (`resolve`) is the only place money is computed, and it does so purely
// by calling the SAME services that power the dashboard. The assistant phrases;
// services compute.

import type {
  Transaction, Budget, Goal, Debt, Asset, Profile, ExchangeRates, SplitInfo, TxnType, RecurringSchedule,
} from '../types';
import {
  spendByCategory, monthlyData, liquidAssets, totalMonthlyDebtPayment,
} from './calculations';
import { getCat, NEEDS_WANTS_MAP } from '../constants';
import { fmt } from './format';
import { nowMonthKey, getMonthKey } from './format';
import type { SafeSummary } from './aiSummary';
import type { IntentResult, AssistantBucket } from './askVyactIntents';
import { normaliseChips, type AssistantChip, type ResolveResult } from './askVyactResponses';
import {
  classifyIntentViaModel, phraseViaModel,
  InventedFigureError, ModelUnavailableError, type ModelCall,
} from './askVyactLlm';
import { resolveConfiguredModelCall } from './askVyactModelCall';
import { isAskVyactBucketEnabled, FEATURES } from '../config/features';

// ── Context passed through the pipeline (the same data the dashboard reads) ─────
export interface AssistantContext {
  summary: SafeSummary;
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
  assets: Asset[];
  profile: Profile;
  rates: ExchangeRates;
  baseCurrency: string;
  /** Recurring schedules — for "upcoming bills". Optional; defaults to none. */
  recurring?: RecurringSchedule[];
}

// ── The two-method seam (rules now, LLM later) ─────────────────────────────────
// Both methods are ASYNC. The rules implementation resolves immediately (no I/O),
// but the signature must be Promise-shaped so a network-backed LlmBackend can be
// dropped in without touching a single call site. Stages 1/2/4 stay synchronous
// and pure — only the seam awaits.
export interface AssistantBackend {
  id: 'rules' | 'llm';
  classifyIntent(utterance: string, ctx: AssistantContext): Promise<IntentResult>;   // stage 3
  /**
   * `seed` selects the phrasing variant deterministically, so the same question
   * always reads the same way. It is part of the CONTRACT, not an implementation
   * detail of the rules backend: it used to be smuggled through a
   * `backend as RulesBackend` cast at the call site, which meant any backend not
   * declaring a 4th parameter silently dropped it and fell back to `Date.now()`
   * — making replies non-reproducible on that path, with no test to catch it.
   */
  phraseResponse(
    intent: IntentResult,
    result: ResolveResult,
    ctx: AssistantContext,
    seed?: number,
  ): Promise<string>; // stage 5
}

export interface AssistantTurn {
  reply: string;
  bucket: AssistantBucket | 'none';
  intentId: string;
  /** Capture only — seed for the existing TransactionFormModal (openAddTxn). */
  seed?: Partial<Transaction>;
  /**
   * Up to three one-tap follow-ups (#62). Already normalised and capped by
   * `runAssistant` — a renderer may show these verbatim without re-checking.
   * `undefined` means this turn offers none, which is normal.
   */
  chips?: AssistantChip[];
  /** True when the turn is a clarifying chip / fallback rather than an answer. */
  clarify: boolean;
}

// ── helpers ─────────────────────────────────────────────────────────────────
const cur = (ctx: AssistantContext) => ctx.baseCurrency;
const money = (n: number, ctx: AssistantContext) => fmt(Math.round(n), cur(ctx));

/** Rolling monthly average expense for a category over the last `n` months
 *  (excluding the current month). Pure composition of `spendByCategory`. */
function categoryRollingAvg(ctx: AssistantContext, category: string, n = 3): number {
  const months = [...new Set(ctx.transactions.map(t => getMonthKey(t.date)))]
    .sort().filter(m => m !== nowMonthKey()).slice(-n);
  if (!months.length) return 0;
  const sum = months.reduce((s, mk) => s + (spendByCategory(ctx.transactions, mk, cur(ctx), ctx.rates)[category] || 0), 0);
  return sum / months.length;
}

/** Average monthly expense (burn) over recent months — for runway/affordability. */
function monthlyBurn(ctx: AssistantContext): number {
  const t = ctx.summary.trend6m;
  if (t.length) return t.reduce((s, m) => s + m.expense, 0) / t.length;
  return ctx.summary.thisMonth.expense;
}

/** Emergency-fund floor: 3× monthly burn (goals are no longer a module). */
function emergencyFloor(ctx: AssistantContext): number {
  return monthlyBurn(ctx) * 3;
}

/** Does this category lean on onboarding estimates? (provenance, spec §5). */
function categoryUsesEstimate(ctx: AssistantContext, category: string): boolean {
  const b = ctx.budgets.find(x => x.category === category);
  if (b && b.confidence && b.confidence !== 'confirmed') return true;
  return ctx.transactions.some(t => t.category === category && t.confidence && t.confidence !== 'confirmed');
}

// ── Stage 4 — resolve (the ONLY place money is computed) ────────────────────────
export function resolve(intent: IntentResult, ctx: AssistantContext): ResolveResult {
  const e = intent.entities;

  switch (intent.id) {
    // ── Capture ───────────────────────────────────────────────────────────────
    case 'capture.expense':
    case 'capture.income':
    case 'capture.transfer':
    case 'capture.investment': {
      if (e.amount == null) {
        // No chips. The deck answers this case with three amounts drawn from
        // this user's own spend history ("₹200 · ₹500 · ₹1,000") — that needs
        // #70. The old `{ label: 'Add details' }` placeholder asked nothing, so
        // it could only ever have been a dead end had it reached a screen.
        return { kind: 'capture', outcome: 'missing_amount', vars: {} };
      }
      const type: TxnType = intent.id === 'capture.income' ? 'income'
        : intent.id === 'capture.transfer' ? 'transfer'
        : intent.id === 'capture.investment' ? 'investment' : 'expense';
      // v9 §3 — transfer-class rows carry no category ('' → null at the adapter).
      const transferClass = type === 'transfer' || type === 'investment';
      const category = transferClass ? ''
        : (e.category ?? (type === 'income' ? 'salary' : 'other_expense'));
      const seed: Partial<Transaction> = {
        type, amount: e.amount, category,
        description: e.merchant ? e.merchant.charAt(0).toUpperCase() + e.merchant.slice(1) : '',
      };
      return {
        kind: 'capture', outcome: 'seeded', seed,
        vars: {
          amount: money(e.amount, ctx),
          category: transferClass
            ? (type === 'investment' ? 'investment' : 'transfer')
            : getCat(category).label.toLowerCase(),
        },
      };
    }
    case 'capture.split': {
      if (e.amount == null) {
        // No chips. The deck answers this case with three amounts drawn from
        // this user's own spend history ("₹200 · ₹500 · ₹1,000") — that needs
        // #70. The old `{ label: 'Add details' }` placeholder asked nothing, so
        // it could only ever have been a dead end had it reached a screen.
        return { kind: 'capture', outcome: 'missing_amount', vars: {} };
      }
      const ways = e.participantCount ?? 2;
      const share = Math.round((e.amount / ways) * 100) / 100;
      const split: SplitInfo = {
        isSplit: true, totalAmount: e.amount, yourShare: share, paidBy: 'me',
        participants: Array.from({ length: ways }, (_, i) => ({
          name: i === 0 ? 'me' : `Person ${i + 1}`, isYou: i === 0, share, paid: i === 0,
        })),
      };
      const seed: Partial<Transaction> = {
        type: 'expense', amount: e.amount, category: e.category ?? 'food_dining',
        description: e.merchant ? e.merchant.charAt(0).toUpperCase() + e.merchant.slice(1) : 'Split',
        split,
      };
      return {
        kind: 'capture', outcome: 'seeded', seed,
        vars: { amount: money(e.amount, ctx), ways, share: money(share, ctx) },
      };
    }

    // ── Interpret ───────────────────────────────────────────────────────────────
    case 'interpret.lookup': {
      const mk = nowMonthKey();
      const spend = spendByCategory(ctx.transactions, mk, cur(ctx), ctx.rates);
      const category = e.category
        ?? Object.entries(spend).sort(([, a], [, b]) => b - a)[0]?.[0];
      if (!category) return fallback();
      const amount = spend[category] || 0;
      const budget = ctx.budgets.find(b => b.category === category);
      const usesEstimate = categoryUsesEstimate(ctx, category);
      // The deck's canonical example of the rule: after a figure, the next
      // question is "why", never "open reports".
      const lookupChips: AssistantChip[] = [
        { label: 'Why is it up?', prompt: `why is my ${getCat(category).label.toLowerCase()} spending so high` },
        { label: 'Where else is it going?', prompt: 'where is my money going' },
      ];
      if (budget && budget.limit > 0) {
        return {
          kind: 'interpret', outcome: 'vs_budget', usesEstimate, chips: lookupChips,
          vars: {
            amount: money(amount, ctx), category: getCat(category).label.toLowerCase(),
            pct: `${Math.round((amount / budget.limit) * 100)}%`, budget: money(budget.limit, ctx),
          },
        };
      }
      return {
        kind: 'interpret', outcome: 'ok', usesEstimate, chips: lookupChips,
        vars: { amount: money(amount, ctx), category: getCat(category).label.toLowerCase() },
      };
    }
    case 'interpret.status': {
      const s = ctx.summary;
      if (/net ?worth|wealth/.test(e.text)) {
        return { kind: 'interpret', outcome: 'ok', vars: {
          headline: `Your net worth is ${money(s.netWorth.netWorth, ctx)}.`,
          detail: `That's ${money(s.netWorth.totalAssets, ctx)} in assets minus ${money(s.netWorth.totalLiabilities, ctx)} of debt, with about ${s.netWorth.liquidityMonths.toFixed(1)} months of liquid cover.`,
        } };
      }
      if (/balance/.test(e.text)) {
        return { kind: 'interpret', outcome: 'ok', vars: {
          headline: `You've got about ${money(s.netWorth.totalAssets, ctx)} across your accounts.`,
          detail: `Roughly ${s.netWorth.liquidityMonths.toFixed(1)} months of expenses in liquid savings.`,
        } };
      }
      const total = s.pulseScore.total ?? 0;
      return { kind: 'interpret', outcome: 'ok', vars: {
        headline: `Your Pulse Score is ${total}/100.`,
        detail: total >= 80 ? 'Strong — keep doing what you are doing.'
          : total >= 65 ? 'Solid, with a little room to push.'
          : 'There is room to improve — the Planner has prioritised steps.',
      } };
    }
    case 'interpret.diagnostic': {
      const mk = nowMonthKey();
      const spend = spendByCategory(ctx.transactions, mk, cur(ctx), ctx.rates);
      // Biggest category vs its rolling average — the deterministic "why".
      let worst: { cat: string; now: number; avg: number; delta: number } | null = null;
      for (const [c, amt] of Object.entries(spend)) {
        const avg = categoryRollingAvg(ctx, c);
        const delta = amt - avg;
        if (avg > 0 && delta > 0 && (!worst || delta > worst.delta)) worst = { cat: c, now: amt, avg, delta };
      }
      if (worst && worst.delta / Math.max(worst.avg, 1) >= 0.2) {
        const pct = Math.round((worst.delta / worst.avg) * 100);
        // The chips deliberately exclude "Why so high?" — this reply has just
        // said why, and the deck bans a chip that repeats the answer.
        return { kind: 'interpret', outcome: 'found', usesEstimate: categoryUsesEstimate(ctx, worst.cat), vars: {
          headline: `${getCat(worst.cat).label} is ${pct}% above your usual.`,
          detail: `It's at ${money(worst.now, ctx)} this month vs about ${money(worst.avg, ctx)} normally — that's the main pull on your cash.`,
        }, chips: [
          { label: `See ${getCat(worst.cat).label}`, prompt: `how much on ${worst.cat} this month` },
          { label: 'Where can I cut back?', prompt: 'where can I cut back' },
        ] };
      }
      return { kind: 'interpret', outcome: 'clear', vars: {
        detail: `your spending is tracking close to your normal pattern this month.`,
      }, chips: [
        { label: 'What did I spend most on?', prompt: 'what did I spend the most on this month' },
      ] };
    }
    case 'interpret.budgets': {
      const over = ctx.summary.budgets.filter(b => b.spentPct > 100);
      const near = ctx.summary.budgets.filter(b => b.spentPct > 80 && b.spentPct <= 100);
      const detail = over.length
        ? `${over.length} over: ${over.map(b => getCat(b.category).label).join(', ')}.`
        : near.length
          ? `${near.length} close to the limit: ${near.map(b => getCat(b.category).label).join(', ')}.`
          : ctx.summary.budgets.length ? `all ${ctx.summary.budgets.length} budgets are on track.` : `you have no budgets yet.`;
      // Chips only when there is something to chase — "Budgets look healthy"
      // needs no follow-up, and an offer of one implies a problem there isn't.
      const worstBudget = over[0] ?? near[0];
      return { kind: 'interpret', outcome: 'ok', vars: {
        headline: over.length ? 'Some budgets need attention.' : near.length ? 'A couple of budgets are getting close.' : 'Budgets look healthy.',
        detail,
      }, chips: worstBudget ? [
        { label: `Why is ${getCat(worstBudget.category).label} over?`, prompt: `why is my ${getCat(worstBudget.category).label.toLowerCase()} spending so high` },
        { label: 'Where can I cut back?', prompt: 'where can I cut back' },
      ] : undefined };
    }
    case 'interpret.debts': {
      const d = ctx.summary.debts;
      if (!d.length) return { kind: 'interpret', outcome: 'ok', vars: { headline: "You're debt-free.", detail: 'Nothing to pay down right now.' } };
      const totalDebt = d.reduce((s, x) => s + x.balance, 0);
      const top = [...d].sort((a, b) => b.aprPct - a.aprPct)[0];
      return { kind: 'interpret', outcome: 'ok', vars: {
        headline: `You owe ${money(totalDebt, ctx)} across ${d.length} debt${d.length === 1 ? '' : 's'}.`,
        detail: `Highest rate: ${getCat(top.type).label || top.type} at ${top.aprPct}% — the avalanche method targets it first.`,
      } };
    }
    case 'interpret.bills': {
      const today = new Date();
      const soon = (ctx.recurring ?? [])
        .map(r => ({ r, due: new Date(r.nextDueDate) }))
        .filter(x => x.due >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
        .sort((a, b) => a.due.getTime() - b.due.getTime())
        .slice(0, 3);
      if (!soon.length) return { kind: 'interpret', outcome: 'ok', vars: { headline: 'No upcoming bills tracked.', detail: 'Add a recurring schedule to see what is due.' } };
      const detail = soon.map(x => `${x.r.transactionTemplate.description || getCat(x.r.transactionTemplate.category).label} (${x.r.nextDueDate})`).join(', ');
      return { kind: 'interpret', outcome: 'ok', vars: { headline: `Next up: ${soon.length} bill${soon.length === 1 ? '' : 's'}.`, detail } };
    }

    // ── Forecast (Planner-grounded) ──────────────────────────────────────────────
    case 'forecast.affordability': {
      // No chip: the reply itself asks "how much?", and a chip that repeats the
      // answer is exactly what the deck's rule forbids.
      if (e.amount == null) return { kind: 'forecast', outcome: 'missing_amount', vars: {} };
      const liquid = liquidAssets(ctx.assets, cur(ctx), ctx.rates);
      const floor = emergencyFloor(ctx);
      const headroom = liquid - floor;
      if (headroom >= e.amount) {
        return { kind: 'forecast', outcome: 'fits', vars: {
          amount: money(e.amount, ctx), headroom: money(headroom, ctx),
          cushion: money(headroom - e.amount, ctx),
        }, chips: [
          { label: 'How long would my savings last?', prompt: 'how long would my savings last' },
        ] };
      }
      // The deck's chip here is "When is it comfortable?" — deliberately NOT
      // shipped: answering it needs payday as a modelled date (#68), and today
      // `payday` is only a trigger keyword. The old chip carried no prompt, so
      // it would have been untappable even had it reached a screen. These two
      // are answerable now.
      return { kind: 'forecast', outcome: 'tight', vars: {
        amount: money(e.amount, ctx), shortfall: money(e.amount - headroom, ctx),
      }, chips: [
        { label: 'Where can I cut back?', prompt: 'where can I cut back' },
        { label: 'How long would my savings last?', prompt: 'how long would my savings last' },
      ] };
    }
    case 'forecast.runway': {
      const liquid = liquidAssets(ctx.assets, cur(ctx), ctx.rates);
      const burn = monthlyBurn(ctx) || (totalMonthlyDebtPayment(ctx.debts, cur(ctx), ctx.rates) + 1);
      const months = burn > 0 ? liquid / burn : 0;
      return { kind: 'forecast', outcome: 'ok', vars: { months: months.toFixed(1) }, chips: [
        { label: 'Where can I cut back?', prompt: 'where can I cut back' },
        { label: 'What is driving my spending?', prompt: 'where is my money going' },
      ] };
    }
    case 'forecast.prescriptive': {
      const target = e.amount;
      const mk = nowMonthKey();
      const spend = spendByCategory(ctx.transactions, mk, cur(ctx), ctx.rates);
      // Rank "want" categories by overage vs rolling average — least-painful trims.
      let best: { cat: string; over: number } | null = null;
      for (const [c, amt] of Object.entries(spend)) {
        if (NEEDS_WANTS_MAP[c] !== 'want') continue;
        const over = amt - categoryRollingAvg(ctx, c);
        if (over > 0 && (!best || over > best.over)) best = { cat: c, over };
      }
      if (!best) {
        // fall back to the single biggest discretionary category
        const top = Object.entries(spend).filter(([c]) => NEEDS_WANTS_MAP[c] === 'want')
          .sort(([, a], [, b]) => b - a)[0];
        if (top) best = { cat: top[0], over: top[1] };
      }
      if (!best) return { kind: 'forecast', outcome: 'ok', vars: { months: '0' } };
      return { kind: 'forecast', outcome: 'suggest', vars: {
        target: target ? money(target, ctx) : 'some room',
        category: getCat(best.cat).label.toLowerCase(),
        over: money(best.over, ctx),
      } };
    }

    default:
      return fallback();
  }
}

function fallback(): ResolveResult {
  return { kind: 'fallback', outcome: 'default', vars: {} };
}

// ── LlmBackend — the ONLY assistant backend (v10.20) ────────────────────────────
//
// The deterministic `RulesBackend` was REMOVED in v10.20 by product decision:
// Ask Vyact is model-backed, with no rules fallback for classify/phrase.
//
// What did NOT move: stage 4, `resolve()` above. Every figure the assistant says
// still comes from it. The model decides WHICH question this is and says the
// answer in words — it never computes money. That is the binding rule, and
// `assertNoInventedFigures` enforces it on the way out rather than trusting the
// prompt to have been obeyed.
//
// CONSEQUENCE, stated plainly: with no model configured and reachable, Ask Vyact
// cannot answer. `runAssistant` surfaces that as an explicit unavailable turn —
// it must never silently degrade to a canned reply, because a finance assistant
// that quietly stops thinking while still sounding confident is worse than one
// that says it is unavailable.
export class LlmBackend implements AssistantBackend {
  readonly id = 'llm' as const;
  constructor(private readonly call: ModelCall) {}

  async classifyIntent(utterance: string, ctx: AssistantContext): Promise<IntentResult> {
    return classifyIntentViaModel(utterance, ctx, this.call);
  }

  /** `seed` is accepted for interface conformance; a model does not use a
   *  variant table, so phrasing variety comes from the model itself. */
  async phraseResponse(
    intent: IntentResult, result: ResolveResult, _ctx?: AssistantContext, _seed?: number,
  ): Promise<string> {
    return phraseViaModel(intent, result, this.call);
  }
}

/**
 * The model transport. Resolved per turn (never memoised at module scope) so a
 * DB-driven configuration change takes effect on the next question rather than
 * requiring a page reload.
 *
 * Returns null when no model is configured — the caller must treat that as
 * "unavailable", not as a reason to invent an answer.
 */
export function selectModelCall(): ModelCall | null {
  return resolveConfiguredModelCall();
}

/** The active backend, or null when no model is reachable. */
export function selectAssistantBackend(): AssistantBackend | null {
  const call = selectModelCall();
  return call ? new LlmBackend(call) : null;
}

// ── The orchestrator — runs all five stages ─────────────────────────────────────
// The `backend` default is evaluated PER CALL (not captured at module load), so a
// runtime change to `FEATURES.askVyact.backend` takes effect on the next turn.
export async function runAssistant(
  utterance: string,
  ctx: AssistantContext,
  backend: AssistantBackend | null = selectAssistantBackend(),
  seed = Date.now(),
): Promise<AssistantTurn> {
  // No model configured or reachable. Say so — never fake an answer. There is no
  // rules fallback by design (v10.20), and a finance assistant that invents a
  // reply when it cannot think is worse than one that admits it is offline.
  if (!backend) return unavailableTurn('not_configured');

  let intent: IntentResult;
  try {
    intent = await backend.classifyIntent(utterance, ctx);         // stages 1–3
  } catch (err) {
    if (err instanceof ModelUnavailableError) return unavailableTurn('unreachable');
    throw err;
  }

  // Per-bucket gate: a disabled bucket degrades to a clarifying fallback (§2).
  const gated = intent.bucket !== 'none' && !isAskVyactBucketEnabled(intent.bucket);
  const effective: IntentResult = gated
    ? { ...intent, id: 'fallback', bucket: 'none' }
    : intent;
  const result = gated ? fallback() : resolve(effective, ctx);     // stage 4 (never LLM)

  let reply: string;
  try {
    reply = await backend.phraseResponse(effective, result, ctx, seed);
  } catch (err) {
    if (err instanceof ModelUnavailableError) return unavailableTurn('unreachable');
    // The model put a figure in the reply that no tool computed. Discard the
    // whole reply: showing an invented number in a finance app is the one
    // failure this system exists to prevent.
    if (err instanceof InventedFigureError) return unavailableTurn('unverified_figures');
    throw err;
  }

  return {
    reply,
    bucket: effective.bucket,
    intentId: effective.id,
    seed: result.seed,
    // The ONE place the cap and the well-formedness rule are applied, so every
    // channel gets the same list and no call site can opt out of the limit.
    chips: normaliseChips(result.chips),
    clarify: gated || result.kind === 'fallback' || result.outcome === 'missing_amount',
  };
}

/** Reason codes are distinct so telemetry can tell "never set up" from
 *  "set up but broken" from "the model misbehaved" — three different fixes. */
export type UnavailableReason = 'not_configured' | 'unreachable' | 'unverified_figures';

const UNAVAILABLE_COPY: Record<UnavailableReason, string> = {
  not_configured: "Ask Vyact isn't set up yet — no assistant model is configured.",
  unreachable: "I can't reach the assistant right now. Your data is untouched — please try again shortly.",
  unverified_figures: "I couldn't verify the numbers in that answer, so I haven't shown it. Please ask again.",
};

function unavailableTurn(reason: UnavailableReason): AssistantTurn {
  return {
    reply: UNAVAILABLE_COPY[reason],
    bucket: 'none',
    intentId: 'unavailable',
    clarify: true,
  };
}

// ── Proactive "what to know" (spec §5, gated by proactiveInsight) ───────────────
export interface ProactiveInsight { text: string; chipPrompt?: string; }

/** At most ONE insight, ranked by materiality. Positive observations count too.
 *  Pure read over the summary + entities; caller rate-limits to one per session. */
export function proactiveInsight(ctx: AssistantContext): ProactiveInsight | null {
  if (!FEATURES.askVyact.proactiveInsight || !isAskVyactBucketEnabled('interpret')) return null;
  const s = ctx.summary;

  // 1) A budget meaningfully over — highest materiality.
  const over = s.budgets.filter(b => b.spentPct > 100).sort((a, b) => b.spentPct - a.spentPct)[0];
  if (over) {
    return {
      text: `Your ${getCat(over.category).label.toLowerCase()} is ${Math.round(over.spentPct)}% of budget — want to see why?`,
      chipPrompt: `why is my ${over.category} so high`,
    };
  }
  // 2) A category running hot vs its norm.
  const mk = nowMonthKey();
  const spend = spendByCategory(ctx.transactions, mk, cur(ctx), ctx.rates);
  let hot: { cat: string; pct: number } | null = null;
  for (const [c, amt] of Object.entries(spend)) {
    const avg = categoryRollingAvg(ctx, c);
    if (avg > 0) {
      const pct = Math.round(((amt - avg) / avg) * 100);
      if (pct >= 30 && (!hot || pct > hot.pct)) hot = { cat: c, pct };
    }
  }
  if (hot) {
    return {
      text: `Your ${getCat(hot.cat).label.toLowerCase()} is ${hot.pct}% above your usual — want to see why?`,
      chipPrompt: `where is my money going`,
    };
  }
  // 3) Positive: beating the savings target.
  if (s.thisMonth.netSavingsRate >= 0.2) {
    return { text: `You're on track to save ${Math.round(s.thisMonth.netSavingsRate * 100)}% this month — nicely done.` };
  }
  return null;
}
