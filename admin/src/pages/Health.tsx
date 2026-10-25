// Vyact Admin — Health (v1.6.0; Track Q4, audit OPS-06, DB-OPS-08; owner decision D9, 20 Oct 2026).
// Every scheduled job against its cadence, from `admin_job_health()` (roles tier): when it last ran, how that run
// ended, runs and failures in 24 hours, and the problem the hourly job-health email is about (failed on its last
// run · partly failed twice in a row · has not run for two of its intervals). A row opens its last 20 runs
// (`admin_job_runs()`): counts and the error only, never a household's data. Runs are kept 30 days.
// Before v1.6.0 a run's answer lived in pg_net for about 6 hours, so "nothing to send" and "broken" looked the same.

import { Fragment, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchJobHealth, fetchJobRuns, type JobHealthRow, type JobRunRow } from '../lib/adminApi';
import { agoLabel, everyLabel, jobLabel, problemLabel, summaryText } from '../lib/jobHealth';

const STATUS_CLASS: Record<string, string> = {
  ok: 'text-positive border-positive/30',
  partial: 'text-warn border-warn/30',
  failed: 'text-danger border-danger/30',
};

function StatusPill({ status }: { status: string | null }) {
  if (!status) return <span className="font-mono text-[0.62rem] text-ink-dim">no runs</span>;
  return <span className={`font-mono text-[0.62rem] uppercase tracking-wider px-2 py-0.5 rounded border ${STATUS_CLASS[status] ?? ''}`}>{status}</span>;
}

export default function Health() {
  const [rows, setRows] = useState<JobHealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError('');
      try { const data = await fetchJobHealth(); if (!cancelled) setRows(data); }
      catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tick]);

  const problems = rows.filter(r => r.problem).length;
  return (
    <div>
      <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="display-serif text-3xl text-ink mb-1">Health</h1>
          <p className="text-ink-mid text-[0.92rem]">
            {loading ? 'Checking the scheduled jobs…' : problems ? `${problems} of ${rows.length} scheduled jobs need a look` : `All ${rows.length} scheduled jobs are running`}
          </p>
        </div>
        <button onClick={() => setTick(t => t + 1)}
          className="font-mono text-[0.6rem] tracking-wider uppercase px-3 py-2 border border-line rounded-md hover:bg-elev transition flex items-center gap-1.5">
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {error && <div className="panel p-4 mb-4 border-danger/30 text-danger text-sm">{error}</div>}
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_90px_1.6fr] gap-3 px-4 py-2.5 bg-elev border-b border-line2 mono-label">
          <div>Job</div><div>Runs</div><div>Last run</div><div>Result</div><div>Problem</div>
        </div>
        <div className="divide-y divide-line">
          {loading && <div className="px-4 py-6 text-center text-ink-mid text-sm">Loading…</div>}
          {!loading && rows.map(r => (
            <Fragment key={r.job}>
              <button type="button" onClick={() => setOpen(open === r.job ? null : r.job)} aria-expanded={open === r.job}
                className="w-full text-left grid grid-cols-[2fr_1fr_1fr_90px_1.6fr] gap-3 px-4 py-3 row-hover items-start">
                <div>
                  <div className="text-[0.84rem] font-semibold text-ink">{jobLabel(r.job)}</div>
                  <div className="font-mono text-[0.66rem] text-ink-dim">{r.job}</div>
                </div>
                <div className="text-[0.78rem] text-ink-mid">
                  {everyLabel(r.every_minutes)}<br />
                  <span className="font-mono text-[0.66rem] text-ink-dim">{r.runs_24h} in 24 h{r.failed_24h ? ` · ${r.failed_24h} failed` : ''}</span>
                </div>
                <div className="font-mono text-[0.7rem] text-ink-mid">{agoLabel(r.last_started_at)}</div>
                <div><StatusPill status={r.last_status} /></div>
                <div className="text-[0.78rem] break-words">
                  {r.problem
                    ? <span className="text-danger">{problemLabel(r.problem)}{r.last_error ? `: ${r.last_error}` : ''}</span>
                    : <span className="text-ink-dim">{summaryText(r.last_summary)}</span>}
                </div>
              </button>
              {open === r.job && <RecentRuns job={r.job} />}
            </Fragment>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[0.7rem] text-ink-dim font-mono">
        Source: <code>admin_job_health()</code> · runs kept 30 days · the owner is emailed about a problem once a day while it lasts
      </p>
    </div>
  );
}

function RecentRuns({ job }: { job: string }) {
  const [runs, setRuns] = useState<JobRunRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetchJobRuns(job, 20)
      .then(data => { if (!cancelled) setRuns(data); })
      .catch(e => { if (!cancelled) setError((e as Error).message); });
    return () => { cancelled = true; };
  }, [job]);
  return (
    <div className="px-6 py-3 bg-elev/50">
      {error && <div className="text-danger text-sm">{error}</div>}
      {!error && !runs && <div className="text-ink-mid text-sm">Loading runs…</div>}
      {runs && runs.length === 0 && <div className="text-ink-dim text-sm">No runs recorded yet.</div>}
      {runs && runs.map(run => (
        <div key={run.id} className="grid grid-cols-[160px_90px_1fr] gap-3 py-1.5 items-start">
          <div className="font-mono text-[0.68rem] text-ink-mid">{run.started_at.replace('T', ' ').slice(0, 19)}</div>
          <div><StatusPill status={run.status} /></div>
          <div className="text-[0.76rem] text-ink-mid break-words">{run.error ? `${run.error} · ` : ''}{summaryText(run.summary)}</div>
        </div>
      ))}
    </div>
  );
}
