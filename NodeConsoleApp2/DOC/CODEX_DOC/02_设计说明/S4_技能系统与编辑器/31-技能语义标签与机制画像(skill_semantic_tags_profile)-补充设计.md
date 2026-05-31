# 技能语义标签与机制画像补充设计

**日期：** 2026-05-31

**状态：** `已并入主设计文档，保留为过程补充`

**关联主文档：**

- [03-技能系统(skill_design)-设计说明](./03-技能系统(skill_design)-设计说明.md)
- [06-技能平衡(skill_balance_design)-设计说明](./06-技能平衡(skill_balance_design)-设计说明.md)
- [30-技能测试器(skill_tester)-设计说明](./30-技能测试器(skill_tester)-设计说明.md)

## 1. 补充目的

本补充用于收口技能测试器批量分析暴露的问题：当前系统能读取技能描述、AP、KP、actions 和 buffRefs，但仍然难以判断技能之间的设计差异。

具体表现是：

1. `剑击` 与 `连刺` 在当前测试器视角下都接近 `1 AP / 10 护甲伤害`。
2. `浅割` 与 `锯齿斩` 都接近 `1 AP / 低伤害 / 增加流血窗口`。
3. 批量测试中出现 `锯齿斩 + 连刺 + 浅割` 高覆盖核心组合，但该组合更像同质技能堆叠，而不是健康的战术分工。

因此，技能分析、有效性分析和可行性分析不能只依赖自然语言描述或单点数值。系统需要一套可计算、可查询、可解释的技能语义标签与机制画像。

## 2. 设计判断

### 2.1 标签不是装饰字段

标签系统的目标不是给技能贴几个名称，而是让工具、测试器和 Codex 能回答：

1. 这个技能承担什么战术角色。
2. 它和同类技能有什么本质差异。
3. 它与其它技能是并行选择、进阶替代、前置依赖，还是协同组合。
4. 在某个战斗状态下，为什么应该选择它而不是另一个相似技能。

如果标签不能回答这些问题，它只是展示文案，不是技能设计模型。

### 2.2 标签不能替代正式字段

本项目已经退役旧 `tags` 作为运行时事实来源的做法。因此，本补充中的标签不应成为技能执行器的硬特判来源。

推荐口径是：

1. `actions / buffRefs / costs / target / requirements / prerequisites` 仍是运行时事实源。
2. 语义标签和机制画像用于设计分析、编辑器辅助、批量测试、报告解释和 Codex 复盘。
3. 能从正式字段推导出的标签，应优先由工具派生。
4. 无法可靠推导、但属于设计意图的关系，才由人工维护。

## 3. 技能语义模型

建议把每个技能抽象为一枚可分析的战术棋子：

```text
s = {
  id,
  name,
  roleTags,
  mechanicProfile,
  relationProfile,
  decisionProfile
}
```

### 3.1 roleTags：战术角色

`roleTags` 描述技能在战斗循环中的主要职责。

建议初始分类：

| 标签 | 含义 |
| --- | --- |
| `Skill.Attack.BasicArmor` | 基础护甲伤害 |
| `Skill.Attack.MultiHit` | 多段攻击 |
| `Skill.Bleed.Apply` | 建立流血窗口 |
| `Skill.Bleed.Extend` | 延长流血窗口 |
| `Skill.Bleed.Read` | 读取流血剩余回合但不消耗 |
| `Skill.Bleed.Consume` | 消耗流血窗口兑现收益 |
| `Skill.Finisher` | 终结技或高约束爆发 |
| `Skill.Defense.Guard` | 防御或护甲回复 |
| `Skill.Defense.Counter` | 防反 |
| `Skill.Control` | 控制、减速、眩晕、削弱 |
| `Skill.Recover` | 治疗或恢复 |

一个技能可以有多个角色，但必须区分主角色和副角色。测试器分析时，应优先按主角色判断循环是否健康。

### 3.2 mechanicProfile：机制画像

`mechanicProfile` 描述技能真实效果，不依赖玩家文案。

建议字段：

```text
mechanicProfile = {
  apCost,
  kpCost,
  hitCount,
  targetShape,
  damageChannels,
  armorDamage,
  hpDamage,
  buffWrites,
  buffReads,
  buffConsumes,
  conditions,
  perTurnLimit,
  opportunityCost
}
```

其中：

| 字段 | 说明 |
| --- | --- |
| `hitCount` | 单次释放产生几段命中 |
| `targetShape` | 单部位、多部位、自身、敌方整体等 |
| `damageChannels` | 护甲伤害、HP 伤害、治疗、护甲回复 |
| `buffWrites` | 写入或延长哪些 Buff，例如 `bleed +1` |
| `buffReads` | 读取哪些 Buff 的 remaining 或 stacks |
| `buffConsumes` | 消耗哪些 Buff 的 remaining 或 stacks |
| `conditions` | 释放条件，例如目标必须流血、HP 低于阈值 |
| `opportunityCost` | 设计层机会成本，例如低伤换窗口、延迟收益、高 AP 爆发 |

测试器应从 `actions / buffRefs / costs / requirements / target` 派生这部分信息。

### 3.3 relationProfile：技能关系

`relationProfile` 描述技能之间的设计关系。

建议字段：

```text
relationProfile = {
  variantOf,
  upgradeOf,
  alternativeTo,
  synergyWith,
  exclusiveWith,
  replacesInPhase
}
```

含义：

| 字段 | 说明 |
| --- | --- |
| `variantOf` | 同一战术角色的变体 |
| `upgradeOf` | 进阶替代关系 |
| `alternativeTo` | 同阶段二选一或多选一 |
| `synergyWith` | 明确协同 |
| `exclusiveWith` | 互斥学习或互斥循环 |
| `replacesInPhase` | 在某个 KP 阶段替代旧技能 |

这部分不一定能完全自动推导，允许由技能编辑器或策划维护，但必须被测试器消费。

### 3.4 decisionProfile：选择理由

`decisionProfile` 描述系统在何种战斗状态下应该倾向选择该技能。

建议字段：

```text
decisionProfile = {
  preferredWhen,
  avoidWhen,
  stateInputs,
  expectedRoleInLoop
}
```

示例：

| 技能 | 推荐选择条件 |
| --- | --- |
| 浅割 | 需要低成本建立短流血窗口，且希望保留较高即时伤害 |
| 锯齿斩 | 已经进入流血路线，需要牺牲即时伤害换更长窗口 |
| 深切 | 目标已有足够流血窗口，需要读取或消耗窗口兑现收益 |

如果两个技能的 `preferredWhen` 无法区分，说明它们在设计上高度可疑。

## 4. 当前问题样例

### 4.1 剑击与连刺

当前字段下：

| 技能 | AP | 效果 |
| --- | ---: | --- |
| 剑击 | 1 | 10 点护甲伤害 |
| 连刺 | 1 | 2 次 5 点护甲伤害 |

如果系统没有多段命中收益、多段命中惩罚、命中次数触发或敌人反制机制，那么它们在当前测试器眼中接近等价。

可选设计方向：

1. 保留差异：给多段命中增加明确机制，例如触发流血、触发破绽、被反击克制、对低护甲部位溢出更差。
2. 进阶替代：明确 `连刺 upgradeOf 剑击`，在中期替代基础攻击。
3. 并行选择：让 `剑击` 强在单点破甲，`连刺` 强在多段触发，但必须有敌人或 Buff 机制支撑。
4. 合并删除：如果没有机制差异，则不应保留两个等价技能。

### 4.2 浅割、锯齿斩与深切

当前讨论中，“巨齿斩”按现有技能包语义对应 `锯齿斩`。

建议拆成三类不同角色：

| 技能 | 推荐角色 | 差异点 |
| --- | --- | --- |
| 浅割 | `Skill.Bleed.Apply` | 基础建窗，较高即时伤害，短流血窗口 |
| 锯齿斩 | `Skill.Bleed.Extend` | 延长窗口，较低即时伤害，适合维持流血 |
| 深切 | `Skill.Bleed.Read` 或 `Skill.Bleed.Consume` | 对已有流血进行兑现，必须依赖窗口状态 |

如果 `浅割` 和 `锯齿斩` 都只是 1 AP 建流血，且差异只有 1 点伤害或 1 回合持续时间，那么测试器无法判断“为什么选浅割而不选锯齿斩”。这不是测试器缺陷，而是设计语义不足。

## 5. 分析器与测试器改造要求

### 5.1 技能等价检测

批量分析器应输出：

1. 同 AP、同角色、同目标、同 Buff 写入的技能组。
2. 功能高度接近但名称不同的技能组。
3. 被支配技能：同类中几乎没有状态会优先选择的技能。

示例输出：

```text
疑似等价组：剑击 / 连刺
原因：同为 1 AP 基础护甲伤害；当前缺少多段命中差异机制。
```

### 5.2 循环角色分析

批量分析器不应只看技能 ID 覆盖率，而应分析：

1. 循环中有多少不同主角色。
2. 是否存在同角色重复堆叠。
3. 是否有建窗但没有读窗或消窗。
4. 是否有读窗或消窗但缺少建窗。
5. 核心三件套是否只是同质低阶技能。

建议指标：

| 指标 | 含义 |
| --- | --- |
| `uniqueRoleCount` | 循环中不同战术角色数量 |
| `duplicateRolePressure` | 同角色重复技能比例 |
| `coreTrioCoverage` | 三技能核心组合覆盖率 |
| `functionalChainQuality` | 建窗、维窗、读窗、消窗链条完整度 |
| `dominantEquivalentGroupCoverage` | 等价技能组覆盖率 |

### 5.3 Codex 结论要求

每轮批量测试后，工具只提供证据。Codex 必须基于原始数据给出人工可审阅结论。

结论至少包含：

1. 当前是否存在单技能通解。
2. 当前是否存在完整循环通解。
3. 当前是否存在核心技能组通解。
4. 当前是否存在等价技能堆叠。
5. 当前结论是否受候选上限、构筑上限或技能标签缺失影响。
6. 建议下一轮验证项。

## 6. 不直接并入主文档的原因

本补充仍是设计草案，不能直接写入主文档作为当前事实，原因是：

1. 当前 skill schema 尚未正式加入 `roleTags / mechanicProfile / relationProfile / decisionProfile`。
2. 技能编辑器尚未提供这些字段的维护入口。
3. 技能测试器尚未消费这些字段。
4. 当前批量测试只证明“需要语义模型”，还没有完成模型落地验证。

用户确认本补充后，应分三步并入：

1. 并入 `03-技能系统`：作为 SkillDef 语义投影与设计标签契约。
2. 并入 `06-技能平衡`：作为技能合理性、等价检测和支配关系判断方法。
3. 并入 `30-技能测试器`：作为批量分析器和 Codex 结论输出的证据模型。

## 7. 外部概念参考

本补充参考以下成熟概念：

1. Unreal Gameplay Tags：层级化概念标签，用于对象识别、分类、匹配和过滤。
2. Unreal Gameplay Ability System：Ability 使用标签进行分类、关系查询和阻断。
3. Type Object Pattern：将对象类型和能力描述从硬编码中抽离为数据驱动模型。
4. Dominant Strategy / Dominant Option：如果某个选择在多数局面都支配同类选择，则它会压平其它选择，降低决策价值。

这些概念只作为设计方法参考，不代表本项目需要引入对应引擎或外部库。
