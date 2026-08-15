/**
 * Relationship-type tests.
 *
 * A Cypher relationship type cannot be a parameter, so it is interpolated into
 * the query string. That makes the sanitizer the only thing standing between a
 * package name from a stranger's lock file and the query text, which is worth
 * a few tests of its own.
 */

'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { safeRelType, relTypeFor, cypherFor } from '../src/query.js';

test('a normal project root becomes a usable type', () => {
  assert.equal(relTypeFor('my-app@1.0.0'), 'IN_MY_APP_1_0_0');
  assert.equal(relTypeFor('@scope/pkg@2.3.4'), 'IN__SCOPE_PKG_2_3_4');
});

test('quotes, braces and newlines cannot escape the query', () => {
  for (const evil of [
    "x'}) YIELD path RETURN path //",
    'a"b',
    'a\nMATCH (n) DETACH DELETE n',
    'a`b',
    'a) MERGE (x',
  ]) {
    const t = relTypeFor(evil);
    assert.match(t, /^[A-Za-z_][A-Za-z0-9_]*$/, `unsafe type produced: ${t}`);
    const q = cypherFor(t);
    assert.equal(q.includes("'" + t + "'"), true);
    // Four single quotes total, and no more: the pair around the type and the
    // pair around 'incoming'. Anything else means a quote survived the scrub.
    assert.equal((q.match(/'/g) ?? []).length, 4);
    assert.equal(q.split('\n').length, 8);
  }
});

test('the default traversal type is unchanged', () => {
  assert.match(cypherFor(), /relTypes: \['DEPENDS_ON'\]/);
  assert.match(cypherFor(), /relDirection: 'incoming'/);
});

test('a type that sanitizes to nothing usable is rejected, not silently emptied', () => {
  assert.throws(() => safeRelType(''), /unusable relationship type/);
});

test('a leading digit is not a valid type start', () => {
  // relTypeFor prefixes IN_, so this can only arise from a direct call.
  assert.throws(() => safeRelType('9lives'), /unusable relationship type/);
});

test('types stay short enough for the server to accept', () => {
  const t = relTypeFor('x'.repeat(500) + '@1.0.0');
  assert.ok(t.length <= 120, `type too long: ${t.length}`);
  assert.match(t, /^[A-Za-z_][A-Za-z0-9_]*$/);
});
