# 敌人设计 V2 机制映射与迁移表

创建时间：2026-05-30

状态：`设计迁移表 / 待落实到 enemies.json 与敌人编辑器诊断`

归属子系统：`S6_敌人系统与编辑器`

关联文档：

1. [敌人成长与机制模型](./32-敌人成长与机制模型(enemy_growth_mechanic_model)-设计说明.md)
2. [三章敌人机制池与数值带](./33-三章敌人机制池与数值带(enemy_mechanic_roster_model)-设计说明.md)
3. [流派敌人职责与反制矩阵](./31-流派敌人职责与反制矩阵(content_counter_matrix)-设计说明.md)
4. [战斗数值基准模型](../00_总纲/03-战斗数值基准模型(combat_numeric_baseline)-设计说明.md)

## 1. 文档目标

本文把三章 30 个正式关卡的当前主敌，迁移到机制优先的敌人设计 V2。

本迁移表不先讨论敌人名字、种族、剧情或文学包装。每一行只回答：

1. 当前关卡使用哪个敌人。
2. 当前 HP 和护甲预算是多少。
3. V2 应落到哪个机制槽位。
4. 建议 HP 和护甲预算是多少。
5. 敌人的意图循环是什么。
6. 它检查玩家哪类构筑能力。
7. 当前数据应该保留、调参、拆分还是替换。

本文只落设计迁移口径，不直接修改 `assets/data/enemies.json`。

## 2. 迁移原则

1. 先定机制槽位，再决定是否沿用当前敌人模板。
2. 同一个敌人模板不应同时服务第二章和第三章的不同量级；跨章复用模板应拆分。
3. 第三章正式主敌不再使用 `50-150 HP` 的旧样本量级。
4. Boss 和精英不只提高 HP，必须补意图循环、软时间限制、脆弱窗口或构筑偏科检查。
5. 普通敌人可以机制简单，但必须有明确的失败诊断。
6. 关键高压行为必须能被意图展示、倒计时、阶段提示或战斗日志解释。

## 3. 迁移字段

| 字段 | 说明 |
| --- | --- |
| 当前 HP/甲 | 当前 `stats.hp` 与部位护甲 current 合计 |
| V2 槽位 | 来自 `33-三章敌人机制池与数值带` 的机制槽位 |
| 建议 HP/甲 | 第一版迁移建议值，不是最终平衡定稿 |
| 意图循环 | 敌人大致行为节奏，用于后续 `intentModel` |
| 构筑检查 | 玩家需要什么能力才能稳定应对 |
| 迁移动作 | 保留、调参、拆分、替换、重做技能或补 Boss 阶段 |

## 4. 第一章迁移表

第一章保留教学定位。HP 只做轻中度提高，重点是补足意图展示和机制区分，避免同一个快攻敌重复承担多个关卡。

| 关卡 | 当前敌人 | 当前 HP/甲 | V2 槽位 | 建议 HP/甲 | 意图循环 | 构筑检查 | 迁移动作 |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| `1-1` | `enemy_c1_razor_runner` | 58/11 | `C1-M01` 快攻引入 | 70/10 | `attack -> bleed -> attack` | 低 AP 防御、先手击杀 | 轻调参，保留教学快攻 |
| `1-2` | `goblin_scout` | 50/5 | `C1-M02` 纯血基础 | 115/20 | `attack -> attack -> rest` | 稳定输出 | 旧样本转纯血基础或替换为新模板 |
| `1-3` | `goblin_story_headhunter` | 65/16 | `C1-M06` DOT 引入 | 90/20 | `bleed -> attack -> attack` | 治疗、速杀 | 保留机制，补可见流血意图 |
| `1-4` | `orc_warrior` | 74/46 | `C1-M03` 纯攻基础 | 105/35 | `telegraph -> heavy_attack -> recover` | 格挡、补甲、打断 | 去掉精英语义，改成纯攻检查 |
| `1-5` | `enemy_c1_thorn_mender` | 78/21 | `C1-M05` 轻修复 | 105/40 | `attack -> repair -> poison` | 爆发窗口、DOT | 保留，补修复冷却 |
| `1-6` | `enemy_c1_barkshield_guard` | 96/66 | `C1-M04` 弱点护甲 | 115/90 | `guard -> attack -> guard` | 部位选择、破甲 | 保留，强化弱点部位说明 |
| `1-7` | `goblin_story_medic` | 70/12 | `C1-M07` 控制引入 | 100/30 | `slow -> attack -> heal` | 速度管理、低 AP 技能 | 旧医护模板调成控制/治疗入门 |
| `1-8` | `enemy_c1_razor_runner` | 58/11 | `C1-M08` 反击姿态引入 | 120/55 | `stance -> counter -> recover` | 读提示、停手、破姿态 | 不复用 1-1 快攻，建议替换或拆新模板 |
| `1-9` | `enemy_c1_barkshield_guard` | 96/66 | `C1-M09` 第一章精英 | 180/110 | `guard -> heavy_attack -> repair` | 防御 + 破甲 | 从普通护甲敌拆出门卫精英版本 |
| `1-10` | `boss_c1_ruin_bruiser` | 210/138 | `C1-M10` 第一章 Boss | 300/160 | `pressure -> guard -> exposed -> heavy` | 基础防御、弱点窗口 | 保留 Boss，补两阶段和脆弱窗口 |

第一章关键改动：

1. `enemy_c1_razor_runner` 不应同时承担 `1-1` 和 `1-8`；`1-8` 应改为反击姿态教学。
2. `enemy_c1_barkshield_guard` 不应同时承担普通护甲和门卫精英；`1-9` 应拆精英版本。
3. 第一章 Boss 当前粗耐久尚可，但缺阶段和意图循环。

## 5. 第二章迁移表

第二章进入 `200-300 HP` 标准量级，重点是护甲、修复、控制和软时间限制。

| 关卡 | 当前敌人 | 当前 HP/甲 | V2 槽位 | 建议 HP/甲 | 意图循环 | 构筑检查 | 迁移动作 |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| `2-1` | `enemy_c2_frost_skirmisher` | 82/28 | `C2-M01` 进阶快攻 | 190/45 | `slow -> attack -> attack` | 速度管理、先手防御 | 大幅调 HP，保留快攻定位 |
| `2-2` | `goblin_scout_lvl3` | 60/20 | `C2-M02` 纯血标准 | 270/60 | `attack -> attack -> attack` | 持续输出、DOT | 旧样本不合适，建议替换为纯血标准模板 |
| `2-3` | `enemy_c2_iceplate_guard` | 145/160 | `C2-M04` 护甲墙 | 250/220 | `guard -> slow -> attack` | 破甲、部位选择 | 保留，提升 HP 和护甲预算 |
| `2-4` | `orc_berserker_lvl5` | 200/110 | `C2-M03` 纯攻压迫 | 240/80 | `telegraph -> heavy_attack -> recover` | 格挡、补甲、打断 | 拆出第二章纯攻版本，避免与第三章共用 |
| `2-5` | `skeleton_story_repair_guard` | 100/118 | `C2-M05` 修复守卫 | 260/160 | `attack -> repair -> guard` | 爆发、DOT、打断 | 拆第二章修复版本 |
| `2-6` | `enemy_c2_chill_hexer` | 108/56 | `C2-M06` 控制术式 | 230/70 | `slow -> poison -> attack` | 速度管理、状态处理 | 保留，补确定性控制冷却 |
| `2-7` | `skeleton_guard_lvl4` | 100/150 | `C2-M07` 绕甲 DOT | 230/110 | `poison -> armor_attack -> poison` | 治疗、净化、速杀 | 旧护甲样本改成 DOT/绕甲检查，或替换 |
| `2-8` | `enemy_c2_iceplate_guard` | 145/160 | `C2-M08` 防御反击 | 280/140 | `stance -> counter -> slow` | 读提示、破甲、停手 | 不复用 2-3 护甲墙，建议拆反击版本 |
| `2-9` | `orc_berserker_lvl5` | 200/110 | `C2-M09` 第二章精英 | 370/210 | `guard -> heavy_attack -> lifesteal` | 防御 + 爆发窗口 | 拆第二章门卫精英版本 |
| `2-10` | `boss_c2_frozen_centurion` | 210/202 | `C2-M10` 第二章 Boss | 520/280 | `armor_phase -> control_phase -> exposed -> burst` | 破甲、速度管理、窗口爆发 | 大幅重做 Boss 数值与阶段 |

第二章关键改动：

1. `goblin_scout_lvl3` 的 `60 HP` 不适合继续作为第二章正式主敌。
2. `orc_berserker_lvl5` 当前同时服务第二、三章，必须拆分。
3. `enemy_c2_iceplate_guard` 当前重复出现在 `2-3 / 2-8`，V2 中应分别承担护甲墙和反击姿态。
4. 第二章 Boss 当前 HP 偏低，和章节终局定位不匹配。

## 6. 第三章迁移表

第三章进入构筑考试。标准敌主带应接近或超过 `500 HP`，但仍按机制分配，不做无脑血量堆叠。

| 关卡 | 当前敌人 | 当前 HP/甲 | V2 槽位 | 建议 HP/甲 | 意图循环 | 构筑检查 | 迁移动作 |
| --- | --- | ---: | --- | ---: | --- | --- | --- |
| `3-1` | `enemy_c3_dusk_runner` | 52/36 | `C3-M01` 高速持续压迫 | 380/90 | `bleed -> attack -> slow` | 低 AP 防御、治疗、速杀 | 当前 HP 严重偏低，大幅调参 |
| `3-2` | `enemy_c3_plague_caller` | 132/72 | `C3-M06` DOT 引擎 | 500/110 | `poison -> vulnerable -> attack` | 治疗、净化、速杀 | 保留机制，重做 HP 与 DOT 节奏 |
| `3-3` | `orc_berserker_lvl5` | 200/110 | `C3-M02` 纯血高标准 | 620/90 | `attack -> attack -> heavy` | 完整输出循环、DOT、终结 | 不再复用第二章兽人，建议替换纯血高模板 |
| `3-4` | `enemy_c3_graveplate_guard` | 172/194 | `C3-M04` 重甲堡垒 | 560/320 | `guard -> repair -> exposed` | 破甲、弱点攻击、绕甲 | 保留，重做为第三章重甲标准 |
| `3-5` | `enemy_c3_blood_rite_acolyte` | 118/58 | `C3-M08` Buff 读取 / 标记兑现 | 560/140 | `mark -> pressure -> cash_out` | 清状态、阻止铺垫、窗口爆发 | 机制很好，数值严重偏低 |
| `3-6` | `enemy_c3_mire_chain_jailer` | 150/122 | `C3-M07` 节奏控制 | 500/150 | `slow -> armor_attack -> stun_or_bind` | 速度管理、预防性防御 | 保留，补控制冷却和意图 |
| `3-7` | `enemy_c3_twilight_warden` | 188/192 | `C3-M05` 修复引擎 | 580/200 | `guard -> repair -> punish` | 爆发、DOT、阻止修复 | 从精英降为修复引擎，或另拆精英版 |
| `3-8` | `enemy_c3_plague_standard_bearer` | 142/84 | `C3-M06` DOT + 易伤变体 | 540/140 | `vulnerable -> poison -> pressure` | 治疗、净化、速杀 | 保留，避免与 3-2 完全重复 |
| `3-9` | `enemy_c3_graveplate_guard` | 172/194 | `C3-M09` 第三章精英 | 760/300 | `guard -> repair -> control -> burst` | 破甲 + 爆发 + 状态处理 | 不复用 3-4，拆门卫精英版本 |
| `3-10` | `boss_c3_twilight_bastion` | 320/252 | `C3-M10` 第三章 Boss | 1050/430 | `setup -> pressure -> exposed -> terminal` | Buff 管理、窗口爆发、续航 | 大幅重做 Boss 阶段和 HP |

第三章关键改动：

1. `3-1` 当前 `52 HP` 明显不成立，不能作为第三章正式主敌。
2. `3-5` 的“血礼/标记/吸血前置”方向有价值，应升级为标记兑现机制敌。
3. `3-9` 不应复用 `3-4` 的普通重甲模板，应拆成第三章门卫精英。
4. 第三章 Boss 应成为完整构筑考试，当前 `320 HP / 252 甲` 更像第二章 Boss。

## 7. 模板拆分清单

| 当前模板 | 问题 | V2 处理 |
| --- | --- | --- |
| `enemy_c1_razor_runner` | 同时用于 `1-1` 和 `1-8`，机制重复 | `1-1` 保留快攻，`1-8` 新建反击姿态模板 |
| `enemy_c1_barkshield_guard` | 同时用于普通护甲和门卫 | 拆 `c1_armor_guard` 与 `c1_gate_elite` |
| `goblin_scout_lvl3` | 第二章正式主敌 HP 过低 | 替换为 `C2-M02` 纯血标准模板 |
| `orc_berserker_lvl5` | 同时服务第二章和第三章 | 拆第二章纯攻/精英版本，第三章不直接复用 |
| `skeleton_story_repair_guard` | 同时服务第二章和第三章 | 第二章保留修复守卫，第三章使用更高量级修复引擎 |
| `enemy_c2_iceplate_guard` | `2-3 / 2-8` 重复定位 | 拆护甲墙和防御反击两个机制 |
| `enemy_c3_graveplate_guard` | `3-4 / 3-9` 重复定位 | `3-4` 普通重甲，`3-9` 门卫精英 |

## 8. V2 敌人行为字段建议

后续落实到数据时，建议每个正式主敌至少补以下字段。第一阶段可以作为编辑器派生摘要，不要求立即进入运行时。

```json
{
  "mechanicProfile": {
    "slotId": "C3-M08",
    "primaryRole": "buff_window",
    "targetTurns": [7, 10],
    "hpBand": [500, 650],
    "armorBudget": [100, 180],
    "counterTags": ["cleanse", "prevent_setup", "burst_window"],
    "failureSignal": "玩家未处理标记，在兑现回合受到爆发"
  },
  "intentModel": {
    "visible": true,
    "pattern": ["mark", "pressure", "cash_out"],
    "telegraphText": "正在准备兑现标记"
  },
  "softTimer": {
    "type": "cash_out",
    "cashOutTurn": 3,
    "counterWindow": [1, 2]
  },
  "buildCheck": {
    "punishAxis": ["no_cleanse", "no_burst", "slow_build"],
    "expectedCounter": ["cleanse", "burst_window", "prevent_setup"]
  }
}
```

## 9. 落地顺序

推荐分四步落地：

1. 文档确认
   - 先确认本表的机制槽位和三章 HP/护甲量级。
2. 数据迁移
   - 修改或拆分 `assets/data/enemies.json` 中的正式主敌。
   - 不先改所有旧样本，只处理 30 个正式关卡引用链。
3. 敌技调整
   - 按 `intentModel.pattern` 补敌技或调整敌技 AP、Buff、冷却和提示。
4. 编辑器诊断
   - 敌人编辑器展示机制槽位、HP 带、护甲预算、意图循环、软时间限制和构筑检查。

## 10. 验收口径

V2 数据迁移完成后，应满足：

1. 30 个正式关卡都有机制槽位。
2. 第二章标准敌主带进入 `200-300 HP`。
3. 第三章正式主敌不再出现 `50-150 HP` 量级。
4. 第二章和第三章不再共用同一个敌人模板来承担不同章节量级。
5. 每章至少有一个纯血、纯攻、护甲、修复、状态或控制检查点。
6. 每个精英和 Boss 都能说明它检查哪类构筑偏科。
7. 关键高压行为能通过意图、倒计时、阶段提示或日志提示解释。

