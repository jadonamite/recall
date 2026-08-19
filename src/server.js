/**
 * Recall's web UI and scan API.
 *
 * Zero dependencies beyond what the CLI already needs — node:http, one static
 * page, one streaming endpoint.
 *
 *   npm run ui                     →  http://127.0.0.1:7676   (local, loopback)
 *   RECALL_HOSTED=1 npm run ui     →  0.0.0.0:$PORT           (shared, public)
 *
 * The two modes are genuinely different products and the flag says which:
 *
 *   local   resolves paths on this filesystem, keeps what it scans in the
 *           shared graph, and trusts whoever is at the keyboard.
 *   hosted  accepts a pasted lock file and nothing else — no path ever reaches
 *           the filesystem — writes the visitor's tree under a relationship
 *           type private to that one scan, and deletes it again on the way out.
 *           Nobody's dependency graph is kept, and nobody can see anybody
 *           else's, which is what the landing page promises.
 *
 * POST /api/scan streams NDJSON progress lines rather than returning one blob
 * at the end. A first scan of an unseen project queries OSV for several hundred
 * package names, and a spinner with no news is how a demo dies.
 */

'use strict';

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, resolve as resolvePath } from 'node:path';

import { resolveProject, fromLockObject } from './resolve.js';
import { backfillAdvisories, upsert, report } from './project.js';
import { Recall, scanRelType } from './query.js';

const HOSTED = process.env.RECALL_HOSTED === '1';
const PORT = Number(process.env.PORT ?? (HOSTED ? 8080 : 7676));
const HOST = HOSTED ? '0.0.0.0' : '127.0.0.1';
const PAGE = new URL('../public/index.html', import.meta.url).pathname;
const DATA = new URL('../data/', import.meta.url).pathname;

// Local: lock files for large monorepos get big. Hosted: a shared node has no
// business accepting 32MB of anything from a stranger.
const MAX_BODY = HOSTED ? 2 * 1024 * 1024 : 32 * 1024 * 1024;
// Measured, not guessed: a 2,140-package tree scans fine once on a 512MB
// instance and then kills it on a repeat, because the graph database wants its
// share of the same memory. A cap that holds is worth more than a ceiling that
// works until a judge is the second person to click.
const MAX_PACKAGES = HOSTED ? 1_200 : Infinity;
// A shared node runs in 512MB alongside the graph database. The report is what
// grows: every finding keeps its paths, and a wide tree with a hundred findings
// holds thousands of string arrays at once. Locally that is free; here it is the
// difference between answering and being OOM-killed mid-scan.
const REPORT_OPTS = HOSTED ? { limit: 1_200, keepPaths: 12 } : {};
const MAX_NEW_NAMES = HOSTED ? 800 : Infinity;
const SCAN_TIMEOUT_MS = HOSTED ? 3 * 60_000 : Infinity;

/**
 * Ids are allocated in memory here, never written back to disk.
 *
 * This is safe only because a hosted node wipes its store at boot and reloads
 * the committed graph (see scripts/serve.sh): store and map then start from the
 * same baseline. A map that outlived its store is precisely how a scan ends up
 * writing edges to vertices that no longer exist.
 */
const hostedMap = HOSTED
  ? JSON.parse(readFileSync(`${DATA}idmap.json`, 'utf8'))
  : undefined;

/**
 * One scan at a time.
 *
 * Not throughput management — correctness. Id allocation is read-modify-write
 * over a single map, and two scans interleaving in it hand out one id for two
 * different packages.
 */
let busy = false;

const ORIGINS = (process.env.RECALL_ORIGIN ?? 'https://recall-brown.vercel.app')
  .split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

function cors(req, res) {
  if (!HOSTED) return;
  const origin = req.headers.origin;
  const cleanOrigin = origin ? origin.replace(/\/$/, '') : null;
  if (cleanOrigin && (ORIGINS.includes(cleanOrigin) || ORIGINS.includes('*') || ORIGINS.length === 0)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'origin');
  } else if (ORIGINS.includes('*')) {
    res.setHeader('access-control-allow-origin', '*');
  }
  res.setHeader('access-control-allow-methods', 'POST, GET, OPTIONS');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-max-age', '86400');
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { fail(new Error('request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

/** `~/x` and relative paths both resolve against something predictable. */
const expand = (p) => {
  const t = p.trim();
  if (t.startsWith('~')) return resolvePath(homedir(), t.slice(1).replace(/^\/+/, ''));
  return isAbsolute(t) ? t : resolvePath(process.cwd(), t);
};

/** Delete a scan's edges. Best effort: a failure here must not fail the answer. */
async function dropScan(relType, map) {
  if (!relType) return;
  const r = new Recall({ map });
  try { await r.dropRelType(relType); }
  catch (e) { console.error(`cleanup ${relType}: ${e?.message ?? e}`); }
  finally { await r.close().catch(() => {}); }
}

async function scan(req, res) {
  cors(req, res);

  if (HOSTED && busy) {
    res.writeHead(503, { 'content-type': 'application/x-ndjson; charset=utf-8', 'retry-after': '20' });
    res.end(JSON.stringify({
      stage: 'error',
      message: 'another scan is running on this node — one at a time. Try again in a few seconds.',
    }) + '\n');
    return;
  }
  busy = true;

  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
  });
  const send = (o) => res.write(JSON.stringify(o) + '\n');

  let relType;
  const deadline = SCAN_TIMEOUT_MS === Infinity ? null
    : setTimeout(() => { try { send({ stage: 'error', message: 'scan timed out' }); res.end(); } catch {} }, SCAN_TIMEOUT_MS);

  try {
    const { lock, dir, dev = false } = JSON.parse(await readBody(req));

    // A hosted node never touches the filesystem on a visitor's say-so. `expand`
    // resolves `~` and absolute paths, so honouring `dir` here would be an
    // arbitrary file read wearing a scan's clothes.
    if (HOSTED && dir) throw new Error('this node scans pasted lock files only');
    if (HOSTED && !lock) throw new Error('paste a package-lock.json to scan');

    send({ stage: 'resolve', message: 'resolving dependency tree' });
    const graph = lock
      ? fromLockObject(typeof lock === 'string' ? JSON.parse(lock) : lock, { dev })
      : await resolveProject(expand(String(dir ?? '.')), { dev });

    if (graph.nodes.length > MAX_PACKAGES) {
      throw new Error(
        `${graph.nodes.length} packages — this shared node handles trees up to ${MAX_PACKAGES}. ` +
        `It runs on a 512MB free instance next to the graph database, and a tree this size ` +
        `takes it down. Clone the repo (github.com/jadonamite/recall) and run it locally, ` +
        `where there is no limit: npm run recall <your project>`
      );
    }

    send({
      stage: 'resolved', root: graph.root, mode: graph.mode,
      packages: graph.nodes.length, edges: graph.edges.length,
      warnings: graph.warnings ?? [],
    });

    send({ stage: 'advisories', message: 'checking advisory history for every package name' });
    const adv = await backfillAdvisories(graph.nodes.map((n) => n.name), { maxNew: MAX_NEW_NAMES });
    send({ stage: 'advisories-done', ...adv });

    send({ stage: 'load', message: 'loading the tree into HydraDB' });
    const up = await upsert(graph, HOSTED
      ? { relType: scanRelType(), map: hostedMap, persist: false, shared: false }
      : {});
    relType = up.relType;
    send({ stage: 'loaded', newPackages: up.newPackages, hits: up.exposed.length, relType });

    send({ stage: 'recall', message: 'traversing DEPENDS_ON backwards from each vulnerable version' });
    const out = await report(graph, up.exposed, {
      relType, map: HOSTED ? hostedMap : undefined, ...REPORT_OPTS,
    });
    send({ stage: 'done', report: out });
  } catch (e) {
    send({ stage: 'error', message: e.message ?? String(e) });
  } finally {
    if (deadline) clearTimeout(deadline);
    res.end();
    // Release before cleaning up, not after. Deleting this scan's edges touches
    // nothing the next scan needs — the lock exists to serialize id allocation —
    // and holding it through cleanup means the next visitor is told the node is
    // busy when it is only tidying up.
    busy = false;
    // After the answer is on the wire, not before it: the visitor waits for a
    // recall, not for our housekeeping.
    if (HOSTED) await dropScan(relType, hostedMap);
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    cors(req, res);
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/scan') return scan(req, res);

  // Liveness that means something: the API is up AND it can reach the graph.
  // A health check that only proves the HTTP server started would let a node
  // with a dead HydraDB behind it stay in service.
  if (req.method === 'GET' && (req.url === '/healthz' || req.url?.startsWith('/healthz'))) {
    cors(req, res);
    const r = new Recall({ map: hostedMap });
    try {
      const n = (await r.vulnerable()).length;
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, hosted: HOSTED, vulnerableVersions: n, busy }));
    } catch (e) {
      res.writeHead(503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: false, error: e?.message ?? String(e) }));
    } finally { await r.close().catch(() => {}); }
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    // Read per request so editing the page during a demo needs only a refresh.
    const html = readFileSync(PAGE);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(html);
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found\n');
});

// The Bolt driver can throw while packing a large write, asynchronously enough
// that it escapes the try/catch around the call and would otherwise take the
// whole server down mid-scan. Log it and keep serving; the in-flight request
// ends without a `done` event, which the page already reports as a failure.
process.on('uncaughtException', (e) => {
  console.error(`uncaught: ${e?.message ?? e}`);
});

server.listen(PORT, HOST, () => {
  console.log(`recall ${HOSTED ? 'api' : 'ui '}  ·  http://${HOST}:${PORT}`);
  console.log(`hydradb    ·  ${process.env.HYDRA_BOLT ?? 'bolt://127.0.0.1:7687'}`);
  if (HOSTED) {
    console.log(`mode       ·  hosted — pasted lock files only, per-scan graph, nothing kept`);
    console.log(`origins    ·  ${ORIGINS.join(', ')}`);
  }
});
