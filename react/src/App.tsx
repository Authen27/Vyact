import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { useTheme } from './hooks';
import Layout from './components/layout/Layout';
import ToastHost from './components/ui/ToastHost';
import AuthGate from './components/auth/AuthGate';

import Dashboard    from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Reports      from './pages/Reports';
import Recurring    from './pages/Recurring';
import Planner      from './pages/Planner';
import Chat         from './pages/Chat';
import Onboarding   from './pages/Onboarding';
import Households   from './pages/Households';
import Stubs        from './pages/Stubs';

import SignIn        from './pages/auth/SignIn';
import SignUp        from './pages/auth/SignUp';
import ResetPassword from './pages/auth/ResetPassword';
import AcceptInvite  from './pages/auth/AcceptInvite';

export default function App() {
  return (
    <AuthGate>
      <AppShell />
      <ToastHost />
    </AuthGate>
  );
}

function AppShell() {
  const profile = useStore(s => s.profile);
  const loading = useStore(s => s.loading);
  const cloudEnabled = useStore(s => s.cloudEnabled);
  const session = useStore(s => s.session);
  const currentHouseholdId = useStore(s => s.currentHouseholdId);
  const subscribeRealtime = useStore(s => s.subscribeRealtime);
  const refreshHouseholds = useStore(s => s.refreshHouseholds);
  const runRecurring = useStore(s => s.runRecurringEngine);
  const location = useLocation();
  useTheme();

  // Periodic recurring + notifications check (every 60s while app open)
  useEffect(() => {
    const id = setInterval(() => { runRecurring(); }, 60_000);
    return () => clearInterval(id);
  }, [runRecurring]);

  // v4.1 — Realtime subscription on the active household
  useEffect(() => {
    if (!cloudEnabled || !session || !currentHouseholdId || currentHouseholdId === 'local') return;
    refreshHouseholds();
    const unsub = subscribeRealtime(currentHouseholdId);
    return unsub;
  }, [cloudEnabled, session, currentHouseholdId, subscribeRealtime, refreshHouseholds]);

  // Auth-only routes (rendered without Layout)
  const isAuthRoute = location.pathname.startsWith('/auth/') || location.pathname.startsWith('/invite/');
  if (isAuthRoute) {
    return (
      <Routes>
        <Route path="/auth/sign-in"        element={<SignIn />} />
        <Route path="/auth/sign-up"        element={<SignUp />} />
        <Route path="/auth/reset"          element={<ResetPassword />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/auth/verified"       element={<Navigate to="/dashboard" replace />} />
        <Route path="/invite/:token"       element={<AcceptInvite />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="display-italic text-3xl text-coral mb-2">FinFlow</div>
          <div className="mono-label">Loading…</div>
        </div>
      </div>
    );
  }

  // First-run gate: route to onboarding if no template assigned
  // (only for local mode or after sign-up before household exists)
  if (!profile.template && !profile.onboardedAt && !cloudEnabled) {
    return <Onboarding />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"             element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"    element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/reports"      element={<Reports />} />
        <Route path="/recurring"    element={<Recurring />} />
        <Route path="/planner"      element={<Planner />} />
        <Route path="/chat"         element={<Chat />} />
        <Route path="/households"   element={<Households />} />
        <Route path="/budgets"      element={<Stubs page="budgets" />} />
        <Route path="/goals"        element={<Stubs page="goals" />} />
        <Route path="/splits"       element={<Stubs page="splits" />} />
        <Route path="/debts"        element={<Stubs page="debts" />} />
        <Route path="/networth"     element={<Stubs page="networth" />} />
        <Route path="/settings"     element={<Stubs page="settings" />} />
        <Route path="/help"         element={<Stubs page="help" />} />
        <Route path="*"             element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
