#!/usr/bin/env bash
#
# Build the whole public site into site-next/out/:
#
#   /       the landing page (Next.js, static export)
#   /app/   the working tool, showing a recorded scan
#
# Needs a HydraDB node up (scripts/hydradb.sh) because both datasets are
# measured against a live traversal rather than written by hand.
#
#   scripts/build-site.sh [<lockfile-or-dir-for-/app>] [--source <url>]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"
shift || true

if [[ -n "$TARGET" ]]; then
  echo "── recording the /app scan"
  node src/build-demo.js "$TARGET" --dev "$@"
elif [[ ! -f dist/demo.json ]]; then
  echo "no dist/demo.json and no target given — pass a lock file or directory" >&2
  exit 1
else
  echo "── reusing existing dist/demo.json for /app"
fi

echo "── measuring the landing page dataset"
node src/build-site.js

echo "── building the landing page"
cd site-next
npx next build
cd "$ROOT"

OUT="site-next/out"
[[ -d "$OUT" ]] || { echo "next build produced no $OUT" >&2; exit 1; }

echo "── folding in the tool at /app"
mkdir -p "$OUT/app"
# The tool reads its recorded scan from the site root.
sed 's#</head>#<script>window.RECALL_DEMO = "../demo.json";</script>\n</head>#' \
  public/index.html > "$OUT/app/index.html"
cp dist/demo.json "$OUT/demo.json"

echo
echo "built $OUT"
du -sh "$OUT"
find "$OUT" -maxdepth 2 -name '*.html' -o -maxdepth 2 -name '*.json' | sed 's/^/  /'
