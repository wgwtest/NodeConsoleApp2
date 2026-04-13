#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${GRAPHIFY_ROOT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENSURE_SCRIPT="${GRAPHIFY_ENSURE_SCRIPT:-$SCRIPT_DIR/graphify_ensure_fresh.sh}"
GRAPH_PATH="$ROOT_DIR/graphify-out/graph.html"
HTTP_PORTS="${GRAPHIFY_HTTP_PORTS:-3101 3000}"
LAUNCH=0

usage() {
  cat <<'EOF' >&2
Usage: graphify_open.sh [--launch]
  --launch  Open the resolved graph entry in the desktop browser when possible.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --launch)
      LAUNCH=1
      ;;
    *)
      usage
      exit 1
      ;;
  esac
  shift
done

if [ ! -x "$ENSURE_SCRIPT" ]; then
  echo "Graphify ensure script not found: $ENSURE_SCRIPT" >&2
  exit 1
fi

"$ENSURE_SCRIPT" --quiet

if [ ! -f "$GRAPH_PATH" ]; then
  echo "Graphify page not found: $GRAPH_PATH" >&2
  exit 1
fi

resolved_entry="$GRAPH_PATH"
if command -v curl >/dev/null 2>&1; then
  for port in $HTTP_PORTS; do
    candidate="http://127.0.0.1:${port}/graphify-out/graph.html"
    if curl -fsI --max-time 2 "$candidate" >/dev/null 2>&1; then
      resolved_entry="$candidate"
      break
    fi
  done
fi

printf '%s\n' "$resolved_entry"

if [ "$LAUNCH" -eq 1 ] && command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$resolved_entry" >/dev/null 2>&1 &
fi
