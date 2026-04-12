# 关卡地图选择与地图包设计说明

创建时间：2026-04-12

最后整理时间：2026-04-12

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

1. [19-关卡选择内容元数据(level_select_content)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/19-关卡选择内容元数据(level_select_content)-设计说明.md)
   - 负责当前主流程关卡选择页的玩家可见信息
2. [24-关卡管理与关卡编辑器(level_management_editor)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md)
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
3. `maps[]`
   - 一张章节地图
4. `maps[].nodes[]`
   - 地图节点，必须绑定 `levelId`
5. `maps[].edges[]`
   - 节点关系
6. `maps[].previewModes[]`
   - 仅用于方案验证或编辑器预览，不是主流程强依赖字段

节点字段最小要求：

1. `id`
2. `levelId`
3. `label`
4. `title`
5. `kind`
6. `x / y`
7. `objectiveText`
8. `difficultyLabel`
9. `rewardPreview`

边字段最小要求：

1. `id`
2. `fromNodeId`
3. `toNodeId`
4. `branchLabel`
5. `type`

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

它们验证的是：

1. 地图式组织是否足够直观
2. 地图包是否能独立存在
3. 主程序交接面是否已经被限制在最小 payload

## 8. 当前结论

当前推荐推进顺序为：

1. 先完成地图组织方案与效果图验证
2. 再把 `level_map_pack` 正式纳入地图编辑器维护范围
3. 再由地图编辑器消费 `WBS-3.2.2` 维护的 `levelId` 与章节元数据
4. 最后再评估是否把主流程 story 选关从线性列表切换到地图模式

因此，`#100 / WBS-3.2.3.1` 的本质不是“新做一个好看的页面”，而是：

- `先把地图组织方案的数据契约和主程序交接边界收口，再决定是否进入正式运行时接入。`

而 `#101 / WBS-3.2.3` 的正式本质是：

- `消费 3.2.1 与 3.2.2 的稳定输出，交付标准地图编辑器，并输出关卡/地图联合成果。`
