# 敌人原画资产管理

这个目录存放战斗展示和编辑器使用的角色完整原画。敌人编辑器的「原画资产」下拉读取的是完整立绘字段 `presentation.battleSpriteRef`，不要用地图头像替代。

## 命名规则

敌人原画使用稳定中文名和三位数字编号：

```text
敌人-001-状态001-正常状态.png
敌人-002-状态001-正常状态.png
敌人-003-状态001-正常状态.png
```

规则：

- `敌人-XXX` 表示敌人角色族，`XXX` 从 `001` 起递增。
- `状态YYY` 表示同一个敌人的状态或变体。
- 默认完整原画固定使用 `状态001-正常状态`。
- 同一敌人的破盾、受伤、卸甲等变体继续使用同一 `敌人-XXX` 编号，例如 `敌人-001-状态002-丢失盾牌.png`。
- 不要把 `女性长枪骑士_透明_1021x1062.png` 这类生成草稿名提交为运行时资产。

## 画布与比例

新增敌人默认完整原画采用：

```text
画布尺寸：1021x1062 px
文件格式：PNG
颜色模式：RGBA
背景：透明
```

比例参考 `敌人-001-状态001-正常状态.png`。标准目标：

```text
可见角色高度：约 800-900 px
脚底基线：接近 y=1018
水平位置：默认居中，武器或盾牌很宽时优先保证不裁切
```

宽盾、长枪等横向轮廓可以低于 800px 可见高度，但整体视觉重量要接近基准角色，不要让角色缩在画布中央。

## 归一化流程

新增 AI 生成或外部导入的敌人原画时：

1. 先保留原始输出，确认没有背景。
2. 转为 PNG + RGBA 透明底。
3. 按 alpha 通道找非透明边界框。
4. 裁掉透明空白，只保留角色内容。
5. 将角色缩放到 `1021x1062` 透明画布内。
6. 归一化内容框建议最大约 `980x860`。
7. 脚底或主要站立基线对齐到 `y=1018` 左右。
8. 保存为 `敌人-XXX-状态001-正常状态.png`。
9. 在 `script/editor/enemy/EnemyWorkspace.js` 的 `BUILT_IN_CHARACTER_SPRITES` 中登记。
10. 打开 `test/enemy_editor_v1.html`，确认「原画资产」下拉能选择，并且预览展示完整角色比例。

这一步追求的是游戏内视觉重量一致，不是让每张图像素高度完全相同。

## 当前敌人原画

```text
敌人-001-状态001-正常状态.png  # 基准剑盾敌人
敌人-001-状态002-丢失盾牌.png
敌人-001-状态003-盾牌破损.png
敌人-002-状态001-正常状态.png  # 双刀斥候
敌人-003-状态001-正常状态.png  # 重盾守卫
敌人-004-状态001-正常状态.png  # 长枪骑士
敌人-005-状态001-正常状态.png  # 破盾老兵
```

## 编辑器字段

敌人完整原画写入：

```json
{
  "presentation": {
    "battleSpriteRef": "../source/character/敌人-002-状态001-正常状态.png"
  }
}
```

字段约定：

- `battleSpriteRef`：完整角色原画，供战斗展示和敌人编辑器原画预览使用。
- `portraitRef`：头像或概览图，不用于完整原画预览。
- `mapPortraitRef`：地图编辑器节点头像，不用于完整原画预览。
- `iconRef`：小图标，不用于完整原画预览。

## 快速检查

在 `NodeConsoleApp2` 项目目录下运行：

```bash
python3 - <<'PY'
from pathlib import Path
from PIL import Image

for path in sorted(Path('source/character').glob('敌人-*.png')):
    image = Image.open(path).convert('RGBA')
    bbox = image.getchannel('A').getbbox()
    visible = None if bbox is None else (bbox[2] - bbox[0], bbox[3] - bbox[1])
    print(path.name, image.size, bbox, visible)
PY
```

新增默认原画应优先保持 `1021x1062` 画布。若可见高度明显低于 800px，需要重新裁剪和放大；若武器或盾牌过宽，则以不裁切轮廓为优先。
