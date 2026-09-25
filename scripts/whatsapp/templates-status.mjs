#!/usr/bin/env node
// Vyact — compare the WhatsApp template manifest with what Meta actually holds.
//
// READ-ONLY: it never creates, edits or deletes a template. Run it by hand, with
// your own token in your own shell (it is never printed or written anywhere):
//
//   WHATSAPP_ACCESS_TOKEN=… WHATSAPP_WABA_ID=1887272231954080 \
//     node --experimental-strip-types scripts/whatsapp/templates-status.mjs [--json]
//
// Prints each template's status and category at Meta, and every difference between
// Meta and supabase/functions/_shared/whatsapp-templates.ts (body, header, footer,
// buttons). Exits 1 when anything drifted, so a send can never be built from a
// manifest that no longer matches the approved template.

import { TEMPLATES } from '../../supabase/functions/_shared/whatsapp-templates.ts';

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION || 'v21.0'}`;
const token = process.env.WHATSAPP_ACCESS_TOKEN;
const waba = process.env.WHATSAPP_WABA_ID;
const asJson = process.argv.includes('--json');
/** Meta samples we keep on purpose and do not manage from the manifest. */
const UNMANAGED = new Set(['hello_world']);

if (!token || !waba) {
  console.error('Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_WABA_ID in your shell first.');
  process.exit(2);
}

async function fetchAll() {
  const out = [];
  let url = `${GRAPH}/${waba}/message_templates?fields=id,name,status,category,language,components&limit=100`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Meta ${res.status}: ${await res.text()}`);
    const page = await res.json();
    out.push(...(page.data ?? []));
    url = page.paging?.next ?? null;
  }
  return out;
}

const norm = (s) => String(s ?? '').replace(/\r\n/g, '\n').trim();

function diff(def, remote) {
  const problems = [];
  const part = (type) => (remote.components ?? []).find((c) => c.type === type);
  if (norm(part('BODY')?.text) !== norm(def.body)) problems.push('body differs');
  const header = part('HEADER');
  if (!!def.headerImage !== (header?.format === 'IMAGE')) {
    problems.push(def.headerImage ? 'manifest has an image header; Meta does not' : 'Meta has an image header; manifest does not');
  }
  if (norm(part('FOOTER')?.text) !== norm(def.footer)) problems.push('footer differs');
  const remoteButtons = (part('BUTTONS')?.buttons ?? []).map((b) => `${b.type}:${b.text}`).join(' | ');
  const localButtons = (def.buttons ?? []).map((b) => `${b.type === 'url' ? 'URL' : 'QUICK_REPLY'}:${b.text}`).join(' | ');
  if (remoteButtons !== localButtons) problems.push(`buttons differ (Meta: ${remoteButtons || 'none'})`);
  if (remote.category?.toLowerCase() !== def.category && !(def.category === 'marketing' && remote.category === 'UTILITY')) {
    problems.push(`category at Meta is ${remote.category}; manifest treats it as ${def.category}`);
  }
  return problems;
}

const remote = await fetchAll();
const byName = new Map(remote.filter((r) => r.language === 'en_US').map((r) => [r.name, r]));
const rows = [];
for (const def of Object.values(TEMPLATES)) {
  const r = byName.get(def.name);
  rows.push(r
    ? { name: def.name, status: r.status, category: r.category, problems: diff(def, r) }
    : { name: def.name, status: 'MISSING', category: '-', problems: ['not found at Meta'] });
}
const extra = remote.filter((r) => !TEMPLATES[r.name] && !UNMANAGED.has(r.name)).map((r) => r.name);

if (asJson) {
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), rows, notInManifest: extra }, null, 2));
} else {
  for (const r of rows) {
    console.log(`${r.problems.length ? '✗' : '✓'} ${r.name.padEnd(26)} ${String(r.status).padEnd(10)} ${r.category}`);
    for (const p of r.problems) console.log(`    - ${p}`);
  }
  if (extra.length) console.log(`\nAt Meta but not in the manifest: ${extra.join(', ')}`);
}
process.exit(rows.some((r) => r.problems.length) || extra.length ? 1 : 0);
