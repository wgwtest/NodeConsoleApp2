# C1 Spine Bundle Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a main-project-side probe that imports the `B1` sample bundle from the SpineAssets repository, classifies failures, and renders a standalone diagnostic page without touching the live battle flow.

**Architecture:** Split the work into a pure bundle loader, a pure fallback policy, a Node-side report builder, and a standalone HTML probe page. Keep all filesystem reads inside Node tooling, emit a generated report module into `test-results/`, and let the probe page render from that report so the browser never has to read arbitrary local directories directly.

**Tech Stack:** Node.js ESM, `node:test`, static HTML, filesystem tooling, existing `test-results/` probe pattern

---

### Task 1: Add red tests for loader, fallback policy, and report builder

**Files:**
- Create: `test/spine_bundle_loader.test.mjs`
- Create: `script/ui/presentation/spine/SpineBundleLoader.mjs`
- Create: `script/ui/presentation/spine/SpineBundleFallbackPolicy.mjs`
- Create: `tools/build_spine_bundle_probe_report.mjs`

- [ ] **Step 1: Write the failing test for a valid sample bundle**

```js
test('loadSpineBundleReport 正常读取 b1_official_samples 并输出角色摘要', async () => {
  const report = await buildSpineBundleProbeReport({ bundleRoot });
  assert.equal(report.bundle.ok, true);
  assert.equal(report.bundle.bundleId, 'b1_official_samples');
  assert.equal(report.characters.length, 2);
});
```

- [ ] **Step 2: Add failing negative tests**

```js
test('bundle 缺失时输出 reject_bundle', async () => {
  const report = await buildSpineBundleProbeReport({ bundleRoot: missingRoot });
  assert.equal(report.bundle.ok, false);
  assert.equal(report.fallback.decision, 'fallback_static_all');
});

test('单角色资源缺失时只让该角色回退', async () => {
  const report = await buildSpineBundleProbeReport({ bundleRoot: brokenRoot });
  assert.equal(report.characters.find(x => x.presentationId === 'raptor').fallback.decision, 'fallback_static_character');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test test/spine_bundle_loader.test.mjs`
Expected: FAIL with missing loader or report builder module

- [ ] **Step 4: Commit**

```bash
git add test/spine_bundle_loader.test.mjs script/ui/presentation/spine/SpineBundleLoader.mjs script/ui/presentation/spine/SpineBundleFallbackPolicy.mjs tools/build_spine_bundle_probe_report.mjs
git commit -m "test: add C1 spine bundle probe red tests"
```

### Task 2: Implement the bundle loader and fallback policy

**Files:**
- Modify: `script/ui/presentation/spine/SpineBundleLoader.mjs`
- Modify: `script/ui/presentation/spine/SpineBundleFallbackPolicy.mjs`
- Modify: `test/spine_bundle_loader.test.mjs`

- [ ] **Step 1: Implement loader shape**

```js
export async function loadSpineBundle(bundleRoot) {
  return {
    bundle: { ok: false, errors: [] },
    characters: []
  };
}
```

- [ ] **Step 2: Implement fallback classification**

```js
export function classifyBundleFallback({ bundleErrors = [], characterErrors = [] }) {
  if (bundleErrors.length > 0) {
    return { decision: 'fallback_static_all', reason: bundleErrors[0].code };
  }
  if (characterErrors.length > 0) {
    return { decision: 'fallback_static_character', reason: characterErrors[0].code };
  }
  return { decision: 'use_bundle', reason: 'OK' };
}
```

- [ ] **Step 3: Run targeted test**

Run: `node --test test/spine_bundle_loader.test.mjs`
Expected: FAIL on missing report-builder output details, not missing loader basics

- [ ] **Step 4: Commit**

```bash
git add script/ui/presentation/spine/SpineBundleLoader.mjs script/ui/presentation/spine/SpineBundleFallbackPolicy.mjs test/spine_bundle_loader.test.mjs
git commit -m "feat: add C1 spine bundle loader and fallback policy"
```

### Task 3: Build the report-generator CLI and generated module

**Files:**
- Modify: `tools/build_spine_bundle_probe_report.mjs`
- Modify: `test/spine_bundle_loader.test.mjs`
- Create: `test-results/spine_bundle_probe_report.json`
- Create: `test-results/spine_bundle_probe_report.mjs`

- [ ] **Step 1: Extend tests for generated report files**

```js
assert.equal(await exists(path.join(outputRoot, 'spine_bundle_probe_report.json')), true);
assert.equal(await exists(path.join(outputRoot, 'spine_bundle_probe_report.mjs')), true);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/spine_bundle_loader.test.mjs`
Expected: FAIL on missing output file generation

- [ ] **Step 3: Implement the report builder**

```js
export async function buildSpineBundleProbeReport({ bundleRoot, outputRoot }) {
  const loaded = await loadSpineBundle(bundleRoot);
  const report = {
    generatedAt: new Date().toISOString(),
    source: { mode: 'sibling_repo', bundleRoot },
    bundle: loaded.bundle,
    characters: loaded.characters,
    fallback: classifyBundleFallback(loaded)
  };
}
```

- [ ] **Step 4: Write both JSON and ESM outputs**

```js
await fs.writeFile(jsonFile, JSON.stringify(report, null, 2), 'utf8');
await fs.writeFile(moduleFile, `export const probeReport = ${JSON.stringify(report, null, 2)};\n`, 'utf8');
```

- [ ] **Step 5: Run targeted test**

Run: `node --test test/spine_bundle_loader.test.mjs`
Expected: PASS all loader and report-builder tests

- [ ] **Step 6: Commit**

```bash
git add tools/build_spine_bundle_probe_report.mjs test/spine_bundle_loader.test.mjs test-results/spine_bundle_probe_report.json test-results/spine_bundle_probe_report.mjs
git commit -m "feat: generate C1 spine bundle probe report"
```

### Task 4: Build the standalone probe page

**Files:**
- Create: `test/spine_bundle_probe.html`
- Modify: `test-results/spine_bundle_probe_report.mjs`

- [ ] **Step 1: Add a simple smoke assertion using the generated module**

```js
import { probeReport } from '../test-results/spine_bundle_probe_report.mjs';
assert.equal(probeReport.bundle.bundleId, 'b1_official_samples');
```

- [ ] **Step 2: Implement the HTML page**

```html
<script type="module">
  import { probeReport } from '../test-results/spine_bundle_probe_report.mjs';
</script>
```

- [ ] **Step 3: Render required sections**

```html
<section data-block="bundle-source"></section>
<section data-block="bundle-summary"></section>
<section data-block="characters"></section>
<section data-block="fallback"></section>
```

- [ ] **Step 4: Run the report build and manually open the page**

Run:
- `node tools/build_spine_bundle_probe_report.mjs`
- open `test/spine_bundle_probe.html`

Expected: Page shows source path, bundle summary, 2 character cards, and fallback decision

- [ ] **Step 5: Commit**

```bash
git add test/spine_bundle_probe.html
git commit -m "feat: add C1 spine bundle probe page"
```

### Task 5: Final verification and evidence docs

**Files:**
- Modify: `DOC/CODEX_DOC/03_研制计划/README.md`
- Create: `DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-07-C1-Spine样本bundle导入probe-自测报告.md`
- Create: `DOC/CODEX_DOC/05_测试文档/02_验收清单/C1-Spine样本bundle导入probe-[待验收]-2026-04-07-人工验收清单.md`
- Create: `DOC/CODEX_DOC/06_过程文档/01_会话交接/2026-04-07-C1-Spine样本bundle导入probe实现与自测记录.md`

- [ ] **Step 1: Run verification commands**

Run:
- `node --test test/spine_bundle_loader.test.mjs`
- `node tools/build_spine_bundle_probe_report.mjs`

Expected: PASS and generated report files under `test-results/`

- [ ] **Step 2: Capture a probe screenshot**

Run: open `test/spine_bundle_probe.html` and save screenshot to `test-results/c1_spine_bundle_probe.png`
Expected: Screenshot clearly shows source path, bundle summary, character cards, fallback decision

- [ ] **Step 3: Write evidence docs with actual paths and outputs**

```md
1. 读取兄弟仓库真实 bundle
2. 生成 `test-results/spine_bundle_probe_report.json`
3. 生成 `test-results/spine_bundle_probe_report.mjs`
4. probe 页面展示 bundle 与降级结论
```

- [ ] **Step 4: Final workspace check**

Run:
- `git status --short`
- `find test-results -maxdepth 1 | sort | rg 'spine_bundle_probe'`

Expected: Only intended C1 files changed; generated probe artifacts present

- [ ] **Step 5: Commit**

```bash
git add DOC/CODEX_DOC/03_研制计划/README.md DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-07-C1-Spine样本bundle导入probe-自测报告.md DOC/CODEX_DOC/05_测试文档/02_验收清单/C1-Spine样本bundle导入probe-[待验收]-2026-04-07-人工验收清单.md DOC/CODEX_DOC/06_过程文档/01_会话交接/2026-04-07-C1-Spine样本bundle导入probe实现与自测记录.md test-results/spine_bundle_probe_report.json test-results/spine_bundle_probe_report.mjs test-results/c1_spine_bundle_probe.png
git commit -m "feat: add C1 spine bundle probe"
```
