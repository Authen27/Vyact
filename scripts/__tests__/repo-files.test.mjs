// Q8 (v10.136.0; audit XC-ARC-15; owner decision 25 Oct 2026: "remove, store privately") — the repository tracks code,
// not business or design artefacts. Whatever is committed is shared with everyone who can read the repository (it was
// public on 25 Oct 2026), and it stays in the history. Office files, archives, media and design files are refused
// anywhere; images only where an app serves them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean);

/** Never tracked: documents, archives, media, design files and builds. */
export const REFUSED = /\.(pdf|pptx?|docx?|xlsx?|odt|ods|odp|key|numbers|pages|zip|rar|7z|gz|tgz|bz2|mp4|mov|avi|webm|mkv|mp3|wav|m4a|psd|ai|sketch|fig|xd|apk|aab|ipa|jar|exe|dll)$/i;
/** Images, only under a folder an app serves. */
export const IMAGE = /\.(png|jpe?g|gif|webp|bmp|tiff?|heic)$/i;
export const SERVED = /^(react|admin)\/public\//;

test('no document, archive, media or design file is tracked', () => {
  assert.deepEqual(tracked.filter((f) => REFUSED.test(f)), []);
});

test('images are tracked only where an app serves them', () => {
  assert.deepEqual(tracked.filter((f) => IMAGE.test(f) && !SERVED.test(f)), []);
});

test('the rules catch what they are for', () => {
  for (const f of ['Vyact App/finflow-ceo-roadmap.pptx', 'plan.docx', 'designs.zip', 'Vyact Redesign/x.fig']) assert.ok(REFUSED.test(f), f);
  assert.ok(IMAGE.test('Vyact-handoff/screenshots/app-dark.png') && !SERVED.test('Vyact-handoff/screenshots/app-dark.png'));
  assert.ok(SERVED.test('react/public/icons/icon-192.png'));
  assert.ok(!REFUSED.test('react/src/lib/format.ts') && !IMAGE.test('react/public/manifest.webmanifest'));
});
