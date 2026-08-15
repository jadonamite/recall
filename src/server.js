/**
 * Recall's local web UI.
 *
 * Zero dependencies beyond what the CLI already needs — node:http, one static
 * page, one streaming endpoint. It binds to loopback only: this tool resolves
 * paths on the local filesystem and talks to an unauthenticated local graph
 * database, neither of which belongs on a public interface.
 *
 *   npm run ui   →   http://127.0.0.1:7676
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

const PORT = Number(process.env.PORT ?? 7676);
const HOST = '127.0.0.1';
const PAGE = new URL('../public/index.html', import.meta.url).pathname;

const MAX_BODY = 32 * 1024 * 1024; // lock files for large monorepos get big

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

async function scan(req, res) {
  res.writeHead(200, {
    'content-type': 'application/x-ndjson; charset=utf-8',
    'cache-control': 'no-store',
    'x-accel-buffering': 'no',
  });
  const send = (o) => res.write(JSON.stringify(o) + '\n');

  try {
    const { lock, dir, dev = false } = JSON.parse(await readBody(req));

    send({ stage: 'resolve', message: 'resolving dependency tree' });
    const graph = lock
      ? fromLockObject(typeof lock === 'string' ? JSON.parse(lock) : lock, { dev })
      : await resolveProject(expand(String(dir ?? '.')), { dev });
    send({
      stage: 'resolved', root: graph.root, mode: graph.mode,
      packages: graph.nodes.length, edges: graph.edges.length,
      warnings: graph.warnings ?? [],
    });

    send({ stage: 'advisories', message: 'checking advisory history for every package name' });
    const adv = await backfillAdvisories(graph.nodes.map((n) => n.name));
    send({ stage: 'advisories-done', ...adv });

    send({ stage: 'load', message: 'loading the tree into HydraDB' });
    const { exposed, newPackages, relType } = await upsert(graph);
    send({ stage: 'loaded', newPackages, hits: exposed.length });

    send({ stage: 'recall', message: 'traversing DEPENDS_ON backwards from each vulnerable version' });
    const out = await report(graph, exposed, { relType });
    send({ stage: 'done', report: out });
  } catch (e) {
    send({ stage: 'error', message: e.message ?? String(e) });
  } finally {
    res.end();
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/scan') return scan(req, res);

  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    // Read per request so editing the page during a demo needs only a refresh.
    const html = readFileSync(PAGE);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(html);
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found\n');
});

server.listen(PORT, HOST, () => {
  console.log(`recall ui  ·  http://${HOST}:${PORT}`);
  console.log(`hydradb    ·  ${process.env.HYDRA_BOLT ?? 'bolt://127.0.0.1:7687'}`);
});
