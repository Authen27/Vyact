// W0 (audit 2026-10-04, XC-PRV-01) — the secret scan flags real secret shapes and stays
// quiet on the public look-alikes this repo legitimately contains. Fixture values are
// assembled at runtime so this file never contains a secret-shaped literal itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../secret-scan.mjs';

const rnd = (n, set = 'aB3dE5gH7jK9mN1pQ2') => Array.from({ length: n }, (_, i) => set[(i * 7) % set.length]).join('');
const b64url = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = role => ['eyJ' + b64url({ alg: 'HS256' }).slice(3), b64url({ role, iss: 'supabase' }), rnd(43)].join('.');
const kinds = text => scanText(text).map(h => h.kind);

test('flags secret shapes, by kind only', () => {
  assert.deepEqual(kinds(`SECRET_KEY="${'sb_' + 'secret_' + rnd(30)}"`), ['Supabase secret key']);
  assert.deepEqual(kinds(`key: ${jwt('service_role')}`), ['Supabase service_role JWT']);
  assert.deepEqual(kinds('-----BEGIN ' + 'PRIVATE KEY-----'), ['Private key block']);
  assert.deepEqual(kinds('token=' + 'EAA' + rnd(80)), ['Meta / WhatsApp access token']);
  assert.deepEqual(kinds('OPENAI=' + 'sk-' + 'proj-' + rnd(60)), ['OpenAI / OpenRouter API key']);
  assert.deepEqual(kinds('ANTHROPIC=' + 'sk-' + 'ant-' + rnd(60)), ['Anthropic API key']);
  assert.deepEqual(kinds('DB=postgres://postgres:' + rnd(14) + '@db.x.supabase.co:5432/postgres'), ['Database URL with a password']);
  const hit = scanText(`a\nb\nSECRET="${'sb_' + 'secret_' + rnd(30)}"`)[0];
  assert.equal(hit.line, 3);
  assert.ok(!JSON.stringify(hit).includes('secret_' + rnd(5)), 'never returns the value');
});

test('stays quiet on public look-alikes', () => {
  assert.deepEqual(kinds(`if (!bearer.startsWith('sb_secret_')) return false;`), []);       // a prefix check
  assert.deepEqual(kinds(`ANON_KEY="sb_publishable_${rnd(30)}"`), []);                        // public by design
  assert.deepEqual(kinds(`anon: ${jwt('anon')}`), []);                                         // anon JWT is public
  assert.deepEqual(kinds('/learn/ev-012-sk-high-interest-credit-card-debt-and-how-to-clear-it'), []);  // slug
  assert.deepEqual(kinds('postgres://postgres:[YOUR-PASSWORD]@db.ref.supabase.co:5432/postgres'), []);
  assert.deepEqual(kinds(`x = '${'sb_' + 'secret_' + rnd(30)}' // secret-scan: allow`), []);
});
