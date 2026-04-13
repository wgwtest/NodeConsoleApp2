# WBS-3.2.3.3 地图包导入导出与校验人工验收清单

状态：`已通过`【通过】

对应 WBS：`#103 / WBS-3.2.3.3 地图包导入导出与校验`

## 1. 本清单在验什么

只验证 `#103 / WBS-3.2.3.3`：

1. 是否已有独立地图包 IO 校核页
2. 是否把 `JSON + image assets` 方案说清楚
3. 是否提供合法样例与非法样例
4. 是否能执行 round-trip 检查
5. 是否能稳定校验背景图、节点素材图、立绘图引用

## 2. 验收入口

1. 页面入口：
   - `http://127.0.0.1:3101/test/level_map_editor_io_test.html`
2. 共享回归辅助入口：
   - `http://127.0.0.1:3101/test/codex_regression_runner.html?scope=WBS-3.2.3.3`
3. 计划文档：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/22-WBS-3.2.3.3-地图包导入导出与校验.md`
4. 自测报告：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-12-173400-WBS-3.2.3.2-WBS-3.2.3.3-地图资源化整改自测报告.md`

## 3. 为什么这些步骤能证明 #103

`#103` 验的不是地图编辑体验，而是：

1. 地图包是否合法
2. 地图包在导入 / 导出 / round-trip 过程里会不会坏
3. 图片资源引用缺失能不能稳定打出问题码

## 4. 人工验收步骤

### 4.1 页面用途与资源方案检查

步骤：

1. 打开 `test/level_map_editor_io_test.html`

观察点：

1. 页头明确写出 `地图包导入导出与校验`
2. 页面明确写出 `JSON + image assets`
3. 页面存在独立的 `资源承载方案` 区块
4. 页面明确出现：
   - `背景图资源`
   - `节点素材图`
   - `立绘图`
5. 页面能说清它不是地图编辑页

### 4.2 合法样例检查

步骤：

1. 点击 `Load 合法样例`

观察点：

1. 状态栏显示 `合法样例 已完成分析`
2. `问题码 = 0`
3. `背景图资源 / 节点素材图 / 立绘图` 三类资源数量都大于 0
4. 资源承载方案区能看到对应图片路径

### 4.3 非法样例检查

步骤：

1. 点击 `Load 非法样例`

观察点：

1. 状态栏显示 `非法样例 已完成分析`
2. 问题码数量明显大于 0
3. 问题列表中至少出现：
   - `missing_entry_node`
   - `missing_level_ref`
   - `missing_background_ref`
   - `missing_node_ref`
   - `missing_node_art_ref`
   - `missing_portrait_ref`

### 4.4 Round-trip 检查

步骤：

1. 先点击 `Load 合法样例`
2. 再点击 `Run round-trip`

观察点：

1. `前置问题码 = 0`
2. `回读后问题码 = 0`
3. `结构是否稳定 = 是`

## 5. 通过标准

以下全部满足才算通过：

1. 已存在独立地图包 IO 校核页
2. 页面已经把 `JSON + image assets` 方案说清楚
3. 合法样例归零问题码
4. 非法样例稳定报出图片引用缺失与结构断裂问题码
5. round-trip 结果稳定

## 6. 批注区

请只在本文件使用 `【】` 写结论和批注，例如：

1. `【通过】`
2. `【4.2 合法样例资源区清晰；4.3 六类问题码均出现；4.4 round-trip 稳定】`
