#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRAPHIFY_VENV="${GRAPHIFY_VENV:-$HOME/.local/share/graphify-venv}"
GRAPHIFY_PYTHON="${GRAPHIFY_PYTHON:-$GRAPHIFY_VENV/bin/python}"

if [ ! -x "$GRAPHIFY_PYTHON" ]; then
  echo "Graphify python not found: $GRAPHIFY_PYTHON" >&2
  echo "Install graphifyy into a venv first, or set GRAPHIFY_PYTHON / GRAPHIFY_VENV." >&2
  exit 1
fi

cd "$ROOT_DIR"
"$GRAPHIFY_PYTHON" - <<'PY'
from pathlib import Path
from graphify.watch import _rebuild_code

raise SystemExit(0 if _rebuild_code(Path('.')) else 1)
PY
