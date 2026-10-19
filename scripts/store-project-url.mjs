#!/usr/bin/env node
// T5d (v10.123.0; audit DB-OPS-07, BE-FN-11; owner, 19 Oct 2026: "Deploy writes it").
//
// Stores a Supabase project's own base URL in its Vault (`project_url`), which every scheduled job reads
// to call that project's Edge Functions (migration 20261106120000). Until then the jobs named the
// production host, so a test database called production. Run by the deploy workflows right after the
// migrations, with the access token they already hold, through the Management API's SQL endpoint and the
// database's own writer, public.set_project_url().
//
//   SUPABASE_ACCESS_TOKEN=… node scripts/store-project-url.mjs <project-ref>          (fails the run if not stored)
//   SUPABASE_ACCESS_TOKEN=… node scripts/store-project-url.mjs <project-ref> --soft   (warns instead)
//
// Production uses the default: without `project_url` its jobs call nothing, so a failure must be seen.
// vyact-test uses --soft: its database may not have the migration yet. The token and the ref are never
// printed.
import { fileURLToPath } from 'node:url';

const REF = /^[a-z0-9]{20}$/;

/** Stores https://<ref>.supabase.co as the project's `project_url`; returns it, or throws why not. */
export async function storeProjectUrl({ ref, token, fetchImpl = fetch }) {
  if (!REF.test(ref ?? '')) throw new Error('the project ref must be 20 lower-case letters and digits');
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not set');
  const url = `https://${ref}.supabase.co`;
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `select public.set_project_url('${url}') as url` }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`the Management API answered ${res.status}: ${text.slice(0, 300)}`);
  // The function returns the URL it stored; the endpoint answers with the result rows. Any successful
  // answer carrying that URL as a JSON string is the confirmation (whatever the rows are wrapped in).
  if (!text.includes(JSON.stringify(url))) throw new Error(`the database did not confirm it: ${text.slice(0, 300)}`);
  return url;
}

async function main(argv) {
  const ref = argv.find((a) => !a.startsWith('--'));
  const soft = argv.includes('--soft');
  try {
    await storeProjectUrl({ ref, token: process.env.SUPABASE_ACCESS_TOKEN });
    console.log('project_url stored: the scheduled jobs call this project.');
  } catch (e) {
    const message = String(e instanceof Error ? e.message : e).replaceAll(ref ?? '\u0000', '<ref>');
    if (soft) { console.log(`::warning title=project_url not stored::${message}`); return; }
    console.error(`::error title=project_url not stored::${message} Without it the scheduled jobs call nothing.`);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
