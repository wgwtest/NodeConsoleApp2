# Node Derived Level Detail Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new node-derived level detail editor that follows the approved prototype and does not reuse the old level editor page model.

**Architecture:** Add a pure `LevelDetailWorkspace` for map-node-to-level-detail data operations, then add `LevelDetailEditorPage` for UI orchestration. The page loads the authoring map package, `levels.json`, and `enemies.json`, renders story/chapter/map/node navigation, edits the selected node's level detail, and exposes save/publish paths as package-level operations.

**Tech Stack:** Vanilla HTML/CSS/ES modules, Node built-in test runner, jsdom-style page tests where existing project patterns support them.

---

### Task 1: LevelDetailWorkspace Data Core

**Files:**
- Create: `NodeConsoleApp2/script/editor/level/LevelDetailWorkspace.js`
- Create: `NodeConsoleApp2/test/level_detail_workspace.test.mjs`
- Modify: `NodeConsoleApp2/script/editor/level/index.js`

- [ ] **Step 1: Write the failing workspace tests**

Create `NodeConsoleApp2/test/level_detail_workspace.test.mjs` with tests covering:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const repoRoot = path.resolve(import.meta.dirname, '..');
const workspaceModulePath = path.join(repoRoot, 'script', 'editor', 'level', 'LevelDetailWorkspace.js');

function buildMapDoc() {
    return {
        $schemaVersion: 'level_map_pack_v1',
        meta: { id: 'story_pack_v1', title: '测试故事包' },
        stories: [{ id: 'story_default', title: '测试故事', entryChapterId: 'chapter_1', chapterIds: ['chapter_1'] }],
        chapters: [{ id: 'chapter_1', storyId: 'story_default', title: '幽暗森林', order: 1, entryMapId: 'map_1', mapIds: ['map_1'] }],
        assetLibrary: {
            backgrounds: [{ id: 'bg_map_forest', label: '地图背景', src: 'assets/bg-map.svg' }],
            battleBackgrounds: [{ id: 'bg_forest_01', label: '森林战斗', src: 'assets/bg-battle.svg' }]
        },
        maps: [{
            id: 'map_1',
            name: '林冠伏击线',
            chapterId: 'chapter_1',
            backgroundRef: 'bg_map_forest',
            entryNodeId: 'node_1',
            nodes: [
                { id: 'node_1', levelId: 'level_1_1', label: '1-1', title: '森林边缘', kind: 'battle', position: { x: 100, y: 200 } },
                { id: 'node_2', levelId: '', label: '1-2', title: '林冠伏击', kind: 'battle', position: { x: 320, y: 240 } }
            ],
            edges: [{ id: 'edge_1', fromNodeId: 'node_1', toNodeId: 'node_2', type: 'main', branchLabel: '推进' }]
        }]
    };
}

function buildLevelsDoc() {
    return {
        $schemaVersion: 'levels_v1_wrapped',
        meta: {
            enums: {
                backgrounds: ['bg_forest_01'],
                slotLayoutIds: ['default_v1'],
                waveTypes: ['fixed']
            }
        },
        enemyPools: {
            pool_level_1_1_primary: {
                id: 'pool_level_1_1_primary',
                name: '森林边缘敌人',
                members: [{ templateId: 'goblin_story_headhunter', position: 1 }]
            }
        },
        levels: {
            level_1_1: {
                id: 'level_1_1',
                name: '森林边缘',
                description: '入口战斗。',
                flow: { kind: 'story', order: 1, chapterId: 'chapter_1', nodeLabel: '1-1', objectiveText: '进入森林' },
                selectionMeta: { difficultyLabel: '标准', buildHint: '稳住节奏' },
                background: 'bg_forest_01',
                battleRules: { slotLayoutId: 'default_v1', victoryCondition: { type: 'defeat_all_enemies' }, failureCondition: { type: 'player_hp_zero' } },
                waves: [{ waveId: 'wave_1', waveType: 'fixed', enemyPoolId: 'pool_level_1_1_primary' }],
                rewards: { exp: 100, gold: 50, kp: 1 }
            }
        }
    };
}

async function importWorkspaceModule() {
    assert.equal(fs.existsSync(workspaceModulePath), true, 'LevelDetailWorkspace.js should exist');
    const source = await fsp.readFile(workspaceModulePath, 'utf8');
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

test('LevelDetailWorkspace lists node level summaries in story/chapter/map order', async () => {
    const { LevelDetailWorkspace } = await importWorkspaceModule();
    const workspace = new LevelDetailWorkspace({
        mapDocument: buildMapDoc(),
        levelsDocument: buildLevelsDoc(),
        enemiesDocument: { goblin_story_headhunter: { id: 'goblin_story_headhunter', name: '追猎手' } }
    });

    const summaries = workspace.listNodeLevelSummaries({ mapId: 'map_1' });
    assert.deepEqual(summaries.map(item => item.nodeId), ['node_1', 'node_2']);
    assert.equal(summaries[0].levelId, 'level_1_1');
    assert.equal(summaries[0].hasLevelDetail, true);
    assert.equal(summaries[1].hasLevelDetail, false);
});

test('ensureLevelForNode creates a level detail and binds the map node', async () => {
    const { LevelDetailWorkspace } = await importWorkspaceModule();
    const workspace = new LevelDetailWorkspace({
        mapDocument: buildMapDoc(),
        levelsDocument: buildLevelsDoc(),
        enemiesDocument: {}
    });

    const level = workspace.ensureLevelForNode({ mapId: 'map_1', nodeId: 'node_2' });
    assert.equal(level.id, 'level_map_1_node_2');
    assert.equal(level.name, '林冠伏击');
    assert.equal(level.flow.chapterId, 'chapter_1');
    assert.equal(level.flow.nodeLabel, '1-2');
    assert.equal(workspace.getNode('map_1', 'node_2').levelId, 'level_map_1_node_2');
    assert.equal(workspace.getPrimaryEnemy(level.id).templateId, '');
});

test('setPrimaryEnemy stores single-enemy intent and exports runtime-compatible wave projection', async () => {
    const { LevelDetailWorkspace } = await importWorkspaceModule();
    const workspace = new LevelDetailWorkspace({
        mapDocument: buildMapDoc(),
        levelsDocument: buildLevelsDoc(),
        enemiesDocument: { skeleton_guard: { id: 'skeleton_guard', name: '骷髅守卫' } }
    });

    const level = workspace.ensureLevelForNode({ mapId: 'map_1', nodeId: 'node_2' });
    workspace.setPrimaryEnemy(level.id, 'skeleton_guard');

    assert.equal(workspace.getPrimaryEnemy(level.id).templateId, 'skeleton_guard');
    const exported = workspace.exportRuntimeLevelsDocument();
    const poolId = exported.levels[level.id].waves[0].enemyPoolId;
    assert.equal(exported.enemyPools[poolId].members.length, 1);
    assert.equal(exported.enemyPools[poolId].members[0].templateId, 'skeleton_guard');
});

test('validatePackage reports missing enemy and background while keeping current node path', async () => {
    const { LevelDetailWorkspace } = await importWorkspaceModule();
    const workspace = new LevelDetailWorkspace({
        mapDocument: buildMapDoc(),
        levelsDocument: buildLevelsDoc(),
        enemiesDocument: {}
    });

    const level = workspace.ensureLevelForNode({ mapId: 'map_1', nodeId: 'node_2' });
    workspace.setBattleBackground(level.id, 'missing_background');
    workspace.setPrimaryEnemy(level.id, 'missing_enemy');

    const issues = workspace.validatePackage();
    assert.equal(issues.some(issue => issue.code === 'missing_enemy_template' && issue.nodeId === 'node_2'), true);
    assert.equal(issues.some(issue => issue.code === 'missing_battle_background' && issue.levelId === level.id), true);
});
```

- [ ] **Step 2: Run the new tests and verify RED**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_detail_workspace.test.mjs
```

Expected: FAIL because `LevelDetailWorkspace.js` does not exist.

- [ ] **Step 3: Implement `LevelDetailWorkspace`**

Implement a pure data class with:

```js
export class LevelDetailWorkspace {
  constructor({ mapDocument, levelsDocument, enemiesDocument })
  listNodeLevelSummaries({ storyId, chapterId, mapId } = {})
  getNode(mapId, nodeId)
  getLevelForNode({ mapId, nodeId })
  ensureLevelForNode({ mapId, nodeId })
  getPrimaryEnemy(levelId)
  setPrimaryEnemy(levelId, templateId)
  setBattleBackground(levelId, background)
  updateLevelBasics(levelId, patch)
  updateRewards(levelId, patch)
  exportMapDocument()
  exportAuthoringLevelsDocument()
  exportRuntimeLevelsDocument()
  validatePackage()
}
```

Use `primaryEnemy.templateId` internally where possible, and keep `waves[0] / enemyPools` as runtime-compatible projection.

- [ ] **Step 4: Export new workspace from level index**

Modify `NodeConsoleApp2/script/editor/level/index.js` to import and export `LevelDetailWorkspace`.

- [ ] **Step 5: Run workspace tests and verify GREEN**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_detail_workspace.test.mjs
```

Expected: PASS.

### Task 2: Level Detail Editor Page

**Files:**
- Create: `NodeConsoleApp2/script/editor/level/LevelDetailEditorPage.js`
- Create: `NodeConsoleApp2/test/level_detail_editor_v1.html`
- Create: `NodeConsoleApp2/test/level_detail_editor_page.test.mjs`
- Modify: `NodeConsoleApp2/script/editor/level/index.js`

- [ ] **Step 1: Write the failing page tests**

Create tests that load `test/level_detail_editor_v1.html`, assert the expected DOM IDs/classes exist, instantiate `LevelDetailEditorPage`, load fixture docs, and assert:

1. Topbar includes authoring/current package paths.
2. Left node list renders node rows.
3. Selected node renders level name, enemy select, reward fields, rule cards, and right-side binding.
4. Changing enemy select updates `workspace.getPrimaryEnemy(levelId).templateId`.

- [ ] **Step 2: Run page tests and verify RED**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_detail_editor_page.test.mjs
```

Expected: FAIL because `LevelDetailEditorPage.js` and HTML do not exist.

- [ ] **Step 3: Implement HTML shell**

Create `test/level_detail_editor_v1.html` based on the approved prototype structure:

1. `#levelDetailStatus`
2. `#authoringPathText`
3. `#runtimePathText`
4. `#nodeTreeList`
5. `#levelNameInput`
6. `#enemyTemplateSelect`
7. `#battleBackgroundSelect`
8. `#rewardExpInput`, `#rewardGoldInput`, `#rewardKpInput`
9. `#bindingSummary`
10. `#issueList`
11. `#fileWriteList`

- [ ] **Step 4: Implement page class**

Implement `LevelDetailEditorPage` with:

```js
export class LevelDetailEditorPage {
  constructor(options = {})
  bind()
  loadDocuments(rawMapPack, rawLevels, rawEnemies)
  renderAll()
  renderTopbar()
  renderNodeTree()
  renderLevelDetail()
  renderInspector()
  selectNode(mapId, nodeId)
  saveCurrentBasics()
  updateCurrentEnemy(templateId)
  updateCurrentRewards()
}
```

- [ ] **Step 5: Wire factory functions**

Add `createLevelDetailEditorPage` and `bootLevelDetailEditorPage` to `script/editor/level/index.js`.

- [ ] **Step 6: Run page tests and verify GREEN**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_detail_editor_page.test.mjs
```

Expected: PASS.

### Task 3: Prototype-Aligned Styling And Visual Verification

**Files:**
- Modify: `NodeConsoleApp2/test/level_detail_editor_v1.html`
- Test with screenshot command.

- [ ] **Step 1: Port approved prototype CSS into the runtime test page**

Use the approved prototype as the layout baseline:

`DOC/CODEX_DOC/08_原型与附图/2026-05-24-104106-NodeConsoleApp2-节点派生关卡详情编辑器原型-v1/source/style.css`

Keep the visual structure:

1. 1920x1080-friendly topbar.
2. Left structure drawer.
3. Central detail editor.
4. Right inspector.
5. Clear authoring/current paths.

- [ ] **Step 2: Start local server**

Run:

```bash
cd NodeConsoleApp2
PORT=3121 node app.js
```

- [ ] **Step 3: Capture runtime screenshot**

Run:

```bash
google-chrome --headless --disable-gpu --no-sandbox --window-size=1920,1080 \
  --screenshot=/tmp/level_detail_editor_runtime_1920x1080.png \
  http://127.0.0.1:3121/test/level_detail_editor_v1.html
```

Expected: PNG is `1920 x 1080`.

- [ ] **Step 4: Inspect screenshot**

Open `/tmp/level_detail_editor_runtime_1920x1080.png` and check:

1. No browser scrollbars visible.
2. No major text overlap.
3. Right inspector bottom file list is visible.
4. Enemy selector is visible and not just a display card.
5. Old level editor layout is not visible.

### Task 4: Save/Publish Package File Contract

**Files:**
- Modify: `NodeConsoleApp2/script/editor/level/LevelDetailEditorPage.js`
- Modify: `NodeConsoleApp2/app.js` if API must allow `levels.json` in map package writes.
- Test: existing/new API tests if practical.

- [ ] **Step 1: Extend package export payload**

`LevelDetailEditorPage` should build a file list containing:

1. `package.json`
2. `maps.json`
3. `levels.json`
4. `asset-manifest.json`

- [ ] **Step 2: Allow map package API to write `levels.json`**

Update `allowedPackageFiles` in `app.js` from:

```js
new Set(['package.json', 'maps.json', 'asset-manifest.json'])
```

to:

```js
new Set(['package.json', 'maps.json', 'levels.json', 'asset-manifest.json'])
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_detail_workspace.test.mjs test/level_detail_editor_page.test.mjs test/level_map_editor_page.test.mjs
```

Expected: PASS.

### Task 5: Final Verification

**Files:**
- All touched source/test/doc/prototype files.

- [ ] **Step 1: Run focused regression**

Run:

```bash
cd NodeConsoleApp2
node --test test/level_detail_workspace.test.mjs test/level_detail_editor_page.test.mjs test/level_map_workspace.test.mjs test/level_map_editor_page.test.mjs test/level_map_pack_io.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run diff hygiene**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 3: Report implementation status**

Report:

1. Files changed.
2. Tests run.
3. Runtime screenshot path and comparison conclusion.
4. Any known gaps, especially whether main game loading from package-local `levels.json` is implemented in this slice.
