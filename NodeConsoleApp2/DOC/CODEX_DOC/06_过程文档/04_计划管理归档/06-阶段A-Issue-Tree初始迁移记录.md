# 阶段A Issue Tree 初始迁移记录

创建时间：2026-03-28

状态：`当前有效，执行记录`

## 1. 记录目的

这份文档不再讨论“要不要用严格树”，而是记录：

1. 当前仓库是否已经启用 GitHub Issues
2. 阶段 A 的 issue tree 已经迁到什么程度
3. 真实 issue 编号是什么
4. 重复节点如何处理
5. 后续 AI 和人工应从哪里继续推进

## 2. 本次迁移结论

当前仓库 `wgwtest/NodeConsoleApp2` 已完成以下动作：

1. 已启用 GitHub Issues
2. 已创建严格树所需标签
3. 已创建阶段 A 的首批真实 issue tree
4. 已通过 `sub-issues` API 建立父子关系
5. 已关闭旧的重复 issue `#1 ~ #12`
6. 已把 `#13 ~ #24` 导入 GitHub Project 作为展示层 item

因此当前结论是：

1. 严格 WBS 真源已经从“仅文档定义”进入“真实 issue tree 执行中”
2. 当前阶段 A 的执行入口应以 `#13 ~ #24` 为准
3. GitHub Project 继续只承担展示层角色
4. 但展示层已经开始直接镜像真实 issue，而不是只用 draft 卡片

## 3. 已启用的仓库能力

仓库：

- `wgwtest/NodeConsoleApp2`

已确认：

1. `Issues = enabled`
2. `Projects = enabled`
3. `gh` 可正常访问仓库并执行 issue / project 操作

## 4. 已创建标签

本次迁移已创建并使用以下标签：

1. `phase:A`
2. `gate:M1`
3. `work:root`
4. `work:phase`
5. `work:package`
6. `work:task`
7. `planning`

标签语义：

1. `phase:*`
   - 阶段归属
2. `gate:*`
   - 贡献到哪个验收门
3. `work:*`
   - 当前处于哪一层 WBS
4. `planning`
   - 说明这批 issue 属于研发计划与执行结构

## 5. 当前真实 issue tree

### 5.1 根节点与阶段节点

1. `#13`
   - `WBS L0: NodeConsoleApp2 可交付版本研发总纲`
2. `#14`
   - `WBS L1: 阶段A 战斗竖切闭环`

### 5.2 阶段 A 的工作包

1. `#15`
   - `WBS L2: A1 Buff 主流程完成`
2. `#16`
   - `WBS L2: A2 敌人行为完成`
3. `#17`
   - `WBS L2: A3 战斗恢复完成`

### 5.3 阶段 A 的执行任务

1. `#18`
   - `WBS L3: A1.1 补齐 Buff 人工验收入口与真实主流程样本`
2. `#19`
   - `WBS L3: A1.2 扩展 Buff 学习-装配-执行闭环`
3. `#20`
   - `WBS L3: A2.1 扩展敌人策略样本到真实关卡`
4. `#21`
   - `WBS L3: A2.2 固化敌人行为的人工验收路径`
5. `#22`
   - `WBS L3: A3.1 梳理战斗恢复所需的最小 runtime snapshot`
6. `#23`
   - `WBS L3: A3.2 恢复后重建 BuffManager 与 planning state`
7. `#24`
   - `WBS L3: A3.3 增加恢复后继续执行回归`

### 5.4 树结构快照

```text
#13
└── #14
    ├── #15
    │   ├── #18
    │   └── #19
    ├── #16
    │   ├── #20
    │   └── #21
    └── #17
        ├── #22
        ├── #23
        └── #24
```

## 6. 重复 issue 清理结果

初次创建过程中曾产生一组重复 issue：

1. 旧树：
   - `#1 ~ #12`
2. 新树：
   - `#13 ~ #24`

处理方式：

1. 保留 `#13 ~ #24` 作为真实执行树
2. 关闭 `#1 ~ #12`
3. 在关闭说明中标记其已被新 issue 替代

替代映射为：

1. `#1 -> #13`
2. `#2 -> #14`
3. `#3 -> #15`
4. `#4 -> #16`
5. `#5 -> #17`
6. `#6 -> #18`
7. `#7 -> #19`
8. `#8 -> #20`
9. `#9 -> #21`
10. `#10 -> #22`
11. `#11 -> #23`
12. `#12 -> #24`

## 7. 验证结果

当前已验证：

1. `#13` 的子 issue 为：
   - `#14`
2. `#14` 的子 issue 为：
   - `#15`
   - `#16`
   - `#17`
3. `#15` 的子 issue 为：
   - `#18`
   - `#19`
4. `#16` 的子 issue 为：
   - `#20`
   - `#21`
5. `#17` 的子 issue 为：
   - `#22`
   - `#23`
   - `#24`
6. `#13 ~ #24` 当前为 `OPEN`
7. `#1 ~ #12` 当前为 `CLOSED`

这说明：

1. 阶段 A 的初始树关系已经落地
2. 当前可以用 GitHub 原生父子结构查看阶段 A 的真实层级

## 7.1 Project 展示层同步结果

为了避免“本地文档是真树、Project 还是旧卡片总览”的割裂状态，当前已经完成以下同步：

1. 为 Project 新增 `Work Type` 字段：
   - `Root`
   - `Phase`
   - `Package`
   - `Task`
2. 将 `#13 ~ #24` 全部加入 Project
3. 为阶段 A 的真实 issue 写入：
   - `Status`
   - `Phase`
   - `Contributes To`
   - `Work Type`
4. 删除重复的旧 draft 卡片：
   - `阶段A 战斗竖切闭环`
   - `当前执行切片：人工可验 Buff / 敌人行为 / 战斗恢复`

当前 Project 结果：

1. 总 item 数：
   - `20`
2. 未来阶段与里程碑仍保留为 draft 总览项
3. 阶段 A 已改为真实 issue 展示

## 8. 关键实现细节

后续如果继续自动化创建 issue tree，必须注意：

1. `gh issue create` 不适合本轮批量结构化创建
2. 更稳妥的方式是调用 REST API：
   - `POST /repos/{owner}/{repo}/issues`
3. 建立父子关系时使用：
   - `POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues`
4. `sub_issue_id` 必须传 REST issue `id`
5. 不能传 GraphQL `node_id`
6. 不能把 `sub_issue_id` 当作字符串处理

这部分是后续扩展阶段 B / C / D / E 时最容易出错的点，应优先复用本轮方式。

## 9. 与其他文档的关系

1. [01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md)
   - 定义全局推进路线
2. [02-WBS-L1-阶段A-战斗竖切闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/02-WBS-L1-阶段A-战斗竖切闭环.md)
   - 定义阶段 A 当前执行内容
3. [04-GitHub-Projects使用说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/04-GitHub-Projects使用说明.md)
   - 定义展示层如何阅读
4. [05-严格树形任务分解与GitHub-Issue-Tree方案](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/05-严格树形任务分解与GitHub-Issue-Tree方案.md)
   - 定义树形模型本身
5. [07-全阶段骨架Issue-Tree与Project迁移记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/07-全阶段骨架Issue-Tree与Project迁移记录.md)
   - 定义全阶段骨架与 Project 的后续扩展结果

## 10. 后续执行建议

从现在开始，后续推进遵守：

1. 阶段 A 的执行跟踪，以 `#13 ~ #24` 为准
2. 新增阶段性任务时，先判断应该挂到哪个 `L1/L2` 节点
3. 不再新建另一套平行“里程碑 issue”与其竞争
4. Project 只做总览，不再承担严格树结构职责
