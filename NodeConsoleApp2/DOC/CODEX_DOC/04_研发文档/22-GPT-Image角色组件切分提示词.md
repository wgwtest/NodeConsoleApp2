# GPT-Image 角色组件切分提示词

创建时间：2026-06-02

适用样例：

`source/character/主角-001-状态001-正常状态.png`

目标：把一张完整角色原画切分成适合 Spine 2D 骨骼动画使用的透明 PNG 组件层。本文优先服务“先验证生产链路”，不是最终美术规范。

## 1. 使用原则

不要一次要求模型拆出所有组件。推荐一轮只生成一个组件：

1. 先拆硬物和边界清楚的部件：弓、箭、箭袋、头发、靴子。
2. 再拆需要补画的身体部件：手臂、躯干、腿、手。
3. 每个输出都要求保持原画画布尺寸和原始像素位置。
4. 其他区域必须完全透明，不能保留黑底。
5. 对需要旋转的肢体，要求在关节处多保留一点重叠绘制区域。

如果模型把组件居中、缩放或重画，应立刻重跑，并加强“保持原始位置”的约束。

## 2. 固定前缀

每次编辑都先粘贴这一段，再追加具体组件说明。

```text
Use the provided archer character image as the exact reference.

Task:
Create a transparent PNG cutout layer for Spine 2D skeletal animation.

Global requirements:
- Preserve the original character design, proportions, colors, lighting, line art, and anime-fantasy style.
- Keep the same canvas size and the same coordinate position as the original image.
- Only the requested component should remain visible.
- All other pixels must be fully transparent.
- The original black background is not part of the component. Remove it completely and make it transparent.
- Do not move, scale, rotate, redraw, simplify, or redesign the component unless explicitly requested.
- Keep clean alpha edges.
- Do not add background, shadow, labels, guide marks, text, UI, or extra objects.
- The result should be suitable as one Spine attachment layer.
```

## 3. 通用负面约束

如果模型容易输出整个人物、黑底、标签或漂移，每次都追加：

```text
Negative requirements:
- Do not generate a full character.
- Do not center the component.
- Do not change the component's pixel position from the source image.
- Do not merge this part with nearby parts.
- Do not crop the joint area.
- Do not add background, black fill, labels, shadows, UI, or text.
- Do not change the character costume design.
- Do not change the camera angle.
```

## 4. 建议组件清单

第一轮验证不需要全拆。建议先验证 4 个：

```text
bow_full
arrow_full
head_face
bow_arm_forearm_hand_viewer_right
```

完整拆分清单：

```text
bow_full
bow_string
arrow_full
quiver
quiver_arrows
head_face
hair_front
hair_back
neck
torso_chest_armor
pelvis_belt_skirt
draw_arm_upper_viewer_left
draw_arm_forearm_hand_viewer_left
bow_arm_upper_viewer_right
bow_arm_forearm_hand_viewer_right
leg_front_upper_viewer_right
leg_front_lower_boot_viewer_right
leg_back_upper_viewer_left
leg_back_lower_boot_viewer_left
shoulder_cape_or_collar
```

命名说明：

- `viewer_left` 表示画面左侧，不一定是角色自身左侧。
- `viewer_right` 表示画面右侧，不一定是角色自身右侧。
- `draw_arm` 表示拉弦手臂。
- `bow_arm` 表示持弓手臂。

## 5. 硬物组件 Prompt

### bow_full

```text
Extract only this component from the reference image:

Component: bow_full

Rules:
- Keep only the full curved wooden bow on the viewer-right side, including the dark grip wraps, gold bands, orange highlights, and both rounded gold tips.
- Remove the bow string, arrow, hand, character, and all background.
- Preserve exact original position and scale on the original canvas.
- All other pixels must be fully transparent.
- Do not repaint or complete hidden areas.
- Output a transparent PNG layer.
```

### bow_string

```text
Extract only this component from the reference image:

Component: bow_string

Rules:
- Keep only the bow string, including the visible diagonal string segments.
- Remove the bow body, arrow, hands, face, hair, clothing, and background.
- Preserve exact original position and scale on the original canvas.
- All other pixels must be fully transparent.
- Keep the string thin, clean, and faithful to the original line.
- Output a transparent PNG layer.
```

### arrow_full

```text
Extract only this component from the reference image:

Component: arrow_full

Rules:
- Keep only the horizontal arrow across the character's face and bow, including the shaft, arrowhead, and any visible tail feather area.
- Remove the hands, bow, string, character body, hair, face, and background.
- Preserve exact original position and scale on the original canvas.
- All other pixels must be fully transparent.
- Do not thicken, shorten, bend, or redesign the arrow.
- Output a transparent PNG layer.
```

### quiver

```text
Extract only this component from the reference image:

Component: quiver

Rules:
- Keep only the rear quiver container behind the character's shoulder and back.
- Remove all arrows, hair, arms, torso, cloak, bow, and background.
- Preserve exact original position and scale on the original canvas.
- Reconstruct small hidden rim areas only if needed for a clean standalone quiver attachment.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### quiver_arrows

```text
Extract only this component from the reference image:

Component: quiver_arrows

Rules:
- Keep only the visible arrow shafts and feather fletchings inside the rear quiver.
- Remove the quiver container, hair, arms, torso, bow, and background.
- Preserve exact original position and scale on the original canvas.
- All other pixels must be fully transparent.
- Keep the feather colors and silhouettes faithful to the source.
- Output a transparent PNG layer.
```

## 6. 头部与头发 Prompt

### head_face

```text
Create a transparent PNG layer for this component:

Component: head_face

Rules:
- Keep only the character's face, ears, visible skin region of the head, eyes, eyebrows, nose, and mouth.
- Do not include front hair bangs, back hair mass, bow string, arrow, armor, neck armor, torso, or background.
- If small parts of the face contour are hidden by hair or the arrow, reconstruct only the minimal clean face contour needed for animation.
- Preserve original position, proportions, expression, colors, and line art.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### hair_front

```text
Create a transparent PNG layer for this component:

Component: hair_front

Rules:
- Keep only the front blonde hair and bangs over the forehead and sides of the face.
- Remove face, eyes, ears, back hair mass, body, arrow, string, bow, and background.
- Preserve the original position, color, highlights, shadows, and line art.
- Include slight overlap where the hair connects behind the forehead for clean layering.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### hair_back

```text
Create a transparent PNG layer for this component:

Component: hair_back

Rules:
- Keep only the large back hair mass behind the head, including the rear blonde hair shape visible behind the face and shoulder.
- Remove face, front bangs, body, quiver, arrows, bow, string, and background.
- Reconstruct small hidden areas only where needed so the hair can sit behind the head as a Spine layer.
- Preserve original position, style, lighting, and color.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### neck

```text
Create a transparent PNG layer for this component:

Component: neck

Rules:
- Keep only the visible neck skin and minimal neck connection area between head and torso.
- Remove head, hair, collar armor, torso, arrow, bowstring, and background.
- Reconstruct a small hidden overlap at the top and bottom so the head and torso can rotate cleanly in Spine.
- Preserve original position and skin tone.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

## 7. 躯干 Prompt

### torso_chest_armor

```text
Create a rig-ready transparent PNG layer for this component:

Component: torso_chest_armor

Rules:
- Keep only the torso, blue chest armor, black shirt area, shoulder armor connection, and upper body clothing.
- Remove head, hair, arms, belt, skirt panels, quiver, arrows, bow, arrow, bowstring, and legs.
- Reconstruct hidden torso edges where arms, straps, or the arrow cover tiny areas, but keep the original costume design.
- Add small overlap at neck, shoulders, and waist for Spine bone rotation.
- Preserve original canvas position, proportions, colors, and line art.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### shoulder_cape_or_collar

```text
Create a transparent PNG layer for this component:

Component: shoulder_cape_or_collar

Rules:
- Keep only the visible shoulder cape, collar, and blue-white shoulder armor pieces around the upper chest.
- Remove head, hair, arms, torso base, belt, bow, arrow, string, and background.
- Preserve exact original position and scale.
- Add slight overlap where this layer connects to the torso.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### pelvis_belt_skirt

```text
Create a transparent PNG layer for this component:

Component: pelvis_belt_skirt

Rules:
- Keep only the waist belt, gold buckle, side pouch, hip cloth, and skirt armor panels around the hips.
- Remove torso, legs, arms, bow, arrow, quiver, string, and background.
- Preserve original position and exact costume design.
- Add small overlap at the waist and upper thighs for Spine layering.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

## 8. 手臂 Prompt

### draw_arm_upper_viewer_left

```text
Create a rig-ready transparent PNG layer for this component:

Component: draw_arm_upper_viewer_left

Rules:
- Keep only the upper arm on the viewer-left side, from shoulder to elbow, belonging to the arm pulling the bowstring.
- Include the visible sleeve/armor segment and skin that belong to this upper arm.
- Remove forearm, hand, arrow, bowstring, torso, hair, quiver, and background.
- Reconstruct any tiny hidden edge needed for a complete upper-arm attachment.
- Add overlap at the shoulder and elbow for Spine rotation.
- Preserve original position, style, lighting, and proportions.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### draw_arm_forearm_hand_viewer_left

```text
Create a rig-ready transparent PNG layer for this component:

Component: draw_arm_forearm_hand_viewer_left

Rules:
- Keep only the bent forearm and hand on the viewer-left side that is pulling the bowstring near the character's face.
- Include the wrist guard and fingers that belong to this hand.
- Remove arrow, bowstring, face, hair, torso, quiver, and background.
- Reconstruct any tiny hidden edge needed for a complete wrist and hand attachment.
- Add overlap at the elbow and wrist for Spine rotation.
- Preserve original position, style, lighting, and proportions.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### bow_arm_upper_viewer_right

```text
Create a rig-ready transparent PNG layer for this component:

Component: bow_arm_upper_viewer_right

Rules:
- Keep only the upper arm on the viewer-right side, from shoulder to elbow, belonging to the extended arm holding the bow.
- Include the visible skin, sleeve, and armor that belong to this upper arm.
- Remove forearm, hand, bow, arrow, string, torso, shoulder cape, and background.
- Reconstruct any tiny hidden edge needed for a complete upper-arm attachment.
- Add overlap at the shoulder and elbow for Spine rotation.
- Preserve original position, style, lighting, and proportions.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### bow_arm_forearm_hand_viewer_right

```text
Create a rig-ready transparent PNG layer for this component:

Component: bow_arm_forearm_hand_viewer_right

Rules:
- Keep only the extended forearm and hand on the viewer-right side holding the bow.
- Include the brown wrist guard, fingers, thumb, palm, and visible skin.
- Remove the bow, arrow, string, torso, shoulder armor, and background.
- Reconstruct the palm area hidden by the bow grip only enough for a clean attachment.
- Add overlap at elbow and wrist for Spine rotation.
- Preserve original canvas position, style, lighting, and proportions.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

## 9. 腿部 Prompt

### leg_front_upper_viewer_right

```text
Create a rig-ready transparent PNG layer for this component:

Component: leg_front_upper_viewer_right

Rules:
- Keep only the upper leg on the viewer-right side, from hip to knee, including the blue trouser segment and knee connection.
- Remove lower leg, boot, skirt, other leg, torso, bow, and background.
- Add overlap at the hip and knee for Spine rotation.
- Preserve original position, shape, color, and line art.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### leg_front_lower_boot_viewer_right

```text
Create a rig-ready transparent PNG layer for this component:

Component: leg_front_lower_boot_viewer_right

Rules:
- Keep only the lower leg and boot on the viewer-right side, including the knee guard if it belongs to this lower leg segment.
- Remove upper leg, skirt, other leg, body, bow, and background.
- Add slight overlap at the knee and ankle for Spine rotation.
- Preserve original position, shape, color, and line art.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### leg_back_upper_viewer_left

```text
Create a rig-ready transparent PNG layer for this component:

Component: leg_back_upper_viewer_left

Rules:
- Keep only the upper leg on the viewer-left side, from hip to knee, including the blue trouser segment and knee connection.
- Remove lower leg, boot, skirt, other leg, torso, bow, and background.
- Add overlap at the hip and knee for Spine rotation.
- Preserve original position, shape, color, and line art.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

### leg_back_lower_boot_viewer_left

```text
Create a rig-ready transparent PNG layer for this component:

Component: leg_back_lower_boot_viewer_left

Rules:
- Keep only the lower leg and boot on the viewer-left side, including the knee guard if it belongs to this lower leg segment.
- Remove upper leg, skirt, other leg, body, bow, and background.
- Add slight overlap at the knee and ankle for Spine rotation.
- Preserve original position, shape, color, and line art.
- All other pixels must be fully transparent.
- Output a transparent PNG layer.
```

## 10. 输出验收标准

每个组件输出后按以下标准判断是否可用：

1. 画布尺寸与原图一致。
2. 组件没有被居中、缩放、旋转或漂移。
3. 除目标组件外，其余区域为透明。
4. 没有残留黑底、阴影、文字、标记或 UI。
5. 硬物组件不被重画变形。
6. 肢体组件在肩、肘、腕、髋、膝、踝处有足够重叠区域。
7. 补画区域不显眼，战斗视角下不会穿帮。
8. 同一角色的所有组件画风、亮度、线条粗细一致。

## 11. 常见失败与修正短句

组件被居中：

```text
Do not center the component. Keep it in the exact same pixel position as in the source image.
```

保留了黑色背景：

```text
The original black background is not part of the component. Remove it completely and make it transparent.
```

输出了整个人物：

```text
Only the requested component should remain visible. Every other body part must be fully transparent.
```

手臂或腿被裁得太短：

```text
Add extra painted overlap at the joint ends so this part can rotate cleanly in Spine.
```

模型重画太多：

```text
Do not redesign or reinterpret the component. Preserve the original pixels and style as much as possible.
```

边缘太脏：

```text
Clean the alpha edge. Remove leftover background pixels and halos around the component.
```

## 12. 第一轮建议操作

第一轮只跑四个组件：

1. `bow_full`
2. `arrow_full`
3. `head_face`
4. `bow_arm_forearm_hand_viewer_right`

如果这四个组件能稳定满足验收标准，再继续拆完整角色。否则先不要扩大范围，优先调整固定前缀和负面约束。
