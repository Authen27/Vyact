// BE-PIP-04, as far as it was fixed (W8b, v10.83.0): only a TRUSTED learned recipe may write. Moved here from
// w8bEdgeFixes.test.ts with the pipeline (v10.136.0, Track Q8). The rest of BE-PIP-04 (per-household confirmation;
// one user can promote a global recipe) is the first thing to build on revival (README.md).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runIngestion } from '../src/pipeline';
import type { ExtractionResult } from '../src/types';

const src = (p: string) => readFileSync(resolve(__dirname, '../src', p), 'utf8');

describe('learned recipes (BE-PIP-04)', () => {
  it('W8b-PIP04-001 · only a TRUSTED learned recipe may write; an untrusted one is drafted (BE-PIP-04)', async () => {
    const recipe = (trusted: boolean | undefined): ExtractionResult => ({
      ok: true, extractor: 'recipe', confidence: 0.95, ...(trusted === undefined ? {} : { trusted }),
      candidate: { amount: 850, currency: 'INR', direction: 'debit', transaction_type: 'expense', accountMask: '4471', category_id: 'groceries', account_alias: 'hdfc' },
    });
    const input = {
      text: 'Rs.850.00 debited from A/c XX4471 to VPA swiggy@ybl', source: 'sms', householdId: 'h1', userId: 'u1', now: new Date('2026-10-08T10:00:00Z'),
      ctx: { households: [{ id: 'h1', name: 'Home' }], accounts: [{ id: 'acc', name: 'HDFC 4471', kind: 'bank', householdId: 'h1' }] },
    } as never;
    const untrusted = await runIngestion(input, { applyRecipe: () => recipe(false) });
    const unknown = await runIngestion(input, { applyRecipe: () => recipe(undefined) });
    expect(untrusted.action.kind).not.toBe('write');
    expect(unknown.action.kind).not.toBe('write');
    expect((await runIngestion(input, { applyRecipe: () => recipe(true) })).action.kind).toBe('write');
    expect(src('pipeline.ts')).toMatch(/&& \(extraction\.extractor !== 'recipe' \|\| extraction\.trusted === true\)/);
    expect(src('recipeStore.ts')).toMatch(/\? \{ \.\.\.result, trusted: true \}/);
  });
});
