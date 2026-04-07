# 设计说明 README

最后整理时间：2026-04-07

状态：`当前有效 / 已完成 design 目录迁移与命名规范化`

## 1. 说明

本目录是 `NodeConsoleApp2` 的正式设计文档区。

原设计目录中的稳定文档已整体迁入 `DOC/CODEX_DOC/02_设计说明/`，并在本轮进一步统一为以下命名规则：

1. `NN-中文主题(英文slug)-设计说明.md`
2. `NN` 用于固定阅读顺序和引用顺序
3. 中文主题用于人工快速识别
4. 英文 slug 保留原始主题标识，便于程序化检索和跨文档引用

## 2. 阅读顺序建议

1. 引擎与数据边界：
   - `01-核心引擎(core_engine)-设计说明.md`
   - `02-数据结构(data_design)-设计说明.md`
   - `18-本地存档(local_save_design)-设计说明.md`
2. 战斗系统与运行时设计：
   - `03-技能系统(skill_design)-设计说明.md`
   - `09-Buff系统(buff_design)-设计说明.md`
   - `11-敌人系统(enemy_design)-设计说明.md`
   - `12-关卡系统(level_design)-设计说明.md`
   - `19-关卡选择内容元数据(level_select_content)-设计说明.md`
   - `13-道具系统(item_design)-设计说明.md`
3. 作者工具与验证设计：
   - `04-技能编辑器(skill_editor_design)-设计说明.md`
   - `05-技能规划(skill_planning_design)-设计说明.md`
   - `06-技能平衡(skill_balance_design)-设计说明.md`
   - `07-技能测试(skill_test_design)-设计说明.md`
   - `08-技能头脑风暴(skill_design_brainStorm)-设计说明.md`
   - `10-Buff编辑器(buff_editor_design)-设计说明.md`
4. 界面与表现：
   - `14-时间线机制(timeline_design)-设计说明.md`
   - `15-时间线界面(timeline_UI_design)-设计说明.md`
   - `16-战斗界面(UI_design)-设计说明.md`
   - `17-战斗场景提案(battle_scene_proposal)-设计说明.md`
   - `20-对战演出与动画展示层(battle_presentation)-设计说明.md`
   - `21-Spine素材制作工程与导入边界(spine_asset_pipeline)-设计说明.md`
   - `22-主工程与SpineAssets协作规则(game_spine_assets_collaboration)-设计说明.md`

## 3. 设计文档清单

| 编号 | 文件 | 主题 |
| --- | --- | --- |
| `01` | `01-核心引擎(core_engine)-设计说明.md` | 核心引擎设计 |
| `02` | `02-数据结构(data_design)-设计说明.md` | 数据结构与配置设计 |
| `03` | `03-技能系统(skill_design)-设计说明.md` | 技能体系设计 |
| `04` | `04-技能编辑器(skill_editor_design)-设计说明.md` | 技能编辑器设计 |
| `05` | `05-技能规划(skill_planning_design)-设计说明.md` | 技能规划设计 |
| `06` | `06-技能平衡(skill_balance_design)-设计说明.md` | 技能平衡设计 |
| `07` | `07-技能测试(skill_test_design)-设计说明.md` | 技能测试设计 |
| `08` | `08-技能头脑风暴(skill_design_brainStorm)-设计说明.md` | 技能思路补充与脑暴记录 |
| `09` | `09-Buff系统(buff_design)-设计说明.md` | Buff 体系设计 |
| `10` | `10-Buff编辑器(buff_editor_design)-设计说明.md` | Buff 编辑器设计 |
| `11` | `11-敌人系统(enemy_design)-设计说明.md` | 敌人设计 |
| `12` | `12-关卡系统(level_design)-设计说明.md` | 关卡设计 |
| `13` | `13-道具系统(item_design)-设计说明.md` | 道具设计 |
| `14` | `14-时间线机制(timeline_design)-设计说明.md` | 时间线机制设计 |
| `15` | `15-时间线界面(timeline_UI_design)-设计说明.md` | 时间线 UI 设计 |
| `16` | `16-战斗界面(UI_design)-设计说明.md` | UI 总体设计 |
| `17` | `17-战斗场景提案(battle_scene_proposal)-设计说明.md` | 战斗场景方案设计 |
| `18` | `18-本地存档(local_save_design)-设计说明.md` | 本地存档生命周期与触发机制设计 |
| `19` | `19-关卡选择内容元数据(level_select_content)-设计说明.md` | story 关卡选择信息与内容元数据设计 |
| `20` | `20-对战演出与动画展示层(battle_presentation)-设计说明.md` | 战斗展示层、动画驱动与 probe 页设计 |
| `21` | `21-Spine素材制作工程与导入边界(spine_asset_pipeline)-设计说明.md` | Spine 独立素材工程、导入边界与可行性分析 |
| `22` | `22-主工程与SpineAssets协作规则(game_spine_assets_collaboration)-设计说明.md` | 主工程侧双仓库协作规则、消费边界与降级策略 |

## 4. 当前使用规则

1. 运行时、编辑器、测试页中的设计引用，统一使用 `DOC/CODEX_DOC/02_设计说明/...` 的仓库相对路径。
2. 设计文档作为稳定说明层，不在文件名中编码“当前阶段”语义。
3. 新增设计文档时，优先延续 `NN-中文主题(英文slug)-设计说明.md` 的命名规则。
4. 设计探索过程、迁移过程和讨论材料，不放入本目录，统一进入 `06_过程文档/`。

## 5. 本轮迁移与命名证据

1. [design文档迁移结果清单](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/2026-04-03-232418-design文档迁移结果清单.md)
2. [设计说明命名规范化记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/2026-04-03-235606-设计说明命名规范化记录.md)
3. [设计说明命名规范化自测报告](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-03-235606-设计说明命名规范化自测报告.md)
