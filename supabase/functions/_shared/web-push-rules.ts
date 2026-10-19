// Which notification reaches which device's lock screen (v10.48.0, TD-22).
//
// Pure, so the whole decision is unit-tested. It mirrors what the app did locally
// before push existed (notifySlice): only action-required (P1) notifications, only
// types the person left on, never inside their quiet hours. Quiet hours are read in
// the DEVICE's own time zone, which the app sends when it subscribes.

export interface PushPrefs {
  master?: boolean;
  perType?: Record<string, boolean>;
  quietStart?: string;   // "22:00"
  quietEnd?: string;     // "07:00"
  /** v10.126.0 (T4c, BE-FN-12) — false: send the private line, not the amounts and names. Absent means on. */
  lockScreenDetails?: boolean;
}

/** The private title and body for a type: the app's `lockScreenText`, read through the bundled engine. */
export type PrivateText = (type: string) => { title: string; body: string };

export interface SubscriptionRow {
  id: string;
  user_id: string;
  household_id: string;
  /** v10.127.0 (T4d): 'webpush' (a browser: endpoint + keys) or 'fcm' (the Android app: fcm_token). Absent = webpush. */
  kind?: 'webpush' | 'fcm';
  fcm_token?: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  tz: string | null;
  prefs: PushPrefs | null;
  created_at: string;
  disabled_at: string | null;
}

export interface NotificationRow {
  id: string;
  household_id: string;
  type: string;
  priority: 'P1' | 'P2';
  title: string;
  body: string | null;
  status: 'unread' | 'read' | 'dismissed';
  created_at: string;
  deep_link: string | null;
  dedupe_key: string;
}

export const DEFAULT_TZ = 'Asia/Kolkata';

/** Minutes past midnight in `tz` (an unknown zone falls back to India time). */
export function localMinutes(now: Date, tz: string | null): number {
  const read = (zone: string) => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(now);
    const h = Number(parts.find((p) => p.type === 'hour')?.value);
    const m = Number(parts.find((p) => p.type === 'minute')?.value);
    return h * 60 + m;
  };
  try { return read(tz || DEFAULT_TZ); } catch { return read(DEFAULT_TZ); }
}

const toMinutes = (hhmm: string | undefined, fallback: number) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
};

/** The app's isInQuietHours, evaluated in the device's zone. */
export function inQuietHours(prefs: PushPrefs | null, tz: string | null, now: Date): boolean {
  const start = toMinutes(prefs?.quietStart, 22 * 60);
  const end = toMinutes(prefs?.quietEnd, 7 * 60);
  if (start === end) return false;
  const cur = localMinutes(now, tz);
  return start > end ? cur >= start || cur < end : cur >= start && cur < end;
}

export type SkipReason =
  | 'other_household' | 'not_action_required' | 'already_seen' | 'before_subscribed'
  | 'all_off' | 'type_off' | 'quiet_hours' | 'device_disabled';

/** Push this notification to this device? Null means yes; otherwise why not. */
export function skipReason(n: NotificationRow, sub: SubscriptionRow, now: Date): SkipReason | null {
  if (sub.disabled_at) return 'device_disabled';
  if (n.household_id !== sub.household_id) return 'other_household';
  if (n.priority !== 'P1') return 'not_action_required';
  if (n.status !== 'unread') return 'already_seen';
  // Never a backlog: a device hears about what was raised after it subscribed.
  if (Date.parse(n.created_at) < Date.parse(sub.created_at) - 60_000) return 'before_subscribed';
  const prefs = sub.prefs ?? {};
  if (prefs.master === false) return 'all_off';
  if (prefs.perType?.[n.type] === false) return 'type_off';
  if (inQuietHours(prefs, sub.tz, now)) return 'quiet_hours';
  return null;
}

export interface PushPayload { title: string; body: string; url: string; tag: string; type: string }

/**
 * What the service worker shows. The deep link is app-relative, never an outside URL: "//host" and
 * "/\host" (which browsers read as "//host") are refused too (T2b-2). It always fits the push limit.
 * v10.126.0 (T4c; audit BE-FN-12; owner: "show by default, and hide via settings"): a device whose
 * "Show details on the lock screen" is off gets the private line for the type instead of the title and body.
 */
export function payloadFor(n: NotificationRow, prefs?: PushPrefs | null, privateText?: PrivateText): PushPayload {
  const link = n.deep_link && /^\/(?![/\\])/.test(n.deep_link) ? n.deep_link : '/';
  const hide = prefs?.lockScreenDetails === false;
  const text = hide && privateText ? privateText(n.type)
    : hide ? { title: 'Vyact', body: 'You have a new notification. Open Vyact to see it.' }
    : { title: n.title, body: n.body ?? '' };
  return fitPayload({ title: text.title, body: text.body, url: link, tag: n.dedupe_key, type: n.type });
}

/** v10.116.0 (T2b-2, BE-FN-07) — the plaintext limit `encryptPayload` enforces (web-push.ts MAX_PAYLOAD_BYTES). */
export const PAYLOAD_LIMIT_BYTES = 3000;
const payloadBytes = (p: PushPayload) => new TextEncoder().encode(JSON.stringify(p)).length;

/**
 * BE-FN-07 — a notification too long for a push is shortened to fit, never refused: the body first,
 * then the title (each ending in "…"), and only then the link and tag. A refused one used to fail its
 * send every run until the 24-hour window closed.
 */
export function fitPayload(p: PushPayload, limit = PAYLOAD_LIMIT_BYTES): PushPayload {
  if (payloadBytes(p) <= limit) return p;
  let out: PushPayload = { ...p };
  for (const field of ['body', 'title'] as const) {
    const chars = Array.from(p[field]);
    const withPrefix = (k: number) => ({ ...out, [field]: k ? `${chars.slice(0, k).join('')}…` : '' });
    let lo = 0;
    let hi = chars.length - 1;          // the longest prefix that fits with its "…"
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (payloadBytes(withPrefix(mid)) <= limit) lo = mid; else hi = mid - 1;
    }
    out = withPrefix(Math.max(lo, 0));
    if (payloadBytes(out) <= limit) return out;
  }
  return { ...out, url: '/', tag: Array.from(out.tag).slice(0, 64).join('') };
}

export function testPayload(now: Date, tz: string | null): PushPayload {
  const mins = localMinutes(now, tz);
  const hhmm = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  return {
    title: 'Vyact notifications are on',
    body: `This is a test sent at ${hhmm}. Bills due, budgets at 80% and balances to check will arrive like this.`,
    url: '/settings', tag: `vyact-test-${now.getTime()}`, type: 'test',
  };
}
