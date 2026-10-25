// Vyact — every scheduled run leaves a row in job_runs (v10.132.0, Track Q4; audit OPS-06, DB-OPS-08; owner
// decision D9, 20 Oct 2026).
//
// A run's answer used to live only in net._http_response (about 6 hours), so a job that had nothing to send and a
// job that was broken looked the same. `withJobRun` records how a run ended, in counts only (never a household's
// data): `failed` when it throws (the error is reported to Sentry, then rethrown for the caller's 500), else
// what `judge` says: `partial` when some of its work failed (one household, one send), `ok` otherwise. job_health() reads the rows; the
// admin Health page and the hourly `job-health` email are built on it.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { reportError } from './errorReport.ts';

export type JobStatus = 'ok' | 'partial' | 'failed';
export interface JobOutcome { status: Exclude<JobStatus, 'failed'>; summary: Record<string, number | string | boolean>; error?: string }

/** Writes one run. A row that can't be written is logged; the Health page then shows the job as late. */
export async function recordJobRun(
  admin: SupabaseClient, job: string, startedAt: Date, status: JobStatus,
  summary: Record<string, unknown>, error?: string,
): Promise<void> {
  try {
    const { error: e } = await admin.rpc('record_job_run', {
      p_job: job, p_started_at: startedAt.toISOString(), p_status: status, p_summary: summary, p_error: error ?? null,
    });
    if (e) console.error('[job-runs] run not recorded', job, e.message);
  } catch (e) {
    // Recording never decides the job's own answer.
    console.error('[job-runs] run not recorded', job, (e as Error)?.message);
  }
}

/** Runs one job and records it. */
export async function withJobRun<T>(
  admin: SupabaseClient, job: string, run: () => Promise<T>, judge: (result: T) => JobOutcome,
): Promise<T> {
  const started = new Date();
  let result: T;
  try {
    result = await run();
  } catch (e) {
    const message = (e as Error)?.message ?? String(e);
    await reportError(job, e);
    await recordJobRun(admin, job, started, 'failed', {}, message);
    throw e;
  }
  // A partial run is recorded, not reported: two in a row reach the owner through job-health, and a job that runs
  // every 15 minutes would otherwise spend Sentry's quota on one household's problem.
  const outcome = judge(result);
  await recordJobRun(admin, job, started, outcome.status, outcome.summary, outcome.error);
  return result;
}
