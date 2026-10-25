import { describe, it, expect } from 'vitest';
import { canAccessPage as can, homePath } from '../permissions';

// Audit 7.5; v1.5.0 (ADM-07; owner, 20 Oct 2026: "narrow the pages"): a page is offered only to the tiers whose
// calls the server accepts (lib/permissions.ts). Content admins no longer see the Dashboard (its figures are the
// roles tier's), and roles admins no longer see AI Intelligence (the content tier's).
const PRIVILEGED = ['dashboard', 'users', 'households', 'subscriptions', 'content', 'audit', 'health', 'intelligence', 'settings'];

describe('admin route gating (audit 7.5, ADM-07)', () => {
  it('CON-UNIT-ADM-001 · a content admin reaches Content and AI Intelligence (and Help), and lands on Content', () => {
    for (const p of PRIVILEGED) {
      expect(can('content', p), `content → ${p}`).toBe(['content', 'intelligence'].includes(p));
    }
    expect(can('content', 'help')).toBe(true);
    expect(homePath('content')).toBe('/content');
  });

  it('CON-UNIT-ADM-002 · a roles admin reaches the Dashboard and the people pages, never content, AI, subscriptions or settings', () => {
    for (const p of PRIVILEGED) {
      expect(can('roles', p), `roles → ${p}`).toBe(['dashboard', 'users', 'households', 'audit', 'health'].includes(p));
    }
    expect(homePath('roles')).toBe('/');
  });

  it('CON-UNIT-ADM-003 · no role (null) reaches nothing but help — direct-URL access is denied', () => {
    for (const p of PRIVILEGED) {
      expect(can(null, p), `null → ${p}`).toBe(false);
    }
    expect(can(null, 'help')).toBe(true);
    expect(homePath(null)).toBe('/help');
  });

  it('CON-UNIT-ADM-004 · super reaches everything (the only role that may)', () => {
    for (const p of PRIVILEGED) {
      expect(can('super', p), `super → ${p}`).toBe(true);
    }
    expect(can('super', 'no-such-page')).toBe(false);
  });
});
