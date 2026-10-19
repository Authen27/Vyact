// T5b (v10.121.0; audit XC-ARC-11) — the silent-catch check flags a catch that does nothing without saying
// why, and passes one that reports or gives a reason. Run: node --test scripts/__tests__/silent-catch-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findSilentCatches } from '../silent-catch-check.mjs';

const lines = (text, file = 'x.ts') => findSilentCatches(text, file).map(h => h.line);

test('an empty catch, or one holding only a comment, is flagged; so is an empty .catch callback', () => {
  assert.deepEqual(lines('try { a(); } catch {}'), [1]);
  assert.deepEqual(lines('try { a(); } catch (e) { /* best-effort */ }'), [1]);
  assert.deepEqual(lines('try {\n  a();\n} catch {\n  // noop\n}'), [3]);
  assert.deepEqual(lines('void save().catch(() => {});'), [1]);
  assert.deepEqual(lines('void save()\n  .catch(function () { /* ignore */ });'), [2]);
  assert.deepEqual(lines('const C = () => { try { a(); } catch { /* x */ } return <div/>; };', 'x.tsx'), [1]);
});

test('a reason, a report or an explicit fallback value passes', () => {
  assert.deepEqual(lines('try { a(); } catch { /* fault-ok: device storage is optional */ }'), []);
  assert.deepEqual(lines('try {\n  a();\n} catch {\n  // fault-ok: the reload below still runs\n}'), []);
  assert.deepEqual(lines("try { a(); } catch (e) { failedWrite(e, 'x'); }"), []);
  assert.deepEqual(lines('void save().catch(() => { /* fault-ok: the widget is optional */ });'), []);
  assert.deepEqual(lines("void save().catch(e => unexpected(e, 'x'));"), []);
  assert.deepEqual(lines('const rows = await read().catch(() => null);'), []);
});

test('fault-ok needs a reason of at least two words', () => {
  assert.deepEqual(lines('try { a(); } catch { /* fault-ok: */ }'), [1]);
  assert.deepEqual(lines('try { a(); } catch { /* fault-ok: noop */ }'), [1]);
  assert.deepEqual(lines('try { a(); } catch { /* fault-ok noop ok */ }'), [1]);
});
