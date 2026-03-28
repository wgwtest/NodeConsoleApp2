# 技能编辑器设计方案 (Skill Editor Design)

> 本文档为 **v4 数据对齐版**：用于确保技能编辑器能够正确加载、编辑、校验并导出 `assets/data/skills_melee_v4.json`。
>
> 对齐来源：
> - `design/skill_design.md`（技能系统规范与字段语义）
> - `assets/data/skills_melee_v4.json`（实际样例与 `meta.enums` 枚举源）

---

## 1. 构建目标

技能编辑器（Skill Editor）是一个基于网页（HTML/CSS/JS）的工具，目标是：

1. **加载/保存技能数据**：以 `skills_melee_v4.json` 为标准输入输出。
2. **可视化编辑技能树**：在二维网格画布上拖拽技能节点；用连线表达前置依赖。
3. **结构化编辑技能属性**：目标选择、消耗、需求、效果、Buff 引用、解锁体系、标签等。
4. **严格校验**：导出前进行 schema/引用关系/循环依赖 等检查，降低数据写错的概率。

---

## 1.1 属性面板的保存策略（Auto-save vs Explicit-save）

为避免“UI 可编辑但未写回数据”的问题，属性面板字段分为两类：

1) **原子字段（Atomic fields）**

- 在 `blur` / `Enter` / `change` 时自动触发 `saveCurrentNode()` 写回到当前 skill。
- 典型字段：
  - `name`, `rarity`, `speed`, `description`
  - `costs.ap`, `costs.perTurnLimit`, `costs.partSlot.*`
  - `target.subject`, `target.scope`, `target.selection.mode`, `target.selection.selectCount`

2) **JSON 字段（Explicit-save fields）**

- 允许存在中间态；只有点击按钮（Apply/Save）后才写回到 skill。
- 典型字段：`unlock`, `requirements`, `tags`, `tagMeta`, `actions[]`。

> 说明：如果某个字段是 `<input type="number">` 但属于原子字段（如 `target.selection.selectCount`），也必须绑定 auto-save 事件，否则切换技能后会回退为旧值。

## 1.2 技能编辑器在整体框架中的定位

技能编辑器属于 **Authoring Layer（内容生产层）**，它的职责不是“临时改出一个能跑的页面状态”，而是稳定地产出可被整条技能链消费的技能配置。

因此，一个合理的技能编辑器应满足以下原则：

1. **编辑器不是运行时真源**
   - 运行时可消费的数据真源仍然是 skill pack 文件。
   - 编辑器只负责帮助人类安全、结构化地修改这份真源。
2. **编辑器必须服从技能契约**
   - 编辑器字段分组、下拉选项、默认值、校验逻辑，应从 skill schema 与 `meta` 推导，而不是自行发明另一套语义。
3. **编辑器必须保留未知字段**
   - 当 pack 中出现新字段或扩展字段时，编辑器默认应“保留并透传”，避免工具版本落后导致数据被意外抹掉。
4. **编辑器输出必须可直接进入运行时链路**
   - 导出的配置不仅要“格式正确”，还要能被装载、进入规划层、最终被执行器消费。
5. **编辑器必须服务于持续内容生产**
   - 它既要支持技能树布局和字段编辑，也要支持引用校验、枚举对齐、导出前检查和后续回归。

换言之，编辑器不是技能系统的替代物，而是技能系统的数据生产入口。

## 2. 输入输出文件与数据源

### 2.1 技能数据文件（v4）

标准技能文件：`assets/data/skills_melee_v4.json`

顶层结构约束（必须保持）：

- `$schemaVersion: string`
- `meta: { defaultParts, enums, ... }`
- `skills: SkillV4[]`

编辑器导出时必须导出 **完整对象**，而不是只导出 `skills[]`。

### 2.2 Buff 数据文件

用于 `buffRefs` 下拉选择与校验：`assets/data/buffs.json`

如果未提供该文件，编辑器可以允许手动输入 `buffId`，但应在校验区提示“未加载 buffs.json，无法校验 buffId 是否存在”。

### 2.2.1 编辑器与其他系统的边界约束

为了避免工具链相互覆盖职责，编辑器应明确只做自己该做的部分：

- **应该负责**
  - skill pack 的读取、编辑、校验、保存
  - 技能树布局与前置依赖关系的可视化
  - 枚举、引用、循环依赖、必填字段等静态校验
- **不应该负责**
  - 替代规划层决定某技能本回合如何落槽
  - 替代执行层决定 `actions[]` 如何结算
  - 替代敌人 AI 决定何时释放技能
  - 替代主流程 UI 维护玩家当前战斗态

编辑器可以提供预览，但预览不应成为唯一验证入口。

---

### 2.3 `skills_melee_v4.json` 版本改动分析（v4 pack vs 旧 `skills.json`）

你当前的 `skills_melee_v4.json` 相比旧版 `skills.json`（常见为 key->skillObject 的 map 结构）属于“**数据结构升级**”。编辑器适配不能只做字段“兼容映射”，而需要将 v4 pack 视为**第一类输入输出**。

#### 2.3.1 顶层结构的变化（Map -> Pack）

- 旧：`skills.json` 通常是对象 map：`{ "skill_id": { ... }, ... }`
- 新：`skills_melee_v4.json` 是 Pack：`{ $schemaVersion, meta, skills: [] }`

Pack 的意义：

1. 编辑器加载时不仅要读 `skills[]`，还要读 `meta`（枚举与默认部位），并将其作为 UI 的数据源。
2. 编辑器导出时必须保留 `$schemaVersion` 与 `meta`，否则下游工具（skill editor / balance tool / 引擎）无法保证枚举一致。

#### 2.3.2 `meta` 新增职责：枚举与字段说明（Meta-driven UI）

v4 将大量“硬编码常量”前置到 `meta`：

- `meta.defaultParts`：默认部位列表（UI 的部位多选/下拉/约束都应以此为准）
- `meta.enums.*`：所有关键枚举（例如 `rarities/targetSubjects/targetScopes/selectionModes/effectTypes/amountTypes/...`）
- `meta.fieldNotes`：字段级说明（可作为编辑器 tooltip/help 的文案来源）

结论：编辑器的下拉框/checkbox **必须**尽量由 `meta` 驱动，而不是写死。

#### 2.3.3 Skill 字段的关键变化（旧字段不应继续作为核心）

1) 行动力消耗：`cost` -> `costs.ap`

- 旧：`cost: number`
- 新：`costs: { ap, partSlot?, perTurnLimit? }`

2) 目标选择：`targetType/requiredPart/targetParts` -> `target.subject/scope/selection`

- 旧：`targetType`（SELF/ENEMY/SINGLE_PART/ALL_PARTS/...） + `requiredPart` + `targetParts`
- 新：
  - `target.subject`（释放对象维度）
  - `target.scope`（作用范围维度）
  - `target.selection`（选择模式与候选/已选/数量约束）

这意味着很多旧目标语义无法用旧三字段“无损表示”，因此编辑器 UI 应尽快切换到 `target.subject/scope/selection` 三层模型。

3) 效果表达：`type/value/valueType` -> `actions[]`

v4 的核心是 `actions[]`：

- `skill.actions: Action[]`
- 每个 `action` 拥有独立 `target`（通常 follow 技能的 `skill.target`）
- 每个 `action` **只有一个** `effect`（多效果通过多个 action 表达）

编辑器不能再以“顶层 `effects[]`”作为核心字段（但可以在导入旧数据时迁移）。

4) 解锁体系：`unlock` 与 `prerequisites` 分工明确

- `prerequisites`：结构依赖（技能树边）
- `unlock`：KP 成本、额外门槛、互斥、授权方式

5) 平衡标签：`tags` 与 `meta.enums.tags` 对齐

`tags` 为工具侧统计/分布分析服务，编辑器即使不编辑，也必须**完整保留**。

#### 2.3.4 对 Skill Editor 的适配要求（建议按优先级实施）

必须做（否则“加载/保存”不可信）：

1. 导入/导出以 v4 pack 为主：保持 `$schemaVersion/meta/skills`。
2. UI 枚举、部位列表由 `meta` 驱动（不再硬编码）。
3. 内部数据模型以 v4 字段为主：`target/costs/actions`。
4. 保存时不得丢弃 effect 扩展字段（例如 `repeat/partOverride/subjectOverride/scaling/...`）。

可后做（MVP 阶段允许先简化）：

- `actions[]` 更完整的表单化编辑（包括 action-level target）；目前 MVP 允许先不做。
- `unlock.requirements` 结构化表单；可先用 JSON 编辑框。
- `tags` 的辅助生成与自动校验；可先做“保留 + 枚举校验”。

## 3. v4 Schema 字段映射（编辑器 UI 必须遵循）

本章是“编辑器 UI <-> 数据文件”的**唯一标准**。工具内不应继续以旧字段（如 `targetType/requiredPart/targetParts/cost`）作为核心。

### 3.1 `meta`：枚举与默认值来源

编辑器页面中的下拉框、默认列表，应尽量来自 `skills_melee_v4.json` 自带的枚举与默认值：

- `meta.defaultParts`: 默认部位列表
- `meta.enums.*`: 全部枚举

典型映射：

- 稀有度：`meta.enums.rarities`
- 目标对象：`meta.enums.targetSubjects`
- 目标范围：`meta.enums.targetScopes`
- 选择模式：`meta.enums.selectionModes`
- 效果类型：`meta.enums.effectTypes`
- 数值类型：`meta.enums.amountTypes`
- BuffRef target：`meta.enums.buffRefTargets`
- requirements.selfPart.mode：`meta.enums.requirementSelfPartModes`

目的：避免编辑器硬编码，确保未来只需要更新数据文件中的 `meta.enums` 也能驱动 UI。

### 3.2 Skill 基础字段（Basic）

- `id: string`
  - **只读**（不允许直接修改）
  - 若确需“改 id”，使用“Duplicate as New（复制为新技能）”生成新 id
- `name: string`
- `rarity: string`（必须在 `meta.enums.rarities` 内）
- `description?: string`

### 3.3 技能树字段：`editorMeta` + `prerequisites`

#### 3.3.1 `editorMeta`（二维坐标）

- `editorMeta.x/y: number`：节点网格坐标（与画布网格对齐/吸附一致）
- `editorMeta.group?: string`：用于分组显示（如 `melee`）
- `editorMeta.locked?: boolean`：锁定后不允许拖拽

画布拖拽行为：

- 拖动节点 => 实时更新 `editorMeta.x/y`。

#### 3.3.2 `prerequisites`（前置技能依赖）

- `prerequisites: string[]`

同步规则：

- **画布连线新增**：`toSkill.prerequisites.push(fromSkillId)`（去重）
- **画布连线删除**：从 `toSkill.prerequisites` 中移除 `fromSkillId`
- **面板编辑 prerequisites**：画布连线重新渲染

校验要求：

- 引用 id 必须存在于同文件 `skills[]`
- 必须禁止循环依赖（DAG 校验）

### 3.4 解锁体系字段：`unlock`（来自 skill_design.md 4.5）

- `unlock.cost.kp: number`：知识点消耗
- `unlock.requirements: object`：扩展预留（前期可先做 JSON 文本框）
- `unlock.exclusives: string[]`：互斥技能 id（可选）
- `unlock.grants.type: string`：例如 `permanent`

说明：

- `prerequisites` 只表达“结构依赖”，`unlock` 才表达“解锁消耗/门槛/互斥/授予方式”。

### 3.5 目标选择：`target` + `selection`

v4 中技能级目标选择仍统一为：

- `target.subject`：`meta.enums.targetSubjects`（如 `SUBJECT_SELF/SUBJECT_ENEMY/SUBJECT_BOTH`）
- `target.scope`：`meta.enums.targetScopes`（如 `SCOPE_ENTITY/SCOPE_PART/SCOPE_MULTI_PARTS`）
- `target.selection.mode`：`meta.enums.selectionModes`
- `target.selection.candidateParts: string[]`
- `target.selection.selectedParts: string[]`
- `target.selection.selectCount: number`

#### 3.5.1 UI 联动规则（Scope-driven gating & normalization）

为避免 `target.scope` 与 `selection` 产生语义冲突，编辑器需要在 UI 与数据层同时做联动：

1) 当 `target.scope = SCOPE_ENTITY`

- UI：隐藏（或折叠并禁用）以下控件：
  - `selection.mode`
  - `selection.selectCount`
  - `selection.candidateParts`
  - `selection.selectedParts`
- 数据规范化（保存时执行）：
  - `selection.mode = single`
  - `selection.selectCount = 1`
  - `selection.candidateParts = []`
  - `selection.selectedParts = []`

2) 当 `target.scope != SCOPE_ENTITY`（如 `SCOPE_PART` / `SCOPE_MULTI_PARTS`）

- UI：显示部位相关控件。
- 数据：允许写入 `candidateParts/selectedParts/selectCount`，并在保存时补齐缺省数组。

建议 UI 设计：

- `candidateParts`、`selectedParts` 使用多选控件（checkbox 或 tag 多选）
- 对 `single` / `random_single` 强制 `selectCount=1`
- `selectedParts` 必须是 `candidateParts` 子集

### 3.6 消耗与需求：`costs` + `requirements`

#### 3.6.1 `costs`

- `costs.ap: number`
- `costs.partSlot?: { part: string, slotCost: number }`
- `costs.perTurnLimit?: number`

#### 3.6.2 `requirements`

当前样例定义了：

- `requirements.selfPart?: { mode: string, parts: string[], mustBeUsable?: boolean }`

其中：

- `mode` 来自 `meta.enums.requirementSelfPartModes`（如 `ANY/ALL`）
- `parts` 多选（默认来自 `meta.defaultParts`）
- `mustBeUsable` 表示部位必须可用（未损坏/可行动）

---

## 4. Actions 与 BuffRefs 的编辑策略

### 4.1 `actions[]`（建议“表单 + JSON”双通道）

v4 action 的关键字段：

- `actions[i].id: string`
- `actions[i].name?: string`
- `actions[i].target`: action 级目标（常见为 follow 技能 `target`）
  - 推荐默认：`{ binding: { mode: 'follow', ref: 'skillTarget' } }`
- `actions[i].effect: Effect`
  - `effectType`：枚举 `meta.enums.effectTypes`
  - `amountType`：枚举 `meta.enums.amountTypes`
  - `amount?: number`
  - 以及 v3 时代 effect 的扩展字段（如 `scaling/repeat/partOverride/subjectOverride/note` 等）应 **原样保留**

实现策略建议：

- MVP：
  - 列表区提供 effect 的常用字段快速编辑（`effectType/amountType/amount/note`）
  - JSON textarea 允许编辑整段 `actions[]`，但必须显式 Apply/Save（避免半成品结构破坏数据）
- 导入兼容：
  - 若导入 v3 顶层 `effects[]`，迁移为 `actions[]`（每个 effect -> 一个 action），并默认 follow `skillTarget`
  - 若导入出现 `actions[].effects[]`（历史中间结构），拆分为多个 action，并落到 v4 单 `effect`

### 4.2 `buffRefs`（需要联动 buffs.json）

结构为：

- `buffRefs.apply[]`
- `buffRefs.applySelf[]`
- `buffRefs.remove[]`

每行建议字段（基于 Schema 驱动的动态表单）：

- `buffId`（下拉选择，来源 `buffs.json`）
- `target`（枚举 `meta.enums.buffRefTargets`，当前为 `self/enemy`）
- `params`（动态参数对象，根据所选 Buff 的 `paramsSchema` 动态生成输入项）

**UI 交互升级（卡片式动态表单）**：
1. **放弃固定表格布局**：将每个 Buff 引用渲染为一个独立的配置卡片，而不是固定列的表格。
2. **动态参数渲染**：当选中某个 Buff 时，实时读取其 `paramsSchema`，在卡片主体中动态渲染输入项（如 `duration`, `damagePerTurn` 等）。
3. **数据绑定支持嵌套**：支持 `params.xxx` 的点语法数据绑定，确保动态参数正确写入 `buffRef.params` 对象。
4. **默认值初始化**：首次选择 Buff 时，自动将 `paramsSchema` 中的 `defaultValue` 填充到 `params` 对象中。

---

## 5. UI 模块拆分（低耦合）

延续模块化与低耦合原则，整体采用三栏结构：

1. 左侧：`SkillListDrawer`
   - 负责索引/搜索/定位
2. 中央：`CanvasWorkspace`
   - 负责节点拖拽与连线
3. 右侧：`SkillPropertiesPanel`
   - 负责字段化编辑

所有模块共享同一个“编辑器状态/数据模型”（Editor Store），模块之间不直接互相调用。

---

## 6. 保存策略与校验规则

### 6.1 保存策略（建议）

- 大多数字段：实时保存（`blur/change/Enter`）
  - `name/rarity/description/speed/target/costs/requirements/prerequisites/editorMeta/unlock/buffRefs/tags/tagMeta`
- `actions`：显式保存（`Validate / Apply JSON / Save Actions`）

### 6.2 导出前必做校验清单

1. 技能 `id` 唯一、非空。
2. 枚举值校验：
   - `rarity/target.subject/target.scope/selection.mode/actions[i].effect.effectType/actions[i].effect.amountType` 必须出现在 `meta.enums`。
3. `target.selection`：
   - `single/random_single` => `selectCount=1`
   - `selectedParts` 是 `candidateParts` 子集
   - `selectCount <= candidateParts.length`
4. `prerequisites`：引用 id 存在，且无循环依赖。
5. 数值合理性：`ap>=0`、`slotCost>=0`、`perTurnLimit>=1`（若存在）。
6. `buffRefs`：
   - `buffId` 存在于 `buffs.json`（若已加载）

---

## 6.3 UI 面板字段规范（表单分组 / 字段说明表）

本节给出“右侧属性面板”的严格表单化规范：每个字段都明确 **数据路径、类型、必填性、默认值来源、校验规则**。

说明约定：

- **数据路径**：相对于单个 `skill` 对象（即 `skills[i]`）。
- **必填**：指导出/运行所需；允许编辑器在创建新技能时用默认值补齐。
- **默认值来源**：优先来自 `meta`（尤其 `meta.defaultParts` 与 `meta.enums.*`）。

### A. Basic Panel（基础信息）

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| 技能 ID | `id` | `string` | 是 | 创建时生成 | 唯一；只读不可编辑；非空 |
| 名称 | `name` | `string` | 是 | `""` | 非空；建议长度 1~40 |
| 稀有度 | `rarity` | `string` | 是 | `meta.enums.rarities[0]` | 必须在 `meta.enums.rarities` 内 |
| 描述 | `description` | `string` | 否 | `""` | 建议长度 <= 200（可选约束） |

### B. Tree Panel（技能树 / 编辑器元信息）

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| 坐标 X | `editorMeta.x` | `number` | 否(建议) | `0` | 建议为整数；与网格大小匹配 |
| 坐标 Y | `editorMeta.y` | `number` | 否(建议) | `0` | 建议为整数；与网格大小匹配 |
| 分组 | `editorMeta.group` | `string` | 否 | 例如 `"melee"` | 可选；用于 UI 分组 |
| 锁定 | `editorMeta.locked` | `boolean` | 否 | `false` | 锁定后禁止拖拽 |

### C. Prerequisites Panel（前置技能）

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| 前置技能 | `prerequisites` | `string[]` | 是 | `[]` | 引用的 skillId 必须存在；禁止循环依赖（DAG） |

### D. Unlock Panel（技能解锁配置）

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| KP 消耗 | `unlock.cost.kp` | `number` | 否(建议) | `0` 或按稀有度映射 | `>=0`，建议为整数 |
| 解锁门槛 | `unlock.requirements` | `object` | 否 | `{}` | 允许空对象；如采用 JSON 编辑需做合法 JSON 校验 |
| 互斥技能 | `unlock.exclusives` | `string[]` | 否 | `[]` | 引用 skillId 必须存在；建议不与自身重复 |
| 授予方式 | `unlock.grants.type` | `string` | 否 | `"permanent"` | 如要枚举化，可由 `meta.enums` 未来补充 |

> 备注：`unlock` 在 v4 文件中为可选字段；但从设计角度建议编辑器对新技能默认生成 `unlock` 结构，以便技能树工具链统一处理。

### E. Target & Speed Panel（目标选择与速度）

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| 速度 | `speed` | `number` | 否 | `0` | 允许负数；建议范围 -10~10（可选约束） |
| 目标对象 | `target.subject` | `string` | 是 | `meta.enums.targetSubjects` 的默认值 | 必须在 `meta.enums.targetSubjects` 内 |
| 目标范围 | `target.scope` | `string` | 是 | `meta.enums.targetScopes` 的默认值 | 必须在 `meta.enums.targetScopes` 内 |
| 选择模式 | `target.selection.mode` | `string` | 是 | `meta.enums.selectionModes` 的默认值 | 必须在 `meta.enums.selectionModes` 内 |
| 候选部位 | `target.selection.candidateParts` | `string[]` | 是 | `meta.defaultParts` | 非空；元素必须是合法部位 id |
| 已选部位 | `target.selection.selectedParts` | `string[]` | 是 | `[]` 或按模式预设 | 必须是 `candidateParts` 子集 |
| 可选数量 | `target.selection.selectCount` | `number` | 是 | 由 `mode` 推导（single->1） | `>=1` 且 `<=candidateParts.length`；`single/random_single` 必须为 1 |

### F. Costs Panel（消耗）

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| AP 消耗 | `costs.ap` | `number` | 否(建议) | `0` | `>=0`，建议整数 |
| 槽位部位 | `costs.partSlot.part` | `string` | 否 | `""` 或 `right_arm` | 必须是合法部位；若 `partSlot` 存在则必填 |
| 槽位消耗 | `costs.partSlot.slotCost` | `number` | 否 | `1` | `>=0`，建议整数 |
| 每回合限制 | `costs.perTurnLimit` | `number` | 否 | `1` | `>=1`，建议整数 |

### G. Requirements Panel（释放需求）

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| 自身部位模式 | `requirements.selfPart.mode` | `string` | 否 | `meta.enums.requirementSelfPartModes[0]` | 必须在 `meta.enums.requirementSelfPartModes` 内 |
| 自身部位列表 | `requirements.selfPart.parts` | `string[]` | 否 | `[]` | 元素必须是合法部位 id |
| 部位必须可用 | `requirements.selfPart.mustBeUsable` | `boolean` | 否 | `false` | - |

### H. Actions Panel（效果 / 行为）

> 推荐：`actions` 使用“显式保存”按钮（`Save Actions`），避免编辑过程中生成半成品结构。

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| 行为列表 | `actions` | `Action[]` | 是 | `[]`（但不建议为空） | 数组至少 1 条（建议约束）；每条 action 校验见下 |

单条 `Action` 字段（MVP 最小集）：

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| Action ID | `actions[i].id` | `string` | 是 | `action_{i+1}` | 非空；建议唯一 |
| 目标绑定 | `actions[i].target.binding` | `object` | 否(建议) | `{mode:'follow', ref:'skillTarget'}` | `mode=follow` 时 `ref` 必填 |
| 效果对象 | `actions[i].effect` | `object` | 是 | `{effectType, amountType, amount}` | 必须是 object |
| 效果类型 | `actions[i].effect.effectType` | `string` | 是 | `meta.enums.effectTypes[0]` | 必须在 `meta.enums.effectTypes` 内 |
| 数值类型 | `actions[i].effect.amountType` | `string` | 否(建议) | `meta.enums.amountTypes[0]` | 若存在必须在 `meta.enums.amountTypes` 内 |
| 数值 | `actions[i].effect.amount` | `number` | 条件 | `0` | `amountType!=SCALING` 时建议必填 |
| 备注 | `actions[i].effect.note` | `string` | 否 | 无 | 可选 |

### I. BuffRefs Panel（Buff 引用）

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| apply 列表 | `buffRefs.apply` | `BuffRef[]` | 否 | `[]` | 每条 BuffRef 校验见下 |
| applySelf 列表 | `buffRefs.applySelf` | `BuffRef[]` | 否 | `[]` | 同上 |
| remove 列表 | `buffRefs.remove` | `BuffRef[]` | 否 | `[]` | 同上 |

单条 `BuffRef` 字段：

| 字段名 | 数据路径 | 类型 | 必填 | 默认值来源 | 校验规则 |
|---|---|---:|:---:|---|---|
| buffId | `buffId` | `string` | 是 | 从 `buffs.json` 下拉 | 必须存在于 `buffs.json`（若已加载） |
| 目标 | `target` | `string` | 是 | `meta.enums.buffRefTargets[0]` | 必须在 `meta.enums.buffRefTargets` 内 |
| 动态参数 | `params` | `object` | 否 | 根据 `paramsSchema` 初始化 | 必须符合对应 Buff 的 `paramsSchema` 定义 |

---

## 7. 与其他工具的对齐说明

- `test/skill_editor_test_v3.html`：应以本文档的 v4 字段为准，尤其是 `target.selection`、`costs/requirements`、`unlock`、`editorMeta`、`actions`。
- `test/skill_balance_tool.html`：加载 v4 时，应复用 `meta.enums` 做标签/枚举来源，避免硬编码。

---

## 8. 兼容性与迁移提示（非强制）

编辑器可以提供“兼容旧数据”的提示逻辑：

- 若导入文件不包含 `meta.enums` 或不包含 `target.selection`，则提示“这不是 v4 格式，需要迁移”。
- 本阶段不要求自动迁移，但应避免 silent failure（加载成功但字段对不上导致编辑/导出错误）。
