#!/usr/bin/env node
// Q1 (v10.128.0; audit OPS-01; owner decision D8, 20 Oct 2026: "Actions deploys the app last").
//
// Vercel builds vyact.app and admin.vyact.app from every push to main, as before, but no longer points the
// production domains at a new build by itself (each project: Settings → Environments → Production →
// "Auto-assign Custom Production Domains" off). The Deploy workflow runs this script LAST, after the
// migrations and the Edge Functions: it finds each project's production build of this commit and promotes it.
// So an app never goes live before the schema and the server it needs, and a failed migration keeps the
// previous app live. Rollback stays Vercel's Instant Rollback.
//
//   VERCEL_PROMOTE_TOKEN=… [VERCEL_TEAM=…] node scripts/promote-app.mjs <commit-sha>
//
// Per project, the commit's production build is:
//   • READY and STAGED      → promoted (POST /v10/projects/{project}/promote/{deployment});
//   • READY and PROMOTED    → already serving (auto-assign is still on) → nothing to do;
//   • CANCELED              → Vercel skipped it (docs-only change, ignoreCommand) → nothing to do;
//   • ERROR                 → the run fails: the build broke, and the previous app stays live;
//   • building or not there → waited for, up to the timeout.
// Without a token the step only warns: production then still follows Vercel's auto-assign. A token that is
// set but refused fails the run, because then nothing would go live. The token is never printed.
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const API = 'https://api.vercel.com';
export const DEFAULT_PROJECTS = ['vyact', 'vyact-admin'];
const SHA = /^[0-9a-f]{40}$/;

const teamQuery = (team) => (!team ? '' : team.startsWith('team_') ? `&teamId=${encodeURIComponent(team)}` : `&slug=${encodeURIComponent(team)}`);

/** The newest production deployment of `sha` for `project`, or null. */
export async function findBuild({ token, team, project, sha, fetchImpl = fetch }) {
  const url = `${API}/v7/deployments?projectId=${encodeURIComponent(project)}&target=production&sha=${sha}&limit=5${teamQuery(team)}`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) throw new Error(`Vercel refused the token (${res.status})`);
  if (!res.ok) throw new Error(`Vercel answered ${res.status} listing ${project}'s deployments`);
  const body = await res.json();
  const list = (body?.deployments ?? []).slice().sort((a, b) => (b.createdAt ?? b.created ?? 0) - (a.createdAt ?? a.created ?? 0));
  return list[0] ?? null;
}

/** What to do with a build: 'promote', 'done', 'skip', 'fail', or 'wait'. */
export function decide(build) {
  if (!build) return 'wait';
  const state = build.readyState ?? build.state;
  if (state === 'READY') return build.readySubstate === 'STAGED' ? 'promote' : 'done';
  if (state === 'CANCELED') return 'skip';
  if (state === 'ERROR' || state === 'DELETED') return 'fail';
  return 'wait';
}

export async function promote({ token, team, project, deploymentId, fetchImpl = fetch }) {
  const q = teamQuery(team).slice(1);
  const url = `${API}/v10/projects/${encodeURIComponent(project)}/promote/${encodeURIComponent(deploymentId)}${q ? `?${q}` : ''}`;
  const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 201 || res.status === 202) return;
  const text = await res.text().catch(() => '');
  throw new Error(`Vercel answered ${res.status} promoting ${project}: ${text.slice(0, 200)}`);
}

/**
 * Promote each project's production build of `sha`. Returns one line per project; throws on a broken build,
 * a refused token or a timeout (the caller fails the run).
 */
export async function promoteApps({
  token, team = '', sha, projects = DEFAULT_PROJECTS, fetchImpl = fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now,
  timeoutMs = 15 * 60_000, pollMs = 15_000, noBuildAfterMs = 5 * 60_000,
}) {
  if (!SHA.test(sha ?? '')) throw new Error('the commit SHA must be 40 hex characters');
  const lines = [];
  for (const project of projects) {
    const started = now();
    for (;;) {
      const build = await findBuild({ token, team, project, sha, fetchImpl });
      const action = decide(build);
      if (action === 'promote') {
        await promote({ token, team, project, deploymentId: build.uid, fetchImpl });
        lines.push(`${project}: promoted ${build.url ?? build.uid}`);
        break;
      }
      if (action === 'done') { lines.push(`${project}: already serving this commit`); break; }
      if (action === 'skip') { lines.push(`${project}: Vercel skipped this commit (nothing changed for it)`); break; }
      if (action === 'fail') throw new Error(`${project}: the production build of this commit failed (${build.errorMessage ?? build.readyState}); the previous app stays live`);
      const waited = now() - started;
      if (!build && waited >= noBuildAfterMs) { lines.push(`${project}: no production build of this commit (not connected to this commit, or not deployed)`); break; }
      if (waited >= timeoutMs) throw new Error(`${project}: still ${build?.readyState ?? 'missing'} after ${Math.round(timeoutMs / 60_000)} minutes`);
      await sleep(pollMs);
    }
  }
  return lines;
}

/** After promoting, vyact.app should serve the version this commit carries (a cache can lag a little). */
export async function confirmLive({ version, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), tries = 8 }) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetchImpl(`https://vyact.app/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok && (await res.json())?.version === version) return true;
    } catch { /* a network blip: try again */ }
    await sleep(15_000);
  }
  return false;
}

async function main(argv) {
  const sha = argv.find((a) => !a.startsWith('--')) ?? process.env.GITHUB_SHA;
  const token = (process.env.VERCEL_PROMOTE_TOKEN ?? '').trim();
  if (!token) {
    console.log('::warning title=App not promoted by this run::VERCEL_PROMOTE_TOKEN is not set, so vyact.app still goes live by Vercel\'s auto-assign, in parallel with the migrations. Set the token, then turn auto-assign off (DEPLOY.md).');
    return;
  }
  const projects = (process.env.VERCEL_PROMOTE_PROJECTS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  try {
    const lines = await promoteApps({ token, team: (process.env.VERCEL_TEAM ?? '').trim(), sha, projects: projects.length ? projects : DEFAULT_PROJECTS });
    for (const l of lines) console.log(`::notice title=App release::${l}`);
    if (lines.some((l) => l.startsWith('vyact: promoted') || l.startsWith('vyact: already'))) {
      const version = JSON.parse(readFileSync('react/package.json', 'utf8')).version;
      if (!(await confirmLive({ version }))) console.log(`::warning title=vyact.app version::vyact.app does not report ${version} yet; check https://vyact.app/version.json.`);
    }
  } catch (e) {
    console.error(`::error title=App release::${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
