import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, assess } from '../src/windows.js';

const W = (introduced, fixed = null) => ({ introduced, fixed });

test('inside an open window (introduced, never fixed)', () => {
  assert.equal(classify('2.0.0', { windows: [W('1.0.0')] }), 'inside');
});

test('inside a closed window', () => {
  assert.equal(classify('4.17.11', { windows: [W('0', '4.17.12')] }), 'inside');
});

test('patched: at the fix boundary', () => {
  assert.equal(classify('4.17.12', { windows: [W('0', '4.17.12')] }), 'patched');
});

test('patched: above the fix', () => {
  assert.equal(classify('5.0.0', { windows: [W('1.0.0', '2.0.0')] }), 'patched');
});

test('before: predates the window entirely', () => {
  assert.equal(classify('0.9.0', { windows: [W('1.0.0', '2.0.0')] }), 'before');
});

test('OSV "0" means from-the-beginning', () => {
  assert.equal(classify('0.0.1', { windows: [W('0', '1.0.0')] }), 'inside');
});

test('multiple windows: inside any one is inside', () => {
  const adv = { windows: [W('1.0.0', '1.5.0'), W('2.0.0', '2.3.0')] };
  assert.equal(classify('2.1.0', adv), 'inside');
  assert.equal(classify('1.7.0', adv), 'patched');
});

test('explicit version list is exact and wins', () => {
  const adv = { versions: ['1.2.3', '1.2.4'], windows: [] };
  assert.equal(classify('1.2.3', adv), 'inside');
  assert.equal(classify('1.2.5', adv), 'patched');
});

test('v-prefixed and messy versions coerce', () => {
  assert.equal(classify('v2.0.0', { windows: [W('1.0.0')] }), 'inside');
});

test('unparseable version is unknown, never inside', () => {
  assert.equal(classify('not-a-version', { windows: [W('0')] }), 'unknown');
});

test('advisory with no data is unknown', () => {
  assert.equal(classify('1.0.0', {}), 'unknown');
});

test('assess aggregates across advisories', () => {
  const advisories = [
    { id: 'A', severity: 'HIGH', summary: 'bad', windows: [W('0', '2.0.0')] },
    { id: 'B', severity: 'LOW', summary: 'meh', windows: [W('0', '1.0.0')] },
  ];
  const r = assess('1.5.0', advisories);
  assert.equal(r.state, 'exposed');
  assert.deepEqual(r.exposed.map((e) => e.id), ['A']);
  assert.equal(r.patched, 1);
});
