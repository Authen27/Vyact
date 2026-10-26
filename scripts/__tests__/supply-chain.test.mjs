// v10.137.0 — supply-chain hardening (owner decision 26 Oct 2026, after the October Node.js security release and the
// 2026 npm worm waves). What this pins:
//   • every workflow runs one Node, from .nvmrc, at or above the 21 Oct 2026 security release (22.23.4);
//   • every GitHub Action is pinned to a commit, with its version as a comment (Dependabot keeps both current);
//   • no package runs an install script (react/.npmrc, admin/.npmrc), so none of our own scripts may rely on a pre/post
//     hook, which npm then skips too: the build runs every step itself (react/scripts/build.mjs);
//   • Dependabot waits 7 days before proposing a new version;
//   • the lockfiles are checked against OSV's malicious-packages feed (deps.yml).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSteps } from '../../react/scripts/build.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p) => readFileSync(ROOT + p, 'utf8').replace(/\r\n/g, '\n');
const workflows = readdirSync(ROOT + '.github/workflows').filter((f) => /\.ya?ml$/.test(f)).map((f) => [f, read(`.github/workflows/${f}`)]);

/** "22.23.4" ≥ "22.23.4"? */
const atLeast = (v, min) => {
  const [a, b] = [v, min].map((x) => x.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

test('one Node for every job, from .nvmrc, at or above the 21 Oct 2026 security release', () => {
  const nvmrc = read('.nvmrc').trim();
  assert.match(nvmrc, /^22\.\d+\.\d+$/, '.nvmrc names an exact Node 22 release (Vercel runs 22.x: react/package.json engines)');
  assert.ok(atLeast(nvmrc, '22.23.4'), `.nvmrc is ${nvmrc}, below 22.23.4 (CVE-2026-111497 and the TLS / DNS fixes)`);
  for (const [f, s] of workflows) {
    assert.doesNotMatch(s, /node-version:/, `${f} names its own Node instead of reading .nvmrc`);
    const steps = s.match(/uses: actions\/setup-node@/g)?.length ?? 0;
    assert.equal(s.match(/node-version-file: '\.nvmrc'/g)?.length ?? 0, steps, `${f}: every setup-node step reads .nvmrc`);
  }
});

test('every GitHub Action is pinned to a commit, with its version as a comment', () => {
  let n = 0;
  for (const [f, s] of workflows) {
    for (const line of s.match(/uses: [^\n]+/g) ?? []) {
      if (/uses: \.\//.test(line)) continue;   // a local action is this repository's own code
      n++;
      assert.match(line, /^uses: [\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40} # v\d+\.\d+\.\d+$/, `${f}: ${line}`);
    }
  }
  assert.ok(n >= 29, `found ${n} action references`);
});

test('no package runs an install script, so no script of ours relies on a pre/post hook', () => {
  for (const dir of ['react', 'admin']) assert.match(read(`${dir}/.npmrc`), /^ignore-scripts=true$/m, `${dir}/.npmrc`);
  const LIFECYCLE = ['install', 'ci', 'pack', 'publish', 'version', 'test', 'start', 'stop', 'restart', 'shrinkwrap', 'uninstall'];
  for (const p of ['package.json', 'react/package.json', 'admin/package.json']) {
    const scripts = JSON.parse(read(p)).scripts ?? {};
    const hooks = Object.keys(scripts).filter((k) => {
      const m = /^(pre|post)(.+)$/.exec(k);
      return k === 'prepare' || k === 'prepublishOnly' || (m && (m[2] in scripts || LIFECYCLE.includes(m[2])));
    });
    assert.deepEqual(hooks, [], `${p}: npm skips these under ignore-scripts`);
  }
});

test('the build runs every step itself, in order, and only vite build gets the arguments after --', () => {
  assert.equal(JSON.parse(read('react/package.json')).scripts.build, 'node scripts/build.mjs');
  const steps = buildSteps(['--mode', 'test']).map(([cmd, args]) => [cmd.replace(/^.*[\\/]/, ''), ...args].join(' '));
  assert.deepEqual(steps, [
    'node check-env.js', 'tsc -b', 'vite build --mode test', 'node scripts/prerender-landing.mjs',
    'node scripts/assert-no-sourcemaps.mjs', 'node scripts/assert-preview-isolated.mjs', 'node scripts/assert-bundle-budget.mjs',
  ]);
  assert.equal(buildSteps()[2][1].join(' '), 'build');
});

test('Dependabot waits a week before proposing a new version, for every ecosystem', () => {
  const cfg = read('.github/dependabot.yml');
  const entries = cfg.split(/\n  - package-ecosystem: /).slice(1);
  assert.equal(entries.length, 3);
  for (const e of entries) {
    const days = /cooldown: \{ default-days: (\d+) \}/.exec(e);
    assert.ok(days && Number(days[1]) >= 7, `no 7-day cooldown in: ${e.split('\n')[0]}`);
  }
});

test('the lockfiles are checked for known-malicious versions on change and every week', () => {
  const deps = read('.github/workflows/deps.yml');
  assert.match(deps, /- '\*\*\/package-lock\.json'/);
  assert.match(deps, /schedule:\n\s+- cron: /);
  assert.match(deps, /run: node scripts\/dependency-malware-check\.mjs/);
  assert.match(deps, /permissions:\n\s+contents: read/);
  assert.doesNotMatch(deps, /secrets\./);
});
