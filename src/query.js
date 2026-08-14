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
import neo4j from 'neo4j-driver';

const DATA = new URL('../data/', import.meta.url).pathname;
const BOLT = process.env.HYDRA_BOLT ?? 'bolt://127.0.0.1:7687';
const TOKEN = process.env.HYDRA_TOKEN ?? 'local-development-token-32-bytes';

export class Recall {
  constructor() {
    this.map = JSON.parse(readFileSync(`${DATA}idmap.json`, 'utf8'));
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
    const r = await this.session.run(`
      MATCH (p:Package)-[:HAS_ADVISORY]->(a:Advisory)
      RETURN p.key AS pkg, a.osv AS osv, a.severity AS severity, a.summary AS summary
    `);
    return r.records.map((x) => x.toObject());
  }

  /**
   * THE RECALL QUERY. Walk DEPENDS_ON edges backwards from a compromised
   * package and return the actual chains that reach it.
   * @returns {Promise<{path: string[], depth: number}[]>}
   */
  async recall(key, { maxLen = 6, limit = 500 } = {}) {
    const r = await this.session.run(`
      CALL algo.SSpaths({sourceNode: $v, relTypes: ['DEPENDS_ON'],
                         maxLen: $maxLen, relDirection: 'incoming', pathCount: $limit})
      YIELD path RETURN path
    `, { v: this.id(key), maxLen: neo4j.int(maxLen), limit: neo4j.int(limit) });

    return r.records.map((rec) => {
      const p = rec.get('path');
      // SSpaths walks outward from the compromised package; reverse it so the
      // chain reads the way a developer thinks: from their app, down to the bad thing.
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
