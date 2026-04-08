# 2026-04-07 C1 Spine样本bundle导入probe与降级壳自测报告

## 1. 范围

本轮自测对应主工程侧 `C1` 样本 bundle 导入 probe 切片。

目标：

1. 读取兄弟仓库 `/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets` 的正式导出样本 bundle
2. 在主工程侧输出结构化导入报告与降级结论
3. 提供一个不接入主战斗流程的独立 probe 页
4. 确保 probe 页可直接通过 `file://` 打开，不依赖本地静态服务

## 2. 自测环境

1. 主工程目录：`/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2`
2. 素材工程目录：`/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets`
3. 默认样本 bundle：
   - `/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets/workspace/exports/b1_official_samples`
4. 浏览器验收入口：
   - `file:///home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/test/spine_bundle_probe.html`

## 3. 执行记录

### 3.1 Node 侧自动测试

执行命令：

```bash
node --test test/spine_bundle_loader.test.mjs
```

结果：

1. 共 `6` 个子测试全部通过
2. 覆盖了正常样本、bundle 缺失、单角色资源缺失、classic script 产物生成、probe 页入口协议与内联脚本可解析性

### 3.2 真实 bundle 报告生成

执行命令：

```bash
node tools/build_spine_bundle_probe_report.mjs
```

结果：

1. 控制台输出：`PROBE REPORT OK mode=sibling_repo decision=use_bundle`
2. 生成以下产物：
   - `test-results/spine_bundle_probe_report.json`
   - `test-results/spine_bundle_probe_report.mjs`
   - `test-results/spine_bundle_probe_report.js`
3. 报告指向真实 bundle 根路径：
   - `/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets/workspace/exports/b1_official_samples`

### 3.3 浏览器 probe 页验收

执行方式：

1. 打开 `file:///home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/test/spine_bundle_probe.html`

检查结果：

1. 页面能正常加载 `spine_bundle_probe_report.js`
2. 页面能显示 `Bundle Source / Bundle Summary / Characters / Failure Diagnostics / Fallback Decision`
3. 页面显示：
   - `mode = sibling_repo`
   - `bundleId = b1_official_samples`
   - `schemaVersion = spine_bundle_manifest_v1`
   - `characters = 2`
   - `fallback decision = use_bundle`
4. 控制台无报错
5. `file://` 下不再触发 ESM CORS 拦截

### 3.4 截图证据

已生成截图：

1. `test-results/c1_spine_bundle_probe.png`

## 4. 发现与修正

本轮发现一项浏览器侧问题并已修正：

1. 旧方案让 probe 页通过 ES module import `spine_bundle_probe_report.mjs`
2. 浏览器在 `file://` 协议下会拦截该模块请求并报 CORS 错误
3. 现已调整为：
   - Node 侧同时输出 `.json / .mjs / .js`
   - probe 页加载 `spine_bundle_probe_report.js`
   - 页面从 `globalThis.__SPINE_BUNDLE_PROBE_REPORT__` 读取数据

## 5. 已知边界

本轮仍然明确不做：

1. 不接入 `mock_ui_v11.html`
2. 不接入主战斗流程
3. 不引入浏览器端 `Spine runtime`
4. 不做真实战斗中的 `Spine` 播放验证

## 6. 自测结论

1. 主工程已能消费兄弟仓库真实样本 bundle 并生成结构化报告
2. 主工程已具备 `use_bundle / fallback_static_character / fallback_static_all` 降级决策输出能力
3. 独立 probe 页已可直接通过 `file://` 打开并展示完整导入诊断
4. 本轮变更未接入主战斗流程，符合当前切片边界

## 7. 相关证据

1. [C1 设计说明](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/02_设计说明/23-Spine样本bundle导入probe与降级壳(spine_bundle_probe_and_fallback)-设计说明.md)
2. [C1 实施计划](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/04_研发文档/2026-04-07-C1-Spine样本bundle导入probe实施计划.md)
3. [D3.2.1 人工验收清单](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/D3.2.1-[待验收]-2026-04-07-235834-Spine样本bundle导入probe与降级壳-人工验收清单.md)
4. [C1 会话交接记录](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/06_过程文档/01_会话交接/2026-04-07-235834-C1-Spine样本bundle导入probe与降级壳实现与自测记录.md)
