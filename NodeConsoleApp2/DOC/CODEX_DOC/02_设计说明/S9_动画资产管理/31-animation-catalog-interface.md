# 动画接口文件与消费端接入说明

创建时间：2026-06-07

状态：`已进入实现`

## 1. 结论

动画集管理器采用“双文件、单真源”的设计：

1. `assets/data/animation_sets_v1.json` 是动画集管理器自身的管理文件，也是唯一真源。
2. `assets/data/animation_catalog_v1.json` 是对外接口文件，由管理器在每次编辑后自动生成。
3. 敌人编辑器、角色编辑器、技能配置和主程序只消费 catalog，不直接读取或依赖管理文件。

这个设计保留文件化配置的优点，同时避免其他模块依赖导入目录、构建状态、删除状态、引用扫描等内部管理字段。

## 2. 文件职责

| 文件 | 写入方 | 读取方 | 职责 |
| --- | --- | --- | --- |
| `animation_sets_v1.json` | 动画集管理器 | 动画集管理器 | 内部台账，记录源目录、构建产物、资源状态、引用关系和编辑属性 |
| `animation_catalog_v1.json` | 动画集管理器自动生成 | 敌人编辑器、角色编辑器、技能配置、主程序、运行时 | 对外接口文件，只暴露可选择、可解析、可播放的动画信息 |

消费端不得写 `animation_catalog_v1.json`。如果需要新增、删除或重建动画，入口必须回到动画集管理器。

## 3. Catalog 数据结构

```json
{
  "schemaVersion": 1,
  "meta": {
    "id": "animation_catalog_v1",
    "name": "Animation Catalog Interface",
    "generatedAt": "2026-06-07T00:00:00.000Z"
  },
  "generatedFrom": {
    "id": "animation_sets_v1",
    "schemaVersion": 1
  },
  "animationSets": [
    {
      "id": "enemy_001_default",
      "ownerType": "enemy",
      "ownerId": "enemy_001",
      "displayName": "敌人001 默认动画集",
      "defaultAnimation": "attack1",
      "status": "ready",
      "clipCount": 1,
      "clips": {
        "attack1": {
          "key": "attack1",
          "sheetRef": "../source/character/enemy_001_attack1/attack1_sheet.png",
          "manifestRef": "../source/character/enemy_001_attack1/attack1_sheet.json",
          "frameWidth": 512,
          "frameHeight": 512,
          "columns": 8,
          "rows": 8,
          "frameCount": 61,
          "fps": 12,
          "loop": true,
          "returnTo": null,
          "scale": 2.1,
          "offset": { "x": 0, "y": 0 },
          "status": "ready"
        }
      }
    }
  ]
}
```

Catalog 只发布 `status === "ready"` 且同时具备 `sheetRef` 和 `manifestRef` 的 clip。`sourceDir`、`references`、构建错误、导入历史不进入 catalog。

## 4. 消费端保存字段

敌人、角色或主程序配置只保存引用：

```json
{
  "presentation": {
    "animationSetRef": "enemy_001_default",
    "defaultAnimation": "idle",
    "actionAnimations": {
      "idle": "idle",
      "attack": "attack1",
      "hit": "hitted",
      "death": "death"
    }
  }
}
```

消费端不保存 `sheetRef`、`manifestRef`、`frameWidth`、`columns`、`sourceDir`。这些数据由 catalog 和 Registry 解析得到。

## 5. Registry 接口

实现位置：

```text
script/editor/animation_set/AnimationSetCatalog.js
```

推荐消费接口：

```js
listAnimationSets({ ownerType, ownerId })
getAnimationSet(animationSetRef)
findAnimationSetsByOwner(ownerType, ownerId)
listClips(animationSetRef)
getDefaultAnimation(animationSetRef)
resolveClip(animationSetRef, animationKey)
validateAnimationRef(animationSetRef, animationKey)
```

使用规则：

1. 选择控件使用 `listAnimationSets()` 和 `listClips()`。
2. 预览控件使用 `resolveClip()`。
3. 保存前使用 `validateAnimationRef()`。
4. 找不到指定动作时，`resolveClip()` 可以降级到默认动作；配置校验仍应提示原始引用缺失。

## 6. 典型展示模块

动画模块可以提供复用展示形态，但这些形态只消费 catalog，不拥有资产管理能力。

| 模块 | 用途 | 可用位置 |
| --- | --- | --- |
| `AnimationSetPicker` | 选择动画集 | 敌人编辑器、角色编辑器 |
| `AnimationClipPicker` | 在某个动画集中选择动作 key | 敌人动作配置、技能配置、角色状态配置 |
| `AnimationPreviewPanel` | 播放 resolved clip | 动画集管理器、敌人编辑器、角色编辑器 |
| `AnimationBindingTable` | 维护事件或状态到动作 key 的映射 | 敌人行为配置、角色状态配置 |

这些模块不提供导入、删除、重建、修改 sourceDir 的入口。需要资产操作时，应跳转或提示去动画集管理器处理。

## 7. 主程序与运行时

主程序和战斗运行时的消费路径：

```text
角色/敌人配置
  -> animationSetRef + animationKey
  -> AnimationSetRegistry.resolveClip()
  -> FighterPresenter 播放 sheet + manifest
```

运行时不扫描 `source/character`，不合成 spritesheet，不读取动画集管理文件。

## 8. 错误与降级

| 场景 | 处理 |
| --- | --- |
| 找不到 `animationSetRef` | 展示静态占位或旧资源 fallback，并在编辑器中报错 |
| 找不到 `animationKey` | 运行时降级到默认动作；编辑器保存前提示缺失 |
| catalog 为空 | 编辑器显示无可用动画；主程序使用静态 fallback |
| sheet 或 manifest 资源 404 | 播放器降级展示，不阻断战斗规则 |

## 9. 设计边界

动画集管理器负责生产和发布动画资产。

接口文件负责对外暴露稳定、干净、只读的数据。

Registry 负责统一读取和解析接口文件。

敌人编辑器、角色编辑器、技能编辑器和主程序只保存引用，并复用选择/预览组件。
