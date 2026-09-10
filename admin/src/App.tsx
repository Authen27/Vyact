import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import AuthGate from './components/AuthGate';
import { useAdminStore } from './store';
import { canAccessPage } from './lib/permissions';

// Audit 7.3 — route-level code splitting. Every page was eagerly imported, so
// the whole admin bundle (incl. the chart-heavy Intelligence and the Content
// editor) parsed on first paint and one page's import error broke them all.
const Dashboard    = lazy(() => import('./pages/Dashboard'));
const Users        = lazy(() => import('./pages/Users'));
const Households   = lazy(() => import('./pages/Households'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const Content      = lazy(() => import('./pages/Content'));
const Audit        = lazy(() => import('./pages/Audit'));
const Intelligence = lazy(() => import('./pages/Intelligence'));
const Settings     = lazy(() => import('./pages/Settings'));
const Help         = lazy(() => import('./pages/Help'));

function PageFallback() {
  return (
    <div className="py-20 text-center font-mono text-[0.65rem] tracking-[0.18em] uppercase text-ink-dim">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <AuthGate>
      <AppShell />
    </AuthGate>
  );
}

function AppShell() {
  const role = useAdminStore(s => s.role);

  // Role-based route gating: each role sees only the pages it's allowed.
  // PRD §07 — Super (everything), Roles (user mgmt only), Content (articles only).
  const can = (page: string): boolean => canAccessPage(role, page);

  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/"              element={<Dashboard />} />
          <Route path="/users"         element={can('users')         ? <Users />         : <Forbidden />} />
          <Route path="/households"    element={can('households')    ? <Households />    : <Forbidden />} />
          <Route path="/subscriptions" element={can('subscriptions') ? <Subscriptions /> : <Forbidden />} />
          <Route path="/content"       element={can('content')       ? <Content />       : <Forbidden />} />
          <Route path="/audit"         element={can('audit')         ? <Audit />         : <Forbidden />} />
          <Route path="/intelligence"  element={can('intelligence')  ? <Intelligence /> : <Forbidden />} />
          <Route path="/settings"      element={can('settings')      ? <Settings />      : <Forbidden />} />
          <Route path="/help"          element={<Help />} />
          <Route path="*"              element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

function Forbidden() {
  return (
    <div className="text-center py-20">
      <div className="display-serif text-6xl text-claude mb-3">403</div>
      <div className="display-serif text-2xl text-ink mb-2">Forbidden</div>
      <p className="text-ink-mid">Your role doesn't have access to this page.</p>
      <p className="text-ink-dim font-mono text-[0.7rem] mt-3 tracking-wider uppercase">Switch role from the sidebar to test other tiers (Super only)</p>
    </div>
  );
}
