#!/usr/bin/env node
// FinFlow — Automation run reporter.
//
// Runs the standard quality gates (lint, unit tests, builds; optionally E2E) and
// writes a self-contained, human-readable evidence folder for the run under
// `automation-runs/<timestamp>__<shortsha>/`:
//   • report.md      — readable summary (metadata + per-gate results + verdict)
//   • summary.json   — machine-readable result
//   • logs/*.log     — full output of each gate
// It also appends a row to `automation-runs/INDEX.md` (the run register) so every
// run is traceable to a commit, and exits non-zero if any gate fails (CI merge gate).
//
// Usage:  node scripts/automation-run.mjs [--e2e]
// Env:    RUN_E2E=1 to include the Playwright E2E gate.

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runE2E = process.argv.includes('--e2e') || process.env.RUN_E2E === '1';

function git(args, fallback = 'unknown') {
  try { return execSync(`git ${args}`, { cwd: repoRoot, encoding: 'utf8' }).trim(); }
  catch { return fallback; }
}

const startedAt = new Date();
const sha = git('rev-parse HEAD');
const shortSha = git('rev-parse --short HEAD');
const branch = process.env.GITHUB_REF_NAME || git('rev-parse --abbrev-ref HEAD');
const author = git('log -1 --pretty=%an');
const subject = git('log -1 --pretty=%s');
const runner = process.env.GITHUB_ACTIONS ? 'github-actions' : 'local';
const trigger = process.env.GITHUB_EVENT_NAME || 'manual';

const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
const runId = `${stamp}__${shortSha}`;
const runDir = path.join(repoRoot, 'automation-runs', runId);
const logsDir = path.join(runDir, 'logs');
fs.mkdirSync(logsDir, { recursive: true });

// ── Gates ──────────────────────────────────────────────────────────
const gates = [
  { id: 'consumer-lint',  name: 'Consumer · type-check', cwd: 'react', cmd: 'npm run lint' },
  { id: 'consumer-unit',  name: 'Consumer · unit tests', cwd: 'react',
    cmd: `npm test -- --reporter=json --outputFile="${path.join(runDir, 'vitest.json')}"` },
  { id: 'consumer-build', name: 'Consumer · build (local-only env)', cwd: 'react', cmd: 'npm run build',
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } },
  { id: 'admin-lint',     name: 'Admin · type-check', cwd: 'admin', cmd: 'npm run lint' },
  { id: 'admin-build',    name: 'Admin · build', cwd: 'admin', cmd: 'npm run build' },
];
if (runE2E) {
  gates.push({ id: 'consumer-e2e', name: 'Consumer · E2E (Playwright)', cwd: 'react', cmd: 'npm run e2e' });
}

const results = [];
for (const g of gates) {
  const t0 = Date.now();
  let status = 'passed', exitCode = 0, output = '';
  process.stdout.write(`▶ ${g.name} … `);
  try {
    output = execSync(g.cmd, {
      cwd: path.join(repoRoot, g.cwd),
      encoding: 'utf8',
      stdio: 'pipe',
      env: { ...process.env, ...(g.env || {}) },
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    status = 'failed';
    exitCode = e.status ?? 1;
    output = `${e.stdout || ''}\n${e.stderr || ''}`;
  }
  const durationMs = Date.now() - t0;
  fs.writeFileSync(path.join(logsDir, `${g.id}.log`), output);
  results.push({ id: g.id, name: g.name, status, exitCode, durationMs, log: `logs/${g.id}.log` });
  console.log(status === 'passed' ? `✓ (${(durationMs / 1000).toFixed(1)}s)` : `✗ (exit ${exitCode})`);
}

// Pull unit-test counts out of the vitest json if present.
let unit = null;
try {
  const v = JSON.parse(fs.readFileSync(path.join(runDir, 'vitest.json'), 'utf8'));
  unit = { total: v.numTotalTests, passed: v.numPassedTests, failed: v.numFailedTests, files: v.numTotalTestSuites };
} catch { /* no json */ }

const finishedAt = new Date();
const passed = results.every(r => r.status === 'passed');
const verdict = passed ? 'PASS' : 'FAIL';

const summary = {
  runId, verdict, passed,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs: finishedAt - startedAt,
  runner, trigger,
  git: { sha, shortSha, branch, author, subject },
  node: process.version, os: `${os.type()} ${os.release()}`,
  unit,
  gates: results,
};
fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));

// ── Readable report ────────────────────────────────────────────────
const row = (r) => `| ${r.name} | ${r.status === 'passed' ? '✅ pass' : '❌ fail'} | ${(r.durationMs / 1000).toFixed(1)}s | [\`${r.log}\`](${r.log}) |`;
const md = `# Automation Run — ${verdict === 'PASS' ? '✅ PASS' : '❌ FAIL'}

**Run ID:** \`${runId}\`
**Verdict:** **${verdict}**

## Run metadata

| Field | Value |
|---|---|
| Started (UTC) | ${startedAt.toISOString()} |
| Finished (UTC) | ${finishedAt.toISOString()} |
| Duration | ${((finishedAt - startedAt) / 1000).toFixed(1)}s |
| Runner | ${runner} |
| Trigger | ${trigger} |
| Branch | \`${branch}\` |
| Commit | \`${shortSha}\` — ${subject} |
| Full SHA | \`${sha}\` |
| Author | ${author} |
| Node | ${process.version} |
| OS | ${os.type()} ${os.release()} |

## Quality gates

| Gate | Result | Duration | Log |
|---|---|---|---|
${results.map(row).join('\n')}
${unit ? `\n**Unit tests:** ${unit.passed}/${unit.total} passed across ${unit.files} files${unit.failed ? ` — ${unit.failed} failed` : ''}.\n` : ''}
## Verdict

**${verdict}** — ${passed
  ? 'all gates passed. This commit meets the merge/deploy quality bar.'
  : 'one or more gates failed. Do not merge or deploy until resolved (see logs above).'}

---
> Governed by [\`docs/TEST_GOVERNANCE.md\`](../../docs/TEST_GOVERNANCE.md). Evidence retained per the retention policy there.
> Generated by \`scripts/automation-run.mjs\`.
`;
fs.writeFileSync(path.join(runDir, 'report.md'), md);

// ── Append to the run register ─────────────────────────────────────
const indexPath = path.join(repoRoot, 'automation-runs', 'INDEX.md');
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(indexPath,
    '# Automation Run Register\n\n' +
    '> Append-only index of automation runs. Each row links to that run\'s evidence folder.\n' +
    '> See [`docs/TEST_GOVERNANCE.md`](../docs/TEST_GOVERNANCE.md).\n\n' +
    '| Finished (UTC) | Verdict | Branch | Commit | Runner | Report |\n' +
    '|---|---|---|---|---|---|\n');
}
fs.appendFileSync(indexPath,
  `| ${finishedAt.toISOString()} | ${verdict === 'PASS' ? '✅' : '❌'} ${verdict} | \`${branch}\` | \`${shortSha}\` | ${runner} | [report](${runId}/report.md) |\n`);

console.log(`\n${verdict === 'PASS' ? '✅' : '❌'} ${verdict} — report: automation-runs/${runId}/report.md`);
process.exit(passed ? 0 : 1);
