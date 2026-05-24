import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pageModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelDetailEditorPage.js');
const workspaceModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelDetailWorkspace.js');
const pageHtmlPath = path.join(projectRoot, 'test', 'level_detail_editor_v1.html');

function buildMapDoc() {
    return {
        $schemaVersion: 'level_map_pack_v1',
        meta: { id: 'story_pack_v1', title: '故事关卡地图 Authoring 工作包' },
        stories: [{ id: 'story_default', title: '故事关卡地图 Authoring 工作包', entryChapterId: 'chapter_1', chapterIds: ['chapter_1'] }],
        chapters: [{ id: 'chapter_1', storyId: 'story_default', title: '幽暗森林', order: 1, entryMapId: 'map_1', mapIds: ['map_1'] }],
        assetLibrary: {
            backgrounds: [{ id: 'bg_forest_01', label: '森林战斗', src: '../assets/images/level_map/backgrounds/bg_forest_canopy.svg' }]
        },
        maps: [{
            id: 'map_1',
            name: '林冠伏击线',
            chapterId: 'chapter_1',
            backgroundRef: 'bg_forest_01',
            entryNodeId: 'node_1',
            nodes: [
                { id: 'node_1', levelId: 'level_1_1', label: '1-1', title: '森林边缘', kind: 'battle', position: { x: 100, y: 200 } },
                { id: 'node_2', levelId: '', label: '1-2', title: '林冠伏击', kind: 'battle', position: { x: 320, y: 240 } }
            ],
            edges: [{ id: 'edge_1', fromNodeId: 'node_1', toNodeId: 'node_2', type: 'main', branchLabel: '推进' }]
        }]
    };
}

function buildMultiChapterMapDoc() {
    return {
        $schemaVersion: 'level_map_pack_v1',
        meta: { id: 'story_pack_v1', title: '故事关卡地图 Authoring 工作包' },
        stories: [{
            id: 'story_default',
            title: '故事关卡地图 Authoring 工作包',
            entryChapterId: 'chapter_1',
            chapterIds: ['chapter_1', 'chapter_2', 'chapter_3']
        }],
        chapters: [
            { id: 'chapter_1', storyId: 'story_default', title: '幽暗森林', order: 1, entryMapId: 'map_1', mapIds: ['map_1'] },
            { id: 'chapter_2', storyId: 'story_default', title: '霜雾峡谷', order: 2, entryMapId: 'map_2', mapIds: ['map_2'] },
            { id: 'chapter_3', storyId: 'story_default', title: '暮色古道', order: 3, entryMapId: 'map_3', mapIds: ['map_3'] }
        ],
        assetLibrary: {
            backgrounds: [{ id: 'bg_forest_01', label: '森林战斗', src: '../assets/images/level_map/backgrounds/bg_forest_canopy.svg' }]
        },
        maps: [
            {
                id: 'map_1',
                name: '林冠伏击线',
                chapterId: 'chapter_1',
                backgroundRef: 'bg_forest_01',
                entryNodeId: 'node_1_1',
                nodes: [
                    { id: 'node_1_1', levelId: 'level_1_1', label: '1-1', title: '森林边缘', kind: 'battle', position: { x: 100, y: 200 } },
                    { id: 'node_1_2', levelId: 'level_1_2', label: '1-2', title: '林冠伏击', kind: 'battle', position: { x: 320, y: 240 } }
                ],
                edges: [{ id: 'edge_1', fromNodeId: 'node_1_1', toNodeId: 'node_1_2', type: 'main', branchLabel: '推进' }]
            },
            {
                id: 'map_2',
                name: '冰桥断口线',
                chapterId: 'chapter_2',
                backgroundRef: 'bg_forest_01',
                entryNodeId: 'node_2_1',
                nodes: [
                    { id: 'node_2_1', levelId: 'level_2_1', label: '2-1', title: '峡谷哨点', kind: 'battle', position: { x: 120, y: 220 } },
                    { id: 'node_2_2', levelId: 'level_2_2', label: '2-2', title: '霜雾冰桥', kind: 'battle', position: { x: 340, y: 260 } }
                ],
                edges: [{ id: 'edge_2', fromNodeId: 'node_2_1', toNodeId: 'node_2_2', type: 'main', branchLabel: '推进' }]
            },
            {
                id: 'map_3',
                name: '暮色古道线',
                chapterId: 'chapter_3',
                backgroundRef: 'bg_forest_01',
                entryNodeId: 'node_3_1',
                nodes: [
                    { id: 'node_3_1', levelId: 'level_3_1', label: '3-1', title: '古道入口', kind: 'battle', position: { x: 140, y: 210 } },
                    { id: 'node_3_2', levelId: 'level_3_2', label: '3-2', title: '暮色祭坛', kind: 'battle', position: { x: 360, y: 250 } }
                ],
                edges: [{ id: 'edge_3', fromNodeId: 'node_3_1', toNodeId: 'node_3_2', type: 'main', branchLabel: '推进' }]
            }
        ]
    };
}

function buildLevelsDoc() {
    return {
        $schemaVersion: 'levels_v1_wrapped',
        meta: { enums: { backgrounds: ['bg_forest_01'], slotLayoutIds: ['default_v1'], waveTypes: ['fixed'] } },
        enemyPools: {
            pool_level_1_1_primary: {
                id: 'pool_level_1_1_primary',
                name: '森林边缘敌人',
                members: [{ templateId: 'goblin_story_headhunter', position: 1 }]
            }
        },
        levels: {
            level_1_1: {
                id: 'level_1_1',
                name: '森林边缘',
                description: '入口战斗。',
                flow: { kind: 'story', order: 1, chapterId: 'chapter_1', nodeLabel: '1-1', objectiveText: '进入森林' },
                selectionMeta: { difficultyLabel: '标准', buildHint: '稳住节奏' },
                background: 'bg_forest_01',
                battleRules: { slotLayoutId: 'default_v1', victoryCondition: { type: 'defeat_all_enemies' }, failureCondition: { type: 'player_hp_zero' } },
                waves: [{ waveId: 'wave_1', waveType: 'fixed', enemyPoolId: 'pool_level_1_1_primary' }],
                rewards: { exp: 100, gold: 50, kp: 1 }
            }
        }
    };
}

function buildEnemiesDoc() {
    return {
        goblin_story_headhunter: {
            id: 'goblin_story_headhunter',
            name: '林冠哥布林追猎手',
            race: 'goblin',
            class: 'hunter',
            stats: { hp: 36, maxHp: 36, ap: 3, speed: 14 },
            skills: ['skill_bite', 'skill_ambush']
        },
        skeleton_guard: {
            id: 'skeleton_guard',
            name: '骷髅守卫',
            race: 'undead',
            class: 'guard',
            stats: { hp: 52, maxHp: 52, ap: 2, speed: 8 },
            skills: ['skill_bash']
        }
    };
}

async function importSourceModule(filePath) {
    assert.equal(fs.existsSync(filePath), true, `缺少源文件: ${filePath}`);
    let source = await fsp.readFile(filePath, 'utf8');
    if (source.includes('./LevelDetailWorkspace.js')) {
        const workspaceSource = await fsp.readFile(workspaceModulePath, 'utf8');
        const workspaceEncoded = Buffer.from(workspaceSource, 'utf8').toString('base64');
        source = source.replace(
            "'./LevelDetailWorkspace.js'",
            `'data:text/javascript;base64,${workspaceEncoded}'`
        );
    }
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

function installDomGlobals(dom) {
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Event = dom.window.Event;
}

function cleanupDomGlobals() {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.Event;
}

async function createPageContext() {
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:3121/test/level_detail_editor_v1.html'
    });
    installDomGlobals(dom);
    const { LevelDetailEditorPage } = await importSourceModule(pageModulePath);
    const page = new LevelDetailEditorPage({ document });
    page.bind();
    page.loadDocuments(buildMapDoc(), buildLevelsDoc(), buildEnemiesDoc());
    return { dom, page };
}

function createEmptyPageContext(options = {}) {
    return fsp.readFile(pageHtmlPath, 'utf8').then(async (html) => {
        const dom = new JSDOM(html, {
            url: 'http://127.0.0.1:3121/test/level_detail_editor_v1.html'
        });
        installDomGlobals(dom);
        const { LevelDetailEditorPage } = await importSourceModule(pageModulePath);
        const page = new LevelDetailEditorPage({
            document,
            mapSourceUrl: options.mapSourceUrl || '../assets/map_packs/authoring/story_pack_v1/package.json',
            levelSourceUrl: options.levelSourceUrl || '../assets/data/levels.json',
            enemySourceUrl: options.enemySourceUrl || '../assets/data/enemies.json',
            fetchImpl: options.fetchImpl
        });
        page.bind();
        return { dom, page };
    });
}

test('level detail editor renders package paths, node tree, detail form, and inspector', async () => {
    const { dom } = await createPageContext();
    try {
        assert.match(document.getElementById('authoringPathText').textContent, /assets\/map_packs\/authoring\/story_pack_v1\/package\.json/u);
        assert.match(document.getElementById('runtimePathText').textContent, /assets\/map_packs\/current\/story_pack_v1\/package\.json/u);
        assert.equal(document.querySelectorAll('#nodeTreeList .node-row').length, 2);
        assert.equal(document.getElementById('levelNameInput').value, '森林边缘');
        assert.equal(document.getElementById('enemyTemplateSelect').value, 'goblin_story_headhunter');
        assert.equal(document.getElementById('rewardExpInput').value, '100');
        assert.match(document.getElementById('bindingSummary').textContent, /node_1/u);
        assert.match(document.getElementById('fileWriteList').textContent, /levels\.json/u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('level detail editor loads package-local maps, levels, asset manifest, and enemies', async () => {
    const fetchedUrls = [];
    const responses = new Map([
        ['../assets/map_packs/authoring/story_pack_v1/package.json', {
            $schemaVersion: 'level_map_package_v1',
            packageId: 'story_pack_v1',
            title: '故事关卡地图 Authoring 工作包',
            files: { maps: 'maps.json', levels: 'levels.json' },
            assets: { manifest: 'asset-manifest.json' }
        }],
        ['../assets/map_packs/authoring/story_pack_v1/maps.json', buildMapDoc()],
        ['../assets/map_packs/authoring/story_pack_v1/levels.json', buildLevelsDoc()],
        ['../assets/map_packs/authoring/story_pack_v1/asset-manifest.json', { backgrounds: [] }],
        ['../assets/data/enemies.json', buildEnemiesDoc()]
    ]);
    const fetchImpl = async (url) => {
        fetchedUrls.push(url);
        const payload = responses.get(url);
        assert.notEqual(payload, undefined, `未预期的 fetch: ${url}`);
        return {
            ok: true,
            status: 200,
            async json() {
                return payload;
            }
        };
    };

    const { dom, page } = await createEmptyPageContext({ fetchImpl });
    try {
        await page.loadDefaultDocuments();

        assert.deepEqual(fetchedUrls, [
            '../assets/map_packs/authoring/story_pack_v1/package.json',
            '../assets/map_packs/authoring/story_pack_v1/maps.json',
            '../assets/map_packs/authoring/story_pack_v1/levels.json',
            '../assets/map_packs/authoring/story_pack_v1/asset-manifest.json',
            '../assets/data/enemies.json'
        ]);
        assert.equal(document.getElementById('levelNameInput').value, '森林边缘');
        assert.equal(document.getElementById('enemyTemplateSelect').value, 'goblin_story_headhunter');
        assert.match(document.getElementById('fileWriteList').textContent, /levels\.json/u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('left drawer scopes node list to the selected chapter map and switches maps explicitly', async () => {
    const { dom, page } = await createEmptyPageContext();
    try {
        page.loadDocuments(buildMultiChapterMapDoc(), buildLevelsDoc(), buildEnemiesDoc());

        assert.equal(document.querySelectorAll('#chapterMapList .map-row').length, 3);
        assert.equal(document.querySelectorAll('#chapterMapList .chapter-row').length, 0);
        assert.doesNotMatch(document.getElementById('chapterMapList').textContent, /张地图/u);

        const selectedMapButton = document.querySelector('#chapterMapList .map-row.is-selected');
        assert.match(selectedMapButton?.textContent || '', /幽暗森林/u);
        assert.match(selectedMapButton?.textContent || '', /林冠伏击线/u);

        const initialNodeText = [...document.querySelectorAll('#nodeTreeList .node-row')]
            .map(row => row.textContent.replace(/\s+/gu, ' ').trim())
            .join(' / ');
        assert.match(initialNodeText, /1-1/u);
        assert.match(initialNodeText, /1-2/u);
        assert.doesNotMatch(initialNodeText, /2-1|2-2|3-1|3-2/u);

        document.querySelector('[data-map-id="map_2"]').click();

        assert.equal(page.selectedMapId, 'map_2');
        assert.equal(page.selectedNodeId, 'node_2_1');
        assert.match(document.querySelector('#chapterMapList .map-row.is-selected')?.textContent || '', /冰桥断口线/u);

        const switchedNodeText = [...document.querySelectorAll('#nodeTreeList .node-row')]
            .map(row => row.textContent.replace(/\s+/gu, ' ').trim())
            .join(' / ');
        assert.match(switchedNodeText, /2-1/u);
        assert.match(switchedNodeText, /2-2/u);
        assert.doesNotMatch(switchedNodeText, /1-1|1-2|3-1|3-2/u);
        assert.match(document.getElementById('nodePathText').textContent, /霜雾峡谷 \/ 冰桥断口线 \/ 2-1/u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('level detail editor saves and publishes the story package with package-local levels.json', async () => {
    const { dom, page } = await createPageContext();
    try {
        const writes = [];
        page.fetchImpl = async (url, options = {}) => {
            writes.push({
                url,
                method: options.method,
                body: JSON.parse(options.body)
            });
            return {
                ok: true,
                status: 200,
                async json() {
                    return { ok: true, targetDirectory: JSON.parse(options.body).targetDirectory };
                }
            };
        };

        await page.saveAuthoringPackage();
        await page.publishRuntimePackage();

        assert.deepEqual(writes.map(write => write.url), [
            '/api/level-map-packs/save',
            '/api/level-map-packs/publish'
        ]);
        assert.equal(writes[0].body.targetDirectory, 'assets/map_packs/authoring/story_pack_v1/');
        assert.equal(writes[1].body.targetDirectory, 'assets/map_packs/current/story_pack_v1/');
        assert.deepEqual(writes[0].body.files.map(file => file.fileName), [
            'package.json',
            'maps.json',
            'levels.json',
            'asset-manifest.json'
        ]);
        const packageJson = JSON.parse(writes[0].body.files[0].content);
        const levelsJson = JSON.parse(writes[0].body.files[2].content);
        assert.equal(packageJson.files.levels, 'levels.json');
        assert.equal(levelsJson.levels.level_1_1.primaryEnemy.templateId, 'goblin_story_headhunter');
        assert.match(document.getElementById('levelDetailStatus').textContent, /assets\/map_packs\/current\/story_pack_v1\/package\.json/u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('selecting an unbound map node creates and renders a derived level detail', async () => {
    const { dom, page } = await createPageContext();
    try {
        page.selectNode('map_1', 'node_2');
        assert.equal(document.getElementById('levelNameInput').value, '林冠伏击');
        assert.equal(document.getElementById('nodeIdText').textContent, 'node_2');
        assert.equal(document.getElementById('levelIdText').textContent, 'level_map_1_node_2');
        assert.equal(page.workspace.getNode('map_1', 'node_2').levelId, 'level_map_1_node_2');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('level detail editor honors mapId/nodeId query parameters from map editor', async () => {
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:3121/test/level_detail_editor_v1.html?mapId=map_1&nodeId=node_2'
    });
    installDomGlobals(dom);
    try {
        const { LevelDetailEditorPage } = await importSourceModule(pageModulePath);
        const page = new LevelDetailEditorPage({ document, window: dom.window });
        page.bind();
        page.loadDocuments(buildMapDoc(), buildLevelsDoc(), buildEnemiesDoc());

        assert.equal(page.selectedMapId, 'map_1');
        assert.equal(page.selectedNodeId, 'node_2');
        assert.equal(document.getElementById('nodeIdText').textContent, 'node_2');
        assert.equal(document.getElementById('levelIdText').textContent, 'level_map_1_node_2');
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('enemy selector updates the selected level primary enemy', async () => {
    const { dom, page } = await createPageContext();
    try {
        const select = document.getElementById('enemyTemplateSelect');
        select.value = 'skeleton_guard';
        select.dispatchEvent(new window.Event('change', { bubbles: true }));

        const levelId = page.getCurrentLevel().id;
        assert.equal(page.workspace.getPrimaryEnemy(levelId).templateId, 'skeleton_guard');
        assert.match(document.getElementById('enemySummary').textContent, /骷髅守卫/u);
        assert.match(document.getElementById('runtimeProjection').textContent, /skeleton_guard/u);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});
