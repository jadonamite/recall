# Recall

**The product-recall query for software supply chains.**

Dependency scanners tell you *which packages are vulnerable*. No manufacturer has run a recall that way since the 1970s. When a bad component lot is found, a manufacturer runs the bill of materials **upward** — which sub-assemblies used it, which finished products used those, which units shipped, which owners to write to. Software borrowed the phrase "bill of materials" and never implemented the query that makes one useful.

Recall implements it. Point it at a real project:

```
$ npm run recall ~/code/my-app

my-app@0.1.2  ·  exact (package-lock.json)
  1634 packages · 4134 edges

111 findings across 29 vulnerable versions
  1 critical · 50 high · 53 medium · 7 low
↓
15 direct dependencies to upgrade:

  CRITICAL 9.6    4 vulnerable versions ·    4 paths · vitest@4.1.4
  HIGH 8.7       10 vulnerable versions ·  202 paths · @privy-io/react-auth@3.27.1
  HIGH 7.5        9 vulnerable versions ·  245 paths · @web3auth/modal@10.16.0
  HIGH 8.7        5 vulnerable versions ·  190 paths · @reown/appkit-adapter-wagmi@1.8.19
  …

worst chains:
  [1] my-app@0.1.2 → vitest@4.1.4
      CRITICAL  GHSA-9crc-q9x8-hgqq  Vitest allows Remote Code Execution …
  [2] my-app@0.1.2 → viem@2.48.11 → ws@8.18.3
      HIGH  GHSA-96hv-2xvq-fx4p  ws: Memory exhaustion DoS from tiny fragments …
```

**111 findings became 15 upgrades.** Not by filtering anything out — every finding is still there. By asking the question a scanner cannot ask: *by what path does this reach me?* Every path enters through exactly one direct dependency, and that is the only thing you can actually change.

![The recall — findings collapsed onto the direct dependencies they enter through](docs/ui-recall.png)

## Why the flat list fails

`npm audit` on a real project prints hundreds of findings with two fatal properties:

1. **It is a list, not a path.** You cannot tell *how* the bad thing reaches you, so you cannot tell which single upgrade kills thirty findings at once.
2. **Most of it is unreachable.** The vulnerable function is frequently never called on any path your code takes.

The result is alert fatigue — the defining failure of the category. Developers learn the output is mostly noise and stop reading it. The UI ships the flat list too, behind a toggle, so you can see the same data both ways.

## The web UI

```bash
npm run ui      # http://127.0.0.1:7676
```

Paste a `package-lock.json` or point it at a directory. Findings on the left, the upgrades they collapse onto on the right, and the traversal that connects them shown verbatim in the sidebar — open any row to walk the chain hop by hop.

![A fix expanded to its vulnerable versions and the exact chains reaching them](docs/ui-chains.png)

It binds to loopback only: it reads paths on the local filesystem and talks to an unauthenticated local graph node, neither of which belongs on a public interface.

## Resolution: exact, or honestly labelled

A dependency graph built from *current* package versions finds almost nothing, because current versions are mostly patched. Real projects are not. Recall resolves the tree the project actually has:

| Input | Fidelity | How |
|---|---|---|
| `package-lock.json` (v2/v3) | **exact**, offline | Replays npm's own `node_modules` lookup rules against the lock file's paths |
| `package.json` | approximate | Ranges resolved against deps.dev — what npm *would* install today |

The lock-file path matters more than it sounds. npm's resolution is positional: a dependency is satisfied by the nearest `node_modules/<name>` walking up the directory chain, so one project routinely holds several live copies of the same package at different versions. Replaying that rule keeps them distinct — a flat scanner collapses them and loses the very edge you needed. Eight tests in `test/resolve.test.js` cover the cases that bite: hoisting, shadowing, scope walk-up, workspace links, optional deps.

When there is no lock file, the report says *"resolved as npm would install today"* on its face rather than quietly implying it knows what you are running.

## The queries

| Query | Question | Mechanism |
|---|---|---|
| `vulnerable` | What is compromised in the graph? | advisory edges, version-window filtered |
| `recall <pkg>` | Who ships this, and by what chain? | reverse traversal, paths returned |
| `blast <pkg>` | How far does it reach? | reachable subgraph + depth profile |
| `cuts <pkg>` | What do I actually fix? | rank by paths severed per upgrade |

The first four are `src/query.js` subcommands, against the whole graph. `src/project.js` runs the same traversal scoped to one real project's root, which is the form the UI uses.

Every one is a path query. A relational schema answers them with recursive CTEs that fall over at depth; a vector store cannot express them at all, because **"reaches" is not a distance**.

## Version windows

An advisory is not a property of a package — it is a property of a *version range*. Recall pulls every advisory that ever affected each package name, with its `introduced → fixed` windows, then classifies each concrete version as:

- `inside` — sits in an affected window (exposed)
- `patched` — at or above the fix
- `before` — predates every window
- `unknown` — unparseable, and deliberately never treated as safe

## Severity

OSV records severity inconsistently: sometimes a label, sometimes a CVSS vector and nothing else, frequently both a v3 and a v4 vector on the same advisory. A vector is not a severity until someone scores it, so `src/severity.js` computes the **CVSS v3.x base score** from the vector using the published formula (tested against the specification's own worked examples).

CVSS v4 vectors are **not** scored. The v4 formula is a lookup table, not a closed form, and running a v3 equation over a v4 vector would produce a confident number that is simply wrong. Those report as `UNRATED`.

## Architecture

```
src/ingest.js            seed dependency graph from deps.dev, resume-safe
src/advisories.js        OSV exact-version scan
src/advisory-history.js  OSV per-name advisory windows — the time dimension
src/windows.js           semver window classification (pure, tested)
src/severity.js          CVSS v3.x base scoring (pure, tested)
src/resolve.js           real projects → nodes + edges (lock file or manifest)
src/load.js              batched idempotent load into HydraDB over Bolt
src/project.js           resolve → backfill → upsert → recall → report
src/query.js             the graph queries + CLI
src/server.js            zero-dependency local web UI
public/index.html        the UI, single file
```

## Run

The crawled dataset is committed — 2,270 packages, 4,557 edges and 979 advisory
windows in `data/` — so there is no waiting on a crawl to see this work.

```bash
npm install
npm test                            # 37 tests, no network, no database

npm run load                        # load the committed graph into HydraDB (~2s)
npm run recall ~/code/my-app        # the recall, on a real project
npm run ui                          # the same thing, in a browser

node src/query.js vulnerable
node src/query.js recall brace-expansion@1.1.12
node src/query.js cuts   brace-expansion@1.1.12
```

Rebuilding the dataset from scratch is `node src/ingest.js` then `node src/advisory-history.js`; both are resume-safe and take a while.

### Running HydraDB

Everything above needs a HydraDB node on `bolt://127.0.0.1:7687` (override with `HYDRA_BOLT` / `HYDRA_TOKEN`, which default to that address and to the token below).

This is the exact environment the node used for every number in this README — the binary came out of `ghcr.io/hydra-db/hydradb`, run directly rather than under a container runtime, because this machine has neither Docker nor root:

```bash
H=./.hydradb
mkdir -p $H && printf 'local-development-token-32-bytes' > $H/auth-token

CLOUD_PROVIDER=local LOCAL_PATH=$H/store \
GRAPH_NAMESPACE=default GRAPH_ID=default \
GRAPH_CELL_ID=cell-0 GRAPH_CELLS=cell-0 GRAPH_NODE_ID=node-0 \
GRAPH_BOLT_NODE_ADDRESSES=node-0=127.0.0.1:7687 \
GRAPH_ADVERTISED_BOLT_ADDR=127.0.0.1:7687 \
GRAPH_DATA_CACHE_DIR=$H/cache GRAPH_AUTH_TOKEN_FILE=$H/auth-token \
GRAPH_ALLOW_PLAINTEXT=true RUST_MIN_STACK=33554432 \
  graph-node
```

Under Docker the same variables apply, with `-p 7687:7687` and the paths pointing inside the container.

`RUST_MIN_STACK=33554432` is **not optional** — without it the node starts, serves `/readyz`, and then aborts on the first traversal.

### Notes on the store

HydraDB speaks a deliberately narrow OpenCypher subset. What the loader and queries are shaped by:

- auto-commit `RUN` only — explicit transactions are rejected
- node ids are **non-negative integers**, so package keys live in a `key` property behind an id map
- parameters must be integer-typed on the wire (`neo4j.int()`), or they arrive as floats and are refused
- vertex upsert is `MERGE`-by-id followed by `SET`; folding properties into the `MERGE` pattern is rejected
- `SET` values must read from the row map — a literal in an `UNWIND` write is rejected
- no `IN`, `CONTAINS`, `IS NULL`, or `RETURN *`
- reverse variable-length patterns are unsupported, so the reverse traversal runs as the native `algo.SSpaths` procedure with `relDirection: 'incoming'` — that one parameter *is* the recall
- `algo.SSpaths`'s `pathCount` caps returned paths across the whole store, so each scanned project's edges are also written under a relationship type private to that project. Without it, one project's paths can crowd out another's and a genuinely reachable vulnerability reads as unreachable — which is exactly the silent false negative this tool exists to avoid.

## What this does not claim

- **Reachability.** Recall reports that a vulnerable version is present in your tree and by what chain. It does not claim the vulnerable *code* is called at runtime. That is a genuinely harder problem, and tools that blur the line are the reason people stopped trusting the category.
- **Completeness of the seed graph.** The ~150-package seed list in `ingest.js` is a judgement call about what the ecosystem leans on, not a mirror of npm. Resolving your own project is not affected by it — your tree is ingested whole.
- **That upgrading the listed dependency is always possible.** Sometimes the fix is an `overrides` entry, and sometimes upstream has not shipped one. Recall tells you where the path enters; it does not promise the door opens.

## Data sources

[deps.dev](https://deps.dev) for resolved dependency graphs · [OSV](https://osv.dev) for advisories. Both public, no key required.

## License

MIT
