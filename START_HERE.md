# Skill Optimization Worktree Startup

Purpose: isolate work for skill data, skill editor, skill tree, skill panel, and skill contract cleanup.

## Workspace

- Branch: `codex/skill-optimization-20260518`
- Worktree: `/home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518`
- Runtime project: `/home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518/NodeConsoleApp2`
- Base commit: `a98ae19` (`优化关卡地图选择界面`)

## Startup

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

## Baseline Checks

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518/NodeConsoleApp2
node --test test/skill_legacy_field_retirement.test.mjs test/c3_skill_contract_remediation.test.mjs test/skill_id_copy_rule.test.mjs
```

Current baseline when created: `15/15 pass`.

## Notes

- Keep changes in this worktree focused on skill-related behavior, data, and tools.
- Do not commit unrelated map or document changes from other worktrees.
- `npm ci` currently fails because `package.json` and `package-lock.json` are not synchronized for the Spine dependency set. Use the startup install commands above until the lockfile is intentionally repaired.
