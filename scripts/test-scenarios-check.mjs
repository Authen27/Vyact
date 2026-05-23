#!/usr/bin/env node
// FinFlow — Test Scenarios reconciler.
//
// Enforces that docs/TEST_SCENARIOS.md and the code stay in lock-step.
// Failure modes (exit code 1):
//   1. Test ID present in code but missing from the doc (orphan in code).
//   2. Test ID present in the doc but no matching test in code (orphan in doc).
//   3. Duplicate ID anywhere (in code or in the doc).
//   4. ID format violation (does not match {APP}-{LAYER}-{NNN}).
//
// Usage:  node scripts/test-scenarios-check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docPath = path.join(repoRoot, 'docs', 'TEST_SCENARIOS.md');

// Layer token allows digits so "E2E" parses correctly (E-then-2-then-E).
const ID_RE = /^([A-Z]+)-([A-Z0-9]+)-(\d{3})$/;

// ── 1. Discover scenario IDs in code ─────────────────────────────────
const sourceRoots = [
  { app: 'CON', layer: 'UNIT', dir: 'react/src/lib/__tests__', match: /\.test\.tsx?$/ },
  { app: 'ADM', layer: 'UNIT', dir: 'admin/src/lib/__tests__', match: /\.test\.tsx?$/ },
  { app: 'CON', layer: 'E2E',  dir: 'react/e2e/tests',         match: /\.spec\.tsx?$/ },
];

// Match it('ID · description', …) and test('ID · description', …).
// Accept either ' · ' (middle dot) or ' - ' as separators.
// The description body uses [\s\S]+?\1 (any-char non-greedy, terminated by the
// captured opening quote) so titles can safely embed other quote types — e.g.
// it('ADM-UNIT-011 · maps null published_at to undefined (not the string "null")', …).
const TITLE_RE = /\b(?:it|test)\s*\(\s*(['"`])([A-Z]+-[A-Z0-9]+-\d{3})\s*(?:·|-)\s*([\s\S]+?)\1/g;

function walk(dir) {
  const out = [];
  const abs = path.join(repoRoot, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const p = path.join(abs, e.name);
    if (e.isDirectory()) out.push(...walk(path.relative(repoRoot, p)));
    else out.push(p);
  }
  return out;
}

const codeScenarios = new Map();   // id -> { file, title, app, layer }
const codeDupes = [];

for (const root of sourceRoots) {
  const files = walk(root.dir).filter(f => root.match.test(f));
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    TITLE_RE.lastIndex = 0;
    let m;
    while ((m = TITLE_RE.exec(src)) !== null) {
      const id = m[2];
      const title = m[3].trim();
      const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
      const parts = ID_RE.exec(id);
      if (!parts || parts[1] !== root.app || parts[2] !== root.layer) {
        // ID's app/layer prefix doesn't match the directory it lives in.
        // Treat as a malformed ID for that location.
        codeDupes.push({
          id, where: 'malformed',
          detail: `${rel} — ID ${id} does not match expected prefix ${root.app}-${root.layer}-NNN for this directory`,
        });
        continue;
      }
      if (codeScenarios.has(id)) {
        codeDupes.push({
          id, where: 'duplicate-in-code',
          detail: `${id} appears in both ${codeScenarios.get(id).file} and ${rel}`,
        });
        continue;
      }
      codeScenarios.set(id, { file: rel, title, app: root.app, layer: root.layer });
    }
  }
}

// ── 2. Discover scenario IDs in the doc ──────────────────────────────
if (!fs.existsSync(docPath)) {
  console.error(`✗ ${path.relative(repoRoot, docPath)} not found`);
  process.exit(1);
}
const docSrc = fs.readFileSync(docPath, 'utf8');

// Scope: only consider rows inside the "## 4. Roster" section. Other sections
// (Conventions, Retired IDs, examples) can mention IDs without registering them.
const rosterStart = docSrc.indexOf('\n## 4. Roster');
const rosterEnd   = docSrc.indexOf('\n## 5. ', rosterStart === -1 ? 0 : rosterStart);
if (rosterStart === -1) {
  console.error('✗ docs/TEST_SCENARIOS.md is missing "## 4. Roster"');
  process.exit(1);
}
const rosterSrc = docSrc.slice(rosterStart, rosterEnd === -1 ? undefined : rosterEnd);

// Retired IDs section: collect to refuse reuse.
const retiredStart = docSrc.indexOf('\n## 5. Retired IDs');
const retiredSrc = retiredStart === -1 ? '' : docSrc.slice(retiredStart);
const retiredIds = new Set(
  Array.from(retiredSrc.matchAll(/\b([A-Z]+-[A-Z0-9]+-\d{3})\b/g)).map(m => m[1]),
);

const ROW_RE = /^\|\s*([A-Z]+-[A-Z0-9]+-\d{3})\s*\|\s*`?([^`|]+?)`?\s*\|\s*([^|]+?)\s*\|/gm;
const docScenarios = new Map();
const docDupes = [];
let row;
while ((row = ROW_RE.exec(rosterSrc)) !== null) {
  const id = row[1];
  const file = row[2].trim();
  const desc = row[3].trim();
  if (docScenarios.has(id)) {
    docDupes.push({ id, where: 'duplicate-in-doc', detail: `${id} listed more than once in §4` });
    continue;
  }
  if (retiredIds.has(id)) {
    docDupes.push({ id, where: 'reused-retired-id', detail: `${id} is in the Retired IDs section but also appears in §4` });
    continue;
  }
  docScenarios.set(id, { file, desc });
}

// ── 3. Reconcile ─────────────────────────────────────────────────────
const codeIds = new Set(codeScenarios.keys());
const docIds  = new Set(docScenarios.keys());

const inCodeNotDoc = [...codeIds].filter(id => !docIds.has(id)).sort();
const inDocNotCode = [...docIds].filter(id => !codeIds.has(id)).sort();

const fileMismatches = [];
for (const id of codeIds) {
  if (!docIds.has(id)) continue;
  const code = codeScenarios.get(id);
  const doc  = docScenarios.get(id);
  if (doc.file && !doc.file.includes(code.file)) {
    fileMismatches.push({ id, codeFile: code.file, docFile: doc.file });
  }
}

const allProblems =
  codeDupes.length + docDupes.length +
  inCodeNotDoc.length + inDocNotCode.length +
  fileMismatches.length;

// ── 4. Report ────────────────────────────────────────────────────────
function pad(s, n) { return String(s).padEnd(n); }

console.log(`Test scenarios reconciler — ${codeIds.size} in code · ${docIds.size} in doc`);

if (codeDupes.length) {
  console.log(`\n✗ Duplicate / malformed IDs in code (${codeDupes.length}):`);
  for (const d of codeDupes) console.log(`   ${pad(d.where, 22)} ${d.detail}`);
}
if (docDupes.length) {
  console.log(`\n✗ Duplicate / reused IDs in the doc (${docDupes.length}):`);
  for (const d of docDupes) console.log(`   ${pad(d.where, 22)} ${d.detail}`);
}
if (inCodeNotDoc.length) {
  console.log(`\n✗ IDs in code but missing from docs/TEST_SCENARIOS.md (${inCodeNotDoc.length}):`);
  for (const id of inCodeNotDoc) {
    const c = codeScenarios.get(id);
    console.log(`   ${id}   ${c.file}   "${c.title}"`);
  }
}
if (inDocNotCode.length) {
  console.log(`\n✗ IDs in docs/TEST_SCENARIOS.md but missing from code (${inDocNotCode.length}):`);
  for (const id of inDocNotCode) {
    const d = docScenarios.get(id);
    console.log(`   ${id}   ${d.file}`);
  }
}
if (fileMismatches.length) {
  console.log(`\n✗ File-column mismatches (${fileMismatches.length}):`);
  for (const m of fileMismatches) {
    console.log(`   ${m.id}   code: ${m.codeFile}   doc: ${m.docFile}`);
  }
}

if (allProblems === 0) {
  console.log(`\n✅ Catalog and code are in lock-step.`);
  process.exit(0);
}
console.log(`\n❌ ${allProblems} problem(s). Update docs/TEST_SCENARIOS.md or the test titles to reconcile.`);
process.exit(1);
