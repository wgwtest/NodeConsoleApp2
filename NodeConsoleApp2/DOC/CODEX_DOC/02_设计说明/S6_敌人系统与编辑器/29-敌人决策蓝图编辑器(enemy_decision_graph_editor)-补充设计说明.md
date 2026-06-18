# 敌人决策蓝图编辑器补充设计说明

最后整理时间：2026-06-18

状态：`设计审阅中`

适用范围：`S6_敌人系统与编辑器`

## 1. 设计结论

敌人行为系统应从当前的 `intentModel.pattern[]` 和 `decisionModel.actions[]` 迁移为“敌人决策”蓝图编辑模型。

第一阶段采用“编辑器优先”路线：

1. 在敌人编辑器内新增独立的敌人决策蓝图编辑模块。
2. 编辑器界面移除“意图循环”和“行为决策”两个概念。
3. 新界面统一称为“敌人决策”。
4. 第一阶段完成模板库、蓝图画布、节点属性、技能绑定、保存加载、静态校验和路径预览。
5. 第一阶段不要求真实战斗运行时立刻消费蓝图。
6. 后续第二阶段再让战斗运行时的敌人行动规划器消费该状态机。

这意味着第一阶段的核心目标不是让敌人马上按新状态机战斗，而是先建立一个清晰、可编辑、可保存、可校验、可预览的作者工具和数据结构。

## 2. 为什么要替换旧模型

当前模型由两部分组成：

1. `intentModel.pattern[]`
   - 固定意图循环。
   - 本质是按回合号从数组中取 token。

2. `decisionModel.actions[]`
   - 轻量优先级行动表。
   - 支持少量条件，例如 always、HP 阈值、回合取模。
   - 不是完整状态机。

这套模型存在以下问题：

1. 概念误导
   - “行为决策”这个名字暗示敌人拥有完整 AI 或状态机，但实际只是优先级表。

2. 表达能力不足
   - 难以自然表达阶段切换、反击姿态、蓄力、循环、失败回退、事件触发和持续状态。

3. 设计重复
   - 当前很多 `decisionModel.actions[]` 只是重复 `intentModel.pattern[]` 的节奏。

4. 编辑体验差
   - 开发者需要理解多个抽象字段，而不是直接编辑“状态 -> 判断 -> 动作 -> 回退”。

5. 后续扩展方向不清晰
   - 如果继续给 `decisionModel.actions[].when` 加条件，最终会变成一套隐藏的脚本语言，但编辑器仍然是表格。

因此，旧模型应被视为待移除数据，只允许作为一次性迁移输入，不再作为敌人编辑器的设计语言，也不允许继续作为发布包兼容输出。

## 3. 目标用户和使用场景

目标用户是内容设计者和系统设计者，而不是只会填写 JSON 的程序员。

主要使用场景：

1. 从通用敌人决策模板创建一个敌人行为图。
2. 为当前敌人的动作节点绑定具体技能。
3. 调整状态、条件和动作的连接关系。
4. 在编辑器中预览若干回合的状态机路径。
5. 保存敌人模板后，下次打开能恢复完整蓝图布局。
6. 发布前发现非法技能引用、断线、无 fallback、死循环等问题。

第一阶段不要求设计者编写代码，不提供自由脚本节点。

## 4. 第一阶段范围

### 4.1 必须完成

1. 新增“敌人决策”编辑页。
2. 移除敌人编辑器中的“意图循环”和“行为决策”页签。
3. 决策模板库：
   - 新建模板。
   - 复制模板。
   - 删除模板。
   - 重命名模板。
   - 从当前敌人图保存为模板。
   - 将模板应用到当前敌人。

4. 蓝图画布：
   - 添加节点。
   - 删除节点。
   - 拖拽节点位置。
   - 创建连线。
   - 删除连线。
   - 保存并恢复节点坐标。

5. 节点类型：
   - Entry 节点。
   - State 节点。
   - Branch 条件节点。
   - Action 动作节点。

6. 节点属性面板：
   - 编辑节点名称。
   - 编辑状态说明。
   - 编辑条件。
   - 绑定技能槽位或具体技能。
   - 编辑目标规则。
   - 编辑 fallback。
   - 编辑 telegraph 标记。

7. 当前敌人技能库绑定：
   - 动作节点只能绑定当前敌人 `skills[]` 中存在的技能。
   - 模板不能硬编码某个敌人专属 skillId。

8. 静态校验：
   - 检查断开的连线。
   - 检查孤立节点。
   - 检查无出口状态。
   - 检查无 fallback 动作。
   - 检查非法 skillId。
   - 检查重复节点 id。
   - 检查入口节点数量。
   - 检查单回合内无限循环风险。

9. 路径预览：
   - 在编辑器内模拟若干回合。
   - 展示每回合经过的状态、条件结果和动作。
   - 展示 fallback 原因。
   - 展示校验警告。

10. 保存加载：
    - 保存到 enemy pack。
    - 下次加载恢复模板引用、图结构、节点属性、连线和画布位置。

### 4.2 第一阶段不做

1. 不接入真实战斗运行时。
2. 不替换 `CoreEngine` 的敌人行动流程。
3. 不实现自由脚本语言。
4. 不开放任意 JavaScript 表达式。
5. 不做多人协作编辑。
6. 不做复杂调试器断点。
7. 不做真实伤害结算模拟。
8. 不承诺预览结果等同于实战结果。

## 5. 编辑器整体布局

推荐布局为三栏加底部预览：

```text
┌─────────────────────────────────────────────────────────────┐
│ 敌人决策工具栏：模板、节点、连线、校验、预览、保存           │
├───────────────┬─────────────────────────────┬───────────────┤
│ 左侧栏         │ 中央蓝图画布                 │ 右侧属性面板   │
│               │                             │               │
│ 决策模板库     │ Entry / State / Branch /     │ 当前节点属性   │
│ 当前敌人技能库 │ Action 节点和连线             │ 技能绑定       │
│ 节点类型面板   │                             │ fallback 设置  │
├───────────────┴─────────────────────────────┴───────────────┤
│ 路径预览：Turn 1 / Turn 2 / Turn 3 ...                       │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 左侧栏

左侧栏分为三个区：

1. 决策模板库
   - 显示可用模板。
   - 支持新建、复制、删除、重命名。
   - 支持“应用到当前敌人”。

2. 当前敌人技能库
   - 读取当前敌人 `skills[]`。
   - 显示技能名、skillId、AP 成本、标签和目标类型。
   - 支持拖拽到 Action 节点完成绑定。

3. 节点面板
   - Entry。
   - State。
   - Branch。
   - Action。

### 5.2 中央蓝图画布

中央画布负责显示和编辑图结构。

要求：

1. 节点可拖拽。
2. 节点之间可连线。
3. 连线可选择、删除。
4. 画布支持缩放和平移。
5. 节点坐标保存到数据中。
6. 选中节点后右侧属性面板同步显示。

第一阶段可以使用 DOM 节点加 SVG 连线实现，不必引入重量级图编辑库。

### 5.3 右侧属性面板

右侧属性面板根据节点类型变化。

State 节点显示：

1. 状态 id。
2. 显示名。
3. 状态说明。
4. 默认 fallback 动作。
5. 进入状态时是否显示 telegraph。
6. 出边优先级列表。

Branch 节点显示：

1. 条件类型。
2. 条件参数。
3. true 出口。
4. false 出口。
5. 条件说明。

Action 节点显示：

1. 动作 id。
2. 动作名称。
3. 绑定方式：
   - 绑定模板槽位。
   - 或绑定当前敌人具体 skillId。
4. 目标规则。
5. AP 不足时的 fallback。
6. 技能不存在时的 fallback。
7. telegraph 标记。

### 5.4 底部路径预览

路径预览展示“如果从当前初始状态开始，未来 N 回合会怎样走”。

每回合至少显示：

1. turn number。
2. 起始 state。
3. 经过的 branch。
4. branch 结果。
5. 最终 action。
6. 使用的 skillId。
7. fallback 是否发生。
8. 预览警告。

## 6. 数据模型

### 6.1 总体结构

敌人包中新增两个概念：

1. `decisionGraphTemplates`
   - 包级别的通用决策模板库。

2. `enemies.*.enemyDecision`
   - 单个敌人的决策图实例。

推荐结构：

```json
{
  "$schemaVersion": "enemies_v2_2",
  "decisionGraphTemplates": {
    "tpl_basic_aggressor": {
      "id": "tpl_basic_aggressor",
      "name": "基础进攻模板",
      "schemaVersion": "enemy_decision_graph_v1",
      "revision": 1,
      "slots": [
        {
          "id": "slot_basic_attack",
          "label": "基础攻击",
          "required": true,
          "expectedTags": ["attack"]
        }
      ],
      "graph": {
        "entryNodeId": "entry",
        "initialStateId": "state_normal",
        "nodes": [],
        "edges": []
      }
    }
  },
  "enemies": {
    "enemy_v2_c1_01_razor_initiate": {
      "id": "enemy_v2_c1_01_razor_initiate",
      "skills": ["enemy_skill_rusty_shiv", "skill_throw_stone"],
      "enemyDecision": {
        "schemaVersion": "enemy_decision_graph_v1",
        "templateId": "tpl_basic_aggressor",
        "templateRevision": 1,
        "slotBindings": {
          "slot_basic_attack": "skill_throw_stone",
          "slot_bleed_attack": "enemy_skill_rusty_shiv"
        },
        "graph": {
          "entryNodeId": "entry",
          "initialStateId": "state_normal",
          "nodes": [],
          "edges": []
        },
        "layout": {
          "viewport": { "x": 0, "y": 0, "zoom": 1 },
          "nodes": {
            "state_normal": { "x": 260, "y": 80 }
          }
        }
      }
    }
  }
}
```

### 6.2 模板与实例的关系

模板不是运行时对象，模板是作者工具中的可复用设计起点。

应用模板时采用“复制为实例”的策略：

1. 模板图复制到当前敌人的 `enemyDecision.graph`。
2. 当前敌人保存 `templateId` 和 `templateRevision`。
3. 当前敌人可以自由修改自己的图。
4. 模板后续更新不会自动修改已有敌人。
5. 如需同步模板更新，编辑器提供显式“应用模板更新”操作。

这样可以避免模板一改导致大量敌人行为被隐式改变。

### 6.3 技能槽位

模板中的 Action 节点不应直接写死 skillId，而应绑定技能槽位。

示例：

```json
{
  "id": "action_basic_attack",
  "type": "action",
  "label": "基础攻击",
  "skillSlotId": "slot_basic_attack",
  "targetRule": "player_weak_part",
  "fallbackNodeId": "action_default_attack"
}
```

当前敌人通过 `slotBindings` 将槽位绑定到具体 skillId：

```json
{
  "slot_basic_attack": "skill_throw_stone"
}
```

如果某个动作是敌人私有动作，也允许直接绑定 skillId，但必须来自当前敌人的 `skills[]`：

```json
{
  "id": "action_private_bleed",
  "type": "action",
  "label": "剃刀流血",
  "skillId": "enemy_skill_rusty_shiv",
  "targetRule": "player_weak_part"
}
```

规则：

1. 模板推荐使用 `skillSlotId`。
2. 敌人实例允许使用 `skillId`。
3. `skillId` 必须存在于当前敌人 `skills[]`。
4. `skillSlotId` 必须能通过 `slotBindings` 解析到当前敌人 `skills[]`。

## 7. 节点设计

### 7.1 Entry 节点

Entry 节点表示状态机入口。

约束：

1. 每张图必须有且只有一个 Entry 节点。
2. Entry 节点必须连接到一个 State 节点。
3. Entry 节点不允许直接连接到 Action 节点。

示例：

```json
{
  "id": "entry",
  "type": "entry",
  "label": "Start"
}
```

### 7.2 State 节点

State 节点表示敌人可持久停留的行为状态。

示例状态：

1. `Normal`
2. `Recover`
3. `CounterStance`
4. `Charging`
5. `Phase2`

State 节点字段：

```json
{
  "id": "state_normal",
  "type": "state",
  "label": "Normal",
  "description": "默认进攻状态",
  "fallbackNodeId": "action_basic_attack"
}
```

约束：

1. State 节点必须至少有一条出边。
2. State 节点必须有 fallback。
3. State 节点可以连到 Branch 或 Action。
4. State 节点可以通过边回到自身或其他 State，形成循环。

### 7.3 Branch 条件节点

Branch 节点表示 if-else 判断。

示例：

```json
{
  "id": "branch_low_hp",
  "type": "branch",
  "label": "HP <= 35%",
  "condition": {
    "type": "self_hp_ratio_lte",
    "value": 0.35
  }
}
```

Branch 节点至少有两个出口：

1. `true`
2. `false`

也允许多出口条件，例如根据 player 状态分支，但第一阶段应优先支持二分支。

第一阶段支持的条件类型：

| 条件类型 | 含义 |
| --- | --- |
| `always` | 永真 |
| `self_hp_ratio_lte` | 自身 HP 比例小于等于阈值 |
| `self_hp_ratio_gte` | 自身 HP 比例大于等于阈值 |
| `turn_number_modulo` | 回合数取模 |
| `skill_available` | 绑定技能存在且 AP 足够 |
| `has_self_buff` | 自身拥有指定 buff |
| `player_part_armor_lte` | 玩家指定部位护甲低于阈值 |
| `previous_state_is` | 上回合状态为指定状态 |
| `previous_action_is` | 上回合动作为指定动作 |

禁止在第一阶段开放自由表达式，例如：

```text
enemy.hp / enemy.maxHp < 0.35 && player.hasBuff("bleed")
```

原因是自由表达式会带来安全、调试、序列化和校验问题。

### 7.4 Action 节点

Action 节点表示一个最终可执行意图。

第一阶段 Action 节点只描述“应该使用哪个敌人技能”，不负责真实伤害结算。

字段：

```json
{
  "id": "action_bleed_cut",
  "type": "action",
  "label": "Bleed Cut",
  "skillSlotId": "slot_bleed_attack",
  "targetRule": "player_weak_part",
  "telegraph": false,
  "fallbackNodeId": "action_basic_attack"
}
```

约束：

1. Action 必须能解析到一个 skillId。
2. skillId 必须属于当前敌人 `skills[]`。
3. Action 必须有 targetRule。
4. 高威胁动作可设置 `telegraph`。
5. 如果技能不可用，必须有 fallback。

## 8. 连线设计

连线负责描述执行流程。

字段：

```json
{
  "id": "edge_normal_to_low_hp",
  "from": "state_normal",
  "to": "branch_low_hp",
  "priority": 100,
  "label": "check low hp"
}
```

Branch 出边需要声明分支：

```json
{
  "id": "edge_low_hp_true",
  "from": "branch_low_hp",
  "to": "state_recover",
  "branch": "true",
  "priority": 100
}
```

规则：

1. 同一节点的出边按 `priority` 从高到低检查。
2. Branch 节点必须有 true 出边和 false 出边。
3. State 节点可以有多个出边。
4. Action 节点默认结束本回合。
5. Action 节点如有 nextStateId，可以在动作后更新当前状态。
6. 单回合路径必须有最大步数限制，防止无动作循环。

### 8.1 单回合求值语义

第一阶段路径预览和第二阶段运行时接入都应遵循同一套求值语义。

单回合求值流程：

1. 读取当前状态 `currentStateId`。
2. 从当前 State 节点开始。
3. 按出边 priority 从高到低进入下一个节点。
4. 遇到 Branch 节点时计算条件。
5. 根据 true / false 出边继续前进。
6. 遇到 Action 节点时尝试解析技能。
7. 如果技能合法且可用，输出本回合动作。
8. 如果技能不可用，进入 fallback。
9. 如果 Action 声明了 `nextStateId`，动作完成后更新 `currentStateId`。
10. 如果没有声明 `nextStateId`，默认保持原状态。

求值必须设置单回合最大节点步数，例如 32 步。超过上限视为图结构错误，预览必须停止并报告 `single_turn_loop_detected`。

### 8.2 循环语义

状态机允许循环，但必须区分两种循环：

1. 跨回合循环
   - 合法。
   - 例如 Normal -> Action -> Normal，下回合再从 Normal 开始。

2. 单回合无动作循环
   - 非法。
   - 例如 State -> Branch -> State，且没有任何 Action 结束本回合。

编辑器校验器必须阻止第二种循环进入发布包。

### 8.3 状态持久化语义

`currentStateId` 是运行时敌人实例状态，不是敌人模板静态字段。

第一阶段只在路径预览里维护模拟用的 currentState。第二阶段接入真实运行时时，currentState 应存放在战斗中的敌人实例上，而不是写回 enemy pack。

## 9. 路径预览

### 9.1 预览定位

路径预览是作者工具，不是战斗模拟器。

它回答的问题是：

1. 当前状态机会走到哪个动作？
2. 条件判断顺序是否符合预期？
3. fallback 是否被触发？
4. 是否存在死路或循环？

它不回答的问题是：

1. 真实伤害是多少？
2. 玩家实际会不会死亡？
3. 这个敌人是否平衡？
4. 战斗日志是否完全一致？

### 9.2 预览输入

预览面板提供简化输入：

1. 初始回合数。
2. 模拟回合数。
3. 敌人 HP 比例。
4. 敌人 AP。
5. 玩家各部位护甲。
6. 上一状态。
7. 上一动作。
8. 可选 buff 状态。

默认值来自当前敌人模板。

### 9.3 预览输出

每回合输出 trace：

```json
{
  "turn": 1,
  "startStateId": "state_normal",
  "visitedNodes": [
    "state_normal",
    "branch_low_hp",
    "branch_skill_bleed_ready",
    "action_bleed_cut"
  ],
  "conditionResults": [
    {
      "nodeId": "branch_low_hp",
      "result": false
    },
    {
      "nodeId": "branch_skill_bleed_ready",
      "result": true
    }
  ],
  "selectedActionNodeId": "action_bleed_cut",
  "selectedSkillId": "enemy_skill_rusty_shiv",
  "fallbacks": [],
  "warnings": []
}
```

### 9.4 预览限制

1. 不执行真实技能效果。
2. 不修改真实存档。
3. 不依赖 `CoreEngine`。
4. 不承诺与战斗运行时完全一致。
5. 后续运行时接入后，可增加“实战路径对照”。

## 10. 校验规则

### 10.1 图结构校验

| 规则 | 严重级别 |
| --- | --- |
| 缺少 Entry 节点 | error |
| Entry 节点超过一个 | error |
| Entry 未连接 State | error |
| initialStateId 不存在 | error |
| 节点 id 重复 | error |
| 连线引用不存在的节点 | error |
| Branch 缺少 true 或 false 出边 | error |
| State 无出边且无 fallback | error |
| 存在不可达节点 | warning |
| 存在单回合无动作循环 | error |

### 10.2 技能绑定校验

| 规则 | 严重级别 |
| --- | --- |
| Action 无 skillId 且无 skillSlotId | error |
| skillSlotId 未绑定 | error |
| skillId 不在当前敌人 skills[] | error |
| skillId 不存在于敌人技能包 | error |
| AP 成本高于敌人 AP | warning |
| targetRule 与技能 target 不兼容 | warning |

### 10.3 模板校验

| 规则 | 严重级别 |
| --- | --- |
| 模板 id 重复 | error |
| 模板缺少 slots 定义 | warning |
| 模板 Action 硬编码 skillId | warning |
| 模板图无 Entry | error |
| 模板 revision 不是数字 | error |

## 11. 旧数据迁移策略

### 11.1 编辑器表层迁移

敌人编辑器不再显示：

1. `intentModel`
2. `decisionModel`

新页签显示：

1. `enemyDecision`
2. 决策模板库。
3. 蓝图画布。
4. 路径预览。

### 11.2 数据迁移

打开旧敌人包时，如果敌人缺少 `enemyDecision`，编辑器应提供迁移：

1. 根据 `intentModel.pattern[]` 创建一条线性状态图。
2. 根据 `decisionModel.actions[]` 创建 Action 节点。
3. 根据 `decisionModel.actions[].when` 创建 Branch 节点。
4. 根据 `decisionModel.actions[].skillId` 绑定具体技能。
5. 将无法表达的字段写入迁移警告。

迁移结果应让用户确认后再写回。

### 11.3 无向下兼容策略

敌人决策蓝图编辑器上线后，不保留 `intentModel` / `decisionModel` 的向下兼容发布路径。

硬性规则：

1. `enemyDecision` 是唯一作者模型。
2. `intentModel` / `decisionModel` 只允许作为旧包迁移输入。
3. 迁移确认写回后，enemy pack 中必须移除 `intentModel` / `decisionModel`。
4. 编辑器不得生成 `intentModel` / `decisionModel`。
5. 发布 runtime pack 时不得生成旧字段。
6. 如果真实战斗运行时尚未支持 `enemyDecision`，编辑器必须禁止发布 runtime pack。
7. 禁止使用 `generated`、`legacy`、`compatibility` 等方式保留旧行为模型。

第一阶段如果只完成编辑器和路径预览，则发布边界是：

1. 可以保存 authoring draft。
2. 可以保存包含 `enemyDecision` 的敌人包。
3. 不允许发布给旧 `EnemyActionPlanner` 消费的 runtime pack。
4. 若项目要求 runtime pack 立即可玩，则必须把 `EnemyDecisionGraphPlanner` 纳入同一发布批次。

这是一条硬切换路线：旧字段不是兼容层，只是迁移材料。迁移完成后，旧字段必须消失。

## 12. 模块边界

第一阶段推荐新增独立模块，而不是继续把逻辑塞进 `EnemyEditorPage.js`。

建议模块：

```text
script/editor/enemy/decision/
  EnemyDecisionGraphEditor.js
  EnemyDecisionGraphModel.js
  EnemyDecisionGraphValidator.js
  EnemyDecisionGraphPreviewer.js
  EnemyDecisionTemplateStore.js
  EnemyDecisionGraphRenderer.js
  enemyDecisionGraph.css
```

职责：

| 模块 | 职责 |
| --- | --- |
| `EnemyDecisionGraphEditor` | 对外入口，接收敌人、技能包、模板库，协调 UI |
| `EnemyDecisionGraphModel` | 图数据读写、节点/连线增删改 |
| `EnemyDecisionGraphValidator` | 静态校验 |
| `EnemyDecisionGraphPreviewer` | 路径预览，不接真实战斗 |
| `EnemyDecisionTemplateStore` | 模板 CRUD 和应用模板 |
| `EnemyDecisionGraphRenderer` | 画布渲染、拖拽、连线、选中状态 |
| `enemyDecisionGraph.css` | 蓝图编辑器样式 |

`EnemyEditorPage.js` 只负责：

1. 创建敌人决策编辑器实例。
2. 提供当前敌人。
3. 提供敌人技能包。
4. 在保存时读取 `enemyDecision`。
5. 在切换敌人前同步当前图。

## 13. 用户操作流程

### 13.1 从模板创建

1. 用户打开敌人编辑器。
2. 选择一个敌人。
3. 进入“敌人决策”页。
4. 左侧选择 `基础进攻模板`。
5. 点击“应用到当前敌人”。
6. 编辑器复制模板图到当前敌人。
7. 右侧提示需要绑定技能槽位。
8. 用户将当前敌人技能拖到槽位。
9. 点击“校验”。
10. 点击“预览 6 回合”。
11. 保存敌人包。

### 13.2 修改现有图

1. 用户拖动节点调整布局。
2. 用户添加 Branch 节点，例如 `HP <= 35%`。
3. 用户连接到 `Recover` 状态。
4. 用户为 Recover 状态添加 fallback。
5. 用户运行路径预览。
6. 校验通过后保存。

### 13.3 从敌人图保存为模板

1. 用户完成某个敌人决策图。
2. 点击“保存为模板”。
3. 编辑器要求把具体 skillId 转换为槽位。
4. 用户确认槽位名称和说明。
5. 模板进入 `decisionGraphTemplates`。

### 13.4 撤销、重做和脏状态

第一阶段编辑器应支持最小可用的编辑安全机制：

1. 节点新增、删除、移动进入 undo 栈。
2. 连线新增、删除进入 undo 栈。
3. 节点属性修改进入 undo 栈。
4. 模板应用前记录一次快照。
5. 切换敌人、切换模板、离开页面前，如果当前图有未保存改动，需要提示。

不要求第一阶段实现复杂历史树，只需要线性 undo / redo。

### 13.5 删除和引用失效处理

如果删除模板：

1. 已经应用到敌人的图不应被删除。
2. 敌人的 `templateId` 可以保留为历史来源。
3. 编辑器显示“模板已不存在，当前图已脱离模板”。

如果当前敌人删除了某个已绑定技能：

1. 对应 Action 节点变为 error。
2. 节点仍保留，不自动删除。
3. 校验器提示 `missing_skill_binding`。
4. 用户可以重新绑定技能或删除节点。

如果敌人技能包加载失败：

1. 蓝图图形仍可打开。
2. 技能绑定显示为无法验证。
3. 禁止发布 runtime pack。
4. 允许保存 authoring draft，但必须带 warning。

## 14. UI 文案规则

旧文案全部下线：

1. 意图循环。
2. 行为决策。
3. ActionPriorityTable。
4. intent timeline。

新文案：

1. 敌人决策。
2. 决策模板。
3. 状态。
4. 条件。
5. 动作。
6. 技能绑定。
7. 回退动作。
8. 路径预览。
9. 迁移旧字段。
10. 禁止发布。

如果在迁移前的 Advanced JSON 中展示旧字段，必须标明：

```text
旧模型字段，仅可用于一次性迁移；迁移写回后必须删除。
```

## 15. 测试和验收

### 15.1 单元测试

必须覆盖：

1. 创建节点。
2. 删除节点。
3. 创建连线。
4. 删除连线。
5. 应用模板。
6. 保存为模板。
7. 技能槽位绑定。
8. 非法 skillId 校验。
9. Branch 缺少 true/false 出边校验。
10. 路径预览 trace 输出。
11. 无限循环保护。

### 15.2 页面测试

必须覆盖：

1. 打开敌人编辑器。
2. 切换到“敌人决策”页。
3. 应用模板。
4. 添加 Action 节点。
5. 绑定当前敌人技能。
6. 拖动节点后保存。
7. 重新加载后节点位置存在。
8. 路径预览可生成回合列表。
9. 旧“意图循环 / 行为决策”页签不存在。

### 15.3 回归检查

第一阶段完成后必须检查：

1. 主入口页面可打开。
2. 敌人编辑器可打开。
3. 技能编辑器可打开。
4. 技能测试器可打开。
5. 地图编辑器可打开。
6. 关卡编辑器可打开。
7. `npm test` 通过。
8. 敌人包 JSON 可解析。
9. 如果运行时尚未接入 `enemyDecision`，发布 runtime pack 必须被阻止。

## 16. 风险和处理

### 16.1 编辑器复杂度风险

蓝图编辑器天然复杂，不能直接塞进现有大文件。

处理：

1. 独立模块。
2. 图模型、渲染、校验、预览分层。
3. `EnemyEditorPage.js` 只做集成。

### 16.2 硬切换发布风险

第一阶段如果不接运行时，而旧运行时仍依赖 `intentModel` / `decisionModel`，直接发布 runtime pack 会导致战斗行为不可用。

处理：

1. 编辑器隐藏并迁移旧概念。
2. 不生成任何旧字段。
3. 如果运行时尚未支持 `enemyDecision`，禁止发布 runtime pack。
4. 若必须保证当前战斗页面可玩，则把 `EnemyDecisionGraphPlanner` 提前到同一发布批次。

### 16.3 模板误改风险

如果模板修改自动影响所有敌人，会导致不可控变化。

处理：

1. 模板应用时复制为实例。
2. 模板更新不自动传播。
3. 提供显式“应用模板更新”操作。

### 16.4 自由脚本风险

自由表达式会带来安全和调试问题。

处理：

1. 第一阶段只开放枚举条件。
2. 条件类型必须由校验器和预览器共同支持。
3. 未实现条件不得出现在下拉框中。

## 17. 后续阶段

### 17.1 第二阶段：运行时接入

目标：

1. 新增 `EnemyDecisionGraphPlanner`。
2. 每个敌人实例保存当前 state。
3. 每回合先推进状态机，再选择动作。
4. 用蓝图 Action 节点输出真实 skill plan。
5. 确认发布包不再包含旧 `intentModel` / `decisionModel`。

### 17.2 第三阶段：调试和实战对照

目标：

1. 战斗日志显示状态机路径。
2. 编辑器路径预览和真实战斗 trace 可对照。
3. 支持导入一段真实战斗日志复盘。

### 17.3 第四阶段：高级模板

目标：

1. Boss 阶段模板。
2. 反击姿态模板。
3. 蓄力爆发模板。
4. 支援单位模板。
5. 多敌人协作模板。

## 18. 第一阶段完成定义

满足以下条件才算第一阶段完成：

1. 敌人编辑器中存在“敌人决策”页。
2. 旧“意图循环 / 行为决策”页不再作为编辑入口出现。
3. 可以创建并编辑一张敌人决策图。
4. 可以创建、复制、删除、重命名模板。
5. 可以把模板应用到敌人。
6. Action 节点可以绑定当前敌人的技能。
7. 图结构可以保存到 enemy pack。
8. 重新加载后图结构和布局不丢失。
9. 静态校验能发现关键错误。
10. 路径预览能输出多回合 trace。
11. 现有主页面、敌人编辑器、技能编辑器、技能测试器、地图编辑器、关卡编辑器不因该变更报错。
12. 如果运行时尚未接入 `enemyDecision`，runtime pack 发布按钮必须阻止发布并解释原因。
13. 第一阶段没有声称真实战斗已经按新状态机运行。

## 19. 推荐实施顺序

1. 先落数据 schema 和迁移规则。
2. 再做纯模型层：
   - 图增删改。
   - 模板 CRUD。
   - 校验。
   - 路径预览。
3. 再做蓝图 UI：
   - 画布。
   - 节点。
   - 连线。
   - 属性面板。
4. 再嵌入敌人编辑器。
5. 最后处理旧字段迁移删除和 runtime pack 发布拦截。

这个顺序可以避免先做出一个漂亮画布，但底层数据不可维护。
