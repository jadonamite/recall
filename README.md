# Recall

**The product-recall query for software supply chains.**

Dependency scanners tell you *which packages are vulnerable*. No manufacturer has run a recall that way since the 1970s. When a bad component lot is found, a manufacturer runs the bill of materials **upward** — which sub-assemblies used it, which finished products used those, which units shipped, which owners to write to. Software borrowed the phrase "bill of materials" and never implemented the query that makes one useful.

Recall implements it.

```
$ recall recall turbo-stream@2.4.1

2 paths reach turbo-stream@2.4.1
  [1] @remix-run/server-runtime@2.17.5 → turbo-stream@2.4.1
  [2] @remix-run/node@2.17.5 → @remix-run/server-runtime@2.17.5 → turbo-stream@2.4.1

$ recall cuts brace-expansion@5.0.8

upgrade these to sever paths to brace-expansion@5.0.8:
     2 paths · 2 dependents · minimatch@10.2.5
     1 paths · 1 dependents · nx@23.1.1
```

The second command is the point. Not a wall of findings — an ordered list of *fixes*, ranked by how many paths each one severs.

## Why the flat list fails

`npm audit` on a real project prints hundreds of findings with two fatal properties:

1. **It is a list, not a path.** You cannot tell *how* the bad thing reaches you, so you cannot tell which single upgrade kills thirty findings at once.
2. **Most of it is unreachable.** The vulnerable function is frequently never called on any path your code takes.

The result is alert fatigue — the defining failure of the category. Developers learn the output is mostly noise and stop reading it.

## The four queries

| Query | Question | Mechanism |
|---|---|---|
| `vulnerable` | What is compromised in the graph? | advisory edges, version-window filtered |
| `recall <pkg>` | Who ships this, and by what chain? | reverse traversal, paths returned |
| `blast <pkg>` | How far does it reach? | reachable subgraph + depth profile |
| `cuts <pkg>` | What do I actually fix? | rank by paths severed per upgrade |

Every one is a path query. A relational schema answers them with recursive CTEs that fall over at depth; a vector store cannot express them at all, because **"reaches" is not a distance**.

## Version windows

An advisory is not a property of a package — it is a property of a *version range*. Recall pulls every advisory that ever affected each package name, with its `introduced → fixed` windows, then classifies each concrete version as:

- `inside` — sits in an affected window (exposed)
- `patched` — at or above the fix
- `before` — predates every window
- `unknown` — unparseable, and deliberately never treated as safe

## Architecture

```
src/ingest.js            dependency graph from deps.dev (full resolved graph
                         per seed in one call), resume-safe
src/advisories.js        OSV exact-version scan
src/advisory-history.js  OSV per-name advisory windows — the time dimension
src/windows.js           semver window classification (pure, tested)
src/load.js              batched idempotent load into HydraDB over Bolt
src/query.js             the four queries + CLI
```

## Run

```bash
npm test                       # window classification suite

node src/ingest.js             # build the dependency graph
node src/advisory-history.js   # attach advisory windows
node src/load.js               # load into HydraDB
node src/query.js vulnerable
node src/query.js recall brace-expansion@5.0.8
node src/query.js cuts  brace-expansion@5.0.8
```

Needs a HydraDB node on `bolt://127.0.0.1:7687` (override with `HYDRA_BOLT` / `HYDRA_TOKEN`).

### Notes on the store

HydraDB speaks a deliberately narrow OpenCypher subset. What the loader and queries are shaped by:

- auto-commit `RUN` only — explicit transactions are rejected
- node ids are **non-negative integers**, so package keys live in a `key` property behind an id map
- parameters must be integer-typed on the wire (`neo4j.int()`), or they arrive as floats and are refused
- vertex upsert is `MERGE`-by-id followed by `SET`
- reverse variable-length patterns are unsupported — reverse traversal uses the native `algo.SSpaths` procedure with `relDirection: 'incoming'`

## Data sources

[deps.dev](https://deps.dev) for resolved dependency graphs · [OSV](https://osv.dev) for advisories. Both public, no key required.

## License

MIT
