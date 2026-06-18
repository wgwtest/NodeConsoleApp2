# Enemy Decision Graph Editor Implementation Plan

> Current execution note: this plan uses a hard switch. There is no downward-compatible behavior model and no migration from retired behavior fields.

**Goal:** Replace the enemy editor's retired behavior pages with an enemy decision graph editor that saves `enemyDecision`, supports templates, validates graphs, previews decision paths, and publishes packs without retired behavior fields.

**Architecture:** Add a focused `script/editor/enemy/decision/` module family for graph data, validation, preview, template handling, and DOM rendering. `EnemyWorkspace` owns normalization, hard removal of retired behavior fields on export, and template metadata preservation. `EnemyEditorPage` integrates the new module and publishes `enemyDecision` packs. `EnemyActionPlanner` consumes `enemyDecision.graph` directly.

**Tech Stack:** Vanilla ES modules, DOM APIs, Node `node:test`, existing fake DOM test harness, existing local editor HTML.

## Task 1: Decision Graph Model, Validation, Preview

Files:

1. `NodeConsoleApp2/script/editor/enemy/decision/EnemyDecisionGraphModel.js`
2. `NodeConsoleApp2/test/enemy_decision_graph_model.test.mjs`

Required behavior:

1. `normalizeEnemyDecision()` returns existing `enemy.enemyDecision` when present.
2. If `enemyDecision` is missing, it creates a conservative default graph from `enemy.skills[]`.
3. It does not read retired behavior fields.
4. It does not create retired behavior fields.
5. `validateEnemyDecision()` checks entry, initial state, duplicate ids, broken edges, branch exits, action skill binding, skill ownership, and single-turn loop risk.
6. `previewEnemyDecision()` walks the graph for N turns with a max node visit guard and returns trace objects.

Verification:

```powershell
node --test test/enemy_decision_graph_model.test.mjs
```

## Task 2: Workspace Integration and Hard Field Removal

Files:

1. `NodeConsoleApp2/script/editor/enemy/EnemyWorkspace.js`
2. `NodeConsoleApp2/test/enemy_editor_page.test.mjs`
3. `NodeConsoleApp2/test/enemy_v2_candidate_pack.test.mjs`
4. `NodeConsoleApp2/test/enemy_v2_candidate_runtime_parse.test.mjs`

Required behavior:

1. `normalizeEnemy()` writes `enemyDecision`.
2. Exported enemies do not contain retired behavior fields.
3. Enemy packs preserve `decisionGraphTemplates`.
4. Validation includes graph issues.
5. Pack tests assert every current enemy has `enemyDecision.schemaVersion === "enemy_decision_graph_v1"`.

Verification:

```powershell
node --test test/enemy_editor_page.test.mjs test/enemy_v2_candidate_pack.test.mjs test/enemy_v2_candidate_runtime_parse.test.mjs
```

## Task 3: Editor UI Module and HTML Replacement

Files:

1. `NodeConsoleApp2/script/editor/enemy/decision/EnemyDecisionGraphEditor.js`
2. `NodeConsoleApp2/script/editor/enemy/decision/enemyDecisionGraph.css`
3. `NodeConsoleApp2/script/editor/enemy/EnemyEditorPage.js`
4. `NodeConsoleApp2/test/enemy_editor_v1.html`
5. `NodeConsoleApp2/test/enemy_editor_page.test.mjs`

Required behavior:

1. The editor exposes an `enemyDecision` tab.
2. The old behavior tabs are absent.
3. The graph editor renders templates, current enemy skills, graph canvas, inspector, issues, and preview trace.
4. Authoring drafts and runtime packs save `enemyDecision`.
5. Runtime publish writes `assets/enemy_packs/current/enemies.json`.

Verification:

```powershell
node --test test/enemy_editor_page.test.mjs
```

## Task 4: Runtime Planner

Files:

1. `NodeConsoleApp2/script/engine/EnemyActionPlanner.js`
2. `NodeConsoleApp2/test/enemy_decision_graph_planner.test.mjs`

Required behavior:

1. Planner traverses `enemyDecision.graph`.
2. Branches support the condition types declared by the editor.
3. Action nodes resolve skill bindings and target rules.
4. Illegal graph-selected actions fall back to existing scoring.
5. Retired behavior fields are ignored.

Verification:

```powershell
node --test test/enemy_decision_graph_planner.test.mjs
```

## Task 5: Pack, Docs, and Regression

Files:

1. `NodeConsoleApp2/assets/enemy_packs/current/enemies.json`
2. `NodeConsoleApp2/assets/enemy_packs/authoring/enemies_20260531_000000.json`
3. `NodeConsoleApp2/test/enemy_editor_contract_prototype.html`
4. `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
5. `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/28-敌人编辑器(enemy_editor)-设计说明.md`
6. `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/29-敌人决策蓝图编辑器(enemy_decision_graph_editor)-补充设计说明.md`

Required behavior:

1. Current and authoring enemy packs contain `enemyDecision`.
2. Current and authoring enemy packs do not contain retired behavior fields.
3. Docs describe `enemyDecision` as the only behavior authoring model.
4. Docs state there is no downward-compatible behavior model.

Focused verification:

```powershell
node --test test/enemy_decision_graph_model.test.mjs test/enemy_decision_graph_planner.test.mjs test/enemy_editor_page.test.mjs test/enemy_v2_candidate_pack.test.mjs test/enemy_v2_candidate_runtime_parse.test.mjs
```

Full regression:

```powershell
npm test
```

HTTP page checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:64734/test/enemy_editor_v1.html
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:64734/mock_ui_v11.html
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:64734/test/skill_tester.html
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:64734/test/level_editor_v1.html
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:64734/test/level_map_editor_v1.html
```

## Done Definition

1. Focused tests pass.
2. Full regression passes or any unrelated failure is documented.
3. Main local pages return HTTP 200.
4. Enemy editor visually opens with the graph editor tab.
5. Git diff contains no runtime/editor consumer for retired behavior fields.
