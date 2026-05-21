# 技能与 Buff 渐进式解耦测试策略

创建日期：2026-05-21

状态：`当前策略 / 已启动首轮测试`

## 1. 文档职责

本文档用于固定后续技能系统与 Buff 系统测试工作的执行策略。

它不是测试结果报告，也不是一次性全量修复计划。它的职责是：

1. 明确 Skill、Buff、CoreEngine 的边界；
2. 明确渐进式测试批次；
3. 明确哪些能力应当先测试并收口，哪些能力应当记录后交由人工判断；
4. 避免为了单个 Buff 或单个技能，把专属循环、专属标志位、专属状态写入核心引擎。

## 2. 总目标

后续测试工作的目标不是“强行让所有技能和 Buff 一次性通过”，而是建立一套可持续扩展的验证体系：

1. 对已经符合现有通用机制的 Buff 和 Skill，做全面测试；
2. 对可以通过小型通用能力补齐的机制，单独归档、分批推进；
3. 对会污染核心引擎或需要复杂额外状态的机制，先记录风险与设计问题，交给人工判断；
4. 保持 Buff 与 Skill 尽可能数据驱动，保持 CoreEngine 只承接通用事件、通用上下文和通用结算接口。

## 3. 解耦边界

### 3.1 Skill 的职责

Skill 负责：

1. 目标选择：`target.subject / target.scope / target.selection`；
2. 释放条件：`requirements`；
3. 资源消耗：`costs.ap / costs.partSlot / perTurnLimit`；
4. 直接动作：`actions[]`，例如伤害、治疗、加甲、破甲、获得 AP；
5. Buff 指令：`buffRefs.apply / buffRefs.remove`。

Skill 不负责：

1. 内嵌 Buff 的生命周期；
2. 自己解释 Buff 的层数、触发器、持续回合；
3. 为单个 Buff 写专属结算逻辑；
4. 通过旧标签或描述文案反推运行时事实。

### 3.2 Buff 的职责

Buff 负责：

1. 定义生命周期：duration、stacks、stackStrategy；
2. 定义通用触发点：例如 `onTurnStart`、`onAttackPre`、`onAttackPost`、`onTakeDamagePre`、`onDefendPost`；
3. 定义通用动作：例如 `DAMAGE_HP`、`HEAL_ARMOR`、`SKIP_TURN`、`PREVENT_DAMAGE_HP`、`PREVENT_DAMAGE_ARMOR`、`AP_COST_REDUCE`；
4. 定义通用属性修正：例如 `speed`、`damageTakenMult` 等；
5. 通过 `paramsSchema` 暴露可编辑参数。

Buff 不应要求 CoreEngine 为某个具体 Buff 追加硬编码分支。

### 3.3 CoreEngine 的职责

CoreEngine 负责：

1. 发出通用事件；
2. 提供通用战斗上下文；
3. 消费通用上下文字段，例如 `preventHpDamage`、`preventArmorDamage`、`damageTakenMult`、`tempModifiers`；
4. 执行技能动作和 Buff 系统已产出的通用结果。

CoreEngine 不应承担：

1. “某个 Buff 名称”的专属逻辑；
2. “某个技能名称”的专属逻辑；
3. 为单个设计点增加难以复用的标志位；
4. 为复杂 Buff 维护专属跨回合、跨部位历史状态。

## 4. 渐进式测试分层

后续测试按以下层级推进，不把所有问题混成“技能不能用”。

### 4.1 L0：数据与引用层

目标：

1. Skill pack 可加载；
2. Buff pack 可加载；
3. `buffRefs` 引用存在；
4. 技能前置依赖有效；
5. 测试/演示节点不会污染正式技能树。

主要产物：

1. 数据引用检查；
2. 缺失 Buff 清单；
3. orphan skill / invalid prerequisite 清单。

### 4.2 L1：Buff 原子能力层

目标：

1. `BuffRegistry` 能解析 `paramsSchema` 默认值和覆盖值；
2. `BuffManager` 能处理添加、刷新、叠层、过期、移除；
3. `BuffSystem` 能在隔离事件下触发对应 action；
4. 不依赖完整主流程。

优先测试对象：

1. `buff_bleed` / `buff_poison`：周期伤害；
2. `buff_stun`：跳过行动；
3. `buff_slow` / `new_buff_1771487521271`：速度修正；
4. `new_buff_1771481773827` / `new_buff_1771481936095`：免伤标志；
5. `new_buff_1771482673293` / `new_buff_1771485041778` / `buff_ap_regen`：护甲恢复；
6. `new_buff_1771485482007` / `new_buff_1771487055554`：技能开销修正。

### 4.3 L2：Skill 执行动作层

目标：

1. Skill 的 `actions[]` 能在轻量实体上执行；
2. 目标选择、部位、AP、部位槽位规则可验证；
3. Skill 能正确施加或移除 Buff；
4. Skill 不内嵌 Buff 的结算细节。

典型测试：

1. 伤害技能造成 HP 或护甲变化；
2. 治疗和加甲技能修改正确目标；
3. `buffRefs.apply` 能把 Buff 放到 `self` 或 `enemy`；
4. `buffRefs.remove` 能移除指定 Buff。

### 4.4 L3：Skill + Buff 集成层

目标：

1. Skill 只负责施加 Buff；
2. Buff 只在后续通用事件里生效；
3. 验证技能说明、Buff 引用、运行时结果三者一致。

典型测试：

1. `锯齿斩` 施加 `buff_bleed`，下一次 `TURN_START` 扣血；
2. `大地震击` 施加 `buff_stun`，下一次行动被跳过；
3. `顺手捡漏` 施加攻击获甲，在攻击事件中恢复护甲；
4. `堡垒姿态` 施加护甲回复，在回合开始恢复护甲；
5. `绝对防御` 施加护甲免伤，在受击结算中保留护甲。

### 4.5 L4：核心引擎桥接层

目标：

1. 只验证 CoreEngine 对通用上下文字段的消费；
2. 不把某个 Buff 的专属行为写入 CoreEngine；
3. 对通用事件链进行小规模回归。

典型测试：

1. `BATTLE_TAKE_DAMAGE_PRE` 写入 `preventArmorDamage` 后，护甲不下降；
2. `BATTLE_TAKE_DAMAGE_PRE` 写入 `preventHpDamage` 后，HP 不下降；
3. `speed` statModifier 会影响规划速度；
4. `_planningApCostFlatDelta` 会影响技能 AP 成本。

## 5. 分批推进策略

### 5.1 第一批：现有通用机制可直接覆盖

第一批只测已经具备通用路径的能力：

1. 流血、中毒、晕眩；
2. 加速、减速；
3. HP 免伤、护甲免伤；
4. 攻击获甲、受击获甲、回合护甲回复；
5. 开销降低、开销增多；
6. 直接伤害、直接护甲伤害、治疗、加甲、AP_GAIN。

通过标准：

1. 有隔离单测；
2. 有至少一个 Skill + Buff 集成样本；
3. 不新增 CoreEngine 专属分支。

### 5.2 第二批：数据存在但运行时未完全接通

第二批先记录，再决定是否补通用能力：

1. `buff_vulnerable`：当前缺有效 effect/statModifier；
2. `buff_pain_sup`：当前缺有效 effect/statModifier；
3. `debuff_weak`：有 `atk` 修正，但技能伤害计算是否消费 `atk` 需要单独确认；
4. `buff_lifesteal`：名称是吸血，但当前效果是 `HEAL_ARMOR`；
5. `new_buff_1771487561747`：减速定义基本为空；
6. `buff_shield`：被 `西海岸` 引用，但当前 Buff 包缺失。

处理规则：

1. 不直接改 CoreEngine；
2. 先判断是否能用已有通用 stat/effect 表达；
3. 如果不能，提出通用 action 或通用 context 字段方案；
4. 方案未确认前，只记录为待决设计问题。

### 5.3 第三批：需要复杂状态模型的机制

第三批不追求立即实现，先进入设计风险清单。

典型例子：

1. “同一部位多个回合反复叠甲，效果更强”；
2. “记录某个部位连续被同一类技能命中次数”；
3. “按每个部位的历史 Buff 来源计算额外收益”；
4. “按敌人流血层数消耗后转为治疗，同时保留部分层数”；
5. “检测自身是否有某个 Buff，再改变技能动作”。

这些机制可能需要：

1. 部位级状态容器；
2. Buff 来源追踪；
3. Buff 层数查询与消耗 action；
4. 条件型技能动作；
5. 更明确的战斗上下文生命周期。

在没有通用模型前，不应为了单个技能把这些状态塞进 CoreEngine。

## 6. 难实现能力的记录模板

每个暂缓项必须记录以下内容：

1. 名称：Buff 或 Skill 名称；
2. 期望效果：玩家可理解的玩法描述；
3. 当前支持情况：现有 trigger/action/stat 是否可表达；
4. 缺口类型：
   - 缺 Buff action；
   - 缺 trigger；
   - 缺 stat 消费；
   - 缺 skill condition；
   - 缺部位级状态；
   - 缺 Buff 层数查询/消耗；
5. 解耦风险：是否会导致 CoreEngine 专属分支；
6. 推荐处置：
   - 直接测试；
   - 补通用能力后测试；
   - 重写为现有机制可表达的效果；
   - 暂缓并交人工判断。

## 7. 禁止事项

后续测试与修复中禁止：

1. 因为某个 Buff 测不过，就在 CoreEngine 里写 `if buffId === ...`；
2. 因为某个技能测不过，就在 CoreEngine 里写 `if skillId === ...`；
3. 用技能描述文案代替运行时事实；
4. 用旧 `tags` 作为正式运行时来源；
5. 为单个设计点新增不可复用的跨回合标志位；
6. 一次性要求所有技能和 Buff 全部通过后才算有价值。

## 8. 成果物要求

每一轮测试完成后，应产出：

1. 已覆盖清单：哪些 Buff/Skill 已经有测试；
2. 通过清单：哪些行为已经被验证；
3. 异常清单：哪些行为失败；
4. 暂缓清单：哪些设计需要人工判断；
5. 解耦风险清单：哪些方案可能污染 CoreEngine；
6. 对应测试命令和结果；
7. 如有代码变更，必须有回归测试。

建议输出位置：

1. 自测报告：`DOC/CODEX_DOC/05_测试文档/01_自测报告/`
2. 异常归档：`DOC/CODEX_DOC/04_研发文档/`
3. 计划拆分：`DOC/CODEX_DOC/03_研制计划/`

## 9. 当前首轮建议入口

首轮建议从以下方向开始：

1. 先建立 Buff 原子能力测试；
2. 再建立 Skill 施加 Buff 的集成测试；
3. 再检查当前活动技能包中所有 `buffRefs` 是否有对应 Buff；
4. 最后输出第一轮“可直接收口 / 需补通用能力 / 暂缓判断”的清单。

首轮不处理：

1. 新增技能设计；
2. 高风险复杂 Buff；
3. 大规模 CoreEngine 重构；
4. 为某个具体 Buff 写专属运行时分支。
