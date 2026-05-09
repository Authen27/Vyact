// Lightweight custom hooks
import { useEffect, useCallback } from 'react';
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
