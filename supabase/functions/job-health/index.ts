// job-health — the owner hears about a scheduled job that stopped working (v10.132.0, Track Q4; audit OPS-06,
// DB-OPS-08; owner decision D9, 20 Oct 2026). Deploy --no-verify-jwt (pg_cron has no user JWT).
//
// pg_cron calls this every hour (x-cron-secret, checked against Vault; or the service key). It reads job_health(),
// each scheduled job against its cadence, and emails HEALTH_ALERT_EMAIL about every job that
//   • failed on its latest run,
//   • finished only partly twice in a row, or
//   • has not run for two of its intervals.
// v10.135.0 (Track Q7; audit OPS-11): it also reads Pip's model calls in the last 24 hours against the global ceiling
// (ai_ceiling_state) and says so at 50%, 80% and 100% (and when Pip's limits cannot be read, which refuses every
// question). One email per job and problem a day: claim_job_alert claims before sending, and a send that fails gives the
// claims back, so the next hour tries again. Inert without HEALTH_ALERT_EMAIL or an email transport (the admin
// Health page shows the same). Its own run is recorded too, so the Health page shows when it last checked.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { env, json, corsHeaders } from '../_shared/whatsapp.ts';
import { isServiceCaller } from '../_shared/service-auth.ts';
import { deliver, emailConfigured } from '../_shared/emailTransport.ts';
import { renderEmail } from '../_shared/emailTemplates.ts';
import { withJobRun } from '../_shared/jobRuns.ts';

export interface HealthRow {
  job: string;
  every_minutes: number;
  last_started_at: string | null;
  last_status: string | null;
  last_error: string | null;
  problem: 'failed' | 'partial' | 'late' | null;
}

export const HEALTH_PAGE = 'https://admin.vyact.app/health';

/** One line of the owner's email, and the claim that keeps it to once a day. */
interface Alert { job: string; kind: string; line: string }

/** Pip's model calls in the last 24 hours, and the global ceiling (null: no ai_limits row). */
export interface CeilingState { calls: number; ceiling: number | null }

/** v10.135.0 (Q7) — the highest share of the ceiling reached: 100, 80, 50, or none below half. */
export function spendLevel(s: CeilingState): 50 | 80 | 100 | null {
  if (s.ceiling === null) return null;
  const share = s.ceiling > 0 ? s.calls / s.ceiling : 1;
  return share >= 1 ? 100 : share >= 0.8 ? 80 : share >= 0.5 ? 50 : null;
}

const count = (n: number) => n.toLocaleString('en-US');

/** The owner's line for Pip's spend, or null when there is nothing to say. */
export function spendAlert(s: CeilingState): Alert | null {
  if (s.ceiling === null) {
    return { job: 'pip', kind: 'failed', line: 'Pip\'s limits (the ai_limits row) cannot be read, so Pip is refusing every question.' };
  }
  const level = spendLevel(s);
  if (!level) return null;
  const used = `${count(s.calls)} of its ${count(s.ceiling)} model calls in the last 24 hours`;
  const line = level === 100
    ? `Pip has used ${used} and is refusing new questions until the count falls. Raise ai_limits.global_daily_calls to lift it.`
    : `Pip has used ${used} (${Math.floor((s.calls / s.ceiling) * 100)}%).${level === 80 ? ` At ${count(s.ceiling)} it stops answering everyone until the count falls.` : ''}`;
  return { job: 'pip', kind: `spend_${level}`, line };
}

function readCeiling(data: unknown): CeilingState | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { calls?: unknown; ceiling?: unknown };
  if (typeof d.calls !== 'number') return null;
  return { calls: d.calls, ceiling: typeof d.ceiling === 'number' ? d.ceiling : null };
}

const ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;

const every = (m: number) =>
  m % 1440 === 0 ? (m === 1440 ? 'day' : `${m / 1440} days`) : m % 60 === 0 ? (m === 60 ? 'hour' : `${m / 60} hours`) : `${m} minutes`;
const utc = (iso: string) => `${new Date(iso).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** One sentence per problem: which job, what happened, when. */
export function problemLine(r: HealthRow): string {
  if (r.problem === 'late') {
    return `${r.job} has not run ${r.last_started_at ? `since ${utc(r.last_started_at)}` : 'yet'} (it runs every ${every(r.every_minutes)}).`;
  }
  const error = r.last_error ? `: ${r.last_error}` : '.';
  if (r.problem === 'failed') return `${r.job} failed${r.last_started_at ? ` at ${utc(r.last_started_at)}` : ''}${error}`;
  return `${r.job} finished only partly on its last two runs${error}`;
}

export function alertEmail(lines: string[], jobsOnly = true): { subject: string; html: string; text: string } {
  const heading = !jobsOnly
    ? (lines.length === 1 ? 'Something needs a look' : `${lines.length} things need a look`)
    : lines.length === 1 ? 'A scheduled job needs a look' : `${lines.length} scheduled jobs need a look`;
  return {
    subject: `Vyact: ${heading.charAt(0).toLowerCase()}${heading.slice(1)}`,
    ...renderEmail({
      heading,
      lines: [...lines, 'You hear about each problem once a day while it lasts. The Health page shows every job.'],
      cta: { label: 'Open Health', url: HEALTH_PAGE },
    }),
  };
}

export interface HealthSummary extends Record<string, number | string> { problems: number; emailed: number }

export async function checkHealth(admin: SupabaseClient): Promise<HealthSummary> {
  const { data, error } = await admin.rpc('job_health');
  if (error) throw new Error(`job_health: ${error.message}`);
  // The check does not report on itself: a check that is not running cannot send.
  const alerts: Alert[] = ((data ?? []) as HealthRow[])
    .filter((r) => r.problem && r.job !== 'job-health')
    .map((r) => ({ job: r.job, kind: r.problem as string, line: problemLine(r) }));
  // Q7 (OPS-11): Pip's calls against the ceiling. A failed read never stops the job alerts.
  const extra: Record<string, number | string> = {};
  const { data: ceilingData, error: ceilingError } = await admin.rpc('ai_ceiling_state');
  const ceiling = ceilingError ? null : readCeiling(ceilingData);
  if (ceiling) {
    if (ceiling.ceiling) extra.spend_pct = Math.floor((ceiling.calls / ceiling.ceiling) * 100);
    const spend = spendAlert(ceiling);
    if (spend) alerts.push(spend);
  } else {
    console.error('[job-health] ai_ceiling_state not read', ceilingError?.message ?? 'unexpected shape');
    extra.spend = 'unread';
  }
  const problems = alerts.length;
  if (!problems) return { problems: 0, emailed: 0, ...extra };
  const to = env('HEALTH_ALERT_EMAIL').trim();
  if (!ADDRESS.test(to) || !emailConfigured()) return { problems, emailed: 0, email: 'not_configured', ...extra };

  const claimed: Alert[] = [];
  for (const a of alerts) {
    const { data: ok, error: claimError } = await admin.rpc('claim_job_alert', { p_job: a.job, p_kind: a.kind });
    if (claimError) throw new Error(`claim: ${claimError.message}`);
    if (ok === true) claimed.push(a);
  }
  if (!claimed.length) return { problems, emailed: 0, ...extra };
  const mail = alertEmail(claimed.map((a) => a.line), claimed.every((a) => a.job !== 'pip'));
  if (await deliver('job-health', to, mail.subject, mail.html, mail.text)) return { problems, emailed: claimed.length, ...extra };
  for (const r of claimed) {
    const { error: releaseError } = await admin.rpc('release_job_alert', { p_job: r.job, p_kind: r.kind });
    if (releaseError) console.error('[job-health] claim not given back', r.job, releaseError.message);
  }
  throw new Error('the alert email was not sent');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const given = req.headers.get('x-cron-secret') ?? '';
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: cronOk } = given ? await admin.rpc('job_health_cron_ok', { p: given }) : { data: false };
  if (cronOk !== true && !(await isServiceCaller(bearer))) return json({ error: 'forbidden' }, 403);
  try {
    return json(await withJobRun(admin, 'job-health', () => checkHealth(admin), (s) => ({ status: 'ok', summary: s })));
  } catch (e) {
    console.error('[job-health] failed', (e as Error)?.message);
    return json({ error: 'health_check_failed' }, 500);
  }
});
