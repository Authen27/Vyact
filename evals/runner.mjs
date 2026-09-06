#!/usr/bin/env node
// Vyact Agent — evaluation harness (vyact-agent-architecture.md §7 layer 6).
//
// Runs the golden corpus through `runIngestion` and scores the DECISION.
//
// Built model-free on purpose: with the default `null` provider the pipeline
// gets an EMPTY dep bag, spends nothing, touches no network, and is exactly the
// deterministic path that ships today. That makes this both (a) the instrument
// that will later prove whether adding a model helped, and (b) an immediate
// regression net for the deterministic path.
//
//   node evals/runner.mjs                      # score the corpus, gate on it
//   node evals/runner.mjs --verbose            # print every case
//   node evals/runner.mjs --bucket=bank_sms    # one bucket
//   node evals/runner.mjs --record             # dump observed outcomes (JSON)
//   node evals/runner.mjs --json               # machine-readable report
//   node evals/runner.mjs --provider=null      # the seam; see providers.mjs
//
// NO NEW DEPENDENCIES. Plain ESM, Node's own TypeScript type-stripping is used
// to import the agent modules directly (they are `.ts` and erasable-syntax-only).
// On Node < 23.6 the flag is not on by default, so the runner re-execs itself
// once with `--experimental-strip-types`.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const CASES_DIR = join(HERE, 'cases');
const PIPELINE = pathToFileURL(
  join(REPO, 'supabase', 'functions', '_shared', 'agent', 'pipeline.ts'),
).href;

// ── declared gate (also stated in evals/README.md) ───────────────────────────
/** Minimum share of SCORED cases (i.e. excluding `expectedFailure`) that must match. */
const DEFAULT_THRESHOLD = 0.95;

// ═════════════════════════════════════════════════════════════════════════════
//  0. TypeScript loading — re-exec once if this Node needs the flag
// ═════════════════════════════════════════════════════════════════════════════

async function loadPipeline() {
  try {
    return await import(PIPELINE);
  } catch (err) {
    const needsFlag = /Unknown file extension|ERR_UNKNOWN_FILE_EXTENSION|Unsupported/i
      .test(String(err && err.message));
    if (!needsFlag || process.env.VYACT_EVAL_REEXEC === '1') throw err;

    const res = spawnSync(
      process.execPath,
      ['--experimental-strip-types', '--no-warnings=ExperimentalWarning',
        fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      { stdio: 'inherit', env: { ...process.env, VYACT_EVAL_REEXEC: '1' } },
    );
    process.exit(res.status ?? 1);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  1. fixtures — the household context every case resolves against
// ═════════════════════════════════════════════════════════════════════════════
//
// SYNTHETIC. No real account numbers, no real people, no real merchant tied to
// anyone. Masks are sequential-looking fabrications; names are generic.
//
// `now` is FROZEN. `resolveCandidate` takes an injected clock precisely so a
// corpus does not rot, and a harness that passed `new Date()` would start
// failing date cases on its own.

const NOW = new Date('2026-08-20T10:00:00Z');

const ACCOUNTS = [
  { name: 'HDFC Savings', kind: 'bank', maskLast4: '4471' },
  { name: 'ICICI Salary', kind: 'bank', maskLast4: '8802' },
  { name: 'Kotak Credit Card', kind: 'credit_card', maskLast4: '3319' },
  { name: 'Cash', kind: 'cash' },
  { name: 'Zerodha', kind: 'investment' },
];

export const CONTEXTS = {
  /** The default: one household, five distinct accounts. */
  one_household: {
    accounts: ACCOUNTS,
    households: [{ id: 'h1', name: 'Home' }],
    baseCurrency: 'INR',
    now: NOW,
  },
  /** Household is ALWAYS asked when there is more than one (locked, §3.5). */
  two_households: {
    accounts: ACCOUNTS,
    households: [{ id: 'h1', name: 'Home' }, { id: 'h2', name: 'Side Business' }],
    baseCurrency: 'INR',
    now: NOW,
  },
  /** Two accounts an alias like "hdfc" matches equally — the resolver must not pick. */
  hdfc_twice: {
    accounts: [
      { name: 'HDFC Savings', kind: 'bank', maskLast4: '4471' },
      { name: 'HDFC Credit Card', kind: 'credit_card', maskLast4: '9015' },
      { name: 'Cash', kind: 'cash' },
    ],
    households: [{ id: 'h1', name: 'Home' }],
    baseCurrency: 'INR',
    now: NOW,
  },
};

/** Recent-row sets for the dedupe window (stage 6). Amounts are MINOR units. */
export const RECENT_SETS = {
  none: [],
  same_day_groceries: [
    { id: 'txn-1', date: '2026-08-20', amountMinor: 85000, merchant: 'groceries' },
  ],
  cafe_auth: [
    { id: 'txn-2', date: '2026-08-19', amountMinor: 120000, merchant: 'testcafe' },
  ],
  with_reference: [
    { id: 'txn-3', date: '2026-08-19', amountMinor: 85000, merchant: 'testvendor', refId: '550012349911' },
  ],
  unrelated: [
    { id: 'txn-4', date: '2026-06-02', amountMinor: 44000, merchant: 'quickcart' },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
//  2. corpus loading
// ═════════════════════════════════════════════════════════════════════════════

const OUTCOMES = new Set(['write', 'draft', 'ask', 'block', 'ignore']);

function loadCases() {
  const files = readdirSync(CASES_DIR).filter(f => f.endsWith('.jsonl')).sort();
  /** @type {object[]} */
  const cases = [];
  const seen = new Set();

  for (const file of files) {
    const text = readFileSync(join(CASES_DIR, file), 'utf8');
    text.split(/\r?\n/).forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return;   // blank + comment lines
      let c;
      try {
        c = JSON.parse(trimmed);
      } catch (err) {
        throw new Error(`${file}:${i + 1} is not valid JSON — ${err.message}`);
      }
      const where = `${file}:${i + 1}`;
      if (!c.id) throw new Error(`${where}: every case needs an \`id\`.`);
      if (seen.has(c.id)) throw new Error(`${where}: duplicate case id "${c.id}".`);
      seen.add(c.id);
      if (!c.expect || !OUTCOMES.has(c.expect.outcome)) {
        throw new Error(`${where}: \`expect.outcome\` must be one of ${[...OUTCOMES].join('|')}.`);
      }
      if (c.expectedFailure && !(c.baseline && OUTCOMES.has(c.baseline.outcome))) {
        throw new Error(`${where}: an \`expectedFailure\` case must record the observed \`baseline.outcome\`.`);
      }
      if (c.expectedFailure && !c.note) {
        throw new Error(`${where}: an \`expectedFailure\` case must carry a \`note\` saying WHY.`);
      }
      if (c.ctx && !CONTEXTS[c.ctx]) throw new Error(`${where}: unknown ctx "${c.ctx}".`);
      if (c.recent && !RECENT_SETS[c.recent]) throw new Error(`${where}: unknown recent set "${c.recent}".`);
      cases.push({ ...c, bucket: c.bucket ?? file.replace(/\.jsonl$/, ''), source: where });
    });
  }
  if (cases.length === 0) throw new Error(`No cases found in ${CASES_DIR}.`);
  return cases;
}

// ═════════════════════════════════════════════════════════════════════════════
//  3. scoring
// ═════════════════════════════════════════════════════════════════════════════

/** The observed decision, flattened to the shape the corpus asserts against. */
function observe(outcome) {
  const { action, trace } = outcome;
  const o = {
    outcome: action.kind,
    format: trace.format,
    extractor: trace.extractor ?? null,
    reason: action.kind === 'ignore' || action.kind === 'block' ? action.reason : null,
    ambiguityKinds: action.kind === 'ask' ? action.ambiguities.map(a => a.kind) : [],
    optionCounts: action.kind === 'ask' ? action.ambiguities.map(a => a.options.length) : [],
    candidate: action.kind === 'ask' || action.kind === 'draft' || action.kind === 'write'
      ? action.candidate
      : null,
    confidence: action.kind === 'draft' ? action.confidence : null,
    issues: (trace.validation?.issues ?? []).map(i => `${i.code}/${i.severity}`),
  };
  return o;
}

const eq = (a, b) => (a === b) || (a == null && b == null);

/**
 * Compare one observation against a case's `expect`. Only asserted keys are
 * checked: a case that cares about the outcome alone stays readable, and a case
 * that cares about `amount` says so.
 *
 * @returns {string[]} human-readable mismatches; empty means pass.
 */
function diff(expect, got) {
  const problems = [];

  if (expect.outcome !== got.outcome) {
    problems.push(`outcome: expected ${expect.outcome}, got ${got.outcome}`
      + (got.reason ? ` (${got.reason})` : ''));
  }
  if (expect.reason != null && expect.reason !== got.reason) {
    problems.push(`reason: expected ${expect.reason}, got ${got.reason ?? '—'}`);
  }
  if (expect.format != null && expect.format !== got.format) {
    problems.push(`format: expected ${expect.format}, got ${got.format}`);
  }
  if (expect.extractor != null && expect.extractor !== got.extractor) {
    problems.push(`extractor: expected ${expect.extractor}, got ${got.extractor ?? '—'}`);
  }

  // ambiguityKinds is a SUBSET assertion: the corpus states the question that
  // must be asked, not the complete list (the engine may legitimately add more).
  for (const kind of expect.ambiguityKinds ?? []) {
    if (!got.ambiguityKinds.includes(kind)) {
      problems.push(`ambiguity: expected a "${kind}" question, got [${got.ambiguityKinds.join(', ') || 'none'}]`);
    }
  }
  if (expect.minOptions != null) {
    const min = got.optionCounts.length ? Math.min(...got.optionCounts) : 0;
    if (min < expect.minOptions) {
      problems.push(`options: expected >= ${expect.minOptions} per question, got ${min}`);
    }
  }

  for (const [key, want] of Object.entries(expect.candidate ?? {})) {
    const have = got.candidate ? got.candidate[key] : undefined;
    if (!eq(want, have)) {
      problems.push(`candidate.${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(have)}`);
    }
  }

  // An issue code the case says the validator MUST raise (§3.4 guards).
  for (const code of expect.issues ?? []) {
    if (!got.issues.some(i => i.startsWith(`${code}/`))) {
      problems.push(`validator: expected issue "${code}", got [${got.issues.join(', ') || 'none'}]`);
    }
  }
  return problems;
}

// ═════════════════════════════════════════════════════════════════════════════
//  4. reporting
// ═════════════════════════════════════════════════════════════════════════════

const pct = n => `${(n * 100).toFixed(1)}%`;
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function bar(rate, width = 14) {
  const filled = Math.round(rate * width);
  return '#'.repeat(filled) + '.'.repeat(width - filled);
}

function printReport(results, opts, provider) {
  const scored = results.filter(r => !r.xfail);
  const passed = scored.filter(r => r.pass);
  const failed = scored.filter(r => !r.pass);
  const xfails = results.filter(r => r.xfail);
  const drift = xfails.filter(r => r.driftedFrom != null);
  const rate = scored.length ? passed.length / scored.length : 1;

  const line = '─'.repeat(78);
  console.log(`\n${line}`);
  console.log('VYACT AGENT — INGESTION EVAL');
  console.log(`provider   ${provider.label ?? provider.id}`);
  console.log(`corpus     ${results.length} cases  ·  ${scored.length} scored  ·  ${xfails.length} known-gap (expectedFailure)`);
  console.log(`clock      ${NOW.toISOString()} (frozen)`);
  console.log(line);

  // ── per bucket ─────────────────────────────────────────────────────────────
  const buckets = [...new Set(results.map(r => r.case.bucket))].sort();
  console.log(`\n${pad('BUCKET', 14)} ${lpad('SCORED', 7)} ${lpad('PASS', 5)} ${lpad('FAIL', 5)} ${lpad('GAP', 4)}  ${pad('ACCURACY', 8)}`);
  console.log('─'.repeat(78));
  for (const b of buckets) {
    const rows = results.filter(r => r.case.bucket === b);
    const s = rows.filter(r => !r.xfail);
    const p = s.filter(r => r.pass).length;
    const g = rows.length - s.length;
    const r = s.length ? p / s.length : 1;
    console.log(
      `${pad(b, 14)} ${lpad(s.length, 7)} ${lpad(p, 5)} ${lpad(s.length - p, 5)} ${lpad(g, 4)}  `
      + `${pad(s.length ? pct(r) : '   n/a', 8)} ${bar(r)}`,
    );
  }
  console.log('─'.repeat(78));
  console.log(`${pad('TOTAL', 14)} ${lpad(scored.length, 7)} ${lpad(passed.length, 5)} ${lpad(failed.length, 5)} ${lpad(xfails.length, 4)}  ${pad(pct(rate), 8)} ${bar(rate)}`);

  // ── confusion summary ──────────────────────────────────────────────────────
  console.log('\nCONFUSION (expected outcome -> observed), scored cases only');
  console.log('─'.repeat(78));
  const outs = ['write', 'draft', 'ask', 'block', 'ignore'];
  console.log(`${pad('expected \\ got', 16)}${outs.map(o => lpad(o, 8)).join('')}${lpad('total', 8)}`);
  for (const want of outs) {
    const row = scored.filter(r => r.case.expect.outcome === want);
    if (row.length === 0) continue;
    const cells = outs.map(got => {
      const n = row.filter(r => r.got.outcome === got).length;
      return lpad(n === 0 ? '.' : (want === got ? String(n) : `${n}!`), 8);
    });
    console.log(`${pad(want, 16)}${cells.join('')}${lpad(row.length, 8)}`);
  }

  // ── failures ───────────────────────────────────────────────────────────────
  if (failed.length > 0) {
    console.log(`\nFAILURES (${failed.length}) — these are NOT known gaps`);
    console.log('─'.repeat(78));
    for (const r of failed) {
      console.log(`\n  ${r.case.id}  [${r.case.bucket}]${r.case.safety ? '  ** SAFETY **' : ''}`);
      console.log(`    input   ${JSON.stringify(r.case.text).slice(0, 120)}`);
      for (const p of r.problems) console.log(`    x  ${p}`);
    }
  }

  // ── xfail drift ────────────────────────────────────────────────────────────
  if (drift.length > 0) {
    console.log(`\nBASELINE DRIFT (${drift.length}) — a known-gap case changed behaviour`);
    console.log('─'.repeat(78));
    for (const r of drift) {
      const now = r.pass ? `${r.got.outcome} (NOW PASSES — retire the expectedFailure)` : r.got.outcome;
      console.log(`  ${pad(r.case.id, 30)} baseline ${r.driftedFrom} -> ${now}`);
    }
  }

  // ── known gaps ─────────────────────────────────────────────────────────────
  if (xfails.length > 0 && opts.verbose) {
    console.log(`\nKNOWN GAPS (${xfails.length})`);
    console.log('─'.repeat(78));
    for (const r of xfails) {
      console.log(`  ${pad(r.case.id, 30)} want ${pad(r.case.expect.outcome, 6)} got ${pad(r.got.outcome, 6)} — ${r.case.note}`);
    }
  }

  if (opts.verbose) {
    console.log('\nALL CASES');
    console.log('─'.repeat(78));
    for (const r of results) {
      const tag = r.xfail ? (r.pass ? 'XPASS' : 'gap  ') : (r.pass ? 'pass ' : 'FAIL ');
      console.log(`  ${tag} ${pad(r.case.id, 30)} ${pad(r.case.expect.outcome, 6)} -> ${pad(r.got.outcome, 6)} ${r.got.reason ?? r.got.ambiguityKinds.join('+')}`);
    }
  }

  return { scored, passed, failed, xfails, drift, rate };
}

// ═════════════════════════════════════════════════════════════════════════════
//  5. main
// ═════════════════════════════════════════════════════════════════════════════

function parseArgs(argv) {
  const opts = { verbose: false, json: false, record: false, bucket: null, provider: undefined, threshold: DEFAULT_THRESHOLD };
  for (const a of argv) {
    if (a === '--verbose' || a === '-v') opts.verbose = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--record') opts.record = true;
    else if (a.startsWith('--bucket=')) opts.bucket = a.slice(9);
    else if (a.startsWith('--provider=')) opts.provider = a.slice(11);
    else if (a.startsWith('--threshold=')) opts.threshold = Number(a.slice(12));
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else throw new Error(`Unknown flag "${a}". Try --help.`);
  }
  if (!(opts.threshold >= 0 && opts.threshold <= 1)) throw new Error('--threshold must be between 0 and 1.');
  return opts;
}

function printHelp() {
  console.log(`
Vyact agent ingestion eval

  node evals/runner.mjs [flags]

  --verbose, -v        print every case and every known gap
  --bucket=<name>      run one bucket only (file basename in evals/cases/)
  --provider=<id>      model seam; default "null" (offline, deterministic)
  --threshold=<0..1>   accuracy floor over SCORED cases (default ${DEFAULT_THRESHOLD})
  --record             print observed outcomes as JSON (for authoring baselines)
  --json               machine-readable report on stdout
  --help, -h           this

Exit codes: 0 green · 1 gate failed · 2 harness error.
`.trim());
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { runIngestion } = await loadPipeline();
  const { resolveProvider, toIngestionDeps } = await import('./providers.mjs');

  const provider = resolveProvider(opts.provider);
  const deps = toIngestionDeps(provider);

  let cases = loadCases();
  if (opts.bucket) {
    cases = cases.filter(c => c.bucket === opts.bucket);
    if (cases.length === 0) throw new Error(`No cases in bucket "${opts.bucket}".`);
  }

  const results = [];
  for (const c of cases) {
    const input = {
      text: c.text ?? '',
      channel: c.channel ?? 'chat',
      ctx: CONTEXTS[c.ctx ?? 'one_household'],
      householdId: 'householdId' in c ? c.householdId : 'h1',
      recent: RECENT_SETS[c.recent ?? 'none'],
      hasImage: c.hasImage === true,
    };

    let got;
    try {
      got = observe(await runIngestion(input, deps));
    } catch (err) {
      got = { outcome: 'ignore', format: 'chitchat', extractor: null, reason: `THREW: ${err.message}`,
        ambiguityKinds: [], optionCounts: [], candidate: null, confidence: null, issues: [] };
    }

    const problems = diff(c.expect, got);
    const pass = problems.length === 0;
    const xfail = c.expectedFailure === true;
    // Drift = a known-gap case that no longer behaves the way its baseline says.
    // Includes XPASS (it started passing), which is news either way.
    const driftedFrom = xfail && (got.outcome !== c.baseline.outcome
      || (c.baseline.reason != null && got.reason !== c.baseline.reason))
      ? `${c.baseline.outcome}${c.baseline.reason ? `/${c.baseline.reason}` : ''}`
      : null;

    results.push({ case: c, got, problems, pass, xfail, driftedFrom });
  }

  if (opts.record) {
    console.log(JSON.stringify(results.map(r => ({
      id: r.case.id, bucket: r.case.bucket, expected: r.case.expect.outcome,
      got: r.got.outcome, reason: r.got.reason, ambiguityKinds: r.got.ambiguityKinds,
      issues: r.got.issues, candidate: r.got.candidate, pass: r.pass, problems: r.problems,
    })), null, 1));
    return 0;
  }

  const summary = printReport(results, opts, provider);

  // ── the gate ───────────────────────────────────────────────────────────────
  const safetyFailures = summary.failed.filter(r => r.case.safety === true);
  const belowThreshold = summary.rate < opts.threshold;
  const drifted = summary.drift.length > 0;

  console.log(`\n${'─'.repeat(78)}`);
  console.log(`GATE  accuracy ${pct(summary.rate)} vs threshold ${pct(opts.threshold)}   `
    + `safety failures ${safetyFailures.length}   baseline drift ${summary.drift.length}`);

  if (opts.json) {
    console.log(JSON.stringify({
      provider: provider.id,
      total: results.length,
      scored: summary.scored.length,
      passed: summary.passed.length,
      failed: summary.failed.length,
      knownGaps: summary.xfails.length,
      accuracy: summary.rate,
      threshold: opts.threshold,
      safetyFailures: safetyFailures.map(r => r.case.id),
      drift: summary.drift.map(r => r.case.id),
      failures: summary.failed.map(r => ({ id: r.case.id, problems: r.problems })),
    }, null, 1));
  }

  if (belowThreshold || safetyFailures.length > 0 || drifted) {
    const why = [
      belowThreshold && `accuracy ${pct(summary.rate)} < ${pct(opts.threshold)}`,
      safetyFailures.length > 0 && `${safetyFailures.length} SAFETY case(s) failed`,
      drifted && `${summary.drift.length} known-gap case(s) changed behaviour`,
    ].filter(Boolean);
    console.log(`RED   ${why.join('  ·  ')}\n`);
    return 1;
  }
  console.log('GREEN\n');
  return 0;
}

main().then(
  code => { process.exitCode = code; },
  err => {
    console.error(`\nevals: ${err && err.stack ? err.stack : err}\n`);
    process.exitCode = 2;
  },
);
