# 装备系统设计文档 (Item System Design)

## 1. 装备综述 (Overview)

本游戏的装备系统作为角色成长的基石，基于经典的 **西方奇幻 (Western Fantasy)** 风格构建。
装备不仅提供基础属性支撑，更通过 **Buff/Debuff 机制** 实现多样化的特效，与技能系统共同构建角色的战斗流派。

*   **核心理念**: 装备即 Buff 容器。装备属性不再是硬编码的字段，而是通过施加永久或条件性的 Buff 来生效。
*   **装备类型**:
    *   **武器 (Weapon)**: 提供攻击力、暴击率、命中率等攻击性属性，决定基础伤害类型。
    *   **防具 (Armor)**: 提供各部位的护甲值、抗性、生命值加成。
    *   **饰品 (Accessory)**: 提供特殊效果、属性修正、被动技能。
*   **部位拆分**:
    *   主手 (Main Hand) / 副手 (Off Hand)
    *   头部 (Head) / 身体 (Body) / 四肢 (Limbs, 可能分为手/脚)
    *   饰品栏 (通常 1-2 个)

---

## 1.1 物品与 Buff 系统的对接规范（重要）

本节用于把 `13-閬撳叿绯荤粺(item_design)-璁捐璇存槑.md` 中的“装备效果描述”与新版 `09-Buff绯荤粺(buff_design)-璁捐璇存槑.md` / `assets/data/buffs.json` 对齐。

### 1.1.1 设计原则

1. **装备效果=Buff 引用**：装备不直接写“特殊逻辑”，而是通过 `buffId` 组合表达。
2. **低耦合**：装备系统只负责“何时把 Buff 装到谁身上”，Buff 的触发器/动作由 Buff 自身定义。
3. **部位/槽位与 Buff 的作用域解耦**：
   - “装备穿在头/身/四肢”属于物品和角色系统的装备槽概念；
   - “Buff 影响头部护甲/躯干减伤”等属于 Buff 的 `scope.part`（或目标配置）概念。

### 1.1.2 装备 Buff 引用字段约定（文档层面）

> 本节是“设计文档约定”，用于后续落地成 `items.json` schema（如果你后续计划更新数据文件）。

- `buffRefs.passive`: 装备后立即生效、持续到卸下为止的被动 Buff 列表（通常 `lifecycle.duration = -1`）
- `buffRefs.proc`: 装备提供的触发类 Buff 列表（例如“暴击时施加易伤”“受击前触发护盾”），由 Buff 的 `effects[].trigger` 决定触发时机
- `buffRefs.onEquip` / `buffRefs.onUnequip`: 装备/卸下瞬间施加/移除的 Buff（多数情况下通过引擎统一处理“卸下移除”即可）

每个引用项建议具备：
- `buffId`: 必须存在于 `assets/data/buffs.json`
- `target`: 通常为 `self`（装备给自己），少数诅咒类也可设计为“被攻击者”但建议仍用 Buff 的触发器实现
- `notes`: 说明该 Buff 的触发点与适用范围（不写具体运行逻辑）

## 2. 装备机制 (Item Mechanics)

装备系统深度集成于 Buff/Debuff 系统，遵循以下机制：

### 2.1 效果生效 (Activation)
*   **常驻效果 (Static/Native Buffs)**: 装备一旦穿戴，即赋予角色一个 infinite duration (持续时间 -1) 的 Buff。
    *   *例*: 穿戴 [铁甲] -> 获得 [Buff: 身体护甲 +50]。
    *   *例*: 装备 [长剑] -> 获得 [Buff: 攻击力 +10]。
*   **触发效果 (Conditional Buffs/Triggers)**: 装备可能包含监听战斗事件的逻辑，在满足条件时触发临时 Buff 或各即时效果。
    *   *触发条件*: 攻击时 (OnHit)、被攻击时 (OnDefend)、回合开始 (OnTurnStart)、暴击时 (OnCrit)。

### 2.2 护甲与耐久 (Armor & Durability)
*   与传统 RPG 不同，本游戏的护甲值是消耗性的“外层生命值”。
*   装备提供的护甲值在战斗开始时转化为角色的 **最大护甲值 (Max Armor)** 和 **当前护甲值**。
*   **装备破坏**: 当某部位护甲值降为 0，视为该部位装备“失效”或“破损”，失去其提供的护甲减免效果，但装备提供的其他属性（如力量加成）可能依然保留或随之失效（取决于具体设计难度，建议初期保留非护甲属性）。

### 2.3 装备稀有度 (Item Rarity)

与技能系统类似，装备按强度和词条数量分为 5 个等级：

*   **Tier 1: 普通 (Common)** - 灰色
    *   仅提供基础属性（攻/防）。无特殊词条。
    *   *获取*: 商店购买，普通小怪掉落。
*   **Tier 2: 稀有 (Uncommon)** - 绿色
    *   基础属性略高，附带 1 个初级词条（如: 命中 +5%）。
    *   *获取*: 精英怪，铜宝箱。
*   **Tier 3: 卓越 (Rare)** - 蓝色
    *   附带 1-2 个中级词条，可能改变技能形态或提供特殊被动。
    *   *获取*: Boss 掉落，银宝箱。
*   **Tier 4: 史诗 (Epic)** - 紫色
    *   拥有专属名称和背景故事，强力特效（如: 攻击附带流血）。
    *   *获取*: 关卡 Boss 稀有掉落，高层商店。
*   **Tier 5: 传说 (Legendary)** - 金色
    *   具有唯一性，拥有颠覆玩法的核心特效（如: 死亡复活，无限 AP 模式）。
    *   *获取*: 隐藏 Boss，神级宝箱。

---

## 3. 装备获取方式 (Acquisition)

1.  **战斗掉落 (Loot Drop)**
    *   战斗胜利后，根据敌人等级和类型掉落战利品。
    *   Boss 必定掉落高品质装备。
2.  **商店购买 (Shop)**
    *   在特定休息关卡（Rest Site），商人出售随机装备。
3.  **事件奖励 (Event Reward)**
    *   随机遭遇事件（如：拔出石中剑，帮助受伤的冒险者）给予装备作为报酬。
4.  **初始携带 (Starting Gear)**
    *   根据选择的角色职业，开局携带基础套装。

---

## 4. 详细装备示例 (Item Examples)

### 4.1 武器类 (Weapons)

| ID | 名称 (Name) | 稀有度 | 部位 | 属性/Buff | 特殊效果 (Effect) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `wp_rusty_sword` | 锈蚀铁剑 | 普通 | 主手 | 攻击 +6 | 无 |
| `wp_knight_sword` | 骑士长剑 | 稀有 | 主手 | 攻击 +12 | **[精良工艺]**: 命中率 +5% |
| `wp_vampire_fang` | 吸血鬼之牙 (匕首) | 卓越 | 主手 | 攻击 +8, 速度 +2 | **[吸血]**: 造成伤害的 20% 转化为自身 HP 治疗。 |
| `wp_thunder_hammer`| 雷神之锤 | 史诗 | 主手 | 攻击 +20 | **[雷击]**: 攻击时有 30% 概率触发“落雷”，对目标造成额外 10 点无视护甲伤害。 |
| `wp_cursed_blade` | 诅咒魔刃 | 传说 | 主手 | 攻击 +35 | **[血之代价]**: 攻击力大幅提升，但每回合开始时自身受到 5 点真实伤害。 |

### 4.2 防具类 (Armor)

| ID | 名称 (Name) | 稀有度 | 部位 | 属性/Buff | 特殊效果 (Effect) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `helm_leather_cap` | 皮帽 | 普通 | 头部 | 头部护甲 +15 | 无 |
| `body_chainmail` | 锁子甲 | 稀有 | 身体 | 身体护甲 +40 | **[轻便]**: 不会因为穿着重甲而降低速度 (通常重甲会 -Speed)。 |
| `limbs_iron_greaves`| 钢铁护腿 | 普通 | 四肢 | 四肢护甲 +20 | 无 |
| `helm_gladiator` | 角斗士头盔 | 卓越 | 头部 | 头部护甲 +25 | **[威吓]**: 战斗开始时，使所有敌人攻击力 -2 (持续 2 回合)。 |
| `body_dragon_scale`| 龙鳞甲 | 史诗 | 身体 | 身体护甲 +80 | **[火焰抗性]**: 受到的火焰伤害减少 50%。 |

### 4.3 饰品类 (Accessories)

| ID | 名称 (Name) | 稀有度 | 部位 | 属性/Buff | 特殊效果 (Effect) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `acc_ring_vitality`| 活力指环 | 稀有 | 饰品 | HP上限 +20 | 无 |
| `acc_amulet_focus` | 专注项链 | 卓越 | 饰品 | 命中 +10% | **[冥想]**: 若上一回合未移动/攻击，本回合 AP +1。 |
| `acc_boots_speed` | 赫尔墨斯之靴 | 史诗 | 饰品 | 速度 +5 | **[极速]**: 闪避率 +10%。 |
| `acc_pendant_phoenix`| 凤凰吊坠 | 传说 | 饰品 | 全抗性 +5 | **[涅槃]**: 受到致命伤害时免疫死亡，恢复 30% HP (每场战斗限 1 次)。 |

---

## 5. 装备设计约束 (Design Constraints)

1.  **数值平衡**:
    *   同级装备的总属性价值应维持在一定范围内（例如 Tier 1 武器攻击力在 5-8 之间）。
    *   装备提供的 Buff 应当避免无限叠加，需要设定堆叠上限 (Max Stocks) 或使用唯一 ID 覆盖。
2.  **槽位互斥**:
    *   装备必须严格对应 Slot 定义。双手武器 (Two-handed) 装备时，副手槽位必须为空或被禁用。
3.  **UI 表现**:
    *   每个装备需有对应的图标（Icon ID）。
    *   装备的 Buff 效果需要在通过 UI 的 Tooltip 清晰展示给玩家，特别是触发类的复杂效果。
4.  **数据结构**:
        *   装备数据结构应包含 `buffs` 数组，直接映射到 Buff 系统，避免在装备类中写死逻辑代码。

## 6. 装备 -> Buff 追溯表 (Traceability)

    下表列出了装备与其提供的 Buff/Passive 效果的对应关系。

    | 装备ID | 装备名称 | 关联 Buff ID | 说明 |
    | :--- | :--- | :--- | :--- |
    | `wp_vampire_fang` | 吸血鬼之牙 | `buff_lifesteal` | 攻击吸血 (Passive) |
    | `acc_amulet_focus` | 专注护符 | `buff_ap_regen` | 回合未行动回复 AP |
    | `acc_pendant_phoenix` | 不死鸟项链 | `buff_revive`, `passive_phoenix` | 死亡复活 (一次性) |
    | `wp_knight_sword` | 骑士长剑 | `passive_knight` | 增加伤害 |
    | `body_chainmail` | 重装锁甲 | `passive_heavy_armor` | 增加护甲，降低速度 |
    | `helm_gladiator` | 角斗士头盔 | `passive_gladiator`, `debuff_weak` | 战斗开始时降低自身攻击 |
    | `body_dragon_scale` | 龙鳞甲 | `passive_dragon` | 降低受到的伤害 |
    | `acc_boots_speed` | 赫尔墨斯之靴 | `passive_speed_boost` | 增加速度 |
    | `wp_thunder_hammer` | 雷神之锤 | `passive_thunder_strike` | 攻击附带额外雷电伤害 |
    | `wp_cursed_blade` | 诅咒魔剑 | `passive_cursed_self_dmg` | 攻击力极高，但每回合自伤 |


