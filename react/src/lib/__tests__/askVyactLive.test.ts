// Ask Vyact — LIVE model smoke test (architecture P3).
//
// The first REAL question: a real model, the real classify → resolve → phrase
// chain, and the real anti-hallucination guard. Everything else in the suite
// uses a fake model; this is the one that proves the wiring against an actual
// provider.
//
// SKIPPED BY DEFAULT. It runs only when OPENROUTER_API_KEY is present in the
// environment, so CI, other developers and the normal `vitest run` are never
// slowed down and never spend a cent. It reads the key from process.env and
// never logs it.
//
//   HOW TO RUN (PowerShell):
//     $env:OPENROUTER_API_KEY = "sk-or-..."
//     node ./node_modules/vitest/vitest.mjs run src/lib/__tests__/askVyactLive.test.ts
//
// COST: two questions × two model calls ≈ 1,700 in / 340 out tokens.
// On claude-sonnet-5 that is roughly USD 0.007 for the whole run.
import { describe, it, expect } from 'vitest';
import { LlmBackend, runAssistant, type AssistantContext } from '../askVyactBackend';
import type { ModelCall } from '../askVyactLlm';
import { buildSafeSummary } from '../aiSummary';
import type { Transaction, Budget, Goal, Debt, Asset, Profile } from '../../types';

const KEY = process.env.OPENROUTER_API_KEY ?? '';
const MODEL = process.env.VYACT_LIVE_MODEL ?? 'anthropic/claude-sonnet-5';

/**
 * A real OpenRouter call. Deliberately mirrors what the deployed `ask-vyact`
 * gateway sends. This does not validate deployed gateway authentication,
 * quota, consent, configuration or metering.
 */
const liveModel: ModelCall = async ({ system, user, json, maxTokens }) => {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens ?? 600,
      temperature: 0.2,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('empty model reply');
  return text;
};

function makeCtx(): AssistantContext {
  const profile = { baseCurrency: 'GBP', household: 'individual', language: 'en' } as unknown as Profile;
  const rates = { GBP: 1 };
  const transactions = [
    { id: 't1', type: 'expense', amount: 420, currency: 'GBP',
      date: new Date().toISOString().slice(0, 10), description: '', category: 'food_dining' },
  ] as Transaction[];
  const budgets = [{ id: 'b1', category: 'food_dining', limit: 300, currency: 'GBP' }] as Budget[];
  const goals: Goal[] = [];
  const debts: Debt[] = [];
  const assets = [{ id: 'a1', type: 'cash', name: 'Cash', value: 8000,
    currency: 'GBP', liquidity: 'liquid' }] as Asset[];
  const summary = buildSafeSummary(transactions, budgets, goals, debts, assets, profile, rates);
  return { summary, transactions, budgets, goals, debts, assets, profile, rates, baseCurrency: 'GBP' };
}

describe.skipIf(!KEY)(`Ask Vyact live · ${MODEL}`, () => {
  it('answers a spending question with the COMPUTED figure, not an invented one', async () => {
    const backend = new LlmBackend(liveModel);
    const turn = await runAssistant('how much did I spend on dining this month?', makeCtx(), backend, 0);


    console.log(`\n  Q: how much did I spend on dining this month?\n  A: ${turn.reply}\n  intent: ${turn.intentId}\n`);

    // The model must NOT have fallen through to an unavailable/fallback turn.
    expect(turn.intentId).not.toBe('unavailable');
    expect(turn.intentId).toBe('interpret.lookup');

    // 420 is what resolve() computed from the fixture. If the reply carries a
    // figure, it has already survived assertNoInventedFigures — an invented one
    // would have produced an 'unavailable' turn instead.
    expect(turn.reply).toContain('420');
    expect(turn.reply.length).toBeGreaterThan(10);
  }, 60_000);

  it('routes a capture utterance to a seeded draft, not a lecture', async () => {
    const backend = new LlmBackend(liveModel);
    const turn = await runAssistant('spent 45 on fuel', makeCtx(), backend, 0);


    console.log(`\n  Q: spent 45 on fuel\n  A: ${turn.reply}\n  intent: ${turn.intentId}  seed: ${JSON.stringify(turn.seed)}\n`);

    expect(turn.intentId).toBe('capture.expense');
    // Stage 4 still builds the seed — the model only chose the intent.
    expect(turn.seed?.type).toBe('expense');
    expect(turn.seed?.amount).toBe(45);
  }, 60_000);
});
