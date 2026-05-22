# 技能新增 Codex 护栏与排布检查规程

创建时间：2026-05-22 11:28:07 +0800

## 1. 定位

本文档不是给玩家或人工编辑者使用的编辑器功能说明，而是 Codex 在协助新增、调整技能时必须遵守的工作规程。

核心目标是避免 Codex 直接生成 JSON 时出现以下问题：

- 技能节点堆叠或破坏已有手工布局。
- `prerequisites` 断链、循环，或把战斗释放条件误写成技能树前置。
- `buffRefs` / `actions[].effect.amountSource.buffId` 引用不存在的 Buff。
- 稀有度、KP 成本、技能层级不匹配。
- 未区分正式技能、测试技能、演示技能。
- 在未审定前直接发布到主流程运行时文件。

## 2. 工作边界

Codex 可以做：

1. 读取当前技能包与 Buff 包，理解现有技能结构。
2. 基于当前技能体系提出新增技能草案。
3. 写入 authoring 技能工作稿供人工审定。
4. 使用检查器验证结构、引用、排布和成本约束。

Codex 不应做：

1. 把“自动生成技能”做成技能编辑器核心功能。
2. 在未得到明确确认前发布到 `assets/data/skills_melee_v4_5.json`。
3. 运行编辑器的全局自动布局覆盖已有手工布局。
4. 为单个技能临时硬编码主引擎逻辑，除非该机制已被设计为通用能力。

## 3. 新增技能前置读档

每次新增正式技能前，Codex 必须读取：

1. `assets/data/skills_melee_v4_5.json`
2. `assets/data/buffs_v2_7.json`
3. 最近的技能/Buff 测试报告或交接文档
4. 本规程

Codex 必须先输出设计表，再改 JSON。设计表至少包含：

| 字段 | 要求 |
| --- | --- |
| 技能名 | 保留当前项目允许的口语化/梗式命名风格，但描述要能说明真实效果 |
| 挂接父节点 | 使用 `prerequisites` 表达结构依赖 |
| 稀有度 | `Common / Uncommon / Rare / Epic / Legendary` |
| KP | 与稀有度和层级匹配 |
| 战斗效果 | 说明由 skill action 直接结算，还是通过 Buff 结算 |
| Buff 引用 | 所有 `buffId` 必须存在于 Buff 包 |
| 复杂度 | 低/中/高；高复杂度需要先解释是否值得实现 |
| 坐标 | 明确 `editorMeta.x/y`，说明相对父节点的位置 |

## 4. 排布规则

已有正式技能的 `editorMeta.x/y` 是手工排布结果，视为权威布局。

新增技能排布原则：

1. 不移动已有正式技能节点，除非本轮目标就是重排技能树。
2. 优先沿父节点向下或侧下方扩展，保持现有 100/200 像素网格节奏。
3. 节点尺寸按编辑器/运行时现状视为 `72 x 72`。
4. 新增正式技能与任一正式可见技能之间至少保留检查器要求的间隙。
5. 坐标必须显式写入 `editorMeta.x/y`，不能依赖导入 fallback。
6. 测试/演示节点必须显式标记 `editorMeta.hiddenInSkillTree: true`。

## 5. 结构与成本规则

1. `prerequisites` 只表达技能树前置关系，不表达战斗释放条件。
2. 战斗释放条件应写入 `requirements` 或 `costs`。
3. `unlock.cost.kp` 是学习成本，不等同于战斗 AP。
4. 当前 Codex 检查器采用的建议 KP 区间：

| 稀有度 | KP 建议区间 |
| --- | --- |
| Common | 0-1 |
| Uncommon | 1-2 |
| Rare | 1-3 |
| Epic | 3-5 |
| Legendary | 8 |

如果确实要突破区间，Codex 必须在设计表里说明原因。

## 6. Buff 复杂度分级

低复杂度：

- 技能只施加或移除已有 Buff。
- Buff 后续生命周期、层数、触发时机由 Buff 系统处理。

中复杂度：

- 技能动作读取指定 Buff 的层数或存在状态。
- 例如“按流血层数增伤/回血”。
- 必须确认 `amountSource.buffId` 指向存在的 Buff。

高复杂度：

- 需要为某个部位、某个来源、某几个回合单独记录额外状态。
- 需要主引擎新增专用状态字段。
- 需要跨技能、跨 Buff 写特殊循环。

高复杂度技能不能直接落 JSON，必须先单独说明机制价值、引擎影响和替代方案。

## 7. 必跑检查

新增或调整技能后，Codex 必须运行：

```bash
node tools/validate_skill_authoring_guard.mjs <技能工作稿路径> assets/data/buffs_v2_7.json
```

如修改了正式运行时技能包，还必须运行：

```bash
node --test test/skill_authoring_guard.test.mjs
```

检查器当前覆盖：

1. 技能 ID 缺失或重复。
2. `prerequisites` 缺失引用。
3. `prerequisites` 循环。
4. 任意嵌套位置的 `buffId` 缺失引用。
5. 正式可见技能缺少 `editorMeta.x/y`。
6. 正式可见技能节点距离过近或重叠。
7. 稀有度与 KP 建议区间明显不匹配。

## 8. 交付规则

默认交付路径：

1. 生成或修改 authoring 工作稿：
   - `assets/skill_packs/authoring/skills_melee_v4_5_YYYYMMDD_HHMMSS.json`
2. 报告新增技能表、检查器结果和未决设计问题。
3. 等待人工审定。

禁止默认发布到：

- `assets/data/skills_melee_v4_5.json`

除非用户明确要求“发布到主流程”或“提交当前版本到运行时”。
