// Mobile bottom tab bar (Aurora v10, handoff §7) — the section-based tab
// set so the mobile IA mirrors desktop and no route is dropped: secondary
// routes are reached via the SubNav pill scroller inside each section.
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Wallet, BookOpen, UserRound } from 'lucide-react';
import { sectionForPath } from './navModel';

const TABS = [
  { id: 'home',    label: 'Home',    to: '/dashboard', icon: LayoutDashboard },
  { id: 'track',   label: 'Track',   to: '/transactions', icon: ArrowLeftRight },
  { id: 'plan',    label: 'Plan',    to: '/budgets', icon: Wallet },
  { id: 'analyze', label: 'Analyze', to: '/insights', icon: BookOpen },
  { id: 'profile', label: 'Profile', to: '/settings', icon: UserRound },
];

function activeTab(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return 'home';
  const section = sectionForPath(pathname);
  if (section === 'track') return 'track';
  if (section === 'plan') return 'plan';
  if (section === 'analyze') return 'analyze';
  return 'profile';
}

export default function MobileTabBar() {
  const location = useLocation();
  const current = activeTab(location.pathname);

  return (
    <nav
      aria-label="Primary"
      className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line"
      style={{
        background: 'var(--glass-strong)',
        backdropFilter: 'var(--blur)',
        WebkitBackdropFilter: 'var(--blur)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-stretch justify-around px-1 py-1.5">
        {TABS.map(t => {
          const on = current === t.id;
          return (
            <NavLink
              key={t.id}
              to={t.to}
              aria-current={on ? 'page' : undefined}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] px-2.5 py-1 rounded-r2 transition-colors"
              style={on ? { background: 'var(--ff-coral-tint)', color: 'var(--accent)' } : { color: 'var(--ff-ink-3)' }}
            >
              <t.icon size={19} strokeWidth={on ? 2.2 : 1.8} />
              <span className="font-display text-[10px] font-semibold">{t.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
