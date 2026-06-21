# 敌人的行为决策体系设计

最后整理时间：2026-06-21

状态：`草案 / 待用户评审`

归属子系统：`S6_敌人系统与编辑器`

关联文档：

1. `DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
2. `DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/29-敌人决策蓝图编辑器(enemy_decision_graph_editor)-补充设计说明.md`
3. `DOC/CODEX_DOC/02_设计说明/S4_技能系统与编辑器/29-敌人技能包与技能编辑器模式切换(enemy_skill_pack_editor_mode)-设计说明.md`

工程治理依据：`project-engineering-strategy`

## 1. 本文要解决的问题

当前敌人决策编辑台已经能展示状态、分支、行动和连线，但它还没有充分表达“逻辑节点”的输入来源、判断主语和运行时可检验关系。

用户指出的问题是准确的：

1. `HP <= 35%` 这类节点没有明确主语。
2. `距离 >= 2` 这类节点没有明确数据来自哪里。
3. 技能释放节点没有明确“谁释放技能、对谁释放、按什么目标规则选择部位”。
4. 当前图形展示不能证明状态机真实可运行、可校验。
5. 主语不能被写死为“我”或“对方”，而应来自可配置、可接入的主语解析体系。
6. 技能编辑器已经定义了目标、部位、选择、消耗和释放要求，敌人决策不能用一张行动卡片简化吞掉这些约束。

本文不是单独的 UI 原型文档，也不是只描述“输入依赖与逻辑节点”的窄口径文档。本文定义的是敌人的行为决策体系：它同时覆盖作者模型、状态机节点、主语解析、目标解析、技能合法性、编辑器呈现、预览、校验、发布和运行时求值。

后续 UI、模型、运行时、校验器必须先满足本文，再谈画布美化。

## 2. 当前事实与关键缺口

### 2.1 当前运行时调用事实

当前 `CoreEngine` 调用敌人行动规划器时提供的上下文大致是：

```js
enemyPlanner.planTurn({
  enemy,
  player,
  playerBodyParts,
  turnNumber
})
```

也就是说，当前运行时至少已经有这些输入：

1. 当前敌人实例：`enemy`
2. 玩家实例：`player`
3. 玩家运行时部位：`playerBodyParts`
4. 当前回合号：`turnNumber`
5. 敌人技能包解析函数：`getEnemySkillConfig(skillId)`

这些输入足以支持一部分简单规则，但不足以支撑完整状态机。

### 2.2 当前预览模型事实

当前 `EnemyDecisionGraphModel.previewEnemyDecision` 支持的条件包括：

1. `always`
2. `self_hp_ratio_lte`
3. `self_hp_ratio_gte`
4. `turn_number_modulo`
5. `previous_action_is`
6. `target_distance_gte`
7. `target_missing_status`

其中 `target_distance_gte` 和 `target_missing_status` 依赖目标侧数据，但当前 UI 没有清楚显示目标是谁，也没有说明这些目标数据如何从运行时输入中取得。

### 2.3 当前运行时 Planner 事实

当前 `EnemyActionPlanner._decisionConditionMatches` 支持的条件更少：

1. `always`
2. `self_hp_ratio_lte`
3. `self_hp_ratio_gte`
4. `turn_number_modulo`
5. `previous_action_is`

运行时 Planner 不支持：

1. `target_distance_gte`
2. `target_missing_status`
3. `skill_available`
4. `has_self_buff`
5. `player_part_armor_lte`
6. `previous_state_is`

### 2.4 当前 enemy pack 枚举事实

当前 `assets/enemy_packs/current/enemies.json` 中 `meta.enums.decisionConditionTypes` 包含：

1. `always`
2. `self_hp_ratio_lte`
3. `self_hp_ratio_gte`
4. `turn_number_modulo`
5. `skill_available`
6. `has_self_buff`
7. `player_part_armor_lte`
8. `previous_state_is`
9. `previous_action_is`

但它不包含当前自动图中已经出现的：

1. `target_distance_gte`
2. `target_missing_status`

### 2.5 当前核心矛盾

当前至少存在三套条件真源：

| 来源 | 支持集合 | 问题 |
| --- | --- | --- |
| enemy pack `meta.enums.decisionConditionTypes` | 作者下拉枚举 | 列出一些运行时/预览未实现条件 |
| `EnemyDecisionGraphModel` | 预览与编辑器模型 | 支持一些 meta 未声明、运行时未实现条件 |
| `EnemyActionPlanner` | 当前战斗运行时 | 支持集合最窄，不能运行全部图 |

结论：

当前编辑台不能被视为真正可运行、可检验的决策状态机。它只能展示部分图形结构。下一步必须先统一输入契约、条件目录和节点语义。

## 3. 决策上下文输入契约

敌人决策求值不能直接读取零散全局对象。它必须接收一个明确的 `DecisionContext`。

建议目标结构不是单纯把 `self`、`opponent`、`target` 写成固定字段，而是由“运行时事实 + 解析注册表 + 合法性服务”组成：

```json
{
  "self": {},
  "participants": {},
  "battle": {},
  "memory": {},
  "skills": {},
  "world": {},
  "subjectCatalog": {},
  "targetResolverCatalog": {},
  "skillLegality": {}
}
```

其中 `self` 是当前决策调用天然存在的行动者，但所有“判断谁、选谁、打谁、修谁”的问题，都必须通过 `SubjectRef` 或 `TargetQuery` 解析，不能在条件或行动节点里写死具体对象。

### 3.1 输入契约的强制原则

1. `DecisionContext` 提供事实，不替节点做隐式判断。
2. 节点保存 `subjectRef`、`targetQuery`、`skillRef` 等引用，不直接保存运行时对象。
3. `subjectRef` 由 `SubjectResolver` 解析。
4. `targetQuery` 由 `TargetResolver` 解析。
5. 技能能否释放由技能系统的合法性检查判定，敌人决策只消费检查结果。
6. 编辑器预览和运行时必须使用同一套解析器与合法性服务。

### 3.2 `self`：行动主体

`self` 是当前正在决策的敌人实例。

必须包含：

1. `id`
2. `templateId`
3. `stats.hp`
4. `stats.maxHp`
5. `stats.ap`
6. `stats.speed`
7. `bodyParts`
8. `buffs` 或标准化 `statuses`
9. `skills[]`
10. `enemyDecision`
11. `decisionRuntime`

在 UI 中应显示为：`自身`、`释放者`、`Self`。

示例：

```text
自身 HP <= 35%
自身 AP >= 技能消耗
自身拥有 buff_bleed
```

### 3.3 `participants`：战斗参与者池

`participants` 是可被主语解析器访问的战斗对象集合，不是敌人决策节点直接读取的固定字段。

第一阶段至少需要包含：

1. 当前行动敌人。
2. 当前玩家主体。
3. 敌方、友方或中立单位列表，如果战斗系统已经存在这些概念。
4. 可被目标系统选择的部位、召唤物、环境物或 Boss 部件，前提是运行时确实提供这些对象。

UI 不应把 `participants.player` 直接当成唯一对方，而应通过主语解析结果显示为：`玩家主体`、`当前目标`、`最低护甲部位所属者`、`最近敌方单位` 等。

示例：

```text
主语：玩家主体
读取：玩家主体.bodyParts.chest.currentArmor

主语：当前锁定目标
读取：当前锁定目标.statuses

主语：友方最低 HP 单位
读取：友方最低 HP 单位.stats.hp
```

### 3.4 `subjectCatalog`：可接入主语目录

`subjectCatalog` 是主语解析器注册表，负责把作者选择的主语引用解析成运行时对象。

主语引用建议结构：

```json
{
  "resolverId": "battle.player.main",
  "role": "target",
  "params": {},
  "requiredShape": ["stats.hp", "bodyParts", "statuses"]
}
```

第一阶段内置主语可以包括：

| resolverId | 中文显示 | 说明 |
| --- | --- | --- |
| `actor.self` | 自身 | 当前正在决策的敌人 |
| `battle.player.main` | 玩家主体 | 当前玩家角色 |
| `target.current` | 当前目标 | 由上游目标解析产生的候选目标 |
| `target.selectedPartOwner` | 目标部位所属者 | 当前被选中部位所属实体 |
| `memory.previousTarget` | 上次目标 | 来自 `decisionRuntime` 或战斗日志 |

这些内置项只是默认注册项，不是写死上限。后续可以继续注册：

1. `ally.lowestHp`：友方最低 HP 单位。
2. `enemy.nearest`：最近敌方单位。
3. `summon.owner`：召唤物主人。
4. `boss.part:<partId>`：Boss 指定部件。
5. `world.object:<objectType>`：场景对象。

如果一个节点选择了运行时没有注册的 `resolverId`，发布检查必须报 error。

### 3.5 `targetResolverCatalog`：目标解析目录

`target` 不是永远等同于玩家。它是根据 `targetQuery` 和技能目标约束共同解析出的候选对象。

旧字段 `targetRule` 只能作为过渡输入，不应作为长期契约。长期字段应升级为：

```json
{
  "resolverId": "player.weakestArmorPart",
  "subjectRef": {
    "resolverId": "battle.player.main"
  },
  "params": {
    "candidateParts": ["head", "chest", "abdomen", "arm", "leg"]
  },
  "expectedSkillTarget": {
    "subject": "SUBJECT_ENEMY",
    "scope": "SCOPE_PART"
  }
}
```

`target` 必须明确：

1. `entityId`
2. `entityRole`：例如 `actor.self`、`battle.player.main`、`ally`、`summon`
3. `partId`，如果技能或条件涉及部位
4. `partRole`，例如 `weakestArmor`、`fixed`、`randomCandidate`
5. `distance`，如果项目确实存在站位/距离系统
6. `statuses`
7. `sourceResolverId`

如果运行时没有距离系统，则不得开放 `target_distance_gte`。不能为了图好看保留一个运行时无法给值的条件。

### 3.6 `battle`：本次战斗和回合数据

必须包含：

1. `turnNumber`
2. `turnIndex`
3. 当前行动阶段
4. 敌我双方存活列表，后续多敌人协同时使用

示例：

```text
回合数 % 2 = 0
第 3 回合后进入二阶段
```

### 3.7 `memory`：状态机运行记忆

必须来自敌人实例的 `decisionRuntime`，不能写回 enemy pack。

建议包含：

1. `currentStateId`
2. `previousStateId`
3. `previousActionNodeId`
4. `previousSkillId`
5. `turnsInState`

示例：

```text
上一行动是 action_guard
上一状态是 state_charging
在当前状态停留 >= 2 回合
```

### 3.8 `skills`：技能解析与合法性输入

必须能解析当前敌人 `skills[]` 中的敌人技能。

每个技能至少需要提供：

1. `id`
2. `name`
3. `target.subject`
4. `target.scope`
5. `target.selection`
6. `costs.ap`
7. `requirements`
8. `actions`
9. `buffRefs`
10. `speed`

示例：

```text
技能 skill_throw_stone 可用
技能 enemy_skill_rusty_shiv 可对玩家部位释放
技能成本 <= 自身 AP
```

### 3.9 `skillLegality`：技能合法性服务

敌人决策不能复制技能编辑器的规则。技能定义中的目标、部位、选择、消耗和释放要求必须由统一服务检查。

建议接口语义：

```text
checkSkillLegality({
  actorRef,
  skillRef,
  targetQuery,
  context
}) -> {
  ok,
  reasons[],
  resolvedActor,
  resolvedSkill,
  resolvedTargets[],
  cost,
  targetSummary
}
```

必须检查：

1. `actorRef` 能否解析为释放者。
2. `skillRef` 是否属于当前敌人的 `skills[]`。
3. 技能是否存在于敌人技能包。
4. AP、冷却、前置状态等 `costs/requirements` 是否满足。
5. `targetQuery` 解析出的目标是否符合 `skill.target.subject`。
6. `targetQuery` 解析出的部位是否符合 `skill.target.scope`。
7. `target.selection.candidateParts`、`selectedParts`、`selectCount` 是否被满足。
8. 技能动作内部 `actions[].target` 或 buffRefs 目标是否与技能主目标冲突。

行动节点只保存作者意图，不能绕过 `skillLegality` 直接生成战斗行动。

### 3.10 `world`：场地、距离、站位等扩展输入

第一阶段如果没有明确战斗站位模型，不应把 `world.distance` 作为正式条件。

后续如果加入距离，应明确：

1. 距离单位是什么。
2. 距离由谁维护。
3. 每回合何时刷新。
4. 距离条件是否影响技能合法性，还是只影响决策偏好。

## 4. 可接入主语模型

逻辑节点必须由五段组成：

```text
主语引用 + 属性路径 + 运算符 + 参数 + 数据来源
```

例如：

```text
Subject(actor.self).hpRatio <= 0.35
Subject(battle.player.main).bodyParts.chest.currentArmor <= 0
Subject(target.current).statuses 不包含 bleed
Skill(skill_throw_stone).isAvailable(actor.self, targetQuery) == true
Memory.previousActionNodeId == action_guard
```

UI 不能只显示：

```text
HP <= 35%
距离 >= 2
目标未流血
```

应显示：

```text
自身 HP <= 35%
玩家主体距离 >= 2
当前目标未处于 bleed
```

如果某个条件的主语无法确定，该条件应为 error。

### 4.1 `SubjectRef` 字段

所有需要“谁”的节点都必须保存 `SubjectRef`。建议结构：

```json
{
  "resolverId": "actor.self",
  "labelOverride": "",
  "params": {},
  "requiredShape": ["stats.hp"]
}
```

字段语义：

| 字段 | 含义 |
| --- | --- |
| `resolverId` | 指向 `subjectCatalog` 的主语解析器 |
| `labelOverride` | 作者可选的显示名，不影响运行时解析 |
| `params` | 解析参数，例如 `partId`、`team`、`sortBy` |
| `requiredShape` | 本节点需要主语具备的数据形态，用于校验 |

### 4.2 条件主语和行动主语必须分开

Branch 的主语是“判断谁的数据”。

Action 的主语是“谁执行行动”，建议字段名为 `actorRef`。

两者不能混用。例如：

```text
判断：玩家主体未流血
行动：自身释放锈刀划拉
目标：玩家弱点部位
```

这里有三个不同概念：

1. `condition.subjectRef`：玩家主体。
2. `action.actorRef`：自身。
3. `action.targetQuery.subjectRef`：玩家主体或当前目标集合。

如果 UI 只显示一张“锈刀划拉”卡片，就会把这些概念混在一起，导致设计师无法判断图是否真实可运行。

### 4.3 主语注册的边界

主语解析器可以内置，但不能写死在节点模型里。

允许：

1. `subjectCatalog` 内置 `actor.self`、`battle.player.main`。
2. 关卡、战斗系统或 Boss 系统注册新的 resolver。
3. 编辑器根据当前上下文过滤可选主语。

不允许：

1. Branch 类型名隐含主语，例如 `player_part_armor_lte` 长期独占玩家。
2. Action 节点直接假定所有非自身技能都打玩家。
3. 目标规则字符串绕过技能 target schema。
4. 预览器和运行时使用两套不同的主语解析逻辑。

## 5. 节点与输入的关系

### 5.1 系统节点：行动开始

`行动开始` 是一次敌人决策求值的系统边界。

输入：

1. `self.decisionRuntime.currentStateId`
2. `battle.turnNumber`

输出：

1. 进入当前 state。

规则：

1. 不编辑业务字段。
2. 可拖拽、可选中、可进入 Inspect。
3. Inspect 说明它是系统节点。

### 5.2 State 节点：行为状态

State 代表敌人可以跨回合停留的行为状态。

输入：

1. `memory.currentStateId`
2. `memory.turnsInState`

输出：

1. 普通 flow 到 Branch / Action / State。
2. fallback 到可执行路径。

它不直接读取玩家数据，也不直接释放技能。

示例：

```text
状态：默认状态
输入：当前状态 == state_normal
输出：进入低血判断
```

### 5.3 Branch 节点：逻辑判断

Branch 是真正的逻辑节点。

输入由 condition 声明，必须显式可见。condition 不只保存 `type`，还必须保存 `subjectRef`、`readPath`、参数和条件目录定义之间的绑定关系。

示例：

| 节点显示 | subjectRef | 输入依赖 | 输出 |
| --- | --- | --- | --- |
| 自身 HP <= 35% | `actor.self` | `resolvedSubject.stats.hp`、`resolvedSubject.stats.maxHp` | true / false |
| 玩家胸部护甲 <= 0 | `battle.player.main` | `resolvedSubject.bodyParts.chest.current` | true / false |
| 当前目标未流血 | `target.current` | `resolvedSubject.statuses` | true / false |
| 技能可用：投石 | `actor.self + targetQuery` | `actor.stats.ap`、`actor.skills[]`、`skill.costs.ap`、`skill.target`、`resolvedTargets[]` | true / false |
| 上一行动是防御 | `memory` | `memory.previousActionNodeId` | true / false |

Branch 不能产生副作用，不能修改状态，不能释放技能。

### 5.4 Action 节点：行动输出

Action 节点表达“某个行动者释放某个技能，并通过目标解析器选择合法目标”。

输入：

1. `actorRef`
2. `skillRef`
3. `targetQuery`
4. `skills`
5. `skillLegality`
6. `memory.currentStateId`

输出：

1. `ActionPlan`
2. `nextStateId`
3. `memory.previousActionNodeId`
4. `memory.previousSkillId`
5. `memory.previousTargetRef`，如果本轮需要供后续判断使用

Action 卡片必须明确主语：

```text
行动者：自身
释放：锈刀划拉
目标解析：玩家弱点部位
技能约束：SUBJECT_ENEMY / SCOPE_PART / candidateParts=head,chest
合法性：可释放，AP 1
回流状态：state_normal
```

不能只显示：

```text
锈刀划拉
skillId enemy_skill_rusty_shiv
```

建议 Action 节点字段：

```json
{
  "id": "action_rusty_shiv",
  "type": "action",
  "label": "锈刀划拉",
  "actorRef": {
    "resolverId": "actor.self"
  },
  "skillRef": {
    "mode": "skillId",
    "skillId": "enemy_skill_rusty_shiv"
  },
  "targetQuery": {
    "resolverId": "player.weakestArmorPart",
    "subjectRef": { "resolverId": "battle.player.main" },
    "params": {}
  },
  "nextStateId": "state_normal"
}
```

旧字段 `targetRule` 可以在迁移期被转换成 `targetQuery`，但正式模型和编辑器不应继续让作者直接编辑 `targetRule` 字符串。

### 5.5 系统节点：行动结束

`行动结束` 是一次敌人决策求值的系统终点。

输入：

1. 所有 Action 的行动输出。
2. Action 写入的 `nextStateId`。

输出：

1. 本回合行动计划。
2. 更新后的 `decisionRuntime`。

规则：

1. 不编辑业务字段。
2. 可拖拽、可选中、可进入 Inspect。
3. 所有正常路径必须从 `行动开始` 出发，最终到达 `行动结束`。

## 6. 条件目录必须重建为输入契约目录

当前不能继续只维护 `decisionConditionTypes` 字符串数组。每个条件都必须有完整定义。

建议结构：

```json
{
  "type": "self_hp_ratio_lte",
  "label": "自身 HP <= 阈值",
  "subjectPolicy": {
    "defaultResolverId": "actor.self",
    "allowedResolverIds": ["actor.self"],
    "requiredShape": ["stats.hp", "stats.maxHp"]
  },
  "reads": ["resolvedSubject.stats.hp", "resolvedSubject.stats.maxHp"],
  "params": [
    { "name": "value", "type": "number", "min": 0, "max": 1 }
  ],
  "runtimeSupported": true,
  "previewSupported": true,
  "editorSupported": true
}
```

### 6.1 第一阶段推荐条件集合

第一阶段只开放以下条件：

| 条件 | 主语 | 读取输入 | 当前建议 |
| --- | --- | --- | --- |
| `always` | system | 无 | 保留 |
| `self_hp_ratio_lte` | `actor.self` 默认，不开放改主语 | `resolvedSubject.stats.hp/maxHp` | 保留 |
| `self_hp_ratio_gte` | `actor.self` 默认，不开放改主语 | `resolvedSubject.stats.hp/maxHp` | 保留 |
| `turn_number_modulo` | battle | `battle.turnNumber` | 保留 |
| `previous_action_is` | memory | `memory.previousActionNodeId` | 保留，但要落地 decisionRuntime |
| `skill_available` | `actorRef + targetQuery` | AP、技能、目标合法性 | 需要补 `skillLegality` 后开放 |
| `has_status` | 可配置 `SubjectRef` | `resolvedSubject.statuses` | 取代 `has_self_buff`，需要统一 Buff/status 快照后开放 |
| `body_part_armor_lte` | 可配置 `SubjectRef` | `resolvedSubject.bodyParts[partId].current` | 取代 `player_part_armor_lte`，需要参数化 partId 后开放 |
| `previous_state_is` | memory | `memory.previousStateId` | 需要落地 decisionRuntime 后开放 |

不建议长期保留 `has_self_buff`、`player_part_armor_lte` 这类把主语写进类型名的条件。它们可以作为迁移别名，但正式条件目录应使用 `has_status`、`body_part_armor_lte` 这类可配置主语的定义。

### 6.2 暂不应开放的条件

| 条件 | 原因 |
| --- | --- |
| `target_distance_gte` | 当前战斗没有明确距离/站位输入契约 |
| `target_missing_status` | 目标状态快照和 Buff/status 标准化尚未统一 |

如果仍希望保留这两个条件，必须先定义 `target.distance` 和 `target.statuses` 的来源，否则它们只能留在原型，不应进入发布包。

## 7. 编辑器卡片必须表达输入依赖

### 7.1 Branch 卡片显示规则

Branch 卡片至少显示：

```text
主语徽标：自身 / 玩家 / 目标 / 记忆 / 回合
条件标题：自身 HP <= 35%
读取输入：resolvedSubject.stats.hp, resolvedSubject.stats.maxHp
参数：value = 0.35
输出端口：true / false
```

### 7.2 Action 卡片显示规则

Action 卡片至少显示：

```text
行动者：自身
动作：释放 enemy_skill_rusty_shiv
目标解析：玩家弱点部位
技能约束：SUBJECT_ENEMY / SCOPE_PART / single
合法性：可释放，AP 1
回流状态：state_normal
```

Action 卡片不承载所有技能约束细节，只显示摘要和合法性状态。完整字段必须在 Inspect 中编辑。

### 7.3 Inspect 面板显示规则

Inspect 不能只是字段摘要。它必须解释：

1. 此节点读了哪些输入。
2. 此节点输出什么。
3. 此节点是否会修改 `decisionRuntime`。
4. 此节点是否依赖当前运行时尚未支持的数据。
5. 此节点使用了哪个 `SubjectResolver` 或 `TargetResolver`。
6. Action 节点的技能合法性检查结果来自哪里。

示例：

```text
节点：自身 HP <= 35%
类型：逻辑判断
主语：自身
读取：self.stats.hp, self.stats.maxHp
参数：value = 0.35
输出：true / false
副作用：无
支持状态：Editor / Preview / Runtime 均支持
```

Action Inspect 示例：

```text
节点：锈刀划拉
类型：行动
行动者：自身 actor.self
技能：enemy_skill_rusty_shiv
目标解析：player.weakestArmorPart
技能目标约束：SUBJECT_ENEMY / SCOPE_PART
候选部位：head, chest, abdomen, arm, leg
消耗：AP 1
合法性：通过
失败原因：无
写入：previousActionNodeId, previousSkillId, nextStateId
```

## 8. 对应现有状态机编辑台的补充清单

当前编辑台已经有一套基础形态：顶部有 `编辑台 / 活动图预览 / 运行检验 / 发布检查` 模式，左侧有 `决策模板 / 敌人技能 / 节点组件 / 图检查`，中间是可拖拽状态机画布，右侧是 `Inspect`。这些是可以保留和继续建设的基础，但它们目前更接近“图形展示与浅层编辑”，还没有完整承载行为决策体系。

本章专门列出：现有基础是什么、需要补充什么、需要细化什么，以及这些内容应该落到编辑器的哪个区域。

### 8.1 总体模式切换

已有基础：

1. `编辑台`：作为主要编辑入口。
2. `活动图预览`：用于查看活动图式的路径表达。
3. `运行检验`：用于展示运行或预览结果。
4. `发布检查`：用于发布前校验。

需要补充：

1. `编辑台` 必须成为唯一可修改 `enemyDecision` 的模式。
2. `活动图预览` 只能从同一份状态机模型派生，不能拥有另一套图数据。
3. `运行检验` 必须调用共享 evaluator，而不是只显示编辑器预览文本。
4. `发布检查` 必须把结构错误、主语错误、目标错误、技能合法性错误分组展示。

需要细化：

| 模式 | 应承担的职责 | 不应承担的职责 |
| --- | --- | --- |
| 编辑台 | 编辑节点、连线、主语、目标、技能绑定、状态回流 | 展示另一套不可运行图 |
| 活动图预览 | 自动排版、路径可读化、帮助设计师理解流程 | 作为作者真源 |
| 运行检验 | 用指定上下文跑 evaluator，展示 trace 和失败原因 | 伤害模拟和平衡模拟 |
| 发布检查 | 阻止不可运行状态机进入 runtime pack | 只做 JSON 格式检查 |

### 8.2 左侧：决策模板

已有基础：

1. 左侧已有 `决策模板` 区。
2. 现有模型里已经有 `templateId`、`templateRevision`、`slotBindings`。
3. 29 号文档已经定义模板是作者工具，不是运行时继承链。

需要补充：

1. 模板必须保存完整状态机图，而不是只保存一个 id。
2. 模板应用时必须复制图到当前敌人，不允许运行时继承模板。
3. 模板必须声明技能槽位，而不是直接硬编码具体技能。
4. 模板必须声明它需要哪些主语 resolver、目标 resolver 和条件类型。

需要细化：

| 当前编辑区 | 需要新增/细化的内容 |
| --- | --- |
| 决策模板列表 | 模板名、版本、适用敌人类型、需要技能槽、需要 resolver |
| 复制模板 | 复制模板定义，不只是改 `templateId` |
| 清空模板 | 清空模板引用时要说明当前图是否保留 |
| 应用模板 | 复制图、写入模板来源、要求完成 slotBindings |
| 保存为模板 | 从当前图生成模板，并抽取技能槽位 |

### 8.3 左侧：敌人技能

已有基础：

1. 左侧已有 `敌人技能` 区。
2. 当前敌人模板已有 `skills[]`。
3. 技能包中已有 `target.subject`、`target.scope`、`target.selection`、`costs`、`requirements`。

需要补充：

1. 技能区不能只显示 skillId chip。
2. 每个技能必须显示 AP、目标主体、目标范围、候选部位、关键 requirement。
3. 技能卡片必须能拖到 Action 节点或 Action 的 `skillRef` 字段。
4. 技能选择必须触发合法性预检：当前 `actorRef + targetQuery` 是否满足技能约束。

需要细化：

| 技能字段 | 在决策编辑器里的作用 |
| --- | --- |
| `target.subject` | 决定目标解析器能否选择自身、玩家、友方或其他对象 |
| `target.scope` | 决定目标是实体、单部位还是多部位 |
| `target.selection.candidateParts` | 限定 `targetQuery` 能选择哪些部位 |
| `costs.ap` | 参与 `skill_available` 和 Action 合法性 |
| `requirements` | 决定技能是否可释放，并给出失败原因 |
| `buffRefs/actions[].target` | 检查技能内部效果目标是否和主目标冲突 |

### 8.4 左侧：节点组件

已有基础：

1. 当前已有添加 `状态`、`分支`、`行动` 的入口。
2. 画布里已有 `行动开始` 和 `行动结束` 的系统节点表达。

需要补充：

1. 节点组件不能只是“新增一个默认卡片”。
2. 新增 Branch 时必须选择条件类型和主语。
3. 新增 Action 时必须选择行动者、技能和目标解析。
4. 系统节点必须在组件库里可见但不可删除。

需要细化：

| 节点组件 | 必填字段 | 默认值建议 | 创建后必须进入 Inspect |
| --- | --- | --- | --- |
| 行动开始 | 无业务字段 | 系统生成 | 是 |
| State | `id`、显示名、说明、fallback | `state_normal` 或自动编号 | 是 |
| Branch | condition、subjectRef、参数 | `actor.self HP <= 35%` | 是 |
| Action | actorRef、skillRef、targetQuery、nextStateId | `actor.self + 第一个技能 + 默认目标` | 是 |
| 行动结束 | 无业务字段 | 系统生成 | 是 |

### 8.5 中间：状态机画布

已有基础：

1. 当前画布已经支持节点拖拽。
2. 当前画布已经支持画布平移和缩放。
3. 当前画布已经改为横向工作台布局。
4. 当前有连接线和端口的基本表达。

需要补充：

1. Branch 必须有明确的 `true` 与 `false` 输出端口，不能两个分支从同一个加号出来。
2. Action 必须区分 `flow/actionEnd`、`fallback`、`nextState`，不能只显示一个泛化连接点。
3. 端口点击区域必须与视觉位置一致。
4. 连线必须写入结构化 `fromPort/toPort`，不能只靠 `branch` 文本。
5. 节点卡片必须直接显示主语、目标解析和合法性摘要。

需要细化：

| 画布元素 | 当前基础 | 需要补充 |
| --- | --- | --- |
| 系统节点 | 行动开始/行动结束已存在 | 黑色系统节点，可拖拽、可选中、不可删除 |
| State 节点 | 有状态节点 | 显示当前状态、回流目标、进入条件摘要 |
| Branch 节点 | 有条件节点 | 显示 subjectRef、readPath、参数、true/false 端口 |
| Action 节点 | 有技能节点 | 显示 actorRef、skillRef、targetQuery、skillLegality 摘要 |
| 连线 | 有曲线/虚线 | 类型化端口、可删除、可重连、显示分支标签 |
| 画布 | 可拖拽缩放 | 需要保持节点响应区与视觉一致 |

### 8.6 右侧：Inspect 属性栏

已有基础：

1. 右侧已有 `Inspect`。
2. 当前可以显示节点 id、类型、条件、skillId、目标规则、回流状态。

需要补充：

1. Inspect 必须从只读摘要变成主要编辑入口。
2. Branch Inspect 必须编辑 `subjectRef`、条件类型、参数、输出端口。
3. Action Inspect 必须编辑 `actorRef`、`skillRef`、`targetQuery`、fallback、nextState。
4. Inspect 必须显示技能合法性结果，而不是只显示 skillId。
5. Inspect 必须显示当前节点读了哪些输入、写了哪些运行时状态。

需要细化：

| Inspect 对象 | 必须展示 | 必须可编辑 |
| --- | --- | --- |
| 行动开始 | 系统职责、进入状态、读取 memory | 不编辑业务字段 |
| State | 状态名、说明、fallback、出边 | 名称、说明、fallback、出边优先级 |
| Branch | 主语、读取路径、条件、参数、true/false 出口 | subjectRef、condition、params、端口去向 |
| Action | 行动者、技能、目标解析、合法性、回流状态 | actorRef、skillRef、targetQuery、fallback、nextState |
| 行动结束 | 系统职责、写入结果、结束语义 | 不编辑业务字段 |
| Edge | fromPort、toPort、优先级、标签 | 优先级、标签、重连 |

### 8.7 左侧：图检查

已有基础：

1. 左侧已有 `图检查` 区。
2. 当前 validator 已能发现部分结构和技能绑定问题。

需要补充：

1. 图检查必须按错误类型分组：结构、主语、目标、技能、路径、运行时支持。
2. 每条错误必须能定位到节点或连线。
3. 点击错误应选中对应节点或连线。
4. 发布检查必须复用同一批校验结果。

需要细化：

| 检查分类 | 示例问题 |
| --- | --- |
| 结构错误 | 缺少行动开始/行动结束、孤立节点、端口类型不兼容 |
| 主语错误 | `subjectRef.resolverId` 未注册、主语缺少 `stats.hp` |
| 目标错误 | `targetQuery` 解析不到目标、候选部位不合法 |
| 技能错误 | 技能不在当前敌人 `skills[]`、AP 不足、requirements 不满足 |
| 路径错误 | Branch 缺 true/false、单回合无动作循环、Action 不可达 |
| 支持错误 | 编辑器支持但运行时 evaluator 不支持 |

### 8.8 活动图预览

已有基础：

1. 当前已有 `活动图预览` 模式。
2. 之前的活动图方向更接近用户认可的“可读流程图”。

需要补充：

1. 活动图预览必须由编辑台状态机自动生成。
2. 活动图预览可以自动排版，但不能成为第二套作者数据。
3. 活动图预览必须显示本轮主路径、分支、行动结束和跨回合回流。
4. 活动图预览必须标出哪些节点依赖运行时还没有的数据。

需要细化：

| 预览内容 | 显示要求 |
| --- | --- |
| 主路径 | 从行动开始到行动结束的主流程 |
| 分支 | 菱形判断、true/false 标签、条件主语 |
| 行动 | 圆角矩形，显示行动者、技能、目标摘要 |
| 回流 | 显示 Action.nextState，但不把回流线画回行动开始 |
| 错误 | 用醒目标记显示不可运行节点 |

### 8.9 运行检验与路径 Trace

已有基础：

1. 当前已有 `decisionPreviewTrace`。
2. 当前预览模型能输出 `visitedNodes`、`selectedSkillId`、`nextStateId`、fallback 等信息。

需要补充：

1. Trace 必须来自共享 evaluator。
2. Trace 必须显示每个 Branch 的主语解析结果和条件结果。
3. Trace 必须显示每个 Action 的技能合法性检查结果。
4. Trace 必须支持输入上下文编辑，例如 HP、AP、状态、目标部位护甲。

需要细化：

| Trace 字段 | 用途 |
| --- | --- |
| `resolvedSubjects[]` | 证明主语解析正确 |
| `conditionResults[]` | 证明分支判断路径正确 |
| `skillLegalityResults[]` | 证明行动节点不是强行通过 |
| `selectedActionNodeId` | 说明本回合最终行动 |
| `nextStateId` | 说明下一回合状态 |
| `warnings/errors` | 说明不可运行原因 |

### 8.10 发布检查

已有基础：

1. 当前 UI 已有 `发布检查` 模式入口。
2. 29 号文档已经明确 runtime pack 发布必须阻止 error 状态机。

需要补充：

1. 发布检查必须比运行检验更严格。
2. 发布检查必须阻止任何旧 `intentModel` / `decisionModel` 参与路径。
3. 发布检查必须确保所有条件、主语、目标、技能合法性都被运行时支持。
4. 发布检查必须至少用默认上下文跑通首回合行动。

需要细化：

| 发布门 | 阻止条件 |
| --- | --- |
| 模型门 | schema 不正确、旧字段参与路径、缺行动开始/结束 |
| 主语门 | resolver 未注册、requiredShape 不满足 |
| 目标门 | targetQuery 不可解析、与技能 target schema 冲突 |
| 技能门 | 技能不存在、不属于敌人、成本或 requirements 不满足 |
| 路径门 | 无法到达行动结束、单回合循环、首回合无行动 |
| 运行门 | editor preview 和 runtime evaluator 结果不一致 |

### 8.11 数据模型与现有字段的对应关系

已有基础：

1. 当前图使用 `enemyDecision.graph.nodes[]` 和 `enemyDecision.graph.edges[]`。
2. 当前 Action 使用 `skillId`、`targetRule`、`nextStateId`。
3. 当前 Branch 使用 `condition.type` 和参数。
4. 当前 layout 已分为活动图和 rete 工作台布局。

需要补充：

1. Branch 增加 `condition.subjectRef`。
2. Action 增加 `actorRef`、`skillRef`、`targetQuery`。
3. Edge 增加正式 `fromPort`、`toPort`。
4. Decision 增加 resolver/catalog 引用或声明。
5. 运行时增加或落地 `decisionRuntime`。

需要细化：

| 旧/当前字段 | 新体系中的位置 | 处理规则 |
| --- | --- | --- |
| `condition.type` | `ConditionCatalog` 条件定义 | 保留，但必须绑定 subjectPolicy |
| `condition.value/status/partId` | condition params | 保留为结构化参数 |
| `skillId` | `skillRef.skillId` | 可迁移，正式编辑用 `skillRef` |
| `targetRule` | `targetQuery` | 只作为迁移输入，不作为正式编辑字段 |
| `nextStateId` | Action 回流状态 | 保留，但必须指向 State |
| `branch` | `fromPort` | 可迁移为 true/false 端口 |
| `layout.nodes/reteNodes` | 编辑器布局 | 保留，运行时不得读取 |

### 8.12 本章实施顺序

基于当前已有基础，推荐落地顺序为：

1. 先补模型字段：`SubjectRef`、`TargetQuery`、`SkillRef`、`fromPort/toPort`。
2. 再补条件目录和技能合法性服务。
3. 再让 Inspect 成为可编辑属性面板。
4. 再补图检查和发布检查。
5. 再把运行检验切到共享 evaluator。
6. 最后优化画布交互和活动图预览。

这个顺序的原因是：现有画布已经能承载基本展示，但它缺少真实语义。如果先继续修视觉，仍然会得到一张好看的不可运行图。

## 9. 预览与运行时必须共享同一 Evaluator

当前预览模型和运行时 Planner 各自判断条件，这是不可接受的。

目标结构：

```text
EnemyDecisionStateMachineModel
  -> normalize / schema / condition catalog

EnemyDecisionStateMachineEvaluator
  -> evaluateTurn(decision, decisionContext)
  -> SubjectResolver / TargetResolver / SkillLegality
  -> Editor Preview 和 Runtime Planner 共用

EnemyDecisionStateMachineValidator
  -> 静态结构校验
  -> 输入依赖校验
  -> 条件支持校验
  -> 技能绑定校验
```

`EnemyActionPlanner` 只负责把 evaluator 输出的 `ActionPlan` 转成战斗时间线行动，不应再维护另一套条件判断。

Evaluator 不应直接读取 UI 卡片字段得出隐式目标。它必须按顺序执行：

1. 解析当前 state。
2. 进入 Branch 时解析 `condition.subjectRef`。
3. 根据条件目录读取数据路径并求值。
4. 进入 Action 时解析 `actorRef`。
5. 解析 `skillRef`。
6. 解析 `targetQuery`。
7. 调用 `skillLegality`。
8. 合法则输出 `ActionPlan`，非法则进入 fallback 或报错。

## 10. 校验器需要新增的规则

### 10.1 输入依赖校验

校验器必须能发现：

1. 条件缺少主语。
2. 条件读取了不存在的数据路径。
3. 条件依赖运行时未提供的数据。
4. 条件存在于 meta，但 evaluator 不支持。
5. 条件存在于 graph，但 meta 未声明。
6. 预览支持但运行时不支持。
7. `subjectRef.resolverId` 未注册。
8. `subjectRef.requiredShape` 与 resolver 输出不匹配。
9. `targetQuery.resolverId` 未注册。

### 10.2 逻辑节点校验

校验器必须能发现：

1. Branch 没有 true / false 出口。
2. Branch 使用了不可运行条件。
3. Branch 条件参数类型错误。
4. Branch 条件主语和参数不匹配，例如 HP 条件绑定到没有 `stats.hp` 的部位对象。
5. Branch 条件类型把主语写死在类型名中，但又暴露了可配置主语，导致语义冲突。

### 10.3 Action 节点校验

校验器必须能发现：

1. Action 没有技能。
2. 技能不在当前敌人 `skills[]`。
3. 技能不存在于敌人技能包。
4. `actorRef` 不能解析。
5. `targetQuery` 不能解析。
6. `targetQuery` 和技能 `target.subject/scope` 不兼容。
7. `targetQuery` 解析出的部位不在技能 `selection.candidateParts` 内。
8. 技能 `selection.selectCount`、`selectedParts`、`candidateParts` 不满足。
9. 技能 AP 成本超过行动者 AP。
10. 技能 `requirements` 不满足。
11. Action 没有 `nextStateId` 或 `nextStateId` 不是 State。

旧字段 `targetRule` 的校验结论只能是：

1. 可转换为 `targetQuery`。
2. 不可转换，报 error。

不能长期保留“`targetRule` 和技能目标大致兼容即可”的弱校验。

### 10.4 路径校验

校验器必须能发现：

1. 从行动开始无法到达行动结束。
2. 有路径进入单回合无限循环。
3. 有 Action 永远不可达。
4. 有 State 永远不可达。
5. 所有分支最终都落到同一个 Action，导致逻辑节点没有实际设计意义。

## 11. 推荐的第一轮重构顺序

不要先改画布样式。建议顺序：

1. 定义 `DecisionContext`、`SubjectCatalog`、`TargetResolverCatalog` 和 `ConditionCatalog`。
2. 定义 `SkillLegality` 接口，复用技能编辑器/技能运行时的 target、selection、costs、requirements 规则。
3. 删除三套条件真源，统一为一个条件目录。
4. 新增共享 evaluator。
5. 让预览和运行时 Planner 共用 evaluator。
6. 在校验器中加入主语解析、目标解析、技能合法性和输入依赖校验。
7. 再改 UI 卡片，让 Branch / Action 展示主语、目标解析和合法性摘要。
8. 最后再优化蓝图端口、连线和视觉层级。

## 12. 本文结论

当前编辑台的问题不是“卡片不好看”这么简单，而是缺少可运行状态机的输入模型。

下一步不应继续只做画布视觉修补，而应先把以下事实做成硬契约：

1. 每个逻辑判断都有主语。
2. 每个逻辑判断都有明确输入路径。
3. 每个输入路径都能从 `DecisionContext` 取得。
4. 主语来自 `SubjectCatalog`，而不是写死在节点类型里。
5. 目标来自 `TargetResolverCatalog`，而不是长期依赖 `targetRule` 字符串。
6. 技能约束来自技能系统合法性服务，而不是 Action 卡片自定义一份简化规则。
7. 编辑器、预览器、运行时共用同一条件目录。
8. 预览器和运行时共用同一 evaluator。
9. Action 节点明确表达“行动者释放技能到目标解析结果”。
10. 校验器能证明图不是只可展示，而是可运行、可检验。

只有完成这些，敌人决策编辑器才有资格继续进入下一轮 UI 原型和实现。
