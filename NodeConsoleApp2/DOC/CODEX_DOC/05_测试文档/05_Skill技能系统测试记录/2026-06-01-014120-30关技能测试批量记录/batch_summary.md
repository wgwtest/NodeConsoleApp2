# 30 关技能测试批量记录

- 时间戳：2026-06-01-014120
- 敌人选择：每关使用关卡原始敌人
- 覆盖敌人：30 种
- KP 模式：assumed_per_level
- AP 预算：5
- 击杀关卡：30/30
- 平均最佳评分：99.83
- 构筑枚举上限：80
- 候选输出上限：10

## 结论

- 全部 30 个关卡的最佳候选都能击杀各关卡原始敌人。
- 第 1 关开始出现可击杀目标敌人的候选循环。
- 28 个关卡达到 maxBuilds=80 的构筑枚举检查阈值，最早从 1-3 开始；这些关卡需要谨慎区分“当前采样最佳”和“全量空间最佳”。
- 30 个关卡达到 maxCandidates=10 的候选输出上限，候选表只保留评分靠前的循环。
- 击杀回合稳定为 3 回合。
- 最佳评分从第 1 关的 102 下降到第 30 关的 96，说明当前评分排序未必只反映 KP 增长带来的强度提升。

## 关卡总表

| 关卡 | 节点 | 敌人 | KP | 构筑数 | 候选数 | 最佳评分 | 击杀 | 击杀回合 | 终局 HP | AP |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| 1 | 1-1 | enemy_v2_c1_01_razor_initiate | 8 | 30 | 10 | 102 | 是 | 3 | 0 | 5 |
| 2 | 1-2 | enemy_v2_c1_02_path_cutthroat | 11 | 54 | 10 | 102 | 是 | 3 | 0 | 5 |
| 3 | 1-3 | enemy_v2_c1_03_canopy_bleeder | 14 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 4 | 1-4 | enemy_v2_c1_04_telegraph_bruiser | 17 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 5 | 1-5 | enemy_v2_c1_05_thorn_mender | 20 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 6 | 1-6 | enemy_v2_c1_06_barkshield_guard | 23 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 7 | 1-7 | enemy_v2_c1_07_field_medic | 26 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 8 | 1-8 | enemy_v2_c1_08_bramble_counter | 29 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 9 | 1-9 | enemy_v2_c1_09_bark_gate_elite | 32 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 10 | 1-10 | boss_v2_c1_10_ruin_bruiser | 35 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 11 | 2-1 | enemy_v2_c2_01_frost_skirmisher | 38 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 12 | 2-2 | enemy_v2_c2_02_frost_blood_raider | 41 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 13 | 2-3 | enemy_v2_c2_03_iceplate_guard | 44 | 80 | 10 | 102 | 是 | 3 | 0 | 5 |
| 14 | 2-4 | enemy_v2_c2_04_canyon_breaker | 47 | 80 | 10 | 101 | 是 | 3 | 0 | 5 |
| 15 | 2-5 | enemy_v2_c2_05_frostbone_mender | 50 | 80 | 10 | 100 | 是 | 3 | 0 | 5 |
| 16 | 2-6 | enemy_v2_c2_06_chill_hexer | 53 | 80 | 10 | 100 | 是 | 3 | 0 | 5 |
| 17 | 2-7 | enemy_v2_c2_07_rotplate_guard | 56 | 80 | 10 | 100 | 是 | 3 | 0 | 5 |
| 18 | 2-8 | enemy_v2_c2_08_ice_counter_sentinel | 59 | 80 | 10 | 99 | 是 | 3 | 0 | 5 |
| 19 | 2-9 | enemy_v2_c2_09_gatebreaker_knight | 62 | 80 | 10 | 99 | 是 | 3 | 0 | 5 |
| 20 | 2-10 | boss_v2_c2_10_frozen_centurion | 65 | 80 | 10 | 98 | 是 | 3 | 0 | 5 |
| 21 | 3-1 | enemy_v2_c3_01_dusk_runner | 68 | 80 | 10 | 98 | 是 | 3 | 0 | 5 |
| 22 | 3-2 | enemy_v2_c3_02_plague_caller | 71 | 80 | 10 | 98 | 是 | 3 | 0 | 5 |
| 23 | 3-3 | enemy_v2_c3_03_twilight_reaver | 74 | 80 | 10 | 98 | 是 | 3 | 0 | 5 |
| 24 | 3-4 | enemy_v2_c3_04_graveplate_bastion | 77 | 80 | 10 | 97 | 是 | 3 | 0 | 5 |
| 25 | 3-5 | enemy_v2_c3_05_blood_rite_acolyte | 80 | 80 | 10 | 97 | 是 | 3 | 0 | 5 |
| 26 | 3-6 | enemy_v2_c3_06_mire_chain_jailer | 83 | 80 | 10 | 97 | 是 | 3 | 0 | 5 |
| 27 | 3-7 | enemy_v2_c3_07_twilight_warden | 86 | 80 | 10 | 97 | 是 | 3 | 0 | 5 |
| 28 | 3-8 | enemy_v2_c3_08_plague_standard | 89 | 80 | 10 | 97 | 是 | 3 | 0 | 5 |
| 29 | 3-9 | enemy_v2_c3_09_twilight_gate_elite | 92 | 80 | 10 | 97 | 是 | 3 | 0 | 5 |
| 30 | 3-10 | boss_v2_c3_10_twilight_bastion | 95 | 80 | 10 | 96 | 是 | 3 | 0 | 5 |

## 原始数据

每关的原始 JSON 记录保存在 `levels/*/report.json`，包含候选构筑、循环组合、逐回合回放和发现项。
