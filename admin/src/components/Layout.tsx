import { type ReactNode, useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, Users, Home, CreditCard, FileText,
  ScrollText, Settings, Sun, Moon, Search, ChevronDown, LogOut,
  HelpCircle, Brain, Menu, X,
} from 'lucide-react';
import { useAdminStore } from '../store';
import { signOut } from '../lib/auth';
import type { AdminRole } from '../types';

const ROLE_PAGES: Record<AdminRole, string[]> = {
  super:   ['dashboard','users','households','subscriptions','content','audit','intelligence','settings','help'],
  roles:   ['dashboard','users','households','audit','intelligence','help'],
  content: ['dashboard','content','intelligence','help'],
};

const NAV = [
  { to: '/',              page: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { to: '/users',         page: 'users',         label: 'Users',         icon: Users },
  { to: '/households',    page: 'households',    label: 'Households',    icon: Home },
  { to: '/subscriptions', page: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/content',       page: 'content',       label: 'Content',       icon: FileText },
  { to: '/audit',         page: 'audit',         label: 'Audit Log',     icon: ScrollText },
  { to: '/intelligence',  page: 'intelligence',  label: 'AI Intelligence', icon: Brain },
  { to: '/settings',      page: 'settings',      label: 'Settings',      icon: Settings },
  { to: '/help',          page: 'help',          label: 'Help & Manual', icon: HelpCircle },
];

export default function Layout({ children }: { children: ReactNode }) {
  const role        = useAdminStore(s => s.role);
  const serverRole  = useAdminStore(s => s.serverRole);
  const session     = useAdminStore(s => s.session);
  const setRole     = useAdminStore(s => s.setRole);
  const dark        = useAdminStore(s => s.darkMode);
  const toggleDark  = useAdminStore(s => s.toggleDark);
  const query       = useAdminStore(s => s.query);
  const setQuery    = useAdminStore(s => s.setQuery);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visible = new Set(ROLE_PAGES[role]);
  const canSwitchRole = serverRole === 'super';

  const navLinks = (onNavigate?: () => void) =>
    NAV.filter(n => visible.has(n.page)).map(n => (
      <NavLink
        key={n.to}
        to={n.to}
        end={n.to === '/'}
        onClick={onNavigate}
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
    ));

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-surface border-r border-line">
        <div className="px-5 py-5 border-b border-line">
          <Link to="/" className="flex items-center gap-2.5">
            <svg viewBox="0 0 36 36" width={32} height={32} className="flex-shrink-0">
              <defs>
                <radialGradient id="ff-logo-grad" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#F4B6A8" />
                  <stop offset="100%" stopColor="#E26D5C" />
                </radialGradient>
              </defs>
              <path d="M18 3 C 27 3, 33 9, 33 18 C 33 27, 27 33, 18 33 C 9 33, 3 27, 3 18 C 3 9, 9 3, 18 3 Z" fill="url(#ff-logo-grad)" stroke="#2A2522" strokeWidth="1.2" />
              <ellipse cx="13" cy="16" rx="1.4" ry="1.8" fill="#2A2522" />
              <ellipse cx="23" cy="16" rx="1.4" ry="1.8" fill="#2A2522" />
              <circle cx="9.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
              <circle cx="26.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
              <path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              <path d="M18 3 Q 16 -1, 14 1 Q 17 3, 18 3 Z" fill="#85A88A" stroke="#2A2522" strokeWidth="0.8" />
            </svg>
            <div>
              <div className="text-lg leading-none" style={{ fontFamily: 'var(--ff-serif, Georgia)', fontWeight: 500, letterSpacing: '-0.015em' }}>
                Fin<span style={{ fontStyle: 'italic', color: '#E26D5C' }}>Flow</span>
              </div>
              <div className="font-mono text-[0.55rem] tracking-[0.18em] uppercase text-ink-dim mt-0.5">Admin · v1.0.5</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navLinks()}
        </nav>

        <div className="px-3 py-3 border-t border-line space-y-2">
          <div className="relative">
            <button
              onClick={() => canSwitchRole && setRoleMenuOpen(o => !o)}
              disabled={!canSwitchRole}
              className={`w-full flex items-center justify-between px-3 py-2 bg-elev border border-line rounded-md transition ${
                canSwitchRole ? 'hover:bg-sunken cursor-pointer' : 'cursor-not-allowed opacity-80'
              }`}
            >
              <div className="text-left">
                <div className="font-mono text-[0.54rem] tracking-[0.16em] uppercase text-ink-dim">
                  {canSwitchRole ? 'Previewing as' : 'Acting as'}
                </div>
                <div className="text-[0.84rem] font-semibold text-ink capitalize">{role} Admin</div>
              </div>
              {canSwitchRole && <ChevronDown size={14} className="text-ink-dim" />}
            </button>
            {roleMenuOpen && canSwitchRole && (
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
          {session?.user?.email && (
            <div className="px-3 py-1 text-center font-mono text-[0.58rem] tracking-wider text-ink-dim truncate">
              {session.user.email}
            </div>
          )}
          <button onClick={toggleDark} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-line rounded-md text-ink-mid hover:bg-sunken transition font-mono text-[0.62rem] tracking-wider uppercase">
            {dark ? <Sun size={12} /> : <Moon size={12} />} {dark ? 'Light' : 'Dark'} mode
          </button>
          <button onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-line rounded-md text-ink-dim hover:border-danger hover:text-danger transition font-mono text-[0.62rem] tracking-wider uppercase">
            <LogOut size={12} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile nav drawer (below lg) */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-surface border-r border-line flex flex-col shadow-2">
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div className="text-lg leading-none" style={{ fontFamily: 'var(--ff-serif, Georgia)', fontWeight: 500, letterSpacing: '-0.015em' }}>
                Fin<span style={{ fontStyle: 'italic', color: '#E26D5C' }}>Flow</span>
                <span className="font-mono text-[0.5rem] tracking-[0.16em] uppercase text-ink-dim ml-2">Admin</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="text-ink-mid hover:text-ink">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 py-3 overflow-y-auto">
              {navLinks(() => setMobileNavOpen(false))}
            </nav>
            <div className="px-3 py-3 border-t border-line space-y-2">
              <button onClick={toggleDark} className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-line rounded-md text-ink-mid hover:bg-sunken transition font-mono text-[0.62rem] tracking-wider uppercase">
                {dark ? <Sun size={12} /> : <Moon size={12} />} {dark ? 'Light' : 'Dark'} mode
              </button>
              <button onClick={() => signOut()}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-line rounded-md text-ink-dim hover:border-danger hover:text-danger transition font-mono text-[0.62rem] tracking-wider uppercase">
                <LogOut size={12} /> Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-surface border-b border-line flex items-center justify-between gap-3 px-4 sm:px-5 flex-shrink-0">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="lg:hidden flex-shrink-0 text-ink-mid hover:text-ink p-1 -ml-1"
          >
            <Menu size={20} />
          </button>
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search users, households, articles…"
              className="w-full bg-elev border border-line rounded-md pl-8 pr-3 py-1.5 outline-none focus:border-claude text-[0.84rem]"
            />
          </div>
          <div className="hidden sm:block font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
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
