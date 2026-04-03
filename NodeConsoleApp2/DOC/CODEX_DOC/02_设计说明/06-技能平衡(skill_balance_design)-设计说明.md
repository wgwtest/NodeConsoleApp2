# 技能平衡设计文档（`06-技能平衡(skill_balance_design)-设计说明.md`）

> 目标：解决“如何制作出一套合理技能”的方法论问题。
>
> 本文不直接给出所有技能清单，而是提供：设计原则、可量化的平衡维度、标签体系（可作为 `skills.json` / skill editor 的元数据字段），以及落地流程。

---

## 1. 技能的设计原则

### 1.1 与核心玩法一致

本项目战斗的核心约束（决定了技能设计的“地形”）：

1. **回合制 + 行动点（AP）预算**：玩家每回合能做的事情有限，技能之间天然存在“机会成本”。
2. **1v1 对战**：技能不需要处理复杂的群体单位生态；所谓 AOE 更接近“对一个目标的多个部位生效”。
3. **部位护甲（分散）+ HP（整体）**：护甲先承伤，护甲破坏后才扣 HP，技能在“破甲/穿透/补甲/恢复”上可做出明确策略分化。
4. **速度决定行动顺序**：技能不只是“做什么”，还包含“什么时候做”，速度是技能强度的重要维度。
5. **技能序列（组合/连携）**：单个技能强不强并不是唯一维度，组合之后是否过强/过弱更关键。

设计原则：

- **每个技能都必须回答一个战术问题**：
  - “我想更快出手？”
  - “我需要破某个部位护甲？”
  - “我需要保命/续航？”
  - “我需要在下回合爆发？”
- **让玩家在多种有效策略间做选择**（可行策略 > 最优解）。
- **尽量避免单技能无脑通吃**：如果一个技能在多数局面都是最优，它就需要被削弱，或增加条件/成本。

### 1.2 可读性优先于复杂度

- 技能描述必须能在 UI 上被解释清楚：伤害、buff、持续时间、目标、部位、触发条件。
- 技能效果尽量由 **可复用的 buff/effect 组件**组合而成（避免每个技能写定制逻辑）。

### 1.3 平衡目标：让“强度差”来自代价与条件

- 强力效果不一定不能存在，但必须付出代价：
  - 更高 AP
  - 更慢的 speed
  - 更严格的目标限制/前置条件
  - 更长的冷却/每回合次数限制（当前设定：同技能每回合只能用一次，可视为“硬冷却”）

### 1.4 强度要可度量、可回归

- 每个技能应当能映射到一套“可比较”的数值维度（见第2章），否则很难系统调参。

### 1.5 平衡建立在稳定框架之上

技能平衡不是孤立地调一个伤害数字，而是建立在技能系统整体框架稳定的前提下：

1. **定义层必须稳定**
   - skill 的 `target / costs / requirements / actions / buffRefs / tags` 语义清晰，平衡讨论才有共同语言。
2. **规划层必须可信**
   - 如果 AP、部位槽位、多选/单选规则、每回合次数限制不稳定，则任何数值平衡都会被规划漏洞放大或扭曲。
3. **执行层必须一致**
   - 设计表里写的是一回事，执行器实际结算的是另一回事，就不存在真正的平衡。
4. **Buff 边界必须清楚**
   - Skill 负责动作与意图，Buff 负责持续效果与事件响应；只有边界清楚，平衡才不会在两个系统之间重复计价。
5. **验证入口必须可回归**
   - 平衡调整后，应能在测试页、主流程、日志和数据对照中验证“数值变化真实生效”。

因此，平衡文档只讨论“如何设计合理技能”，不应承担修补契约混乱、规划失控、执行漂移的问题；这些应由对应层先收口。

---

## 2. 技能的作用属性（Effects & Stats）

> 目的：建立一个“技能能改变什么”的统一词表，供设计与实现共用。

### 2.1 基础作用属性（建议引擎层支持）

1. **伤害类（Damage）**
   - `damage.hp`: 对整体 HP 造成伤害（通常通过护甲系统折算后落到 HP）
   - `damage.armor`: 对某部位护甲造成伤害（破甲/削甲）
   - `damage.ignoreArmor`: 护甲忽略/穿透（按比例或按固定值）

2. **防护类（Defense / Armor）**
   - `armor.add`: 给指定部位增加护甲值
   - `armor.repair`: 修复护甲（从 0 恢复到一定值，或提高当前值）
   - `armor.max`: 增加护甲上限（可选，若系统存在上限）

3. **生命类（HP / Sustain）**
   - `hp.heal`: 回复 HP
   - `hp.max`: 增加最大 HP（通常是长期 buff）

4. **行动类（Action / Tempo）**
   - `ap.cost`: 技能自身 AP 成本（配置项）
   - `ap.gain`: 返还/获得 AP（例如“专注”类技能）
   - `speed.delta`: 改变行动速度（加速/减速）
   - `turn.extra`: 额外行动/插队（若实现难度高，可作为高阶效果受限使用）

5. **状态类（Buff / Debuff）**
   - `buff.apply`: 给目标施加 buff/debuff（通过 `buffRefs`）
   - `buff.remove`: 驱散/净化（通过 `buffRefs.remove`）

6. **机制类（Mechanics / Rule-Breakers）**
   > 机制类指“跳出/规避基础规则”的效果。它们通常不是简单的数值加减，而是改变结算路径或行动规则。
   > 由于容易破坏系统平衡，建议作为高稀有度/高代价/强条件的能力，并且尽量通过 buff/trigger 进行显式表达与可反制。

   - `mechanic.bypassArmorToHp`: 直接绕过护甲，结算为对 HP 的伤害（或将一部分伤害按比例转为直伤 HP）
   - `mechanic.ignoreArmorReduction`: 忽略护甲的减伤计算（与“穿透”不同：穿透可能只是降低护甲值，此项是改变减伤规则）
   - `mechanic.skipTurn`: 使目标跳过其下一次行动/回合（硬控类，风险极高）
   - `mechanic.extraAction`: 获得一次额外行动/插队（改变行动经济，风险极高）
   - `mechanic.preventAction`: 禁止使用某类技能/禁止攻击/禁止防御（可视为软控，通常需要可驱散）
   - `mechanic.immunity`: 对某类效果免疫（例如免疫破甲/免疫控制），通常为短时 buff

### 2.2 作用目标维度（Targeting）

- 目标阵营：`SELF` / `ENEMY`
- 目标粒度：
  - `SINGLE_PART`：指定部位
  - `ALL_PARTS`：目标全部部位（1v1 下的“AOE”等价物）
  - `RANDOM_PART`：随机部位
  - `SELF_PARTS`：对自身多个部位生效

### 2.3 强度衡量的推荐维度（用于平衡）

为了比较不同技能强度，建议为每个技能建立一个“评估面板”（无需写进引擎，但建议写进设计/调参表）：

- **AP 效率**：单位 AP 能带来多少净收益（伤害/护甲/治疗/控制）
- **时序价值**：速度带来的“先手优势”折算
- **确定性**：是否有随机性（命中率/触发概率/随机部位）
- **可反制性**：是否能被驱散、是否需要前置、是否容易被针对
- **成长性**：随着回合数/叠层是否指数变强（需要重点防止滚雪球）

---

## 3. 技能的分类标签（Skill Tags / Taxonomy）

> 目的：让每个技能都能被一致地描述、检索、统计与平衡。

本章标签建议作为技能的元数据字段（例如 `tags: []`），但即便暂时不写入数据文件，也应在设计表中维护。

### 3.1 按作用属性维度（What it changes）

- `DMG_HP`：以 HP 伤害为主
- `DMG_ARMOR`：以护甲伤害/破甲为主
- `PIERCE`：穿透/忽略护甲
- `HEAL`：治疗
- `ARMOR_ADD`：加护甲/补护甲
- `AP_GAIN`：获得/返还 AP
- `SPEED`：加速/减速/插队（若有）
- `BUFF_APPLY`：施加 buff
- `BUFF_REMOVE`：移除 buff

### 3.2 按数值类型（Absolute vs Relative）

- `ABS`：修改绝对值（+10 HP、-5 Armor）
- `PCT_MAX`：按最大值比例（最大 HP 的 10%）
- `PCT_CURRENT`：按当前值比例（当前护甲的 30%）
- `SCALING`：按来源属性缩放（例如 atk * 1.2；若系统支持）

### 3.3 按生效时间点（Immediate vs Delayed）

- `INSTANT`：即时生效（释放时立刻结算）
- `DELAYED`：延时生效（下回合/若干回合后触发）
- `ON_EVENT`：事件触发（如受击时、回合开始/结束时）

> 注：`DELAYED` 与 `ON_EVENT` 通常通过 buff/trigger 来实现。

### 3.4 按持续周期（Duration / Lifetime）

- `ONE_SHOT`：单次生效（典型伤害技能）
- `ONE_TURN`：单回合持续（例如“本回合 +护甲”）
- `MULTI_TURN`：多回合持续（例如 3 回合中毒）
- `BATTLE`：单战斗持续（直到战斗结束）
- `PERMANENT`：永久持续（Roguelike 成长向，通常来自装备/天赋）

### 3.5 按条件（Conditionality）

- `UNCONDITIONAL`：无条件
- `CONDITIONAL`：有条件（需要额外描述条件）

条件的推荐细分（可选）：
- `COND_TARGET_ARMOR_BROKEN`：目标某部位护甲为 0
- `COND_SELF_HP_LT_X`：自身 HP 低于阈值
- `COND_STACK_GE_X`：某 buff 层数达到阈值
- `COND_PREV_SKILL_USED`：依赖上一技能/连携

### 3.6 风格与流派维度（Build / Archetype）

用于“设计一套技能体系”的全局组织：

- 流派（示例）：`ARCH_HEAVY`（重装）、`ARCH_WALL`（铁壁）、`ARCH_SWORD`（剑术）、`ARCH_RANGER`（游侠）、`ARCH_SNIPER`（狙击）、`ARCH_ELEMENT`（元素）、`ARCH_HOLY`（神圣）
- 距离（可选）：`MELEE` / `RANGED` / `MAGIC`

### 3.7 按释放对象维度（Target Subject / Release Object）

> 目的：补足“技能是对谁释放、作用在什么对象粒度上”的分类能力。
> 该维度与 `targetType` / `requiredPart` 字段是互补关系：
>
> - 字段表达的是**运行时事实**（引擎如何结算）
> - 标签表达的是**设计语义**（设计意图/用于检索与平衡统计）
>
> 当标签与字段冲突时，以字段为准；标签用于校验与提示。

#### 3.7.1 阵营对象（Subject）

- `SUBJECT_SELF`：主要对自己施放（治疗、加护甲、自增益、净化等）
- `SUBJECT_ENEMY`：主要对敌人施放（伤害、破甲、减益、控制等）
- `SUBJECT_BOTH`：（可选）同时影响双方（较少见，通常属于高阶机制类）

#### 3.7.2 作用粒度（Scope）

- `SCOPE_ENTITY`：作用在角色整体（HP/AP/速度/全局免疫等，不绑定部位）
- `SCOPE_PART`：作用在单个部位（典型：护甲、部位 debuff、指定部位打击）
- `SCOPE_MULTI_PARTS`：作用在多个部位（1v1 中的“AOE”等价物：全身部位伤害/全身部位增益）

#### 3.7.3 选择方式（Selection，可选增强）

> 若后续需要更细分的检索/校验，可增加以下可选标签；MVP 阶段可不强制要求。

- `SELECT_FIXED_PART`：指定部位（通常对应 `targetType=SINGLE_PART` 且存在 `requiredPart`）
- `SELECT_RANDOM_PART`：随机部位（通常对应 `targetType=RANDOM_PART`）
- `SELECT_ALL_PARTS`：全部部位（通常对应 `targetType=ALL_PARTS` 或 `SELF_PARTS`）
- `SELECT_LISTED_PARTS`：（建议扩展）指定多个部位（用于 `SCOPE_MULTI_PARTS` 但不覆盖全身的情况，例如“只作用四肢/只作用双腿/只加固上半身”等）

#### 3.7.4 标签完整性建议（推荐约束）

- 每个技能至少具备：`SUBJECT_*` + `SCOPE_*`。
- 若 `SUBJECT_SELF`：
  - 常见为 `SCOPE_ENTITY`（治疗、净化）或 `SCOPE_MULTI_PARTS`（全身部位修甲/加护甲）。
- 若 `DMG_ARMOR`：通常应为 `SCOPE_PART` 或 `SCOPE_MULTI_PARTS`。
- 若技能要求玩家选择/指定部位，建议补充 `SELECT_FIXED_PART/SELECT_RANDOM_PART/SELECT_ALL_PARTS` 以便检索与校验。

---

## 4. 技能标签体系（可落地的 Schema 方案）

### 4.1 标签字段建议

建议在 `skills.json` 的每个技能对象中增加（或由编辑器额外维护）以下字段：

- `tags: string[]`：基础标签（枚举集合，便于过滤与统计）
- `tagMeta?: object`：标签的参数化信息（用于条件类、部位类等）

示例：

```json
{
  "id": "skill_crush_armor",
  "name": "破甲打击",
  "cost": 3,
  "speed": -1,
  "targetType": "SINGLE_PART",
  "requiredPart": "chest",
  "tags": ["DMG_ARMOR", "ABS", "INSTANT", "ONE_SHOT", "UNCONDITIONAL", "SUBJECT_ENEMY", "SCOPE_PART", "SELECT_FIXED_PART", "MELEE", "ARCH_SWORD"],
  "tagMeta": {
    "parts": ["chest"],
    "notes": "专门对胸甲造成高额护甲伤害"
  }
}
```

### 4.2 标签枚举设计建议（稳定枚举 vs 可扩展）

- **稳定枚举**（建议写死到文档/编辑器下拉）：
  - 作用属性类（`DMG_HP` 等）
  - 数值类型类（`ABS`/`PCT_MAX`/`PCT_CURRENT`/`SCALING`）
  - 生效时间点（`INSTANT`/`DELAYED`/`ON_EVENT`）
  - 持续周期（`ONE_SHOT`/`ONE_TURN`/`MULTI_TURN`/`BATTLE`/`PERMANENT`）
  - 释放对象（`SUBJECT_*`）与作用粒度（`SCOPE_*`），以及（可选）选择方式（`SELECT_*`）
  - 距离/流派（`MELEE`/`RANGED`/`MAGIC` + `ARCH_*`）

- **可扩展标签**（允许自由新增，但要有约束与校验）：
  - 条件类（`COND_*`）
  - 玩法类（例如 `COMBO`/`FINISHER`/`SETUP`）

> 原则：枚举越稳定，越适合用于 UI 的过滤与统计；扩展标签用于快速迭代，但应逐步“收敛入枚举”。

### 4.3 设计流程：用标签驱动技能产出

推荐“先标签、后数值”的设计流程：

1. 先确定技能的 **战术定位**：输出/破甲/续航/节奏/控制/辅助。
2. 选择标签组合（至少覆盖）：
   - 作用属性（What）
   - 数值类型（How）
   - 时间点（When）
   - 周期（How long）
   - 条件（If）
   - 部位（Where）
3. 再确定 AP 与 speed（成本维度）。
4. 最后确定具体数值（伤害/护甲/持续时间/概率）。
5. 通过“对照组”测试：
   - 同 AP、同 speed 的技能应当强度接近，但玩法不同
   - 更强效果必须对应更高代价或更苛刻条件

---

## 5. 技能需求资源与消耗模型（Resource Requirements）

> 目的：补齐“释放技能需要消耗什么资源、消耗多少、是否受部位与技能槽限制”的描述能力。
>
> 背景：当前战斗输入是“**一回合选择多个技能进行组合释放**”，因此仅用 `cost/AP` 很难完整表达约束。
> 例如：
>
> - 同回合能否重复使用某种类型技能？
> - 某些技能是否依赖“自身某个部位可用/未受伤/未被封印”？
> - 每个部位是否有“技能槽位”上限（本回合该部位最多放几个技能）？
> - 某些技能是否需要先占用某个部位的“姿态/准备槽”，导致同回合其他技能不能使用？

### 5.1 资源类型（Resource Types）

建议把“需求资源”拆成两层：

1) **全局资源（Global Resources）**：不依赖部位、通常每回合刷新
- `AP`：行动点（当前已有）

2) **部位资源（Part Resources）**：与自身部位绑定，适合表达“多技能组合释放”的结构性约束
- `PartSlot`：部位技能槽（关键）
  - 例：头部 1 槽、躯干 2 槽、左臂 1 槽…（默认上限可在角色模板中定义）
- `PartState`：部位状态（可用性约束）
  - 例：`partDisabled`（部位不可用/被封印）、`partBroken`（护甲破坏）、`partImmobilized` 等

### 5.2 需求资源（Requirements）vs 消耗（Costs）

为了避免规则混乱，建议将技能释放限制拆分为两类：

- **Requirements（门槛）**：必须满足，但不一定消耗
  - 例：需要“自身右臂可用”，需要“目标护甲未破/已破”，需要“已点亮前置技能”等
- **Costs（消耗）**：满足后会减少资源
  - 例：消耗 AP，消耗某部位 1 个技能槽，消耗一次“每回合次数”

在“一回合多技能配置”中，`PartSlot` 更像一种 **消耗**：你把技能放进对应部位的队列，就占用了该部位的槽位。

### 5.3 部位技能槽模型（Part Slots）

#### 5.3.1 为什么需要槽位

如果不引入槽位限制，玩家可能在同回合堆叠大量低 AP 技能，导致：

- 平衡公式倾斜到“堆叠量”而不是“策略选择”
- 速度（出手顺序）与组合设计被稀释
- UI/交互会变成“尽可能塞满”而不是“在结构上选择”

因此建议在战斗配置阶段引入：

- 每个部位有一个 `slotLimit`（默认最大 8 的总体约束仍可保留，但建议给每部位再设一个更小的上限）
- 每个技能声明其**占用哪一个自身部位**（或可选部位）以及占用几个槽

#### 5.3.2 技能的“来源部位”（Cast From / Self Part)

注意区分两个概念：

- `targetParts`：技能作用到对方哪个部位（目标维度）
- `castParts`：技能释放依赖自身哪个部位（来源维度）

例：

- “挥砍”可能要求 `castParts=["right_arm","left_arm"]`（任一手臂可用）
- “盾击”要求 `castParts=["left_arm"]`（必须持盾的手臂）
- “圣光祷言”可为 `castParts=[]`（不依赖部位，属于全身/精神类技能）

#### 5.3.3 槽位消耗（slotCost）

建议技能增加字段：

- `slotCost: number`（默认 1）

用于表达：

- 大招/重型技能占多个槽（本回合组合空间变小）
- 轻量技能占 0 槽（谨慎：容易被堆叠滥用，建议只用于少数辅助/触发器类技能）

### 5.4 可落地的 Schema 建议（MVP）

在不修改引擎代码的前提下，先把字段写进数据与设计文档，供编辑器与平衡工具使用：

#### 5.4.1 技能侧字段（`skills.json`）

建议新增：

- `cost`：AP 消耗（现有）
- `requirements?: { ... }`：门槛
- `costs?: { ... }`：消耗

MVP 示例：

```json
{
  "id": "skill_shield_bash",
  "name": "盾牌猛击",
  "cost": 3,
  "speed": 0,

  "requirements": {
    "selfPart": {
      "mode": "ANY",
      "parts": ["left_arm"],
      "mustBeUsable": true
    }
  },

  "costs": {
    "ap": 3,
    "partSlot": {
      "part": "left_arm",
      "slotCost": 1
    }
  }
}
```

说明：

- `requirements.selfPart` 用于表达“依赖自身部位”；`mode` 表达 `ANY/ALL`。
- `costs.partSlot` 用于表达“占用哪个部位的槽位”。

#### 5.4.2 角色侧字段（Player/Enemy Template）

建议角色模板定义每个部位的槽位上限（仅设计层先写清楚）：

```json
{
  "partSlots": {
    "head": 1,
    "chest": 2,
    "left_arm": 1,
    "right_arm": 1,
    "left_leg": 1,
    "right_leg": 1
  }
}
```

### 5.5 与标签体系的结合（用于平衡统计）

为了让平衡工具能统计“资源约束”是否偏科，建议增加一组资源相关标签：

- `RES_AP`：消耗 AP（几乎所有技能）
- `RES_SLOT`：消耗部位槽位（绝大多数战斗技能）
- `REQ_SELF_PART`：依赖自身部位可用
- `REQ_POSITIONAL`：（可选）依赖站位/姿态/引导状态
- `LIMIT_PER_TURN`：每回合次数限制（若未来需要）

并建议在 `tagMeta` 里记录关键参数：

```json
{
  "tags": ["RES_AP","RES_SLOT","REQ_SELF_PART"],
  "tagMeta": {
    "slot": { "part": "left_arm", "slotCost": 1 },
    "reqSelfPart": { "mode": "ANY", "parts": ["left_arm"] }
  }
}
```

### 5.6 平衡性风险提示（与“一回合多技能组合”强相关）

引入资源需求后，平衡检查需要额外关注：

1. **零槽/低槽技能堆叠**：如果存在 `slotCost=0` 的收益技能，很容易在同回合被塞满，导致组合过强。
2. **单部位垄断**：大量强技能都依赖同一个部位（例如右臂），会导致打法收敛，且“封印该部位”变成过强 counter。
3. **高 AP + 高槽双重惩罚**：若大招同时高 AP、高槽位、低速度，可能变得完全不可用，需要给到更高的收益或更强的独特机制。
4. **与速度的耦合**：同回合多技能时，速度的边际价值更高（先手连段更强），因此高速度技能需要更严格的资源约束。

---

## 6. 平衡落地建议（不写代码也能执行）

### 6.1 建立技能对照表（Design Sheet）

建议维护一个表格（可以是 Markdown 表格或 Excel），列包括：

- `id` / `name` / `rarity` / `arch` / `tags`
- `AP cost` / `speed`
- `targetType` / `requiredPart`
- `buffRefs` 摘要（施加了哪些 buff）
- 预期定位（输出/破甲/续航/节奏）
- 评估指标（AP 效率、确定性、反制性、组合风险）

### 6.2 重点关注的“失衡风险”清单

- **滚雪球**：叠层 buff 导致指数成长（例如“每层提高伤害并更容易叠层”）
- **先手锁死**：速度+控制让对方几乎无法行动
- **低成本破甲**：便宜且稳定的破甲使护甲体系失去意义
- **无代价续航**：治疗/上护甲过于便宜导致战斗无限拖长

### 6.3 与编辑器的结合点（建议）

- 在 skill editor 的属性面板中增加 `tags`（多选）与 `tagMeta`（只读/弱编辑）。
- 允许按 `tags` 过滤技能库、以及导出时进行标签完整性校验（至少每类选一个）。

---

## 7. 附录：最小标签集合（MVP）

若要快速落地，建议先实现如下 MVP 标签：

- 作用属性：`DMG_HP` / `DMG_ARMOR` / `HEAL` / `ARMOR_ADD` / `BUFF_APPLY` / `BUFF_REMOVE`
- 数值类型：`ABS` / `PCT_MAX` / `PCT_CURRENT`
- 时间点：`INSTANT` / `ON_EVENT`
- 周期：`ONE_SHOT` / `ONE_TURN` / `MULTI_TURN`
- 释放对象（MVP）：`SUBJECT_SELF` / `SUBJECT_ENEMY` + `SCOPE_ENTITY` / `SCOPE_PART` / `SCOPE_MULTI_PARTS`
- 流派：`ARCH_*`（至少一个）
