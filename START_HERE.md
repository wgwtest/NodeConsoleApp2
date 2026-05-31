# NodeConsoleApp2 Enemy Worktree

Purpose: isolate enemy-content design, enemy data, and campaign-balance verification work for the browser runtime.

## Workspace

- Branch: `codex/enemy-worktree`
- Worktree: `.worktree/enemy`
- Base branch: `master`
- Current focus: WBS-3.4 enemy ecosystem, chapter-three enemy-role coverage, enemy skills, and related design documents.

## Startup

Run from this worktree:

```powershell
cd NodeConsoleApp2
npm install --package-lock=false --no-audit --no-fund --prefer-offline --progress=false
node tools/serve_with_port.cjs 3101
```

Open:

- Main flow: `http://127.0.0.1:3101/mock_ui_v11.html`
- Shared regression runner: `http://127.0.0.1:3101/test/codex_regression_runner.html`
- Enemy editor probe: `http://127.0.0.1:3101/test/enemy_editor_v1.html`
- Battle presentation probe: `http://127.0.0.1:3101/test/battle_presentation_probe.html`
- Level map editor: `http://127.0.0.1:3101/test/level_map_editor_v1.html`

## Current Document Targets

- Chapter-three enemy ecosystem plan:
  `NodeConsoleApp2/docs/superpowers/plans/2026-05-26-chapter-three-enemy-ecosystem.md`
- Enemy system design source of truth:
  `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
- WBS-3.4 plan:
  `NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/26-WBS-3.4-三章关卡敌人与技能平衡.md`

## Key Data Files

- Enemy templates: `NodeConsoleApp2/assets/data/enemies.json`
- Enemy skills: `NodeConsoleApp2/assets/data/skills_enemy_v1.json`
- Runtime levels: `NodeConsoleApp2/assets/data/levels.json`
- Current story pack levels: `NodeConsoleApp2/assets/map_packs/current/story_pack_v1/levels.json`
- Authoring story pack levels: `NodeConsoleApp2/assets/map_packs/authoring/story_pack_v1/levels.json`

## Baseline Checks

Run from `NodeConsoleApp2/`:

```powershell
node --test test/campaign_balance_content.test.mjs
node --test test/enemy_runtime_catalog.test.mjs test/enemy_editor_workspace.test.mjs test/enemy_editor_page.test.mjs
node --test test/acceptance_click_smoke_contract.test.mjs
```

## Notes

- Keep this branch focused on enemy content, enemy editor coverage, enemy runtime contracts, and the WBS-3.4 campaign-balance evidence chain.
- Do not mix player-skill tuning or engine-selection work into this branch unless enemy verification proves it is necessary.
- A migrated Linux worktree under `C:\CodexWorkSpace\CodexProject\2Tree\enemy-design-20260522` has a stale `.git` pointer to `/home/wgw/...`; use it as a content source only unless its Git metadata is rebuilt.
