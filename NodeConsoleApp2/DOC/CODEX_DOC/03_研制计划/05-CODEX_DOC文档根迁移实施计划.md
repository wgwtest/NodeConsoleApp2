# CODEX_DOC 文档根迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前工程文档体系彻底迁移为 `DOC/CODEX_DOC/` 唯一正式文档根，并同步修正本地互链与 GitHub 协作面路径。

**Architecture:** 先建立新文档骨架并按映射表做物理迁移，再批量回写仓库内旧路径引用，最后同步 GitHub Issue/Project，并补齐迁移结果、验收与交接文档。迁移设计文档和后续迁移记录文档作为历史材料保留其“旧路径 -> 新路径”的叙述，不参与无差别文本替换。

**Tech Stack:** Git, Bash, Python 3, GitHub CLI, Markdown

---

### Task 1: 建立 CODEX_DOC 骨架并固定迁移清单

**Files:**
- Create: `DOC/CODEX_DOC/README.md`
- Create: `DOC/CODEX_DOC/00-本地工程策略映射.md`
- Create: `DOC/CODEX_DOC/02_设计说明/README.md`
- Create: `DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/<timestamp>-design文档迁移结果清单.md`
- Create: `DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/<timestamp>-CODEX_DOC迁移执行记录.md`
- Modify: `DOC/CodexAnylyse/开发计划/04-CODEX_DOC文档根深度迁移设计.md`
- Modify: `DOC/CodexAnylyse/开发计划/05-CODEX_DOC文档根迁移实施计划.md`

- [ ] **Step 1: 创建新目录骨架**

Run:

```bash
mkdir -p DOC/CODEX_DOC/01_需求分析 \
  DOC/CODEX_DOC/02_设计说明 \
  DOC/CODEX_DOC/03_研制计划 \
  DOC/CODEX_DOC/04_研发文档 \
  DOC/CODEX_DOC/05_测试文档/01_自测报告 \
  DOC/CODEX_DOC/05_测试文档/02_验收清单 \
  DOC/CODEX_DOC/05_测试文档/03_验收记录 \
  DOC/CODEX_DOC/05_测试文档/04_验收结论 \
  DOC/CODEX_DOC/06_过程文档/01_会话交接 \
  DOC/CODEX_DOC/06_过程文档/02_历史计划 \
  DOC/CODEX_DOC/06_过程文档/03_验收意见处理 \
  DOC/CODEX_DOC/06_过程文档/04_计划管理归档 \
  DOC/CODEX_DOC/06_过程文档/05_汇报材料 \
  DOC/CODEX_DOC/06_过程文档/06_文档迁移记录
```

Expected:

```text
exit 0
```

- [ ] **Step 2: 生成 design 与旧文档的迁移映射清单**

Run:

```bash
find design -maxdepth 1 -type f | sort
find DOC -maxdepth 1 -type f | sort
find DOC/CodexAnylyse -type f | sort
```

Expected:

```text
输出 design/、DOC/ 根目录、DOC/CodexAnylyse/ 的当前实际文件列表
```

- [ ] **Step 3: 写入新文档根入口与迁移结果模板**

Implementation:

```text
用 apply_patch 创建 README、设计说明 README、design 迁移结果清单、迁移执行记录模板。
```

- [ ] **Step 4: 校验迁移前清单完整**

Run:

```bash
find design -maxdepth 1 -type f | wc -l
```

Expected:

```text
17
```

### Task 2: 物理迁移 CodexAnylyse、design 与 DOC 根文档

**Files:**
- Modify: `DOC/CodexAnylyse/**`
- Modify: `design/*.md`
- Modify: `DOC/*.md`
- Create: `DOC/CODEX_DOC/**`

- [ ] **Step 1: 按映射表执行物理迁移**

Run:

```bash
python3 - <<'PY'
from pathlib import Path
import shutil

root = Path('/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2')

mapping = {
    'DOC/CodexAnylyse/README.md': 'DOC/CODEX_DOC/README.md',
    'DOC/CodexAnylyse/00-本地工程策略映射.md': 'DOC/CODEX_DOC/00-本地工程策略映射.md',
    'DOC/CodexAnylyse/00-工程总体分析.md': 'DOC/CODEX_DOC/01_需求分析/00-工程总体分析.md',
    'DOC/CodexAnylyse/05-mock_ui_v11主流程测试基线.md': 'DOC/CODEX_DOC/01_需求分析/05-mock_ui_v11主流程测试基线.md',
    'DOC/CodexAnylyse/02-当前阶段验收说明.md': 'DOC/CODEX_DOC/04_研发文档/02-当前阶段验收说明.md',
    'DOC/CodexAnylyse/03-当前工程Codex工作策略.md': 'DOC/CODEX_DOC/04_研发文档/03-当前工程Codex工作策略.md',
    'DOC/CodexAnylyse/04-mock_ui_v11测试入口更正说明.md': 'DOC/CODEX_DOC/04_研发文档/04-mock_ui_v11测试入口更正说明.md',
    'DOC/CodexAnylyse/06-人工验收设计原则.md': 'DOC/CODEX_DOC/04_研发文档/06-人工验收设计原则.md',
    'DOC/CodexAnylyse/开发计划/README.md': 'DOC/CODEX_DOC/03_研制计划/README.md',
    'DOC/CodexAnylyse/开发计划/00-开发计划索引与关系说明.md': 'DOC/CODEX_DOC/03_研制计划/00-开发计划索引与关系说明.md',
    'DOC/CodexAnylyse/开发计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md': 'DOC/CODEX_DOC/03_研制计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md',
    'DOC/CodexAnylyse/开发计划/02-WBS-L1-阶段A-战斗竖切闭环.md': 'DOC/CODEX_DOC/03_研制计划/02-WBS-L1-阶段A-战斗竖切闭环.md',
    'DOC/CodexAnylyse/开发计划/03-执行Issue任务契约与验收口径.md': 'DOC/CODEX_DOC/03_研制计划/03-执行Issue任务契约与验收口径.md',
    'DOC/CodexAnylyse/开发计划/04-CODEX_DOC文档根深度迁移设计.md': 'DOC/CODEX_DOC/03_研制计划/04-CODEX_DOC文档根深度迁移设计.md',
    'DOC/CodexAnylyse/开发计划/05-CODEX_DOC文档根迁移实施计划.md': 'DOC/CODEX_DOC/03_研制计划/05-CODEX_DOC文档根迁移实施计划.md',
}

for src, dst in mapping.items():
    s = root / src
    d = root / dst
    if s.exists():
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(s), str(d))

for file in (root / 'design').glob('*'):
    if file.is_file():
        dst = root / 'DOC/CODEX_DOC/02_设计说明' / file.name
        shutil.move(str(file), str(dst))

for sub in ['会话交接','计划管理归档','验收意见处理','自测报告','验收清单','验收记录','验收结论']:
    s = root / 'DOC/CodexAnylyse' / sub
    if s.exists():
        if sub == '会话交接':
            d = root / 'DOC/CODEX_DOC/06_过程文档/01_会话交接'
        elif sub == '计划管理归档':
            d = root / 'DOC/CODEX_DOC/06_过程文档/04_计划管理归档'
        elif sub == '验收意见处理':
            d = root / 'DOC/CODEX_DOC/06_过程文档/03_验收意见处理'
        elif sub == '自测报告':
            d = root / 'DOC/CODEX_DOC/05_测试文档/01_自测报告'
        elif sub == '验收清单':
            d = root / 'DOC/CODEX_DOC/05_测试文档/02_验收清单'
        elif sub == '验收记录':
            d = root / 'DOC/CODEX_DOC/05_测试文档/03_验收记录'
        else:
            d = root / 'DOC/CODEX_DOC/05_测试文档/04_验收结论'
        if d.exists():
            for p in s.iterdir():
                shutil.move(str(p), str(d / p.name))
            s.rmdir()
        else:
            shutil.move(str(s), str(d))

history = root / 'DOC/CodexAnylyse/开发计划/历史计划'
if history.exists():
    d = root / 'DOC/CODEX_DOC/06_过程文档/02_历史计划'
    d.mkdir(parents=True, exist_ok=True)
    for p in history.iterdir():
        shutil.move(str(p), str(d / p.name))
    history.rmdir()

doc_map = {
    'DOC/计划案文档.md': 'DOC/CODEX_DOC/01_需求分析/计划案文档.md',
    'DOC/调研报告.md': 'DOC/CODEX_DOC/01_需求分析/调研报告.md',
    'DOC/调研统计.txt': 'DOC/CODEX_DOC/01_需求分析/调研统计.txt',
    'DOC/问题列表.txt': 'DOC/CODEX_DOC/01_需求分析/问题列表.txt',
    'DOC/状态机 vs 工作流 的示例文档.md': 'DOC/CODEX_DOC/01_需求分析/状态机 vs 工作流 的示例文档.md',
    'DOC/工作计划-step01.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step01.md',
    'DOC/工作计划-step02.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step02.md',
    'DOC/工作计划-step03.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step03.md',
    'DOC/工作计划-step04.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step04.md',
    'DOC/todoList.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/todoList.md',
    'DOC/汇报文案.md': 'DOC/CODEX_DOC/06_过程文档/05_汇报材料/汇报文案.md',
    'DOC/汇报稿草案.txt': 'DOC/CODEX_DOC/06_过程文档/05_汇报材料/汇报稿草案.txt',
    'DOC/高光回答.md': 'DOC/CODEX_DOC/06_过程文档/05_汇报材料/高光回答.md',
}
for src, dst in doc_map.items():
    s = root / src
    d = root / dst
    if s.exists():
        d.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(s), str(d))

old_root = root / 'DOC/CodexAnylyse'
if old_root.exists():
    for path in sorted(old_root.rglob('*'), reverse=True):
        if path.is_file():
            continue
        try:
            path.rmdir()
        except OSError:
            pass
    try:
        old_root.rmdir()
    except OSError:
        pass
PY
```

Expected:

```text
exit 0
```

- [ ] **Step 2: 校验 design 文档全部进入新目录**

Run:

```bash
find DOC/CODEX_DOC/02_设计说明 -maxdepth 1 -type f | sort | wc -l
```

Expected:

```text
至少 18
```

### Task 3: 批量回写仓库内旧路径引用

**Files:**
- Modify: `**/*.md`
- Modify: `**/*.txt`
- Modify: `**/*.html`
- Modify: `**/*.js`
- Exclude: `DOC/CODEX_DOC/03_研制计划/04-CODEX_DOC文档根深度迁移设计.md`
- Exclude: `DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/*`

- [ ] **Step 1: 用映射表替换仓库内旧路径**

Run:

```bash
python3 - <<'PY'
from pathlib import Path

root = Path('/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2')
abs_root = '/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/'

replacements = {
    'DOC/CodexAnylyse/README.md': 'DOC/CODEX_DOC/README.md',
    'DOC/CodexAnylyse/00-本地工程策略映射.md': 'DOC/CODEX_DOC/00-本地工程策略映射.md',
    'DOC/CodexAnylyse/00-工程总体分析.md': 'DOC/CODEX_DOC/01_需求分析/00-工程总体分析.md',
    'DOC/CodexAnylyse/02-当前阶段验收说明.md': 'DOC/CODEX_DOC/04_研发文档/02-当前阶段验收说明.md',
    'DOC/CodexAnylyse/03-当前工程Codex工作策略.md': 'DOC/CODEX_DOC/04_研发文档/03-当前工程Codex工作策略.md',
    'DOC/CodexAnylyse/04-mock_ui_v11测试入口更正说明.md': 'DOC/CODEX_DOC/04_研发文档/04-mock_ui_v11测试入口更正说明.md',
    'DOC/CodexAnylyse/05-mock_ui_v11主流程测试基线.md': 'DOC/CODEX_DOC/01_需求分析/05-mock_ui_v11主流程测试基线.md',
    'DOC/CodexAnylyse/06-人工验收设计原则.md': 'DOC/CODEX_DOC/04_研发文档/06-人工验收设计原则.md',
    'DOC/CodexAnylyse/开发计划/README.md': 'DOC/CODEX_DOC/03_研制计划/README.md',
    'DOC/CodexAnylyse/开发计划/00-开发计划索引与关系说明.md': 'DOC/CODEX_DOC/03_研制计划/00-开发计划索引与关系说明.md',
    'DOC/CodexAnylyse/开发计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md': 'DOC/CODEX_DOC/03_研制计划/01-WBS-L0-NodeConsoleApp2-可交付版本研发总纲.md',
    'DOC/CodexAnylyse/开发计划/02-WBS-L1-阶段A-战斗竖切闭环.md': 'DOC/CODEX_DOC/03_研制计划/02-WBS-L1-阶段A-战斗竖切闭环.md',
    'DOC/CodexAnylyse/开发计划/03-执行Issue任务契约与验收口径.md': 'DOC/CODEX_DOC/03_研制计划/03-执行Issue任务契约与验收口径.md',
    'DOC/CodexAnylyse/开发计划/04-CODEX_DOC文档根深度迁移设计.md': 'DOC/CODEX_DOC/03_研制计划/04-CODEX_DOC文档根深度迁移设计.md',
    'DOC/CodexAnylyse/开发计划/05-CODEX_DOC文档根迁移实施计划.md': 'DOC/CODEX_DOC/03_研制计划/05-CODEX_DOC文档根迁移实施计划.md',
    'DOC/CodexAnylyse/会话交接/': 'DOC/CODEX_DOC/06_过程文档/01_会话交接/',
    'DOC/CodexAnylyse/计划管理归档/': 'DOC/CODEX_DOC/06_过程文档/04_计划管理归档/',
    'DOC/CodexAnylyse/验收意见处理/': 'DOC/CODEX_DOC/06_过程文档/03_验收意见处理/',
    'DOC/CodexAnylyse/自测报告/': 'DOC/CODEX_DOC/05_测试文档/01_自测报告/',
    'DOC/CodexAnylyse/验收清单/': 'DOC/CODEX_DOC/05_测试文档/02_验收清单/',
    'DOC/CodexAnylyse/验收记录/': 'DOC/CODEX_DOC/05_测试文档/03_验收记录/',
    'DOC/CodexAnylyse/验收结论/': 'DOC/CODEX_DOC/05_测试文档/04_验收结论/',
    'DOC/CodexAnylyse': 'DOC/CODEX_DOC',
    'design/UI_design.md': 'DOC/CODEX_DOC/02_设计说明/16-战斗界面(UI_design)-设计说明.md',
    'design/battle_scene_proposal.md': 'DOC/CODEX_DOC/02_设计说明/17-战斗场景提案(battle_scene_proposal)-设计说明.md',
    'design/buff_design.md': 'DOC/CODEX_DOC/02_设计说明/09-Buff系统(buff_design)-设计说明.md',
    'design/buff_editor_design.md': 'DOC/CODEX_DOC/02_设计说明/10-Buff编辑器(buff_editor_design)-设计说明.md',
    'design/core_engine.md': 'DOC/CODEX_DOC/02_设计说明/01-核心引擎(core_engine)-设计说明.md',
    'design/data_design.md': 'DOC/CODEX_DOC/02_设计说明/02-数据结构(data_design)-设计说明.md',
    'design/enemy_design.md': 'DOC/CODEX_DOC/02_设计说明/11-敌人系统(enemy_design)-设计说明.md',
    'design/item_design.md': 'DOC/CODEX_DOC/02_设计说明/13-道具系统(item_design)-设计说明.md',
    'design/level_design.md': 'DOC/CODEX_DOC/02_设计说明/12-关卡系统(level_design)-设计说明.md',
    'design/skill_balance_design.md': 'DOC/CODEX_DOC/02_设计说明/06-技能平衡(skill_balance_design)-设计说明.md',
    'design/skill_design.md': 'DOC/CODEX_DOC/02_设计说明/03-技能系统(skill_design)-设计说明.md',
    'design/skill_design_brainStorm.md': 'DOC/CODEX_DOC/02_设计说明/08-技能头脑风暴(skill_design_brainStorm)-设计说明.md',
    'design/skill_editor_design.md': 'DOC/CODEX_DOC/02_设计说明/04-技能编辑器(skill_editor_design)-设计说明.md',
    'design/skill_planning_design.md': 'DOC/CODEX_DOC/02_设计说明/05-技能规划(skill_planning_design)-设计说明.md',
    'design/skill_test_design.md': 'DOC/CODEX_DOC/02_设计说明/07-技能测试(skill_test_design)-设计说明.md',
    'design/timeline_UI_design.md': 'DOC/CODEX_DOC/02_设计说明/15-时间线界面(timeline_UI_design)-设计说明.md',
    'design/timeline_design.md': 'DOC/CODEX_DOC/02_设计说明/14-时间线机制(timeline_design)-设计说明.md',
    'DOC/计划案文档.md': 'DOC/CODEX_DOC/01_需求分析/计划案文档.md',
    'DOC/调研报告.md': 'DOC/CODEX_DOC/01_需求分析/调研报告.md',
    'DOC/调研统计.txt': 'DOC/CODEX_DOC/01_需求分析/调研统计.txt',
    'DOC/问题列表.txt': 'DOC/CODEX_DOC/01_需求分析/问题列表.txt',
    'DOC/状态机 vs 工作流 的示例文档.md': 'DOC/CODEX_DOC/01_需求分析/状态机 vs 工作流 的示例文档.md',
    'DOC/工作计划-step01.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step01.md',
    'DOC/工作计划-step02.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step02.md',
    'DOC/工作计划-step03.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step03.md',
    'DOC/工作计划-step04.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step04.md',
    'DOC/todoList.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/todoList.md',
    'DOC/汇报文案.md': 'DOC/CODEX_DOC/06_过程文档/05_汇报材料/汇报文案.md',
    'DOC/汇报稿草案.txt': 'DOC/CODEX_DOC/06_过程文档/05_汇报材料/汇报稿草案.txt',
    'DOC/高光回答.md': 'DOC/CODEX_DOC/06_过程文档/05_汇报材料/高光回答.md',
}
abs_replacements = {abs_root + k: abs_root + v for k, v in replacements.items()}
replacements.update(abs_replacements)

exclude = {
    root / 'DOC/CODEX_DOC/03_研制计划/04-CODEX_DOC文档根深度迁移设计.md',
}

for path in root.rglob('*'):
    if path.is_dir():
        continue
    if path.suffix.lower() not in {'.md', '.txt', '.html', '.js'}:
        continue
    if '.git' in path.parts or 'node_modules' in path.parts:
        continue
    if path in exclude:
        continue
    try:
        text = path.read_text(encoding='utf-8')
    except Exception:
        continue
    new = text
    for src, dst in sorted(replacements.items(), key=lambda kv: len(kv[0]), reverse=True):
        new = new.replace(src, dst)
    if new != text:
        path.write_text(new, encoding='utf-8')
PY
```

Expected:

```text
exit 0
```

- [ ] **Step 2: 检查旧路径残留**

Run:

```bash
rg -n "DOC/CodexAnylyse|design/.*\\.md|DOC/工作计划|DOC/计划案文档|DOC/调研报告|DOC/汇报文案|DOC/todoList" . --glob '!node_modules/**' --glob '!.git/**'
```

Expected:

```text
只允许迁移设计文档、迁移记录文档、或刻意保留历史来源叙述的文件残留
```

### Task 4: 同步 GitHub Issues 与 Project README

**Files:**
- Modify: GitHub Project `#1` README
- Modify: GitHub Issues `#1 #13 #14 #25 #28 #31 #34 #37 #40 #43 #46 #49-#62`

- [ ] **Step 1: 批量更新 issue 正文中的旧路径**

Run:

```bash
python3 - <<'PY'
import json, subprocess

repo = 'wgwtest/NodeConsoleApp2'
issues = [1,13,14,25,28,31,34,37,40,43,46,49,50,51,52,53,54,55,56,57,58,59,60,61,62]
replacements = {
    'DOC/CodexAnylyse/': 'DOC/CODEX_DOC/',
    'design/': 'DOC/CODEX_DOC/02_设计说明/',
    'DOC/工作计划-step01.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step01.md',
    'DOC/工作计划-step02.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step02.md',
    'DOC/工作计划-step03.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step03.md',
    'DOC/工作计划-step04.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/工作计划-step04.md',
    'DOC/todoList.md': 'DOC/CODEX_DOC/06_过程文档/02_历史计划/todoList.md',
    'DOC/计划案文档.md': 'DOC/CODEX_DOC/01_需求分析/计划案文档.md',
    'DOC/调研报告.md': 'DOC/CODEX_DOC/01_需求分析/调研报告.md',
    'DOC/汇报文案.md': 'DOC/CODEX_DOC/06_过程文档/05_汇报材料/汇报文案.md',
}
for n in issues:
    body = subprocess.check_output(['gh','issue','view',str(n),'-R',repo,'--json','body','--jq','.body'], text=True)
    new = body
    for src, dst in sorted(replacements.items(), key=lambda kv: len(kv[0]), reverse=True):
        new = new.replace(src, dst)
    if new != body:
        subprocess.run(['gh','issue','edit',str(n),'-R',repo,'--body',new], check=True)
PY
```

Expected:

```text
exit 0
```

- [ ] **Step 2: 更新 Project README 到新根路径**

Run:

```bash
gh project view 1 --owner wgwtest --format json --jq .readme
```

Expected:

```text
Project README 中不再出现 DOC/CodexAnylyse 和 design/ 旧路径
```

### Task 5: 生成迁移结果、自测、验收与交接文档

**Files:**
- Create: `DOC/CODEX_DOC/02_设计说明/README.md`
- Create: `DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/<timestamp>-design文档迁移结果清单.md`
- Create: `DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/<timestamp>-CODEX_DOC迁移执行记录.md`
- Create: `DOC/CODEX_DOC/05_测试文档/01_自测报告/<timestamp>-CODEX_DOC文档根迁移自测报告.md`
- Create: `DOC/CODEX_DOC/05_测试文档/02_验收清单/<timestamp>-CODEX_DOC文档根迁移人工验收清单.md`
- Create: `DOC/CODEX_DOC/06_过程文档/01_会话交接/<timestamp>-CODEX_DOC文档根迁移记录.md`

- [ ] **Step 1: 写 design 文档迁移结果清单**

Implementation:

```text
用 apply_patch 创建 design 文档逐项迁移清单，至少覆盖全部 17 份文档的原路径、新路径、主题归类和回写说明。
```

- [ ] **Step 2: 写迁移执行记录、自测报告、人工验收清单与交接文档**

Implementation:

```text
用 apply_patch 创建本轮迁移证据文档，说明迁移范围、验证方式、用户验收入口与后续注意事项。
```

- [ ] **Step 3: 验证最终状态**

Run:

```bash
git diff --check
find DOC/CODEX_DOC/02_设计说明 -maxdepth 1 -type f | sort
rg -n "DOC/CodexAnylyse|design/.*\\.md|DOC/工作计划|DOC/计划案文档|DOC/调研报告|DOC/汇报文案|DOC/todoList" . --glob '!node_modules/**' --glob '!.git/**'
```

Expected:

```text
diff --check 无报错；design 文档全部可见；旧路径残留只存在于迁移设计/迁移记录等历史说明文件
```
