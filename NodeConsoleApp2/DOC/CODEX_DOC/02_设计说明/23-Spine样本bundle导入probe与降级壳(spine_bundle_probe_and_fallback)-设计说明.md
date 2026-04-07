# Spine样本bundle导入probe与降级壳设计说明

创建时间：2026-04-07

最后整理时间：2026-04-07

状态：`当前有效`

## 1. 目的

本设计用于在主工程侧建立 `C1` 的最小导入接入壳，但不直接接入主战斗流程。

本轮目标是：

1. 让主工程能够读取素材工程正式导出的样本 bundle
2. 把 bundle 导入结果转换为主工程可解释的结构化结果
3. 在主工程侧固定 bundle 缺失、schema 不兼容、单角色缺失、资源缺失时的降级结论
4. 提供一个独立 probe 页用于人工验证导入链

## 2. 本轮范围

### 2.1 本轮必须交付

1. 一个独立的 bundle 导入适配层
2. 一个独立的降级决策层
3. 一个独立的 probe 页面
4. 一套针对导入结果的测试与证据文档

### 2.2 本轮明确不做

1. 不接入 `mock_ui_v11.html`
2. 不修改 `CoreEngine / TimelineManager / DataManagerV2`
3. 不在本轮引入浏览器内 `Spine runtime` 播放
4. 不把 bundle 导入结果接入真实战斗执行链

原因是本轮只验证“主工程能不能按契约消费素材工程产物”，而不是验证“真实战斗里如何播放”。

## 3. 推荐结构

本轮采用三段式结构：

### 3.1 `SpineBundleLoader`

职责：

1. 读取 `bundle_manifest.json`
2. 读取每个 `character_manifest.json`
3. 检查 bundle、角色 manifest 与资源文件是否存在
4. 输出主工程侧可消费的结构化导入结果

限制：

1. 不负责 DOM
2. 不负责展示
3. 不负责降级语义解释

### 3.2 `SpineBundleFallbackPolicy`

职责：

1. 把导入错误分类成主工程可见的失败类型
2. 生成主工程侧的降级结论

本轮至少覆盖：

1. `BUNDLE_NOT_FOUND`
2. `BUNDLE_SCHEMA_UNSUPPORTED`
3. `CHARACTER_MANIFEST_MISSING`
4. `CHARACTER_ASSET_MISSING`

输出结论至少覆盖：

1. `reject_bundle`
2. `fallback_static_character`
3. `fallback_static_all`

### 3.3 `spine_bundle_probe.html`

职责：

1. 显示当前读取来源
2. 显示 bundle 摘要
3. 显示每个角色的导入结果
4. 显示错误分类与降级结论

限制：

1. 不直接承担文件系统遍历
2. 不负责与真实战斗规则联动

## 4. 来源策略

### 4.1 默认来源

probe 默认优先读取兄弟仓库真实样本 bundle：

1. `/home/wgw/CodexProject/NodeConsoleApp2-SpineAssets/workspace/exports/b1_official_samples/`

### 4.2 回退来源

同时保留 fixture 模式：

1. 主工程本地 `test/fixtures/`

### 4.3 页面行为

页面必须明确展示：

1. 当前来源模式
2. 当前实际 bundle 根路径
3. 该路径是否可读

## 5. 为什么 probe 页不直接读取任意本地路径

本轮 probe 页不直接在浏览器里读取任意本地目录，而是通过 Node 侧辅助脚本先生成一份同源报告模块，再由 HTML 页面导入。

原因：

1. 浏览器对本地文件路径读取存在限制
2. 把读取逻辑放在 Node 侧更容易做存在性检查和错误归类
3. 这样可以复用同一份导入适配层做自动测试与页面验证

## 6. Node 侧辅助脚本

建议新增：

1. `tools/build_spine_bundle_probe_report.mjs`

职责：

1. 默认读取兄弟仓库真实 bundle
2. 支持切换到 fixture 模式
3. 生成：
   - `test-results/spine_bundle_probe_report.json`
   - `test-results/spine_bundle_probe_report.mjs`

这样 probe 页只需要导入报告模块，不直接承担文件系统读取职责。

## 7. probe 页展示内容

页面至少展示以下区块：

### 7.1 Bundle Source

显示：

1. 来源模式
2. 根路径
3. `bundle_manifest.json` 是否存在

### 7.2 Bundle Summary

显示：

1. `bundleId`
2. `bundleVersion`
3. `schemaVersion`
4. 角色数
5. 导入整体状态

### 7.3 Characters

每个角色一张卡片，至少显示：

1. `presentationId`
2. `character_manifest` 状态
3. `skeleton / atlas / texturePages`
4. `animations / slots`
5. 当前降级结论

### 7.4 Failure Diagnostics

失败时不只显示异常文本，而要显示结构化错误分类。

### 7.5 Fallback Decision

明确显示主工程应采取的处理方式，例如：

1. `reject_bundle`
2. `fallback_static_all`
3. `fallback_static_character`

## 8. 测试口径

本轮至少要覆盖以下场景：

1. 正常读取 `b1_official_samples`
2. bundle 根路径不存在
3. `schemaVersion` 不兼容
4. 单角色 `character_manifest.json` 缺失
5. 角色资源文件缺失

自动测试应优先覆盖：

1. `SpineBundleLoader`
2. `SpineBundleFallbackPolicy`
3. report builder

## 9. 通过标准

`C1` 当前切片通过应满足：

1. 主工程能从兄弟仓库真实样本 bundle 生成导入报告
2. probe 页面能显示 bundle 摘要、角色结果、错误分类与降级结论
3. 缺 bundle、坏 schema、缺资源时，能输出明确且稳定的结论
4. 不修改主战斗主流程
5. 后续若进入真实接入阶段，可直接复用 `Loader + FallbackPolicy`
