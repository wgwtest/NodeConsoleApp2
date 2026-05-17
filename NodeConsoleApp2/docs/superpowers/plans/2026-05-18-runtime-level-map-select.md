# Runtime Level Map Select Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the simplified chapter progress block in the story level select modal with the production map pack and node design from the level map editor.

**Architecture:** DataManager loads the level map pack as a content pack, normalizes it into a runtime level select map model, and maps save progress from `levelId` onto map `nodeId`s. A reusable runtime map view renders the selected map inside `UI_SystemModal` and delegates node clicks to `engine.input.selectLevel(levelId)`.

**Tech Stack:** Browser ES modules, vanilla DOM, Node test runner, JSDOM, existing CSS in `mock_ui_v11.css`.

---

### Task 1: Runtime Map Model

**Files:**
- Modify: `assets/data/config.json`
- Modify: `script/engine/DataManagerV2.js`
- Test: `test/level_select_map_runtime.test.mjs`

- [ ] **Step 1: Write the failing test**

Create a test that imports `DataManagerV2.js`, injects `gameConfig.levelMapPack`, story levels, and progress, then asserts `getLevelSelectMapModel()` returns one active map with background refs, nodes, edges, a recommended node, and `completed/recommended/locked` statuses.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/level_select_map_runtime.test.mjs`
Expected: FAIL because `getLevelSelectMapModel()` does not exist.

- [ ] **Step 3: Implement minimal runtime model**

Add `levelMapPack` to the data registry, validation, load pipeline, content pack meta, and `gameConfig`. Add normalization helpers and `getLevelSelectMapModel()` that derives status from the existing story select model.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/level_select_map_runtime.test.mjs`
Expected: PASS.

### Task 2: Runtime Map View

**Files:**
- Create: `script/ui/LevelSelectMapView.js`
- Modify: `script/ui/UI_SystemModal.js`
- Modify: `mock_ui_v11.css`
- Test: `test/level_select_map_view.test.mjs`
- Test: `test/d1_information_priority.test.mjs`
- Test: `test/c_growth_ui_regression.test.mjs`

- [ ] **Step 1: Write failing view/UI tests**

Assert the runtime view renders background, SVG edges, map node buttons, selected/recommended status, and calls the click callback with `{ levelId, nodeId, mapId }`. Assert `UI_SystemModal` asks data for `getLevelSelectMapModel()` and places a `.level-select-runtime-map` next to the list.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/level_select_map_view.test.mjs test/d1_information_priority.test.mjs test/c_growth_ui_regression.test.mjs`
Expected: FAIL because the view file and modal integration do not exist.

- [ ] **Step 3: Implement runtime view and modal integration**

Implement projection/rendering based on the existing preview page behavior, but omit editor-only preview mode controls, pack JSON output, and explanatory copy. Wire unlocked/recommended/completed node clicks to `selectLevel(levelId)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/level_select_map_view.test.mjs test/d1_information_priority.test.mjs test/c_growth_ui_regression.test.mjs`
Expected: PASS.

### Task 3: 1920x1080 Acceptance

**Files:**
- Modify only if verification exposes layout defects.

- [ ] **Step 1: Run targeted automated tests**

Run: `npm run test`
Run: `node --test test/level_select_map_runtime.test.mjs test/level_select_map_view.test.mjs`

- [ ] **Step 2: Run click smoke**

Run: `npm run test:acceptance-clicks`

- [ ] **Step 3: Start server and capture 1920x1080 screenshots**

Run: `PORT=3101 node app.js`
Open `http://127.0.0.1:3101/mock_ui_v11.html`, navigate to story level select, and capture a 1920x1080 screenshot. Inspect for text overlap, cramped map, missing assets, broken node click behavior, and modal overflow.

- [ ] **Step 4: Commit and push**

Stage only files owned by this feature and push to `origin/master`. Leave unrelated dirty files untouched.
