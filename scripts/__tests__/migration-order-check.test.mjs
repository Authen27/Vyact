// Q1 (v10.128.0; audit OPS-03) — a branch's migration sorts after every migration on main.
// Run: node --test scripts/__tests__/migration-order-check.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { outOfOrder } from '../migration-order-check.mjs';

const MAIN = ['20261106120000_t5d_cron_project_url.sql', '20261108120000_t4d_native_push.sql', 'README.md'];

test('a new migration after main\'s latest is fine; nothing new is fine', () => {
  assert.deepEqual(outOfOrder(MAIN, [...MAIN, '20261109120000_q3_budget_guard.sql']), []);
  assert.deepEqual(outOfOrder(MAIN, MAIN), []);
});

test('a new migration dated before (or at) main\'s latest, or with no timestamp, is out of order', () => {
  assert.deepEqual(outOfOrder(MAIN, [...MAIN, '20261107130000_late_rename.sql']),
    [{ file: '20261107130000_late_rename.sql', latest: '20261108120000' }]);
  assert.deepEqual(outOfOrder(MAIN, [...MAIN, '20261108120000_same_second.sql']).map((b) => b.file), ['20261108120000_same_second.sql']);
  assert.deepEqual(outOfOrder(MAIN, [...MAIN, 'fix_budget.sql']).map((b) => b.file), ['fix_budget.sql']);
  assert.deepEqual(outOfOrder(MAIN, [...MAIN, 'notes.md']), []);       // only .sql files are migrations
});
