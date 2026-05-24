# S4 技能系统与编辑器设计说明

最后整理时间：2026-05-25

状态：`当前有效`

## 1. 子系统范围

本子系统负责技能数据、技能树、技能学习、技能编辑器、技能规划、技能平衡、技能测试和旧技能字段迁移。

## 2. 当前文档

| 文件 | 主题 |
| --- | --- |
| [03-技能系统(skill_design)-设计说明](./03-技能系统(skill_design)-设计说明.md) | 技能体系设计 |
| [04-技能编辑器(skill_editor_design)-设计说明](./04-技能编辑器(skill_editor_design)-设计说明.md) | 技能编辑器设计 |
| [05-技能规划(skill_planning_design)-设计说明](./05-技能规划(skill_planning_design)-设计说明.md) | 技能规划设计 |
| [06-技能平衡(skill_balance_design)-设计说明](./06-技能平衡(skill_balance_design)-设计说明.md) | 技能平衡设计 |
| [07-技能测试(skill_test_design)-设计说明](./07-技能测试(skill_test_design)-设计说明.md) | 技能测试设计 |
| [08-技能头脑风暴(skill_design_brainStorm)-设计说明](./08-技能头脑风暴(skill_design_brainStorm)-设计说明.md) | 技能思路补充与脑暴记录 |
| [25-旧技能附加字段退役(skill_legacy_field_retirement)-设计说明](./25-旧技能附加字段退役(skill_legacy_field_retirement)-设计说明.md) | 旧技能字段退役与迁移方案 |
| [29-敌人技能包与技能编辑器模式切换(enemy_skill_pack_editor_mode)-设计说明](./29-敌人技能包与技能编辑器模式切换(enemy_skill_pack_editor_mode)-设计说明.md) | 敌人技能包独立真源与技能编辑器多技能域切换设计 |

## 3. 归属规则

1. 技能数据、技能树节点、技能编辑器字段、技能运行时说明归入本子系统。
2. Buff action 与 Buff 参数契约归入 `S5`；技能文档只描述如何引用和消费 Buff。
3. 敌人技能包使用同一套技能 schema，但其敌人模板消费、敌人 AI 语义和敌人编辑器引用边界同时关联 `S6`。
4. 技能树 UI 原型放入 `08_原型与附图/`。
5. 技能树页面的统一视觉与模态交互规则归入 `S7`。
