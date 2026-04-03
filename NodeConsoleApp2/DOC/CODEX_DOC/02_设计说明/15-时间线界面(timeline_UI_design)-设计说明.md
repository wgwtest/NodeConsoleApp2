# Timeline UI 设计方案（ATB 风格技能节点）

> 本文仅描述 `timeline labeled-block` 的 UI/交互与渲染数据需求。
> Timeline 的运算/执行内核见：`DOC/CODEX_DOC/02_设计说明/14-时间线机制(timeline_design)-设计说明.md`。

---

## 1. 目标与对标

参考《仙剑奇侠传4》等 ATB 行动条的“直线时间轴 + 节点顺序”的可视化方式。

与传统 ATB（节点代表角色）不同：
- **节点代表技能（skill/action entry）**
- 展示的是“本回合行动序列”的先后顺序

用户价值：玩家在提交规划后即可直观看到“将按什么顺序放哪些技能”，并在推演阶段看到节点逐个被消费。

---

## 2. 整体布局

`timeline labeled-block` 建议结构分为三层：

1) **Header（信息 + 控制）**
- 回合号、阶段（READY/PLAYING/PAUSED/FINISHED/ERROR）
- 播放控制（仅在 `EXECUTION` 阶段开放）：开始/暂停（同一按钮切换） / 单步 / 倍速（1x/2x/4x）
- 特殊控制：直接结算（放在倍速后，用于强调其“非播放参数”的特殊性）

2) **Bar（时间轴轨道 + 节点）**
- 一条横向轨道（track）
- 节点（skill bubbles）按顺序排列在轨道上

3) **Footer（日志/提示，可选）**
- 最近 N 条执行摘要（用于调试与验证）

> 注：如果后续要实现更接近 ATB 的“进度推进”，可以把节点放在轨道上动态移动；但 MVP 建议只做**顺序静态排布 + 当前高亮**。

---

## 3. 节点（Skill Bubble）视觉规范

每个节点表示一个 `TimelineEntry`。

### 3.1 外观
- 形状：**方形圆角气泡**（rounded square）
- 尺寸：相对当前实现缩减为 **0.5 倍**（长宽均减半）
- 内容：
  - 第一行：阵营标识（玩家/敌人）+ 技能名（短）
  - 第二行：可选数据，例如 `速度/状态`
- 图标：
  - 可选在左上角放一个小 icon（若未来有 `iconKey`）
- 锚点：节点底边中心增加一个**等腰三角锚点**，锚点尖端指向时间轴轨道，用于明确“该技能对应的轨道位置”

### 3.4 对齐规则（锚点对齐）
- 节点在视觉上不再以方形中心对齐轨道
- 采用“**三角锚点尖端**”作为几何对齐点
- 对齐基准：锚点尖端与轨道线重合，确保节点位置感知一致

### 3.2 状态色
- `PENDING`：中性紫/蓝边框
- `RUNNING`（当前执行）：高亮（金色描边/发光）
- `DONE`：偏绿色（完成态）
- `ERROR`：红色（失败态）

### 3.3 交互
- Hover：显示 tooltip（技能名/目标/部位等摘要）
- Click：
  - 高亮选中
  - 在 Footer 或侧栏输出该 entry 的详细信息（MVP 可先输出 console + battle log）

---

## 4. 轨道（Track）与节点布局规则

### 4.1 轨道对象抽象（速度标尺轴）

轨道不是纯装饰线，应抽象为“带标尺的速度轴”：

- 轴范围：`[-15, +15]`
- 中心刻度：`0`
- 左侧：负速度区（最小 `-15`）
- 右侧：正速度区（最大 `+15`）

建议渲染元素：
- **单一轴主线（baseline）**：节点锚点与该主线对齐；标尺刻度直接标注在同一条轴线附近（避免出现“两条线/脱节”）
- **刻度位置约束（避免与节点重叠）**：刻度数字应优先放在轴线**下方**（而非上方），从而避免与上方的技能节点/锚点产生遮挡
- 关键刻度：`-15, -10, -5, 0, +5, +10, +15`
- 可选次刻度（每 1 或 2）

### 4.1.1 UI 分层建议（Track 背景层 / Nodes 前景层）

为避免出现“刻度飘、两条线、滚动条意外出现、重绘时需要保留子树”等问题，建议将时间轴控件明确拆分为两层：

- **TrackLayer（背景层）**：负责轴线、渐变轨道、刻度、标尺标签等纯展示元素
- **NodeLayer（前景层）**：只负责渲染技能节点、状态色、高亮与交互

约束：
- baseline 仅由 TrackLayer 负责绘制一次（禁止 Nodes 容器再绘制“第二条线”）
- 刻度与 baseline 必须属于同一坐标系（同一容器/同一相对定位基准），避免视觉“脱节”
- NodeLayer 不应通过 `overflow-x: auto` 的滚动条来“兜底”解决碰撞或超出；超出应由控件自身策略处理（例如压缩、聚合、裁切提示）

说明（对应当前实现中暴露的问题类型）：
- **刻度飘**：当 baseline 用伪元素绘制、刻度用独立 DOM 绘制且 y 基准/padding 没有严格绑定时，即使“只有一条线”，也会出现刻度与线不贴合、随布局变化而漂移
- **横向滚动条离谱**：当节点采用绝对定位且同 speed 横向拍开会把节点推到容器可视区外，`overflow-x: auto` 会触发滚动条，这属于容器行为而非控件语义
- **清空/重绘时的补丁**：把刻度、轴线、节点塞入同一容器会导致每次刷新都需要“保留刻度子树”等维护性补丁；分层后可独立刷新 NodeLayer 而不影响 TrackLayer

### 4.1.2 TrackLayer 轴线渲染实现（Canvas 方案，推荐）

为彻底消除“轴线/刻度/标签因 DOM/CSS 参照系不一致导致的错位”（两条线、刻度飘、padding 影响等），TrackLayer 建议改为使用 `canvas` 绘制速度轴。

目标：
- TrackLayer 提供**单一权威坐标系**：输入 `speed` 输出 `x(px)`，并提供 `axisY(px)` 供 NodeLayer 做锚点对齐。
- NodeLayer 继续使用 DOM 渲染技能节点（便于交互与状态样式），但**不得**再绘制任何“第二条轴线/刻度”。

Canvas 轴线要求：
- 坐标原点在中间，速度区间 `[-15, +15]`
- 轴线在 `timelineTrack` 靠下位置：`axisY = trackHeight * 0.9`（即离底部约 10% 的位置）
- 刻度线全部在轴线下方，数字在刻度线上方
- 关键刻度：`-15, -10, -5, 0, +5, +10, +15`

工程约束（高内聚/低耦合）：
- 新增 1 个独立 UI 渲染器（例如 `script/ui/TimelineAxisRenderer.js`）：
  - 只负责 TrackLayer canvas 绘制与坐标换算（`speedToX()`、`getAxisY()`）
  - 不依赖 `TimelineManager` 内部结构，仅依赖 `speedRange` 与宿主容器尺寸
- `UI_TimelineBlock`：
  - 负责 renderer 生命周期：init / resize / repaint
  - 使用 `speedToX()` 与 `axisY` 定位 NodeLayer 节点（以三角锚点尖端对齐轴线）

### 4.1.3 TrackLayer 工程化模块化设计（TimelineAxisRenderer）

目标：将 TrackLayer 封装成“标准、工程化强”的独立模块（建议命名 `script/ui/TimelineAxisRenderer.js`），提供两项基础能力：

1) **接收参数绘制坐标轴**（TrackLayer 渲染）
2) **接收坐标轴输入，输出可用于 DOM 定位的坐标**（坐标换算服务）

该方案可行，且能从架构上消除“刻度飘 / 两条线 / padding 影响导致错位 / 重绘时需要保留子树”等 UI 问题：绘制与换算必须共享同一套权威几何参数（范围、padding、轴线 y、宽高）。

#### A. 职责边界（强内聚 / 低耦合）

`TimelineAxisRenderer` 只做两件事：

- **Axis Paint（绘制）**：在 `canvas` 上绘制 baseline、ticks、labels。
- **Axis Geometry（几何/坐标换算）**：提供 `speed -> x(px)` 与 `axisY(px)`，用于 NodeLayer 以“锚点尖端”对齐。

明确禁止/不负责：

- 不依赖 `TimelineManager`、不读取 Timeline 可变结构，只接受纯参数。
- 不管理节点 DOM，不处理重叠拍开策略（那属于 NodeLayer 布局器）。
- 不在 NodeLayer 或容器上绘制任何“第二条轴线/刻度”。

#### B. 坐标系定义与“全局 div 位置”的工程化解释

为保证模块可复用与可测试，Renderer 输出的坐标应优先定义为：

- **Host-local 坐标（推荐）**：相对于 `timelineTrack`（宿主容器）的坐标系；该坐标直接用于 NodeLayer 的 `position:absolute`（left/top）。

若业务确实需要“全局/视口坐标”（例如 tooltip、浮层/引导线锚定），建议由上层做一次显式转换：

- 由 `UI_TimelineBlock` 使用 `host.getBoundingClientRect()` 将 host-local 坐标转换为 viewport 坐标。

原因：DOM 全局坐标受滚动、缩放、transform、布局变化影响较大，把这类环境耦合塞进 Renderer 会降低模块稳定性。

约定：

- `speedToX()` 返回 **host-local x(px)**。
- `getAxisY()` 返回 **host-local y(px, top-based)**，即“从宿主容器顶部向下的像素距离”。
- 上层若需要 viewport：`viewport = hostRect + local`。

注意：NodeLayer 若使用 `bottom` 作为定位基准（bottom-based），则必须进行坐标系转换：

- `bottom = hostHeight - axisY`

为避免 top/bottom 混用导致 y 方向翻转（`r` 与 `1-r` 对调），NodeLayer 推荐直接使用 `top` 来定位节点锚点。

#### C. 推荐配置项（输入参数）

- `speedMin/speedMax`：速度区间（默认 `-15..15`）
- `majorTicks`：关键刻度列表（默认 `[-15,-10,-5,0,5,10,15]`）
- `minorTickStep`（可选）：次刻度步长（如 `1` 或 `2`）
- `paddingLeft/paddingRight`：轴线可用绘制区 padding（用于绘制与 `speedToX()` 的共同约束）
- `axisYRatio`：轴线位置比例（默认 `0.9`）
- `theme`（可选）：颜色、字体、线宽等

#### C.1 配置输入方式（推荐：方案 B - 集中 UI 配置模块）

结论：**不建议为 Timeline TrackLayer 单独引入 JSON 配置文件作为首选**；更工程化、可维护的方式是采用“集中 UI 配置模块（JS）”。

原则：

- `TimelineAxisRenderer` 只消费一个纯 `config` 对象（POJO），不负责配置加载。
- `UI_TimelineBlock`（或更高层 UI 组合模块）负责从集中配置模块读取 Timeline 配置并注入 Renderer。
- 配置缺失/非法时：**直接抛错并在 UI 给出明确提示**，禁止 silent fallback（与工程约束：尽量暴露问题一致）。

推荐落地形式：新增一个集中配置文件（命名按工程习惯二选一即可）：

- `script/ui/TimelineUIConfig.js`
- 或 `script/ui/ui_config.js`（包含多个 UI 模块配置，Timeline 作为其中一段）

集中配置模块应导出：

- `timelineAxis`：供 `TimelineAxisRenderer` 使用的轴配置（speedRange、ticks、padding、theme 等）
- （可选）`timelineLayout`：NodeLayer 相关布局参数（节点尺寸、拍开间距、最小间距等），但与 AxisRenderer 保持解耦

示例（概念，不要求当前实现一比一照抄）：

- `export const timelineAxis = { speedMin: -15, speedMax: 15, majorTicks: [-15,-10,-5,0,5,10,15], axisYRatio: 0.9, paddingLeft: 24, paddingRight: 24, theme: {...} }`

采用 JS 模块的工程收益：

- 允许表达派生值与默认值（例如根据 `devicePixelRatio`、主题色、容器尺寸动态生成线宽/字体大小）
- 版本控制友好，变更可代码审查
- 无“配置文件网络加载失败/路径错误”导致 UI 半坏的风险

与 JSON 相比的取舍：

- 若未来确实需要“多套皮肤/非开发调参/热切换”，可以在上层引入 JSON，但不改变 Renderer 接口；JSON 仅作为 `TimelineUIConfig` 的一种来源。

#### D. 推荐 API（最小稳定接口）

建议对外暴露以下方法（命名允许根据现有代码风格调整）：

- `constructor(canvas, config)`
- `setConfig(config)`：更新范围/刻度/padding/theme 等
- `resize(width, height, dpr?)`：宿主容器尺寸变化时调用
- `render()`：重绘轴线（TrackLayer 只重绘 canvas）
- `speedToX(speed)`：将速度映射为 host-local x
- `getAxisY()`：返回 host-local 轴线 y（NodeLayer 三角锚点尖端对齐该 y）
- `getAnchorPoint(speed)`（可选）：返回 `{ x, y }`，等价于 `{ speedToX(speed), getAxisY() }`

#### E. 生命周期与一致性约束（必须遵守）

1) **`resize()` 与 `render()` 必须先于节点布局**

- NodeLayer 计算节点位置前，必须保证 Renderer 的 width/height/padding/axisY 已更新。
- 否则会出现：轴线正确但节点偏移（节点仍用旧宽度映射）。

2) **Canvas 像素尺寸必须与显示尺寸一致（含 DPR）**

- 必须在 `resize()` 中设置 `canvas.width/height`（考虑 `devicePixelRatio`），并同步更新绘制缩放。
- 否则会出现：轴线/刻度模糊或坐标换算与视觉不一致。

3) **绘制与换算共享同一套几何参数**

- `paddingLeft/paddingRight`、`axisYRatio`、`speedMin/speedMax` 必须同时作用于绘制和 `speedToX()`。

#### F. 与 NodeLayer 的对接要点（锚点对齐）

- NodeLayer 节点使用“**三角锚点尖端**”作为几何对齐点。
- 对齐规则：锚点尖端 `y == getAxisY()`，锚点尖端 `x == speedToX(speed)`。

实现提示：若节点使用伪元素 `::after` 绘制三角锚点，且锚点高度为 `anchorH`，则节点容器（方形气泡）定位可按：

- `nodeTop = axisY - (nodeHeight + anchorH)`

从而保证三角尖端落在 `axisY`。

建议 NodeLayer 仅持有 Renderer 的只读输出（`speedToX/getAxisY`），禁止自行定义轴线 y 或重复实现映射公式。

### 4.2 运行与展示解耦（核心规则）

- **运行层**：保持离散固定频率（例如每 `0.3s/action`）
- **展示层**：节点位置按技能 `speed` 映射到速度轴，而不是简单按 index 均匀排布

即：执行顺序与播放节奏仍离散稳定；视觉位置表达“速度语义”。

### 4.3 速度映射公式（建议）

设轨道像素区间为 `[xMin, xMax]`，速度 `v ∈ [-15, 15]`：

`x = xMin + ((clamp(v, -15, 15) + 15) / 30) * (xMax - xMin)`

节点锚点尖端落在 `x` 位置。

### 4.4 重叠处理规则（速度优先 + 顺序拍开）

当两个或多个节点映射后发生重叠：

1) 基础定位始终按速度映射
2) 若检测到碰撞：
   - **同 speed（或映射到同一 x）**：按执行顺序在水平方向依次错开（横向拍开），保持“先后顺序可读”
   - **不同 speed 但仍重叠**：仍以速度位置为主，按执行顺序做最小水平错开，尽量不改变速度语义
3) 若无重叠，不做拍开，保持纯速度位置

说明：该策略满足“无重叠时按速度分布；重叠时按顺序可读”。

---

## 5. UI 与引擎的数据契约

UI 不直接读取 Engine 可变结构；只消费快照：
- `TimelineSnapshot.phase`
- `TimelineSnapshot.roundId`
- `TimelineSnapshot.currentIndex`
- `TimelineSnapshot.entries[]`（用于渲染节点）

建议 `entries` 里 UI 需要的字段：
- `entryId`
- `side`
- `skillId`
- `meta.label`（展示用标题）
- `meta.speed`（可选展示）
- `executionState`

事件驱动刷新：
- `TIMELINE_SNAPSHOT`
- `TIMELINE_ENTRY_START/END`
- `TIMELINE_READY/START/PAUSE/FINISHED/ERROR`

---

## 6. 与当前实现的对齐建议（工程侧）

当前已有：
- `script/ui/UI_TimelineBlock.js`：订阅事件并渲染列表

为了达到 ATB 风格，需要把渲染从“卡片列表”升级为：
- `timeline-list` 作为轨道容器
- `timeline-item` 按“气泡节点”风格渲染（正方形圆角）
- current/done/error 状态对应样式

实现建议：
- 保持 `UI_TimelineBlock` 的事件绑定不变
- 只改其 DOM 结构与 CSS（不影响 TimelineManager 内核）

---

## 7. 开放项

- 是否在节点上显示“目标部位/目标对象”？（信息密度 vs 清晰度）
- 节点过多时采用滚动还是压缩（缩小节点/折叠）
- 是否允许点击节点跳转播放指针（需要 Timeline 支持 seek）

---

## 8. 阶段注意力机制对接（与主界面联动）

为避免 Timeline 在非执行阶段造成视觉干扰，Timeline UI 与主界面采用统一阶段驱动：

1. 页面根状态：`body[data-ui-phase]`
   - `planning`：Timeline 视觉弱化，仅保留“预览可见”。
   - `execution`：Timeline 视觉强化，控制区高亮，作为当前主交互区。

2. 控制区可交互约束：
   - 继续保持“播放控制仅在 `EXECUTION` 开放”的规则。
   - 视觉高亮只做提示，不替代状态机校验。

3. 工程实现约束：
   - 由独立模块统一写入 `data-ui-phase`，Timeline 仅消费该状态。
   - 禁止 Timeline 自行推断主流程阶段，避免与主状态机耦合。

