# 行动时间轴（Timeline）设计方案

> 目标：把 `timeline labeled-block` 从“纯 UI 展示区”升级为**主战斗状态机下的子状态机**：
>
> - 回合规划提交后：接收我方行动队列并生成时间轴
> - AI 生成后：接收敌方行动并合并
> - 战斗模拟阶段：作为推演驱动器按顺序驱动执行与展示
> - 推演完成：向主引擎回传事件与摘要结果
>
> 本文以“高内聚、低耦合”为原则：Timeline 负责**排序、驱动、播放控制、事件分发**；具体结算逻辑由执行器/模拟器模块承担。

UI 视觉与交互设计见：`DOC/CODEX_DOC/02_设计说明/15-时间线界面(timeline_UI_design)-设计说明.md`。

---

## 1. 模块定位与边界

### 1.1 Timeline 是什么
Timeline 是一个“回合级队列管理 + 播放驱动”的引擎子模块：

- 输入：本回合双方已决定的行动（我方来自规划器输出，敌方来自 AI 输出）
- 输出：按时间顺序的行动序列、执行过程事件、回合结束摘要

它必须具备：

- 可重置、可加载新回合
- 可播放/暂停/单步
- 可对外发布事件（用于 UI 与主引擎推进）

### 1.2 Timeline 不是什么（避免耦合/补丁化）
- **不是数据加载器**：不读取 JSON（`DataManagerV2` 负责）
- **不是规划器**：不决定玩家怎么选槽位/怎么选目标（`TurnPlanner`/输入模块负责）
- **不是结算引擎本体**：不直接硬编码 buff/伤害规则（交给 `ActionExecutor`/`BattleSimulator`）

### 1.3 “暴露问题”的原则
遵循仓库约束：关键数据缺失或结构不匹配，Timeline 应进入 `ERROR` 并通过系统弹窗/日志提示；**不允许 silent fallback 或 mock 兜底**。

---

## 2. 与现有模块的对接点（建议）

结合当前工程文件：

- `script/engine/CoreEngine.js`：主循环/状态机的拥有者，驱动 Timeline 子状态机
- `script/engine/TurnPlanner.js`：规划器，输出“按 skill 维度”的规划结果（参考 `DOC/CODEX_DOC/02_设计说明/05-技能规划(skill_planning_design)-设计说明.md`）
- `script/ui/UI_BattleRow.js` / `script/ui/UI_SkillPanel.js`：提交规划按钮与主界面交互
- `UI_SystemModal.js`：承接 `TIMELINE_ERROR` 等错误提示

建议新增（或以文件存在情况为准）：

- `script/engine/TimelineManager.js`：本文核心设计模块
- `script/engine/ActionExecutor.js`（或 `BattleSimulator.js`）：执行 entry 并生成结果
- `script/ui/UI_TimelineBlock.js`：专职渲染 labeled-block 的 UI 控制器

---

## 3. 数据结构设计

### 3.1 TimelineEntry（时间轴条目）
时间轴的最小播放单位。

建议字段：

- `entryId: string`：唯一 ID（回合内唯一即可）
- `roundId: string | number`：回合标识（可选，但便于调试）
- `side: "self" | "enemy"`
- `actorId: string`
- `skillId: string`
- `plan: object`：规划快照（至少包含目标与部位/槽位选择结果；结构遵循规划设计文档）
- `time: number`：排序主键（越小越先执行）
- `priority?: number`：同 `time` 下的次级排序（越大越先）
- `meta?: { label?: string, iconKey?: string }`：纯展示辅助信息，避免 UI 反查过多
- `execution?: { state: "PENDING"|"RUNNING"|"DONE"|"CANCELED"|"ERROR", result?: object, error?: string }`

> 说明：`time` 不必直接等于 `speed`。如果未来要支持先手、延迟、插队、打断，应把 `time` 视为“行动调度时间”。

### 3.2 TimelineSnapshot（给 UI 的只读快照）
UI 渲染只依赖快照，避免拿到可变引用。

- `phase: "IDLE"|"READY"|"PLAYING"|"PAUSED"|"FINISHED"|"ERROR"`
- `currentIndex: number`
- `entries: Array<{ entryId, side, actorId, skillId, time, executionState, meta }>`
- `error?: { message: string, details?: any }`

### 3.3 RoundActionInput（加载本回合动作的输入）

- `selfPlans: Array<SkillPlan>`
- `enemyPlans: Array<SkillPlan>`（允许空数组，但必须显式传入）
- `rules?: { tieBreak?: string, sidePriority?: "self"|"enemy"|"alternate" }`

其中 `SkillPlan` 的字段应以 `DOC/CODEX_DOC/02_设计说明/05-技能规划(skill_planning_design)-设计说明.md` 的输出为准（核心是“以 skill 为维度”而非 slot）。

---

## 4. Timeline 子状态机

### 4.1 状态定义
- `IDLE`：无队列
- `READY`：队列已构建，等待开始
- `PLAYING`：播放/推演中
- `PAUSED`：暂停
- `FINISHED`：本回合推演完成
- `ERROR`：数据缺失/执行失败

### 4.2 状态迁移
- `IDLE` → `READY`：`loadRoundActions()` 正常完成
- `READY` → `PLAYING`：`start()`
- `PLAYING` ↔ `PAUSED`：`pause()` / `resume()`
- `PLAYING` → `FINISHED`：执行到末尾
- 任意 → `ERROR`：输入校验失败、执行器报错等

---

## 9. 工程化：执行按钮（TurnPanel“执行”）后的联合状态机设计

> 结论：Timeline 不能只靠 UI 的 `start/pause/resume` 交互自己“跑”，也不能在 `CoreEngine` 中通过零散的临时标记变量去猜测“这次 start 返回是暂停还是完成”。
>
> 必须工程化地定义**两个状态机的协作边界**：
>
> - **主状态机（Host）**：`CoreEngine.battlePhase`（`PLANNING`/`EXECUTION`）负责“这个回合是否在执行”。
> - **子状态机（Timeline）**：`TimelineManager.phase`（`READY/PLAYING/PAUSED/FINISHED/ERROR`）负责“这个回合的动作序列推进到哪里”。

### 9.1 现状痛点（来自迭代中的真实问题）

在之前的迭代中出现过以下典型症状：

1) UI 显示 `PAUSED`，但“开始/执行”点击无效（通常是 host phase 与 timeline phase 脱节）。
2) 执行中点击“暂停”，`CoreEngine` 误以为回合已结束，直接进入下一回合。
3) 暂停后恢复并执行完，`CoreEngine` 由于“粘性标记”仍认为是暂停退出，导致不进入下一回合。

这些问题本质上都来自：**缺少对“执行按钮”之后生命周期的工程化定义**，使得代码只能用临时变量补丁化判断。

### 9.2 统一术语：一次回合执行的生命周期（Execution Session）

定义“执行会话（Execution Session）”为：

1) `TurnPanel.执行` 被点击
2) Timeline 从 `READY/PAUSED` 开始播放
3) 最终进入 `PAUSED`（用户暂停）或 `FINISHED/ERROR`（会话结束）

该会话期间，Host 状态固定为：`CoreEngine.battlePhase === 'EXECUTION'`。

### 9.3 权威状态与决策点（避免临时标记）

工程约束：**回合是否进入下一回合**只由以下条件决定：

- `TimelineManager.phase === 'FINISHED'`  → 必须进入下一回合（`CoreEngine.startTurn()`）
- `TimelineManager.phase === 'PAUSED'`    → 必须停留在当前回合的执行阶段（等待 resume）
- `TimelineManager.phase === 'ERROR'`     → 必须暴露错误（系统弹窗/日志），并停止推进（禁止 silent fallback）

补充约定（推荐）：**回合推进以事件为准**。

- `CoreEngine` 不应依赖“`await timeline.start()` 返回后立刻检查 phase”来决定是否 `startTurn()`，因为 Timeline 可能在一次执行会话中被 `pause/resume` 多次打断。
- `CoreEngine` 应以 `TIMELINE_FINISHED` / `TIMELINE_ERROR` 作为**执行会话的权威结束信号**：
  - 收到 `TIMELINE_FINISHED` → 执行本回合 `TURN_END` hooks，然后 `startTurn()`。
  - 收到 `TIMELINE_ERROR` → 暴露错误并保持在 `EXECUTION`（或进入专用错误态，后续可扩展）。

禁止做法：

- 不允许 `CoreEngine` 通过额外 boolean（例如“是否曾经暂停过”）来决定是否推进回合。
- 不允许 UI 以 `battlePhase !== EXECUTION` 为由阻止“从 PAUSED 恢复播放”，因为 host/child 脱节时会导致无法恢复。

### 9.4 联合状态迁移表（Host × Timeline）

> 下面表格描述“执行按钮”之后的合法迁移。任何不在表中的迁移都视为 BUG，应进入 `ERROR` 或打印明确日志。

澄清（低耦合原则）：

- 文档中的联合状态写法（例如 `EXECUTION + READY`）是**系统视角/约束视角**：
  - `EXECUTION` 表示 Host（`CoreEngine.battlePhase`）
  - `READY/PLAYING/PAUSED/...` 表示 Timeline（`TimelineManager.phase`）
  - 其用途是描述“此刻系统整体允许哪些动作/哪些 UI 控制可用/Host 是否应推进回合”等跨模块约束。
- `TimelineManager` **不拥有**也**不应读取/依赖** Host 的 `battlePhase`（避免把 Host 枚举耦合进子状态机）。
- Host 与 Timeline 的协作应通过以下方式完成：
  - 显式调用：`timeline.loadRoundActions()` / `timeline.start()` / `timeline.pause()` / `timeline.resume()` / `timeline.reset()`
  - 播放守卫：`timeline.start({ canContinue })` 由 Host 提供可继续条件
  - 事件通知：`TIMELINE_*` 事件回传快照与 finished/error，Host 决定是否推进回合

#### 9.4.1 从规划到执行

前置条件：

- Host：`battlePhase === 'PLANNING'`
- Timeline：`phase === 'READY'`

动作：`commitTurn()`

结果：

- Host：`PLANNING → EXECUTION`
- Timeline：保持 `READY`（由随后的 `executeTurn()` 启动播放）

说明：

- 在当前交互定义中，“回合控制”的「执行」按钮是 **`PLANNING → EXECUTION` 的唯一入口**。
- 一旦进入 `EXECUTION` 会话，Host 不应再次触发 `commitTurn()`；播放的暂停/继续/结算完全由 Timeline 子状态机在 `EXECUTION` 内部控制（见 9.4.2）。
- 因此 `commitTurn()` 不接受 `Timeline.phase === 'PAUSED'` 作为入口条件；`PAUSED → PLAYING` 只允许经由 `timeline.resume()`。

#### 9.4.2 执行阶段内播放控制

- `EXECUTION + READY`  --(timeline.start)--> `EXECUTION + PLAYING`
- `EXECUTION + PAUSED` --(timeline.resume)--> `EXECUTION + PLAYING`
- `EXECUTION + PLAYING`--(timeline.pause)--> `EXECUTION + PAUSED`

约束：播放控制只在 `EXECUTION` 开放（见 UI 设计文档），但“从 PAUSED 恢复”必须以 Timeline phase 为准，避免 host phase 漂移造成不可恢复。

#### 9.4.3 执行会话结束

当 `timeline.start/resume` 的内部循环退出后：

- 若 Timeline 最终 `phase === 'PAUSED'`：
  - Host 保持 `EXECUTION`
  - 不推进回合（等待用户恢复）

- 若 Timeline 最终 `phase === 'FINISHED'`：
  - Host 立即调用 `startTurn()` 进入下一回合
  - `startTurn()` 内部会做：Host `EXECUTION → PLANNING` 且 `timeline.reset()`

- 若 Timeline 最终 `phase === 'ERROR'`：
  - Host 保持 `EXECUTION` 或进入专用错误态（后续可扩展）
  - UI 必须明确展示错误

### 9.5 推荐的工程落地规则（对当前代码的约束）

1) `CoreEngine.executeTurn()` 负责“发起播放”，但**不负责**“等待播放完成后推进回合”。
   - 回合推进（`startTurn()`）必须由 `TIMELINE_FINISHED` 驱动。
   - 禁止为了解决 pause/resume 引入额外 boolean 标记。

2) `TimelineManager.start()` / `pause()` / `resume()` 必须保证：
   - `pause()` 只可能从 `PLAYING` 进入 `PAUSED`
   - `resume()` 只可能从 `PAUSED` 进入 `PLAYING`
   - `start()` 在 `PAUSED` 时视为恢复（或显式要求外部调用 `resume`，二选一但必须统一）

3) 事件协议：
   - `TIMELINE_START`：开始/恢复播放
   - `TIMELINE_PAUSE`：用户暂停
   - `TIMELINE_FINISHED`：仅在 `FINISHED` 时发出（禁止暂停时发出）
   - `TIMELINE_SNAPSHOT`：任意相位变化都应发出，供 UI 刷新

4) UI 刷新源：
   - Timeline UI 不应只监听 `TIMELINE_*`，也应监听 `BATTLE_UPDATE`，避免 host phase 改变时 UI 卡在旧 phase。


### 4.3 关键约束
- `loadRoundActions()` 必须严格校验：缺字段即 `ERROR`，并发出 `TIMELINE_ERROR`。
- Timeline 不得在加载失败时回退到 mock 队列。

---

## 5. 排序策略（Scheduling）

### 5.0 `time / priority / speed` 三者关系说明（避免概念混淆）

在当前实现与本设计中，`time / priority / speed` **并非三个重复的“时间”字段**，而是用于不同层级的概念：

- `speed`：技能/行动的“速度属性”（内容属性）。
  - 典型用途：用于 UI 坐标轴展示（例如将速度映射到 X 坐标），以及作为推导调度时间的输入之一。
  - 重要点：`speed` 本身不等同于“最终执行时间”。

- `time`：时间轴条目的**调度主键**（排序主键）。
  - 规则：`time` 越小越先执行。
  - 重要点：`time` 不必等于 `speed`。为了支持未来的“先手/延迟/插队/打断/加速减速”等机制，`time` 应视为更抽象的“行动调度时间”。

- `priority`：当 `time` 相同时的**次级排序（tie-break）**。
  - 规则：在同 `time` 下，`priority` 越大越先执行。
  - 典型用途：处理同速冲突、特殊行动插队等“同一调度时间点”的先后。

#### 5.0.1 默认映射（当前实现约定）

为降低 MVP 复杂度，若输入 action/plan 未显式提供 `time`，则可采用默认折算：

- `time = -speed`

该折算仅为默认策略：它会让“速度越大越先行动”的直觉在排序上成立，同时允许后续在不破坏 `speed` 含义的前提下，通过显式 `time` 覆盖来实现更复杂的调度。

> 提醒：为了避免“看起来有 3 个时间字段”的误解，推荐在数据/代码层面明确：
> - `speed` 用于展示与作为计算输入
> - `time` 仅用于调度排序
> - `priority` 仅用于同 `time` 的平局裁决

### 5.1 基础排序
按以下规则排序（稳定排序）：
1) `time` 升序
2) `priority` 降序（缺省视作 0）
3) 同速同优先级的 tie-break：
   - 可配置为 `selfFirst` / `enemyFirst` / `alternate`
4) `stableIndex`（构建时顺序）作为最终兜底，确保稳定

### 5.2 为什么要抽出策略
后续需求（先攻 buff、插队、打断、减速/加速）会持续增长；把策略隔离可避免 Timeline 本体补丁化。

建议实现为：
- `TimelineScheduler.buildEntries(selfPlans, enemyPlans, ctx)`
- `TimelineScheduler.sort(entries, rules)`

---

## 6. 推演/执行驱动模型

### 6.1 两种模式

#### 模式 A：离线结算 + 回放（未来增强）
- 一次性执行所有 entry，生成事件流
- UI 播放事件流

优点：可快进/回放/跳转一致性强
缺点：需要明确的事件流结构

#### 模式 B：边播放边结算（建议 MVP）
- Timeline 每次 `step()` 执行一个 entry
- 结果即时应用到战斗态，并发事件更新 UI
- 播放节奏采用**离散步进**：按事件顺序推进，不做连续距离/位移时间模拟
- 默认步进 `1s / action`（可配置）

优点：实现成本低，适合当前迭代
缺点：回放能力弱（但可通过日志补齐）

### 6.3 离散时间步进规范（本期确定）

为降低复杂度并保证稳定性，本期时间轴采用离散时间：

1) **逻辑时间**：仅用于排序（`time/priority`），决定先后顺序。  
2) **展示时间**：固定步长推进（默认 `300ms`），每个 action 占用一个步进周期。  
3) 不引入“按距离推进、真实轨迹耗时、动画时长反推逻辑时间”等机制。  

实现约束：
- `TimelineManager.start({ stepDelayMs })` 默认 `stepDelayMs = 1000`。
- UI 的 `1x/2x/4x` 仅影响展示步进间隔，不改变排序结果。
- 如果需要更精细的真实时间模拟，作为后续扩展，不在本期 MVP 范围。

### 6.2 执行器接口（建议）
Timeline 不关心具体 buff/伤害算法，只调用执行器：

- `executor.execute(entry, engineContext) -> ExecutionResult`

`ExecutionResult` 建议至少包含：
- `events: Array<GameEvent>`（伤害、资源变更、buff 变更等）
- `summary: object`
- `errors?: Array<string>`

---

## 7. 事件协议（Timeline ↔ CoreEngine/UI）

建议通过引擎统一事件总线（或 Timeline 自己的订阅机制），发布以下事件：

- `TIMELINE_READY({ roundId, count })`
- `TIMELINE_START({ roundId })`
- `TIMELINE_ENTRY_START({ entry })`
- `TIMELINE_ENTRY_END({ entry, result })`
- `TIMELINE_PAUSE({ roundId })`
- `TIMELINE_RESUME({ roundId })`
- `TIMELINE_FINISHED({ roundId, roundSummary })`
- `TIMELINE_ERROR({ message, details })`

UI `timeline labeled-block` 应订阅这些事件并刷新快照展示。

---

## 8. UI（timeline labeled-block）交互设计建议

### 8.1 展示层
a) Header：
- 回合号、播放控制：`开始/暂停/单步/倍速(1x/2x/4x)`

b) Body：
- 条目线性列表或分组列表（按 `time` 分组显示更直观）
- 每条显示：阵营、技能名、actor、time、状态（pending/running/done/error）

c) Footer：
- 最近 N 条执行日志摘要（用于你调试校验）

### 8.2 交互
- 点击某条 entry：展示 `plan` 摘要（目标、部位/槽位）+ 执行结果摘要
- 若 `ERROR`：调用系统模态框显示错误详情（不做兜底回退）

#### 8.2.0 播放控制开放时机（避免与“执行”冲突）

为避免 Timeline 的“开始/暂停”等播放控制与回合面板的“执行”产生语义冲突，约定：

- Timeline 在 `PLANNING` 阶段只做 **预览**（`READY` snapshot 可渲染），但 **不开放播放控制**。
- Timeline 的播放控制（开始/暂停/单步/倍速/直接结算）只在 `CoreEngine.battlePhase === 'EXECUTION'` 时可用。

这样用户心智为：

1) `提交规划` → 构建 Timeline 预览（可看顺序）
2) `执行` → 进入 EXECUTION 并开始播放/结算
3) Timeline Header 区域只承担执行过程中的“播放器控制器”角色

#### 8.2.1 “直接结算”（Fast-forward）

目的：用于调试/验证回合结果，在不需要观看逐条播放时，一次性把本回合剩余条目全部执行完。

交互规则：
- 按钮文案：`直接结算`
- 可用相位：`READY` / `PAUSED`
- 不可用相位：`IDLE` / `PLAYING` / `FINISHED` / `ERROR`

执行语义（对应代码实现约定）：
- 本质等价于调用 `TimelineManager.start({ stepDelayMs: 0, canContinue })`
- `stepDelayMs = 0` 代表不做“展示节奏等待”，但仍按 `step()` 的顺序逐条执行（仍会发出 `TIMELINE_ENTRY_START/END` 等事件）
- 必须遵守“暴露问题”原则：执行异常进入 `ERROR`，并通过 `TIMELINE_ERROR` / 系统日志提示原因

---

## 9. MVP 落地清单

### 9.0 严格生命周期契约（必须遵守）

为保证 `CoreEngine.executeTurn()` 可以做严格断言（fail-fast），Timeline 必须满足以下契约：

1) `TimelineManager.start()` 返回 `ok:true` 时，播放结束后的稳定相位只能是：
   - `FINISHED`（自然播完）
   - `PAUSED`（被 host 的 `canContinue()` / 外部 stop/pause 打断）

2) **禁止**在 `TIMELINE_FINISHED` 的同步监听回调链路中调用 `timeline.reset()` 或任何会把 phase 改回 `IDLE` 的操作。
   - 原因：`eventBus.emit()` 为同步分发时，监听器内 reset 会在 `start()`/`step()` 调用栈尚未返回前破坏 phase，导致引擎端出现
     `Timeline ended in unexpected phase=IDLE` 这类契约错误。

3) 新回合 timeline 的进入方式：
   - 在下一回合进入执行阶段时，通过 `timeline.loadRoundActions(...)` 直接覆盖 entries，并将 phase 置为 `READY`。
   - `reset()` 仅允许在“离开战斗/回到标题/彻底初始化”的边界使用，而不是作为“下一回合”的常规路径。

4) 新回合 UI 清空（不破坏相位契约）：
   - 回合开始（进入 PLANNING）时，如果希望时间轴不显示上一回合已执行节点，使用 `timeline.clearForNextTurn({ roundId })`。
   - 语义：仅清空 `entries/currentIndex` 并发出 `TIMELINE_SNAPSHOT`（可选额外事件 `TIMELINE_CLEARED`），但不调用 `reset()`。
   - 重要：`clearForNextTurn()` **不得**把相位强制改为 `READY/IDLE`；相位必须保持 `FINISHED/PAUSED` 以满足引擎严格断言。
     下一回合真正进入 `READY` 由 `loadRoundActions(...)` 负责。
   - 设计目的：避免 `TIMELINE_FINISHED` 同步回调链路里 reset 造成 phase=IDLE，同时满足“新回合时间轴为空”的 UX 预期。

1) 新增 `TimelineManager`：
- `reset()`
- `loadRoundActions(selfPlans, enemyPlans, rules)`（严格校验）
- `start()/pause()/resume()/step()`
- `getSnapshot()`

2) 在 `CoreEngine` 中增加 Timeline 子模块并在主循环相位对接：
- `PLANNING_COMMIT` 后构建 timeline → `READY`
- 进入 `BATTLE_SIMULATION` 相位后 `start()` 或由 UI 控制 `start()`
- 完成后发布 `TIMELINE_FINISHED` → 主循环进入结算/下一回合
- 默认播放节奏按离散步进 `0.3s / action`

3) UI labeled-block：
- 订阅 Timeline 事件并渲染 snapshot
- 提供 `开始/暂停/单步` 控制按钮

---

## 10. 开放问题（后续扩展）
- `time` 的计算来源：由规划器提供，还是由 timeline 根据角色速度计算？（建议先由规划器/调度策略模块计算，Timeline 只消费）
- 同速冲突规则：自优先/敌优先/交替/按角色属性（可配置）
- 是否支持中途插入（interrupt）：需要 `TimelineScheduler` 支持动态重排

---

## 11. 与 `05-技能规划(skill_planning_design)-设计说明.md` 的一致性约束
- Timeline 输入必须是“以 `skill` 为维度的规划结果”，而不是以 slot 为主维度的结构。
- slot 维度结构仅允许存在于规划会话内部作为 UI 便利。
- Timeline 输出/执行日志建议以 `entry/skill` 为索引，避免主引擎被 slot 结构绑死。
