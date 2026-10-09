// W8c (admin v1.4.4) — admin fixes from the 2026-10-04 audit. Each case is named after its finding.
// Vitest runs in node: behaviour is pinned through the pure helpers and, where a page must use them,
// through its source.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HOUSEHOLD_TYPES, normalizeHouseholdType } from '../householdTypes';
import * as consumer from '../../../../react/src/lib/householdTypes';
import { CONTENT_BYLINE, resolvePublishedAt } from '../contentApi';
import { pingDatabase, projectRefOf } from '../dbStatus';
import { revenueByCurrency, revenueLabel } from '../revenue';

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('W8c · admin fixes', () => {
  it('W8c-ADM13-001 · the admin host sends a strict CSP and publishes no source maps (ADM-13)', () => {
    const vercel = JSON.parse(readFileSync(resolve(__dirname, '../../../vercel.json'), 'utf8'));
    const csp = vercel.headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy')?.value as string;
    expect(csp).toBeTruthy();
    for (const d of ["default-src 'self'", "script-src 'self'", "frame-ancestors 'none'", "object-src 'none'",
      'connect-src \'self\' https://dmxqkvploojokffuhxnz.supabase.co wss://dmxqkvploojokffuhxnz.supabase.co',
      'style-src \'self\' https://fonts.googleapis.com', 'font-src \'self\' https://fonts.gstatic.com']) {
      expect(csp, d).toContain(d);
    }
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
    for (const f of ['vite.config.ts', 'vite.config.js']) {
      expect(readFileSync(resolve(__dirname, '../../..', f), 'utf8'), f).toMatch(/sourcemap: false/);
    }
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'));
    expect(pkg.scripts.build).toMatch(/vite build && node scripts\/assert-no-sourcemaps\.mjs$/);
  });

  it('W8c-ADM14-001 · MRR is counted per currency over active + trialing, never one sum labelled USD (ADM-14)', () => {
    const rows = [
      { status: 'active', monthly_amount: 999, currency: 'INR' },
      { status: 'trialing', monthly_amount: 499, currency: 'inr' },
      { status: 'active', monthly_amount: 12, currency: 'USD' },
      { status: 'canceled', monthly_amount: 50, currency: 'USD' },
      { status: 'past_due', monthly_amount: 7, currency: 'USD' },
    ] as const;
    const rev = revenueByCurrency(rows as never);
    expect(rev).toEqual([{ currency: 'INR', mrr: 1498, arr: 17976 }, { currency: 'USD', mrr: 12, arr: 144 }]);
    expect(revenueLabel(rev, 'mrr')).toBe('INR 1,498 · USD 12');
    expect(revenueLabel([], 'mrr')).toBe('—');
    const page = src('pages/Subscriptions.tsx');
    expect(page).not.toMatch(/MRR \(USD\)|ARR \(USD\)/);
    expect(page).toMatch(/revenueLabel\(stats\.revenue, 'mrr'\)/);
  });

  it('W8c-ADM12-001 · Settings claims only what it checked: a live DB round-trip, the real project, the real version (ADM-12)', async () => {
    const client = (error: unknown) => ({ from: () => ({ select: async () => ({ error }) }) }) as never;
    expect(await pingDatabase(client(null))).toBe('connected');
    expect(await pingDatabase(client({ message: 'JWT expired' }))).toBe('unreachable');
    expect(await pingDatabase({ from: () => { throw new Error('offline'); } } as never)).toBe('unreachable');
    expect(await pingDatabase(null)).toBe('not_configured');
    expect(projectRefOf('https://dmxqkvploojokffuhxnz.supabase.co')).toBe('dmxqkvploojokffuhxnz');
    expect(projectRefOf(null)).toBeNull();
    const settings = src('pages/Settings.tsx');
    expect(settings).not.toMatch(/state="connected"/);           // nothing hard-coded as connected
    expect(settings).not.toMatch(/G-E3XKWZP850|eu-west-2|dmxqkvploojokffuhxnz|Wires in v1|Admin v1\.0\.0/);
    expect(settings).toMatch(/pingDatabase\(supabase\)/);
    expect(src('components/Layout.tsx')).toMatch(/Admin · v\{__APP_VERSION__\}/);
    expect(src('lib/supabase.ts')).toMatch(/'X-Client-Info': `vyact-admin\/v\$\{APP_VERSION\}`/);
  });

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
