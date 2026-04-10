import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

const repoRoot = path.resolve(import.meta.dirname, '..');
const workspaceModulePath = path.join(repoRoot, 'script', 'editor', 'level', 'LevelPackWorkspace.js');

function buildFixtureDoc() {
    return {
        $schemaVersion: 'levels_v1_wrapped',
        meta: {
            title: 'Fixture Level Pack',
            enums: {
                waveTypes: ['fixed'],
                slotLayoutIds: ['default_v1'],
                backgrounds: ['bg_forest_01']
            }
        },
        enemyPools: {
            pool_story_1: {
                id: 'pool_story_1',
                name: '故事敌人池 1',
                members: [{ templateId: 'enemy_story_1', position: 1 }]
            },
            pool_story_2: {
                id: 'pool_story_2',
                name: '故事敌人池 2',
                members: [{ templateId: 'enemy_story_2', position: 1 }]
            }
        },
        levels: {
            level_1_1: {
                id: 'level_1_1',
                name: '第一关',
                description: '第一关描述',
                flow: {
                    kind: 'story',
                    order: 1,
                    chapterId: 'chapter_1',
                    chapterOrder: 1,
                    chapterLabel: '第一章',
                    chapterTitle: '测试章节',
                    nodeLabel: '1-1',
                    objectiveText: '通过第一关'
                },
                selectionMeta: {
                    difficultyLabel: '标准',
                    enemyStyleTags: ['压迫'],
                    buildHint: '稳住节奏'
                },
                background: 'bg_forest_01',
                battleRules: {
                    slotLayoutId: 'default_v1'
                },
                waves: [
                    {
                        waveId: 'wave_1',
                        waveType: 'fixed',
                        enemyPoolId: 'pool_story_1'
                    }
                ],
                rewards: {
                    exp: 100,
                    gold: 50,
                    kp: 1
                }
            },
            level_1_2: {
                id: 'level_1_2',
                name: '第二关',
                description: '第二关描述',
                flow: {
                    kind: 'story',
                    order: 2,
                    chapterId: 'chapter_1',
                    chapterOrder: 1,
                    chapterLabel: '第一章',
                    chapterTitle: '测试章节',
                    nodeLabel: '1-2',
                    objectiveText: '通过第二关'
                },
                selectionMeta: {
                    difficultyLabel: '进阶',
                    enemyStyleTags: ['续航'],
                    buildHint: '留爆发'
                },
                background: 'bg_forest_01',
                battleRules: {
                    slotLayoutId: 'default_v1'
                },
                waves: [
                    {
                        waveId: 'wave_1',
                        waveType: 'fixed',
                        enemyPoolId: 'pool_story_2'
                    }
                ],
                rewards: {
                    exp: 120,
                    gold: 60,
                    kp: 1
                }
            },
            level_acceptance_1: {
                id: 'level_acceptance_1',
                name: '验收关卡',
                description: '验收描述',
                flow: {
                    kind: 'acceptance',
                    order: 101
                },
                background: 'bg_forest_01',
                battleRules: {
                    slotLayoutId: 'default_v1'
                },
                waves: [
                    {
                        waveId: 'wave_1',
                        waveType: 'fixed',
                        enemyPoolId: 'pool_story_1'
                    }
                ],
                rewards: {
                    exp: 0,
                    gold: 0,
                    kp: 0
                }
            }
        }
    };
}

async function importWorkspaceModule() {
    assert.equal(
        fs.existsSync(workspaceModulePath),
        true,
        'LevelPackWorkspace.js 缺失，正式关卡编辑器还没有纯数据工作区核心'
    );
    const source = await fsp.readFile(workspaceModulePath, 'utf8');
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

test('LevelPackWorkspace 能按 kind 列出关卡并补齐故事关卡 nextLevelIds', async () => {
    const { LevelPackWorkspace } = await importWorkspaceModule();
    const workspace = new LevelPackWorkspace(buildFixtureDoc());

    const storyLevelIds = workspace.listLevels({ kind: 'story' }).map(level => level.id);
    assert.deepEqual(storyLevelIds, ['level_1_1', 'level_1_2']);

    const level_1_1 = workspace.getLevel('level_1_1');
    assert.deepEqual(
        level_1_1.flow.nextLevelIds,
        ['level_1_2'],
        '未显式配置关系时，应按当前 story 顺序补出默认 nextLevelIds'
    );
});

test('LevelPackWorkspace 默认排序会让 story 关卡优先于 acceptance 关卡', async () => {
    const { LevelPackWorkspace } = await importWorkspaceModule();
    const workspace = new LevelPackWorkspace(buildFixtureDoc());

    const orderedLevelIds = workspace.listLevels().map(level => level.id);
    assert.deepEqual(
        orderedLevelIds.slice(0, 3),
        ['level_1_1', 'level_1_2', 'level_acceptance_1'],
        '正式编辑器默认应先落在 story 内容，acceptance 关卡排在后面'
    );
});

test('LevelPackWorkspace 可以新增关卡并自动创建首波敌人池', async () => {
    const { LevelPackWorkspace } = await importWorkspaceModule();
    const workspace = new LevelPackWorkspace(buildFixtureDoc());

    const newLevelId = workspace.createLevel({
        id: 'level_1_3',
        name: '第三关',
        kind: 'story',
        chapterId: 'chapter_1',
        chapterTitle: '测试章节'
    });

    const createdLevel = workspace.getLevel(newLevelId);
    assert.equal(createdLevel.id, 'level_1_3');
    assert.equal(createdLevel.waves.length, 1);
    assert.equal(createdLevel.waves[0].enemyPoolId, 'pool_level_1_3_wave_1');
    assert.equal(
        workspace.getEnemyPool('pool_level_1_3_wave_1').name,
        '第三关 Wave 1 敌人池'
    );
});

test('LevelPackWorkspace 删除关卡时会修剪其他关卡的 nextLevelIds', async () => {
    const { LevelPackWorkspace } = await importWorkspaceModule();
    const workspace = new LevelPackWorkspace(buildFixtureDoc());

    workspace.createLevel({
        id: 'level_1_3',
        name: '第三关',
        kind: 'story',
        chapterId: 'chapter_1',
        chapterTitle: '测试章节'
    });
    workspace.setNextLevelIds('level_1_2', ['level_1_3']);

    workspace.removeLevel('level_1_3');

    assert.deepEqual(workspace.getLevel('level_1_2').flow.nextLevelIds, []);
    assert.equal(workspace.getLevel('level_1_3'), null);
});

test('LevelPackWorkspace 会报告缺失的关卡连接和敌人池引用', async () => {
    const { LevelPackWorkspace } = await importWorkspaceModule();
    const workspace = new LevelPackWorkspace(buildFixtureDoc());

    workspace.setNextLevelIds('level_1_1', ['level_missing']);
    workspace.updateLevel('level_1_2', (level) => ({
        ...level,
        waves: [
            {
                ...level.waves[0],
                enemyPoolId: 'pool_missing'
            }
        ]
    }));

    const issueCodes = workspace.validateDocument().map(issue => issue.code).sort();
    assert.deepEqual(issueCodes, ['missing_enemy_pool', 'missing_next_level']);
});

test('LevelPackWorkspace 导出后仍保持 wrapped levels.json 结构', async () => {
    const { LevelPackWorkspace } = await importWorkspaceModule();
    const workspace = new LevelPackWorkspace(buildFixtureDoc());

    workspace.updateLevel('level_1_1', (level) => ({
        ...level,
        rewards: {
            ...level.rewards,
            kp: 3
        }
    }));

    const exported = workspace.exportDocument();
    assert.equal(exported.$schemaVersion, 'levels_v1_wrapped');
    assert.equal(typeof exported.meta, 'object');
    assert.equal(typeof exported.enemyPools, 'object');
    assert.equal(typeof exported.levels, 'object');
    assert.equal(exported.levels.level_1_1.rewards.kp, 3);
});
