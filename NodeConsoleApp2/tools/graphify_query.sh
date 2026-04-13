#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 \"question\" [graphify query options...]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${GRAPHIFY_ROOT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
GRAPHIFY_VENV="${GRAPHIFY_VENV:-$HOME/.local/share/graphify-venv}"
GRAPHIFY_BIN="${GRAPHIFY_BIN:-$GRAPHIFY_VENV/bin/graphify}"
ENSURE_SCRIPT="${GRAPHIFY_ENSURE_SCRIPT:-$SCRIPT_DIR/graphify_ensure_fresh.sh}"

if [ ! -x "$GRAPHIFY_BIN" ]; then
  echo "Graphify CLI not found: $GRAPHIFY_BIN" >&2
  echo "Install graphifyy into a venv first, or set GRAPHIFY_BIN / GRAPHIFY_VENV." >&2
  exit 1
fi

if [ ! -x "$ENSURE_SCRIPT" ]; then
  echo "Graphify ensure script not found: $ENSURE_SCRIPT" >&2
  exit 1
fi

"$ENSURE_SCRIPT" --quiet

cd "$ROOT_DIR"
"$GRAPHIFY_BIN" query "$@"
