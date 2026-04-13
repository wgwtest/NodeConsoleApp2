import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(import.meta.dirname, '..');
const previewModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapPreviewPage.js');
const assetResolverModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapAssetResolver.js');

function buildFixtureMapPack() {
    return {
        $schemaVersion: 'level_map_pack_v1',
        meta: {
            id: 'fixture_map_pack',
            ownerNode: 'WBS-3.2.3'
        },
        assetLibrary: {
            backgrounds: [
                {
                    id: 'bg_map_glade_01',
                    label: '地图背景 01',
                    src: '../source/map/image_w2752_h1536_map-bg-01.jpeg',
                    thumbnailSrc: '../source/map/image_w2752_h1536_map-bg-01.jpeg',
                    previewGradient: 'linear-gradient(180deg, #17324d, #3f9f84)'
                }
            ],
            nodeSkins: [
                { id: 'skin_story_battle', label: '战斗节点', shape: 'hex' }
            ],
            nodeArts: [
                {
                    id: 'node_icon_elf_archer',
                    label: '精灵弓手节点图标',
                    src: '../source/scene_icon/level-node-05-elf-archer_1000.png'
                }
            ],
            portraits: [
                {
                    id: 'enemy_goblin_hunter',
                    label: '哥布林猎手',
                    src: '../assets/images/level_map/portraits/enemy_goblin_hunter.svg'
                }
            ]
        },
        maps: [
            {
                id: 'map_chapter_1',
                name: '第一章',
                chapterId: 'chapter_1',
                chapterLabel: '第一章',
                chapterTitle: '幽暗森林',
                space: {
                    logicalWidth: 2000,
                    logicalHeight: 1200
                },
                display: {
                    viewportAspect: '4:3',
                    backgroundFit: 'contain',
                    nodeScale: 0.75,
                    nodeAnchor: 'top-left',
                    edgeAnchor: 'center',
                    edgeLabelMode: 'none'
                },
                entryNodeId: 'node_1',
                backgroundRef: 'bg_map_glade_01',
                nodes: [
                    {
                        id: 'node_1',
                        levelId: 'level_1_1',
                        label: '1-1',
                        title: '森林入口',
                        kind: 'battle',
                        nodeSkinRef: 'skin_story_battle',
                        iconLabel: '侦察',
                        position: { x: 320, y: 420 },
                        objectiveText: '侦查前线',
                        artRefs: {
                            nodeArt: 'node_icon_elf_archer',
                            portrait: 'enemy_goblin_hunter'
                        }
                    },
                    {
                        id: 'node_2',
                        levelId: 'level_1_2',
                        label: '1-2',
                        title: '林间岔路',
                        kind: 'battle',
                        nodeSkinRef: 'skin_story_battle',
                        iconLabel: '分支',
                        position: { x: 960, y: 420 },
                        objectiveText: '观察分支',
                        artRefs: {
                            nodeArt: 'node_icon_elf_archer',
                            portrait: 'enemy_goblin_hunter'
                        }
                    }
                ],
                edges: [
                    {
                        id: 'edge_1',
                        fromNodeId: 'node_1',
                        toNodeId: 'node_2',
                        type: 'branch',
                        branchLabel: '默认路线'
                    }
                ],
                previewModes: [
                    {
                        id: 'preview_default',
                        label: '默认模式',
                        focusNodeId: 'node_1',
                        unlockedNodeIds: ['node_1', 'node_2'],
                        completedNodeIds: []
                    }
                ]
            }
        ]
    };
}

async function importSourceModule(filePath) {
    assert.equal(fs.existsSync(filePath), true, `缺少源文件: ${filePath}`);
    let source = await fsp.readFile(filePath, 'utf8');
    if (source.includes('./LevelMapAssetResolver.js')) {
        const assetResolverSource = await fsp.readFile(assetResolverModulePath, 'utf8');
        const assetResolverEncoded = Buffer.from(assetResolverSource, 'utf8').toString('base64');
        source = source.replace(
            "'./LevelMapAssetResolver.js'",
            `'data:text/javascript;base64,${assetResolverEncoded}'`
        );
    }
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

function installDomGlobals(dom) {
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Node = dom.window.Node;
    global.Event = dom.window.Event;
    global.MouseEvent = dom.window.MouseEvent;
    global.CustomEvent = dom.window.CustomEvent;
}

function cleanupDomGlobals() {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.Node;
    delete global.Event;
    delete global.MouseEvent;
    delete global.CustomEvent;
}

function createPreviewFixture() {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <body>
            <div id="status"></div>
            <button id="reloadBtn" type="button">reload</button>
            <div id="modeButtons"></div>
            <div id="mapStage"></div>
            <div id="mapCanvas"></div>
            <div id="mapHeading"></div>
            <div id="mapModeDescription"></div>
            <div id="packMeta"></div>
            <div id="nodeInspector"></div>
            <pre id="handoffPayload"></pre>
            <pre id="packPreview"></pre>
            <ul id="relationshipList"></ul>
        </body>
    `, {
        url: 'http://127.0.0.1:3101/test/level_map_selection_mock.html'
    });

    installDomGlobals(dom);
    return dom;
}

test('LevelMapPreviewPage 会消费地图显示配置并同步到预览舞台', async () => {
    const dom = createPreviewFixture();
    try {
        const { LevelMapPreviewPage } = await importSourceModule(previewModulePath);
        const page = new LevelMapPreviewPage({ document });
        page.bind();
        page.loadDocument(buildFixtureMapPack());

        const mapStage = document.getElementById('mapStage');
        const node = document.querySelector('#mapCanvas .map-node[data-selected="true"]');
        const node2 = document.querySelectorAll('#mapCanvas .map-node')[1];
        const edgeLabel = document.querySelector('#mapCanvas .map-edge-label');
        const edgePath = document.querySelector('#mapCanvas .map-edge');

        assert.match(mapStage.style.backgroundSize || '', /contain/u);
        assert.equal(mapStage.style.aspectRatio, '4 / 3');
        assert.match(node?.style.getPropertyValue('--node-scale') || '', /0\.75/u);
        assert.match(node?.style.transform || '', /translate\(0px,\s*0px\)\s*scale\(0\.75\)/u);
        assert.equal(node2?.style.left, '365px');
        assert.equal(edgeLabel, null, '预览页应在 edgeLabelMode=none 时隐藏边标签');
        assert.ok(edgePath?.getAttribute('d'), '预览页缺少边路径');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});
