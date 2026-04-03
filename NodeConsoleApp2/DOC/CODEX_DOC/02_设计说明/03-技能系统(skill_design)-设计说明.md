# 技能系统设计文档 (Skill System Design)

## 1. 技能综述 (Overview)

本游戏的技能系统构建于经典的 **西方奇幻 (Western Fantasy)** 背景之上。
技能是玩家与敌人交互的主要手段，也是构建角色流派 (Build) 的核心要素。

*   **核心理念**: 技能不仅仅是伤害输出的手段，更是策略执行的工具。
*   **技能类型**:
    *   **攻击型 (Offensive)**: 削减敌人 HP 或破坏护甲。
    *   **防御型 (Defensive)**: 增加临时护甲、格挡伤害或进行回复。
    *   **辅助/控制型 (Support/Control)**: 施加 Buff (增益) 或 Debuff (减益)，改变战斗节奏。
*   **资源消耗**: 当前实现以行动力 (AP) 为主，但在“一回合内配置多个技能组合释放”的玩法下，仅用 AP 无法完整表达约束；因此设计层面预留了“需求资源 / 消耗资源”的扩展模型（见 5.3.4）。

---

## 2. 技能体系架构 (Skill Architecture)

### 2.1 技能稀有度 (Skill Rarity)

技能按稀缺度和强度分为 5 个等级，稀有度越高的技能越难获取，且通常具有决定性的战场影响力。

*   **Tier 1: 普通 (Common)** - 灰色
    *   基础技能，角色初始携带或在早期关卡大量掉落。通常作为填充 AP 的手段。
*   **Tier 2: 稀有 (Uncommon)** - 绿色
    *   进阶技能，具备一定的特效（如流血、破甲）。是构建流派的基础组件。
*   **Tier 3: 卓越 (Rare)** - 蓝色
    *   核心技能，数值优秀或机制独特。通常决定了玩家战斗风格的走向。
*   **Tier 4: 史诗 (Epic)** - 紫色
    *   强力技能，通常在特定流派中能产生质变效果。获取途径有限（如关卡 20+ 或商店高价购买）。
*   **Tier 5: 传说 (Legendary)** - 金色
    *   终极技能，拥有扭转战局的能力（如无敌、全屏控制）。极其稀有，通常来自 Boss 战利品或隐藏事件。

### 2.2 合理的 Skill 系统框架（Framework Principles）

一个可交付、可扩展的技能系统，不应被理解为“若干技能条目 + 若干页面按钮”，而应被设计成一条完整的内容链。
这条内容链至少包含：**内容定义、内容生产、运行时装载、回合规划、执行结算、跨系统消费、验证回归** 七个层次。

#### 2.2.1 单一真源：Skill 是内容契约，不是页面状态

- 技能的**唯一真源**应是技能配置文件及其 schema，而不是 UI 当前状态、某个页面内部对象或执行器中的临时兼容字段。
- 技能树、技能编辑器、战斗运行时、敌人行为、平衡分析、测试脚本，都应消费同一套 skill 数据语义。
- 运行时允许把静态技能配置转换为 `runtime skill view`，但该 runtime view 必须是对静态契约的**规范化投影**，而不是第二套独立协议。

#### 2.2.2 分层职责：一个合理的 Skill 系统应至少拆成五层

1. **Definition Layer（定义层）**
   - 定义 skill 的静态数据结构：`id`、`target`、`costs`、`requirements`、`actions`、`buffRefs`、`unlock`、`tags` 等。
2. **Authoring Layer（生产层）**
   - 提供技能编辑器、技能树布局、枚举/引用校验、导入导出能力。
3. **Planning Layer（规划层）**
   - 将静态 skill 配置转成“本回合计划动作”，处理 AP、部位槽位、目标选择、每回合使用次数等约束。
4. **Execution Layer（执行层）**
   - 将规划结果转成真实结算，消费 `actions[]` 与 `selectionResult`，驱动伤害、治疗、Buff 施加、事件触发等效果。
5. **Consumption Layer（消费层）**
   - 角色成长、敌人 AI、关卡脚本、日志、存档/读档、UI 展示，共同消费技能结果，但不应各自重写 skill 语义。

这五层中：

- 编辑器不是运行时真源；
- 规划层不是内容定义层；
- 执行层不是技能设计文档本身；
- 消费层更不应回头重写 skill 契约。

#### 2.2.3 生命周期：合理的 Skill 链路应当可追踪

一个技能从被定义到在游戏中真实生效，应经历如下链路：

1. **定义 / 编辑**
   - 技能被写入配置文件，满足 schema 与引用约束。
2. **装载 / 规范化**
   - 引擎读取技能 pack，生成规范化 runtime view。
3. **解锁 / 获得**
   - 玩家或敌人获得该技能的使用资格。
4. **规划 / 选择**
   - 在回合规划阶段，根据 `target / costs / requirements / selection` 生成 planned action。
5. **执行 / 结算**
   - planned action 被执行器消费，并产出真实战斗影响。
6. **反馈 / 持久化**
   - UI、日志、存档、回放记录技能的使用结果。
7. **回归 / 验证**
   - 编辑器、测试页、主流程回归验证该技能链路可重复成立。

设计上应保证：任何一个 skill 都能沿着这条链路被追踪，而不是只能在某个局部页面“看起来可用”。

#### 2.2.4 与 Buff / Enemy / Level 的边界

合理的 skill 框架应与其他内容系统保持**高内聚、低耦合**：

- **Skill**
  - 负责“做什么、对谁做、付出什么代价、何时能做”。
- **Buff**
  - 负责“持续多久、如何在事件中响应、如何叠层或衰减”。
- **Enemy**
  - 负责“何时选哪个技能、为何这样选、权重和条件如何变化”。
- **Level**
  - 负责“战斗场景、敌人组合、资源节奏、关卡输入条件”。

因此：

- skill 不应内嵌完整 buff 逻辑，只通过 `buffRefs` 等轻耦合引用 Buff；
- enemy 不应持有第二套技能定义，只应引用 skillId 并在行为层决定使用策略；
- level 不应复制技能内容，只应通过敌人池、玩家成长、关卡规则间接影响技能价值。

#### 2.2.5 扩展性要求：系统必须支持持续内容生产

一个合理的 skill 系统，必须允许未来继续扩技能，而不是每次新增内容都回到代码层手改逻辑。

因此它应具备：

- 新技能可以通过配置新增，而不是必须改执行器分支；
- 新流派可以通过数据扩展，而不是改 UI 固定结构；
- 技能编辑、Buff 编辑、敌人配置、关卡配置可以并行演进；
- 验证入口能在编辑器、测试页和主流程之间形成闭环。

---

## 3. 技能设计约束 (Design Constraints)

本章节明确了在设计新技能时必须遵守的核心规则，以确保游戏的策略深度与数值平衡。

### 3.1 技能平衡性 (Game Balance)
*   **避免数值碾压**: 技能的强度模型应符合 `强度 = AP消耗 * 稀有度系数` 的基本公式。避免设计出低费高伤且无副作用的技能。
*   **风险与回报**: 高回报技能必须伴随高风险（如自伤、降低防御、下回合行动受限）或高门槛（如苛刻的触发条件、极高的 AP 消耗）。
*   **针对性**: 强力技能应有明显的短板（例如破甲技能对无甲单位低效，单体爆发技能无 AOE 能力），避免出现“万金油”式的无脑最优解。

### 3.2 行动力消耗与策略 (AP & Strategy)
*   **资源管理**: 技能设计应迫使玩家在“当前爆发”与“留存 AP”之间做选择。
*   **低费技能的价值**: 0-1 AP 的技能不应只是填充物，而应具备调整节奏、触发特效或补刀的功能。
*   **高费技能的代价**: 4+ AP 的技能一旦被打断或未命中，应给玩家带来沉重的战术挫败感，因此其收益必须足够诱人。

### 3.3 技能组合与槽位分配策略（Combo & Slot Strategy）

本游戏的回合输入不是“选 1 个技能立即释放”，而是“在规划阶段配置 1~多个技能进入待执行队列，然后按速度依次结算”。
因此，技能的设计必须同时考虑：

1) **回合内技能组合（Combo）**：技能之间如何衔接形成策略链；
2) **部位槽位（Part Slot）与资源约束**：同一回合能“装下/安排”多少个技能。

#### 3.3.1 为什么需要“槽位分配”维度

仅用 `costs.ap` 无法表达“同一回合多技能配置”的核心约束：

- 玩家可能 AP 够用，但某个技能需要占用 `arm` 的“技能槽”，导致同回合无法再安排其他需要 `arm` 的技能；
- 某些强力防御技能（例如格挡/护盾）如果只消耗 AP，会变成“无脑必带”的最优解；
- 多技能队列需要从“资源层”限制组合上限，而不是事后在引擎里硬编码。

因此推荐把“释放技能需要占用的部位/槽位”作为标准成本写入技能数据：

- `costs.partSlot`: `{ part, slotCost }`（见 5.3.4）

#### 3.3.2 组合设计的基本准则（推荐）

- **明确每个技能在组合中的角色**：
  - `SETUP`：铺垫/上状态（施加 `buff_vulnerable` 等）。
  - `PAYOFF`：兑现伤害/收益（对“已破甲/已流血”目标有更高收益）。
  - `DEFENSE`：减伤/护盾/回复（通常对自己生效）。
- **风险与回报要能被组合放大，但不能无限放大**：
  - 通过 `costs.ap + costs.partSlot + perTurnLimit` 三者共同约束。
- **避免同回合“全输出无代价”**：
  - 高爆发技能建议提高 `costs.partSlot.slotCost` 或加入额外 `requirements`（例如“目标护甲为 0”“自身某部位可用”）。

#### 3.3.3 槽位分配的推荐策略（设计层面）

- **最小实现（MVP）**：
  - 多数主动技能都应显式填写 `costs.partSlot`；
  - 护盾/格挡/强控制技能建议同时具备 `costs.partSlot` 与 `perTurnLimit`。
- **同部位竞争**（手部技能为例）：
  - `arm` 代表手部动作；当你把多个“手部技能”塞进同回合队列，应当被槽位系统自然限制。
- **跨部位组合**：
  - 允许“手部防御 + 腿部攻击”这种组合成为稳定策略；
  - 通过槽位差异引导玩家构建更丰富的回合内决策。

#### 3.3.4 与数据结构的对应关系

- 组合的“可执行性”由 `requirements` + `costs` 控制：
  - `requirements.selfPart.mustBeUsable`：用于表达“该部位必须没损坏/可用”。
  - `costs.partSlot`：用于表达“该部位本回合会被占用多少槽位”。
- 组合的“排序与先后”由 `speed` 控制：
  - 设计上可用“快手上状态、慢手打输出”的方式形成稳定套路。

> 实现提示（不改变设计结论）：实际 UI 里，“待执行队列”应当按部位分组展示，才能让玩家直观看到部位槽位被占用的情况。

### 3.4 频率限制 (Usage Frequency)
*   **单回合单次使用**: 核心规则限定 **同名主动技能每回合只能使用一次**。
    *   *设计意图*: 鼓励玩家组建多样化的技能 Build，而不是复读同一个最优技能。
    *   *冷却时间 (CD)*: 对于极强力的技能 (如无敌、全屏 AOE)，除 AP 消耗外，还应设计额外的 CD (2-4 回合) 以防止连续爆发。

### 3.5 机制禁区 (Mechanical Constraints)
*   **不仅限于数值**: 任何 **"回复 AP"** 的技能，其净收益应严格控制，避免无限连动。
*   **实时性剥离**: 不支持 QTE、蓄力条等即时反应机制，保持回合制纯粹的策略规划。
*   **状态控制**: 避免永久硬控 (Perma-Stun)，控制类技能必须有递减机制或免疫期。

### 3.6 游戏特性适配约束 (Game Specific Constraints)
*   **AOE 的重新定义 (Area of Effect in 1v1)**
    *   *背景*: 本游戏采用 1v1 决斗机制 (Duel)，不存在“多名敌人”的概念。
    *   *约束*: 所有的 **AOE (范围伤害)** 技能，其作用对象不是多个单位，而是 **单一目标的所有身体部位** (All Parts)。
    *   *设计*: 例如 "暴风雪" 技能，效果是对敌人的 [头、胸、腹、手、腿] 同时造成伤害。这类技能通常用于快速剥离敌人全身护甲，或施加全局 Debuff。
*   **无队友机制 (Solo Combat)**
    *   *背景*: 玩家全程单人作战。
    *   *约束*: 移除所有依赖队友的技能设计。
    *   *设计*: 所有 **辅助/治疗** 技能的目标强制为 **自身 (Self)**。不存在“复活队友”、“光环共享”等机制。
*   **部位依赖与破坏 (Limb Dependency)**
    *   *背景*: 敌人的身体部位会被破坏 (Broken)。
    *   *约束*: 技能在规划阶段 (Planning Phase) 锁定的部位，在结算阶段 (Execution Phase) 可能已经不存在或已损坏。
    *   *设计*:
        *   **如果目标是特定部位**: 若该部位在技能判定前损毁，技能应 **默认转移至躯干 (Chest)** 或 **判定为丢失 (Miss)** (根据技能类型决定，如精密射击可能Miss，狂乱挥砍则转移)。
        *   **如果目标是全身**: 即使部分部位损毁，技能仍对剩余完好部位生效。

### 3.7 护甲部位枚举（简化版）

为降低输入成本与数据维护复杂度，护甲部位统一为 5 个标准枚举，不再区分左右：

- `head`（头）
- `chest`（胸）
- `abdomen`（腹）
- `arm`（手）
- `leg`（腿）

---

## 4. 技能获取与成长系统 (Skill Acquisition & Progression)

本章节描述技能从获取到成长的方式，重点围绕“知识点天赋树（Talent Tree）”解锁模式。

### 4.1 核心资源：知识点 (Knowledge Points - KP)

*   **定义**: 玩家通过冒险获得的用于解锁技能的专用货币。
*   **获取途径**:
    *   **关卡胜利**: 每次战斗胜利获得一定数量 KP (例如: 普通关卡 +1, 精英 +2, boss +5)。
    *   **升级**: 角色等级提升时获得 KP。
    *   **特殊事件**: 某些随机事件可提供额外 KP。

### 4.2 天赋树机制 (Talent Tree Mechanism)

技能不再通过随机三选一获取，而是通过 **天赋面板 (Talent Panel)** 主动解锁。

*   **流派独立**: 7 个流派 (重装、铁壁、剑术等) 各自拥有一条独立的天赋树。
*   **解锁条件 (Unlock Requirements)**:
    1.  **资源足够**: 拥有足够的 KP (Common: 1, Uncommon: 2, Rare: 3, Epic: 5, Legendary: 8)。
    2.  **前置满足**: 必须已解锁该技能的前置节点 (Root 节点无前置)。
*   **树形结构示例**:
    *   Tier 1 (Common) ---> Tier 2 (Uncommon) ---> Tier 3 (Rare) ...
    *   例如: *重锤挥击* (解锁) -> *野蛮冲撞* (可购买)。

### 4.3 交互设计意图 (Interaction Design)

*   **入口**: 在非战斗状态下 (休息点、整备阶段) 可打开技能书。
*   **视觉表现**: 采用传统的连线树状图。已解锁常亮，可解锁高亮闪烁，不可解锁灰显。
*   **策略性**: 玩家必须规划路径，是在一个流派深耕以获取终极技能，还是多流派兼修以获得更多工具。

### 4.4 可行性分析 (Feasibility Analysis)

针对 "随机三选一" 转向 "天赋树" 的方案评估：

#### 4.4.1 数据结构 (Data Structure)
*   **可行性: 高**
*   **改动**:
    *   `skills.json`: 新增字段 `learningCost` (int) 和 `prerequisites` (array of skill_ids).
    *   `Player` 对象: 新增属性 `knowledgePoints` (int) 和 `unlockedSkills` (Set/List).
    *   兼容性: 现有的 `id` 索引结构非常适合做依赖检查。

#### 4.4.2 界面开发 (UI Development)
*   **可行性: 中**
*   **挑战**: 需要开发一个新的 UI 组件 `UI_SkillTree`。
    *   相比简单的列表，树状图需要处理节点位置 (Layout) 和连线绘制 (Canvas/SVG 或 简单的 CSS border)。
    *   **简化方案**: 如果 Canvas 绘制复杂，可以采用 **分层矩阵 (Tiered Matrix)** 布局，用箭头图标指示前置关系，降低开发成本。

#### 4.4.3 游戏体验 (Gameplay Experience)
*   **影响**: 正向。
*   **分析**:
    *   即时反馈减少 (战斗后没有直接技能奖励)，但长期规划感增强。
    *   符合 WoW 风格的 RPG 深度。
    *   **风险**: 早期如果不给足够的 KP，玩家可能觉得技能太少。需要仔细调整 KP 投放节奏。

#### 4.4.4 结论 (Conclusion)
该方案 **技术上完全可行**，且能显著提升游戏的 RPG 养成深度。建议优先实施 **数据层改造** 和 **基础 UI (简化版树状图)**。

### 4.5 技能解锁体系设计（Unlock System Spec）

本节用于把“技能获取/解锁”的规则从 UI 行为提升为可数据化的设计方案，使其能够在：天赋树、事件奖励、商店购买、装备/职业限定等不同来源下复用。

#### 4.5.1 `prerequisites` 字段的设计初衷

你当前在 `skills.json` 中使用 `prerequisites: string[]`（skillId 列表）表达“前置技能已解锁”。

该字段适合解决的核心问题只有一个：

- **依赖关系（Dependency Graph）**：某技能解锁前，必须先解锁哪些技能。

它天然对应“天赋树连线”的数据基础，因此作为最小实现（MVP）是合理的。

#### 4.5.2 仅用 `prerequisites` 是否能完全满足“解锁体系”需求？

结论：**不能完全满足**。

原因是“技能解锁”在设计上通常至少包含 3 类约束，而 `prerequisites` 只覆盖其中 1 类：

1) **结构约束（前置关系）**：由 `prerequisites` 覆盖。
2) **资源约束（解锁消耗）**：例如 KP/金币/道具/天赋点数的消耗与数量。
3) **条件约束（额外限制）**：例如玩家等级、关卡进度、阵营/职业、已解锁的某类标签数量、需要某个装备或某个部位可用等。

如果只用 `prerequisites`：

- 无法表达“KP 不足不能点亮”；
- 无法表达“达到第 N 关才能点亮”；
- 无法表达“需要先点亮同流派 X 个技能”（天赋树常见门槛）；
- 无法表达“互斥技能（二选一分支）”；
- 无法表达“临时授予/战斗内获得”与“永久解锁”的区别。

因此，`prerequisites` **是必要但不充分** 的一部分。

#### 4.5.3 推荐的解锁数据结构（在保留 `prerequisites` 的前提下扩展）

为避免把所有规则硬编码到 UI 或引擎逻辑里，建议技能对象新增统一的解锁配置块（命名可选）：

- `unlock?: { ... }`：解锁入口统一描述

示例（仅示意，不要求立刻改数据文件）：

```json
{
  "id": "skill_savage_charge",
  "prerequisites": ["skill_heavy_swing"],
  "unlock": {
    "cost": { "kp": 2 },
    "requirements": {
      "playerLevelAtLeast": 1,
      "minUnlockedInGroup": { "group": "melee", "count": 2 }
    },
    "exclusives": ["skill_other_branch"],
    "grants": { "type": "permanent" }
  }
}
```

字段语义建议：

- `unlock.cost`：解锁消耗（KP/金币/道具等），与战斗内 `costs`（AP/槽位）严格区分。
- `unlock.requirements`：解锁门槛（非消耗）。
- `unlock.exclusives`：互斥集合（用于“二选一”分支）。
- `unlock.grants`：解锁的授予类型（永久/本局/本场战斗）。

#### 4.5.4 `prerequisites` 的细化规则（避免歧义）

为了让 `prerequisites` 在工具链（skill editor / balance tool / UI tree）里稳定工作，建议在文档中固定以下规则：

1. **默认 AND 语义**：数组内所有 skillId 都必须已解锁。
2. **空数组表示无前置**：即树根节点。
3. **禁止循环依赖**：数据校验时必须检测 `A -> B -> A` 的环。
4. **仅表达“解锁依赖”，不表达“释放依赖”**：
   - 释放条件（比如“必须持有盾牌”“必须某部位可用”）属于技能的 `requirements/costs`（战斗内规则），不应混进 `prerequisites`。

如果未来需要 OR / AND 混合，建议用结构化表达替代简单数组（但不建议一开始就上复杂度）：

```json
{
  "prerequisites": {
    "allOf": ["skill_a"],
    "anyOf": ["skill_b", "skill_c"]
  }
}
```

#### 4.5.5 与知识点（KP）天赋树方案的对应关系

- `prerequisites`：解决“树的连线/依赖”。
- `unlock.cost.kp`：解决“点亮消耗多少 KP”。
- `Player.knowledgePoints` + `Player.unlockedSkills`：解决“当前是否可点亮”。

因此：

- 如果你要做的是“类似魔兽世界天赋树”的稳定解锁体系，**建议保留 `prerequisites`，并补充 `unlock.cost` 与 `unlock.requirements`**。

---

## 5. 技能数据规范（Data Spec / Schema）

本章节给出技能数据结构的落地规范：如何在 `skills.json` / `skills_*_v3.json` 中组织技能对象，使其能被引擎、编辑器、平衡工具共同使用。

### 5.1 技能与 Buff 系统的对接规范（重要）

本节用于把 `03-技能系统(skill_design)-设计说明.md` 中的“技能效果描述”与新版 `09-Buff系统(buff_design)-设计说明.md` / `assets/data/buffs.json` 的 **数据驱动 Buff 体系**对齐。

#### 5.1.1 设计原则

1. **技能只“引用 Buff”，不直接定义 Buff 的运行逻辑**：
   - 技能文档中不再使用“[Buff]/[Debuff] + 一段自由文本”作为唯一规范。
   - 技能只需要声明要施加/移除/刷新哪些 `buffId`（这些 `buffId` 的行为完整定义在 `buffs.json`），以保证低耦合。

2. **Atomic Buff（原子 Buff）优先**：
   - 一个 `buffId` 尽量只描述一个清晰效果（比如“流血 DoT”“减速”“破甲（下一次攻击调整护甲减免）”）。
   - 复杂技能通过“施加多个 Atomic Buff”组合实现，而不是在技能里写特殊逻辑。

3. **触发器/动作以 Buff 为主，技能只负责“施加时机与目标”**：
   - Buff 的触发频率（例如 `onTurnStart` / `onAttackPre` / `onTakeDamagePre`）由 Buff 自身定义。

#### 5.1.2 技能文档中的 Buff 引用字段约定（文档层面）

> 本节是“设计文档约定”，用于后续落地成 `skills.json` schema（如果你后续计划更新数据文件）。

- `buffRefs.apply`: 技能成功命中后施加的 Buff 列表
- `buffRefs.applySelf`: 技能释放后对自身施加的 Buff 列表
- `buffRefs.remove`: 技能用于移除的 Buff 列表（如净化）
- `buffRefs.notes`: 仅用于解释该 Buff 的触发点、层数策略或范围（不写运行逻辑）

每个引用项建议具备：
- `buffId`: 必须存在于 `assets/data/buffs.json`
- `target`: `self | enemy`（若需要“部位级”目标，交由 Buff 的 `scope.part`/目标配置表达，技能只负责把“目标对象”传入引擎）
- `stacks`: 可选，若需要技能一次性叠加多层（最终仍受 Buff 的 `lifecycle.maxStacks` 限制）

---

### 5.2 技能平衡标签体系与元数据规范（补充）

本节将 `06-技能平衡(skill_balance_design)-设计说明.md` 中的“技能分类标签（Skill Tags）”融入技能设计方案，作为技能的**设计语义层**。该层不改变引擎结算，但能显著提升：技能库检索、强度对照、以及 editor 的数据校验能力。

#### 5.2.1 基本原则（字段 vs 标签）

- 技能字段（`cost/speed/targetType/requiredPart/buffRefs/effects`）表达的是**运行时事实**（引擎如何结算）。
- `tags/tagMeta` 表达的是**设计语义**（设计意图、用于检索与统计）。
- 两者冲突时，以字段为准；标签用于发现问题与提示修正。

#### 5.2.2 数据结构（建议写入 `skills.json`，或由 Skill Editor 维护）

- `tags: string[]`
  - 存放标签枚举。
  - 建议按固定维度顺序书写，便于肉眼扫描（示例见 1.2.6）。
- `tagMeta?: object`
  - 参数化信息（例如固定部位列表、设计备注等）。
  - 不影响引擎结算；主要用于设计说明与编辑器提示。

#### 5.2.3 标签维度（稳定枚举，建议写死到编辑器下拉）

1) **作用属性（What it changes）**

- `DMG_HP` / `DMG_ARMOR` / `PIERCE` / `HEAL` / `ARMOR_ADD` / `AP_GAIN` / `SPEED` / `BUFF_APPLY` / `BUFF_REMOVE`

2) **数值类型（Absolute vs Relative）**

- `ABS` / `PCT_MAX` / `PCT_CURRENT` / `SCALING`

3) **生效时间点（Immediate vs Delayed）**

- `INSTANT` / `DELAYED` / `ON_EVENT`

4) **持续周期（Duration / Lifetime）**

- `ONE_SHOT` / `ONE_TURN` / `MULTI_TURN` / `BATTLE` / `PERMANENT`

5) **释放对象（Target Subject / Scope / Selection）**

- Subject：`SUBJECT_SELF` / `SUBJECT_ENEMY` / `SUBJECT_BOTH`
- Scope：`SCOPE_ENTITY` / `SCOPE_PART` / `SCOPE_MULTI_PARTS`
- Selection（可选增强）：`SELECT_FIXED_PART` / `SELECT_RANDOM_PART` / `SELECT_ALL_PARTS`

6) **体系组织（Build / Archetype）**

- 距离：`MELEE` / `RANGED` / `MAGIC`
- 流派：`ARCH_HEAVY` / `ARCH_WALL` / `ARCH_SWORD` / `ARCH_RANGER` / `ARCH_SNIPER` / `ARCH_ELEMENT` / `ARCH_HOLY`

#### 5.2.4 可扩展标签（允许新增，但应逐步收敛）

- 条件类：`COND_*`（例如 `COND_TARGET_ARMOR_BROKEN`、`COND_SELF_HP_LT_X`、`COND_STACK_GE_X`、`COND_PREV_SKILL_USED`）
- 玩法偏好类：`COMBO` / `FINISHER` / `SETUP` 等（用于设计沟通，不建议影响结算）

#### 5.2.5 与运行时字段的对照（用于校验）

> 下列对照用于“编辑器校验/人工审查”发现：标签与配置是否一致。

- `SUBJECT_SELF` 常见对应：`targetType=SELF` 或 `targetType=SELF_PARTS`，以及 `buffRefs.applySelf` 为主。
- `SUBJECT_ENEMY` 常见对应：`targetType=ENEMY` / `SINGLE_PART` / `ALL_PARTS` / `RANDOM_PART`，以及 `buffRefs.apply` 为主。
- `SCOPE_ENTITY` 常见对应：不要求 `requiredPart`；效果落在 HP/AP/speed 或全局 buff。
- `SCOPE_PART` 常见对应：`targetType=SINGLE_PART` 且存在 `requiredPart`（或运行时能明确一个部位）。
- `SCOPE_MULTI_PARTS` 常见对应：`targetType=ALL_PARTS` 或 `targetType=SELF_PARTS`。
- `SELECT_FIXED_PART` 常见对应：`targetType=SINGLE_PART` + `requiredPart`。
- `SELECT_RANDOM_PART` 常见对应：`targetType=RANDOM_PART`。
- `SELECT_ALL_PARTS` 常见对应：`targetType=ALL_PARTS` 或 `SELF_PARTS`。

#### 5.2.6 标签最小完备性（推荐约束）

建议每个技能至少具备：

- 1 个 What
- 1 个 How
- 1 个 When
- 1 个 How long
- `SUBJECT_*` + `SCOPE_*`（必选）
- 1 个距离标签（`MELEE/RANGED/MAGIC`）
- 1 个流派标签（`ARCH_*`）

#### 5.2.7 tags 示例（写法示例）

以“破甲打击（对敌单部位）”为例：

- 字段：`targetType=SINGLE_PART`、`requiredPart=chest`
- 标签：
  - `DMG_ARMOR` + `ABS` + `INSTANT` + `ONE_SHOT`
  - `SUBJECT_ENEMY` + `SCOPE_PART` + `SELECT_FIXED_PART`
  - `MELEE` + `ARCH_SWORD`

---

### 5.3 标准技能数据对象模板（Schema Draft / v2）

> 目的：提供一个可长期维护的 `skills.json` 技能对象结构模板。
>
> 说明：
>
> - 本模板以 `06-技能平衡(skill_balance_design)-设计说明.md` 的目标选择三段式（3.7 Subject/Scope/Selection）与“需求/消耗”模型（第5章）为基础。
> - 当前你已移除“流派”概念，因此模板中不再强制包含 `ARCH_*`。如未来需要分类，可用 `groups/tags` 扩展。

#### 5.3.1 顶层字段（最小可用集合）

推荐每个技能对象至少包含：

- `id: string`：技能唯一 ID（稳定主键）
- `name: string`
- `description?: string`
- `rarity?: "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary"`

- `speed?: number`：技能速度修正（用于行动排序）

- `target: { subject, scope, selection? }`：默认目标锚点（三段式）。主要服务于 UI 的拖拽/点击选择、待执行队列记录与回放；在执行阶段可被 action 通过 `follow: skillTarget` 引用。

- `actions: SkillAction[]`：技能执行步骤数组（Skill v4 核心）。技能的所有结算逻辑都必须落在 `actions[]` 中。
- `buffRefs?: { apply?, applySelf?, remove? }`：Buff 引用（数据驱动）

- `requirements?: object`：门槛（必须满足但不一定消耗）
- `costs?: object`：消耗（满足后会扣除资源/占槽）

- `prerequisites?: string[] | object`：解锁前置（用于技能树依赖关系，见 4.5）
  - `string[]`：默认 AND 语义（数组内所有技能都已解锁才满足）
  - `object`：可选的结构化表达（例如 `allOf/anyOf`，用于 OR/AND 混合）
- `unlock?: object`：解锁配置（用于解锁消耗/门槛/互斥/授予类型，见 4.5）

- `editorMeta?: object`：编辑器元数据（仅编辑器/工具使用，不参与引擎结算）

- `tags?: string[]`：用于统计/筛选/平衡校验
- `tagMeta?: object`：标签参数（例如 parts、说明等）

- `devNote?: string`：开发/策划注记（仅编辑器/工具使用，不参与引擎结算）
- `notes?: object[]`：结构化注记列表（可选，用于更强的筛选与流程管理）

##### 5.3.1.1 `editorMeta`（Skill Editor 可视化布局元数据）

为支持 `Skill_editor_test` 进行技能树的二维可视化编辑，需要在技能数据中保存“节点在画布/网格中的位置”。

设计目标：

1. **只服务编辑器**：引擎战斗结算不读取该字段；它不应影响技能逻辑。
2. **可稳定保存/加载**：编辑器拖拽位置后可写回 json，下一次打开仍能保持布局。
3. **可兼容网格系统**：若编辑器采用网格（M*N）布局，`x/y` 可视为网格坐标；若采用自由拖拽，也可视为像素坐标。

##### 5.3.1.2 `devNote/notes`（技能编制注记：仅编辑/策划用途）

为支持技能在长期迭代过程中的“设计决策可追溯”和“问题记录”，引入 `devNote/notes` 字段用于记录：

- 该技能当前存在的问题、待验证点、平衡性风险
- 为什么采用当前的数值/标签/目标选择方案
- 与其它技能/Buff/装备的联动、冲突或测试结论

**定位与边界**

1. `devNote/notes` 是“设计/开发元信息”，**不参与战斗结算**；引擎（CoreEngine）应忽略该字段。
2. 该字段主要服务于 Skill Editor / Balance Tool / 文档追踪；可以被导出、被搜索、被筛选，但不应影响 runtime。

**推荐格式**

1) MVP 版本（最简单、最快落地）：

- `devNote?: string`

2) 结构化版本（便于后续 UI 表单化/过滤/统计）：

- `notes?: Array<{
    tag?: string,
    text: string,
    status?: "todo" | "verified" | "blocked",
    createdAt?: string
  }>`

字段约束建议：

- `notes[].createdAt`：建议使用 ISO 8601 格式字符串（例如 `2026-01-31T12:34:56Z`）
- `notes[].status`：枚举值固定为 `todo | verified | blocked`
- `notes[].tag`：建议用于粗分类（例如 `balance` / `bug` / `design` / `ui` / `data`），不做强制枚举，以便扩展

**Editor / Tool 保存约束（重要）**

Skill Editor / Balance Tool 在“保存/导出（Export(dev)）”时，必须保证：

- 不丢失 `devNote/notes` 以及其他未被当前 UI 表单覆盖的字段
- 推荐策略：以“内存中的 skill 完整对象”为基准，仅对被编辑的字段做局部更新（merge/patch），而不是用字段白名单重建对象

推荐结构：

```json
{
  "editorMeta": {
    "x": 10,
    "y": 5,
    "group": "melee",
    "locked": false
  }
}
```

字段说明（建议约束）：

- `editorMeta.x: number`：节点横向坐标。
- `editorMeta.y: number`：节点纵向坐标。
- `editorMeta.group?: string`：编辑器分组用（例如流派/技能页签）；用于 UI 过滤、同屏布局。
- `editorMeta.locked?: boolean`：节点是否锁定位置（避免误拖动）。

坐标语义建议（二选一，保持一致即可）：

- **网格坐标模式（推荐）**：`x/y` 代表网格单元坐标（整数，`0..N-1`），编辑器负责把网格坐标映射到像素；优点是对齐稳定、连线更规整。
- **像素坐标模式**：`x/y` 直接代表画布像素；优点是自由，缺点是缩放/响应式难维护。

与依赖关系的关系：

- `prerequisites` 决定“树的连线/前置关系”（逻辑结构）。
- `editorMeta` 决定“树的摆放/布局”（视觉结构）。

两者必须解耦：编辑器允许只调整 `editorMeta` 而不改变 `prerequisites`。

#### 5.3.2 `target`（核心：目标选择三段式 / 默认目标锚点）

> **Skill v4：默认 Target + Actions[]（解决多效果/多目标）**
>
> 为了同时满足：
>
> 1) **交互输入**：玩家在 UI 中可以拖拽/点击快速指定目标（默认目标）；
> 2) **技能表达力**：同一个技能可以包含多个效果（例如“自伤 + 攻击”）且每个效果可能作用于不同对象；
>
> 设计上保留 Skill 级 `target` 作为**默认目标锚点 (Default Target Anchor)**，并新增 `actions[]` 作为**执行步骤 (Execution Steps)**。
>
> - Skill 级 `target`：主要服务于“配置阶段/待执行队列/存档回放”，是技能的默认目标选择结果。
> - `actions[]`：负责描述技能真实执行逻辑；每个 action 自带独立的 target + effects。
> - action 的 target 支持两类模式：
>   - **跟随指定目标**：复用 Skill 默认 `target`（或其他引用）
>   - **指定目标**：action 内显式定义自己的目标（例如对自己扣血）

```json
{
  "target": {
    "subject": "SUBJECT_ENEMY",
    "scope": "SCOPE_PART",
    "selection": {
      "mode": "single",
      "candidateParts": ["head", "chest", "abdomen", "arm", "leg"],
      "selectedParts": ["chest"],
      "selectCount": 1
    }
  }
}
```

##### 5.3.2.1 字段说明（默认目标 `target`）

- `target.subject`（必填）
  - `SUBJECT_SELF`：对自己
  - `SUBJECT_ENEMY`：对敌人
  - `SUBJECT_BOTH`：（可选）同时影响双方

- `target.scope`（必填）
  - `SCOPE_ENTITY`：角色整体（不绑定部位）
  - `SCOPE_PART`：单个部位
  - `SCOPE_MULTI_PARTS`：多个部位（1v1 的 AOE 等价物）

- `target.selection`（可选，但当 `scope != SCOPE_ENTITY` 时必填）

  > **重要前提**：在战斗输入/释放机制里，“目标选择”最终会落到**某些槽位（部位）**。
  > 因此 Selection 以“槽位选择”建模，而不是用 `part/parts` 这种互斥字段。

  - `mode: "single" | "multiple" | "random_single" | "random_multiple"`
    - `single`：指定单个槽位（玩家选择 1 个部位）
    - `multiple`：指定多个槽位（玩家选择 N 个部位）
    - `random_single`：随机单个槽位（从候选池随机 1 个部位）
    - `random_multiple`：随机多个槽位（从候选池随机 N 个部位）

  - `candidateParts: string[]`
    - 候选部位池（该技能允许命中/影响的部位范围）。
    - 例：只能攻击手部 -> `["arm"]`；攻击任意部位 -> 全部部位列表。
    - 约束建议：`candidateParts` 应使用标准枚举（`head/chest/abdomen/arm/leg`），避免旧版左右拆分混入数据。

  - `selectedParts: string[]`
    - 已选部位（主要用于：
      - **静态技能**：技能写死目标（可直接预填，例如固定打胸）
      - **技能配置阶段 UI**：玩家已经选定的部位结果
      - **存档/回放**：记录当回合技能配置时的目标选择结果）
    - 对于 `random_*`：
      - 设计层面可留空，由引擎在执行阶段从 `candidateParts` 中生成；
      - 或在“已配置待执行技能队列”里落地为具体结果（便于回放）。

  - `selectCount: number`
    - 允许选择/抽取的数量 N。
    - 对 `single` / `random_single` 通常固定为 `1`。
    - 对 `multiple` / `random_multiple` 表示 N。
    - 约束建议：`selectCount <= candidateParts.length`。

  > 一致性约束建议：
  >
  > - `mode` 为 `single | random_single` 时：`selectCount` 必须为 `1`。
  > - `mode` 为 `multiple | random_multiple` 时：`selectCount >= 1`。
  > - 若 `selectedParts` 非空：必须满足 `selectedParts.length == selectCount` 且 `selectedParts` 都属于 `candidateParts`。
  > - `selectedParts` 不允许重复。

> 约束建议：
>
> - `scope = SCOPE_ENTITY`：在数据层**显式表达“全选”**（例如用于统一 UI/统计/回放结构，让所有技能都有 selection 对象），约定：
>     - `mode = "multiple"`
>     - `candidateParts = 全部部位列表`
>     - `selectedParts = 全部部位列表`
>     - `selectCount = candidateParts.length`
> - `scope = SCOPE_PART`：建议 `selection.mode` 仅使用 `single | random_single`（因为只允许落到一个槽位）。
> - `scope = SCOPE_MULTI_PARTS`：建议 `selection.mode` 使用 `multiple | random_multiple`。
> - `scope = SCOPE_MULTI_PARTS` 且你想表达“全身所有部位”：推荐约定 `selectCount = candidateParts.length`。

##### 5.3.2.2 常见目标选择模式示例

###### (A) 玩家指定：攻击任意单部位

```json
{
  "target": {
    "subject": "SUBJECT_ENEMY",
    "scope": "SCOPE_PART",
    "selection": {
      "mode": "single",
      "candidateParts": ["head", "chest", "abdomen", "arm", "leg"],
      "selectedParts": [],
      "selectCount": 1
    }
  }
}
```

#### 5.3.3 `actions[]`（Skill v4：执行步骤）

`actions[]` 用于描述“一个技能由多个步骤组成”，每个步骤包含：

- `action.target`：该步骤作用的目标（可跟随默认目标，或显式指定）
- `action.effect`：该步骤对目标产生的**单个效果**（复用 5.3.3 的 `SkillEffect` schema）

**推荐约束**：

- 结算顺序严格按 `actions[]` 从前到后执行（序列语义）；
- 需要并行/分组时再扩展（例如 `phase/group`），MVP 不引入。

##### 5.3.3.1 `SkillAction` 示例：自伤 + 攻击（复合技能）

```json
{
  "target": {
    "subject": "SUBJECT_ENEMY",
    "scope": "SCOPE_PART",
    "selection": {
      "mode": "single",
      "candidateParts": ["head", "chest", "abdomen", "arm", "leg"],
      "selectedParts": [],
      "selectCount": 1
    }
  },
  "actions": [
    {
      "id": "a1",
      "name": "self_cost",
      "target": {
        "binding": { "mode": "explicit" },
        "spec": { "subject": "SUBJECT_SELF", "scope": "SCOPE_ENTITY" }
      },
      "effect": { "effectType": "DMG_HP", "amount": 2, "amountType": "ABS" }
    },
    {
      "id": "a2",
      "name": "strike",
      "target": {
        "binding": { "mode": "follow", "ref": "skillTarget" }
      },
      "effect": { "effectType": "DMG_HP", "amount": 10, "amountType": "ABS" }
    }
  ]
}
```

##### 5.3.3.2 `action.target`：binding（跟随/指定）

为避免 action 目标与 Skill 默认目标“职责混淆”，action 目标分为两层：

- `binding`：描述 action 的目标如何解析
- `spec`：仅当显式指定目标时，提供目标结构（复用 Skill 级 `target` 的三段式结构）

字段定义建议：

- `action.target.binding.mode: "follow" | "explicit"`
  - `follow`：跟随某个引用目标，不在 action 内写死目标
    - `action.target.binding.ref: "skillTarget" | "source" | "lastActionTarget"`
      - `skillTarget`：跟随 Skill 的默认 `target`（UI 配置/拖拽选择的结果）
      - `source`：跟随释放者（等价“对自己”，但语义更明确）
      - `lastActionTarget`：（可选）跟随上一 action 解析出的目标（用于链式技能；MVP 可不实现）
  - `explicit`：action 指定自己的目标
    - `action.target.spec: { subject, scope, selection? }`

##### 5.3.3.3 解析优先级与“默认目标缺失”策略

1) 若 action 使用 `binding.mode = explicit`：直接使用 `spec` 解析目标。

2) 若 action 使用 `binding.mode = follow`：

- `ref = skillTarget`：必须存在 Skill 级 `target`（通常来自 UI 配置结果）
- `ref = source`：由引擎上下文提供 source（无需 Skill 默认 target）

3) 当 `ref = skillTarget` 且 Skill 默认 `target` 缺失时，建议在设计层引入如下约束二选一：

- **强约束（推荐）**：技能声明 `requiresTarget = true`，UI 若未完成目标配置则禁止进入执行阶段。
- **弱约束**：允许引擎在执行时回退到 `target.selection` 的默认策略（如 `random_single` 或固定 `selectedParts`），但必须在数据中显式配置。

##### 5.3.3.4 `effects`（action 子效果 / 建议强 schema）

> **重要：本方案已完成重构，不再支持“技能顶层 effects”。**
>
> - 技能对象不再包含 `effects` 顶层字段。
> - 所有效果必须写在 `actions[].effect` 中。
> - 因此本节的 `effects` 默认指 **`action.effect`**。

> 目标：把“技能做了什么”从自由文本/散乱字段，收敛成可校验、可编辑、可统计的结构化效果列表。
>
> 设计原则：
>
> 1. `target` 负责回答“对谁、对哪些槽位”。
> 2. `effects` 负责回答“产生什么数值/规则变化”。
> 3. Buff/触发器优先走 `buffRefs`，`effects` 只承载 **即时结算** 与少量必须的规则开关。

###### 5.3.3.4.1 `SkillEffect` 统一结构

建议统一为对象（位于 `actions[].effect`）：

```json
"effect": {
  "effectType": "DAMAGE",
  "amount": 20,
  "amountType": "ABS",
  "damageKind": "HP",
  "hit": { "mode": "normal" }
}
```

公共字段（所有 effect 推荐支持）：

- `effectType: string`：效果类型（枚举）。**直接复用 5.2.3 中的“作用属性（What）”标签作为枚举集合**，以保证标签体系与 effect schema 不脱节。
  - 例如：`DMG_HP` / `DMG_ARMOR` / `PIERCE` / `HEAL` / `ARMOR_ADD` / `AP_GAIN` / `SPEED` / `BUFF_APPLY` / `BUFF_REMOVE`
- `note?: string`：纯说明（不参与结算，可用于编辑器提示）

目标绑定规则（关键）：

- `action.effect` 默认继承 **该 action 解析出来的目标**（即 `action.target` 解析结果），而不是继承 Skill 顶层 `target`。
- effect 本身不再携带 `target=enemy/self`。
- 若某个 effect 需要在同一 action 内“临时改 subject”（不推荐，尽量用拆 action 解决），才使用：
  - `subjectOverride?: "SUBJECT_SELF" | "SUBJECT_ENEMY"`
- 若某个 effect 需要指定“具体部位/槽位”，则优先两种方式（按复杂度选择其一）：
  1) **复用 action 最终选中的槽位**：默认即可（effect 不写 part）
  2) **写死部位/部位集合覆盖**（仅在确实需要时）：
     - `partOverride?: { mode: "fixed" | "listed", parts: string[] }`

> 约束建议：不要在 effect 里再复制一份 selection 逻辑；selection 永远只在 `target.selection` 出现。

###### 5.3.3.4.2 effectType / amountType 与标签体系的对齐（推荐）

为避免 `effects` 与 `tags` 出现两套命名体系：

- `effect.effectType`：**直接使用 5.2.3 的“作用属性（What）”枚举**
- `effect.amountType`：**直接使用 5.2.3 的“数值类型（How）”枚举**

也就是说，`effects` 中不再使用 `DAMAGE/HEAL/...` 这种另起炉灶的 type。

**1) effectType（What）枚举来源**

- `DMG_HP`：对 HP 造成伤害（默认作用于 `target.selection` 选中部位；若护甲>0 是否透传 HP 由引擎伤害规则决定）
- `DMG_ARMOR`：对护甲造成伤害（破坏/削减某个或多个部位护甲）
- `PIERCE`：穿透/真伤类（若你希望它直接等价 TRUE DAMAGE，也可以在引擎层映射；否则作为规则开关）
- `HEAL`：治疗（通常用于 `SUBJECT_SELF`）
- `ARMOR_ADD`：护甲增加/修复（通常用于 `SCOPE_PART` 或 `SCOPE_MULTI_PARTS`）
- `AP_GAIN`：AP 变更
- `SPEED`：速度变更
- `BUFF_APPLY` / `BUFF_REMOVE`：原则上更建议用 `buffRefs`，但若你需要“即时施加/移除”且不想走 buffRefs，也可保留（后续建议收敛）

**2) amountType（How）枚举来源**

- `ABS`：绝对值
- `PCT_MAX`：按最大值百分比（例如最大 HP）
- `PCT_CURRENT`：按当前值百分比（例如当前 HP）
- `SCALING`：按某个来源属性缩放（例如按 `atk`、或按武器伤害）

> 说明：
>
> - 原先 `PERCENT` 这一类容易含混（到底是按 max 还是 current，还是按 atk 的百分比）。建议完全用 `PCT_MAX/PCT_CURRENT/SCALING` 三者覆盖。
> - 当 `amountType=SCALING` 时，建议提供 `scaling` 参数：`{ stat, multiplier }`。


---

#### 5.3.4 `requirements`（门槛）与 `costs`（消耗）

#### (A) `requirements`：必须满足，但不一定扣除

```json
{
  "requirements": {
    "targetHpPercentBelow": 0.3,
    "targetPart": { "armorZero": true },
    "selfPart": { "mode": "ANY", "parts": ["arm"], "mustBeUsable": true }
  }
}
```

#### (B) `costs`：满足后扣除的资源/占槽

```json
{
  "costs": {
    "ap": 3,
    "partSlot": { "part": "arm", "slotCost": 1 },
    "perTurnLimit": 1
  }
}
```

> 约束建议：
>
> - `cost` 与 `costs.ap` 统一为 `costs.ap`。
> - 若玩法采用“一回合配置多技能队列”，建议尽早让绝大多数技能显式写 `costs.partSlot`。

#### 5.3.5 `buffRefs`（技能引用 Buff，不写逻辑）

```json
{
  "buffRefs": {
    "apply": [
      { "buffId": "buff_bleed", "target": "enemy", "chance": 1.0, "duration": 3 }
    ],
    "applySelf": [
      { "buffId": "buff_block", "target": "self", "chance": 1.0, "duration": 1 }
    ],
    "remove": [
      { "buffId": "buff_poison", "target": "self" }
    ]
  }
}
```

#### 5.3.6 `tags/tagMeta`（用于统计与校验，可选但推荐）

```json
{
  "tags": [
    "DMG_ARMOR",
    "ABS",
    "INSTANT",
    "ONE_SHOT",
    "UNCONDITIONAL",
    "SUBJECT_ENEMY",
    "SCOPE_PART",
    "SELECT_FIXED_PART",
    "RES_AP",
    "RES_SLOT"
  ],
  "tagMeta": {
    "parts": ["chest"],
    "slot": { "part": "left_arm", "slotCost": 1 }
  }
}
```

#### 5.3.7 完整模板示例（推荐你后续在数据文件中采用）

```json
{
  "id": "skill_example_crush_armor",
  "name": "破甲打击",
  "rarity": "Common",
  "description": "对单个部位造成护甲伤害。",

  "prerequisites": [],
  "unlock": {
    "cost": { "kp": 1 },
    "requirements": {},
    "exclusives": [],
    "grants": { "type": "permanent" }
  },

  "editorMeta": {
    "x": 10,
    "y": 5,
    "group": "melee",
    "locked": false
  },

  "speed": 0,
  "costs": {
    "ap": 3,
    "partSlot": { "part": "right_arm", "slotCost": 1 },
    "perTurnLimit": 1
  },

  "target": {
    "subject": "SUBJECT_ENEMY",
    "scope": "SCOPE_PART",
    "selection": { "mode": "SELECT_FIXED_PART" }
  },

  "actions": [
    {
      "id": "a1",
      "name": "crush_armor",
      "target": {
        "binding": { "mode": "follow", "ref": "skillTarget" }
      },
      "effects": [
        { "effectType": "DMG_ARMOR", "amount": 20, "amountType": "ABS" }
      ]
    }
  ],

  "requirements": {
    "selfPart": { "mode": "ANY", "parts": ["right_arm"], "mustBeUsable": true }
  },

  "buffRefs": {
    "apply": [
      { "buffId": "debuff_weak", "target": "enemy", "chance": 0.25, "duration": 1 }
    ]
  },

  "tags": [
    "DMG_ARMOR",
    "ABS",
    "INSTANT",
    "ONE_SHOT",
    "UNCONDITIONAL",
    "SUBJECT_ENEMY",
    "SCOPE_PART",
    "SELECT_FIXED_PART",
    "RES_AP",
    "RES_SLOT",
    "REQ_SELF_PART"
  ],
  "tagMeta": {
    "notes": "MVP：护甲伤害与 debuff 组合。"
  }
}
```



## 6. 技能-Buff 追溯表 (Traceability)

## 6.1 Buff 历史缺口清单（当前示例已规避）

本清单用于对照 `assets/data/buffs.json`，列出“技能设计文档中需要引用，但当前数据中缺失/命名不一致”的 `buffId`。你可以据此判断哪些 Buff 需要新增、哪些应合并为现有 Buff、哪些应该改为“纯技能数值效果（不落 Buff）”。

> 注：以下清单以当前文档中已出现的 `buffId` 为准；同时也包含了你在旧版追溯表中使用、但与新版 `buffs.json` 不一致的命名。

### A. 历史上曾考虑/引用，但 `buffs.json` 当前未见定义（缺失）

（已从当前“技能示例/追溯表”中移除对应设计，避免引用不存在的 `buffId`。若未来需要恢复相关玩法，再考虑在 `buffs.json` 补齐。）

### B. `03-技能系统(skill_design)-设计说明.md` 旧追溯表中的命名，与新版 `buffs.json` 不一致（建议统一）

- `buff_weakness`：建议统一为 `debuff_weak`（当前 `buffs.json` 已定义 `debuff_weak`）

### C. 已在 `buffs.json` 存在（无缺口，但需确保技能引用保持一致）

- `buff_bleed`（流血）
- `buff_poison`（中毒）
- `buff_stun`（眩晕）
- `buff_slow`（减速）
- `buff_vulnerable`（易伤/承伤提升）
- `buff_block`（格挡/减伤）
- `buff_shield`（护盾：一次性抵挡）
- `buff_armor_pen`（破甲：通过 `armorMitigationMult` 修正护甲减免）
- `buff_bless`（祝福：命中/闪避）
- `debuff_weak`（虚弱：atk 降低）

---

为了确保技能系统与 Buff 系统的紧密集成，下表仅保留 **C 类（已存在于 `buffs.json`）** 与 **B 类（可通过改名对齐）** 的引用。

> 处理规则：
> - **A 类（缺失 buff）**：对应技能先从追溯表中移除（技能本体仍可保留为“纯技能效果”，但不再声称引用某个不存在的 `buffId`）。
> - **B 类（命名不一致）**：统一命名（例如 `buff_weakness` -> `debuff_weak`）。
> - **C 类（已存在）**：明确引用，避免用错 `buffId`。

| 技能名称 (Skill Name) | 关联 Buff ID | 说明 |
| :--- | :--- | :--- |
| **Artery Slice (血刃切割)** | `buff_bleed` | 命中后对目标施加流血 |
| **Thousand Cuts (千刀风暴)** | `buff_bleed` | 多段命中判定，多次尝试叠加流血 |
| **Bloody Harvest (血腥收割)** | `buff_bleed` | “依赖目标已有流血”的条件判断（Buff 仍为 `buff_bleed`） |
| **Crimson Finale (猩红终结)** | `buff_bleed` | 结算/移除流血层数（移除动作不一定是 Buff，需要引擎支持 removeById；此处仅标明依赖 `buff_bleed`） |
| **Poison Arrow (毒箭)** | `buff_poison` | 命中后对目标施加中毒 |
| **Shield Bash (盾牌猛击)** | `buff_stun` | 命中后对目标施加眩晕 |
| **Headbutt (蛮牛头槌)** | `buff_stun` | 命中后对目标施加眩晕 |
| **Earthquake (地震波)** | `buff_stun` | 概率对目标施加眩晕 |
| **Shockwave (震荡波)** | `buff_slow` | 命中后对目标施加减速 |
| **Knee Shot (膝盖射击)** | `buff_slow` | 命中且造成 HP 伤害后施加减速 |
| **Frost Nova (冰霜新星)** | `buff_slow` | 对目标施加减速并刷新持续时间 |
| **Taunt (嘲讽)** | `debuff_weak` | B 类：统一命名为 `debuff_weak` |
| **Disarm (远程缴械)** | `debuff_weak` | B 类：统一命名为 `debuff_weak`（原 `buff_weakness`） |
| **Mark Target (标记目标)** | `buff_vulnerable` | 命中后对目标施加易伤 |
| **Feint (佯攻)** | `buff_armor_pen` | 对自身施加“下一次攻击护甲减免修正” |
| **Bless (祝福)** | `buff_bless` | 对自身施加命中/闪避增益 |
| **Block (格挡)** | `buff_block` | 对自身施加减伤 |
| **Shield of Faith (信仰之盾)** | `buff_shield` | 对自身施加一次性护盾 |
| **Holy Shield (圣盾)** | `buff_shield` | 对自身施加一次性护盾（神圣系核心生存 Buff） |
| **Steady Aim (稳固瞄准)** | `buff_bless` | 对自身施加命中/闪避增益（用 `buff_bless` 近似实现） |
