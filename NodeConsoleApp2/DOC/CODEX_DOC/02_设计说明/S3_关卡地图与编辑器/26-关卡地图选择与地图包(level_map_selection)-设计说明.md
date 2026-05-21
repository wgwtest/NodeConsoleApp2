# 关卡地图选择与地图包设计说明

创建时间：2026-04-12

最后整理时间：2026-04-13

状态：`当前有效`

关联节点：

1. `WBS-3.2 关卡与地图编辑`
2. `#100 / WBS-3.2.3.1 地图组织方案与效果图验证`
3. `WBS-3.2.2 关卡编辑器基础能力与 JSON 导出链`
4. `#101 / WBS-3.2.3 地图编辑器基础能力与地图包导出链`

## 1. 文档定位

本文件解决的不是“当前主流程怎么选关”，而是“如果未来关卡从线性列表升级为地图式组织，应该怎样保持低耦合”。

它专门定义三件事：

1. `地图选择层` 的职责边界
2. `地图包(level_map_pack)` 的数据契约
3. 地图页、关卡编辑器与主程序之间的最小交接面

它不替代：

1. [19-关卡选择内容元数据(level_select_content)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S1_主游戏流程/19-关卡选择内容元数据(level_select_content)-设计说明.md)
   - 负责当前主流程关卡选择页的玩家可见信息
2. [24-关卡管理与关卡编辑器(level_management_editor)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/S3_关卡地图与编辑器/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md)
   - 负责 `WBS-3.2` 上位对象、关卡编辑器和对象域边界

## 2. 设计目标

地图式关卡组织必须同时满足以下目标：

1. 允许 story 关卡从线性列表扩展为分支、汇合或网状组织。
2. 不要求战斗运行时理解地图 UI。
3. 不要求本地存档直接保存整张地图页面状态。
4. 不要求关卡编辑器与主流程强绑定。
5. 允许先用独立效果图页验证可理解性，再决定是否接入正式主流程。

对应的正式结论是：

- `地图选择层是纯展示与选择层，不是战斗规则层。`

## 2.1 在 WBS-3.2 输入输出链中的位置

本文件同时承担 `WBS-3.2.1` 输出物的一部分，并为 `WBS-3.2.3` 提供固定输入。

当前固定链路为：

1. `WBS-3.2.1`
   - 输出：
     - `assets/data/contracts/level_map_definition.contract.json`
     - 本文件中的地图包字段说明
2. `WBS-3.2.2`
   - 输出：
     - `assets/data/contracts/level_editor_export.contract.json`
     - `assets/data/levels.json`
3. `WBS-3.2.3`
   - 输入：
     - `assets/data/contracts/level_map_definition.contract.json`
     - `assets/data/contracts/level_editor_export.contract.json`
     - `assets/data/levels.json`
   - 输出：
     - `assets/data/contracts/level_delivery_bundle.contract.json`
     - `assets/data/level_map_pack_v1.example.json`
     - `test/level_map_editor_v1.html`

因此地图编辑器不是“单独随便画一张图”，而是必须消费前序关卡编辑链已经稳定下来的 `levelId` 与导出契约。

## 3. 三层解耦模型

### 3.1 运行时关卡层

运行时继续消费既有 `levels.json` 一类的战斗配置，负责：

1. `levelId`
2. 敌人、奖励、胜负条件
3. 战斗实例化所需数据

它不负责：

1. 地图节点排布
2. 地图连线样式
3. 章节背景素材引用

### 3.2 地图组织层

地图组织层由独立的 `level_map_pack` 承担，负责：

1. 地图定义
2. 节点坐标与视觉标签
3. 节点和 `levelId` 的绑定
4. 分支、汇合、章节背景与节点素材引用
5. 预览模式或样本状态

它不直接负责：

1. 伤害计算
2. Buff 结算
3. 敌人行为
4. 战斗内 HUD

### 3.3 作者工具层

正式关卡编辑器未来至少应拆成两个对象域：

1. `level workspace`
   - 维护运行时关卡配置
2. `level map workspace`
   - 维护地图节点、边、背景和素材引用

两者可以共存于一个编辑器工程，但数据上必须允许独立导入、导出和验证。

在当前 WBS 口径下，这两个对象域应分别落在：

1. `WBS-3.2.2`
   - 运行时关卡配置编辑
2. `#101 / WBS-3.2.3`
   - 地图包编辑与导出

这里的稳定交接要求固定为：

1. 地图编辑器只能消费 `WBS-3.2.2` 已导出的 `levels.json`
2. 地图节点与 `levelId` 的绑定必须满足 `level_editor_export` 契约
3. 地图编辑器最终输出的是 `level_delivery_bundle` 约束下的地图包，而不是任意页面快照

### 3.4 关卡与地图的真值边界

地图编辑器与关卡编辑器之间，当前固定采用以下边界：

1. `关卡编辑器` 负责 `运行时关卡真值`
   - 战斗规则
   - 敌人与波次
   - 奖励
   - 解锁规则
   - 线性 fallback 选择展示元数据
   - 战斗背景
2. `地图编辑器` 负责 `地图组织真值`
   - 地图背景
   - 节点逻辑坐标
   - 节点图标 / 立绘 / 皮肤引用
   - 边关系
   - 入口节点
   - 地图显示配置
3. 两侧的稳定连接键只有：
   - `levelId`
4. 关卡运行时层不再承载地图图结构
   - 无地图模式下的线性推进由关卡顺序与解锁规则推导
   - 正式地图连线只能由 `edges[]` 表达
5. 地图包中与关卡内容看起来相似的字段：
   - `label`
   - `title`
   - `objectiveText`
   - `difficultyLabel`
   - `rewardPreview`
   当前统一视为 `展示覆写`
6. 如果地图包未提供这些展示覆写：
   - 应优先回落到 `levelId` 对应的关卡元数据
   - 而不是要求地图包重复维护一整份运行时内容

### 3.5 数据真值优先于 DOM

地图编辑器必须坚持：

- `先有地图数据，再有显示层。`

这句话在本系统中的准确含义是：

1. 地图背景的语义不是“给某个 div 铺一张图”，而是：
   - `backgroundRef` 对应一张逻辑地图的背景资源
   - 该背景资源负责承载整张地图空间
2. 节点位置的语义不是“相对当前 div 左上角的像素值”，而是：
   - `节点在逻辑地图空间中的位置`
   - 显示层再把这个逻辑位置投影到当前画布
3. 边的语义不是“保存两个像素端点”，而是：
   - `fromNodeId -> toNodeId` 的关系
   - 连线起终点、标签位置和样式都应由渲染层根据节点位置反推
4. 抽屉开关、舞台宽度变化、浏览器缩放变化，只能影响：
   - `显示映射结果`
   - 不能反向改变地图真值

因此如果关闭左抽屉、右抽屉后节点位置发生漂移，这不应被解释为“缩放正常”，而应被认定为：

- `编辑器错误地把显示容器几何当成了地图真值。`

## 4. 地图包契约

`level_map_pack_v1` 的最小职责是描述“地图如何组织”，而不是“战斗如何执行”。

该契约的固定文件落点为：

1. `assets/data/contracts/level_map_definition.contract.json`
2. `assets/data/level_map_pack_v1.example.json`

建议结构：

1. `meta`
   - 包 id
   - 标题
   - ownerNode
   - 说明备注
2. `assetLibrary`
   - 背景资源引用
   - 节点皮肤引用
   - 节点素材图引用
   - 立绘图引用
3. `maps[]`
   - 一张章节地图
4. `maps[].nodes[]`
   - 地图节点，必须绑定 `levelId`
5. `maps[].edges[]`
   - 节点关系
6. `maps[].previewModes[]`
   - 仅用于方案验证或编辑器预览，不是主流程强依赖字段

### 4.1 `JSON + image assets` 固定口径

地图包的正式口径不是“节点上直接塞大段视觉数据”，而是：

- `一个 JSON 文件描述地图结构`
- `一组外部图片资源负责背景和节点表现`
- `两者通过短引用连接`

固定规则如下：

1. `maps[].backgroundRef`
   - 只保存背景资源 id
   - 真正图片路径由 `assetLibrary.backgrounds[].src` 提供
2. `maps[].nodes[].artRefs.nodeArt`
   - 只保存节点素材图 id
   - 真正图片路径由 `assetLibrary.nodeArts[].src` 提供
3. `maps[].nodes[].artRefs.portrait`
   - 只保存节点立绘图 id
   - 真正图片路径由 `assetLibrary.portraits[].src` 提供
4. `maps[].nodes[].nodeSkinRef`
   - 继续只承担节点容器样式或皮肤语义，不替代图片资源

因此 `level_map_pack` 的推荐资源结构为：

1. `assetLibrary.backgrounds[]`
   - `id`
   - `label`
   - `src`
   - 可选：`thumbnailSrc / previewGradient`
2. `assetLibrary.nodeArts[]`
   - `id`
   - `label`
   - `src`
3. `assetLibrary.portraits[]`
   - `id`
   - `label`
   - `src`
4. `assetLibrary.nodeSkins[]`
   - `id`
   - `label`
   - `shape`

### 4.2 素材格式与复杂背景策略

当前样例资源使用 `svg` 文件，只是因为：

1. 便于版本管理
2. 便于快速演示图片引用链已真正打通
3. 不会把契约和某种绘制实现绑死

正式契约并不绑定 `svg`。只要浏览器可直接显示，后续都可以替换为：

1. `png`
2. `webp`
3. 其他静态图片产物

这意味着当前方案不是“只能画简单 SVG”，而是“先把地图包与图片资源的连接方式固定下来”。

对更复杂背景，当前建议策略是：

1. 第一阶段
   - 用单张背景图完成章节舞台承载
2. 第二阶段
   - 在 `assetLibrary.backgrounds[]` 扩展前景层、遮罩层或多层图
3. 第三阶段
   - 如后续接入更复杂渲染器，也只在展示层替换消费方式，不改 `backgroundRef / artRefs.*` 这层稳定短引用

因此“复杂地图背景能否支持”的关键，不在于现在样例图用什么画，而在于：

- `资源引用口径已经稳定`
- `编辑页 / 预览页 / IO 页已经共同消费这套口径`
- `主流程仍只拿最小 handoff payload`

### 4.3 逻辑地图空间与显示映射层

正式地图包需要明确区分两类数据：

1. `地图真值`
   - 地图逻辑空间
   - 节点逻辑位置
   - 边关系
   - 背景图与节点资源引用
2. `显示配置`
   - 当前地图如何投影到某个 16:9 画布
   - 节点显示比例
   - 连线锚点策略
   - 标签显示策略

推荐在 `maps[]` 下固定两组字段：

1. `space`
   - `logicalWidth`
   - `logicalHeight`
   - 含义：这张地图自己的逻辑坐标空间
2. `display`
   - `viewportAspect`
   - `backgroundFit`
   - `nodeScale`
   - `nodeAnchor`
   - `edgeAnchor`
   - `edgeLabelMode`

推荐语义如下：

1. `space.logicalWidth / logicalHeight`
   - 决定地图内部的统一坐标系
   - 例如可固定为 `1600 x 900` 的逻辑空间
   - 后续无论舞台实际显示成 `1280x720`、`960x540` 还是抽屉收起后的窄视口，都只做投影，不改逻辑值
2. `display.viewportAspect`
   - 当前地图期望的主舞台比例，默认推荐 `16:9`
3. `display.backgroundFit`
   - 背景图如何铺满逻辑地图，默认推荐 `cover`
4. `display.nodeScale`
   - 节点显示层的统一缩放系数
   - 属于显示配置，不属于节点真值
5. `display.nodeAnchor / edgeAnchor`
   - 规定节点图片和连线锚点默认以什么位置作为几何中心
   - 当前推荐默认值为 `center`
6. `display.edgeLabelMode`
   - 例如 `midpoint`
   - 表示边标签由渲染层自动计算，而不是手工写死像素位置

### 4.4 节点与连线的数据语义

地图节点和边的字段设计，应优先表达“关系”和“位置真值”，而不是表达“页面怎么画”。

节点字段最小要求：

1. `id`
2. `levelId`
3. `label`
4. `kind`
5. `position.x`
6. `position.y`
7. `artRefs.nodeArt`
8. `artRefs.portrait`

推荐但不再视为地图真值必填的展示覆写字段：

1. `title`
2. `objectiveText`
3. `difficultyLabel`
4. `rewardPreview`
5. `iconLabel`

其中：

1. `position.x / position.y`
   - 语义为逻辑地图坐标
   - 不是 DOM 坐标
2. 为兼容当前早期样例，若暂时保留 `x / y` 字段，也必须把其语义解释为：
   - `逻辑地图坐标`
   - 而不是“当前画布像素”
3. `label / title / objectiveText / difficultyLabel / rewardPreview`
   - 只承担地图页展示层责任
   - 不能反向改写关卡运行时数据

边字段最小要求：

1. `id`
2. `fromNodeId`
3. `toNodeId`
4. `branchLabel`
5. `type`

边字段不应直接导出：

1. 起点像素坐标
2. 终点像素坐标
3. 手工摆放后的标签像素坐标

这些内容都属于渲染层根据以下输入反推出来的派生结果：

1. `nodes[].position`
2. `display.nodeAnchor`
3. `display.edgeAnchor`
4. `display.edgeLabelMode`

### 4.5 地图编辑器的数据驱动工作流

合理的地图编辑器不应直接改 DOM，而应遵守下面的顺序：

1. 用户在抽屉或检查器修改字段
2. 字段先写入地图工作区数据对象
3. 工作区完成规范化和校验
4. 渲染层根据：
   - `map document`
   - `assetLibrary`
   - `display`
   - `当前舞台视口尺寸`
   重新计算显示结果
5. 导出时只导出数据对象，不导出页面状态

因此以下状态应属于：

1. `可导出数据`
   - `backgroundRef`
   - `nodes[].position`
   - `edges[].fromNodeId / toNodeId`
   - `display.nodeScale`
   - `display.backgroundFit`
2. `不可导出编辑器临时状态`
   - 左抽屉是否展开
   - 右抽屉是否展开
   - 当前滚动位置
   - 当前 hover 节点
   - 当前浏览器窗口尺寸
   - 当前 DOM 实际像素宽高

## 5. 主程序交接面

地图页最终交给主程序的结果必须收敛为最小 handoff payload。

最低建议为：

1. `selectedLevelId`
2. `sourceMapId`
3. `sourceNodeId`
4. `previewModeId`

其中真正进入战斗主流程的核心字段只有：

1. `selectedLevelId`

其他字段只用于：

1. 调试
2. 埋点
3. UI 回流
4. 编辑器预览上下文

这条规则的目的，是避免主流程反向依赖地图层内部实现。

同时它也是 `assets/data/contracts/level_delivery_bundle.contract.json` 中必须保留的最小 handoff payload。

同样也意味着：

1. 主流程进入战斗只需要 `selectedLevelId`
2. 主流程不需要知道节点在地图上的像素位置
3. 主流程不需要知道地图边标签是什么
4. 地图页想展示更丰富的 `title / objectiveText / difficultyLabel / rewardPreview` 时，默认应先尝试从 `levelId` 关联的关卡元数据回填

## 6. 低耦合规则

地图选择相关工作必须严格遵守以下规则：

1. 没有地图页，主流程仍可继续使用当前线性选关。
2. 地图页崩溃，不得破坏 `levelId -> 战斗` 的既有装载链。
3. 地图包字段扩展，不得直接要求修改战斗内核。
4. 地图素材缺失时，允许降级为默认背景或默认节点皮肤。
5. 正式接入前，必须先有独立方案页或独立编辑器页做验证。

## 7. 验证入口

当前 `#100 / WBS-3.2.3.1` 的正式验证资产为：

1. `assets/data/level_map_pack_v1.example.json`
2. `script/editor/level/LevelMapPreviewPage.js`
3. `test/level_map_selection_mock.html`
4. `test/wbs_3_2_3_1_level_map_mock.test.mjs`
5. `test/codex_regression_runner.html?scope=WBS-3.2.3.1`

现行使用口径：

1. 这些资产已经完成 `WBS-3.2.3.1` 的历史验证职责。
2. `test/level_map_selection_mock.html` 继续保留，但当前定位是“历史验证资产”，不是 `WBS-3.2.3.2` 地图编辑工作区的主入口。
3. 当前所见即所得作者工作流以 `test/level_map_editor_v1.html` 为准；预览页只负责回溯 `level_map_pack` 的早期组织验证结论。

它们验证的是：

1. 地图式组织是否足够直观
2. 地图包是否能独立存在
3. 主程序交接面是否已经被限制在最小 payload

## 7.1 地图包 IO 校核入口

当 `WBS-3.2.3.3` 开始承接地图包导入导出与校验后，固定增加以下资产：

1. `assets/data/level_map_pack_v1.invalid.example.json`
   - 非法样例，用于稳定复现缺失引用问题码
2. `script/editor/level/LevelMapPackIO.js`
   - 纯工具层，负责导入分析、规范化导出与 round-trip 校核
3. `test/level_map_editor_io_test.html`
   - 独立 IO 校核页，只解释地图包 JSON，不承担地图编辑职责

它们验证的是：

1. 合法样例可以被稳定归一化且问题码为零
2. 非法样例可以稳定打出关键问题码，而不是依赖人工目测
3. round-trip 后地图 / 节点 / 边摘要不发生结构漂移

因此 `WBS-3.2.3.3` 不是“再做一个编辑页”，而是：

- `把地图包从作者工作台页面状态，收口成可导入、可导出、可复核的数据契约。`

## 8. 当前结论

当前推荐推进顺序为：

1. 先完成地图组织方案与效果图验证
2. 再把 `level_map_pack` 正式纳入地图编辑器维护范围
3. 再由地图编辑器消费 `WBS-3.2.2` 维护的 `levelId` 与章节元数据
4. 最后再评估是否把主流程 story 选关从线性列表切换到地图模式

截至当前版本，上述顺序已经完成到第 `3` 步：

1. `WBS-3.2.3.1` 已验收，转为历史验证资产
2. `WBS-3.2.3.2` 已验收，成为当前地图编辑工作区主入口
3. `WBS-3.2.3.3` 已验收，形成正式地图包 IO 与 round-trip 校核链

因此，`#100 / WBS-3.2.3.1` 的本质不是“新做一个好看的页面”，而是：

- `先把地图组织方案的数据契约和主程序交接边界收口，再决定是否进入正式运行时接入。`

而 `#101 / WBS-3.2.3` 的正式本质是：

- `消费 3.2.1 与 3.2.2 的稳定输出，交付标准地图编辑器，并输出关卡/地图联合成果。`
