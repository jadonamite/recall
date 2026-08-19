#!/usr/bin/env bash
#
# Boot a shared Recall node: graph node, then the committed graph, then the API.
#
# The store is wiped on every boot, deliberately, and that is load-bearing twice
# over:
#
#   1. HydraDB's LocalFileSystem backend does not implement conditional put, so
#      a store that lives long enough to need a compare-and-swap stops accepting
#      writes forever. One that never survives a restart never gets there.
#   2. A hosted node allocates package ids in memory and never writes them back
#      (see src/server.js). Store and id map therefore have to start from the
#      same committed baseline, or the first scan writes edges to vertices that
#      do not exist.
#
# Nothing of value is lost: the graph is rebuilt from data/ in about ten seconds,
# and visitors' trees are never meant to survive their own request.

set -uo pipefail

H="${HYDRA_STORE:-/tmp/hydradb}"
BOLT_PORT="${HYDRA_PORT:-7687}"
TOKEN="${HYDRA_TOKEN:-container-local-token-32-bytes-min}"

# Export what the database is actually configured with, rather than leaving the
# Node side to fall back to its own default. The two defaults differ, and a
# mismatch surfaces as "invalid credentials" from the loader — a confusing way
# to say the token file and the client disagree.
export HYDRA_TOKEN="$TOKEN"
export HYDRA_BOLT="${HYDRA_BOLT:-bolt://127.0.0.1:$BOLT_PORT}"

rm -rf "$H"
mkdir -p "$H/store" "$H/cache"
printf '%s' "$TOKEN" > "$H/auth-token"

echo "── starting hydradb"
env \
  CLOUD_PROVIDER=local \
  LOCAL_PATH="$H/store" \
  GRAPH_NAMESPACE=default \
  GRAPH_ID=default \
  GRAPH_CELL_ID=cell-0 \
  GRAPH_CELLS=cell-0 \
  GRAPH_NODE_ID=node-0 \
  GRAPH_BOLT_NODE_ADDRESSES="node-0=127.0.0.1:$BOLT_PORT" \
  GRAPH_ADVERTISED_BOLT_ADDR="127.0.0.1:$BOLT_PORT" \
  GRAPH_DATA_CACHE_DIR="$H/cache" \
  GRAPH_AUTH_TOKEN_FILE="$H/auth-token" \
  GRAPH_ALLOW_PLAINTEXT=true \
  RUST_MIN_STACK=33554432 \
  graph-node &
HYDRA_PID=$!

# Liveness after startup is the health check's job, not a watchdog's: /healthz
# opens a Bolt session and fails if the graph node is gone, so an instance whose
# database died is already unhealthy and gets restarted. An earlier version
# supervised it here with `wait` from a background function — which cannot work,
# because that runs in a subshell where the node is not a child. `wait` returned
# 127 instantly, the handler believed the database had crashed, and its `kill 0`
# then took down the whole process group. The database was killed by its own
# watchdog, one second after it started.
echo "── waiting for bolt on 127.0.0.1:$BOLT_PORT"
for i in $(seq 1 90); do
  if node -e "
    const net = require('node:net');
    const s = net.connect($BOLT_PORT, '127.0.0.1');
    s.on('connect', () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
  " 2>/dev/null; then
    echo "   bolt up after ${i}s"
    break
  fi
  # Startup is the one window where a dead node has to be caught here: there is
  # no health check yet, and without this the loop would spend 90s waiting for a
  # port that nothing is listening on any more.
  if ! kill -0 "$HYDRA_PID" 2>/dev/null; then
    echo "!! graph-node exited during startup — its output is above" >&2
    exit 1
  fi
  sleep 1
  if [[ "$i" == "90" ]]; then echo "!! bolt never came up in 90s" >&2; exit 1; fi
done

# The id map goes with the store, always. It records which integer vertex id
# each package key was given, and the loader preserves assignments it finds — so
# a map left over from a previous run hands out ids for packages this fresh
# store has never heard of, and the first scan writes edges to vertices that do
# not exist. Wiping the store without wiping the map is the single most reliable
# way to break this thing.
echo "── loading the committed graph"
rm -f data/idmap.json
node src/load.js || { echo "!! load failed" >&2; exit 1; }

echo "── serving on :${PORT:-8080}"
exec node src/server.js
