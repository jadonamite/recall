/**
 * Severity rating.
 *
 * OSV hands back whatever the upstream database recorded: sometimes a plain
 * label ("HIGH"), sometimes a CVSS vector string and nothing else. A vector is
 * not a severity until someone scores it, and a UI that ranks fixes has to
 * rank them by something real — so the v3.x base score is computed here from
 * the vector, exactly as the specification defines it.
 *
 * CVSS v4.0 vectors are NOT scored. The v4 formula is a lookup table, not a
 * closed form, and approximating it with the v3 equation would produce a
 * confident number that is simply wrong. Those come back UNRATED, which is the
 * honest answer.
 *
 * Reference: CVSS v3.1 specification §7.1 (FIRST, 2019).
 */

'use strict';

const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const AC = { L: 0.77, H: 0.44 };
const PR = { U: { N: 0.85, L: 0.62, H: 0.27 }, C: { N: 0.85, L: 0.68, H: 0.5 } };
const UI = { N: 0.85, R: 0.62 };
const CIA = { H: 0.56, L: 0.22, N: 0 };

const LABELS = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ALIASES = { MODERATE: 'MEDIUM', IMPORTANT: 'HIGH', UNKNOWN: 'UNRATED' };

/** Base score → qualitative rating, per the v3.1 rating scale. */
export function labelFor(score) {
  if (score === null || Number.isNaN(score)) return 'UNRATED';
  if (score === 0) return 'NONE';
  if (score < 4) return 'LOW';
  if (score < 7) return 'MEDIUM';
  if (score < 9) return 'HIGH';
  return 'CRITICAL';
}

// v3.1 rounds up to one decimal; naive ceil misfires on float representation
// (6.1 stored as 6.0999… would round to 6.2), hence the integer detour.
const roundUp = (x) => {
  const i = Math.round(x * 100000);
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
};

/** @returns {number|null} CVSS v3.x base score, or null if not a v3 vector. */
export function scoreVector(vector) {
  if (typeof vector !== 'string' || !/^CVSS:3\.[01]\//.test(vector)) return null;
  const m = Object.fromEntries(
    vector.split('/').slice(1).map((p) => p.split(':'))
  );
  const scope = m.S === 'C' ? 'C' : 'U';
  const av = AV[m.AV], ac = AC[m.AC], pr = PR[scope][m.PR], ui = UI[m.UI];
  const c = CIA[m.C], i = CIA[m.I], a = CIA[m.A];
  if ([av, ac, pr, ui, c, i, a].some((v) => v === undefined)) return null;

  const iss = 1 - (1 - c) * (1 - i) * (1 - a);
  const impact = scope === 'U'
    ? 6.42 * iss
    : 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15;
  if (impact <= 0) return 0;

  const exploitability = 8.22 * av * ac * pr * ui;
  const raw = scope === 'U'
    ? Math.min(impact + exploitability, 10)
    : Math.min(1.08 * (impact + exploitability), 10);
  return roundUp(raw);
}

/**
 * Normalize whatever OSV recorded into something rankable.
 * @param {string|number|undefined} raw
 * @returns {{score: number|null, label: string, rank: number, source: string}}
 */
export function rate(raw) {
  const v = raw === undefined || raw === null ? '' : String(raw).trim();

  const fromVector = scoreVector(v);
  if (fromVector !== null) {
    const label = labelFor(fromVector);
    return { score: fromVector, label, rank: LABELS.indexOf(label), source: 'cvss3' };
  }

  if (/^CVSS:4\.0\//.test(v)) return { score: null, label: 'UNRATED', rank: -1, source: 'cvss4' };

  if (/^\d+(\.\d+)?$/.test(v)) {
    const score = Number(v);
    const label = labelFor(score);
    return { score, label, rank: LABELS.indexOf(label), source: 'numeric' };
  }

  const upper = ALIASES[v.toUpperCase()] ?? v.toUpperCase();
  if (LABELS.includes(upper)) return { score: null, label: upper, rank: LABELS.indexOf(upper), source: 'label' };

  return { score: null, label: 'UNRATED', rank: -1, source: 'none' };
}
