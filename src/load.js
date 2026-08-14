/**
 * Recall loader — push the ingested graph into HydraDB over Bolt.
 *
 * HydraDB speaks OpenCypher over Neo4j Bolt 5.x, so the standard neo4j-driver
 * works unchanged. Model:
 *
 *   (:Package {key, name, version, seedOf?})
 *   (:Advisory {id, severity, summary})
 *   (:Package)-[:DEPENDS_ON]->(:Package)
 *   (:Package)-[:HAS_ADVISORY]->(:Advisory)
 *
 * Batched UNWIND writes (1k rows per tx). Idempotent via MERGE — safe to
 * re-run after a partial load.
 *
 * Env: HYDRA_BOLT (default bolt://127.0.0.1:7687), HYDRA_TOKEN (auth token
 * file contents; HydraDB uses bearer-token auth — passed as the password half
 * of basic auth with a conventional username).
 */

'use strict';

import { readFileSync } from 'node:fs';
import neo4j from 'neo4j-driver';

const DATA = new URL('../data/', import.meta.url).pathname;
const BOLT = process.env.HYDRA_BOLT ?? 'bolt://127.0.0.1:7687';
const TOKEN = process.env.HYDRA_TOKEN ?? 'local-development-token-32-bytes';
const BATCH = 1000;

const ndjson = (f) =>
  readFileSync(`${DATA}${f}`, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

async function run() {
  const driver = neo4j.driver(BOLT, neo4j.auth.basic('token', TOKEN), {
    disableLosslessIntegers: true,
  });
  const session = driver.session();
  const t0 = Date.now();

  const batched = async (label, rows, cypher) => {
    for (let i = 0; i < rows.length; i += BATCH) {
      await session.executeWrite((tx) => tx.run(cypher, { rows: rows.slice(i, i + BATCH) }));
    }
    console.log(`${label}: ${rows.length}`);
  };

  try {
    const nodes = ndjson('nodes.ndjson');
    const edges = ndjson('edges.ndjson');
    const advisories = ndjson('advisories.ndjson');

    await batched('packages', nodes, `
      UNWIND $rows AS r
      MERGE (p:Package {key: r.key})
      SET p.name = r.name, p.version = r.version,
          p.seed = CASE WHEN r.seedOf IS NULL THEN false ELSE true END
    `);

    await batched('depends_on', edges, `
      UNWIND $rows AS r
      MATCH (a:Package {key: r.from}), (b:Package {key: r.to})
      MERGE (a)-[:DEPENDS_ON]->(b)
    `);

    // Advisory nodes are shared across affected versions; link per package@version.
    await batched('advisories', advisories, `
      UNWIND $rows AS r
      MERGE (v:Advisory {id: r.id})
      SET v.severity = r.severity, v.summary = r.summary
      WITH v, r
      MATCH (p:Package {key: r.package + '@' + r.version})
      MERGE (p)-[:HAS_ADVISORY]->(v)
    `);

    // Smoke query: the whole point of the tool in one line of Cypher.
    const res = await session.executeRead((tx) => tx.run(`
      MATCH (p:Package)-[:DEPENDS_ON*1..6]->(q:Package)-[:HAS_ADVISORY]->(a:Advisory)
      RETURN count(DISTINCT p) AS exposed
    `));
    console.log(`\nexposed packages (≤6 hops from an advisory): ${res.records[0].get('exposed')}`);
    console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } finally {
    await session.close();
    await driver.close();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
