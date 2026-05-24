# S8 UI 与交互基线设计说明

最后整理时间：2026-05-21

状态：`当前有效`

## 1. 子系统范围

本子系统负责 UI 基线、交互规则、模态语义、视觉验收视口、时间线界面、战斗场景提案、Spine 素材制作与展示协作。

## 2. 当前文档

| 文件 | 主题 |
| --- | --- |
| [15-时间线界面(timeline_UI_design)-设计说明](./15-时间线界面(timeline_UI_design)-设计说明.md) | 时间线 UI 设计 |
| [16-战斗界面(UI_design)-设计说明](./16-战斗界面(UI_design)-设计说明.md) | 战斗 UI 总体设计 |
| [17-战斗场景提案(battle_scene_proposal)-设计说明](./17-战斗场景提案(battle_scene_proposal)-设计说明.md) | 战斗场景方案 |
| [21-Spine素材制作工程与导入边界(spine_asset_pipeline)-设计说明](./21-Spine素材制作工程与导入边界(spine_asset_pipeline)-设计说明.md) | Spine 素材制作工程与导入边界 |
| [22-主工程与SpineAssets协作规则(game_spine_assets_collaboration)-设计说明](./22-主工程与SpineAssets协作规则(game_spine_assets_collaboration)-设计说明.md) | 主工程与 SpineAssets 协作规则 |
| [23-Spine样本bundle导入probe与降级壳(spine_bundle_probe_and_fallback)-设计说明](./23-Spine样本bundle导入probe与降级壳(spine_bundle_probe_and_fallback)-设计说明.md) | Spine bundle 导入 probe 与降级壳 |

## 3. 归属规则

1. 通用模态规则、页面视觉基线、1920x1080 验收视口、交互语言归入本子系统。
2. 单个子系统的业务数据和行为规则不放在本子系统。
3. 原型包、截图和附图进入 `08_原型与附图/`，本子系统只记录正式引用关系。
