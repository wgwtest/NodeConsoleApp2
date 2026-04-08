# WBS L3：D3.2 SpineAssets协作规则与导入契约基线

## 1. 工作目标

在主工程侧固定 `NodeConsoleApp2` 与 `NodeConsoleApp2-SpineAssets` 的协作规则、消费边界和导入降级策略，为后续战斗展示层接入 `Spine` 做准备。

## 2. 工作内容

1. 建立主工程视角的协作文档
2. 明确主工程只消费正式导出产物
3. 明确 bundle 缺失、schema 不兼容、单角色 manifest 缺失时的降级策略
4. 与素材工程侧同步建立镜像 issue / project 节点

## 3. 潜在难点

1. 双仓库文档容易漂移
2. 主工程已有 DOM 展示层和未来 `Spine` 展示层之间的回退边界必须写清
3. 接口定义过早绑定到实现细节会损害后续并行开发

## 4. Depends On

1. `#70 WBS L2: D3 对战演出与动画展示层`
2. `#71 WBS L3: D3.1 动画展示驱动与验证页基线`

## 5. 成果物

1. `DOC/CODEX_DOC/02_设计说明/22-主工程与SpineAssets协作规则(game_spine_assets_collaboration)-设计说明.md`
2. `DOC/CODEX_DOC/03_研制计划/09-WBS-L3-D3.2-SpineAssets协作规则与导入契约基线.md`

## 6. 验收方法

1. 只读本仓库文档，也能判断主工程消费什么、不消费什么
2. 能明确读到失败降级策略
3. GitHub Issue / Project 中存在与素材工程镜像对应的节点

## 7. 当前状态

1. `已自测`
2. `已验收`

## 8. 上级节点

1. `#70 WBS L2: D3 对战演出与动画展示层`

## 9. 证据链接

1. `DOC/CODEX_DOC/05_测试文档/01_自测报告/2026-04-07-145702-D3.2-SpineAssets协作规则与导入契约基线自测报告.md`
2. `DOC/CODEX_DOC/05_测试文档/02_验收清单/D3.2-[已通过]-2026-04-07-145702-SpineAssets协作规则与导入契约基线-人工验收清单.md`
3. `DOC/CODEX_DOC/06_过程文档/01_会话交接/2026-04-07-145702-D3.2-SpineAssets协作规则与导入契约基线实现与自测记录.md`
