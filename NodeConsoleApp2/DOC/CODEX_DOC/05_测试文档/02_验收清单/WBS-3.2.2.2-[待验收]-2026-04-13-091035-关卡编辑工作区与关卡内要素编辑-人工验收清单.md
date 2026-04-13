# WBS-3.2.2.2 关卡编辑工作区与关卡内要素编辑人工验收清单

状态：`待验收`

对应 WBS：`#105 / WBS-3.2.2.2 关卡编辑工作区与关卡内要素编辑`

## 1. 本清单在验什么

只验证 `#105 / WBS-3.2.2.2`：

1. 正式关卡编辑器是否已经具备稳定页面入口
2. 页面是否明确说明“这是啥工具、为什么点这些按钮、和哪些页面有关”
3. 是否能编辑 `unlockRules / victoryCondition / failureCondition`
4. 是否能编辑波次与敌人池
5. 是否能导出 JSON 产物

## 2. 验收入口

1. 页面入口：
   - `http://127.0.0.1:3101/test/level_editor_v1.html`
2. 计划文档：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/24-WBS-3.2.2.2-关卡编辑工作区与关卡内要素编辑.md`
3. 自测报告：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-13-091035-WBS-3.2.2-关卡编辑器三叶子实现与闭环自测报告.md`

## 3. 为什么这些步骤能证明 #105

`#105` 验的是正式编辑工作区本体。

所以本清单只关心：

1. 页面入口是否存在
2. 页面是否能维护关卡字段真值
3. 导出 JSON 是否反映这些编辑结果

## 4. 人工验收步骤

### 4.1 页面用途与边界说明检查

步骤：

1. 打开 `test/level_editor_v1.html`

观察点：

1. 页头明确写出 `正式关卡编辑器主入口`
2. 页面明确出现：
   - `与其他页面的关系`
   - `导入现有 JSON`
   - `导入 -> 编辑 -> 导出 -> Runtime Override -> Probe`
3. 页头说明中能看到：
   - `level_runtime_probe.html`
   - `level_editor_io_test.html`
   - `mock_ui_v11.html`

### 4.2 解锁与胜败条件编辑检查

步骤：

1. 点击 `重新加载默认关卡包`
2. 保持当前关卡为 `level_1_1`
3. 在 `解锁与胜败条件` 区块设置：
   - `unlockMode = after_levels_cleared`
   - `unlockRequiredLevelIds = level_1_2_story`
   - `victoryCondition.type = survive_rounds`
   - `victoryCondition.value = 5`
   - `failureCondition.type = body_part_broken`
   - `failureCondition.target = head`
4. 点击 `保存当前关卡`
5. 点击 `导出 JSON`

观察点：

1. 页面没有报错
2. 导出 JSON 中 `level_1_1.flow.unlockRules` 为：
   - `mode = after_levels_cleared`
   - `requiredLevelIds = ["level_1_2_story"]`
3. 导出 JSON 中 `battleRules.victoryCondition` 为：
   - `type = survive_rounds`
   - `value = 5`
4. 导出 JSON 中 `battleRules.failureCondition` 为：
   - `type = body_part_broken`
   - `target = head`

### 4.3 波次与敌人池编辑检查

步骤：

1. 在 `当前波次编辑` 区块中修改：
   - `enemyPoolName = 幽暗森林边缘敌人池·人工验收`
   - `敌人池成员` 改为两行：

```text
goblin_story_headhunter@1
enemy_acceptance_guard@2
```

2. 点击 `保存波次与敌人池`
3. 再点击 `导出 JSON`

观察点：

1. `enemyPoolName` 已变化
2. 导出 JSON 中 `pool_story_goblin_edge.members` 为两条成员
3. 第二条成员的 `templateId` 为 `enemy_acceptance_guard`

### 4.4 导入入口与历史入口检查

步骤：

1. 在 `导入 / 导出 / Runtime Override` 区块确认存在：
   - 文件选择框
   - `导入现有 JSON`
   - `查看历史 I/O 页`
2. 点击页头或页内任一 `level_editor_io_test.html` 相关按钮

观察点：

1. 页面确实提供正式导入入口
2. 历史 I/O 页仍可打开，但它被说明为历史对照页，不是正式入口

## 5. 通过标准

以下全部满足才算通过：

1. `level_editor_v1.html` 已具备正式入口说明
2. `unlockRules / victoryCondition / failureCondition` 可编辑并能写入导出 JSON
3. 波次与敌人池编辑可用
4. JSON 导入入口与历史 I/O 页入口都已明确放在正式编辑器中

## 6. 批注区

请只在本文件使用 `【】` 写结论和批注，例如：

1. `【通过】`
2. `【4.2 和 4.3 都正常；4.4 历史 I/O 页关系说明清楚】`
