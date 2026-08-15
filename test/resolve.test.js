/**
 * Lock-file resolution tests.
 *
 * The edge set is the whole product — if npm's node_modules lookup is replayed
 * wrongly, every path the recall query returns is a lie. These cases cover the
 * rules that actually bite: hoisting to the root, a nested copy shadowing the
 * hoisted one, walking up past a scope that doesn't have the dependency, and
 * workspace links, which are not real packages.
 */

'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fromLockfile } from '../src/resolve.js';

function fixture(packages, name = 'app', version = '1.0.0') {
  const dir = mkdtempSync(join(tmpdir(), 'recall-'));
  writeFileSync(join(dir, 'package-lock.json'), JSON.stringify({
    name, version, lockfileVersion: 3,
    packages: { ...packages, '': { name, version, ...packages[''] } },
  }));
  return dir;
}

const edgeSet = (g) => new Set(g.edges.map((e) => `${e.from}->${e.to}`));

test('hoisted dependency resolves from the root node_modules', () => {
  const g = fromLockfile(fixture({
    '': { dependencies: { a: '^1.0.0' } },
    'node_modules/a': { version: '1.2.0', dependencies: { b: '^2.0.0' } },
    'node_modules/b': { version: '2.1.0' },
  }));
  assert.equal(g.root, 'app@1.0.0');
  assert.deepEqual(edgeSet(g), new Set(['app@1.0.0->a@1.2.0', 'a@1.2.0->b@2.1.0']));
});

test('a nested copy shadows the hoisted one', () => {
  // The classic case a flat scanner collapses: two live versions of b, and
  // only one of them is the one a reaches.
  const g = fromLockfile(fixture({
    '': { dependencies: { a: '^1.0.0', b: '^2.0.0' } },
    'node_modules/a': { version: '1.0.0', dependencies: { b: '^1.0.0' } },
    'node_modules/a/node_modules/b': { version: '1.9.9' },
    'node_modules/b': { version: '2.0.0' },
  }));
  assert.deepEqual(edgeSet(g), new Set([
    'app@1.0.0->a@1.0.0', 'app@1.0.0->b@2.0.0', 'a@1.0.0->b@1.9.9',
  ]));
});

test('lookup walks up past a scope that lacks the dependency', () => {
  const g = fromLockfile(fixture({
    '': { dependencies: { a: '^1.0.0' } },
    'node_modules/a': { version: '1.0.0', dependencies: { b: '^1.0.0' } },
    'node_modules/a/node_modules/b': { version: '1.0.0', dependencies: { c: '^1.0.0' } },
    'node_modules/c': { version: '1.0.0' },
  }));
  assert.ok(edgeSet(g).has('b@1.0.0->c@1.0.0'));
});

test('devDependencies are excluded unless asked for', () => {
  const packages = {
    '': { dependencies: { a: '^1.0.0' }, devDependencies: { d: '^1.0.0' } },
    'node_modules/a': { version: '1.0.0' },
    'node_modules/d': { version: '1.0.0' },
  };
  assert.ok(!edgeSet(fromLockfile(fixture(packages))).has('app@1.0.0->d@1.0.0'));
  assert.ok(edgeSet(fromLockfile(fixture(packages), { dev: true })).has('app@1.0.0->d@1.0.0'));
});

test('workspace links are not packages and produce no edges', () => {
  const g = fromLockfile(fixture({
    '': { dependencies: { pkg: '*' } },
    'node_modules/pkg': { resolved: 'packages/pkg', link: true },
    'packages/pkg': { version: '0.0.1' },
  }));
  assert.equal(g.edges.length, 0);
  assert.ok(!g.nodes.some((n) => n.name === 'pkg' && n.version === undefined));
});

test('optionalDependencies count as edges', () => {
  const g = fromLockfile(fixture({
    '': { dependencies: { a: '^1.0.0' } },
    'node_modules/a': { version: '1.0.0', optionalDependencies: { o: '^1.0.0' } },
    'node_modules/o': { version: '1.0.0' },
  }));
  assert.ok(edgeSet(g).has('a@1.0.0->o@1.0.0'));
});

test('a missing dependency is dropped, not invented', () => {
  const g = fromLockfile(fixture({
    '': { dependencies: { a: '^1.0.0' } },
    'node_modules/a': { version: '1.0.0', dependencies: { ghost: '^1.0.0' } },
  }));
  assert.deepEqual(edgeSet(g), new Set(['app@1.0.0->a@1.0.0']));
});

test('lockfileVersion 1 is rejected with an actionable message', () => {
  const dir = mkdtempSync(join(tmpdir(), 'recall-'));
  writeFileSync(join(dir, 'package-lock.json'),
    JSON.stringify({ name: 'app', version: '1.0.0', lockfileVersion: 1, dependencies: {} }));
  assert.throws(() => fromLockfile(dir), /lockfileVersion 1/);
});
