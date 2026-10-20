#!/usr/bin/env node
// Q1 (v10.128.0; audit OPS-03). A migration added by a branch must sort AFTER every migration already on main.
//
// Deploy used `supabase db push --include-all`, which applies a migration older than the last applied one
// anyway, out of order, so "the latest file wins" could be false in production (a stacked PR whose migration
// was named before another that merged first). Q1 drops --include-all, so such a file would now fail the
// Deploy; this check refuses it on the pull request instead, where renaming it is cheap.
//
//   node scripts/migration-order-check.mjs [base-ref]     (default: origin/$GITHUB_BASE_REF, else origin/main)
// Exit 0 = in order (or nothing new), 1 = a new migration is not newer than the base's latest.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = 'supabase/migrations';
const stamp = (f) => (/^(\d{14})_/.exec(f) ?? [])[1] ?? null;

/** New migrations (in head, not in base) whose timestamp is not after the base's latest. */
export function outOfOrder(baseNames, headNames) {
  const base = new Set(baseNames.filter((f) => f.endsWith('.sql')));
  const latest = [...base].map(stamp).filter(Boolean).sort().pop() ?? '';
  return headNames
    .filter((f) => f.endsWith('.sql') && !base.has(f))
    .filter((f) => !stamp(f) || stamp(f) <= latest)
    .map((file) => ({ file, latest }));
}

function baseNames(ref) {
  const list = () => execFileSync('git', ['ls-tree', '--name-only', `${ref}:${DIR}`], { encoding: 'utf8' });
  try { return list().split('\n').filter(Boolean); }
  catch {
    // A shallow CI checkout has no base yet: fetch just its tip.
    const branch = ref.replace(/^origin\//, '');
    execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', `${branch}:refs/remotes/origin/${branch}`], { stdio: 'ignore' });
    return list().split('\n').filter(Boolean);
  }
}

function main(argv) {
  const ref = argv[0] ?? (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main');
  let base;
  try { base = baseNames(ref); }
  catch (e) {
    console.log(`::warning title=Migration order not checked::could not read ${ref} (${e instanceof Error ? e.message.split('\n')[0] : e})`);
    return;
  }
  const bad = outOfOrder(base, readdirSync(DIR));
  if (!bad.length) { console.log(`Migration order ok against ${ref}.`); return; }
  for (const b of bad) {
    console.error(`::error title=Migration out of order::${b.file} is not newer than ${ref}'s latest migration (${b.latest}). Rename it with a later timestamp; Deploy would refuse it.`);
  }
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
