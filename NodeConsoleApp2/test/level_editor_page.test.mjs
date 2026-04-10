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
                    objectiveText: '通过第一关',
                    nextLevelIds: ['level_1_2']
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
                    objectiveText: '通过第二关',
                    nextLevelIds: []
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
            <div id="nextLevelList"></div>
            <input id="backgroundInput">
            <input id="slotLayoutIdInput">
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

test('LevelEditorPage 能加载默认关卡包并渲染列表、详情和校验面板', async () => {
    const dom = createPageFixture();
    try {
        const { page } = await createPageContext();
        await page.loadDefaultPack();

        const listText = document.getElementById('levelList').textContent || '';
        const selectedLevelId = document.getElementById('selectedLevelId').textContent || '';
        const validationText = document.getElementById('validationList').textContent || '';
        const nextLevelCheckboxes = document.querySelectorAll('#nextLevelList input[type="checkbox"]');

        assert.match(listText, /第一关/);
        assert.match(listText, /第二关/);
        assert.match(selectedLevelId, /level_1_1/);
        assert.equal(nextLevelCheckboxes.length, 1, '故事关卡应渲染可维护的下一关复选框');
        assert.equal(nextLevelCheckboxes[0].checked, true, 'level_1_1 默认应指向 level_1_2');
        assert.match(validationText, /未发现结构问题/);
    } finally {
        dom.window.close();
        cleanupDomGlobals();
    }
});

test('LevelEditorPage 能保存关卡关系和敌人池成员，并导出与写入 override', async () => {
    const dom = createPageFixture();
    try {
        const { page, overrideWrites } = await createPageContext();
        await page.loadDefaultPack();

        document.getElementById('levelNameInput').value = '第一关·编辑后';
        document.getElementById('rewardKpInput').value = '3';
        const nextLevelCheckbox = document.querySelector('#nextLevelList input[type="checkbox"]');
        nextLevelCheckbox.checked = false;
        document.getElementById('saveLevelBtn').click();

        document.getElementById('enemyPoolNameInput').value = '第一关敌人池·编辑后';
        document.getElementById('enemyMembersInput').value = 'enemy_story_1@1\nenemy_story_2@2';
        document.getElementById('saveWaveBtn').click();

        document.getElementById('exportBtn').click();
        const exported = JSON.parse(document.getElementById('exportOutput').value);
        assert.equal(exported.levels.level_1_1.name, '第一关·编辑后');
        assert.equal(exported.levels.level_1_1.rewards.kp, 3);
        assert.deepEqual(exported.levels.level_1_1.flow.nextLevelIds, []);
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
