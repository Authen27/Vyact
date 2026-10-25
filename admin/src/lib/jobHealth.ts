// Vyact Admin — how the Health page words a scheduled job (v1.6.0; Track Q4, audit OPS-06, DB-OPS-08). Pure, so the
// tests read the same words the page shows. The figures come from `admin_job_health()` / `admin_job_runs()`.

export type JobStatus = 'ok' | 'partial' | 'failed';
export type JobProblem = 'failed' | 'partial' | 'late';

/** What each scheduled job does, in the words the owner uses. A job the server adds later shows its own name. */
export const JOB_LABEL: Record<string, string> = {
  'job-health': 'Health check (emails the owner)',
  'loan-auto-record': 'Loan EMIs recorded on their date',
  'recurring-post': 'Bills that post themselves',
  'web-push-dispatch': 'Push notifications',
  'whatsapp-dispatch-alerts': 'WhatsApp alerts: large spends, budgets, splits',
  'whatsapp-dispatch-bills': 'WhatsApp bill reminders',
  'whatsapp-dispatch-digest': 'WhatsApp evening digest',
  'whatsapp-dispatch-monthly': 'WhatsApp month close, payday and set-up',
  'whatsapp-dispatch-weekly': 'WhatsApp weekly summary and nudges',
  'whatsapp-inbox-sweep': 'WhatsApp messages retried',
  'whatsapp-retention': 'Old WhatsApp messages and run records removed',
};

export const jobLabel = (job: string) => JOB_LABEL[job] ?? job;

/** "every 15 minutes", "every hour", "every day". */
export function everyLabel(minutes: number): string {
  if (minutes % 1440 === 0) return minutes === 1440 ? 'every day' : `every ${minutes / 1440} days`;
  if (minutes % 60 === 0) return minutes === 60 ? 'every hour' : `every ${minutes / 60} hours`;
  return `every ${minutes} minutes`;
}

/** The problem as the page says it; null when the job is fine. */
export function problemLabel(problem: JobProblem | null): string | null {
  if (problem === 'failed') return 'Failed on its last run';
  if (problem === 'partial') return 'Partly failed twice in a row';
  if (problem === 'late') return 'Has not run for two of its intervals';
  return null;
}

/** A run's counts, as "posted 2 · errors 1". Zero counts are left out; an empty run says so. */
export function summaryText(summary: Record<string, unknown> | null | undefined): string {
  const parts = Object.entries(summary ?? {})
    .filter(([, v]) => (typeof v === 'number' && v !== 0) || (typeof v === 'string' && v) || v === true)
    .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v === true ? 'yes' : String(v)}`);
  return parts.length ? parts.join(' · ') : 'nothing to do';
}

/** "3 min ago", "2 h ago", "4 d ago"; "never" before a first run. */
export function agoLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return 'never';
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} d ago`;
}
