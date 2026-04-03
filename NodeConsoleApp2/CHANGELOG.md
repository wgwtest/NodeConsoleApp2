此文件解释 Visual Studio 如何创建项目。

以下为生成此项目的步骤:
- 创建项目文件 (`NodeConsoleApp2.esproj`)。
- 创建 `launch.json` 以启用调试。
- 安装 npm 包: `npm init && npm i --save-dev eslint`。
- 创建 `app.js`。
- 更新 `package.json` 入口点。
- 创建 `eslint.config.js` 以启用 Lint 分析。
- 向解决方案添加项目。
- 写入此文件。

# 引擎更新日志

## [未发布] - 2025-12-30

### 新增
- **高级战斗持久化**: 实现了一个健壮的系统来保存和恢复战斗的精确状态。
    - **运行时数据结构**: 扩展了 `DataConfig.runtime` 以包含：
        - `initialState`: 战斗开始时敌人的快照。
        - `history`: 每一回合的详细日志，包括状态快照、系统事件和详细的行动结果。
        - `queues`: 持久化当前回合玩家和敌人计划的行动。
        - `playerTempState`: 存储临时的战斗特定玩家属性和增益。
    - **历史记录追踪**: 现在每一回合都会记录一个包含时间戳、种子和状态快照的完整历史条目。
    - **行动记录**: 战斗行动现在是历史日志中的结构化对象，包含详细结果（伤害、命中/未命中等），而不仅仅是文本字符串。

### 变更
- **DataManager**:
    - 更新了 `saveGame` 以同步新的复杂运行时数据结构。
    - 更新了模拟关卡配置，为敌人包含 `bodyParts`，以支持新的伤害系统设计。
- **CoreEngine**:
    - `startBattle`: 现在初始化全面的运行时状态（历史记录、队列、快照）。
    - `startTurn`: 为历史日志捕获状态快照。
    - `executeTurn`: 将结构化的行动结果记录到历史日志中。
    - `saveGame`: 现在在保存到存储之前正确同步战斗状态（包括队列和历史记录）。
    - `resumeBattle`: 从保存的运行时数据恢复行动队列和战斗状态。
    - `endBattle`: 清理所有临时战斗运行时数据以保持存档文件整洁。

### 修复
- 修复了在战斗中重新加载游戏会丢失当前回合进度和敌人状态的问题。
- 修复了重新加载游戏后，技能按钮可能保持禁用状态的问题（通过调整 `DATA_UPDATE` 和 `BATTLE_UPDATE` 的触发顺序）。

### 变更 (2025-12-31)
- **数据驱动配置**:
    - 引入了 JSON 配置文件系统，位于 `assets/data/` 目录下 (`skills.json`, `items.json`, `enemies.json`, `levels.json`)。
    - `DataManager` 现在尝试从这些 JSON 文件加载游戏配置，如果加载失败（如本地文件协议限制），则回退到内置的模拟数据。
    - 实现了 `instantiateLevel` 方法，支持从 `levels.json` 定义的波次和 `enemies.json` 定义的模板动态生成战斗关卡和敌人实例。
- **CoreEngine**:
    - 更新了 `selectLevel` 方法，使用 `instantiateLevel` 来生成关卡数据，确保每次进入关卡都是全新的状态。

### 变更 (2026-01-10) - 数据架构升级
- **数据设计标准化**:
    - 创建了 `DOC/CODEX_DOC/02_设计说明/02-数据结构(data_design)-设计说明.md`，统一了游戏核心数据结构。
    - **身体部位 (Body Parts)**: 将所有角色（玩家和敌人）的身体部位统一扩展为 7 个部位（头部、胸部、腹部、双臂、双腿）。
    - **装备系统重构**: 装备不再直接定义属性，而是作为 **Buff 容器**。通过装备携带的 `duration: -1` (常驻) Buff 来动态修改角色属性（如 `armor_head`）。
    - **Buff/Debuff系统**: 确立了通用的 Buff 数据结构，支持属性修正(STAT_MOD)、持续伤害(DOT)等效果。

- **CoreEngine**:
    - 重写了 `initializePlayerBodyParts` 方法：
        - 实现了 7 部位系统的初始化。
        - 实现了基于 Buff 的属性计算逻辑：现在通过遍历装备的 `buffs` 列表来计算各部位的护甲值。
    
- **数据文件更新**:
    - **enemies.json**: 更新所有敌人模板，使其包含完整的 7 个身体部位定义。
    - **items.json**: 重构装备数据，移除旧的 `defense`/`durability` 字段，改为使用 `buffs` 数组定义属性加成。
    - **player.json**: 简化 `equipment` 结构，现在仅存储部位与 ItemID 的映射关系。

- **UI Adaptations (v11)**:
    - **mock_ui_v11.html**:
        - 更新了玩家和敌人 HUD 的 `armor-list-wrapper`，添加了标准的 `data-key` 属性 (如 `left_arm`, `chest`) 以匹配数据设计。
    - **UI_BattleRow.js**:
        - 更新了 `updateArmor` 方法，优先读取 DOM 元素的 `data-key` 属性来查找对应的护甲数据，提高了 UI 绑定的准确性，并不再依赖中文文本匹配。
    - **UI_SkillPanel.js**:
        - 增强了 `initMatrixRows` 逻辑，现在能正确读取 `enemies.json` 中的 `bodyParts` 结构（包含 max/maxHp check），并根据数据隐藏或禁用缺失部位的技能槽位。
    - **CoreEngine Fixes**:
        - 修正了 `emitBattleUpdate` 和 `startBattle` 中的数据载荷，明确将运行时的 `bodyParts` 状态注入到 `player` 数据对象中，解决了 UI 无法显示玩家护甲的问题。
        - 更新了 `executePlayerSkill` 和 `executeEnemySkill` 中的伤害计算逻辑，从旧的 `armor` 字段迁移到了新的 `current/max` 结构。
        - 移除了过时的装备耐久度回写逻辑，符合新的“装备即Buff”设计。
    - **DataManager**:
        - 更新 `createNewGame` 方法，确保新创建的玩家数据包含从模板拷贝的 `bodyParts`。
        - 更新 `instantiateLevel` 方法，正确适配新的敌人 `bodyParts` 结构 (初始化 `current` = `max`)。
        - 更新模拟数据 `loadMockConfigs` 以符合新的数据字段标准。
    - **Data Design & Player Schema**:
        - `02-数据结构(data_design)-设计说明.md`: 明确了玩家 Schema 中需包含完整的 7 身体部位定义。
        - `player.json`: 更新了默认玩家配置，加入了完整的 7 身体部位（初始值为0），作为基础属性。
        - `CoreEngine`: 更新 `initializePlayerBodyParts` 这里优先使用 `player.json` 中定义的部位数据（如果存在），再在此基础上应用装备的 Buff 加成。

### 变更 (2026-01-11)
- **DataManager 增强**:
    - **加载策略**: 实现了"优先加载 JSON -> 失败回退到 Mock 数据"的健壮机制。
    - **错误处理**: 在 `loadConfigs` 中增加了对 `fetch` 响应状态 (HTTP 404 等) 的显式检查，确保文件读取失败时能被正确捕获。
    - **日志系统**: 改进了控制台输出，清晰标记当前数据来源（Success/Fallback）及失败原因，便于调试。
- **UI_BattleRow Fix**:
        - 修复了 `update` 方法中的判断逻辑。现在能正确根据 `data.bodyParts` 的存在与否来触发 `updateArmor`，解决了数据结构更新后护甲面板不刷新的 BUG。

### 修复 (2026-01-xx) - 战斗状态与持久化
- **战斗状态重置**: 
    - 修复了 F5 刷新或重新进入战斗时，玩家 HP/AP 继承上次战斗结束状态（导致“血量持续减少”）的问题。
    - 在 `CoreEngine.startBattle` 中实现了强制状态重置逻辑：
        - 玩家 HP 重置为 MaxHP。
        - 玩家 AP 重置为 MaxAP。
        - 玩家所有身体部位 (Body Parts) 的耐久度修复为最大值，状态重置为 NORMAL。

### 修复 (2026-01-18) - Buff Editor v3 测试器
- **UI 独立滚动**: 为 `test/buff_editor_v3.html` 增加 `#app` 的 flex 高度约束并禁用 `body` 自身滚动，避免页面整体被内容撑高导致三列无法独立滚动。
- **Enemy 状态不刷新**: 修复 `test/buff_editor_v3.html` 中 enemies 面板 HP 不更新的问题：
    - 统一 enemy 运行时血量存储到 `stats.hp/maxHp` 并保持 `hp/maxHp` 同步。
    - enemies 面板显示优先读取 `stats.hp/maxHp`（回退到 `hp/maxHp`）。
    - `castAttack` 在扣血后同步 `target.stats.hp` 与 `target.hp`，避免 BuffSystem 与模拟攻击写入不同字段导致 UI 不刷新。
