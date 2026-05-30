# NodeConsoleApp2

当前仓库承载的是 `NodeConsoleApp2/` 这一份可运行工程，以及围绕它的 WBS、设计说明、测试文档与交接记录。

如果你是第一次进入仓库，先记住两件事：

1. 实际运行目录是 [`NodeConsoleApp2`](NodeConsoleApp2)
2. 正式本地文档根是 [`NodeConsoleApp2/DOC/CODEX_DOC`](NodeConsoleApp2/DOC/CODEX_DOC)

## 当前版本定位

当前版本是一个可持续推进的战斗竖切与内容工具链候选版，已经具备：

1. `mock_ui_v11.html` 主流程可跑通
2. 技能、Buff、关卡、地图等数据驱动工具链
3. 共享回归页、专项 probe 页与人工验收清单
4. GitHub Issue WBS 树 + 本地 `CODEX_DOC` 协同工作流

当前不把以下内容视为“已经完全交付”：

1. 安装包或分发器
2. Spine 素材制作工程本体
3. 所有遗留验收说明的全面重写

## 快速开始

### 1. 进入运行目录

```bash
cd NodeConsoleApp2
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动本地静态服务

推荐直接使用：

```bash
npm run serve:3101
```

等价命令：

PowerShell：

```powershell
$env:PORT='3101'; node app.js
```

Bash：

```bash
PORT=3101 node app.js
```

### 4. 打开正式入口

1. 主流程入口：
   - `http://127.0.0.1:3101/mock_ui_v11.html`
2. 共享回归入口：
   - `http://127.0.0.1:3101/test/codex_regression_runner.html`
3. 当前人工验收入口：
   - [`NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/00-当前待验收功能总入口.md`](NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/02_验收清单/00-当前待验收功能总入口.md)

## 仓库结构

### 运行工程

- [`NodeConsoleApp2/mock_ui_v11.html`](NodeConsoleApp2/mock_ui_v11.html)
- [`NodeConsoleApp2/test/`](NodeConsoleApp2/test)
- [`NodeConsoleApp2/assets/data/`](NodeConsoleApp2/assets/data)
- [`NodeConsoleApp2/script/`](NodeConsoleApp2/script)

### 本地文档根

- [`NodeConsoleApp2/DOC/CODEX_DOC/README.md`](NodeConsoleApp2/DOC/CODEX_DOC/README.md)
- [`NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/README.md`](NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/README.md)
- [`NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/README.md`](NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/README.md)

## 常用命令

在 `NodeConsoleApp2/` 目录下执行：

```bash
npm run serve:3101
npm run test
npm run test:wbs-3.3.3.1
npm run test:wbs-4.2
npm run test:acceptance-clicks
npm run test:release-docs
```

`npm run test:acceptance-clicks` 需要先启动 `npm run serve:3101`，并启动带 `--remote-debugging-port=9222` 的 Chrome。它会自动点击 `mock_ui_v11.html` 主流程、`battle_presentation_probe.html` 和 `battle_presentation_configurator.html`，用于提供自动验收证据。

## 常见问题

### 页面能打开，但资源 404

通常是因为服务启动目录不对。必须在 `NodeConsoleApp2/` 目录下运行 `node app.js`，不要在仓库外层目录直接启动。

### 页面状态和预期不一致

先确认浏览器里是否残留了 runtime override、本地存档或旧的测试数据。当前工程大量工具页会通过 `localStorage` 写入临时覆盖层。

### 我只想知道当前该看哪些文档

按下面顺序：

1. [`CODEX_DOC README`](NodeConsoleApp2/DOC/CODEX_DOC/README.md)
2. [`03_研制计划/README.md`](NodeConsoleApp2/DOC/CODEX_DOC/03_研制计划/README.md)
3. [`05_测试文档/README.md`](NodeConsoleApp2/DOC/CODEX_DOC/05_测试文档/README.md)
