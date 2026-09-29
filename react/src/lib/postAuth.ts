// Vyact — where a person lands after signing in or up (v10.49.0, marketing #20).
//
// Landing and Learn links send new users to the feature they were reading about
// (`/auth/sign-up?ref=…&next=/budgets`). Email sign-up navigates there directly;
// Google sign-up leaves the site for the consent screen and comes back to
// /auth/verified, so `next` is remembered across that redirect.
//
// `next` is only ever an in-app PATH: anything else (another origin, "//host",
// "javascript:") is dropped, so a crafted link can't bounce someone off the site.

const KEY = 'vy_post_auth_next';

export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!/^\/(?![/\\])/.test(v)) return null;
  if (/^\/auth\//.test(v)) return null;          // never loop back into auth
  return v.slice(0, 200);
}

export function rememberNext(value: string | null | undefined): void {
  const next = safeNext(value);
  try {
    if (next) sessionStorage.setItem(KEY, next);
  } catch { /* private mode: the default landing still works */ }
}

/** A pending household invite wins; then the remembered or given `next`; else the dashboard. */
export function postAuthPath(next?: string | null): string {
  let pendingInvite: string | null = null;
  let stored: string | null = null;
  try {
    pendingInvite = sessionStorage.getItem('pending_invite_token');
    stored = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch { /* ignore */ }
  if (pendingInvite) return `/invite/${encodeURIComponent(pendingInvite)}`;
  return safeNext(next) ?? safeNext(stored) ?? '/dashboard';
}
