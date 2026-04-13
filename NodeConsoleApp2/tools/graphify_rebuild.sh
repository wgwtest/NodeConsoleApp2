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
from graphify.extract import extract
from graphify.detect import detect
from graphify.build import build_from_json
from graphify.cluster import cluster, score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from graphify.export import to_json, to_html
from graphify.wiki import to_wiki

root = Path(".")
out = root / "graphify-out"
out.mkdir(exist_ok=True)

detected = detect(root)
code_files = [Path(f) for f in detected["files"]["code"]]
if not code_files:
    print("[graphify rebuild] No code files found - nothing to rebuild.")
    raise SystemExit(1)

result = extract(code_files)
G = build_from_json(result)
communities = cluster(G)
cohesion = score_all(G, communities)
gods = god_nodes(G)
surprises = surprising_connections(G, communities)
labels = {cid: f"Community {cid}" for cid in communities}
questions = suggest_questions(G, communities, labels)

report = generate(
    G,
    communities,
    cohesion,
    labels,
    gods,
    surprises,
    {
        "files": {
            "code": [str(f) for f in code_files],
            "document": [],
            "paper": [],
            "image": [],
        },
        "total_files": len(code_files),
        "total_words": detected.get("total_words", 0),
    },
    {"input": 0, "output": 0},
    str(root),
    suggested_questions=questions,
)

(out / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
to_json(G, communities, str(out / "graph.json"))
to_html(G, communities, str(out / "graph.html"), community_labels=labels)
wiki_count = to_wiki(
    G,
    communities,
    out / "wiki",
    community_labels=labels,
    cohesion=cohesion,
    god_nodes_data=gods,
)

flag = out / "needs_update"
if flag.exists():
    flag.unlink()

print(
    f"[graphify rebuild] Rebuilt: {G.number_of_nodes()} nodes, "
    f"{G.number_of_edges()} edges, {len(communities)} communities"
)
print("[graphify rebuild] graph.json, graph.html and GRAPH_REPORT.md updated in graphify-out")
print(f"[graphify rebuild] wiki articles updated in graphify-out/wiki ({wiki_count} articles)")
PY
