#!/usr/bin/env node
// FinFlow — Automation run reporter.
//
// Runs the standard quality gates (lint, type-check, unit tests, builds;
// optionally E2E; doc reconciliation) and writes a self-contained,
// human-readable evidence folder for the run under
// `automation-runs/<timestamp>__<shortsha>/`:
//   • report.md            — readable summary
//   • summary.json         — machine-readable result
//   • consumer-vitest.json — raw vitest output (consumer)
//   • admin-vitest.json    — raw vitest output (admin)
//   • playwright.json      — raw playwright output (if --e2e)
//   • logs/*.log           — full stdout/stderr of each gate
//
// Per-scenario evidence: every test scenario discovered in code is recorded
// with its TS ID, app, layer, file, status, duration, and (on failure) the
// full error message + stack. This is the durable audit trail required by
// docs/TEST_GOVERNANCE.md. The catalog at docs/TEST_SCENARIOS.md is the
// regression-managed master copy; scripts/test-scenarios-check.mjs enforces
// lock-step between the catalog and the code.
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

const consumerVitestJson = path.join(runDir, 'consumer-vitest.json');
const adminVitestJson    = path.join(runDir, 'admin-vitest.json');
const playwrightJson     = path.join(runDir, 'playwright.json');

// ── Gates ──────────────────────────────────────────────────────────
const gates = [
  { id: 'consumer-lint',       name: 'Consumer · ESLint',     cwd: 'react', cmd: 'npm run lint' },
  { id: 'consumer-typecheck',  name: 'Consumer · type-check', cwd: 'react', cmd: 'npm run typecheck' },
  { id: 'consumer-unit',       name: 'Consumer · unit tests', cwd: 'react',
    cmd: `npm test -- --reporter=json --outputFile="${consumerVitestJson}"` },
  { id: 'consumer-build',      name: 'Consumer · build (local-only env)', cwd: 'react', cmd: 'npm run build',
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } },
  { id: 'admin-lint',          name: 'Admin · ESLint',        cwd: 'admin', cmd: 'npm run lint' },
  { id: 'admin-typecheck',     name: 'Admin · type-check',    cwd: 'admin', cmd: 'npm run typecheck' },
  { id: 'admin-unit',          name: 'Admin · unit tests',    cwd: 'admin',
    cmd: `npm test -- --reporter=json --outputFile="${adminVitestJson}"` },
  { id: 'admin-build',         name: 'Admin · build',         cwd: 'admin', cmd: 'npm run build' },
  { id: 'test-scenarios-doc',  name: 'Test scenarios catalog (code ↔ doc reconciler)', cwd: '.',
    cmd: 'node scripts/test-scenarios-check.mjs' },
  { id: 'db-migrations',       name: 'DB migrations (naming + schema.sql snapshot in sync)', cwd: '.',
    cmd: 'node scripts/db-migrations-check.mjs' },
  { id: 'version-drift',       name: 'Version drift (README/VERSIONS/CHANGELOG vs package.json)', cwd: '.',
    cmd: 'node scripts/version-drift-check.mjs' },
];
if (runE2E) {
  // --reporter=json prints to stdout; redirect to a file the report can parse.
  gates.push({
    id: 'consumer-e2e',
    name: 'Consumer · E2E (Playwright)',
    cwd: 'react',
    cmd: `npx playwright test --reporter=json > "${playwrightJson}"`,
    shell: true,
  });
}

const results = [];
const gateStdout = {};
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
      shell: g.shell ? true : undefined,
    });
  } catch (e) {
    status = 'failed';
    exitCode = e.status ?? 1;
    output = `${e.stdout || ''}\n${e.stderr || ''}`;
  }
  const durationMs = Date.now() - t0;
  fs.writeFileSync(path.join(logsDir, `${g.id}.log`), output);
  gateStdout[g.id] = output;
  results.push({ id: g.id, name: g.name, status, exitCode, durationMs, log: `logs/${g.id}.log` });
  console.log(status === 'passed' ? `✓ (${(durationMs / 1000).toFixed(1)}s)` : `✗ (exit ${exitCode})`);
}

// ── Scenario aggregation ──────────────────────────────────────────
// Build a single per-scenario record list from both vitest JSONs and (when
// present) the Playwright JSON. Each record carries enough to render the
// per-scenario evidence sections of report.md and to serialise into
// summary.json for audit.
//
// Record shape:
//   { id, app, layer, title, file, status: 'passed'|'failed', durationMs,
//     failureMessage?, failureStack? }

const TS_ID_RE = /\b([A-Z]+-[A-Z0-9]+-\d{3})\b/;
const TS_TITLE_RE = /^\s*([A-Z]+-[A-Z0-9]+-\d{3})\s*(?:·|-)\s*(.+)$/;

function relRepo(p) {
  return path.relative(repoRoot, p).replace(/\\/g, '/');
}

function extractIdAndTitle(rawTitle) {
  if (!rawTitle) return { id: null, title: rawTitle || '' };
  const m = TS_TITLE_RE.exec(rawTitle);
  if (m) return { id: m[1], title: m[2].trim() };
  const idOnly = TS_ID_RE.exec(rawTitle);
  return { id: idOnly ? idOnly[1] : null, title: rawTitle };
}

function appLayerFromId(id) {
  // CON-UNIT-001 → { app: 'Consumer', layer: 'unit' }, etc.
  const parts = id.split('-');
  const app = parts[0] === 'CON' ? 'Consumer' : parts[0] === 'ADM' ? 'Admin' : parts[0];
  const layer = parts[1] === 'UNIT' ? 'unit' : parts[1] === 'E2E' ? 'e2e' : parts[1].toLowerCase();
  return { app, layer };
}

function readJsonIfExists(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function parseVitestAssertions(json) {
  if (!json || !Array.isArray(json.testResults)) return [];
  const out = [];
  for (const file of json.testResults) {
    const fileRel = relRepo(file.name || '');
    for (const a of (file.assertionResults || [])) {
      const fullTitle = a.fullName || a.title || '';
      const lastTitle = a.title || fullTitle.split('>').pop() || fullTitle;
      const { id, title } = extractIdAndTitle(lastTitle.trim());
      if (!id) continue;
      const { app, layer } = appLayerFromId(id);
      const status = a.status === 'passed' ? 'passed' : 'failed';
      const failureMessages = a.failureMessages || [];
      out.push({
        id, app, layer, title,
        file: fileRel,
        status,
        durationMs: a.duration || 0,
        failureMessage: failureMessages[0] ? failureMessages[0].split('\n')[0] : undefined,
        failureStack: failureMessages[0],
      });
    }
  }
  return out;
}

function parsePlaywrightSpecs(json) {
  if (!json || !Array.isArray(json.suites)) return [];
  const out = [];
  const walk = (suites, ancestors = []) => {
    for (const s of (suites || [])) {
      const path = [...ancestors, s.title].filter(Boolean);
      for (const spec of (s.specs || [])) {
        const { id, title } = extractIdAndTitle(spec.title || '');
        if (!id) continue;
        const { app, layer } = appLayerFromId(id);
        // tests[].results[0] for the single retry/run; failure surfaces here.
        const test = (spec.tests && spec.tests[0]) || {};
        const result = (test.results && test.results[0]) || {};
        const ok = spec.ok === true && (result.status === 'passed' || result.status === 'expected');
        const errMsg = result.error && result.error.message
          ? String(result.error.message).split('\n')[0]
          : undefined;
        const errStack = result.error && (result.error.stack || result.error.message)
          ? String(result.error.stack || result.error.message)
          : undefined;
        out.push({
          id, app, layer, title,
          file: spec.file ? `react/${spec.file}` : path.join(' › '),
          status: ok ? 'passed' : 'failed',
          durationMs: result.duration || 0,
          failureMessage: ok ? undefined : errMsg,
          failureStack: ok ? undefined : errStack,
        });
      }
      if (s.suites) walk(s.suites, path);
    }
  };
  walk(json.suites, []);
  return out;
}

const consumerVitest = readJsonIfExists(consumerVitestJson);
const adminVitest    = readJsonIfExists(adminVitestJson);
const playwright     = readJsonIfExists(playwrightJson);

const scenarios = [
  ...parseVitestAssertions(consumerVitest),
  ...parseVitestAssertions(adminVitest),
  ...parsePlaywrightSpecs(playwright),
];
scenarios.sort((a, b) => a.id.localeCompare(b.id));

// Per-app/per-layer matrix.
const matrix = {}; // key: `${app} · ${layer}` → { total, pass, fail, durMs }
for (const s of scenarios) {
  const k = `${s.app} · ${s.layer}`;
  matrix[k] = matrix[k] || { app: s.app, layer: s.layer, total: 0, pass: 0, fail: 0, durMs: 0 };
  matrix[k].total += 1;
  matrix[k][s.status === 'passed' ? 'pass' : 'fail'] += 1;
  matrix[k].durMs += s.durationMs || 0;
}
const matrixRows = Object.values(matrix).sort((a, b) =>
  a.app.localeCompare(b.app) || a.layer.localeCompare(b.layer),
);
const totals = matrixRows.reduce(
  (t, r) => ({ total: t.total + r.total, pass: t.pass + r.pass, fail: t.fail + r.fail, durMs: t.durMs + r.durMs }),
  { total: 0, pass: 0, fail: 0, durMs: 0 },
);

// Reconciler summary line (first line of its log starts with
// "Test scenarios reconciler — N in code · M in doc").
const reconcilerLine = (gateStdout['test-scenarios-doc'] || '').split('\n').find(l => l.startsWith('Test scenarios reconciler')) || '';

const finishedAt = new Date();
const passed = results.every(r => r.status === 'passed');
const verdict = passed ? 'PASS' : 'FAIL';

// ── summary.json ──────────────────────────────────────────────────
const summary = {
  runId, verdict, passed,
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs: finishedAt - startedAt,
  runner, trigger,
  git: { sha, shortSha, branch, author, subject },
  node: process.version, os: `${os.type()} ${os.release()}`,
  gates: results,
  scenarios: {
    totals,
    perAppLayer: matrixRows,
    reconciler: reconcilerLine,
    records: scenarios,
  },
};
fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));

// ── Readable report ───────────────────────────────────────────────
const gateRow = (r) =>
  `| ${r.name} | ${r.status === 'passed' ? '✅ pass' : '❌ fail'} | ${(r.durationMs / 1000).toFixed(1)}s | [\`${r.log}\`](${r.log}) |`;

const matrixRow = (r) =>
  `| ${r.app} | ${r.layer} | ${r.total} | ${r.pass} | ${r.fail} | ${(r.durMs / 1000).toFixed(3)}s |`;

const failureRows = scenarios.filter(s => s.status === 'failed');
const passRows = scenarios.filter(s => s.status === 'passed');

const failureSection = failureRows.length === 0
  ? `*(no failures in this run — see Pass register below for the full success evidence.)*\n`
  : failureRows.map(s => (
      `#### ❌ ${s.id} · ${s.app} · ${s.layer}\n` +
      `**Title:** ${s.title}\n\n` +
      `**File:** \`${s.file}\`\n\n` +
      `**Error:** ${s.failureMessage || '(no message)'}\n\n` +
      (s.failureStack ? '```\n' + s.failureStack.split('\n').slice(0, 20).join('\n') + '\n```\n' : '')
    )).join('\n---\n\n');

const passRegister = passRows.length === 0
  ? `*(no passing scenarios — investigate; this row should not be empty in a green run.)*`
  : '| ID | App · Layer | Title | Duration | File |\n|---|---|---|---|---|\n' +
    passRows.map(s =>
      `| ${s.id} | ${s.app} · ${s.layer} | ${s.title.replace(/\|/g, '\\|')} | ${(s.durationMs || 0).toFixed(2)}ms | \`${s.file}\` |`
    ).join('\n');

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
${results.map(gateRow).join('\n')}

## Test scenarios

> Master catalog: [\`docs/TEST_SCENARIOS.md\`](../../docs/TEST_SCENARIOS.md). Reconciler: \`scripts/test-scenarios-check.mjs\`.

${reconcilerLine ? `**Catalog reconciliation:** ${reconcilerLine}` : '**Catalog reconciliation:** (reconciler gate did not produce a parseable summary line)'}

### Per-app / per-layer summary

| App | Layer | Total | Pass | Fail | Duration |
|---|---|---|---|---|---|
${matrixRows.length ? matrixRows.map(matrixRow).join('\n') : '| _no scenarios recorded_ | | 0 | 0 | 0 | — |'}
| **All** | | **${totals.total}** | **${totals.pass}** | **${totals.fail}** | **${(totals.durMs / 1000).toFixed(3)}s** |

${runE2E ? '' : '_E2E counts are zero in this run because Playwright was not requested (`--e2e`). The Lane A E2E job in CI surfaces them on every PR; locally invoke with `node scripts/automation-run.mjs --e2e`._\n'}
### Failure details

${failureSection}

### Pass register

> Per-scenario success evidence retained for audit. Every passing TS ID is captured below with its duration so a reviewer can confirm what executed.

${passRegister}

## Verdict

**${verdict}** — ${passed
  ? 'all gates passed. This commit meets the merge/deploy quality bar.'
  : 'one or more gates failed. Do not merge or deploy until resolved (see logs above).'}

---
> Governed by [\`docs/TEST_GOVERNANCE.md\`](../../docs/TEST_GOVERNANCE.md). Evidence retained per the retention policy there.
> Generated by \`scripts/automation-run.mjs\`.
`;
fs.writeFileSync(path.join(runDir, 'report.md'), md);

// ── Append to the run register ────────────────────────────────────
const indexPath = path.join(repoRoot, 'automation-runs', 'INDEX.md');
if (!fs.existsSync(indexPath)) {
  fs.writeFileSync(indexPath,
    '# Automation Run Register\n\n' +
    '> Append-only index of automation runs. Each row links to that run\'s evidence folder.\n' +
    '> See [`docs/TEST_GOVERNANCE.md`](../docs/TEST_GOVERNANCE.md).\n\n' +
    '| Finished (UTC) | Verdict | Branch | Commit | Runner | Scenarios | Report |\n' +
    '|---|---|---|---|---|---|---|\n');
}
const scenarioCell = totals.total === 0
  ? '—'
  : `${totals.pass}/${totals.total}${totals.fail ? ` (${totals.fail} ❌)` : ''}`;
fs.appendFileSync(indexPath,
  `| ${finishedAt.toISOString()} | ${verdict === 'PASS' ? '✅' : '❌'} ${verdict} | \`${branch}\` | \`${shortSha}\` | ${runner} | ${scenarioCell} | [report](${runId}/report.md) |\n`);

console.log(`\n${verdict === 'PASS' ? '✅' : '❌'} ${verdict} — report: automation-runs/${runId}/report.md`);
console.log(`   Scenarios: ${totals.pass}/${totals.total}${totals.fail ? ` (${totals.fail} failed)` : ''}`);
process.exit(passed ? 0 : 1);
