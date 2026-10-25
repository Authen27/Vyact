// Q4-001..014 — v10.132.0 (Track Q4; audit OPS-06, DB-OPS-08, FE-UIS-12, Q-WA-01, XC-PRV-03; owner decision D9 and
// 20 Oct 2026 decisions). Errors reach Sentry, scrubbed, from vyact.app, the Android app and the Edge Functions only;
// every scheduled job records its runs and job-health emails the owner about one that failed or stopped; Userback
// stays off on localhost and the demo; the weekly WhatsApp summary is an insight, like the digest.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as app from '../errorReport';
import * as edge from '../../../../supabase/functions/_shared/errorReport';
import { setFaultTransport, unexpected } from '../faults';
import { feedbackWidgetAllowed } from '../feedbackWidget';
import { POLICY_CHANGES, POLICY_VERSION } from '../policyVersion';
import { withJobRun } from '../../../../supabase/functions/_shared/jobRuns';
import { TEMPLATES } from '../../../../supabase/functions/_shared/whatsapp-templates';
import { DEFAULT_PREFS, refusalFor, prefsSummary, consentOf } from '../../../../supabase/functions/_shared/whatsapp-prefs';
import { captureHandler, queryResult } from './helpers/edgeHarness';

const api = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2.45.0', () => ({ createClient: () => api }));
vi.mock('https://deno.land/x/denomailer@1.6.0/mod.ts', () => ({ SMTPClient: class { send() {} close() {} } }));
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}'))); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); setFaultTransport(null); app.setReportDsn(null); });

const repo = new URL('../../../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, repo), 'utf8');
const DSN = 'https://0123456789abcdef0123456789abcdef@o4506123456789504.ingest.de.sentry.io/4506123456789512';
const ENDPOINT = 'https://o4506123456789504.ingest.de.sentry.io/api/4506123456789512/envelope/';
const CHROME_STACK = `TypeError: x is undefined
    at saveTxn (https://vyact.app/assets/index-abc.js?v=2:10:20)
    at https://vyact.app/assets/vendor-def.js:5:6`;
const envelopeOf = (body: string) => body.trim().split('\n').map(l => JSON.parse(l));

describe('error reports leave scrubbed (OPS-06, FE-UIS-12)', () => {
  it('Q4-001 · scrub takes out emails, ids, tokens, numbers and query strings, and caps the message', () => {
    const raw = 'save failed for asha.r@example.com: ₹1,23,456.78 on 9876543210 at https://x.supabase.co/rest/v1/transactions?id=eq.5#f '
      + 'row 3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f token eyJhbGciOiJIUzI1NiJ9abcdefghij';
    const out = app.scrub(raw);
    expect(out).toBe('save failed for [email]: ₹[n] on [n] at https://x.supabase.co/rest/v1/transactions row [id] token [token]');
    expect(out).not.toMatch(/\d\d|@|\?|eyJ/);
    expect(app.scrub('a'.repeat(50) + ' b'.repeat(400))).toHaveLength(300);
    expect(app.scrub('step 3 of a sync')).toBe('step 3 of a sync');            // a single digit is no amount
  });

  it('Q4-002 · a DSN must be Sentry\'s; frames come oldest first, without a query', () => {
    expect(app.parseDsn(DSN)).toEqual({ endpoint: ENDPOINT, key: '0123456789abcdef0123456789abcdef' });
    for (const bad of ['', 'https://key@evil.example/1', 'http://0123456789abcdef@o1.ingest.de.sentry.io/1', 'https://k@o1.ingest.de.sentry.io/1'])
      expect(app.parseDsn(bad), bad).toBeNull();
    expect(app.framesOf(CHROME_STACK)).toEqual([
      { filename: 'https://vyact.app/assets/vendor-def.js', function: '?', lineno: 5, colno: 6, in_app: true },
      { filename: 'https://vyact.app/assets/index-abc.js', function: 'saveTxn', lineno: 10, colno: 20, in_app: true },
    ]);
    expect(app.framesOf('save@https://vyact.app/assets/a.js:1:2\n@https://esm.sh/x.js:3:4')).toEqual([
      { filename: 'https://esm.sh/x.js', function: '?', lineno: 3, colno: 4, in_app: false },
      { filename: 'https://vyact.app/assets/a.js', function: 'save', lineno: 1, colno: 2, in_app: true },
    ]);
  });

  it('Q4-003 · the Edge Functions scrub exactly as the app does (one rule, two copies)', () => {
    for (const fn of ['scrub', 'parseDsn', 'framesOf'] as const) expect(String(edge[fn]), fn).toBe(String(app[fn]));
    for (const s of ['user a@b.co paid 1,500', 'GET https://h/x?token=abc failed', CHROME_STACK]) expect(edge.scrub(s)).toBe(app.scrub(s));
  });

  it('Q4-004 · only a production build on vyact.app or in the Android app reports; never the demo, a preview or localhost', () => {
    const base = { dsn: DSN, host: 'vyact.app', native: false, demo: false, prod: true };
    expect(app.reportingAllowed(base)).toBe(true);
    expect(app.reportingAllowed({ ...base, host: 'www.vyact.app' })).toBe(true);
    expect(app.reportingAllowed({ ...base, host: 'localhost', native: true })).toBe(true);          // the Android app
    for (const o of [{ host: 'localhost' }, { host: 'vyact-git-fix-x.vercel.app' }, { host: 'stage.vyact.app' }, { demo: true, host: 'demo.vyact.app' },
      { demo: true, native: true }, { prod: false }, { dsn: '' }, { dsn: 'https://k@evil.example/1' }])
      expect(app.reportingAllowed({ ...base, ...o }), JSON.stringify(o)).toBe(false);
  });

  it('Q4-005 · the event holds the scrubbed error, where it happened and nothing else; network and chunk errors are not sent', () => {
    const err = new TypeError('could not save ₹2,400 for asha@example.com');
    err.stack = CHROME_STACK;
    const where = { origin: 'https://vyact.app', pathname: '/invite/tok_abcdefghijklmnopqrstuvwxyz/accept' } as Location;
    const ev = app.eventFor(err, 'sync.flush:dropped-op', where)!;
    expect(ev.exception.values[0]).toMatchObject({ type: 'TypeError', value: 'could not save ₹[n] for [email]' });
    expect(ev.request).toEqual({ url: 'https://vyact.app/invite/:token/accept' });
    expect(ev.tags).toEqual({ context: 'sync.flush:dropped-op', platform: 'web' });
    expect(Object.keys(ev).sort()).toEqual(['environment', 'event_id', 'exception', 'level', 'logger', 'platform', 'release', 'request', 'tags', 'timestamp']);
    expect(JSON.stringify(ev)).not.toMatch(/asha|2,400/);
    expect(app.cleanPath('/transactions/3f2b8c1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f/edit')).toBe('/transactions/:id/edit');
    expect(app.eventFor(new TypeError('Failed to fetch'), 'x')).toBeNull();
    expect(app.eventFor(new Error('Failed to fetch dynamically imported module: /assets/a.js'), 'x')).toBeNull();
  });

  it('Q4-006 · one envelope per error, a simple request, the same error once and at most 10 a page load; nothing without a DSN', async () => {
    app.reportError(new Error('boom'), 'x');
    expect(fetch).not.toHaveBeenCalled();
    app.setReportDsn(DSN);
    const err = new Error('boom 42');
    err.stack = CHROME_STACK;
    app.reportError(err, 'render:ErrorBoundary');
    app.reportError(err, 'render:ErrorBoundary');
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENDPOINT}?sentry_key=0123456789abcdef0123456789abcdef&sentry_version=7`);
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit', referrerPolicy: 'origin' });
    expect(init.headers).toBeUndefined();                                      // text body: no preflight
    const [head, item, event] = envelopeOf(String(init.body));
    expect(item).toEqual({ type: 'event' });
    expect(head.event_id).toBe(event.event_id);
    expect(event.exception.values[0].value).toBe('boom [n]');
    for (let i = 0; i < 20; i++) app.reportError(new Error(`different ${'x'.repeat(i)}`), 'x');
    expect(fetch).toHaveBeenCalledTimes(10);
  });

  it('Q4-007 · faults hand the error to the reporter; main.tsx starts it first; the CSP, Privacy and the policy say so', () => {
    const seen: unknown[] = [];
    setFaultTransport((record, err) => seen.push([record.context, err]));
    const err = new Error('dropped write');
    unexpected(err, 'sync.flush');
    expect(seen).toEqual([['sync.flush', err]]);
    const main = read('react/src/main.tsx');
    expect(main.indexOf('startErrorReporting();')).toBeGreaterThan(0);
    expect(main.indexOf('startErrorReporting();')).toBeLessThan(main.indexOf('ReactDOM.createRoot'));
    expect(read('react/src/lib/errorReport.ts')).toMatch(/setFaultTransport\(\(record, err\) => reportError\(/);
    expect(read('react/src/components/ui/ErrorBoundary.tsx')).toMatch(/unexpected\(error, 'render:ErrorBoundary'\)/);
    const csp = (JSON.parse(read('react/vercel.json')).headers as { headers: { key: string; value: string }[] }[])
      .flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy-Report-Only')!.value;
    expect(csp).toMatch(/connect-src [^;]*https:\/\/\*\.ingest\.de\.sentry\.io/);
    const privacy = read('react/src/pages/Privacy.tsx');
    expect(privacy).toMatch(/<strong className="text-ink">Sentry<\/strong> \(Functional Software, EU data region, Germany\)/);
    expect(privacy).toContain('error reports in the European Union (Sentry, Germany)');
    expect(POLICY_VERSION).toBe('2026-10-25');
    expect(POLICY_CHANGES.join(' ')).toMatch(/Sentry in the European Union/);
    expect(read('react/.env.production')).toMatch(/^VITE_SENTRY_DSN=/m);
  });
});

describe('every scheduled run is recorded, and the owner hears about a broken one (OPS-06, DB-OPS-08)', () => {
  const adminWith = (rpc = vi.fn().mockResolvedValue({ data: 1, error: null })) => ({ rpc }) as unknown as Parameters<typeof withJobRun>[0];

  it('Q4-008 · withJobRun records ok, partial and failed runs; a failure is reported and rethrown; recording never decides the answer', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null });
    const admin = adminWith(rpc);
    expect(await withJobRun(admin, 'recurring-post', async () => ({ posted: 2, errors: 0 }), (s) => ({ status: s.errors ? 'partial' : 'ok', summary: s })))
      .toEqual({ posted: 2, errors: 0 });
    await withJobRun(admin, 'recurring-post', async () => ({ posted: 1, errors: 1 }), (s) => ({ status: s.errors ? 'partial' : 'ok', summary: s, error: 'one schedule' }));
    vi.stubGlobal('Deno', { env: { get: (k: string) => (k === 'SENTRY_DSN' ? DSN : '') } });
    await expect(withJobRun(admin, 'web-push-dispatch', async () => { throw new Error('subscriptions: timeout for a@b.co'); }, () => ({ status: 'ok', summary: {} })))
      .rejects.toThrow('subscriptions: timeout');
    expect(rpc.mock.calls.map(c => [c[0], c[1].p_job, c[1].p_status, c[1].p_summary, c[1].p_error])).toEqual([
      ['record_job_run', 'recurring-post', 'ok', { posted: 2, errors: 0 }, null],
      ['record_job_run', 'recurring-post', 'partial', { posted: 1, errors: 1 }, 'one schedule'],
      ['record_job_run', 'web-push-dispatch', 'failed', {}, 'subscriptions: timeout for a@b.co'],
    ]);
    // The failure reached Sentry, scrubbed, tagged with the job.
    const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${ENDPOINT}?sentry_key=0123456789abcdef0123456789abcdef&sentry_version=7`);
    const event = envelopeOf(String(init.body))[2];
    expect(event.exception.values[0].value).toBe('subscriptions: timeout for [email]');
    expect(event.tags).toEqual({ function: 'web-push-dispatch' });
    // A run that cannot be recorded still answers.
    const broken = adminWith(vi.fn().mockRejectedValue(new Error('db down')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await withJobRun(broken, 'job-health', async () => 7, () => ({ status: 'ok', summary: {} }))).toBe(7);
  });

  it('Q4-009 · each Edge job records under its cron job\'s name, and a part that failed makes the run partial', async () => {
    const handler = await captureHandler(() => import('../../../../supabase/functions/recurring-post/index'));
    api.rpc.mockImplementation(async (name: string) => ({ data: name === 'recurring_post_cron_ok' ? true : 1, error: null }));
    api.from.mockImplementation(() => queryResult([]));
    const res = await handler(new Request('https://edge.example.com/recurring-post', { method: 'POST', headers: { 'x-cron-secret': 'c'.repeat(64) } }));
    expect(await res.json()).toEqual({ schedules: 0, posted: 0, alreadyPosted: 0, fastForwarded: 0, finished: 0, errors: 0 });
    expect(api.rpc).toHaveBeenCalledWith('record_job_run', expect.objectContaining({ p_job: 'recurring-post', p_status: 'ok' }));
    expect(read('supabase/functions/web-push/index.ts')).toMatch(/withJobRun\(admin, 'web-push-dispatch', \(\) => dispatch\(admin, new Date\(\)\), dispatchOutcome\)/);
    expect(read('supabase/functions/whatsapp-webhook/index.ts')).toMatch(/withJobRun\(supabase, 'whatsapp-inbox-sweep', \(\) => sweepInbox\(supabase\)/);
    expect(read('supabase/functions/whatsapp-dispatch/index.ts')).toMatch(/withJobRun\(admin, `whatsapp-dispatch-\$\{job\}`, \(\) => runDispatch\(/);
    const dispatch = await import('../../../../supabase/functions/whatsapp-dispatch/index');
    expect(dispatch.runOutcome({ planned: 2, results: { sent: 2 }, problems: [] })).toEqual({ status: 'ok', summary: { planned: 2, sent: 2, problems: 0 }, error: undefined });
    expect(dispatch.runOutcome({ planned: 2, results: { sent: 1, 'failed:meta_error': 1 }, problems: [] }))
      .toMatchObject({ status: 'partial', error: '1 send(s) failed' });
    expect(dispatch.runOutcome({ planned: 0, results: {}, problems: ['h: weekly transactions: timeout'] }))
      .toMatchObject({ status: 'partial', summary: { problems: 1 }, error: 'h: weekly transactions: timeout' });
    const push = await import('../../../../supabase/functions/web-push/index');
    expect(push.dispatchOutcome({ households: 0, raised: 0, pushed: 0, skipped: {} })).toEqual({ status: 'ok', summary: { households: 0, raised: 0, pushed: 0, problems: 0 }, error: undefined });
    expect(push.dispatchOutcome({ households: 2, raised: 1, raiseDeferred: 0, considered: 3, deferred: 1, pushed: 2, skipped: { quiet_hours: 1 }, problems: ['h: raise: x'] }))
      .toEqual({ status: 'partial', error: 'h: raise: x',
        summary: { households: 2, raised: 1, pushed: 2, problems: 1, considered: 3, deferred: 1, raiseDeferred: 0, skipped_quiet_hours: 1 } });
  });

  it('Q4-010 · job-health emails the owner once per problem a day, gives the claim back when the email fails, and is inert unconfigured', async () => {
    const load = () => import('../../../../supabase/functions/job-health/index');
    const rows = [
      { job: 'recurring-post', every_minutes: 30, last_started_at: '2026-10-25T10:10:00Z', last_status: 'failed', last_error: 'schedules: <b>timeout</b>', problem: 'failed' },
      { job: 'whatsapp-inbox-sweep', every_minutes: 5, last_started_at: '2026-10-25T09:00:00Z', last_status: 'ok', last_error: null, problem: 'late' },
      { job: 'job-health', every_minutes: 60, last_started_at: null, last_status: null, last_error: null, problem: 'late' },
      { job: 'web-push-dispatch', every_minutes: 15, last_started_at: '2026-10-25T10:30:00Z', last_status: 'ok', last_error: null, problem: null },
    ];
    let claims = 0;
    const releases: unknown[] = [];
    api.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
      if (name === 'job_health_cron_ok') return { data: args.p === 'h'.repeat(64), error: null };
      if (name === 'job_health') return { data: rows, error: null };
      if (name === 'claim_job_alert') return { data: ++claims !== 2, error: null };       // the sweep's was sent today already
      if (name === 'release_job_alert') { releases.push(args); return { data: null, error: null }; }
      if (name === 'ai_ceiling_state') return { data: { calls: 100, ceiling: 5000 }, error: null };   // Q7: well below half
      return { data: 1, error: null };
    });
    // Unconfigured: counted, not emailed.
    let handler = await captureHandler(load);
    const call = (h: typeof handler, secret = 'h'.repeat(64)) => h(new Request('https://edge.example.com/job-health', { method: 'POST', headers: { 'x-cron-secret': secret } }));
    expect((await call(handler, 'x'.repeat(64))).status).toBe(403);
    expect(await (await call(handler)).json()).toEqual({ problems: 2, emailed: 0, email: 'not_configured', spend_pct: 2 });
    // Configured: one email for what was claimed.
    vi.resetModules();
    handler = await captureHandler(load, { HEALTH_ALERT_EMAIL: 'owner@vyact.app', MAILERSEND_API_KEY: 'ms-key' });
    expect(await (await call(handler)).json()).toEqual({ problems: 2, emailed: 1, spend_pct: 2 });
    const mail = JSON.parse(String((vi.mocked(fetch).mock.calls[0] as [string, RequestInit])[1].body));
    expect(mail.to).toEqual([{ email: 'owner@vyact.app' }]);
    expect(mail.subject).toBe('Vyact: a scheduled job needs a look');
    expect(mail.text).toContain('recurring-post failed at 2026-10-25 10:10 UTC: schedules: <b>timeout</b>');
    expect(mail.html).toContain('schedules: &lt;b&gt;timeout&lt;/b&gt;');                // escaped
    expect(mail.html).toContain('https://admin.vyact.app/health');
    expect(api.rpc).toHaveBeenCalledWith('record_job_run', expect.objectContaining({ p_job: 'job-health', p_status: 'ok', p_summary: { problems: 2, emailed: 1, spend_pct: 2 } }));
    // The email fails: the claims are given back, the run is failed.
    claims = 0;
    vi.mocked(fetch).mockResolvedValue(new Response('{}', { status: 500 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await call(handler)).status).toBe(500);
    expect(releases).toEqual([{ p_job: 'recurring-post', p_kind: 'failed' }]);
    expect(api.rpc).toHaveBeenCalledWith('record_job_run', expect.objectContaining({ p_job: 'job-health', p_status: 'failed' }));
    const mod = await load();
    expect(mod.problemLine(rows[1] as never)).toBe('whatsapp-inbox-sweep has not run since 2026-10-25 09:00 UTC (it runs every 5 minutes).');
    expect(mod.alertEmail(['a', 'b']).subject).toBe('Vyact: 2 scheduled jobs need a look');
  });

  it('Q4-011 · job-health is deployed without a user JWT, in production and on vyact-test', () => {
    for (const wf of ['.github/workflows/deploy.yml', '.github/workflows/deploy-test-functions.yml'])
      expect(read(wf), wf).toMatch(/NO_JWT="[^"]*\bjob-health\b[^"]*"/);
  });
});

describe('Userback stays off on localhost and the demo (XC-PRV-03)', () => {
  it('Q4-012 · the widget loads on the real site and in the Android app, never on localhost, a .test host or the demo', () => {
    expect(feedbackWidgetAllowed('vyact.app', false)).toBe(true);
    expect(feedbackWidgetAllowed('localhost', false, true)).toBe(true);                 // the Android app
    for (const [host, demo] of [['localhost', false], ['127.0.0.1', false], ['app.localhost', false], ['vyact.test', false],
      ['demo.vyact.app', false], ['vyact.app', true], ['', false]] as const)
      expect(feedbackWidgetAllowed(host, demo), `${host} ${demo}`).toBe(false);
    expect(read('react/src/main.tsx')).toMatch(/if \(feedbackWidgetAllowed\(window\.location\.hostname, import\.meta\.env\.VITE_DEMO === '1', isNativeApp\(\)\)\) \{\r?\n {2}if \(onLanding\)/);
  });
});

describe('the weekly WhatsApp summary is an insight (Q-WA-01)', () => {
  it('Q4-013 · it needs insights consent, like the digest; Settings and "Messages I send you" say which switch sends what', () => {
    expect(consentOf(TEMPLATES.weekly_summary)).toBe('insights');
    expect(refusalFor(TEMPLATES.weekly_summary, DEFAULT_PREFS)).toBe('insights_consent_required');
    expect(refusalFor(TEMPLATES.weekly_summary, { ...DEFAULT_PREFS, insights_opt_in: true })).toBeNull();
    expect(refusalFor(TEMPLATES.weekly_summary, { ...DEFAULT_PREFS, marketing_opt_in: true })).toBe('insights_consent_required');
    expect(refusalFor(TEMPLATES.weekly_summary, { ...DEFAULT_PREFS, insights_opt_in: true, muted_topics: ['weekly'] })).toBe('muted');
    expect(refusalFor(TEMPLATES.balance_stale_nudge, { ...DEFAULT_PREFS, insights_opt_in: true })).toBe('marketing_consent_required');
    const summary = prefsSummary({ ...DEFAULT_PREFS, insights_opt_in: true }, 'https://vyact.app');
    expect(summary).toMatch(/What I send you here:\n(• .*\n)*• Insights: payday, the evening digest, the weekly summary and the month close/);
    expect(summary).toMatch(/Off:\n(• .*\n)*• Tips and reminders/);
    const settings = read('react/src/components/settings/WhatsAppLink.tsx');
    expect(settings).toContain("{ id: 'weekly', label: 'Weekly summary', hint: 'On Sunday at 6 pm, what you spent that week and the top category.' }");
    expect(settings).toContain('Payday, the evening digest, the weekly summary and the month close read your figures');
    expect(settings).not.toContain('Tips, weekly summary and reminders');
  });

  it('Q4-014 · the weekly job plans the summary for people with insights on, and the nudges only with marketing on', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-25T12:35:00Z'), toFake: ['Date'] });   // Sunday 18:05 in Kolkata
    const handler = await captureHandler(() => import('../../../../supabase/functions/whatsapp-dispatch/index'), { WHATSAPP_DISPATCH_SECRET: 's3cret' });
    const audits: { profile_id: string; payload: { templateName: string; result: { reason?: string } } }[] = [];
    api.from.mockImplementation((table: string) => {
      if (table === 'memberships') return queryResult({ id: 'membership' });
      if (table === 'whatsapp_identities') {
        const q = queryResult([{ profile_id: 'ins', household_id: 'h' }, { profile_id: 'mkt', household_id: 'h' }, { profile_id: 'none', household_id: 'h' }]);
        q.maybeSingle.mockReturnValue(queryResult({ phone_number: '222', household_id: 'h' }));
        return q;
      }
      if (table === 'households') return queryResult({ id: 'h', base_currency: 'INR', timezone: 'Asia/Kolkata' });
      if (table === 'whatsapp_preferences') {
        const q = queryResult([{ profile_id: 'ins', insights_opt_in: true, marketing_opt_in: false },
          { profile_id: 'mkt', insights_opt_in: false, marketing_opt_in: true }]);
        q.maybeSingle.mockReturnValue(queryResult(null));
        return q;
      }
      if (table === 'transactions') {
        const q = queryResult([{ id: 't1', household_id: 'h', created_by: 'ins', type: 'expense', amount: 640, currency: 'INR',
          date: '2026-10-24', category: 'food_dining', account_id: 'a1', extras: null, created_at: '2026-10-24T08:00:00Z' }]);
        q.maybeSingle.mockReturnValue(queryResult({ created_at: '2026-10-14T08:00:00Z' }));   // quiet for 11 days: a nudge is due
        return q;
      }
      if (table === 'accounts') return queryResult([]);
      if (table === 'profiles') return queryResult([{ id: 'ins', display_name: 'Ira' }, { id: 'mkt', display_name: 'Mo' }]);
      if (table === 'whatsapp_inbound_messages') {
        const q = queryResult(null);
        q.insert.mockImplementation((row: (typeof audits)[number]) => { audits.push(row); return q; });
        return q;
      }
      throw new Error(`Unexpected table ${table}`);
    });
    api.rpc.mockResolvedValue({ data: 1, error: null });
    const res = await handler(new Request('https://edge.example.com/dispatch?job=weekly', { method: 'POST', headers: { 'x-dispatch-secret': 's3cret' } }));
    expect(await res.json()).toMatchObject({ status: 'ok', job: 'weekly', planned: 2, problems: [] });
    // The summary goes to the insights member only, the quiet-week nudge to the marketing member only, nothing to the
    // member with neither (each then refused again by guardedSend, whose prefs read is empty here).
    expect(audits.map(a => [a.profile_id, a.payload.templateName])).toEqual([['ins', 'weekly_summary'], ['mkt', 'reengagement_nudge_quiet']]);
    expect(api.rpc).toHaveBeenCalledWith('record_job_run', expect.objectContaining({ p_job: 'whatsapp-dispatch-weekly', p_status: 'ok' }));
  });
});
