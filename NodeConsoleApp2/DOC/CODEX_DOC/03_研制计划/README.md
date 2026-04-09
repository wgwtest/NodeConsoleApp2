# 研制计划 README

最后整理时间：2026-04-09

状态：`当前有效`

## 0. 在当前文档体系中的位置

`03_研制计划/` 是当前工程的正式计划目录。

在进入本目录前，建议先看：

1. [CODEX_DOC README](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/README.md)
2. [00-本地工程策略映射](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/00-本地工程策略映射.md)

## 1. 当前激活节点

1. WBS 根节点：`#13`
2. 当前正式阶段节点：`#28 / 阶段C`
3. 当前正式未关闭工作包：
   - `#29 / C1`
   - `#30 / C2`
   - `#83 / C3`
4. 当前主执行节点：
   - `#83 / C3（#84 / #85 已自测待人工验收）`
   - `#29 / C1（#63 / #64 / #65 已验收，#74 / #75 / #76 待人工验收）`
5. 当前并行 Prep 工作包：
   - `#70 / D3 对战演出与动画展示层`
6. 当前待人工验收节点：
   - `#69 / C2.1`
   - `#74 / C1.4`
   - `#75 / C1.5`
   - `#76 / C1.6`
   - `#77 / C2.2`
   - `#78 / C2.3`
   - `#79 / C2.4`
   - `#84 / C3.1`
   - `#85 / C3.2`
   - `#73 / D3.2.1`
   - `#80 / D3.3`
   - `#81 / D3.4`
   - `#82 / D3.5`
   - `#86 / D3.6`
7. 当前正式关闭门 Gate：`M3`
8. 当前并行 Prep Gate：`M4`
9. 当前跨阶段表现层 Prep：
   - `#70 / D3`
   - `#73 / D3.2.1`
   - `#80 / D3.3`
   - `#81 / D3.4`
   - `#82 / D3.5`
   - `#86 / D3.6`
10. 当前阶段计划文档：
   - [10-WBS-L2-C1-技能树与构筑](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/10-WBS-L2-C1-技能树与构筑.md)
   - [07-WBS-L2-C2-内容扩充](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/07-WBS-L2-C2-内容扩充.md)
   - [11-WBS-L2-C3-技能运行时一致性与说明校核](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/11-WBS-L2-C3-技能运行时一致性与说明校核.md)
   - [08-WBS-L2-D3-对战演出与动画展示层](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/08-WBS-L2-D3-对战演出与动画展示层.md)
   - [12-WBS-L2-D1-UI统一](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/12-WBS-L2-D1-UI统一.md)
   - [13-WBS-L2-D2-新手与反馈](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/13-WBS-L2-D2-新手与反馈.md)
   - [14-WBS-L2-E1-测试冻结](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/14-WBS-L2-E1-测试冻结.md)
   - [15-WBS-L2-E2-发布包整理](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/15-WBS-L2-E2-发布包整理.md)
   - [09-WBS-L3-D3.2-SpineAssets协作规则与导入契约基线](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/09-WBS-L3-D3.2-SpineAssets协作规则与导入契约基线.md)
11. 当前主执行拆分：
   - `#74 / C1.4 成长资源来源与最近学习结果可视化`
   - `#75 / C1.5 关前构筑摘要与技能池差异预览`
   - `#76 / C1.6 学习结果驱动的下一局可见反馈闭环`
   - `#69 / C2.1 故事关卡内容元数据与选择页提示收口`
   - `#77 / C2.2 故事关卡奖励节奏与首次通关反馈可视化`
   - `#78 / C2.3 关卡章节组织与连续推进信息补足`
   - `#79 / C2.4 story / acceptance / 编辑器样本层级口径清理`
   - `#84 / C3.1 技能效果矩阵与说明契约收口`
   - `#85 / C3.2 技能运行时批量回归与异常归档`
12. 当前并行启动线：
   - `#70 / D3 对战演出与动画展示层`
   - `#86 / D3.6 HUD比例与动作可观察性校准`
13. 当前已补齐待启动的 Prep 工作包：
   - `#32 / D1 UI 统一`
   - `#33 / D2 新手与反馈`
   - `#35 / E1 测试冻结`
   - `#36 / E2 发布包整理`
14. 当前已补齐待启动的 Prep 叶子：
   - `#87 / D1.1 主入口与主流程按钮语言统一基线`
   - `#88 / D1.2 模态开关、关闭规则与返回语义统一`
   - `#89 / D1.3 主界面信息优先级与状态摘要版式基线`
   - `#90 / D2.1 主流程引导与页面自解释补齐`
   - `#91 / D2.2 机制术语说明与关键规则提示收口`
   - `#92 / D2.3 错误、阻塞与空态反馈统一`
   - `#93 / E1.1 回归入口冻结清单与覆盖矩阵基线`
   - `#94 / E1.2 人工验收入口冻结与版本结论页基线`
   - `#95 / E2.1 运行环境与启动说明整理`
   - `#96 / E2.2 版本说明、已知问题与交付目录清单`
15. 阶段 B 当前已完成且已验收的工作包：
   - `#26 / B1`
   - `#27 / B2`
   - `#67 / B3`
16. 阶段 C 当前已完成并已验收的叶子节点：
   - `#63 / C1.1 主菜单成长摘要与技能树入口`
   - `#64 / C1.2 学习提交后主菜单成长摘要即时刷新`
   - `#65 / C1.3 结算页直达技能树与构筑入口`
17. 阶段 C 当前待人工验收叶子：
   - `#69 / C2.1 故事关卡内容元数据与选择页提示收口`
   - `#74 / C1.4 成长资源来源与最近学习结果可视化`
   - `#75 / C1.5 关前构筑摘要与技能池差异预览`
   - `#76 / C1.6 学习结果驱动的下一局可见反馈闭环`
   - `#77 / C2.2 故事关卡奖励节奏与首次通关反馈可视化`
   - `#78 / C2.3 关卡章节组织与连续推进信息补足`
   - `#79 / C2.4 story / acceptance / 编辑器样本层级口径清理`
   - `#84 / C3.1 技能效果矩阵与说明契约收口`
   - `#85 / C3.2 技能运行时批量回归与异常归档`
18. 阶段 D 当前已完成并已验收的表现层叶子：
   - `#71 / D3.1 动画展示驱动与验证页基线`
   - `#72 / D3.2 SpineAssets协作规则与导入契约基线`
19. 阶段 D 当前待人工验收叶子：
   - `#73 / D3.2.1 Spine样本bundle导入probe与降级壳`
   - `#80 / D3.3 场景节奏强化与镜头感补足`
   - `#81 / D3.4 更多角色 / 技能类别的表现模板扩展`
   - `#82 / D3.5 演出配置化与内容驱动边界`
   - `#86 / D3.6 HUD比例与动作可观察性校准`
20. 当前新启动执行线：
   - `#83 / C3 技能运行时一致性与说明校核`
   - `#84 / C3.1 技能效果矩阵与说明契约收口`
   - `#85 / C3.2 技能运行时批量回归与异常归档`
   - `#86 / D3.6 HUD比例与动作可观察性校准`
   - `#87 ~ #96 / D1、D2、E1、E2 首轮 Prep 执行树`

## 2. 当前目录内的正式计划文件

1. [00-开发计划索引与关系说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/00-开发计划索引与关系说明.md)
2. [01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md)
3. [02-WBS-L1-阶段A-战斗竖切闭环](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/02-WBS-L1-阶段A-战斗竖切闭环.md)
4. [03-执行Issue任务契约与验收口径](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/03-执行Issue任务契约与验收口径.md)
5. [06-WBS-L2-B3-本地存档与读档系统收口](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/06-WBS-L2-B3-本地存档与读档系统收口.md)
6. [07-WBS-L2-C2-内容扩充](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/07-WBS-L2-C2-内容扩充.md)
7. [08-WBS-L2-D3-对战演出与动画展示层](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/08-WBS-L2-D3-对战演出与动画展示层.md)
8. [09-WBS-L3-D3.2-SpineAssets协作规则与导入契约基线](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/09-WBS-L3-D3.2-SpineAssets协作规则与导入契约基线.md)
9. [10-WBS-L2-C1-技能树与构筑](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/10-WBS-L2-C1-技能树与构筑.md)
10. [11-WBS-L2-C3-技能运行时一致性与说明校核](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/11-WBS-L2-C3-技能运行时一致性与说明校核.md)
11. [12-WBS-L2-D1-UI统一](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/12-WBS-L2-D1-UI统一.md)
12. [13-WBS-L2-D2-新手与反馈](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/13-WBS-L2-D2-新手与反馈.md)
13. [14-WBS-L2-E1-测试冻结](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/14-WBS-L2-E1-测试冻结.md)
14. [15-WBS-L2-E2-发布包整理](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/15-WBS-L2-E2-发布包整理.md)
15. [04-CODEX_DOC文档根深度迁移设计](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/04-CODEX_DOC文档根深度迁移设计.md)
16. [05-CODEX_DOC文档根迁移实施计划](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/05-CODEX_DOC文档根迁移实施计划.md)

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
3. 阶段 B `#37` 关闭并完成状态同步：`2026-04-08`
4. 当前正式阶段切到 `#28 / 阶段C`：`2026-04-08`
5. `#29 / C1` 已进入正式执行：`2026-04-08`
6. `#29 / C1` 已验收叶子：`#63 ~ #65`
7. `#29 / C1` 当前待验收叶子：`#74 ~ #76`
8. `#30 / C2` 当前待验收叶子：`#69、#77 ~ #79`
9. `#83 / C3` 已进入正式执行：`#84 ~ #85`
10. `#70 / D3` 已验收叶子：`#71 ~ #72`
11. `#70 / D3` 当前待验收叶子：`#73、#80 ~ #82、#86`
12. `#32 / D1` Prep 排期：`2026-04-10 ~ 2026-04-13`
13. `#33 / D2` Prep 排期：`2026-04-13 ~ 2026-04-16`
14. `#35 / E1` Prep 排期：`2026-04-16 ~ 2026-04-18`
15. `#36 / E2` Prep 排期：`2026-04-18 ~ 2026-04-20`
16. GitHub Project Roadmap 地址：
   - <https://github.com/users/wgwtest/projects/1>

## 7. 状态语义

1. GitHub Project 粗粒度状态：
   - `Todo`
   - `In Progress`
   - `Hum Check`
   - `Done`
2. GitHub Issue 正文中的 `当前状态` 使用细粒度执行语义：
   - `待开发`
   - `开发中`
   - `已自测`
   - `待人工验收`
   - `已验收`
   - `阻塞中`

补充要求：

1. 本地文档若已标记某节点 `已通过`，GitHub Project 不应继续停留在待验收语义。
2. GitHub Project 若已标记 `Done`，必须能在本地验收清单中找到对应的用户通过结论。
3. GitHub Issue 正文中的 `当前状态` 是执行真相，优先级高于 Project 的粗粒度展示状态。
