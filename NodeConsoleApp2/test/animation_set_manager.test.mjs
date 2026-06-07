import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import { JSDOM } from 'jsdom';

const projectRoot = path.resolve(import.meta.dirname, '..');
const modelPath = path.join(projectRoot, 'script', 'editor', 'animation_set', 'AnimationSetWorkspace.js');
const pagePath = path.join(projectRoot, 'script', 'editor', 'animation_set', 'AnimationSetManagerPage.js');
const indexPath = path.join(projectRoot, 'script', 'editor', 'animation_set', 'index.js');
const dataPath = path.join(projectRoot, 'assets', 'data', 'animation_sets_v1.json');
const pageHtmlPath = path.join(projectRoot, 'test', 'animation_set_manager_v1.html');

async function importSourceModule(filePath) {
    assert.equal(fs.existsSync(filePath), true, `missing source file: ${filePath}`);
    let source = await fsp.readFile(filePath, 'utf8');
    if (filePath === pagePath) {
        const workspaceSource = await fsp.readFile(modelPath, 'utf8');
        const workspaceEncoded = Buffer.from(workspaceSource, 'utf8').toString('base64');
        source = source.replace("'./AnimationSetWorkspace.js'", `'data:text/javascript;base64,${workspaceEncoded}'`);
    }
    const encoded = Buffer.from(source, 'utf8').toString('base64');
    return import(`data:text/javascript;base64,${encoded}`);
}

function buildFixtureDocument() {
    return {
        schemaVersion: 1,
        meta: { id: 'animation_sets_v1' },
        animationSets: [
            {
                id: 'player_001_default',
                ownerType: 'player',
                ownerId: 'player_001',
                displayName: '主角001 默认动画集',
                defaultAnimation: 'walk',
                status: 'ready',
                clips: {
                    walk: {
                        key: 'walk',
                        sourceDir: 'source/character/walk',
                        sheetRef: '../source/character/walk/walk_sheet.png',
                        manifestRef: '../source/character/walk/walk_sheet.json',
                        frameWidth: 512,
                        frameHeight: 512,
                        columns: 8,
                        rows: 8,
                        frameCount: 61,
                        fps: 12,
                        loop: true,
                        status: 'ready'
                    },
                    idle: {
                        key: 'idle',
                        sourceDir: 'source/character/主角-001-状态-001-idle',
                        sheetRef: '../source/character/主角-001-状态-001-idle/idle_sheet.png',
                        manifestRef: '../source/character/主角-001-状态-001-idle/idle_sheet.json',
                        frameWidth: 512,
                        frameHeight: 512,
                        columns: 8,
                        rows: 8,
                        frameCount: 61,
                        fps: 16,
                        loop: true,
                        status: 'ready'
                    },
                    attack: {
                        key: 'attack',
                        sourceDir: 'source/character/主角-001-状态-001-attack',
                        sheetRef: '../source/character/主角-001-状态-001-attack/attack_sheet.png',
                        manifestRef: '../source/character/主角-001-状态-001-attack/attack_sheet.json',
                        frameCount: 61,
                        fps: 18,
                        loop: false,
                        returnTo: 'walk',
                        status: 'ready'
                    }
                },
                references: [
                    { type: 'player', id: 'player', field: 'animationSetRef' },
                    { type: 'skill', id: 'basic_attack', animationKey: 'attack' }
                ]
            },
            {
                id: 'enemy_001_default',
                ownerType: 'enemy',
                ownerId: 'enemy_001',
                displayName: '敌人001 默认动画集',
                defaultAnimation: 'attack1',
                status: 'warning',
                clips: {
                    attack1: {
                        key: 'attack1',
                        sourceDir: 'source/character/敌人-001-状态001-正常状态-attack1',
                        sheetRef: '../source/character/敌人-001-状态001-正常状态-attack1/attack1_sheet.png',
                        manifestRef: '../source/character/敌人-001-状态001-正常状态-attack1/attack1_sheet.json',
                        frameWidth: 512,
                        frameHeight: 512,
                        columns: 8,
                        rows: 8,
                        frameCount: 61,
                        fps: 12,
                        loop: true,
                        status: 'ready'
                    },
                    hit: {
                        key: 'hit',
                        status: 'missing',
                        fps: 16,
                        loop: false,
                        returnTo: 'attack1'
                    }
                },
                references: [{ type: 'enemy', id: 'enemy_v2_c1_01_razor_initiate', field: 'animationSetRef' }]
            }
        ]
    };
}

test('AnimationSetWorkspace groups ledger by concrete owner before animation sets', async () => {
    const { AnimationSetWorkspace } = await importSourceModule(modelPath);
    const workspace = new AnimationSetWorkspace(buildFixtureDocument());

    const owners = workspace.listOwners();
    assert.deepEqual(owners.map(owner => `${owner.ownerType}:${owner.ownerId}`), [
        'player:player_001',
        'enemy:enemy_001'
    ]);
    assert.equal(owners[0].setCount, 1);
    assert.equal(owners[0].clipCount, 3);
    assert.equal(owners[0].readyClipCount, 3);
    assert.equal(owners[0].status, 'ready');
    assert.equal(workspace.getOwnerSummary('enemy', 'enemy_001').issueCount, 1);
    assert.equal(workspace.findPrimarySetForOwner('player', 'player_001').id, 'player_001_default');
    assert.equal(workspace.listOwners({ ownerType: 'player', query: 'attack' }).length, 1);
    assert.equal(workspace.listOwners({ ownerType: 'enemy', query: 'player' }).length, 0);
});

test('AnimationSetWorkspace can add a new clip under the selected owner primary set', async () => {
    const { AnimationSetWorkspace } = await importSourceModule(modelPath);
    const workspace = new AnimationSetWorkspace(buildFixtureDocument());

    const clip = workspace.addClipToOwner('player', 'player_001', {
        key: 'dodge',
        sourceDir: 'source/character/player-dodge',
        fps: 20,
        loop: false,
        returnTo: 'walk'
    });

    assert.equal(clip.key, 'dodge');
    assert.equal(clip.status, 'planned');
    assert.equal(workspace.resolveClip('player_001_default', 'dodge').sourceDir, 'source/character/player-dodge');
    assert.equal(workspace.getOwnerSummary('player', 'player_001').clipCount, 4);
});

test('AnimationSetWorkspace can create a concrete owner with an empty default animation set', async () => {
    const { AnimationSetWorkspace } = await importSourceModule(modelPath);
    const workspace = new AnimationSetWorkspace(buildFixtureDocument());

    const animationSet = workspace.createOwner({
        ownerType: 'enemy',
        displayName: '敌人002 默认动画配置'
    });

    assert.equal(animationSet.id, 'enemy_002_default');
    assert.equal(animationSet.ownerType, 'enemy');
    assert.equal(animationSet.ownerId, 'enemy_002');
    assert.equal(animationSet.status, 'warning');
    assert.deepEqual(Object.keys(animationSet.clips), []);
    assert.equal(workspace.getOwnerSummary('enemy', 'enemy_002').clipCount, 0);
    const nextSet = workspace.createOwner({
        ownerType: 'enemy',
        displayName: '敌人003 默认动画配置'
    });
    assert.equal(nextSet.ownerId, 'enemy_003');
    assert.throws(() => workspace.createOwner({ ownerType: 'enemy', displayName: '' }), /名称/u);
});

test('animation set runtime asset file contains the provided player and enemy frame sequences', () => {
    assert.equal(fs.existsSync(dataPath), true, 'missing animation set ledger data file');
    const document = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const player = document.animationSets.find(item => item.id === 'player_001_default');
    const enemy = document.animationSets.find(item => item.id === 'enemy_001_default');

    assert.ok(player, 'missing player_001_default');
    assert.ok(enemy, 'missing enemy_001_default');
    assert.deepEqual(Object.keys(player.clips).filter(key => ['attack', 'idle', 'walk'].includes(key)).sort(), ['attack', 'idle', 'walk']);
    assert.ok(Object.keys(enemy.clips).includes('attack1'));
});

test('animation set manager page exposes object-ledger import and real preview controls', async () => {
    assert.equal(fs.existsSync(pageHtmlPath), true, 'missing animation set manager page');
    const html = await fsp.readFile(pageHtmlPath, 'utf8');

    for (const required of [
        'ownerTree',
        'newOwnerTypeInput',
        'newOwnerDisplayNameInput',
        'createOwnerBtn',
        'selectedOwnerTitle',
        'ownerAnimationSetList',
        'clipTableBody',
        'clipPreviewCanvas',
        'playPreviewBtn',
        'pausePreviewBtn',
        'previewTimeline',
        'previewFrameLabel',
        'newClipKeyInput',
        'localFrameDirectoryInput',
        'importClipBtn',
        'selectedClipFpsInput',
        'selectedClipLoopInput',
        'selectedClipReturnToInput',
        'actionPropertiesPanel',
        'actionOperationPanel',
        'buildSelectedBtn'
    ]) {
        assert.match(html, new RegExp(`id=["']${required}["']`), `page missing #${required}`);
    }

    assert.doesNotMatch(html, /当前动画机没有需要导入的 clip/u);
    assert.doesNotMatch(html, /台账/u);
    assert.doesNotMatch(html, /加载台账/u);
    assert.doesNotMatch(html, /重建当前动作/u);
    assert.doesNotMatch(html, /刷新配置/u);
    assert.doesNotMatch(html, /id=["']loadAnimationSetsBtn["']/u);
    assert.doesNotMatch(html, /id=["']newOwnerIdInput["']/u);
    assert.doesNotMatch(html, /webkitdirectory/u);
    assert.doesNotMatch(html, /id=["']frameDirectoryPicker["']/u);
    assert.doesNotMatch(html, /id=["']newClipSourceDirSelect["']/u);
    assert.doesNotMatch(html, /id=["']newClipSourceDirInput["']/u);
    assert.doesNotMatch(html, /id=["']newClipFpsInput["']/u);
    assert.doesNotMatch(html, /id=["']newClipLoopInput["']/u);
    assert.doesNotMatch(html, /id=["']newClipReturnToInput["']/u);
    assert.doesNotMatch(html, /id=["']updateClipPropertiesBtn["']/u);
    assert.doesNotMatch(html, /更新动作属性/u);
    assert.doesNotMatch(html, /对象是一级归属/u);
    assert.doesNotMatch(html, /只作用于/u);
    assert.doesNotMatch(html, /构建 sheet 与 manifest/u);
    assert.doesNotMatch(html, /<div class=["']timeline["']><\/div>/u);
    assert.match(html, /<progress id=["']previewTimeline["']/u);
    assert.match(html, /对象列表/u);
    assert.match(html, /配置文件/u);
    assert.match(html, /新建对象/u);
    assert.match(html, /动作操作区/u);
    assert.match(html, /重建选中动作资源/u);
    assert.match(html, /本地帧目录/u);
    assert.match(html, /动作属性/u);
    assert.match(html, /新增动作并导入/u);
    assert.match(html, /导入到当前对象/u);
    const staticDom = new JSDOM(html);
    assert.equal(staticDom.window.document.querySelector('.detail-toolbar #buildSelectedBtn'), null);
    assert.ok(staticDom.window.document.querySelector('#actionOperationPanel #buildSelectedBtn'));
    assert.equal(staticDom.window.document.querySelector('.detail #selectedClipFpsInput'), null);
    assert.ok(staticDom.window.document.querySelector('#actionPropertiesPanel #selectedClipFpsInput'));
    assert.equal(staticDom.window.document.querySelector('thead tr th:last-child').textContent, '操作');
    assert.match(html, /script\/editor\/animation_set\/index\.js/u);
});

test('AnimationSetManagerPage renders concrete owners and clips instead of a flat animation-set list', async () => {
    const { AnimationSetManagerPage } = await importSourceModule(pagePath);
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, { url: 'http://127.0.0.1:3106/test/animation_set_manager_v1.html' });
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {} });
    const fetchImpl = async () => ({
        ok: true,
        json: async () => ({ content: JSON.stringify(buildFixtureDocument()), path: 'assets/data/animation_sets_v1.json' })
    });
    const page = new AnimationSetManagerPage({ document: dom.window.document, fetchImpl });

    page.bind();
    await page.loadDefault();

    assert.match(dom.window.document.getElementById('ownerTree').textContent, /玩家/u);
    assert.match(dom.window.document.getElementById('ownerTree').textContent, /player_001/u);
    assert.match(dom.window.document.getElementById('ownerTree').textContent, /敌人/u);
    assert.match(dom.window.document.getElementById('ownerTree').textContent, /enemy_001/u);
    assert.match(dom.window.document.getElementById('selectedOwnerTitle').textContent, /player_001/u);
    assert.equal(dom.window.document.getElementById('ownerAnimationSetList').hidden, true);
    assert.match(dom.window.document.getElementById('clipTableBody').textContent, /walk/u);
    assert.match(dom.window.document.getElementById('clipTableBody').textContent, /idle/u);
    assert.match(dom.window.document.getElementById('clipTableBody').textContent, /attack/u);
    assert.equal(dom.window.document.querySelectorAll('#clipTableBody .delete-clip-btn').length, 3);
    assert.equal(dom.window.document.getElementById('metricOwnerCount').textContent, '2');
    assert.equal(dom.window.document.getElementById('metricClipCount').textContent, '5');
});

test('AnimationSetManagerPage imports a local frame directory as a new independent clip for the selected owner', async () => {
    const { AnimationSetManagerPage } = await importSourceModule(pagePath);
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:3106/test/animation_set_manager_v1.html',
        pretendToBeVisual: true
    });
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url).startsWith('/__skill_editor_file') && options.method !== 'POST') {
            return {
                ok: true,
                json: async () => ({ content: JSON.stringify(buildFixtureDocument()), path: 'assets/data/animation_sets_v1.json' })
            };
        }
        if (String(url) === '/__skill_editor_file' && options.method === 'POST') {
            return { ok: true, json: async () => ({ ok: true, path: 'assets/data/animation_sets_v1.json' }) };
        }
        if (String(url) === '/api/animation-assets/import-local-directory') {
            const payload = JSON.parse(options.body);
            assert.equal(payload.sourceDirectory, 'C:\\frames\\player-dodge');
            assert.equal(payload.targetName, 'player_001-dodge');
            return {
                ok: true,
                json: async () => ({
                    ok: true,
                    directory: 'source/character/player_001-dodge',
                    frameCount: 2,
                    files: [
                        { path: 'source/character/player_001-dodge/001.png' },
                        { path: 'source/character/player_001-dodge/002.png' }
                    ]
                })
            };
        }
        if (String(url).startsWith('/api/animation-assets/frames')) {
            return {
                ok: true,
                json: async () => ({
                    ok: true,
                    directory: 'source/character/player_001-dodge',
                    frameCount: 2,
                    frames: [
                        { name: '001.png', path: 'source/character/player_001-dodge/001.png' },
                        { name: '002.png', path: 'source/character/player_001-dodge/002.png' }
                    ]
                })
            };
        }
        if (String(url) === '/api/animation-assets/write') {
            return { ok: true, json: async () => ({ ok: true, files: [] }) };
        }
        throw new Error(`unexpected fetch ${url}`);
    };
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {} });
    dom.window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,ZmFrZQ==';
    const page = new AnimationSetManagerPage({
        document: dom.window.document,
        fetchImpl,
        ImageCtor: class FakeImage {
            set src(value) {
                this._src = value;
                this.width = 512;
                this.height = 512;
                setTimeout(() => this.onload?.(), 0);
            }
            get src() {
                return this._src;
            }
        }
    });

    page.bind();
    await page.loadDefault();
    dom.window.document.getElementById('newClipKeyInput').value = 'dodge';
    dom.window.document.getElementById('localFrameDirectoryInput').value = 'C:\\frames\\player-dodge';
    await page.importClipForSelectedOwner();

    assert.equal(page.workspace.resolveClip('player_001_default', 'dodge').status, 'ready');
    assert.equal(page.workspace.resolveClip('player_001_default', 'dodge').frameCount, 2);
    assert.equal(page.workspace.resolveClip('player_001_default', 'dodge').sourceDir, 'source/character/player_001-dodge');
    assert.equal(page.workspace.resolveClip('player_001_default', 'dodge').fps, 12);
    assert.equal(page.workspace.resolveClip('player_001_default', 'dodge').loop, true);
    assert(calls.some(call => call.url === '/api/animation-assets/import-local-directory'));
    assert(calls.some(call => call.url.includes('/api/animation-assets/frames?dir=source%2Fcharacter%2Fplayer_001-dodge')));
    const writeCall = calls.find(call => call.url === '/api/animation-assets/write');
    assert.ok(writeCall, 'missing built asset write call');
    assert.match(JSON.parse(writeCall.options.body).files[0].path, /source\/character\/player_001-dodge\/dodge_sheet\.png/u);
    const ledgerWrite = calls.find(call => call.url === '/__skill_editor_file' && call.options.method === 'POST');
    assert.ok(ledgerWrite, 'missing ledger write-back call');
    assert.match(JSON.parse(ledgerWrite.options.body).content, /"dodge"/u);
});

test('AnimationSetManagerPage autosaves selected clip playback properties from the right detail panel', async () => {
    const { AnimationSetManagerPage } = await importSourceModule(pagePath);
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:3106/test/animation_set_manager_v1.html',
        pretendToBeVisual: true
    });
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url).startsWith('/__skill_editor_file') && options.method !== 'POST') {
            return {
                ok: true,
                json: async () => ({ content: JSON.stringify(buildFixtureDocument()), path: 'assets/data/animation_sets_v1.json' })
            };
        }
        if (String(url) === '/__skill_editor_file' && options.method === 'POST') {
            return { ok: true, json: async () => ({ ok: true, path: 'assets/data/animation_sets_v1.json' }) };
        }
        throw new Error(`unexpected fetch ${url}`);
    };
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {} });
    const page = new AnimationSetManagerPage({ document: dom.window.document, fetchImpl });

    page.bind();
    await page.loadDefault();
    page.selectedClipKey = 'attack';
    page.render();
    dom.window.document.getElementById('selectedClipFpsInput').value = '24';
    dom.window.document.getElementById('selectedClipLoopInput').checked = true;
    dom.window.document.getElementById('selectedClipReturnToInput').value = 'idle';
    dom.window.document.getElementById('selectedClipFpsInput').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    await new Promise(resolve => setTimeout(resolve, 0));

    const clip = page.workspace.resolveClip('player_001_default', 'attack');
    assert.equal(clip.fps, 24);
    assert.equal(clip.loop, true);
    assert.equal(clip.returnTo, 'idle');
    const ledgerWrite = calls.find(call => call.url === '/__skill_editor_file' && call.options.method === 'POST');
    assert.ok(ledgerWrite, 'missing clip property write-back');
    assert.match(JSON.parse(ledgerWrite.options.body).content, /"fps": 24/u);
});

test('AnimationSetManagerPage deletes a clip row after confirmation and removes copied local assets', async () => {
    const { AnimationSetManagerPage } = await importSourceModule(pagePath);
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:3106/test/animation_set_manager_v1.html',
        pretendToBeVisual: true
    });
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url).startsWith('/__skill_editor_file') && options.method !== 'POST') {
            return {
                ok: true,
                json: async () => ({ content: JSON.stringify(buildFixtureDocument()), path: 'assets/data/animation_sets_v1.json' })
            };
        }
        if (String(url) === '/api/animation-assets/delete') {
            const payload = JSON.parse(options.body);
            assert.deepEqual(payload.paths, [
                'source/character/主角-001-状态-001-attack',
                'source/character/主角-001-状态-001-attack/attack_sheet.png',
                'source/character/主角-001-状态-001-attack/attack_sheet.json'
            ]);
            return { ok: true, json: async () => ({ ok: true, deleted: payload.paths }) };
        }
        if (String(url) === '/__skill_editor_file' && options.method === 'POST') {
            return { ok: true, json: async () => ({ ok: true, path: 'assets/data/animation_sets_v1.json' }) };
        }
        throw new Error(`unexpected fetch ${url}`);
    };
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {} });
    const page = new AnimationSetManagerPage({
        document: dom.window.document,
        fetchImpl,
        confirmImpl: message => {
            assert.match(message, /player_001_default\/attack/u);
            return true;
        }
    });

    page.bind();
    await page.loadDefault();
    page.selectedClipKey = 'attack';
    page.render();
    const attackRow = Array.from(dom.window.document.querySelectorAll('#clipTableBody tr'))
        .find(row => row.firstChild?.textContent === 'attack');
    assert.ok(attackRow, 'missing attack row');
    attackRow.querySelector('.delete-clip-btn').click();
    const deadline = Date.now() + 1000;
    while (!calls.some(call => call.url === '/__skill_editor_file' && call.options.method === 'POST')) {
        if (Date.now() > deadline) throw new Error('delete write-back did not finish');
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    assert.equal(page.workspace.resolveClip('player_001_default', 'attack')?.key, 'walk');
    assert.doesNotMatch(dom.window.document.getElementById('clipTableBody').textContent, /attack/u);
    assert(calls.some(call => call.url === '/api/animation-assets/delete'));
    const ledgerWrite = calls.find(call => call.url === '/__skill_editor_file' && call.options.method === 'POST');
    assert.ok(ledgerWrite, 'missing ledger write-back call');
    const writtenDocument = JSON.parse(JSON.parse(ledgerWrite.options.body).content);
    const writtenPlayerSet = writtenDocument.animationSets.find(item => item.id === 'player_001_default');
    assert.equal(writtenPlayerSet.clips.attack, undefined);
});

test('AnimationSetManagerPage creates a new owner record and persists the config', async () => {
    const { AnimationSetManagerPage } = await importSourceModule(pagePath);
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:3106/test/animation_set_manager_v1.html',
        pretendToBeVisual: true
    });
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {} });
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
        calls.push({ url: String(url), options });
        if (String(url).startsWith('/__skill_editor_file') && options.method !== 'POST') {
            return {
                ok: true,
                json: async () => ({ content: JSON.stringify(buildFixtureDocument()), path: 'assets/data/animation_sets_v1.json' })
            };
        }
        if (String(url) === '/__skill_editor_file' && options.method === 'POST') {
            return { ok: true, json: async () => ({ ok: true, path: 'assets/data/animation_sets_v1.json' }) };
        }
        throw new Error(`unexpected fetch ${url}`);
    };
    const page = new AnimationSetManagerPage({ document: dom.window.document, fetchImpl });

    page.bind();
    await page.loadDefault();
    dom.window.document.getElementById('newOwnerTypeInput').value = 'player';
    dom.window.document.getElementById('newOwnerDisplayNameInput').value = '主角002 默认动画配置';
    await page.createOwnerFromForm();

    assert.match(dom.window.document.getElementById('ownerTree').textContent, /player_002/u);
    assert.match(dom.window.document.getElementById('selectedOwnerTitle').textContent, /玩家 \/ player_002/u);
    assert.equal(dom.window.document.getElementById('clipTableBody').textContent.trim(), '');
    assert.equal(dom.window.document.getElementById('clipPreviewTitle').textContent, '当前对象还没有动作');
    assert.equal(dom.window.document.getElementById('previewFrameLabel').textContent, '0 / 0');
    const ledgerWrite = calls.find(call => call.url === '/__skill_editor_file' && call.options.method === 'POST');
    assert.ok(ledgerWrite, 'missing config write-back call');
    const saved = JSON.parse(JSON.parse(ledgerWrite.options.body).content);
    assert.ok(saved.animationSets.some(set => set.id === 'player_002_default' && set.ownerId === 'player_002'));
    assert.match(dom.window.document.getElementById('status').textContent, /自动分配 ID：player_002/u);
});

test('AnimationSetManagerPage preview advances spritesheet frames on canvas', async () => {
    const { AnimationSetManagerPage } = await importSourceModule(pagePath);
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:3106/test/animation_set_manager_v1.html',
        pretendToBeVisual: true
    });
    const drawCalls = [];
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({
        clearRect() {},
        drawImage(...args) {
            drawCalls.push(args);
        }
    });
    const page = new AnimationSetManagerPage({
        document: dom.window.document,
        fetchImpl: async () => ({
            ok: true,
            json: async () => ({ content: JSON.stringify(buildFixtureDocument()), path: 'assets/data/animation_sets_v1.json' })
        }),
        ImageCtor: class FakeImage {
            set src(value) {
                this._src = value;
                this.width = 4096;
                this.height = 4096;
                setTimeout(() => this.onload?.(), 0);
            }
            get src() {
                return this._src;
            }
        }
    });

    page.bind();
    await page.loadDefault();
    await new Promise(resolve => setTimeout(resolve, 0));
    page.advancePreviewFrame();
    page.advancePreviewFrame();

    assert.equal(page.previewState.frameIndex, 2);
    assert.ok(drawCalls.length >= 2, 'preview did not draw to canvas');
    assert.match(dom.window.document.getElementById('previewFrameLabel').textContent, /3 \/ 61/u);
    assert.equal(dom.window.document.getElementById('previewTimeline').value, 2);
    assert.equal(dom.window.document.getElementById('previewTimeline').max, 60);
});

test('AnimationSetManagerPage transport shows playback state and stops one-shot clips at the end', async () => {
    const { AnimationSetManagerPage } = await importSourceModule(pagePath);
    const html = await fsp.readFile(pageHtmlPath, 'utf8');
    const dom = new JSDOM(html, {
        url: 'http://127.0.0.1:3106/test/animation_set_manager_v1.html',
        pretendToBeVisual: true
    });
    dom.window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {} });
    let nextRafId = 1;
    const page = new AnimationSetManagerPage({
        document: dom.window.document,
        fetchImpl: async () => ({
            ok: true,
            json: async () => ({ content: JSON.stringify(buildFixtureDocument()), path: 'assets/data/animation_sets_v1.json' })
        }),
        ImageCtor: class FakeImage {
            set src(value) {
                this._src = value;
                this.width = 4096;
                this.height = 4096;
                setTimeout(() => this.onload?.(), 0);
            }
            get src() {
                return this._src;
            }
        },
        requestAnimationFrameImpl: () => nextRafId++,
        cancelAnimationFrameImpl: () => {}
    });

    page.bind();
    await page.loadDefault();
    await new Promise(resolve => setTimeout(resolve, 0));
    page.selectedClipKey = 'attack';
    page.render();
    await new Promise(resolve => setTimeout(resolve, 0));

    page.playPreview();
    assert.equal(page.previewState.isPlaying, true);
    assert.equal(dom.window.document.getElementById('playPreviewBtn').disabled, true);
    assert.equal(dom.window.document.getElementById('pausePreviewBtn').disabled, false);
    assert.equal(dom.window.document.getElementById('playPreviewBtn').getAttribute('aria-pressed'), 'true');

    page.previewState.frameIndex = 60;
    page.advancePreviewFrame();

    assert.equal(page.previewState.frameIndex, 60);
    assert.equal(page.previewState.isPlaying, false);
    assert.equal(dom.window.document.getElementById('playPreviewBtn').disabled, false);
    assert.equal(dom.window.document.getElementById('pausePreviewBtn').disabled, true);
    assert.equal(dom.window.document.getElementById('previewTimeline').value, 60);
    assert.match(dom.window.document.getElementById('previewFrameLabel').textContent, /61 \/ 61/u);
});

test('animation set editor index exports workspace and page modules', async () => {
    const source = fs.readFileSync(indexPath, 'utf8');
    assert.match(source, /AnimationSetWorkspace/u);
    assert.match(source, /AnimationSetManagerPage/u);
});
