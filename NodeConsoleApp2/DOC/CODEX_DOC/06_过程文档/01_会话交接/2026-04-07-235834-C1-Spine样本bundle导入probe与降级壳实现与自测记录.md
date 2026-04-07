# C1 Spine样本bundle导入probe与降级壳实现与自测记录

时间：2026-04-07 23:58:34 +0800

状态：`当前有效`

## 1. 本轮目的

在不接入主战斗流程的前提下，让主工程先具备对 `NodeConsoleApp2-SpineAssets` 正式样本 bundle 的消费探针、失败分类和独立人工验证入口。

## 2. 本轮完成

已完成：

1. 新增 `script/ui/presentation/spine/SpineBundleLoader.mjs`
2. 新增 `script/ui/presentation/spine/SpineBundleFallbackPolicy.mjs`
3. 新增 `tools/build_spine_bundle_probe_report.mjs`
4. 新增 `test/spine_bundle_loader.test.mjs`
5. 新增 `test/spine_bundle_probe.html`
6. 生成以下报告与截图产物：
   - `test-results/spine_bundle_probe_report.json`
   - `test-results/spine_bundle_probe_report.mjs`
   - `test-results/spine_bundle_probe_report.js`
   - `test-results/c1_spine_bundle_probe.png`
7. 新增本轮自测报告与人工验收清单

## 3. 关键实现结论

1. `SpineBundleLoader` 负责读取 `bundle_manifest.json`、`character_manifest.json` 与资产存在性检查
2. `SpineBundleFallbackPolicy` 负责把错误归类为：
   - `use_bundle`
   - `fallback_static_character`
   - `fallback_static_all`
3. `build_spine_bundle_probe_report.mjs` 默认读取兄弟仓库真实样本 bundle，并写出三类产物：
   - `.json`
   - `.mjs`
   - `.js`
4. `test/spine_bundle_probe.html` 当前通过 classic script 读取 `spine_bundle_probe_report.js`

## 4. 本轮遇到的问题

问题：

1. 旧实现让 probe 页通过 ES module import `../test-results/spine_bundle_probe_report.mjs`
2. 浏览器在 `file://` 协议下会因为 CORS 策略拦截该模块

修正：

1. 生成器额外输出 `spine_bundle_probe_report.js`
2. 该文件把报告挂到 `globalThis.__SPINE_BUNDLE_PROBE_REPORT__`
3. probe 页改为 classic script 加载，避免 `file://` 下的 ESM 限制
4. 补了两条回归测试：
   - `spine_bundle_probe.html 使用 file 协议可加载的 classic script 报告入口`
   - `spine_bundle_probe.html 的内联脚本可以被解析`

## 5. 当前可用入口

1. 设计入口：
   - [Spine样本bundle导入probe与降级壳设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/23-Spine样本bundle导入probe与降级壳(spine_bundle_probe_and_fallback)-设计说明.md)
2. 实施计划：
   - [2026-04-07-C1-Spine样本bundle导入probe实施计划](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/04_研发文档/2026-04-07-C1-Spine样本bundle导入probe实施计划.md)
3. 自动测试：
   - `node --test test/spine_bundle_loader.test.mjs`
4. 报告生成：
   - `node tools/build_spine_bundle_probe_report.mjs`
5. 浏览器入口：
   - `file:///home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/test/spine_bundle_probe.html`

## 6. 当前边界

1. 不接入 `mock_ui_v11.html`
2. 不接入真实战斗流程
3. 不引入浏览器端 `Spine runtime`
4. 当前只验证导入契约、报告生成与独立 probe 页

## 7. 下一步建议

如果后续继续推进：

1. 在保留当前 probe 壳的前提下，为 `fixture` 模式补一个稳定本地样本
2. 当素材工程 bundle 契约稳定后，再评估把 `Loader + FallbackPolicy` 接到更上层展示壳
3. 真正接入战斗页前，先明确主工程侧的 `Spine runtime` 选择与资源缓存策略
