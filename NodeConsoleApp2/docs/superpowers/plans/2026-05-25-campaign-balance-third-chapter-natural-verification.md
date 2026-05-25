# Campaign Balance Third Chapter Natural Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the low-KP browser natural progression smoke from two chapters to all three chapters and record whether the current campaign is playable through `level_3_10` without adding enemies, enemy skills, or player skills by default.

**Architecture:** Keep the implementation inside the existing acceptance-click smoke instead of adding a new browser runner. First lock the intended three-chapter contract in `test/acceptance_click_smoke_contract.test.mjs`, then update `runNaturalProgressiveCampaignSmoke()` in `tools/acceptance_click_smoke.mjs`, then run the existing browser CDP smoke at 1920x1080 and document the result.

**Tech Stack:** Node.js `node:test`, plain JavaScript, existing Chrome DevTools Protocol helper functions in `tools/acceptance_click_smoke.mjs`, local `app.js` static server, headless Chrome at CDP port `9223`.

---

## File Structure

- Modify `test/acceptance_click_smoke_contract.test.mjs`
  - Locks the natural progression smoke at three chapters.
  - Adds static contract checks for `thirdChapterNaturalProgression` and existing late-game learned skills used by chapter 3.
- Modify `tools/acceptance_click_smoke.mjs`
  - Changes the natural progression target from 20 levels to 30 levels.
  - Keeps the low-KP start and real UI battle flow.
  - Allows the browser auto-player to learn and deploy already-existing late-game skills used by the low-KP simulator.
  - Adds third-chapter report fields and assertions.
- Create `DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-05-25-WBS-3.4.6-第三章浏览器低KP自然连续验收自测报告.md`
  - Records commands and pass/fail evidence.
- Create `DOC/CODEX_DOC/06_过程文档/01_会话交接/2026-05-25-WBS-3.4.6-第三章浏览器低KP自然连续验收记录.md`
  - Records implementation scope and next action.

Do not modify these files in the first implementation pass:

- `assets/data/enemies.json`
- `assets/data/skills_enemy_v1.json`
- `assets/data/skills_melee_v4_5.json`
- `assets/data/levels.json`
- `assets/map_packs/current/story_pack_v1/levels.json`

Only touch data files if the browser run produces a classified failure proving that data, not autoplay or UI wiring, is the problem.

---

### Task 1: Lock The Three-Chapter Natural Progression Contract

**Files:**
- Modify: `test/acceptance_click_smoke_contract.test.mjs`

- [ ] **Step 1: Write the failing contract update**

In `test/acceptance_click_smoke_contract.test.mjs`, replace the current `targetChapterCount = 2` assertion with a `targetChapterCount = 3` assertion:

```js
  assert.match(
    toolSource,
    /const targetChapterCount = 3;/u
  );
```

In the `requiredText` array, add these strings next to `secondChapterNaturalProgression` and the existing late-game natural progression entries:

```js
    'thirdChapterNaturalProgression',
    'skill_leftover_lunchbox',
    'skill_execute',
    'level_3_1',
    'level_3_2',
    'level_3_3',
    'level_3_4',
    'level_3_5',
    'level_3_6',
    'level_3_7',
    'level_3_8',
    'level_3_9',
    'level_3_10',
```

- [ ] **Step 2: Run the contract test and verify red**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/acceptance_click_smoke_contract.test.mjs
```

Expected result:

```text
not ok 1 - 自动点击验收脚本固定主流程与专项页面覆盖范围
```

The failure should mention that `/const targetChapterCount = 3;/u` did not match the current script. If it fails for a different reason, inspect the failure before implementing.

- [ ] **Step 3: Commit only if this task is intentionally split**

Do not commit the red test by itself unless using task-by-task commits. If committing red tests is not desired, continue to Task 2 and commit green code together.

---

### Task 2: Extend `runNaturalProgressiveCampaignSmoke()` To Three Chapters

**Files:**
- Modify: `tools/acceptance_click_smoke.mjs`
- Test: `test/acceptance_click_smoke_contract.test.mjs`

- [ ] **Step 1: Update the natural progression target and report flags**

In `tools/acceptance_click_smoke.mjs`, inside `runNaturalProgressiveCampaignSmoke(cdpEndpoint, mainUrl)`, replace the target count and chapter flags with:

```js
    const targetChapterCount = 3;
    const naturalProgressionLevels = Array.from({ length: targetChapterCount }, (_, chapterIndex) => Array.from({ length: 10 }, (_, levelIndex) => `level_${chapterIndex + 1}_${levelIndex + 1}`)).flat();
    const initialSkillPointsOverride = 0;
    const firstChapterNaturalProgression = true;
    const secondChapterNaturalProgression = true;
    const thirdChapterNaturalProgression = true;
```

Inside the browser `evaluate()` string, replace the corresponding constants with:

```js
            const naturalProgressionLevels = ${JSON.stringify(naturalProgressionLevels)};
            const initialSkillPointsOverride = ${initialSkillPointsOverride};
            const firstChapterNaturalProgression = ${JSON.stringify(firstChapterNaturalProgression)};
            const secondChapterNaturalProgression = ${JSON.stringify(secondChapterNaturalProgression)};
            const thirdChapterNaturalProgression = ${JSON.stringify(thirdChapterNaturalProgression)};
```

- [ ] **Step 2: Allow the auto-player to learn existing late-game tools**

Replace the current `naturalProgressiveLearningPriority` with this list:

```js
            const naturalProgressiveLearningPriority = [
                "skill_block",
                "skill_1771769351059",
                "skill_skull_cracker",
                "skill_regroup",
                "skill_shockwave_copy_1770042951717",
                "skill_leftover_lunchbox",
                "skill_execute",
                "skill_execute_copy_1770043820577",
                "skill_execute_copy_1770044052832"
            ];
```

This does not add player skills. It only lets the browser route learn existing skills that the simulator already uses in late progression.

- [ ] **Step 3: Add late-game skills to the deployment candidate order**

Inside `preferredSkillOrder()`, replace the `candidateSkillIds` declaration with:

```js
                const candidateSkillIds = [
                    "skill_heal",
                    "skill_regroup",
                    "skill_execute_copy_1770044052832",
                    "skill_shockwave_copy_1770042951717",
                    "skill_leftover_lunchbox",
                    "skill_execute",
                    "skill_execute_copy_1770043820577",
                    "skill_1771769351059",
                    "skill_skull_cracker",
                    "skill_heavy_swing",
                    "skill_block"
                ];
```

Keep the existing `skill_savage_charge` self-damage guard unchanged.

- [ ] **Step 4: Give third-chapter pressure levels enough natural turns**

Replace the current high-pressure and max-turn declarations with:

```js
            const naturalProgressiveHighPressureLevels = ["level_2_9", "level_3_9"];
            const getNaturalProgressiveMaxTurns = levelId => {
                if (levelId === "level_3_10") return 18;
                if (levelId.endsWith("_10")) return 14;
                if (naturalProgressiveHighPressureLevels.includes(levelId)) return 12;
                return 10;
            };
```

This mirrors the existing terminal boss natural checkpoint allowance without changing combat data.

- [ ] **Step 5: Return and assert the third-chapter flag**

In the object returned from the browser `evaluate()` call, add `thirdChapterNaturalProgression` next to the first and second chapter flags:

```js
                firstChapterNaturalProgression,
                secondChapterNaturalProgression,
                thirdChapterNaturalProgression,
```

After the existing second-chapter assertion, add:

```js
        assertCondition(report.thirdChapterNaturalProgression === true, "自然进度式 smoke 未标记第三章完整自然推进");
```

- [ ] **Step 6: Add chapter-3 deployment assertions**

After the existing second-chapter deployment assertions, add:

```js
        assertCondition(
            report.naturalLevelResults.some(level => level.levelId.startsWith("level_3_") && level.naturalTurnSnapshots
                .some(turn => (turn.plannedActions || []).length > 0)),
            "自然进度式 smoke 第三章没有提交任何玩家规划"
        );
        assertCondition(
            report.naturalLevelResults.some(level => level.levelId === "level_3_10"
                && level.naturalProgressiveOutcome === "victory"),
            "自然进度式 smoke 未自然通过第三章终局 Boss"
        );
```

Do not assert a specific third-chapter skill until the first browser run shows the actual learned path. The existing all-level victory and `completedLevels` checks already require all 30 target levels to complete.

- [ ] **Step 7: Run the contract test and verify green**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/acceptance_click_smoke_contract.test.mjs
```

Expected result:

```text
# pass 2
# fail 0
```

- [ ] **Step 8: Run syntax and whitespace checks**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --check tools/acceptance_click_smoke.mjs
git -C /home/wgw/CodexProject/NodeConsoleApp2 diff --check
```

Expected result:

```text
```

Both commands should exit with code `0` and print no errors.

---

### Task 3: Run The Full Browser Acceptance Smoke At 1920x1080

**Files:**
- Runtime only: no source file changes expected in this task.
- Report output: `/tmp/nodeconsole-acceptance-wbs-3.4.6.json`

- [ ] **Step 1: Start the app server**

Open a long-running shell session in the app directory:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
PORT=3111 node app.js
```

Expected server URL:

```text
http://127.0.0.1:3111/mock_ui_v11.html
```

- [ ] **Step 2: Start headless Chrome with CDP at 1920x1080**

Open a second long-running shell session:

```bash
google-chrome --headless=new --disable-gpu --no-first-run --no-default-browser-check --no-sandbox \
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=9223 \
  --window-size=1920,1080 \
  --user-data-dir=/tmp/nodeconsoleapp2-cdp-wbs-3.4.6-9223 \
  about:blank
```

If `google-chrome` is unavailable, try `/usr/bin/google-chrome` before changing the test approach.

- [ ] **Step 3: Run the full acceptance click smoke**

Run in the app directory:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
APP_BASE_URL=http://127.0.0.1:3111 CDP_ENDPOINT=http://127.0.0.1:9223 \
  node tools/acceptance_click_smoke.mjs > /tmp/nodeconsole-acceptance-wbs-3.4.6.json
```

Expected pass result:

```text
```

The command should exit with code `0`. The JSON report should contain:

```json
{
  "naturalProgressiveCampaign": {
    "thirdChapterNaturalProgression": true,
    "naturalProgressiveOutcome": {
      "total": 30,
      "victories": 30,
      "forcedSettlementUsed": false
    }
  }
}
```

- [ ] **Step 4: Summarize the browser report**

Run:

```bash
node --input-type=module - <<'NODE'
import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync('/tmp/nodeconsole-acceptance-wbs-3.4.6.json', 'utf8'));
const natural = report.naturalProgressiveCampaign;
const rows = natural.naturalLevelResults.map(level => ({
  levelId: level.levelId,
  outcome: level.naturalProgressiveOutcome,
  turns: level.naturalTurnSnapshots.length,
  hp: `${level.finalVitals.playerHp}/${level.finalVitals.playerMaxHp}`,
  enemyHp: level.finalVitals.enemyRemainingHp,
  learnedBefore: level.skillTreeBeforeBattle.learned,
  plannedSkillIds: [...new Set(level.naturalTurnSnapshots.flatMap(turn => (turn.plannedActions || []).map(action => action.skillId).filter(Boolean)))]
}));
console.log(JSON.stringify({
  targetLevels: natural.naturalProgressionLevels.length,
  victories: natural.naturalProgressiveOutcome.victories,
  failures: natural.naturalProgressiveOutcome.failures,
  forcedSettlementUsed: natural.naturalProgressiveOutcome.forcedSettlementUsed,
  completedCount: natural.completedLevels.length,
  finalState: natural.finalState,
  finalTitle: natural.finalTitle,
  learnedSnapshots: natural.naturalProgressiveLearningSnapshots.map(item => ({
    levelId: item.levelId,
    learnedThisLevel: item.learnedThisLevel,
    beforeKp: item.skillTreeBeforeLearning.skillPoints,
    afterKp: item.skillTreeAfterLearning.skillPoints
  })),
  pressureRows: rows.filter(row => ['level_1_10', 'level_2_10', 'level_3_9', 'level_3_10'].includes(row.levelId))
}, null, 2));
NODE
```

Expected pass indicators:

```json
{
  "targetLevels": 30,
  "victories": 30,
  "forcedSettlementUsed": false
}
```

- [ ] **Step 5: If the browser smoke fails, extract the failure summary before changing code**

If `tools/acceptance_click_smoke.mjs` exits nonzero, check stderr first. If `/tmp/nodeconsole-acceptance-wbs-3.4.6.json` was still written, run the summary command from Step 4. If the file was not written, use the assertion failure's `naturalProgressiveFailureSummary` text from the terminal output.

Classify the failure using this exact table before editing data:

| Failure signal | Next action |
| --- | --- |
| `no_deployable_skill` with learned skills available | Fix `preferredSkillOrder()`, target selection, or slot placement |
| learned skill missing from battle buttons | Inspect skill-tree commit and battle loadout wiring |
| `turn_wait_timeout` | Inspect timeline wait condition and battle phase transitions |
| player HP `0` while enemy HP high | Inspect enemy skill pressure and defensive learned path |
| player healthy while enemy HP high at turn cap | Inspect enemy HP, armor, repair, or selected body part |
| mutual kill | Inspect settlement semantics before tuning difficulty |

Do not change `assets/data/enemies.json`, `assets/data/skills_enemy_v1.json`, or `assets/data/skills_melee_v4_5.json` during this task unless the failure classification proves that data is the smallest correct fix.

---

### Task 4: Record The WBS-3.4.6 Evidence

**Files:**
- Create: `DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-05-25-WBS-3.4.6-第三章浏览器低KP自然连续验收自测报告.md`
- Create: `DOC/CODEX_DOC/06_过程文档/01_会话交接/2026-05-25-WBS-3.4.6-第三章浏览器低KP自然连续验收记录.md`

- [ ] **Step 1: Create the self-test report**

If the browser smoke passes, create the self-test report with this structure:

```markdown
# WBS-3.4.6 第三章浏览器低 KP 自然连续验收自测报告

## 背景

本轮把浏览器低 KP 自然连续推进从两章扩展到三章，目标是验证 `level_1_1` 到 `level_3_10` 能否通过真实 UI、真实规划、真实执行回合和自然结算连续推进。

## 改动

1. `test/acceptance_click_smoke_contract.test.mjs` 固定 `targetChapterCount = 3`。
2. `tools/acceptance_click_smoke.mjs` 的 `runNaturalProgressiveCampaignSmoke()` 覆盖三章 30 关。
3. 自动玩家可学习并部署已有后期技能，不新增玩家技能。

## 验证

```bash
node --test test/acceptance_click_smoke_contract.test.mjs
node --check tools/acceptance_click_smoke.mjs
git diff --check
APP_BASE_URL=http://127.0.0.1:3111 CDP_ENDPOINT=http://127.0.0.1:9223 node tools/acceptance_click_smoke.mjs > /tmp/nodeconsole-acceptance-wbs-3.4.6.json
```

## 浏览器结果

- 视口：1920x1080
- 初始 KP：0
- 目标关卡：30
- 自然胜利：30/30
- 强制结算：false

## 当前判断

本轮不新增敌人、不新增敌方技能、不新增玩家技能。第三章真实浏览器低 KP 自然连续流程通过后，下一阶段应转入人工试玩反馈或更细粒度平衡微调，而不是继续扩大内容数量。
```

If the browser smoke fails, replace the `浏览器结果` and `当前判断` sections with the extracted failure summary and the failure classification from Task 3 Step 5.

- [ ] **Step 2: Create the handoff record**

If the browser smoke passes, create the handoff record with this structure:

```markdown
# WBS-3.4.6 第三章浏览器低 KP 自然连续验收记录

## 本轮目标

将低 KP 浏览器自然连续推进从两章扩展到三章，验证三章 30 关能否在真实 UI 流程中自然推进。

## 结果

- `targetChapterCount = 3`
- `naturalProgressionLevels.length = 30`
- `naturalProgressiveOutcome.victories = 30`
- `forcedSettlementUsed = false`

## 产物

- `test/acceptance_click_smoke_contract.test.mjs`
- `tools/acceptance_click_smoke.mjs`
- `DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-05-25-WBS-3.4.6-第三章浏览器低KP自然连续验收自测报告.md`

## 下一步

如用户继续要求优化难度，优先基于真实玩家反馈或逐关压力报告微调；不要默认继续扩敌人或新增玩家技能。
```

If the browser smoke fails, record the failing level, final vitals, planned skills, learned skills, and next action instead of the pass summary.

---

### Task 5: Final Verification, Commit, And Sync

**Files:**
- Modified implementation and test files from Tasks 1-2.
- New report files from Task 4.

- [ ] **Step 1: Run the focused verification suite**

Run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2
node --test test/acceptance_click_smoke_contract.test.mjs
node --test test/campaign_balance_content.test.mjs test/campaign_balance_simulator.test.mjs
node --check tools/acceptance_click_smoke.mjs
git -C /home/wgw/CodexProject/NodeConsoleApp2 diff --check
```

Expected result:

```text
# pass 2
# fail 0
```

for the contract test, `23/23 pass` for the campaign balance tests, and no output from `node --check` / `git diff --check`.

- [ ] **Step 2: Verify the browser evidence exists**

Run:

```bash
test -s /tmp/nodeconsole-acceptance-wbs-3.4.6.json
node --input-type=module - <<'NODE'
import fs from 'node:fs';
const report = JSON.parse(fs.readFileSync('/tmp/nodeconsole-acceptance-wbs-3.4.6.json', 'utf8'));
const natural = report.naturalProgressiveCampaign;
if (natural.naturalProgressionLevels.length !== 30) throw new Error('natural target count is not 30');
if (natural.naturalProgressiveOutcome.forcedSettlementUsed !== false) throw new Error('natural smoke used forced settlement');
console.log(JSON.stringify({
  targetLevels: natural.naturalProgressionLevels.length,
  victories: natural.naturalProgressiveOutcome.victories,
  failures: natural.naturalProgressiveOutcome.failures.length,
  forcedSettlementUsed: natural.naturalProgressiveOutcome.forcedSettlementUsed
}, null, 2));
NODE
```

Expected pass output:

```json
{
  "targetLevels": 30,
  "victories": 30,
  "failures": 0,
  "forcedSettlementUsed": false
}
```

If the browser smoke intentionally fails and produces a diagnosis instead of 30 victories, do not use this expected pass output. Commit the diagnosis only after the next action is clear.

- [ ] **Step 3: Commit the implementation**

For a passing three-chapter browser smoke, run:

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2
git status --short
git add NodeConsoleApp2/test/acceptance_click_smoke_contract.test.mjs \
  NodeConsoleApp2/tools/acceptance_click_smoke.mjs \
  NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-05-25-WBS-3.4.6-第三章浏览器低KP自然连续验收自测报告.md \
  NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/01_会话交接/2026-05-25-WBS-3.4.6-第三章浏览器低KP自然连续验收记录.md
git commit -m "test: cover full campaign natural progression"
```

For a diagnosed failure without data tuning, use:

```bash
git commit -m "test: diagnose full campaign natural progression"
```

- [ ] **Step 4: Sync long-lived worktree branches**

After the commit, fast-forward the three long-lived worktree branches:

```bash
git -C /home/wgw/CodexProject/NodeConsoleApp2/.worktree/map-optimization-20260518 merge --ff-only master
git -C /home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518 merge --ff-only master
git -C /home/wgw/CodexProject/NodeConsoleApp2/.worktree/enemy-design-20260522 merge --ff-only master
git push origin master codex/map-optimization-20260518 codex/skill-optimization-20260518 codex/enemy-design-20260522
```

- [ ] **Step 5: Final status check**

Run:

```bash
git -C /home/wgw/CodexProject/NodeConsoleApp2 status --short --branch
git -C /home/wgw/CodexProject/NodeConsoleApp2/.worktree/map-optimization-20260518 status --short --branch
git -C /home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518 status --short --branch
git -C /home/wgw/CodexProject/NodeConsoleApp2/.worktree/enemy-design-20260522 status --short --branch
```

Expected result:

```text
## master...origin/master
## codex/map-optimization-20260518...origin/codex/map-optimization-20260518
## codex/skill-optimization-20260518...origin/codex/skill-optimization-20260518
## codex/enemy-design-20260522...origin/codex/enemy-design-20260522
```

No modified or untracked files should be listed.

---

## Self-Review

- Spec coverage:
  - Formal WBS baseline was already updated in the prior docs commit.
  - This plan covers the remaining implementation requirement: extend browser natural progression from two chapters to three chapters.
  - This plan covers failure classification before data changes.
  - This plan covers no default enemy, enemy skill, or player skill additions.
- Placeholder scan:
  - No unresolved placeholders or unspecified implementation steps are intentionally left in this plan.
- Type and property consistency:
  - Uses existing names: `runNaturalProgressiveCampaignSmoke`, `naturalProgressionLevels`, `naturalProgressiveOutcome`, `naturalLevelResults`, `naturalTurnSnapshots`, `skillTreeBeforeBattle`, `naturalProgressiveLearningSnapshots`.
  - Adds one new report flag: `thirdChapterNaturalProgression`.
