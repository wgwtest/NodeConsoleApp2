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
const levelsJsonPath = path.join(projectRoot, 'assets', 'data', 'levels.json');

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
            <button id="publishMapBtn" type="button">publish map</button>
            <button id="exportMapBtn" type="button">export map</button>
            <button id="addStoryBtn" type="button">add story</button>
            <button id="addChapterBtn" type="button">add chapter</button>
            <button id="addMapBtn" type="button">add map</button>
            <button id="duplicateMapBtn" type="button">duplicate map</button>
            <button id="removeMapBtn" type="button">remove map</button>
            <input id="storyTitleInput">
            <input id="chapterTitleInput">
            <input id="mapNameInput">
            <div id="storyList"></div>
            <div id="chapterList"></div>
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
            <button id="openBackgroundPickerBtn" type="button">open background picker</button>
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
                <option value="main">main</option>
                <option value="branch">branch</option>
                <option value="supply">supply</option>
                <option value="elite">elite</option>
                <option value="boss">boss</option>
                <option value="battle">battle</option>
                <option value="event">event</option>
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
            <dialog id="mapSettingsDialog">
                <button id="confirmMapSettingsBtn" type="button">confirm map settings</button>
                <button id="cancelMapSettingsBtn" type="button">cancel map settings</button>
            </dialog>
            <dialog id="backgroundPickerDialog">
                <div id="backgroundPickerList"></div>
                <button id="confirmBackgroundPickerBtn" type="button">confirm background</button>
                <button id="cancelBackgroundPickerBtn" type="button">cancel background</button>
            </dialog>
            <dialog id="exportMapDialog">
                <p>完整目录式地图包入口 package.json，资源 ID / 路径引用，不会被嵌入 JSON。导出只负责下载备份。</p>
                <p>地图数据 maps.json</p>
                <p>资源清单 asset-manifest.json</p>
                <label>包 ID <input id="packageIdInput" value="story_pack_v1"></label>
                <label>包标题 <input id="packageTitleInput" value="故事地图包 v1"></label>
                <label>作者目录 <input id="authoringPackageDirectoryInput" value="assets/map_packs/authoring/story_pack_v1/"></label>
                <label>发布目录 <input id="runtimePackageDirectoryInput" value="assets/map_packs/current/story_pack_v1/"></label>
                <label>导出目录 <input id="packageDirectoryInput" value="assets/map_packs/current/story_pack_v1/"></label>
                <p id="authoringPackagePathPreview">assets/map_packs/authoring/story_pack_v1/package.json</p>
                <p id="runtimePackagePathPreview">assets/map_packs/current/story_pack_v1/package.json</p>
                <p id="packagePathPreview">assets/map_packs/current/story_pack_v1/package.json</p>
                <p>资源文件被删或移动时，结构校验会报错。</p>
                <button id="selectPackageDirectoryBtn" type="button">select dir</button>
                <button id="downloadPackageFilesBtn" type="button">download package files</button>
                <button id="writePackageDirectoryBtn" type="button">write package dir</button>
                <button id="cancelExportMapBtn" type="button">cancel export</button>
            </dialog>
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

function applyMapSettingsThroughDialog() {
    [
        'backgroundSelect',
        'entryNodeSelect',
        'viewportAspectSelect',
        'nodeScaleInput',
        'backgroundFitSelect',
        'logicalWidthInput',
        'logicalHeightInput',
        'edgeLabelModeSelect',
        'nodeAnchorSelect',
        'edgeAnchorSelect'
    ].forEach((id) => {
        const element = document.getElementById(id);
        if (element) dispatchEditorInput(element);
    });
}

function dispatchEditorInput(element) {
    element.dispatchEvent(new window.Event('input', { bubbles: true }));
    element.dispatchEvent(new window.Event('change', { bubbles: true }));
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

test('LevelMapEditorPage 渲染故事章节地图层级并支持新建复制删除地图', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        assert.match(document.getElementById('storyList').textContent || '', /默认故事/u, '左侧缺少当前故事列表');
        assert.match(document.getElementById('chapterList').textContent || '', /幽暗森林|第一章/u, '左侧缺少章节列表');
        assert.match(document.getElementById('mapList').textContent || '', /map_chapter_1/u, '左侧缺少地图列表');

        document.getElementById('storyTitleInput').value = '北境故事';
        document.getElementById('addStoryBtn').click();
        document.getElementById('chapterTitleInput').value = '霜雾峡谷';
        document.getElementById('addChapterBtn').click();
        document.getElementById('mapNameInput').value = '霜雾入口';
        document.getElementById('addMapBtn').click();

        let exported = JSON.parse(document.getElementById('exportPreview').value);
        const story = exported.stories.find(item => item.title === '北境故事');
        const chapter = exported.chapters.find(item => item.title === '霜雾峡谷');
        const createdMap = exported.maps.find(item => item.name === '霜雾入口');

        assert.ok(story, '新建故事未写入工作区');
        assert.ok(chapter, '新建章节未写入工作区');
        assert.ok(createdMap, '新建地图未写入工作区');
        assert.equal(chapter.storyId, story.id);
        assert.equal(createdMap.chapterId, chapter.id);
        assert.equal(page.selectedMapId, createdMap.id);

        document.getElementById('duplicateMapBtn').click();
        exported = JSON.parse(document.getElementById('exportPreview').value);
        const copiedMaps = exported.maps.filter(item => item.name.includes('副本'));
        assert.equal(copiedMaps.length >= 1, true, '复制地图未生成副本');
        assert.equal(exported.chapters.find(item => item.id === chapter.id).mapIds.includes(copiedMaps[0].id), true);

        document.getElementById('removeMapBtn').click();
        exported = JSON.parse(document.getElementById('exportPreview').value);
        assert.equal(exported.maps.some(item => item.id === copiedMaps[0].id), false, '删除地图后仍保留旧地图');
        assert.equal(
            exported.chapters.find(item => item.id === chapter.id).mapIds.includes(copiedMaps[0].id),
            false,
            '删除地图后章节 mapIds 未同步'
        );
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
        dispatchEditorInput(document.getElementById('backgroundFitSelect'));
        document.getElementById('nodeScaleInput').value = '0.85';
        dispatchEditorInput(document.getElementById('nodeScaleInput'));
        document.getElementById('edgeLabelModeSelect').value = 'none';
        dispatchEditorInput(document.getElementById('edgeLabelModeSelect'));

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

test('LevelMapEditorPage 地图设置是所见即所得，表单变化后立即更新当前工作区', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const dialog = document.getElementById('mapSettingsDialog');
        const mapStage = document.getElementById('mapStage');

        document.getElementById('backgroundFitSelect').value = 'contain';
        dispatchEditorInput(document.getElementById('backgroundFitSelect'));
        document.getElementById('nodeScaleInput').value = '0.85';
        dispatchEditorInput(document.getElementById('nodeScaleInput'));

        const exported = JSON.parse(document.getElementById('exportPreview').value);
        assert.equal(dialog.hasAttribute('open'), false, '地图设置不应再弹二次确认框');
        assert.equal(exported.maps[0].display?.backgroundFit, 'contain');
        assert.equal(exported.maps[0].display?.nodeScale, 0.85);
        assert.match(mapStage.style.backgroundSize || '', /contain/u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 背景资源通过资源选择器更换，并先暂存到地图设置表单', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const dialog = document.getElementById('backgroundPickerDialog');
        dialog.showModal = () => {
            dialog.setAttribute('open', '');
        };
        dialog.close = () => {
            dialog.removeAttribute('open');
        };

        document.getElementById('openBackgroundPickerBtn').click();

        const options = document.querySelectorAll('#backgroundPickerList button[data-background-id]');
        assert.equal(dialog.hasAttribute('open'), true, '点击更换背景应打开资源选择器');
        assert.equal(options.length, 2, '资源选择器应来自背景资源库');
        assert.match(options[0].textContent || '', /bg_map_glade_01/u);
        assert.match(options[1].textContent || '', /bg_map_glade_03/u);

        options[1].click();
        document.getElementById('confirmBackgroundPickerBtn').click();

        const exported = JSON.parse(document.getElementById('exportPreview').value);
        assert.equal(dialog.hasAttribute('open'), false, '确认背景后应关闭选择器');
        assert.equal(document.getElementById('backgroundSelect').value, 'bg_map_glade_03');
        assert.equal(exported.maps[0].backgroundRef, 'bg_map_glade_03', '背景选择应立即写入工作区并刷新画布');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 导出弹窗说明下载备份、保存目录和发布目录', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const dialog = document.getElementById('exportMapDialog');
        dialog.showModal = () => {
            dialog.setAttribute('open', '');
        };
        dialog.close = () => {
            dialog.removeAttribute('open');
        };

        document.getElementById('exportMapBtn').click();

        const text = dialog.textContent || '';
        assert.equal(dialog.hasAttribute('open'), true, '导出包文件应打开下载备份弹窗');
        assert.match(text, /package\.json/u);
        assert.match(text, /maps\.json/u);
        assert.match(text, /asset-manifest\.json/u);
        assert.match(text, /assets\/map_packs\/authoring\/story_pack_v1/u);
        assert.match(text, /assets\/map_packs\/current\/story_pack_v1/u);
        assert.match(text, /目录式地图包/u);
        assert.match(text, /作者目录/u);
        assert.match(text, /发布目录/u);
        assert.match(text, /导出目录/u);
        assert.match(text, /资源 ID \/ 路径引用/u);
        assert.match(text, /不会被嵌入 JSON/u);
        assert.match(text, /下载备份/u);
        assert.match(text, /资源文件被删或移动/u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 导出目录包会使用可编辑包目录并生成三个包文件', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        document.getElementById('packageIdInput').value = 'custom_story_pack';
        document.getElementById('packageTitleInput').value = '自定义故事地图包';
        document.getElementById('packageDirectoryInput').value = 'assets/map_packs/current/custom_story_pack/';

        const bundle = page.buildPackageBundleFromForm();
        const files = page.buildPackageExportFiles(bundle);

        assert.equal(bundle.packageJson.packageId, 'custom_story_pack');
        assert.equal(bundle.packageJson.title, '自定义故事地图包');
        assert.deepEqual(files.map(file => file.fileName), ['package.json', 'maps.json', 'asset-manifest.json']);
        assert.equal(JSON.parse(files[0].content).packageId, 'custom_story_pack');
        assert.equal(JSON.parse(files[1].content).$schemaVersion, 'level_map_pack_v1');
        assert.equal(Array.isArray(JSON.parse(files[2].content).backgrounds), true);
        assert.match(page.getPackageDirectoryFromForm(), /assets\/map_packs\/current\/custom_story_pack\//u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 支持选择目录后写入 package.json、maps.json 与 asset-manifest.json', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const writtenFiles = {};
        const directoryHandle = {
            name: 'custom_story_pack',
            async getFileHandle(fileName, options = {}) {
                assert.equal(options.create, true);
                return {
                    async createWritable() {
                        return {
                            async write(content) {
                                writtenFiles[fileName] = content;
                            },
                            async close() {}
                        };
                    }
                };
            }
        };
        dom.window.showDirectoryPicker = async () => directoryHandle;

        await page.selectPackageDirectory();
        await page.writePackageDirectory();

        assert.deepEqual(Object.keys(writtenFiles).sort(), ['asset-manifest.json', 'maps.json', 'package.json']);
        assert.equal(JSON.parse(writtenFiles['package.json']).packageId, 'custom_story_pack');
        assert.equal(JSON.parse(writtenFiles['maps.json']).$schemaVersion, 'level_map_pack_v1');
        assert.equal(Array.isArray(JSON.parse(writtenFiles['asset-manifest.json']).nodeArts), true);
        assert.match(document.getElementById('status').textContent || '', /已写入所选包目录/u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 保存工作稿会写入 authoring 目录，发布会写入 current 目录', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const writes = [];
        page.fetchImpl = async (url, options = {}) => {
            writes.push({
                url,
                method: options.method,
                body: JSON.parse(options.body)
            });
            return {
                ok: true,
                async json() {
                    return { ok: true };
                }
            };
        };

        document.getElementById('packageIdInput').value = 'story_pack_v1';
        document.getElementById('authoringPackageDirectoryInput').value = 'assets/map_packs/authoring/story_pack_v1/';
        document.getElementById('runtimePackageDirectoryInput').value = 'assets/map_packs/current/story_pack_v1/';

        await page.saveAuthoringPackage();
        await page.publishRuntimePackage();

        assert.deepEqual(writes.map(write => write.url), ['/api/level-map-packs/save', '/api/level-map-packs/publish']);
        assert.deepEqual(writes.map(write => write.method), ['POST', 'POST']);
        assert.equal(writes[0].body.targetDirectory, 'assets/map_packs/authoring/story_pack_v1/');
        assert.equal(writes[1].body.targetDirectory, 'assets/map_packs/current/story_pack_v1/');
        assert.deepEqual(writes[0].body.files.map(file => file.fileName), ['package.json', 'maps.json', 'asset-manifest.json']);
        assert.deepEqual(writes[1].body.files.map(file => file.fileName), ['package.json', 'maps.json', 'asset-manifest.json']);
        assert.equal(JSON.parse(writes[0].body.files[0].content).packageId, 'story_pack_v1');
        assert.equal(JSON.parse(writes[1].body.files[1].content).$schemaVersion, 'level_map_pack_v1');
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
        applyMapSettingsThroughDialog();

        const exported = JSON.parse(document.getElementById('exportPreview').value);
        const map = exported.maps[0];
        const afterNode = document.querySelector('#mapCanvas .map-node[data-node-id="node_2"]');
        const mapStage = document.getElementById('mapStage');

        assert.deepEqual(map.space, { logicalWidth: 2000, logicalHeight: 1200 });
        assert.equal(map.display?.viewportAspect, '4:3');
        assert.equal(mapStage.style.aspectRatio, '4 / 3');
        assert.equal(mapStage.style.getPropertyValue('--map-aspect-ratio'), '1.333333');
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
        applyMapSettingsThroughDialog();

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
        applyMapSettingsThroughDialog();

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

test('LevelMapEditorPage 不再提供预览页强入口，画布保留素材预览和紧凑地图状态', async () => {
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
        assert.ok(previewArchiveNote, '缺少舞台状态提示');
        assert.match(previewArchiveNote.textContent || '', /收起抽屉可放大地图/u);
        assert.doesNotMatch(previewArchiveNote.textContent || '', /历史验证资产|WBS-3\.2\.3\.1/u);

        assert.ok(packFacts, '缺少包级元信息容器');
        assert.match(packFacts.textContent || '', /Map ID/u);
        assert.match(packFacts.textContent || '', /Owner/u);
        assert.match(packFacts.textContent || '', /Nodes \/ Edges/u);

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

test('level_map_editor_v1.html 是紧凑地图编辑工作台，保留可收起抽屉并移除说明页文案', async () => {
    assert.equal(fs.existsSync(pageHtmlPath), true, 'level_map_editor_v1.html 缺失');
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    for (const requiredText of [
        '地图编辑工作区',
        '工作稿',
        '加载工作稿',
        '保存工作稿',
        '发布到主流程',
        '导出包文件',
        '当前故事',
        '章节列表',
        '地图列表',
        '新建故事',
        '新建章节',
        '新建地图',
        '复制地图',
        '删除地图',
        '新增节点',
        '删除节点',
        '保存节点',
        '新增边',
        '删除边',
        '保存边',
        '地图抽屉',
        '检查器抽屉',
        '16:9',
        '地图设置',
        'package.json',
        'maps.json',
        'asset-manifest.json',
        'assets/map_packs/authoring/story_pack_v1',
        'assets/map_packs/current/story_pack_v1',
        '作者目录',
        '发布目录',
        '导出目录',
        '包 ID',
        '选择包目录',
        '下载包文件',
        '写入所选目录'
    ]) {
        assert.match(
            html,
            new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `地图编辑页缺少工作台要素：${requiredText}`
        );
    }

    for (const removedText of [
        '本页只负责地图作者编辑',
        '不会直接改战斗主流程',
        '消费 levels.json 中已存在的 levelId',
        '导入导出与 round-trip 校验不在本页完成',
        '节点检查器 / 边检查器',
        '加载 Authoring',
        '>Authoring<',
        '写回 authoring 文件',
        '应用地图设置',
        '导出 / 写回',
        '保存当前地图设置',
        '导出 / 发布',
        '交接边界',
        '地图真值 + 显示配置',
        '历史验证资产',
        'level_map_selection_mock.html',
        'level_editor_v1.html',
        '打开剧情预览页',
        '素材化地图舞台',
        '路线总览',
        '当前入口',
        '当前焦点',
        '路线语义',
        '目录包草稿'
    ]) {
        assert.doesNotMatch(
            html,
            new RegExp(removedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `地图编辑页仍保留旧舞台文案：${removedText}`
        );
    }

    assert.match(html, /class="app-toolbar"/u, '高频编辑操作应前置到顶部工具栏');
    assert.match(html, /class="toolbar-actions"/u, '顶部操作应分组承载，避免一排重按钮');
    assert.match(html, /class="tool-cluster tool-cluster--project"/u, '加载、地图设置保存和导出发布应归入地图工程操作');
    assert.doesNotMatch(html, /class="tool-cluster tool-cluster--node"/u, '节点操作不应和地图工程操作混在顶部工具栏');
    assert.doesNotMatch(html, /class="tool-cluster tool-cluster--edge"/u, '边操作不应和地图工程操作混在顶部工具栏');
    assert.match(html, /<div class="inspector-action-row" aria-label="节点操作">[\s\S]*id="addNodeBtn"[\s\S]*id="saveNodeBtn"[\s\S]*id="removeNodeBtn"/u, '节点操作应放在节点检查器内');
    assert.match(html, /<div class="inspector-action-row" aria-label="边操作">[\s\S]*id="addEdgeBtn"[\s\S]*id="saveEdgeBtn"[\s\S]*id="removeEdgeBtn"/u, '边操作应放在边检查器内');
    assert.match(html, /class="tool-cluster tool-cluster--status"/u, '状态提示应并入工具栏分组');
    assert.match(html, /class="toolbar-btn toolbar-btn--danger"/u, '危险操作应降为轻量危险按钮');
    assert.match(html, /id="storyList" class="list-box story-list-box"/u, '左侧应先提供故事列表');
    assert.match(html, /id="chapterList" class="list-box chapter-list-box"/u, '左侧应先提供章节列表');
    assert.match(html, /id="mapList" class="list-box map-list-box"/u, '左侧地图列表应属于章节之后的地图层级');
    assert.match(html, /<div class="map-action-row" aria-label="故事操作">[\s\S]*id="addStoryBtn"/u, '新建故事操作应归在故事区域');
    assert.match(html, /<div class="map-action-row" aria-label="章节操作">[\s\S]*id="addChapterBtn"/u, '新建章节操作应归在章节区域');
    assert.match(html, /<div class="map-action-row" aria-label="地图操作">[\s\S]*id="addMapBtn"[\s\S]*id="duplicateMapBtn"[\s\S]*id="removeMapBtn"/u, '地图新建复制删除应归在地图区域');
    assert.match(html, /id="authoringPackageDirectoryInput"/u, '保存工作稿应有明确作者目录');
    assert.match(html, /id="runtimePackageDirectoryInput"/u, '发布到主流程应有明确发布目录');
    assert.match(html, /id="packageDirectoryInput"/u, '导出弹窗应允许设置目标包目录');
    assert.match(html, /id="selectPackageDirectoryBtn"/u, '导出弹窗应允许选择真实目录');
    assert.match(html, /id="downloadPackageFilesBtn"/u, '导出弹窗应提供可执行下载按钮');
    assert.match(html, /id="writePackageDirectoryBtn"/u, '导出弹窗应提供可执行目录写入按钮');
    assert.match(html, /<details class="[^"]*\blevelid-panel\b[^"]*">[\s\S]*<summary>可绑定 levelId<\/summary>/u, '长 levelId 列表应默认折叠，避免污染左侧视觉');
    assert.match(html, /id="nodeList" class="list-box node-list-box"/u, '右侧节点列表应有独立高度策略');
    assert.match(html, /\.page\s*\{[\s\S]*width:\s*min\(1920px,\s*calc\(100vw - 16px\)\)/u, '页面应按 1920x1080 工作台宽度组织');
    const stageShellBlock = html.match(/\.stage-shell\s*\{(?<css>[\s\S]*?)\n\s*\}/u)?.groups?.css || '';
    assert.match(stageShellBlock, /height:\s*calc\(100vh - 118px\)/u, '主工作区应接近单屏 1080 编辑器比例');
    assert.match(stageShellBlock, /overflow:\s*hidden/u, '收起抽屉不应制造横向页面溢出');
    const stageFrameBlock = html.match(/\.stage-frame\s*\{(?<css>[\s\S]*?)\n\s*\}/u)?.groups?.css || '';
    assert.match(stageFrameBlock, /padding:\s*34px 48px 8px/u, '地图舞台应减少顶部留白');
    assert.match(stageFrameBlock, /align-items:\s*flex-start/u, '地图应向上贴近工具状态行');
    const mapStageBlock = html.match(/\.map-stage\s*\{(?<css>[\s\S]*?)\n\s*\}/u)?.groups?.css || '';
    assert.match(mapStageBlock, /width:\s*min\(100%,\s*calc\(\(100vh - 150px\) \* var\(--map-aspect-ratio,\s*1\.7778\)\)\)/u, '抽屉收起后地图应按比例放大，不应被宽度拉伸');
    const nodeListBlock = html.match(/\.node-list-box\s*,\s*\n\s*\.edge-list-box\s*\{(?<css>[\s\S]*?)\n\s*\}/u)?.groups?.css || '';
    assert.match(nodeListBlock, /max-height:\s*360px/u, '右侧节点和边列表应作为检查器主区域');
    const backgroundOptionBlock = html.match(/\.background-option\s*\{(?<css>[\s\S]*?)\n\s*\}/u)?.groups?.css || '';
    assert.match(backgroundOptionBlock, /white-space:\s*normal/u, '背景资源卡不能继承按钮 nowrap，长资源路径必须可换行');
    assert.match(html, /data-left-open="true" data-right-open="true"/u, '左右抽屉应默认展开');
    assert.match(html, /\.stage-shell\[data-left-open="false"\]\s+\.stage-frame\s*\{[\s\S]*padding-left:\s*56px/u, '左抽屉收起时中央地图应释放宽度');
    assert.match(html, /\.stage-shell\[data-right-open="false"\]\s+\.stage-frame\s*\{[\s\S]*padding-right:\s*56px/u, '右抽屉收起时中央地图应释放宽度');
    assert.match(
        html,
        /\.map-node\s*\{[\s\S]*width:\s*68px;[\s\S]*height:\s*68px;[\s\S]*scale\(var\(--node-scale,\s*1\)\)/u,
        '地图节点未把显示缩放挂到 display.nodeScale'
    );
});

test('地图编辑器默认加载三章 authoring 地图包作为可编辑工作源', async () => {
    assert.equal(fs.existsSync(pageHtmlPath), true, 'level_map_editor_v1.html 缺失');
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    assert.match(html, /assets\/map_packs\/authoring\/story_pack_v1\/package\.json/u, '编辑器默认数据源应指向 authoring 目录式地图包');
    assert.doesNotMatch(html, /mapSourceUrl:\s*['"]\.\.\/assets\/data\/level_map_pack_v1\.example\.json['"]/u, '编辑器不应继续默认加载 4 节点示例包');
});

test('三章 authoring 地图包每章不少于 10 个节点并通过工作区校验', async () => {
    const authoringMapsPath = path.join(projectRoot, 'assets', 'map_packs', 'authoring', 'story_pack_v1', 'maps.json');
    assert.equal(fs.existsSync(authoringMapsPath), true, '缺少 authoring 目录式地图包 maps.json');
    const [{ LevelMapWorkspace }] = await Promise.all([
        importSourceModule(workspaceModulePath)
    ]);
    const rawPack = JSON.parse(await fsp.readFile(authoringMapsPath, 'utf8'));
    const rawLevels = JSON.parse(await fsp.readFile(levelsJsonPath, 'utf8'));
    const workspace = new LevelMapWorkspace(rawPack, { levelsDocument: rawLevels });
    const exported = workspace.exportDocument();

    assert.equal(exported.meta?.id, 'story_level_map_authoring_pack');
    assert.equal(exported.maps.length, 3, 'authoring 地图包必须包含三张地图');
    exported.maps.forEach((map) => {
        assert.equal(map.nodes.length >= 10, true, `${map.id} 节点数不足 10`);
        assert.equal(map.edges.length >= 9, true, `${map.id} 连线数不足以表达地图路径`);
        assert.equal(Boolean(map.entryNodeId), true, `${map.id} 缺少入口节点`);
        assert.equal(new Set(map.nodes.map(node => node.id)).has(map.entryNodeId), true, `${map.id} 入口节点不存在`);
    });
    assert.deepEqual(workspace.validateDocument(), []);
});

test('LevelMapEditorPage 节点使用类型符号标记，不依赖彩色标签区分类型', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const node = document.querySelector('#mapCanvas .map-node[data-node-id="node_1"]');
        const kindMark = node?.querySelector('.map-node__kind-mark');
        const nodeLabel = node?.querySelector('.map-node__label');

        assert.ok(node, '缺少地图节点');
        assert.ok(kindMark, '节点缺少类型符号标记');
        assert.equal(kindMark.getAttribute('aria-hidden'), 'true');
        assert.match(kindMark.textContent || '', /⚔|✦|◆|☩|♛/u, '类型符号必须是可见符号，而不是颜色差异');
        assert.ok(nodeLabel, '节点仍需要保留弱标签便于编辑定位');
        assert.equal(document.querySelector('#mapCanvas .map-node__kind-color'), null, '不应渲染颜色专用类型标记');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelMapEditorPage 连线使用统一地图墨线，不用随机彩色线区分类型', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultDocuments();

        const edgeGroup = document.querySelector('#mapCanvas .map-edge-group[data-edge-id="edge_1"]');
        assert.ok(edgeGroup, '缺少地图连线');
        assert.equal(edgeGroup.style.getPropertyValue('--edge-route'), 'rgba(70, 55, 34, 0.86)');
        assert.equal(edgeGroup.style.getPropertyValue('--edge-halo'), 'rgba(246, 224, 173, 0.32)');
        assert.doesNotMatch(edgeGroup.getAttribute('style') || '', /hsl/iu, '连线不应继续使用基于 hash 的随机彩色 HSL');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});
