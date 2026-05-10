#!/bin/bash
# score.sh — Run PS (PRNG + Screen) scoring against public sessions.
# Usage: bash score.sh [session_dir]
#
# This is the contest scoring script. It compares your JS implementation
# against recorded C sessions, checking:
#   P (PRNG): Every RNG call must match C's sequence exactly
#   S (Screen): Terminal output at each input boundary must match
#
# Results are printed to stderr (human-readable) and stdout (JSON).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSIONS_DIR="${1:-$PROJECT_ROOT/sessions}"

METADATA_PATH="$PROJECT_ROOT/.teleport/repo-metadata.json"
METADATA_REL=".teleport/repo-metadata.json"
TEMPLATE_METADATA='{ "category": "none" }'

if [[ ! -f "$METADATA_PATH" ]]; then
  echo "Error: missing $METADATA_REL." >&2
  echo "This shouldn't happen! Please restore it from the template repo state, maybe with git." >&2
  exit 2
fi

if [[ "$(cat "$METADATA_PATH")" == "$TEMPLATE_METADATA" ]]; then
  echo "You need to set your repository's category before you can score!" >&2
  echo "You can do it by calling ./frozen/set-category.sh <CATEGORY>." >&2
  echo "See the README for a description of categories. Aborting..." >&2
  exit 2
fi

# Overlay frozen infrastructure files. Three pieces of the contest
# fixture are judge-owned:
#   ISAAC64 (canonical PRNG sequence — has to be bit-exact across all
#       contestants for the recorded RNG trace to align),
#   Terminal (24x80 grid + serialize() — defines the canonical
#       byte-stream the judge reads back as the "screen"),
#   storage  (the VFS contract that makes save/restore + bones
#       persist across segments in a multi-segment session, both in
#       the browser via localStorage and in the Node sandbox via
#       InMemoryStorage). Freezing storage means every contestant
#       gets the same well-defined isolation: state survives across
#       segments within a session, resets between sessions.
# Everything else — const.js, display.js, game_display.js, and the
# rest of js/ — is contestant-owned.
cp "$SCRIPT_DIR/isaac64.js" "$PROJECT_ROOT/js/isaac64.js" 2>/dev/null || true
cp "$SCRIPT_DIR/terminal.js" "$PROJECT_ROOT/js/terminal.js" 2>/dev/null || true
cp "$SCRIPT_DIR/storage.js"  "$PROJECT_ROOT/js/storage.js"  2>/dev/null || true

exec node "$SCRIPT_DIR/ps_test_runner.mjs" "$SESSIONS_DIR"
