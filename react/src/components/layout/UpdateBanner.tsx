import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { applyUpdate } from '../../lib/pwa';

/**
 * SW-free "new version available" prompt.
 *
 * The build stamps `dist/version.json` with package.json's version (see
 * vite.config.ts). The running bundle knows its own version via the
 * build-time `__APP_VERSION__` constant. We poll version.json with
 * `cache: 'no-store'` (so we always hit the network, never a cached copy)
 * and, when the deployed version differs from the running one, show a
 * dismissible banner with a Refresh action.
 *
 * This is the consumer app's update mechanism: there is no service worker,
 * and hashed assets are immutable-cached, so without this a user who keeps a
 * tab open never learns a new build shipped. Degrades to a no-op in dev
 * (version.json isn't served) and on any fetch error.
 */
const POLL_MS = 15 * 60 * 1000; // 15 minutes

export default function UpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [swWaiting, setSwWaiting] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/version.json', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: unknown };
      if (typeof data.version === 'string') setLatest(data.version);
    } catch {
      /* offline / dev / transient — ignore, try again next tick */
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const onSwUpdate = () => setSwWaiting(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    window.addEventListener('vyact:sw-update', onSwUpdate);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.removeEventListener('vyact:sw-update', onSwUpdate);
    };
  }, [check]);

  const updateAvailable = swWaiting || (latest !== null && latest !== __APP_VERSION__);
  if (!updateAvailable || dismissed) return null;

  function refresh() {
    if (swWaiting) {
      // Tell the waiting SW to take over; applyUpdate() reloads on 'controlling'.
      void applyUpdate();
    } else {
      window.location.reload();
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] w-[min(92vw,30rem)]
                 bg-bg2 border border-line2 rounded-lg shadow-3 px-4 py-3
                 flex items-center gap-3 animate-modalIn"
    >
      <RefreshCw size={18} className="text-coral flex-shrink-0" />
      <div className="flex-1 min-w-0 text-[0.84rem] text-ink leading-snug">
        A new version of Vyact{latest ? ` (v${latest})` : ''} is available.
        <span className="text-ink-dim"> Refresh to update.</span>
      </div>
      <button
        onClick={refresh}
        className="btn-primary py-1.5 px-3 text-xs flex-shrink-0"
      >
        Refresh
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notice"
        className="text-ink-dim hover:text-ink p-1 flex-shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
}
