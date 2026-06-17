# NodeConsoleApp2 Current Workspace

Purpose: orient work in the formal `NodeConsoleApp2` repository root and avoid confusing the main checkout with old isolated worktree notes.

## Workspace

- Formal repository root: `C:\CodexWorkSpace\CodexProject\NodeConsoleApp2`
- Runnable project root: `C:\CodexWorkSpace\CodexProject\NodeConsoleApp2\NodeConsoleApp2`
- Formal local docs root: `NodeConsoleApp2/DOC/CODEX_DOC`
- Current branch: `master`
- Current focus: WBS-3.4 campaign balance, 30 story levels, enemy ecosystem, skill testing evidence, and browser natural-progression verification.

## Startup

Run from the runnable project root:

```powershell
cd C:\CodexWorkSpace\CodexProject\NodeConsoleApp2\NodeConsoleApp2
npm install
npm run serve:3101
```

Open:

- Main flow: `http://127.0.0.1:3101/mock_ui_v11.html`
- Shared regression runner: `http://127.0.0.1:3101/test/codex_regression_runner.html`
- Skill tester: `http://127.0.0.1:3101/test/skill_tester.html`
- Enemy editor probe: `http://127.0.0.1:3101/test/enemy_editor_v1.html`
- Level map editor: `http://127.0.0.1:3101/test/level_map_editor_v1.html`
- Battle presentation probe: `http://127.0.0.1:3101/test/battle_presentation_probe.html`

## Read First

- Repository overview: `README.md`
- Formal docs entry: `NodeConsoleApp2/DOC/CODEX_DOC/README.md`
- Engineering strategy: `NodeConsoleApp2/DOC/CODEX_DOC/00-本地工程策略映射.md`
- Design index: `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/README.md`
- WBS plan index: `NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/README.md`
- Current acceptance entry: `NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/00-当前待验收功能总入口.md`

## Current WBS-3.4 Targets

- WBS-3.4 plan: `NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/26-WBS-3.4-三章关卡敌人与技能平衡.md`
- Enemy design source of truth: `NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
- Third-chapter natural verification spec: `NodeConsoleApp2/docs/superpowers/specs/2026-05-25-campaign-balance-third-chapter-natural-verification-design.md`
- Latest 30-level skill batch evidence: `NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/05_Skill技能系统测试记录/2026-06-01-014120-30关技能测试批量记录/batch_summary.md`

## Key Data Files

- Enemy templates: `NodeConsoleApp2/assets/data/enemies.json`
- Enemy skills: `NodeConsoleApp2/assets/data/skills_enemy_v1.json`
- Runtime levels: `NodeConsoleApp2/assets/data/levels.json`
- Current story pack levels: `NodeConsoleApp2/assets/map_packs/current/story_pack_v1/levels.json`
- Authoring story pack levels: `NodeConsoleApp2/assets/map_packs/authoring/story_pack_v1/levels.json`
- Player skills: `NodeConsoleApp2/assets/data/skills_melee_v4_5.json`

## Baseline Checks

Run from `NodeConsoleApp2/`:

```powershell
node --test test/campaign_balance_content.test.mjs
node --test test/campaign_balance_simulator.test.mjs
node --test test/acceptance_click_smoke_contract.test.mjs
node --test test/enemy_runtime_catalog.test.mjs test/enemy_editor_workspace.test.mjs test/enemy_editor_page.test.mjs
node --test test/skill_tester_model.test.mjs test/skill_tester_page.test.mjs test/skill_batch_analyzer.test.mjs
```

Browser smoke requires a local server and Chrome CDP:

```powershell
$env:APP_BASE_URL='http://127.0.0.1:3101'
$env:CDP_ENDPOINT='http://127.0.0.1:9222'
node tools/acceptance_click_smoke.mjs
```

## Notes

- Treat this checkout as the formal user-visible state. Isolated worktrees under `.worktree/` are development aids only.
- Do not report a worktree-only change as complete until it is synchronized back to this main repository.
- Do not add player skills or tune single enemy numbers for WBS-3.4 without evidence from the simulator, skill tests, or browser natural-progression diagnostics.
- When updating acceptance status, follow the active checklist and user `【】` comment rules in `00-本地工程策略映射.md`.
