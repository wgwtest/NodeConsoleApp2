# 研制计划 README

最后整理时间：2026-04-03

状态：`当前有效`

## 0. 在当前文档体系中的位置

`03_研制计划/` 是当前工程的正式计划目录。

在进入本目录前，建议先看：

1. [CODEX_DOC README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/README.md)
2. [00-本地工程策略映射](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/00-本地工程策略映射.md)

## 1. 当前激活节点

1. WBS 根节点：`#13`
2. 当前阶段节点：`#14`
3. 当前阶段工作包：`#15`、`#16`、`#17`、`#49`
4. 当前 Gate：`M1`
5. 当前阶段计划文档：
   - [02-WBS-L1-阶段A-战斗竖切闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/02-WBS-L1-阶段A-战斗竖切闭环.md)
6. 当前阶段并行启动线：
   - `#50` 技能编辑契约与编辑链
   - `#51` Buff 编辑契约与编辑链
   - `#52` 关卡编辑契约与编辑链
7. A4 当前执行拆分：
   - `#53` 统一内容契约入口与装载基线
   - `#54 ~ #56` 技能链执行任务
   - `#57 ~ #59` Buff 链执行任务
   - `#60 ~ #62` 关卡链执行任务

## 2. 当前目录内的正式计划文件

1. [00-开发计划索引与关系说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/00-开发计划索引与关系说明.md)
2. [01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md)
3. [02-WBS-L1-阶段A-战斗竖切闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/02-WBS-L1-阶段A-战斗竖切闭环.md)
4. [03-执行Issue任务契约与验收口径](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/03-执行Issue任务契约与验收口径.md)
5. [04-CODEX_DOC文档根深度迁移设计](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/04-CODEX_DOC文档根深度迁移设计.md)
6. [05-CODEX_DOC文档根迁移实施计划](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/05-CODEX_DOC文档根迁移实施计划.md)

## 3. 协作规则

### 3.1 双门模型

1. 当前项目采用双门模型：
   - `研发推进门`
   - `阶段关闭门`
2. 用户人工验收不再阻断低耦合的后续研发准备工作。
3. 用户人工验收仍然是阶段正式关闭的唯一依据。

### 3.2 Prep / Core 规则

1. `Prep`
   - 指下一阶段可提前进行的低耦合工作
   - 例如：契约草案、测试脚手架、样本数据、只读分析、独立 UI 壳子、文档和验收基线设计
2. `Core`
   - 指直接依赖上一阶段稳定输出的正式实现
3. 当上一阶段处于 `待人工验收` 时：
   - 允许推进下一阶段 `Prep`
   - 不允许把下一阶段 `Core` 标记为正式开始
4. 当上一阶段人工验收通过后：
   - 才允许把下一阶段 `Core` 作为正式主线推进

### 3.3 GitHub 同步规则

1. GitHub Issue tree 是严格 WBS 真源。
2. GitHub Project 只做投影展示，不替代树结构。
3. 本地计划、Issue 契约和 Project 状态不能长期冲突。
4. 共享协作面统一使用仓库相对路径。

## 4. 阅读顺序

1. [CODEX_DOC README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/README.md)
2. [00-本地工程策略映射](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/00-本地工程策略映射.md)
3. [01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md)
4. [02-WBS-L1-阶段A-战斗竖切闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/02-WBS-L1-阶段A-战斗竖切闭环.md)
5. [03-执行Issue任务契约与验收口径](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/03-执行Issue任务契约与验收口径.md)
6. [02_设计说明/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/README.md)
7. 对应阶段的自测报告、验收清单和会话交接

## 5. 归档入口

以下内容已不再属于活跃计划区，而是计划管理过程归档：

1. [计划管理归档 README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/04_计划管理归档/README.md)

## 6. 时间基线

1. 首版时间估算同步时间：`2026-03-28`
2. 文档根深度迁移同步时间：`2026-04-03`
3. 当前阶段 `#14` 目标评估日：`2026-04-03`
4. GitHub Project Roadmap 地址：
   - <https://github.com/users/wgwtest/projects/1>

## 7. 状态语义

1. `In Development`
   - 当前切片正在实现中
2. `Self-Tested`
   - 实现和自测已完成，但尚未交由用户确认
3. `Pending User Acceptance`
   - 已形成验收入口，等待用户人工验收
4. `Accepted`
   - 用户已确认通过，可视为阶段关闭依据
5. `Blocked`
   - 当前切片存在明确阻塞

补充要求：

1. 本地文档若已标记某节点 `已通过`，GitHub Project 不应继续停留在待验收语义。
2. GitHub Project 若已标记 `Accepted`，必须能在本地验收清单中找到对应的用户通过结论。
3. GitHub Issue 正文中的 `当前状态` 是执行真相，优先级高于 Project 的粗粒度展示状态。
