# 敌人系统设计说明

最后整理时间：2026-06-19

状态：`当前有效 / 敌人决策图口径`

归属子系统：`S6_敌人系统与编辑器`

关联子系统：

1. `S2_战斗运行时`
2. `S3_关卡地图与编辑器`
3. `S4_技能系统与编辑器`
4. `S5_Buff系统与编辑器`
5. `S7_数据存档与内容契约`

行为编辑器细节以 [29-敌人决策蓝图编辑器(enemy_decision_graph_editor)-补充设计说明](./29-敌人决策蓝图编辑器(enemy_decision_graph_editor)-补充设计说明.md) 为准。

## 1. 当前结论

敌人模板只负责定义战斗内威胁。跨关 HP、护甲、补给、路线消耗和战后状态清理属于关卡、路线或战役规则，不写在敌人模板里。

当前敌人行为只允许通过 `enemyDecision` 决策图表达：

1. 旧行为字段 `intentModel` 已退役。
2. 旧行为字段 `decisionModel` 已退役。
3. 编辑器不显示旧行为页签。
4. 发布包不生成旧行为字段。
5. 运行时不读取旧行为字段。
6. 如果导入数据里残留旧行为字段，工作区只做删除和忽略，不做自动迁移或双写。

这次是硬切换，不提供向下兼容设计。

## 2. 敌人系统职责

敌人系统负责回答四个问题：

1. 这个敌人拥有什么战斗资源：HP、护甲、部位、AP、速度。
2. 这个敌人能使用哪些敌技：`skills[]` 中列出的技能。
3. 这个敌人怎样在回合中选择行动：`enemyDecision.graph`。
4. 这个敌人怎样被编辑器、地图编辑器和战斗 UI 展示：`presentation`。

敌人系统不负责：

1. 决定玩家是否关后满血。
2. 决定玩家护甲是否带入下一关。
3. 决定战役路线补给和消耗。
4. 替关卡系统设计敌人组合预算。
5. 动态读取玩家完整构筑并临场改变敌人策略。

## 3. 数据分层

当前敌人模板分成四层。

### 3.1 运行时核心字段

运行时核心字段会影响实例化、行动选择或展示：

1. `id`
2. `name`
3. `race`
4. `class`
5. `stats`
6. `bodyParts`
7. `skills[]`
8. `enemyDecision`
9. `presentation`

### 3.2 作者设计字段

作者设计字段解释敌人为什么这样设计，但不是行动选择输入：

1. `mechanicProfile`
2. `capabilities[]`
3. `buildCheck`
4. `failureDiagnosis`
5. `playerResponseNotes`

这些字段可以用于发布审核、编辑器提示和平衡说明，但 `EnemyActionPlanner` 不应把它们当作 if-else 条件。

### 3.3 诊断字段

诊断字段用于检查内容质量：

1. 技能引用是否存在。
2. 技能 AP 是否可支付。
3. 行为图是否有入口、状态、动作和合法边。
4. 高压敌人是否有可读反制窗口。
5. 当前关卡资源预算是否能解释敌人造成的损耗。

### 3.4 关卡 / 战役字段

以下字段不属于敌人：

1. HP 继承策略。
2. 护甲继承策略。
3. 战后状态清除策略。
4. 补给节点。
5. 路线消耗预算。
6. 敌人池组合预算。

## 4. 敌人决策图

`enemyDecision` 是敌人行为唯一作者模型。

推荐结构：

```json
{
  "schemaVersion": "enemy_decision_graph_v1",
  "templateId": "tpl_basic_aggressor",
  "templateRevision": 1,
  "slotBindings": {},
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

### 4.1 节点类型

| 节点 | 作用 | 运行时含义 |
| --- | --- | --- |
| `entry` | 决策图入口 | 每张图必须有一个入口 |
| `state` | 当前行为状态 | 回合从当前状态开始执行 |
| `branch` | 条件分支 | 根据战斗上下文选择 true / false 出边 |
| `action` | 行动输出 | 绑定一个敌技并输出目标规则 |

### 4.2 条件类型

第一版只开放已经被编辑器、校验器、预览器和运行时共同支持的条件：

1. `always`
2. `self_hp_ratio_lte`
3. `self_hp_ratio_gte`
4. `turn_number_modulo`
5. `previous_action_is`

未实现的阶段、反击后触发、标记后触发、复杂表达式和脚本条件不得出现在下拉框或发布包中。

### 4.3 动作绑定

`action` 节点必须满足以下规则：

1. `skillId` 必须存在于当前敌人的 `skills[]`。
2. `skillId` 必须能在敌人技能包中解析。
3. 如果使用模板槽位，`skillSlotId` 必须能通过 `slotBindings` 解析为技能。
4. `targetRule` 必须来自 `meta.enums.decisionTargetRules`。
5. AP 不足时运行时应回退到合法候选，而不是强行执行非法技能。

### 4.4 布局不是规则

`enemyDecision.layout` 只保存编辑器坐标和缩放。运行时不得根据节点坐标推断优先级、阶段或行动顺序。

## 5. 模板机制

决策模板是作者工具能力，不是运行时继承链。

模板用于快速生成常见敌人行为：

1. 基础攻击者。
2. 低血自保者。
3. 蓄力爆发者。
4. DOT 压力者。
5. 支援单位。
6. Boss 阶段机。

模板应用到敌人后应复制为敌人自己的 `enemyDecision` 实例。模板后续修改不应自动影响已应用敌人，除非作者显式执行“应用模板更新”。

## 6. 敌人能力与敌技

`capabilities[]` 描述敌人拥有哪些机制能力；`skills[]` 和 `enemyDecision.graph` 决定这些能力是否真的可执行。

能力进入运行时必须经过这条链：

```text
capabilities[] 说明设计意图
  -> skills[] 提供具体敌技
  -> enemyDecision.action 绑定敌技
  -> EnemyActionPlanner 做合法性检查
  -> 输出真实行动
```

如果一个能力只写在 `capabilities[]` 中，但没有敌技和 `action` 节点支撑，它只是设计声明，不是运行时能力。

## 7. 战斗压力边界

敌人可以制造本场战斗内压力：

1. HP 损耗。
2. 护甲损耗。
3. 部位弱点压力。
4. DOT 压力。
5. 控制节奏压力。
6. 蓄力爆发压力。
7. 治疗或修甲拖延。
8. 反击或姿态惩罚。

敌人不能声明这些损耗是否进入下一关。关卡或战役系统决定：

1. 战后 HP 是否继承。
2. 战后护甲是否继承。
3. 普通临时 Buff / Debuff 是否清理。
4. 是否给予治疗、修甲或补给。

因此敌人模板中不保留 `runPressure` 和 `statePersistence`。

## 8. Enemy Pack 契约

当前发布包使用 `enemies_v2_1`：

```json
{
  "$schemaVersion": "enemies_v2_1",
  "meta": {
    "contentDomain": "enemy",
    "selectedPackId": "enemy_v2_story",
    "fieldNotes": {},
    "enums": {},
    "enumDescriptions": {},
    "decisionGraphTemplates": {}
  },
  "enemies": {}
}
```

编辑器必须优先读取 `meta.enums` 生成控件：

1. `races`
2. `classes`
3. `tags`
4. `capabilityTypes`
5. `capabilityCadences`
6. `capabilityPressures`
7. `counterplay`
8. `decisionConditionTypes`
9. `decisionTargetRules`
10. `decisionGraphTemplateIds`
11. `enemySkillIds`
12. `bodyParts`

`meta.enums` 是编辑器控件来源，不等于所有字段都是运行时条件。尤其是 `capabilities[].cadence`、`capabilities[].pressure` 和 `capabilities[].counterplay[]` 仍然是作者设计资料，不是行动触发器。

## 9. 编辑器要求

敌人编辑器必须提供以下主入口：

1. 身份。
2. 数值部位。
3. 自身能力。
4. 敌人决策。
5. 资产引用。

敌人决策页必须支持：

1. 模板列表。
2. 当前敌人技能列表。
3. 节点画布。
4. 节点检查器。
5. 添加状态、分支、行动。
6. 校验问题。
7. 路径预览。

编辑器不得提供旧行为页签，也不得在高级 JSON 或发布包中重新生成旧行为字段。

## 10. 运行时要求

运行时选择流程：

```text
enemyDecision.graph
  -> 从当前 state 开始
  -> 执行 branch 条件
  -> 到达 action 节点
  -> 解析 skillId / skillSlotId
  -> 检查 AP、目标、部位和技能存在性
  -> 合法则执行
  -> 非法则回退到评分候选
```

`EnemyActionPlanner` 可以在图选择失败时走评分兜底，但兜底只用于保证战斗不断裂，不代表旧行为模型仍然存在。

## 11. 测试与验收

进入可提交状态前至少验证：

1. 敌人包中每个敌人都有 `enemyDecision.schemaVersion === "enemy_decision_graph_v1"`。
2. 敌人包不包含旧行为字段。
3. 编辑器页面不存在旧行为页签。
4. 编辑器能保存 authoring draft。
5. 编辑器能发布当前 enemy pack。
6. `EnemyActionPlanner` 能从 `enemyDecision.graph` 规划首回合行动。
7. 主入口、技能编辑器、地图编辑器和关卡编辑器 HTTP 页面不因本改动报 404。

## 12. 后续方向

后续扩展应沿着决策图增加显式能力：

1. Boss 阶段模板。
2. 反击姿态模板。
3. 多回合蓄力模板。
4. 支援单位模板。
5. 战斗日志和编辑器路径预览对照。

禁止通过恢复旧行为字段、塞隐藏脚本或扩展作者标签来绕过决策图模型。
