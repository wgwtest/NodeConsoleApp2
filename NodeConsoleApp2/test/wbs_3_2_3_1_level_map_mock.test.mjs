import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const mapPackPath = path.join(projectRoot, 'assets', 'data', 'level_map_pack_v1.example.json');
const previewPagePath = path.join(projectRoot, 'test', 'level_map_selection_mock.html');
const previewModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapPreviewPage.js');

function readUtf8(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function normalizeRenderedTextFromHtml(html) {
    return html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function assertPageIncludesText(html, requiredText, message) {
    const normalizedRequired = requiredText.replace(/\s+/g, ' ').trim();
    const normalizedRenderedText = normalizeRenderedTextFromHtml(html);
    assert.equal(
        html.includes(requiredText) || normalizedRenderedText.includes(normalizedRequired),
        true,
        `${message}: ${requiredText}`
    );
}

test('WBS-3.2.3.1 提供独立的地图包样例文件，并指向 WBS-3.2.3 地图编辑器父节点', () => {
    assert.equal(fs.existsSync(mapPackPath), true, 'level_map_pack_v1.example.json 缺失');
    const json = JSON.parse(readUtf8(mapPackPath));

    assert.equal(json.$schemaVersion, 'level_map_pack_v1', '地图包 schemaVersion 错误');
    assert.equal(json.meta?.ownerNode, 'WBS-3.2.3', '地图包 ownerNode 应指向 WBS-3.2.3');
    assert.equal(Array.isArray(json.maps), true, '地图包缺少 maps 数组');
    assert.equal(json.maps.length > 0, true, '地图包至少应包含一张地图');

    const firstMap = json.maps[0];
    assert.equal(Array.isArray(firstMap.nodes), true, '地图缺少 nodes');
    assert.equal(Array.isArray(firstMap.edges), true, '地图缺少 edges');
    assert.equal(Array.isArray(firstMap.previewModes), true, '地图缺少 previewModes');
    assert.equal(firstMap.nodes.length >= 3, true, '地图节点数量不足，无法体现分支组织');
    assert.equal(firstMap.edges.length >= 2, true, '地图连线数量不足，无法体现路线关系');
    assert.equal(typeof firstMap.entryNodeId, 'string', '地图缺少 entryNodeId');

    const node = firstMap.nodes[0];
    assert.equal(typeof node.levelId, 'string', '地图节点缺少 levelId');
    assert.equal(typeof node.artRefs?.nodeArt, 'string', '地图节点缺少 nodeArt 引用');
});

test('WBS-3.2.3.1 的预览页明确说明用途、解耦边界和交接载荷', () => {
    assert.equal(fs.existsSync(previewPagePath), true, 'level_map_selection_mock.html 缺失');
    const html = readUtf8(previewPagePath);

    for (const requiredText of [
        '关卡地图组织方案预览',
        '不会改当前主流程',
        '关卡选择层与游戏主内容绝对解耦',
        '只输出 selectedLevelId',
        '未来正式地图编辑器应维护这份地图包',
        '同一张地图的三种推进快照',
        '不是主流程玩法按钮',
        '正式地图编辑器',
        '地图包样例'
    ]) {
        assertPageIncludesText(html, requiredText, '预览页缺少说明');
    }
});

test('WBS-3.2.3.1 的预览模块会渲染节点状态与 handoff payload', () => {
    assert.equal(fs.existsSync(previewModulePath), true, 'LevelMapPreviewPage.js 缺失');
    const source = readUtf8(previewModulePath);

    assert.match(source, /class LevelMapPreviewPage/, '缺少 LevelMapPreviewPage 类');
    assert.match(source, /selectedLevelId/, '预览模块未生成 selectedLevelId handoff payload');
    assert.match(source, /sourceMapId/, '预览模块未保留地图来源字段');
    assert.match(source, /previewModeId/, '预览模块未输出当前预览模式');
    assert.match(source, /getNodeStatus/, '预览模块未实现节点状态解析');
});
