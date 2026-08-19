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
BOLT_PORT=7687
TOKEN="${HYDRA_TOKEN:-container-local-token-32-bytes-min}"

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

# Exit if the graph node dies at any point. A container that keeps serving HTTP
# with a dead database behind it is worse than one the platform restarts.
watch_hydra() {
  wait "$HYDRA_PID"
  echo "!! graph-node exited ($?) — bringing the container down" >&2
  kill 0
}
watch_hydra &

echo "── waiting for bolt on 127.0.0.1:$BOLT_PORT"
for i in $(seq 1 60); do
  if node -e "
    const net = require('node:net');
    const s = net.connect($BOLT_PORT, '127.0.0.1');
    s.on('connect', () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
  " 2>/dev/null; then
    echo "   bolt up after ${i}s"
    break
  fi
  sleep 1
  if [[ "$i" == "60" ]]; then echo "!! bolt never came up" >&2; exit 1; fi
done

echo "── loading the committed graph"
node src/load.js || { echo "!! load failed" >&2; exit 1; }

echo "── serving on :${PORT:-8080}"
exec node src/server.js
