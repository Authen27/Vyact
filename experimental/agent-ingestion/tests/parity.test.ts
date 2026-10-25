// The parked pipeline's own copies of the app's sets (v10.136.0, Track Q8; audit XC-ARC-07). They ran in
// categoryModel.test.ts and whatsappParser.test.ts while the pipeline lived in supabase/functions; parked, they run
// here, so a revived pipeline starts from a checked allowlist. Reviving it puts them back (README.md).
import { describe, expect, it } from 'vitest';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../../../react/src/constants';
import { PAYMENT_MODE_LABEL } from '../../../react/src/lib/accountsView';
import { EXPENSE_IDS, INCOME_IDS, PAYMENT_MODE_IDS } from '../src/types';

describe('the parked agent accepts exactly what the app offers', () => {
  it('CON-UNIT-162 · the agent accepts exactly what the app offers', () => {
    expect([...EXPENSE_IDS].sort()).toEqual(EXPENSE_CATEGORIES.map(c => c.id as string).sort());
  });

  it('W7a-CON05-002 · the agent accepts exactly the income categories the app offers', () => {
    expect([...INCOME_IDS].sort()).toEqual(INCOME_CATEGORIES.map(c => c.id as string).sort());
  });

  it('the agent accepts exactly the modes the app offers', () => {
    expect([...PAYMENT_MODE_IDS].sort()).toEqual(Object.keys(PAYMENT_MODE_LABEL).sort());
  });
});
