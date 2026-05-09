import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Households from './pages/Households';
import Subscriptions from './pages/Subscriptions';
import Content from './pages/Content';
import Audit from './pages/Audit';
import Settings from './pages/Settings';
import { useAdminStore } from './store';

export default function App() {
  const role = useAdminStore(s => s.role);

  // Role-based route gating: each role sees only the pages it's allowed.
  // PRD §07 — Super (everything), Roles (user mgmt only), Content (articles only).
  const can = (page: string): boolean => {
    if (role === 'super') return true;
    if (role === 'roles')  return ['dashboard','users','households','audit'].includes(page);
    if (role === 'content') return ['dashboard','content'].includes(page);
    return false;
  };

  return (
    <Layout>
      <Routes>
        <Route path="/"              element={<Dashboard />} />
        <Route path="/users"         element={can('users')         ? <Users />         : <Forbidden />} />
        <Route path="/households"    element={can('households')    ? <Households />    : <Forbidden />} />
        <Route path="/subscriptions" element={can('subscriptions') ? <Subscriptions /> : <Forbidden />} />
        <Route path="/content"       element={can('content')       ? <Content />       : <Forbidden />} />
        <Route path="/audit"         element={can('audit')         ? <Audit />         : <Forbidden />} />
        <Route path="/settings"      element={can('settings')      ? <Settings />      : <Forbidden />} />
        <Route path="*"              element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function Forbidden() {
  return (
    <div className="text-center py-20">
      <div className="display-serif text-6xl text-claude mb-3">403</div>
      <div className="display-serif text-2xl text-ink mb-2">Forbidden</div>
      <p className="text-ink-mid">Your role doesn't have access to this page.</p>
      <p className="text-ink-dim font-mono text-[0.7rem] mt-3 tracking-wider uppercase">Switch role from the sidebar to test other tiers</p>
    </div>
  );
}
