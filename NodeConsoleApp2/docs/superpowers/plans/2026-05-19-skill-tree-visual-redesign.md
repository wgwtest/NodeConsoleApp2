# Skill Tree Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved skill tree visual redesign from `DOC/CODEX_DOC/08_原型与附图/2026-05-18-234717-NodeConsoleApp2-技能树视觉优化草图-v1/`.

**Architecture:** Keep `UI_SkillTreeOverlay` as the host and refactor `UI_SkillTreeModal` rendering into a runtime tree layout with top resource bar, route rail, fitted canvas, and right-side decision detail. Runtime filtering stays data-driven through `editorMeta.hiddenInSkillTree`; sample/test nodes are hidden by data, not by UI string matching.

**Tech Stack:** Browser ES modules, vanilla DOM, CSS in `mock_ui_v11.css`, Node test runner, JSDOM.

---

### Task 1: Runtime Tree Semantics

**Files:**
- Modify: `NodeConsoleApp2/script/ui/UI_SkillTreeModal.js`
- Modify: `NodeConsoleApp2/assets/data/skills_melee_v4_5.json`
- Test: `NodeConsoleApp2/test/skill_tree_visual_redesign.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests that mount `UI_SkillTreeModal`, assert test/demo nodes with `hiddenInSkillTree` are absent, the shell contains route rail/canvas/detail regions, selected detail uses Chinese status text and downstream unlock copy, and the first transform is fitted instead of `translate(0px, 0px) scale(1)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill_tree_visual_redesign.test.mjs`
Expected: FAIL because the redesigned regions and fit transform do not exist.

- [ ] **Step 3: Implement semantic shell and data filtering**

Mark runtime-only sample/test nodes in `skills_melee_v4_5.json` with `editorMeta.hiddenInSkillTree: true`. Update `UI_SkillTreeModal` to render topbar, route rail, canvas meta controls, fitted transform, route classes, Chinese status labels, and path-focused details.

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test test/skill_tree_visual_redesign.test.mjs test/skill_legacy_field_retirement.test.mjs test/c_growth_ui_regression.test.mjs`
Expected: PASS.

### Task 2: Approved Visual Styling

**Files:**
- Modify: `NodeConsoleApp2/mock_ui_v11.css`
- Test: `NodeConsoleApp2/test/skill_tree_visual_redesign.test.mjs`

- [ ] **Step 1: Extend failing CSS assertions**

Assert CSS contains redesigned layout classes for the skill tree topbar, route rail, canvas controls, node route variants, and focused path states.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/skill_tree_visual_redesign.test.mjs`
Expected: FAIL until CSS classes exist.

- [ ] **Step 3: Add CSS matching approved prototype**

Replace the old rounded-card skill tree look with the approved dark tactical panel, route rail, fitted canvas, path highlighting, and decision detail styling.

- [ ] **Step 4: Run targeted tests**

Run: `node --test test/skill_tree_visual_redesign.test.mjs test/skill_legacy_field_retirement.test.mjs test/c_growth_ui_regression.test.mjs`
Expected: PASS.

### Task 3: Runtime Screenshot Verification

**Files:**
- Modify only if screenshot exposes layout defects.

- [ ] **Step 1: Start runtime**

Run: `PORT=3122 node app.js`

- [ ] **Step 2: Capture 1920 x 1080 skill tree screenshot**

Use the existing capture script or Chrome headless to open `mock_ui_v11.html`, click `技能树 / 构筑`, and inspect default and selected states.

- [ ] **Step 3: Fix blocking visual defects**

Fix text overflow, clipped core regions, missing nodes, or broken action states before reporting.

- [ ] **Step 4: Final verification**

Run the targeted node tests again and record screenshot paths in the final answer.
