// Vyact — the app's errors reach Sentry (v10.132.0, Track Q4; audit OPS-06, FE-UIS-12; owner decision D9, 20 Oct
// 2026: "Sentry, EU, errors only, scrubbed, never replay").
//
// Until now an unexpected fault (a dropped write, a crash the ErrorBoundary caught, an uncaught error) went to the
// console of the device it happened on, and nowhere else. Now it is sent to Sentry, but only:
//   • from vyact.app or the Android app; never localhost, a preview, stage/dev or the demo;
//   • from a production build that has VITE_SENTRY_DSN (the vyact-web project's DSN, in Sentry's EU region).
// What is sent:
//   • the error's type and message, SCRUBBED (`scrub`): no email, id, token or number of two digits or more
//     (amounts, phones, account numbers), no query string; at most 300 characters;
//   • where it happened: the fault's context tag (`sync.flush…`, `render:ErrorBoundary`), the stack's file:line
//     frames, the page path with ids taken out, the app version and the platform.
// Never the screen, a replay, a trail of clicks, the person, the household, or anything they typed.
// No SDK (the landing page's budget, and every byte of the event is ours to see): one envelope POST per error, the
// same error once, at most 10 a page load. Network failures and an older build's missing chunk are expected in an
// offline-first app (lib/faults, lib/chunkRecovery) and are not sent.
// The Edge Functions' copy of scrub / parseDsn / framesOf is supabase/functions/_shared/errorReport.ts;
// errorReportParity.test.ts keeps them identical.
import { setFaultTransport } from './faults';
import { isChunkLoadError } from './chunkRecovery';
import { platform } from './analytics';
import { isNativeApp } from './feedbackWidget';

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

/** The page as Sentry sees it: the path only, with an invite token, ids, tokens and numbers taken out. */
export function cleanPath(pathname: string): string {
  return pathname
    .replace(/^\/invite\/[^/]+/, '/invite/:token')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/[A-Za-z0-9_-]{24,}/g, ':token')
    .replace(/\d{2,}/g, ':n');
}

/** Whether this page may report at all. Pure, for the tests. */
export function reportingAllowed(o: { dsn: string; host: string; native: boolean; demo: boolean; prod: boolean }): boolean {
  if (!o.prod || o.demo || !parseDsn(o.dsn)) return false;
  return o.native || o.host === 'vyact.app' || o.host === 'www.vyact.app';
}

const NETWORK = /failed to fetch|networkerror|network request failed|load failed|fetch failed/i;
const MAX_PER_LOAD = 10;
const sent = new Set<string>();

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');

/** The Sentry event for an error, or null when it is not one to send. Exported for the tests: this is all that leaves. */
export function eventFor(e: unknown, context: string, where = typeof location !== 'undefined' ? location : undefined) {
  const err = e instanceof Error ? e : new Error(typeof e === 'string' ? e : 'non-error thrown');
  if (NETWORK.test(err.message) || isChunkLoadError(err)) return null;
  return {
    event_id: hex(16),
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    logger: 'web',
    release: `vyact-web@${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}`,
    environment: 'production',
    tags: { context: scrub(context).slice(0, 80), platform: platform() },
    request: where ? { url: `${where.origin}${cleanPath(where.pathname)}` } : undefined,
    exception: { values: [{ type: err.name || 'Error', value: scrub(err.message), stacktrace: { frames: framesOf(err.stack) } }] },
  };
}

let dsn: Dsn | null = null;

/** Where reports go (null: nowhere), with a fresh page-load budget. startErrorReporting sets it; so do the tests. */
export function setReportDsn(raw: string | null): void {
  dsn = raw ? parseDsn(raw) : null;
  sent.clear();
}

/** Sends one error, if reporting is on: the same error once, at most 10 a page load. Never throws. */
export function reportError(e: unknown, context: string): void {
  if (!dsn) return;
  const event = eventFor(e, context);
  if (!event) return;
  const top = event.exception.values[0];
  const last = top.stacktrace.frames[top.stacktrace.frames.length - 1];
  const key = `${top.type}|${top.value}|${last?.filename ?? ''}:${last?.lineno ?? ''}`;
  if (sent.has(key) || sent.size >= MAX_PER_LOAD) return;
  sent.add(key);
  const body = `${JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() })}\n`
    + `${JSON.stringify({ type: 'event' })}\n${JSON.stringify(event)}\n`;
  // A text body (no Content-Type header) is a simple request: no preflight. The referrer is the origin only.
  void fetch(`${dsn.endpoint}?sentry_key=${dsn.key}&sentry_version=7`, {
    method: 'POST', body, keepalive: true, credentials: 'omit', referrerPolicy: 'origin',
  }).catch(() => { /* fault-ok: a report that cannot be sent is dropped; reporting it would loop */ });
}

/** Turns reporting on for this page (main.tsx), when it is allowed here. */
export function startErrorReporting(): void {
  if (typeof window === 'undefined') return;
  const env = import.meta.env;
  if (!reportingAllowed({ dsn: env.VITE_SENTRY_DSN ?? '', host: location.hostname, native: isNativeApp(), demo: env.VITE_DEMO === '1', prod: env.PROD })) return;
  setReportDsn(env.VITE_SENTRY_DSN ?? '');
  // An unexpected fault (a dropped write, a crash the ErrorBoundary caught).
  setFaultTransport((record, err) => reportError(err ?? new Error(record.message), record.context));
  // An error nothing caught: only from the app's own scripts (never an extension's or a widget's).
  window.addEventListener('error', (ev) => {
    if (ev.filename && !ev.filename.startsWith(location.origin)) return;
    reportError(ev.error ?? ev.message, 'window.error');
  });
  window.addEventListener('unhandledrejection', (ev) => {
    if (ev.reason instanceof Error) reportError(ev.reason, 'unhandledrejection');
  });
}
