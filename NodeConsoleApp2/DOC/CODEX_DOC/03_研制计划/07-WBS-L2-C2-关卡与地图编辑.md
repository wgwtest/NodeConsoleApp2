# WBS-3.2 计划：关卡与地图编辑

创建时间：2026-04-07

最后整理时间：2026-04-13

状态：`当前有效；对应 #30 / WBS-3.2；当前按“元数据 -> 关卡编辑器 -> 地图编辑器”三段主树维护`

编号口径：

1. 当前正式编号：`WBS-3.2`
2. 历史简称：`C2`
3. 历史证据文件若仍使用 `C2 / C2.1 / C2.2` 命名，统一按 [16-WBS-编号迁移映射表](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/16-WBS-编号迁移映射表.md) 回看

## 1. 节点定位

本节点对应：

1. `#30 WBS-3.2 关卡与地图编辑`

上级节点：

1. `#28 WBS-3 成长与内容闭环`

上游承接：

1. `#52 WBS-1.4.3 关卡编辑契约与编辑链启动`
2. `#53 WBS-1.4.4 统一内容契约入口与装载基线`
3. `#60 WBS-1.4.3.1 关卡 schema 与敌人池配置映射收口`
4. `#61 WBS-1.4.3.2 关卡装载与实例化边界收口`
5. `#62 WBS-1.4.3.3 关卡编辑链局部验证入口`

## 2. 当前树形结构

当前 `WBS-3.2` 按严格树形编号组织为：

1. `#69 WBS-3.2.1 关卡地图元数据设计`
2. `#79 WBS-3.2.2 关卡编辑器基础能力与 JSON 导出链`
3. `#101 WBS-3.2.3 地图编辑器基础能力与地图包导出链`

其中派生叶子为：

1. `#77 WBS-3.2.1.1 关卡元数据与奖励反馈设计`
2. `#78 WBS-3.2.1.2 地图元数据与连接结构设计`
3. `#104 WBS-3.2.2.1 关卡工作区数据核心与字段级校验`
4. `#105 WBS-3.2.2.2 关卡编辑工作区与关卡内要素编辑`
5. `#106 WBS-3.2.2.3 关卡 JSON 导入导出与运行时验证闭环`
6. `#100 WBS-3.2.3.1 地图组织方案与效果图验证`
7. `#102 WBS-3.2.3.2 地图编辑工作区与节点边背景编辑`
8. `#103 WBS-3.2.3.3 地图包导入导出与校验`

按树形关系展开为：

1. `#30 WBS-3.2 关卡与地图编辑`
2. `#69 WBS-3.2.1 关卡地图元数据设计`
3. `#77 WBS-3.2.1.1 关卡元数据与奖励反馈设计`
4. `#78 WBS-3.2.1.2 地图元数据与连接结构设计`
5. `#79 WBS-3.2.2 关卡编辑器基础能力与 JSON 导出链`
6. `#104 WBS-3.2.2.1 关卡工作区数据核心与字段级校验`
7. `#105 WBS-3.2.2.2 关卡编辑工作区与关卡内要素编辑`
8. `#106 WBS-3.2.2.3 关卡 JSON 导入导出与运行时验证闭环`
9. `#101 WBS-3.2.3 地图编辑器基础能力与地图包导出链`
10. `#100 WBS-3.2.3.1 地图组织方案与效果图验证`
11. `#102 WBS-3.2.3.2 地图编辑工作区与节点边背景编辑`
12. `#103 WBS-3.2.3.3 地图包导入导出与校验`

## 3. 为什么必须这样拆

这轮整编的核心要求有两条：

1. `编号层级必须与父子树严格一致`
2. `进入正式实现的主树，都要像 3.2.3 一样具备可复用的父节点骨架`

因此：

1. `3.2.1` 是元数据设计父节点
2. `3.2.2` 是关卡编辑器父节点，不能再停留在单页执行清单
3. `3.2.3` 是地图编辑器父节点，继续保持 `方案验证 -> 工作区 -> IO 校验` 的三叶结构

如果不这样拆，就会再次出现：

1. 同样是作者工具，有的节点有父子树，有的节点只有一页执行 checklist
2. 看文档时无法只凭 WBS 编号判断输入输出和推进顺序

## 4. 稳定输入输出主链

### 4.1 `#69 / WBS-3.2.1 关卡地图元数据设计`

这是 `WBS-3.2` 的第一段主树，职责不是做页面，而是产出后续节点必须统一消费的规范文件。

输入物：

1. `#52 / #53 / #60 / #61 / #62` 已收口的关卡装载边界
2. 现有运行时数据载体：`assets/data/levels.json`
3. 现有地图方案样例：`assets/data/level_map_pack_v1.example.json`

稳定输出物：

1. `assets/data/contracts/level_runtime_definition.contract.json`
2. `assets/data/contracts/level_map_definition.contract.json`
3. [24-关卡管理与关卡编辑器(level_management_editor)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md)
4. [26-关卡地图选择与地图包(level_map_selection)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/26-关卡地图选择与地图包(level_map_selection)-设计说明.md)

消费方：

1. `#79 / WBS-3.2.2`
2. `#101 / WBS-3.2.3`
3. `#100 / WBS-3.2.3.1`

非职责范围：

1. 不直接产出正式编辑器页面
2. 不直接导出最终关卡包或地图包

### 4.2 `#79 / WBS-3.2.2 关卡编辑器基础能力与 JSON 导出链`

这是第二段主树，职责是消费 `3.2.1` 的规范文件，形成标准关卡编辑器与关卡侧导出规范。

输入物：

1. `assets/data/contracts/level_runtime_definition.contract.json`
2. `assets/data/contracts/level_map_definition.contract.json`
3. [24-关卡管理与关卡编辑器(level_management_editor)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md)

稳定输出物：

1. `assets/data/contracts/level_editor_export.contract.json`
2. `assets/data/levels.json`
3. `test/level_editor_v1.html`
4. `test/level_runtime_probe.html`
5. `test/level_editor_io_test.html`
6. [17-WBS-3.2.2-关卡编辑器实现计划](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/17-WBS-3.2.2-关卡编辑器实现计划.md)

消费方：

1. `#101 / WBS-3.2.3`
2. 运行时装载链：`DataManagerV2`

非职责范围：

1. 不负责地图节点、边、背景与地图包编辑
2. 不直接定义地图 handoff payload

### 4.3 `#101 / WBS-3.2.3 地图编辑器基础能力与地图包导出链`

这是第三段主树，职责是消费前两个节点的输出，交付标准地图编辑器，并导出关卡与地图联合成果。

输入物：

1. `assets/data/contracts/level_runtime_definition.contract.json`
2. `assets/data/contracts/level_map_definition.contract.json`
3. `assets/data/contracts/level_editor_export.contract.json`
4. `assets/data/levels.json`

稳定输出物：

1. `assets/data/contracts/level_delivery_bundle.contract.json`
2. `test/level_map_editor_v1.html`
3. `assets/data/level_map_pack_v1.example.json`
4. `test/level_map_editor_io_test.html`
5. `assets/data/levels.json + assets/data/level_map_pack_v1.example.json`
6. [20-WBS-3.2.3-地图编辑器基础能力与地图包导出链](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/20-WBS-3.2.3-地图编辑器基础能力与地图包导出链.md)

消费方：

1. Story 选关展示层
2. 未来关卡/地图内容制作链
3. 发布阶段的内容打包流程

非职责范围：

1. 不反向决定战斗规则
2. 不要求主流程直接依赖地图编辑器页面状态

## 5. 叶子节点在主链中的位置

### 5.1 `#77 / WBS-3.2.1.1 关卡元数据与奖励反馈设计`

这是 `3.2.1` 的关卡侧叶子，负责把“关卡卡片与奖励表达”写进 `level_runtime_definition` 的关卡字段。

稳定输出进入：

1. `assets/data/contracts/level_runtime_definition.contract.json`
2. `assets/data/levels.json` 的 `selectionMeta / rewards / flow` 字段规范

### 5.2 `#78 / WBS-3.2.1.2 地图元数据与连接结构设计`

这是 `3.2.1` 的地图侧叶子，负责把“节点、边、章节、最小 handoff payload”写进 `level_map_definition`。

稳定输出进入：

1. `assets/data/contracts/level_map_definition.contract.json`
2. `assets/data/level_map_pack_v1.example.json` 的组织字段规范

### 5.3 `#104 / WBS-3.2.2.1 关卡工作区数据核心与字段级校验`

这是 `3.2.2` 的数据核心叶子。

输入物：

1. `assets/data/contracts/level_runtime_definition.contract.json`
2. `assets/data/contracts/level_map_definition.contract.json`
3. `assets/data/levels.json`

输出物：

1. `script/editor/level/LevelPackWorkspace.js`
2. `test/level_editor_workspace.test.mjs`
3. [23-WBS-3.2.2.1-关卡工作区数据核心与字段级校验](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/23-WBS-3.2.2.1-关卡工作区数据核心与字段级校验.md)

### 5.4 `#105 / WBS-3.2.2.2 关卡编辑工作区与关卡内要素编辑`

这是 `3.2.2` 的正式编辑工作区叶子。

输入物：

1. `script/editor/level/LevelPackWorkspace.js`
2. `assets/data/levels.json`
3. `assets/data/contracts/level_runtime_definition.contract.json`

输出物：

1. `script/editor/level/LevelEditorPage.js`
2. `script/editor/level/index.js`
3. `test/level_editor_v1.html`
4. `test/level_editor_page.test.mjs`
5. [24-WBS-3.2.2.2-关卡编辑工作区与关卡内要素编辑](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/24-WBS-3.2.2.2-关卡编辑工作区与关卡内要素编辑.md)

### 5.5 `#106 / WBS-3.2.2.3 关卡 JSON 导入导出与运行时验证闭环`

这是 `3.2.2` 的交付与验证叶子。

输入物：

1. `script/editor/level/LevelPackWorkspace.js`
2. `script/editor/level/LevelEditorPage.js`
3. `test/level_editor_v1.html`

输出物：

1. `assets/data/contracts/level_editor_export.contract.json`
2. `test/level_runtime_probe.html`
3. `test/level_editor_io_test.html`
4. `test/codex_regression_runner.html`
5. [25-WBS-3.2.2.3-关卡JSON导入导出与运行时验证闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/25-WBS-3.2.2.3-关卡JSON导入导出与运行时验证闭环.md)

### 5.6 `#100 / WBS-3.2.3.1 地图组织方案与效果图验证`

这是 `3.2.3` 的前置验证叶子，不是最终成果本体。

输入物：

1. `assets/data/contracts/level_map_definition.contract.json`
2. `assets/data/levels.json`

输出物：

1. `test/level_map_selection_mock.html`
2. `assets/data/level_map_pack_v1.example.json`
3. `test/wbs_3_2_3_1_level_map_mock.test.mjs`

### 5.7 `#102 / WBS-3.2.3.2 地图编辑工作区与节点边背景编辑`

这是地图编辑器工作区本体叶子。

输入物：

1. `assets/data/contracts/level_map_definition.contract.json`
2. `assets/data/contracts/level_editor_export.contract.json`
3. `assets/data/levels.json`

输出物：

1. `test/level_map_editor_v1.html`
2. `script/editor/level/`
3. [21-WBS-3.2.3.2-地图编辑工作区与节点边背景编辑](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/21-WBS-3.2.3.2-地图编辑工作区与节点边背景编辑.md)

### 5.8 `#103 / WBS-3.2.3.3 地图包导入导出与校验`

这是地图编辑器导出与交付叶子。

输入物：

1. `assets/data/contracts/level_delivery_bundle.contract.json`
2. `test/level_map_editor_v1.html`
3. `assets/data/levels.json`

输出物：

1. `assets/data/level_map_pack_v1.example.json`
2. `test/level_map_editor_io_test.html`
3. `test/codex_regression_runner.html`
4. 发布时使用的 `levels.json + level_map_pack` 组合产物

## 6. 当前切片策略

当前推进顺序固定为：

1. `3.2.1` 先产出规范文件
2. `3.2.2.1` 先收口关卡工作区真值与字段级校验
3. `3.2.2.2` 再落正式关卡编辑工作区
4. `3.2.2.3` 最后闭合导入导出与运行时验证链
5. `3.2.3` 再消费前两段输出，产出标准地图编辑器与最终联合成果
6. `3.2.3.1` 只是地图编辑器的前置验证，不得代替 `3.2.3` 本体

当前下一执行节点固定为：

1. `#104 / WBS-3.2.2.1 关卡工作区数据核心与字段级校验`

## 7. 当前稳定产物

本节点当前应维护：

1. `assets/data/contracts/level_runtime_definition.contract.json`
2. `assets/data/contracts/level_map_definition.contract.json`
3. `assets/data/contracts/level_editor_export.contract.json`
4. `assets/data/contracts/level_delivery_bundle.contract.json`
5. `assets/data/levels.json`
6. `assets/data/enemies.json`
7. `assets/data/level_map_pack_v1.example.json`
8. `script/engine/DataManagerV2.js`
9. `script/editor/level/LevelPackWorkspace.js`
10. `script/editor/level/LevelEditorPage.js`
11. `script/editor/level/index.js`
12. `test/codex_regression_runner.html`
13. `test/level_editor_v1.html`
14. `test/level_runtime_probe.html`
15. `test/level_editor_io_test.html`
16. `test/level_map_selection_mock.html`
17. `test/wbs_3_2_3_1_level_map_mock.test.mjs`
