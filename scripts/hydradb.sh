#!/usr/bin/env bash
#
# Start a local HydraDB node for Recall.
#
#   scripts/hydradb.sh              start (or resume) a node on 127.0.0.1:7687
#   scripts/hydradb.sh --fresh      wipe the store first
#
# There are no prebuilt HydraDB releases, so there are two ways to point this at
# a binary:
#
#   HYDRA_BIN=/path/to/graph-node          a binary already on this machine
#   HYDRA_ROOTFS=/path/to/extracted/rootfs the ghcr.io image unpacked by hand,
#                                          run through its own dynamic loader
#                                          (what you need with no Docker/root)
#
# KNOWN LIMIT — read before relying on this for long. HydraDB stores through
# SlateDB over an object store. With CLOUD_PROVIDER=local the backend is
# LocalFileSystem, which does NOT implement conditional put:
#
#   object store error: Operation `put_opts` with mode `PutMode::Update`
#   not yet implemented by LocalFileSystem(...)
#
# Reads keep working, but once the store has accumulated enough writes to need a
# compare-and-swap, every write fails with "internal query execution error" and
# the node never recovers. Re-run with --fresh and reload, or point
# CLOUD_PROVIDER/LOCAL_PATH at a real S3-compatible store for sustained use.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H="$HERE/.hydradb"
PORT="${HYDRA_PORT:-7687}"
TOKEN="${HYDRA_TOKEN:-local-development-token-32-bytes}"

if [[ "${1:-}" == "--fresh" ]]; then
  # data/idmap.json goes with it. It maps package keys to the integer node ids
  # HydraDB requires, and project.js skips upserting any package already in it —
  # so an idmap that outlives its store makes the next scan write edges to
  # vertices that no longer exist ("MATCH endpoint vertex N ... does not exist").
  # Wipe them together; `npm run load` rebuilds both.
  echo "wiping $H/store and data/idmap.json"
  rm -rf "$H/store" "$H/cache"
  rm -f "$HERE/data/idmap.json"
fi

mkdir -p "$H/store" "$H/cache"
printf '%s' "$TOKEN" > "$H/auth-token"

env_vars=(
  CLOUD_PROVIDER=local
  "LOCAL_PATH=$H/store"
  GRAPH_NAMESPACE=default
  GRAPH_ID=default
  GRAPH_CELL_ID=cell-0
  GRAPH_CELLS=cell-0
  GRAPH_NODE_ID=node-0
  "GRAPH_BOLT_NODE_ADDRESSES=node-0=127.0.0.1:$PORT"
  "GRAPH_ADVERTISED_BOLT_ADDR=127.0.0.1:$PORT"
  "GRAPH_DATA_CACHE_DIR=$H/cache"
  "GRAPH_AUTH_TOKEN_FILE=$H/auth-token"
  GRAPH_ALLOW_PLAINTEXT=true
  # Not optional: without a large stack the node starts, serves /readyz, then
  # aborts on the first traversal.
  RUST_MIN_STACK=33554432
)

if [[ -n "${HYDRA_ROOTFS:-}" ]]; then
  R="$HYDRA_ROOTFS"
  [[ -x "$R/usr/local/bin/graph-node" ]] || { echo "no graph-node under $R" >&2; exit 1; }
  cmd=(
    "$R/lib64/ld-linux-x86-64.so.2"
    --library-path "$R/usr/lib/x86_64-linux-gnu:$R/lib/x86_64-linux-gnu:$R/usr/local/lib"
    "$R/usr/local/bin/graph-node"
  )
else
  BIN="${HYDRA_BIN:-graph-node}"
  command -v "$BIN" >/dev/null || {
    echo "graph-node not found. Set HYDRA_BIN or HYDRA_ROOTFS (see this script's header)." >&2
    exit 1
  }
  cmd=("$BIN")
fi

echo "starting hydradb on 127.0.0.1:$PORT  (log: $H/node.log)"
setsid env "${env_vars[@]}" "${cmd[@]}" > "$H/node.log" 2>&1 < /dev/null &

for i in $(seq 1 40); do
  if (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | grep -q ":$PORT "; then
    echo "bolt listening on 127.0.0.1:$PORT"
    exit 0
  fi
  sleep 0.5
done

echo "node did not open port $PORT in 20s — last log lines:" >&2
tail -5 "$H/node.log" >&2
exit 1
