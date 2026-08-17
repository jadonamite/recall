/**
 * Build the landing site's dataset.
 *
 * The site makes two arguments, in this order:
 *
 *   1. THE RECALL NOTICE (the maintainer's question). Your package was just
 *      compromised — who ships it, and who do you have to write to? This is the
 *      query no scanner can answer, because a scanner starts from a manifest.
 *      It is a reverse path query over a shared graph, which is the whole
 *      reason a graph store belongs here.
 *
 *   2. THE OTHER DIRECTION (the consumer's question). Here is my lock file,
 *      what do I upgrade? Familiar, and it collapses onto a handful of rows.
 *
 * Everything below is measured, not authored. Each subject is queried live
 * against HydraDB and the numbers are written out as-is. The site renders this
 * file; when a live backend exists it can serve the same shape from the same
 * queries, and nothing on the page has to change.
 *
 *   node src/build-site.js
 */

'use strict';

import { mkdirSync, writeFileSync, readFileSync, existsSync, cpSync } from 'node:fs';

import { Recall, cypherFor, relTypeFor } from './query.js';
import { rate } from './severity.js';

const ROOT = new URL('../', import.meta.url).pathname;
const DATA = `${ROOT}data/`;
const DIST = `${ROOT}dist/`;

/**
 * How many recall-notice subjects the page offers, and the minimum reach a
 * subject needs to be worth showing. Subjects are CHOSEN FROM THE DATA rather
 * than hardcoded: a hardcoded list silently goes stale the moment an advisory
 * crawl changes what is exposed, and then the page reports numbers for a
 * package that is no longer vulnerable.
 */
const SUBJECT_COUNT = 6;

const MIN_DEPENDENTS = 3;

// SEED_GRAPH, not DEPENDS_ON: the latter is the union of everything ever loaded,
// including projects scanned during development. A public page claiming to
// describe the npm ecosystem must not answer with somebody's private tree.
const SEED = 'SEED_GRAPH';
const OPTS = { maxLen: 8, limit: 4000, relType: SEED };

/**
 * A representative sample, weighted toward depth. One-hop chains are true but
 * make a dull argument — "minimatch depends on brace-expansion" surprises
 * nobody. The long chains are the point: nothing in that app asked for this
 * package, and it is six hops down.
 */
function sampleChains(paths, n = 8) {
  if (paths.length <= n) return paths.map((p) => p.path);
  const deep = [...paths].sort((a, b) => b.depth - a.depth);
  const shallowest = [...paths].sort((a, b) => a.depth - b.depth)[0];
  const picked = deep.slice(0, n - 1).map((p) => p.path);
  return [...picked, shallowest.path];
}

async function main() {
  const windows = readFileSync(`${DATA}advisory-windows.ndjson`, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

  // Totals and provenance come from the measured manifest that ingest-public.js
  // writes, not from the seed files alone — the shared graph is both.
  if (!existsSync(`${DATA}public-graph.json`)) {
    throw new Error('data/public-graph.json missing — run `npm run ingest:public` first');
  }
  const pub = JSON.parse(readFileSync(`${DATA}public-graph.json`, 'utf8'));

  const r = new Recall();
  const t0 = Date.now();
  const vulnerable = await r.vulnerable();

  // Advisory metadata by package key, worst first.
  const advByPkg = new Map();
  for (const v of vulnerable) {
    if (!advByPkg.has(v.pkg)) advByPkg.set(v.pkg, []);
    advByPkg.get(v.pkg).push({ osv: v.osv, summary: v.summary, ...rate(v.severity) });
  }
  for (const list of advByPkg.values()) list.sort((a, b) => b.rank - a.rank || (b.score ?? 0) - (a.score ?? 0));

  // Rank every exposed version by how far it actually reaches, then keep the
  // widest few. This is the recall's own question asked of the whole graph.
  const scored = [];
  for (const key of new Set(vulnerable.map((v) => v.pkg))) {
    let paths;
    try { paths = await r.recall(key, OPTS); } catch { continue; }
    if (!paths.length) continue;
    const dependents = new Set(paths.map((p) => p.path[0]));
    if (dependents.size < MIN_DEPENDENTS) continue;
    scored.push({ key, paths, dependents });
  }
  scored.sort((a, b) => b.dependents.size - a.dependents.size || b.paths.length - a.paths.length);

  // One version per package name. Three flavours of brace-expansion is an
  // accurate answer to a question nobody asked; six different packages shows
  // the reach is a property of the ecosystem, not of one unlucky library.
  const byName = new Set();
  const picked = [];
  for (const c of scored) {
    const name = c.key.slice(0, c.key.lastIndexOf('@'));
    if (byName.has(name)) continue;
    byName.add(name);
    picked.push(c);
    if (picked.length === SUBJECT_COUNT) break;
  }
  console.log(`  ${scored.length} exposed versions with real reach; taking the widest ${picked.length} distinct packages`);

  const notices = [];
  for (const { key, paths, dependents } of picked) {
    const advisories = advByPkg.get(key);
    const byDepth = new Map();
    for (const p of paths) byDepth.set(p.depth, (byDepth.get(p.depth) ?? 0) + 1);
    const cuts = await r.cutPoints(key, OPTS);

    notices.push({
      package: key,
      name: key.slice(0, key.lastIndexOf('@')),
      version: key.slice(key.lastIndexOf('@') + 1),
      worst: advisories[0],
      advisories,
      dependents: dependents.size,
      paths: paths.length,
      maxDepth: Math.max(...paths.map((p) => p.depth)),
      byDepth: [...byDepth.entries()].sort((a, b) => a[0] - b[0]),
      cuts: cuts.map((c) => ({ package: c.package, severs: c.severs, dependents: c.dependents })),
      // Who a maintainer would actually have to write to: the top of each chain.
      notify: [...dependents].sort(),
      chains: sampleChains(paths),
    });
    console.log(`  ${key.padEnd(28)} ${dependents.size} dependents · ${paths.length} paths · ${cuts.length} cuts`);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  await r.close();

  const site = {
    builtAt: new Date().toISOString().slice(0, 10),
    graph: {
      packages: pub.unionPackages,
      edges: pub.unionEdges,
      seedPackages: pub.seedNodes,
      publicApps: pub.sources.length,
      advisoryWindows: windows.length,
      advisoryNames: new Set(windows.map((w) => w.package)).size,
      vulnerableVersions: new Set(vulnerable.map((v) => v.pkg)).size,
      traversalSeconds: Number(elapsed),
      exposedWithReach: scored.length,
    },
    // Stated on the page: the shared graph is a seed crawl plus the committed
    // lock files of these public repositories. No private tree is ever in it.
    publicSources: pub.sources.map((x) => ({ name: x.name, url: x.url })),
    query: cypherFor(SEED),
    projectQuery: cypherFor(relTypeFor('your-app@1.0.0')),
    notices,
  };

  mkdirSync(DIST, { recursive: true });
  writeFileSync(`${DIST}site.json`, JSON.stringify(site));
  console.log(`\ndist/site.json  ${(readFileSync(`${DIST}site.json`).length / 1024).toFixed(0)}K`);

  // The landing page and the working tool ship together: / is the argument,
  // /app is the thing itself.
  cpSync(`${ROOT}site/index.html`, `${DIST}index.html`);
  mkdirSync(`${DIST}app/`, { recursive: true });
  const app = readFileSync(`${ROOT}public/index.html`, 'utf8');
  writeFileSync(`${DIST}app/index.html`, app.replace(
    '</head>', '<script>window.RECALL_DEMO = "../demo.json";</script>\n</head>'
  ));
  if (!existsSync(`${DIST}demo.json`)) {
    console.warn('\n! dist/demo.json missing — run src/build-demo.js so /app has a scan to show');
  }
  console.log('dist/index.html, dist/app/index.html written');
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
