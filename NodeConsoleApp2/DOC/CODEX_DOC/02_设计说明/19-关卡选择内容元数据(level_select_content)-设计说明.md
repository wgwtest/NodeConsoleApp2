# 关卡选择内容元数据设计说明

创建时间：2026-04-07

最后整理时间：2026-04-10

状态：`当前有效`

关联节点：

1. `#30 WBS-3.2 关卡管理与关卡编辑链`
2. `#69 WBS-3.2.1 关卡内容元数据、通关状态与选择页提示基线`

## 1. 文档定位

本文件是对 [12-关卡系统(level_design)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/12-关卡系统(level_design)-设计说明.md) 和 [24-关卡管理与关卡编辑器(level_management_editor)-设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md) 的运行时补充。

它不重写战斗规则，也不重写关卡实例化逻辑，只回答一个问题：

1. 玩家在进入战斗前，应该如何从关卡选择页感知 story 关卡之间的实际差异。

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

这样做的目的不是剧透战斗细节，而是让 `WBS-3.2` 的关卡管理链开始形成“可感知差异”，避免三个 story 关卡在 UI 上看起来只是换了名字。

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

## 4. 运行时边界

运行时边界统一如下：

1. `DataManagerV2.getLevelSelectEntries()`
   - 负责把 `selectionMeta` 与 `rewards` 透出为关卡选择页消费边界
2. `UI_SystemModal.renderLevelSelect()`
   - 只消费 `getLevelSelectEntries()` 返回结果
   - 不自行推断 story 关卡差异
3. 关卡执行主链
   - 仍以 `levelConfig`、`waves`、`battleRules`、`battlePlayerState` 为真源
   - 不依赖 `selectionMeta`

这保证了：

1. 关卡选择信息与战斗运行时解耦
2. 后续关卡编辑器可以只负责产出配置，不需要直接耦合 UI 实现
3. 阶段 C 后续可以继续扩充内容，而不破坏阶段 A / B 已经稳定的战斗主流程

## 5. UI 展示规则

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

## 6. 作者侧填写建议

为避免 story 内容标签失控，建议遵守以下填写规则：

1. `difficultyLabel`
   - 不超过 4 个字
2. `enemyStyleTags`
   - 优先描述“行为风格”，不要写成纯数值标签
   - 示例：`弱点追击 / 低血自疗 / 残甲修补 / 重击压迫`
3. `buildHint`
   - 只写一条最重要的准备建议
   - 不要把完整打法教程塞进关卡选择页

## 7. 验证口径

自动验证：

1. `test/codex_regression_runner.html`
   - `DataManager 透出故事关卡内容元数据与奖励预览`
   - `UI_SystemModal 会渲染故事关卡内容提示`

人工验证：

1. 从 `mock_ui_v11.html` 进入 `关卡选择`
2. 确认 3 个 story 关卡卡片都具备：
   - 难度
   - 敌人风格
   - 奖励预览
   - 构筑提示
3. 确认锁定态与完成态没有被破坏

## 8. 后续扩展

本契约为 `WBS-3.2` 后续关卡管理链预留了稳定入口，后续可继续叠加：

1. 章节主题标签
2. 首通奖励高亮
3. 推荐构筑类型
4. 内容编辑器对 `selectionMeta` 的可视化维护

但这些扩展应继续遵守：

1. 关卡选择信息只表达“进入前可见差异”
2. 真正的战斗执行语义仍由关卡正式配置驱动
