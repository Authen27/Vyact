// FinFlow v4.1 — AuthGate
//
// Sits at the top of the route tree. Three modes:
//   1. Cloud disabled (no env vars) — render children, app behaves as v6/v7 local-only.
//   2. Cloud enabled, user authed — render children.
//   3. Cloud enabled, user NOT authed — render auth screen, redirect attempts back to original URL.

import { type ReactNode, useEffect } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useStore } from '../../store';
import { isCloudEnabled, supabase } from '../../lib/supabase';

const PUBLIC_ROUTES = ['/auth/sign-in', '/auth/sign-up', '/auth/reset', '/auth/verified'];

export default function AuthGate({ children }: { children: ReactNode }) {
  const session = useStore(s => s.session);
  const sessionLoaded = useStore(s => s.sessionLoaded);
  const setSession = useStore(s => s.setSession);
  const init = useStore(s => s.init);
  const location = useLocation();

  useEffect(() => {
    if (!isCloudEnabled() || !supabase) {
      // Local-only mode — just init the app
      init();
      return;
    }

    // Hydrate session from Supabase + subscribe to changes
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session, true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess, true);
    });
    return () => sub.subscription.unsubscribe();
  }, [init, setSession]);

  // Cloud disabled → bypass auth entirely
  if (!isCloudEnabled()) return <>{children}</>;

  // Wait for session check to complete
  if (!sessionLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="display-italic text-3xl text-coral mb-2">FinFlow</div>
          <div className="mono-label">Checking your session…</div>
        </div>
      </div>
    );
  }

  const isPublic = PUBLIC_ROUTES.some(p => location.pathname.startsWith(p)) ||
                   location.pathname.startsWith('/invite/');

  // Not signed in + on a private route → bounce to sign-in
  if (!session && !isPublic) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/sign-in?next=${next}`} replace />;
  }

  // Signed in + on auth page → bounce to app
  if (session && location.pathname.startsWith('/auth/')) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
