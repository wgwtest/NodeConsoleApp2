# 关卡管理与关卡编辑器设计说明

创建时间：2026-04-10

最后整理时间：2026-04-13

状态：`当前有效`

关联节点：

1. `#30 WBS-3.2 关卡与地图编辑`
2. `#69 WBS-3.2.1 关卡地图元数据设计`
3. `#77 WBS-3.2.1.1 关卡元数据与奖励反馈设计`
4. `#78 WBS-3.2.1.2 地图元数据与连接结构设计`
5. `#79 WBS-3.2.2 关卡编辑器基础能力与 JSON 导出链`
6. `#101 WBS-3.2.3 地图编辑器基础能力与地图包导出链`
7. `#100 WBS-3.2.3.1 地图组织方案与效果图验证`
8. `#102 WBS-3.2.3.2 地图编辑工作区与节点边背景编辑`
9. `#103 WBS-3.2.3.3 地图包导入导出与校验`
8. `#52 WBS-1.4.3 关卡编辑契约与编辑链启动`

## 1. 文档定位

本文件是 `WBS-3.2` 的上位设计说明。

它不替代：

1. [12-关卡系统(level_design)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/12-关卡系统(level_design)-设计说明.md)
   - 负责更早期的关卡系统概念设计
2. [19-关卡选择内容元数据(level_select_content)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/19-关卡选择内容元数据(level_select_content)-设计说明.md)
   - 负责选择页的玩家可见元数据表达

本文件要解决的是另外一个问题：

1. `WBS-3.2` 到底在做什么
2. 为什么它不是泛泛的“内容扩充”
3. 关卡运行时、关卡组织、关卡编辑器三者如何解耦
4. 当前阶段应该如何在现有 `WBS-3.2.1 ~ WBS-3.2.3.3` 上严谨拆分
5. 为什么 `WBS-3.2.2` 和 `WBS-3.2.3` 都不能只停留在样本页或测试页

## 2. 设计结论

`WBS-3.2` 的正式对象应定义为：

- `关卡与地图编辑`

它由三层共同组成：

1. `关卡节点层`
   - 单个关卡的定义、敌人、奖励、胜利条件、情节摘要、通关状态表达
2. `线性 fallback 推进层`
   - 无地图模式下的章节归组、顺序、解锁规则与线性后继兼容表达
3. `作者工具层`
   - 正式关卡编辑器如何维护运行时关卡、线性 fallback 元数据与导出链

如果只把这部分叫“内容扩充”，会同时丢失两个关键信息：

1. 它的核心对象其实是 `关卡`
2. 它已经天然包含 `关卡编辑器` 这条作者链，而不只是 UI 上多几张关卡卡片

同时，如果把 `WBS-3.2.2` 只理解成“样本页”“测试页”或“边界说明页”，也会把真正的交付对象偷换掉。

`WBS-3.2.2` 的正式交付对象应是：

- `像技能编辑器、Buff 编辑器一样的正式关卡编辑器`

## 2.1 关卡与地图的字段归属

从当前版本开始，`levels.json` 与 `level_map_pack` 的边界固定如下：

1. `levels.json` 负责 `运行时关卡真值`
   - `battleRules`
   - `waves`
   - `rewards`
   - `unlockRules`
   - `selectionMeta`
   - `background`
2. `level_map_pack` 负责 `地图组织真值`
   - `backgroundRef`
   - `space`
   - `display`
   - `nodes[].position`
   - `edges[]`
   - `entryNodeId`
   - `artRefs.*`
3. `background` 与 `backgroundRef` 不是同一件事
   - `levels.*.background` 表示战斗场景背景
   - `maps[].backgroundRef` 表示章节/世界地图背景
4. 关卡运行时层不再持有“下一关连接字段”
   - 无地图模式下的推进提示由顺序、章节和解锁规则共同推导
   - 正式地图连线只由 `level_map_pack.edges[]` 维护
5. 地图包里出现的 `label / title / objectiveText / difficultyLabel / rewardPreview`
   - 当前版本只允许视为 `展示覆写`
   - 不能反向定义战斗规则或替代 `levels.json` 的运行时语义

## 2.2 WBS-3.2 的稳定输入输出链

从本轮开始，`WBS-3.2` 不再只按“页面功能”理解，而按稳定输入输出链理解：

1. `WBS-3.2.1`
   - 输出：数据结构规范文件
   - 当前固定为：
     - `assets/data/contracts/level_runtime_definition.contract.json`
     - `assets/data/contracts/level_map_definition.contract.json`
2. `WBS-3.2.2`
   - 输入：`3.2.1` 输出的规范文件
   - 输出：关卡编辑器导出规范与标准关卡编辑器产物
   - 当前固定为：
     - `assets/data/contracts/level_editor_export.contract.json`
     - `assets/data/levels.json`
     - `test/level_editor_v1.html`
3. `WBS-3.2.3`
   - 输入：`3.2.1` 的规范文件 + `3.2.2` 的关卡编辑器输出
   - 输出：标准地图编辑器与关卡/地图联合成果
   - 当前固定为：
     - `assets/data/contracts/level_delivery_bundle.contract.json`
     - `test/level_map_editor_v1.html`
     - `assets/data/level_map_pack_v1.example.json`

这条链要求：

1. `3.2.2` 不能自行发明另一套 level 数据语义
2. `3.2.3` 不能绕过 `3.2.2` 直接拼接未经约束的 `levelId`
3. 最终成果必须表现为稳定文件组合，而不是临时页面状态

## 3. 三层模型

### 3.1 关卡节点层

单个关卡节点至少应具备以下语义：

1. `基础标识`
   - `id`
   - `name`
   - `description`
   - `chapterId`
2. `进入前可见信息`
   - 难度
   - 敌人风格标签
   - 奖励预览
   - 构筑提示
   - 情节摘要
3. `运行时内容`
   - 敌人池或波次配置
   - 奖励配置
   - 胜利条件
   - 失败条件
4. `进度语义`
   - 是否已解锁
   - 是否首次通关
   - 是否已完成
   - 是否仍可领取首通奖励

### 3.2 线性 fallback 推进层

线性 fallback 推进层回答的是：

1. 在没有地图页时，当前关卡在章节列表中的位置是什么
2. 当前线性选择页应该如何给出下一步提示
3. 关卡解锁规则在无地图模式下如何表达

当前结论：

1. 当前版本可以继续采用 `线性章节链` 作为最小可交付基线
2. 但这不等于把 `线性 fallback` 当成地图图结构真值
3. 当前最小字段应理解为：
   - `chapterId / chapterOrder`
   - `chapterLabel / chapterTitle / nodeLabel / objectiveText`
   - `unlockRules`

这意味着：

1. 当前 UI 可以把它投影成线性流程
2. 未来如果扩成支线、分叉或回环，应由地图包承接图结构，而不是再往关卡运行时层塞图连接字段

### 3.3 作者工具层

关卡编辑器的职责不是直接操纵战斗页面，而是维护关卡运行时数据与线性 fallback 元数据。

它至少应覆盖两类编辑对象：

1. `关卡归组与 fallback 对象`
   - 章节
   - 顺序
   - 解锁关系
   - 线性 fallback 展示元数据
   - 首通 / 复通奖励规则
2. `关卡内对象`
   - 敌人配置
   - 奖励配置
   - 解锁规则
   - 胜利条件
   - 失败条件
   - 进入前提示信息

同时需要明确一个新增边界：

1. `地图组织编辑` 与 `运行时关卡编辑` 是并列作者域
2. 地图编辑消费 `levelId`、章节和部分展示元数据，但不替代运行时关卡配置
3. 地图编辑负责节点坐标、边关系、地图背景和素材引用
4. 关卡编辑不再承担地图图结构编辑
5. 因此 `WBS-3.2.2` 与 `#101 / WBS-3.2.3` 必须并列存在，而不是互相吞并

编辑器与运行时的边界固定如下：

1. 编辑器负责产出或修改配置
2. 运行时只消费已验证通过的配置
3. 运行时不依赖编辑器页面存在
4. 没有编辑器也不影响主流程游玩

### 3.4 关卡编辑器在输入输出链中的位置

`WBS-3.2.2` 在这条链中的职责不是“做一个可点的编辑页面”，而是：

1. 消费 `level_runtime_definition` 与 `level_map_definition` 两份规范文件
2. 固化一套标准关卡编辑工作区
3. 导出满足运行时装载链要求的 `levels.json`
4. 输出供 `WBS-3.2.3` 继续消费的关卡编辑契约

因此 `WBS-3.2.2` 的稳定输出必须同时包含：

1. `规范`
   - `assets/data/contracts/level_editor_export.contract.json`
2. `工具`
   - `test/level_editor_v1.html`
3. `数据`
   - `assets/data/levels.json`

### 3.5 正式关卡编辑器应具备的基础能力

`WBS-3.2.2` 不应继续以“样本页”充当交付物。

一个合理的正式关卡编辑器，至少要具备以下能力：

1. `关卡节点 CRUD`
   - 新增关卡
   - 删除关卡
   - 修改关卡基础元数据
2. `章节与线性 fallback 元数据编辑`
   - 指定 `chapterId`
   - 维护 `chapterOrder / chapterLabel / chapterTitle / nodeLabel / objectiveText`
   - 维护 `unlockRules`
3. `关卡内要素编辑`
   - 敌人配置
   - 奖励配置
   - 胜利条件
   - 失败条件
   - 进入前提示信息
4. `导入 / 导出`
   - 读取当前 `levels.json`
   - 导出供主游戏直接消费的 JSON 文件
5. `强校验`
   - 节点 id 唯一
   - 章节归属有效
   - 奖励 / 敌人 / 胜利条件等关键字段满足最小契约

这意味着：

1. `test/level_editor_io_test.html` 与 `test/level_runtime_probe.html` 只能作为历史验证页或后续导出验证页
2. 它们不能再被当作 `WBS-3.2.2` 的正式编辑器本体
3. 当前正式闭环固定为：`level_editor_v1.html` 导入 / 编辑 / 导出 / Runtime Override -> `level_runtime_probe.html` 重新装载验证

## 4. 当前 WBS-3.2 的严格拆分

在不全面重写既有 issue 的前提下，当前 `WBS-3.2` 统一按下面结构理解：

### 4.1 `WBS-3.2.1`

- `关卡地图元数据设计`

负责：

1. 作为 `WBS-3.2` 的元数据父节点
2. 下分关卡侧与地图侧元数据叶子
3. 先收口“要编辑的对象是什么”，再进入正式编辑器实现

### 4.2 `WBS-3.2.1.1`

- `关卡元数据与奖励反馈设计`

负责：

1. 奖励配置的玩家可见表达
2. 首通奖励与重复通关收益的区别
3. 通关后回到关卡选择页的状态切换

### 4.3 `WBS-3.2.1.2`

- `地图元数据与连接结构设计`

负责：

1. 当前章节信息
2. 当前节点与下一步去向
3. 线性链路的基线表达
4. 非线性扩展所需的最小连接语义预留

### 4.4 `WBS-3.2.2`

- `关卡编辑器基础能力与 JSON 导出链`

负责：

1. 作为 `WBS-3.2` 的第二段主树，消费 `3.2.1` 的规范输出
2. 维护正式关卡编辑器的父节点边界，而不再只是一个单页执行清单
3. 对内拆分为“数据核心 -> 编辑工作区 -> 导入导出与运行时验证”三叶结构
4. 对外产出稳定的 `levels.json` 与 `level_editor_export` 消费链

同时固定其输入输出为：

1. 输入：
   - `assets/data/contracts/level_runtime_definition.contract.json`
   - `assets/data/contracts/level_map_definition.contract.json`
2. 输出：
   - `assets/data/contracts/level_editor_export.contract.json`
   - `assets/data/levels.json`
   - `test/level_editor_v1.html`
   - `test/level_runtime_probe.html`
   - `test/level_editor_io_test.html`

当前正式子节点固定为：

1. `#104 / WBS-3.2.2.1 关卡工作区数据核心与字段级校验`
2. `#105 / WBS-3.2.2.2 关卡编辑工作区与关卡内要素编辑`
3. `#106 / WBS-3.2.2.3 关卡 JSON 导入导出与运行时验证闭环`

### 4.4.1 `#104 / WBS-3.2.2.1`

- `关卡工作区数据核心与字段级校验`

负责：

1. 不依赖 DOM 的关卡工作区真值模型
2. 章节、连接、波次、敌人池、奖励等字段级校验
3. 为页面层和导出层提供稳定读写 API

### 4.4.2 `#105 / WBS-3.2.2.2`

- `关卡编辑工作区与关卡内要素编辑`

负责：

1. 正式关卡编辑器页面壳
2. 关卡列表、详情、章节关系与波次编辑
3. 关卡内作者对象的页面级交互

### 4.4.3 `#106 / WBS-3.2.2.3`

- `关卡 JSON 导入导出与运行时验证闭环`

负责：

1. 关卡 JSON 导入导出
2. runtime override 写入与清理
3. `level_runtime_probe` 和回归页的稳定消费验证

### 4.5 `#101 / WBS-3.2.3`

- `地图编辑器基础能力与地图包导出链`

负责：

1. 提供与正式关卡编辑器并列的地图编辑工作区
2. 定义并维护“逻辑地图空间 -> 显示映射层 -> 导出契约”的完整数据链
3. 支持地图背景切换、节点拖拽定位、节点增删改和节点样式编辑
4. 支持节点与 `levelId` 的绑定与校验
5. 支持边、分支、汇合关系编辑
6. 支持导入 / 导出 `level_map_pack`
7. 保持地图编辑器与主流程运行时低耦合

同时固定其输入输出为：

1. 输入：
   - `assets/data/contracts/level_runtime_definition.contract.json`
   - `assets/data/contracts/level_map_definition.contract.json`
   - `assets/data/contracts/level_editor_export.contract.json`
   - `assets/data/levels.json`
2. 输出：
   - `assets/data/contracts/level_delivery_bundle.contract.json`
   - `test/level_map_editor_v1.html`
   - `assets/data/level_map_pack_v1.example.json`
   - 最终关卡/地图联合成果

### 4.6 `#100 / WBS-3.2.3.1`

- `关卡地图组织方案与效果图验证`

负责：

1. 用独立地图包样例表达章节地图、分支和汇合关系
2. 用独立效果图页验证地图式关卡组织是否足够直观
3. 明确地图层与主程序的 handoff payload 只保留最小字段
4. 为后续正式关卡编辑器补一条“地图包维护域”，但当前不直接改主流程

### 4.7 `#102 / WBS-3.2.3.2`

- `地图编辑工作区与节点边背景编辑`

负责：

1. 基于地图数据对象驱动中央舞台，而不是基于 DOM 临时状态直接绘制
2. 地图节点增删改
3. 节点拖拽定位
4. 背景切换
5. 节点样式编辑
6. 边关系编辑
7. 把节点逻辑位置、背景资源引用、显示配置写回地图数据
8. 保证抽屉开关、视口变化和舞台缩放不会改变地图真值

### 4.8 `#103 / WBS-3.2.3.3`

- `地图包导入导出与校验`

负责：

1. `level_map_pack` 导入
2. `level_map_pack` 导出
3. 字段级校验
4. round-trip 验证与回归接入

## 5. 当前实现策略

当前阶段不应再把“样本页边界澄清”误判为 `WBS-3.2.2` 的主要目标。

当前正确推进顺序应改为：

1. 先由 `WBS-3.2.1` 把元数据与最小契约收口
2. 再由 `WBS-3.2.2.1` 收口关卡工作区真值与字段级校验
3. 再由 `WBS-3.2.2.2` 交付正式关卡编辑工作区
4. 再由 `WBS-3.2.2.3` 闭合导入导出与运行时验证链
5. 再用 `WBS-3.2.3.1` 先验证地图组织方案和最小 handoff payload
6. 再进入 `WBS-3.2.3.2` 交付地图编辑工作区
7. 再进入 `WBS-3.2.3.3` 交付地图包导入导出与校验
8. 最后再用既有 probe 页和主流程页验证导出产物能被消费

因此当前要求是：

1. 主流程页继续证明关卡节点层与章节组织层成立
2. 正式关卡编辑器必须作为单独作者工具交付
3. `LevelPackWorkspace` 这类纯数据核心要先于页面层承担字段规则
4. 既有 `level_editor_io_test` / `level_runtime_probe` 只保留为导出后验证链，不再冒充正式编辑器

当前不要求一步做到：

1. 完整商业级章节图可视化
2. 所有关卡内对象的高级可视化排布
3. 把编辑器强塞进主流程运行时

## 6. 验证入口分层

### 6.1 玩家主流程验证

主入口：

1. `mock_ui_v11.html`

用于验证：

1. 玩家是否能在关卡选择中理解当前关卡差异
2. 玩家是否能理解章节推进与奖励反馈

### 6.2 正式关卡编辑器验证

主入口：

1. `test/level_editor_v1.html`
   - 当前正式关卡编辑器主入口
   - 独立于主流程页
   - 独立于历史 I/O 页和 probe 页

用于验证：

1. 是否可新增 / 删除关卡
2. 是否可编辑章节与线性 fallback 元数据
3. 是否可编辑 `unlockRules`、`victoryCondition`、`failureCondition`
4. 是否可导入已有关卡包 JSON，并把字段正确回填到正式编辑工作区
5. 是否可编辑关卡内敌人、奖励和提示信息
6. 是否可导出可被主游戏消费的 JSON 文件

### 6.3 运行时装载验证

主入口：

1. `test/level_runtime_probe.html`

用于验证：

1. 正式关卡编辑器导出产物能否被运行时装载
2. `unlockRules`、`victoryCondition`、`failureCondition` 是否在独立运行时中被重新读取
3. 关卡节点与运行时对象之间的映射边界是否稳定

### 6.4 自动化与浏览器回归验证

主入口：

1. `node --test test/level_editor_workspace.test.mjs test/level_editor_page.test.mjs`
2. `node tools/level_editor_cdp_smoke.mjs`
3. `test/codex_regression_runner.html`
4. `test/level_map_selection_mock.html`

用于验证：

1. 工作区核心是否保持节点排序、关系维护、校验与导出契约
2. 正式编辑器页面是否能在真实浏览器里完成“导入 -> 编辑 -> 导出 -> override -> probe 消费 -> 清理回退”链路
3. 作者工具页摘要与静态页面语义是否仍与当前正式入口一致
4. 地图组织方案是否能在不改主流程的前提下完成独立展示和最小 payload 验证

## 7. 低耦合规则

`WBS-3.2` 必须继续遵守低耦合规则：

1. 关卡编辑器不是主流程运行的前置依赖
2. 章节组织展示失败，不应阻断战斗进入
3. 选择页提示信息失败，不应破坏关卡执行主链
4. 编辑器链的字段扩展，不应直接改写战斗内核

## 8. 当前结论

当前 `WBS-3.2` 的合理理解不再是“多做一些内容”，而是：

- `把关卡从离散配置，收口成可管理、可组织、可编辑、可验证的正式内容系统`

后续所有 `WBS-3.2.x` 子节点都应围绕这个定义展开，而不是再次退回“内容扩充”这种过泛表述。

其中 `WBS-3.2.2` 的当前正式口径已经明确为：

- `交付正式关卡编辑器基础能力与 JSON 导出链`

同时应补充一个前置验证叶子：

- `#100 / WBS-3.2.3.1 地图组织方案与效果图验证`

其职责是先收口地图包与地图选择层边界，再决定是否进入正式主流程接入。

而不是：

- `继续追加样本页`
- `继续追加测试入口`
- `仅做 story / acceptance / editor sample 边界说明`
