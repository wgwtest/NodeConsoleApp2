# 关卡选择内容元数据设计说明

创建时间：2026-04-07

最后整理时间：2026-04-08

状态：`当前有效`

关联节点：

1. `#30 WBS L2: C2 内容扩充`
2. `#69 WBS L3: C2.1 故事关卡内容元数据与选择页提示收口`
3. `#78 WBS L3: C2.3 关卡章节组织与连续推进信息补足`
4. `#79 WBS L3: C2.4 story / acceptance / 编辑器样本层级口径清理`

## 1. 文档定位

本文件是对 [12-关卡系统(level_design)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/12-关卡系统(level_design)-设计说明.md) 的运行时补充。

它不重写战斗规则，也不重写关卡实例化逻辑，只回答一个问题：

1. 玩家在进入战斗前，应该如何从关卡选择页感知 story 关卡之间的实际差异。

随着 `C2.3 / C2.4` 落地，本文件还要补充第二个问题：

1. story、验收样本与作者样本工具页之间，应该如何维持稳定的内容来源分层。

## 2. 设计目标

关卡选择页不应只展示“关卡名 + 一句描述”。

对于已经具备基础战斗闭环的 vertical slice，story 关卡至少要让玩家在进入战斗前看见四类信息：

1. `难度`
   - 让玩家快速判断本关的压力级别
2. `敌人风格`
   - 让玩家提前理解敌人行为关键词
3. `奖励预览`
   - 让玩家知道本关提供的成长节奏
4. `构筑提示`
   - 让玩家知道当前构筑应优先准备什么能力

这样做的目的不是剧透战斗细节，而是让阶段 C 的内容扩充开始形成“可感知差异”，避免三个 story 关卡在 UI 上看起来只是换了名字。

## 3. 数据契约

story 关卡在 `assets/data/levels.json` 中新增轻量字段：

```json
{
  "selectionMeta": {
    "difficultyLabel": "标准",
    "enemyStyleTags": ["弱点追击", "快攻"],
    "buildHint": "优先补头部防御，再用低耗技能稳定换血。"
  }
}
```

字段约束：

1. `difficultyLabel`
   - 字符串
   - 用于人工快速理解难度层级
   - 推荐值示例：`标准 / 进阶 / 高压`
2. `enemyStyleTags`
   - 字符串数组
   - 用于展示敌人行为关键词
   - 推荐保留 `2 ~ 4` 个标签，避免信息过载
3. `buildHint`
   - 单句字符串
   - 用于提示当前关卡更适合怎样的技能或资源准备

设计约束：

1. `selectionMeta` 只表达“选择前可见信息”，不承载战斗执行逻辑
2. 奖励预览不在 `selectionMeta` 中重复维护，统一复用关卡正式 `rewards`
3. acceptance 样本默认不要求配置 `selectionMeta`
4. `selectionMeta` 缺失时，关卡选择页必须允许降级显示，不应阻断进入

## 4. 内容来源分层

当前工程中的关卡相关内容，必须严格分成 3 层：

1. `story`
   - 面向正式玩家推进
   - 入口：`mock_ui_v11.html -> 关卡选择`
   - 真源：`levels.json` 中 `flow.kind = story`
2. `acceptance`
   - 面向人工验收 / 稳定复核
   - 入口：`mock_ui_v11.html -> 验收样本`
   - 真源：`levels.json` 中 `flow.kind = acceptance`
3. `authoring / 编辑器样本`
   - 面向作者验证产物注入与运行时消费
   - 入口：
     - `test/level_editor_io_test.html`
     - `test/level_runtime_probe.html`
   - 真源：工具页内存 + `runtime override`

设计要求：

1. `story` 与 `acceptance` 属于运行时关卡来源。
2. `authoring` 不属于运行时关卡来源，不进入正式关卡列表。
3. 任何页面都不应把 `authoring` 误写成“故事推进关卡”或“验收样本入口”。
4. 任何说明文案都必须能回答“这页是给谁用的，它不是什么”。

## 5. 运行时边界

运行时边界统一如下：

1. `DataManagerV2.getLevelSelectEntries()`
   - 负责把 `selectionMeta` 与 `rewards` 透出为关卡选择页消费边界
2. `UI_SystemModal.renderLevelSelect()`
   - 只消费 `getLevelSelectEntries()` 返回结果
   - 不自行推断 story 关卡差异
3. 关卡执行主链
   - 仍以 `levelConfig`、`waves`、`battleRules`、`battlePlayerState` 为真源
   - 不依赖 `selectionMeta`
4. `DataManagerV2.getAcceptanceLevelSelectEntries()`
   - 只暴露 `acceptance` 层
   - 不混入 `story`
5. `DataManagerV2.getLevelContentSourceOverview()`
   - 统一输出 `story / acceptance / authoring` 的来源摘要
   - 供 UI 或验收页解释入口分工

这保证了：

1. 关卡选择信息与战斗运行时解耦
2. 后续关卡编辑器可以只负责产出配置，不需要直接耦合 UI 实现
3. 阶段 C 后续可以继续扩充内容，而不破坏阶段 A / B 已经稳定的战斗主流程

## 6. UI 展示规则

story 关卡卡片展示顺序如下：

1. 关卡名称
2. 关卡描述
3. 状态标记
   - `已完成`
   - `未解锁`
4. 难度
5. 敌人风格
6. 奖励预览
7. 构筑提示

展示约束：

1. `未解锁` 状态必须继续生效，不因新增信息变成可点击
2. `已完成` 状态必须继续保留
3. acceptance 样本页不强行展示 story 内容提示
4. 奖励预览显示正式奖励值，推荐以 `EXP / GOLD / KP` 的紧凑标签形式呈现
5. 主菜单中的入口说明必须明确：
   - `关卡选择` 对应 `story`
   - `验收样本` 对应 `acceptance`
   - `作者样本工具页` 不在游戏菜单
6. 作者工具页必须明确写出：
   - 自己不属于故事推进关卡
   - 自己不属于验收样本入口

## 7. 作者侧填写建议

为避免 story 内容标签失控，建议遵守以下填写规则：

1. `difficultyLabel`
   - 不超过 4 个字
2. `enemyStyleTags`
   - 优先描述“行为风格”，不要写成纯数值标签
   - 示例：`弱点追击 / 低血自疗 / 残甲修补 / 重击压迫`
3. `buildHint`
   - 只写一条最重要的准备建议
   - 不要把完整打法教程塞进关卡选择页

## 8. 验证口径

自动验证：

1. `test/codex_regression_runner.html`
   - `DataManager 透出故事关卡内容元数据与奖励预览`
   - `UI_SystemModal 会渲染故事关卡内容提示`
   - `DataManager 构建关卡内容来源分层摘要`
   - `UI_SystemModal 会解释 story/验收样本/作者样本入口分工`

人工验证：

1. 从 `mock_ui_v11.html` 进入 `关卡选择`
2. 确认 3 个 story 关卡卡片都具备：
   - 难度
   - 敌人风格
   - 奖励预览
   - 构筑提示
3. 确认锁定态与完成态没有被破坏
4. 确认主菜单不会把作者样本误渲染成运行时入口
5. 确认作者工具页明确写出其用途与边界

## 9. 后续扩展

本契约为阶段 C 后续内容扩充预留了稳定入口，后续可继续叠加：

1. 章节主题标签
2. 首通奖励高亮
3. 推荐构筑类型
4. 内容编辑器对 `selectionMeta` 的可视化维护

但这些扩展应继续遵守：

1. 关卡选择信息只表达“进入前可见差异”
2. 真正的战斗执行语义仍由关卡正式配置驱动
