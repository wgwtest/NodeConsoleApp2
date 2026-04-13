# WBS-3.2.2.1 关卡工作区数据核心与字段级校验人工验收清单

状态：`待验收`

对应 WBS：`#104 / WBS-3.2.2.1 关卡工作区数据核心与字段级校验`

## 1. 本清单在验什么

只验证 `#104 / WBS-3.2.2.1`：

1. 关卡工作区是否补齐 `unlockRules / victoryCondition / failureCondition` 默认字段
2. 工作区是否能稳定报告坏引用、坏奖励值、坏胜败条件
3. 非法样例文件是否可作为稳定校验样本

## 2. 验收入口

1. 页面入口：
   - `http://127.0.0.1:3101/test/level_editor_v1.html`
2. 非法样例文件：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/assets/data/levels.invalid.example.json`
3. 计划文档：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/23-WBS-3.2.2.1-关卡工作区数据核心与字段级校验.md`
4. 自测报告：
   - `/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-13-091035-WBS-3.2.2-关卡编辑器三叶子实现与闭环自测报告.md`

## 3. 为什么这些步骤能证明 #104

`#104` 验的不是正式编辑器排版，也不是运行时 Override。

它只验证：

1. 数据核心是否补齐标准默认值
2. 字段级校验是否真的存在
3. 非法样例是否能稳定触发关键 issue code

## 4. 人工验收步骤

### 4.1 非法样例导入

步骤：

1. 打开 `test/level_editor_v1.html`
2. 在页面下方 `导入现有 JSON` 区块里选择文件：
   - `assets/data/levels.invalid.example.json`
3. 点击 `导入现有 JSON`

观察点：

1. 关卡列表出现 `level_invalid_1`
2. 页面没有崩溃
3. `结构校验` 面板立即出现多条错误

### 4.2 字段级校验结果检查

观察 `结构校验` 面板，确认至少出现以下错误语义：

1. `unlockRules` 引用了不存在的前置关卡
2. `victoryCondition` 配置无效
3. `failureCondition` 配置无效
4. 奖励字段 `kp` 非法
5. 缺失下一关引用
6. 缺失敌人池引用

### 4.3 默认字段回填检查

步骤：

1. 点击 `重新加载默认关卡包`
2. 选中 `level_1_2_story` 或任意未显式声明这些字段的关卡

观察点：

1. `unlockMode` 显示为 `always`
2. `victoryCondition.type` 显示为 `defeat_all_enemies`
3. `failureCondition.type` 显示为 `player_hp_zero`

这说明默认值来自工作区真值，而不是页面自己猜测。

## 5. 通过标准

以下全部满足才算通过：

1. 非法样例能被正式编辑器导入
2. 结构校验面板能稳定给出 6 类关键错误
3. 默认关卡能自动回填 `unlockRules / victoryCondition / failureCondition` 默认值
4. 当前结果表明字段级约束属于工作区数据核心，而不是 UI 临时逻辑

## 6. 批注区

请只在本文件使用 `【】` 写结论和批注，例如：

1. `【通过】`
2. `【4.2 六类错误都能看到；4.3 默认值回填正常】`
