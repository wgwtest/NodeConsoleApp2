# 当前工程 Codex 工作策略

最后整理时间：2026-04-03

状态：`兼容入口 / 当前有效`

## 1. 说明

本文件继续保留，用于兼容历史阶段已经沉淀下来的引用路径。

当前工程的正式策略入口已经固定为：

1. [CODEX_DOC README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/README.md)
2. [00-本地工程策略映射](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/00-本地工程策略映射.md)
3. [03_研制计划/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/README.md)

## 2. 当前仍然有效的硬规则

1. 当前工程采用三层协同模型：
   - GitHub Project 负责排程与状态投影
   - GitHub Issue 负责执行契约与 WBS 真源
   - `DOC/CODEX_DOC/` 负责长篇说明与证据
2. 当前工程继续采用双门模型：
   - `研发推进门`
   - `阶段关闭门`
3. 用户人工验收不自动阻断低耦合 `Prep`。
4. 用户人工验收仍然是阶段正式关闭的唯一依据。
5. 人工验收清单必须与 WBS 节点严格对应。
6. 用户明确验收通过后，应同步更新：
   - 本地验收清单状态
   - GitHub Issue 正文中的 `当前状态`
   - GitHub Project 的粗粒度状态
7. GitHub Issue / GitHub Project / PR 评论等共享协作面，只使用仓库相对路径作为主路径。
8. 旧本地文档根不再作为正式目录存在。

## 3. 当前目录入口

建议后续优先从以下入口恢复上下文：

1. [02_设计说明/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/README.md)
2. [03_研制计划/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/README.md)
3. [05_测试文档/02_验收清单/README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/README.md)
4. 最新会话交接文档

## 4. 迁移结论

1. 原设计目录中的稳定文档已迁入 `DOC/CODEX_DOC/02_设计说明/`。
2. 旧本地文档根已整体退出，不再作为兼容根保留。
3. 迁移设计与实施计划保留在 `DOC/CODEX_DOC/03_研制计划/`，作为本轮迁移历史依据。
4. GitHub Issue / Project 中的旧路径引用应同步替换为 `DOC/CODEX_DOC/...`。
