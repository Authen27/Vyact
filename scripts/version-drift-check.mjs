#!/usr/bin/env node
// Vyact — version-drift guard (TD-28 / closes TD-23's recurrence).
//
// The consumer and admin version numbers are hand-maintained in several
// surfaces. This gate makes `react/package.json` and `admin/package.json` the
// source of truth and fails the build when any human-facing surface drifts:
//   - README.md           — the "Current" column for each app
//   - VERSIONS.md         — the master status table rows
//   - react/CHANGELOG.md  — the "Current production version" banner
//
// Exit code 1 on any mismatch, with a precise report of file → expected → found.
//
// Usage: node scripts/version-drift-check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const pkgVersion = (p) => JSON.parse(read(p)).version;

const consumer = pkgVersion('react/package.json');
const admin = pkgVersion('admin/package.json');

// Each check pulls the version that a surface *claims* for an app and compares
// it to the package.json truth. `find` returns the claimed version or null.
const checks = [
  {
    file: 'README.md',
    label: 'README consumer row',
    expected: consumer,
    find: (s) => s.match(/\*\*Consumer \(React\)\*\*\s*\|\s*\*\*v([0-9]+\.[0-9]+\.[0-9]+)\*\*/)?.[1],
  },
  {
    file: 'README.md',
    label: 'README admin row',
    expected: admin,
    find: (s) => s.match(/\*\*Admin\*\*\s*\|\s*\*\*v([0-9]+\.[0-9]+\.[0-9]+)\*\*/)?.[1],
  },
  {
    file: 'VERSIONS.md',
    label: 'VERSIONS consumer row',
    expected: consumer,
    find: (s) => s.match(/\*\*Consumer \(React\)\*\*[^\n]*?\*\*v([0-9]+\.[0-9]+\.[0-9]+)\*\*/)?.[1],
  },
  {
    file: 'VERSIONS.md',
    label: 'VERSIONS admin row',
    expected: admin,
    find: (s) => s.match(/\*\*Admin\*\*[^\n]*?\*\*v([0-9]+\.[0-9]+\.[0-9]+)\*\*/)?.[1],
  },
  {
    file: 'react/CHANGELOG.md',
    label: 'CHANGELOG production banner',
    expected: consumer,
    find: (s) => s.match(/Current production version:\s*`v([0-9]+\.[0-9]+\.[0-9]+)`/)?.[1],
  },
];

const failures = [];
for (const c of checks) {
  const found = c.find(read(c.file));
  if (found == null) {
    failures.push(`${c.file} — ${c.label}: could not locate a version string (pattern moved?)`);
  } else if (found !== c.expected) {
    failures.push(`${c.file} — ${c.label}: expected v${c.expected} (from package.json) but found v${found}`);
  }
}

if (failures.length) {
  console.error('Version-drift check FAILED:');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(`\nSource of truth: react/package.json = v${consumer}, admin/package.json = v${admin}.`);
  console.error('Fix the drifted surface(s) above (do not hand-edit versions out of sync).');
  process.exit(1);
}

console.log(`Version-drift check passed — consumer v${consumer}, admin v${admin} consistent across README, VERSIONS, CHANGELOG.`);
