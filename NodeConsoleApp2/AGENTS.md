## graphify

This project can generate a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure when the graph exists
- If graphify-out/ may be missing or stale, run `./tools/graphify_ensure_fresh.sh`
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- If you need a browser-viewable map, prefer `./tools/graphify_open.sh`
- Prefer `./tools/graphify_query.sh "<question>"` for local graph queries when you need a fast structural overview
