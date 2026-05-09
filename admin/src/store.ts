// FinFlow Admin — minimal global state (current user role + theme)
import { create } from 'zustand';
import type { AdminRole } from './types';

interface Store {
  role: AdminRole;
  setRole: (r: AdminRole) => void;
  darkMode: boolean;
  toggleDark: () => void;
  query: string;
  setQuery: (q: string) => void;
}

export const useAdminStore = create<Store>((set) => ({
  role: (localStorage.getItem('admin_role') as AdminRole) || 'super',
  setRole: (role) => { localStorage.setItem('admin_role', role); set({ role }); },
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
