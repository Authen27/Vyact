import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight, Target, Wallet, Repeat,
  TrendingUp, Users, Banknote, Scale, BarChart3,
  Home, Settings, HelpCircle, LogOut, BookOpen,
  Sun, Moon, Monitor, Download, Trash2, X,
} from 'lucide-react';
import { signOut as authSignOut } from '../../lib/auth';
import { useStore } from '../../store';
import ProfileSwitcher from './ProfileSwitcher';
import { useTranslation } from '../../hooks';
import { pagesForTemplate } from '../../lib/templates';
import NotificationCenter from './NotificationCenter';
import SyncStatusBadge from './SyncStatusBadge';

interface Props {
  open: boolean;
  onClose: () => void;
}

const navGroups = [
  { label: 'TRACK', items: [
    { to: '/dashboard',    key: 'dashboard',    page: 'dashboard',    icon: LayoutDashboard },
    { to: '/transactions', key: 'transactions', page: 'transactions', icon: ArrowLeftRight },
    { to: '/splits',       key: 'splits',       page: 'splits',       icon: Users },
    { to: '/recurring',    key: 'recurring',    page: 'recurring',    icon: Repeat },
  ]},
  { label: 'PLAN', items: [
    { to: '/budgets',  key: 'budgets',  page: 'budgets',  icon: Wallet },
    { to: '/goals',    key: 'goals',    page: 'goals',    icon: Target },
    { to: '/debts',    key: 'debts',    page: 'debts',    icon: Banknote },
    { to: '/networth', key: 'networth', page: 'networth', icon: Scale },
  ]},
  { label: 'ANALYZE', items: [
    { to: '/reports',  key: 'reports',  page: 'reports',  icon: BarChart3 },
    { to: '/insights', key: 'insights', page: 'insights', icon: BookOpen },
  ]},
  { label: 'ACCOUNT', items: [
    { to: '/households', key: 'households', page: 'households', icon: Home },
  ]},
];

export default function Sidebar({ open, onClose }: Props) {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const template = useStore(s => s.profile.template);
  const cloudEnabled = useStore(s => s.cloudEnabled);
  const session = useStore(s => s.session);
  const visible = pagesForTemplate(template);
  // Always show new v7+ pages even outside template (they're additive ANALYZE tools)
  ['recurring','insights','households'].forEach(p => visible.add(p));
  const { t } = useTranslation();

  return (
    <>
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/45 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}
      <aside className={`fixed top-0 left-0 bottom-0 w-[260px] lg:w-60 bg-bg2 border-r border-line z-50 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo — click to return to Dashboard */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-line relative">
          <Link
            to="/dashboard"
            onClick={() => { if (window.innerWidth < 1024) onClose(); }}
            className="flex items-center gap-2.5 flex-1 min-w-0 group rounded-md -mx-1 px-1 py-1 transition-colors hover:bg-coral-tint/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-coral/40"
            aria-label="FinFlow — go to dashboard"
            title="Dashboard"
          >
            <Logo />
            <div className="text-2xl text-ink leading-none flex-1 group-hover:text-ink"
                 style={{ fontFamily: 'var(--ff-serif)', fontWeight: 500, letterSpacing: '-0.015em' }}>
              Fin<span style={{ fontStyle: 'italic', color: 'var(--ff-coral)' }}>Flow</span>
            </div>
          </Link>
          <div className="hidden lg:flex items-center gap-2">
            <NotificationCenter />
            <SyncStatusBadge />
          </div>
          <button onClick={onClose} className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 border border-line rounded text-ink-mid hover:text-ink hover:border-line2 flex items-center justify-center">
            <X size={14} />
          </button>
        </div>

        {/* Profile switcher */}
        <ProfileSwitcher />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              <div className="font-mono text-[0.56rem] tracking-[0.18em] uppercase text-ink-dim px-4 pt-3 pb-1.5">
                {group.label}
              </div>
              {group.items.filter(item => visible.has(item.page)).map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-4 py-2 text-[0.86rem] font-medium border-l-2 transition-all ${
                      isActive
                        ? 'text-coral bg-coral-tint border-l-coral font-semibold'
                        : 'text-ink-mid border-l-transparent hover:text-ink hover:bg-coral-tint/40 hover:border-l-line2'
                    }`
                  }
                >
                  <item.icon size={16} className="opacity-85" />
                  <span>{t(item.key)}</span>
                </NavLink>
              ))}
            </div>
          ))}

          <div className="h-px bg-line mx-4 my-2.5" />

          <NavLink to="/settings" className={({ isActive }) =>
            `flex items-center gap-2.5 px-4 py-2 text-[0.86rem] font-medium border-l-2 transition-all ${isActive ? 'text-coral bg-coral-tint border-l-coral font-semibold' : 'text-ink-mid border-l-transparent hover:text-ink hover:bg-coral-tint/40'}`
          }>
            <Settings size={16} /> {t('settings')}
          </NavLink>
          <NavLink to="/help" className={({ isActive }) =>
            `flex items-center gap-2.5 px-4 py-2 text-[0.86rem] font-medium border-l-2 transition-all ${isActive ? 'text-coral bg-coral-tint border-l-coral font-semibold' : 'text-ink-mid border-l-transparent hover:text-ink hover:bg-coral-tint/40'}`
          }>
            <HelpCircle size={16} /> {t('help')}
          </NavLink>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-line space-y-1.5">
          <div className="grid grid-cols-3 gap-1 bg-bg3 p-1 rounded-md">
            {([
              ['warm', Sun],
              ['dark', Moon],
              ['system', Monitor],
            ] as const).map(([key, Icon]) => (
              <button
                key={key}
                onClick={() => setTheme(key)}
                title={key}
                className={`p-1.5 rounded flex items-center justify-center transition-all ${
                  theme === key ? 'bg-bg2 text-coral shadow-1' : 'text-ink-dim hover:text-ink-mid hover:bg-bg4'
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
          <button className="w-full flex items-center gap-1.5 px-3 py-2 text-[0.6rem] tracking-[0.1em] uppercase font-mono text-ink-mid border border-line rounded-md hover:border-line2 hover:bg-bg3">
            <Download size={12} /> Export CSV
          </button>
          <button className="w-full flex items-center gap-1.5 px-3 py-2 text-[0.6rem] tracking-[0.1em] uppercase font-mono text-ink-mid border border-line rounded-md hover:border-terra hover:text-terra hover:bg-coral-tint/60">
            <Trash2 size={12} /> Clear Data
          </button>
          {cloudEnabled && session && (
            <button
              onClick={async () => {
                if (confirm('Sign out of FinFlow?')) {
                  try { await authSignOut(); }
                  catch { /* even on error, the auth listener clears state */ }
                }
              }}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-[0.6rem] tracking-[0.1em] uppercase font-mono text-ink-mid border border-line rounded-md hover:border-coral hover:text-coral"
              title={session.user?.email || ''}
            >
              <LogOut size={12} /> Sign Out
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 36 36" width={32} height={32}>
      <defs>
        <radialGradient id="logo-grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#F4B6A8" />
          <stop offset="100%" stopColor="#E26D5C" />
        </radialGradient>
      </defs>
      <path d="M18 3 C 27 3, 33 9, 33 18 C 33 27, 27 33, 18 33 C 9 33, 3 27, 3 18 C 3 9, 9 3, 18 3 Z" fill="url(#logo-grad)" stroke="#2A2522" strokeWidth="1.2" />
      <ellipse cx="13" cy="16" rx="1.4" ry="1.8" fill="#2A2522" />
      <ellipse cx="23" cy="16" rx="1.4" ry="1.8" fill="#2A2522" />
      <circle cx="9.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
      <circle cx="26.5" cy="20" r="1.6" fill="#F4B6A8" opacity="0.8" />
      <path d="M14 22 Q 18 25, 22 22" stroke="#2A2522" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M18 3 Q 16 -1, 14 1 Q 17 3, 18 3 Z" fill="#85A88A" stroke="#2A2522" strokeWidth="0.8" />
    </svg>
  );
}
