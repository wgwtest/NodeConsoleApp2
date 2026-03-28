# GitHub Projects 使用说明

创建时间：2026-03-28

状态：`当前有效，展示层；Issue Tree 镜像`

## 1. 当前 Project

已为当前仓库创建 GitHub Project：

- 名称：`NodeConsoleApp2 Delivery Roadmap`
- 地址：[GitHub Project - NodeConsoleApp2 Delivery Roadmap](https://github.com/users/wgwtest/projects/1)

说明：

1. 这是面向人类查看进度的展示层
2. 本地 `DOC/CodexAnylyse/开发计划/` 仍然是 AI 和工程执行的事实源
3. 如果 Project 与本地总计划冲突，以本地总计划为准
4. 当前 Project 是真实 issue tree 的展示镜像，不再维护另一套平行结构
5. 严格树形结构以 GitHub `Issues + sub-issues` 为准

当前严格树形迁移入口：

1. 方案定义：
   - [05-严格树形任务分解与GitHub-Issue-Tree方案](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/计划管理归档/05-严格树形任务分解与GitHub-Issue-Tree方案.md)
2. 执行记录：
   - [06-阶段A-Issue-Tree初始迁移记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/计划管理归档/06-阶段A-Issue-Tree初始迁移记录.md)

## 2. 当前已初始化的结构

### 2.1 字段

当前 Project 已补充以下字段：

1. `Status`
   - `Todo`
   - `In Progress`
   - `Done`
2. `Layer`
   - 当前仍保留，但已不是主识别字段
   - 后续阅读应优先看 `Work Type`
3. `Phase`
   - `A`
   - `B`
   - `C`
   - `D`
   - `E`
4. `Contributes To`
   - `M1`
   - `M2`
   - `M3`
   - `M4`
5. `Work Type`
   - `Root`
   - `Phase`
   - `Package`
   - `Task`
6. `Start Date`
7. `Target Date`

### 2.2 当前卡片

当前已录入：

1. 项目根节点：
   - `#13`
2. 阶段节点：
   - `#14`
   - `#25`
   - `#28`
   - `#31`
   - `#34`
3. 阶段工作包与阶段 A 的执行任务：
   - `#15 ~ #36`

注意：

1. 当前 Project 已不再依赖 milestone draft 或 phase draft 作为主结构
2. 当前 Project 中的 `24` 个 item 全都是真实 issue
3. `Work Type` 已成为 Project 中识别树层级的主字段

### 2.3 当前语义关系

当前 Project 应按下面关系理解：

1. `Work Type`
   - `Root / Phase / Package / Task`
   - 用于识别真实 WBS 层级
2. `Phase`
   - `A / B / C / D / E`
   - 用于识别所属阶段
3. `Contributes To`
   - `M1 / M2 / M3 / M4`
   - 用于识别该项贡献到哪个验收门

当前映射：

1. `阶段A` -> `M1`
2. `阶段B` -> `M2`
3. `阶段C` -> `M3`
4. `阶段D` -> `M4`
5. `阶段E` -> `M4`
6. `#18 ~ #24` -> `阶段A` -> `M1`

## 3. 当前建议怎么用

现在建议按下面顺序看，而不是只看 Project 本身：

1. 先看 [06-阶段A-Issue-Tree初始迁移记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/计划管理归档/06-阶段A-Issue-Tree初始迁移记录.md)
   - 确认当前真正的树结构已经落到哪些 issue
2. 再开 GitHub Project 的 `Table`
   - 把它当作总览镜像，而不是主任务树
3. 再看 `Board`
   - 用于快速看展示层状态
4. 最后看 `Roadmap`
   - 用于看阶段顺序和大致时间线

## 3.1 当前自动化边界

这次已经自动完成：

1. 创建 Project
2. 关联仓库
3. 创建字段
4. 创建核心卡片
5. 写入 Project 描述与 readme

这次没有继续自动完成的部分：

1. 额外创建多个自定义视图
2. 自动设置视图的分组、排序、筛选规则

原因不是遗漏，而是当前 GitHub 公开 CLI / GraphQL 能稳定管理：

1. Project
2. Field
3. Item
4. Description / Readme

但不提供同等稳定的 `Project View` 创建和编辑能力。

因此，当前最稳妥的做法是：

1. 由脚本初始化项目骨架
2. 首次手工把 `Table / Board / Roadmap` 调整到你喜欢的样式
3. 后续继续用这几个视图

## 3.2 第一次手工整理视图的建议步骤

建议你第一次打开 Project 后，按下面顺序操作：

### A. Table 视图

目标：

1. 作为默认全量结构视图

建议：

1. 显示字段：
   - `Title`
   - `Status`
   - `Work Type`
   - `Phase`
   - `Contributes To`
   - `Start Date`
   - `Target Date`
2. 按 `Target Date` 升序排序
3. 不加过滤，保留全量视图

### B. Board 视图

目标：

1. 用来快速看“现在在做什么”

建议：

1. 以 `Status` 分组
2. 保留 `Todo / In Progress / Done`
3. 可选过滤：
   - `Phase = A`
   - 或 `Contributes To = M1`

最适合你每天打开时先看：

1. 当前执行切片是否还在 `In Progress`
2. 阶段 A 是否接近关闭

### C. Roadmap 视图

目标：

1. 用来替代 Markdown 里的轻量甘特图感受

建议：

1. 时间字段同时使用 `Start Date` 与 `Target Date`
2. 纵向优先按 `Work Type`、`Phase` 或 `Contributes To` 分组
3. 首次建议先不过滤，整体看全局时间线

如果你希望更像阶段推进图，建议：

1. 先按 `Work Type` 看
2. 重点关注：
   - `Phase`
   - `Package`

## 3.3 你第一次最值得点的地方

如果你只想最快建立感觉，打开 Project 后直接做这三件事：

1. 在 `Table` 里确认当前 Project 共有 24 个 item
2. 在 `Table` 里确认：
   - `#13` 的 `Work Type = Root`
   - `#14/#25/#28/#31/#34` 的 `Work Type = Phase`
   - `#15 ~ #17` 和 `#26 ~ #36` 的 `Work Type = Package`
   - `#18 ~ #24` 的 `Work Type = Task`
3. 在 `Roadmap` 或 `Table` 里确认阶段顺序仍从 A 开始，后面顺序进入 B / C / D / E
4. 在 `Roadmap` 里确认当前首版估算时间线：
   - `#14 -> 2026-04-03`
   - `#25 -> 2026-04-10`
   - `#28 -> 2026-04-20`
   - `#31 -> 2026-04-27`
   - `#34 -> 2026-05-02`
5. 同时明确：
   - 严格父子关系不在这些卡片里维护
   - 严格父子关系在 GitHub issue tree 里维护

## 4. 我建议的视图方式

### 4.1 状态视图

建议：

1. 以 `Status` 分组
2. 用于看当前推进中的卡片

最适合回答：

1. 现在在做什么
2. 哪些还没开始
3. 哪些已经完成
4. 展示层上当前聚焦的是哪个阶段

### 4.2 阶段视图

建议：

1. 以 `Phase` 过滤或分组
2. 用于看某个阶段内部都有哪些卡片

最适合回答：

1. 阶段 A 是否能关闭
2. 当前执行切片属于哪个阶段

### 4.3 时间线视图

建议：

1. 使用 `Roadmap`
2. 日期字段使用 `Start Date` + `Target Date`
3. 如果想看“哪些内容属于同一验收节点”，增加 `Contributes To` 过滤或分组

说明：

1. 当前日期已在 `2026-03-28` 按总计划估算同步到 Project
2. 这些日期用于建立可视化时间轴和评估节点，不应被理解为精确承诺
3. 如果后续确认了更可靠的排期，再统一调整
4. 这条时间线不是 Microsoft Project 式严格树
5. 严格树已经转由 issue tree 承担

## 5. 后续维护规则

### 5.1 什么时候更新本地文档

以下情况先更新本地文档：

1. 阶段切换
2. Gate 判断变化
3. 当前激活的 WBS L1 阶段计划更换
4. 关键阻塞变化

### 5.2 什么时候更新 Project

本地文档更新后，再同步更新 Project：

1. 修改 `Status`
2. 调整 `Contributes To`
3. 调整 `Target Date`
4. 新增或归档执行切片卡片
5. 在需要时补 issue / PR 关联

## 6. 当前使用边界

当前这版 Project 故意保持轻量，不做以下复杂配置：

1. 不自动同步本地 Markdown
2. 不自动生成 issue
3. 不自动拆分到过细的开发任务
4. 不把所有验收清单、自测报告都塞进 Project

原因：

1. 你是第一次使用 GitHub Projects
2. 当前更重要的是先建立稳定直观的总览入口
3. 等你确认这套方式有用，再考虑是否继续细化

## 7. 与本地文档的对应关系

1. 总体事实源：
   - [01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/开发计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md)
2. 当前激活阶段计划：
   - [02-WBS-L1-阶段A-战斗竖切闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/开发计划/02-WBS-L1-阶段A-战斗竖切闭环.md)
3. 人类总览文档：
   - [03-研发总览看板](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/计划管理归档/03-研发总览看板.md)
4. 严格树方案：
   - [05-严格树形任务分解与GitHub-Issue-Tree方案](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/计划管理归档/05-严格树形任务分解与GitHub-Issue-Tree方案.md)
5. 阶段 A 迁移记录：
   - [06-阶段A-Issue-Tree初始迁移记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/计划管理归档/06-阶段A-Issue-Tree初始迁移记录.md)

## 8. 当前结论

当前项目已经形成双层管理方式：

1. 本地 Markdown 负责事实源与 AI 执行
2. GitHub Projects 负责更直观的人类项目总览
3. GitHub Issues + sub-issues 负责严格树形任务结构

也就是说，严格树形结构不再是“后续要切换”，而是已经开始执行中。

当前 Project 的具体状态是：

1. 共 `24` 个 item
2. 全部为真实 issue item
3. 其中：
   - `1` 个 `Root`
   - `5` 个 `Phase`
   - `11` 个 `Package`
   - `7` 个 `Task`
4. 重复创建后关闭的 `#37 ~ #48` 已从 Project 移除
