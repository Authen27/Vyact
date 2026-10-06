#!/usr/bin/env node
// W0 (audit 2026-10-04, XC-PRV-01) — fail when a secret-shaped string is committed.
//
// A production `sb_secret_` key sat in setup.sh from 10 May to 1 Jun 2026 and is still in
// git history (it has since been revoked). Nothing checked for it. This scans every
// TRACKED file (docs included — .github/workflows/secret-scan.yml has no paths filter) and
// reports file:line and the KIND of secret only, never the value.
//
// Run: node scripts/secret-scan.mjs            (all tracked files)
//      node scripts/secret-scan.mjs a.ts b.md  (just these files)
// A line that must contain a look-alike (a test fixture) can carry `secret-scan: allow`.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mixed = s => /[a-z]/.test(s) && /[A-Z]/.test(s) && /[0-9]/.test(s);
const placeholder = s => /[[\]<>{}$*]|your|password|example|xxxx/i.test(s);

export const RULES = [
  { kind: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{20,}/g },
  { kind: 'Private key block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/g },
  { kind: 'Meta / WhatsApp access token', re: /\bEAA[A-Za-z0-9]{60,}/g, ok: mixed },
  { kind: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{32,}/g },
  { kind: 'OpenAI / OpenRouter API key', re: /\bsk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{40,}/g, ok: m => !m.startsWith('sk-ant-') && mixed(m) },
  { kind: 'GitHub token', re: /\b(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}/g },
  { kind: 'Resend API key', re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}/g, ok: mixed },
  { kind: 'Database URL with a password', re: /postgres(?:ql)?:\/\/[^:\s/@]+:([^@\s]{6,})@/g, ok: (_m, pw) => !placeholder(pw) },
];

// JWTs: only a service_role token is a secret (the anon/publishable key is public by design).
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.(eyJ[A-Za-z0-9_-]{8,})\.[A-Za-z0-9_-]{8,}/g;
function jwtRole(payload) {
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')).role ?? null; } catch { return null; }
}

/** Findings in one text: [{ line, kind }] — never the matched value. */
export function scanText(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    if (line.includes('secret-scan: allow')) return;
    const kinds = new Set();
    for (const r of RULES) {
      for (const m of line.matchAll(r.re)) {
        if (!r.ok || r.ok(m[0], m[1])) kinds.add(r.kind);
      }
    }
    for (const m of line.matchAll(JWT)) {
      if (jwtRole(m[1]) === 'service_role') kinds.add('Supabase service_role JWT');
    }
    kinds.forEach(kind => out.push({ line: i + 1, kind }));
  });
  return out;
}

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0').filter(Boolean);
}

function main(argv) {
  const files = argv.length ? argv : trackedFiles();
  const hits = [];
  for (const f of files) {
    let st;
    try { st = statSync(f); } catch { continue; }          // deleted in the working tree
    if (!st.isFile() || st.size > 4 * 1024 * 1024) continue;
    const buf = readFileSync(f);
    if (buf.includes(0)) continue;                          // binary
    for (const h of scanText(buf.toString('utf8'))) hits.push(`${f}:${h.line}  ${h.kind}`);
  }
  if (hits.length) {
    console.error(`Secret scan: ${hits.length} secret-shaped string(s) found. Values are not printed.`);
    for (const h of hits) console.error(`  ${h}`);
    console.error('Remove the value, rotate it if it was real, and keep secrets in Supabase / GitHub / Vercel settings.');
    process.exit(1);
  }
  console.log(`Secret scan: ${files.length} file(s) clean.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
