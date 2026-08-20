/**
 * Repository-spec tests.
 *
 * The hosted node refuses a path because resolving one a stranger names is an
 * arbitrary file read. Naming a repository points the same risk outward, so the
 * URL is never taken from the visitor — only owner, repository and ref, and the
 * host is a constant. These tests are the proof that nothing else gets through.
 */

'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseRepoSpec } from '../src/resolve.js';

test('the forms a person actually types all resolve', () => {
  const head = { owner: 'expressjs', repo: 'express', ref: 'HEAD' };
  for (const form of [
    'expressjs/express',
    ' expressjs/express ',
    'github.com/expressjs/express',
    'www.github.com/expressjs/express',
    'https://github.com/expressjs/express',
    'https://github.com/expressjs/express.git',
  ]) assert.deepEqual(parseRepoSpec(form), head, form);
});

test('a ref can be named, in either notation', () => {
  assert.deepEqual(parseRepoSpec('axios/axios@v1.7.2'), { owner: 'axios', repo: 'axios', ref: 'v1.7.2' });
  assert.deepEqual(parseRepoSpec('https://github.com/axios/axios/tree/v1.7.2'),
    { owner: 'axios', repo: 'axios', ref: 'v1.7.2' });
  assert.deepEqual(parseRepoSpec('https://github.com/axios/axios/blob/release/1.x'),
    { owner: 'axios', repo: 'axios', ref: 'release/1.x' });
});

test('nothing that could leave raw.githubusercontent.com is accepted', () => {
  for (const evil of [
    'evil.com/a/b',                       // another host
    'a/b@../../../../etc/passwd',         // traversal in the ref
    '../../etc/passwd',
    'a/b@HEAD/../../..',
    'a/b?x=1',
    'a/b#frag',
    'a/b@ref with space',
    'a/b/c/d',                            // not a repository
    'onlyowner',
    '',
    '   ',
  ]) assert.throws(() => parseRepoSpec(evil), /repository|character|GitHub|climbs/, `accepted ${JSON.stringify(evil)}`);
});

test('a scoped-looking name is still just owner and repo', () => {
  assert.deepEqual(parseRepoSpec('jadonamite/recall'), { owner: 'jadonamite', repo: 'recall', ref: 'HEAD' });
});
