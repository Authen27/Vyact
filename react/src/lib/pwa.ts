// Vyact v7.4.0 — PWA registration + install lifecycle
//
// Three responsibilities, kept here so the UI components stay thin:
//   1. Register the service worker (production only) and dispatch a custom
//      `vyact:sw-update` event when a fresh build is waiting to activate.
//      InstallBanner / UpdateBanner can subscribe and offer the user a
//      one-tap "Reload to update" action.
//   2. Capture the `beforeinstallprompt` event for Android / desktop Chrome
//      / Edge so we can show our own install affordance later, and emit a
//      `vyact:installable` event so React can react.
//   3. Detect iOS Safari (which doesn't fire beforeinstallprompt) and
//      surface an "Add to Home Screen" hint — same event channel.
//
// Nothing here imports React; the UI layer talks to this via window events.

import type { Workbox } from 'workbox-window';

let wb: Workbox | undefined;
let deferredPrompt: BeforeInstallPromptEvent | undefined;

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari uses navigator.standalone; everyone else uses the display-mode media query.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
}

export function canPrompt(): boolean {
  return deferredPrompt !== undefined;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = undefined;
  window.dispatchEvent(new CustomEvent('vyact:install-resolved', { detail: choice.outcome }));
  return choice.outcome;
}

export async function applyUpdate(): Promise<void> {
  if (!wb) return;
  // Tell the waiting SW to take over, then reload once it's controlling.
  wb.addEventListener('controlling', () => window.location.reload());
  await wb.messageSkipWaiting();
}

export async function registerPwa(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  // Only register the production-built SW; dev SW is opt-in via vite.config.
  if (import.meta.env.DEV) return;

  // Capture install prompt eagerly — fires before our React tree mounts on
  // some browsers, so we listen at the module level.
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('vyact:installable'));
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = undefined;
    window.dispatchEvent(new Event('vyact:installed'));
  });

  try {
    const { Workbox } = await import('workbox-window');
    wb = new Workbox('/sw.js', { scope: '/' });
    wb.addEventListener('waiting', () => {
      window.dispatchEvent(new Event('vyact:sw-update'));
    });
    await wb.register();
  } catch (err) {
    // Service worker registration failures must never break the app shell.
    console.warn('[pwa] SW registration failed', err);
  }
}
