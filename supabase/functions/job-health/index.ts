// job-health — the owner hears about a scheduled job that stopped working (v10.132.0, Track Q4; audit OPS-06,
// DB-OPS-08; owner decision D9, 20 Oct 2026). Deploy --no-verify-jwt (pg_cron has no user JWT).
//
// pg_cron calls this every hour (x-cron-secret, checked against Vault; or the service key). It reads job_health(),
// each scheduled job against its cadence, and emails HEALTH_ALERT_EMAIL about every job that
//   • failed on its latest run,
//   • finished only partly twice in a row, or
//   • has not run for two of its intervals.
// One email per job and problem a day: claim_job_alert claims before sending, and a send that fails gives the
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

export function alertEmail(lines: string[]): { subject: string; html: string; text: string } {
  const heading = lines.length === 1 ? 'A scheduled job needs a look' : `${lines.length} scheduled jobs need a look`;
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
  const problems = ((data ?? []) as HealthRow[]).filter((r) => r.problem && r.job !== 'job-health');
  if (!problems.length) return { problems: 0, emailed: 0 };
  const to = env('HEALTH_ALERT_EMAIL').trim();
  if (!ADDRESS.test(to) || !emailConfigured()) return { problems: problems.length, emailed: 0, email: 'not_configured' };

  const claimed: HealthRow[] = [];
  for (const r of problems) {
    const { data: ok, error: claimError } = await admin.rpc('claim_job_alert', { p_job: r.job, p_kind: r.problem });
    if (claimError) throw new Error(`claim: ${claimError.message}`);
    if (ok === true) claimed.push(r);
  }
  if (!claimed.length) return { problems: problems.length, emailed: 0 };
  const mail = alertEmail(claimed.map(problemLine));
  if (await deliver('job-health', to, mail.subject, mail.html, mail.text)) return { problems: problems.length, emailed: claimed.length };
  for (const r of claimed) {
    const { error: releaseError } = await admin.rpc('release_job_alert', { p_job: r.job, p_kind: r.problem });
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
