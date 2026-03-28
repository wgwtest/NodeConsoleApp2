# 开发计划 README

最后整理时间：2026-03-28

状态：`当前有效`

## 1. 当前激活节点

1. WBS 根节点：`#13`
2. 当前阶段节点：`#14`
3. 当前阶段工作包：`#15`、`#16`、`#17`、`#49`
4. 当前 Gate：`M1`
5. 当前阶段计划文档：
   - [02-WBS-L1-阶段A-战斗竖切闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/开发计划/02-WBS-L1-阶段A-战斗竖切闭环.md)
6. 当前阶段并行启动线：
   - `#50` 技能编辑契约与编辑链
   - `#51` Buff 编辑契约与编辑链
   - `#52` 关卡编辑契约与编辑链

## 1.1 当前协作规则

1. 当前项目采用“双门模型”：
   - `研发推进门`
   - `阶段关闭门`
2. `研发推进门` 的作用是决定研发是否可以继续向前推进
3. `阶段关闭门` 的作用是决定某一阶段是否可以正式标记为 `Accepted / Closed`
4. 用户人工验收不再阻断低耦合的后续研发准备工作
5. 用户人工验收仍然是阶段正式关闭的唯一依据

## 1.2 Prep / Core 规则

1. `Prep`
   - 指下一阶段可提前进行的低耦合工作
   - 例如：契约草案、测试脚手架、样本数据、只读分析、独立 UI 壳子、文档和验收基线设计
2. `Core`
   - 指直接依赖上一阶段稳定输出的正式实现
   - 例如：绑定真实结算契约、依赖稳定存档结构的功能、依赖稳定 Buff/敌人运行时语义的业务逻辑
3. 当上一阶段处于 `待人工验收` 时：
   - 允许推进下一阶段 `Prep`
   - 不允许把下一阶段 `Core` 标记为正式开始
4. 当上一阶段人工验收通过后：
   - 才允许把下一阶段 `Core` 作为正式主线推进

## 2. 命名规则

1. 稳定计划文档按 WBS 节点命名
2. `L0` 总计划对应总纲文档
3. `L1` 阶段计划对应单个阶段的稳定计划文档
4. 不再用“当前阶段计划”作为文件名
5. 当前激活的是哪个节点，只在本 README 和 GitHub Project 中更新

## 3. 阅读顺序

1. [01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/开发计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md)
2. [02-WBS-L1-阶段A-战斗竖切闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/开发计划/02-WBS-L1-阶段A-战斗竖切闭环.md)
3. [00-工程总体分析](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/00-工程总体分析.md)
4. [05-mock_ui_v11主流程测试基线](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/05-mock_ui_v11主流程测试基线.md)
5. `design/skill_editor_design.md`、`design/buff_editor_design.md`、`design/level_design.md`
6. 对应阶段的自测报告、验收清单和会话交接

## 3.1 归档入口

以下内容已不再属于活跃计划区，而是计划管理过程归档：

1. [计划管理归档 README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CodexAnylyse/计划管理归档/README.md)

## 4. 时间基线

1. 首版时间估算同步时间：`2026-03-28`
2. 当前阶段 `#14` 目标评估日：`2026-04-03`
3. GitHub Project Roadmap 地址：
   - <https://github.com/users/wgwtest/projects/1>

## 5. 协作状态语义

本地计划按以下语义理解阶段状态。GitHub Project 当前若仍使用粗粒度 `Status` 字段，应以 Project README 中的映射说明为准。

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
