import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pageModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapEditorPage.js');
const workspaceModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapWorkspace.js');
const assetResolverModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelMapAssetResolver.js');
const pageHtmlPath = path.join(projectRoot, 'test', 'level_map_editor_v1.html');

function buildFixtureLevelsDoc() {
    return {
        $schemaVersion: 'levels_v1_wrapped',
        levels: {
            level_1_1: { id: 'level_1_1', name: '第一关', flow: { kind: 'story', order: 1 } },
            level_1_2: { id: 'level_1_2', name: '第二关', flow: { kind: 'story', order: 2 } },
            level_1_3: { id: 'level_1_3', name: '第三关', flow: { kind: 'story', order: 3 } }
        }
    };
}

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
                },
                {
                    id: 'bg_map_glade_03',
                    label: '地图背景 03',
                    src: '../source/map/image_w2752_h1536_map-bg-03.jpeg',
                    thumbnailSrc: '../source/map/image_w2752_h1536_map-bg-03.jpeg',
                    previewGradient: 'linear-gradient(180deg, #2f1b16, #6c4b2c)'
                }
            ],
            nodeSkins: [
                { id: 'skin_story_battle', label: '战斗节点', shape: 'hex' },
                { id: 'skin_story_event', label: '事件节点', shape: 'pill' },
                { id: 'skin_story_boss', label: '首领节点', shape: 'diamond' }
            ],
            nodeArts: [
                {
                    id: 'node_icon_elemental',
                    label: '元素节点图标',
                    src: '../source/scene_icon/level-node-04-elemental_1000.png'
                },
                {
                    id: 'node_icon_elf_archer',
                    label: '精灵弓手节点图标',
                    src: '../source/scene_icon/level-node-05-elf-archer_1000.png'
                },
                {
                    id: 'node_icon_owlbear',
                    label: '枭熊节点图标',
                    src: '../source/scene_icon/level-node-07-owlbear_1000.png'
                }
            ],
            portraits: [
                {
                    id: 'enemy_goblin_hunter',
                    label: '哥布林猎手',
                    src: '../assets/images/level_map/portraits/enemy_goblin_hunter.svg'
                },
                {
                    id: 'enemy_goblin_medic',
                    label: '哥布林医师',
                    src: '../assets/images/level_map/portraits/enemy_goblin_medic.svg'
                },
                {
                    id: 'enemy_ruins_boss',
                    label: '废墟首领',
                    src: '../assets/images/level_map/portraits/enemy_ruins_boss.svg'
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
                    logicalWidth: 1600,
                    logicalHeight: 900
                },
                display: {
                    viewportAspect: '16:9',
                    backgroundFit: 'cover',
                    nodeScale: 0.6,
                    nodeAnchor: 'center',
                    edgeAnchor: 'center',
                    edgeLabelMode: 'midpoint'
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
                        difficultyLabel: '标准',
                        rewardPreview: ['KP+1'],
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
                        kind: 'event',
                        nodeSkinRef: 'skin_story_event',
                        iconLabel: '分支',
                        position: { x: 960, y: 420 },
                        objectiveText: '观察分支',
                        difficultyLabel: '进阶',
                        rewardPreview: ['金币 50'],
                        artRefs: {
                            nodeArt: 'node_icon_elemental',
                            portrait: 'enemy_goblin_medic'
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
                        completedNodeIds: ['node_1']
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

function createPageFixture() {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <body>
            <div id="status"></div>
            <button id="loadDefaultBtn" type="button">load</button>
            <button id="addNodeBtn" type="button">add node</button>
            <button id="removeNodeBtn" type="button">remove node</button>
            <button id="saveNodeBtn" type="button">save node</button>
            <button id="addEdgeBtn" type="button">add edge</button>
            <button id="removeEdgeBtn" type="button">remove edge</button>
            <button id="saveEdgeBtn" type="button">save edge</button>
            <button id="saveMapBtn" type="button">save map</button>
            <div id="mapList"></div>
            <div id="nodeList"></div>
            <div id="edgeList"></div>
            <div id="validationList"></div>
            <div id="mapHeading"></div>
            <div id="mapMeta"></div>
            <div id="packFacts"></div>
            <div id="routeLegend"></div>
            <div id="availableLevelsSummary"></div>
            <div id="mapStage"></div>
            <div id="mapCanvas"></div>
            <div id="previewArchiveNote"></div>
            <button id="nodeInspectorBtn" type="button">node inspector</button>
            <button id="edgeInspectorBtn" type="button">edge inspector</button>
            <div id="inspectorModeLabel"></div>
            <section id="nodeInspectorPanel"></section>
            <section id="edgeInspectorPanel"></section>
            <select id="backgroundSelect"></select>
            <select id="entryNodeSelect"></select>
            <select id="backgroundFitSelect">
                <option value="cover">cover</option>
                <option value="contain">contain</option>
            </select>
            <input id="logicalWidthInput" type="number" min="1" step="1">
            <input id="logicalHeightInput" type="number" min="1" step="1">
            <select id="viewportAspectSelect">
                <option value="16:9">16:9</option>
                <option value="4:3">4:3</option>
            </select>
            <input id="nodeScaleInput" type="number" step="0.05" min="0.1" max="2">
            <select id="edgeLabelModeSelect">
                <option value="midpoint">midpoint</option>
                <option value="none">none</option>
            </select>
            <select id="nodeAnchorSelect">
                <option value="center">center</option>
                <option value="top-left">top-left</option>
            </select>
            <select id="edgeAnchorSelect">
                <option value="center">center</option>
                <option value="top-left">top-left</option>
            </select>
            <div id="selectedNodeId"></div>
            <input id="nodeIdInput">
            <select id="nodeLevelIdSelect"></select>
            <input id="nodeLabelInput">
            <input id="nodeTitleInput">
            <select id="nodeKindSelect">
                <option value="battle">battle</option>
                <option value="event">event</option>
                <option value="boss">boss</option>
            </select>
            <select id="nodeSkinSelect"></select>
            <select id="nodeArtSelect"></select>
            <select id="nodePortraitSelect"></select>
            <input id="nodeXInput" type="number">
            <input id="nodeYInput" type="number">
            <textarea id="nodeObjectiveInput"></textarea>
            <input id="nodeDifficultyInput">
            <textarea id="nodeRewardInput"></textarea>
            <div id="backgroundAssetPreview"></div>
            <div id="nodeAssetPreview"></div>
            <div id="nodePortraitPreview"></div>
            <div id="selectedEdgeId"></div>
            <input id="edgeIdInput">
            <select id="edgeFromSelect"></select>
            <select id="edgeToSelect"></select>
            <select id="edgeTypeSelect">
                <option value="branch">branch</option>
                <option value="merge">merge</option>
            </select>
            <input id="edgeBranchLabelInput">
            <textarea id="exportPreview"></textarea>
        </body>
    `, {
        url: 'http://127.0.0.1:3101/test/level_map_editor_v1.html'
    });

    installDomGlobals(dom);
    return dom;
}

async function createPageContext() {
    const [{ LevelMapEditorPage }, { LevelMapWorkspace }] = await Promise.all([
        importSourceModule(pageModulePath),
        importSourceModule(workspaceModulePath)
    ]);

    const page = new LevelMapEditorPage({
        document,
        mapSourceUrl: '../assets/data/level_map_pack_v1.example.json',
        levelSourceUrl: '../assets/data/levels.json',
        fetchImpl: async (url) => ({
            ok: true,
            async json() {
                return url.includes('level_map_pack')
                    ? JSON.parse(JSON.stringify(buildFixtureMapPack()))
                    : JSON.parse(JSON.stringify(buildFixtureLevelsDoc()));
            }
        }),
        workspaceFactory(rawMapPack, levelsDocument) {
            return new LevelMapWorkspace(rawMapPack, { levelsDocument });
        }
    });

    page.bind();
    return { page };
}

function installDynamicCanvasMetrics({ aspectToSize = {}, defaultSize = { width: 920, height: 520 } } = {}) {
    const stage = document.getElementById('mapStage');
    const canvas = document.getElementById('mapCanvas');
    const resolveSize = () => {
        const key = stage?.style?.aspectRatio || '';
        return aspectToSize[key] || defaultSize;
    };

    Object.defineProperty(canvas, 'clientWidth', {
        configurable: true,
        get() {
            return resolveSize().width;
        }
    });
    Object.defineProperty(canvas, 'clientHeight', {
        configurable: true,
        get() {
            return resolveSize().height;
        }
    });
    canvas.getBoundingClientRect = () => {
        const size = resolveSize();
        return {
            left: 0,
            top: 0,
            right: size.width,
            bottom: size.height,
            width: size.width,
            height: size.height
        };
    };

    return { stage, canvas, resolveSize };
}

test('LevelMapEditorPage 能加载默认地图包并渲染地图、节点、边和关卡绑定选项', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const nodeButtons = document.querySelectorAll('#nodeList button');
        const edgeButtons = document.querySelectorAll('#edgeList button');
        const levelOptions = document.querySelectorAll('#nodeLevelIdSelect option');
        const canvasNodes = document.querySelectorAll('#mapCanvas .map-node');

        assert.equal(nodeButtons.length >= 2, true, '节点列表未渲染');
        assert.equal(edgeButtons.length >= 1, true, '边列表未渲染');
        assert.equal(levelOptions.length >= 3, true, '关卡绑定下拉框未消费 levels.json');
        assert.equal(canvasNodes.length >= 2, true, '地图画布未渲染节点');
        assert.match(document.getElementById('validationList').textContent || '', /未发现结构问题/u);
        assert.equal(document.getElementById('mapHeading').textContent || '', '', '中央舞台不应再显示章节标题');
        assert.equal(document.getElementById('routeLegend').textContent || '', '', '中央舞台不应再保留路线总览');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 支持新增节点、编辑边并更新位置', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        document.getElementById('addNodeBtn').click();
        document.getElementById('nodeLevelIdSelect').value = 'level_1_3';
        document.getElementById('nodeLabelInput').value = '1-3';
        document.getElementById('nodeTitleInput').value = '废墟关口';
        document.getElementById('nodeKindSelect').value = 'boss';
        document.getElementById('nodeSkinSelect').value = 'skin_story_boss';
        document.getElementById('nodeArtSelect').value = 'node_icon_owlbear';
        document.getElementById('nodePortraitSelect').value = 'enemy_ruins_boss';
        document.getElementById('nodeXInput').value = '1240';
        document.getElementById('nodeYInput').value = '450';
        document.getElementById('nodeRewardInput').value = 'KP+2\n章节奖励';
        document.getElementById('saveNodeBtn').click();

        document.getElementById('addEdgeBtn').click();
        document.getElementById('edgeFromSelect').value = 'node_2';
        document.getElementById('edgeToSelect').value = page.selectedNodeId;
        document.getElementById('edgeTypeSelect').value = 'merge';
        document.getElementById('edgeBranchLabelInput').value = '汇合到首领';
        document.getElementById('saveEdgeBtn').click();

        page.moveSelectedNodeTo(1280, 500);

        const exported = JSON.parse(document.getElementById('exportPreview').value);
        const map = exported.maps[0];
        const currentNode = map.nodes.find(node => node.id === page.selectedNodeId);
        const edge = map.edges.find(item => item.branchLabel === '汇合到首领');

        assert.equal(currentNode.levelId, 'level_1_3');
        assert.deepEqual(currentNode.position, { x: 1280, y: 500 });
        assert.equal(currentNode.artRefs?.nodeArt, 'node_icon_owlbear');
        assert.equal(currentNode.artRefs?.portrait, 'enemy_ruins_boss');
        assert.equal(edge.type, 'merge');
        assert.equal(edge.fromNodeId, 'node_2');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 支持编辑地图显示配置，并让显示层与导出结果保持一致', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        document.getElementById('backgroundFitSelect').value = 'contain';
        document.getElementById('nodeScaleInput').value = '0.85';
        document.getElementById('edgeLabelModeSelect').value = 'none';
        document.getElementById('saveMapBtn').click();

        const exported = JSON.parse(document.getElementById('exportPreview').value);
        const map = exported.maps[0];
        const mapStage = document.getElementById('mapStage');
        const node = document.querySelector('#mapCanvas .map-node[data-node-id="node_1"]');
        const edgeLabel = document.querySelector('#mapCanvas .map-edge-label-text');

        assert.equal(map.display?.backgroundFit, 'contain');
        assert.equal(map.display?.nodeScale, 0.85);
        assert.equal(map.display?.edgeLabelMode, 'none');
        assert.match(mapStage.style.backgroundSize || '', /contain/u);
        assert.equal(node?.style.getPropertyValue('--node-scale'), '0.85');
        assert.equal(edgeLabel, null, '边标签应在 edgeLabelMode=none 时隐藏');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 支持编辑逻辑地图空间与视口比例，并同步影响投影结果', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const beforeNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        const beforeLeft = beforeNode?.style.left || '';

        document.getElementById('logicalWidthInput').value = '2000';
        document.getElementById('logicalHeightInput').value = '1200';
        document.getElementById('viewportAspectSelect').value = '4:3';
        document.getElementById('saveMapBtn').click();

        const exported = JSON.parse(document.getElementById('exportPreview').value);
        const map = exported.maps[0];
        const afterNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        const mapStage = document.getElementById('mapStage');

        assert.deepEqual(map.space, { logicalWidth: 2000, logicalHeight: 1200 });
        assert.equal(map.display?.viewportAspect, '4:3');
        assert.equal(mapStage.style.aspectRatio, '4 / 3');
        assert.notEqual(afterNode?.style.left || '', beforeLeft);
        assert.deepEqual(map.nodes.find(node => node.id === 'node_2')?.position, { x: 960, y: 420 });
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 修改视口比例后会在同一次保存中按新舞台尺寸重算节点投影', async () => {
    const dom = createPageFixture();
    try {
        installDynamicCanvasMetrics({
            aspectToSize: {
                '16 / 9': { width: 920, height: 520 },
                '4 / 3': { width: 920, height: 690 }
            },
            defaultSize: { width: 920, height: 520 }
        });

        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const beforeNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        assert.equal(beforeNode?.style.top || '', '243px');

        document.getElementById('viewportAspectSelect').value = '4:3';
        document.getElementById('saveMapBtn').click();

        const afterNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        const mapStage = document.getElementById('mapStage');

        assert.equal(mapStage.style.aspectRatio, '4 / 3');
        assert.equal(afterNode?.style.top || '', '322px', '节点应立即按新的舞台高度重算投影，不应等待下一次操作');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 支持编辑节点锚点与边锚点策略，并只改变投影不改逻辑坐标', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const beforePath = document.querySelector('#mapCanvas .map-edge[data-edge-id], #mapCanvas .map-edge')?.getAttribute('d')
            || document.querySelector('#mapCanvas .map-edge')?.getAttribute('d')
            || '';

        document.getElementById('nodeAnchorSelect').value = 'top-left';
        document.getElementById('edgeAnchorSelect').value = 'center';
        document.getElementById('saveMapBtn').click();

        const exported = JSON.parse(document.getElementById('exportPreview').value);
        const map = exported.maps[0];
        const node = document.querySelector('#mapCanvas .map-node[data-node-id="node_1"]');
        const afterPath = document.querySelector('#mapCanvas .map-edge')?.getAttribute('d') || '';

        assert.equal(map.display?.nodeAnchor, 'top-left');
        assert.equal(map.display?.edgeAnchor, 'center');
        assert.match(node?.style.transform || '', /translate\(0px,\s*0px\)\s*scale\(0\.6\)/u);
        assert.notEqual(afterPath, beforePath, '边路径应随锚点策略变化');
        assert.deepEqual(map.nodes.find(item => item.id === 'node_1')?.position, { x: 320, y: 420 });
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 支持在画布中拖拽节点改变坐标', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const canvas = document.getElementById('mapCanvas');
        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 920,
            bottom: 520,
            width: 920,
            height: 520
        });

        const target = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        assert.ok(target, '缺少 node_2 的画布节点');

        target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 552, clientY: 243 }));
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 644, clientY: 301 }));
        document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 644, clientY: 301 }));

        const exported = JSON.parse(document.getElementById('exportPreview').value);
        const movedNode = exported.maps[0].nodes.find(node => node.id === 'node_2');
        assert.deepEqual(movedNode.position, { x: 1120, y: 521 });
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 在不同画布尺寸下会保持同一份逻辑坐标，只改变显示投影', async () => {
    const dom = createPageFixture();
    try {
        const canvas = document.getElementById('mapCanvas');
        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 920,
            bottom: 520,
            width: 920,
            height: 520
        });

        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const beforeNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        const beforeLeft = beforeNode.style.left;
        const beforeTop = beforeNode.style.top;
        const beforeExport = JSON.parse(document.getElementById('exportPreview').value);

        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 640,
            bottom: 360,
            width: 640,
            height: 360
        });
        page.renderAll();

        const afterNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        const afterExport = JSON.parse(document.getElementById('exportPreview').value);

        assert.notEqual(afterNode.style.left, beforeLeft);
        assert.notEqual(afterNode.style.top, beforeTop);
        assert.deepEqual(beforeExport.maps[0].nodes.find(node => node.id === 'node_2').position, { x: 960, y: 420 });
        assert.deepEqual(afterExport.maps[0].nodes.find(node => node.id === 'node_2').position, { x: 960, y: 420 });
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 在画布尺寸变化后会自动刷新节点投影，不需要额外点击', async () => {
    const dom = createPageFixture();
    try {
        const canvas = document.getElementById('mapCanvas');
        let size = { width: 920, height: 520 };
        Object.defineProperty(canvas, 'clientWidth', {
            configurable: true,
            get() {
                return size.width;
            }
        });
        Object.defineProperty(canvas, 'clientHeight', {
            configurable: true,
            get() {
                return size.height;
            }
        });
        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: size.width,
            bottom: size.height,
            width: size.width,
            height: size.height
        });

        class FakeResizeObserver {
            static instances = [];
            constructor(callback) {
                this.callback = callback;
                FakeResizeObserver.instances.push(this);
            }
            observe(target) {
                this.target = target;
            }
            disconnect() {}
            trigger() {
                this.callback([{ target: this.target, contentRect: this.target.getBoundingClientRect() }]);
            }
        }

        const [{ LevelMapEditorPage }, { LevelMapWorkspace }] = await Promise.all([
            importSourceModule(pageModulePath),
            importSourceModule(workspaceModulePath)
        ]);

        const page = new LevelMapEditorPage({
            document,
            ResizeObserverImpl: FakeResizeObserver,
            mapSourceUrl: '../assets/data/level_map_pack_v1.example.json',
            levelSourceUrl: '../assets/data/levels.json',
            fetchImpl: async (url) => ({
                ok: true,
                async json() {
                    return url.includes('level_map_pack')
                        ? JSON.parse(JSON.stringify(buildFixtureMapPack()))
                        : JSON.parse(JSON.stringify(buildFixtureLevelsDoc()));
                }
            }),
            workspaceFactory(rawMapPack, levelsDocument) {
                return new LevelMapWorkspace(rawMapPack, { levelsDocument });
            }
        });

        page.bind();
        await page.loadDefaultDocuments();

        const beforeNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        assert.equal(beforeNode?.style.left || '', '552px');
        assert.equal(beforeNode?.style.top || '', '243px');
        assert.equal(FakeResizeObserver.instances.length > 0, true, '应注册画布尺寸监听');

        size = { width: 640, height: 360 };
        FakeResizeObserver.instances[0].trigger();

        const afterNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        assert.equal(afterNode?.style.left || '', '384px');
        assert.equal(afterNode?.style.top || '', '168px');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 会在画布中渲染边标签，并允许点击边切换到边检查器', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const edgeGroup = document.querySelector('#mapCanvas .map-edge-group[data-edge-id="edge_1"]');
        const edgeLabel = document.querySelector('#mapCanvas .map-edge-label-text');
        assert.ok(edgeGroup, '缺少可交互的边图层');
        assert.ok(edgeLabel, '缺少边标签文本');
        assert.match(edgeLabel.textContent || '', /默认路线/u);

        edgeGroup.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        assert.equal(page.selectedEdgeId, 'edge_1');
        assert.equal(document.getElementById('inspectorModeLabel').textContent, 'edge');
        assert.equal(document.getElementById('edgeInspectorBtn').getAttribute('aria-pressed'), 'true');
        assert.equal(edgeGroup.getAttribute('aria-current'), 'true');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 不再提供预览页强入口，而是把 3.2.3.1 标记为历史验证资产', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const previewLink = document.getElementById('previewPageLink');
        const previewArchiveNote = document.getElementById('previewArchiveNote');
        const packFacts = document.getElementById('packFacts');
        const artBanner = document.querySelector('#mapCanvas .map-node__sprite');
        const nodeLabel = document.querySelector('#mapCanvas .map-node[data-node-id="node_1"] .map-node__label');
        const mapStage = document.getElementById('mapStage');
        const backgroundPreview = document.getElementById('backgroundAssetPreview');
        const nodeAssetPreview = document.getElementById('nodeAssetPreview');
        const nodePortraitPreview = document.getElementById('nodePortraitPreview');
        const nodeArtSelect = document.getElementById('nodeArtSelect');
        const nodePortraitSelect = document.getElementById('nodePortraitSelect');

        assert.equal(previewLink, null, '编辑页不应继续保留剧情预览页强入口');
        assert.ok(previewArchiveNote, '缺少历史验证资产说明');
        assert.match(previewArchiveNote.textContent || '', /历史验证资产/u);
        assert.match(previewArchiveNote.textContent || '', /WBS-3\.2\.3\.1/u);

        assert.ok(packFacts, '缺少包级元信息容器');
        assert.match(packFacts.textContent || '', /Map ID/u);
        assert.match(packFacts.textContent || '', /Owner/u);

        assert.ok(artBanner, '节点缺少纯图片显示层');
        assert.ok(nodeLabel, '节点缺少最小标签');
        assert.equal(document.querySelector('#mapCanvas .map-node__body'), null, '中央舞台不应再渲染节点信息卡片');
        assert.equal(document.querySelector('#mapCanvas .map-node__portrait'), null, '中央舞台不应再渲染立绘角标');
        assert.equal(document.querySelector('#mapCanvas .map-node__art-meta'), null, '中央舞台不应再渲染素材说明胶囊');
        assert.match(nodeLabel.textContent || '', /1-1/u);
        assert.match(mapStage.style.backgroundImage || mapStage.getAttribute('style') || '', /source\/map\/image_w2752_h1536_map-bg-01\.jpeg/u);
        assert.match(artBanner.style.backgroundImage || '', /source\/scene_icon\/level-node-05-elf-archer_1000\.png/u);
        assert.equal(nodeArtSelect.options.length >= 3, true, '缺少节点图片配置入口');
        assert.equal(nodePortraitSelect.options.length >= 3, true, '缺少立绘图片配置入口');
        assert.match(backgroundPreview.textContent || '', /source\/map\/image_w2752_h1536_map-bg-01\.jpeg/u);
        assert.match(nodeAssetPreview.textContent || '', /source\/scene_icon\/level-node-05-elf-archer_1000\.png/u);
        assert.match(nodePortraitPreview.textContent || '', /enemy_goblin_hunter\.svg/u);
        assert.equal(document.getElementById('mapMeta').textContent?.includes('Map ID') || false, false, '中央舞台仍保留调试式元信息');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 会移除中央路线总览，但仍允许直接点击边切到边检查器', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const routeLegendButtons = document.querySelectorAll('#routeLegend button');
        const edgeGroup = document.querySelector('#mapCanvas .map-edge-group[data-edge-id="edge_1"]');
        assert.equal(routeLegendButtons.length, 0, '中央舞台不应再保留路线总览按钮');
        assert.ok(edgeGroup, '缺少中央边图层');

        edgeGroup.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        assert.equal(page.selectedEdgeId, 'edge_1');
        assert.equal(document.getElementById('inspectorModeLabel').textContent, 'edge');
        assert.equal(document.getElementById('edgeInspectorBtn').getAttribute('aria-pressed'), 'true');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 会让边图层使用画布实际尺寸，保证连线锚点与图标中心对齐', async () => {
    const dom = createPageFixture();
    try {
        const canvas = document.getElementById('mapCanvas');
        canvas.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 450,
            width: 800,
            height: 450
        });

        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const edgeLayer = document.querySelector('#mapCanvas .map-edge-layer');
        assert.ok(edgeLayer, '缺少边图层');
        assert.equal(edgeLayer.getAttribute('viewBox'), '0 0 800 450');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('level_map_editor_v1.html 会明确页面用途、按钮原因与和其他节点的关系', async () => {
    assert.equal(fs.existsSync(pageHtmlPath), true, 'level_map_editor_v1.html 缺失');
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    for (const requiredText of [
        '地图编辑工作区',
        '不会直接改战斗主流程',
        '消费 levels.json 中已存在的 levelId',
        'WBS-3.2.3.3',
        '导入导出与 round-trip 校验不在本页完成',
        'JSON + image assets',
        '背景图',
        '节点素材图',
        '立绘图',
        'level_map_selection_mock.html',
        'level_editor_v1.html',
        '历史验证资产',
        '节点检查器',
        '边检查器',
        '16:9',
        '抽屉',
        '地图真值 + 显示配置',
        '只改变当前地图的显示映射',
        '不会把 DOM 像素状态写回地图真值'
    ]) {
        assert.match(
            html,
            new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `地图编辑页缺少说明：${requiredText}`
        );
    }

    for (const removedText of [
        '打开剧情预览页',
        '素材化地图舞台',
        '路线总览',
        '当前入口',
        '当前焦点',
        '路线语义'
    ]) {
        assert.doesNotMatch(
            html,
            new RegExp(removedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `地图编辑页仍保留旧舞台文案：${removedText}`
        );
    }

    assert.match(
        html,
        /\.map-node\s*\{[\s\S]*width:\s*68px;[\s\S]*height:\s*68px;[\s\S]*scale\(var\(--node-scale,\s*1\)\)/u,
        '地图节点未把显示缩放挂到 display.nodeScale'
    );
});
