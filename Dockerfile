# Recall as a shared node: HydraDB and the scan API in one container.
#
# The two have to live together. The traversal talks Bolt, not HTTP, so the API
# cannot be a serverless function calling a managed database — and a free host
# gives you one process group with one port, not a private network. So the graph
# node listens on loopback inside the container and only the API is exposed.
#
# Base is HydraDB's own published image rather than a Node base with the binary
# copied in: graph-node links libgraphblas and is built against Ubuntu 24.04's
# glibc, and rebuilding that dependency set by hand is how a container works on
# a laptop and dies on a host. Node is copied in from the official image
# instead, which is the smaller and better-defined half of the problem.
FROM node:22-bookworm-slim AS node

FROM ghcr.io/hydra-db/hydradb:latest

# The published image runs as uid 10001 and entrypoints straight into
# graph-node. Build as root, then hand the app back to that uid — and clear the
# entrypoint, or every CMD below arrives as arguments to the database.
USER root

# glibc is backward compatible, so a node built against Debian 12 runs on
# Ubuntu 24.04. npm is a script in node_modules, hence both copies.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && node --version && npm --version

WORKDIR /app

# Dependencies first, so a change to the source does not refetch them.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The crawled graph ships with the repo — 2,270 packages, 4,557 edges and the
# advisory windows — so a cold container is serving real answers ~10s after boot
# instead of after an afternoon of crawling.
COPY data ./data
COPY src ./src
COPY public ./public
COPY scripts/serve.sh ./scripts/serve.sh

ENV RECALL_HOSTED=1 \
    HYDRA_BOLT=bolt://127.0.0.1:7687 \
    HYDRA_TOKEN=container-local-token-32-bytes-min \
    HYDRA_STORE=/tmp/hydradb \
    PORT=8080

# data/ is written at runtime: the loader rewrites the id map, and a scan appends
# whatever advisory history OSV had that the crawl did not.
RUN chown -R 10001:10001 /app
USER 10001:10001

EXPOSE 8080
ENTRYPOINT []
CMD ["./scripts/serve.sh"]
