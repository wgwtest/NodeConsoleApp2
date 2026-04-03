# 核心引擎设计说明书 (Core Engine Design)

## 1. 概述
本引擎旨在构建一个轻量级、数据驱动的网页游戏核心逻辑层。引擎完全基于 JavaScript (ES6+) 开发，负责管理游戏的主循环、状态流转、数据处理及事件分发。引擎与视图层（渲染）解耦，通过标准化的文本/JSON 接口进行交互。

## 2. 帧循环设计 (Game Loop)

虽然本游戏核心玩法为回合制，不依赖高频的物理模拟，但为了处理动画时序、UI更新及异步逻辑，仍采用标准的帧循环架构。

### 2.1 循环机制
采用 `requestAnimationFrame` 作为主驱动，辅以 `Delta Time` 计算以保证逻辑在不同帧率下的统一性。

```javascript
class GameLoop {
    constructor() {
        this.lastTime = 0;
        this.isRunning = false;
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame(this.loop.bind(this));
    }

    loop(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = (currentTime - this.lastTime) / 1000; // 秒为单位
        this.lastTime = currentTime;

        this.update(deltaTime);
        // render() 由视图层订阅 update 事件自行处理，引擎不直接调用渲染
        
        requestAnimationFrame(this.loop.bind(this));
    }

    update(dt) {
        // 更新全局状态机
        // 更新定时器/动画补间系统
        // 触发 'tick' 事件
    }
}
```

## 3. 游戏流程设计 (Finite State Machine)

游戏全局流程由一个有限状态机 (FSM) 管理，确保游戏在任意时刻处于单一且明确的状态。

### 3.1 核心状态定义

| 状态名称 | 描述 | 允许流转至 |
| :--- | :--- | :--- |
| **INIT** | 引擎初始化，加载核心配置 | LOGIN |
| **LOGIN** | 玩家登录/注册界面 | MAIN_MENU |
| **MAIN_MENU** | 主菜单（查看状态、背包、设置） | LEVEL_SELECT, LOGIN |
| **LEVEL_SELECT** | 关卡选择界面 | BATTLE_PREPARE, MAIN_MENU |
| **BATTLE_PREPARE** | 战斗前准备（调整装备/技能） | BATTLE_LOOP, LEVEL_SELECT |
| **BATTLE_LOOP** | 核心战斗循环（回合制逻辑） | BATTLE_SETTLEMENT |
| **BATTLE_SETTLEMENT** | 战斗结算（胜利/失败/掉落） | LEVEL_SELECT, MAIN_MENU |

### 3.2 状态机接口
```javascript
class GameFSM {
    changeState(newState, params = {}) {
        // 1. 触发当前状态的 onExit()
        // 2. 更新 currentState
        // 3. 触发新状态的 onEnter(params)
        // 4. 发布 STATE_CHANGED 事件
    }
}
```

### 3.3 关卡开始时的状态重置规则 (Level Initialization & State Reset)

[新增项] 当玩家进入新关卡（从 `LEVEL_SELECT` 或 `MAIN_MENU` 进入 `BATTLE_PREPARE` / `BATTLE_LOOP`）时，玩家的运行时状态将按照以下规则进行强制重置。此机制确保了每次闯关的独立性，避免因上一局残留的低HP导致的死局。

1.  **HP / 生命值**:
    *   重置为 `maxHp`。
2.  **AP / 行动力**:
    *   重置为 `maxAp`。
3.  **身体部位 / Body Parts (护甲)**:
    *   **玩家部位**: 根据当前装备的 `maxDurability` (或部位定义的 `max` 值) 重置 `current` 值。
    *   **状态**: 所有部位状态重置为 `NORMAL`。
4.  **Buffs / 状态效果**:
    *   清空所有临时 Buffs 和 Debuffs。
5.  **技能冷却 (Cooldowns)**:
    *   重置所有技能的 CD。

### 3.4 状态机接口
```javascript
class GameFSM {
    changeState(newState, params = {}) {
        // 1. 触发当前状态的 onExit()
        // 2. 更新 currentState
        // 3. 触发新状态的 onEnter(params)
        // 4. 发布 STATE_CHANGED 事件
    }
}
```

## 4. 事件系统设计 (Event System)

采用 **发布-订阅 (Publish-Subscribe)** 模式作为模块间通信的核心，实现逻辑层与视图层的彻底解耦。

### 4.1 核心机制
*   **EventBus**: 全局单例，负责事件的注册、注销与分发。
*   **事件命名规范**: `MODULE:ACTION` (例如 `BATTLE:ATTACK_START`, `UI:BUTTON_CLICK`)。

### 4.2 接口定义
```javascript
class EventBus {
    on(event, callback, context) { ... }
    off(event, callback) { ... }
    emit(event, payload) { ... }
}
```

## 5. 数据对象设计 (Data Schema)

所有游戏实体均为纯数据对象 (POJO)，逻辑方法分离在对应的 System/Manager 中。

### 5.1 角色对象 (Character)
```json
{
  "id": "char_001",
  "name": "王国骑士",
  "type": "PLAYER", // 或 ENEMY
  "stats": {
    "hp": 150,
    "maxHp": 150,
    "ap": 4,        // 行动力
    "maxAp": 6,
    "speed": 12     // 决定出手顺序
  },
  "equipment": {
    "weapon": "wp_sword_01",
    "armor": {
      "head": { "id": "helm_01", "durability": 30, "maxDurability": 30, "defense": 5 },
      "chest": { "id": "plate_01", "durability": 60, "maxDurability": 60, "defense": 15 }
    }
  },
  "skills": {
    "skillTreeId": "tree_knight_v1",
    "skillPoints": 3,
    "learned": ["skill_slash", "skill_defend"]
  },
  "buffs": []
}
```

**字段说明（技能相关）**
- `skills.skillTreeId`: 绑定当前角色使用的技能树模板 ID（静态配置）。
- `skills.skillPoints`: 当前可用技能点。
- `skills.learned`: 已学习技能 ID 列表，用于战斗与 UI 读取。

**学习判定（来自技能数据）**
- `skills_melee_v4_5.json` 中每个技能包含：`prerequisites` 与 `unlock.cost.kp`。
- **已学习**：`skills.learned` 中包含该 `skillId`。
- **可学习**：未学习且 `prerequisites` 全满足，且 `skills.skillPoints >= unlock.cost.kp`。
- **互斥**：若 `unlock.exclusives` 中包含已学习技能，则禁止学习。

**技能树静态结构（独立配置）**
技能树关系不放在角色对象中，建议在技能配置或独立 `skill_tree.json` 中维护：
```json
{
  "id": "tree_knight_v1",
  "nodes": [
    { "nodeId": "node_slash_01", "skillId": "skill_slash", "prerequisites": [] },
    { "nodeId": "node_defend_01", "skillId": "skill_defend", "prerequisites": ["node_slash_01"] }
  ]
}
```

### 5.2 物品对象 (Item)
```json
{
  "id": "wp_sword_01",
  "type": "WEAPON",
  "name": "铁剑",
  "effects": [
    { "type": "DAMAGE_PHYSICAL", "value": 20 }
  ]
}
```

### 5.3 场景/关卡对象 (Scene/Level)
```json
{
  "id": "level_1_1",
  "name": "幽暗森林边缘",
  "backgroundId": "bg_forest_01",
  "enemies": [
    { "enemyId": "goblin_01", "position": 1 }
  ],
  "rewards": {
    "exp": 100,
    "gold": 50,
    "dropTable": "drop_forest_easy"
  }
}
```

## 6. 数据配置设计 (Data Configuration Design)

为了实现游戏状态的实时保存与加载（Save/Load），我们需要定义一个统一的数据结构 `DataConfig`。该结构包含游戏运行时的所有动态数据。

### 6.1 数据结构总览
`DataConfig` 分为三个主要部分：
1.  **GlobalData**: 全局持久化数据（玩家属性、背包、进度）。
2.  **RuntimeData**: 运行时临时数据（当前战斗状态、场景状态）。
3.  **Settings**: 系统设置（音量、按键）。

```json
{
  "version": "1.0.0",
  "timestamp": 1703856000000,
  "global": { ... },
  "runtime": { ... },
  "settings": { ... }
}
```

### 6.4 静态数据加载策略：Fail-Fast（移除 Mock Fallback）

`DataManagerV2.loadConfigs()` 是本阶段的静态数据加载入口。为避免“加载失败被隐藏”而产生误判（例如表现为：关卡/技能名称乱码、数据结构似乎不一致、UI 显示异常，但真实原因其实是某个 JSON 为空/格式错误/404/字段结构不符合约定），本项目在当前阶段采用如下策略：

- **Fail-fast**：只要任一数据源加载、JSON 解析或结构校验失败，就直接报错并抛出异常，中止初始化。
- **移除 mock fallback**：不再在加载失败时自动切换到内置 mock 数据，因为这会把“加载问题”伪装成“业务逻辑或数据内容问题”，显著增加定位成本。

**实现约定 (Implementation Notes)**
- `loadConfigs()` 失败时：
  - `gameConfig` 会被置为空对象 `{}`（避免残缺数据继续运行）。
  - 通过 `throw` 将异常抛出，交由上层/控制台直接暴露。
- `loadMockConfigs()`：已改为直接 `throw`，用于防止误调用。

**推荐排查流程 (Recommended Debug Flow)**
1. 打开浏览器 DevTools Console，查看 `DataManagerV2.loadConfigs()` 抛出的异常与堆栈（通常会指向具体的 URL 或解析失败位置）。
2. 打开 Network，确认 `assets/data/config.json` 与 `sources.*` 里配置的每个 URL：
   - HTTP 状态为 200
   - Response 是合法 JSON（不是空文件、不是 HTML 错误页）
3. 如果使用了本地编辑器修改过 JSON，优先检查：是否存在空文件、尾部多逗号、或非 UTF-8 编码导致的解析异常。


---

## 7. 战斗规则：行动槽位布局 (Battle Rules: Action Slot Layout)

### 7.1 设计目标

行动槽位（Slot）是战斗机制的核心约束：它限制“每回合在不同目标/部位上可规划的技能数量”。

为保证**引擎逻辑**与**UI 展示**一致，槽位容量不再由静态 DOM 决定，而由数据驱动：
- 规则来自 `slot_layouts.json`（可复用模板）。
- 关卡通过 `levels.json -> battleRules.slotLayoutId` 选择布局。
- 若关卡未指定，则使用 `config.json -> battleRules.slotLayoutId` 默认值。

### 7.2 数据加载

`DataManagerV2.loadConfigs()` 额外加载 `sources.slotLayouts`，存入：
- `gameConfig.slotLayouts`

### 7.3 规则解析优先级

当进入战斗（`startBattle()`）后，当前战斗使用的 `slotLayoutId` 按以下优先级解析：
1. `levels[levelId].battleRules.slotLayoutId`
2. `dataConfig.battleRules.slotLayoutId`（来自 `config.json`）
3. fallback：`default_v1`

### 7.4 运行态快照（用于回放/一致性）

战斗开始时将规则写入运行态（建议视为本场战斗的不可变快照）：
- `runtime.battleRules.slotLayoutId`
- `runtime.battleRules.slotLayout`（深拷贝布局对象）

这样可以避免后续热更新/数据变更导致同一存档在不同版本下产生不一致的槽位约束。

### 7.5 机制约束：入队校验

在 `addSkillToQueue(skillId, targetId, bodyPart)` 中，除 AP 校验外，增加槽位容量校验：
- 计算该 action 对应的 `side`（`self` / `enemy`）与 `bodyPart`
- 查询 `slotCounts[bodyPart][side]` 得到容量
- 统计当前队列中同 `side+bodyPart` 的已用数量
- 若已满，则拒绝入队并通过 `BATTLE_LOG` 输出原因

> 注：这使“槽位”从 UI 展示限制升级为引擎级规则，AI 与玩家同源约束。

### 6.2 ?洢??汾??????? (Save/Load Version Guard)

???????????迭?????? `player.json` / `skills_*.json` / `buffs_*.json` / `config.json` ??????????
???????????????????/????????Ч????????????? **?洢????汾????**??

**????**
*   `assets/data/config.json` ?е? `version` ??? **???????汾** (data sources version)
*   ??α??? `save_game` ???д?? `dataSourcesVersion`
*   `loadGame()` ????? `save_game.dataSourcesVersion` ?? `config.json.version`
    *   **?????**???Ч?洢?档?????????? `false` ??????? "save invalid" ?? UI ?????????????

**?洢?????**
```json
{
  "version": "1.0.0",
  "dataSourcesVersion": "data_sources_v1",
  "timestamp": 1703856000000,
  "global": { "player": { ... } },
  "runtime": { ... },
  "settings": { ... }
}
```

**?????????**
*   ????：
    *   `login()` ??? `loadGame()` ????????????й????
    *   ??汾??????????洢????
    *   ??汾???????????? UI ?? "?????????" / "?????????"（??????ο? UI ????
*   ????：
    *   `createNewGame()` ???? `player.json.default` ?????壬???????????
    *   ???????洢?????????????????????????? `save_game`

### 6.2 GlobalData (全局存档数据)
这部分数据在游戏整个生命周期中持续存在，是存档的核心。

```json
{
  "player": {
    "id": "player_001",
    "name": "Hero",
    "stats": { "hp": 100, "maxHp": 100, "ap": 4, "maxAp": 6, "speed": 10 },
    "equipment": { 
        "weapon": "sword_01", 
        "armor": { 
            "head": { "itemId": "helm_01", "durability": 25 },
            "chest": { "itemId": "plate_01", "durability": 50 }
        } 
    },
    "skills": ["skill_slash", "skill_heal"],
    "inventory": [
      { "itemId": "potion_hp", "count": 5 },
      { "itemId": "material_iron", "count": 2 }
    ]
  },
  "progress": {
    "unlockedLevels": ["level_1", "level_2"],
    "completedQuests": ["quest_001"],
    "flags": { "has_met_guide": true }
  }
}
```

### 6.3 RuntimeData (运行时状态)
这部分数据用于记录“当前正在发生的事情”。为了支持战斗中断后的完美恢复（Resume），我们需要记录战斗的初始配置、当前动态状态以及历史回溯信息。

```json
{
  "currentScene": "BATTLE_LOOP", // 或 "MAIN_MENU", "LEVEL_SELECT"
  "battleState": {
    "levelId": "level_1_1",
    "turnCount": 3,
    "phase": "PLANNING", // PLANNING (配置阶段) 或 EXECUTION (执行阶段)
    
    // 1. 初始状态快照 (Initial State Snapshot)
    // 用于重置战斗或计算某些基于初始值的百分比
    "initialState": {
      "enemies": [
        { "instanceId": "enemy_1", "templateId": "goblin", "maxHp": 50, "stats": { ... } }
      ]
    },

    // 2. 当前动态状态 (Current Dynamic State)
    // 记录战斗中实时变化的数值
    "enemies": [
      { 
        "instanceId": "enemy_1", 
        "templateId": "goblin", 
        "hp": 20, 
        "maxHp": 50, 
        "position": 1, 
        "buffs": [
           { "id": "buff_burn", "duration": 2, "sourceId": "player_001" }
        ],
        // 护甲/部位状态 (支持部位破坏)
        "bodyParts": {
           "head": { "armor": 0, "maxArmor": 0, "weakness": 1.5, "status": "NORMAL" },
           "body": { "armor": 5, "maxArmor": 10, "weakness": 1.0, "status": "NORMAL" }
        }
      }
    ],
    
    // 玩家在战斗中的临时状态 (如临时Buff，非永久属性变更)
    "playerBattleState": {
        "buffs": [],
        "tempStatModifiers": { "speed": 2 },
        // [新增] 玩家部位状态 (从装备映射而来)
        // 映射逻辑: maxArmor = 装备maxDurability, armor = 装备currentDurability
        "bodyParts": {
           "head": { "armor": 25, "maxArmor": 30, "weakness": 1.0, "status": "NORMAL" },
           "body": { "armor": 50, "maxArmor": 60, "weakness": 1.0, "status": "NORMAL" }
        }
    },

    // 3. 行动队列 (Action Queues)
    // 记录当前回合双方已配置但未执行的技能
    "queues": {
        "player": [
            { "skillId": "skill_slash", "targetId": "enemy_1", "bodyPart": "body", "cost": 2 }
        ],
        "enemy": [
            // 在 EXECUTION 阶段前生成
        ]
    },

    // 4. 历史记录 (History)
    // 记录过去回合的完整行为与结果，用于战斗回放、逻辑校验或撤销操作
    "history": [
        {
            "turn": 1,
            "timestamp": 1703856000000,
            "seed": "rng_seed_x8s7", // 用于复现随机结果
            
            // [新增] 回合开始时的简要状态快照，用于快速恢复/回放定位
            "snapshot": {
                "player": { "hp": 100, "ap": 4 },
                "enemies": [
                    { "id": "enemy_1", "hp": 50, "pos": 1 }
                ]
            },

            // [新增] 回合开始/结束时的系统结算（非角色主动行为）
            "systemEvents": [
                { "type": "BUFF_TICK", "targetId": "enemy_1", "buffId": "poison", "value": -5 },
                { "type": "BUFF_EXPIRE", "targetId": "player_001", "buffId": "shield" }
            ],

            "actions": [
                {
                    "order": 1,
                    "sourceId": "player_001",
                    "skillId": "skill_slash",
                    "targetId": "enemy_1",
                    "bodyPart": "body",
                    "result": {
                        "isHit": true,
                        "isCrit": false,
                        "damage": 15,
                        "targetHpRemaining": 35,
                        "armorDamage": 5,
                        "addedBuffs": []
                    }
                },
                {
                    "order": 2,
                    "sourceId": "enemy_1",
                    "skillId": "skill_bite",
                    "targetId": "player_001",
                    "result": {
                        "isHit": true,
                        "damage": 5,
                        "targetHpRemaining": 95
                    }
                }
            ]
        }
    ]
  }
}
```

### 6.4 Settings (系统设置)
```json
{
  "audio": { "bgmVolume": 0.8, "sfxVolume": 1.0 },
  "display": { "showDamageNumbers": true }
}
```

## 7. 数据管理设计 (Data Management)

### 7.1 数据存储 (Persistence)
*   **用户存档**: 使用 `localStorage` 或 `IndexedDB` 存储用户的进度、背包、角色状态。
*   **格式**: JSON 字符串序列化 `DataConfig` 对象。
*   **自动保存**: 在 `BATTLE_SETTLEMENT` 和关键状态切换时触发。

### 7.2 静态数据加载 (Asset Loader)
为了支持数据驱动的开发模式，游戏的核心配置（关卡、敌人、技能、物品）将从外部 JSON 文件加载，而非硬编码在代码中。

#### 7.2.1 数据加载入口（config.json / data_sources.json）
为避免资源路径硬编码，推荐新增一个独立的加载入口文件（如 `assets/data/config.json` 或 `assets/data/data_sources.json`），用于声明所有数据文件路径。加载顺序固定为：先读入口文件，再按其配置加载各数据源。

**示例结构：**
```json
{
  "version": "data_sources_v1",
  "basePath": "./assets/data/",
  "sources": {
    "skills": "skills.json",
    "items": "items.json",
    "enemies": "enemies.json",
    "levels": "levels.json",
    "player": "player.json",
    "buffs": "buffs.json"
  }
}
```

**字段说明：**
- `basePath`：默认数据根路径（可选，若为空则使用入口文件所在目录）。
- `sources`：各数据类型的相对路径或绝对路径。
- `version`：入口文件版本号，用于后续兼容与迁移。

#### 7.2.2 目录结构
推荐目录组织如下（示例）：
```
assets/data/
├── config.json       # 数据加载入口
├── skills.json       # 技能定义
├── items.json        # 物品定义
├── enemies.json      # 敌人模板定义
├── levels.json       # 关卡流程定义
├── player.json       # 玩家初始配置
└── buffs.json        # Buff 定义
```

#### 7.2.3 JSON 配置规范

**1. 玩家配置 (player.json)**
定义玩家初始状态。
```json
{
    "default": {
        "stats": {
            "hp": 100,
            "maxHp": 100,
            "ap": 4,
            "maxAp": 6,
            "speed": 10
        },
        "skills": ["skill_slash", "skill_heal", "skill_fireball"],
        "equipment": {
            "weapon": null,
            "armor": { "head": null, "chest": null }
        },
        "inventory": []
    }
}
```

**2. 敌人模板 (enemies.json)**
定义敌人的基础属性、技能和部位结构。
```json
{
  "goblin_scout": {
    "id": "goblin_scout",
    "name": "哥布林斥候",
    "stats": {
      "hp": 50,
      "maxHp": 50,
      "speed": 12,
      "ap": 3
    },
    "skills": ["skill_bite", "skill_throw_stone"],
    "bodyParts": {
      "head": { "maxArmor": 0, "weakness": 1.5 }, // weakness: 伤害倍率
      "body": { "maxArmor": 5, "weakness": 1.0 }
    },
    "dropTable": "drop_goblin_common"
  },
  "orc_warrior": {
    "id": "orc_warrior",
    "name": "兽人战士",
    "stats": { "hp": 120, "maxHp": 120, "speed": 8, "ap": 4 },
    "skills": ["skill_smash", "skill_warcry"],
    "bodyParts": {
      "head": { "maxArmor": 10, "weakness": 1.2 },
      "body": { "maxArmor": 20, "weakness": 0.8 }
    }
  }
}
```

**3. 关卡配置 (levels.json)**
定义关卡的结构、敌人波次和奖励。
```json
{
  "level_1_1": {
    "id": "level_1_1",
    "name": "幽暗森林边缘",
    "description": "森林外围，常有哥布林出没。",
    "background": "bg_forest_01",
    "waves": [
      {
        "enemies": [
          { "templateId": "goblin_scout", "position": 1 },
          { "templateId": "goblin_scout", "position": 2 }
        ]
      }
    ],
    "rewards": {
      "exp": 100,
      "gold": 50,
      "firstClearBonus": { "itemId": "wp_dagger_01", "count": 1 }
    }
  }
}
```

#### 7.2.4 加载流程
1.  **初始化阶段 (`INIT`)**: `DataManager` 先加载入口文件（`config.json` 或 `data_sources.json`）。
2.  **解析与缓存**: 解析 `basePath` 与 `sources`，并并行请求配置中列出的所有 JSON 数据文件。
3.  **实例化**: 进入战斗时，根据 `levels.json` 中的 `templateId` 从 `enemies.json` 查找模板，深拷贝生成运行时的敌人实例。

#### 7.2.5 新版技能数据加载与展示方案（skills_melee_v4_5.json）
为适配新版技能数据结构（`{ meta, skills: [...] }`），加载阶段需进行一次“归一化映射”，并明确 UI 展示依赖字段。

**输入结构（示例）**
```json
{
  "$schemaVersion": "skills_melee_v3",
  "meta": { "defaultParts": ["head", "chest", "abdomen", "arm", "leg"] },
  "skills": [
    {
      "id": "skill_heavy_swing",
      "name": "重锤",
      "speed": 0,
      "target": { "subject": "SUBJECT_ENEMY", "scope": "SCOPE_PART" },
      "requirements": {},
      "costs": { "ap": 2, "partSlot": { "part": "arm", "slotCost": 2 } },
      "tags": ["DMG_HP", "SCALING", "SUBJECT_ENEMY", "SCOPE_PART"]
    }
  ]
}
```

**加载归一化规则（必须）**
1. 将 `skills` 数组转换为 `id -> skill` 的字典（Map），作为引擎运行时的 `gameConfig.skills`。
2. 仅支持新版结构；若不满足 `{ skills: [...] }` 形态，应直接报错或拒绝加载（不再兼容旧版字典结构）。
3. 若 `player.json` 中的 `skills` 列表包含不存在的 `skillId`，必须输出告警日志（以便快速定位配置问题）。

**UI 展示依赖字段（核心映射）**
- 名称：`skill.name`
- AP 消耗：`skill.costs.ap`
- 目标信息：`skill.target.subject` / `skill.target.scope` / `skill.target.selection`
- 约束：`skill.requirements`
- 槽位消耗：`skill.costs.partSlot`
- 语义类型（用于图标/样式）：基于 `skill.tags` 推导（如 `DMG_HP` / `HEAL` / `BUFF_APPLY`）

**与玩家技能列表对齐**
- `player.json` 中的 `skills` 必须使用新版 `skills[].id`。
- 若存在旧 `skill_slash` 等 ID，需在数据层先做迁移或替换。

### 7.3 运行时缓存 (Runtime Cache)
*   **DataManager**: 维护当前活跃的游戏对象实例，避免频繁反序列化。

## 8. 游戏流程详述

### 8.1 登录阶段
1.  **输入**: 用户名/密码 (或点击“开始游戏”)。
2.  **处理**: 检查本地存档，若无则创建新存档 (New Game)，若有则读取 (Load Game)。
3.  **输出**: 玩家基础数据对象，跳转至 `MAIN_MENU`。

### 8.2 关卡选择
1.  **输入**: 玩家点击关卡节点 ID。
2.  **处理**: 校验前置关卡是否通关，校验体力/消耗品。
3.  **输出**: 关卡配置数据，跳转至 `BATTLE_PREPARE`。

### 8.3 战斗场景 (核心循环)
1.  **初始化**: 加载场景资源，实例化玩家与敌人对象。
2.  **回合开始**:
    *   恢复 AP，结算持续性效果 (DOT/HOT)。
    *   进入 **技能配置阶段 (Planning Phase)**。
3.  **技能配置阶段**:
    *   **玩家输入**:
        *   `addSkillToQueue(skillId, targetId, targetBodyPart?)`: 
            *   **技能类型校验**: 
                *   **攻击技能**: 必须指定敌方目标的具体部位 (如 `head`, `body`)，除非技能定义为AOE或自动索敌。
                *   **治疗/增益技能**: 必须指定己方目标的具体部位 (如修复头盔护甲)，除非技能定义为全局回复。
                *   **通用技能**: 部分技能 (如全局Buff、姿态切换) 不需要指定部位。
            *   **合法性校验**: 检查 AP 是否足够，检查目标部位是否存在/已毁坏 (视技能逻辑而定)。
        *   `removeSkillFromQueue(index)`: 从队列中移除技能 (返还占用 AP)。
        *   `commitPlanning`: 确认技能配置完成，并立即构建本回合时间轴（进入 `Timeline READY`，用于预览）。
    *   **敌人AI**: 在玩家确认（commitPlanning）后，AI 生成敌方技能队列，并与我方队列一起用于构建时间轴预览。
    *   **预览**: 提交后，UI 立即在 `timeline labeled-block` 中展示本回合行动顺序（不自动开始执行）。
    *   **状态流转**: 玩家点击“执行”后，进入 **技能释放阶段 (Execution Phase)**。
4.  **技能释放阶段**:
    *   **排序**: `commitPlanning` 时已将双方队列合并并生成本回合 `ActionTimeline`（时间轴处于 `READY`），执行阶段直接按该顺序播放/结算。
    *   **执行循环**:
        *   按顺序取出下一个技能行动。
        *   **处理**: 执行技能逻辑，计算命中/暴击/伤害/护甲损耗。
        *   **状态检查**: 每次造成伤害后立即调用 `checkBattleStatus()`。若战斗结束，中断循环。
        *   **输出**: `BATTLE_LOG` 事件 (包含伤害数值、状态变更)。
        *   **延迟**: 每个技能之间预留时间间隙供前端播放动画。
5.  **回合结束**: 所有技能执行完毕后，循环至“回合开始”。

> 交互约束（与 UI 对齐）
> - “提交规划”：只负责生成/刷新时间轴预览（`Timeline READY`）。
> - “执行”：只负责从 `Timeline READY/PAUSED` 开始播放（`Timeline PLAYING`）。
> - “重置”：清空技能槽规划 + 行动队列 + 时间轴（回到 `Timeline IDLE`），用于重新配置。

### 8.4 结算阶段
当 `checkBattleStatus()` 检测到满足结束条件时触发：
1.  **判定条件**:
    *   **胜利**: 所有敌人 HP <= 0。
    *   **失败**: 玩家 HP <= 0。
2.  **处理逻辑**:
    *   **胜利**: 发放经验、金币、掉落物，更新存档进度。
    *   **失败**: 显示重试或返回菜单选项。
3.  **输出**: 
    *   发布 `BATTLE_END` 事件 (包含 `{ victory: boolean }`)。
    *   跳转至 `BATTLE_SETTLEMENT` 状态，等待玩家确认。

## 9. 引擎输入输出接口规范 (I/O Interface)

引擎不直接操作 DOM，而是通过标准接口与 UI 层交互。

### 9.1 输入接口 (Input)
UI 层调用引擎暴露的方法：
*   `Engine.input.login(username)`
*   `Engine.input.selectLevel(levelId)`
*   `Engine.input.addSkillToQueue(skillId, targetId, targetBodyPart)`
    *   `targetBodyPart`: 可选。对于攻击/治疗特定部位的技能必填 (例如 "head", "body")。
*   `Engine.input.removeSkillFromQueue(index)`
*   `Engine.input.commitTurn()`
*   `Engine.input.confirmSettlement()`: 在结算界面点击确认后调用，返回主菜单或关卡选择。

### 9.2 输出接口 (Output)
UI 层监听引擎发布的事件：
*   `Engine.on('STATE_CHANGED', (state) => { ... })`
*   `Engine.on('BATTLE_LOG', (log) => { console.log(log.text); renderEffect(log); })`
*   `Engine.on('DATA_UPDATE', (data) => { updateUI(data); })`
*   `Engine.on('BATTLE_UPDATE', (data) => { updateBattleUI(data); })`
*   `Engine.on('BATTLE_END', (result) => { showResult(result.victory); })`
