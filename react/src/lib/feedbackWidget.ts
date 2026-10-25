// Vyact — where the Userback feedback widget may load (v10.132.0, Track Q4; audit XC-PRV-03; owner, 20 Oct 2026:
// "off on localhost and the demo").
//
// The widget stays on every app page of the real site and in the Android app (D20: people send feedback from where
// they are, with a screenshot they choose to take). It never loads on a developer's machine or on the guest demo:
// nobody's feedback is wanted there, and a screenshot from either would send test or demo figures to Userback.
// The Android app serves its bundled pages from https://localhost (Capacitor), so it is told apart by `native`.
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|[^.]+\.localhost|.+\.test)$/i;

export function feedbackWidgetAllowed(hostname: string, demo: boolean, native = false): boolean {
  if (demo) return false;
  if (native) return true;
  const host = String(hostname ?? '').toLowerCase();
  return !!host && !LOCAL.test(host) && host !== 'demo.vyact.app';
}

/** True inside the Android app (Capacitor's bridge). */
export function isNativeApp(): boolean {
  try {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
    return Boolean(cap?.isNativePlatform?.());
  } catch { return false; }
}
