/**
 * Recall loader — push the ingested graph into HydraDB over Bolt.
 *
 * HydraDB speaks a deliberately narrow OpenCypher subset. The rules that
 * shape this file, all learned from cypher-compat.md and the live server:
 *
 *   - Auto-commit RUN only; explicit transactions are rejected.
 *   - Node ids are NON-NEGATIVE INTEGERS. Strings are not valid ids, so the
 *     package key ("express@4.21.2") lives in a `key` property and every node
 *     gets a dense integer id assigned here.
 *   - Relationships carry their own integer id.
 *   - Vertex upsert must be MERGE-by-id followed by SET; folding properties
 *     into the MERGE pattern is rejected.
 *   - Parameters are scalars or a list-of-maps for UNWIND; nulls are not a
 *     valid property value, so absent fields are omitted, never set to null.
 *
 * Model:
 *   (:Package  {id, key, name, version, seed})
 *   (:Advisory {id, osv, severity, summary})
 *   (:Package)-[:DEPENDS_ON   {id}]->(:Package)
 *   (:Package)-[:HAS_ADVISORY {id}]->(:Advisory)
 *
 * Writes data/idmap.json so queries can translate key → integer id.
 */

'use strict';

import { readFileSync, writeFileSync } from 'node:fs';
import neo4j from 'neo4j-driver';

const DATA = new URL('../data/', import.meta.url).pathname;
const BOLT = process.env.HYDRA_BOLT ?? 'bolt://127.0.0.1:7687';
const TOKEN = process.env.HYDRA_TOKEN ?? 'local-development-token-32-bytes';
const BATCH = 500;
const ADV_BASE = 10_000_000; // advisory ids live above the package id space

const ndjson = (f) =>
  readFileSync(`${DATA}${f}`, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

async function run() {
  const driver = neo4j.driver(BOLT, neo4j.auth.basic('token', TOKEN), {
    disableLosslessIntegers: true,
  });
  const session = driver.session();
  const t0 = Date.now();

  const batched = async (label, rows, cypher) => {
    let done = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      await session.run(cypher, { rows: rows.slice(i, i + BATCH) });
      done += Math.min(BATCH, rows.length - i);
      if (done % 2000 === 0 || done === rows.length) process.stdout.write(`\r  ${label}: ${done}/${rows.length}`);
    }
    process.stdout.write(`\r  ${label}: ${rows.length}/${rows.length}\n`);
  };

  try {
    const nodes = ndjson('nodes.ndjson');
    const edges = ndjson('edges.ndjson');
    const windows = ndjson('advisory-windows.ndjson');

    // ---- integer id assignment -------------------------------------------
    const pkgId = new Map();
    nodes.forEach((n, i) => pkgId.set(n.key, i));

    const advId = new Map();
    const advRows = [];
    for (const w of windows) {
      if (advId.has(w.id)) continue;
      const id = ADV_BASE + advId.size;
      advId.set(w.id, id);
      advRows.push({
        id: neo4j.int(id),
        osv: w.id,
        severity: String(w.severity ?? 'UNKNOWN'),
        summary: String(w.summary ?? '').slice(0, 300),
      });
    }

    writeFileSync(`${DATA}idmap.json`, JSON.stringify({
      packages: Object.fromEntries(pkgId),
      advisories: Object.fromEntries(advId),
    }));

    // ---- packages ---------------------------------------------------------
    await batched('packages', nodes.map((n) => ({
      id: neo4j.int(pkgId.get(n.key)), key: n.key, name: n.name,
      version: n.version, seed: Boolean(n.seedOf),
    })), `
      UNWIND $rows AS row
      MERGE (n {id: row.id})
      SET n:Package, n.key = row.key, n.name = row.name,
          n.version = row.version, n.seed = row.seed
    `);

    // ---- advisories -------------------------------------------------------
    await batched('advisories', advRows, `
      UNWIND $rows AS row
      MERGE (n {id: row.id})
      SET n:Advisory, n.osv = row.osv, n.severity = row.severity, n.summary = row.summary
    `);

    // ---- dependency edges -------------------------------------------------
    const depRows = [];
    for (const e of edges) {
      const f = pkgId.get(e.from), t = pkgId.get(e.to);
      if (f === undefined || t === undefined) continue;
      depRows.push({ f: neo4j.int(f), t: neo4j.int(t), rid: neo4j.int(f * 100_000 + t) });
    }
    await batched('depends_on', depRows, `
      UNWIND $rows AS row
      MATCH (s:Package {id: row.f}), (t:Package {id: row.t})
      MERGE (s)-[r:DEPENDS_ON {id: row.rid}]->(t)
    `);

    // ---- advisory edges (version-window aware) ----------------------------
    // Link an advisory to every ingested version of the affected package that
    // falls inside a compromised window. Classification happens in windows.js.
    const { classify } = await import('./windows.js');
    const byName = new Map();
    for (const n of nodes) {
      if (!byName.has(n.name)) byName.set(n.name, []);
      byName.get(n.name).push(n);
    }
    const advEdges = [];
    let rid = 0;
    for (const w of windows) {
      for (const n of byName.get(w.package) ?? []) {
        if (classify(n.version, w) !== 'inside') continue;
        advEdges.push({ f: neo4j.int(pkgId.get(n.key)), t: neo4j.int(advId.get(w.id)), rid: neo4j.int(rid++) });
      }
    }
    await batched('has_advisory', advEdges, `
      UNWIND $rows AS row
      MATCH (s:Package {id: row.f}), (a:Advisory {id: row.t})
      MERGE (s)-[r:HAS_ADVISORY {id: row.rid}]->(a)
    `);

    console.log(`\nloaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`packages=${nodes.length} advisories=${advRows.length} deps=${depRows.length} vulnerable-versions=${advEdges.length}`);
  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch((e) => { console.error(e.message ?? e); process.exit(1); });
