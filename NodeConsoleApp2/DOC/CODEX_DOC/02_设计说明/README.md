# 设计说明 README

最后整理时间：2026-05-21

状态：`当前有效 / 子系统化设计说明目录`

## 1. 说明

本目录是 `NodeConsoleApp2` 的正式设计文档区，承载已经确认、需要长期复用的系统设计、子系统设计和稳定补充设计。

本轮参考 `CodeFactoryV2` 的正式设计说明组织方式，将原先扁平的 `NN-主题-设计说明.md` 文档池改为：

1. `00_总纲/`：跨子系统总设计、文档治理和粒度规则。
2. `S1-S7` 子系统目录：按游戏功能边界组织主设计与专题设计。
3. 子系统 README：作为每个子系统的稳定入口，说明范围、当前文档和排除边界。

## 2. 阅读顺序

1. [00_总纲/00-NodeConsoleApp2游戏系统总体设计](./00_总纲/00-NodeConsoleApp2游戏系统总体设计.md)
2. [00_总纲/01-设计说明文档治理与粒度规则](./00_总纲/01-设计说明文档治理与粒度规则.md)
3. [S1_主游戏流程/README](./S1_主游戏流程/README.md)
4. [S2_战斗运行时/README](./S2_战斗运行时/README.md)
5. [S3_关卡地图与编辑器/README](./S3_关卡地图与编辑器/README.md)
6. [S4_技能系统与编辑器/README](./S4_技能系统与编辑器/README.md)
7. [S5_Buff系统与编辑器/README](./S5_Buff系统与编辑器/README.md)
8. [S6_数据存档与内容契约/README](./S6_数据存档与内容契约/README.md)
9. [S7_UI与交互基线/README](./S7_UI与交互基线/README.md)

## 3. 子系统目录

| 子系统 | 目录 | 职责 |
| --- | --- | --- |
| `00` | `00_总纲/` | 游戏总体架构、设计说明治理、跨子系统边界 |
| `S1` | `S1_主游戏流程/` | 主菜单、关卡选择、进入确认、结算流转、主流程信息优先级 |
| `S2` | `S2_战斗运行时/` | 核心引擎、敌人、道具、时间线、战斗展示层 |
| `S3` | `S3_关卡地图与编辑器/` | 关卡系统、地图选择、地图包、关卡编辑器、地图编辑器 |
| `S4` | `S4_技能系统与编辑器/` | 技能系统、技能树、技能编辑器、技能规划、技能平衡、技能测试 |
| `S5` | `S5_Buff系统与编辑器/` | Buff 运行时、Buff 数据契约、Buff 编辑器 |
| `S6` | `S6_数据存档与内容契约/` | 数据结构、本地存档、内容装载、跨模块配置契约 |
| `S7` | `S7_UI与交互基线/` | UI 基线、时间线界面、战斗场景、Spine 素材与展示协作 |

## 4. 现有设计文档索引

### 4.1 总纲

| 文件 | 主题 |
| --- | --- |
| [00-NodeConsoleApp2游戏系统总体设计](./00_总纲/00-NodeConsoleApp2游戏系统总体设计.md) | 游戏系统总体结构与子系统关系 |
| [01-设计说明文档治理与粒度规则](./00_总纲/01-设计说明文档治理与粒度规则.md) | 设计文档分层、命名、粒度和迁移规则 |

### 4.2 S1 主游戏流程

| 文件 | 主题 |
| --- | --- |
| [19-关卡选择内容元数据(level_select_content)-设计说明](./S1_主游戏流程/19-关卡选择内容元数据(level_select_content)-设计说明.md) | 关卡选择信息与主流程内容元数据 |

### 4.3 S2 战斗运行时

| 文件 | 主题 |
| --- | --- |
| [01-核心引擎(core_engine)-设计说明](./S2_战斗运行时/01-核心引擎(core_engine)-设计说明.md) | 核心引擎设计 |
| [11-敌人系统(enemy_design)-设计说明](./S2_战斗运行时/11-敌人系统(enemy_design)-设计说明.md) | 敌人系统设计 |
| [13-道具系统(item_design)-设计说明](./S2_战斗运行时/13-道具系统(item_design)-设计说明.md) | 道具系统设计 |
| [14-时间线机制(timeline_design)-设计说明](./S2_战斗运行时/14-时间线机制(timeline_design)-设计说明.md) | 时间线机制设计 |
| [20-对战演出与动画展示层(battle_presentation)-设计说明](./S2_战斗运行时/20-对战演出与动画展示层(battle_presentation)-设计说明.md) | 战斗展示层和动画展示设计 |

### 4.4 S3 关卡地图与编辑器

| 文件 | 主题 |
| --- | --- |
| [12-关卡系统(level_design)-设计说明](./S3_关卡地图与编辑器/12-关卡系统(level_design)-设计说明.md) | 关卡系统设计 |
| [24-关卡管理与关卡编辑器(level_management_editor)-设计说明](./S3_关卡地图与编辑器/24-关卡管理与关卡编辑器(level_management_editor)-设计说明.md) | 关卡管理与关卡编辑器设计 |
| [26-关卡地图选择与地图包(level_map_selection)-设计说明](./S3_关卡地图与编辑器/26-关卡地图选择与地图包(level_map_selection)-设计说明.md) | 地图式关卡选择、地图包和主程序交接设计 |

### 4.5 S4 技能系统与编辑器

| 文件 | 主题 |
| --- | --- |
| [03-技能系统(skill_design)-设计说明](./S4_技能系统与编辑器/03-技能系统(skill_design)-设计说明.md) | 技能体系设计 |
| [04-技能编辑器(skill_editor_design)-设计说明](./S4_技能系统与编辑器/04-技能编辑器(skill_editor_design)-设计说明.md) | 技能编辑器设计 |
| [05-技能规划(skill_planning_design)-设计说明](./S4_技能系统与编辑器/05-技能规划(skill_planning_design)-设计说明.md) | 技能规划设计 |
| [06-技能平衡(skill_balance_design)-设计说明](./S4_技能系统与编辑器/06-技能平衡(skill_balance_design)-设计说明.md) | 技能平衡设计 |
| [07-技能测试(skill_test_design)-设计说明](./S4_技能系统与编辑器/07-技能测试(skill_test_design)-设计说明.md) | 技能测试设计 |
| [08-技能头脑风暴(skill_design_brainStorm)-设计说明](./S4_技能系统与编辑器/08-技能头脑风暴(skill_design_brainStorm)-设计说明.md) | 技能思路补充与脑暴记录 |
| [25-旧技能附加字段退役(skill_legacy_field_retirement)-设计说明](./S4_技能系统与编辑器/25-旧技能附加字段退役(skill_legacy_field_retirement)-设计说明.md) | 旧技能字段退役与迁移方案 |

### 4.6 S5 Buff 系统与编辑器

| 文件 | 主题 |
| --- | --- |
| [09-Buff系统(buff_design)-设计说明](./S5_Buff系统与编辑器/09-Buff系统(buff_design)-设计说明.md) | Buff 体系设计 |
| [10-Buff编辑器(buff_editor_design)-设计说明](./S5_Buff系统与编辑器/10-Buff编辑器(buff_editor_design)-设计说明.md) | Buff 编辑器设计 |

### 4.7 S6 数据存档与内容契约

| 文件 | 主题 |
| --- | --- |
| [02-数据结构(data_design)-设计说明](./S6_数据存档与内容契约/02-数据结构(data_design)-设计说明.md) | 数据结构与配置设计 |
| [18-本地存档(local_save_design)-设计说明](./S6_数据存档与内容契约/18-本地存档(local_save_design)-设计说明.md) | 本地存档生命周期与触发机制设计 |

### 4.8 S7 UI 与交互基线

| 文件 | 主题 |
| --- | --- |
| [15-时间线界面(timeline_UI_design)-设计说明](./S7_UI与交互基线/15-时间线界面(timeline_UI_design)-设计说明.md) | 时间线 UI 设计 |
| [16-战斗界面(UI_design)-设计说明](./S7_UI与交互基线/16-战斗界面(UI_design)-设计说明.md) | 战斗 UI 总体设计 |
| [17-战斗场景提案(battle_scene_proposal)-设计说明](./S7_UI与交互基线/17-战斗场景提案(battle_scene_proposal)-设计说明.md) | 战斗场景方案 |
| [21-Spine素材制作工程与导入边界(spine_asset_pipeline)-设计说明](./S7_UI与交互基线/21-Spine素材制作工程与导入边界(spine_asset_pipeline)-设计说明.md) | Spine 素材制作工程与导入边界 |
| [22-主工程与SpineAssets协作规则(game_spine_assets_collaboration)-设计说明](./S7_UI与交互基线/22-主工程与SpineAssets协作规则(game_spine_assets_collaboration)-设计说明.md) | 主工程与 SpineAssets 协作规则 |
| [23-Spine样本bundle导入probe与降级壳(spine_bundle_probe_and_fallback)-设计说明](./S7_UI与交互基线/23-Spine样本bundle导入probe与降级壳(spine_bundle_probe_and_fallback)-设计说明.md) | Spine bundle 导入 probe 与降级壳 |

## 5. 使用规则

1. 新增稳定设计文档时，先判断归属子系统；跨系统主题进入 `00_总纲/`。
2. 子系统主设计保持稳定入口，不在文件名中追加临时时间戳。
3. 临时讨论、验收意见处理、迁移记录、过程分析，不放入本目录；继续进入 `06_过程文档/`。
4. UI 原型、效果图、截图基线、HTML 原型，进入 `08_原型与附图/`，设计说明只引用其正式路径。
5. 测试计划、自测报告、验收清单和验收结论，进入 `05_测试文档/`。
6. 设计说明内部可以保留原 `NN-主题` 文件名，`NN` 只作为历史稳定编号，不再承担全局阅读顺序。
