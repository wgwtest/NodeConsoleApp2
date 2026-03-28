# 执行 Issue 任务契约与验收口径

最后整理时间：2026-03-28

状态：`当前有效`

## 1. 目的

这份文档用于明确：

1. GitHub Project 负责什么
2. GitHub Issue 负责什么
3. `DOC/CodexAnylyse` 负责什么
4. 执行 issue 至少要写到什么程度，才算“可直接开工、可被审定”

## 2. 三层职责分工

### 2.1 GitHub Project

Project 只负责人类快速查看的排程和状态，不承载长文档细节。

Project 应维护：

1. `Status`
2. `Phase`
3. `Contributes To`
4. `Work Type`
5. `Start Date`
6. `Target Date`

Project 不负责：

1. 长篇设计说明
2. 详细点击验收脚本
3. 自测日志
4. 会话级交接细节

### 2.2 GitHub Issue

Issue 是单个任务的最小工作契约。

执行 issue 至少必须包含：

1. `目标`
2. `Owner`
3. `Write Scope`
4. `Depends On`
5. `验收入口`
6. `验收标准`
7. `输出物`
8. `证据链接`
9. `当前状态`
10. `上级节点`

Issue 应该做到：

1. 让人不看聊天记录，也能知道任务要做什么
2. 让人不翻代码，也能先看到验收入口在哪里
3. 让人能判断这是不是 `Prep`，是不是已经可进入开发

### 2.3 DOC/CodexAnylyse

本地文档负责承载 issue 不适合直接塞进去的长内容。

适合放在文档中的内容：

1. 设计推导
2. 长篇契约说明
3. 详细人工验收步骤
4. 自测报告
5. 会话交接
6. 计划管理归档

原则：

1. Issue 中写“最小可执行契约”
2. 文档中写“详细说明与证据”
3. Issue 必须回链到关键文档

## 3. 执行 issue 的固定模板

建议以后所有执行 issue 统一按下面结构维护：

```md
目标：
- ...

Owner：
- ...

Write Scope：
- ...

Depends On：
- ...

验收入口：
- 主入口：...
- 辅助入口：...

验收标准：
- ...

输出物：
- ...

证据链接：
- 设计文档：...
- 计划文档：...
- 自测报告：...
- 验收清单：...

当前状态：
- ...

上级节点：
- ...
```

## 4. 当前状态语义

Issue 正文中的 `当前状态` 建议只使用下列值：

1. `待开发`
2. `开发中`
3. `已自测`
4. `待人工验收`
5. `已验收`
6. `阻塞中`

解释：

1. Project 里的 `Status` 继续保持粗粒度
2. Issue 正文里的 `当前状态` 负责表达更细的执行与评审状态

## 5. 当前项目的特殊口径

对于本项目当前阶段，内容工具链链路要特别注意：

1. 技能链的主要 UI 验证入口不是 `mock_ui_v11.html`
   - 而是 `test/skill_editor_*.html`
2. Buff 链的主要 UI 验证入口不是主战斗 UI
   - 而是 `test/buff_editor_v*.html`
3. 关卡链当前没有完整独立编辑器页面
   - 因此局部验证入口可以是：
   - `assets/data/levels.json`
   - `assets/data/enemies.json`
   - `mock_ui_v11.html`
   - `test/codex_regression_runner.html`
4. `mock_ui_v11.html` 主要用于主流程运行时消费验证，不应被误写成所有内容链的唯一测试入口

## 6. 当前建议

从现在开始：

1. Project 继续保持简洁
2. `#53 ~ #62` 这类执行 issue 必须补齐“验收入口 / 验收标准 / 输出物 / 当前状态”
3. 长验收脚本与详细自测结论继续保留在 `DOC/CodexAnylyse`
