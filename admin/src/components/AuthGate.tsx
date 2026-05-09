// FinFlow Admin v8 — Auth gate
// Wraps the entire admin app. Three states:
//   1. Loading (waiting on session check)
//   2. Not signed in → render <SignIn />
//   3. Signed in but no admin_roles row → render <NotAuthorized />
//   4. Signed in + admin → render children

import { type ReactNode, useEffect, useState } from 'react';
import { useAdminStore } from '../store';
import { isCloudEnabled, supabase } from '../lib/supabase';
import { signIn, signOut, fetchMyAdminRole } from '../lib/auth';

export default function AuthGate({ children }: { children: ReactNode }) {
  const session       = useAdminStore(s => s.session);
  const sessionLoaded = useAdminStore(s => s.sessionLoaded);
  const serverRole    = useAdminStore(s => s.serverRole);
  const setSession    = useAdminStore(s => s.setSession);

  useEffect(() => {
    if (!isCloudEnabled() || !supabase) {
      setSession(null, null, true);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase!.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        const role = await fetchMyAdminRole();
        setSession(data.session, role, true);
      } else {
        setSession(null, null, true);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (sess) {
        const role = await fetchMyAdminRole();
        setSession(sess, role, true);
      } else {
        setSession(null, null, true);
      }
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, [setSession]);

  if (!isCloudEnabled()) return <ConfigError />;
  if (!sessionLoaded)    return <Loading />;
  if (!session)          return <SignInPage />;
  if (!serverRole)       return <NotAuthorized email={session.user.email || ''} />;

  return <>{children}</>;
}

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="display-serif text-3xl text-claude mb-2">FinFlow Admin</div>
        <div className="font-mono text-[0.65rem] tracking-[0.18em] uppercase text-ink-dim">Checking session…</div>
      </div>
    </div>
  );
}

function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md panel p-6 text-center">
        <div className="display-serif text-2xl text-danger mb-2">Cloud not configured</div>
        <p className="text-ink-mid text-sm">
          Set <code className="font-mono">VITE_SUPABASE_URL</code> and{' '}
          <code className="font-mono">VITE_SUPABASE_ANON_KEY</code> in <code className="font-mono">admin/.env.local</code> and rebuild.
        </p>
      </div>
    </div>
  );
}

function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try { await signIn(email, password); }
    catch (err) { setError((err as Error).message); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-7">
          <div className="display-serif text-3xl text-claude leading-none">FinFlow</div>
          <div className="font-mono text-[0.6rem] tracking-[0.2em] uppercase text-ink-dim mt-1.5">Admin Console · v8.0</div>
        </div>
        <form onSubmit={onSubmit} className="panel p-6 space-y-3">
          <div>
            <label className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-ink-mid mb-1.5 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              className="w-full bg-elev border border-line rounded-md px-3 py-2 text-[0.86rem] outline-none focus:border-claude" />
          </div>
          <div>
            <label className="font-mono text-[0.58rem] tracking-[0.14em] uppercase text-ink-mid mb-1.5 block">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-elev border border-line rounded-md px-3 py-2 text-[0.86rem] outline-none focus:border-claude" />
          </div>
          {error && <div className="text-danger text-[0.78rem]">{error}</div>}
          <button type="submit" disabled={submitting}
            className="w-full bg-claude text-white font-mono uppercase tracking-wider text-[0.7rem] py-2.5 rounded-md hover:bg-claude-2 transition disabled:opacity-50">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-[0.72rem] text-ink-dim text-center mt-4 leading-relaxed">
          Admin access is granted server-side via the <code className="font-mono">admin_roles</code> table.<br/>
          Contact a Super Admin to request a tier.
        </p>
      </div>
    </div>
  );
}

function NotAuthorized({ email }: { email: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md panel p-6 text-center">
        <div className="display-serif text-2xl text-warn mb-2">Not an admin</div>
        <p className="text-ink-mid text-sm mb-3">
          You are signed in as <strong className="text-ink">{email}</strong> but no admin role is granted.
        </p>
        <p className="text-ink-dim text-[0.78rem] mb-5">
          Ask a Super Admin to add a row to <code className="font-mono">public.admin_roles</code> for your user id.
        </p>
        <button onClick={signOut}
          className="font-mono text-[0.62rem] tracking-wider uppercase px-4 py-2 border border-line rounded-md hover:border-danger hover:text-danger transition">
          Sign out
        </button>
      </div>
    </div>
  );
}
