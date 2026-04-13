#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${GRAPHIFY_ROOT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
OUT_DIR="$ROOT_DIR/graphify-out"
ARTIFACT_PATH="$OUT_DIR/graph.json"
FLAG_PATH="$OUT_DIR/needs_update"
REBUILD_SCRIPT="${GRAPHIFY_REBUILD_SCRIPT:-$SCRIPT_DIR/graphify_rebuild.sh}"

STATUS_ONLY=0
QUIET=0

usage() {
  cat <<'EOF' >&2
Usage: graphify_ensure_fresh.sh [--status-only] [--quiet]
  --status-only  Only report fresh/stale and update the marker file.
  --quiet        Suppress fresh/stale status lines; rebuild output is preserved.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --status-only)
      STATUS_ONLY=1
      ;;
    --quiet)
      QUIET=1
      ;;
    *)
      usage
      exit 1
      ;;
  esac
  shift
done

mkdir -p "$OUT_DIR"

say() {
  if [ "$QUIET" -eq 0 ]; then
    printf '%s\n' "$1"
  fi
}

mark_stale() {
  local reason="$1"
  printf '%s\n' "$reason" > "$FLAG_PATH"
  say "stale"
}

clear_stale_flag() {
  if [ -f "$FLAG_PATH" ]; then
    rm -f "$FLAG_PATH"
  fi
}

find_newer_source() {
  find "$ROOT_DIR" \
    \( \
      -path "$OUT_DIR" -o \
      -path "$ROOT_DIR/.git" -o \
      -path "$ROOT_DIR/node_modules" -o \
      -path "$ROOT_DIR/.venv" -o \
      -path "$ROOT_DIR/venv" \
    \) -prune -o \
    -type f \
    \( \
      -name '*.js' -o \
      -name '*.mjs' -o \
      -name '*.cjs' -o \
      -name '*.json' -o \
      -name '*.html' -o \
      -name '*.css' -o \
      -name '*.py' -o \
      -name '*.sh' -o \
      -name '.graphifyignore' \
    \) \
    -newer "$ARTIFACT_PATH" \
    -print -quit
}

stale_reason=""

if [ ! -f "$ARTIFACT_PATH" ]; then
  stale_reason="missing graph artifact: graphify-out/graph.json"
else
  newer_source="$(find_newer_source || true)"
  if [ -n "$newer_source" ]; then
    stale_reason="newer source detected: ${newer_source#$ROOT_DIR/}"
  fi
fi

if [ -n "$stale_reason" ]; then
  mark_stale "$stale_reason"
  if [ "$STATUS_ONLY" -eq 1 ]; then
    exit 0
  fi

  if [ ! -x "$REBUILD_SCRIPT" ]; then
    echo "Graphify rebuild script not found: $REBUILD_SCRIPT" >&2
    exit 1
  fi

  "$REBUILD_SCRIPT"
  say "fresh"
  exit 0
fi

clear_stale_flag
say "fresh"
