# Graphify 接入与知识图谱使用说明

最后整理时间：2026-04-12 13:47:59 +0800

状态：`当前有效`

## 1. 目标与边界

`Graphify` 在当前工程中定位为`开发辅助知识图谱层`，用于帮助 Codex 或人工快速理解代码结构、模块关系和社区聚类结果。

它不是游戏运行时的一部分，不参与 `mock_ui_v11.html` 主流程，不影响技能、Buff、关卡、战斗演出等业务功能的执行。

## 2. 当前工程的正式落点

当前工程的 Graphify 接入结果固定如下：

1. 仓库指令入口
   - `AGENTS.md`
2. Codex 提示钩子
   - `.codex/hooks.json`
3. Graphify 忽略规则
   - `.graphifyignore`
4. 项目内稳定命令入口
   - `tools/graphify_ensure_fresh.sh`
   - `tools/graphify_rebuild.sh`
   - `tools/graphify_query.sh`
   - `tools/graphify_open.sh`
5. 本地生成产物目录
   - `graphify-out/`

## 3. 使用规则

### 3.1 什么时候用

优先用于以下场景：

1. 回答“这个工程的核心模块是什么”
2. 回答“某个模块依赖链大致如何”
3. 需要快速定位高连接度文件或社区聚类
4. 进入陌生代码区之前，先建立结构化理解

### 3.3 自动刷新规则

当前工程采用`脏标记 + 按需刷新`，不采用后台常驻监听。

规则如下：

1. `Graphify` 不会在每次文件变化时立即后台重建
2. 当执行 `tools/graphify_query.sh` 或 `tools/graphify_open.sh` 时，会先调用 `tools/graphify_ensure_fresh.sh`
3. `tools/graphify_ensure_fresh.sh` 会检查源码类文件是否比 `graphify-out/graph.json` 更新
4. 若检测到图谱缺失或过期，会写入 `graphify-out/needs_update`
5. 若本次入口允许继续执行，则自动调用 `tools/graphify_rebuild.sh` 完成刷新

这意味着：

1. 不会引入常驻 watcher
2. 不会影响主游戏流程
3. 外部编辑器、手工改文件、其他 CLI 改动也能在下次使用图谱入口时被识别

### 3.2 什么时候不用

以下情况不应把 Graphify 当成唯一依据：

1. 精确行为判断
2. UI 交互细节判断
3. 运行时 bug 定位
4. 人工验收结论

这些场景仍然应回到源码、测试页、运行结果和验收文档。

## 4. 当前工程的标准操作

### 4.1 首次或刷新图谱

在 `NodeConsoleApp2/` 工程根执行：

```bash
./tools/graphify_rebuild.sh
```

成功后会刷新：

1. `graphify-out/GRAPH_REPORT.md`
2. `graphify-out/graph.json`
3. `graphify-out/graph.html`
4. `graphify-out/wiki/index.md`

如需只检查当前图谱是否过期，可执行：

```bash
./tools/graphify_ensure_fresh.sh --status-only
```

### 4.2 本地图谱问答

```bash
./tools/graphify_query.sh "Which files are the core engine modules in this repository?" --budget 1200
```

该命令会在查询前自动检查图谱是否过期，并在需要时自动重建。

### 4.3 阅读顺序

推荐顺序：

1. `graphify-out/GRAPH_REPORT.md`
2. `graphify-out/graph.json`
3. 相关源码文件
4. `DOC/CODEX_DOC/` 内的设计说明与研制计划

### 4.4 浏览器查看

优先使用：

```bash
./tools/graphify_open.sh
```

该命令会先自动检查并刷新图谱，再返回当前最合适的浏览入口。

如果当前工程的静态服务已经启动，脚本会优先返回：

1. `http://127.0.0.1:3000/graphify-out/graph.html`
2. 如果当前服务端口是 `3101`，则打开：
   - `http://127.0.0.1:3101/graphify-out/graph.html`

若未检测到本地静态服务，则会回退为本地文件路径：

1. `graphify-out/graph.html`

推荐阅读顺序：

1. 先看 `graphify-out/graph.html`
2. 再看 `graphify-out/GRAPH_REPORT.md`
3. 如需按社区文档走读，再看 `graphify-out/wiki/index.md`

补充说明：

1. `graph.html` 是当前工程面向人工浏览的主要入口
2. `wiki/index.md` 是 Graphify 生成的 Markdown 社区目录，更适合在编辑器、GitHub 或 AI 工具中继续走读
3. 本地静态服务不会把 `wiki/index.md` 渲染成富文本页面，因此浏览器优先看 `graph.html`

## 5. 当前接入约束

### 5.1 依赖策略

当前工程采用`项目级正式接入，不装自动 Git hooks`的策略。

说明：

1. 允许仓库内的 `.codex/hooks.json` 作为 Codex 提示钩子
2. 不向 `.git/hooks/` 写入自动 Git hooks
3. Graphify 安装在独立 venv 中，不混入游戏运行时依赖

### 5.2 当前语言覆盖

当前已按工程实际代码面补齐最小依赖，覆盖：

1. JavaScript
2. Python

如果后续工程新增大量 TypeScript、Go、Rust 等代码，再按实际语言面扩充对应 `tree-sitter-*` 依赖。

## 6. 产物管理规则

1. `graphify-out/` 属于本地生成物，不属于业务运行时资源
2. 代码理解可以参考 Graphify 产物，但正式设计、计划、验收结论仍以 `DOC/CODEX_DOC/` 为准
3. 如果 `graphify-out/` 缺失，不应阻断业务开发；先按脚本重建即可
4. 如果 Graphify 构建失败，不应把失败误判为游戏功能故障，应分离处理为开发辅助链问题
5. 当前工程面向人工浏览的正式可视化入口是 `graphify-out/graph.html`
6. 当前推荐入口不是直接手点旧产物，而是走 `tools/graphify_query.sh` 或 `tools/graphify_open.sh`，以便自动完成 freshness 检查
