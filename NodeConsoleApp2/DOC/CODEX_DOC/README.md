# CODEX_DOC 文档总入口

最后整理时间：2026-04-03

状态：`当前有效 / 已完成深度迁移`

## 1. 当前怎么使用本目录

`DOC/CODEX_DOC/` 是 `NodeConsoleApp2` 的唯一正式本地文档根。

本目录用于承接 GitHub Project / GitHub Issue 不适合直接承载的长篇设计、详细验收、自测证据和过程记录。

当前建议阅读顺序：

1. [00-本地工程策略映射](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/00-本地工程策略映射.md)
2. [03_研制计划/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/README.md)
3. [02_设计说明/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/README.md)
4. [05_测试文档/02_验收清单/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/README.md)
5. 最近一份会话交接文档

## 2. 三层协同入口

当前工程默认采用三层协同模型：

1. `Tracker`
   - GitHub Project：<https://github.com/users/wgwtest/projects/1>
   - 负责排程、状态、日期和路线图展示
2. `Execution Contract`
   - GitHub Issues + sub-issues
   - 负责严格 WBS 树和最小执行契约
3. `Local Docs`
   - `DOC/CODEX_DOC/`
   - 负责长篇设计、详细验收、自测和交接证据

## 3. 六类文档与当前物理目录

| 目录 | 当前用途 | 典型内容 |
| --- | --- | --- |
| `01_需求分析` | 产品边界、总体分析、测试基线 | 工程总体分析、mock_ui_v11 主流程基线 |
| `02_设计说明` | 稳定设计文档 | Skill / Buff / Level / Engine / UI / Timeline 设计 |
| `03_研制计划` | WBS 总纲、阶段计划、执行口径 | L0 总纲、阶段 A 计划、迁移设计与实施计划 |
| `04_研发文档` | 当前实现边界、研发规则说明 | 当前阶段验收说明、入口更正、人工验收原则 |
| `05_测试文档` | 自测、人工验收、验收结论 | 自测报告、验收清单、验收记录、验收结论 |
| `06_过程文档` | 会话交接、计划归档、迁移记录 | 会话交接、计划管理归档、文档迁移记录 |

## 4. 本轮迁移结论

本轮已完成 `CODEX_DOC` 深度迁移，当前口径如下：

1. `DOC/CODEX_DOC/` 是唯一正式本地文档根。
2. 原设计目录中的稳定文档已整体迁入 `DOC/CODEX_DOC/02_设计说明/`。
3. 旧本地文档根已退出正式使用，不再作为兼容入口保留。
4. GitHub Issue / GitHub Project 等共享协作面，应统一引用 `DOC/CODEX_DOC/...` 的仓库相对路径。
5. 迁移设计与迁移实施计划保留旧路径说明，作为本轮迁移的历史依据。

## 5. 本轮迁移证据

1. [04-CODEX_DOC文档根深度迁移设计](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/04-CODEX_DOC文档根深度迁移设计.md)
2. [05-CODEX_DOC文档根迁移实施计划](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/05-CODEX_DOC文档根迁移实施计划.md)
3. [design文档迁移结果清单](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/2026-04-03-232418-design文档迁移结果清单.md)
4. [CODEX_DOC迁移执行记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/2026-04-03-232418-CODEX_DOC迁移执行记录.md)
5. [CODEX_DOC文档根迁移自测报告](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-03-232418-CODEX_DOC文档根迁移自测报告.md)

## 6. 当前恢复上下文的最短路径

如果后续需要从零恢复上下文，优先看以下材料：

1. [00-本地工程策略映射](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/00-本地工程策略映射.md)
2. [03_研制计划/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/README.md)
3. [01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md)
4. [02_设计说明/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/README.md)
5. 最新自测报告、验收清单和会话交接
