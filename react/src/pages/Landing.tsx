// Vyact — public landing page at "/" (v10.33.0; restored as the brand page in v10.50.0).
//
// Rendered Layout-less, before the `loading` gate (see App.tsx), and imported EAGERLY: the
// build pre-renders the same markup into dist/landing.html (scripts/prerender-landing.mjs),
// and a lazy import would swap that markup for a loading spinner before putting it back.
//
// The CTA reads real auth state, the same way AppShell/AuthGate do:
//   cloud mode + signed in  → "Go to Dashboard"
//   cloud mode + signed out → "Sign in" / sign-up with ?ref= per placement
//   local-only mode         → straight into the app, no auth concept here
import { useStore } from '../store';
import { isCloudEnabled } from '../lib/supabase';
import { track } from '../lib/analytics';
import LandingView from './LandingView';

export default function Landing() {
  const session = useStore(s => s.session);
  const cloudMode = isCloudEnabled();
  return (
    <LandingView
      cloudMode={cloudMode}
      signedIn={cloudMode && !!session}
      onCta={placement => track('landing_cta_click', { placement, page: '/' })}
    />
  );
}
