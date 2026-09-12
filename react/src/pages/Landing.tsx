// Vyact — public landing page at "/" (vyact.app domain cutover).
//
// Rendered Layout-less, before the `loading` gate, so an anonymous visitor or
// crawler sees it immediately (same reasoning as the legal-route branch in
// App.tsx — see the comment there). Reads auth state the same way AppShell
// does, so the call to action always points somewhere real:
//   cloud mode + signed in  → "Go to Dashboard"
//   cloud mode + signed out → "Sign in" / "Get started"
//   local-only mode         → straight to the dashboard, no auth concept here
import { Link } from 'react-router-dom';
import { useStore } from '../store';
import { isCloudEnabled } from '../lib/supabase';

function Feature({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-bg3 border border-line rounded-lg p-5 md:p-6">
      <div className="text-2xl mb-2" aria-hidden>{icon}</div>
      <h3 className="text-[15px] font-semibold text-ink mb-1.5">{title}</h3>
      <p className="text-[0.9rem] leading-6 text-ink-mid">{children}</p>
    </div>
  );
}

export default function Landing() {
  const session = useStore(s => s.session);
  const cloudMode = isCloudEnabled();
  const signedIn = cloudMode && !!session;

  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--canvas)' }}>
      <header className="max-w-5xl mx-auto px-5 pt-8 pb-4 flex items-center justify-between">
        <span className="display-italic text-2xl text-coral">Vyact</span>
        {cloudMode && (
          <nav className="flex items-center gap-4">
            {signedIn ? (
              <Link to="/dashboard" className="text-[0.85rem] font-medium text-coral hover:underline">
                Go to Dashboard
              </Link>
            ) : (
              <Link to="/auth/sign-in" className="text-[0.85rem] font-medium text-ink-mid hover:text-ink">
                Sign in
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-5 pb-16">
        <section className="pt-10 pb-14 text-center max-w-2xl mx-auto">
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim mb-3">
            Family Finance OS
          </p>
          <h1 className="display-italic text-4xl md:text-5xl text-ink mb-4 leading-tight">
            Household finance, planned together.
          </h1>
          <p className="text-[1.05rem] leading-7 text-ink-mid mb-8">
            Track spend, budgets, debts, and net worth across the family — one honest
            picture, always up to date.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {!cloudMode ? (
              <Link to="/dashboard" className="btn-primary px-6 py-3 text-[0.95rem] font-semibold">
                Open Vyact
              </Link>
            ) : signedIn ? (
              <Link to="/dashboard" className="btn-primary px-6 py-3 text-[0.95rem] font-semibold">
                Go to Dashboard
              </Link>
            ) : (
              <>
                <Link to="/auth/sign-up" className="btn-primary px-6 py-3 text-[0.95rem] font-semibold">
                  Get started
                </Link>
                <Link
                  to="/auth/sign-in"
                  className="px-6 py-3 text-[0.95rem] font-semibold text-ink border border-line rounded-lg hover:bg-bg3"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-14">
          <Feature icon="💰" title="Cash Flow + Net Worth">
            Every transaction moves a real account. The dashboard is two honest numbers,
            not a guess — Cash Flow and Net Worth, always true.
          </Feature>
          <Feature icon="📊" title="Budgets that hold up">
            Set budgets by category, see actual spend against them, and catch drift
            before it becomes a surprise at month-end.
          </Feature>
          <Feature icon="🤖" title="Ask Vyact">
            A model-backed assistant that explains your own numbers in plain English —
            it never invents a figure Vyact hasn't already calculated.
          </Feature>
          <Feature icon="💬" title="Log spend from WhatsApp">
            Text a purchase and Vyact logs it — no app open required, no template
            needed within the 24-hour window.
          </Feature>
          <Feature icon="📚" title="Learn as you go">
            A free library of plain-English money lessons in the Insights Hub —
            no jargon, no upsell.
          </Feature>
          <Feature icon="👥" title="Built for the household">
            Invite the family, share budgets, split bills, and keep everyone looking
            at the same numbers.
          </Feature>
        </section>
      </main>

      <footer className="max-w-5xl mx-auto px-5 py-8 border-t border-line flex flex-wrap gap-x-6 gap-y-2 text-[0.8rem] text-ink-dim">
        <Link to="/privacy" className="hover:text-ink">Privacy</Link>
        <Link to="/terms" className="hover:text-ink">Terms</Link>
        <Link to="/cookies" className="hover:text-ink">Cookies</Link>
      </footer>
    </div>
  );
}
