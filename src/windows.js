/**
 * Version-window classification — the time dimension of the recall query.
 *
 * An advisory declares windows: [{introduced, fixed}] (fixed=null → still
 * open) and/or an explicit affected-versions list. Given a concrete version,
 * classify it:
 *
 *   'inside'   — the version sits in an affected window (exposed)
 *   'patched'  — the version is at/above a fix for every window it entered
 *   'before'   — the version predates every window (never exposed)
 *   'unknown'  — the version doesn't parse or the advisory has no usable data
 *
 * Semver quirks handled: OSV uses '0' for "from the beginning"; versions in
 * the wild carry prefixes ('v1.2.3') and 4-part or partial forms — coerce
 * rather than reject, but never coerce silently into a false 'inside'.
 */

'use strict';

import semver from 'semver';

const clean = (v) => semver.valid(semver.coerce(v));

/**
 * @param {string} version                     concrete version to classify
 * @param {{windows?: {introduced:string, fixed:string|null}[], versions?: string[]}} adv
 * @returns {'inside'|'patched'|'before'|'unknown'}
 */
export function classify(version, adv) {
  const v = clean(version);
  if (!v) return 'unknown';

  // Explicit version list wins when present — it is exact.
  if (adv.versions?.length) {
    const hit = adv.versions.some((av) => {
      const a = clean(av);
      return a !== null && semver.eq(v, a);
    });
    if (hit) return 'inside';
    // A version list without windows is exhaustive → not listed = not affected.
    if (!adv.windows?.length) return 'patched';
  }

  if (!adv.windows?.length) return 'unknown';

  let sawWindow = false;
  let beforeAll = true;
  for (const w of adv.windows) {
    const intro = w.introduced === '0' ? '0.0.0' : clean(w.introduced);
    if (intro === null) continue;
    sawWindow = true;

    const aboveIntro = semver.gte(v, intro);
    if (aboveIntro) beforeAll = false;

    const fixed = w.fixed ? clean(w.fixed) : null;
    const belowFix = fixed === null ? true : semver.lt(v, fixed);
    if (aboveIntro && belowFix) return 'inside';
  }
  if (!sawWindow) return 'unknown';
  return beforeAll ? 'before' : 'patched';
}

/**
 * Summarize a package version against a list of advisories.
 * @returns {{exposed: object[], patched: number, state: 'exposed'|'clean'}}
 */
export function assess(version, advisories) {
  const exposed = [];
  let patched = 0;
  for (const adv of advisories) {
    const c = classify(version, adv);
    if (c === 'inside') exposed.push({ id: adv.id, severity: adv.severity, summary: adv.summary });
    else if (c === 'patched') patched++;
  }
  return { exposed, patched, state: exposed.length ? 'exposed' : 'clean' };
}
