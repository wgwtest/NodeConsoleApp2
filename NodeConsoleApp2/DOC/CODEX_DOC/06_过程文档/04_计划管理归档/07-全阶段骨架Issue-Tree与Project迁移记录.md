# 全阶段骨架 Issue Tree 与 Project 迁移记录

创建时间：2026-03-28

状态：`当前有效，执行记录`

## 1. 记录目的

这份文档记录的是：

1. 阶段 B ~ E 的骨架如何继续落地到真实 issue tree
2. GitHub Project 如何从“阶段卡片展示层”切到“真实 issue 镜像层”
3. 本轮迁移过程中出现了哪些重复节点，以及如何清理

它是 [06-阶段A-Issue-Tree初始迁移记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/06-阶段A-Issue-Tree初始迁移记录.md) 的后续扩展，不替代阶段 A 的首轮记录。

## 2. 本轮完成结果

当前仓库已经完成以下动作：

1. 创建阶段 B ~ E 的 L1 阶段节点
2. 创建阶段 B ~ E 的 L2 工作包节点
3. 将这些节点连到 `#13` 根节点下
4. 将全阶段骨架同步进 GitHub Project
5. 清理了迁移过程中的重复 issue 与重复 Project item

因此当前结论是：

1. 严格树形骨架已覆盖 `A ~ E` 五个阶段
2. GitHub Project 已经变成真实 issue 的镜像层
3. 现阶段不再需要保留旧式阶段 draft 卡片

## 3. 本轮新增的真实 issue

### 3.1 阶段 B

1. `#25`
   - `WBS L1: 阶段B 单局体验闭环`
2. `#26`
   - `WBS L2: B1 结果与奖励`
3. `#27`
   - `WBS L2: B2 关卡流转`

### 3.2 阶段 C

1. `#28`
   - `WBS L1: 阶段C 成长与内容闭环`
2. `#29`
   - `WBS L2: C1 技能树与构筑`
3. `#30`
   - `WBS L2: C2 内容扩充`

### 3.3 阶段 D

1. `#31`
   - `WBS L1: 阶段D 交互与可用性收口`
2. `#32`
   - `WBS L2: D1 UI 统一`
3. `#33`
   - `WBS L2: D2 新手与反馈`

### 3.4 阶段 E

1. `#34`
   - `WBS L1: 阶段E 发布收口`
2. `#35`
   - `WBS L2: E1 测试冻结`
3. `#36`
   - `WBS L2: E2 发布包整理`

## 4. 当前全阶段骨架树

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

## 5. 重复节点清理结果

本轮迁移过程中，由于同一批脚本在 GitHub GraphQL 限流前后被触发了两次，产生了重复 issue：

1. 重复树：
   - `#37 ~ #48`
2. 保留树：
   - `#25 ~ #36`

处理结果：

1. `#37 ~ #48` 已全部关闭
2. `#13` 根节点下已移除重复的 L1 子节点：
   - `#37`
   - `#40`
   - `#43`
   - `#46`
3. GitHub Project 中的重复 item 也已移除

## 6. Project 同步结果

当前 Project：

- [NodeConsoleApp2 Delivery Roadmap](https://github.com/users/wgwtest/projects/1)

当前同步结果：

1. Project 共 `24` 个 item
2. 这 `24` 个 item 全部是真实 issue
3. 当前层级分布为：
   - `1` 个 `Root`
   - `5` 个 `Phase`
   - `11` 个 `Package`
   - `7` 个 `Task`

### 6.1 当前 Work Type 分布

1. `Root`
   - `#13`
2. `Phase`
   - `#14`
   - `#25`
   - `#28`
   - `#31`
   - `#34`
3. `Package`
   - `#15`
   - `#16`
   - `#17`
   - `#26`
   - `#27`
   - `#29`
   - `#30`
   - `#32`
   - `#33`
   - `#35`
   - `#36`
4. `Task`
   - `#18 ~ #24`

### 6.2 当前 Project 字段语义

1. `Work Type`
   - 识别真实 WBS 层级
2. `Phase`
   - 识别所属阶段
3. `Contributes To`
   - 识别所属验收门
4. `Status`
   - 当前执行状态

说明：

1. `Layer` 已经不再是 Project 里的主语义字段
2. 当前更应优先看 `Work Type`

## 7. 当前 Project 清理结果

已经完成：

1. 删除旧的阶段 draft 卡片：
   - `阶段B 单局体验闭环`
   - `阶段C 成长与内容闭环`
   - `阶段D 交互与可用性收口`
   - `阶段E 发布收口`
2. 移除重复关闭 issue 对应的 Project item：
   - `#37 ~ #48`

当前意义上，Project 已经是：

1. 真实 issue 的展示层
2. 而不是“阶段卡片 + 真实 issue”的混合态

## 8. 当前验证结果

当前已验证：

1. `#13` 的直接子节点为：
   - `#14`
   - `#25`
   - `#28`
   - `#31`
   - `#34`
2. `#25` 的子节点为：
   - `#26`
   - `#27`
3. `#28` 的子节点为：
   - `#29`
   - `#30`
4. `#31` 的子节点为：
   - `#32`
   - `#33`
5. `#34` 的子节点为：
   - `#35`
   - `#36`
6. Project 当前仅保留 `#13 ~ #36` 这 24 个真实 issue item

## 9. 与其他文档的关系

1. [01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md)
   - 定义所有阶段的上位规划
2. [04-GitHub-Projects使用说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/04-GitHub-Projects使用说明.md)
   - 定义如何阅读当前 Project
3. [05-严格树形任务分解与GitHub-Issue-Tree方案](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/05-严格树形任务分解与GitHub-Issue-Tree方案.md)
   - 定义严格树形模型本身
4. [06-阶段A-Issue-Tree初始迁移记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/06-阶段A-Issue-Tree初始迁移记录.md)
   - 记录阶段 A 首次迁移

## 10. 当前结论

一句话概括本轮结果：

- 当前项目已经不只是“阶段 A 有真实 issue tree”，而是“从 `#13` 根节点开始，`A ~ E` 五个阶段骨架和 Project 展示层都已经统一到真实 issue 结构上”。
