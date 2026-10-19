// T4c (v10.126.0; audit BE-FN-11) — production's auth settings are recorded, and a change is noticed.
// Run: node --test scripts/__tests__/auth-config-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRACKED, SNAPSHOT, fetchAuthConfig, readSnapshot, compare, report, fillUnrecorded,
} from '../auth-config-check.mjs';

const REF = 'xdbfzwltqocyljbgztmv';
const fake = (status, body) => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: status < 300, status, text: async () => body }; };
  return { calls, fetchImpl };
};
const LIVE = {
  site_url: 'https://vyact.app', uri_allow_list: 'https://vyact.app/**,https://www.vyact.app/**', disable_signup: false,
  mailer_autoconfirm: false, jwt_exp: 3600,
  // Secrets the API also returns: never read, never printed.
  external_google_secret: 'g-secret-value', smtp_pass: 'smtp-password-value', smtp_admin_email: 'owner@example.com',
  hook_custom_access_token_secrets: 'v1,whsec_value',
};

test('it reads the project\'s auth settings with the token, and keeps only the tracked ones', async () => {
  const { calls, fetchImpl } = fake(200, JSON.stringify(LIVE));
  const live = await fetchAuthConfig({ ref: REF, token: 'sbp_x', fetchImpl });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.supabase.com/v1/projects/${REF}/config/auth`);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sbp_x');
  assert.equal(calls[0].init.method, undefined);                    // a read, never a write
  assert.deepEqual(Object.keys(live).sort(), ['disable_signup', 'jwt_exp', 'mailer_autoconfirm', 'site_url', 'uri_allow_list']);
  assert.doesNotMatch(JSON.stringify(live), /secret|password|owner@example/);
  for (const key of TRACKED) assert.doesNotMatch(key, /secret|_pass$|smtp_pass|smtp_user|admin_email|api_key|client_id|_token$/);
});

test('a refusal, a non-JSON answer, a bad ref or no token is an error', async () => {
  await assert.rejects(fetchAuthConfig({ ref: REF, token: 't', fetchImpl: fake(401, '{}').fetchImpl }), /answered 401/);
  await assert.rejects(fetchAuthConfig({ ref: REF, token: 't', fetchImpl: fake(200, '<html>').fetchImpl }), /not JSON/);
  await assert.rejects(fetchAuthConfig({ ref: "x'; --", token: 't', fetchImpl: fake(200, '{}').fetchImpl }), /20 lower-case/);
  await assert.rejects(fetchAuthConfig({ ref: REF, token: '', fetchImpl: fake(200, '{}').fetchImpl }), /SUPABASE_ACCESS_TOKEN is not set/);
});

test('drift is a changed recorded value; null is unrecorded; a list\'s order is not a change', () => {
  const settings = {
    site_url: 'https://vyact.app', uri_allow_list: 'https://www.vyact.app/**, https://vyact.app/**',
    disable_signup: true, mailer_autoconfirm: null, jwt_exp: 3600, password_min_length: 8,
  };
  const live = { site_url: 'https://vyact.app', uri_allow_list: LIVE.uri_allow_list, disable_signup: false, mailer_autoconfirm: false, jwt_exp: 3600 };
  const r = compare(settings, live);
  assert.deepEqual(r.drift, [{ key: 'disable_signup', expected: true, live: false }]);
  assert.deepEqual(r.unrecorded, [{ key: 'mailer_autoconfirm', live: false }]);
  assert.deepEqual(r.missing, ['password_min_length']);

  const warn = report(r);
  assert.equal(warn.fail, false);                                     // warn first (owner)
  assert.match(warn.lines[0], /^::warning title=Auth setting changed::disable_signup is false in the project, but true in supabase\/auth-config\.json/);
  assert.match(warn.lines[1], /^::warning title=Auth setting not found::password_min_length/);
  assert.match(warn.lines[2], /^::notice title=Auth settings not recorded yet::1 setting\(s\).*\{"mailer_autoconfirm":false\}$/);
  assert.equal(report(r, { strict: true }).fail, true);
  assert.equal(report({ drift: [], missing: [], unrecorded: r.unrecorded }, { strict: true }).fail, false);
  assert.deepEqual(report({ drift: [], missing: [], unrecorded: [] }).lines, ['Auth settings match supabase/auth-config.json.']);
});

test('--write fills only unrecorded settings, never a recorded one', () => {
  const snap = { _about: 'x', settings: { site_url: 'https://vyact.app', jwt_exp: null } };
  const out = fillUnrecorded(snap, [{ key: 'jwt_exp', live: 3600 }, { key: 'site_url', live: 'https://evil.example' }]);
  assert.deepEqual(out.settings, { site_url: 'https://vyact.app', jwt_exp: 3600 });
  assert.equal(snap.settings.jwt_exp, null);                          // the input is not changed
});

test('the committed record names tracked settings only, and refuses any other', () => {
  const committed = readSnapshot(readFileSync(SNAPSHOT, 'utf8'));
  assert.deepEqual(Object.keys(committed.settings), TRACKED);
  assert.throws(() => readSnapshot(JSON.stringify({ settings: { smtp_pass: null } })), /may not read: smtp_pass/);
  assert.throws(() => readSnapshot(JSON.stringify({ settings: [] })), /needs a "settings" object/);
});
