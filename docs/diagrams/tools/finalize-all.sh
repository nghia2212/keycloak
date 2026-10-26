#!/usr/bin/env bash
# Renders and verifies every diagram under docs/diagrams with Archify, re-links the module tree
# and rebuilds README.md. Run from the repository root:
#
#   ARCHIFY=/path/to/archify/bin/archify.mjs docs/diagrams/tools/finalize-all.sh
set -u
: "${ARCHIFY:?set ARCHIFY to the archify.mjs CLI path}"
cd "$(git rev-parse --show-toplevel)"
root=docs/diagrams
failed=0
for json in $(find "$root" -path "$root/.receipts" -prune -o -name '*.json' -print | grep -E '\.(architecture|tree|class)\.json$' | sort); do
  type=$(basename "$json" .json); type=${type##*.}
  html=${json%.json}.html
  receipts=$root/.receipts/$(dirname "${json#$root/}" | tr / -)-$(basename "$json" .json)
  if node "$ARCHIFY" finalize "$type" "$json" "$html" --repo-root . --quality showcase --out-dir "$receipts" --json >/dev/null 2>&1; then
    echo "pass  $json"
  else
    echo "FAIL  $json (see $receipts)"; failed=1
  fi
done
node "$root/tools/link-diagrams.mjs"
node "$root/tools/build-index.mjs"
exit $failed
