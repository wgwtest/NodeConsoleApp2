# WBS-3.2.2.3 关卡 JSON 导入导出与运行时验证闭环人工验收清单

状态：`待验收`

对应 WBS：`#106 / WBS-3.2.2.3 关卡 JSON 导入导出与运行时验证闭环`

## 1. 本清单在验什么

只验证 `#106 / WBS-3.2.2.3`：

1. 正式编辑器是否能导入、导出并写入 Runtime Override
2. Runtime Probe 是否能在独立运行时里重新读到 override 结果
3. `unlockRules / victoryCondition / failureCondition` 是否也进入了运行时展示证据
4. 清理 override 后是否能回退到默认文件来源

## 2. 验收入口

1. 正式编辑器：
   - `http://127.0.0.1:3101/test/level_editor_v1.html`
2. 运行时 Probe：
   - `http://127.0.0.1:3101/test/level_runtime_probe.html`
3. 历史 I/O 页：
   - `http://127.0.0.1:3101/test/level_editor_io_test.html`
4. 计划文档：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/25-WBS-3.2.2.3-关卡JSON导入导出与运行时验证闭环.md`
5. 自测报告：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-13-091035-WBS-3.2.2-关卡编辑器三叶子实现与闭环自测报告.md`

## 3. 为什么这些步骤能证明 #106

`#106` 验的不是字段编辑本身，而是交付闭环。

所以必须跨两个独立页面验证：

1. 在编辑器里写入 override
2. 在 Probe 页里重新加载运行时
3. 在清理后再次验证回退

只有这样，才能证明消费的是产物，不是编辑页内存。

## 4. 人工验收步骤

### 4.1 编辑器产物写入检查

步骤：

1. 打开 `test/level_editor_v1.html`
2. 点击 `重新加载默认关卡包`
3. 选中 `level_1_1`
4. 设置以下字段：
   - `unlockMode = after_levels_cleared`
   - `unlockRequiredLevelIds = level_1_2_story`
   - `victoryCondition.type = survive_rounds`
   - `victoryCondition.value = 5`
   - `failureCondition.type = body_part_broken`
   - `failureCondition.target = head`
5. 点击 `保存当前关卡`
6. 点击 `导出 JSON`
7. 点击 `应用 Runtime Override`

观察点：

1. `overrideStatus` 出现 `Runtime override active`
2. 导出 JSON 中能看到上面三组字段

### 4.2 独立运行时消费检查

步骤：

1. 打开 `test/level_runtime_probe.html`
2. 点击 `Reload Runtime`

观察点：

1. `Pack Source` 显示为 `override`
2. `Resolved Level Name` 显示当前改动后的关卡名
3. `Unlock Rules` 显示 `after_levels_cleared`
4. `Victory Condition` 显示 `survive_rounds`
5. `Failure Condition` 显示 `body_part_broken`

### 4.3 实例化检查

步骤：

1. 在 Probe 页点击 `Instantiate Probe Level`

观察点：

1. `Instantiated Enemy Names` 变为非空
2. 页面状态不是报错

这说明 override 不是只被展示，而是能驱动运行时实例化。

### 4.4 清理回退检查

步骤：

1. 回到 `level_editor_v1.html`
2. 点击 `清除 Runtime Override`
3. 再回到 Probe 页点击 `Reload Runtime`

观察点：

1. `Pack Source` 回到 `file`
2. `Resolved Level Name` 回到默认关卡名
3. `Unlock Rules` 回到默认展示值

## 5. 通过标准

以下全部满足才算通过：

1. 正式编辑器可以把编辑结果写入 Runtime Override
2. Probe 页可以独立读取 override，而不是依赖编辑页内存
3. `unlockRules / victoryCondition / failureCondition` 都能在 Probe 中被看到
4. 清理后能够回退到默认文件来源

## 6. 批注区

请只在本文件使用 `【】` 写结论和批注，例如：

1. `【通过】`
2. `【4.2 Probe 已读到 override；4.4 清理后已回到 file】`
