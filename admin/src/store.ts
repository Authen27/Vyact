// FinFlow Admin — global state
// v6.2.3 — extended with Supabase session + server-side role hydrated from
// public.admin_roles. The `role` field is now derived from the server, not
// from a localStorage spoof — but the localStorage value is kept as a
// "preview" override so roles-admin or content-admin can be tested without
// re-granting privileges in the DB (only effective when the real server role
// is 'super', otherwise ignored).

import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { AdminRole } from './types';

interface Store {
  // Auth
  session: Session | null;
  sessionLoaded: boolean;
  serverRole: AdminRole | null;        // from public.admin_roles
  setSession: (s: Session | null, role: AdminRole | null, loaded?: boolean) => void;

  // Effective role used by route gating + nav.
  // For super admins, defaults to localStorage override so they can preview
  // roles-admin / content-admin without losing actual privileges.
  role: AdminRole;
  setRole: (r: AdminRole) => void;

  // UI
  darkMode: boolean;
  toggleDark: () => void;
  query: string;
  setQuery: (q: string) => void;
}

const previewRole = (localStorage.getItem('admin_role') as AdminRole) || 'super';

export const useAdminStore = create<Store>((set, get) => ({
  session: null,
  sessionLoaded: false,
  serverRole: null,
  setSession: (session, serverRole, loaded = true) => {
    // Effective role: if real role is super, allow the preview override to
    // simulate other tiers; otherwise force the real role.
    const role = serverRole === 'super' ? get().role : (serverRole || get().role);
    set({ session, serverRole, sessionLoaded: loaded, role });
  },

  role: previewRole,
  setRole: (role) => {
    // Only super admins can preview-switch to lower tiers
    if (get().serverRole !== 'super') return;
    localStorage.setItem('admin_role', role);
    set({ role });
  },

  darkMode: localStorage.getItem('admin_dark') === '1',
  toggleDark: () => set(s => {
    const next = !s.darkMode;
    localStorage.setItem('admin_dark', next ? '1' : '0');
    document.documentElement.classList.toggle('dark', next);
    return { darkMode: next };
  }),

  query: '',
  setQuery: (query) => set({ query }),
}));

// Initialize dark mode on load
if (localStorage.getItem('admin_dark') === '1') {
  document.documentElement.classList.add('dark');
}
