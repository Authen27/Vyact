import { describe, it, expect } from 'vitest';
import { canAccessPage as can } from '../permissions';

const PRIVILEGED = ['users', 'households', 'subscriptions', 'content', 'audit', 'intelligence', 'settings'];

describe('admin route gating (audit 7.5)', () => {
  it('CON-UNIT-ADM-001 · a content-admin reaches content/intelligence/dashboard/help only', () => {
    for (const p of PRIVILEGED) {
      expect(can('content', p), `content → ${p}`).toBe(['content', 'intelligence'].includes(p));
    }
    expect(can('content', 'help')).toBe(true);
  });

  it('CON-UNIT-ADM-002 · a roles-admin reaches user-mgmt pages but never content/subscriptions/settings', () => {
    for (const p of PRIVILEGED) {
      expect(can('roles', p), `roles → ${p}`).toBe(['users', 'households', 'audit', 'intelligence'].includes(p));
    }
    expect(can('roles', 'content')).toBe(false);
    expect(can('roles', 'subscriptions')).toBe(false);
    expect(can('roles', 'settings')).toBe(false);
  });

  it('CON-UNIT-ADM-003 · no role (null) reaches nothing but help — direct-URL access is denied', () => {
    for (const p of [...PRIVILEGED, 'dashboard']) {
      expect(can(null, p), `null → ${p}`).toBe(false);
    }
    expect(can(null, 'help')).toBe(true);
  });

  it('CON-UNIT-ADM-004 · super reaches everything (the only role that may)', () => {
    for (const p of [...PRIVILEGED, 'dashboard']) {
      expect(can('super', p), `super → ${p}`).toBe(true);
    }
  });
});
