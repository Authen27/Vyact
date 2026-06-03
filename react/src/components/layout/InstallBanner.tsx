// Vyact v7.4.0 — InstallBanner
//
// Tiny, dismissible banner that surfaces:
//   • on Android / desktop Chrome / Edge once the browser fires
//     `beforeinstallprompt` — clicking "Install" calls promptInstall().
//   • on iOS Safari with a one-line "Add to Home Screen" tip (Safari does
//     not expose a programmatic install prompt).
//
// Hidden when:
//   • already running standalone (display-mode: standalone or
//     navigator.standalone), so installed users never see it.
//   • the user dismissed it this session (sessionStorage) OR more than
//     three times overall (localStorage counter) — keeps the nag low.

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { canPrompt, isIos, isStandalone, promptInstall } from '../../lib/pwa';

const SESSION_KEY = 'vt_install_banner_dismissed_session';
const COUNT_KEY = 'vt_install_banner_dismiss_count';
const MAX_DISMISSALS = 3;

export default function InstallBanner() {
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    const count = Number(localStorage.getItem(COUNT_KEY) || '0');
    if (count >= MAX_DISMISSALS) return;

    const onInstallable = () => setShow(true);
    const onInstalled = () => setShow(false);
    window.addEventListener('vyact:installable', onInstallable);
    window.addEventListener('vyact:installed', onInstalled);

    if (canPrompt()) setShow(true);

    // iOS path — show the hint after a short delay only if no prompt fires.
    if (isIos()) {
      const t = setTimeout(() => {
        if (!canPrompt()) {
          setIosHint(true);
          setShow(true);
        }
      }, 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener('vyact:installable', onInstallable);
        window.removeEventListener('vyact:installed', onInstalled);
      };
    }

    return () => {
      window.removeEventListener('vyact:installable', onInstallable);
      window.removeEventListener('vyact:installed', onInstalled);
    };
  }, []);

  if (!show) return null;

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1');
    const count = Number(localStorage.getItem(COUNT_KEY) || '0') + 1;
    localStorage.setItem(COUNT_KEY, String(count));
    setShow(false);
  }

  async function install() {
    const outcome = await promptInstall();
    if (outcome === 'accepted' || outcome === 'unavailable') setShow(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Install Vyact"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[60] bg-bg2 border border-line rounded-xl shadow-2 p-3.5 flex items-start gap-3 animate-[modalIn_180ms_ease-out]"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-md bg-coral/15 text-coral flex items-center justify-center">
        <Download size={18} strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-ink text-[0.92rem] mb-0.5">Install Vyact</div>
        {iosHint ? (
          <div className="text-[0.78rem] text-ink-mid leading-snug">
            Tap <span className="font-mono">Share</span> &rarr;{' '}
            <span className="font-mono">Add to Home Screen</span> to keep Vyact one tap away.
          </div>
        ) : (
          <div className="text-[0.78rem] text-ink-mid leading-snug">
            Add Vyact to your home screen for full-screen, offline-friendly access.
          </div>
        )}
        {!iosHint && (
          <button
            onClick={install}
            className="btn-primary mt-2 text-[0.72rem] py-1.5 px-3"
          >
            Install
          </button>
        )}
      </div>
      <button
        onClick={dismiss}
        className="row-action flex-shrink-0"
        aria-label="Dismiss install banner"
        title="Dismiss"
      >
        <X size={14} strokeWidth={1.8} />
      </button>
    </div>
  );
}
