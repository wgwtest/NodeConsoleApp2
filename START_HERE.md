# NodeConsoleApp2 Engine Selection Worktree

Purpose: isolate real implementation technology selection work for the main game runtime.

## Workspace

- Branch: `codex/engine-selection-20260527`
- Worktree: `.worktree/engine-selection-20260527`
- Base branch: `master`
- Starting commit: `cf6746c`

This branch is for validating whether the current browser-front-end runtime should remain the main implementation target, or whether the project should move toward a game engine such as Unity, Unreal Engine, Godot, Phaser, PixiJS, Cocos Creator, or another runtime.

## Startup

```bash
cd .worktree/engine-selection-20260527/NodeConsoleApp2
npm install --package-lock=false --no-audit --no-fund --prefer-offline --progress=false
npm install --package-lock=false --no-save --no-audit --no-fund --prefer-offline --progress=false jsdom
node tools/serve_with_port.cjs 3124
```

Open:

- Main flow: `http://127.0.0.1:3124/mock_ui_v11.html`
- Shared regression runner: `http://127.0.0.1:3124/test/codex_regression_runner.html`
- Battle presentation probe: `http://127.0.0.1:3124/test/battle_presentation_probe.html`
- Skill editor probe: `http://127.0.0.1:3124/test/skill_editor_test_v3.html`
- Level map editor: `http://127.0.0.1:3124/test/level_map_editor_v1.html`

## Selection Questions

Use this branch to answer these questions with evidence, not preference:

1. Can the current web runtime meet the expected stability, animation, effect, and tooling needs with reasonable effort?
2. If not, which engine reduces production risk most: Unity, Unreal Engine, Godot, Phaser/PixiJS, Cocos Creator, or another option?
3. Which parts of the current data model, editors, map tooling, skill tooling, buff tooling, and battle logic can be reused?
4. What is the migration cost for gameplay runtime, authoring tools, asset pipeline, testing, save data, and deployment?
5. What proof should be built before committing to a full migration?

## Recommended Document Targets

- Selection analysis:
  `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/00_总纲/04-真实实现技术选型(engine_selection)-分析文档.md`
- Execution plan:
  `NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/27-WBS-实现技术选型验证.md`
- Prototype notes or screenshots:
  `NodeConsoleApp2/DOC/CODEX_DOC/08_原型与附图/2026-05-27-真实实现技术选型验证/`

## Baseline Checks

```bash
cd .worktree/engine-selection-20260527/NodeConsoleApp2
npm test
node --test test/campaign_balance_content.test.mjs test/acceptance_click_smoke_contract.test.mjs test/skill_growth_tree_authoring_pack.test.mjs
```

## Notes

- Keep this branch focused on engine selection, migration feasibility, runtime prototype spikes, and decision evidence.
- Do not mix map-only, skill-only, or enemy-only content work into this branch unless it is needed to evaluate engine fit.
- Keep `.worktree/` project-local and ignored by Git.
- `npm ci` may fail if `package.json` and `package-lock.json` drift. Use the startup install commands above unless the lockfile is intentionally repaired.
