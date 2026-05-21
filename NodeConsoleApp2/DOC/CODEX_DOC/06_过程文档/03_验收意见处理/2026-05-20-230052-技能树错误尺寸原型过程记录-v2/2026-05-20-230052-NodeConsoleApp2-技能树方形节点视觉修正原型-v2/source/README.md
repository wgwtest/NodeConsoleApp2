# Source Notes

本目录保存 v2 原型截图的再生成脚本。

脚本依赖本机 Chrome 和已启动的 `3122` 端口服务，不修改项目源码。它通过 Chrome DevTools Protocol 打开当前运行页面，截取当前问题图，然后向页面临时注入 CSS/DOM 状态，生成方形节点视觉原型图。

```bash
cd /home/wgw/CodexProject/NodeConsoleApp2/.worktree/skill-optimization-20260518/NodeConsoleApp2
node DOC/CODEX_DOC/08_原型与附图/2026-05-20-230052-NodeConsoleApp2-技能树方形节点视觉修正原型-v2/source/capture-skilltree-square-prototype.mjs
```
