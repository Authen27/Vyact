import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { agoLabel, everyLabel, jobLabel, JOB_LABEL, problemLabel, summaryText } from '../jobHealth';
import { canAccessPage } from '../permissions';

// Q4-ADM-001..004 — admin v1.6.0 (Track Q4; audit OPS-06, DB-OPS-08; owner decision D9, 20 Oct 2026). The Health page
// shows every scheduled job against its cadence, from admin_job_health() / admin_job_runs() (v10.132.0).

const src = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const migration = () => readFileSync(new URL('../../../../supabase/migrations/20261110120000_q4_job_runs.sql', import.meta.url), 'utf8');

describe('admin v1.6.0 Health (Q4)', () => {
  it('Q4-ADM-001 · the roles tier opens Health, from the sidebar and the route; content admins do not', () => {
    expect(canAccessPage('roles', 'health')).toBe(true);
    expect(canAccessPage('super', 'health')).toBe(true);
    expect(canAccessPage('content', 'health')).toBe(false);
    expect(canAccessPage(null, 'health')).toBe(false);
    expect(src('components/Layout.tsx')).toMatch(/\{ to: '\/health', +page: 'health', +label: 'Health', +icon: Activity \}/);
    expect(src('App.tsx')).toMatch(/<Route path="\/health" +element=\{can\('health'\) +\? <Health \/> +: <Forbidden \/>\} \/>/);
  });

  it('Q4-ADM-002 · it reads the two Health RPCs only, and labels every job the server watches', () => {
    const api = src('lib/adminApi.ts');
    expect(api).toContain("rpc('admin_job_health')");
    expect(api).toContain("rpc('admin_job_runs', { p_job: job, p_limit: limit })");
    expect(src('pages/Health.tsx')).not.toMatch(/from\('job_runs'\)/);
    // Every job in job_expectations() has words on the page.
    const watched = [...migration().matchAll(/\('([a-z0-9-]+)', (\d+)\)/g)].map(m => m[1]);
    expect(watched.length).toBe(11);
    expect(Object.keys(JOB_LABEL).sort()).toEqual([...watched].sort());
    expect(jobLabel('a-new-job')).toBe('a-new-job');
  });

  it('Q4-ADM-003 · cadence, problem, counts and age read as the owner would say them', () => {
    expect([5, 30, 60, 120, 1440, 2880].map(everyLabel)).toEqual(['every 5 minutes', 'every 30 minutes', 'every hour', 'every 2 hours', 'every day', 'every 2 days']);
    expect(problemLabel('failed')).toBe('Failed on its last run');
    expect(problemLabel('partial')).toBe('Partly failed twice in a row');
    expect(problemLabel('late')).toBe('Has not run for two of its intervals');
    expect(problemLabel(null)).toBeNull();
    expect(summaryText({ posted: 2, errors: 0, skipped_quiet_hours: 1, email: 'not_configured' })).toBe('posted 2 · skipped quiet hours 1 · email not_configured');
    expect(summaryText({ posted: 0 })).toBe('nothing to do');
    expect(summaryText(null)).toBe('nothing to do');
    const now = Date.parse('2026-10-25T12:00:00Z');
    expect(agoLabel('2026-10-25T11:57:00Z', now)).toBe('3 min ago');
    expect(agoLabel('2026-10-25T09:00:00Z', now)).toBe('3 h ago');
    expect(agoLabel('2026-10-21T12:00:00Z', now)).toBe('4 d ago');
    expect(agoLabel(null, now)).toBe('never');
  });

  it('Q4-ADM-004 · Help says what Health shows and where errors go', () => {
    const help = src('pages/Help.tsx');
    expect(help).toContain("q: 'Are the scheduled jobs running?'");
    expect(help).toMatch(/never a household\\'s data/);
    expect(help).toContain('reach Sentry with emails, ids and numbers taken out');
  });
});
