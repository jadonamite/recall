/**
 * Recall ingest — build the npm dependency graph from deps.dev.
 *
 * Why deps.dev: its `:dependencies` endpoint returns a package version's FULL
 * resolved graph (nodes + edges) in a single call — the transitive closure is
 * computed server-side. ~150 seeds → ~1 call each → thousands of distinct
 * package@version nodes, with none of the N+1 registry crawling that dies on
 * a flaky connection.
 *
 * Output (data/):
 *   nodes.ndjson  { key, name, version, seedOf? }
 *   edges.ndjson  { from, to }            from/to are "name@version" keys
 *   seeds.done    resume log — one seed per line, safe to re-run any time
 */

'use strict';

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';

const API = 'https://api.deps.dev/v3/systems/npm/packages';
const DATA = new URL('../data/', import.meta.url).pathname;
const CONCURRENCY = 3;          // flaky-network setting: gentle but parallel
const RETRIES = 4;

/**
 * Seeds: high-traffic packages across the ecosystem's load-bearing categories.
 * The transitive closure from these reaches the packages that matter — the
 * graph fans out to thousands of name@version nodes on its own.
 */
const SEEDS = [
  // frameworks & servers
  'express', 'next', 'react', 'react-dom', 'vue', 'svelte', 'fastify', 'koa',
  'nest', '@nestjs/core', 'hono', 'remix', '@remix-run/node', 'astro', 'nuxt',
  // build tooling
  'webpack', 'vite', 'rollup', 'esbuild', 'parcel', 'babel-loader',
  '@babel/core', 'typescript', 'ts-node', 'tsx', 'turbo', 'nx',
  // linting / formatting / test
  'eslint', 'prettier', 'jest', 'vitest', 'mocha', 'chai', 'cypress',
  'playwright', '@playwright/test', 'karma',
  // utilities everyone has
  'lodash', 'underscore', 'ramda', 'axios', 'node-fetch', 'got', 'undici',
  'chalk', 'commander', 'yargs', 'inquirer', 'ora', 'debug', 'dotenv',
  'uuid', 'nanoid', 'dayjs', 'date-fns', 'moment', 'luxon', 'zod', 'joi',
  'yup', 'ajv', 'semver', 'glob', 'minimatch', 'rimraf', 'fs-extra',
  'graceful-fs', 'mkdirp', 'micromatch', 'fast-glob',
  // data & backend
  'mongoose', 'mongodb', 'pg', 'mysql2', 'redis', 'ioredis', 'prisma',
  '@prisma/client', 'sequelize', 'knex', 'typeorm', 'drizzle-orm',
  'kafkajs', 'amqplib', 'bullmq',
  // auth & security-adjacent (rich advisory history)
  'jsonwebtoken', 'passport', 'bcrypt', 'bcryptjs', 'argon2', 'helmet',
  'cors', 'express-session', 'cookie-parser', 'csurf', 'express-rate-limit',
  // http/microservice plumbing
  'body-parser', 'multer', 'form-data', 'formidable', 'ws', 'socket.io',
  'socket.io-client', 'graphql', 'apollo-server', '@apollo/server',
  // templating / rendering / parsing (classic vuln territory)
  'ejs', 'pug', 'handlebars', 'mustache', 'nunjucks', 'marked',
  'markdown-it', 'sanitize-html', 'dompurify', 'cheerio', 'jsdom',
  'xml2js', 'fast-xml-parser', 'js-yaml', 'yaml', 'csv-parse', 'papaparse',
  // crypto / encoding
  'crypto-js', 'jose', 'node-forge', 'elliptic', 'tweetnacl',
  // infra SDKs
  'aws-sdk', '@aws-sdk/client-s3', 'firebase', 'firebase-admin',
  '@google-cloud/storage', 'stripe', 'twilio', 'nodemailer',
  // web3 (course of business)
  'ethers', 'viem', 'wagmi', 'web3', '@solana/web3.js',
  // process & cli infra
  'pm2', 'nodemon', 'concurrently', 'cross-env', 'execa', 'shelljs',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url) {
  for (let i = 0; i < RETRIES; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === RETRIES - 1) throw e;
      await sleep(1500 * 2 ** i); // 1.5s, 3s, 6s
    }
  }
}

async function defaultVersion(name) {
  const pkg = await getJSON(`${API}/${encodeURIComponent(name)}`);
  if (!pkg?.versions?.length) return null;
  const def = pkg.versions.find((v) => v.isDefault) ?? pkg.versions.at(-1);
  return def.versionKey.version;
}

async function main() {
  mkdirSync(DATA, { recursive: true });
  const doneFile = `${DATA}seeds.done`;
  const done = new Set(
    existsSync(doneFile) ? readFileSync(doneFile, 'utf8').split('\n').filter(Boolean) : []
  );
  const seenNodes = new Set();
  const seenEdges = new Set();

  // Rebuild dedup sets from any previous partial run.
  for (const f of ['nodes', 'edges']) {
    const p = `${DATA}${f}.ndjson`;
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      if (!line) continue;
      const o = JSON.parse(line);
      (f === 'nodes' ? seenNodes : seenEdges).add(f === 'nodes' ? o.key : `${o.from}→${o.to}`);
    }
  }

  const todo = SEEDS.filter((s) => !done.has(s));
  console.log(`seeds: ${SEEDS.length} total, ${done.size} done, ${todo.length} to go · nodes so far: ${seenNodes.size}`);

  let active = 0, idx = 0, failures = 0;
  await new Promise((resolve) => {
    const pump = () => {
      while (active < CONCURRENCY && idx < todo.length) {
        const seed = todo[idx++];
        active++;
        (async () => {
          try {
            const version = await defaultVersion(seed);
            if (!version) throw new Error('no default version');
            const graph = await getJSON(
              `${API}/${encodeURIComponent(seed)}/versions/${encodeURIComponent(version)}:dependencies`
            );
            if (!graph?.nodes) throw new Error('no graph');

            const keys = graph.nodes.map((n) => `${n.versionKey.name}@${n.versionKey.version}`);
            for (let i = 0; i < graph.nodes.length; i++) {
              const key = keys[i];
              if (!seenNodes.has(key)) {
                seenNodes.add(key);
                appendFileSync(`${DATA}nodes.ndjson`, JSON.stringify({
                  key, name: graph.nodes[i].versionKey.name,
                  version: graph.nodes[i].versionKey.version,
                  ...(i === 0 ? { seedOf: seed } : {}),
                }) + '\n');
              }
            }
            for (const e of graph.edges ?? []) {
              const ek = `${keys[e.fromNode]}→${keys[e.toNode]}`;
              if (!seenEdges.has(ek)) {
                seenEdges.add(ek);
                appendFileSync(`${DATA}edges.ndjson`, JSON.stringify({
                  from: keys[e.fromNode], to: keys[e.toNode],
                }) + '\n');
              }
            }
            appendFileSync(doneFile, seed + '\n');
            console.log(`✓ ${seed}@${version}  +${graph.nodes.length} nodes  (total ${seenNodes.size})`);
          } catch (e) {
            failures++;
            console.error(`✗ ${seed}: ${e.message}`);
          } finally {
            active--;
            if (idx >= todo.length && active === 0) resolve();
            else pump();
          }
        })();
      }
    };
    pump();
  });

  console.log(`\ndone · nodes=${seenNodes.size} edges=${seenEdges.size} failures=${failures}`);
  console.log('re-run to retry failures; resume is automatic.');
}

main().catch((e) => { console.error(e); process.exit(1); });
