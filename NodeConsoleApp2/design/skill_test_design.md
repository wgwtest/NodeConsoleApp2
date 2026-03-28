# 技能、装备与 Buff 系统测试方案 (Skill, Item & Buff Test Design)

## 1. 测试目标 (Test Objectives)

本测试方案旨在验证游戏核心战斗机制中 **技能 (Skill)**、**装备 (Item)** 与 **增益/减益 (Buff/Debuff)** 系统的功能完整性与数值准确性。
核心目标包括：
1.  **数据完整性**: 确保从 JSON 加载的数据能正确实例化为运行时对象。
2.  **流程正确性**: 确保获取 -> 装备/配置 -> 战斗释放/生效 -> 销毁/移除 的整个生命周期逻辑闭环。
3.  **数值准确性**: 确保属性修正、伤害计算、治疗量等数值符合设计公式。
4.  **交互稳定性**: 确保多 Buff 共存、装备替换、技能并发等复杂场景下系统不崩溃、逻辑不冲突。

## 1.1 合理的 Skill 验证分层

一个合理的技能系统，不应只靠“主页面点一下看看能不能放技能”来验证。
验证体系应当覆盖从配置到主流程消费的完整链路，并按层次拆开，避免把所有问题都混成“技能不能用”。

推荐的验证分层如下：

1. **配置层验证**
   - skill pack 是否满足 schema
   - 枚举、引用、前置依赖、buffRefs 是否有效
2. **编辑器层验证**
   - 编辑器是否能正确加载、编辑、保存、保留字段、导出技能数据
3. **规划层验证**
   - AP、部位槽位、目标选择、单选/多选、每回合使用次数是否按规则成立
4. **执行层验证**
   - `actions[]`、`selectionResult`、Buff 施加/移除、伤害/治疗/护甲结算是否真实生效
5. **主流程消费验证**
   - 技能树学习、技能入池、技能部署、提交规划、执行、进入下一回合的完整链路是否成立
6. **跨系统联动验证**
   - Skill 与 Buff、敌人 AI、关卡配置、存档/读档之间是否保持一致

这意味着：

- `test/*.html` 更适合做局部隔离验证；
- `mock_ui_v11.html` 更适合做主流程消费验证；
- 两者应互补，而不应相互替代。

---

## 2. 测试环境与前置条件 (Test Environment)

*   **测试工具**:
    *   `test/engine_test_v2.html` (或最新版本的测试入口)
    *   浏览器的 Developer Console (用于注入指令和查看 Log)
*   **前置数据**:
    *   确保 `assets/data/skills.json`, `items.json` 包含用于测试的标准模版数据（如：无特效白板剑、纯伤害技能、纯 Buff 技能）。
*   **Mock 对象**:
    *   提供一个标准的 `Player` 对象和一个 `Enemy` 对象（通常是靶子，高 HP，低 AI）。

---

## 3. 技能系统测试 (Skill System Testing)

### 3.1 技能获取与库存管理
*   **测试点 1 (初始化加载)**:
    *   *操作*: 加载包含 `initialSkills: ["skill_slash", "skill_heal"]` 的角色 JSON。
    *   *验证*: `player.skills` 列表中包含这两个技能对象，且属性（如 AP 消耗、威力）与 JSON 一致。
*   **测试点 2 (动态学习)**:
    *   *操作*: 调用 `player.learnSkill("skill_fireball")`。
    *   *验证*: 技能列表长度 +1，UI 面板实时刷新显示新图标。
*   **测试点 3 (重复获取)**:
    *   *操作*: 再次调用 `player.learnSkill("skill_slash")` (已拥有的技能)。
    *   *验证*: 技能列表不应出现重复项（除非设计允许升级，否则应提示“已拥有”）。

### 3.2 技能 UI 交互与释放配置
*   **测试点 4 (AP 限制)**:
    *   *操作*: 当前 AP = 2，尝试将消耗 3 AP 的技能拖入待执行队列。
    *   *验证*: 拖拽失败或 UI 显红提示，无法加入队列。
*   **测试点 5 (目标部位验证)**:
    *   *操作*: 选择仅限攻击“头部”的技能，尝试瞄准敌人的“腿部”。
    *   *验证*: 无法选定目标，或自动修正/报错。
*   **测试点 6 (队列提交)**:
    *   *操作*: 配置 3 个技能进入队列，点击“回合开始”。
    *   *验证*: 核心引擎接收到的 Action List 顺序与 UI 队列一致。

---

## 4. 装备系统测试 (Item System Testing)

### 4.1 装备穿戴与属性同步
*   **测试点 7 (穿戴生效)**:
    *   *操作*: 角色装备 `wp_sword_01` (攻击 +10)。
    *   *验证*:
        1.  `player.equipment.main_hand` 指向该物品对象。
        2.  `player.getAttack()` 的返回值比裸装时高 10 点。
        3.  Buff 列表中新增一个来源自该武器的 `StatModifier` Buff。
*   **测试点 8 (替换逻辑)**:
    *   *操作*: 在已有 `wp_sword_01` 的情况下，装备 `wp_axe_01` (攻击 +15)。
    *   *验证*:
        1.  先触发旧武器的 `OnUnequip` (攻击力 -10)。
        2.  再触发新武器的 `OnEquip` (攻击力 +15)。
        3.  最终攻击力净增 +5，Buff 列表中无残留的旧武器 Buff。
*   **测试点 9 (部位互斥)**:
    *   *操作*: 尝试将 `helm_01` (头盔) 装备到 `chest` (胸甲) 槽位。
    *   *验证*: 装备失败，系统抛出 Slot Mismatch 警告。

### 4.2 装备耐久与破坏 (Durability)
*   **测试点 10 (护甲归零)**:
    *   *操作*: 模拟战斗中多次攻击胸部，使胸部护甲值降为 0。
    *   *验证*:
        1.  胸部装备状态变为“Broken”或失效。
        2.  该装备提供的额外属性（如果有设计，如抗性）应该失效。
        3.  UI 上胸部护甲条变灰/红。

---

## 5. Buff/Debuff 系统专项测试 (Buff System Testing)

### 5.1 施加与堆叠 (Application & Stacking)
*   **测试点 11 (施加状态)**:
    *   *操作*: 对角色施加 `buff_poison` (中毒, Duration: 3, Stacks: 1)。
    *   *验证*: `player.buffs` 列表非空，包含该 ID，且 UI 状态栏出现中毒图标。
*   **测试点 12 (堆叠层数)**:
    *   *操作*: 再次施加 `buff_poison`。
    *   *验证*:
        *   情况 A (可堆叠): Stack 变为 2，Duration 刷新为 3。
        *   情况 B (不可堆叠): Stack 仍为 1，Duration 刷新为 3。
*   **测试点 13 (互斥与净化)**:
    *   *操作*: 施加 `buff_cleansing_fire` (清除所有 Debuff)。
    *   *验证*: 之前的 `buff_poison` 被移除。

### 5.2 生命周期与钩子 (Lifecycle Hooks)
*   **测试点 14 (回合衰减)**:
    *   *操作*: 模拟 `Engine.nextTurn()` 或 `TurnEnd` 事件。
    *   *验证*: 所有 Duration > 0 的 Buff，其 Duration 减 1。
*   **测试点 15 (自动过期)**:
    *   *操作*: 模拟回合流逝直到 `buff_poison` 的 Duration 归零。
    *   *验证*: Buff 从 `player.buffs` 中移除，且 `OnRemove` 逻辑执行完毕。

### 5.3 触发器响应 (Trigger Response)
*   **测试点 16 (DoT 伤害)**:
    *   *操作*: 带有中毒 Buff 的角色开始新回合 (`ON_TURN_START`)。
    *   *验证*: 角色 HP 减少，Console log 显示“Buff [中毒] 造成了 X 点伤害”。
*   **测试点 17 (受击触发 - 反伤)**:
    *   *操作*: 带有 `buff_thorns` (荆棘) 的角色受到近战攻击 (`ON_TAKE_DAMAGE`)。
    *   *验证*: 攻击者同时受到反弹伤害。

---

## 6. 综合作用效果测试 (Integration Verify)

### 6.1 最终伤害公式验证
*   **场景**:
    *   攻击者: 基础攻击 10, 装备+5, 力量Buff +20% (Base + Flat) * Percent = (10+5) * 1.2 = 18。
    *   防御者: 护甲 5 (假设减免公式为 Damage - Armor)。
    *   技能: 威力系数 2.0。
*   **预期结果**:
    *   理论伤害 = (18 * 2.0) - 5 = 31 (需扣除浮动值后验证)。
    *   *操作*: 执行攻击，检查 Log 中的 `FinalDamage`。

### 6.2 复杂状态交互
*   **场景**: [眩晕] + [行动]
    *   *操作*: 角色处于 [眩晕] (Stun) 状态下，尝试正常结算回合。
    *   *预期*: 系统跳过该角色的行动阶段，直接进入 TurnEnd，且 [眩晕] Duration -1。

### 6.3 存档与恢复 (Save/Load)
*   **测试点 18 (状态持久化)**:
    *   *操作*: 战斗进行到第 3 回合，角色身上有 2 层毒，HP 50%。保存游戏。刷新页面。载入游戏。
    *   *验证*: 恢复后，处于第 3 回合，角色仍有 2 层毒 (Duration 正确)，HP 仍为 50%。Buff 不丢失，不重置。

---

## 7. 自动化测试脚本示例 (Pseudo-Code)

为了提高效率，可在 Console 中直接运行类似脚本进行冒烟测试：

```javascript
// Test 1: Equip Item
let player = Game.player;
let sword = ItemFactory.create("wp_knight_sword");
let oldAtk = player.getStat("attack");
player.equip(sword);
console.assert(player.getStat("attack") > oldAtk, "Test Failed: Attack did not increase after equip");

// Test 2: Apply Buff
let poison = BuffFactory.create("buff_poison");
player.addBuff(poison);
console.assert(player.hasBuff("buff_poison"), "Test Failed: Buff not found on player");

// Test 3: Buff Damage on Tick
let oldHp = player.hp;
player.triggerBuffs("ON_TURN_START");
console.assert(player.hp < oldHp, "Test Failed: Poison did not deal damage");
```

---

## 8. 独立测试工具设计 (Test Tool Design)

为了更高效地验证上述逻辑，我们将开发一个专用的轻量级测试页面 `test/skill_test.html`。该工具脱离完整的 Game Loop，专注于核心对象的单元测试与交互模拟。

### 8.1 界面布局与功能区
测试页面将分为左右两个主区域：
*   **左侧 (Control Panel)**: 操作区，包含技能、装备、Buff 的模拟指令按钮。
*   **右侧 (Status Display)**: 展示区，实时渲染 Player 和 Dummy Enemy 的详细状态（属性、装备槽、Buff列表）。
*   **底部 (Log Panel)**: 独立的日志区域，实时打印操作反馈。

### 8.2 技能测试模块 (Skill Module)
*   **技能树可视化 (Skill Tree Visualization)**:
    *   **全览视图 (Overview Layout)**: 废弃标签页设计，界面采用长滚动或网格布局，将 **7 大流派**（重装、铁壁、剑术、游侠、狙击、元素、神圣）全部展示在同一页面中。每个流派作为一个独立的面板 (Section) 垂直排列或网格排列，方便测试者直观对比所有流派的技能树。
    *   **树状拓扑图 (Topology)**:
        *   **布局**: 采用 **分层有向图 (Layered Digraph)** 布局。
        *   **层级**: 纵向或横向排列 Tier 1 到 Tier 5。页面
        *   **连线**: 使用 Canvas 或 SVG 绘制连线，连接 **前置技能** 指向 **后继技能**，直观展示依赖关系。
        *   *示例*: [重锤挥击] ---> [野蛮冲撞] ---> [震荡波]
    *   **节点状态 (Node States)**:
        *   *已解锁 (Learned)*: 正常彩色图标，点击可进行“模拟释放”。
        *   *可解锁 (Available)*: 半透明彩色或高亮灰度，点击触发“解锁”操作（需满足 KP 要求）。
        *   *锁定 (Locked)*: 灰色且带锁标记，Tooltip 提示缺失的前置技能。

*   **交互与获取测试 (Unlock & Progression)**:
    *   **资源模拟**: 控制面板提供 "设置 KP (Knowledge Points)" 功能，允许测试者随意调整 KP 数量。
    *   **点击解锁**:
        *   点击“可解锁”节点 -> 检查 KP -> 扣除 KP -> 写入 `player.unlockedSkills` -> 刷新视图（下一级节点变为可解锁）。
    *   **依赖验证**:
        *   尝试越级解锁（通过控制台或非正常操作），验证系统是否拒绝。
    *   **详情展示**: 鼠标悬停显示技能详情，新增显示：`消耗: X KP`, `前置: [技能名]`.

*   **模拟释放 (Execution Test)**:
    *   *操作*: 仅允许选中 **已解锁** 的技能。选中后点击“释放”按钮（或双击图标），对右侧 Dummy Enemy 执行 `Skill.execute()`。
    *   *反馈*: 日志输出详细的数值运算过程（基础伤害 -> 护甲减免 -> 最终伤害），右侧敌人 HP/护甲条实时扣除。

*   **重置与管理**:
    *   按钮“重置 AP/CD”：一键回复玩家行动力，清空技能冷却。
    *   按钮“重置天赋树”：遗忘所有技能，恢复到初始状态，用于反复测试解锁路径。

### 8.3 装备测试模块 (Item Module)
*   **列表显示**: 分为“背包”和“已装备槽位”两部分。
*   **模拟获取**: 按钮“随机掉落装备”，从 `items.json` 中随机抽取 1 件装备直接放入玩家背包。
*   **穿戴交互**:
    *   点击背包物品 -> 装备到对应槽位（自动替换旧装备）。
    *   点击已装备物品 -> 卸下放入背包。
    *   *反馈*: 观察右侧状态栏中 Player 属性（如攻击力、护甲上限）的实时变化，验证 Buff 挂载是否正确。

### 8.4 Buff/Debuff 测试模块
*   **状态监控**: 列表展示当前所有 Buff，包含 Icon、层数、剩余回合。
*   **注入测试**: 下拉框选择一个预设 Buff (如 Poison, Stun, Shield)，点击“施加给玩家”或“施加给敌人”。
    *   *逻辑*: 默认持续时间为 3 回合，若目标已有该 Buff 则增加层数并刷新持续时间。
*   **Tick 模拟**: 按钮“模拟回合结束”，触发所有 Buff 的 `ON_TURN_END` 钩子，观察扣血/回复效果及 Duration 衰减。

### 8.5 虚拟环境 (Mock Environment)
*   **Player Agent**: 实例化一个标准玩家对象，属性实时同步显示。
*   **Dummy Enemy**: 一个高血量（如 1000 HP）、全裸装的靶子对象，用于承受伤害和 Debuff，直观展示测试效果。
