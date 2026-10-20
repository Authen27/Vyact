// Q1 (v10.128.0; audit OPS-01; owner D8) — the app goes live last: Deploy promotes this commit's staged build.
// Run: node --test scripts/__tests__/promote-app.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoteApps, decide, findBuild, confirmLive } from '../promote-app.mjs';

const SHA = 'a'.repeat(40);
/** A fake Vercel: `builds[project]` is a list of answers, one per list call (the last one repeats). */
function vercel(builds, { promoteStatus = 201, listStatus = 200 } = {}) {
  const calls = [];
  const seen = {};
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, method: init.method ?? 'GET', auth: init.headers?.Authorization });
    const promoteMatch = /\/v10\/projects\/([^/]+)\/promote\/([^?]+)/.exec(url);
    if (promoteMatch) return { status: promoteStatus, ok: promoteStatus < 300, text: async () => 'nope' };
    const project = decodeURIComponent(/projectId=([^&]+)/.exec(url)[1]);
    const list = builds[project] ?? [[]];
    const i = Math.min(seen[project] = (seen[project] ?? -1) + 1, list.length - 1);
    return { status: listStatus, ok: listStatus < 300, json: async () => ({ deployments: list[i] }) };
  };
  return { calls, fetchImpl };
}
const clock = () => { let t = 0; return { now: () => t, sleep: async (ms) => { t += ms; } }; };
const build = (over) => ({ uid: 'dpl_1', url: 'vyact-abc.vercel.app', readyState: 'READY', readySubstate: 'STAGED', createdAt: 2, ...over });

test('a staged build of this commit is promoted; one already serving, or skipped by Vercel, is left alone', async () => {
  const { calls, fetchImpl } = vercel({
    vyact: [[build({}), build({ uid: 'dpl_old', createdAt: 1, readySubstate: 'PROMOTED' })]],
    'vyact-admin': [[build({ uid: 'dpl_a', readySubstate: 'PROMOTED' })]],
  });
  const lines = await promoteApps({ token: 't', sha: SHA, fetchImpl, ...clock() });
  assert.deepEqual(lines, ['vyact: promoted vyact-abc.vercel.app', 'vyact-admin: already serving this commit']);
  const list = calls.find((c) => c.method === 'GET');
  assert.match(list.url, /^https:\/\/api\.vercel\.com\/v7\/deployments\?projectId=vyact&target=production&sha=a{40}&limit=5$/);
  assert.equal(list.auth, 'Bearer t');
  assert.deepEqual(calls.filter((c) => c.method === 'POST').map((c) => c.url), ['https://api.vercel.com/v10/projects/vyact/promote/dpl_1']);

  const skipped = vercel({ vyact: [[build({ readyState: 'CANCELED', readySubstate: undefined })]], 'vyact-admin': [[]] });
  const c = clock();
  const out = await promoteApps({ token: 't', sha: SHA, fetchImpl: skipped.fetchImpl, ...c, noBuildAfterMs: 60_000, pollMs: 15_000 });
  assert.deepEqual(out, ['vyact: Vercel skipped this commit (nothing changed for it)', 'vyact-admin: no production build of this commit (not connected to this commit, or not deployed)']);
  assert.equal(skipped.calls.filter((x) => x.method === 'POST').length, 0);
});

test('it waits for a build still running, then promotes it; a team is passed by id or slug', async () => {
  const { calls, fetchImpl } = vercel({ vyact: [[], [build({ readyState: 'BUILDING', readySubstate: undefined })], [build({})]] });
  const lines = await promoteApps({ token: 't', team: 'team_abc', sha: SHA, projects: ['vyact'], fetchImpl, ...clock() });
  assert.deepEqual(lines, ['vyact: promoted vyact-abc.vercel.app']);
  assert.equal(calls.filter((c) => c.method === 'GET').length, 3);
  assert.ok(calls.every((c) => c.url.includes('teamId=team_abc')));
  const slug = vercel({ vyact: [[build({ readySubstate: 'PROMOTED' })]] });
  await promoteApps({ token: 't', team: 'authen27', sha: SHA, projects: ['vyact'], fetchImpl: slug.fetchImpl, ...clock() });
  assert.match(slug.calls[0].url, /&slug=authen27$/);
});

test('a broken build, a refused token, a timeout or a refused promote fails the run (the previous app stays live)', async () => {
  await assert.rejects(promoteApps({ token: 't', sha: SHA, projects: ['vyact'], ...clock(),
    fetchImpl: vercel({ vyact: [[build({ readyState: 'ERROR', errorMessage: 'Command "npm run build" exited with 1' })]] }).fetchImpl }),
  /vyact: the production build of this commit failed \(Command "npm run build" exited with 1\); the previous app stays live/);
  await assert.rejects(promoteApps({ token: 'bad', sha: SHA, projects: ['vyact'], ...clock(), fetchImpl: vercel({}, { listStatus: 403 }).fetchImpl }), /refused the token \(403\)/);
  await assert.rejects(promoteApps({ token: 't', sha: SHA, projects: ['vyact'], ...clock(), timeoutMs: 60_000,
    fetchImpl: vercel({ vyact: [[build({ readyState: 'BUILDING', readySubstate: undefined })]] }).fetchImpl }), /still BUILDING after 1 minutes/);
  await assert.rejects(promoteApps({ token: 't', sha: SHA, projects: ['vyact'], ...clock(),
    fetchImpl: vercel({ vyact: [[build({})]] }, { promoteStatus: 409 }).fetchImpl }), /answered 409 promoting vyact/);
  await assert.rejects(promoteApps({ token: 't', sha: 'main', fetchImpl: vercel({}).fetchImpl }), /40 hex/);
});

test('decide() and the live check', async () => {
  assert.equal(decide(null), 'wait');
  assert.equal(decide({ readyState: 'QUEUED' }), 'wait');
  assert.equal(decide({ readyState: 'READY', readySubstate: 'STAGED' }), 'promote');
  assert.equal(decide({ readyState: 'READY', readySubstate: 'PROMOTED' }), 'done');
  assert.equal(decide({ readyState: 'READY' }), 'done');
  assert.equal(decide({ readyState: 'CANCELED' }), 'skip');
  assert.equal(decide({ readyState: 'ERROR' }), 'fail');
  assert.equal(await findBuild({ token: 't', project: 'vyact', sha: SHA, fetchImpl: vercel({ vyact: [[]] }).fetchImpl }), null);
  let n = 0;
  const live = async () => ({ ok: true, json: async () => ({ version: ++n < 3 ? '10.127.0' : '10.128.0' }) });
  assert.equal(await confirmLive({ version: '10.128.0', fetchImpl: live, sleep: async () => {} }), true);
  assert.equal(await confirmLive({ version: '9.9.9', fetchImpl: live, sleep: async () => {}, tries: 2 }), false);
});
