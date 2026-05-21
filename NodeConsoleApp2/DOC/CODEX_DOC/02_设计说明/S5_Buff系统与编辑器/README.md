# S5 Buff 系统与编辑器设计说明

最后整理时间：2026-05-21

状态：`当前有效`

## 1. 子系统范围

本子系统负责 Buff 数据结构、Buff 运行时语义、Buff action、参数 schema、Buff 编辑器和与技能系统的效果衔接。

## 2. 当前文档

| 文件 | 主题 |
| --- | --- |
| [09-Buff系统(buff_design)-设计说明](./09-Buff系统(buff_design)-设计说明.md) | Buff 体系设计 |
| [10-Buff编辑器(buff_editor_design)-设计说明](./10-Buff编辑器(buff_editor_design)-设计说明.md) | Buff 编辑器设计 |

## 3. 归属规则

1. Buff action、触发时机、参数默认值、参数 schema、编辑器校验归入本子系统。
2. 技能如何挂载 Buff 归入 `S4`，但 Buff 本身语义以本子系统为准。
3. Buff 对战斗执行的影响由本子系统定义语义，由 `S2` 描述消费边界。
