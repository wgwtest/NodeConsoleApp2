# 敌人技能包与技能编辑器模式切换设计说明

创建时间：2026-05-25 00:21:44 +0800

状态：`已实现 / 第一阶段运行中`

归属子系统：`S4_技能系统与编辑器`

关联子系统：`S6_敌人系统与编辑器`、`S7_数据存档与内容契约`

关联文档：

1. `DOC/CODEX_DOC/02_设计说明/S4_技能系统与编辑器/03-技能系统(skill_design)-设计说明.md`
2. `DOC/CODEX_DOC/02_设计说明/S4_技能系统与编辑器/04-技能编辑器(skill_editor_design)-设计说明.md`
3. `DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
4. `DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/28-敌人编辑器(enemy_editor)-设计说明.md`

## 1. 背景结论

当前敌人技能链路已经能运行，但组织方式不适合作为长期内容生产方案。

现状如下：

1. 敌人模板在 `assets/data/enemies.json` 中通过 `skills[]` 引用技能 ID。
2. 运行时 `DataManagerV2.getSkillConfig()` 当前主要从玩家技能包 `assets/data/skills_melee_v4_5.json` 取技能。
3. 一部分旧敌人技能 ID 通过 `_enemySkillAliases` 映射到玩家正式技能，例如：
   - `skill_bite -> skill_heavy_swing`
   - `skill_throw_stone -> skill_skull_cracker`
   - `skill_shield_bash -> skill_skull_cracker`
4. 这种做法可以兼容旧数据，但会导致敌人技能语义和玩家技能树混在一起。
5. 如果继续把敌人技能做成玩家技能包里的隐藏节点，会污染玩家技能包职责，并让技能编辑器、技能树、技能新增规程越来越难判断“这是玩家成长技能，还是敌人行为技能”。

因此，长期方案应把玩家技能与敌人技能拆成两个技能包，同时复用同一套 skill schema、Buff 引用和运行时执行器。

## 2. 设计目标

本方案要解决以下问题：

1. 敌人技能有独立真源
   - 敌人技能不再长期寄生在玩家技能树中。
   - 敌人技能包可以独立加载、保存、发布和回滚。
2. 技能编辑器复用
   - 不单独复制一个敌人技能编辑器。
   - 当前技能编辑器增加“技能类型 / 技能域”切换。
   - 同一套动作编辑、Buff 引用、目标选择、AP 成本和校验能力可同时服务玩家技能与敌人技能。
3. 玩家技能树保持纯净
   - 玩家技能包继续负责成长树、KP、稀有度、前置节点和解锁逻辑。
   - 敌人技能包不需要完整技能树，不参与玩家学习和 KP 成长。
4. 敌人编辑器引用更清晰
   - 敌人模板编辑器从敌人技能包中搜索和绑定技能。
   - 校验敌人技能引用时优先检查敌人技能包，再按兼容策略检查旧别名或玩家技能包。
5. 运行时装载清晰
   - 玩家释放技能使用玩家技能 catalog。
   - 敌人规划和执行技能使用敌人技能 catalog。
   - 旧数据在过渡期继续可运行，但不作为新内容生产规范。

## 3. 非目标

本方案第一阶段不做以下事情：

1. 不重写技能执行 schema。
2. 不把敌人技能做成一棵完整的成长树。
3. 不把敌人技能放入玩家技能树 UI 中展示。
4. 不在敌人技能里硬编码单个敌人或单个技能的专用运行时逻辑。
5. 不替代 Buff 编辑器；敌人技能仍通过 `buffRefs` 或通用 `actions[]` 消费 Buff。
6. 不让敌人编辑器直接编辑技能定义；敌人编辑器只引用敌人技能。

## 4. 数据真源与文件边界

### 4.1 玩家技能包

玩家技能包继续使用当前文件：

```text
assets/data/skills_melee_v4_5.json
```

职责：

1. 玩家技能树节点。
2. 玩家可学习技能。
3. KP 成本、稀有度、前置关系、技能树坐标。
4. 主流程中玩家战斗技能的运行时配置。

推荐 `meta` 标记：

```json
{
  "$schemaVersion": "skills_melee_v3",
  "meta": {
    "skillDomain": "player",
    "selectedTreeId": "melee_v4_5"
  },
  "skills": []
}
```

### 4.2 敌人技能包

新增敌人技能包：

```text
assets/data/skills_enemy_v1.json
```

职责：

1. 敌人专用攻击、治疗、防御、控制和骚扰技能。
2. 敌人种族 / 职业 / AI 策略使用的技能候选池。
3. 不参与玩家技能树和 KP 学习。
4. 可被敌人编辑器、敌人行为规划器、运行时战斗执行器消费。

推荐 `meta` 标记：

```json
{
  "$schemaVersion": "skills_melee_v3",
  "meta": {
    "skillDomain": "enemy",
    "selectedTreeId": "enemy_v1",
    "notes": [
      "Enemy skill pack uses the shared skill schema but does not participate in player KP progression."
    ]
  },
  "skills": []
}
```

### 4.3 为什么仍使用 skill schema

敌人技能和玩家技能在运行时层面共享以下核心字段：

1. `id`
2. `name`
3. `description`
4. `speed`
5. `target`
6. `costs`
7. `requirements`
8. `actions`
9. `buffRefs`

因此不应为敌人技能另造一套 schema。

差异只在内容生产层：

| 维度 | 玩家技能 | 敌人技能 |
| --- | --- | --- |
| 是否进技能树 | 是 | 否 |
| 是否有 KP 成本 | 是 | 否 |
| 是否需要前置关系 | 是 | 通常否 |
| 是否显示稀有度 | 是 | 可选，仅用于内容分级 |
| 主要组织方式 | 技能树 | 列表、标签、种族/职业分组 |
| 消费者 | 玩家成长、玩家战斗 | 敌人模板、敌人 AI、敌人战斗 |

## 5. 技能编辑器模式切换

### 5.1 顶栏入口

技能编辑器顶部应增加“技能类型”切换控件：

```text
技能类型：[我方技能] [敌方技能]
```

切换后改变以下上下文：

1. 默认打开路径。
2. 最近版本列表。
3. 保存工作稿目录和文件名。
4. 发布目标。
5. 编辑区字段显隐。
6. 校验规则。
7. 技能库组织方式。

### 5.2 我方技能模式

配置如下：

| 项 | 值 |
| --- | --- |
| `skillDomain` | `player` |
| 默认运行时路径 | `assets/data/skills_melee_v4_5.json` |
| 工作稿目录 | `assets/skill_packs/authoring/` |
| 工作稿命名 | `skills_melee_v4_5_YYYYMMDD_HHMMSS.json` |
| 发布目标 | `assets/data/skills_melee_v4_5.json` |
| 主视图 | 技能树画布 |
| 核心字段 | `unlock`、`rarity`、`prerequisites`、`editorMeta.x/y`、`costs`、`actions`、`buffRefs` |

### 5.3 敌方技能模式

配置如下：

| 项 | 值 |
| --- | --- |
| `skillDomain` | `enemy` |
| 默认运行时路径 | `assets/data/skills_enemy_v1.json` |
| 工作稿目录 | `assets/skill_packs/authoring/` |
| 工作稿命名 | `skills_enemy_v1_YYYYMMDD_HHMMSS.json` |
| 发布目标 | `assets/data/skills_enemy_v1.json` |
| 主视图 | 技能列表 / 分组视图 |
| 核心字段 | `target`、`costs.ap`、`speed`、`actions`、`buffRefs`、`tags`、`description` |

敌方技能模式下应弱化或隐藏以下字段：

1. `unlock.cost.kp`
2. `prerequisites`
3. 玩家技能树坐标
4. 玩家学习状态
5. 技能树 LOD 展示语义

这些字段可以保留透传，但不作为敌方技能的核心编辑入口。

### 5.4 技能库组织方式

敌方技能不适合用完整树组织，推荐使用列表和标签组织：

```text
全部敌人技能
├─ goblin
│  ├─ scout
│  ├─ hunter
│  └─ support
├─ orc
│  ├─ warrior
│  └─ berserker
├─ undead
│  └─ defender
└─ acceptance / demo
```

技能条目推荐显示：

1. 技能名。
2. 技能 ID。
3. AP 成本。
4. 目标类型。
5. 主要效果。
6. Buff 引用。
7. 推荐敌人类型标签。

## 6. 后端保存与发布策略

### 6.1 API 语义

现有技能包保存 / 发布接口应从“只服务玩家技能包”改为“按技能域服务不同技能包”。

推荐请求参数：

```json
{
  "kind": "player",
  "targetPath": "assets/data/skills_melee_v4_5.json",
  "content": "{...}"
}
```

或：

```json
{
  "kind": "enemy",
  "targetPath": "assets/data/skills_enemy_v1.json",
  "content": "{...}"
}
```

### 6.2 最近版本

最近版本接口应支持按 `kind` 过滤：

```text
/api/skill-packs/recent?kind=player
/api/skill-packs/recent?kind=enemy
```

过滤规则：

| kind | 运行时文件 | authoring 文件前缀 |
| --- | --- | --- |
| `player` | `assets/data/skills_melee_v4_5.json` | `skills_melee` |
| `enemy` | `assets/data/skills_enemy_v1.json` | `skills_enemy` |

这样可以避免敌人技能版本出现在玩家技能下拉里，也避免玩家技能版本污染敌方技能模式。

### 6.3 发布白名单

发布接口应按 `kind` 使用不同白名单：

| kind | 允许发布目标 |
| --- | --- |
| `player` | `assets/data/skills_melee_v4_5.json` |
| `enemy` | `assets/data/skills_enemy_v1.json` |

不允许前端把敌人技能误发布到玩家技能包，也不允许玩家技能误发布到敌人技能包。

## 7. 运行时装载策略

### 7.1 内容注册表

`assets/data/config.json` 应新增敌人技能内容源：

```json
{
  "contentRegistry": {
    "skills": {
      "kind": "skills",
      "path": "skills_melee_v4_5.json"
    },
    "enemySkills": {
      "kind": "skills",
      "path": "skills_enemy_v1.json",
      "schemaVersion": "skills_melee_v3",
      "rootKey": "skills"
    }
  }
}
```

保留 `skills` 作为玩家技能包入口，新增 `enemySkills` 作为敌人技能包入口。

### 7.2 DataManagerV2 catalog

运行时应维护两个 catalog：

1. `skillCatalog`
   - 玩家技能 catalog。
   - 由 `assets/data/skills_melee_v4_5.json` 构建。
2. `enemySkillCatalog`
   - 敌人技能 catalog。
   - 由 `assets/data/skills_enemy_v1.json` 构建。

推荐查询接口：

```js
getSkillConfig(skillId)
getEnemySkillConfig(skillId)
```

语义：

1. 玩家规划和执行调用 `getSkillConfig()`。
2. 敌人规划和执行调用 `getEnemySkillConfig()`。
3. `getEnemySkillConfig()` 优先读取敌人技能包。
4. 过渡期如果敌人技能包缺失该 ID，可按兼容规则 fallback 到旧别名或玩家技能包。

### 7.3 敌人行动规划器

`EnemyActionPlanner` 不应直接假设敌人技能来自玩家技能 catalog。

构造参数应从：

```js
new EnemyActionPlanner({ getSkillConfig })
```

演进为：

```js
new EnemyActionPlanner({ getEnemySkillConfig })
```

或保留旧参数名但调用方传入敌人技能解析函数。

关键要求：

1. 规划候选技能时使用敌人技能包。
2. 分数计算继续基于 `actions`、`buffRefs`、`target` 和 `costs`。
3. 不把某个敌人或某个技能 ID 写入规划器专用分支。

### 7.4 执行入口

`executeEnemySkill(action)` 应使用 `getEnemySkillConfig(action.skillId)`。

玩家执行入口继续使用 `getSkillConfig(action.skillId)`。

这样可以确保：

1. 玩家和敌人可以拥有同名语义但不同数值的技能。
2. 敌人技能不会被玩家技能树意外学习。
3. 敌人技能可以独立平衡，不影响玩家构筑。

## 8. 敌人编辑器交接

敌人编辑器维护的是 `assets/data/enemies.json`，其中 `skills[]` 只保存 skillId。

敌人编辑器应消费敌人技能包：

```text
assets/data/skills_enemy_v1.json
```

并提供：

1. 敌人技能搜索。
2. 技能摘要预览。
3. AP 成本与敌人 `stats.ap` 的匹配校验。
4. 缺失技能引用提示。
5. 旧别名技能提示为“兼容引用”，建议迁移到敌人技能包中的正式 ID。

敌人编辑器不应直接创建或编辑技能定义。

如需编辑技能，应从敌人编辑器提供“打开敌方技能编辑模式”的跳转，而不是在敌人模板表单中内嵌技能编辑器。

## 9. 迁移策略

### 9.1 第一阶段：建立独立敌人技能包

1. 新增 `assets/data/skills_enemy_v1.json`。
2. 把当前旧别名承载的敌人行为转换为敌人专用技能。
3. 保留旧 `_enemySkillAliases` 兼容。
4. 敌人模板先可逐步替换 `skills[]`。

### 9.2 第二阶段：编辑器支持技能域切换

1. 技能编辑器新增 `skillDomain` 状态。
2. 顶栏增加“我方技能 / 敌方技能”切换。
3. 保存、发布、最近版本列表按 `kind` 分流。
4. 敌方技能模式隐藏玩家成长相关字段。

### 9.3 第三阶段：运行时双 catalog

1. `config.json` 注册 `enemySkills`。
2. `DataManagerV2` 装载并构建 `enemySkillCatalog`。
3. `EnemyActionPlanner` 使用敌人技能解析入口。
4. `executeEnemySkill` 使用敌人技能解析入口。

### 9.4 第四阶段：迁移敌人模板

1. 将 story 敌人的旧技能 ID 替换为敌人技能包中的正式 ID。
2. 验收敌人如需固定技能，可保留 `skill_demo_enemy_*` 或迁移为 `enemy_skill_demo_*`。
3. 旧别名只用于历史存档和旧测试数据兼容，不再作为新增敌人的推荐写法。

## 10. 校验与测试要求

### 10.0 本轮实现落地

实现时间：2026-05-25

本轮已经完成第一阶段到第三阶段的代码落地：

1. `assets/data/skills_enemy_v1.json` 已作为敌人技能包真源接入。
2. 技能编辑器顶栏已经支持“我方技能 / 敌方技能”切换，切换后会刷新对应最近版本并打开对应默认技能包。
3. 技能包保存、发布和最近版本接口已经按 `kind=player|enemy` 分流。
4. `config.json` 已注册 `enemySkills`，`DataManagerV2` 已构建 `enemySkillCatalog`。
5. 敌人规划和敌人执行技能时优先使用 `getEnemySkillConfig()`。
6. 敌人编辑器默认以 `assets/data/skills_enemy_v1.json` 作为技能引用源。
7. 当前 `assets/data/enemies.json` 中的技能引用已经能被敌方技能包覆盖；旧引用先作为兼容技能保留。

### 10.1 静态校验

新增或调整敌人技能包后，至少校验：

1. 技能 ID 唯一。
2. `buffRefs` 和 `actions[].effect.amountSource.buffId` 引用存在。
3. `target.selection.candidateParts` 使用标准部位。
4. `costs.ap` 不为负。
5. 敌人模板 `skills[]` 中的 ID 能在敌人技能包或兼容表中解析。

### 10.2 运行时测试

至少覆盖：

1. `DataManagerV2` 能同时装载玩家技能包和敌人技能包。
2. `getSkillConfig()` 不返回敌人专用技能。
3. `getEnemySkillConfig()` 能返回敌人专用技能。
4. `EnemyActionPlanner` 能从敌人技能包中选择技能。
5. `executeEnemySkill()` 能执行敌人技能的 `actions` 和 `buffRefs`。
6. 当前 story 敌人的首回合行为仍可稳定复现。

### 10.3 编辑器测试

至少覆盖：

1. 切换到玩家技能模式后默认路径和发布目标正确。
2. 切换到敌人技能模式后默认路径和发布目标正确。
3. 最近版本列表按技能域过滤。
4. 敌方技能模式不会强制要求 `editorMeta.x/y`。
5. 敌方技能模式保存的 JSON 保留未知字段。

## 11. 风险与降级

### 11.1 主要风险

1. 双 catalog 装载后，如果查询入口混用，可能导致玩家能看到敌人技能，或敌人继续取玩家技能。
2. 后端发布白名单如果没有按 `kind` 分流，可能误覆盖正式玩家技能包。
3. 敌方技能模式如果继续沿用玩家技能树校验，可能错误要求坐标、KP 和前置关系。
4. 旧别名兼容期过长，会让新旧写法混杂。

### 11.2 降级策略

如果第一轮实现风险较高，可以先采用以下降级：

1. 先新增 `skills_enemy_v1.json`，但运行时仍把玩家技能包与敌人技能包合并成一个只读 runtime map。
2. 继续保留 `getSkillConfig()`，但内部先查玩家，再查敌人，敌人执行入口标记来源。
3. 等敌人技能包和编辑器模式稳定后，再拆成严格的 `getSkillConfig()` / `getEnemySkillConfig()` 双入口。

降级方案只能作为过渡，不应成为最终架构。最终架构必须保持玩家技能和敌人技能的查询边界。

## 12. 推荐结论

推荐采用“同一个技能编辑器，多技能域切换”的方案。

理由：

1. 敌人技能和玩家技能共享运行时 schema，复制一个敌人技能编辑器会造成大量重复。
2. 敌人技能不需要玩家技能树，但仍需要动作、目标、AP、Buff 引用和校验能力。
3. 玩家技能包和敌人技能包应拆分真源，避免敌人技能污染玩家成长树。
4. 编辑器模式切换可以复用现有保存、发布、版本管理和字段编辑能力，同时通过 `kind` 明确发布目标。
5. 运行时双 catalog 能让敌人技能独立平衡，并保留旧数据兼容路径。

最终目标是形成如下内容链：

```text
玩家技能编辑模式
  -> assets/data/skills_melee_v4_5.json
  -> player skillCatalog
  -> 玩家技能树 / 玩家战斗

敌方技能编辑模式
  -> assets/data/skills_enemy_v1.json
  -> enemySkillCatalog
  -> 敌人模板 skills[] / EnemyActionPlanner / executeEnemySkill
```
