# Skill 设计说明与实现一致性审计

创建时间：2026-05-28 21:27:40 +0800

## 1. 审计目标

本轮审计目标是确认 `S4 技能系统与技能树` 设计说明是否与当前代码、技能数据和测试严格对应。

审计原则：

1. 以代码、正式 JSON、测试为事实源。
2. 文档不能把目标态、设计意图、未来能力写成当前实现事实。
3. Skill 文档不逐条穷尽所有技能；具体技能清单由 JSON、编辑器和测试矩阵承担。
4. 与实现不一致但只是文档误写的内容，直接修正文档。
5. 与实现不一致且影响系统设计的内容，记录为设计债务，不在本轮直接改技能或引擎。

## 2. 事实源

### 2.1 技能数据

| 文件 | 当前事实 |
| --- | --- |
| `assets/data/skills_melee_v4_5.json` | 玩家技能包，45 个技能，其中 40 个正式可见技能、5 个隐藏测试/演示节点 |
| `assets/data/skills_enemy_v1.json` | 敌人技能包，36 个技能，全部隐藏于玩家技能树 |

玩家技能包当前结构事实：

| 维度 | 当前值 |
| --- | --- |
| `requirements` 非空 | 27 |
| `costs.partSlot` 存在 | 25 |
| `costs.perTurnLimit` 存在 | 45 |
| `placement` 存在 | 1 |
| `target.scope=SCOPE_MULTI_PARTS` | 3 |
| `target.selection.mode=multiple` | 5 |
| `BUFF_REMAINING` 读数技能 | 2 |
| `buffRefs.apply[].chance < 1` | 1 |

敌人技能包当前结构事实：

| 维度 | 当前值 |
| --- | --- |
| `requirements` 非空 | 1 |
| `costs.partSlot` 存在 | 0 |
| `costs.perTurnLimit` 存在 | 36 |
| `buffRefs.apply[].chance < 1` | 14 |

### 2.2 运行代码

| 模块 | 当前事实 |
| --- | --- |
| `DataManagerV2` | 加载玩家/敌人技能包，构建 catalog；`getSkillContractSummary()` 保留 `requirements/costs/buffRefs/actions` 并派生 `runtimeFlags` |
| `CoreEngine._getSkillApCostStrict()` | 严格读取 `skill.costs.ap`，缺失或非法会抛错 |
| `CoreEngine.learnSkill()` | 校验技能存在、已学、`prerequisites`、`unlock.cost.kp`、`unlock.exclusives` |
| `CoreEngine._validateSkillTargetSelection()` | 校验目标存在、subject self/enemy、`SCOPE_PART/SCOPE_MULTI_PARTS` 必须有有效 `bodyPart` |
| `CoreEngine._executeSkillActions()` | 支持 `DMG_HP/DMG_ARMOR/HEAL/ARMOR_ADD/AP_GAIN/BUFF_REMOVE` |
| `CoreEngine._computeEffectAmount()` | 支持 `ABS/PCT_MAX/PCT_CURRENT/BUFF_STACKS/BUFF_REMAINING` |
| `CoreEngine._applySkillBuffRefs()` | 支持 `buffRefs.apply/remove`，并实际读取 `chance/duration/params/stacks/stackStrategy/maxStacks/extendBy` |
| `TurnPlanner` | 校验 AP 预算、slotKey 格式与容量；不校验 `requirements`，不按 `costs.partSlot.slotCost` 扣槽，不直接读取 `costs.perTurnLimit` |
| `EnemyActionPlanner` | 敌人选技主要消费 `target/costs.ap/actions/buffRefs`，不执行完整 `requirements/partSlot/perTurnLimit` 裁决 |

### 2.3 测试

| 测试 | 当前覆盖 |
| --- | --- |
| `test/skill_formal_skill_matrix.test.mjs` | 40 个正式玩家技能逐项通过 `CoreEngine.executePlayerSkill()` 至少执行一次 |
| `test/skill_buff_decoupled_runtime.test.mjs` | Skill/Buff 解耦、`BUFF_REMAINING`、`BUFF_REMOVE` 等运行能力 |
| `test/skill_buff_battle_robot.test.mjs` | 通过战斗机器人覆盖 Skill 与 Buff 的战斗链路 |
| `test/skill_editor_file_persistence.test.mjs` | 技能编辑器保存、发布和版本文件能力 |

## 3. 已修正文档不一致点

### 3.1 `requirements` 不是当前硬释放门槛

旧写法容易理解为：`requirements.selfPart` 已由 CoreEngine/TurnPlanner 阻止非法释放。

当前事实：

- `DataManagerV2.getSkillContractSummary()` 会保留 `requirements`。
- UI/编辑器会展示 `requirements`。
- `runtimeFlags.isConditional` 会因 `requirements` 非空被置为 true。
- CoreEngine/TurnPlanner 不按 `requirements.selfPart` 或其它 requirements 条目做硬校验。

处理：

- `03-技能系统`、`05-技能规划`、`06-技能平衡`、`18-技能新增Codex护栏` 已改为“数据契约/展示/统计字段，尚未硬执行”。

### 3.2 `costs.partSlot.slotCost` 不是当前硬槽位消耗

旧写法容易理解为：`slotCost=2` 会真实占用两个部位槽。

当前事实：

- UI 可展示 `costs.partSlot`。
- `runtimeFlags.consumesPartSlot` 可从 `costs.partSlot.part` 派生。
- TurnPlanner 只校验 `slotKey` 对应部位的布局容量，不按 `slotCost` 占用多个槽。

处理：

- 相关文档已改为“契约/展示/平衡统计字段，尚未作为硬扣槽逻辑”。

### 3.3 `costs.perTurnLimit` 不是当前直接读取的限制

旧写法容易理解为：规划器直接按 `costs.perTurnLimit` 限制次数。

当前事实：

- 玩家技能包 45 个技能均声明 `costs.perTurnLimit`。
- TurnPlanner 当前不直接读取 `costs.perTurnLimit`。
- 当前同技能限制主要来自 `planningDraftBySkill` 的 `skillId` key 与 replace 语义。

处理：

- 文档已改为“当前字段存在，但硬限制来自草稿 key/replace 语义；若要按字段控制，需补 Planner 校验”。

### 3.4 `placement.maxSlots` 不是当前规划器事实

旧写法容易理解为：`placement.maxSlots` 会影响规划或槽位表现。

当前事实：

- 当前玩家技能包只有 `skill_heavy_swing` 保留 `placement.maxSlots=1`。
- 代码检索未发现 TurnPlanner/CoreEngine/UI 以 `placement.maxSlots` 做规划裁决。
- TurnPlanner 当前最大放置数来自 `target.selection.selectCount` 和草稿 `selectionResult.selectedParts`。

处理：

- 主文档已把 `placement.maxSlots` 改为历史/编排字段，不作为当前运行事实。

### 3.5 多选技能目标态与当前实现不一致

目标态：

- 多选技能一次规划应产生一条 `PlannedAction`，由 `selectionResult.selectedParts` 表达多个部位。

当前事实：

- `UI_SkillPanel` 使用 `planningDraftBySkill` 组织草稿。
- `TurnPlanner.planMany()` 对一个含多个 `placedSlots` 的草稿会按 slot 生成多条 action。
- `_rebuildSkillViews()` 中 `plannedBySkill[skillId]` 只保留最后一条 action，`skillToSlots[skillId]` 保留全部 slot。
- `CoreEngine._freezePlannerToQueue()` 冻结的是 `turnPlanner.getPlannedActions()` 数组，因此执行队列仍以 action 数组为准。

处理：

- `05-技能规划` 已把目标态和当前实现状态拆开写，并列为后续应收敛的设计债务。

### 3.6 `chance` 当前不是纯历史字段

旧写法容易理解为：项目设计不采用概率，因此 `chance` 只是兼容字段。

当前事实：

- `CoreEngine._applySkillBuffRefs()` 实际读取 `chance`，`chance < 1` 会通过 `Math.random()` 决定是否施加 Buff。
- 玩家技能包存在 1 个 `chance < 1` 的 Buff 施加技能。
- 敌人技能包存在 14 个 `chance < 1` 的 Buff 施加项。

处理：

- 主文档已改为：直接 action 无命中概率，但 `buffRefs.apply[].chance` 当前仍被实现和数据使用；若坚持确定性设计，应单独迁移。

## 4. 当前设计问题清单

### 4.1 规划约束字段已经写入数据，但运行时未硬执行

影响：

- 技能平衡如果依赖 `requirements.selfPart`、`partSlot.slotCost`、`perTurnLimit` 来控制强度，当前实际战斗不会兑现这些限制。
- 这会导致“设计上很受限、实际很自由”的强度漂移。

建议：

1. 先补 TurnPlanner/CoreEngine 的硬校验。
2. 再重新审查依赖这些字段做约束的技能。
3. 测试应增加负例：自身部位不可用、slotCost 超容量、perTurnLimit 超限时必须拒绝规划。

### 4.2 多选技能执行粒度需要尽快收敛

影响：

- 当前多选草稿可能展开为多条 action，可能导致时间线、执行次数、AP 语义与产品定义不一致。
- 如果后续设计大范围使用多目标、多部位技能，这个问题会放大。

建议：

1. 将 `TurnPlanner.planMany()` 改为每个 `skillId` 只生成一条 `PlannedAction`。
2. `placedSlots` 只作为 UI 映射写入 `skillToSlots` 或 action meta。
3. 执行器根据 `selectionResult.selectedParts` 做多部位 action 解析。

### 4.3 概率触发与确定性战斗口径冲突

影响：

- 用户已多次强调当前设计没有概率命中/概率判断概念。
- 当前敌人技能包大量使用 `chance < 1`，这会让战斗结果带随机性。

建议：

1. 短期：文档明确“这是当前实现事实，也是设计冲突点”。
2. 中期：把敌人技能概率触发改为确定性弱效果、AP/部位/冷却限制、或明确引入概率系统。
3. 若引入概率系统，需要单独写战斗随机性设计，不应只靠 `chance` 字段散落在技能中。

### 4.4 敌人技能与玩家技能共享 schema，但 AI 消费能力较浅

影响：

- 敌人技能可以写复杂 `requirements` 或多部位字段，但 `EnemyActionPlanner` 当前不会完整理解。
- 敌人技能越复杂，AI 选择越可能与真实执行或设计意图不一致。

建议：

1. 敌人技能短期保持简单：单目标、明确 AP、直接 actions/buffRefs。
2. 如果敌人要使用复杂技能，先扩展 `EnemyActionPlanner` 的 requirement、multi-part 和 buff-resource 评分理解。

## 5. 后续建议优先级

| 优先级 | 事项 | 原因 |
| --- | --- | --- |
| P0 | 补 `requirements/partSlot/perTurnLimit` 硬校验或明确从技能数据中弱化这些字段 | 直接影响技能强度与玩家理解 |
| P0 | 修正多选技能 action 粒度 | 直接影响执行次数、时间线和 AP 语义 |
| P1 | 处理 `chance < 1` 的确定性设计冲突 | 影响战斗可解释性 |
| P1 | 敌人 AI 对复杂技能字段的理解 | 影响敌人技能质量 |
| P2 | 清理 `placement.maxSlots` 残留字段 | 当前影响较小，但会造成误导 |
