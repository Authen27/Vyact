// v10.49.0 (marketing #5) — funnel events. Pinned: every event carries `platform`;
// sign_up fires ONCE, on a new account's first sign-in, with where it came from (?ref=);
// an existing account signing in is not a sign-up.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let store: Record<string, string>;
beforeEach(() => {
  vi.resetModules();
  store = {};
  vi.stubEnv('MODE', 'production');   // track() is off under vitest by design
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; },
  });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function browser(standalone = false) {
  const gtag = vi.fn();
  vi.stubGlobal('window', { gtag, matchMedia: () => ({ matches: standalone }), navigator: {} });
  return gtag;
}

describe('funnel events', () => {
  it('CON-UNIT-FUN-001 · every event carries platform (web / pwa)', async () => {
    let gtag = browser(false);
    let a = await import('../analytics');
    a.track('budget_created', { surface: 'budgets' });
    expect(gtag).toHaveBeenCalledWith('event', 'budget_created', { surface: 'budgets', platform: 'web' });
    vi.resetModules();
    gtag = browser(true);
    a = await import('../analytics');
    a.track('pwa_install');
    expect(gtag).toHaveBeenCalledWith('event', 'pwa_install', { platform: 'pwa' });
  });

  it('CON-UNIT-FUN-002 · sign_up once, on a new account\'s first sign-in, with its ref; never for an existing account', async () => {
    const gtag = browser();
    const a = await import('../analytics');
    a.rememberSignupRef('learn_ev-001-the-500-a-day-idea');
    const fresh = { id: 'u1', created_at: '2026-09-29T10:00:00Z', last_sign_in_at: '2026-09-29T10:00:20Z', app_metadata: { provider: 'google' } };
    a.trackSignUpOnce(fresh);
    a.trackSignUpOnce(fresh);                       // a reload of that first session
    expect(gtag.mock.calls.filter(c => c[1] === 'sign_up')).toEqual([
      ['event', 'sign_up', { method: 'google', ref: 'learn_ev-001-the-500-a-day-idea', platform: 'web' }],
    ]);
    a.trackSignUpOnce({ id: 'u2', created_at: '2026-01-01T00:00:00Z', last_sign_in_at: '2026-09-29T10:00:00Z' });
    expect(gtag.mock.calls.filter(c => c[1] === 'sign_up')).toHaveLength(1);
  });
});
