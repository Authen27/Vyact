import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectReport, renderInventory } from '../test-inventory.mjs';

const metadata = new Map([['component.test.tsx', { feature: 'Example', layer: 'unit', availability: 'available', owner: 'production' }]]);
const report = () => ({ success: true, numTotalTests: 2, numPassedTests: 2, testResults: [{ name: 'component.test.tsx', status: 'passed', assertionResults: [
  { fullName: 'untagged case', status: 'passed' }, { fullName: 'parameterized case 2', status: 'passed' },
] }] });

test('counts every reported assertion including untagged and expanded parameterized component cases', () => {
  const files = collectReport(report(), 'react', metadata, value => value);
  assert.equal(files[0].count, 2);
  assert.deepEqual(files[0].tests, ['parameterized case 2', 'untagged case']);
  assert.match(renderInventory(files, []), /2 passing deterministic cases in 1 files/);
});
test('rejects skipped, failing, empty and incomplete reports', () => {
  for (const patch of [{ success: false }, { numPendingTests: 1 }, { numFailedTestSuites: 1 }, { numTodoTests: 1 },
    { testResults: [] }, { numTotalTests: 3 }]) {
    assert.throws(() => collectReport({ ...report(), ...patch }, 'react', metadata, value => value));
  }
});
test('rejects unclassified files and nonpassing assertions', () => {
  assert.throws(() => collectReport(report(), 'react', new Map(), value => value), /Unclassified/);
  const failed = report();
  failed.testResults[0].assertionResults[0].status = 'failed';
  assert.throws(() => collectReport(failed, 'react', metadata, value => value), /Non-passing/);
});