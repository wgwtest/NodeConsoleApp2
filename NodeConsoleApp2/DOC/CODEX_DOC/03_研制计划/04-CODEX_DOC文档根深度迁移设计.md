# CODEX_DOC 文档根深度迁移设计

最后整理时间：2026-04-03

状态：`待用户复核`

## 1. 目标

本设计用于把当前工程的文档体系从：

1. `DOC/CodexAnylyse/`
2. `design/`
3. `DOC/` 根目录历史文档

统一深度迁移为以 `DOC/CODEX_DOC/` 为唯一正式文档根的结构，并同步修正：

1. 本地 Markdown 互链
2. GitHub Issue 中的文档路径
3. GitHub Project README 中的文档路径
4. 本地计划、验收、交接与设计说明入口

迁移后的文档体系必须严格对齐全局策略定义的六类结构，而不是仅做目录别名或兼容跳转。

## 2. 迁移完成后的目标结构

```text
DOC/CODEX_DOC/
├── README.md
├── 00-本地工程策略映射.md
├── 01_需求分析/
├── 02_设计说明/
├── 03_研制计划/
├── 04_研发文档/
├── 05_测试文档/
│   ├── 01_自测报告/
│   ├── 02_验收清单/
│   ├── 03_验收记录/
│   └── 04_验收结论/
└── 06_过程文档/
    ├── 01_会话交接/
    ├── 02_历史计划/
    ├── 03_验收意见处理/
    ├── 04_计划管理归档/
    ├── 05_汇报材料/
    └── 06_文档迁移记录/
```

说明：

1. `DOC/CODEX_DOC/` 将成为唯一正式文档根
2. `DOC/CodexAnylyse/` 不再保留为正式入口
3. `design/` 不再承载正式设计文档
4. `DOC/` 根目录旧文档迁入 `CODEX_DOC` 后，不再作为正式入口使用

## 3. 总体迁移原则

### 3.1 唯一正式文档根

迁移完成后，正式文档入口只保留：

1. `DOC/CODEX_DOC/README.md`
2. `DOC/CODEX_DOC/00-本地工程策略映射.md`

### 3.2 深度迁移，不保留长期兼容层

本轮不采用“旧目录保留 README 跳转”的长期兼容策略。

原因：

1. 用户明确要求彻底切换
2. 长期兼容层会使 Issue / Project / 本地文档继续存在双根状态
3. 双根状态不利于后续统一工程策略复用

### 3.3 design 文档谨慎迁移

`design/` 中现有 17 份文档全部迁入 `DOC/CODEX_DOC/02_设计说明/`，并遵守：

1. 保留原文件名
2. 不做内容删减
3. 不在本轮随意合并文档
4. 迁移完成后单独形成“design 文档迁移结果清单”

### 3.4 物理迁移优先于复制

本轮默认使用物理迁移而不是复制保留双份。

原因：

1. 双份会制造“哪个才是正式版本”的歧义
2. 后续引用同步更容易遗漏

### 3.5 GitHub 路径同轮同步

任何被迁移的正式文档路径，都必须在同一轮同步修正：

1. GitHub Issue 正文
2. GitHub Project README
3. 本地入口 README
4. 本地计划、验收、交接、自测文档中的互链

## 4. 迁移范围

### 4.1 必迁范围

1. `DOC/CodexAnylyse/` 全部正式文档与子目录
2. `design/` 全部 Markdown 设计文档
3. `DOC/` 根目录现有历史文档

### 4.2 迁移但不重命名的范围

1. `design/*.md`
2. 历史验收清单
3. 历史交接文档
4. 历史自测报告

### 4.3 本轮不处理的范围

1. 源代码实现文件
2. 测试 HTML 页本身
3. 业务配置 JSON
4. 非文档类资源

## 5. 新结构下的归类规则

### 5.1 `01_需求分析`

用于放置：

1. 工程总体分析
2. 主流程测试基线
3. 调研报告
4. 问题清单
5. 计划案类产品边界材料

### 5.2 `02_设计说明`

用于放置：

1. 所有来自 `design/` 的正式设计文档
2. 与运行时结构、编辑器设计、UI 设计、技能/Buff/关卡设计有关的稳定设计文档

### 5.3 `03_研制计划`

用于放置：

1. WBS 总计划
2. 阶段计划
3. Issue 契约与验收口径
4. 计划索引与计划入口 README

### 5.4 `04_研发文档`

用于放置：

1. 当前阶段验收说明
2. mock_ui_v11 测试入口更正说明
3. 人工验收设计原则
4. 其他实现边界、运行时约束、专题性研发说明

### 5.5 `05_测试文档`

用于放置：

1. 自测报告
2. 人工验收清单
3. 验收记录
4. 验收结论

### 5.6 `06_过程文档`

用于放置：

1. 会话交接
2. 历史计划
3. 验收意见处理
4. 计划管理归档
5. 汇报材料
6. 文档迁移记录

## 6. design 文档迁移设计

### 6.1 总规则

`design/` 中的全部文件迁入：

1. `DOC/CODEX_DOC/02_设计说明/`

本轮不改文件名，只改物理位置和引用路径。

### 6.2 逐文件迁移表

| 原路径 | 目标路径 | 迁移说明 |
| --- | --- | --- |
| `design/UI_design.md` | `DOC/CODEX_DOC/02_设计说明/16-战斗界面(UI_design)-设计说明.md` | UI 总体设计，保留原名 |
| `design/battle_scene_proposal.md` | `DOC/CODEX_DOC/02_设计说明/17-战斗场景提案(battle_scene_proposal)-设计说明.md` | 战斗场景方案设计，保留原名 |
| `design/buff_design.md` | `DOC/CODEX_DOC/02_设计说明/09-Buff系统(buff_design)-设计说明.md` | Buff 体系设计，保留原名 |
| `design/buff_editor_design.md` | `DOC/CODEX_DOC/02_设计说明/10-Buff编辑器(buff_editor_design)-设计说明.md` | Buff 编辑器设计，保留原名 |
| `design/core_engine.md` | `DOC/CODEX_DOC/02_设计说明/01-核心引擎(core_engine)-设计说明.md` | 核心引擎设计，保留原名 |
| `design/data_design.md` | `DOC/CODEX_DOC/02_设计说明/02-数据结构(data_design)-设计说明.md` | 数据结构设计，保留原名 |
| `design/enemy_design.md` | `DOC/CODEX_DOC/02_设计说明/11-敌人系统(enemy_design)-设计说明.md` | 敌人设计，保留原名 |
| `design/item_design.md` | `DOC/CODEX_DOC/02_设计说明/13-道具系统(item_design)-设计说明.md` | 道具设计，保留原名 |
| `design/level_design.md` | `DOC/CODEX_DOC/02_设计说明/12-关卡系统(level_design)-设计说明.md` | 关卡设计，保留原名 |
| `design/skill_balance_design.md` | `DOC/CODEX_DOC/02_设计说明/06-技能平衡(skill_balance_design)-设计说明.md` | 技能平衡设计，保留原名 |
| `design/skill_design.md` | `DOC/CODEX_DOC/02_设计说明/03-技能系统(skill_design)-设计说明.md` | 技能体系设计，保留原名 |
| `design/skill_design_brainStorm.md` | `DOC/CODEX_DOC/02_设计说明/08-技能头脑风暴(skill_design_brainStorm)-设计说明.md` | 技能头脑风暴设计，保留原名 |
| `design/skill_editor_design.md` | `DOC/CODEX_DOC/02_设计说明/04-技能编辑器(skill_editor_design)-设计说明.md` | 技能编辑器设计，保留原名 |
| `design/skill_planning_design.md` | `DOC/CODEX_DOC/02_设计说明/05-技能规划(skill_planning_design)-设计说明.md` | 技能规划设计，保留原名 |
| `design/skill_test_design.md` | `DOC/CODEX_DOC/02_设计说明/07-技能测试(skill_test_design)-设计说明.md` | 技能测试设计，保留原名 |
| `design/timeline_UI_design.md` | `DOC/CODEX_DOC/02_设计说明/15-时间线界面(timeline_UI_design)-设计说明.md` | 时间线 UI 设计，保留原名 |
| `design/timeline_design.md` | `DOC/CODEX_DOC/02_设计说明/14-时间线机制(timeline_design)-设计说明.md` | 时间线机制设计，保留原名 |

### 6.3 迁移后补充产物

迁移完成后，新增：

1. `DOC/CODEX_DOC/02_设计说明/README.md`
2. `DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/YYYY-MM-DD-HHMMSS-design文档迁移结果清单.md`

这两份文档必须逐条记录每个 design 文档的：

1. 原路径
2. 新路径
3. 主题归类
4. 是否存在链接回写

## 7. DOC 根目录旧文档迁移设计

### 7.1 需求/调研类

迁入 `01_需求分析/`：

1. `DOC/计划案文档.md`
2. `DOC/调研报告.md`
3. `DOC/调研统计.txt`
4. `DOC/问题列表.txt`
5. `DOC/状态机 vs 工作流 的示例文档.md`

### 7.2 历史计划类

迁入 `06_过程文档/02_历史计划/`：

1. `DOC/工作计划-step01.md`
2. `DOC/工作计划-step02.md`
3. `DOC/工作计划-step03.md`
4. `DOC/工作计划-step04.md`
5. `DOC/todoList.md`

### 7.3 汇报材料类

迁入 `06_过程文档/05_汇报材料/`：

1. `DOC/汇报文案.md`
2. `DOC/汇报稿草案.txt`
3. `DOC/高光回答.md`

## 8. CodexAnylyse 现有内容迁移设计

### 8.1 根目录单文档

| 原路径 | 目标路径 |
| --- | --- |
| `DOC/CodexAnylyse/README.md` | `DOC/CODEX_DOC/README.md` |
| `DOC/CodexAnylyse/00-本地工程策略映射.md` | `DOC/CODEX_DOC/00-本地工程策略映射.md` |
| `DOC/CodexAnylyse/00-工程总体分析.md` | `DOC/CODEX_DOC/01_需求分析/00-工程总体分析.md` |
| `DOC/CodexAnylyse/02-当前阶段验收说明.md` | `DOC/CODEX_DOC/04_研发文档/02-当前阶段验收说明.md` |
| `DOC/CodexAnylyse/03-当前工程Codex工作策略.md` | `DOC/CODEX_DOC/04_研发文档/03-当前工程Codex工作策略.md` |
| `DOC/CodexAnylyse/04-mock_ui_v11测试入口更正说明.md` | `DOC/CODEX_DOC/04_研发文档/04-mock_ui_v11测试入口更正说明.md` |
| `DOC/CodexAnylyse/05-mock_ui_v11主流程测试基线.md` | `DOC/CODEX_DOC/01_需求分析/05-mock_ui_v11主流程测试基线.md` |
| `DOC/CodexAnylyse/06-人工验收设计原则.md` | `DOC/CODEX_DOC/04_研发文档/06-人工验收设计原则.md` |

### 8.2 计划目录

迁入 `03_研制计划/`：

1. `开发计划/README.md`
2. `开发计划/00-开发计划索引与关系说明.md`
3. `开发计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md`
4. `开发计划/02-WBS-L1-阶段A-战斗竖切闭环.md`
5. `开发计划/03-执行Issue任务契约与验收口径.md`
6. `开发计划/04-CODEX_DOC文档根深度迁移设计.md`

### 8.3 测试与验收目录

按全局策略落入：

1. `自测报告/` -> `05_测试文档/01_自测报告/`
2. `验收清单/` -> `05_测试文档/02_验收清单/`
3. `验收记录/` -> `05_测试文档/03_验收记录/`
4. `验收结论/` -> `05_测试文档/04_验收结论/`

### 8.4 过程目录

按全局策略落入：

1. `会话交接/` -> `06_过程文档/01_会话交接/`
2. `开发计划/历史计划/` -> `06_过程文档/02_历史计划/`
3. `验收意见处理/` -> `06_过程文档/03_验收意见处理/`
4. `计划管理归档/` -> `06_过程文档/04_计划管理归档/`

## 9. 执行步骤

### 9.1 第一步：建立新骨架

创建 `DOC/CODEX_DOC/` 及其六类目录与编号子目录。

### 9.2 第二步：物理迁移文档

按本设计中的归类表完成：

1. `CodexAnylyse` 文档迁移
2. `design` 文档迁移
3. `DOC/` 根目录旧文档迁移

### 9.3 第三步：修正本地互链

修正所有仍引用以下旧路径的 Markdown 文档：

1. `DOC/CodexAnylyse/...`
2. `design/...`
3. `DOC/...` 根目录旧文档

### 9.4 第四步：同步 GitHub 协作面

修正：

1. 相关 GitHub Issue 正文中的旧路径
2. GitHub Project README 中的旧路径

### 9.5 第五步：生成迁移结果文档

至少生成：

1. 新文档根 `README.md`
2. `02_设计说明/README.md`
3. `06_过程文档/06_文档迁移记录/...-design文档迁移结果清单.md`
4. `06_过程文档/06_文档迁移记录/...-CODEX_DOC迁移执行记录.md`

## 10. 验证要求

迁移完成后至少验证：

1. `DOC/CODEX_DOC/` 主入口存在
2. 原 `design` 文档均能在新路径找到
3. design 文档迁移结果清单覆盖全部 17 份文档
4. 本地 Markdown 旧路径引用已清理
5. GitHub Project README 不再引用 `CodexAnylyse`
6. 当前活跃 Issue 不再引用 `DOC/CodexAnylyse/` 作为正式路径

## 11. 风险与控制

### 11.1 风险

1. 大量 Markdown 互链可能遗漏
2. GitHub 协作面路径可能出现漂移
3. 历史文档分类可能出现歧义

### 11.2 控制方式

1. 迁移前先用映射表固定归类
2. 迁移后用全文检索检查旧路径残留
3. 对 design 文档单独形成迁移结果清单
4. GitHub Issue / Project 在同一轮完成回写

## 12. 通过线

本设计通过后，才进入物理迁移实施。

实施完成的通过线是：

1. `DOC/CODEX_DOC/` 成为唯一正式文档根
2. `design/` 中 17 份文档全部迁入 `02_设计说明/`
3. 本地与 GitHub 路径同步完成
4. design 文档迁移结果可逐项审阅
