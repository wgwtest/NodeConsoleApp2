# 流派敌人职责与反制矩阵设计说明

创建时间：2026-05-26

状态：`WBS-3.4.7 当前事实源 / 第三章 P0 敌人生态已落数据`

归属子系统：`S6_敌人系统与编辑器`

关联子系统：

1. `S1_主游戏流程`
2. `S3_关卡地图与编辑器`
3. `S4_技能系统与编辑器`
4. `S5_Buff系统与编辑器`
5. `S7_数据存档与内容契约`

## 1. 目标

本文固定 WBS-3.4.7 的设计事实源，用于把三章 30 关从“已有敌人和技能数据”推进到“可解释、可扩展、可验证的内容生态”。

本阶段不直接调单个伤害数值，不以低 KP 自动玩家 30/30 自然全通作为目标。它先回答四个问题：

1. 玩家技能树当前支持哪些流派。
2. 每个关卡在章节节奏中承担什么职责。
3. 每个敌人和敌人技能制造什么压力。
4. 失败时应优先补敌人、补敌技、换敌人池、调数值，还是补玩家技能树。

## 2. 当前事实基线

当前主分支内容事实：

| 项目 | 当前值 | 设计判断 |
| --- | ---: | --- |
| 正式章节 | 3 | 每章 10 个正式编号关卡 |
| 正式关卡 | 30 | 已具备独立 `levelId` 和敌人池 |
| 敌人模板 | 27 | 第三章 P0 敌人生态已补 4 个章节专属敌人，仍需避免无目标膨胀 |
| 正式关卡实际引用敌人 | 24 | 第三章 `level_3_5` 到 `level_3_8` 已替换旧样本补位；第一、二章仍有旧样本补位 |
| 敌人技能 | 36 | 已新增 4 个第三章压力敌技，但仍需持续补充职责说明 |
| 玩家技能 | 45 | 输出、破甲、防御充足；控制、DOT、治疗续航偏少 |

玩家技能粗分类统计：

| 流派 | 当前数量 | 判断 |
| --- | ---: | --- |
| 输出 | 14 | 数量充足，容易形成默认解 |
| 防御补甲 | 10 | 数量充足，但需要确认是否在学习节奏中可用 |
| 破甲 | 9 | 数量充足，适合第二章护甲主题 |
| 吸血 / 斩杀 | 8 | 数量较多，但多为中后期能力 |
| 治疗续航 | 3 | 数量偏少，第三章持续压迫下需要重点验证 |
| DOT | 3 | 数量偏少，作为高护甲反制和吸血前置需要重点验证 |
| 控制 / 节奏 | 2 | 数量偏少，不足以支撑大量控制型敌人反制 |
| 未归类 | 8 | 需要在技能编辑器或后续矩阵中补语义标签 |

## 3. 玩家流派矩阵

| 流派 | 现有代表技能 | 当前强项 | 当前短板 | 主要反制对象 |
| --- | --- | --- | --- | --- |
| 基础输出 | `skill_heavy_swing`、`skill_double_thrust`、`skill_1770474698976` | 低门槛、通用性强 | 容易成为默认解，遇到护甲和修复会拖长战斗 | 快攻、普通推进关 |
| 破甲 | `skill_skull_cracker`、`skill_shockwave`、`skill_shockwave_copy_1770042951717` | 能处理高护甲和部位防御 | 部分技能 AP 高或中后期解锁 | 护甲守卫、Boss 护甲阶段 |
| 防御补甲 | `skill_block`、`skill_regroup`、`skill_fortify` | 有先手补甲和受击前防御能力 | 长战输出不足，容易被 DOT 慢性消耗 | 快攻、重击、Boss 爆发 |
| 治疗续航 | `skill_heal`、`skill_double_thrust_copy_1770395861178`、`skill_execute_copy_1770044052832` | 能修正低血窗口 | 数量少，部分依赖前置状态或中后期 KP | DOT、持续压迫 |
| DOT | `skill_1771769351059`、`skill_shockwave_copy_1770042951717`、`skill_leftover_lunchbox` | 可对抗高护甲和制造吸血前置 | 数量少，低血互杀风险高 | 高护甲、慢速修复敌人 |
| 控制 / 节奏 | `skill_earthquake`、`skill_loose_shoelaces` | 能打断或拖慢敌人节奏 | 数量明显偏少，且成本偏中高 | 高速敌、蓄力敌、控制敌 |
| 爆发 / 斩杀 | `skill_execute`、`skill_execute_copy_1770043820577` | 适合 Boss 收尾 | 前期铺垫弱，易和治疗窗口冲突 | Boss 收尾、恢复型敌人 |
| 吸血 / 反打 | `skill_execute_copy_1770044052832`、`skill_blood_debt_due` | 能把低血输出转为生存 | 依赖速度、层数或中后期学习 | 终局高压、持续压迫 |

设计结论：

1. 暂不补无条件输出技能。
2. 若第三章持续压迫仍不合理，优先检查治疗续航、DOT、控制 / 节奏三类流派是否在学习路径上可用。
3. 若敌人失败诊断指向“玩家没有任何反制”，才补玩家技能树；否则优先补敌人生态或调整关卡敌人池。

## 4. 敌人职责矩阵

| 职责 | 当前代表敌人 | 设计作用 | 当前问题 | 后续处理 |
| --- | --- | --- | --- | --- |
| 快攻 | `enemy_c1_razor_runner`、`enemy_c2_frost_skirmisher`、`enemy_c3_dusk_runner` | 惩罚无防御和慢速构筑 | 三章都有，但技能组合复用较多 | 后续可为第三章新增更具持续压迫语义的快攻敌 |
| 护甲 | `enemy_c1_barkshield_guard`、`enemy_c2_iceplate_guard`、`enemy_c3_graveplate_guard` | 检验破甲和部位选择 | 第二、三章护甲职责重复 | 第三章护甲敌应加入毒、吸血或反击差异 |
| 防御修复 | `enemy_c1_thorn_mender`、`skeleton_story_repair_guard`、`enemy_c3_plague_caller` | 拉长战斗并检验持续输出 | 旧骷髅样本在第二、三章重复补位 | 用章节专属敌替换旧样本补位 |
| 状态压迫 | `enemy_c3_plague_caller`、`enemy_c3_dusk_runner` | 迫使玩家处理毒、流血、减速 | 第三章状态压力集中在少数敌人 | 扩第三章状态敌，避免只靠 Boss 与门卫 |
| 控制 / 节奏 | `enemy_c2_chill_hexer`、`enemy_c3_graveplate_guard` | 打乱玩家行动顺序 | 玩家控制反制偏少，敌人控制不宜过密 | 先限定控制敌分布，再评估是否补玩家反制 |
| 精英组合 | `orc_berserker_lvl4`、`enemy_c3_twilight_gate_elite` | Boss 前构筑检查 | 第二、三章仍使用旧兽人精英补位 | 新增章节精英替换旧兽人 |
| Boss 机制 | `boss_c1_ruin_bruiser`、`boss_c2_frozen_centurion`、`boss_c3_twilight_bastion` | 收束章节主题 | Boss 技能可用，但阶段感不足 | 后续通过专属敌技和关卡前置提示增强 |

## 5. 30 关节奏矩阵

| 关卡 | 节奏职责 | 当前敌人 | 当前职责 | 问题 |
| --- | --- | --- | --- | --- |
| `level_1_1` | 引入 | `enemy_c1_razor_runner` | 快攻 / 状态 / 控制 | 合理，可作为第一章快攻引入 |
| `level_1_2` | 引入 | `goblin_scout` | 快攻 | 旧样本补位，章节语义弱 |
| `level_1_3` | 第一检查 | `goblin_story_headhunter` | 快攻 / 状态 | 旧样本补位，缺护甲或修复检查 |
| `level_1_4` | 第一检查 | `orc_warrior` | 精英 / 护甲 | 旧样本补位，缺状态或修复变化 |
| `level_1_5` | 组合变化 | `enemy_c1_thorn_mender` | 修复 / 状态 | 合理，但可补护甲协同 |
| `level_1_6` | 组合变化 | `enemy_c1_barkshield_guard` | 护甲 / 修复 / 状态 / 控制 | 合理 |
| `level_1_7` | 高压预演 | `goblin_story_medic` | 修复 | 旧样本补位，强度和职责都不足 |
| `level_1_8` | 高压预演 | `enemy_c1_razor_runner` | 快攻 / 状态 / 控制 | 缺精英或护甲检查 |
| `level_1_9` | 门卫 | `enemy_c1_barkshield_guard` | 护甲 / 修复 / 状态 / 控制 | 缺精英标签和门卫机制 |
| `level_1_10` | Boss | `boss_c1_ruin_bruiser` | Boss / 精英 / 护甲 / 状态 / 控制 | 合理 |
| `level_2_1` | 引入 | `enemy_c2_frost_skirmisher` | 快攻 / 状态 / 控制 | 合理 |
| `level_2_2` | 引入 | `goblin_scout_lvl3` | 快攻 / 修复 / 状态 / 控制 | 旧样本补位，职责过杂 |
| `level_2_3` | 第一检查 | `enemy_c2_iceplate_guard` | 护甲 / 修复 / 状态 / 控制 | 缺精英变化 |
| `level_2_4` | 第一检查 | `orc_berserker_lvl4` | 精英 / 护甲 / 状态 | 旧样本补位 |
| `level_2_5` | 组合变化 | `skeleton_story_repair_guard` | 护甲 / 修复 / 状态 / 控制 | 旧样本补位 |
| `level_2_6` | 组合变化 | `enemy_c2_chill_hexer` | 护甲 / 修复 / 状态 / 控制 | 合理 |
| `level_2_7` | 高压预演 | `skeleton_guard_lvl4` | 护甲 / 修复 / 状态 / 控制 | 旧样本补位，缺精英 |
| `level_2_8` | 高压预演 | `enemy_c2_iceplate_guard` | 护甲 / 修复 / 状态 / 控制 | 重复 2-3，缺精英 |
| `level_2_9` | 门卫 | `orc_berserker_lvl4` | 精英 / 护甲 / 状态 | 旧样本补位，缺本章门卫机制 |
| `level_2_10` | Boss | `boss_c2_frozen_centurion` | Boss / 精英 / 护甲 / 修复 / 状态 / 控制 | 合理 |
| `level_3_1` | 引入 | `enemy_c3_dusk_runner` | 快攻 / 状态 / 控制 | 合理 |
| `level_3_2` | 引入 | `enemy_c3_plague_caller` | 护甲 / 修复 / 状态 / 控制 | 合理，但压力偏复杂 |
| `level_3_3` | 第一检查 | `orc_berserker_lvl5` | 精英 / 护甲 / 状态 | 旧样本补位 |
| `level_3_4` | 第一检查 | `enemy_c3_graveplate_guard` | 护甲 / 修复 / 状态 / 控制 | 缺精英变化 |
| `level_3_5` | 组合变化 | `enemy_c3_blood_rite_acolyte` | 状态 / 流血 / 吸血前置 | 已替换旧样本补位，作为持续压迫中段铺垫 |
| `level_3_6` | 组合变化 | `enemy_c3_mire_chain_jailer` | 护甲 / 状态 / 减速 / 破甲 | 已替换旧样本补位，检查速度管理与部位防御 |
| `level_3_7` | 高压预演 | `enemy_c3_twilight_warden` | 精英 / 护甲 / 修复 | 已替换旧样本补位，承担 Boss 前破甲与续航预演 |
| `level_3_8` | 高压预演 | `enemy_c3_plague_standard_bearer` | 状态 / 修复 / 毒 / 易伤 | 已避免重复 3-2，补充 Boss 前持续损耗压力 |
| `level_3_9` | 门卫 | `enemy_c3_twilight_gate_elite` | 精英 / 护甲 / 修复 / 状态 / 控制 | 合理，后续不应靠伤害阈值硬调 |
| `level_3_10` | Boss | `boss_c3_twilight_bastion` | Boss / 精英 / 护甲 / 修复 / 状态 / 控制 | 合理，但需要 Boss 前信息铺垫 |

## 6. 敌技压力矩阵

| 压力类型 | 当前敌技 | 主要使用敌人 | 玩家反制方向 | 风险 |
| --- | --- | --- | --- | --- |
| 快速小伤 + 流血 | `enemy_skill_rusty_shiv` | 快攻敌 | 先手击杀、补甲、治疗 | 若第三章频繁叠加，治疗流派可能不足 |
| 快速小伤 + 减速 | `enemy_skill_ankle_pebble` | 快攻敌 | 防御补甲、速度管理 | 玩家控制反制偏少 |
| 毒伤 | `enemy_skill_bad_lunchbox`、`enemy_skill_plague_mist_burst` | 状态敌 | 速杀、治疗、净化类技能 | 玩家净化能力需要复核 |
| 敌方治疗 | `enemy_skill_dirty_bandage` | 修复敌 | 爆发、DOT、破甲压制 | 不能和高护甲无限叠加 |
| 护甲修复 | `enemy_skill_bone_patch`、`skill_block` | 护甲 / 修复敌 | 破甲、DOT、爆发窗口 | 第二、三章复用过多 |
| 破甲 + 晕眩 | `enemy_skill_shield_tap`、`enemy_skill_orc_headbutt` | 护甲 / Boss | 防御补甲、速度管理 | 玩家控制反制少，分布需谨慎 |
| 重击 | `enemy_skill_wrecking_swing`、`enemy_skill_centurion_wrecking_swing`、`enemy_skill_twilight_bastion_swing` | Boss | 先手防御、治疗、吸血反打 | 不应靠微调 `30 -> 26` 解决 |
| 门卫重压 | `enemy_skill_twilight_gate_crush` | `level_3_9` | 防御补甲、治疗续航、破甲推进 | 作为门卫检查合理，但需 Boss 前铺垫 |
| 吸血姿态 | `enemy_skill_blood_heat` | 精英 / Boss | 爆发、控制、状态处理 | 若无提示会显得不可解释 |

## 7. 缺口清单

### 7.1 优先级 P0

1. 第三章 `level_3_5 / level_3_6 / level_3_7 / level_3_8` 的旧样本补位已完成首轮替换。
2. `level_3_7` 已由 `enemy_c3_twilight_warden` 承担高压预演，但是否需要更明确的蓄力提示仍待浏览器诊断。
3. 第三章 `level_3_8` 已避免重复 `enemy_c3_plague_caller`，后续需要观察毒、易伤和修复组合是否过密。
4. 玩家控制 / 节奏技能只有 2 个，若第三章继续堆减速、晕眩和节奏压迫，需要谨慎验证是否缺反制。

### 7.2 优先级 P1

1. 第二章 `level_2_7 / level_2_8 / level_2_9` 重复护甲压力和旧样本补位，门卫语义不足。
2. 第一章 `level_1_7 / level_1_8 / level_1_9` 的高压和门卫职责不够明确。
3. 旧样本敌人可以保留为早期教学或回归样本，但不应长期承担章节高压、门卫和 Boss 前检查。

### 7.3 暂不处理

1. 不新增无条件高伤害玩家技能。
2. 不把第三章失败直接归因于单个敌技数值。
3. 不把自动玩家策略写成复杂专用 AI 来掩盖设计缺口。

## 8. 内容实现建议

### 8.1 第三章优先补 4 个敌人

| 敌人 | 使用位置 | 职责 | 敌技 | 状态 |
| --- | --- | --- | --- | --- |
| `enemy_c3_blood_rite_acolyte` | `level_3_5` | DOT + 吸血前置 | `enemy_skill_blood_rite_cut` | 已落数据 |
| `enemy_c3_mire_chain_jailer` | `level_3_6` | 控制 / 节奏 + 护甲 | `enemy_skill_mire_chain_drag` | 已落数据 |
| `enemy_c3_twilight_warden` | `level_3_7` | 高压预演精英 | `enemy_skill_twilight_warden_bulwark` | 已落数据 |
| `enemy_c3_plague_standard_bearer` | `level_3_8` | 状态 + 防御修复组合 | `enemy_skill_plague_standard_wave` | 已落数据 |

### 8.2 第二章后段再补 2 个敌人

| 建议敌人 | 替换 / 使用位置 | 职责 |
| --- | --- | --- |
| `enemy_c2_frostbone_mender` | `level_2_7` | 护甲修复精英 |
| `enemy_c2_gatebreaker_knight` | `level_2_9` | 第二章门卫 |

### 8.3 第一章只做轻量替换

第一章已经承担教学职责，不宜过度复杂化。后续只需把 `level_1_7 / level_1_9` 的旧样本补位替换为章节语义明确的修复敌和门卫敌。

## 9. 验收口径

矩阵完成后的内容实现必须满足：

1. 第三章正式关卡不再使用第一、二章旧样本承担高压、门卫或 Boss 前检查。
2. 每个新增敌人至少有 2 个技能，精英至少 3 个技能。
3. 每个新增敌技都能映射到一个压力类型和一个玩家反制方向。
4. 自动试玩失败必须先落入矩阵诊断，不直接触发数值下调。
5. 若玩家控制、治疗或 DOT 反制不足，必须先证明现有技能树无法覆盖，再补玩家技能。

## 10. 下一步

推荐实施顺序：

1. 已完成第三章 4 个敌人模板及对应敌技草案。
2. 已替换 `level_3_5 / level_3_6 / level_3_7 / level_3_8` 敌人池。
3. 跑内容契约和模拟器报告，观察是否出现无反制失败。
4. 再决定是否补第二章后段敌人。
5. 最后基于真实浏览器诊断调整难度。
