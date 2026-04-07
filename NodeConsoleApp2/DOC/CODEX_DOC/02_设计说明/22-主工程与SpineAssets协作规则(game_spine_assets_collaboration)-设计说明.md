# 主工程与SpineAssets协作规则

创建时间：2026-04-07

最后整理时间：2026-04-07

状态：`当前有效`

## 1. 目的

本说明从 `NodeConsoleApp2` 主工程视角，固定与 `NodeConsoleApp2-SpineAssets` 的协作模式、消费边界和降级规则。

目标不是把 `Spine` 工作流搬进主工程，而是让主工程在消费素材工程正式产物时保持低耦合和可回退。

## 2. 主工程职责

主工程负责：

1. 战斗规则与状态流转
2. 运行时展示事件语义
3. `presentationId` 的业务归属
4. 导入适配层
5. 素材缺失、导入失败、版本不兼容时的降级策略

主工程不负责：

1. `Spine Editor` 源工程
2. Rig 与动画制作
3. 素材导出与 atlas 构建

## 3. 主工程消费什么

主工程只允许消费素材工程的正式导出产物：

1. `bundle_manifest.json`
2. `character_manifest.json`
3. `*.skel|json`
4. `*.atlas`
5. `*.png`

主工程不允许：

1. 直接读取素材工程内部工作目录
2. 直接依赖 `.spine` 源文件

## 4. 运行时边界

### 4.1 可见边界

主工程运行时只能看到：

1. `presentationId`
2. 动画名
3. 槽位名
4. anchor / scale 等展示参数

### 4.2 不可见边界

主工程不应该感知：

1. Rig 内部骨骼结构细节
2. 导出工具链实现
3. 素材制作过程中的临时命名

## 5. 降级规则

这是主工程必须明确拥有的规则：

1. 当 bundle 缺失时，继续使用现有静态展示层
2. 当 schema 不兼容时，拒绝加载该 bundle，并记录可诊断错误
3. 当单角色 manifest 缺失时，只回退该角色，不中断整场战斗主流程
4. 即使 `Spine` 完全不可用，`开始冒险 -> 关卡选择 -> 提交规划 -> 执行 -> 下一回合` 仍必须成立

## 6. 双仓库变更规则

### 6.1 非 breaking change

以下变更可以先在素材工程落地，再由主工程择机跟进：

1. 新增可选动画
2. 新增不会影响旧消费者的可选字段

### 6.2 breaking change

以下变更属于 breaking change：

1. 删除字段
2. 修改字段语义
3. 修改目录结构
4. 改动画名或槽位名
5. 调整必填项

发生 breaking change 时：

1. 主工程必须建立对应 issue
2. 素材工程必须建立对应 issue
3. 两边镜像文档同轮更新
4. 主工程必须写清降级或迁移策略

## 7. 当前协作入口

主工程本地文档入口：

1. `DOC/CODEX_DOC/02_设计说明/21-Spine素材制作工程与导入边界(spine_asset_pipeline)-设计说明.md`
2. `DOC/CODEX_DOC/02_设计说明/22-主工程与SpineAssets协作规则(game_spine_assets_collaboration)-设计说明.md`
3. `DOC/CODEX_DOC/03_研制计划/09-WBS-L3-D3.2-SpineAssets协作规则与导入契约基线.md`

素材工程对口文档入口：

1. `https://github.com/wgwtest/NodeConsoleApp2-SpineAssets/blob/main/DOC/CODEX_DOC/02_%E8%AE%BE%E8%AE%A1%E8%AF%B4%E6%98%8E/03-%E5%8F%8C%E4%BB%93%E5%BA%93%E5%8D%8F%E4%BD%9C%E6%A8%A1%E5%BC%8F%E4%B8%8E%E6%8E%A5%E5%8F%A3%E5%8F%98%E6%9B%B4%E8%A7%84%E5%88%99(cross_repo_collaboration)-%E8%AE%BE%E8%AE%A1%E8%AF%B4%E6%98%8E.md`
2. `https://github.com/wgwtest/NodeConsoleApp2-SpineAssets/blob/main/DOC/CODEX_DOC/02_%E8%AE%BE%E8%AE%A1%E8%AF%B4%E6%98%8E/04-Spine%E5%AF%BC%E5%87%BAbundle%E4%BA%A4%E4%BB%98%E5%A5%91%E7%BA%A6(spine_bundle_delivery)-%E8%AE%BE%E8%AE%A1%E8%AF%B4%E6%98%8E.md`
