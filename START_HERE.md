# NodeConsoleApp2 Worktree Startup

Purpose: keep the map, skill, and enemy design worktrees easy to start from the project-local `.worktree` directory.

## Workspace

- Main branch: `master`
- Map worktree: `/home/wgw/CodexProject/NodeConsoleApp2/.worktree/map-optimization-20260518`
- Skill worktree: `/home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518`
- Enemy worktree: `/home/wgw/CodexProject/NodeConsoleApp2/.worktree/enemy-design-20260522`

## Map Startup

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/.worktree/map-optimization-20260518/NodeConsoleApp2
npm install --package-lock=false --no-audit --no-fund --prefer-offline --progress=false
npm install --package-lock=false --no-save --no-audit --no-fund --prefer-offline --progress=false jsdom
PORT=3121 node app.js
```

Open:

- Main flow: `http://127.0.0.1:3121/mock_ui_v11.html`
- Map editor: `http://127.0.0.1:3121/test/level_map_editor_v1.html`
- Map preview: `http://127.0.0.1:3121/test/level_map_preview_v1.html`

## Skill Startup

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518/NodeConsoleApp2
npm install --package-lock=false --no-audit --no-fund --prefer-offline --progress=false
npm install --package-lock=false --no-save --no-audit --no-fund --prefer-offline --progress=false jsdom
PORT=3122 node app.js
```

Open:

- Main flow: `http://127.0.0.1:3122/mock_ui_v11.html`
- Shared regression runner: `http://127.0.0.1:3122/test/codex_regression_runner.html`
- Skill contract probe: `http://127.0.0.1:3122/test/skill_contract_probe.html`

## Enemy Startup

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/.worktree/enemy-design-20260522/NodeConsoleApp2
npm install --package-lock=false --no-audit --no-fund --prefer-offline --progress=false
npm install --package-lock=false --no-save --no-audit --no-fund --prefer-offline --progress=false jsdom
PORT=3123 node app.js
```

Open:

- Main flow: `http://127.0.0.1:3123/mock_ui_v11.html`
- Shared regression runner: `http://127.0.0.1:3123/test/codex_regression_runner.html`
- Battle presentation probe: `http://127.0.0.1:3123/test/battle_presentation_probe.html`

Primary enemy fact sources:

- `NodeConsoleApp2/assets/data/enemies.json`
- `NodeConsoleApp2/script/engine/EnemyActionPlanner.js`
- `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S2_战斗运行时/11-敌人系统(enemy_design)-设计说明.md`

## Baseline Checks

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/level_map_pack_io.test.mjs test/level_map_workspace.test.mjs test/level_map_editor_page.test.mjs test/level_map_preview_page.test.mjs test/level_select_map_runtime.test.mjs test/level_select_map_view.test.mjs test/d1_information_priority.test.mjs test/c_growth_ui_regression.test.mjs
node --test test/skill_tree_visual_redesign.test.mjs test/skill_legacy_field_retirement.test.mjs test/c_growth_ui_regression.test.mjs test/d1_ui_modal_semantics.test.mjs test/c3_skill_contract_remediation.test.mjs test/skill_id_copy_rule.test.mjs
node --test test/skill_buff_battle_robot.test.mjs test/d3_battle_presentation_contract.test.mjs test/level_select_map_runtime.test.mjs
```

## Notes

- Keep map-specific changes in the map worktree and skill-specific changes in the skill worktree until they are intentionally merged.
- Keep enemy-specific data, AI, battle-runtime, and enemy-design document work in the enemy worktree until it is intentionally merged.
- Keep `.worktree/` project-local and ignored by Git.
- `npm ci` currently fails because `package.json` and `package-lock.json` are not synchronized for the Spine dependency set. Use the startup install commands above until the lockfile is intentionally repaired.
- Before adding or adjusting formal skills, read `NodeConsoleApp2/DOC/CODEX_DOC/04_研发文档/18-技能新增Codex护栏与排布检查规程.md` and run `node tools/validate_skill_authoring_guard.mjs <skill-json> assets/data/buffs_v2_7.json`.
