# 本地存档设计说明 (Local Save Design)

最后更新：2026-04-07

## 0. 文档职责

本文只回答四个问题：

1. 当前工程的本地存档键到底有哪些
2. 这些键在什么时机读写
3. 哪些用户操作会触发自动存档或手动存档
4. 当前实现还缺什么，后续应该怎样演进

本文以“当前真实实现”为准，不再混写改造前的旧行为。

## 1. 当前实现真源

当前本地存档系统的主依据如下：

1. `script/engine/DataManagerV2.js`
2. `script/engine/CoreEngine.js`
3. `script/ui/UI_SystemModal.js`
4. `script/ui/UI_SkillTreeModal.js`
5. `test/codex_regression_runner.html`

职责分层如下：

1. `DataManagerV2.js`
   - 负责键模型、序列化、反序列化、槽位元数据提取
2. `CoreEngine.js`
   - 负责决定“什么操作应该落盘”
   - 负责统一保存协调入口 `requestSave(...)`
3. `UI_SystemModal.js`
   - 负责把登录页、存档页、读档页呈现成用户可理解的入口
4. `UI_SkillTreeModal.js`
   - 负责技能学习提交流程中的保存触发
5. `test/codex_regression_runner.html`
   - 负责固定当前存档边界，防止后续回归

## 2. 当前落盘模型

### 2.1 当前使用的 localStorage 键

| Key | 当前语义 | 读写方式 |
| --- | --- | --- |
| `save_game` | 自动存档槽位，同时也是当前工作线的权威快照 | 自动保存高频写入；所有读档最终会镜像回这里 |
| `save_game_slot_1` | 手动槽位 1 | 显式手动保存 / 显式读取 |
| `save_game_slot_2` | 手动槽位 2 | 显式手动保存 / 显式读取 |
| `save_game_slot_3` | 手动槽位 3 | 显式手动保存 / 显式读取 |
| `save_game_last_slot` | 最近一次手动读档或手动保存涉及的槽位编号 | 仅兼容性写入，当前主流程不消费 |

当前实现结论：

1. `save_game` 已经被正式视为“自动存档槽位”
2. UI 中已经把它显式命名为“自动存档”
3. 自动存档槽位只允许读取，不允许在存档页被手动点击“保存”覆盖
4. 手动槽位当前固定为 `3` 个，但这只是当前实现限制，不应视为最终产品上限

### 2.2 当前存档快照内容

当前落盘对象是整个 `dataConfig`，其中至少包括：

1. `version`
2. `timestamp`
3. `dataSourcesVersion`
4. `global`
5. `runtime`
6. `settings`

语义上可以理解为：

1. `global`
   - 长期玩家数据与进度
2. `runtime`
   - 当前运行态快照
   - 包括当前场景、战斗快照、关卡数据、规划态等
3. `settings`
   - 本地设置

### 2.3 旧 `DataManager.js` 的地位

当前主流程导入的是 `DataManagerV2.js`，不是旧 `DataManager.js`。

这意味着：

1. 旧 `DataManager.js` 不再参与当前存档生命周期
2. 本文只以 `DataManagerV2.js` 为当前实现真源
3. 旧文件是否物理删除，应作为后续代码治理任务单独处理

## 3. 当前生命周期

### 3.1 新游戏创建

当前链路为：

1. 登录页点击 `新游戏`
2. `UI_SystemModal.renderLogin()` 调用 `engine.input.login(username)`
3. `CoreEngine.login()` 调用 `data.createNewGame(username)`
4. `DataManagerV2.createNewGame()` 只构建内存中的 `dataConfig`
5. `CoreEngine.login()` 继续调用 `requestSave({ reason: 'new-game', slotId: null, captureBattleRuntime: false, sceneOverride: 'MAIN_MENU' })`
6. `requestSave()` 调用 `_prepareNonBattleSave(...)`
7. 最终 `DataManagerV2.saveGame(null)` 把快照写入 `save_game`

关键结论：

1. 新游戏创建后会立即生成自动存档
2. `createNewGame()` 本身不直接落盘
3. 落盘权统一由 `CoreEngine.requestSave(...)` 协调

### 3.2 登录页读档入口

当前登录页已不再是“开始冒险默认读档”模型，而是显式二选一：

1. `新游戏`
2. `读取存档`

入口控制规则如下：

1. `UI_SystemModal.renderLogin()` 会先调用 `data.hasAnySave()`
2. `hasAnySave()` 只检查：
   - `save_game`
   - 任意一个 `save_game_slot_n`
3. 若没有任何存档，`读取存档` 按钮禁用
4. 若存在任意存档，用户可进入“读取存档”页选择自动槽位或手动槽位

### 3.3 自动存档读取

自动存档读取链路如下：

1. 用户在存档页点击 `自动存档 -> 读取`
2. `CoreEngine.loadGame('auto')` 或 `loadGame(null)` 被调用
3. `DataManagerV2.loadGame(...)` 从 `save_game` 读取 JSON
4. 反序列化后恢复 `dataConfig`
5. 若 `runtime.levelData` 存在，则 `CoreEngine.resumeBattle()`
6. 若 `runtime.levelData` 不存在，则进入 `MAIN_MENU`

关键结论：

1. 自动存档是正式可见、可读取的槽位
2. 登录页的“读取存档”本质上就是从“自动槽位 + 手动槽位”中选择一条历史线恢复

### 3.4 手动槽位读取

手动读取链路如下：

1. 用户在存档页点击 `手动槽位 n -> 读取`
2. `CoreEngine.loadGame(n)` 调用 `DataManagerV2.loadGame(n)`
3. `DataManagerV2.loadGame(n)` 从 `save_game_slot_n` 读取快照
4. 读取成功后，当前实现会把该快照重新镜像回 `save_game`
5. 同时更新 `save_game_last_slot = n`
6. 然后按 `runtime.levelData` 是否存在决定恢复战斗还是回主菜单

这意味着当前系统采用的是：

1. 手动槽位保存“显式分叉点”
2. 自动存档保存“当前工作线”
3. 当用户读取某个手动槽位后，该手动槽位会成为新的当前工作线起点

这个行为不是 bug，而是当前设计的明确取舍。

### 3.5 手动槽位保存

手动保存链路如下：

1. 用户在存档页点击 `手动槽位 n -> 保存`
2. `UI_SystemModal.renderSaveLoad()` 调用 `engine.input.saveGame(slotId)`
3. `CoreEngine.saveGame(slotId)` 统一转发到 `requestSave({ reason: 'manual-slot-save', slotId })`
4. 若当前处于 `BATTLE_LOOP`，`requestSave()` 先调用 `saveBattleState()`
5. 若当前不处于战斗态，`requestSave()` 先调用 `_prepareNonBattleSave(...)`
6. 最终 `DataManagerV2.saveGame(slotId)` 会：
   - 始终先写 `save_game`
   - 再写 `save_game_slot_n`
   - 最后写 `save_game_last_slot = n`

当前语义可以概括为：

1. 手动保存是“自动槽位 + 指定手动槽位”的双写
2. 自动槽位始终跟随当前工作线推进
3. 手动槽位是用户明确留下的命名分叉点

### 3.6 自动存档触发点

当前主流程中，以下动作会触发自动存档写入 `save_game`：

1. `CoreEngine.login()`
   - 新游戏创建后
2. `CoreEngine.resetGame()`
   - 强制重开后
3. `CoreEngine.learnSkill()`
   - 技能学习提交后
4. `CoreEngine.endBattle()`
   - 战斗结算后
5. 显式调用 `saveGame()` 且 `slotId = null`

这些动作现在都统一走 `requestSave(...)`。

### 3.7 明确不会直接落盘的动作

当前以下动作不会直接写入 `localStorage`：

1. `startTurn()`
2. `commitPlanning()`
3. `saveBattleState()`

这些动作只会更新内存中的 `runtime` 快照，不会立刻落盘。

这是当前存档系统的重要边界：

1. 自动存档不是“每一步操作都写盘”
2. 自动存档只发生在语义明确的稳定节点
3. 回合内的草稿变更不应偷偷污染正式存档

## 4. 当前用户可见语义

### 4.1 登录页

当前登录页语义已经收口为：

1. `新游戏`
2. `读取存档`

这意味着：

1. 用户进入主流程前必须明确选择“开新局”还是“读已有档”
2. 系统不再把默认读档伪装成“开始冒险”

### 4.2 主菜单与战斗内菜单

当前与存档相关的两个语义已经区分：

1. `返回战斗`
   - 当前内存态快捷返回
2. `存档 / 读档`
   - 持久化快照入口

因此：

1. “返回战斗”不再与“继续游戏 / 读取存档”混淆
2. 局内返回与持久化恢复已经分成两条用户能理解的路径

### 4.3 存档页

当前存档页固定展示：

1. `自动存档`
2. `手动槽位 1`
3. `手动槽位 2`
4. `手动槽位 3`

各自权限如下：

1. `自动存档`
   - 可读取
   - 不可在 UI 中手动点击保存
2. `手动槽位`
   - 可保存
   - 可读取

## 5. 当前实现约束

### 5.1 自动槽位同时承担“自动存档”和“当前工作线”

当前 `save_game` 不只是一个展示槽位，它还是：

1. 当前工作线的唯一权威快照
2. 自动存档读写的真实落点
3. 手动读档后新的工作线承接点

因此当前系统的心智模型应理解为：

1. 自动存档代表“你现在这条线正在往前走到哪里”
2. 手动槽位代表“你主动打了一个可回溯分叉点”

### 5.2 手动读取会改写自动槽位

手动读取后会把所读快照镜像到 `save_game`。

这会带来两个结果：

1. 之后的自动存档会沿着该手动槽位继续推进
2. 原手动槽位仍然保留，不会被自动覆盖

这是当前设计中最关键、也最容易被误解的一条规则。

### 5.3 非战斗保存会清理战斗 runtime

当 `requestSave()` 在非战斗态触发时，会调用 `_prepareNonBattleSave(...)` 清理：

1. `levelData`
2. `turn`
3. `phase`
4. `initialState`
5. `history`
6. `queues`
7. `planning`
8. `battleRules`
9. `playerBattleState`
10. `playerTempState`

因此：

1. 主菜单态保存不会伪造战斗恢复快照
2. 战斗快照只在真正处于战斗态时由 `saveBattleState()` 进入存档

### 5.4 读档存在数据源版本硬校验

当前若 `dataSourcesVersion` 与当前配置不一致，读档会直接失败。

这代表当前设计优先保证：

1. 不把旧配置生成的存档静默读成新配置运行态
2. 在开发期先保证一致性，再考虑迁移兼容

## 6. 当前不足

### 6.1 仍然没有正式 manifest

当前仍没有独立的存档 manifest 来表达：

1. 当前激活槽位
2. 最近一次读取来源
3. 自动存档最近一次保存原因
4. 每个槽位的轻量元数据

所以系统现在仍依赖：

1. `save_game`
2. `save_game_slot_n`
3. `save_game_last_slot`

这套结构能工作，但表达力有限。

### 6.2 `save_game_last_slot` 仍是兼容字段

当前 `save_game_last_slot` 只有写入，没有主流程消费。

因此它现在只是：

1. 历史兼容残留
2. 调试辅助字段

它还没有成长为真正的“当前激活槽位机制”。

### 6.3 手动槽位数量写死

当前手动槽位数量固定为 `3`，写死在 `DataManagerV2.js`。

这意味着：

1. 后续若要扩展更多槽位，需要改代码而不是改配置
2. 当前还没有“可配置 N 个手动槽位”的基础

### 6.4 缺少面向用户的读档失败解释

当前版本不匹配或数据损坏时，系统能拒绝加载，但缺少用户级解释：

1. 为什么读失败
2. 是版本问题、损坏问题，还是缺字段问题
3. 用户下一步应该怎么做

### 6.5 槽位元数据仍然是现算，不是独立对象

当前存档页显示的：

1. 时间
2. 关卡名
3. 场景
4. 回合

都是从整份存档快照现算出来的，而不是独立的轻量 header。

这意味着：

1. 元数据读取成本高于必要水平
2. 后续如果要加“存档来源 / 存档原因 / 游戏时长”等信息，不够自然

## 7. 推荐演进方向

### 7.1 引入正式 manifest

建议新增单独 manifest，至少记录：

1. `activeSlot`
2. `lastLoadedSlot`
3. `lastSavedSlot`
4. `lastSaveReason`
5. `lastSavedAt`

### 7.2 把手动槽位数量改为配置项

不要长期把槽位数量写死在运行时代码中。

应改成：

1. 配置可声明手动槽位数量
2. UI 根据配置渲染槽位
3. DataManager 根据配置生成槽位列表

### 7.3 为槽位引入 header 元数据层

建议把“完整快照”和“槽位摘要”拆成两层：

1. 完整快照
2. 轻量 header

这样可以更低成本地展示：

1. 存档时间
2. 关卡
3. 场景
4. 回合
5. 保存原因
6. 版本兼容状态

### 7.4 为版本不兼容补 UI 反馈与迁移策略

后续应补齐：

1. 版本不兼容提示
2. 数据迁移策略
3. 损坏存档处理策略

### 7.5 清理旧实现残留

当 manifest 和兼容迁移稳定后，应安排独立节点处理：

1. 旧 `DataManager.js` 的物理删除
2. `save_game_last_slot` 的正式退役或吸收入 manifest

## 8. 当前结论摘要

当前工程的本地存档已经完成从“隐式默认工作副本”向“显式自动存档槽位 + 手动槽位”的收口。

当前可用且应被遵守的设计结论是：

1. `save_game` 就是自动存档槽位
2. 自动存档同时也是当前工作线的权威快照
3. 手动槽位是显式分叉点，不会被自动存档直接覆盖
4. 手动读档后，该手动槽位会成为新的当前工作线起点
5. 所有正式落盘都应通过 `CoreEngine.requestSave(...)` 协调
6. `startTurn()`、`commitPlanning()` 这类运行时草稿更新不应直接落盘

如果只用一句话概括当前生命周期：

当前系统采用“自动槽位承接当前工作线，手动槽位承接显式分叉点”的双层模型；它已经可交付使用，但还需要 manifest、元数据层和迁移策略，才能成为长期稳定的存档体系。
