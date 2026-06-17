# 敌人系统设计说明

最后整理时间：2026-05-31

状态：`当前唯一敌人设计主文档`

归属子系统：`S6_敌人系统与编辑器`

关联子系统：

1. `S1_主游戏流程`
2. `S2_战斗运行时`
3. `S3_关卡地图与编辑器`
4. `S4_技能系统与编辑器`
5. `S5_Buff系统与编辑器`
6. `S7_数据存档与内容契约`

数值基准：敌人血量、护甲、技能压力、击败轮数和玩家有效输出折扣，优先遵循 [战斗数值基准模型](../00_总纲/03-战斗数值基准模型(combat_numeric_baseline)-设计说明.md)。

## 1. 文档定位

本文是敌人系统的统一设计事实源。后续不要再把敌人机制、敌人平衡、敌人迁移表、流程压力和反制矩阵拆成多份并列设计说明。

敌人编辑器作为工具边界，仍保留独立文档：[28-敌人编辑器(enemy_editor)-设计说明](./28-敌人编辑器(enemy_editor)-设计说明.md)。

本文回答：

1. 敌人系统服务什么游戏体验。
2. 敌人怎样从静态属性升级为机制化模板。
3. 单关压力和整轮流程压力怎样区分。
4. 敌人技能和攻击策略怎样设计。
5. V2-lite 数据字段和运行时使用边界是什么。
6. 后续如何迁移现有三章 30 关敌人。

## 2. 核心设计判断

敌人不是单关一次性障碍，而是整轮游戏资源管理的一部分。

如果每关结束后玩家自动回满 HP / 护甲，那么敌人之间会变得孤立：上一关造成的损耗不影响下一关，磨血、拖延、路线选择和补给节点的价值都会下降。后续设计改为连续流程口径：

1. 进入下一关时，玩家默认不自动回满。
2. 跨关继承玩家当前 HP。
3. 跨关继承玩家当前护甲 / 部位护甲状态。
4. 战斗结束时清除普通临时状态。

跨关不继承：

1. 流血。
2. 中毒。
3. 减速。
4. 易伤。
5. 眩晕。
6. 战斗内临时 Buff / Debuff。
7. 普通技能铺垫标记。

因此，流血和中毒不是跨关状态。它们只在本关内造成 HP 损失；战斗结束后状态清除，但已经损失的 HP 会带入下一关。

```text
本关中毒 -> 多损失 20 HP -> 战斗结束中毒清除 -> 少掉的 20 HP 带入下一关
```

## 3. 设计目标

敌人系统的目标不是单纯增加敌人数量，而是让敌人成为玩家构筑、路线选择和资源管理的检查点。

设计目标：

1. 敌人职责清晰：每个正式敌人要能说明它检查玩家什么能力。
2. 行为可解释：关键高压行为必须能通过意图、倒计时、阶段提示或日志解释。
3. 反制可推断：玩家失败时能知道缺的是输出、防御、治疗、破甲、控制、净化还是路线资源。
4. 流程可持续：敌人可以通过 HP / 护甲损耗服务整轮流程，但不能形成无解死亡螺旋。
5. 实现轻量：不做复杂智能 AI，优先使用机制标签、固定意图循环、技能用途标签、AP / 冷却 / fallback。

## 4. 敌人数据分层模型

敌人文档必须区分三类资料：

1. 运行时核心字段：主流程和战斗运行时直接消费，缺失会影响实例化、行动选择或展示。
2. 作者设计资料：帮助设计者说明敌人为什么这样配置，通常由编辑器、测试和内容生成流程消费。
3. 设计诊断与验证资料：帮助审查敌人是否公平、是否可反制、是否满足章节职责；缺失不应阻塞主流程运行，但可以阻塞内容发布或平衡验收。

不要把这三类资料写成同一层“核心属性”。否则会把诊断资料误解成敌人运行时能力。

分层模型：

```text
EnemyTemplate =
  + BodyProfile
  + SkillProfile
  + IntentModel
  + PresentationProfile
  + StatePersistence

EnemyAuthoringProfile =
  GrowthBudget
  + ResponsibilityProfile
  + CapabilityProfile
  + RunPressureProfile
  + MechanicProfile

EnemyDesignDiagnostics =
  PlayerResponseNotes
  + BuildCheck
  + FailureDiagnosis
  + PressureValidation
  + RouteAndChapterValidation
```

运行时核心字段：

| 模块 | 作用 | 运行时关系 |
| --- | --- | --- |
| `BodyProfile` | HP、护甲、部位、弱点和受击策略 |
| `SkillProfile` | 技能组怎样制造压力、窗口或续航 |
| `IntentModel` | 敌人固定行为节奏和 fallback |
| `PresentationProfile` | 编辑器、地图和战斗 UI 的展示摘要 |
| `StatePersistence` | 战后哪些状态清除，哪些资源状态跨关保留 |

作者设计资料：

| 模块 | 作用 | 边界 |
| --- | --- | --- |
| `GrowthBudget` | 当前章节和关卡允许该敌人占用多少战斗预算 | 用于平衡约束，不是主流程实例化必需 |
| `ResponsibilityProfile` | 敌人在单关中负责检查什么能力 | 用于设计说明和关卡职责矩阵，不是运行时决策条件 |
| `CapabilityProfile` | 敌人自己拥有哪些机制能力 | 必须能落到敌技和 `intentModel.pattern` 才算已实现 |
| `RunPressureProfile` | 敌人是否服务整轮路线资源消耗 | 解释 HP / 护甲损耗怎样进入连续流程 |
| `MechanicProfile` | 机制槽位、目标回合、预算和失败信号 | 用于编辑器和测试定位 |

设计诊断与验证资料：

| 模块 | 作用 | 边界 |
| --- | --- | --- |
| `PlayerResponseNotes` | 玩家理论上可以怎样应对该敌人 | 不是敌人 AI 输入 |
| `BuildCheck` | 该敌人检查哪些构筑短板 | 当前不动态读取玩家构筑 |
| `FailureDiagnosis` | 玩家失败时应解释为哪类问题 | 用于日志、测试和调参，不直接改行为 |
| `PressureValidation` | 单关压力和流程压力是否合理 | 用于发布验收 |
| `RouteAndChapterValidation` | 敌人是否符合路线风险和章节职责 | 用于关卡内容审核 |

### 4.1 敌人行为决策循环

敌人行为决策循环是运行时主干。作者设计资料和设计诊断资料必须能解释这条主干，但不能冒充这条主干。

当前 V2-lite 不做复杂智能 AI，也不让敌人动态分析玩家构筑。当前可执行循环定义为：

```text
TurnContext
  -> resolveIntent
  -> collectSkillCandidates
  -> filterByLegality
  -> filterByIntent
  -> scoreCandidates
  -> chooseAction
  -> fallbackIfNeeded
```

各阶段职责：

| 阶段 | 输入 | 输出 | 当前运行时语义 |
| --- | --- | --- | --- |
| `TurnContext` | 敌人模板、敌人当前状态、玩家状态、回合序号 | 本回合决策上下文 | 提供 HP、AP、部位、技能列表和回合 index |
| `resolveIntent` | `intentModel.pattern[]`、`intentModel.fallback`、回合序号 | 当前 intent token | 按固定循环取 token；这是当前唯一明确的行为节奏来源 |
| `collectSkillCandidates` | 敌人 `skills[]` 和敌技包 | 候选技能列表 | 只从该敌人已配置技能里选，不凭空生成动作 |
| `filterByLegality` | AP、目标、部位、技能可用性 | 合法候选 | AP 不足、目标不存在、部位非法时不能释放 |
| `filterByIntent` | intent token、技能标签、技能效果摘要 | 符合当前意图的候选 | 例如 `bleed` 匹配施加流血的技能，`heavy_attack` 匹配高伤技能 |
| `scoreCandidates` | 合法候选、敌我状态、部位弱点 | 排序结果 | 在同一 intent 下选更合适的目标和技能 |
| `chooseAction` | 排序结果 | 敌人行动 | 输出 skillId、targetId、bodyPart、speed、cost |
| `fallbackIfNeeded` | fallback token、全部合法候选 | 降级行动 | intent 找不到可用技能时尝试 fallback，再退回评分最高技能 |

这条循环决定什么是“能执行”的行为。其他字段和它的关系如下：

| 字段 | 在决策循环里的位置 | 不是 |
| --- | --- | --- |
| `capabilities[]` | 解释敌人为什么拥有这些技能和机制，用于设计、编辑器、测试诊断 | 不是触发器，不直接出招 |
| `capabilities[].cadence` | 描述该能力期望出现在循环中的节奏密度 | 不是冷却实现，不是 HP 阈值触发 |
| `capabilities[].pressure` | 描述该能力制造什么压力，方便平衡和诊断 | 不是 planner 分支 |
| `capabilities[].counterplay[]` | 描述玩家应该怎样应对 | 不是敌人 AI 条件 |
| `intentModel.pattern[]` | 当前运行时行为节奏的主要输入 | 不是完整智能，只是固定意图循环 |
| `runPressure` | 解释行动结果怎样转化为跨关 HP / 护甲损耗 | 不是单回合行动选择器 |
| `buildCheck` | 失败诊断和设计校验 | 当前不动态读取玩家构筑 |

因此，设计顺序必须是：

```text
敌人职责
  -> 敌人拥有的能力
  -> 能力对应的敌技
  -> intentModel.pattern 安排行为节奏
  -> EnemyActionPlanner 按循环选择技能
  -> 行动结果形成单关压力或流程压力
  -> PlayerResponseNotes / FailureDiagnosis 解释玩家反制和失败原因
```

如果某个能力不能落到敌技，或不能进入 `intentModel.pattern` 支撑的行为循环，它就不能被当作已实现机制，只能是待实现设计说明。

如果缺少 `PlayerResponseNotes`、`BuildCheck` 或 `FailureDiagnosis`，主流程仍然可以运行；但该敌人不应直接进入正式发布或平衡验收，因为设计者无法判断它是否公平、可读、可反制。

### 4.2 传统规则参考后的决策模型

敌人决策不应凭空发明。参考传统游戏 AI 和回合制 / 卡牌敌人设计，可分出几类常见做法：

| 做法 | 常见使用场景 | 优点 | 对本项目的取舍 |
| --- | --- | --- | --- |
| 状态机 / 阶段机 | Boss 阶段、怪物姿态、低血转阶段 | 简单、稳定、可解释 | 保留为后续 `phase/state` 输入，不作为当前主循环唯一机制 |
| 行为树 | 实时 NPC、复杂条件分支、巡逻/战斗/逃跑切换 | 结构清晰，适合大量条件组合 | 当前回合制敌人不需要完整行为树；可借鉴 Selector 的“条件优先表” |
| GOAP / 规划 AI | 实时战术 NPC，目标、资源、动作链复杂 | 能自动规划多步行为 | 对当前项目过重，且会降低敌人意图可读性 |
| Utility AI | 多个可行动作之间按状态打分 | 适合同类候选中选最优动作 | 保留轻量评分，用在 intent 匹配后的候选排序 |
| 固定意图 / 技能轮换 | 卡牌、回合制、Boss 技能表 | 玩家可预判，易测试 | 作为当前核心：意图时间线和条件优先表 |

因此，本项目采用混合模型，而不是完整行为树或 GOAP：

```text
EnemyDecisionModel =
  PhaseState
  + IntentTimeline
  + ActionPriorityTable
  + LegalityCheck
  + TargetRule
  + UtilityScore
  + Telegraph
  + Fallback
```

各模块定位：

| 模块 | 作用 | 当前实现状态 |
| --- | --- | --- |
| `PhaseState` | 表示普通阶段、预兆阶段、Boss 阶段、低血阶段等 | 当前只作为未来扩展，尚未运行时解析 |
| `IntentTimeline` | 提供固定、可预告的回合意图序列 | 当前由 `intentModel.pattern[]` 实现 |
| `ActionPriorityTable` | 用优先级和条件选择具体技能 | 当前由 `decisionModel.actions[]` 的轻量优先级表实现，替代散落标签 |
| `LegalityCheck` | 检查 AP、冷却、目标、部位和技能可用性 | 当前已有 AP / 目标 / 部位等基础检查 |
| `TargetRule` | 决定打玩家、打部位、打弱点或自我施法 | 当前已有弱点和自我目标的轻量规则 |
| `UtilityScore` | 对同一 intent 下的候选技能评分 | 当前已有轻量评分 |
| `Telegraph` | 高威胁行为提前告知玩家 | 当前主要通过 intent token 和文本说明表达 |
| `Fallback` | 当前意图不可用时降级 | 当前由 `intentModel.fallback` 和评分兜底实现 |

后续扩展应继续收敛到 `decisionModel.actions[]` 的 ActionPriorityTable，而不是继续扩展 `capabilities[].cadence` 或压力标签。

建议目标结构：

```json
"decisionModel": {
  "mode": "intent_priority_table",
  "intentTimeline": ["attack", "telegraph", "heavy_attack", "recover"],
  "fallbackIntent": "attack",
  "actions": [
    {
      "priority": 100,
      "when": { "previousIntent": "telegraph" },
      "intent": "heavy_attack",
      "skillId": "enemy_skill_heavy_swing",
      "targetRule": "player_weak_part",
      "telegraph": true,
      "fallbackIntent": "attack"
    },
    {
      "priority": 80,
      "when": { "selfArmorLte": 2 },
      "intent": "repair",
      "skillId": "enemy_skill_repair_armor",
      "targetRule": "self",
      "fallbackIntent": "guard"
    },
    {
      "priority": 10,
      "when": { "always": true },
      "intent": "attack",
      "skillId": "enemy_skill_basic_attack",
      "targetRule": "player_weak_part",
      "fallbackIntent": "attack"
    }
  ]
}
```

执行顺序建议：

```text
1. 解析当前 phase / state。
2. 从 intentTimeline 取得本回合基础意图。
3. 读取 ActionPriorityTable，按 priority 从高到低检查条件。
4. 候选 action 必须通过 LegalityCheck。
5. 多个候选都可用时，用 UtilityScore 排序。
6. 输出行动，并生成下一回合可展示的 Telegraph / Intent。
7. 没有候选时走 fallbackIntent。
```

这个模型的边界：

1. 它保留卡牌 / 回合制敌人的可预判性。
2. 它允许 Boss 或精英有条件技能，但条件必须显式写在 action 表里。
3. 它不让敌人临时“聪明地”读玩家构筑。
4. 它不要求为每个压力标签写 if-else。
5. 它能被编辑器做成表格，并能生成前 N 回合行动预览。

编辑器后续最重要的页不是“更多标签”，而是“行为决策表”和“前 N 回合预览”。这两个视图应回答：

```text
这个敌人本回合为什么这样行动？
下一回合玩家能看到什么预告？
某个能力是否真的有技能和意图支撑？
fallback 会不会让敌人行为失真？
```

### 4.3 设计诊断资料不是敌人核心属性

`CounterContract` 不作为敌人核心模型术语继续使用。反制、失败解释和公平性检查应归入设计诊断与验证资料。

更准确的拆分是：

| 原概念 | 新位置 | 理由 |
| --- | --- | --- |
| `CounterContract` | `PlayerResponseNotes` + `FailureDiagnosis` | 反制策略属于玩家应对和设计验证，不是敌人运行时能力 |
| `ResponsibilityProfile` | 作者设计资料 / 关卡职责矩阵 | 它说明敌人承担什么设计任务，不是主流程实例化必要字段 |
| `GrowthBudget` | 作者设计资料 / 数值预算 | 它约束敌人生成和平衡，不是行动决策输入 |
| `BuildCheck` | 设计诊断与验证资料 | 当前不动态分析玩家构筑，只用于失败归因和内容验收 |

这类资料和运行时字段的关系是“解释和验收”，不是“驱动行为”：

```text
运行时字段决定敌人怎么被实例化和行动
作者设计资料解释为什么这样设计
设计诊断资料检查这个设计是否合理
```

因此，文档、编辑器和测试可以要求正式发布内容补齐诊断资料；但运行时不应因为缺少诊断资料而改变行为，也不应让敌人 planner 读取玩家反制标签来做决策。

## 5. 单关压力与流程压力

敌人设计必须区分两层。

| 层级 | 说明 | 示例 |
| --- | --- | --- |
| 单关压力 | 当前战斗内造成威胁，战斗结束后临时状态清除 | 快攻、重击、流血、中毒、减速、反击姿态 |
| 流程压力 | 战斗结束后仍影响后续路线的资源结果 | HP 损失、护甲损耗、治疗资源消耗、绕路成本 |

不是每个敌人都必须有流程压力。教学敌、纯机制演示敌可以只服务单关。高压敌、门卫、精英和 Boss 前敌人必须说明是否承担流程压力。

流程压力类型：

| 类型 | 说明 | 设计边界 |
| --- | --- | --- |
| `none` | 只服务单关教学或机制展示 | 不强行给每个敌人加长期职责 |
| `hp_attrition` | 本关稳定消耗 HP，损耗带入下一关 | 不让 DOT 状态跨关继续结算 |
| `armor_attrition` | 攻击或拖延导致护甲状态恶化 | 不在玩家无选择时无限破甲 |
| `delay_tax` | 拖长战斗，放大自然受击和治疗消耗 | 不和高修复无限叠加 |
| `route_tax` | 高收益路线附带可预期损耗 | 不隐藏路线风险 |
| `pre_boss_drain` | Boss 前削弱玩家状态 | 必须给补给、绕路或构筑调整机会 |

## 6. 敌人自身能力

“检查玩家能力”只是设计目标，不是实现手段。每个敌人都必须说明自己拥有哪些能力；敌人能力先制造压力，压力再检查玩家构筑。

```text
敌人自身能力 -> 造成的压力 -> 玩家反制能力
```

但自身能力不是敌人的行为决策。它只回答“敌人能做什么”和“这些能力服务什么压力”。要变成可执行行为，还必须满足：

1. 能力对应到至少一个敌技。
2. 敌技存在于该敌人的 `skills[]`。
3. 敌技能被 `intentModel.pattern[]` 中的某个 token 匹配。
4. planner 在当前回合能通过 AP、目标、部位和技能合法性检查。
5. fallback 能在主意图不可用时给出可解释降级。

如果只写 `capabilities[]`，没有敌技和意图循环支撑，这个能力只是设计声明，不是运行时能力。

敌人能力类型：

| 能力 | 说明 | 造成的压力 | 典型反制 |
| --- | --- | --- | --- |
| `basic_attack` | 稳定普通攻击 | 基础 HP / 护甲损耗 | 防御、补甲、速杀 |
| `high_damage` | 高伤害攻击或重击 | 爆发威胁 | 格挡、补甲、打断 |
| `telegraph_countdown` | 预告后兑现 | 限时处理窗口 | 读提示、打断、提前击杀 |
| `bleed_apply` | 施加流血 | 本关内持续 HP 损耗 | 治疗、净化、速杀 |
| `poison_apply` | 施加中毒 | 本关内持续 HP 损耗 | 治疗、净化、速杀 |
| `slow_or_bind` | 减速、束缚或节奏限制 | 打乱行动顺序 | 速度管理、低 AP 行动 |
| `armor_break` | 破坏玩家护甲 | 护甲状态带入后续关卡 | 补甲、速杀、防御 |
| `armor_repair` | 修复自身护甲 | 拖长战斗 | 破甲、爆发、打断 |
| `self_heal` | 回复自身 HP | 消耗玩家输出窗口 | 爆发、DOT、打断 |
| `self_cleanse` | 清除自身 Debuff | 抵抗 DOT / 控制锁 | 诱导清除、清除后爆发 |
| `counter_stance` | 进入反击姿态 | 惩罚无脑攻击 | 停手、破姿态、绕开 |
| `mark_and_cashout` | 标记后兑现爆发或吸血 | 铺垫压力 | 清标记、阻止铺垫、窗口爆发 |
| `lifesteal` | 伤害转回复 | 低血反打和续航 | 控制、爆发收尾、阻止铺垫 |
| `support_aura` | 给队友强化、修复或上状态 | 优先级压力 | 转火、控制、先杀支援 |
| `phase_shift` | Boss 或精英阶段变化 | 多段构筑检查 | 阶段理解、资源保留 |

能力复杂度预算：

| 敌人类型 | 能力上限 | 设计要求 |
| --- | --- | --- |
| 普通教学敌 | 1 个核心能力 | 机制清晰，不要求流程压力 |
| 普通标准敌 | 1 个核心能力 + 1 个辅助能力 | 能说明压力和反制 |
| 高压普通敌 | 1 个核心能力 + 1 个流程压力 | 不用纯数值压人 |
| 精英 | 2 个核心能力组合 | 必须有可读窗口 |
| Boss | 多个能力按阶段展开 | 每阶段有明确反制 |

能力字段建议：

```json
"capabilities": [
  {
    "type": "telegraph_countdown",
    "cadence": "windup_2_turns",
    "pressure": "burst_damage",
    "counterplay": ["guard", "interrupt", "fast_kill"]
  },
  {
    "type": "self_cleanse",
    "cadence": "cooldown_3_turns",
    "pressure": "counter_punish",
    "counterplay": ["cleanse", "burst_window"]
  }
]
```

## 7. 敌人核心意图

敌人核心意图不是“流血”。流血只是 DOT / 状态压力的一种材料。敌人的核心意图应按功能划分。

核心意图也不是完整决策系统。它只回答“本回合想做什么类型的动作”。真正的行为仍然要经过技能候选、合法性、意图匹配、评分和 fallback。

```text
核心意图 token
  -> 匹配敌技用途或效果
  -> planner 从合法候选中选一个实际技能
```

因此：

1. `attack` 不等于固定释放某个技能，而是优先选择符合攻击意图的合法技能。
2. `bleed` 不等于一定施加流血；如果没有可用流血技能，应走 fallback。
3. `phase_shift` 这类能力不能只靠意图词成立，必须有对应技能、循环位置和可读窗口。
4. Boss 阶段、HP 阈值、反击后触发等条件逻辑当前不属于核心意图；如果需要，应另设行为模型或触发模型。

| 意图 | 需要的敌人能力 | 作用 | 典型循环 | 玩家反制 |
| --- | --- | --- | --- | --- |
| 快攻压迫 | `basic_attack`、`bleed_apply` | 惩罚慢速和无防御构筑 | `attack -> bleed -> attack` | 低 AP 防御、先手击杀、补甲 |
| 持续伤害压力 | `bleed_apply`、`poison_apply` | 本关内制造磨血和治疗压力 | `poison -> attack -> poison` | 治疗、净化、速杀 |
| 重击预告 | `telegraph_countdown`、`high_damage` | 给玩家可读的爆发窗口 | `telegraph -> heavy_attack -> recover` | 格挡、补甲、打断 |
| 护甲 / 部位检查 | `armor_break`、`armor_repair` | 检查破甲和目标选择 | `guard -> attack -> guard` | 破甲、绕甲、部位选择 |
| 修复 / 续航压力 | `armor_repair`、`self_heal` | 拉长战斗并消耗资源 | `attack -> repair -> guard` | 爆发、打断、DOT |
| 控制节奏 | `slow_or_bind` | 打乱玩家行动顺序 | `slow -> attack -> bind` | 速度管理、低 AP 行动 |
| 反击 / 姿态惩罚 | `counter_stance` | 惩罚无脑攻击 | `stance -> counter -> recover` | 读提示、停手、破姿态 |
| 标记 / 铺垫 / 兑现 | `mark_and_cashout`、`lifesteal` | 先铺垫，后爆发或吸血 | `mark -> pressure -> cash_out` | 清标记、阻止铺垫、窗口爆发 |
| 支援 / 优先级压力 | `support_aura` | 逼玩家决定先杀谁 | `buff -> repair -> attack` | 转火、控制、先杀支援 |
| Boss 阶段压力 | `phase_shift`、复合能力 | 收束章节主题 | `setup -> pressure -> exposed -> terminal` | 阶段理解、资源保留、爆发窗口 |

## 8. 有效耐久与成长

敌人血量不能单独设计。玩家实际面对的是有效耐久。

```text
有效耐久 =
  HP 预算
  + 护甲预算
  + 回复预算
  + 减伤预算
  + 延迟预算
```

同样是 `300 HP`，纯血敌和 `220 HP + 高护甲 + 修复` 的敌人实际难度不同。后续调参时先判断预算来源，再改具体数值。

章节成长不是线性加 HP。

| 阶段 | 敌人成长重点 | 玩家被检查的能力 | 禁止倾向 |
| --- | --- | --- | --- |
| 第一章 | 低血量、清晰弱点、单压力点 | 基础输出、基础补甲、低 AP 行动 | 用高 HP 拖长教学战 |
| 第二章 | 护甲、减速、修复、部位选择 | 破甲、速度管理、输出窗口 | 所有敌人都变厚 |
| 第三章 | DOT、吸血、反击、组合状态、阶段变化 | 构筑循环、Buff 处理、爆发窗口 | 1000 HP 但无机制 |

## 9. 章节职责与当前迁移方向

当前三章 30 个编号关卡仍是平衡对象，但不要再把每个章节拆成单独设计文档。后续在本文维护高层矩阵，具体数据落到 JSON 和测试。

| 章节 | 主题 | 敌人压力 | 玩家反制方向 | 当前重点 |
| --- | --- | --- | --- | --- |
| 第一章 | 快攻与弱点追击 | 低血量、高速度、部位弱点、轻状态 | 基础治疗、补甲、低 AP 输出 | 替换旧样本，避免同模板承担教学和门卫 |
| 第二章 | 护甲与控制 | 中高护甲、减速、修复护甲 | 破甲、速度管理、续航 | 拆分重复护甲敌和旧兽人补位 |
| 第三章 | 持续压迫与组合敌人 | 毒、DOT、吸血、防御反击、Boss 阶段 | 构筑组合、Buff 处理、爆发窗口 | 第三章 P0 已补，后续复核流程压力 |

当前已确认：

1. 第三章 `level_3_5` 到 `level_3_8` 已使用章节专属敌人替换旧样本补位。
2. 第一、二章仍存在旧样本承担高压、门卫或章节标准敌的问题。
3. 后续优先处理第一、二章旧样本复用，再处理 Boss 阶段感。

## 10. 敌人技能与攻击策略

敌人技能不应只是“伤害动作”。每个敌技都要服务敌人意图。

敌技必须能回答：

1. 它是铺垫、施压、爆发、修复、控制还是恢复窗口。
2. 它在 `IntentModel.pattern` 里的位置是什么。
3. 它的 AP 成本和冷却是否支撑敌人节奏。
4. 玩家用什么方式反制它。
5. 它是否会转化为流程压力。

敌技设计规则：

1. 流血、中毒等 DOT 是本关内磨血工具，不是跨关状态。
2. 用于流程压力的敌技必须能解释它怎样转化为 HP / 护甲损耗。
3. 用于单关爆发的敌技必须有预告、窗口、冷却或 AP 成本约束。
4. 用于拖延的敌技必须防止和高护甲、强修复无限叠加。
5. 新敌技尽量采用确定性节奏，不依赖低概率随机作为主要平衡方式。

## 11. V2-lite 数据字段

第一阶段不要重做复杂 AI。先把敌人设计信息补成可编辑、可测试、可逐步消费的轻量字段。

```json
{
  "mechanicProfile": {
    "slotId": "C3-M08",
    "primaryRole": "buff_window",
    "targetTurns": [7, 10],
    "hpBand": [500, 650],
    "armorBudget": [100, 180],
    "counterTags": ["cleanse", "interrupt", "burst_window"],
    "failureSignal": "玩家未处理标记，在兑现回合受到爆发"
  },
  "capabilities": [
    {
      "type": "mark_and_cashout",
      "cadence": "windup_2_turns",
      "pressure": "burst_damage",
      "counterplay": ["cleanse", "interrupt", "burst_window"]
    }
  ],
  "intentModel": {
    "visible": true,
    "pattern": ["mark", "pressure", "cash_out"],
    "telegraphText": "正在准备兑现标记",
    "fallback": "attack"
  },
  "buildCheck": {
    "punishAxis": ["no_cleanse", "no_burst", "slow_build"],
    "expectedCounter": ["cleanse", "burst_window", "interrupt"]
  },
  "runPressure": {
    "type": "hp_attrition",
    "carryoverImpact": ["hp_loss"],
    "expectedDamageBudget": 18,
    "counterplay": ["healing", "fast_kill", "resource_save"]
  },
  "statePersistence": {
    "carryOver": ["hp", "armor"],
    "clearAfterBattle": ["bleed", "poison", "slow", "vulnerable", "stun", "temporary_buff"]
  }
}
```

字段使用边界：

1. `mechanicProfile` 给设计、编辑器和测试使用。
2. `intentModel` 后续可被轻量 `EnemyActionPlanner` 消费。
3. `buildCheck` 第一阶段只做诊断，不在运行时动态分析玩家构筑。
4. `runPressure` 用于路线、补给、模拟器和高压关卡解释。
5. `statePersistence` 固定跨关清除规则，避免 DOT 状态被误设计成跨关异常。

## 12. 运行时使用边界

敌人运行时不做复杂智能 AI。

当前选择逻辑：

1. 读取 `intentModel.pattern` 当前 token。
2. 从敌人 `skills[]` 解析敌技配置。
3. 根据 AP、目标和部位过滤不可用技能。
4. 用 intent token 匹配技能标签或技能效果。
5. 对候选技能评分，优先处理伤害、护甲、Buff、自保和部位弱点。
6. 如果当前 intent 没有候选，尝试 `intentModel.fallback`。
7. 如果 fallback 也没有候选，在全部合法技能里按评分选最高项。

这比“敌人自动判断最佳策略”更可控，也更容易测试。

当前不支持：

1. 不支持 `capabilities[].cadence` 直接触发技能。
2. 不支持 HP 50% 之类阈值自动切换行为。
3. 不支持 `after_counter`、`after_mark` 这类事件后触发。
4. 不支持每个压力标签各自写一套 if-else。
5. 不支持动态读取玩家完整构筑后临场改策略。

这些能力不是不能做，而是不应在没有模型的情况下混入 `capabilities` 或 `pressure` 标签。需要时应走 `4.2` 中定义的 `decisionModel` / `ActionPriorityTable` 路线。

当前 `decisionModel.actions[].when` 只支持已实现的轻量条件：`always`、`selfHpRatioLte`、`selfHpRatioGte`、`previousIntent`、`turnNumberModulo`。未实现的阶段切换、反击后触发、标记后触发不能进入发布包枚举。

## 13. 编辑器和测试要求

敌人编辑器后续应分区展示：

1. 运行时核心字段：HP、护甲、部位、技能引用、意图循环、展示资源、战后状态规则。
2. 作者设计资料：机制槽位、敌人自身能力、HP 带、护甲预算、流程压力。
3. 设计诊断资料：构筑检查、玩家反制说明、失败诊断、章节职责验证。

编辑器可以用诊断资料提示发布风险，但不应把诊断资料伪装成运行时行为规则。

测试和模拟器后续应检查：

1. 30 个正式关卡都有机制槽位。
2. 高压、门卫、精英和 Boss 前敌人声明 `runPressure`。
3. 每个 V2 敌人声明至少一个 `capabilities` 项。
4. 普通流血、中毒和临时 Debuff 在战斗结束时清除。
5. 连续流程验证不得默认关后满血。
6. 敌技能映射到压力类型和反制方向。
7. 第一、二章旧样本补位逐步替换或降级为教学样本。
8. 运行时 smoke 只依赖运行时核心字段。
9. 发布验收可以要求作者设计资料和设计诊断资料齐全。

## 14. 后续落地计划

### 14.1 文档治理

本文作为敌人设计唯一主文档。新增敌人设计理念、规则、字段和迁移计划优先补本文。不要再新增平行的敌人机制说明、敌人迁移表或敌人平衡矩阵文档。

### 14.2 数据迁移

1. 先为当前 30 个正式关卡补机制槽位和流程压力标注。
2. 只处理正式关卡引用链，不先改所有历史样本。
3. 优先替换第一、二章旧样本补位。
4. 第三章 P0 已补的敌人先复核 `runPressure` 和 Boss 前铺垫。

### 14.3 敌技调整

1. 给敌技补用途标签：铺垫、施压、爆发、修复、控制、恢复窗口。
2. 让敌技支撑 `intentModel.pattern`。
3. 不因为单次模拟失败直接微调单个伤害值。

### 14.4 运行时和工具

1. 第一阶段让编辑器和测试先识别 V2-lite 字段。
2. 第二阶段让模拟器按连续流程验证 HP / 护甲继承。
3. 第三阶段再让 `EnemyActionPlanner` 消费 `intentModel`。

## 15. 验收口径

敌人 V2 设计进入实现前，应满足：

1. 本文是敌人设计唯一事实源。
2. 跨关继承和状态清除规则没有歧义。
3. 敌人核心意图没有被流血、毒或任一单状态绑死。
4. 每个高压敌能说明单关压力和流程压力。
5. 每个新增敌人能说明自身能力、能力节奏、玩家反制说明和失败诊断。
6. 每个新增敌技能说明用途、反制和是否服务流程损耗。
7. 自动模拟失败先进入职责 / 构筑 / 敌人能力 / 流程压力诊断，不直接触发数值微调。

验收口径分两层：

| 层级 | 必须满足 | 不满足时 |
| --- | --- | --- |
| 运行时 smoke | 核心字段可实例化，技能可解析，planner 可给出行动 | 阻塞主流程 |
| 内容发布 / 平衡验收 | 作者设计资料和诊断资料足够解释敌人职责、压力和反制 | 阻塞发布或继续设计，不一定阻塞本地运行 |

## 16. 敌人包存储与发布机制

敌人数据采用三层发布机制：

1. `assets/enemy_packs/authoring/` 保存设计阶段多版本草稿，文件名使用 `enemies_YYYYMMDD_HHMMSS.json`。
2. `assets/enemy_packs/current/enemies.json` 是唯一当前发布包，运行时和关卡编辑器默认读取这里。
3. `assets/data/enemies.json` 只作为旧路径兼容文件保留，不再作为主流程发布目标。

敌人编辑器的“保存草稿”只写入 authoring 新文件，不影响主流程；“发布”会把当前编辑器内容写入 `assets/enemy_packs/current/enemies.json`。系统不会从 authoring 目录自动选择最新版进入运行时，避免未审定草稿被误发布。

## 17. Enemy Pack Data Contract v2.1

Enemy authoring data must no longer be a bare inferred record as the primary format. The standard published enemy file is a content pack:

```json
{
  "$schemaVersion": "enemies_v2_1",
  "meta": {
    "contentDomain": "enemy",
    "selectedPackId": "enemy_v2_story",
    "fieldNotes": {},
    "enums": {}
  },
  "enemies": {
    "enemy_id": {}
  }
}
```

Design rule: enemy JSON is the source of truth for editable domains. The editor must not guess whether race, class, tags, capability type, intent token, run pressure type, carry-over state, or body part is free text. If a field is constrained, its allowed values must be declared in `meta.enums`, and its edit rule must be described in `meta.fieldNotes`.

Current constrained fields:

1. `enemies.*.race` comes from `meta.enums.races`.
2. `enemies.*.class` comes from `meta.enums.classes`.
3. `enemies.*.tags[]` comes from `meta.enums.tags`.
4. `enemies.*.capabilities[].type` comes from `meta.enums.capabilityTypes`.
5. `enemies.*.capabilities[].cadence` comes from `meta.enums.capabilityCadences`; cooldown strings such as `cooldown_3_turns` must not be typed freely.
6. `enemies.*.capabilities[].pressure` comes from `meta.enums.capabilityPressures`.
7. `enemies.*.capabilities[].counterplay[]` comes from `meta.enums.counterplay`.
8. `enemies.*.intentModel.pattern[]` and `fallback` come from `meta.enums.intentTokens`.
9. `enemies.*.runPressure.type` comes from `meta.enums.runPressureTypes`.
10. `enemies.*.runPressure.carryoverImpact[]` comes from `meta.enums.carryoverImpact`.
11. `enemies.*.runPressure.counterplay[]` comes from `meta.enums.counterplay`.
12. `enemies.*.statePersistence.carryOver[]` comes from `meta.enums.carryOver`.
13. `enemies.*.statePersistence.clearAfterBattle[]` comes from `meta.enums.clearAfterBattle`.
14. `enemies.*.bodyParts` keys come from `meta.enums.bodyParts`.

Free-text fields are limited to display and design explanation fields such as `name`, `description`, `mechanicProfile.failureSignal`, `buildCheck.punishAxis[]`, and presentation asset refs. Capability timing, capability pressure, counterplay tags, intent tokens, run-pressure type, carry-over impact, and persistence states are enum domains once the pack declares them in `meta.enums`.

Runtime compatibility rule: loaders may accept the legacy bare `Record<enemyId, EnemyTemplate>` shape, but all newly published enemy packs should use the wrapped contract. Runtime must consume only `pack.enemies`; editor UI must drive dropdowns and multi-select controls from `pack.meta.enums`.

Contract boundary: enum-constrained does not mean runtime-driven. `capabilities[].counterplay[]`, `runPressure.counterplay[]`, `buildCheck`, and failure notes belong to authoring / diagnostics. They can be required by publishing tools, but `EnemyActionPlanner` must not treat them as enemy decision inputs.

### 17.1 Runtime Fields vs Design Labels

The current enemy runtime has one executable behavior loop: `enemies.*.intentModel.pattern[]`.
`EnemyActionPlanner` resolves the turn index, selects the current intent token, filters enemy skills by intent-compatible tags/effects, then scores legal skills by AP, target, damage, armor, buff, and recovery signals.

`enemies.*.capabilities[]` is not a second AI trigger system. It describes what the enemy owns as a mechanism and how designers should read that mechanism. Therefore:

1. `capabilities[].cadence` is a design pacing label, not a runtime trigger.
2. `capabilities[].pressure` is a diagnostic pressure category, not an action branch.
3. `capabilities[].counterplay[]` describes intended player answers, not enemy-side if-else rules.
4. HP thresholds, phase names, "after counter", and "after mark" must not appear as cadence enum values unless runtime support is explicitly implemented.
5. If a future design needs real conditional triggers, add them to `decisionModel.actions[].when` and planner support instead of overloading `capabilities[].cadence`.

This means `cooldown_3_turns` currently means "rough intended pressure density" unless the referenced skill itself has a runtime cooldown/AP constraint. `intent_loop_slot` means "look at `intentModel.pattern` for the executable timing." `hp_50_percent`, `phase_2`, `after_counter`, and similar labels were removed because they implied guaranteed runtime branches that do not exist.

### 17.2 Current Enum Grouping

`meta.enums.capabilityCadences` is intentionally small:

1. `every_turn`
2. `alternating_turns`
3. `cooldown_2_turns`
4. `cooldown_3_turns`
5. `cooldown_4_turns`
6. `windup_1_turn`
7. `windup_2_turns`
8. `intent_loop_slot`

`meta.enums.capabilityPressures` is grouped by design purpose, not by individual monster gimmick:

1. `hp_attrition`
2. `armor_attrition`
3. `burst_damage`
4. `status_dot`
5. `control_tempo`
6. `delay_sustain`
7. `counter_punish`
8. `priority_target`
9. `progression_exam`

`meta.enums.counterplay` is grouped by player response:

1. `guard`
2. `armor_up`
3. `armor_break`
4. `healing`
5. `cleanse`
6. `interrupt`
7. `fast_kill`
8. `burst_window`
9. `weakpoint_focus`
10. `read_telegraph`
11. `stop_attack`
12. `speed_management`
13. `resource_save`
14. `target_priority`
15. `stable_output`

All displayed explanations for these enum values should come from `meta.enumDescriptions` when present. The editor may keep local fallback text only for legacy packs.
