# S5 Buff 系统与编辑器设计说明

最后整理时间：2026-05-28

状态：`当前有效`

## 1. 子系统范围

本子系统负责 Buff 内容包、Buff 数据契约、Buff 运行内核、Buff action、参数 schema、Buff 编辑器、运行时探针，以及与技能系统的效果衔接。

本项目不强行采用传统“前端/后端”二分。S5 的设计口径是：

- 数据契约层：`buffs_v2_7.json`、`meta.enums`、字段说明、schema。
- 内容装载层：`DataManagerV2`、内容包覆盖、版本与来源。
- 运行内核层：`BuffRegistry`、`BuffManager`、`BuffSystem`、`Buff`。
- 编辑展示层：Buff 编辑器、技能编辑器中的 Buff 引用面板。
- 验证探针层：Buff runtime probe、I/O 测试页、战斗机器人测试。

## 2. 当前文档

| 文件 | 主题 |
| --- | --- |
| [09-Buff系统(buff_design)-设计说明](./09-Buff系统(buff_design)-设计说明.md) | S5 主软件设计说明：系统边界、分层、数据契约、运行内核、状态机、流程、验收 |
| [10-Buff编辑器(buff_editor_design)-设计说明](./10-Buff编辑器(buff_editor_design)-设计说明.md) | Buff 编辑器子设计：工作区、信息架构、交互、校验、导入导出、模拟器边界 |

## 3. 归属规则

1. Buff action、触发时机、参数默认值、参数 schema、编辑器校验归入本子系统。
2. 技能如何挂载 Buff 归入 `S4`，但 Buff 本身语义以本子系统为准。
3. Buff 对战斗执行的影响由本子系统定义语义，由 `S2` 描述消费边界。
4. 编辑器 UI 只负责编辑展示；Buff 是否真的生效以运行内核和验证探针为准。
