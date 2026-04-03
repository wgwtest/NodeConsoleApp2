# 敌人系统设计文档 (Enemy Design)

## 1. 敌人综述 (Overview)

本游戏的敌人系统基于 **西方奇幻 (Western Fantasy)** 背景构建。
在一个充满危险的 Roguelike 世界中，玩家将遭遇形态各异的生物。敌人不仅是玩家通关的阻碍，也是检验玩家 Build (构建) 合理性的试金石。

敌人种族构成了一个完整的生态系统，从低级的哥布林、强盗，到中级的兽人、亡灵，再到高级的恶魔、巨龙。每种敌人都有其独特的战斗风格、属性倾向和弱点机制。

---

## 2. 敌人设计总体目标 (Design Goals)

1.  **差异化的战斗体验**:
    *   不同种族和职业的敌人应给玩家带来截然不同的压迫感。
    *   例如：**哥布林**依靠闪避和高频攻击，**兽人**依靠厚重的护甲和单发重击，**法师**则侧重于魔法伤害和状态施加。

2.  **部位与护甲策略 (Body Parts & Armor Strategy)**:
    *   敌人的护甲分布必须符合其形象。
    *   **重甲单位**：头部、躯干拥有高额护甲，玩家需要寻找四肢弱点或使用破甲技能。
    *   **轻甲/闪避单位**：全身护甲较低，但基础速度高，可能拥有高 "闪避率" (通过技能或属性体现)，需要玩家使用必中或多段攻击。

3.  **智能化的行动逻辑 (AI Behavior)**:
    *   敌人不应只是随机释放技能。
    *   AI 应具备基本的战术意识，例如：生命值低时尝试治疗，拥有高 AP 时释放终结技，玩家护甲破裂时优先攻击弱点。

4.  **可扩展的生态 (Scalability)**:
    *   通过 JSON 配置，能够轻松组合 "种族" + "职业" + "等级" 来生成成百上千种不同的敌人实例。

---

## 3. 实现细节 (Implementation Details)

### 3.1 数据结构 (Data Model)
敌人的核心数据主要包含以下几个部分：

*   **基础属性 (Stats)**:
    *   `HP`: 生命值，归零即死亡。
    *   `Speed`: 决定出手顺序。
    *   `AP`: 每回合的行动力。
*   **部位系统 (Body Parts)**:
    *   每个部位定义 `Head`, `Chest`, `Abdomen`, `Arms`, `Legs`。
    *   属性包含 `Armor (Max/Current)` 和 `Weakness (Hit Multiplier)`。
    *   (例如：无头盔的敌人 Head Weakness = 1.5)。
*   **技能组 (Skill Deck)**:
    *   敌人携带的技能列表。AI 将从列表中选择技能放入行动队列。

### 3.2 行为模式 (AI Patterns)
这通过代码中的 AI 逻辑模块实现，常见的模式包括：
*   **Aggressive (进攻型)**: 优先消耗所有 AP 用于攻击，忽视防守。
*   **Defensive (防守型)**: 只要受到一定伤害或护甲破裂，优先使用防御技能。
*   **Tactical (战术型)**: 会根据玩家的状态 (Debuff) 选择技能，例如对流血目标使用 "嗜血打击"。

---

## 4. 敌人种族类型 (Races)

### 4.1 人类/类人 (Humanoid)
*   **特点**: 属性均衡，拥有标准的装备配置，战术灵活。
*   **弱点**: 无明显弱点，根据装备决定。
*   **代表**: 强盗 (Bandit), 雇佣兵 (Mercenary), 邪教徒 (Cultist)。

### 4.2 绿皮部落 (Greenskins)
*   **哥布林 (Goblin)**:
    *   *特点*: 低血量，极高速度，低护甲。
    *   *战术*: 骚扰，偷取 AP，施加中毒/流血。
*   **兽人 (Orc)**:
    *   *特点*: 高血量，高力量，粗制但厚重的局部护甲 (往往只有肩甲或胸甲)。
    *   *战术*: 暴力输出，即使受损也要攻击 (Berserk)。

### 4.3 亡灵 (Undead)
*   **特点**: 免疫流血/中毒，速度极慢，生命值中等，但往往有 "复生" 或 "吸血" 能力。
*   **代表**: 骷髅兵 (Skeleton), 僵尸 (Zombie), 巫妖 (Lich)。
*   **部位特性**: 骷髅类敌人对 "穿刺" 伤害有抗性，对 "打击" 伤害有弱点。

### 4.4 野兽 (Beasts)
*   **特点**: 无护甲 (依靠皮毛，Armor 值低)，高 HP，高速度。
*   **代表**: 恐狼 (Dire Wolf), 巨熊 (Bear)。
*   **战术**: 撕咬 (造成流血), 咆哮 (降低玩家攻击力)。

---

## 5. 职业类型 (Classes / Archetypes)

通过将种族与职业结合，可以构建具体的敌人。

### 5.1 战士 (Warrior / Grunt)
*   **定位**: 基础近战单位。
*   **技能**: 普通攻击 (Slash), 格挡 (Block)。
*   **护甲**: 均衡的全身轻甲。

### 5.2 重装守卫 (Tank / Defender)
*   **定位**: 高生存，低输出。
*   **技能**: 盾击 (Stun), 铁壁 (增加大量护甲), 嘲讽 (Taunt - 在 1v1 中可能表现为强制玩家攻击特定部位)。
*   **护甲**: 极高的 Chest/Head 护甲。

### 5.3 刺客/斥候 (Rogue / Scout)
*   **定位**: 爆发输出，闪避。
*   **技能**: 背刺 (高额单体伤害), 涂毒 (Poison), 烟幕 (增加闪避)。
*   **护甲**: 几乎无护甲，依赖速度先手压制。

### 5.4 施法者 (Caster)
*   **定位**: 远程，特殊效果。
*   **技能**: 火球 (高额无视护甲伤害), 冰锥 (降低玩家速度), 治疗术 (Heal)。
*   **护甲**: 布甲 (极低 Armor)，但可能有魔法护盾 (Magic Shield)。

---

## 6. 敌人技能示例 (Enemy Skill Examples)

技能设计需配合部位攻击系统。

| 技能名称 | 类型 | 消耗 AP | 描述 | 适用职业 |
| :--- | :--- | :--- | :--- | :--- |
| **Rusty Slash (生锈劈砍)** | 攻击 | 2 | 造成基础伤害，有概率造成 1 回合破伤风 (速度降低)。 | 强盗/骷髅 |
| **Heavy Smash (重力猛击)** | 攻击 | 4 | 消耗大量 AP，对头部造成毁灭性伤害，容易破坏头盔。 | 兽人/巨魔 |
| **Ankle Bite (脚踝撕咬)** | 攻击 | 2 | 攻击腿部，造成少量伤害但显著降低下回合速度。 | 哥布林/野兽 |
| **Shield Wall (盾墙)** | 防御 | 3 | 恢复左臂/躯干护甲值，并在下回合提升格挡率。 | 守卫 |
| **Necrotic Ray (死灵射线)** | 魔法 | 3 | 直接攻击生命值 (穿透护甲)，并恢复造成伤害 50% 的血量。 | 亡灵法师 |
| **Wild Roar (野性咆哮)** | 状态 | 2 | 在 2 回合内，自身攻击力提升 20%，玩家护甲效能降低。 | 野兽/狂战士 |

---

## 7. 敌人配置示例 (Sample Configuration)

以下展示不同种族和类型的敌人配置样例，这些样例展示了如何通过属性和部位护甲来区分不同类型的敌人。

### 7.1 兽人狂战士 (Orc Berserker) - 强攻型
典型的“玻璃大炮”或“重装坦克”混合体，护甲主要集中在胸部，头部暴露。

```json
{
  "id": "orc_berserker_lvl5",
  "name": "嗜血兽人 (Lv.5)",
  "race": "orc",
  "class": "berserker",
  "stats": {
    "hp": 200,
    "speed": 8,
    "ap": 4
  },
  "bodyParts": {
    "head": { "max": 0, "current": 0, "weakness": 1.5 },
    "chest": { "max": 50, "current": 50, "weakness": 0.8 },
    "left_arm": { "max": 10, "current": 10, "weakness": 1.0 },
    "right_arm": { "max": 10, "current": 10, "weakness": 1.0 },
    "legs": { "max": 10, "current": 10, "weakness": 1.0 }
  },
  "skills": ["skill_heavy_smash", "skill_rage", "skill_cleave"]
}
```

### 7.2 哥布林斥候 (Goblin Scout) - 高速骚扰型
依靠高速度和闪避生存，血量极低，几乎没有护甲。

```json
{
  "id": "goblin_scout_lvl3",
  "name": "哥布林斥候 (Lv.3)",
  "race": "goblin",
  "class": "scout",
  "stats": {
    "hp": 60,
    "speed": 15,
    "ap": 3
  },
  "bodyParts": {
    "head": { "max": 5, "current": 5, "weakness": 1.2 },
    "chest": { "max": 10, "current": 10, "weakness": 1.0 },
    "left_arm": { "max": 0, "current": 0, "weakness": 1.0 },
    "right_arm": { "max": 0, "current": 0, "weakness": 1.0 },
    "legs": { "max": 0, "current": 0, "weakness": 0.9 }
  },
  "skills": ["skill_ankle_bite", "skill_throw_stone", "skill_escape"]
}
```

### 7.3 骷髅卫士 (Skeleton Guard) - 重甲防守型
拥有盾牌和全身护甲，对穿刺伤害有抗性（通过 weakness < 1.0 体现），但动作缓慢。

```json
{
  "id": "skeleton_guard_lvl4",
  "name": "骷髅卫士 (Lv.4)",
  "race": "undead",
  "class": "defender",
  "stats": {
    "hp": 100,
    "speed": 5,
    "ap": 3
  },
  "bodyParts": {
    "head": { "max": 20, "current": 20, "weakness": 1.1 },
    "chest": { "max": 40, "current": 40, "weakness": 0.9 },
    "left_arm": { "max": 30, "current": 30, "weakness": 0.5 },
    "right_arm": { "max": 10, "current": 10, "weakness": 1.0 },
    "legs": { "max": 15, "current": 15, "weakness": 1.0 }
  },
  "skills": ["skill_shield_bash", "skill_bone_repair"]
}
