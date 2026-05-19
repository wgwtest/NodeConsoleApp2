# Level Select Map Visual Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Address user feedback on the runtime level select map: zoom must enlarge the map image and nodes together, the right drawer must show richer selected-level details, and map nodes must use a more cohesive marker treatment.

**Architecture:** Keep the existing `LevelSelectMapView` boundary. Move the map image layers from the fixed stage onto the transformed surface so background, edges, and nodes share one pan/zoom coordinate space. Extend the drawer markup with structured selected-node metadata and replace the pin-plus-caption node composition with a compact map-plate marker.

**Tech Stack:** Browser ES modules, vanilla DOM, Node test runner, JSDOM, existing `mock_ui_v11.css`, CDP screenshot smoke.

---

### Task 1: Behavioral Tests

**Files:**
- Modify: `test/level_select_map_view.test.mjs`

- [x] **Step 1: Write failing assertions**

Add assertions that:
- `.level-select-runtime-map__surface` owns the background image and `stage` no longer owns the image.
- Zoom controls update the transformed surface while keeping background on the same element.
- The drawer contains a meta grid, unlock hint, level description, and reward list for the selected node.
- Nodes render `.level-map-node__plate` and do not render the old `.level-map-node__pin` or `.level-map-node__caption`.

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_select_map_view.test.mjs
```

Observed: FAIL because the current view still rendered old pin/caption node markup. Runtime model test also failed until `unlockHint` was passed into map nodes.

### Task 2: Runtime View

**Files:**
- Modify: `script/ui/LevelSelectMapView.js`

- [x] **Step 1: Move background to the transformed surface**

Apply map image layers to `.level-select-runtime-map__surface`, not the stage. Keep `stage` as the clipped viewport frame and keep the surface dimensions tied to the map metrics.

- [x] **Step 2: Expand the selected-level drawer**

Use existing runtime node fields: `label`, `statusLabel`, `levelId`, `levelDescription`, `objectiveText`, `difficultyLabel`, `rewardPreview`, and `selectLevelId`. Render them as structured rows and sections.

- [x] **Step 3: Replace node markup**

Render nodes as a single plate marker with an embedded art badge and text. Remove old pin/caption markup.

- [x] **Step 4: Run view test**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_select_map_view.test.mjs
```

Observed: PASS.

### Task 3: CSS And Screenshot Smoke

**Files:**
- Modify: `mock_ui_v11.css`
- Modify: `tools/level_select_map_screenshot_check.mjs`

- [x] **Step 1: Restyle map surface and nodes**

Ensure the surface paints the map image, fills the stage, and uses a cohesive plate marker style. Keep selected/recommended/completed/locked states visually distinct.

- [x] **Step 2: Update screenshot smoke assertions**

Read background image from `.level-select-runtime-map__surface`, assert the drawer has the richer sections, and assert old pin markup is absent.

- [x] **Step 3: Run targeted tests**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_select_map_runtime.test.mjs test/level_select_map_view.test.mjs test/d1_information_priority.test.mjs test/c_growth_ui_regression.test.mjs
```

Observed: PASS.

### Task 4: Visual Verification

**Files:**
- Modify only if screenshot exposes layout defects.

- [x] **Step 1: Start server and CDP Chrome**

Run:

```bash
cd NodeConsoleApp2
PORT=3121 node app.js
google-chrome-stable --headless=new --remote-debugging-port=9223 --disable-gpu --no-sandbox --user-data-dir=/tmp/nodeconsoleapp2-map-feedback-cdp about:blank
```

- [x] **Step 2: Capture 1920x1080 screenshot**

Run:

```bash
cd NodeConsoleApp2
ACCEPTANCE_MAIN_URL=http://127.0.0.1:3121/mock_ui_v11.html OUTPUT_PATH=test-results/level-select-map-1920x1080.png node tools/level_select_map_screenshot_check.mjs
```

Observed: PASS and refreshed `test-results/level-select-map-1920x1080.png`.

- [x] **Step 3: Inspect screenshot**

Open `test-results/level-select-map-1920x1080.png` and confirm:
- Zoom controls are attached to a map that can pan/zoom as one surface.
- Right drawer has meaningful information density.
- Node markers read as one integrated map element rather than round icon plus separate bubble.

Observed: The screenshot no longer exposes dark unpainted map regions after the post-layout surface refresh; status remains `待人工验收`.
