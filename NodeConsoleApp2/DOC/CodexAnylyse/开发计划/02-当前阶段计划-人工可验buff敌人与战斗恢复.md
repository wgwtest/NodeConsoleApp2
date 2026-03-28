# 当前阶段计划：人工可验的 Buff / 敌人行为 / 战斗恢复

创建时间：2026-03-28 09:16

状态：`已审定，执行中；从属于总体研发计划阶段 A`

## 1. 计划目标

这份计划不是泛泛的“后续方向”，而是从属于总体研发计划阶段 A 的可执行阶段计划，目标有三个：

1. 把当前仅能由自动回归证明的 Buff / 敌人策略行为，逐步转成可人工点击验收
2. 在不破坏 `mock_ui_v11.html` 主流程基线的前提下，扩展真实战斗样本
3. 补上战斗中保存 -> 刷新 -> 继续战斗这一条高风险主链路

与总计划的关系：

1. 上位文档是 [01-总体研发计划-从战斗原型到可交付游戏](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/开发计划/01-总体研发计划-从战斗原型到可交付游戏.md)
2. 本文聚焦总计划中的阶段 A：战斗竖切闭环
3. 当前阶段完成后，后续阶段计划应继续从总计划阶段 B 起承接

## 2. 当前基线

截至已推送提交 `e3b6c25`，当前已确认的基线如下：

1. `mock_ui_v11.html` 主流程可稳定进入战斗、规划、执行、进入下一回合
2. 多选技能部署与执行已有真实页面证据
3. 下列行为已有自动回归证据：
   - `PREVENT_DAMAGE_HP`
   - `PREVENT_DAMAGE_ARMOR`
   - `HEAL_ARMOR`
   - 敌人受损修甲
   - 敌人低血量回血
4. 当前仍缺：
   - 上述行为的人工可点击验收入口
   - 防御/恢复型敌人的真实关卡接入
   - 战斗中存档恢复验收

## 3. 核心原则

### 3.1 不破坏当前默认主流程

当前用户已接受的主流程基线是：

1. `开始冒险`
2. `关卡选择`
3. 进入唯一关卡
4. 战斗规划
5. `提交规划`
6. `执行`
7. 自动进入下一回合

因此后续扩展遵循：

1. 不轻易把默认入口改成复杂多分支
2. 如需增加人工验收能力，优先增加“验收样本入口”或“验收专用技能”，而不是破坏当前唯一基线

### 3.2 先让行为可验，再继续扩行为

当前真正的阻塞，不是“代码写不出来”，而是“人工无法逐项确认”。

所以后续顺序必须是：

1. 先补人工验收入口
2. 再扩更多 Buff / 敌人行为
3. 最后补战斗恢复

### 3.3 继续沿用工程策略

每一轮切片都必须产出：

1. 自测报告
2. 验收清单
3. 会话交接记录

文档目录仍使用：

- `DOC/CodexAnylyse/`

## 4. 计划总览

建议按四个阶段执行。

### 阶段 1：补人工验收入口

目标：

- 让 `HP免伤 / 护甲免伤 / 受击获甲 / 敌人修甲 / 敌人回血` 至少有一条可人工点击复现的路径

输出：

- `mock_ui_v11.html` 中可用于人工验收的技能/关卡入口
- 一份新的人工验收清单

### 阶段 2：扩展 Buff 主流程样本

目标：

- 让 Buff 不只是“运行时通过”，而是“在主流程中能学、能放、能执行、能观察结果”

输出：

- 至少 2 条可真实触发的 Buff 主流程样本

### 阶段 3：扩展敌人真实行为样本

目标：

- 让真实关卡中的敌人不再只有 `skill_bite`
- 至少出现 3 类真实可观察的敌人选择逻辑

输出：

- 防御型 / 恢复型 / 追击型敌人样本

### 阶段 4：补战斗恢复链路

目标：

- 支持战斗中保存 -> 刷新 -> 恢复后继续战斗

输出：

- 读档恢复自动回归
- 一条真实页面恢复链路

## 5. 分阶段详细计划

## 阶段 1：补人工验收入口

### 5.1 目标

解决你刚刚指出的核心问题：

- 验收清单里有些项只能靠自动回归证明，不能手工点出来

这一阶段结束后，至少以下能力要有人工入口：

1. `HP免伤`
2. `护甲免伤`
3. `受击获甲`
4. 敌人受损修甲
5. 敌人低血量回血

### 5.2 计划改动文件

- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/mock_ui_v11.html`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/skills_melee_v4_5.json`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/enemies.json`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/levels.json`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/engine/DataManagerV2.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/ui/UI_SystemModal.js`

### 5.3 实施方案

建议不要直接污染当前默认唯一关卡，而是新增一个“验收样本关卡”。

建议新增：

1. `level_1_2_acceptance_buff_enemy`
   - 用于人工验收 Buff 和敌人策略
2. 样本敌人：
   - `enemy_guard_demo`
   - 技能包含修甲/回血/普通攻击
3. 样本技能：
   - `skill_demo_hp_guard`
   - `skill_demo_armor_guard`
   - `skill_demo_on_hit_armor`

这样可以做到：

1. `level_1_1` 仍保留现有稳定基线
2. 新能力在新关卡里人工验收

### 5.4 验收标准

人工可点击复现以下现象：

1. 玩家挂 `HP免伤` 后，被敌人命中时 HP 不下降
2. 玩家挂 `护甲免伤` 后，被敌人命中时护甲不下降，且伤害不穿透 HP
3. 玩家挂 `受击获甲` 后，被敌人命中时先补甲，再由护甲吸收本次伤害
4. 样本敌人护甲受损后，优先用修甲技能
5. 样本敌人低血量时，优先用回血技能

### 5.5 风险

1. `mock_ui_v11.html` 当前技能显示层与真实技能池并不完全一致
2. 新增验收关卡后，关卡选择 UI 可能暴露新的列表/排序问题

### 5.6 完成判定

完成这一阶段后，你应该不需要再问“这个行为我怎么手工确认”。

## 阶段 2：扩展 Buff 主流程样本

### 6.1 目标

让 Buff 在“学习 -> 装配 -> 执行 -> 观察结果”这一条主流程里完整成立。

### 6.2 计划改动文件

- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/skills_melee_v4_5.json`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/buffs_v2_7.json`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/engine/CoreEngine.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/engine/buff/BuffSystem.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/ui/UI_SkillPanel.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/test/codex_regression_runner.html`

### 6.3 重点任务

1. 建立 Buff 演示技能与 Buff 效果的明确映射
2. 补 `BATTLE_ACTION_PRE / BATTLE_ATTACK_PRE / BATTLE_TAKE_DAMAGE_PRE / BATTLE_ATTACK_POST` 的真实页面样本
3. 让至少两条主动技能在主流程中形成清晰 Buff 联动：
   - 防御链
   - 受击触发链

### 6.4 验收标准

人工验收中至少应能看到：

1. 技能施放后 Buff 图标或状态变化
2. 下一次攻击/受击时 Buff 产生可观察影响
3. Buff 生命周期至少可观察一回合以上

### 6.5 完成判定

完成这一阶段后，Buff 不再只是底层“生效”，而是“主流程中稳定可用”。

## 阶段 3：扩展敌人真实行为样本

### 7.1 目标

把当前自动回归中的敌人行为逻辑，转成真实关卡中可观察的战斗行为。

### 7.2 计划改动文件

- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/enemies.json`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/levels.json`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/skills_melee_v4_5.json`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/engine/EnemyActionPlanner.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/engine/CoreEngine.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/test/codex_regression_runner.html`

### 7.3 重点任务

1. 增加真实敌人样本：
   - 防御型
   - 恢复型
   - 追击型
2. 扩展策略评分：
   - 对薄弱部位优先攻击
   - 对破甲部位追击
   - 在不同血线下切换技能
3. 做多敌人样本，但先不要求复杂协同

### 7.4 验收标准

人工和自动都能看到至少 3 类行为：

1. 受损修甲
2. 低血量回血
3. 优先追击玩家薄弱/破甲部位

### 7.5 完成判定

完成这一阶段后，敌人行为才算真正从“脚本型”走向“策略型”。

## 阶段 4：补战斗恢复链路

### 8.1 目标

闭环战斗中存档恢复。

### 8.2 计划改动文件

- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/engine/CoreEngine.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/engine/DataManagerV2.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/engine/TurnPlanner.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/script/ui/UI_SkillPanel.js`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/mock_ui_v11.html`
- `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/test/codex_regression_runner.html`

### 8.3 重点任务

1. 明确战斗中 runtime snapshot 的最小必要字段
2. 确保恢复后：
   - `BuffManager` 重建
   - `planning budget` 重建
   - `timeline / turn / queue` 状态一致
3. 增加恢复后的继续执行回归

### 8.4 验收标准

人工恢复链路：

1. 进入战斗
2. 完成一轮规划
3. 中途保存
4. 刷新页面
5. 恢复战斗
6. 继续规划与执行

预期：

1. 玩家/敌人状态不丢
2. Buff 状态不丢
3. 可继续正常进入下一回合

## 6. 推荐执行顺序

建议采用下面的顺序，避免反复返工：

1. 先做阶段 1
   - 原因：先解决“怎么验”
2. 再做阶段 2
   - 原因：Buff 的主流程可观察性最差，先补
3. 再做阶段 3
   - 原因：敌人策略扩展依赖真实敌人样本和验收入口
4. 最后做阶段 4
   - 原因：恢复链路最容易被前面新增状态影响，宜最后闭环

## 7. 每阶段输出要求

每完成一个阶段，必须新增：

1. 自测报告
2. 人工验收清单
3. 会话交接记录

建议命名继续沿用：

- `DOC/CodexAnylyse/自测报告/`
- `DOC/CodexAnylyse/验收清单/`
- `DOC/CodexAnylyse/会话交接/`

## 8. 我对这份计划的判断

这份计划是可执行的，原因是：

1. 它先解决当前最大的验收缺口
2. 它不要求一次性重构战斗系统
3. 它把风险最高的“战斗恢复”放到了行为样本稳定之后
4. 它保持了当前 `mock_ui_v11.html` 已验收主流程不被随意破坏

## 9. 建议你优先审定的点

你只需要先拍板以下三件事：

1. 是否接受“新增验收样本关卡”，而不是改坏当前唯一基线关卡
2. 是否接受“先把自动回归能力转成手工可验入口”作为下一阶段最高优先级
3. 是否接受“战斗恢复”放在 Buff / 敌人真实样本之后

如果这三点你认可，我就可以按这份详细计划继续推进。
