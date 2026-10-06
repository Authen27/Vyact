// A household's calendar day and wall clock, on a server whose own clock is UTC (W3a, v10.65.0).
//
// Before this the webhook and the scheduler added a fixed 330 minutes (India time) for every
// household, and the SQL default fell back to the database's UTC current_date. Now the zone is the
// household's (`households.timezone`, IANA), read through Intl, so daylight saving is right too.
// An unknown or missing zone falls back to India time — the database default.

export const DEFAULT_TZ = 'Asia/Kolkata';

export interface ZoneParts {
  /** YYYY-MM-DD in the zone. */
  day: string;
  /** Minutes past local midnight. */
  minutes: number;
  /** 0 = Sunday … 6 = Saturday, in the zone. */
  weekday: number;
}

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function read(at: Date, zone: string): ZoneParts {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(at)) p[x.type] = x.value;
  return {
    day: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    weekday: WEEKDAY[p.weekday] ?? 0,
  };
}

/** The day, time and weekday of an instant in `tz` (India time when the zone is missing or unknown). */
export function zoneParts(at: Date, tz?: string | null): ZoneParts {
  try { return read(at, tz || DEFAULT_TZ); } catch { return read(at, DEFAULT_TZ); }
}

/** The calendar day (YYYY-MM-DD) of an instant in `tz`. */
export function localDayIn(at: Date, tz?: string | null): string {
  return zoneParts(at, tz).day;
}
