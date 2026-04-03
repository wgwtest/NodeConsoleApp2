# Buff 编辑器（Buff Editor）重做方案（vNext，不考虑兼容）

本文件描述 `buff_editor_v4` 的当前标准契约：以 `assets/data/buffs_v2_7.json` 为标准样本，并以其 `meta.enums` 与规范化后的 `effects[].payload` 结构驱动 UI。目标是打造一个“面向数据规范、面向批量生产、面向强校验与重构”的 Buff 编辑器。

关联文档：

- `DOC/CODEX_DOC/02_设计说明/09-Buff系统(buff_design)-设计说明.md`：Buff 数据规范（Schema / Data Spec）。
- `assets/data/buffs_v2_7.json`：包含 `$schemaVersion`、`meta.enums`、`meta.fieldNotes`、以及 `buffs` 数据库。

---

## 1. 重做目标（Goals）

### 1.1 主要目标

1. 以数据规范驱动 UI：下拉选项、默认值、字段说明来自 `buffs_v2_7.json.meta`，避免 UI 内部硬编码枚举。
2. 统一编辑体验：所有 `effects[]` 使用 `{ trigger, action, target, payload }`，UI 根据 `action` 渲染 `payload` 表单。
3. 强校验 + 快速定位问题：结构校验、枚举校验、跨引用校验（`aliasOf`、id 唯一性等），并可跳转到字段。
4. 批量生产/重构友好：模板、一键复制、批量替换、批量重命名、字段迁移工具优先。
5. 编辑器与模拟器解耦：编辑器是“数据生产工具”，模拟器是“验证工具”（可选/可折叠/可独立页面）。

### 1.2 非目标

- 不追求对旧版 `buffs.json`/旧 effect 结构的兼容。
- 不把编辑器做成完整战斗系统复刻；验证以“最小可用、可解释”优先。

---

## 2. 编辑器工作区模型（Workspace Model）

### 2.1 顶层文档（Doc）

编辑器内存模型建议直接对应：

- `doc.$schemaVersion`
- `doc.meta`（至少包含：`enums`、`fieldNotes`，可选 `defaults`/`title`/`notes`）
- `doc.buffs: Record<buffId, BuffDef>`

### 2.2 BuffDef（编辑器关注字段）

常用字段（主 UI 必须覆盖）：

- `id`, `name`, `description`
- `type`（来自 `meta.enums.buffTypes`）
- `tags: string[]`
- `lifecycle: { duration, maxStacks, stackStrategy, removeOnBattleEnd }`
- `statModifiers: StatModifier[]`
- `effects: Effect[]`

工程字段（建议保留在“高级/折叠区”）：

- `status`（例如 active/deprecated）
- `version`, `icon`
- `aliasOf`

### 2.3 Effect（标准化）

统一结构：

- `trigger`：来自 `meta.enums.triggers`
- `action`：来自 `meta.enums.effectActions`
- `target`：来自 `meta.enums.targets`
- `payload`：由 `action` 决定形状（Action-specific payload）

约束：编辑器不再把“任意 key-value params 编辑器”作为主入口；如确需兜底，放入“高级 → 原始 JSON”。

---

## 3. 信息架构（IA）与布局

### 3.1 推荐布局：两栏 + 底部面板

- 左侧：Buff 库（列表/搜索/过滤/分组/质量状态）
- 右侧：主编辑区（Tabs）
- 底部面板（或右侧抽屉）：问题列表/校验结果/日志/可选模拟器

原则：编辑效率优先；模拟器按需展开。

### 3.2 主编辑区 Tabs（建议）

1. `概览`：id/name/type/tags/status/version，快速摘要（duration、stacks、effects 数量）
2. `生命周期`：`lifecycle` 可视化编辑
3. `属性修改（Stat）`：`statModifiers` 列表编辑
4. `效果（Effects）`：可排序、可复制、可模板化的 effect 编辑
5. `引用与别名`：`aliasOf`、被引用统计（反向引用）
6. `高级`：原始 JSON、差异/历史（可选）

---

## 4. 关键交互（重点）

### 4.1 左侧列表：库管理器能力

- 搜索：支持 `id/name/tags/description` 全文；高级筛选（type/status/trigger/action）
- 分组：按 `type`、`status`、`tag` 分组折叠
- 质量提示：每条 Buff 显示校验状态（OK/Warn/Error）与未保存标记

### 4.2 Effects：Action → Payload 动态表单

流程：先选 `trigger/action/target`，再由 `action` 决定 `payload` 的结构化字段。

建议能力：

- effect 复制/粘贴/拖拽排序
- effect 模板库（例如：回合开始伤害、攻击后吸血、受击后反伤等）
- 对表达式字段提供变量提示与插入（若引擎支持表达式）

### 4.3 StatModifiers：语义化呈现 + 冲突提示

每行建议展示为：`stat + op(flat/percent_base/...) + value + 人类可读说明`。

并提供：

- 同一 stat 重复项提示
- 与 effects 的功能重叠提示（仅提示，不强限制）

---

## 5. 校验体系（必须强）

### 5.1 校验类型

1. 结构校验：必填字段缺失、类型错误
2. 枚举校验：`trigger/action/target/type/stackStrategy/stat/modifierType` 等必须来自 `meta.enums.*`
3. 引用校验：`aliasOf` 是否存在、禁止 alias 环（至少提示）
4. 一致性校验：`id` 与对象 key 一致（如果以 key 存储）、基础约束（如 duration=-1 的提示规则）
5. 迁移提示（可选）：检测到旧字段（`params`、`value/valueType`）引导迁移

### 5.2 呈现与定位

- 底部“问题面板”：`severity + message + path`
- 点击跳转到字段；支持“仅当前 Buff/仅 Error/导出报告”

---

## 6. 批量工具（Tools）

优先做一个 `工具（Tools）` 抽屉页：

- 批量重命名 `id`（连带更新 `aliasOf` 引用）
- 批量替换/追加 tag
- 批量查找：按 trigger/action/stat/target 查找 Buff
- 迁移工具：把历史 effect 结构迁移为 `{ payload }`（如仍需处理旧数据）
- 模板库：从当前 Buff 生成模板、通过模板批量创建

---

## 7. 导入/导出与工作流

### 7.1 只操作容器结构（buffs_v2_7）

- 导入：选择文件 → 解析 → 校验 → 载入 workspace
- 导出：导出整个文档（包含 `$schemaVersion/meta/buffs`）

### 7.2 单 Buff 导出/分享

- 导出单个 `BuffDef`（用于 PR/讨论）
- 可选：导出“最小差异/patch 文本”（用于审阅）

---

## 8. 模拟器（可选，建议独立或可折叠）

### 8.1 原则

- 模拟器用于解释 Buff 是否触发、如何修改 context，不追求完整战斗复刻。
- 必须提供“上下文变化（diff）”与“有效属性（effective stats）”展示，避免误判。

### 8.2 最小能力

1. Turn：`TURN_START` / `TURN_END`
2. Attack pipeline（简化）：`BATTLE_ATTACK_PRE` → 结算 → `BATTLE_TAKE_DAMAGE_PRE` → `BATTLE_ATTACK_POST`
3. Action intent（控制类 Buff）：`BATTLE_ACTION_PRE` 支持取消动作

### 8.3 输出

- 事件日志：event → matched effects → action → payload → context diff
- actor 有效属性面板：显示叠加 Buff 后的最终数值
