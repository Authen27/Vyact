// W8c (admin v1.4.4) — admin fixes from the 2026-10-04 audit. Each case is named after its finding.
// Vitest runs in node: behaviour is pinned through the pure helpers and, where a page must use them,
// through its source.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOUSEHOLD_TYPES, normalizeHouseholdType } from '../householdTypes';
import * as consumer from '../../../../react/src/lib/householdTypes';
import { CONTENT_BYLINE, resolvePublishedAt } from '../contentApi';

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('W8c · admin fixes', () => {
  it('W8c-ADM11-001 · an edit keeps the publish date; the byline is "Vyact", never an email (ADM-11)', () => {
    const now = new Date('2026-10-09T10:00:00Z');
    const first = '2026-07-01T10:00:00.000Z';
    expect(resolvePublishedAt({ status: 'published', prev_published_at: first }, now)).toBe(first);   // was reset to now
    expect(resolvePublishedAt({ status: 'published', prev_published_at: null }, now)).toBe(now.toISOString());  // draft → live
    expect(resolvePublishedAt({ status: 'draft', prev_published_at: first }, now)).toBeNull();
    expect(resolvePublishedAt({ status: 'published', published_at: '2026-01-05T12:00:00.000Z' }, now)).toBe('2026-01-05T12:00:00.000Z');
    expect(CONTENT_BYLINE).toBe('Vyact');
    expect(src('lib/contentApi.ts')).toMatch(/author_name: CONTENT_BYLINE,/);
    const page = src('pages/Content.tsx');
    expect(page).not.toMatch(/user\?\.email/);
    expect(page.match(/prev_published_at: initial\?\.publishedAt \?\? null,/g)).toHaveLength(3);
  });

  it('W8c-ADM10-001 · the old infographic is removed only after the save succeeds, and with its item (ADM-10)', () => {
    const page = src('pages/Content.tsx');
    // No delete before the save any more…
    expect(page).not.toMatch(/await deleteInfographic\(prevInfographic\)\.catch\(\(\) => \{\}\);\s*const input/);
    // …each of the three forms deletes after `await upsertContent(input);`.
    expect(page.match(/await upsertContent\(input\);\s*\/\/ W8c[^\n]*\n[^\n]*\n\s*if \(prevInfographic && prevInfographic !== \(infographicUrl \|\| null\)\) await deleteInfographic\(prevInfographic\);/g)).toHaveLength(3);
    expect(page).toMatch(/await deleteContent\(a\.id\);\s*if \(a\.infographicUrl\) await deleteInfographic\(a\.infographicUrl\);/);
  });

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
