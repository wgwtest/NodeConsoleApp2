import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const repoRoot = path.resolve(import.meta.dirname, '..');
const workspaceModulePath = path.join(repoRoot, 'script', 'editor', 'level', 'LevelDetailWorkspace.js');

function buildMapDoc() {
    return {
        $schemaVersion: 'level_map_pack_v1',
        meta: { id: 'story_pack_v1', title: '测试故事包' },
        stories: [
            {
                id: 'story_default',
                title: '测试故事',
                entryChapterId: 'chapter_1',
                chapterIds: ['chapter_1']
            }
        ],
        chapters: [
            {
                id: 'chapter_1',
                storyId: 'story_default',
                title: '幽暗森林',
                order: 1,
                entryMapId: 'map_1',
                mapIds: ['map_1']
            }
        ],
        assetLibrary: {
            backgrounds: [
                { id: 'bg_map_forest', label: '地图背景', src: 'assets/bg-map.svg' }
            ],
            battleBackgrounds: [
                { id: 'bg_forest_01', label: '森林战斗', src: 'assets/bg-battle.svg' }
            ]
        },
        maps: [
            {
                id: 'map_1',
                name: '林冠伏击线',
                chapterId: 'chapter_1',
                backgroundRef: 'bg_map_forest',
                entryNodeId: 'node_1',
                nodes: [
                    {
                        id: 'node_1',
                        levelId: 'level_1_1',
                        label: '1-1',
                        title: '森林边缘',
                        kind: 'battle',
                        position: { x: 100, y: 200 }
                    },
                    {
                        id: 'node_2',
                        levelId: '',
                        label: '1-2',
                        title: '林冠伏击',
                        kind: 'battle',
                        position: { x: 320, y: 240 }
                    }
                ],
                edges: [
                    {
                        id: 'edge_1',
                        fromNodeId: 'node_1',
                        toNodeId: 'node_2',
                        type: 'main',
                        branchLabel: '推进'
                    }
                ]
            }
        ]
    };
}

function buildLevelsDoc() {
    return {
        $schemaVersion: 'levels_v1_wrapped',
        meta: {
            enums: {
                backgrounds: ['bg_forest_01'],
                slotLayoutIds: ['default_v1'],
                waveTypes: ['fixed']
            }
        },
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
                flow: {
                    kind: 'story',
                    order: 1,
                    chapterId: 'chapter_1',
                    nodeLabel: '1-1',
                    objectiveText: '进入森林'
                },
                selectionMeta: {
                    difficultyLabel: '标准',
                    buildHint: '稳住节奏'
                },
                background: 'bg_forest_01',
                battleRules: {
                    slotLayoutId: 'default_v1',
                    victoryCondition: { type: 'defeat_all_enemies' },
                    failureCondition: { type: 'player_hp_zero' }
                },
                waves: [
                    {
                        waveId: 'wave_1',
                        waveType: 'fixed',
                        enemyPoolId: 'pool_level_1_1_primary'
                    }
                ],
                rewards: { exp: 100, gold: 50, kp: 1 }
            }
        }
    };
}

async function importWorkspaceModule() {
    assert.equal(fs.existsSync(workspaceModulePath), true, 'LevelDetailWorkspace.js should exist');
    const source = await fsp.readFile(workspaceModulePath, 'utf8');
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

test('LevelDetailWorkspace lists node level summaries in map order', async () => {
    const { LevelDetailWorkspace } = await importWorkspaceModule();
    const workspace = new LevelDetailWorkspace({
        mapDocument: buildMapDoc(),
        levelsDocument: buildLevelsDoc(),
        enemiesDocument: { goblin_story_headhunter: { id: 'goblin_story_headhunter', name: '追猎手' } }
    });

    const summaries = workspace.listNodeLevelSummaries({ mapId: 'map_1' });
    assert.deepEqual(summaries.map(item => item.nodeId), ['node_1', 'node_2']);
    assert.equal(summaries[0].levelId, 'level_1_1');
    assert.equal(summaries[0].hasLevelDetail, true);
    assert.equal(summaries[1].hasLevelDetail, false);
});

test('ensureLevelForNode creates a level detail and binds the map node', async () => {
    const { LevelDetailWorkspace } = await importWorkspaceModule();
    const workspace = new LevelDetailWorkspace({
        mapDocument: buildMapDoc(),
        levelsDocument: buildLevelsDoc(),
        enemiesDocument: {}
    });

    const level = workspace.ensureLevelForNode({ mapId: 'map_1', nodeId: 'node_2' });
    assert.equal(level.id, 'level_map_1_node_2');
    assert.equal(level.name, '林冠伏击');
    assert.equal(level.flow.chapterId, 'chapter_1');
    assert.equal(level.flow.nodeLabel, '1-2');
    assert.equal(workspace.getNode('map_1', 'node_2').levelId, 'level_map_1_node_2');
    assert.equal(workspace.getPrimaryEnemy(level.id).templateId, '');
});

test('setPrimaryEnemy stores single-enemy intent and exports runtime-compatible wave projection', async () => {
    const { LevelDetailWorkspace } = await importWorkspaceModule();
    const workspace = new LevelDetailWorkspace({
        mapDocument: buildMapDoc(),
        levelsDocument: buildLevelsDoc(),
        enemiesDocument: { skeleton_guard: { id: 'skeleton_guard', name: '骷髅守卫' } }
    });

    const level = workspace.ensureLevelForNode({ mapId: 'map_1', nodeId: 'node_2' });
    workspace.setPrimaryEnemy(level.id, 'skeleton_guard');

    assert.equal(workspace.getPrimaryEnemy(level.id).templateId, 'skeleton_guard');
    const exported = workspace.exportRuntimeLevelsDocument();
    const poolId = exported.levels[level.id].waves[0].enemyPoolId;
    assert.equal(exported.enemyPools[poolId].members.length, 1);
    assert.equal(exported.enemyPools[poolId].members[0].templateId, 'skeleton_guard');
});

test('validatePackage reports missing enemy and background while keeping current node path', async () => {
    const { LevelDetailWorkspace } = await importWorkspaceModule();
    const workspace = new LevelDetailWorkspace({
        mapDocument: buildMapDoc(),
        levelsDocument: buildLevelsDoc(),
        enemiesDocument: {}
    });

    const level = workspace.ensureLevelForNode({ mapId: 'map_1', nodeId: 'node_2' });
    workspace.setBattleBackground(level.id, 'missing_background');
    workspace.setPrimaryEnemy(level.id, 'missing_enemy');

    const issues = workspace.validatePackage();
    assert.equal(issues.some(issue => issue.code === 'missing_enemy_template' && issue.nodeId === 'node_2'), true);
    assert.equal(issues.some(issue => issue.code === 'missing_battle_background' && issue.levelId === level.id), true);
});
