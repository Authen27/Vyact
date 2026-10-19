#!/usr/bin/env node
// T5b (v10.121.0; audit XC-ARC-11) — a catch that does nothing has to say why that is safe.
//
// CLAUDE.md has long said "never a silent write-loss catch {} on a write/contract path", and nothing
// checked it: the audit counted 110 empty catches, seven of them on writes (a split marked paid, the
// legacy recurring import, the default Cash account). ESLint's no-empty cannot help, because it treats
// a block holding only a comment as not empty, and `catch { /* best-effort */ }` is exactly the
// pattern that hid them.
//
// So every catch block with no statements, and every `.catch(() => { })` callback with an empty body, in
// the app, the admin app and the Edge Functions, must carry a comment that starts with `fault-ok:` and
// gives the reason, e.g.
//   try { localStorage.setItem(KEY, v); } catch { /* fault-ok: device storage is optional (private mode, quota) */ }
// A write that can lose the user's data reports instead: `failedWrite` / `unexpected` / `expected`
// from react/src/lib/faults.ts in the app, a logged error or a returned failure in an Edge Function.
// Tests and generated code are not checked.
//
// Run: node scripts/silent-catch-check.mjs            (the whole tree)
//      node scripts/silent-catch-check.mjs a.ts b.tsx  (just these files)
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const ts = createRequire(join(ROOT, 'react', 'package.json'))('typescript');

export const ROOTS = ['react/src', 'admin/src', 'supabase/functions'];
const SKIP_DIR = /(^|[\\/])(node_modules|__tests__|__mocks__|e2e)([\\/]|$)/;
const SKIP_FILE = /\.(test|spec)\.tsx?$|\.d\.ts$|generated/;
/** The reason has to say something: `fault-ok:` and at least two words after it. */
const REASON = /fault-ok:\s*\S+\s+\S+/;

/** Catch blocks and `.catch` callbacks with no statements and no `fault-ok:` reason, as [{ line }] (1-based).
 *  A callback with an expression body (`.catch(() => null)`) states its fallback value, so it passes. */
export function findSilentCatches(text, fileName = 'file.tsx') {
  const kind = /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const silent = (block, at) => {
    if (block.statements.length) return;
    // The comment's words only: a closing `*/` is not part of the reason.
    const inside = text.slice(block.getStart(source) + 1, block.getEnd() - 1).replace(/\/\*+|\*+\/|\/\//g, ' ');
    if (!REASON.test(inside)) out.push({ line: source.getLineAndCharacterOfPosition(at.getStart(source)).line + 1 });
  };
  const visit = (node) => {
    if (ts.isCatchClause(node)) silent(node.block, node);
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'catch') {
      const fn = node.arguments[0];
      if (fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) && ts.isBlock(fn.body)) silent(fn.body, node.expression.name);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

function walk(dir, files) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) { if (!SKIP_DIR.test(path)) walk(path, files); }
    else if (/\.tsx?$/.test(entry.name) && !SKIP_FILE.test(entry.name)) files.push(path);
  }
  return files;
}

function main(argv) {
  const files = argv.length ? argv : ROOTS.flatMap(r => walk(join(ROOT, r), []));
  const hits = [];
  for (const f of files) {
    for (const h of findSilentCatches(readFileSync(f, 'utf8'), f)) {
      hits.push(`${relative(ROOT, f).split(sep).join('/')}:${h.line}`);
    }
  }
  if (hits.length) {
    console.error(`Silent catches: ${hits.length} catch block(s) or .catch callback(s) do nothing and don't say why.`);
    for (const h of hits) console.error(`  ${h}`);
    console.error('Report the failure (react/src/lib/faults.ts: failedWrite / unexpected / expected), or, when ignoring');
    console.error('it is safe, say why: catch { /* fault-ok: <reason> */ } or .catch(() => { /* fault-ok: <reason> */ })');
    process.exit(1);
  }
  console.log(`Silent catches: none in ${files.length} file(s).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
