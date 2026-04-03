# 08 阶段A A4 内容工具链 Issue Tree 迁移记录

最后整理时间：2026-03-28

状态：`归档`

## 1. 迁移目的

把此前只存在于本地计划文档中的“阶段 A 内容契约与作者工具链并行启动线”，正式迁入 GitHub issue tree，避免计划真源与执行真源分离。

## 2. 本轮新增节点

1. `#49 WBS L2: A4 内容契约与作者工具链启动`
2. `#50 WBS L3: A4.1 技能编辑契约与编辑链启动`
3. `#51 WBS L3: A4.2 Buff 编辑契约与编辑链启动`
4. `#52 WBS L3: A4.3 关卡编辑契约与编辑链启动`

## 3. 树关系

本轮迁移后，阶段 A 的真实树补充为：

1. `#14 -> #49`
2. `#49 -> #50`
3. `#49 -> #51`
4. `#49 -> #52`

## 4. 治理字段

四个节点均补齐或固化了以下最小治理字段：

1. `Owner`
2. `Write Scope`
3. `Depends On`

标签策略：

1. `phase:A`
2. `gate:M1`
3. `planning`
4. `work:package` 或 `work:task`

## 5. Project 同步结果

GitHub Project `1` 中已同步：

1. `#49`
   - `Status = In Progress`
   - `Phase = A`
   - `Contributes To = M1`
   - `Work Type = Package`
   - `Start Date = 2026-03-28`
   - `Target Date = 2026-04-03`
2. `#50`
   - `Status = In Progress`
   - `Phase = A`
   - `Contributes To = M1`
   - `Work Type = Task`
   - `Start Date = 2026-03-28`
   - `Target Date = 2026-03-31`
3. `#51`
   - `Status = In Progress`
   - `Phase = A`
   - `Contributes To = M1`
   - `Work Type = Task`
   - `Start Date = 2026-03-28`
   - `Target Date = 2026-03-31`
4. `#52`
   - `Status = In Progress`
   - `Phase = A`
   - `Contributes To = M1`
   - `Work Type = Task`
   - `Start Date = 2026-03-28`
   - `Target Date = 2026-04-01`

## 6. 关键结论

1. 阶段 A 现在不仅有战斗主线，也有正式入树的内容工具链共享包
2. 技能、Buff、关卡三条编辑链可以在阶段 A 内按并行 `Prep` 推进
3. 三条线的共同上游是内容契约层，不应彼此直接耦合
4. 运行时只消费配置产物，不反向绑定编辑器页面实现
5. 阶段 C 继续承接其产品化与内容生产闭环
