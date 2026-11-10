#!/bin/bash
# play.sh — Local playability check (per-keystroke speed).
#
# Mirrors what the judge runs against your fork on the public
# leaderboard. Drives moveloop_core() one key at a time — the exact
# code path the browser play page uses — and prints whether your
# implementation hits the "playable" threshold (< 5 ms/move overall).
# One-time game startup is reported separately from interactive key latency.
#
# Usage: bash play.sh [session_dir]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSIONS_DIR="${1:-$PROJECT_ROOT/sessions}"

cd "$PROJECT_ROOT"
exec node "$SCRIPT_DIR/playability_runner.mjs" "$SESSIONS_DIR"
