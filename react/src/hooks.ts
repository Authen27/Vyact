// Lightweight custom hooks
import { useEffect, useState, useCallback } from 'react';
import { useStore } from './store';
import { LOCALES } from './constants';

// useTranslation — returns t() bound to current language
export function useTranslation() {
  const lang = useStore(s => s.profile.language || 'en');
  const t = useCallback((key: string): string =>
    LOCALES[lang]?.strings?.[key] ?? LOCALES.en.strings[key] ?? key, [lang]);
  return { t, lang };
}

// useShortcuts — global keyboard shortcuts
export function useShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        if (e.key === 'Escape') (document.activeElement as HTMLElement)?.blur();
        return;
      }
      const handler = handlers[e.key];
      if (handler) { e.preventDefault(); handler(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers]);
}

// useScrollDirection — returns 'up' | 'down' | 'idle' based on window scroll.
// Used by AddFab to hide while the user is reading down the page and re-show
// the moment they scroll back up. Threshold filters out tiny scrolls.
export function useScrollDirection(threshold = 6): 'up' | 'down' | 'idle' {
  const [dir, setDir] = useState<'up' | 'down' | 'idle'>('idle');
  useEffect(() => {
    let last = window.scrollY;
    let ticking = false;
    function update() {
      const y = window.scrollY;
      const delta = y - last;
      if (Math.abs(delta) > threshold) {
        setDir(delta > 0 ? 'down' : 'up');
        last = y;
      }
      // Treat the very top of the page as idle so the FAB always shows there.
      if (y < 24) setDir('idle');
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return dir;
}

// useTheme — initialize theme on mount and listen for system changes
export function useTheme() {
  const setTheme = useStore(s => s.setTheme);
  const theme    = useStore(s => s.theme);
  useEffect(() => {
    setTheme(theme);
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, setTheme]);
}
