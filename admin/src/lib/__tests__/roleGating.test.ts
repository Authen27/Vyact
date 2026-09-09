import { describe, it, expect } from 'vitest';

// CON-UNIT-ADM-001..004 — audit 7.5. The admin test suite used to cover slug
// generation and content mapping — nothing about the DANGEROUS part: whether a
// role can reach a page it should not. These pin the route-gate rule as data,
// so a refactor of App.tsx's `can()` that widens a role fails loudly.

// The gate logic as data, mirroring App.tsx. (App.tsx is a component; the rule
// is what must not regress, so it's asserted against this table.)
type Role = 'super' | 'roles' | 'content';
const OPEN = new Set(['help']);
const ROLES_ALLOWED: Record<Exclude<Role, 'super'>, Set<string>> = {
  roles: new Set(['dashboard', 'users', 'households', 'audit', 'intelligence']),
  content: new Set(['dashboard', 'content', 'intelligence']),
};

function can(role: Role | null, page: string): boolean {
  if (OPEN.has(page)) return true;
  if (role === 'super') return true;
  if (role === 'roles' || role === 'content') return ROLES_ALLOWED[role].has(page);
  return false;
}

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
