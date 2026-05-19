# 测试文档 README

最后整理时间：2026-04-14

状态：`当前有效`

## 1. 目录用途

`05_测试文档/` 是当前工程的正式测试证据根。

这里不只放“测试结果”，还负责固定：

1. 正式主流程入口
2. 共享回归入口
3. 人工验收入口
4. 自测报告、验收记录和最终结论的物理落点

## 2. 当前正式入口分层

### 2.1 正式主流程入口

1. [`mock_ui_v11.html`](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/mock_ui_v11.html)
2. 用途：
   - 真实游玩主流程
   - 主界面与模态页的人机可理解性验证
   - 运行时链路是否被工具页 override 破坏的烟测

### 2.2 共享回归入口

1. [`test/codex_regression_runner.html`](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/test/codex_regression_runner.html)
2. 用途：
   - 共享自动断言
   - 按 `scope=` 过滤当前节点范围
   - 不替代人工验收，只提供自动回归证据
3. 自动点击验收命令：
   - `npm run test:acceptance-clicks`
   - 前置条件：`npm run serve:3101` 已启动，Chrome remote debugging 监听 `http://127.0.0.1:9222`
   - 覆盖：`mock_ui_v11.html` 主流程、`battle_presentation_probe.html` 展示层按钮、`battle_presentation_configurator.html` workspace / JSON 往返
   - 结论口径：只作为自动点击验收证据，不等同于用户在清单内逐条写入 `【通过】`

### 2.3 人工验收入口

1. [`02_验收清单/00-当前待验收功能总入口.md`](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/00-当前待验收功能总入口.md)
2. 用途：
   - 当前唯一正式人工验收主入口
   - 只列 `待验收 / 待重测` 节点
   - 与活跃人工验收清单一一对应

## 3. 物理目录说明

1. `01_自测报告/`
   - Codex 自测证据
2. `02_验收清单/`
   - 节点级人工验收清单与待验收总入口
3. `03_验收记录/`
   - 线下或历史验收记录
4. `04_验收结论/`
   - 候选版或阶段性结论汇总

## 4. 当前协作规则

1. 当用户说“我要验收”时，先刷新 [`00-当前待验收功能总入口.md`](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/00-当前待验收功能总入口.md)，再把路径给用户。
2. 人工结论默认只以用户写在 `【】` 内的批注为准。
3. 已通过节点不得继续停留在当前待验收入口里。
4. 专项 probe / I/O 页若要进入人工验收路径，必须先把“页面用途、按钮原因、与主流程的关系”写清楚。

## 5. 推荐阅读顺序

1. [`02_验收清单/README.md`](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/README.md)
2. 当前最新自测报告
3. [`04_验收结论/README.md`](/home/wgw/CodexProject/NodeConsoleApp2/NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/04_验收结论/README.md)
