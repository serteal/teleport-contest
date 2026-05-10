#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
METADATA_PATH="$PROJECT_ROOT/.teleport/repo-metadata.json"

usage() {
  cat >&2 <<'EOF'
Usage: bash frozen/set-category.sh <category>

Sets the participant category for this repo by writing to:
  .teleport/repo-metadata.json

Expected categories (see README for a description):
  agentic
  transpiled
  other
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 2
fi

category="$1"
case "$category" in
  agentic|transpiled|other) ;;
  *)
    echo "Error: unexpected category: $category" >&2
    usage
    exit 2
    ;;
esac

mkdir -p "$PROJECT_ROOT/.teleport"
printf '{ "category": "%s" }\n' "$category" >"$METADATA_PATH"

echo "Wrote $METADATA_PATH (category: $category)" >&2
