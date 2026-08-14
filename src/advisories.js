/**
 * Recall advisories — attach OSV vulnerability data to the ingested graph.
 *
 * Reads data/nodes.ndjson, queries OSV.dev in batches of 500 (its querybatch
 * limit), then hydrates each hit for severity/summary. Output:
 *   advisories.ndjson  { id, package, version, summary, severity, aliases }
 * Safe to re-run; already-fetched advisory ids are skipped.
 */

'use strict';

import { appendFileSync, existsSync, readFileSync } from 'node:fs';

const DATA = new URL('../data/', import.meta.url).pathname;
const BATCH = 500;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(url, body, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(2000 * 2 ** i);
    }
  }
}

async function getAdvisory(id, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://api.osv.dev/v1/vulns/${id}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) return null;
      await sleep(1500 * 2 ** i);
    }
  }
}

function severityOf(v) {
  // Prefer CVSS from severity[]; fall back to database_specific.severity.
  const cvss = v.severity?.find((s) => s.type?.startsWith('CVSS'));
  return cvss?.score ?? v.database_specific?.severity ?? 'UNKNOWN';
}

async function main() {
  const nodes = readFileSync(`${DATA}nodes.ndjson`, 'utf8')
    .split('\n').filter(Boolean).map(JSON.parse);
  console.log(`querying OSV for ${nodes.length} package versions…`);

  const outFile = `${DATA}advisories.ndjson`;
  const seen = new Set(
    existsSync(outFile)
      ? readFileSync(outFile, 'utf8').split('\n').filter(Boolean)
          .map((l) => { const a = JSON.parse(l); return `${a.id}|${a.package}@${a.version}`; })
      : []
  );

  let hits = 0;
  for (let i = 0; i < nodes.length; i += BATCH) {
    const slice = nodes.slice(i, i + BATCH);
    const res = await post('https://api.osv.dev/v1/querybatch', {
      queries: slice.map((n) => ({
        package: { ecosystem: 'npm', name: n.name }, version: n.version,
      })),
    });
    for (let j = 0; j < slice.length; j++) {
      for (const v of res.results[j]?.vulns ?? []) {
        const key = `${v.id}|${slice[j].key}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const full = await getAdvisory(v.id);
        appendFileSync(outFile, JSON.stringify({
          id: v.id,
          package: slice[j].name,
          version: slice[j].version,
          summary: full?.summary ?? '',
          severity: full ? severityOf(full) : 'UNKNOWN',
          aliases: full?.aliases ?? [],
        }) + '\n');
        hits++;
      }
    }
    console.log(`batch ${1 + i / BATCH}/${Math.ceil(nodes.length / BATCH)} · advisories so far: ${hits}`);
  }
  console.log(`done · ${hits} new advisory links written`);
}

main().catch((e) => { console.error(e); process.exit(1); });
