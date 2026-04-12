# WBS-3.2 计划：关卡与地图编辑

创建时间：2026-04-07

最后整理时间：2026-04-12

状态：`当前有效；对应 #30 / WBS-3.2；当前已按严格树形编号完成重编`

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
3. `#100 WBS-3.2.3.1 地图组织方案与效果图验证`
4. `#102 WBS-3.2.3.2 地图编辑工作区与节点边背景编辑`
5. `#103 WBS-3.2.3.3 地图包导入导出与校验`

按树形关系展开为：

1. `#30 WBS-3.2 关卡与地图编辑`
2. `#69 WBS-3.2.1 关卡地图元数据设计`
3. `#77 WBS-3.2.1.1 关卡元数据与奖励反馈设计`
4. `#78 WBS-3.2.1.2 地图元数据与连接结构设计`
5. `#79 WBS-3.2.2 关卡编辑器基础能力与 JSON 导出链`
6. `#101 WBS-3.2.3 地图编辑器基础能力与地图包导出链`
7. `#100 WBS-3.2.3.1 地图组织方案与效果图验证`
8. `#102 WBS-3.2.3.2 地图编辑工作区与节点边背景编辑`
9. `#103 WBS-3.2.3.3 地图包导入导出与校验`

## 3. 为什么必须这样拆

这轮整编的核心要求只有一条：

- `编号层级必须与父子树严格一致。`

因此：

1. `3.2.1` 是元数据设计父节点
2. 它的直接子节点只能是 `3.2.1.1 / 3.2.1.2`
3. `3.2.2` 不能再挂在 `3.2.1` 下面，只能是与 `3.2.1` 并列的正式关卡编辑器节点
4. `3.2.3` 不能只剩效果图验证，而必须是正式地图编辑器父节点
5. 效果图验证只能作为 `3.2.3.1` 存在

如果不这样拆，就会出现“树关系是父子，但编号关系像并列”的问题，导致 reviewer 无法只看标题判断结构是否完整。

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
5. [17-WBS-3.2.2-关卡编辑器实现计划](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/17-WBS-3.2.2-关卡编辑器实现计划.md)

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

### 5.3 `#100 / WBS-3.2.3.1 地图组织方案与效果图验证`

这是 `3.2.3` 的前置验证叶子，不是最终成果本体。

输入物：

1. `assets/data/contracts/level_map_definition.contract.json`
2. `assets/data/levels.json`

输出物：

1. `test/level_map_selection_mock.html`
2. `assets/data/level_map_pack_v1.example.json`
3. `test/wbs_3_2_3_1_level_map_mock.test.mjs`

### 5.4 `#102 / WBS-3.2.3.2 地图编辑工作区与节点边背景编辑`

这是地图编辑器工作区本体叶子。

输入物：

1. `assets/data/contracts/level_map_definition.contract.json`
2. `assets/data/contracts/level_editor_export.contract.json`
3. `assets/data/levels.json`

输出物：

1. `test/level_map_editor_v1.html`
2. `script/editor/level/`
3. [21-WBS-3.2.3.2-地图编辑工作区与节点边背景编辑](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/21-WBS-3.2.3.2-地图编辑工作区与节点边背景编辑.md)

### 5.5 `#103 / WBS-3.2.3.3 地图包导入导出与校验`

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
2. `3.2.2` 消费规范文件，产出标准关卡编辑器与关卡导出契约
3. `3.2.3` 再消费前两者输出，产出标准地图编辑器与最终联合成果
4. `3.2.3.1` 只是地图编辑器的前置验证，不得代替 `3.2.3` 本体

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
9. `script/ui/UI_SystemModal.js`
10. `test/codex_regression_runner.html`
11. `test/level_editor_v1.html`
12. `test/level_runtime_probe.html`
13. `test/level_map_selection_mock.html`
14. `test/wbs_3_2_3_1_level_map_mock.test.mjs`
15. [24-关卡管理与关卡编辑器(level_management_editor)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md)
16. [26-关卡地图选择与地图包(level_map_selection)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/26-关卡地图选择与地图包(level_map_selection)-设计说明.md)
17. [17-WBS-3.2.2-关卡编辑器实现计划](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/17-WBS-3.2.2-关卡编辑器实现计划.md)
18. [19-WBS-3.2.3.1-关卡地图组织方案与效果图验证](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/19-WBS-3.2.3.1-关卡地图组织方案与效果图验证.md)
19. [20-WBS-3.2.3-地图编辑器基础能力与地图包导出链](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/20-WBS-3.2.3-地图编辑器基础能力与地图包导出链.md)
20. [21-WBS-3.2.3.2-地图编辑工作区与节点边背景编辑](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/21-WBS-3.2.3.2-地图编辑工作区与节点边背景编辑.md)
21. [22-WBS-3.2.3.3-地图包导入导出与校验](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/22-WBS-3.2.3.3-地图包导入导出与校验.md)

## 8. 验收口径

判断 `WBS-3.2` 是否合理，不再看“有没有多做几个页面”，而是看这棵树是否让人一眼能回答：

1. `3.2.1` 的子节点是否严格写成 `3.2.1.x`
2. 关卡编辑器和地图编辑器是否都是正式主树
3. 地图编辑器是否已经包含“方案验证 / 工作区实现 / IO 校验”三类子节点
4. 看树标题时，是否已经足够判断当前结构能否覆盖全部需求

## 9. 当前结论

`WBS-3.2` 当前正式语义已经收束为：

- `关卡与地图编辑`

后续如果继续扩 `WBS-3.2.x`，必须继续围绕：

1. `对象设计`
2. `对应正式工具`
3. `工具内部的正式子能力`

这三条主轴拆分，而不是回退到抽象、混合、不可审计的命名。
