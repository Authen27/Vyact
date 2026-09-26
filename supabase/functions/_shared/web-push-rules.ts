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
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  household_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
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

/** What the service worker shows. The deep link is app-relative, never an outside URL. */
export function payloadFor(n: NotificationRow): PushPayload {
  const link = n.deep_link && n.deep_link.startsWith('/') && !n.deep_link.startsWith('//') ? n.deep_link : '/';
  return { title: n.title, body: n.body ?? '', url: link, tag: n.dedupe_key, type: n.type };
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
