/**
 * Build the static demo.
 *
 * Recall cannot run on a serverless host: the traversal needs a Bolt connection
 * to a HydraDB node, resolution reads a lock file off disk, and a first scan of
 * an unseen project queries OSV for hundreds of package names — minutes past
 * any function timeout. So the deployable artifact is the real UI driven by a
 * real scan that was computed here, ahead of time.
 *
 * That is a recorded scan, and the page says so on its face. Nothing in the
 * output is fabricated or trimmed: it is exactly what `npm run recall` printed
 * for a public repository's committed lock file, which anyone can re-run.
 *
 *   node src/build-demo.js <dir-or-lockfile> [--dev] [--source <url>]
 *
 * Writes dist/index.html and dist/demo.json.
 */

'use strict';

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

import { resolveProject, fromLockObject } from './resolve.js';
import { backfillAdvisories, upsert, report } from './project.js';

const ROOT = new URL('../', import.meta.url).pathname;
const DIST = `${ROOT}dist/`;

async function main() {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const dev = args.includes('--dev');
  const sourceUrl = args[args.indexOf('--source') + 1] ?? null;
  if (!target) {
    console.log('usage: node src/build-demo.js <dir-or-lockfile> [--dev] [--source <url>]');
    process.exit(1);
  }

  console.log(`resolving ${target}`);
  const graph = target.endsWith('.json')
    ? fromLockObject(JSON.parse(readFileSync(target, 'utf8')), { dev })
    : await resolveProject(target, { dev });
  console.log(`  ${graph.root} · ${graph.nodes.length} packages · ${graph.edges.length} edges`);

  await backfillAdvisories(graph.nodes.map((n) => n.name));
  const { exposed, relType } = await upsert(graph);
  const out = await report(graph, exposed, { relType });
  console.log(`  ${out.findings} findings → ${out.fixes.length} upgrades`);

  mkdirSync(DIST, { recursive: true });

  const demo = {
    ...out,
    recordedAt: new Date().toISOString().slice(0, 10),
    sourceUrl,
    sourceLabel: sourceUrl ? sourceUrl.replace(/^https?:\/\/(www\.)?/, '') : basename(target),
    dev,
  };
  writeFileSync(`${DIST}demo.json`, JSON.stringify(demo));

  // The deployed page is the same page, with the demo payload declared up top.
  const page = readFileSync(`${ROOT}public/index.html`, 'utf8');
  if (!page.includes('</head>')) throw new Error('index.html has no </head> to inject into');
  const injected = page.replace(
    '</head>',
    '<script>window.RECALL_DEMO = "demo.json";</script>\n</head>'
  );
  writeFileSync(`${DIST}index.html`, injected);

  const size = (f) => (readFileSync(f).length / 1024).toFixed(0);
  console.log(`\ndist/index.html  ${size(`${DIST}index.html`)}K`);
  console.log(`dist/demo.json   ${size(`${DIST}demo.json`)}K`);
  if (!existsSync(`${DIST}demo.json`)) process.exit(1);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
