/**
 * Recall on a real project — resolve, load, recall, report.
 *
 * This is the entry point the product actually has. Point it at a directory:
 *
 *   node src/project.js ~/code/some-app
 *
 * It resolves that project's dependency tree (resolve.js), makes sure every
 * package NAME in the tree has its advisory windows on disk, upserts the tree
 * into HydraDB alongside the seeded graph, and then runs the recall query from
 * the project's own root node.
 *
 * The output is the argument. A scanner prints one line per vulnerable package
 * — hundreds of them, unordered, unactionable. Every one of those findings
 * enters the project through exactly one direct dependency, and there are only
 * ever a handful of those. Collapsing the wall into that handful is the whole
 * product, and it is a path query: you cannot do it from a flat list, because
 * a flat list has thrown away the path.
 *
 * HydraDB constraints observed here (see load.js for the full list): ids are
 * integers, MERGE-by-id then SET, auto-commit RUN only, params integer-typed.
 */

'use strict';

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import neo4j from 'neo4j-driver';

import { resolveProject } from './resolve.js';
import { classify } from './windows.js';
import { queryName, windowsOf, severityOf } from './advisory-history.js';
import { rate } from './severity.js';
import { Recall, cypherFor, relTypeFor } from './query.js';
import { batchedRun } from './bolt.js';

const DATA = new URL('../data/', import.meta.url).pathname;
const BOLT = process.env.HYDRA_BOLT ?? 'bolt://127.0.0.1:7687';
const TOKEN = process.env.HYDRA_TOKEN ?? 'local-development-token-32-bytes';
// The Bolt driver throws `RangeError: offset out of range` while packing large
// payloads against this server — and throws it asynchronously, so it escapes
// try/catch and takes the process with it. It scales with payload bytes, so
// rows carrying long strings (advisory summaries, package keys) go in smaller
// batches than rows that are only integers.
const BATCH = 100;      // id-only rows: dependency and advisory edges
const BATCH_TEXT = 25;  // rows carrying strings
const ADV_BASE = 10_000_000;
const PROJ_REL_BASE = 900_000_000; // keeps project advisory edge ids clear of load.js's

const ndjson = (f) =>
  existsSync(`${DATA}${f}`)
    ? readFileSync(`${DATA}${f}`, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
    : [];

// ------------------------------------------------------- advisory backfill

/**
 * Every package name in a real project that the seeded crawl never saw needs
 * its advisory history fetched, or it silently reads as clean — the worst
 * possible failure mode for a tool whose whole claim is completeness.
 */
export async function backfillAdvisories(names, { concurrency = 4, maxNew = Infinity } = {}) {
  const doneFile = `${DATA}advisory-names.done`;
  const done = new Set(
    existsSync(doneFile) ? readFileSync(doneFile, 'utf8').split('\n').filter(Boolean) : []
  );
  const todo = [...new Set(names)].filter((n) => !done.has(n));
  if (!todo.length) return { queried: 0, added: 0 };
  // A shared node cannot spend four minutes in OSV on one visitor's request.
  // Refusing with the number is honest; a silent partial backfill would report
  // unseen packages as clean, which is the one failure this tool must not have.
  if (todo.length > maxNew) {
    throw new Error(
      `this tree needs advisory history for ${todo.length} package names the shared graph has ` +
      `never seen, over the ${maxNew} this node fetches per scan — run it locally ` +
      `(git clone github.com/jadonamite/recall) where there is no such cap`
    );
  }

  process.stdout.write(`  advisories: 0/${todo.length} names`);
  let idx = 0, added = 0, failed = 0;
  const worker = async () => {
    while (idx < todo.length) {
      const i = idx++;
      const name = todo[i];
      const res = await queryName(name);
      if (res === null) { failed++; continue; }
      for (const v of res.vulns ?? []) {
        const ranges = windowsOf(v, name);
        if (!ranges.length) continue;
        appendFileSync(`${DATA}advisory-windows.ndjson`, JSON.stringify({
          id: v.id, package: name,
          summary: v.summary ?? '',
          severity: severityOf(v),
          windows: ranges.filter((r) => r.introduced !== undefined),
          versions: ranges.find((r) => r.versions)?.versions ?? [],
        }) + '\n');
        added++;
      }
      appendFileSync(doneFile, name + '\n');
      if (i % 25 === 0) process.stdout.write(`\r  advisories: ${i}/${todo.length} names · ${added} windows`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write(`\r  advisories: ${todo.length}/${todo.length} names · ${added} windows${failed ? ` · ${failed} failed` : ''}\n`);
  return { queried: todo.length, added, failed };
}

// ------------------------------------------------------------------ upsert

/**
 * Push a resolved project graph into HydraDB next to the seeded graph.
 *
 * @param {object} graph resolved tree from resolve.js
 * @param {object} [opts]
 * @param {string[]} [opts.extraRelTypes] additional types to write the edges under
 * @param {string} [opts.relType] the tree's own type; defaults to one derived
 *   from the root's name. A hosted node passes a per-scan type instead — see
 *   `scanRelType` in query.js for why the name-derived one is unsafe there.
 * @param {object} [opts.map] id map to allocate into, instead of reading the
 *   file. Callers that pass one own it, and get it back on the result.
 * @param {boolean} [opts.persist=true] write the id map back to disk.
 * @param {boolean} [opts.shared=true] also write the edges into the shared
 *   DEPENDS_ON graph. A hosted node sets this false: a visitor's tree is theirs,
 *   and the landing page says so out loud.
 */
export async function upsert(graph, {
  extraRelTypes = [], relType: relTypeIn, map: mapIn, persist = true, shared = true,
} = {}) {
  const relType = relTypeIn ?? relTypeFor(graph.root);
  const map = mapIn ?? JSON.parse(readFileSync(`${DATA}idmap.json`, 'utf8'));
  const windows = ndjson('advisory-windows.ndjson');

  const byName = new Map();
  for (const w of windows) {
    if (!byName.has(w.package)) byName.set(w.package, []);
    byName.get(w.package).push(w);
  }

  let nextPkg = Math.max(-1, ...Object.values(map.packages)) + 1;
  let nextAdv = Math.max(ADV_BASE - 1, ...Object.values(map.advisories)) + 1;

  const newNodes = [];
  for (const n of graph.nodes) {
    if (map.packages[n.key] !== undefined) continue;
    map.packages[n.key] = nextPkg++;
    newNodes.push(n);
  }

  // Advisory edges for EVERY node in the tree, not just the new ones — a
  // package already in the seeded graph may only now become reachable from
  // this project's root.
  const advEdges = [];
  const exposed = [];
  let rel = PROJ_REL_BASE;
  const newAdvisories = [];
  for (const n of graph.nodes) {
    for (const w of byName.get(n.name) ?? []) {
      if (classify(n.version, w) !== 'inside') continue;
      if (map.advisories[w.id] === undefined) {
        map.advisories[w.id] = nextAdv++;
        newAdvisories.push(w);
      }
      advEdges.push({
        f: neo4j.int(map.packages[n.key]), t: neo4j.int(map.advisories[w.id]),
        rid: neo4j.int(rel++),
      });
      exposed.push({ key: n.key, name: n.name, version: n.version, osv: w.id, severity: w.severity, summary: w.summary });
    }
  }

  const driver = neo4j.driver(BOLT, neo4j.auth.basic('token', TOKEN), { disableLosslessIntegers: true });
  const session = driver.session();
  const batched = (label, rows, cypher, size = BATCH) =>
    batchedRun(session, label, rows, cypher, { size });

  try {
    await batched('packages', newNodes.map((n) => ({
      id: neo4j.int(map.packages[n.key]), key: n.key, name: n.name, version: n.version, seed: false,
    })), `
      UNWIND $rows AS row
      MERGE (n {id: row.id})
      SET n:Package, n.key = row.key, n.name = row.name, n.version = row.version, n.seed = row.seed
    `, BATCH_TEXT);

    await batched('advisories', newAdvisories.map((w) => ({
      id: neo4j.int(map.advisories[w.id]), osv: w.id,
      severity: String(w.severity ?? 'UNKNOWN'), summary: String(w.summary ?? '').slice(0, 300),
    })), `
      UNWIND $rows AS row
      MERGE (n {id: row.id})
      SET n:Advisory, n.osv = row.osv, n.severity = row.severity, n.summary = row.summary
    `, BATCH_TEXT);

    const depRows = graph.edges
      .map((e) => ({ f: map.packages[e.from], t: map.packages[e.to] }))
      .filter((r) => r.f !== undefined && r.t !== undefined)
      .map((r) => ({ f: neo4j.int(r.f), t: neo4j.int(r.t), rid: neo4j.int(r.f * 100_000 + r.t) }));

    // Normally twice: once into the shared DEPENDS_ON graph the global queries
    // use, and once under a type private to this project so its traversal cannot
    // be crowded out of `pathCount` by an unrelated project in the same store.
    // A hosted node writes the private type only — see `shared` above.
    const types = shared ? ['DEPENDS_ON', relType, ...extraRelTypes] : [relType, ...extraRelTypes];
    for (const type of [...new Set(types)]) {
      await batched(`depends_on:${type}`, depRows, `
        UNWIND $rows AS row
        MATCH (s:Package {id: row.f}), (t:Package {id: row.t})
        MERGE (s)-[r:${type} {id: row.rid}]->(t)
      `);
    }

    await batched('has_advisory', advEdges, `
      UNWIND $rows AS row
      MATCH (s:Package {id: row.f}), (a:Advisory {id: row.t})
      MERGE (s)-[r:HAS_ADVISORY {id: row.rid}]->(a)
    `);
  } finally {
    await session.close();
    await driver.close();
  }

  if (persist) writeFileSync(`${DATA}idmap.json`, JSON.stringify(map));
  return { newPackages: newNodes.length, edges: graph.edges.length, exposed, relType, map };
}

// ------------------------------------------------------------------ report

/**
 * The recall itself, from the project's own root.
 *
 * For each exposed version in the tree, ask HydraDB for the chains that reach
 * it and keep the ones that start at this project. The first hop of such a
 * chain is a direct dependency — the only thing the developer can actually
 * change. Grouping findings by that hop is what turns the wall into a list.
 */
export async function report(graph, exposed, {
  maxLen = 12, limit = 5000, keepPaths = 40, relType, map,
} = {}) {
  const type = relType ?? relTypeFor(graph.root);
  const r = new Recall({ map });
  const byDirect = new Map();
  const unreachable = [];
  const details = [];

  // One traversal per distinct vulnerable version; the advisories on that
  // version all share it.
  const byVersion = new Map();
  for (const e of exposed) {
    if (!byVersion.has(e.key)) byVersion.set(e.key, { key: e.key, name: e.name, version: e.version, advisories: [] });
    byVersion.get(e.key).advisories.push({
      osv: e.osv, summary: e.summary, ...rate(e.severity), raw: e.severity,
    });
  }

  try {
    for (const v of byVersion.values()) {
      v.advisories.sort((a, b) => b.rank - a.rank || (b.score ?? 0) - (a.score ?? 0));
      const worst = v.advisories[0];

      // The tree was written on one session and is being read on another, and
      // the store does not always show those writes immediately. That surfaces
      // as a traversal finding no path from the root — a *silent false
      // negative*, which for this tool is the worst answer available: it reads
      // as "you are clean". So an empty result is retried before it is believed.
      let paths = [];
      let fromRoot = [];
      let failed;
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await new Promise((ok) => setTimeout(ok, 250 * attempt));
        try {
          paths = await r.recall(v.key, { maxLen, limit, relType: type });
        } catch (err) { failed = err.message; break; }
        fromRoot = paths.filter((p) => p.path[0] === graph.root);
        if (fromRoot.length) break;
      }
      if (failed) { unreachable.push({ ...v, reason: failed }); continue; }
      if (!fromRoot.length) { unreachable.push({ ...v, reason: 'no path from project root' }); continue; }

      const shortest = fromRoot.reduce((a, b) => (b.depth < a.depth ? b : a));
      details.push({
        ...v, worst,
        pathCount: fromRoot.length,
        depth: shortest.depth,
        maxDepth: Math.max(...fromRoot.map((p) => p.depth)),
        shortest: shortest.path,
        paths: fromRoot.slice(0, keepPaths).map((p) => p.path),
        truncated: Math.max(0, fromRoot.length - keepPaths),
      });

      for (const p of fromRoot) {
        const direct = p.path[1];
        if (!direct) continue;
        if (!byDirect.has(direct)) {
          byDirect.set(direct, { package: direct, vulns: new Map(), paths: 0, advisories: new Set(), rank: -1, score: null });
        }
        const d = byDirect.get(direct);
        d.vulns.set(v.key, worst);
        for (const a of v.advisories) d.advisories.add(a.osv);
        d.paths++;
        if (worst.rank > d.rank) { d.rank = worst.rank; d.label = worst.label; }
        if ((worst.score ?? -1) > (d.score ?? -1)) d.score = worst.score;
      }
    }
  } finally {
    await r.close();
  }

  const fixes = [...byDirect.values()]
    .map((d) => ({
      package: d.package,
      vulns: d.vulns.size,
      advisories: d.advisories.size,
      paths: d.paths,
      label: d.label ?? 'UNRATED',
      rank: d.rank,
      score: d.score,
      // Worst first inside the row too — a critical must not sit below a
      // low-severity DoS just because it was discovered later in the traversal.
      via: [...d.vulns.entries()]
        .sort((a, b) => b[1].rank - a[1].rank || (b[1].score ?? 0) - (a[1].score ?? 0))
        .map(([key]) => key),
    }))
    // Worst thing it carries first; then how much it carries. Ranking by count
    // alone would bury a single critical under a pile of low-severity DoS.
    .sort((a, b) => b.rank - a.rank || b.vulns - a.vulns || b.paths - a.paths);

  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0, UNRATED: 0 };
  for (const e of exposed) counts[rate(e.severity).label]++;

  return {
    root: graph.root,
    mode: graph.mode,
    packages: graph.nodes.length,
    edges: graph.edges.length,
    findings: exposed.length,
    exposedVersions: byVersion.size,
    severities: counts,
    fixes,
    details: details.sort((a, b) => b.worst.rank - a.worst.rank || b.pathCount - a.pathCount),
    unreachable,
    query: cypherFor(type),
    warnings: graph.warnings ?? [],
  };
}

// ---------------------------------------------------------------- CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  if (!dir) {
    console.log('usage: node src/project.js <path-to-project> [--dev] [--json]');
    process.exit(1);
  }
  const dev = process.argv.includes('--dev');
  const asJson = process.argv.includes('--json');

  const t0 = Date.now();
  const graph = await resolveProject(dir, { dev });
  if (!asJson) {
    console.log(`\n${graph.root}  ·  ${graph.mode === 'lockfile' ? 'exact (package-lock.json)' : 'resolved as npm would install today (package.json)'}`);
    console.log(`  ${graph.nodes.length} packages · ${graph.edges.length} edges`);
    for (const w of graph.warnings ?? []) console.error(`  ! ${w}`);
  }

  await backfillAdvisories(graph.nodes.map((n) => n.name));
  const { exposed, newPackages, relType } = await upsert(graph);
  if (!asJson) console.log(`  ${newPackages} packages new to the graph · ${exposed.length} advisory hits\n`);

  const out = await report(graph, exposed, { relType });

  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    if (!out.findings) {
      console.log(`Nothing to recall. No version in this tree sits inside a known advisory window.`);
      console.log(`  ${out.packages} packages checked against every advisory OSV has for their names.`);
      process.exit(0);
    }

    const sev = Object.entries(out.severities).filter(([, n]) => n > 0)
      .map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ');
    console.log(`${out.findings} findings across ${out.exposedVersions} vulnerable versions`);
    if (sev) console.log(`  ${sev}`);
    console.log(`↓`);
    console.log(`${out.fixes.length} direct dependencies to upgrade:\n`);
    for (const f of out.fixes) {
      const badge = `${f.label}${f.score === null ? '' : ` ${f.score}`}`.padEnd(13);
      console.log(`  ${badge} ${String(f.vulns).padStart(3)} vulnerable versions · ${String(f.paths).padStart(4)} paths · ${f.package}`);
    }
    console.log(`\nworst chains:`);
    for (const d of out.details.slice(0, 8)) {
      console.log(`  [${d.depth}] ${d.shortest.join(' → ')}`);
      console.log(`        ${d.worst.label}  ${d.worst.osv}  ${String(d.worst.summary).slice(0, 66)}`);
    }
    if (out.unreachable.length) {
      console.log(`\n${out.unreachable.length} vulnerable versions with no path from the root (dev-only or orphaned) — not counted above`);
    }
    console.log(`\n${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
}
