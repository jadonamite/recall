/**
 * Recall advisory history — the "compromised version windows" layer.
 *
 * advisories.js asks: is this EXACT version vulnerable? (Answer for current
 * top-package versions: rarely — they're patched. 14 hits across 2,270.)
 *
 * This asks the richer question: which advisories exist for each package NAME,
 * and which version windows do they affect? That yields the graph's time
 * dimension: a node either sits inside a window (exposed), above it (patched),
 * or the window is upstream of it entirely (inherited exposure).
 *
 * Output: data/advisory-windows.ndjson
 *   { id, package, summary, severity, ranges: [{introduced, fixed}], versions: [...] }
 */

'use strict';

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const DATA = new URL('../data/', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function queryName(name, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch('https://api.osv.dev/v1/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ package: { ecosystem: 'npm', name } }),
        signal: AbortSignal.timeout(40_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) return null;
      await sleep(1800 * 2 ** i);
    }
  }
}

export function windowsOf(vuln, name) {
  const out = [];
  for (const aff of vuln.affected ?? []) {
    if (aff.package?.name !== name || aff.package?.ecosystem !== 'npm') continue;
    for (const r of aff.ranges ?? []) {
      if (r.type !== 'SEMVER' && r.type !== 'ECOSYSTEM') continue;
      let intro = '0', fixed = null;
      for (const ev of r.events ?? []) {
        if (ev.introduced !== undefined) intro = ev.introduced;
        if (ev.fixed !== undefined) fixed = ev.fixed;
      }
      out.push({ introduced: intro, fixed });
    }
    if (aff.versions?.length) out.push({ versions: aff.versions.slice(0, 50) });
  }
  return out;
}

export function severityOf(v) {
  const cvss = v.severity?.find((s) => s.type?.startsWith('CVSS'));
  return cvss?.score ?? v.database_specific?.severity ?? 'UNKNOWN';
}

async function main() {
  const names = [...new Set(
    readFileSync(`${DATA}nodes.ndjson`, 'utf8').split('\n').filter(Boolean)
      .map((l) => JSON.parse(l).name)
  )];
  const doneFile = `${DATA}advisory-names.done`;
  const done = new Set(
    existsSync(doneFile) ? readFileSync(doneFile, 'utf8').split('\n').filter(Boolean) : []
  );
  const todo = names.filter((n) => !done.has(n));
  console.log(`names: ${names.length} total, ${todo.length} to query`);

  const out = `${DATA}advisory-windows.ndjson`;
  let advisories = 0;
  let processed = 0;
  for (const name of todo) {
    const res = await queryName(name);
    if (res === null) { console.error(`✗ ${name}`); continue; }
    for (const v of res.vulns ?? []) {
      const ranges = windowsOf(v, name);
      if (!ranges.length) continue;
      appendFileSync(out, JSON.stringify({
        id: v.id, package: name,
        summary: v.summary ?? '',
        severity: severityOf(v),
        windows: ranges.filter((r) => r.introduced !== undefined),
        versions: ranges.find((r) => r.versions)?.versions ?? [],
      }) + '\n');
      advisories++;
    }
    appendFileSync(doneFile, name + '\n');
    if (++processed % 100 === 0) console.log(`…${processed}/${todo.length} names · ${advisories} advisory windows`);
  }
  console.log(`done · ${advisories} advisory windows across ${processed} names`);
}

// Only crawl when run directly — resolve.js imports the fetch helpers above.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
