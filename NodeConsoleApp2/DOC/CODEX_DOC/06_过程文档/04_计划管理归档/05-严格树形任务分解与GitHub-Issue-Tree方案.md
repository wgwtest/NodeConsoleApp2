# 严格树形任务分解与 GitHub Issue Tree 方案

创建时间：2026-03-28

状态：`执行中，阶段A已开始迁移`

## 1. 这份方案解决什么问题

当前 `GitHub Projects` 已经能承担“人类优先的总览展示层”，但它不适合作为严格树形任务管理的主结构。

原因：

1. 当前 Project 里的 `Milestone / Phase / Slice` 仍然更像“展示层卡片”
2. 这类卡片虽然便于总览，但不等于 Microsoft Project 风格的 `WBS / 摘要任务 / 子任务`
3. 如果继续把 `Milestone` 也放进同一层任务卡片，语义会越来越混乱

所以这里需要明确切换思路：

1. `GitHub Project`
   - 负责展示
2. `GitHub Issues + sub-issues`
   - 负责严格树形结构

## 2. 检索结论

### 2.1 GitHub 官方能力

GitHub 官方已经支持：

1. `Issue -> sub-issue` 层级
2. 最多 `8` 层嵌套
3. `Project` 中显示：
   - `Parent issue`
   - `Sub-issue progress`
4. 按父 issue 查看完整层级

这意味着：

1. GitHub 真正的树形工作分解能力，在 `Issues`
2. `Projects` 更适合作为 issue 树的展示、过滤、时间轴视图

参考：

1. [About issues - GitHub Docs](https://docs.github.com/articles/about-issues)
2. [Adding sub-issues - GitHub Docs](https://docs.github.com/issues/managing-your-tasks-with-tasklists/creating-a-tasklist)
3. [Browsing sub-issues - GitHub Docs](https://docs.github.com/en/enterprise-cloud%40latest/issues/tracking-your-work-with-issues/using-issues/browsing-sub-issues)
4. [REST API endpoints for sub-issues - GitHub Docs](https://docs.github.com/en/rest/issues/sub-issues)

### 2.2 Microsoft Project / OpenProject 语义

Microsoft Project 的核心是：

1. `Summary task`
2. `Subtask`
3. `Indent hierarchy`
4. `Gantt`
5. `Dependency`

OpenProject 的核心也是：

1. `Work package hierarchy`
2. `Parent-child`
3. `Relation`
4. `Gantt`

这说明：

1. 严格树形任务分解的核心对象应始终是“工作任务”
2. `Milestone` 应是特殊节点或字段，不应抢占工作分解顶层

参考：

1. [Work with the Gantt Chart view - Microsoft Support](https://support.microsoft.com/en-au/office/work-with-the-gantt-chart-view-0e84efa4-78ce-4cd1-baed-5159a55f78b4)
2. [Use task checklists in Microsoft Project for the web - Microsoft Support](https://support.microsoft.com/en-au/office/use-task-checklists-in-microsoft-project-for-the-web-c69bcf73-5c75-4ad3-9893-6d6f92360e9c)
3. [Work packages - OpenProject](https://www.openproject.org/docs/user-guide/work-packages)
4. [Work package relations and hierarchies - OpenProject](https://www.openproject.org/docs/user-guide/work-packages/work-package-relations-hierarchies)

## 3. 推荐的结构原则

### 3.1 只把“工作对象”放进树里

树形结构中的节点应该只有三类：

1. 项目级工作对象
2. 阶段级工作对象
3. 执行级工作对象

不建议把下面这些直接放进树顶层：

1. `M1 / M2 / M3 / M4`
2. 验收结论
3. 自测报告
4. 验收清单

这些应该作为：

1. 字段
2. 标签
3. 状态门
4. 关联文档

### 3.2 Milestone 是 Gate，不是主树节点

最关键的原则：

1. `Milestone` 是验收门
2. `WBS` 是工作分解树

所以：

1. 树回答“工作怎么拆”
2. `Milestone` 回答“拆完做到什么程度算过线”

## 4. 当前项目的严格树形模型

推荐采用四层：

### L0：项目根节点

示例：

- `NodeConsoleApp2 可交付版本研发总纲`

职责：

1. 作为全项目父节点
2. 汇总所有阶段
3. 关联总计划文档

### L1：阶段节点

示例：

1. `阶段A 战斗竖切闭环`
2. `阶段B 单局体验闭环`
3. `阶段C 成长与内容闭环`
4. `阶段D 交互与可用性收口`
5. `阶段E 发布收口`

职责：

1. 作为主工作包
2. 是真正的一级 WBS 结构

### L2：阶段子工作包

以阶段 A 为例：

1. `A1 Buff 主流程完成`
2. `A2 敌人行为完成`
3. `A3 战斗恢复完成`

以阶段 B 为例：

1. `B1 结果与奖励`
2. `B2 关卡流转`

职责：

1. 作为阶段内可管理、可验收的工作包
2. 是开发推进和资源安排的主要粒度

### L3：执行任务

以 `A3 战斗恢复完成` 为例：

1. `A3.1 梳理 runtime snapshot 最小必要字段`
2. `A3.2 恢复后重建 BuffManager`
3. `A3.3 恢复后重建 planning budget`
4. `A3.4 增加恢复后继续执行回归`

职责：

1. 作为真正可执行任务
2. 直接对应开发、测试、修正动作

## 5. 里程碑如何放进这套树

### 5.1 不作为树节点

建议：

1. 不创建 `M1/M2/M3/M4` 作为 L1 或 L2 工作节点
2. 改为用字段表示

推荐字段：

1. `Gate`
   - `M1`
   - `M2`
   - `M3`
   - `M4`

### 5.2 当前映射

按照当前总计划，映射应为：

1. `阶段A` 及其子树：
   - `Gate = M1`
2. `阶段B` 及其子树：
   - `Gate = M2`
3. `阶段C` 及其子树：
   - `Gate = M3`
4. `阶段D` 与 `阶段E` 及其子树：
   - `Gate = M4`

说明：

1. `Gate` 只是“该工作包贡献到哪个验收门”
2. 不等于“这个工作包本身就是里程碑”

## 6. GitHub 中应如何落地

### 6.1 Source of Truth

严格树形结构的真源建议改为：

- `GitHub Issues + sub-issues`

### 6.2 Project 的角色

`GitHub Projects` 改为 issue 树的投影视图：

1. `Table`
   - 显示：
     - `Title`
     - `Status`
     - `Parent issue`
     - `Sub-issue progress`
     - `Phase`
     - `Gate`
     - `Target Date`
2. `Board`
   - 看活跃工作
3. `Roadmap`
   - 看 `Gate` 和时间线

### 6.3 推荐字段

除了 GitHub 自带字段，建议保留或新增：

1. `Phase`
   - `A/B/C/D/E`
2. `Gate`
   - `M1/M2/M3/M4`
3. `Target Date`
4. `Work Type`
   - `Phase`
   - `Package`
   - `Task`

## 7. 当前项目的首版树形样例

```text
NodeConsoleApp2 可交付版本研发总纲
├── 阶段A 战斗竖切闭环 [Gate=M1]
│   ├── A1 Buff 主流程完成
│   ├── A2 敌人行为完成
│   └── A3 战斗恢复完成
│       ├── A3.1 梳理 runtime snapshot 最小必要字段
│       ├── A3.2 恢复后重建 BuffManager
│       ├── A3.3 恢复后重建 planning budget
│       └── A3.4 增加恢复后继续执行回归
├── 阶段B 单局体验闭环 [Gate=M2]
│   ├── B1 结果与奖励
│   └── B2 关卡流转
├── 阶段C 成长与内容闭环 [Gate=M3]
│   ├── C1 技能树与构筑
│   └── C2 内容扩充
├── 阶段D 交互与可用性收口 [Gate=M4]
│   ├── D1 UI 统一
│   └── D2 新手与反馈
└── 阶段E 发布收口 [Gate=M4]
    ├── E1 测试冻结
    └── E2 发布包整理
```

## 7.1 已经落地的全阶段骨架树

当前仓库已经完成 `A ~ E` 全阶段骨架的真实 issue tree 迁移，对应编号如下：

```text
#13 WBS L0: NodeConsoleApp2 可交付版本研发总纲
├── #14 WBS L1: 阶段A 战斗竖切闭环
│   ├── #15 WBS L2: A1 Buff 主流程完成
│   │   ├── #18 WBS L3: A1.1 补齐 Buff 人工验收入口与真实主流程样本
│   │   └── #19 WBS L3: A1.2 扩展 Buff 学习-装配-执行闭环
│   ├── #16 WBS L2: A2 敌人行为完成
│   │   ├── #20 WBS L3: A2.1 扩展敌人策略样本到真实关卡
│   │   └── #21 WBS L3: A2.2 固化敌人行为的人工验收路径
│   └── #17 WBS L2: A3 战斗恢复完成
│       ├── #22 WBS L3: A3.1 梳理战斗恢复所需的最小 runtime snapshot
│       ├── #23 WBS L3: A3.2 恢复后重建 BuffManager 与 planning state
│       └── #24 WBS L3: A3.3 增加恢复后继续执行回归
├── #25 WBS L1: 阶段B 单局体验闭环
│   ├── #26 WBS L2: B1 结果与奖励
│   └── #27 WBS L2: B2 关卡流转
├── #28 WBS L1: 阶段C 成长与内容闭环
│   ├── #29 WBS L2: C1 技能树与构筑
│   └── #30 WBS L2: C2 内容扩充
├── #31 WBS L1: 阶段D 交互与可用性收口
│   ├── #32 WBS L2: D1 UI 统一
│   └── #33 WBS L2: D2 新手与反馈
└── #34 WBS L1: 阶段E 发布收口
    ├── #35 WBS L2: E1 测试冻结
    └── #36 WBS L2: E2 发布包整理
```

说明：

1. 这不是样例，而是当前真实执行树的全阶段骨架
2. 旧的重复 issue `#1 ~ #12` 已关闭，不再作为树结构使用
3. 全阶段骨架迁移过程中产生的重复 issue `#37 ~ #48` 也已关闭
3. 更详细的迁移证据见：
   - [06-阶段A-Issue-Tree初始迁移记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/06-阶段A-Issue-Tree初始迁移记录.md)
   - [07-全阶段骨架Issue-Tree与Project迁移记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/07-全阶段骨架Issue-Tree与Project迁移记录.md)

## 8. 对当前 GitHub Project 的判断

当前已创建的 Project：

- [NodeConsoleApp2 Delivery Roadmap](https://github.com/users/wgwtest/projects/1)

当前定位应改为：

1. `过渡性总览板`
2. 适合看全局状态
3. 不适合作为严格 WBS 主结构

因此不建议继续在现有 Project 上无限加字段模拟树。

## 9. 当前执行状态与后续顺序

当前已经完成：

1. 树模型冻结为 `L0/L1/L2/L3`
2. `Gate` 明确作为字段/标签语义，而不是树节点
3. `GitHub Issues + sub-issues` 已成为严格树形真源
4. 全阶段骨架 issue tree 已创建并连线
5. 旧的重复 issue 已关闭
6. GitHub Project 已同步为真实 issue 镜像

后续顺序建议：

1. 继续以 `#13 ~ #36` 为项目骨架入口
2. 当阶段 A 完成时，再扩展阶段 B 的 `L1/L2/L3` issue tree
3. Project 改为逐步展示这些 issue，而不是继续依赖 draft item 充当主结构

## 10. 当前建议

当前最合理的下一步不是继续修 Project，而是：

1. 按真实 issue tree 推进阶段 A 收口
2. 用迁移记录持续维护树结构和编号
3. 保留当前 Project 作为过渡性展示层，后续逐步切换到 issue-based 视图
