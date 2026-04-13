import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(import.meta.dirname, '..');
const pageModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelEditorPage.js');
const workspaceModulePath = path.join(projectRoot, 'script', 'editor', 'level', 'LevelPackWorkspace.js');
const pageHtmlPath = path.join(projectRoot, 'test', 'level_editor_v1.html');
const probeHtmlPath = path.join(projectRoot, 'test', 'level_runtime_probe.html');
const smokeScriptPath = path.join(projectRoot, 'tools', 'level_editor_cdp_smoke.mjs');

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
            }
        }
    };
}

async function importSourceModule(filePath) {
    assert.equal(fs.existsSync(filePath), true, `缺少源文件: ${filePath}`);
    const source = await fsp.readFile(filePath, 'utf8');
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

function installDomGlobals(dom) {
    global.window = dom.window;
    global.document = dom.window.document;
    global.HTMLElement = dom.window.HTMLElement;
    global.Node = dom.window.Node;
    global.Event = dom.window.Event;
    global.CustomEvent = dom.window.CustomEvent;
}

function cleanupDomGlobals() {
    delete global.window;
    delete global.document;
    delete global.HTMLElement;
    delete global.Node;
    delete global.Event;
    delete global.CustomEvent;
}

function createPageFixture() {
    const dom = new JSDOM(`
        <!DOCTYPE html>
        <body>
            <div id="status"></div>
            <button id="loadDefaultBtn" type="button">load</button>
            <button id="addLevelBtn" type="button">add</button>
            <button id="removeLevelBtn" type="button">remove</button>
            <button id="saveLevelBtn" type="button">save level</button>
            <button id="addWaveBtn" type="button">add wave</button>
            <button id="removeWaveBtn" type="button">remove wave</button>
            <button id="saveWaveBtn" type="button">save wave</button>
            <button id="exportBtn" type="button">export</button>
            <button id="downloadBtn" type="button">download</button>
            <button id="applyOverrideBtn" type="button">apply override</button>
            <button id="clearOverrideBtn" type="button">clear override</button>
            <div id="levelList"></div>
            <div id="validationList"></div>
            <div id="selectedLevelId"></div>
            <input id="levelIdInput">
            <input id="levelNameInput">
            <textarea id="levelDescriptionInput"></textarea>
            <select id="levelKindSelect">
                <option value="story">story</option>
                <option value="acceptance">acceptance</option>
            </select>
            <input id="levelOrderInput" type="number">
            <input id="chapterIdInput">
            <input id="chapterOrderInput" type="number">
            <input id="chapterLabelInput">
            <input id="chapterTitleInput">
            <input id="nodeLabelInput">
            <textarea id="objectiveTextInput"></textarea>
            <select id="unlockModeInput">
                <option value="always">always</option>
                <option value="after_levels_cleared">after_levels_cleared</option>
            </select>
            <textarea id="unlockRequiredLevelIdsInput"></textarea>
            <input id="backgroundInput">
            <input id="slotLayoutIdInput">
            <select id="victoryConditionTypeInput">
                <option value="defeat_all_enemies">defeat_all_enemies</option>
                <option value="survive_rounds">survive_rounds</option>
            </select>
            <input id="victoryConditionValueInput" type="number">
            <select id="failureConditionTypeInput">
                <option value="player_hp_zero">player_hp_zero</option>
                <option value="body_part_broken">body_part_broken</option>
            </select>
            <input id="failureConditionTargetInput">
            <input id="difficultyLabelInput">
            <input id="enemyStyleTagsInput">
            <textarea id="buildHintInput"></textarea>
            <input id="rewardExpInput" type="number">
            <input id="rewardGoldInput" type="number">
            <input id="rewardKpInput" type="number">
            <div id="waveList"></div>
            <div id="selectedWaveId"></div>
            <input id="waveIdInput">
            <input id="waveTypeInput">
            <input id="waveEnemyPoolIdInput">
            <input id="enemyPoolNameInput">
            <textarea id="enemyMembersInput"></textarea>
            <input id="importJsonInput" type="file">
            <button id="importJsonBtn" type="button">import json</button>
            <textarea id="exportOutput"></textarea>
            <div id="overrideStatus"></div>
        </body>
    `, {
        url: 'http://127.0.0.1:3101/test/level_editor_v1.html'
    });

    installDomGlobals(dom);
    return dom;
}

async function createPageContext() {
    const [{ LevelEditorPage }, { LevelPackWorkspace }] = await Promise.all([
        importSourceModule(pageModulePath),
        importSourceModule(workspaceModulePath)
    ]);
    const fixtureDoc = buildFixtureDoc();
    const overrideWrites = [];
    const overrideStore = {
        set(contentKey, pack) {
            overrideWrites.push({
                contentKey,
                pack: JSON.parse(JSON.stringify(pack))
            });
            return pack;
        },
        clear() {
            overrideWrites.push({ contentKey: 'levels', cleared: true });
        },
        get() {
            return null;
        }
    };

    const page = new LevelEditorPage({
        document,
        defaultSourceUrl: '../assets/data/levels.json',
        fetchImpl: async () => ({
            ok: true,
            async json() {
                return JSON.parse(JSON.stringify(fixtureDoc));
            }
        }),
        workspaceFactory(rawDocument) {
            return new LevelPackWorkspace(rawDocument);
        },
        overrideStore,
        createObjectURL() {
            return 'blob:level-editor-test';
        },
        revokeObjectURL() {}
    });

    page.bind();
    return {
        page,
        fixtureDoc,
        overrideWrites
    };
}

test('LevelEditorPage 能加载默认关卡包并渲染简化后的关卡详情', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultPack();

        const listText = document.getElementById('levelList').textContent || '';
        const selectedLevelId = document.getElementById('selectedLevelId').textContent || '';
        const validationText = document.getElementById('validationList').textContent || '';
        assert.match(listText, /第一关/);
        assert.match(listText, /第二关/);
        assert.match(selectedLevelId, /level_1_1/);
        assert.match(document.getElementById('chapterTitleInput').value || '', /测试章节/);
        assert.match(validationText, /未发现结构问题/);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelEditorPage 保存关卡时不会导出旧版后继字段', async () => {
    const dom = createPageFixture();
    try {
        const { page, overrideWrites } = await createPageContext();
        await page.loadDefaultPack();

        document.getElementById('levelNameInput').value = '第一关·编辑后';
        document.getElementById('rewardKpInput').value = '3';
        document.getElementById('saveLevelBtn').click();

        document.getElementById('enemyPoolNameInput').value = '第一关敌人池·编辑后';
        document.getElementById('enemyMembersInput').value = 'enemy_story_1@1\nenemy_story_2@2';
        document.getElementById('saveWaveBtn').click();

        document.getElementById('exportBtn').click();
        const exported = JSON.parse(document.getElementById('exportOutput').value);
        assert.equal(exported.levels.level_1_1.name, '第一关·编辑后');
        assert.equal(exported.levels.level_1_1.rewards.kp, 3);
        assert.deepEqual(
            Object.keys(exported.levels.level_1_1.flow).sort(),
            ['chapterId', 'chapterLabel', 'chapterOrder', 'chapterTitle', 'kind', 'nodeLabel', 'objectiveText', 'order', 'unlockRules'].sort()
        );
        assert.equal(exported.enemyPools.pool_story_1.name, '第一关敌人池·编辑后');
        assert.deepEqual(
            exported.enemyPools.pool_story_1.members,
            [
                { templateId: 'enemy_story_1', position: 1 },
                { templateId: 'enemy_story_2', position: 2 }
            ]
        );

        document.getElementById('applyOverrideBtn').click();

        assert.equal(overrideWrites.length, 1, '应把当前导出 pack 写入 override');
        assert.equal(overrideWrites[0].contentKey, 'levels');
        assert.equal(overrideWrites[0].pack.levels.level_1_1.name, '第一关·编辑后');
        assert.match(document.getElementById('overrideStatus').textContent || '', /Runtime override active/);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelEditorPage 能保存 unlockRules 与胜败条件字段', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultPack();

        document.getElementById('unlockModeInput').value = 'after_levels_cleared';
        document.getElementById('unlockRequiredLevelIdsInput').value = 'level_1_2';
        document.getElementById('victoryConditionTypeInput').value = 'survive_rounds';
        document.getElementById('victoryConditionValueInput').value = '5';
        document.getElementById('failureConditionTypeInput').value = 'body_part_broken';
        document.getElementById('failureConditionTargetInput').value = 'head';

        document.getElementById('saveLevelBtn').click();
        document.getElementById('exportBtn').click();

        const exported = JSON.parse(document.getElementById('exportOutput').value);
        assert.deepEqual(exported.levels.level_1_1.flow.unlockRules, {
            mode: 'after_levels_cleared',
            requiredLevelIds: ['level_1_2']
        });
        assert.deepEqual(exported.levels.level_1_1.battleRules.victoryCondition, {
            type: 'survive_rounds',
            value: 5
        });
        assert.deepEqual(exported.levels.level_1_1.battleRules.failureCondition, {
            type: 'body_part_broken',
            target: 'head'
        });
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelEditorPage 能从 JSON 文本导入关卡包，并在非法 JSON 时抛出错误', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultPack();

        const imported = buildFixtureDoc();
        imported.levels.level_1_1.name = '第一关·导入后';
        imported.levels.level_1_1.flow.unlockRules = {
            mode: 'after_levels_cleared',
            requiredLevelIds: ['level_1_2']
        };

        await page.importDocumentFromText(JSON.stringify(imported));
        assert.match(document.getElementById('levelList').textContent || '', /第一关·导入后/);
        assert.equal(document.getElementById('unlockModeInput').value, 'after_levels_cleared');

        await assert.rejects(
            () => page.importDocumentFromText('{bad json'),
            /JSON|Unexpected token|非法/u
        );
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('level_editor_v1.html 会提供 unlockRules、胜败条件与 JSON 导入入口，并说明运行时闭环', async () => {
    assert.equal(fs.existsSync(pageHtmlPath), true, 'level_editor_v1.html 缺失');
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    for (const requiredText of [
        '导入现有 JSON',
        'importJsonInput',
        'importJsonBtn',
        'unlockModeInput',
        'unlockRequiredLevelIdsInput',
        'victoryConditionTypeInput',
        'victoryConditionValueInput',
        'failureConditionTypeInput',
        'failureConditionTargetInput',
        'after_levels_cleared',
        'survive_rounds',
        'body_part_broken',
        'level_editor_io_test.html',
        '导入 -> 编辑 -> 导出 -> Runtime Override -> Probe',
        '与其他页面的关系'
    ]) {
        assert.match(
            html,
            new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `正式关卡编辑页缺少入口或说明：${requiredText}`
        );
    }
});

test('level_runtime_probe.html 会展示解锁条件与胜败条件的运行时消费结果', async () => {
    assert.equal(fs.existsSync(probeHtmlPath), true, 'level_runtime_probe.html 缺失');
    const html = await fsp.readFile(probeHtmlPath, 'utf8');

    for (const requiredText of [
        'Unlock Rules',
        'Victory Condition',
        'Failure Condition',
        'resolvedUnlockRules',
        'resolvedVictoryCondition',
        'resolvedFailureCondition',
        'override 后的关卡配置'
    ]) {
        assert.match(
            html,
            new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `Runtime probe 缺少运行时字段展示：${requiredText}`
        );
    }
});

test('level_editor_cdp_smoke.mjs 会校验 unlockRules 与胜败条件的编辑到运行时闭环', async () => {
    assert.equal(fs.existsSync(smokeScriptPath), true, 'level_editor_cdp_smoke.mjs 缺失');
    const source = await fsp.readFile(smokeScriptPath, 'utf8');

    for (const requiredText of [
        'unlockModeInput',
        'unlockRequiredLevelIdsInput',
        'victoryConditionTypeInput',
        'victoryConditionValueInput',
        'failureConditionTypeInput',
        'failureConditionTargetInput',
        'resolvedUnlockRules',
        'resolvedVictoryCondition',
        'resolvedFailureCondition',
        'after_levels_cleared',
        'survive_rounds',
        'body_part_broken'
    ]) {
        assert.match(
            source,
            new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
            `CDP smoke 脚本缺少字段闭环校验：${requiredText}`
        );
    }
});
