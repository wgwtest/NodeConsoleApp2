# 关卡系统设计文档 (Level Design)

## 1. 游戏综述 (Game Overview)

本游戏是一款基于 Web 的 Roguelike 回合制策略游戏。
*   **游戏结构**: 单局游戏包含 10-30 个线性增长难度的关卡 (Levels)。
*   **核心玩法**: 玩家通过不断挑战每一层的敌人，获取随机奖励（装备/技能/属性提升），构建独特的角色能力（Build），以应对后续更强大的挑战。
*   **关卡特征**:
    *   **一对一决斗**: 每个关卡仅存在一名独特的敌人。
    *   **随机生成**: 敌人的属性、装备配置、技能组合在一定规则下随机生成，确保每局游戏的体验不可复制。
    *   **永久进阶**: 赢得关卡是获取资源的唯一途径，失败则意味着本局结束（Roguelike 机制）。

---

## 2. 关卡设计总体目标 (Design Goals)

1.  **循序渐进的挑战 (Progressive Difficulty)**
    *   前 5 关用于让玩家熟悉战斗系统和技能机制。
    *   中段关卡（5-20）考验玩家的 Build 策略（针对特定部位攻击、护甲管理）。
    *   后段关卡（20+）需要玩家具备极致的数值优化和战术执行力。

2.  **策略多样性验证 (Strategy Validation)**
    *   关卡生成器应产出不同类型的敌人（高血厚甲型、高攻速型、特殊状态型），迫使玩家调整战术，而不是一套技能打到底。

3.  **高风险高回报 (Risk & Reward)**
    *   奖励系统应与关卡难度挂钩。越艰难的战斗，胜利后的 "战利品"（新技能、强力 Buff）应越强力。

4.  **资源管理 (Resource Management)**
    *   由于是连续闯关，玩家需要在 "回复生命值" 和 "增强战斗力" 之间做取舍（如果设计有休整机制）。

---

## 3. 实现细节 (Implementation Details)

### 3.1 关卡结构数据 (Level Data Structure)
关卡不再是硬编码的死数据，而是通过配置生成的动态实例。

*   **所有关卡配置 (`levels.json`)**: 定义每一层的生成规则。
    *   `level_index`: 层数 (1-30)。
    *   `difficulty_multiplier`: 难度系数 (如 1.0, 1.2, 2.5)。
    *   `enemy_pool_id`: 该层可能出现的敌人 ID 列表。
    *   `environment_effect`: (可选) 环境效果，如 "炎热：每回合扣血"。

### 3.2 敌人生成机制 (Enemy Generation System)
每个关卡的敌人只有一个，但在进入关卡时动态生成。

1.  **原型读取**: 根据 `enemy_pool` 从 `enemies.json` 读取敌人作为原型。
2.  **数值修正**:
    *   `HP = Prototype_HP * difficulty_multiplier`
    *   `Armor = Prototype_Armor * difficulty_multiplier`
    *   `Speed = Prototype_Speed * (1 + (difficulty_multiplier - 1) * 0.2)` (速度增长需克制，避免玩家无法出手)
3.  **随机化配置**:
    *   **装备/Buff**: 随机赋予敌人初始状态（如：初始带有 "护盾" 或 "利刃" Buff）。
    *   **技能组**: 敌人可能携带随机的特殊技能，而不仅仅是普攻。

### 3.3 奖励与结算流程 (Reward & Settlement Flow)

当玩家击败关卡敌人后，进入结算阶段：

1.  **基础奖励**:
    *   恢复一定比例的 HP/护甲。
2.  **Roguelike 三选一**:
    *   系统随机抽取 3 个选项供玩家选择：
        *   **选项 A (技能)**: 获得一个新技能（加入技能库）。
        *   **选项 B (装备/Buff)**: 获得一个被动增益（如 "头部护甲上限 +20"）。
        *   **选项 C (补给)**: 立刻恢复大量 HP 或清除 Debuff。
3.  **进入下一关**:
    *   选择奖励后，自动保存当前状态，并加载下一层的配置。

### 3.4 难度曲线规划 (Difficulty Curve)

| 关卡阶段 | 层数 range | 敌人特征 | 玩家目标 |
| :--- | :--- | :--- | :--- |
| **教学期** | 1 - 3 | 低血量，无护甲或低护甲 | 熟悉技能释放，无伤通关 |
| **成长期** | 4 - 10 | 出现带部位护甲的敌人 | 收集核心技能，确立流派 |
| **挑战期** | 11 - 20 | 敌人高攻高防，甚至有回血能力 | 优化技能顺序，通过 Buff 削弱敌人 |
| **终局** | 21 - 30 | Boss 级敌人，具备秒杀能力 | 极限操作，容错率极低 |

### 3.5 特殊关卡节点 (Special Nodes)
为了增加变数，每 5 层可以设定为特殊节点：
*   **精英层 (Elite Level)**: 敌人极强，但必掉落稀有 Buff。
*   **休息层 (Rest Level)**: 无敌人，直接进行满状态恢复或并在商店购买/升级技能（消耗关卡中获得的代币，如果有经济系统）。

---

## 4. 接口需求 (Interface Requirements)

为了支持上述设计，`CoreEngine` 和 `DataManager` 需要提供以下支持：

*   `CoreEngine.loadNextLevel()`: 加载下一关逻辑。
*   `DataManager.generateEnemy(levelIndex)`: 根据层数生成具体的敌人对象实例。
*   `DataManager.getRewardOptions(levelIndex)`: 生成随机奖励列表。
*   `Gameplay.calculateRewards()`: 处理玩家选择奖励后的属性变更。
