/**
 * Ingest public applications into the shared graph.
 *
 * The seed crawl (ingest.js) resolves ~150 popular packages at their *current*
 * versions, and current versions are mostly patched — 19 vulnerable versions
 * across 2,270 packages. That is a true picture of the registry's head and a
 * useless basis for a recall, because almost nothing is actually exposed.
 *
 * Real applications are exposed, because they pin. So the shared graph also
 * holds the committed lock files of the public repositories listed in
 * data/public-sources.json. Every dependent the recall notice names is then a
 * real, checkable project — and because the sources are a committed spec that
 * this script fetches, anyone can rebuild the same graph and get the same
 * answers.
 *
 * These land under SEED_GRAPH alongside the crawl, which is the relationship
 * type the public site queries. Private scans never do, so nobody's own project
 * can leak into a page describing the ecosystem.
 *
 *   node src/ingest-public.js            fetch and ingest every source
 *   node src/ingest-public.js <file...>  ingest local lock files instead
 */

'use strict';

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

import { fromLockObject } from './resolve.js';
import { backfillAdvisories, upsert } from './project.js';

const DATA = new URL('../data/', import.meta.url).pathname;
const RAW = 'https://raw.githubusercontent.com';

async function fetchLock({ repo, ref }) {
  const url = `${RAW}/${repo}/${ref}/package-lock.json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const dev = process.argv.includes('--dev');

  /** @type {{label: string, url: string|null, lock: object}[]} */
  const targets = [];

  if (files.length) {
    for (const f of files) {
      try { targets.push({ label: basename(f), url: null, lock: JSON.parse(readFileSync(f, 'utf8')) }); }
      catch (e) { console.error(`✗ ${basename(f)}: ${e.message}`); }
    }
  } else {
    const spec = JSON.parse(readFileSync(`${DATA}public-sources.json`, 'utf8'));
    for (const s of spec.sources) {
      try {
        console.log(`fetching ${s.repo}@${s.ref}`);
        targets.push({ label: s.repo, url: `https://github.com/${s.repo}`, lock: await fetchLock(s) });
      } catch (e) {
        console.error(`✗ ${s.repo}: ${e.message}`);
      }
    }
  }

  // Exact union across the seed crawl and every public source, so the site can
  // state real totals instead of adding overlapping numbers together.
  const unionNodes = new Set();
  const unionEdges = new Set();
  for (const line of readFileSync(`${DATA}nodes.ndjson`, 'utf8').split('\n')) {
    if (line) unionNodes.add(JSON.parse(line).key);
  }
  for (const line of readFileSync(`${DATA}edges.ndjson`, 'utf8').split('\n')) {
    if (line) { const e = JSON.parse(line); unionEdges.add(`${e.from}\u0000${e.to}`); }
  }
  const seedNodes = unionNodes.size, seedEdges = unionEdges.size;

  const manifest = [];
  for (const t of targets) {
    let graph;
    try {
      graph = fromLockObject(t.lock, { dev });
    } catch (e) {
      console.error(`✗ ${t.label}: ${e.message}`);
      continue;
    }
    console.log(`${graph.root}  (${t.label})`);
    console.log(`  ${graph.nodes.length} packages · ${graph.edges.length} edges`);

    await backfillAdvisories(graph.nodes.map((n) => n.name));
    const { exposed, newPackages } = await upsert(graph, { extraRelTypes: ['SEED_GRAPH'] });
    console.log(`  +${newPackages} new packages · ${exposed.length} advisory hits\n`);

    for (const n of graph.nodes) unionNodes.add(n.key);
    for (const e of graph.edges) unionEdges.add(`${e.from}\u0000${e.to}`);

    manifest.push({
      name: t.label, url: t.url, root: graph.root,
      packages: graph.nodes.length, edges: graph.edges.length,
      newPackages, advisoryHits: exposed.length,
    });
  }

  // Measured, not declared — build-site.js reads this for the page's totals and
  // its "what this graph is made of" disclosure.
  writeFileSync(`${DATA}public-graph.json`, JSON.stringify({
    ingestedAt: new Date().toISOString().slice(0, 10),
    dev,
    seedNodes,
    seedEdges,
    unionPackages: unionNodes.size,
    unionEdges: unionEdges.size,
    sources: manifest,
  }, null, 2) + '\n');
  console.log(`data/public-graph.json written · ${manifest.length} sources`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
