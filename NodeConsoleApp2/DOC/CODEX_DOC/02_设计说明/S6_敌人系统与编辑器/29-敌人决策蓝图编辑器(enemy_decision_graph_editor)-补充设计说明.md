# 敌人决策状态机与蓝图编辑器补充设计说明

最后整理时间：2026-06-19

状态：`当前有效 / 下一轮实现基准`

适用范围：`S6_敌人系统与编辑器`

工程治理依据：`project-engineering-strategy`

## 1. 设计结论

敌人行为系统必须从“可拖拽节点图原型”收敛为一套真实可执行的敌人决策状态机。

本设计取代旧口径中的“第一阶段只做编辑器、运行时以后再接入”。从本轮规则起，敌人决策编辑器、路径预览、静态校验和战斗运行时必须共享同一套状态机语义。编辑器不是独立画图工具，运行时也不能另写一套隐藏 AI。

核心结论：

1. `enemyDecision` 是敌人行为唯一作者模型。
2. 敌人决策是有限状态机（Finite State Machine, FSM），不是回合意图循环，也不是优先级表。
3. 每个战斗中的敌人实例必须持有自己的运行时状态。
4. 蓝图编辑器只负责编辑状态机，不允许产生运行时无法执行的图。
5. 模板是作者工具，不是运行时继承链。
6. 没有向下兼容路径。`intentModel` 和 `decisionModel` 只能删除或忽略，不能继续参与编辑、发布或运行时决策。

## 2. 文档治理与落地原则

本文件是 S6 敌人行为规则的稳定补充设计文档。后续实现、测试和验收以本文为基准。

落地原则：

1. 正式文档根为 `NodeConsoleApp2/DOC/CODEX_DOC/`。
2. 本文件承接 S6 主设计文档，不新增平行敌人行为设计文档。
3. 模型、契约、校验和运行时语义优先于 UI 实现。
4. UI 的蓝图形态必须服务状态机规则，不能用视觉效果掩盖不可执行模型。
5. 任何实现偏离本文时，必须先更新本文或补充正式变更说明，再改代码。

## 3. 范围与非目标

### 3.1 本轮必须定义

1. 敌人决策状态机的数据结构。
2. 战斗运行时状态的保存位置和更新规则。
3. 节点、端口、连线、条件、行动、fallback 的语义。
4. 模板应用、技能绑定、路径预览和发布校验规则。
5. 蓝图编辑器必须支持的最小交互能力。
6. 当前原型和目标状态之间的差距。

### 3.2 本轮不定义

1. 多敌人协同 AI。
2. 自由脚本表达式。
3. 真实伤害结算模拟器。
4. 多人协作编辑。
5. 编辑器高级调试断点。
6. 关卡或战役的跨关 HP / 护甲继承规则。

## 4. 核心概念

### 4.1 作者态 enemyDecision

`enemyDecision` 存在于敌人模板中，描述“这个敌人拥有怎样的行为状态机”。

它保存：

1. 状态机 schema。
2. 模板来源。
3. 技能槽位绑定。
4. 节点和连线。
5. 编辑器布局。

它不保存：

1. 当前战斗中敌人正在处于哪个状态。
2. 上一回合真实行动。
3. 战斗日志。
4. 玩家跨关状态。

### 4.2 运行态 decisionRuntime

每个战斗中的敌人实例必须持有运行态字段，建议命名为 `decisionRuntime`。

示例：

```json
{
  "currentStateId": "state_normal",
  "previousStateId": "",
  "previousActionNodeId": "",
  "previousSkillId": "",
  "turnsInState": 0
}
```

运行态字段只存在于战斗实例，不写回 enemy pack。

### 4.3 蓝图编辑器

蓝图编辑器是 `enemyDecision` 的可视化作者工具。它必须遵守运行时规则。

编辑器不能允许以下内容进入发布包：

1. 运行时不支持的条件。
2. 类型不兼容的连线。
3. 无法解析技能的 Action。
4. 无法结束本回合的单回合循环。
5. 旧 `intentModel` / `decisionModel` 字段。

## 5. 数据结构目标

目标 schema 建议使用 `enemy_decision_state_machine_v1`。如果实现阶段决定沿用现有 `enemy_decision_graph_v1` 字符串，必须在同一轮实现中证明字段语义已经满足本文状态机规则；否则应升级 schemaVersion，避免把旧图原型误认为已完成状态机。

推荐结构：

```json
{
  "schemaVersion": "enemy_decision_state_machine_v1",
  "templateId": "tpl_basic_aggressor",
  "templateRevision": 1,
  "slotBindings": {
    "slot_basic_attack": "skill_throw_stone"
  },
  "graph": {
    "entryNodeId": "entry",
    "initialStateId": "state_normal",
    "nodes": [],
    "edges": []
  },
  "layout": {
    "viewport": { "x": 0, "y": 0, "zoom": 1 },
    "nodes": {}
  }
}
```

约束：

1. `graph.initialStateId` 只用于战斗实例初始化。
2. 回合执行必须读取敌人实例的 `decisionRuntime.currentStateId`。
3. `layout` 只归编辑器使用，运行时不得读取。
4. `slotBindings` 必须解析到当前敌人 `skills[]` 中的技能。

## 6. 战斗运行时求值规则

### 6.1 战斗实例初始化

敌人实例化时：

1. 读取 `enemyDecision.graph.initialStateId`。
2. 校验该 state 存在。
3. 写入实例 `decisionRuntime.currentStateId`。
4. 初始化 `previousStateId`、`previousActionNodeId`、`previousSkillId`、`turnsInState`。

如果初始化失败，战斗运行时应拒绝该敌人进入战斗，或在编辑器发布阶段提前阻止。

### 6.2 单回合求值流程

每个敌人行动回合：

1. 从 `decisionRuntime.currentStateId` 对应的 State 节点开始。
2. 按出边优先级进入 Branch 或 Action。
3. 遇到 Branch 时计算条件。
4. 根据 true / false 端口选择下一条边。
5. 遇到 Action 时解析技能。
6. 校验 AP、目标、部位和技能存在性。
7. 合法则输出行动。
8. 非法则进入 fallback。
9. Action 完成后按 `nextStateId` 更新 `currentStateId`。
10. 若 Action 没有 `nextStateId`，默认保持原状态。
11. 更新 `previousStateId`、`previousActionNodeId`、`previousSkillId`、`turnsInState`。

单回合最大节点步数固定为 32。超过上限视为状态机错误。

### 6.3 跨回合状态持久化

状态机允许跨回合循环。

合法示例：

```text
state_normal -> action_attack -> nextStateId: state_normal
state_normal -> branch_low_hp -> state_recover -> action_heal -> nextStateId: state_normal
```

非法示例：

```text
state_normal -> branch_a -> state_normal
```

如果这条路径没有 Action 结束本回合，就是单回合无动作循环，必须报错。

## 7. 节点规则

### 7.1 Entry 节点

Entry 只用于图入口声明。

规则：

1. 每张图必须有且只有一个 Entry。
2. Entry 必须连接到一个 State。
3. Entry 不允许连接 Action。
4. 运行时回合求值不从 Entry 开始，Entry 只参与初始化校验。

### 7.2 State 节点

State 是敌人可以持久停留的行为状态。

示例：

1. `state_normal`：默认攻击。
2. `state_recover`：恢复。
3. `state_counter_stance`：反击姿态。
4. `state_charging`：蓄力。
5. `state_phase_2`：二阶段。

字段：

```json
{
  "id": "state_normal",
  "type": "state",
  "label": "默认状态",
  "description": "基础攻击和低血检查",
  "fallbackNodeId": "action_basic_attack"
}
```

规则：

1. State 必须至少有一条出边或 fallback。
2. State 可以连接 Branch、Action 或另一个 State。
3. State 不直接输出技能。
4. State 可以被 `nextStateId` 设置为下一回合状态。

### 7.3 Branch 节点

Branch 是 if-else 判断节点。

字段：

```json
{
  "id": "branch_low_hp",
  "type": "branch",
  "label": "HP 低于 35%",
  "condition": {
    "type": "self_hp_ratio_lte",
    "value": 0.35
  }
}
```

规则：

1. Branch 必须有 true 出口。
2. Branch 必须有 false 出口。
3. Branch 不能直接执行技能。
4. Branch 条件必须来自正式条件目录。
5. Branch 不允许使用任意 JavaScript 表达式。

### 7.4 Action 节点

Action 是本回合行动输出。

字段：

```json
{
  "id": "action_bleed_cut",
  "type": "action",
  "label": "流血切割",
  "skillSlotId": "slot_bleed_attack",
  "targetRule": "player_weak_part",
  "telegraph": false,
  "fallbackNodeId": "action_basic_attack",
  "nextStateId": "state_normal"
}
```

规则：

1. Action 必须解析到一个 skillId。
2. skillId 必须属于当前敌人的 `skills[]`。
3. skillId 必须能在敌人技能包中解析。
4. targetRule 必须来自 `decisionTargetRules`。
5. 高威胁动作可设置 `telegraph`。
6. 可能不可用的 Action 必须有 fallback。
7. Action 是单回合求值的正常终点。

## 8. 端口与连线规则

蓝图编辑器必须显示真实端口，不能只提供一个泛化“连出”按钮。

### 8.1 端口类型

| 节点 | 输入端口 | 输出端口 |
| --- | --- | --- |
| Entry | 无 | `flow` |
| State | `flow` | `flow`、`fallback` |
| Branch | `flow` | `true`、`false` |
| Action | `flow` | `fallback`、`nextState` |

### 8.2 连接规则

1. `flow` 只能连接到可被流程进入的节点。
2. Branch 的 `true` / `false` 只能从 Branch 节点发出。
3. Action 的 `nextState` 只能连接 State。
4. fallback 可以连接 Action、Branch 或 State，但必须保证最终能到达 Action。
5. 类型不兼容的连接必须在拖线时阻止。
6. 删除节点时必须提示将删除相关连线。

### 8.3 连线字段

```json
{
  "id": "edge_low_hp_true",
  "from": "branch_low_hp",
  "fromPort": "true",
  "to": "state_recover",
  "toPort": "flow",
  "priority": 100,
  "label": "低血恢复"
}
```

第一版可以保留 `branch: "true"` 作为数据字段，但 UI 和校验器必须把它解释为端口，而不是普通文本标签。

## 9. 条件目录

第一版只允许运行时、预览器、校验器共同支持的条件。

| 条件 | 参数 | 含义 |
| --- | --- | --- |
| `always` | 无 | 永真 |
| `self_hp_ratio_lte` | `value` | 自身 HP 比例小于等于阈值 |
| `self_hp_ratio_gte` | `value` | 自身 HP 比例大于等于阈值 |
| `turn_number_modulo` | `mod`、`equals` | 回合数取模 |
| `skill_available` | `skillId` 或 `skillSlotId` | 技能存在、AP 足够、目标可选 |
| `has_self_buff` | `buffId`、`minStacks` | 自身拥有指定 Buff |
| `player_part_armor_lte` | `partId`、`value` | 玩家指定部位护甲低于阈值 |
| `previous_state_is` | `stateId` | 上回合结束状态 |
| `previous_action_is` | `actionNodeId` | 上回合动作节点 |

实现规则：

1. 未实现条件不得出现在编辑器下拉框。
2. 数据包 `meta.enums.decisionConditionTypes` 必须和运行时支持能力一致。
3. 条件参数必须有类型校验。
4. 条件说明必须在编辑器中显示为中文。
5. 条件失败不能抛出运行时异常，应返回 false 并写入 trace warning。

## 10. 技能绑定规则

敌人能力必须经过这条链路才算真实可执行：

```text
capabilities[] 说明设计意图
  -> skills[] 声明敌人拥有的具体技能
  -> enemyDecision.action 绑定技能或技能槽位
  -> 状态机求值选择 Action
  -> 运行时校验技能合法性
  -> 输出真实行动
```

绑定方式：

1. 模板 Action 优先使用 `skillSlotId`。
2. 敌人实例 Action 可以使用 `skillId`。
3. `skillSlotId` 必须通过 `slotBindings` 解析。
4. 解析结果必须存在于当前敌人的 `skills[]`。
5. `skills[]` 删除某个技能时，不自动删除 Action，但 Action 必须变为 error。

编辑器要求：

1. 左侧敌人技能库显示技能名、skillId、AP、目标类型和关键标签。
2. 技能可拖到 Action 节点或 slot 绑定区。
3. 右侧属性面板允许修改技能绑定。
4. 绑定失败时给出明确错误原因。

## 11. 模板规则

模板是作者工具，不是运行时继承。

模板保存位置：

```json
{
  "decisionGraphTemplates": {
    "tpl_basic_aggressor": {}
  }
}
```

应用模板时：

1. 复制模板图到当前敌人的 `enemyDecision.graph`。
2. 写入 `templateId` 和 `templateRevision`。
3. 要求作者完成 slotBindings。
4. 允许作者自由修改实例图。
5. 模板后续更新不自动影响已应用敌人。

模板操作必须真实可用：

1. 新建模板。
2. 复制模板。
3. 删除模板。
4. 重命名模板。
5. 从当前敌人图保存为模板。
6. 应用模板到当前敌人。
7. 应用模板更新到当前敌人。

删除模板时，已应用敌人不删除图，只显示“模板已不存在，当前图已脱离模板”。

## 12. 蓝图编辑器规则

### 12.1 总体布局

编辑器采用三栏一画布：

```text
左侧：模板 / 技能 / 节点库
中间：蓝图画布
右侧：节点属性 / 端口 / 预览上下文
底部或右侧：路径预览 / 校验问题
```

全屏模式是核心入口，不是附属小功能。全屏模式下只展示敌人决策编辑器，但必须保留退出全屏、保存状态提示和校验入口。

### 12.2 画布能力

最低要求：

1. 节点拖拽。
2. 画布平移。
3. 缩放。
4. 真实端口连接。
5. 连线预览。
6. 连线选择和删除。
7. 多选和框选。
8. 撤销 / 重做。
9. 脏状态提示。
10. 节点和连线的中文标签。

### 12.3 属性面板

属性面板必须可编辑，不是只读摘要。

State 属性：

1. 显示名。
2. 说明。
3. fallback。
4. 出边优先级。

Branch 属性：

1. 条件类型。
2. 条件参数。
3. true / false 出口。
4. 条件说明。

Action 属性：

1. 显示名。
2. 绑定方式。
3. skillId 或 skillSlotId。
4. targetRule。
5. telegraph。
6. fallback。
7. nextStateId。

## 13. 校验规则

校验分为结构校验、运行时校验、设计有效性校验。

### 13.1 结构校验

| 规则 | 级别 |
| --- | --- |
| 缺少 Entry | error |
| Entry 超过一个 | error |
| Entry 未连接 State | error |
| initialStateId 不存在 | error |
| currentStateId 初始化目标不存在 | error |
| 节点 id 重复 | error |
| 连线引用不存在节点 | error |
| 端口类型不兼容 | error |
| Branch 缺少 true / false 出口 | error |
| 单回合无动作循环 | error |
| 不可达节点 | warning |

### 13.2 技能校验

| 规则 | 级别 |
| --- | --- |
| Action 无 skillId 且无 skillSlotId | error |
| skillSlotId 未绑定 | error |
| skillId 不在当前敌人 skills[] | error |
| skillId 不存在于敌人技能包 | error |
| AP 成本高于敌人 AP | warning |
| targetRule 与技能目标不兼容 | warning |

### 13.3 设计有效性校验

| 规则 | 级别 |
| --- | --- |
| State 多条普通出边但无条件区分，导致低优先级永远不可达 | warning |
| Action 永远不会被执行 | warning |
| fallback 指向自身且无中止动作 | error |
| telegraph 高威胁动作没有前置可读状态 | warning |
| 模板 Action 硬编码具体 skillId | warning |
| 当前图只是在重复技能列表，没有形成状态或条件 | warning |

校验器必须服务设计决策，不只是 JSON 结构检查。

## 14. 路径预览规则

路径预览使用和运行时相同的 evaluator。

预览输入：

1. 初始 state。
2. 初始回合号。
3. 模拟回合数。
4. 敌人 HP 比例。
5. 敌人 AP。
6. 敌人 Buff。
7. 玩家各部位护甲。
8. 上一状态。
9. 上一行动。

预览输出：

```json
{
  "turn": 1,
  "startStateId": "state_normal",
  "visitedNodes": ["state_normal", "branch_low_hp", "action_attack"],
  "conditionResults": [
    { "nodeId": "branch_low_hp", "result": false }
  ],
  "selectedActionNodeId": "action_attack",
  "selectedSkillId": "skill_throw_stone",
  "nextStateId": "state_normal",
  "fallbacks": [],
  "warnings": []
}
```

预览不是伤害模拟器，不计算真实胜负和平衡结果。它只回答状态机路径是否符合设计预期。

## 15. 发布规则

发布 runtime pack 前必须满足：

1. 不包含 `intentModel`。
2. 不包含 `decisionModel`。
3. 每个敌人都有合法 `enemyDecision`。
4. 状态机结构校验无 error。
5. 技能绑定校验无 error。
6. 条件类型全部被运行时支持。
7. 每个敌人至少能在默认上下文中规划一个合法首回合行动。
8. 如果运行时 evaluator 未实现本文规则，禁止发布 runtime pack。

保存 authoring draft 可以允许 warning，但必须在 UI 中保留清晰标记。

## 16. 无向下兼容规则

硬性规则：

1. 不读取旧 `intentModel` 生成新图。
2. 不读取旧 `decisionModel` 生成新图。
3. 不把新状态机反向生成旧字段。
4. 不在运行时保留旧优先级表作为兼容路径。
5. 不用 `legacy`、`compatibility`、`generated` 字段隐藏双写。

如果打开缺少 `enemyDecision` 的敌人，只能根据 `skills[]` 生成一个保守默认起点。这不是迁移旧行为，而是新模型缺失时的作者起点。

## 17. 模块边界

建议实现拆分：

```text
script/editor/enemy/decision/
  EnemyDecisionStateMachineModel.js
  EnemyDecisionStateMachineEvaluator.js
  EnemyDecisionStateMachineValidator.js
  EnemyDecisionTemplateStore.js
  EnemyDecisionGraphRenderer.js
  EnemyDecisionGraphEditor.js
  enemyDecisionGraph.css
```

运行时建议新增或改造：

```text
script/engine/EnemyDecisionStateMachineRuntime.js
script/engine/EnemyActionPlanner.js
```

职责：

| 模块 | 职责 |
| --- | --- |
| Model | 图数据、节点、端口、连线、schema normalize |
| Evaluator | 单回合状态机求值，供预览和运行时共用 |
| Validator | 静态校验、运行时校验、设计有效性校验 |
| TemplateStore | 模板 CRUD、应用模板、保存为模板 |
| Renderer | 画布、端口、连线、拖拽、缩放、选择 |
| Editor | 集成入口，负责 UI 协调和脏状态 |
| Runtime | 敌人实例 currentStateId、trace、行动输出 |

`EnemyEditorPage.js` 只负责集成当前敌人、技能包、模板库、保存和发布，不承载状态机内部规则。

## 18. 当前原型差距

当前实现只能作为原型，不满足本文完成定义。

主要差距：

1. 每回合仍近似从静态 initialState 开始，缺少真实 `decisionRuntime.currentStateId`。
2. 模板按钮只改 `templateId/templateRevision`，没有真实应用模板。
3. 技能区只是展示 chip，不是可绑定技能库。
4. 节点没有真实输入/输出端口。
5. “连出”不是蓝图式连接语法。
6. 属性面板只读，不能编辑条件、技能、fallback、nextState。
7. 校验器不能发现永远不会执行的 Action。
8. 预览和运行时没有明确共享 evaluator。
9. 条件枚举和实际支持能力不一致。
10. UI 仍存在少量英文或技术字段直出。

这些差距必须在实现计划中作为正式任务拆分。

## 19. 完成定义

满足以下条件才算敌人决策状态机第一轮完成：

1. 敌人编辑器只保留“敌人决策”概念。
2. 旧 `intentModel` / `decisionModel` 不再参与任何路径。
3. 每个敌人实例拥有运行时 currentState。
4. 预览和运行时共用同一套 evaluator。
5. 蓝图 UI 有真实端口、连线、节点属性编辑。
6. 模板应用会复制图并要求技能槽位绑定。
7. Action 可以绑定当前敌人技能。
8. 校验器能发现结构错误、技能错误和关键设计无效问题。
9. runtime pack 发布会阻止 error 状态机。
10. 当前主入口、敌人编辑器、技能编辑器、技能测试器、地图编辑器、关卡编辑器不因改动报错。
11. `npm test` 通过。
12. 有至少一个路径预览 trace 与运行时首回合规划结果一致的回归测试。

## 20. 推荐实施顺序

1. 先实现状态机 Model、Evaluator、Validator。
2. 将路径预览切到共享 Evaluator。
3. 将 `EnemyActionPlanner` 改为消费同一 Evaluator。
4. 补齐 `decisionRuntime.currentStateId`。
5. 重做模板应用和 slotBindings。
6. 重做蓝图画布端口、连线和属性面板。
7. 更新 enemy pack schema、meta.enums 和现有敌人数据。
8. 最后做全屏编辑器可用性和视觉整理。

这个顺序保证先有真实规则，再有编辑体验。
