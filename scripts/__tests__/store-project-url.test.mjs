// T5d (v10.123.0; audit DB-OPS-07) — the deploy step that stores a project's own URL for its scheduled jobs.
// Run: node --test scripts/__tests__/store-project-url.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeProjectUrl } from '../store-project-url.mjs';

const REF = 'xdbfzwltqocyljbgztmv';
const fake = (status, body) => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { ok: status < 300, status, text: async () => body }; };
  return { calls, fetchImpl };
};

test('it asks the project\'s own database to store its own URL, and returns it once confirmed', async () => {
  const { calls, fetchImpl } = fake(201, JSON.stringify([{ url: `https://${REF}.supabase.co` }]));
  assert.equal(await storeProjectUrl({ ref: REF, token: 'sbp_x', fetchImpl }), `https://${REF}.supabase.co`);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `https://api.supabase.com/v1/projects/${REF}/database/query`);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer sbp_x');
  assert.deepEqual(JSON.parse(calls[0].init.body), { query: `select public.set_project_url('https://${REF}.supabase.co') as url` });
  // The rows may come wrapped; the URL in the answer is what confirms it.
  const wrapped = fake(200, JSON.stringify({ result: [{ url: `https://${REF}.supabase.co` }] }));
  assert.equal(await storeProjectUrl({ ref: REF, token: 't', fetchImpl: wrapped.fetchImpl }), `https://${REF}.supabase.co`);
});

test('a refusal, an unconfirmed answer, a bad ref or no token is an error (never a quiet success)', async () => {
  await assert.rejects(storeProjectUrl({ ref: REF, token: 't', fetchImpl: fake(400, '{"message":"function public.set_project_url(unknown) does not exist"}').fetchImpl }), /answered 400/);
  await assert.rejects(storeProjectUrl({ ref: REF, token: 't', fetchImpl: fake(201, '[]').fetchImpl }), /did not confirm/);
  await assert.rejects(storeProjectUrl({ ref: "x'; drop table t; --", token: 't', fetchImpl: fake(201, '[]').fetchImpl }), /20 lower-case/);
  await assert.rejects(storeProjectUrl({ ref: REF, token: '', fetchImpl: fake(201, '[]').fetchImpl }), /SUPABASE_ACCESS_TOKEN is not set/);
});
