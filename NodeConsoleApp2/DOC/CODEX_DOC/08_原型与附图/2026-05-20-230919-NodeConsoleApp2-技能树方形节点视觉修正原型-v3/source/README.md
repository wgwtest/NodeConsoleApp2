# Source Notes

本目录保存 v3 原型截图再生成脚本与实现后运行验收截图脚本。

脚本依赖本机 Chrome 和已启动的 `3122` 端口服务。

`capture-skilltree-square-prototype.mjs` 不修改项目源码。它通过 Chrome DevTools Protocol 打开当前运行页面，固定 `1920 x 1080` 视口，截取当前问题图，然后向页面临时注入 CSS/DOM 状态生成方形节点视觉原型图。

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518/NodeConsoleApp2
node DOC/CODEX_DOC/08_原型与附图/2026-05-20-230919-NodeConsoleApp2-技能树方形节点视觉修正原型-v3/source/capture-skilltree-square-prototype.mjs
```

`capture-skilltree-runtime-verification.mjs` 用于实现后的真实运行态验收，不注入临时视觉样式。它会创建演示玩家状态，打开技能树，输出 `runtime-verification/runtime-skilltree-v3-1920x1080.png` 与指标文件，并校验图片尺寸、节点数量、默认 LOD、节点重叠和技能名遮挡。

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518/NodeConsoleApp2
node DOC/CODEX_DOC/08_原型与附图/2026-05-20-230919-NodeConsoleApp2-技能树方形节点视觉修正原型-v3/source/capture-skilltree-runtime-verification.mjs
```
