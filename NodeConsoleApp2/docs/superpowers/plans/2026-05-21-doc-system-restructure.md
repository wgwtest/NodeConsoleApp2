# Documentation System Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `DOC/CODEX_DOC/02_设计说明` from a flat historical file list into a subsystem-oriented design documentation structure.

**Architecture:** Keep `DOC/CODEX_DOC` as the formal documentation root. Keep current design documents as stable content, move them into subsystem directories, and add README/index documents that define ownership, reading order, and document granularity. Do not mix this documentation restructure with the existing uncommitted skill-tree UI/code work.

**Tech Stack:** Markdown documentation, Git file moves, repository-local documentation validation with `find`, `rg`, and `git status`.

---

### Task 1: Create Subsystem Design Structure

**Files:**
- Move: `DOC/CODEX_DOC/02_设计说明/*.md`
- Create: `DOC/CODEX_DOC/02_设计说明/00_总纲/`
- Create: `DOC/CODEX_DOC/02_设计说明/S1_主游戏流程/`
- Create: `DOC/CODEX_DOC/02_设计说明/S2_战斗运行时/`
- Create: `DOC/CODEX_DOC/02_设计说明/S3_关卡地图与编辑器/`
- Create: `DOC/CODEX_DOC/02_设计说明/S4_技能系统与编辑器/`
- Create: `DOC/CODEX_DOC/02_设计说明/S5_Buff系统与编辑器/`
- Create: `DOC/CODEX_DOC/02_设计说明/S6_数据存档与内容契约/`
- Create: `DOC/CODEX_DOC/02_设计说明/S7_UI与交互基线/`

- [x] **Step 1: Move existing design documents into subsystem directories**

Use `git mv` so Git records the reorganization as renames.

- [x] **Step 2: Preserve existing document bodies**

Do not rewrite design content in this task except path references required by the move.

### Task 2: Add Stable Indexes And Governance

**Files:**
- Modify: `DOC/CODEX_DOC/02_设计说明/README.md`
- Create: `DOC/CODEX_DOC/02_设计说明/00_总纲/00-NodeConsoleApp2游戏系统总体设计.md`
- Create: `DOC/CODEX_DOC/02_设计说明/00_总纲/01-设计说明文档治理与粒度规则.md`
- Create: subsystem `README.md` files under `S1` through `S7`
- Modify: `DOC/CODEX_DOC/README.md`

- [x] **Step 1: Rewrite the design README**

Make `02_设计说明/README.md` the stable entry point for the new subsystem structure.

- [x] **Step 2: Add subsystem README files**

Each subsystem README states scope, current documents, and what belongs outside the subsystem.

- [x] **Step 3: Update the formal documentation root**

Refresh the design section description in `DOC/CODEX_DOC/README.md`.

### Task 3: Record Migration And Validate

**Files:**
- Create: `DOC/CODEX_DOC/06_过程文档/06_文档迁移记录/2026-05-21-设计说明子系统化重构记录.md`

- [x] **Step 1: Add migration mapping**

Record old path to new path for all moved design documents.

- [x] **Step 2: Run validation commands**

Run:

```bash
find NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明 -maxdepth 2 -type f -name '*.md' | sort
rg -n "DOC/CODEX_DOC/02_设计说明/[^/]+\\.md|02_设计说明/[0-9][0-9]-" NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明 NodeConsoleApp2/DOC/CODEX_DOC/README.md
git status --short --branch
```

Expected:

- No design documents remain flat directly under `02_设计说明` except `README.md`.
- Current entry docs reference subsystem paths.
- Git status shows only documentation restructure files plus pre-existing unrelated dirty files.
