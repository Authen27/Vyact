import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { groups, optionalFiles, retiredIds } from './test-inventory-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const normalize = value => value.replace(/\\/g, '/');
const relative = value => normalize(path.relative(root, value));
const inventoryPath = path.join(root, 'docs/UNIT_TEST_INVENTORY.json');

// Line-ending-insensitive comparison: a generated artefact must not appear to
// drift just because git checked it out with CRLF.
const lf = (text) => text.replace(/\r\n/g, '\n');
const docPath = path.join(root, 'docs/TEST_SCENARIOS.md');

export function collectReport(report, app, metadata, toRelative = relative) {
  if (!report.success || report.numFailedTests || report.numFailedTestSuites || report.numPendingTests || report.numTodoTests || report.snapshot?.failure) {
    throw new Error(`${app}: failed, skipped, TODO, collection or snapshot errors; inventory not updated`);
  }
  const files = [];
  for (const result of report.testResults ?? []) {
    const file = toRelative(result.name);
    const classification = metadata.get(file);
    if (!classification) throw new Error(`Unclassified test file: ${file}`);
    if (result.status !== 'passed' || !result.assertionResults?.length) throw new Error(`Empty or failed test file: ${file}`);
    const tests = result.assertionResults.map(test => {
      if (test.status !== 'passed') throw new Error(`Non-passing test: ${file}: ${test.fullName}`);
      return test.fullName;
    }).sort();
    files.push({ app, file, ...classification, count: tests.length, tests });
  }
  const count = files.reduce((sum, file) => sum + file.count, 0);
  if (!count || count !== report.numTotalTests || count !== report.numPassedTests) throw new Error(`${app}: incomplete assertion report`);
  return files;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}

function metadataMap() {
  const metadata = new Map();
  for (const { files, ...classification } of groups) {
    for (const file of files) {
      if (metadata.has(file)) throw new Error(`Duplicate classification: ${file}`);
      metadata.set(file, classification);
    }
  }
  const discovered = ['react', 'admin'].flatMap(app => walk(path.join(root, app, 'src')))
    .filter(file => /\.test\.tsx?$/.test(file)).map(relative);
  for (const file of discovered) {
    if (!metadata.has(file) && !optionalFiles.includes(file)) throw new Error(`Classify newly discovered test: ${file}`);
  }
  for (const file of [...metadata.keys(), ...optionalFiles]) {
    if (!discovered.includes(file)) throw new Error(`Classification references missing test: ${file}`);
  }
  return metadata;
}

export function renderInventory(files, browserRows, retiredBrowserRows = []) {
  const totals = new Map();
  for (const file of files) {
    const key = `${file.app} | ${file.layer} | ${file.availability}`;
    totals.set(key, (totals.get(key) ?? 0) + file.count);
  }
  const rows = [...totals].sort(([first], [second]) => first.localeCompare(second))
    .map(([key, count]) => `| ${key} | ${count} |`).join('\n');
  const fileRows = files.map(file => `| [${file.file}](../${file.file}) | ${file.feature} | ${file.layer} | ${file.availability} | ${file.count} |`).join('\n');
  const total = files.reduce((sum, file) => sum + file.count, 0);
  return `# Vyact Test Inventory

Generated from passing Vitest assertion results by \`node scripts/test-inventory.mjs --update\`.
Do not hand-edit counts or file rows. Full expanded test names: [UNIT_TEST_INVENTORY.json](UNIT_TEST_INVENTORY.json).
CI runs both apps, rejects failures/skips/empty collections/unclassified files, and compares the generated inventory.
Raw results with execution timestamps are uploaded as CI artifacts under \`test-results/\`.

## 1. Meaning

- **available**: exposed by current source; not a production deployment assertion.
- **conditional**: needs cloud, authorization, configuration or channel activation.
- **infrastructure**: implemented/tested but not connected to a current user entrypoint.
- **unit / contract-unit**: real production logic, external I/O mocked where applicable.
- **store / storage / SQL / handler integration**: multiple real modules; PGlite is a focused schema, not full Supabase RLS. Handler tests stub DB/provider transport.
- Counts are expanded executable cases, not unique user journeys, assertions, code coverage percentages or release approval.

## 2. Scope and Maintenance

Both runners discover \`src/**/*.test.{ts,tsx}\`, including component tests and unnumbered/parameterized titles.
Classifications and owning functions live in [test-inventory-config.mjs](../scripts/test-inventory-config.mjs).
The optional paid provider smoke (\`npm --prefix react run test:live\`) is excluded from default CI and these counts.
Goals/Tax pages are removed; Saved Views is hidden. Shared math, legacy-row compatibility and removal guards remain valuable tests, not proof of those modules being live.
Learned ingestion tests remain in the infrastructure bucket; they do not imply SMS/receipt automation is connected.
Browser and real-cloud execution are separate lanes and are NOT included in Vitest totals.

## 3. Coverage Summary

**${total} passing deterministic cases in ${files.length} files. Zero failed, skipped or TODO cases at generation.**

| App | Layer | Availability | Cases |
|---|---|---|---:|
${rows}

### Executed Files

| File | Feature | Layer | Availability | Cases |
|---|---|---|---|---:|
${fileRows}

## 4. Roster

The Vitest roster is the generated JSON above. The following historical browser IDs remain reconciled separately; presence does not mean the browser/cloud lane passed.

| ID | File | Scenario |
|---|---|---|
${browserRows.join('\n')}

## 5. Retired IDs

Reserved permanently. Never reuse a retired ID for a new scenario.

${retiredIds.join(', ')}: removed recurring backfill/re-key tests. Both writers were DELETED from \`react/src/lib/recurring.ts\` in v10.22.1, not merely unwired — an exported resurrection writer with no tests and no callers is worse than either keeping it tested or removing it. Deletion is final.

Browser IDs (carried forward from the previous document; the generator never mints these):

${retiredBrowserRows.length ? retiredBrowserRows.join('\n') : '- _(none)_'}

## 6. Deployment Verification

See [UNIT_TEST_CI_HANDOFF.md](UNIT_TEST_CI_HANDOFF.md) for the ten happy-path groups, mocked boundaries, commands and remaining live-environment gates.
`;
}

export async function runInventory(args = process.argv.slice(2)) {
  const update = args.includes('--update');
  const metadata = metadataMap();
  const files = [];
  fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
  for (const app of ['react', 'admin']) {
    const option = args.find(arg => arg.startsWith(`--${app}-report=`));
    const reportPath = option ? path.resolve(root, option.slice(option.indexOf('=') + 1)) : path.join(root, `test-results/${app}-vitest.json`);
    if (!option) {
      fs.rmSync(reportPath, { force: true });
      console.log(`Running ${app} deterministic suite...`);
      const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--reporter=default', '--reporter=json', `--outputFile=${reportPath}`], {
        cwd: path.join(root, app), stdio: 'inherit', timeout: 240000,
        env: { ...process.env, OPENROUTER_API_KEY: '', TZ: 'UTC' },
      });
      if (result.status !== 0) throw new Error(`${app} test process failed: ${result.error?.message ?? result.status}`);
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    files.push(...collectReport(report, app, metadata));
  }
  files.sort((first, second) => first.file.localeCompare(second.file));
  const executed = new Set(files.map(file => file.file));
  if (executed.size !== files.length) throw new Error('Duplicate test file in reports');
  for (const file of metadata.keys()) if (!executed.has(file)) throw new Error(`Runner did not execute classified file: ${file}`);
  const content = JSON.stringify({ schemaVersion: 1, files }, null, 2) + '\n';
  const oldDoc = fs.readFileSync(docPath, 'utf8');
  // The roster capture is SCOPED to §4. It used to scan the whole document, so a
  // retired browser ID written as a table row in §5 would be carried back into
  // the live roster — and the reconciler would then reject it as both retired
  // and present. Retired browser IDs use a bullet form for the same reason.
  const rosterStart = oldDoc.indexOf('\n## 4. Roster');
  const rosterEnd = oldDoc.indexOf('\n## 5. Retired IDs');
  const rosterSrc = rosterStart === -1 ? oldDoc
    : oldDoc.slice(rosterStart, rosterEnd === -1 ? undefined : rosterEnd);
  const browserRows = rosterSrc.split(/\r?\n/).filter(line => /^\|\s*CON-E2E-\d{3}\s*\|/.test(line));
  // Retired browser IDs are hand-written (a removed scenario has no Vitest result
  // to generate from), so regeneration must PRESERVE them. Losing them silently
  // frees the ID for reuse, which is exactly what the section exists to prevent.
  const retiredSrc = rosterEnd === -1 ? '' : oldDoc.slice(rosterEnd);
  const retiredBrowserRows = retiredSrc.split(/\r?\n/)
    .filter(line => /^- CON-E2E-\d{3} — /.test(line));
  const document = renderInventory(files, browserRows, retiredBrowserRows);
  if (update) {
    fs.writeFileSync(inventoryPath, content);
    fs.writeFileSync(docPath, document);
    // Both sides are normalised to LF before comparing. The document already
    // was; the JSON was not, so on any checkout with `core.autocrlf=true`
    // (every Windows clone) git rewrites the committed file to CRLF and the
    // drift check fails against a file it would regenerate byte-identically.
    // CI is Linux, so this never fired there — it only ever broke local runs,
    // which is the worst place for a gate to cry wolf.
  } else if (!fs.existsSync(inventoryPath)
      || lf(fs.readFileSync(inventoryPath, 'utf8')) !== lf(content)
      || lf(oldDoc) !== lf(document)) {
    throw new Error('Inventory drift. Run node scripts/test-inventory.mjs --update and review the generated diff.');
  }
  console.log(`Verified inventory: ${files.reduce((sum, file) => sum + file.count, 0)} passed cases in ${files.length} files; zero skipped.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runInventory().catch(error => { console.error(error.message); process.exitCode = 1; });
}