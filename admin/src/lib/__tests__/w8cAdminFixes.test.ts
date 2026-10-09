// W8c (admin v1.4.4) — admin fixes from the 2026-10-04 audit. Each case is named after its finding.
// Vitest runs in node: behaviour is pinned through the pure helpers and, where a page must use them,
// through its source.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOUSEHOLD_TYPES, normalizeHouseholdType } from '../householdTypes';
import * as consumer from '../../../../react/src/lib/householdTypes';

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('W8c · admin fixes', () => {
  it('W8c-CON06-001 · the admin household types are today\'s four, normalised like the consumer app (INT-CON-06, INT-HH-14)', () => {
    expect([...HOUSEHOLD_TYPES]).toEqual(consumer.HOUSEHOLD_TYPE_ORDER);
    for (const t of ['personal', 'couple', 'family', 'business', 'shared', 'multi_biz', 'weird', null]) {
      expect(normalizeHouseholdType(t), String(t)).toBe(consumer.normalizeHouseholdType(t));
    }
    const page = src('pages/Households.tsx');
    expect(page).toMatch(/couple:\s+'bg-info\/15 text-info'/);
    expect(page).not.toMatch(/multi_biz:|shared:\s+'/);
    expect(page).toMatch(/<Metric label="Couple"/);
    expect(src('lib/adminApi.ts')).toMatch(/type: normalizeHouseholdType\(\(h as \{ type\?: unknown \}\)\.type\),/);
  });
});
