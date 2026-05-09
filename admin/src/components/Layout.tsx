import { type ReactNode, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Home, CreditCard, FileText,
  ScrollText, Settings, Sun, Moon, Search, ChevronDown, LogOut,
} from 'lucide-react';
import { useAdminStore } from '../store';
import type { AdminRole } from '../types';

const ROLE_PAGES: Record<AdminRole, string[]> = {
  super:   ['dashboard','users','households','subscriptions','content','audit','settings'],
  roles:   ['dashboard','users','households','audit'],
  content: ['dashboard','content'],
};

const NAV = [
  { to: '/',              page: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/users',         page: 'users',         label: 'Users',         icon: Users },
  { to: '/households',    page: 'households',    label: 'Households',    icon: Home },
  { to: '/subscriptions', page: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/content',       page: 'content',       label: 'Content',       icon: FileText },
  { to: '/audit',         page: 'audit',         label: 'Audit Log',     icon: ScrollText },
  { to: '/settings',      page: 'settings',      label: 'Settings',      icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const role = useAdminStore(s => s.role);
  const setRole = useAdminStore(s => s.setRole);
  const dark = useAdminStore(s => s.darkMode);
  const toggleDark = useAdminStore(s => s.toggleDark);
  const query = useAdminStore(s => s.query);
  const setQuery = useAdminStore(s => s.setQuery);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const visible = new Set(ROLE_PAGES[role]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-surface border-r border-line">
        <div className="px-5 py-5 border-b border-line">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-claude flex items-center justify-center text-white font-mono font-bold text-sm">FF</div>
            <div>
              <div className="display-serif text-lg leading-none">FinFlow</div>
              <div className="font-mono text-[0.55rem] tracking-[0.18em] uppercase text-ink-dim mt-0.5">Admin · v8.0</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.filter(n => visible.has(n.page)).map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-[0.86rem] font-medium border-l-2 transition ${
                  isActive
                    ? 'text-claude bg-claude/10 border-l-claude'
                    : 'text-ink-mid border-l-transparent hover:text-ink hover:bg-sunken'
                }`
              }
            >
              <n.icon size={16} />
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-3 border-t border-line space-y-2">
          <div className="relative">
            <button
              onClick={() => setRoleMenuOpen(o => !o)}
              className="w-full flex items-center justify-between px-3 py-2 bg-elev border border-line rounded-md hover:bg-sunken transition"
            >
              <div className="text-left">
                <div className="font-mono text-[0.54rem] tracking-[0.16em] uppercase text-ink-dim">Acting as</div>
                <div className="text-[0.84rem] font-semibold text-ink capitalize">{role} Admin</div>
              </div>
              <ChevronDown size={14} className="text-ink-dim" />
            </button>
            {roleMenuOpen && (
              <div className="absolute bottom-full mb-1 inset-x-0 bg-surface border border-line2 rounded-md shadow-2 py-1 z-30">
                {(['super','roles','content'] as AdminRole[]).map(r => (
                  <button
                    key={r}
                    onClick={() => { setRole(r); setRoleMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[0.84rem] capitalize hover:bg-sunken ${role === r ? 'text-claude font-semibold' : 'text-ink'}`}
                  >
                    {r} Admin
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={toggleDark} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-line rounded-md text-ink-mid hover:bg-sunken transition font-mono text-[0.62rem] tracking-wider uppercase">
            {dark ? <Sun size={12} /> : <Moon size={12} />} {dark ? 'Light' : 'Dark'} mode
          </button>
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-line rounded-md text-ink-dim hover:border-danger hover:text-danger transition font-mono text-[0.62rem] tracking-wider uppercase">
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-surface border-b border-line flex items-center justify-between px-5 flex-shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search users, households, articles…"
              className="w-full bg-elev border border-line rounded-md pl-8 pr-3 py-1.5 outline-none focus:border-claude text-[0.84rem]"
            />
          </div>
          <div className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            staging.finflow.app · admin
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 lg:px-8 py-6 max-w-[1400px]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
