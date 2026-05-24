# 节点派生关卡编辑器软件设计说明

创建时间：2026-05-24

状态：`草案 / 待评审`

正向参考文档：

1. `DOC/CODEX_DOC/02_设计说明/S3_关卡地图与编辑器/26-关卡地图选择与地图包(level_map_selection)-设计说明.md`
2. `DOC/CODEX_DOC/02_设计说明/27-地图编辑器故事章节与目录式地图包(map_editor_story_package)-设计说明.md`
3. `DOC/CODEX_DOC/02_设计说明/S4_技能系统与编辑器/04-技能编辑器(skill_editor_design)-设计说明.md`

历史兼容文档：

1. `DOC/CODEX_DOC/02_设计说明/S3_关卡地图与编辑器/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md`

## 1. 文档定位

本文定义新的 `关卡编辑器` 形态：关卡不再作为独立预制库存在，而是由地图编辑器中的地图节点派生出来，再进入关卡详情页细化。

本文对既有历史关卡编辑器和 `24-关卡管理与关卡编辑器` 做一次业务口径修正：

1. 旧口径把关卡编辑器设计成独立关卡库管理器，这个方向不再采用。
2. 新口径把关卡视为“故事地图包内某个地图节点的战斗详情”。
3. 技能、Buff、敌人仍然是可复用预制资源；关卡不是可随便挑选的预制资源。
4. 地图节点负责产生和定位关卡，关卡详情编辑器负责补全战斗内容。

因此，本文后续优先级高于旧文档中关于“新增独立关卡库、波次编辑、敌人池编辑、多敌人成员列表”的设计口径。旧实现中的 `waves[0] / enemyPoolId / enemyPools.members[0]` 仅作为运行时兼容结构，不作为编辑器用户心智。

旧关卡编辑器不得作为新关卡编辑器的设计参考。它只能用于三件事：

1. 识别哪些业务模型需要迁移或废弃。
2. 识别运行时当前仍依赖的兼容字段。
3. 必要时作为数据迁移工具或调试入口保留。

新关卡编辑器的业务结构、保存发布机制、页面信息架构和视觉风格，只参考最新地图编辑器与技能编辑器。

## 2. 核心结论

关卡编辑器的正式定位应改为：

- `地图节点派生的关卡详情编辑器`

它不是：

1. 独立关卡预制库。
2. 敌人编辑器。
3. 地图连线编辑器。
4. 战斗模拟器。
5. 多敌人或多阶段战斗编排器。

它应该负责：

1. 为地图上的一个战斗节点维护一份关卡详情。
2. 配置战斗背景 / 场景。
3. 选择一个敌人模板。
4. 配置奖励。
5. 配置胜利条件、失败条件和解锁规则。
6. 配置必要的战斗初始状态或特殊规则。
7. 随当前故事地图包一起保存、发布和校验。

当前系统短期可以继续把单敌人配置投影到 `levels.json.enemyPools + levels[].waves[0]`，但 UI 不暴露“敌人池”“波次”“敌人队列”等概念。

## 3. 设计目标与非目标

### 3.1 设计目标

1. `所见即所得`
   - 地图编辑器里创建的节点、关卡详情页配置的内容、主游戏实际加载的内容，必须来自同一个故事地图包。
2. `一包一故事`
   - 一个地图包就是一个故事；保存和发布主体都是当前故事地图包，不是单个章节或单个关卡。
3. `节点派生关卡`
   - 新建地图节点时，可以自动创建或显式创建对应关卡详情。
4. `单关单敌人`
   - 一个战斗关卡详情只能选择一个敌人模板。
5. `预制资源引用`
   - 敌人、技能、Buff、背景素材等可复用内容通过引用进入关卡详情，关卡本身不成为预制资源库。
6. `低耦合`
   - 地图编辑器、关卡详情编辑器、主游戏运行时通过目录式包和稳定 JSON 契约连接，不依赖页面 DOM 状态。
7. `强校验`
   - 发布前必须校验节点、关卡详情、敌人引用、背景引用、奖励、条件和解锁规则。

### 3.2 非目标

1. 不在本阶段设计多故事包切换 UI；当前仍是一包一故事。
2. 不做多敌人编队。
3. 不做多阶段战斗编排。
4. 不把敌人属性、技能定义、Buff 定义内嵌到关卡详情中编辑。
5. 不让关卡详情页承担地图节点位置、边关系和地图背景编辑。
6. 不在关卡详情页复刻完整战斗运行时。

## 4. 顶层业务对象

### 4.1 故事地图包

故事地图包是保存、发布、导出和主游戏加载的顶层对象。

推荐目录结构：

```text
assets/map_packs/
  authoring/
    story_pack_v1/
      package.json
      maps.json
      levels.json
      asset-manifest.json
      assets/
  current/
    story_pack_v1/
      package.json
      maps.json
      levels.json
      asset-manifest.json
      assets/
```

`package.json` 应声明：

1. `packageId`
2. `packageVersion`
3. `title`
4. `status`
5. `entryStoryId`
6. `entryChapterId`
7. `files.maps`
8. `files.levels`
9. `assets.manifest`

当前已存在的 `package.json -> maps.json -> asset-manifest.json` 链路需要补上 `files.levels = "levels.json"`。

### 4.2 地图节点

地图节点由地图编辑器维护，是关卡详情的来源和位置真值。

地图节点负责：

1. 节点 id。
2. 节点类型。
3. 节点在逻辑地图空间中的位置。
4. 节点图标、皮肤、素材引用。
5. 与关卡详情的绑定键 `levelId`。
6. 在地图中的入口、分支、汇合关系。

地图节点不负责：

1. 战斗背景。
2. 敌人模板。
3. 奖励。
4. 胜败条件。
5. 战斗初始状态。

当前 `maps[].nodes[]` 里已有 `title / objectiveText / difficultyLabel / rewardPreview` 等字段，后续应收缩为展示覆写或迁移到关卡详情真值。默认读取逻辑应优先使用 `levelId` 指向的关卡详情，地图节点只保留短标签、视觉类型和必要覆写。

### 4.3 关卡详情

关卡详情是地图节点派生出的战斗配置对象。

推荐字段：

```json
{
  "id": "level_ch1_node_01",
  "name": "幽暗森林边缘",
  "description": "森林外围的第一场遭遇战。",
  "source": {
    "storyId": "story_default",
    "chapterId": "story_chapter_1",
    "mapId": "chapter_1_authoring_map",
    "nodeId": "node_01"
  },
  "selectionMeta": {
    "difficultyLabel": "标准",
    "buildHint": "优先稳定防御节奏。"
  },
  "background": "bg_forest_01",
  "primaryEnemy": {
    "templateId": "goblin_story_headhunter"
  },
  "rewards": {
    "exp": 100,
    "gold": 50,
    "kp": 1
  },
  "unlockRules": {
    "mode": "after_nodes_cleared",
    "requiredNodeIds": ["node_00"]
  },
  "battleRules": {
    "slotLayoutId": "default_v1",
    "victoryCondition": { "type": "defeat_primary_enemy" },
    "failureCondition": { "type": "player_hp_zero" }
  },
  "battlePlayerState": {}
}
```

短期为了兼容 `DataManagerV2`，发布产物可以继续生成：

1. `enemyPools[poolId].members[0].templateId`
2. `levels[levelId].waves[0].enemyPoolId`

但编辑器内部应通过 `primaryEnemy.templateId` 这类单敌人语义操作，再由导出适配层投影到旧运行时字段。

### 4.4 预制资源

以下对象仍然是独立预制资源：

1. 敌人模板：`assets/data/enemies.json`
2. 技能包：`assets/data/skills_melee_v4_5.json`
3. Buff 包：`assets/data/buffs_v2_7.json` 或后续正式 Buff 包
4. 战斗背景素材：由故事地图包资源库或全局资源库引用

关卡详情只保存引用，不复制这些资源定义。

## 5. 编辑器职责边界

### 5.1 地图编辑器

地图编辑器继续负责：

1. 新建 / 打开故事地图包。
2. 新建章节。
3. 新建地图。
4. 新建、删除、移动地图节点。
5. 编辑节点视觉和地图背景。
6. 编辑边关系。
7. 在节点检查器中显示关卡详情摘要。
8. 为选中节点创建关卡详情。
9. 跳转到选中节点的关卡详情编辑器。
10. 保存和发布整个故事地图包。

地图编辑器可以提供少量快捷编辑，例如“本关敌人”选择器，但这只能是关卡详情的摘要入口，不能替代完整关卡详情编辑器。

### 5.2 关卡详情编辑器

关卡详情编辑器负责当前节点对应关卡的深度配置。

它的入口不是“新建关卡”，而是：

1. 从地图编辑器选中一个节点。
2. 若该节点没有 `levelId`，先创建关卡详情并绑定。
3. 点击“编辑关卡详情”进入详情页。
4. 详情页根据 `packageId / mapId / nodeId / levelId` 加载上下文。

关卡详情编辑器可以允许在同一张地图的节点之间切换，但这种切换是“切换节点上下文”，不是“浏览预制关卡库”。

### 5.3 技能编辑器参考机制

关卡详情编辑器应参考技能编辑器的以下机制：

1. `Pack-first`
   - 编辑完整包文档，不只编辑数组片段。
2. `meta-driven UI`
   - 下拉枚举、字段说明和默认值尽量来自 `meta.enums / meta.fieldNotes`。
3. `保留未知字段`
   - 编辑器不认识的扩展字段默认透传，避免工具版本落后导致数据丢失。
4. `保存工作稿 / 发布到主流程`
   - 保存写入 authoring 区；发布写入 current 区。
5. `强校验`
   - 问题列表必须能定位到具体字段。
6. `原子字段即时写回，复杂 JSON 显式应用`
   - 名称、奖励数字、敌人选择等原子字段可自动写回工作区。
   - 特殊规则、复杂条件等 JSON 字段需要显式“应用”。

### 5.4 地图编辑器参考机制

关卡详情编辑器应参考最新地图编辑器的以下机制：

1. `一包一故事`
   - 当前编辑上下文始终绑定一个故事地图包。
2. `章节 / 地图 / 节点层级`
   - 关卡详情的导航从故事包结构进入，而不是从全局关卡列表进入。
3. `authoring/current 双目录`
   - 保存工作稿写入 authoring；发布到主流程写入 current。
4. `明确保存路径`
   - 页面必须直接显示工作稿目录、发布目录和当前包入口文件。
5. `抽屉式信息区`
   - 左侧结构导航和右侧检查区可以收起，主编辑区随之自适应。
6. `数据驱动`
   - 页面状态不直接成为导出真值，所有导出来自 workspace 文档。

### 5.5 样式基准

新关卡详情编辑器的视觉风格应跟随最新地图编辑器和技能编辑器：

1. 顶部文件区和保存/发布按钮组参考地图编辑器。
2. 左侧结构树参考地图编辑器的故事 / 章节 / 地图层级。
3. 中央编辑 Tabs 和字段密度参考技能编辑器。
4. 右侧问题与摘要区参考地图编辑器检查器。
5. 不沿用旧关卡编辑器的页面结构、按钮分组、字段命名和视觉样式。

关卡详情编辑器的对象导航不是全局关卡库，而是当前故事包内的章节 / 地图 / 节点导航。

## 6. 信息架构与页面形态

推荐采用独立页面：

```text
顶部：故事包上下文 + 当前节点路径 + 保存工作稿 + 发布到主流程
左侧：当前故事包的章节 / 地图 / 节点导航
中间：关卡详情 Tabs
右侧：当前关卡摘要 + 校验问题 + 资源引用状态
```

### 6.1 顶部区域

顶部只放故事包级操作：

1. 返回地图编辑器。
2. 当前包目录。
3. 当前节点路径：故事 / 章节 / 地图 / 节点。
4. 保存工作稿。
5. 发布到主流程。
6. 导出完整包。

顶部不放“新增关卡”“删除关卡”这类全局关卡库操作。

### 6.2 左侧导航

左侧导航显示当前故事包内结构：

1. 章节列表。
2. 地图列表。
3. 当前地图节点列表。
4. 节点是否已有关卡详情。
5. 节点校验状态。

节点切换后，中间区域加载该节点绑定的关卡详情。

### 6.3 中间编辑 Tabs

建议 Tabs：

1. `概览`
   - 名称、描述、难度标签、构筑提示。
2. `战斗场景`
   - 战斗背景、场景氛围、进入战斗时的展示摘要。
3. `敌人`
   - 单个敌人模板选择。
   - 敌人只读摘要：HP、AP、速度、技能、身体部位。
   - 可跳转敌人编辑器，但不在此编辑敌人定义。
4. `奖励`
   - exp、gold、kp、后续物品或解锁奖励。
5. `条件与规则`
   - 解锁规则、胜利条件、失败条件。
   - 默认可从地图入边推导前置节点，但最终保存为关卡详情规则。
6. `初始状态`
   - 玩家初始身体状态、临时技能授予、特殊战斗参数。
7. `高级`
   - 原始 JSON、兼容字段预览、导出投影预览。

### 6.4 右侧检查区

右侧检查区显示：

1. 当前绑定：`nodeId -> levelId`。
2. 保存位置：authoring 包路径。
3. 发布位置：current 包路径。
4. 当前敌人引用是否存在。
5. 当前背景引用是否存在。
6. 当前奖励和条件是否可发布。
7. 当前关卡会生成的运行时兼容字段摘要。

## 7. 数据流

### 7.1 加载

关卡详情编辑器加载顺序：

1. 读取 `assets/map_packs/authoring/<packageId>/package.json`。
2. 根据 `package.json.files.maps` 读取 `maps.json`。
3. 根据 `package.json.files.levels` 读取 `levels.json`。
4. 读取敌人模板、技能包、Buff 包和资源清单。
5. 根据 URL 或页面参数定位 `mapId / nodeId / levelId`。
6. 如果节点没有关卡详情，提示创建；不自动静默生成不可见数据。

### 7.2 编辑

编辑流程：

1. 字段先写入 `LevelDetailWorkspace`。
2. Workspace 完成规范化和字段级校验。
3. 页面按 Workspace 快照重绘。
4. 保存和发布只读取 Workspace 导出，不读取 DOM 状态。

### 7.3 保存工作稿

保存工作稿的主体是当前故事地图包。

目标目录：

```text
assets/map_packs/authoring/<packageId>/
```

保存内容至少包含：

1. `package.json`
2. `maps.json`
3. `levels.json`
4. `asset-manifest.json`

当前用 `__skill_editor_file` 写回 `assets/data/levels.json` 的做法只能作为过渡，不应作为最终关卡详情保存模型。

### 7.4 发布到主流程

发布主体也是当前故事地图包。

目标目录：

```text
assets/map_packs/current/<packageId>/
```

发布前必须通过校验。主游戏应优先从 current 包内读取：

1. `package.json`
2. `maps.json`
3. `levels.json`
4. `asset-manifest.json`

如果 current 包内没有 `levels.json`，才允许回退到历史全局文件 `assets/data/levels.json`，并在诊断信息中明确这是兼容回退。

### 7.5 导出完整包

导出完整包不是导出单个 JSON，而是导出完整目录包文件集合。

最小导出文件：

1. `package.json`
2. `maps.json`
3. `levels.json`
4. `asset-manifest.json`

如果使用包内资源副本，还应包含 `assets/` 下的图片资源。若暂时只保存资源引用，导出报告必须列出每个引用的源路径和缺失状态。

## 8. `LevelDetailWorkspace` 设计

建议新增纯数据工作区：

- `script/editor/level/LevelDetailWorkspace.js`

职责：

1. 装载故事包内的 `levels.json`。
2. 根据地图节点创建或查找关卡详情。
3. 提供字段级读写 API。
4. 暴露单敌人语义 API。
5. 保留未知字段。
6. 导出 authoring 文档。
7. 导出 runtime 兼容文档。
8. 提供校验问题列表。

建议 API：

```js
workspace.listNodeLevelSummaries({ storyId, chapterId, mapId })
workspace.getLevelForNode({ mapId, nodeId })
workspace.ensureLevelForNode({ storyId, chapterId, mapId, nodeId })
workspace.updateLevelBasics(levelId, patch)
workspace.setBattleBackground(levelId, backgroundRef)
workspace.setPrimaryEnemy(levelId, templateId)
workspace.updateRewards(levelId, patch)
workspace.updateBattleRules(levelId, patch)
workspace.updateUnlockRules(levelId, patch)
workspace.exportAuthoringDocument()
workspace.exportRuntimeDocument()
workspace.validatePackage({ mapsDocument, enemiesDocument, assetManifest })
```

`LevelPackWorkspace` 可以继续作为历史兼容层或迁移辅助，但不能作为新关卡详情编辑器的设计基类。新的 `LevelDetailWorkspace` 必须按地图包、地图节点和关卡详情重新建模，不能继续把“关卡库 CRUD”和“敌人池 / 运行时兼容字段”暴露给新的关卡详情页。

## 9. 运行时兼容策略

当前 `DataManagerV2` 的事实是：

1. 关卡运行时从 `levels.json.levels` 读取关卡定义。
2. 敌人引用通过 `enemyPools` 展开。
3. `instantiateLevel(levelId)` 当前只实例化第一个运行时兼容分组。

因此短期发布时可以这样投影：

```json
{
  "enemyPools": {
    "pool_level_ch1_node_01_primary": {
      "id": "pool_level_ch1_node_01_primary",
      "name": "幽暗森林边缘敌人",
      "members": [
        { "templateId": "goblin_story_headhunter", "position": 1 }
      ]
    }
  },
  "levels": {
    "level_ch1_node_01": {
      "id": "level_ch1_node_01",
      "background": "bg_forest_01",
      "waves": [
        {
          "waveId": "primary",
          "waveType": "fixed",
          "enemyPoolId": "pool_level_ch1_node_01_primary"
        }
      ]
    }
  }
}
```

这只是兼容投影，不改变用户侧语义。编辑器 UI 只能显示“本关敌人：某某敌人模板”。

中期应升级 `DataManagerV2`，允许直接消费：

```json
{
  "primaryEnemy": {
    "templateId": "goblin_story_headhunter"
  }
}
```

升级完成后，兼容投影可以保留为导出选项或历史包读取适配。

## 10. 解锁规则归属

当前阶段解锁规则先放在关卡详情中，但必须和地图边关系分工清楚：

1. `maps[].edges[]`
   - 表达地图路线结构。
   - 决定节点之间的连接和玩家可见路线。
2. `levels[].unlockRules`
   - 表达该节点是否允许进入。
   - 可由地图入边默认推导。
   - 可追加前置通关、道具、章节状态等规则。

编辑器应提供“从地图入边同步前置节点”的按钮或默认建议，但保存后的规则仍属于关卡详情。

禁止把地图边复制成另一套隐藏路线字段写入关卡详情。

## 11. 校验规则

发布前阻断级错误：

1. 战斗节点没有绑定 `levelId`。
2. 一个 `levelId` 绑定多个地图节点。
3. 关卡详情的 `source.nodeId` 不存在。
4. 战斗关卡没有敌人模板。
5. 敌人模板不存在于敌人资源。
6. 战斗背景引用不存在。
7. 奖励字段不是非负数字。
8. 胜利条件或失败条件类型不合法。
9. 解锁规则引用不存在的节点或关卡。
10. `package.json.files.levels` 缺失或指向不存在文件。

警告级问题：

1. 地图节点保留了与关卡详情重复的展示覆写。
2. 关卡详情存在未被任何节点引用的孤儿数据。
3. 使用了全局 `assets/data/levels.json` 兼容回退。
4. 资源只保存外部引用，未复制进包内 `assets/`。
5. 特殊规则字段只能通过高级 JSON 编辑。

## 12. 与现有实现的差距

当前实现已经具备：

1. 地图包 authoring/current 目录。
2. `package.json + maps.json + asset-manifest.json` 保存和发布。
3. 一包一故事。
4. 章节 / 地图 / 节点 / 边的编辑。
5. 地图节点绑定 `levelId`。
6. 地图编辑器中选中节点后展示并切换本关敌人。

当前实现仍不符合本文目标的部分：

1. 包内没有 `levels.json`，关卡详情仍写回全局 `assets/data/levels.json`。
2. `package.json.files` 没有声明关卡详情文件。
3. 现有 `LevelEditorPage` 的设计思路、页面形态和样式不符合新方向，不能作为新关卡详情编辑器参考。
4. 地图节点上仍有部分关卡展示字段，容易与关卡详情真值重复。
5. 主游戏仍主要依赖全局 `assets/data/levels.json`。
6. 保存/发布 API 当前只允许地图包三个文件，尚未纳入 `levels.json`。

这些差距应进入后续实施计划，而不是继续在地图编辑器底部追加临时面板来绕过。

## 13. 分阶段实施建议

### 阶段一：契约补齐

1. 地图包 `package.json.files` 增加 `levels`。
2. authoring/current 包目录增加 `levels.json`。
3. 保存/发布 API 允许写入 `levels.json`。
4. 地图包 IO 校验增加关卡详情文件检查。

### 阶段二：Workspace 重构

1. 新增 `LevelDetailWorkspace`。
2. 将单敌人语义封装为 `primaryEnemy`。
3. 提供旧 `enemyPools/waves[0]` 投影。
4. 增加节点与关卡详情双向校验。

### 阶段三：关卡详情页

1. 新增 `test/level_detail_editor_v1.html` 或正式等价入口。
2. 从地图编辑器节点检查器跳转。
3. 实现概览、战斗场景、敌人、奖励、条件与规则、初始状态、高级 Tabs。
4. 不复用旧 `LevelEditorPage` 的布局、交互和样式。

### 阶段四：主游戏加载

1. 主游戏优先读取 `assets/map_packs/current/<packageId>/package.json`。
2. 根据包入口读取 `maps.json` 与 `levels.json`。
3. `selectedLevelId` 进入战斗时使用包内关卡详情。
4. 全局 `assets/data/levels.json` 只作为兼容回退。

### 阶段五：旧口径清理

1. 隐藏或退役旧关卡库 UI。
2. 将旧关卡编辑器保留为兼容调试页或迁移工具；新功能不在旧页面继续扩展。
3. 清理地图节点上重复的关卡内容主编辑入口。
4. 更新 WBS 和验收入口。

## 14. 验收标准

1. 在地图编辑器中新建节点后，可以为该节点创建关卡详情。
2. 从地图节点进入关卡详情页后，能看到明确的节点路径和包路径。
3. 每个战斗关卡详情只能选择一个敌人模板。
4. 关卡详情页不出现多敌人列表、敌人池编辑或运行时兼容分组编辑。
5. 保存工作稿后，authoring 包目录包含 `package.json / maps.json / levels.json / asset-manifest.json`。
6. 发布后，current 包目录包含同样的完整文件集合。
7. 主游戏从 current 包读取地图和关卡详情，而不是继续只读全局 `assets/data/levels.json`。
8. 删除或修改地图节点后，关卡详情能报告孤儿数据或失效绑定。
9. 发布前校验能阻断缺敌人、缺背景、缺 levelId、缺 levels 文件等错误。
10. 旧运行时兼容字段存在时，UI 仍只按“本关敌人”表达。

## 15. 当前结论

新的关卡编辑器不应继续沿用“关卡预制库”的设计。正确方向是：

- 地图编辑器负责创建故事、章节、地图和节点。
- 地图节点派生关卡详情。
- 关卡详情编辑器负责补全单个节点的战斗内容。
- 保存和发布的主体始终是故事地图包。
- 技能、Buff、敌人是预制资源；关卡是故事地图包内的节点详情。

这能同时解决三个问题：

1. 关卡编辑器和地图编辑器职责重复。
2. 关卡详情与主游戏加载数据割裂。
3. 用户无法确认保存、发布、导出到底作用于什么对象。
