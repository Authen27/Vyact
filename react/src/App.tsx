import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { useTheme } from './hooks';
import Layout from './components/layout/Layout';
import ToastHost from './components/ui/ToastHost';
import AuthGate from './components/auth/AuthGate';
import TransactionFormModal from './components/transactions/TransactionFormModal';
import GoalFormModal from './components/goals/GoalFormModal';
import GoalProgressModal from './components/goals/GoalProgressModal';
import BudgetFormModal from './components/budgets/BudgetFormModal';
import DebtFormModal from './components/debts/DebtFormModal';
import AssetFormModal from './components/assets/AssetFormModal';


import React, { Suspense } from 'react';
const Dashboard    = React.lazy(() => import('./pages/Dashboard'));
const Transactions = React.lazy(() => import('./pages/Transactions'));
const Reports      = React.lazy(() => import('./pages/Reports'));
const Recurring    = React.lazy(() => import('./pages/Recurring'));
const Planner      = React.lazy(() => import('./pages/Planner'));
const Chat         = React.lazy(() => import('./pages/Chat'));
const Onboarding   = React.lazy(() => import('./pages/Onboarding'));
const Households   = React.lazy(() => import('./pages/Households'));
const Settings     = React.lazy(() => import('./pages/Settings'));
const Budgets      = React.lazy(() => import('./pages/Budgets'));
const Goals        = React.lazy(() => import('./pages/Goals'));
const Debts        = React.lazy(() => import('./pages/Debts'));
const NetWorth     = React.lazy(() => import('./pages/NetWorth'));
const Splits       = React.lazy(() => import('./pages/Splits'));
const Help         = React.lazy(() => import('./pages/Help'));
const Insights     = React.lazy(() => import('./pages/Insights'));
const E2EErrorTest = React.lazy(() => import('./pages/__e2e__ErrorTest'));

const SignIn        = React.lazy(() => import('./pages/auth/SignIn'));
const SignUp        = React.lazy(() => import('./pages/auth/SignUp'));
const ResetPassword = React.lazy(() => import('./pages/auth/ResetPassword'));
const AcceptInvite  = React.lazy(() => import('./pages/auth/AcceptInvite'));

export default function App() {
  return (
    <AuthGate>
      <AppShell />
      <TransactionFormModal />
      <GoalFormModal />
      <GoalProgressModal />
      <BudgetFormModal />
      <DebtFormModal />
      <AssetFormModal />
      <ToastHost />
    </AuthGate>
  );
}

function AppShell() {
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
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/auth/sign-in"        element={<SignIn />} />
          <Route path="/auth/sign-up"        element={<SignUp />} />
          <Route path="/auth/reset"          element={<ResetPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/auth/verified"       element={<Navigate to="/dashboard" replace />} />
          <Route path="/invite/:token"       element={<AcceptInvite />} />
        </Routes>
      </Suspense>
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

  // Onboarding is opt-in. Existing or fresh users without preferences are NOT
  // forced through the wizard — they land on the dashboard with empty state.
  // The /onboarding route is reachable from Settings, the welcome banner, and
  // the sign-up flow when the user explicitly opts in.

  return (
    <Layout>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/"             element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard"    element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/reports"      element={<Reports />} />
          <Route path="/recurring"    element={<Recurring />} />
          <Route path="/planner"      element={<Planner />} />
          <Route path="/chat"         element={<Chat />} />
          <Route path="/households"   element={<Households />} />
          <Route path="/budgets"      element={<Budgets />} />
          <Route path="/goals"        element={<Goals />} />
          <Route path="/splits"       element={<Splits />} />
          <Route path="/debts"        element={<Debts />} />
          <Route path="/networth"     element={<NetWorth />} />
          <Route path="/settings"     element={<Settings />} />
          <Route path="/help"         element={<Help />} />
          <Route path="/insights"     element={<Insights />} />
          <Route path="/__e2e_error"  element={<E2EErrorTest />} />
          <Route path="/onboarding"   element={<Onboarding />} />
          <Route path="*"             element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );

}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="display-italic text-3xl text-coral mb-2">FinFlow</div>
        <div className="mono-label">Loading…</div>
      </div>
    </div>
  );
}
