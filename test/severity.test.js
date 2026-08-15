/**
 * Severity tests. The vectors below are the worked examples from the CVSS v3.1
 * specification and from advisories in data/advisory-windows.ndjson, so a
 * regression here is visible against a published number, not against our own
 * previous output.
 */

'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rate, scoreVector, labelFor } from '../src/severity.js';

test('scores an unchanged-scope vector', () => {
  // CVE-2013-1937 worked example, spec §3.1 — base 6.1.
  assert.equal(scoreVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N'), 6.1);
});

test('scores a network/no-interaction critical', () => {
  assert.equal(scoreVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H'), 9.8);
});

test('scores a changed-scope vector', () => {
  assert.equal(scoreVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H'), 10);
});

test('a no-impact vector scores zero', () => {
  assert.equal(scoreVector('CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N'), 0);
});

test('accepts v3.0 as well as v3.1', () => {
  assert.equal(scoreVector('CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H'), 7.5);
});

test('rejects non-v3 vectors rather than mis-scoring them', () => {
  assert.equal(scoreVector('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H'), null);
  assert.equal(scoreVector('AV:N/AC:L/Au:N/C:P/I:P/A:P'), null); // v2
  assert.equal(scoreVector('HIGH'), null);
});

test('rate maps CVSS v4 to UNRATED instead of guessing', () => {
  const r = rate('CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H');
  assert.equal(r.label, 'UNRATED');
  assert.equal(r.score, null);
  assert.equal(r.source, 'cvss4');
});

test('rate accepts plain labels and normalizes MODERATE', () => {
  assert.equal(rate('MODERATE').label, 'MEDIUM');
  assert.equal(rate('high').label, 'HIGH');
  assert.equal(rate('CRITICAL').rank > rate('LOW').rank, true);
});

test('rate accepts a bare numeric score', () => {
  assert.deepEqual(
    { score: rate('7.5').score, label: rate('7.5').label },
    { score: 7.5, label: 'HIGH' }
  );
});

test('missing severity is UNRATED, never silently LOW', () => {
  for (const v of [undefined, null, '', 'nonsense']) assert.equal(rate(v).label, 'UNRATED');
  assert.equal(rate(undefined).rank, -1);
});

test('label boundaries follow the v3.1 rating scale', () => {
  assert.deepEqual(
    [0, 0.1, 3.9, 4, 6.9, 7, 8.9, 9, 10].map(labelFor),
    ['NONE', 'LOW', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL', 'CRITICAL']
  );
});
