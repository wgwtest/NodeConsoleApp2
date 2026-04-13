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
        type: 'merge',
        branchLabel: '汇合到首领'
    });
    workspace.setBackgroundRef('map_chapter_1', 'bg_map_glade_03');

    const map = workspace.getMap('map_chapter_1');
    const createdNode = map.nodes.find(node => node.id === createdNodeId);
    const createdEdge = map.edges.find(edge => edge.id === createdEdgeId);

    assert.equal(createdNode.levelId, 'level_1_3');
    assert.deepEqual(createdNode.position, { x: 1280, y: 500 });
    assert.equal(createdNode.nodeSkinRef, 'skin_story_boss');
    assert.equal(createdEdge.type, 'merge');
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
