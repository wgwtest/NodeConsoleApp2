import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const repoRoot = path.resolve(import.meta.dirname, '..');
const workspaceModulePath = path.join(repoRoot, 'script', 'editor', 'level', 'LevelMapWorkspace.js');
const assetResolverModulePath = path.join(repoRoot, 'script', 'editor', 'level', 'LevelMapAssetResolver.js');

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

async function importWorkspaceModule() {
    assert.equal(
        fs.existsSync(workspaceModulePath),
        true,
        'LevelMapWorkspace.js 缺失，地图编辑器还没有正式工作区核心'
    );
    let source = await fsp.readFile(workspaceModulePath, 'utf8');
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

test('LevelMapWorkspace 可以新增节点、移动节点并维护边关系与背景', async () => {
    const { LevelMapWorkspace } = await importWorkspaceModule();
    const workspace = new LevelMapWorkspace(buildFixtureMapPack(), {
        levelsDocument: buildFixtureLevelsDoc()
    });

    const createdNodeId = workspace.createNode('map_chapter_1', {
        id: 'node_3',
        levelId: 'level_1_3',
        label: '1-3',
        title: '废墟关口',
        kind: 'boss',
        nodeSkinRef: 'skin_story_boss',
        position: { x: 1240, y: 450 }
    });
    workspace.moveNode('map_chapter_1', createdNodeId, { x: 1280, y: 500 });
    const createdEdgeId = workspace.createEdge('map_chapter_1', {
        id: 'edge_2',
        fromNodeId: 'node_2',
        toNodeId: createdNodeId,
        branchLabel: '汇合到首领'
    });
    workspace.setBackgroundRef('map_chapter_1', 'bg_map_glade_03');

    const map = workspace.getMap('map_chapter_1');
    const createdNode = map.nodes.find(node => node.id === createdNodeId);
    const createdEdge = map.edges.find(edge => edge.id === createdEdgeId);

    assert.equal(Object.hasOwn(map.edges[0], 'type'), false, '旧地图包导入后不应继续保留边类型');
    assert.equal(createdNode.levelId, 'level_1_3');
    assert.deepEqual(createdNode.position, { x: 1280, y: 500 });
    assert.equal(createdNode.nodeSkinRef, 'skin_story_boss');
    assert.equal(Object.hasOwn(createdEdge, 'type'), false);
    assert.equal(createdEdge.branchLabel, '汇合到首领');
    assert.equal(map.backgroundRef, 'bg_map_glade_03');
    assert.deepEqual(map.space, { logicalWidth: 1600, logicalHeight: 900 });
    assert.equal(map.display.nodeScale, 0.6);
});

test('LevelMapWorkspace 删除节点时会清理关联边和预览模式残留', async () => {
    const { LevelMapWorkspace } = await importWorkspaceModule();
    const workspace = new LevelMapWorkspace(buildFixtureMapPack(), {
        levelsDocument: buildFixtureLevelsDoc()
    });

    workspace.removeNode('map_chapter_1', 'node_2');
    const map = workspace.getMap('map_chapter_1');
    const mode = map.previewModes[0];

    assert.equal(map.nodes.some(node => node.id === 'node_2'), false, '节点未删除');
    assert.equal(map.edges.some(edge => edge.fromNodeId === 'node_2' || edge.toNodeId === 'node_2'), false, '关联边未清理');
    assert.equal(mode.unlockedNodeIds.includes('node_2'), false, '预览模式仍保留已删节点');
    assert.equal(mode.focusNodeId === 'node_2', false, '预览模式焦点未回退');
});

test('LevelMapWorkspace 会校验 levelId、entryNodeId 与边引用完整性', async () => {
    const { LevelMapWorkspace } = await importWorkspaceModule();
    const workspace = new LevelMapWorkspace(buildFixtureMapPack(), {
        levelsDocument: buildFixtureLevelsDoc()
    });

    workspace.updateNode('map_chapter_1', 'node_2', (node) => ({
        ...node,
        levelId: 'level_missing',
        artRefs: {
            nodeArt: 'node_missing_art',
            portrait: 'portrait_missing_art'
        }
    }));
    workspace.updateMap('map_chapter_1', (map) => ({
        ...map,
        entryNodeId: 'node_missing',
        edges: [
            ...map.edges,
            {
                id: 'edge_missing_node',
                fromNodeId: 'node_1',
                toNodeId: 'node_missing',
                type: 'branch',
                branchLabel: '失效边'
            }
        ]
    }));

    const issueCodes = workspace.validateDocument().map(issue => issue.code).sort();
    assert.deepEqual(
        issueCodes,
        ['missing_entry_node', 'missing_level_ref', 'missing_node_art_ref', 'missing_node_ref', 'missing_portrait_ref'],
        '地图工作区应能稳定产出字段级问题码'
    );
});

test('LevelMapWorkspace 会把旧 maps 兼容成单故事包章节结构并支持地图级管理', async () => {
    const { LevelMapWorkspace } = await importWorkspaceModule();
    const workspace = new LevelMapWorkspace(buildFixtureMapPack(), {
        levelsDocument: buildFixtureLevelsDoc()
    });

    const initialDocument = workspace.exportDocument();
    assert.equal(Array.isArray(initialDocument.stories), true, '导出结果应包含 stories[]');
    assert.equal(initialDocument.stories[0].id, 'story_default');
    assert.deepEqual(initialDocument.stories[0].chapterIds, ['chapter_1']);
    assert.deepEqual(initialDocument.chapters.map(chapter => [chapter.id, chapter.mapIds]), [
        ['chapter_1', ['map_chapter_1']]
    ]);

    assert.throws(
        () => workspace.createStory({
            id: 'story_north',
            title: '北境故事',
            summary: '霜雾边境线'
        }),
        /一个地图包只能承载一个故事/u,
        '同一个地图包不应允许追加第二个故事'
    );

    const storyId = initialDocument.stories[0].id;
    const chapterId = workspace.createChapter(storyId, {
        id: 'chapter_north_1',
        title: '霜雾峡谷',
        description: '当前故事包内的第二个章节'
    });
    const mapId = workspace.createMap(chapterId, {
        id: 'map_north_entry',
        name: '霜雾入口'
    });
    const copiedMapId = workspace.duplicateMap(mapId, {
        id: 'map_north_entry_copy',
        name: '霜雾入口复制'
    });
    workspace.removeMap(mapId);

    const exported = workspace.exportDocument();
    const currentStory = exported.stories.find(story => story.id === storyId);
    const northChapter = exported.chapters.find(chapter => chapter.id === chapterId);

    assert.equal(exported.stories.length, 1, '一个地图包应只导出一个故事');
    assert.deepEqual(currentStory.chapterIds, ['chapter_1', 'chapter_north_1']);
    assert.equal(northChapter.storyId, storyId);
    assert.equal(northChapter.entryMapId, copiedMapId);
    assert.deepEqual(northChapter.mapIds, ['map_north_entry_copy']);
    assert.equal(exported.maps.some(map => map.id === mapId), false, '删除地图后 maps[] 不应保留旧地图');
    assert.equal(exported.maps.find(map => map.id === copiedMapId)?.chapterId, chapterId);
});

test('LevelMapWorkspace 会把导入的多故事地图包收口为单故事包', async () => {
    const { LevelMapWorkspace } = await importWorkspaceModule();
    const rawPack = buildFixtureMapPack();
    rawPack.stories = [
        {
            id: 'story_default',
            title: '主故事',
            entryChapterId: 'chapter_1',
            chapterIds: ['chapter_1']
        },
        {
            id: 'story_extra',
            title: '错误的第二故事',
            entryChapterId: 'chapter_extra',
            chapterIds: ['chapter_extra']
        }
    ];
    rawPack.chapters = [
        {
            id: 'chapter_1',
            storyId: 'story_default',
            title: '第一章',
            order: 1,
            entryMapId: 'map_chapter_1',
            mapIds: ['map_chapter_1']
        },
        {
            id: 'chapter_extra',
            storyId: 'story_extra',
            title: '额外章节',
            order: 2,
            entryMapId: 'map_extra',
            mapIds: ['map_extra']
        }
    ];
    rawPack.maps.push({
        ...JSON.parse(JSON.stringify(rawPack.maps[0])),
        id: 'map_extra',
        name: '额外地图',
        chapterId: 'chapter_extra'
    });

    const workspace = new LevelMapWorkspace(rawPack, {
        levelsDocument: buildFixtureLevelsDoc()
    });
    const exported = workspace.exportDocument();
    const bundle = workspace.exportPackageBundle({
        packageId: 'story_pack_v1',
        packageTitle: '故事地图包 v1'
    });

    assert.deepEqual(exported.stories.map(story => story.id), ['story_default']);
    assert.deepEqual(exported.chapters.map(chapter => chapter.storyId), ['story_default', 'story_default']);
    assert.deepEqual(exported.stories[0].chapterIds, ['chapter_1', 'chapter_extra']);
    assert.deepEqual(bundle.packageJson.stories.map(story => story.id), ['story_default']);
});

test('LevelMapWorkspace 能创建新的单故事地图包文档模板', async () => {
    const { LevelMapWorkspace } = await importWorkspaceModule();
    const baseWorkspace = new LevelMapWorkspace(buildFixtureMapPack(), {
        levelsDocument: buildFixtureLevelsDoc()
    });
    const document = LevelMapWorkspace.createNewPackageDocument({
        packageId: 'new_story_pack',
        packageTitle: '新故事包',
        baseDocument: baseWorkspace.exportDocument(),
        levelsDocument: buildFixtureLevelsDoc()
    });
    const workspace = new LevelMapWorkspace(document, {
        levelsDocument: buildFixtureLevelsDoc()
    });
    const exported = workspace.exportDocument();

    assert.equal(exported.meta.id, 'new_story_pack');
    assert.equal(exported.meta.title, '新故事包');
    assert.deepEqual(exported.stories.map(story => [story.id, story.title]), [['story_default', '新故事包']]);
    assert.deepEqual(exported.chapters.map(chapter => [chapter.id, chapter.storyId]), [['chapter_1', 'story_default']]);
    assert.deepEqual(exported.maps.map(map => [map.id, map.chapterId]), [['map_chapter_1', 'chapter_1']]);
    assert.equal(exported.maps[0].nodes[0].levelId, 'level_1_1');
    assert.equal(exported.maps[0].backgroundRef, 'bg_map_glade_01');
    assert.equal(exported.assetLibrary.backgrounds.length, 2, '新建包应继承当前资源库，避免新包没有背景可选');
});

test('LevelMapWorkspace 能导出目录式地图包 bundle 草稿', async () => {
    const { LevelMapWorkspace } = await importWorkspaceModule();
    const workspace = new LevelMapWorkspace(buildFixtureMapPack(), {
        levelsDocument: buildFixtureLevelsDoc()
    });

    const bundle = workspace.exportPackageBundle({
        packageId: 'story_pack_v1',
        packageTitle: '故事地图包 v1'
    });

    assert.equal(bundle.packageJson.$schemaVersion, 'level_map_package_v1');
    assert.equal(bundle.packageJson.packageId, 'story_pack_v1');
    assert.equal(bundle.packageJson.files.maps, 'maps.json');
    assert.equal(bundle.packageJson.assets.manifest, 'asset-manifest.json');
    assert.equal(bundle.mapsJson.$schemaVersion, 'level_map_pack_v1');
    assert.deepEqual(bundle.packageJson.stories.map(story => story.id), ['story_default']);
    assert.equal(bundle.assetManifest.backgrounds.length >= 1, true);
    assert.equal(bundle.assetManifest.backgrounds[0].packagePath.startsWith('assets/backgrounds/'), true);
    assert.equal(bundle.assetManifest.nodeArts[0].packagePath.startsWith('assets/nodeArts/'), true);
    assert.equal(bundle.assetManifest.portraits[0].packagePath.startsWith('assets/portraits/'), true);
});
