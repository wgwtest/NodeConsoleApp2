#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 \"question\" [graphify query options...]" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRAPHIFY_VENV="${GRAPHIFY_VENV:-$HOME/.local/share/graphify-venv}"
GRAPHIFY_BIN="${GRAPHIFY_BIN:-$GRAPHIFY_VENV/bin/graphify}"

if [ ! -x "$GRAPHIFY_BIN" ]; then
  echo "Graphify CLI not found: $GRAPHIFY_BIN" >&2
  echo "Install graphifyy into a venv first, or set GRAPHIFY_BIN / GRAPHIFY_VENV." >&2
  exit 1
fi

cd "$ROOT_DIR"
"$GRAPHIFY_BIN" query "$@"
