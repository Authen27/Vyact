#!/usr/bin/env node
// T4c (v10.126.0; audit BE-FN-11; owner, 19 Oct 2026: "snapshot + drift check", warn first).
//
// Production's sign-in settings (Supabase Auth: redirect URLs, sign-up, email confirmation, providers, token
// lifetimes, password rules, rate limits) lived only in the dashboard, so a change there was invisible to
// review and nothing noticed one. `supabase/auth-config.json` is the record of the settings that matter, and
// this script compares it with the live project through the Management API
// (GET /v1/projects/{ref}/config/auth), with the access token the Deploy workflow already holds.
//
//   SUPABASE_ACCESS_TOKEN=… node scripts/auth-config-check.mjs <project-ref>            warn on drift (exit 0)
//   SUPABASE_ACCESS_TOKEN=… node scripts/auth-config-check.mjs <project-ref> --strict   fail on drift (exit 1)
//   SUPABASE_ACCESS_TOKEN=… node scripts/auth-config-check.mjs <project-ref> --write    record unrecorded values
//
// • A setting recorded as null is not recorded yet: the run prints its live value and the JSON to paste.
//   `--write` fills those in the file (never a recorded value: a difference is drift, decided by a person).
// • Only the settings in TRACKED are ever read or printed. The API's answer also holds secrets (provider
//   secrets, SMTP password, hook secrets); they are never touched. The token and the ref are never printed.
// • The Deploy workflow runs it warn-only, as the owner chose; `--strict` is for when the record is complete.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REF = /^[a-z0-9]{20}$/;
export const SNAPSHOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'auth-config.json');

/** The settings this check may read: none is a secret. A snapshot naming anything else is refused. */
export const TRACKED = [
  // Where sign-in may send people back to.
  'site_url', 'uri_allow_list',
  // Who can sign up, and how.
  'disable_signup', 'external_email_enabled', 'mailer_autoconfirm', 'external_google_enabled',
  'external_anonymous_users_enabled', 'external_phone_enabled', 'security_manual_linking_enabled',
  // Sessions and tokens (recently_reauthenticated() reads the JWT's sign-in time).
  'jwt_exp', 'refresh_token_rotation_enabled', 'security_refresh_token_reuse_interval',
  'sessions_timebox', 'sessions_inactivity_timeout',
  // Passwords and account changes.
  'password_min_length', 'password_required_characters', 'password_hibp_enabled',
  'security_update_password_require_reauthentication', 'mailer_secure_email_change_enabled', 'mailer_otp_exp',
  // Two-factor (owner decision D23: no 2FA in the app) and bot checks.
  'mfa_totp_enroll_enabled', 'mfa_totp_verify_enabled', 'security_captcha_enabled',
  // Rate limits.
  'rate_limit_email_sent', 'rate_limit_otp', 'rate_limit_verify', 'rate_limit_token_refresh',
  'rate_limit_anonymous_users',
  // The sender (host only: the account and password are never read).
  'smtp_host',
];

/** Settings compared as sets: the order of a comma-separated list is not a change. */
const LISTS = new Set(['uri_allow_list']);

function normalise(key, value) {
  if (value === undefined) return undefined;
  if (LISTS.has(key) && typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean).sort().join(',');
  }
  return value;
}

/** The live values of the tracked settings, or throws why not. */
export async function fetchAuthConfig({ ref, token, fetchImpl = fetch }) {
  if (!REF.test(ref ?? '')) throw new Error('the project ref must be 20 lower-case letters and digits');
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not set');
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`the Management API answered ${res.status}`);
  let body;
  try { body = JSON.parse(await res.text()); } catch { throw new Error('the Management API answer was not JSON'); }
  if (!body || typeof body !== 'object') throw new Error('the Management API answer was not an object');
  const live = {};
  for (const key of TRACKED) if (key in body) live[key] = body[key];
  return live;
}

/** Checks a snapshot's shape: an object of tracked settings only. */
export function readSnapshot(text) {
  const parsed = JSON.parse(text);
  const settings = parsed?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('auth-config.json needs a "settings" object');
  const unknown = Object.keys(settings).filter((k) => !TRACKED.includes(k));
  if (unknown.length) throw new Error(`auth-config.json names settings this check may not read: ${unknown.join(', ')}`);
  return parsed;
}

/**
 * Compares the record with the live values.
 *   drift:      recorded, and the live value differs;
 *   unrecorded: null in the record, with the live value to record;
 *   missing:    recorded, but the live answer has no such setting (renamed or removed by Supabase).
 */
export function compare(settings, live) {
  const drift = [];
  const unrecorded = [];
  const missing = [];
  for (const [key, expected] of Object.entries(settings)) {
    const actual = normalise(key, live[key]);
    if (actual === undefined) { missing.push(key); continue; }
    if (expected === null) { unrecorded.push({ key, live: actual }); continue; }
    if (JSON.stringify(normalise(key, expected)) !== JSON.stringify(actual)) drift.push({ key, expected, live: actual });
  }
  return { drift, unrecorded, missing };
}

const show = (v) => JSON.stringify(v);

/** The lines a run prints (GitHub annotations), and whether it should fail. */
export function report({ drift, unrecorded, missing }, { strict = false } = {}) {
  const lines = [];
  for (const d of drift) {
    lines.push(`::warning title=Auth setting changed::${d.key} is ${show(d.live)} in the project, but ${show(d.expected)} in supabase/auth-config.json. If the change was meant, record it in the file; if not, change it back in the Supabase dashboard (Authentication).`);
  }
  for (const key of missing) {
    lines.push(`::warning title=Auth setting not found::${key} is in supabase/auth-config.json but not in the project's auth settings (Supabase may have renamed it).`);
  }
  if (unrecorded.length) {
    const block = Object.fromEntries(unrecorded.map((u) => [u.key, u.live]));
    lines.push(`::notice title=Auth settings not recorded yet::${unrecorded.length} setting(s) have no recorded value. Copy these into supabase/auth-config.json (or run the script with --write): ${JSON.stringify(block)}`);
  }
  if (!drift.length && !missing.length && !unrecorded.length) lines.push('Auth settings match supabase/auth-config.json.');
  return { lines, fail: strict && (drift.length > 0 || missing.length > 0) };
}

/** Fills the unrecorded (null) settings with their live values; never changes a recorded one. */
export function fillUnrecorded(snapshot, unrecorded) {
  const settings = { ...snapshot.settings };
  for (const u of unrecorded) if (settings[u.key] === null) settings[u.key] = u.live;
  return { ...snapshot, settings };
}

async function main(argv) {
  const ref = argv.find((a) => !a.startsWith('--'));
  const strict = argv.includes('--strict');
  const write = argv.includes('--write');
  const hide = (s) => String(s).replaceAll(ref || '\u0000', '<ref>');
  try {
    const snapshot = readSnapshot(readFileSync(SNAPSHOT, 'utf8'));
    const live = await fetchAuthConfig({ ref, token: process.env.SUPABASE_ACCESS_TOKEN });
    const result = compare(snapshot.settings, live);
    if (write && result.unrecorded.length) {
      writeFileSync(SNAPSHOT, `${JSON.stringify(fillUnrecorded(snapshot, result.unrecorded), null, 2)}\n`);
      console.log(`Recorded ${result.unrecorded.length} setting(s) in supabase/auth-config.json. Review and commit it.`);
      result.unrecorded = [];
    }
    const { lines, fail } = report(result, { strict });
    for (const line of lines) console.log(hide(line));
    if (fail) process.exit(1);
  } catch (e) {
    const message = hide(e instanceof Error ? e.message : e);
    if (strict) { console.error(`::error title=Auth settings not checked::${message}`); process.exit(1); }
    console.log(`::warning title=Auth settings not checked::${message}`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
