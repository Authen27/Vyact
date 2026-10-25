// Vyact — an Edge Function's failure reaches Sentry (v10.132.0, Track Q4; audit OPS-06; owner decision D9, 20 Oct
// 2026: "Sentry, EU, errors only, scrubbed, never replay").
//
// Inert until the SENTRY_DSN secret is set (the vyact-edge project's DSN, in Sentry's EU region). No SDK: one
// envelope POST per error, so no function loads anything new. What leaves:
//   • the error's type and its message, SCRUBBED (`scrub`): no email, no id, no token, no number of two digits or
//     more (amounts, phones, account numbers), no query string; at most 300 characters;
//   • the function's name and the stack's file:line frames (no source, no variables);
//   • never a request body, a header, a household's data, a person or an IP we know of.
// The app's copy of `scrub` is react/src/lib/errorReport.ts; errorReportParity.test.ts keeps them identical.

const env = (k: string) => (typeof Deno !== 'undefined' ? Deno.env.get(k) ?? '' : '');

/** Strips what could identify a person or carry their money from an error message. */
export function scrub(text: string): string {
  return String(text ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(https?:\/\/[^\s?#"']+)[?#][^\s"']*/gi, '$1')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[token]')
    .replace(/\d[\d,._]*\d/g, '[n]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export interface Dsn { endpoint: string; key: string }

/** `https://<key>@<host>/<project>` → the envelope endpoint and the public key. Anything else is no DSN. */
export function parseDsn(raw: string): Dsn | null {
  const m = /^https:\/\/([0-9a-f]{16,64})@([a-z0-9.-]+\.sentry\.io)\/(\d{1,20})$/i.exec(String(raw ?? '').trim());
  return m ? { endpoint: `https://${m[2]}/api/${m[3]}/envelope/`, key: m[1] } : null;
}

export interface Frame { filename: string; function: string; lineno?: number; colno?: number; in_app: boolean }

/** The stack's frames, oldest call first (as Sentry wants them), file paths without a query. */
export function framesOf(stack: string | undefined): Frame[] {
  const frames: Frame[] = [];
  for (const line of String(stack ?? '').split('\n').slice(0, 40)) {
    // V8: "    at fn (file:line:col)" or "    at file:line:col"; Firefox/Safari: "fn@file:line:col"
    const m = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/.exec(line) ?? /^\s*([^@\s]*)@(.+?):(\d+):(\d+)\s*$/.exec(line);
    if (!m) continue;
    const filename = m[2].replace(/[?#].*$/, '');
    frames.push({ filename, function: m[1] || '?', lineno: Number(m[3]), colno: Number(m[4]), in_app: !/node_modules|esm\.sh|deno\.land/.test(filename) });
  }
  return frames.reverse();
}

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');

/** The Sentry event for an error. Exported for the tests: this is everything that is sent. */
export function eventFor(e: unknown, fn: string, extraTags: Record<string, string> = {}) {
  const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'non-error thrown');
  return {
    event_id: hex(16),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    logger: 'edge',
    release: env('BUILD_SHA') ? `vyact-edge@${env('BUILD_SHA').slice(0, 12)}` : undefined,
    environment: 'production',
    tags: { function: fn, ...extraTags },
    exception: { values: [{ type: err.name || 'Error', value: scrub(err.message), stacktrace: { frames: framesOf(err.stack) } }] },
  };
}

/** Sends one error to Sentry, if configured. Never throws, never waits more than 3 seconds. */
export async function reportError(fn: string, e: unknown, tags: Record<string, string> = {}): Promise<void> {
  const dsn = parseDsn(env('SENTRY_DSN'));
  if (!dsn) return;
  const event = eventFor(e, fn, tags);
  const body = `${JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() })}\n`
    + `${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
  try {
    await fetch(`${dsn.endpoint}?sentry_key=${dsn.key}&sentry_version=7`, {
      method: 'POST', body, signal: AbortSignal.timeout(3000),
      headers: { 'Content-Type': 'application/x-sentry-envelope' },
    });
  } catch (err) {
    console.error('[error-report] not sent', (err as Error)?.name);
  }
}
