import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Userback from '@userback/widget';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { registerPwa } from './lib/pwa';
import './index.css';

// Feedback widget is best-effort and must NEVER block the app: a top-level
// await here meant any Userback failure (adblocker, corporate proxy,
// unauthorized domain, vendor outage) left users on a permanently blank
// screen because createRoot().render() was never reached.
//
// v10.52.0 — on the public landing page ("/") the widget (~168 KB) and the service
// worker registration wait until the page has loaded and gone idle. They were
// competing with the hero for a throttled phone's bandwidth (PageSpeed mobile,
// 1 Oct 2026). Everywhere else they start immediately, as before.
const onLanding = window.location.pathname === '/';
function afterPaint(run: () => void) {
  if (!onLanding) { run(); return; }
  const idle = () => { if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 2000); };
  if (document.readyState === 'complete') idle(); else window.addEventListener('load', idle, { once: true });
}
afterPaint(() => { void Userback('A-7Q0Mz7gfB3ECVu6ZsOIUew97E').catch(() => { /* widget unavailable — app works without it */ }); });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
        <SpeedInsights />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);

// PWA: register the service worker and capture install lifecycle events.
// No-op in dev unless devOptions.enabled is flipped in vite.config.
afterPaint(() => { void registerPwa(); });
