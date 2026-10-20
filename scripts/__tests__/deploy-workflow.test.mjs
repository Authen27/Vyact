// Q1 (v10.128.0; audit OPS-01, OPS-03, INT-PAR-08) — the Deploy workflow's order is the release gate.
// Run: node --test scripts/__tests__/deploy-workflow.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const wf = read('../../.github/workflows/deploy.yml');
const testWf = read('../../.github/workflows/deploy-test-functions.yml');
/** The text of one job (from its key to the next top-level job key). */
const job = (name) => {
  const start = wf.indexOf(`\n  ${name}:\n`);
  assert.ok(start >= 0, `job ${name} exists`);
  const rest = wf.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z][a-z-]*:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
};

test('migrations apply in order: no --include-all anywhere', () => {
  assert.doesNotMatch(wf, /db push[^\n]*--include-all/);
  assert.match(job('db-migrations'), /supabase db push --password/);
});

test('the Edge deploy checks the bundle first, stamps the commit, and must report it after', () => {
  const edge = job('deploy-edge-functions');
  assert.match(edge, /needs: db-migrations/);
  const check = edge.indexOf('build-agent-engine.mjs --check');
  const stamp = edge.indexOf('supabase secrets set BUILD_SHA="${{ github.sha }}"');
  const deploy = edge.indexOf('name: Deploy all Edge Functions');
  const verify = edge.indexOf('/functions/v1/version');
  assert.ok(check > 0 && stamp > check && deploy > stamp && verify > deploy, 'check → stamp → deploy → verify');
  for (const w of [edge, testWf]) assert.match(w, /NO_JWT="[^"]*\bversion\b[^"]*"/);
});

test('the apps are promoted last, only after both the migrations and the Edge deploy', () => {
  const promote = job('promote-apps');
  assert.match(promote, /needs: \[db-migrations, deploy-edge-functions\]/);
  assert.match(promote, /node scripts\/promote-app\.mjs "\$\{\{ github\.sha \}\}"/);
  assert.match(promote, /VERCEL_PROMOTE_TOKEN: \$\{\{ secrets\.VERCEL_PROMOTE_TOKEN \}\}/);
  assert.doesNotMatch(promote, /continue-on-error/);      // a broken build fails the release
});
