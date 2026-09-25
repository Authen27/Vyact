#!/usr/bin/env node
// Vyact — submit manifest templates to Meta (create, or edit an existing one).
//
// DRY-RUN BY DEFAULT: without --apply it prints exactly what it would send and
// touches nothing. Submitting is an outward action on the business account, so it
// only happens when you run it yourself with --apply and name the templates:
//
//   node --experimental-strip-types scripts/whatsapp/templates-submit.mjs payday_headroom
//   WHATSAPP_ACCESS_TOKEN=… WHATSAPP_WABA_ID=1887272231954080 META_APP_ID=… \
//     node --experimental-strip-types scripts/whatsapp/templates-submit.mjs --apply payday_headroom
//
// The header image is uploaded from react/public/whatsapp/ through Meta's resumable
// upload (which needs META_APP_ID) to get the handle a template submission takes.
// An edit goes back into Meta review, and Meta limits how often an approved template
// can be edited; the category of an existing template is never changed here.
// Afterwards, run templates-status.mjs to confirm Meta now matches the manifest.

import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES, lintTemplate, metaSubmissionComponents } from '../../supabase/functions/_shared/whatsapp-templates.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`;
const apply = process.argv.includes('--apply');
const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));

if (!names.length) {
  console.error('Name the templates to submit, e.g. payday_headroom. Known:', Object.keys(TEMPLATES).join(', '));
  process.exit(2);
}
for (const n of names) {
  if (!TEMPLATES[n]) { console.error(`Unknown template: ${n}`); process.exit(2); }
  const problems = lintTemplate(TEMPLATES[n]);
  if (problems.length) { console.error(`${n} breaks Meta's rules:\n  - ${problems.join('\n  - ')}`); process.exit(1); }
}

const token = process.env.WHATSAPP_ACCESS_TOKEN;
const waba = process.env.WHATSAPP_WABA_ID;
const appId = process.env.META_APP_ID;
if (apply && (!token || !waba)) { console.error('--apply needs WHATSAPP_ACCESS_TOKEN and WHATSAPP_WABA_ID.'); process.exit(2); }

async function graph(path, init = {}) {
  const res = await fetch(`${GRAPH}/${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Meta ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

/** Meta's resumable upload → the `h` handle a template header example takes. */
async function uploadHeader(file) {
  if (!appId) throw new Error('An image header needs META_APP_ID for the resumable upload.');
  const path = resolve(ROOT, 'react/public/whatsapp', file);
  const size = statSync(path).size;
  const session = await graph(`${appId}/uploads?file_name=${encodeURIComponent(file)}&file_length=${size}&file_type=image/jpeg`, { method: 'POST' });
  const res = await fetch(`${GRAPH}/${session.id}`, {
    method: 'POST', headers: { Authorization: `OAuth ${token}`, file_offset: '0' }, body: readFileSync(path),
  });
  const out = await res.json();
  if (!res.ok || !out.h) throw new Error(`Upload failed: ${JSON.stringify(out)}`);
  return out.h;
}

const existing = apply
  ? new Map(((await graph(`${waba}/message_templates?fields=id,name,language&limit=200`)).data ?? [])
      .filter((t) => t.language === 'en_US').map((t) => [t.name, t.id]))
  : new Map();

for (const n of names) {
  const def = TEMPLATES[n];
  const handle = def.headerImage ? (apply ? await uploadHeader(def.headerImage) : '<upload handle>') : undefined;
  const components = metaSubmissionComponents(def, handle);
  const id = existing.get(n);
  const request = id
    ? { method: 'POST', path: `${id}`, body: { components } }
    : { method: 'POST', path: `${waba ?? '<WABA_ID>'}/message_templates`,
        body: { name: def.name, language: def.language, category: def.category.toUpperCase(), components } };
  if (!apply) {
    console.log(`\n# ${n} — ${id ? 'EDIT' : 'CREATE (or EDIT, if it already exists)'} (dry run)`);
    console.log(JSON.stringify(request, null, 2));
    continue;
  }
  const result = await graph(request.path, { method: 'POST', body: JSON.stringify(request.body) });
  console.log(`${n}: ${id ? 'edited' : 'created'} →`, JSON.stringify(result));
}
if (!apply) console.log('\nDry run only. Re-run with --apply to submit.');
