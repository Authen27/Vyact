// W8a (v10.82.0) — app fixes from the 2026-10-04 audit's open low/medium items. Each case is named after
// its finding. Vitest runs in node (no DOM): behaviour is pinned through pure helpers and, where a page
// must use them, through its source.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FULLY_TRANSLATED, languageOptionLabel } from '../i18n';
import { LOCALES } from '../../constants';

const src = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('W8a · app fixes', () => {
  it('W8a-UIS15-001 · the Language select labels the partly translated languages "Preview" (FE-UIS-15)', () => {
    expect(languageOptionLabel('en')).toBe('English');
    for (const code of Object.keys(LOCALES).filter(c => c !== 'en')) {
      expect(languageOptionLabel(code)).toBe(`${LOCALES[code].name} — Preview: navigation only`);
    }
    expect([...FULLY_TRANSLATED]).toEqual(['en']);
    const s = src('pages/Settings.tsx');
    expect(s).toMatch(/<option key=\{k\} value=\{k\}>\{languageOptionLabel\(k\)\}<\/option>/);
    expect(s).toMatch(/!FULLY_TRANSLATED\.has\(profile\.language\)/);
  });
});
