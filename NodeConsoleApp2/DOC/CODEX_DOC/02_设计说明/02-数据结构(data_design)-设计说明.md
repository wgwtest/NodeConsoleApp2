# 游戏数据结构设计 (Data Design)

## 1. 概述
本设计文档旨在规范游戏内核心数据的结构定义，确保逻辑层、数据层与UI表现层的一致性。
特别针对 `enemies.json` 与 `mock_ui_v10.html` 中存在的字段差异进行统一，建立标准化的数据契约。

## 2. 角色数据结构 (Character Data)

角色数据结构应用于玩家 (Player) 和敌人 (Enemy)。

### 2.1 基础属性 (Stats)
所有角色通用的基础属性对象。

| 字段名 | 类型 | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `hp` | Number | 当前生命值 | `100` |
| `maxHp` | Number | 最大生命值 | `100` |
| `ap` | Number | 当前行动力 | `4` |
| `maxAp` | Number | 最大行动力 | `6` |
| `speed` | Number | 速度（决定出手顺序） | `10` |

### 2.2 身体部位与护甲 (Body Parts & Armor)
为了适配 UI 的 5 部位细分显示，所有战斗单位必须包含完整的 `bodyParts` 定义。

**标准部位定义：**
*   `head` (头部)
*   `chest` (胸部)
*   `abdomen` (腹部)
*   `arm` (手臂)
*   `leg` (腿部)

**数据结构：**

```json
"bodyParts": {
    "head":       { "current": 20, "max": 20, "weakness": 1.5 },
    "chest":      { "current": 40, "max": 50, "weakness": 1.0 },
    "abdomen":    { "current": 30, "max": 40, "weakness": 1.1 },
    "arm":        { "current": 30, "max": 50, "weakness": 1.0 },
    "leg":        { "current": 40, "max": 60, "weakness": 1.0 }
}
```

*注：对于某些低级敌人（如无四肢的史莱姆），对应部位的 `max` 可设为 0，UI 层应识别并隐藏该部位。*

### 2.3 玩家数据结构 (Player Schema)
`assets/data/player.json` 应遵循此结构。

```json
{
  "id": "player_001",
  "name": "王国骑士",
  "stats": {
    "hp": 150, "maxHp": 150,
    "ap": 4, "maxAp": 6,
    "speed": 14
  },
  "skills": ["skill_slash", "skill_fireball", "skill_heal_light", "skill_iron_defense"],
  "bodyParts": {
      "head":       { "current": 0, "max": 0, "weakness": 1.5 },
      "chest":      { "current": 0, "max": 0, "weakness": 1.0 },
      "abdomen":    { "current": 0, "max": 0, "weakness": 1.1 },
      "arm":        { "current": 0, "max": 0, "weakness": 1.0 },
      "leg":        { "current": 0, "max": 0, "weakness": 1.0 }
  },
  "equipment": {
      "weapon": "wp_sword_great",
      // 装备只定义基础模板 ID，具体数值映射到 bodyParts
      "head": "helm_plate_01",
      "chest": "armor_plate_01",
      "abdomen": "armor_chain_01",
      "arm": "gloves_plate_01", // 映射到 arm
      "leg": "boots_plate_01"    // 映射到 leg
  },
  "inventory": []
}
```

### 2.4 敌人数据结构 (Enemy Schema)
`assets/data/enemies.json` 中的模板定义。

```json
{
  "mob_assassin": {
    "id": "mob_assassin",
    "name": "暗影刺客",
    "description": "潜伏在阴影中的致命杀手。",
    "stats": {
      "hp": 80, "maxHp": 120,
      "ap": 3, "maxAp": 5,
      "speed": 10
    },
    "skills": ["skill_poison_blade", "skill_stealth"],
    "bodyParts": { 
      // 必须完整定义5个部位，或在加载时补全默认值
      "head":       { "max": 30, "weakness": 2.0 }, // 头部脆弱
      "chest":      { "max": 50, "weakness": 0.8 },
      "abdomen":    { "max": 40, "weakness": 1.2 },
      "arm":        { "max": 60, "weakness": 1.0 },
      "leg":        { "max": 70, "weakness": 1.0 }
    },
    "dropTable": "drop_assassin_common",
    "aiStrategy": "aggressive" // 定义 AI 行为模式
  }
}
```

---

## 7. 行动槽位布局 (Action Slot Layout)

行动槽位（Slot）是战斗机制的核心概念：它约束敌我双方在一个回合内可以“规划/组合释放”的技能数量与分布，从而直接定义策略空间。

本项目将槽位分为两类数据：
1) **规则（Rule）**：槽位拓扑与容量（设计期配置，随关卡/模式变化）。
2) **状态（State）**：本回合已占用/已规划的行动队列（运行态数据，存档/回放可选）。

### 7.1 规则数据：`slot_layouts.json`

文件：`assets/data/slot_layouts.json`

```json
{
  "version": "slot_layouts_v1.0.0",
  "layouts": {
    "default_v1": {
      "id": "default_v1",
      "name": "默认行动槽位布局",
      "rows": ["head", "chest", "abdomen", "arm", "leg", "global"],
      "sides": ["self", "enemy"],
      "slotCounts": {
        "head": { "self": 2, "enemy": 3 },
        "chest": { "self": 2, "enemy": 3 },
        "abdomen": { "self": 2, "enemy": 3 },
        "arm": { "self": 2, "enemy": 3 },
        "leg": { "self": 1, "enemy": 3 },
        "global": { "self": 2, "enemy": 3 }
      }
    }
  }
}
```

字段说明：
- `rows`：行动矩阵的行枚举（与部位枚举保持一致，并包含 `global` 通用行）。
- `sides`：阵营/区域枚举（当前为 `self` / `enemy`）。
- `slotCounts[row][side]`：该行在该阵营下的槽位容量（整数）。

### 7.2 关卡绑定：`levels.json` -> `battleRules.slotLayoutId`

关卡可声明战斗规则中的槽位布局：

```json
{
  "level_1_1": {
    "id": "level_1_1",
    "battleRules": {
      "slotLayoutId": "default_v1"
    }
  }
}
```

### 7.3 默认规则入口：`config.json`

`assets/data/config.json` 作为数据加载入口，同时提供默认战斗规则：

```json
{
  "sources": {
    "slotLayouts": "slot_layouts.json"
  },
  "battleRules": {
    "slotLayoutId": "default_v1"
  }
}
```

### 7.4 状态数据（运行态）建议

运行态队列目前位于引擎 `runtime.queues` 中（player/enemy）。
若需要做“断点续玩/回放一致性”，建议将每个 action 绑定到稳定的 `slotKey`（如 `enemy:head:2`），避免 UI 调整导致旧存档无法复现。

## 3. 技能数据结构 (Skill Data)

为了支持 UI 的丰富显示（Tip、标签、排序参数），技能数据结构需要扩展。`assets/data/skills.json`。

| 字段名 | 类型 | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `id` | String | 技能唯一标识 | `skill_heavy_slash` |
| `name` | String | 技能显示名称 | `重斩` |
| `type` | String | 类型（UI分类/图标用） | `OFFENSE` (进攻), `DEFENSE` (防御), `MAGIC` (魔法) |
| `cost` | Number | AP消耗 | `2` |
| `speed` | Number | 速度修正值 | `1` (表示 +1), `-2` (表示 -2) |
| `targetType` | String | 目标选择逻辑 | `SINGLE_PART` (单体部位), `SELF`, `ALL_ENEMIES` |
| `icon` | String | 图标字符/图片路径 | `??` |
| `description` | String | 技能详细描述 | `对目标造成 150% 物理伤害。` |
| `tags` | Array | 搜索/分类标签 | `["单体", "物理"]` |
| `tip` | String | 简短提示（鼠标悬停） | `基础的高伤害技能` |
| `value` | Number | 基础数值（伤害/治疗等） | `1.5` (倍率) 或 `50` (固定值) |

**JSON 示例：**

```json
{
  "skill_heavy_slash": {
    "id": "skill_heavy_slash",
    "name": "重斩",
    "type": "OFFENSE",
    "cost": 2,
    "speed": 1,
    "targetType": "SINGLE_PART",
    "icon": "??",
    "description": "对目标造成 150% 物理伤害。",
    "tags": ["单体", "物理"],
    "tip": "基础的高伤害技能",
    "value": 150
  },
  "skill_iron_defense": {
    "id": "skill_iron_defense",
    "name": "钢铁防御",
    "type": "DEFENSE",
    "cost": 1,
    "speed": 2,
    "targetType": "SELF",
    "icon": "???",
    "description": "获得 20 点临时护甲，持续 1 回合。",
    "tags": ["防御", "护甲"],
    "tip": "预判敌方攻击时使用",
    "value": 20
  }
}
```

## 4. 物品数据结构 (Item Data)

### 4.1 装备定义 (Equipment)

装备被设计为 **Buff 容器**。它不再直接定义属性字段（如 `armorValue`），而是通过携带 **常驻 Buff (Passive Buffs)** 来影响角色属性。
这种设计将装备属性统一到了 Buff/Debuff 系统中，极大地提升了扩展性（例如：装备可以提供"每回合回血"或"免疫中毒"等复杂效果）。

**数据结构：**

| 字段名 | 类型 | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `id` | String | 物品ID | `wp_fire_sword` |
| `name` | String | 显示名称 | `烈焰长剑` |
| `type` | String | 物品类型 | `WEAPON`, `ARMOR`, `ACCESSORY` |
| `slot` | String | 装备部位 | `main_hand`, `head`, `chest` |
| `price` | Number | 价格 | `500` |
| `buffs` | Array | 装备提供的 Buff 列表 (可以是 ID 引用或内联定义) | `["buff_attack_up", { "stat": "hp", "val": 100 }]` |

**JSON 示例：**

```json
{
  "helm_plate_01": {
    "id": "helm_plate_01",
    "name": "制式钢盔",
    "type": "ARMOR",
    "slot": "head", 
    "price": 100,
    "buffs": [
      {
        "id": "passive_armor_head_30", 
        "name": "头部防护",
        "type": "BUFF",
        "effect": "STAT_MOD",
        "stat": "armor_head", // 专有属性：头部护甲上限
        "value": 30,
        "mode": "ADD",
        "duration": -1 // -1 表示装备期间永久生效
      },
      {
        "id": "passive_res_stun",
        "name": "坚毅",
        "type": "BUFF",
        "effect": "RESIST_CONTROL",
        "target": "stun",
        "duration": -1
      }
    ]
  },
  "wp_sword_great": {
    "id": "wp_sword_great",
    "name": "巨剑",
    "type": "WEAPON",
    "slot": "main_hand",
    "buffs": [
      {
        "type": "BUFF",
        "effect": "STAT_MOD",
        "stat": "attack",
        "value": 25,
        "mode": "ADD",
        "duration": -1
      }
    ]
  }
}
```

## 5. 关卡数据结构 (Level Data)

`assets/data/levels.json`

```json
{
  "level_1_2": {
    "id": "level_1_2",
    "name": "试炼场",
    "description": "模拟战斗训练。",
    "background": "bg_arena",
    "waves": [
      {
        "waveId": 1,
        "enemies": [
          { "templateId": "mob_assassin", "position": "center" }
        ]
      }
    ],
    "rewards": {
      "exp": 150,
      "gold": 80,
      "items": ["potion_hp_small"]
    }
  }
}
```

## 6. Buff/Debuff 系统设计 (Buff/Debuff System)

Buff (增益) 与 Debuff (减益) 是驱动战斗数值变化与状态流转的核心机制。
本系统将统一管理技能效果、装备属性、消耗品效果及环境影响。

### 6.1 核心字段定义

| 字段名 | 类型 | 描述 | 示例 |
| :--- | :--- | :--- | :--- |
| `id` | String | 唯一标识 (可选，内联时可忽略) | `buff_attack_up` |
| `name` | String | 显示名称 | `攻击力提升` |
| `type` | String | 类型 | `BUFF` (增益), `DEBUFF` (减益), `HIDDEN` (隐藏被动) |
| `effect` | String | 效果机制 | `STAT_MOD`, `DOT`, `HOT`, `CONTROL`... |
| `stat` | String | 关联属性 (当 effect=STAT_MOD) | `hp`, `maxHp`, `ap`, `speed`, `attack`, `armor_head`... |
| `value` | Number | 影响数值 | `10` |
| `mode` | String | 数值计算模式 | `ADD` (加法), `MULT` (乘法) |
| `duration` | Number | 持续回合数 | `3` (3回合), `-1` (永久/装备被动) |
| `trigger` | String | 触发时机 (DOT/HOT等需要) | `TURN_START`, `TURN_END`, `ON_HIT` |
| `icon` | String | 图标 | `??` |
| `description` | String | 描述文本 | `攻击力提升 10 点` |

### 6.2 常用效果枚举 (Effect Types)

*   **STAT_MOD**: 属性修正。直接改变角色的面板属性（如 HP上限、护甲上限、速度）。
*   **DOT (Damage Over Time)**: 持续伤害。在 `trigger` 时机扣除生命值。
*   **HOT (Heal Over Time)**: 持续治疗。在 `trigger` 时机恢复生命值。
*   **CONTROL**: 状态控制。如 `STUN` (跳过回合), `SILENCE` (无法使用技能)。
*   **SHIELD**: 护盾。优先消耗护盾值抵挡伤害。

### 6.3 示例 (JSON)

```json
{
  "buff_berserk": {
    "id": "buff_berserk",
    "name": "狂暴",
    "type": "BUFF",
    "effect": "STAT_MOD",
    "stat": "attack",
    "value": 0.5,
    "mode": "MULT",
    "duration": 3,
    "icon": "??",
    "description": "攻击力提升 50%"
  },
  "debuff_poison": {
    "id": "debuff_poison",
    "name": "剧毒",
    "type": "DEBUFF",
    "effect": "DOT",
    "value": 10,
    "trigger": "TURN_END",
    "duration": 5,
    "icon": "??",
    "description": "每回合结束时受到 10 点伤害"
  }
}
