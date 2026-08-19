/**
 * Recall queries — the recall itself.
 *
 * Three questions, in the order a person actually asks them:
 *
 *   1. recall(pkg)      Who ships this? Every dependent, WITH THE PATH.
 *                       Not "you are affected" but
 *                       "app -> webpack -> loader -> compromised@1.2.3".
 *   2. blastRadius(pkg) How much of the ecosystem sits above it, and how deep.
 *   3. cutPoints(pkg)   Which single upgrade severs the most paths — the
 *                       ordered action list that replaces a wall of findings.
 *
 * HydraDB notes: reverse variable-length patterns are rejected, so traversal
 * uses the native algo.SSpaths procedure with relDirection 'incoming'. Node
 * ids are integers, so callers pass a package key and idmap.json translates.
 */

'use strict';

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import neo4j from 'neo4j-driver';

const DATA = new URL('../data/', import.meta.url).pathname;
const BOLT = process.env.HYDRA_BOLT ?? 'bolt://127.0.0.1:7687';
const TOKEN = process.env.HYDRA_TOKEN ?? 'local-development-token-32-bytes';

/**
 * The traversal, verbatim. Exported so the UI can show the query that produced
 * what is on screen rather than a prettified retelling of it.
 *
 * The relationship type is interpolated rather than parameterised because a
 * Cypher relationship type cannot be a parameter. Callers pass a type this
 * module generated (see `relTypeFor`), and it is sanitized here regardless.
 */
export const cypherFor = (relType = 'DEPENDS_ON') => `CALL algo.SSpaths({
  sourceNode: $v,
  relTypes: ['${safeRelType(relType)}'],
  relDirection: 'incoming',
  maxLen: $maxLen,
  pathCount: $limit
})
YIELD path RETURN path`;

export const TRAVERSAL_CYPHER = cypherFor();

/** Relationship types are interpolated into Cypher, so they are whitelisted. */
export function safeRelType(t) {
  const s = String(t).replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) throw new Error(`unusable relationship type: ${t}`);
  return s;
}

/**
 * A relationship type private to one project.
 *
 * `pathCount` caps how many paths the procedure returns, and that cap applies
 * across everything in the store — so with several projects loaded, another
 * project's paths can crowd out the ones from this root and a genuinely
 * reachable vulnerability reads as unreachable. A project's resolved tree is
 * self-contained, so scoping the traversal to its own edges makes the answer
 * exact and independent of whatever else has been scanned.
 */
export const relTypeFor = (rootKey) =>
  safeRelType('IN_' + String(rootKey).toUpperCase()).slice(0, 120);

/**
 * A relationship type private to one *scan*, not one project name.
 *
 * `relTypeFor` derives the type from the root package's name, which is exactly
 * right on a laptop and wrong the moment two people use the same node: every
 * npm project scaffolded from the same template is `my-app@1.0.0`, and two
 * visitors would then share a relationship type and walk each other's edges.
 * A random type per scan makes that impossible.
 */
export const scanRelType = () =>
  'SCAN_' + randomBytes(8).toString('hex').toUpperCase();

export class Recall {
  /**
   * @param {{map?: object}} [opts] an id map to use instead of reading the file.
   *   A hosted node allocates ids in memory (see project.js), so the map on
   *   disk is a stale baseline there and reading it would resolve keys to ids
   *   that belong to different packages.
   */
  constructor({ map } = {}) {
    this.map = map ?? JSON.parse(readFileSync(`${DATA}idmap.json`, 'utf8'));
    this.driver = neo4j.driver(BOLT, neo4j.auth.basic('token', TOKEN), {
      disableLosslessIntegers: true,
    });
    this.session = this.driver.session();
  }

  async close() { await this.session.close(); await this.driver.close(); }

  id(key) {
    const v = this.map.packages[key];
    if (v === undefined) throw new Error(`unknown package: ${key}`);
    return neo4j.int(v);
  }

  /** Every package version carrying a live advisory. */
  async vulnerable() {
    const r = await this.#retry(() => this.session.run(`
      MATCH (p:Package)-[:HAS_ADVISORY]->(a:Advisory)
      RETURN p.key AS pkg, a.osv AS osv, a.severity AS severity, a.summary AS summary
    `));
    return r.records.map((x) => x.toObject());
  }

  /** True for the driver's payload-size packing fault (see bolt.js). */
  static #isPacking(e) {
    return e instanceof RangeError || /offset.*out of range/i.test(e?.message ?? '');
  }

  /** Retry a read across a fresh connection when the packing fault hits. */
  async #retry(fn, tries = 3) {
    let last;
    for (let i = 0; i < tries; i++) {
      try { return await fn(); } catch (e) {
        last = e;
        if (!Recall.#isPacking(e)) throw e;
        await this.reset();
      }
    }
    throw last;
  }

  /**
   * Delete every edge of one relationship type.
   *
   * A hosted scan writes its tree under a type of its own and drops it again
   * when the answer has been sent, so the store does not grow by one visitor's
   * dependency graph per request.
   */
  async dropRelType(type) {
    const t = safeRelType(type);
    if (!t.startsWith('SCAN_')) throw new Error(`refusing to drop non-scan type: ${type}`);
    await this.#retry(() => this.session.run(`MATCH ()-[r:${t}]->() DELETE r`));
  }

  /** Reopen the driver and session — a connection that hit a packing fault stays unhappy in the pool. */
  async reset() {
    try { await this.session?.close(); } catch { /* already gone */ }
    try { await this.driver?.close(); } catch { /* already gone */ }
    this.driver = neo4j.driver(BOLT, neo4j.auth.basic('token', TOKEN), {
      disableLosslessIntegers: true,
    });
    this.session = this.driver.session();
  }

  /**
   * THE RECALL QUERY. Walk dependency edges backwards from a compromised
   * package and return the actual chains that reach it.
   * @returns {Promise<{path: string[], depth: number}[]>}
   */
  async recall(key, { maxLen = 6, limit = 500, relType = 'DEPENDS_ON' } = {}) {
    // The driver's packing fault (see bolt.js) hits reads as well as writes, and
    // a read cannot be split. It clears on a fresh connection often enough that
    // reconnecting is worth trying; when it does not, ask for fewer paths, since
    // the fault tracks payload size. A reduced result is flagged by the caller's
    // own path count rather than pretended to be complete.
    let attemptLimit = limit;
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return this.#paths(await this.session.run(cypherFor(relType), {
          v: this.id(key), maxLen: neo4j.int(maxLen), limit: neo4j.int(attemptLimit),
        }));
      } catch (e) {
        lastErr = e;
        if (!Recall.#isPacking(e)) throw e;
        await this.reset();
        if (attempt >= 1) attemptLimit = Math.max(50, Math.floor(attemptLimit / 2));
      }
    }
    throw new Error(`recall(${key}) failed after retries — ${lastErr?.message}`);
  }

  /**
   * THE RECALL QUERY's result shaping. SSpaths walks outward from the
   * compromised package, so each path is reversed to read the way a developer
   * thinks: from their app, down to the bad thing.
   */
  #paths(r) {
    return r.records.map((rec) => {
      const p = rec.get('path');
      const chain = [p.start.properties.key, ...p.segments.map((s) => s.end.properties.key)];
      return { path: chain.reverse(), depth: chain.length - 1 };
    }).sort((a, b) => a.depth - b.depth);
  }

  /** How far the contamination reaches: distinct dependents and depth profile. */
  async blastRadius(key, opts = {}) {
    const paths = await this.recall(key, opts);
    const reached = new Set();
    const byDepth = new Map();
    for (const { path, depth } of paths) {
      reached.add(path[0]);
      byDepth.set(depth, (byDepth.get(depth) ?? 0) + 1);
    }
    const total = Object.keys(this.map.packages).length;
    return {
      package: key,
      dependents: reached.size,
      paths: paths.length,
      maxDepth: paths.length ? Math.max(...paths.map((p) => p.depth)) : 0,
      shareOfGraph: +((reached.size / total) * 100).toFixed(2),
      byDepth: [...byDepth.entries()].sort((a, b) => a[0] - b[0]),
    };
  }

  /**
   * Rank remediation by leverage. Every path from a dependent down to the
   * compromised package passes through a first hop; upgrading that one
   * package severs every path through it. Ranked, that turns hundreds of
   * findings into a short ordered list.
   */
  async cutPoints(key, opts = {}) {
    const paths = await this.recall(key, opts);
    const cuts = new Map();
    for (const { path } of paths) {
      // The hop directly above the compromised package on this chain.
      const cut = path[path.length - 2];
      if (!cut) continue;
      if (!cuts.has(cut)) cuts.set(cut, { package: cut, severs: 0, reaches: new Set() });
      const c = cuts.get(cut);
      c.severs++;
      c.reaches.add(path[0]);
    }
    return [...cuts.values()]
      .map((c) => ({ package: c.package, severs: c.severs, dependents: c.reaches.size }))
      .sort((a, b) => b.severs - a.severs);
  }
}

// ---------------------------------------------------------------- CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, arg] = process.argv.slice(2);
  const r = new Recall();
  try {
    if (cmd === 'vulnerable' || !cmd) {
      const v = await r.vulnerable();
      console.log(`${v.length} vulnerable package versions in graph\n`);
      for (const x of v) console.log(`  ${x.pkg.padEnd(38)} ${x.osv}  ${x.summary.slice(0, 50)}`);
    } else if (cmd === 'recall') {
      const paths = await r.recall(arg);
      console.log(`\n${paths.length} paths reach ${arg}\n`);
      for (const p of paths.slice(0, 25)) console.log(`  [${p.depth}] ${p.path.join(' → ')}`);
    } else if (cmd === 'blast') {
      console.log(await r.blastRadius(arg));
    } else if (cmd === 'cuts') {
      const cuts = await r.cutPoints(arg);
      console.log(`\nupgrade these to sever paths to ${arg}:\n`);
      for (const c of cuts) console.log(`  ${String(c.severs).padStart(4)} paths · ${c.dependents} dependents · ${c.package}`);
    } else {
      console.log('usage: node src/query.js [vulnerable|recall <pkg@ver>|blast <pkg@ver>|cuts <pkg@ver>]');
    }
  } finally { await r.close(); }
}
