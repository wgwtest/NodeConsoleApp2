# 敌人编辑器设计说明

创建时间：2026-05-22

状态：`设计基线 / 待实现`

归属子系统：`S6_敌人系统与编辑器`

关联文档：

1. `DOC/CODEX_DOC/02_设计说明/S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
2. `DOC/CODEX_DOC/02_设计说明/S3_关卡地图与编辑器/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md`
3. `DOC/CODEX_DOC/02_设计说明/S3_关卡地图与编辑器/26-关卡地图选择与地图包(level_map_selection)-设计说明.md`
4. `DOC/CODEX_DOC/02_设计说明/S4_技能系统与编辑器/04-技能编辑器(skill_editor_design)-设计说明.md`

## 1. 当前目录结论

当前 `DOC/CODEX_DOC/02_设计说明/` 中没有独立的 `enemy editor` 章节规划。

已有内容如下：

1. `S6_敌人系统与编辑器/11-敌人系统(enemy_design)-设计说明.md`
   - 负责敌人种族、职业、属性、部位、技能组和 AI 行为目标。
2. `S3_关卡地图与编辑器/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md`
   - 负责关卡编辑器、波次和敌人池绑定。
3. `S3_关卡地图与编辑器/26-关卡地图选择与地图包(level_map_selection)-设计说明.md`
   - 负责地图节点、地图包、地图资源和 `levelId` 绑定。

缺口是：

1. 当前没有一个正式作者工具负责维护 `assets/data/enemies.json`。
2. 关卡编辑器和地图编辑器只能选择或引用敌人模板，不能安全生产敌人模板。
3. 敌人模板的字段、技能引用、部位护甲和地图编辑器展示摘要之间还没有统一校验入口。

因此本文件新增 `敌人编辑器` 作为 `S6_敌人系统与编辑器` 的稳定专题设计。

## 2. 文档定位

敌人编辑器是 `Enemy Template Authoring Layer`，负责生产和维护敌人模板目录。

它和技能编辑器、Buff 编辑器类似，都是内容生产工具；但它的第一服务对象不是主流程页面，而是关卡编辑器和地图编辑器。

按当前文档目录口径，敌人编辑器归入 `S6_敌人系统与编辑器`。敌人种族、部位、属性、技能组和 AI 行为语义，与敌人模板作者工具一起组成独立内容域；`S3_关卡地图与编辑器` 只通过敌人池和 `templateId` 消费敌人模板。

固定定位如下：

1. `敌人编辑器`
   - 维护敌人模板真值。
   - 输出 `assets/data/enemies.json` 或后续等价 enemy pack。
   - 校验敌人模板字段、技能引用、部位护甲和地图展示摘要。
2. `关卡编辑器`
   - 维护 `levels.json`。
   - 在波次和敌人池中保存 `templateId`。
   - 不直接编辑敌人模板本体。
3. `地图编辑器`
   - 维护地图节点、边、背景和素材引用。
   - 在“本关敌人”面板中消费敌人模板目录，显示摘要并切换当前关卡首个敌人模板。
   - 不直接编辑敌人模板本体。
4. `运行时`
   - 通过 `DataManagerV2` 装载 `levels.json` 与 `enemies.json`。
   - 通过 `EnemyActionPlanner` 根据敌人技能组和战斗状态规划行为。
   - 不依赖敌人编辑器页面存在。

结论：

- 敌人编辑器是地图编辑器的上游服务工具，不是地图编辑器的子面板。

## 3. 设计目标

敌人编辑器需要解决以下问题：

1. 安全维护敌人模板
   - 新增、复制、编辑、删除或废弃敌人模板。
   - 保证 `id` 唯一，且对象内 `id` 与 key 一致。
2. 服务地图编辑器
   - 输出稳定的敌人模板目录，供地图编辑器下拉选择。
   - 提供地图节点“本关敌人”面板所需摘要：名称、类型、HP/AP/速度、技能组、部位护甲。
3. 服务关卡编辑器
   - 检查 `levels.json.enemyPools.*.members[].templateId` 是否存在。
   - 删除或重命名敌人模板前提示引用风险。
4. 服务战斗运行时
   - 校验敌人技能引用是否存在于当前技能包。
   - 校验技能 AP 成本是否可能被敌人的 `stats.ap` 支付。
   - 校验部位字段能被战斗 UI、伤害系统和 AI 规划器消费。
5. 保留扩展字段
   - 编辑器版本落后时，不应因为表单未覆盖某字段而丢弃数据。
   - 未识别字段进入高级 JSON 区并默认透传。

## 4. 非目标

敌人编辑器第一阶段不做以下事情：

1. 不编辑地图节点、地图连线、地图背景或地图包资源。
2. 不编辑关卡波次、敌人池或 `levels.json` 的运行时规则。
3. 不替代技能编辑器创建或修改技能。
4. 不替代 Buff 编辑器创建或修改 Buff。
5. 不实现完整战斗模拟器。
6. 不把敌人 AI 调试结果直接写回运行时状态。

如需从敌人编辑器跳转到地图编辑器或关卡编辑器，应以“打开引用位置 / 查看被引用关卡”的方式实现，而不是在敌人编辑器中直接接管这些对象域。

## 5. 数据真值与文件边界

### 5.1 当前真值文件

当前敌人模板真值文件为：

```text
assets/data/enemies.json
```

当前结构是 `Record<enemyId, EnemyTemplate>`：

```json
{
  "goblin_story_headhunter": {
    "id": "goblin_story_headhunter",
    "name": "哥布林追猎手",
    "race": "goblin",
    "class": "hunter",
    "stats": {
      "hp": 65,
      "maxHp": 65,
      "speed": 11,
      "ap": 4
    },
    "bodyParts": {
      "head": { "current": 4, "max": 4, "weakness": 1.2 }
    },
    "skills": ["skill_bite", "skill_throw_stone"]
  }
}
```

敌人编辑器第一阶段应继续以该文件为标准输入输出，不在同一轮强行改成 pack 结构。

### 5.2 推荐内部工作区模型

编辑器内部使用 `EnemyWorkspaceDocument` 包装当前文件：

```text
EnemyWorkspaceDocument
- sourcePath
- enemies: Record<enemyId, EnemyTemplate>
- meta
  - defaultBodyParts
  - knownRaces
  - knownClasses
  - skillCatalogSource
  - levelReferenceSource
- diagnostics[]
- dirty
```

其中 `meta` 可以由现有数据、技能包、关卡包和编辑器默认值派生。第一阶段不要求把 `meta` 写回 `enemies.json`。

### 5.3 EnemyTemplate 主字段

编辑器主表单覆盖以下字段：

1. 基础信息
   - `id`
   - `name`
   - `race`
   - `class`
   - `tags`
   - `description`
2. 战斗属性
   - `stats.hp`
   - `stats.maxHp`
   - `stats.speed`
   - `stats.ap`
3. 部位护甲
   - `bodyParts.head`
   - `bodyParts.chest`
   - `bodyParts.abdomen`
   - `bodyParts.arm`
   - `bodyParts.leg`
   - 每个部位包含 `current / max / weakness`
4. 技能组
   - `skills[]`
5. 展示资产
   - `presentation.portraitRef`
   - `presentation.mapPortraitRef`
   - `presentation.battleSpriteRef`
   - `presentation.iconRef`
   - `presentation.fallbackRaceClass`
6. 可选扩展
   - `dropTable`
   - `aiProfile`
   - `notes`

其中 `presentation` 是第一阶段主表单字段，不应只藏在高级 JSON 区；敌人编辑器需要明确管理敌人原画、地图立绘、战斗素材和 fallback 资源引用。`aiProfile / dropTable / notes` 在第一阶段允许通过高级 JSON 区保留，不要求主表单完整结构化。

## 6. 与现有编辑器的工作逻辑对齐

### 6.1 参考技能编辑器

敌人编辑器应继承技能编辑器的以下工作逻辑：

1. 顶栏文件区
   - 打开版本或打开路径。
   - 保存工作稿。
   - 发布到主流程使用文件。
   - 下载备份。
2. 工作区状态
   - 明确显示当前文件路径、未保存状态和校验状态。
3. 强校验
   - 导出或发布前必须显示阻塞错误。
   - 警告可保留，但必须可读。
4. 保留未知字段
   - 表单未覆盖字段不得被清洗掉。

与技能编辑器不同的是：

1. 技能编辑器直接服务技能运行时和技能树。
2. 敌人编辑器优先服务地图编辑器和关卡编辑器，再间接服务战斗运行时。

### 6.2 参考地图编辑器

敌人编辑器应继承地图编辑器的以下工作逻辑：

1. 目录式资源意识
   - 敌人模板不是孤立表单，而是被地图节点和关卡敌人池引用的资源目录。
2. 当前对象摘要
   - 编辑时持续显示可被地图编辑器消费的敌人摘要。
3. 引用安全
   - 删除、改名、复制敌人模板时，必须显示引用来源。
4. 导入导出闭环
   - 编辑器输出必须能被下游页面重新加载，而不是只存在于 DOM 状态。

与地图编辑器不同的是：

1. 地图编辑器维护地图组织真值。
2. 敌人编辑器只维护敌人模板真值。
3. 两者稳定连接键是 `enemyId / templateId`。

## 7. 页面形态基线

敌人编辑器采用“编辑器工作区”形态，而不是游戏内页面形态。它应与地图编辑器、技能编辑器保持同一类工具心智：

1. 顶部是文件、引用源、保存和发布操作。
2. 左侧是可搜索、可筛选的内容库。
3. 中央是当前对象的结构化编辑区。
4. 右侧是引用关系、下游预览和运行时消费提示。
5. 底部是问题列表和定位入口。

推荐第一版页面骨架如下：

```text
┌──────────────────────────────────────────────────────────────┐
│ 顶栏：打开敌人库 / 引用源 / 编辑操作 / 保存与发布 / 状态       │
├──────────────┬─────────────────────────────┬─────────────────┤
│ 左栏敌人库   │ 中央敌人编辑区               │ 右栏引用与预览   │
│ 搜索筛选     │ 概览 / 属性 / 部位 / 技能组   │ 地图服务摘要     │
│ 新建复制删除 │ 地图服务 / 高级 JSON          │ 关卡引用列表     │
│ 校验标记     │ 当前模板表单                  │ 首回合规划提示   │
├──────────────┴─────────────────────────────┴─────────────────┤
│ 底部问题列表：Error / Warning / Info，点击定位字段            │
└──────────────────────────────────────────────────────────────┘
```

这个形态对应三个原则：

1. 像技能编辑器一样，以“打开、编辑、保存工作稿、发布到主流程、下载备份”为主链路。
2. 像地图编辑器一样，坚持“数据真值先于 DOM”，页面只是 `EnemyWorkspaceDocument` 的投影。
3. 敌人编辑器服务地图编辑器，但不嵌入地图编辑器；两者通过 `templateId` 和敌人目录摘要交接。

## 8. 顶栏文件区与发布链

顶栏应分成四组，文案和语义参考技能编辑器、地图编辑器。

### 8.1 打开敌人库

控件：

1. `最近版本`
   - 下拉列出最近保存或发布的敌人 JSON。
2. `打开版本`
   - 载入所选最近版本。
3. `刷新`
   - 重新扫描最近版本列表。
4. `指定路径`
   - 默认值为 `assets/data/enemies.json`。
5. `打开路径`
   - 从项目路径读取敌人库。
6. `从本地导入`
   - 读取本地 JSON 备份，只进入当前工作区，不自动发布。

打开后必须更新：

1. 当前文件路径。
2. 敌人数量。
3. 脏状态。
4. 校验状态。
5. 引用源是否已加载。

### 8.2 引用源

敌人编辑器需要自动或手动加载三个引用源：

1. 技能包
   - 默认 `assets/data/skills_melee_v4_5.json`。
   - 用于 `skills[]` 下拉、技能名摘要、AP 成本校验和目标语义提示。
2. 关卡包
   - 默认 `assets/data/levels.json`。
   - 用于检查 `enemyPools.*.members[].templateId` 引用。
3. 地图包
   - 默认当前地图编辑器使用的 `assets/map_packs/current/story_pack_v1/package.json` 或 authoring 入口。
   - 用于从地图节点反查 `levelId`，再间接展示敌人被哪些地图节点使用。

参考技能编辑器的“同目录自动加载 Buff”，敌人编辑器顶栏可显示：

```text
引用源：技能包已加载 / 关卡包已加载 / 地图包可选
```

若引用源未加载，编辑器仍允许编辑敌人模板，但必须把对应校验降级为 warning，并在发布前提示“引用校验不完整”。

### 8.3 编辑操作

控件：

1. `敌人库`
   - 展开或收起左侧敌人库。
2. `新建敌人`
   - 从默认模板创建新敌人。
3. `复制为新敌人`
   - 基于当前敌人复制，生成新 `id`。
4. `标记废弃`
   - 给模板写入 `tags` 或扩展字段中的废弃标记，第一阶段不要求运行时识别。
5. `删除`
   - 只有无关卡引用、无地图间接引用时才允许直接删除。

`id` 创建后默认只读。改 `id` 不应作为普通表单编辑，而应走“复制为新敌人 + 引用迁移建议”流程。

### 8.4 保存与发布

控件：

1. `保存工作稿`
   - 保存到 authoring 路径或当前工作稿路径。
   - 推荐后续路径：`assets/enemy_packs/authoring/enemies.json`。
   - 第一阶段如果暂未建立 authoring 目录，也必须保持“保存工作稿”和“发布到主流程”的语义分离。
2. `发布到主流程`
   - 写入运行时消费文件：`assets/data/enemies.json`。
   - 发布前必须阻止结构 error 和引用 error。
3. `另存到指定路径`
   - 保存为指定项目路径。
4. `下载备份`
   - 下载完整敌人 JSON，用于人工备份或跨环境传递。

发布成功的最低条件：

1. 导出的 JSON 能重新解析。
2. 敌人数量与工作区一致。
3. 每个 key 与对象内 `id` 一致。
4. 未知字段没有被主表单清洗。
5. `levels.json` 已知引用没有断裂。

## 9. 左侧敌人库

左侧敌人库承担“目录、筛选、批处理入口”三种职责。

### 9.1 列表显示

每个敌人条目显示：

1. `name`
2. `id`
3. `race / class`
4. `HP / AP / Speed`
5. 技能数量。
6. 引用数量。
7. 校验状态标记。

条目排序默认按 `race -> class -> id`，也允许按引用数量或校验严重程度排序。

### 9.2 搜索与筛选

搜索字段覆盖：

1. `id`
2. `name`
3. `race`
4. `class`
5. `tags`
6. `skills[]`

筛选项：

1. 种族。
2. 职业。
3. 被引用 / 未被引用。
4. 有 error / 有 warning / 正常。
5. 含未知扩展字段。
6. 废弃模板。

### 9.3 批量操作

第一阶段只要求批量查看和批量标记，不做批量字段改写。

允许操作：

1. 批量查看同一 `race / class` 下的模板。
2. 批量显示引用状态。
3. 批量标记废弃。
4. 批量导出当前筛选结果的只读摘要。

不允许第一阶段默认提供：

1. 批量删除。
2. 批量改 `id`。
3. 批量改技能组。

## 10. 中央敌人编辑区

中央编辑区以 tab 或分段表单组织，字段写回策略参考技能编辑器。

### 10.1 写回策略

字段分两类：

1. 原子字段
   - 在 `blur / Enter / change` 时写回工作区。
   - 典型字段：`name`, `race`, `class`, `stats.*`, `bodyParts.*.current`, `bodyParts.*.max`, `bodyParts.*.weakness`, `presentation.*Ref`。
2. JSON 字段
   - 允许中间态。
   - 点击“应用 JSON”后写回。
   - 典型字段：`aiProfile`, `dropTable`, 未知扩展字段。

每次写回后都应运行局部校验并刷新右侧摘要。切换敌人前不能丢失已写回字段。

### 10.2 概览

概览页负责快速识别敌人模板：

1. `id`
   - 创建后只读。
   - 改名应走“复制为新模板 + 引用迁移建议”流程。
2. `name`
3. `race`
4. `class`
5. `tags`
6. `description`

概览页还显示只读摘要：

1. 当前 HP / AP / Speed。
2. 技能数量。
3. 被引用关卡数量。
4. 被地图节点间接使用数量。
5. 校验结果摘要。

### 10.3 属性

属性页覆盖：

1. `stats.hp`
2. `stats.maxHp`
3. `stats.speed`
4. `stats.ap`

规则：

1. 数字字段在 `blur / Enter / change` 时写回工作区。
2. `hp` 不得大于 `maxHp`。
3. `maxHp` 必须大于 `0`。
4. `ap` 必须大于等于 `0`。
5. `speed` 可以为 `0`，但低于现有敌人常规范围时给出 warning。

### 10.4 部位

部位页覆盖标准五部位：

1. `head`
2. `chest`
3. `abdomen`
4. `arm`
5. `leg`

每个部位字段：

1. `current`
2. `max`
3. `weakness`

规则：

1. `current` 不得大于 `max`。
2. `max` 可以为 `0`，表示该部位无护甲。
3. `weakness` 建议大于 `0`。
4. 缺失部位应在修复按钮中一键补齐默认结构。

现有样例中如果出现 `left_arm / right_arm / legs` 等旧式或细分部位，编辑器不应静默删除。第一阶段处理方式：

1. 标准五部位进入主表单。
2. 非标准部位在“高级 JSON / 扩展部位”区域展示。
3. 发布前给出 warning，提示是否需要迁移到标准五部位。

### 10.5 技能组

技能组页覆盖 `skills[]`：

1. 添加技能。
2. 删除技能。
3. 调整顺序。
4. 从当前技能包中搜索技能。
5. 显示技能 AP 成本、目标类型和摘要。

规则：

1. `skills[]` 中的每个 skillId 必须存在于当前技能包。
2. 如果技能 AP 成本高于敌人 `stats.ap`，给出 warning。
3. 如果敌人没有可执行技能，给出 error，除非该敌人被显式标记为展示占位模板。
4. 调整顺序只影响 AI 候选展示顺序，不承诺替代 `EnemyActionPlanner` 的评分结果。

### 10.6 原画资产

原画资产页负责维护敌人在作者工具、地图编辑器和战斗展示中使用的资源引用。

字段建议：

1. `presentation.portraitRef`
   - 敌人主立绘短引用。
   - 用于敌人编辑器主预览和后续图鉴类入口。
2. `presentation.mapPortraitRef`
   - 地图编辑器“本关敌人”面板使用的立绘引用。
   - 可以与 `portraitRef` 相同，也可以是裁切后的地图专用头像。
3. `presentation.battleSpriteRef`
   - 战斗内使用的 Spine、序列帧或静态战斗图引用。
4. `presentation.iconRef`
   - 列表、chip、低配模式或缺图状态使用的小图标引用。
5. `presentation.fallbackRaceClass`
   - 资源缺失时按 `race / class` 回退到默认图。

规则：

1. 敌人模板只保存资源引用，不嵌入图片二进制。
2. 资源路径应由资源库或 manifest 解析，敌人模板内优先保存短引用。
3. 缺失 `portraitRef` 不阻止保存工作稿，但发布到主流程前至少给出 warning。
4. 地图服务预览必须显示 `mapPortraitRef` 的效果；如果缺失，则显示 fallback 图并标出原因。
5. 战斗展示所需的 `battleSpriteRef` 可以第一阶段只校验存在性，不要求接入完整动画预览。

### 10.7 地图服务

地图服务页不是新数据源，而是“地图编辑器会看到什么”的作者预览。

摘要至少包含：

1. `name / id`
2. `race / class`
3. `HP / AP / Speed`
4. `presentation.mapPortraitRef` 对应的敌人立绘或 fallback 图
5. 技能 chips
6. 五部位护甲与弱点
7. 引用状态
8. 断引用、缺图或技能缺失提示

地图编辑器的“本关敌人”面板应只消费这些可派生字段，不要求地图包重复保存敌人战斗字段。

### 10.8 高级 JSON

高级 JSON 区用于：

1. 查看完整 `EnemyTemplate`。
2. 编辑主表单暂未覆盖的扩展字段。
3. 检查未知字段是否会被保留。

高级 JSON 写回前必须重新运行结构校验。写回失败时不能污染当前工作区对象。

## 11. 右侧引用与预览

右侧面板负责回答三个问题：

1. 当前敌人在哪里被使用。
2. 地图编辑器会如何展示它。
3. 运行时是否大概率能消费它。

### 11.1 引用列表

引用列表分两层：

1. 关卡引用
   - 来源：`levels.json.enemyPools.*.members[].templateId`。
   - 展示：`levelId / enemyPoolId / position / wave`。
2. 地图间接引用
   - 来源：地图节点 `levelId` -> 关卡 `enemyPoolId` -> 敌人 `templateId`。
   - 展示：`mapId / nodeId / nodeLabel / levelId`。

引用列表只读。点击引用项可以后续支持打开地图编辑器或关卡编辑器并定位，但第一阶段不跨工具直接改写对方数据。

### 11.2 地图编辑器面板预览

预览应贴近当前地图编辑器的“本关敌人”面板，而不是做一个独立幻想卡片。

固定信息：

1. 当前敌人名称。
2. `templateId`。
3. `race / class`。
4. `HP / AP / Speed`。
5. 技能列表。
6. 部位护甲摘要。
7. 校验提示。

这块预览的目的是让作者在敌人编辑器里确认：发布后，地图编辑器不用理解敌人内部结构，也能显示足够的选择信息。

### 11.3 运行时消费提示

第一阶段只做静态近似提示：

1. 可支付技能数量。
2. AP 不足技能数量。
3. 缺失技能引用数量。
4. 缺失或异常部位数量。
5. `EnemyActionPlanner` 可能无法选出动作的原因。

这不是战斗模拟器，不写回运行时状态。

## 12. 底部问题列表

问题列表按严重程度排序：

1. Error
   - 阻止发布。
2. Warning
   - 允许保存工作稿，发布时需要明确提示。
3. Info
   - 不阻止保存和发布。

每条问题包含：

1. 严重程度。
2. 问题码。
3. 可读说明。
4. 关联敌人 id。
5. 关联字段路径。
6. 修复建议。

点击问题时：

1. 左侧选中对应敌人。
2. 中央切换到对应 tab。
3. 字段获得焦点或高亮。

## 13. 敌人目录对地图编辑器的交接契约

敌人编辑器发布后，地图编辑器不直接读取编辑器页面状态，而是重新读取敌人真值文件并派生目录。

推荐交接视图为：

```text
EnemyCatalogEntry
- id
- name
- race
- class
- tags
- statsSummary
  - hp
  - maxHp
  - ap
  - speed
- skillSummary[]
  - id
  - name
  - apCost
  - targetSummary
- bodyPartSummary[]
  - part
  - current
  - max
  - weakness
- presentationSummary
  - portraitRef
  - mapPortraitRef
  - battleSpriteRef
  - iconRef
  - resolvedMapPortraitSrc
  - missingAssets[]
- diagnosticsSummary
  - hasError
  - warningCount
- referenceSummary
  - levelCount
  - mapNodeCount
```

这不是必须落盘的新文件，而是 `assets/data/enemies.json`、技能包、关卡包和地图包的派生结果。

地图编辑器只需要：

1. 用 `id / name / race / class` 填充敌人模板选择器。
2. 用 `presentationSummary / statsSummary / skillSummary / bodyPartSummary` 显示“本关敌人”摘要。
3. 在切换敌人时写回 `levels.json.enemyPools.*.members[].templateId`。

地图编辑器不需要，也不应该写入：

1. `stats`
2. `bodyParts`
3. `skills`
4. `race`
5. `class`
6. `aiProfile`
7. `presentation.*Ref`

## 14. 核心工作流

### 14.1 新建敌人并交给地图编辑器使用

1. 打开 `assets/data/enemies.json`。
2. 自动加载技能包和关卡包。
3. 点击 `新建敌人`。
4. 填写 `id / name / race / class`。
5. 选择 `presentation.portraitRef / mapPortraitRef / battleSpriteRef`。
6. 配置 `stats`、标准五部位和 `skills[]`。
7. 查看右侧地图服务预览，确认敌人立绘、数值摘要和技能 chips 都可被地图编辑器消费。
8. 修复底部 error。
9. 保存工作稿。
10. 发布到 `assets/data/enemies.json`。
11. 打开或刷新地图编辑器。
12. 在“本关敌人”面板选择新 `templateId`。
13. 保存并发布关卡或地图相关工作稿。

### 14.2 修改已被引用的敌人

1. 选中敌人。
2. 右侧显示所有关卡和地图节点引用。
3. 修改字段。
4. 如果修改影响地图摘要，右侧预览同步刷新。
5. 如果修改导致技能不可支付或字段异常，底部问题列表展示。
6. 发布前再次确认已知引用不会断裂。

已被引用的敌人允许修改属性、部位和技能组，但不允许直接改 `id`。

### 14.3 删除或重命名敌人

1. 删除前必须运行引用检查。
2. 若存在关卡或地图间接引用，默认阻止删除。
3. 若用户需要换 id，使用 `复制为新敌人`。
4. 编辑器生成引用迁移建议列表。
5. 第一阶段不自动批量改写 `levels.json`，避免敌人编辑器越权接管关卡编辑器职责。

## 15. 校验体系

敌人编辑器至少提供四类校验。

### 15.1 结构校验

1. 顶层必须是对象。
2. 每个对象必须有 `id / name / stats / bodyParts / skills`。
3. key 必须等于对象内 `id`。
4. `stats` 必须包含 `hp / maxHp / speed / ap`。
5. `bodyParts` 必须包含标准五部位；旧式或额外部位必须保留并提示迁移。
6. `presentation` 如果存在，必须是对象；资源引用字段必须是字符串短引用或可解析路径。

### 15.2 数值校验

1. `hp <= maxHp`。
2. `maxHp > 0`。
3. `ap >= 0`。
4. `bodyParts.*.current <= bodyParts.*.max`。
5. `bodyParts.*.weakness > 0`。

### 15.3 资产校验

1. `presentation.portraitRef` 或 `presentation.mapPortraitRef` 缺失时给出 warning。
2. 已填写的 `presentation.*Ref` 必须能在资源库或 manifest 中解析。
3. 地图服务预览必须能得到一个可显示的敌人图：优先 `mapPortraitRef`，其次 `portraitRef`，最后 `fallbackRaceClass`。
4. `battleSpriteRef` 第一阶段只校验引用存在，不要求播放动画。

### 15.4 引用校验

1. `skills[]` 引用必须存在于当前技能包。
2. `levels.json.enemyPools.*.members[].templateId` 引用必须能在敌人模板目录中找到。
3. 删除敌人模板前必须检查是否仍被关卡或地图节点间接引用。
4. 重命名敌人模板时必须生成引用迁移建议，不自动静默改写下游文件。

### 15.5 下游消费校验

1. 地图编辑器能生成该敌人的“本关敌人”摘要。
2. `DataManagerV2` 能通过 enemyPool 展开出该模板。
3. `EnemyActionPlanner` 能从该敌人技能组中选出可用技能；如果不能，至少给出明确原因。

第一阶段可以把第 3 点做成静态近似校验：存在技能、技能 AP 可支付、目标字段可识别。

## 16. 与运行时的边界

运行时消费链固定为：

```text
assets/data/enemies.json
  -> DataManagerV2
  -> levels.json enemyPools 展开
  -> CoreEngine battle enemies
  -> EnemyActionPlanner
```

敌人编辑器不得绕过该链路直接创建战斗对象。

敌人编辑器可以提供只读预览：

1. 可支付技能列表。
2. 首回合候选动作说明。
3. 可能的部位攻击目标。

但这些预览只能作为作者参考，不能替代 `CoreEngine` 和 `EnemyActionPlanner` 的真实回归测试。

## 17. 分阶段实现建议

### 17.1 第一阶段：模板库与地图服务闭环

目标：

1. 打开、编辑、保存、发布 `assets/data/enemies.json`。
2. 完成敌人列表、基础字段、属性、部位、技能组编辑。
3. 完成原画资产引用编辑，至少能展示地图面板立绘。
4. 完成结构、数值、资产、技能引用和关卡引用校验。
5. 输出地图编辑器可消费的敌人摘要。

MVP 必须达成：

1. 新增敌人后，发布文件被地图编辑器重新加载，敌人下拉能看到该模板。
2. 地图编辑器切换模板后，`levels.json.enemyPools` 保存的是正确 `templateId`。
3. 运行时能通过 `DataManagerV2` 展开并进入战斗。
4. 修改已被引用敌人的原画、属性、部位或技能组时，右侧引用列表和地图服务预览同步刷新。
5. 删除或改名被引用敌人时，编辑器默认阻止，并输出引用清单。
6. 编辑器未覆盖的未知字段在保存、发布、重新加载后仍然存在。

### 17.2 第二阶段：引用管理与工作稿发布

目标：

1. 支持 authoring 快照，例如 `assets/enemy_packs/authoring/enemies.json`。
2. 支持引用迁移建议。
3. 支持从地图编辑器和关卡编辑器互跳定位。
4. 支持批量标记 `race / class / tags`。

### 17.3 第三阶段：AI 与平衡辅助

目标：

1. 展示 `EnemyActionPlanner` 静态评分解释。
2. 展示敌人战斗定位：骚扰、治疗、防守、重击、追击。
3. 输出敌人池组合风险提示，例如全员无法攻击、全员 AP 不足、重复定位过高。

## 18. 测试与验收方法

第一阶段至少需要以下测试：

1. `EnemyWorkspace` 单元测试
   - 加载、规范化、编辑、导出、保留未知字段。
2. `enemy_editor_page` 页面测试
   - 列表、表单、保存、校验、问题定位。
3. `enemy_editor_io` 测试
   - 打开 `assets/data/enemies.json`、保存工作稿、发布、重新加载。
4. 地图编辑器联动测试
   - 新敌人模板进入地图编辑器下拉。
   - 切换当前节点首个敌人模板后写回 `levels.json.enemyPools`。
5. 运行时 smoke
   - `DataManagerV2` 能展开引用新模板的关卡。
   - `EnemyActionPlanner` 能为新模板规划首个可用动作。

人工验收入口应优先给出：

1. 敌人编辑器页面。
2. 地图编辑器页面。
3. 一条从新增敌人到地图节点选择，再到主流程进入战斗的短路径。

## 19. 当前设计结论

1. 当前目录此前没有 enemy 编辑器章节。
2. 敌人编辑器应归属 `S6_敌人系统与编辑器`，因为敌人和技能、Buff 一样，是独立的内容系统与编辑器域。
3. 敌人编辑器的第一服务对象是地图编辑器和关卡编辑器。
4. 地图编辑器只消费敌人模板摘要和 `templateId`，不编辑敌人模板本体。
5. 第一阶段不改动现有敌人文件结构，继续以 `assets/data/enemies.json` 为标准输入输出。
6. 后续如需 authoring 快照和发布链，可以在不破坏当前文件结构的前提下增量加入。
